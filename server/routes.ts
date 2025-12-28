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

  // List all requests
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

  // Accept request (Driver action)
  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const requestId = parseInt(req.params.requestId);
      const result = await storage.acceptRequest(driverId, requestId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Get driver wallet info
  app.get("/api/drivers/:id", async (req, res) => {
    const driver = await storage.getDriver(Number(req.params.id));
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json(driver);
  });

  // Update driver status
  app.patch("/api/drivers/:id/status", async (req, res) => {
    const driver = await storage.updateDriverStatus(Number(req.params.id), req.body.isOnline);
    res.json(driver);
  });

  // Update request status (Rating / Payment)
  app.patch("/api/requests/:id", async (req, res) => {
    const request = await storage.updateRequestStatus(
      Number(req.params.id), 
      req.body.status, 
      req.body.rating, 
      req.body.paymentMethod
    );
    res.json(request);
  });

  // Refund to customer
  app.post("/api/drivers/:id/refund/:requestId", async (req, res) => {
    try {
      const result = await storage.refundToCustomer(
        Number(req.params.id), 
        Number(req.params.requestId), 
        req.body.amount
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Seed data function
  async function seed() {
    const driversList = await storage.getDrivers();
    if (driversList.length === 0) {
      // Create a test driver with balance
      await storage.createDriver({
        name: "أحمد السائق",
        phone: "07700000000",
        walletBalance: "50000.00",
      });
      // Create a test driver with ZERO balance
      await storage.createDriver({
        name: "سائق بدون رصيد",
        phone: "07800000000",
        walletBalance: "0.00",
      });
      console.log("Seeded drivers data");
    }

    const requestsList = await storage.getRequests();
    if (requestsList.length === 0) {
      await storage.createRequest({
        vehicleType: "small",
        price: "25,000 د.ع",
        location: "بغداد - الكرادة",
      });
    }
  }

  seed().catch(console.error);

  return httpServer;
}
