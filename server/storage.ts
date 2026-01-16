import { db } from "./db";
import {
  requests,
  drivers,
  users,
  transactions,
  settings, // إضافة جدول الإعدادات
  type InsertRequest,
  type Request,
  type Driver,
  type InsertDriver,
  type User,
  type InsertUser,
  type Setting, // إضافة نوع الإعدادات
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // --- الزبائن (Users) ---
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;

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
  
  // --- دوال العمليات المالية ---
  createTransaction(data: any): Promise<any>;
  getDriverTransactions(driverId: number): Promise<any[]>;
  
  // --- منطق الرحلات والماليات ---
  updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request>;
  refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }>;
  acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }>;

  // --- التعديل الجديد: إعدادات النظام ---
  getSettings(): Promise<Setting>;
  updateCommission(amount: number): Promise<Setting>;
}

export class DatabaseStorage implements IStorage {
  // ✅ إدارة الزبائن
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values({
      ...user,
      walletBalance: "0.00"
    }).returning();
    return newUser;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

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
      avatarUrl: null
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

  // 4. العمليات المالية
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

  // 🛠️ التعديل الجذري: سحب العمولة ديناميكياً من قاعدة البيانات
  async getSettings(): Promise<Setting> {
    let [systemSettings] = await db.select().from(settings).limit(1);
    
    // في حال كان الجدول فارغاً (أول تشغيل)، نقوم بإنشاء سجل افتراضي
    if (!systemSettings) {
      [systemSettings] = await db.insert(settings).values({
        commissionAmount: 1000,
      }).returning();
    }
    return systemSettings;
  }

  async updateCommission(amount: number): Promise<Setting> {
    const currentSettings = await this.getSettings();
    const [updated] = await db
      .update(settings)
      .set({ commissionAmount: amount, updatedAt: new Date() })
      .where(eq(settings.id, currentSettings.id))
      .returning();
    return updated;
  }

  // 7. قبول الطلب (معدلة لتستخدم العمولة الديناميكية)
  async acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }> {
    return await db.transaction(async (tx) => {
      // جلب العمولة الحالية من الإعدادات
      const systemSettings = await this.getSettings();
      const currentCommission = systemSettings.commissionAmount;

      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const balance = parseFloat(driver.walletBalance);
      
      // استخدام المتغير currentCommission بدلاً من 1000 الثابتة
      if (balance < currentCommission) {
        throw new Error(`رصيدك غير كافٍ. يرجى شحن المحفظة (أقل رصيد مطلوب ${currentCommission} دينار).`);
      }

      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "pending") throw new Error("الطلب تم قبوله من سائق آخر");

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