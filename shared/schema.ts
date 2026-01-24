import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === 1. إعدادات النظام (Settings) ===
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  commissionAmount: integer("commission_amount").notNull().default(1000),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === 2. جدول المستخدمين (Users) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(), // تم التعديل من name إلى username ليتوافق مع السيرفر
  phone: text("phone").notNull().unique(), 
  password: text("password").notNull(), 
  city: text("city").default("غير محدد"), 
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
});

// === 3. جدول السائقين (Drivers) ===
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  password: text("password").notNull(), 
  city: text("city").notNull(), 
  vehicleType: text("vehicle_type").notNull(), 
  plateNumber: text("plate_number").notNull(), 
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isOnline: boolean("is_online").default(sql`false`),
  status: text("status").notNull().default("pending"), 
  createdAt: timestamp("created_at").defaultNow(),
  lastLat: text("last_lat"),
  lastLng: text("last_lng"),
  avatarUrl: text("avatar_url"), 
});

// === 4. جدول الطلبات (Requests) ===
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").default("زبون"), 
  customerPhone: text("customer_phone").default("07700000000"),
  customerWalletBalance: decimal("customer_wallet_balance", { precision: 10, scale: 2 }).default("0.00"),
  vehicleType: text("vehicle_type").notNull(), 
  price: text("price").notNull(),
  location: text("location").default("لم يحدد العنوان"), 
  pickupAddress: text("pickup_address"), 
  pickupLat: text("pickup_lat"),
  pickupLng: text("pickup_lng"),
  destination: text("destination").default("غير محدد"),
  destLat: text("dest_lat"),
  destLng: text("dest_lng"),
  city: text("city"), 
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").default("pending"),
  driverId: integer("driver_id").references(() => drivers.id), 
  createdAt: timestamp("created_at").defaultNow(),
  rating: integer("rating"),
  paymentMethod: text("payment_method"),
  isRefunded: boolean("is_refunded").default(sql`false`),
});

// === 5. جدول العمليات المالية (Transactions) ===
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => drivers.id), 
  userId: integer("user_id").references(() => users.id), 
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), 
  type: text("type").notNull(), 
  status: text("status").notNull().default("pending"), 
  zainCashId: text("zain_cash_id"), 
  msisdn: text("msisdn"), 
  operationId: text("operation_id"), 
  createdAt: timestamp("created_at").defaultNow(),
});

// === قواعد التحقق (Validation Schemas) ===

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true
});

export const insertRequestSchema = createInsertSchema(requests, {
  city: z.string().optional().nullable(), 
  location: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  vehicleType: z.string().optional().nullable(),
  price: z.string().optional().nullable(),
  driverId: z.number().optional().nullable(),
}).omit({ 
  id: true, 
  status: true, 
  createdAt: true,
  // تمت إزالة omit لـ customerWalletBalance للسماح للسيرفر بتحديثها عند الحاجة
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(2, "الاسم مطلوب"),
  city: z.string().optional().nullable(),
}).omit({
  id: true,
  walletBalance: true
});

export const insertDriverSchema = createInsertSchema(drivers, {
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 رموز"),
  city: z.string().min(2, "يرجى إدخل المدينة"),
  plateNumber: z.string().min(2, "رقم اللوحة مطلوب"),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
}).omit({
  id: true,
  walletBalance: true,
  isOnline: true,
  status: true,
  createdAt: true,
  lastLat: true,
  lastLng: true,
  avatarUrl: true 
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true
});

export const loginSchema = z.object({
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور قصيرة جداً"),
});

// === أنواع البيانات (Types) ===
export type Setting = typeof settings.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// خيارات السيارات
export const VEHICLE_OPTIONS = [
  { id: "small", label: "سطحة صغيرة", price: "25,000 د.ع", priceValue: 25000, description: "Small Flatbed" },
  { id: "large", label: "سطحة كبيرة (لوري)", price: "50,000 د.ع", priceValue: 50000, description: "Large Flatbed" },
  { id: "hydraulic", label: "سطحة هيدروليك", price: "40,000 د.ع", priceValue: 40000, description: "Hydraulic Flatbed" },
] as const;