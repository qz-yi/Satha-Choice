import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDriverSchema } from "@shared/schema";

export async function registerRoutes(arg1: any, arg2: any): Promise<Server> {
  // ✅ فحص ديناميكي لتحديد المتغير الصحيح ومنع الانهيار (Crash)
  const app: Express = arg1.post ? arg1 : arg2;
  const httpServer: Server = arg1.post ? arg2 : arg1;

  // --- مسارات السائقين (Drivers) ---

  // 1. تسجيل سائق جديد
  app.post("/api/drivers", async (req, res) => {
    try {
      const input = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(input);
      res.status(201).json(driver);
    } catch (err: any) {
      res.status(400).json({ message: "خطأ في بيانات التسجيل" });
    }
  });

  // 2. جلب كل السائقين (لواجهة المدير)
  app.get("/api/drivers", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers);
  });

  // 3. جلب بيانات السائق الحالي
  app.get("/api/driver/me", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers[drivers.length - 1] || null);
  });

  // 4. تفعيل/قبول السائق (من قبل المدير)
  app.patch("/api/drivers/:id/approval", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateDriverApprovalStatus(id, status);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // 5. تحديث حالة الاتصال
  app.patch("/api/drivers/:id/status", async (req, res) => {
    const driver = await storage.updateDriverStatus(Number(req.params.id), req.body.isOnline);
    res.json(driver);
  });

  // 6. جلب معلومات محفظة سائق معين
  app.get("/api/drivers/:id", async (req, res) => {
    const driver = await storage.getDriver(Number(req.params.id));
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json(driver);
  });

  // --- مسارات الطلبات (Requests) ---

  app.post(api.requests.create.path, async (req, res) => {
    try {
      const input = api.requests.create.input.parse(req.body);
      const request = await storage.createRequest(input);
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const result = await storage.acceptRequest(Number(req.params.id), Number(req.params.requestId));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get(api.requests.list.path, async (_req, res) => {
    const requests = await storage.getRequests();
    res.json(requests);
  });

  app.post("/api/drivers/:id/refund/:requestId", async (req, res) => {
    try {
      const result = await storage.refundToCustomer(Number(req.params.id), Number(req.params.requestId), req.body.amount);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Seed function
  const seed = async () => {
    const driversList = await storage.getDrivers();
    if (driversList.length === 0) {
      await storage.createDriver({
        name: "أحمد السائق",
        phone: "07700000000",
        city: "بغداد",
        vehicleType: "هيدروليك",
        plateNumber: "12345 بغداد",
      });
    }
  };
  seed().catch(console.error);

  return httpServer;
}