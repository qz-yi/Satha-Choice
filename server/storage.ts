import { db } from "./db";
import {
  requests,
  drivers,
  type InsertRequest,
  type Request,
  type Driver,
  type InsertDriver,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  createRequest(request: InsertRequest): Promise<Request>;
  getRequests(): Promise<Request[]>;
  getRequest(id: number): Promise<Request | undefined>;
  
  // Driver & Wallet methods
  createDriver(driver: InsertDriver): Promise<Driver>;
  getDriver(id: number): Promise<Driver | undefined>;
  getDrivers(): Promise<Driver[]>;
  // ✅ دالة تحديث حالة الاتصال (أونلاين/أوفلاين)
  updateDriverStatus(id: number, isOnline: boolean): Promise<Driver>;
  // ✅ دالة تفعيل السائق من قبل المدير (مقبول/مرفوض)
  updateDriverApprovalStatus(id: number, status: string): Promise<Driver>;
  
  updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request>;
  refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }>;
  acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }>;
}

export class DatabaseStorage implements IStorage {
  async createRequest(request: InsertRequest): Promise<Request> {
    const [newRequest] = await db
      .insert(requests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getRequests(): Promise<Request[]> {
    return await db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request;
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    // ✅ التأكد من أن السائق الجديد يبدأ دائماً بحالة "pending" ورصيد صفر
    const [newDriver] = await db.insert(drivers).values({
      ...driver,
      status: "pending",
      walletBalance: "0",
      isOnline: false
    }).returning();
    return newDriver;
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).orderBy(desc(drivers.id));
  }

  async updateDriverStatus(id: number, isOnline: boolean): Promise<Driver> {
    const [updated] = await db.update(drivers).set({ isOnline }).where(eq(drivers.id, id)).returning();
    return updated;
  }

  // ✅ الدالة الجديدة التي سيتصل بها زر "تفعيل" في لوحة المدير
  async updateDriverApprovalStatus(id: number, status: string): Promise<Driver> {
    const [updated] = await db
      .update(drivers)
      .set({ status })
      .where(eq(drivers.id, id))
      .returning();
    return updated;
  }

  async updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request> {
    const [updated] = await db.update(requests).set({ status, rating, paymentMethod }).where(eq(requests.id, id)).returning();
    return updated;
  }

  async refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }> {
    return await db.transaction(async (tx) => {
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");

      const newDriverBalance = (parseFloat(driver.walletBalance) - amount).toFixed(2);
      const [updatedDriver] = await tx.update(drivers).set({ walletBalance: newDriverBalance }).where(eq(drivers.id, driverId)).returning();
      
      // For MVP, we'll assume a single user for simplicity
      const [user] = await tx.select().from(sql`users`).limit(1);
      const newUserBalance = (parseFloat(user.walletBalance) + amount).toFixed(2);
      const [updatedUser] = await tx.update(sql`users`).set({ walletBalance: newUserBalance }).returning();
      
      await tx.update(requests).set({ isRefunded: true }).where(eq(requests.id, requestId));

      return { driver: updatedDriver, user: updatedUser };
    });
  }

  async acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }> {
    return await db.transaction(async (tx) => {
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const balance = parseFloat(driver.walletBalance);
      // ✅ قيد الأمان: لا يمكن القبول إذا كان الرصيد صفر
      if (balance <= 0) {
        throw new Error("رصيدك صفر. يرجى شحن المحفظة أولاً لاستقبال الطلبات.");
      }

      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "pending") throw new Error("الطلب تم قبوله من سائق آخر");

      // خصم العمولة 10%
      const numericPrice = parseInt(request.price.replace(/[^0-9]/g, "")) || 0;
      const commission = numericPrice * 0.1;
      const newBalance = (balance - commission).toFixed(2);

      const [updatedDriver] = await tx
        .update(drivers)
        .set({ walletBalance: newBalance })
        .where(eq(drivers.id, driverId))
        .returning();

      const [updatedRequest] = await tx
        .update(requests)
        .set({ status: "confirmed", driverId })
        .where(eq(requests.id, requestId))
        .returning();

      return { request: updatedRequest, driver: updatedDriver };
    });
  }
}

export const storage = new DatabaseStorage();