import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Create a request
  app.post(api.requests.create.path, async (req, res) => {
    try {
      const input = api.requests.create.input.parse(req.body);
      const request = await storage.createRequest(input);
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // List all requests (for admin or history)
  app.get(api.requests.list.path, async (req, res) => {
    const requests = await storage.getRequests();
    res.json(requests);
  });

  // Get single request
  app.get(api.requests.get.path, async (req, res) => {
    const request = await storage.getRequest(Number(req.params.id));
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json(request);
  });

  // Seed data function (optional, but good for testing)
  async function seed() {
    const existing = await storage.getRequests();
    if (existing.length === 0) {
      await storage.createRequest({
        vehicleType: "small",
        price: "25,000 د.ع",
        location: "بغداد - الكرادة",
      });
      console.log("Seeded initial data");
    }
  }

  // Run seed
  seed().catch(console.error);

  return httpServer;
}
