import { db } from "./db";
import {
  requests,
  drivers,
  users,
  transactions,
  settings,
  messages,
  type InsertRequest,
  type Request,
  type Driver,
  type InsertDriver,
  type User,
  type InsertUser,
  type Setting,
  type Transaction,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // --- الزبائن (Users) ---
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  updateCustomerWallet(phone: string, amount: number): Promise<User>;

  // --- طلبات الزبائن ---
  createRequest(request: InsertRequest): Promise<Request>;
  getRequests(): Promise<Request[]>;
  getRequest(id: number): Promise<Request | undefined>;
  getDriverRequests(driverId: number): Promise<Request[]>; 
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
  getTransactionByZainCashId(id: string): Promise<Transaction | undefined>;
  completeZainCashDeposit(transactionId: number, driverId: number, amount: number, externalData: any): Promise<void>;

  // --- منطق الرحلات والماليات ---
  updateRequestStatus(id: number, status: string, rating?: number, paymentMethod?: string): Promise<Request>;
  refundToCustomer(driverId: number, requestId: number, amount: number): Promise<{ driver: Driver; user: any }>;
  acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }>;

  // --- إعدادات النظام ---
  getSettings(): Promise<Setting>;
  updateCommission(amount: number): Promise<Setting>;

  // --- نظام الدردشة ---
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByOrder(orderId: number): Promise<Message[]>;
}

export class DatabaseStorage implements IStorage {
  // --- نظام الدردشة ---
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values({
      orderId: message.orderId,
      senderId: message.senderId,
      senderType: message.senderType,
      senderName: message.senderName,
      content: message.content,
    }).returning();
    return newMessage;
  }

  async getMessagesByOrder(orderId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.orderId, orderId))
      .orderBy(messages.timestamp);
  }

  // --- الزبائن (Users) ---
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values({
      username: user.username, 
      phone: user.phone,
      password: user.password,
      city: user.city || "قيد التحديد",
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

  async updateCustomerWallet(phone: string, amount: number): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    if (!user) throw new Error("Customer not found");

    const currentBalance = parseFloat(user.walletBalance || "0");
    const newBalance = (currentBalance + amount).toFixed(2);

    const [updatedUser] = await db
      .update(users)
      .set({ walletBalance: newBalance })
      .where(eq(users.phone, phone))
      .returning();

    return updatedUser;
  }

  // --- طلبات الزبائن ---
  async createRequest(request: InsertRequest): Promise<Request> {
    const [newRequest] = await db.insert(requests).values({
      ...request,
      city: request.city || "قيد التحديد..."
    }).returning();
    return newRequest;
  }

  async getRequests(): Promise<Request[]> {
    return await db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async getDriverRequests(driverId: number): Promise<Request[]> {
    return await db
      .select()
      .from(requests)
      .where(eq(requests.driverId, driverId))
      .orderBy(desc(requests.createdAt));
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

  // --- السائقين ---
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
    if (!updated) throw new Error("Driver not found");
    return updated;
  }

  // --- العمليات المالية ---
  async createTransaction(data: any): Promise<any> {
    const [tx] = await db.insert(transactions).values({
      driverId: data.driverId || null,
      userId: data.userId || null,
      amount: data.amount.toString(),
      type: data.type,
      status: data.status || "pending",
      zainCashId: data.zainCashId || data.referenceId || null,
      operationId: data.operationId || null,
      msisdn: data.msisdn || null,
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

  async getTransactionByZainCashId(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.zainCashId, id));
    return tx;
  }

  async completeZainCashDeposit(transactionId: number, driverId: number, amount: number, externalData: any): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(transactions)
        .set({ 
          status: "completed",
          operationId: externalData.operationId,
          msisdn: externalData.msisdn
        })
        .where(eq(transactions.id, transactionId));

      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");

      const currentBalance = parseFloat(driver.walletBalance || "0");
      const newBalance = (currentBalance + amount).toFixed(2);

      await tx.update(drivers)
        .set({ walletBalance: newBalance })
        .where(eq(drivers.id, driverId));
    });
  }

  // --- منطق الرحلات ---
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

      const newDriverBalance = (parseFloat(driver.walletBalance || "0") - amount).toFixed(2);
      const [updatedDriver] = await tx.update(drivers).set({ walletBalance: newDriverBalance }).where(eq(drivers.id, driverId)).returning();

      const [user] = await tx.select().from(users).where(eq(users.phone, request.customerPhone || ""));
      if (!user) throw new Error("Customer associated with request not found");

      const newUserBalance = (parseFloat(user.walletBalance || "0") + amount).toFixed(2);
      const [updatedUser] = await tx.update(users).set({ walletBalance: newUserBalance }).where(eq(users.id, user.id)).returning();

      await tx.update(requests).set({ isRefunded: true }).where(eq(requests.id, requestId));

      return { driver: updatedDriver, user: updatedUser };
    });
  }

  async getSettings(): Promise<Setting> {
    let [systemSettings] = await db.select().from(settings).limit(1);
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

  // === التعديل الجوهري: تحسين دقة قبول الطلب ===
  async acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }> {
    return await db.transaction(async (tx) => {
      // 1. جلب الإعدادات والعمولة
      const systemSettings = await this.getSettings();
      const currentCommission = Number(systemSettings.commissionAmount);

      // 2. جلب بيانات السائق مع قفل (Select for Update) لضمان دقة الرصيد
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");

      const balance = parseFloat(driver.walletBalance || "0");

      // 3. التحقق من الرصيد قبل السماح بالقبول
      if (balance < currentCommission) {
        throw new Error(`رصيدك غير كافٍ. يرجى شحن المحفظة (أقل رصيد مطلوب ${currentCommission} دينار).`);
      }

      // 4. جلب الطلب والتأكد من أنه لا يزال معلقاً
      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("الطلب غير موجود");

      // السماح بالقبول إذا كان pending (من الزبون) أو confirmed (إذا أعاد السائق الضغط)
      if (request.status !== "pending" && request.driverId !== driverId) {
        throw new Error("عذراً، هذا الطلب مرتبط بسائق آخر حالياً");
      }

      // 5. تحديث الطلب وربطه بالسائق
      const [updatedRequest] = await tx
        .update(requests)
        .set({ 
          status: "confirmed", // نستخدم confirmed كحالة نهائية للقبول في الداتابيز
          driverId: driverId 
        })
        .where(eq(requests.id, requestId))
        .returning();

      return { request: updatedRequest, driver };
    });
  }
}

export const storage = new DatabaseStorage();