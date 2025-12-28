import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  vehicleType: text("vehicle_type").notNull(), // 'small', 'large', 'hydraulic'
  price: text("price").notNull(),
  location: text("location").notNull(), // Simple text for MVP
  status: text("status").default("pending"), // pending, confirmed, completed
  createdAt: timestamp("created_at").defaultNow(),
});

// === BASE SCHEMAS ===
export const insertRequestSchema = createInsertSchema(requests).omit({ 
  id: true, 
  status: true, 
  createdAt: true 
});

// === EXPLICIT API CONTRACT TYPES ===
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;

export type CreateRequestRequest = InsertRequest;
export type RequestResponse = Request;
export type RequestsListResponse = Request[];

// Constants for Frontend/Backend consistency
export const VEHICLE_OPTIONS = [
  { id: "small", label: "سطحة صغيرة", price: "25,000 د.ع", priceValue: 25000, description: "Small Flatbed" },
  { id: "large", label: "سطحة كبيرة (لوري)", price: "50,000 د.ع", priceValue: 50000, description: "Large Flatbed" },
  { id: "hydraulic", label: "سطحة هيدروليك", price: "40,000 د.ع", priceValue: 40000, description: "Hydraulic Flatbed" },
] as const;
