import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  vehicleType: text("vehicle_type").notNull(), // 'small', 'large', 'hydraulic'
  price: text("price").notNull(),
  location: text("location").notNull(),
  pickupLat: text("pickup_lat"),
  pickupLng: text("pickup_lng"),
  destination: text("destination"),
  destLat: text("dest_lat"),
  destLng: text("dest_lng"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").default("pending"),
  driverId: integer("driver_id"), // Linked to user if we had one, but keeping simple
  createdAt: timestamp("created_at").defaultNow(),
  rating: integer("rating"),
  paymentMethod: text("payment_method"), // 'cash', 'wallet'
  isRefunded: boolean("is_refunded").default(sql`false`),
});

export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isOnline: boolean("is_online").default(sql`true`),
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

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
});

// === EXPLICIT API CONTRACT TYPES ===
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type CreateRequestRequest = InsertRequest;
export type RequestResponse = Request;
export type RequestsListResponse = Request[];

// Constants for Frontend/Backend consistency
export const VEHICLE_OPTIONS = [
  { id: "small", label: "سطحة صغيرة", price: "25,000 د.ع", priceValue: 25000, description: "Small Flatbed" },
  { id: "large", label: "سطحة كبيرة (لوري)", price: "50,000 د.ع", priceValue: 50000, description: "Large Flatbed" },
  { id: "hydraulic", label: "سطحة هيدروليك", price: "40,000 د.ع", priceValue: 40000, description: "Hydraulic Flatbed" },
] as const;
