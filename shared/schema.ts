import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

// جدول طلبات السطحة
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  vehicleType: text("vehicle_type").notNull(), 
  price: text("price").notNull(),
  location: text("location").notNull(),
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
  customerPhone: text("customer_phone"), // تم إضافته لإصلاح خطأ الإدارة
});

// جدول السائقين المطور
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
  // ✅ الحقول الجديدة المضافة لدعم التتبع الذكي
  currentLat: text("current_lat"),
  currentLng: text("current_lng"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
});

// === BASE SCHEMAS ===
export const insertRequestSchema = createInsertSchema(requests).omit({ 
  id: true, 
  status: true, 
  createdAt: true 
});

// مخطط إدخال بيانات السائق
export const insertDriverSchema = createInsertSchema(drivers, {
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 رموز"),
  city: z.string().min(2, "يرجى إدخال المدينة"),
  plateNumber: z.string().min(2, "رقم اللوحة مطلوب"),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
}).omit({
  id: true,
  walletBalance: true,
  isOnline: true,
  status: true,
  createdAt: true,
  currentLat: true, // استبعادها من نموذج التسجيل
  currentLng: true  // استبعادها من نموذج التسجيل
});

// مخطط خاص بتسجيل الدخول (Login)
export const loginSchema = z.object({
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور قصيرة جداً"),
});

// === EXPLICIT API CONTRACT TYPES ===
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export const VEHICLE_OPTIONS = [
  { id: "small", label: "سطحة صغيرة", price: "25,000 د.ع", priceValue: 25000, description: "Small Flatbed" },
  { id: "large", label: "سطحة كبيرة (لوري)", price: "50,000 د.ع", priceValue: 50000, description: "Large Flatbed" },
  { id: "hydraulic", label: "سطحة هيدروليك", price: "40,000 د.ع", priceValue: 40000, description: "Hydraulic Flatbed" },
] as const;