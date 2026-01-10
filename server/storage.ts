import { db } from "./db";
import {
  requests,
  drivers,
  users,
  transactions, // 🆕 تأكد من إضافة هذا الجدول في السكيما لاحقاً
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
  assignRequestToDriver(requestId: number, driverId: number): Promise<Request>;
  cancelRequestAssignment(requestId: number): Promise<Request>;
  
  // --- السائقين والمحفظة ---
  createDriver(driver: InsertDriver): Promise<Driver>;
  getDriver(id: number): Promise<Driver | undefined>;
  getDriverByPhone(phone: string): Promise<Driver | undefined>;
  getDrivers(): Promise<Driver[]>;
  updateDriverStatus(id: number, isOnline: boolean): Promise<Driver>;
  updateDriver(id: number, update: Partial<Driver>): Promise<Driver>;
  deleteDriver(id: number): Promise<void>;
  updateDriverApprovalStatus(id: number, status: string): Promise<Driver>;
  
  // --- 🆕 دوال العمليات المالية (المفقودة والتي تسببت بالمشكلة) ---
  createTransaction(data: any): Promise<any>;
  getDriverTransactions(driverId: number): Promise<any[]>;
  
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
      isOnline: false,
      avatarUrl: null // تهيئة حقل الصورة
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

  // 3. التحديث والحذف (تم الحفاظ عليها لدعم الصورة والموقع)
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

  // 🆕 4. إضافة دوال سجل العمليات المالية (لحل مشكلة المحفظة)
  async createTransaction(data: { driverId: number; amount: string; type: string; referenceId: string }): Promise<any> {
    const [tx] = await db.insert(transactions).values({
      ...data,
      createdAt: new Date()
    }).returning();
    return tx;
  }

  async getDriverTransactions(driverId: number): Promise<any[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.driverId, driverId))
      .orderBy(desc(transactions.id));
  }

  // 5. منطق الرحلات
  async updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request> {
    const [updated] = await db.update(requests).set({ status, rating, paymentMethod }).where(eq(requests.id, id)).returning();
    return updated;
  }

  // 6. استرجاع الأموال
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

  // 7. قبول الطلب (تعديل المنطق ليتوافق مع الرصيد)
  async acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }> {
    return await db.transaction(async (tx) => {
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const balance = parseFloat(driver.walletBalance);
      // جعلنا الحد الأدنى للرصيد 1000 دينار كما في الرووت
      if (balance < 1000) {
        throw new Error("رصيدك غير كافٍ. يرجى شحن المحفظة (أقل رصيد مطلوب 1000 دينار).");
      }

      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "pending") throw new Error("الطلب تم قبوله من سائق آخر");

      // تحديث الحالة وتعيين السائق (الخصم يتم عند الإكمال لضمان حق السائق)
      const [updatedRequest] = await tx
        .update(requests)
        .set({ status: "confirmed", driverId })
        .where(eq(requests.id, requestId))
        .returning();

      return { request: updatedRequest, driver };
    });
  }
}

export const storage = new DatabaseStorage();