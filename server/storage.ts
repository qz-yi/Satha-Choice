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
  acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }>;
}

export class DatabaseStorage implements IStorage {
  async createRequest(request: InsertRequest): Promise<Request> {
    const [newRequest] = await db
      .insert(requests)
      .values(request)
      .returning();
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
    const [newDriver] = await db.insert(drivers).values(driver).returning();
    return newDriver;
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers);
  }

  async acceptRequest(driverId: number, requestId: number): Promise<{ request: Request; driver: Driver }> {
    return await db.transaction(async (tx) => {
      const [driver] = await tx.select().from(drivers).where(eq(drivers.id, driverId));
      if (!driver) throw new Error("Driver not found");
      
      const balance = parseFloat(driver.walletBalance);
      if (balance <= 0) {
        throw new Error("رصيدك صفر. لا يمكنك استقبال طلبات.");
      }

      const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "pending") throw new Error("Request already accepted");

      // Calculate 10% deduction
      // For MVP, we'll parse the price string "25,000 د.ع" to number
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
