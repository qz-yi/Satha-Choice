import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDriverSchema, loginSchema } from "@shared/schema"; // ✅ أضفنا loginSchema

export async function registerRoutes(arg1: any, arg2: any): Promise<Server> {
  const app: Express = arg1.post ? arg1 : arg2;
  const httpServer: Server = arg1.post ? arg2 : arg1;

  // --- مسارات السائقين (Drivers) ---

  // 1. تسجيل سائق جديد (مع كلمة المرور)
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

  // 2. ✅ مسار تسجيل الدخول الجديد (Login)
  app.post("/api/drivers/login", async (req, res) => {
    try {
      const { phone, password } = loginSchema.parse(req.body);
      const driver = await storage.getDriverByPhone(phone);

      if (!driver) {
        return res.status(401).json({ message: "رقم الهاتف غير مسجل لدينا" });
      }

      // التحقق من كلمة المرور (نص بسيط كما طلبت)
      if (driver.password !== password) {
        return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
      }

      // إرسال بيانات السائق بنجاح
      res.json(driver);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // 3. جلب كل السائقين (للمدير) - كما هو بدون تغيير
  app.get("/api/drivers", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers);
  });

  // 4. جلب بيانات السائق الحالي (لواجهة السائق) - كما هو بدون تغيير
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

  // 5. التفعيل وتحديث بيانات السائق (المسار الموحد) - كما هو بدون تغيير
  app.patch("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rawBody = req.body;
      const updateData: any = {};

      if (rawBody.status) {
        updateData.status = rawBody.status;
      } else if (rawBody.approvalStatus) {
        updateData.status = rawBody.approvalStatus;
      }

      if (typeof rawBody.isOnline === "boolean") {
        updateData.isOnline = rawBody.isOnline;
      }

      if (rawBody.walletBalance !== undefined) {
        updateData.walletBalance = rawBody.walletBalance;
      }

      const updated = await storage.updateDriver(id, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // 6. حذف طلب السائق (الرفض أو حذف الحساب)
  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDriver(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("خطأ في حذف السائق:", err);
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

  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const result = await storage.acceptRequest(Number(req.params.id), Number(req.params.requestId));
      res.json(result);
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

  app.post("/api/drivers/:id/refund/:requestId", async (req, res) => {
    try {
      const result = await storage.refundToCustomer(Number(req.params.id), Number(req.params.requestId), req.body.amount);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ✅ 7. مسارات تحويل الطلب والمرجوع (Admin Controls)
  
  // تحويل الطلب لسائق محدد
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

  // المرجوع (إلغاء تعيين السائق وإعادة الطلب للانتظار)
  app.post("/api/admin/requests/:requestId/cancel-assignment", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const updated = await storage.cancelRequestAssignment(requestId);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: "فشل في إلغاء تعيين السائق" });
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
          vehicleType: "hydraulic",
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