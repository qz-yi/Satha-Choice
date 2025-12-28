import { db } from "./db";
import {
  requests,
  type InsertRequest,
  type Request,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createRequest(request: InsertRequest): Promise<Request>;
  getRequests(): Promise<Request[]>;
  getRequest(id: number): Promise<Request | undefined>;
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
}

export const storage = new DatabaseStorage();
