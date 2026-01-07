import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDriverSchema, loginSchema } from "@shared/schema"; 

export async function registerRoutes(arg1: any, arg2: any): Promise<Server> {
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

  // 2. تسجيل الدخول
  app.post("/api/drivers/login", async (req, res) => {
    try {
      const { phone, password } = loginSchema.parse(req.body);
      const driver = await storage.getDriverByPhone(phone);

      if (!driver) {
        return res.status(401).json({ message: "رقم الهاتف غير مسجل لدينا" });
      }

      if (driver.password !== password) {
        return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
      }

      res.json(driver);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // ✅ التعديل الجديد: مسار تحديث الموقع الذكي للسائق
  app.patch("/api/drivers/:id/location", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { lat, lng } = req.body;

      if (isNaN(id) || lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "بيانات الموقع غير مكتملة" });
      }

      const updatedDriver = await storage.updateDriverLocation(id, lat, lng);
      res.json(updatedDriver);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // جلب كل السائقين
  app.get("/api/drivers", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers);
  });

  // جلب بيانات السائق الحالي
  app.get("/api/driver/me/:id", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      if (isNaN(driverId)) return res.status(400).json({ message: "رقم السائق غير صحيح" });

      const driver = await storage.getDriver(driverId);
      if (!driver) return res.status(404).json({ message: "السائق غير موجود" });

      res.json(driver);
    } catch (err: any) {
      res.status(500).json({ message: "حدث خطأ داخلي" });
    }
  });

  // تحديث حالة السائق
  app.patch("/api/drivers/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isOnline } = req.body;
      const updated = await storage.updateDriverStatus(id, isOnline);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // تحديث بيانات السائق (Admin/General)
  app.patch("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateDriver(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // حذف السائق
  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDriver(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(400).json({ message: "فشل حذف حساب السائق" });
    }
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
      res.status(500).json({ message: "خطأ في إنشاء الطلب" });
    }
  });

  app.post("/api/requests/:requestId/accept", async (req, res) => {
    try {
      const { driverId } = req.body;
      const result = await storage.acceptRequest(Number(driverId), Number(req.params.requestId));
      res.json(result.request);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/requests/:requestId/status", async (req, res) => {
    try {
      const { status, stage } = req.body;
      const updated = await storage.updateRequestStatus(Number(req.params.requestId), status);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/requests", async (_req, res) => {
    try {
      const requests = await storage.getRequests();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "فشل في جلب قائمة الطلبات" });
    }
  });

  app.post("/api/admin/requests/:requestId/assign", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const { driverId } = req.body;
      const updated = await storage.assignRequestToDriver(requestId, driverId);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: "فشل في تحويل الطلب للسائق" });
    }
  });

  // دالة بذر البيانات (Seed)
  const seed = async () => {
    const driversList = await storage.getDrivers();
    if (driversList.length === 0) {
      try {
        await storage.createDriver({
          name: "أحمد السائق",
          phone: "07700000000",
          password: "password123",
          city: "بغداد",
          vehicleType: "small",
          plateNumber: "12345 بغداد",
        });
      } catch (e) {
        console.log("Seed failed");
      }
    }
  };
  seed().catch(console.error);

  return httpServer;
}
