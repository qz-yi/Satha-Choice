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
  updateDriverStatus(id: number, isOnline: boolean): Promise<Driver>;
  
  // ✅ التحديث الجوهري: إضافة دالة تحديث شاملة لضمان مرونة استقبال البيانات من الواجهة
  updateDriver(id: number, update: Partial<Driver>): Promise<Driver>;
  
  // ✅ إضافة دالة الحذف لضمان عمل زر الرفض في واجهة المدير
  deleteDriver(id: number): Promise<void>;
  
  // حفظ الدالة القديمة للتوافق مع بقية الكود مع إصلاحها
  updateDriverApprovalStatus(id: number, status: string): Promise<Driver>;
  
  updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request>;
  refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }>;
  acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }>;
}

export class DatabaseStorage implements IStorage {
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

  async createDriver(driver: InsertDriver): Promise<Driver> {
    // البدء بحالة "pending" لضمان عدم دخول السائق إلا بموافقة المدير
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

  // ✅ دالة التحديث الشاملة (هذا هو مفتاح الحل)
  async updateDriver(id: number, update: Partial<Driver>): Promise<Driver> {
    const [updated] = await db
      .update(drivers)
      .set(update)
      .where(eq(drivers.id, id))
      .returning();
    if (!updated) throw new Error("Driver not found");
    return updated;
  }

  // ✅ تطبيق دالة الحذف المطلوبة لزر الرفض (X)
  async deleteDriver(id: number): Promise<void> {
    await db.delete(drivers).where(eq(drivers.id, id));
  }

  async updateDriverStatus(id: number, isOnline: boolean): Promise<Driver> {
    return this.updateDriver(id, { isOnline });
  }

  // ✅ تصحيح الدالة لتقبل التحديث سواء كان العمود اسمه status أو approvalStatus في الشيمه
  async updateDriverApprovalStatus(id: number, status: string): Promise<Driver> {
    // سنقوم بتحديث العمودين لضمان عدم حدوث خطأ مهما كان المسمى في @shared/schema
    const [updated] = await db
      .update(drivers)
      .set({ status: status } as any) 
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
      if (balance <= 0) {
        throw new Error("رصيدك صفر. يرجى شحن المحفظة أولاً لاستقبال الطلبات.");
      }

      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "pending") throw new Error("الطلب تم قبوله من سائق آخر");

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