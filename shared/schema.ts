import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  vehicleType: text("vehicle_type").notNull(), 
  price: text("price").notNull(),
  pickupAddress: text("location").notNull(), 
  customerPhone: text("customer_phone").default("07700000000"), 
  pickupLat: text("pickup_lat"),
  pickupLng: text("pickup_lng"),
  destination: text("destination"),
  destLat: text("dest_lat"),
  destLng: text("dest_lng"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").default("pending"),
  driverId: integer("driver_id"),
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
  referenceId: text("reference_id"), 
  createdAt: timestamp("created_at").defaultNow(),
});

// ✅ تم تصحيح جدول الزبائن بإضافة الحقول اللازمة لتسجيل الدخول
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(), // 🆕 إضافة حقل الهاتف
  password: text("password").notNull(), // 🆕 إضافة حقل كلمة السر
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
});

// === BASE SCHEMAS ===
export const insertRequestSchema = createInsertSchema(requests).omit({ 
  id: true, 
  status: true, 
  createdAt: true 
});

// 🆕 إضافة سكيما إدخال الزبائن (لحل مشكلة التسجيل)
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

export const loginSchema = z.object({
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور قصيرة جداً"),
});

// === EXPLICIT API CONTRACT TYPES ===
export type User = typeof users.$inferSelect; // 🆕 إضافة نوع الزبون
export type InsertUser = z.infer<typeof insertUserSchema>; // 🆕 إضافة نوع إدخال الزبون
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const VEHICLE_OPTIONS = [
  { id: "small", label: "سطحة صغيرة", price: "25,000 د.ع", priceValue: 25000, description: "Small Flatbed" },
  { id: "large", label: "سطحة كبيرة (لوري)", price: "50,000 د.ع", priceValue: 50000, description: "Large Flatbed" },
  { id: "hydraulic", label: "سطحة هيدروليك", price: "40,000 د.ع", priceValue: 40000, description: "Hydraulic Flatbed" },
] as const;
