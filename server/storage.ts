import { db } from "./db";
import {
  requests,
  drivers,
  users, // تأكدت من وجودها هنا
  type InsertRequest,
  type Request,
  type Driver,
  type InsertDriver,
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // --- طلبات الزبائن ---
  createRequest(request: InsertRequest): Promise<Request>;
  getRequests(): Promise<Request[]>;
  getRequest(id: number): Promise<Request | undefined>;
  // إضافات جديدة للمسؤول (Admin)
  assignRequestToDriver(requestId: number, driverId: number): Promise<Request>;
  cancelRequestAssignment(requestId: number): Promise<Request>;
  
  // --- السائقين والمحفظة ---
  createDriver(driver: InsertDriver): Promise<Driver>;
  getDriver(id: number): Promise<Driver | undefined>;
  getDriverByPhone(phone: string): Promise<Driver | undefined>; // ميزة الدخول الجديدة
  getDrivers(): Promise<Driver[]>;
  updateDriverStatus(id: number, isOnline: boolean): Promise<Driver>;
  updateDriver(id: number, update: Partial<Driver>): Promise<Driver>;
  deleteDriver(id: number): Promise<void>;
  updateDriverApprovalStatus(id: number, status: string): Promise<Driver>;
  
  // --- منطق الرحلات والماليات ---
  updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request>;
  refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }>;
  acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }>;
}

export class DatabaseStorage implements IStorage {
  // 1. إدارة الطلبات
  async createRequest(request: InsertRequest): Promise<Request> {
    const [newRequest] = await db.insert(requests).values(request).returning();
    return newRequest;
  }

  async getRequests(): Promise<Request[]> {
    return await db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request;
  }

  // --- دوال التحكم المباشر (Admin Control) ---
  
  async assignRequestToDriver(requestId: number, driverId: number): Promise<Request> {
    const [updated] = await db
      .update(requests)
      .set({ 
        driverId: driverId,
        status: "confirmed" 
      })
      .where(eq(requests.id, requestId))
      .returning();
    if (!updated) throw new Error("Request not found");
    return updated;
  }

  async cancelRequestAssignment(requestId: number): Promise<Request> {
    const [updated] = await db
      .update(requests)
      .set({ 
        driverId: null,
        status: "pending"
      })
      .where(eq(requests.id, requestId))
      .returning();
    if (!updated) throw new Error("Request not found");
    return updated;
  }

  // 2. إدارة السائقين
  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [newDriver] = await db.insert(drivers).values({
      ...driver,
      status: "pending", 
      walletBalance: "0.00",
      isOnline: false
    }).returning();
    return newDriver;
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async getDriverByPhone(phone: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.phone, phone));
    return driver;
  }

  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).orderBy(desc(drivers.id));
  }

  // 3. التحديث والحذف (التي أصلحناها سابقاً)
  async updateDriver(id: number, update: Partial<Driver>): Promise<Driver> {
    const [updated] = await db
      .update(drivers)
      .set(update)
      .where(eq(drivers.id, id))
      .returning();
    if (!updated) throw new Error("Driver not found");
    return updated;
  }

  async deleteDriver(id: number): Promise<void> {
    await db.delete(drivers).where(eq(drivers.id, id));
  }

  async updateDriverStatus(id: number, isOnline: boolean): Promise<Driver> {
    return this.updateDriver(id, { isOnline });
  }

  async updateDriverApprovalStatus(id: number, status: string): Promise<Driver> {
    const [updated] = await db
      .update(drivers)
      .set({ status: status } as any) 
      .where(eq(drivers.id, id))
      .returning();
    return updated;
  }

  // 4. منطق الرحلات (الذي تطلب عدم حذفه)
  async updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request> {
    const [updated] = await db.update(requests).set({ status, rating, paymentMethod }).where(eq(requests.id, id)).returning();
    return updated;
  }

  // 5. استرجاع الأموال (Transaction)
  async refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }> {
    return await db.transaction(async (tx) => {
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");

      const newDriverBalance = (parseFloat(driver.walletBalance) - amount).toFixed(2);
      const [updatedDriver] = await tx.update(drivers).set({ walletBalance: newDriverBalance }).where(eq(drivers.id, driverId)).returning();
      
      const [user] = await tx.select().from(users).limit(1);
      const newUserBalance = (parseFloat(user.walletBalance) + amount).toFixed(2);
      const [updatedUser] = await tx.update(users).set({ walletBalance: newUserBalance }).returning();
      
      await tx.update(requests).set({ isRefunded: true }).where(eq(requests.id, requestId));

      return { driver: updatedDriver, user: updatedUser };
    });
  }

  // 6. قبول الطلب وخصم العمولات (Logic كامل)
  async acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }> {
    return await db.transaction(async (tx) => {
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const balance = parseFloat(driver.walletBalance);
      if (balance <= 0) {
        throw new Error("رصيدك صفر. يرجى شحن المحفظة أولاً لاستقبال الطلبات.");
      }

      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "pending") throw new Error("الطلب تم قبوله من سائق آخر");

      const numericPrice = parseInt(request.price.replace(/[^0-9]/g, "")) || 0;
      const commission = numericPrice * 0.1; // عمولة 10%
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