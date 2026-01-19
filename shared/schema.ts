import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  commissionAmount: integer("commission_amount").notNull().default(1000),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").default("زبون"), 
  customerPhone: text("customer_phone").default("07700000000"),
  // +++ التعديل الجوهري: إضافة حقل الرصيد هنا لكي يظهر في لوحة الإدارة +++
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
  city: text("city").default("بغداد"), 
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").default("pending"),
  driverId: integer("driver_id").references(() => drivers.id), 
  createdAt: timestamp("created_at").defaultNow(),
  rating: integer("rating"),
  paymentMethod: text("payment_method"),
  isRefunded: boolean("is_refunded").default(sql`false`),
});

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

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => drivers.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), 
  type: text("type").notNull(), 
  status: text("status").notNull().default("pending"), 
  zainCashId: text("zain_cash_id"), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(), 
  password: text("password").notNull(), 
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
});

// === BASE SCHEMAS & VALIDATION ===

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
}).omit({ 
  id: true, 
  status: true, 
  createdAt: true,
  customerWalletBalance: true // لا نريده عند إنشاء الطلب
});

export const insertUserSchema = createInsertSchema(users).omit({
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

// === EXPLICIT API CONTRACT TYPES ===
export type Setting = typeof settings.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export const VEHICLE_OPTIONS = [
  { id: "small", label: "سطحة صغيرة", price: "25,000 د.ع", priceValue: 25000, description: "Small Flatbed" },
  { id: "large", label: "سطحة كبيرة (لوري)", price: "50,000 د.ع", priceValue: 50000, description: "Large Flatbed" },
  { id: "hydraulic", label: "سطحة هيدروليك", price: "40,000 د.ع", priceValue: 40000, description: "Hydraulic Flatbed" },
] as const;