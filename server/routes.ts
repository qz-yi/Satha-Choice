
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDriverSchema } from "@shared/schema";

export async function registerRoutes(arg1: any, arg2: any): Promise<Server> {
  const app: Express = arg1.post ? arg1 : arg2;
  const httpServer: Server = arg1.post ? arg2 : arg1;

  // --- مسارات السائقين (Drivers) ---

  app.post("/api/drivers", async (req, res) => {
    try {
      const input = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(input);
      res.status(201).json(driver);
    } catch (err: any) {
      console.error("خطأ أثناء تسجيل السائق:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: `خطأ في التحقق: ${err.errors[0].message}` });
      }
      if (err.message && err.message.includes("unique constraint")) {
        return res.status(400).json({ message: "رقم الهاتف هذا مسجل مسبقاً، يرجى استخدام رقم آخر." });
      }
      res.status(400).json({ message: err.message || "خطأ في بيانات التسجيل" });
    }
  });

  app.get("/api/drivers", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers);
  });

  app.get("/api/driver/me", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers[drivers.length - 1] || null);
  });

  // ✅ التعديل الجوهري: المسار الموحد والمحمي
  app.patch("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rawBody = req.body;
      
      // بناء كائن تحديث يحتوي فقط على الحقول المعرفة في السكيما
      const updateData: any = {};
      
      // معالجة الحالة (status) سواء جاءت باسم status أو approvalStatus
      if (rawBody.status) updateData.status = rawBody.status;
      if (rawBody.approvalStatus) updateData.status = rawBody.approvalStatus;
      
      // معالجة حالة الاتصال
      if (typeof rawBody.isOnline === "boolean") updateData.isOnline = rawBody.isOnline;

      const updated = await storage.updateDriver(id, updateData);
      res.json(updated);
    } catch (err: any) {
      console.error("خطأ في تحديث بيانات السائق:", err.message);
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDriver(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(400).json({ message: "فشل حذف طلب السائق" });
    }
  });

  // مسارات الطلبات والمحفظة كما هي دون أي حذف
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

  const seed = async () => {
    const driversList = await storage.getDrivers();
    if (driversList.length === 0) {
      try {
        await storage.createDriver({
          name: "أحمد السائق",
          phone: "07700000000",
          city: "بغداد",
          vehicleType: "hydraulic",
          plateNumber: "12345 بغداد",
        });
      } catch (e) {
        console.log("Seed driver already exists or failed");
      }
    }
  };
  seed().catch(console.error);

  return httpServer;
}