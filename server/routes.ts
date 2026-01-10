import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDriverSchema, loginSchema, insertUserSchema } from "@shared/schema"; // ✅ أضفنا insertUserSchema
// استيراد المكتبات اللازمة لرفع الصور
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express"; // تأكد من استيراد express لاستخدامه في الملفات العامة

// إعداد مجلد رفع الصور وتأكد من وجوده باستخدام المسار المطلق لبيئة Replit
const uploadDir = path.resolve(process.cwd(), "public/uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد Multer لتخزين الصور
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: uploadStorage });

export async function registerRoutes(arg1: any, arg2: any): Promise<Server> {
  const app: Express = arg1.post ? arg1 : arg2;
  const httpServer: Server = arg1.post ? arg2 : arg1;

  // ✅ التعديل الجوهري المحقن: تعريف مسار الصور كأولوية قصوى قبل أي راوتر آخر
  app.use('/uploads', express.static(path.resolve(process.cwd(), "public/uploads")));
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // --- 🆕 مسارات الزبائن (Users/Customers) ---
  
  // 1. مسار إنشاء حساب جديد للزبائن (الميزة المفقودة التي تسبب المشكلة)
  app.post("/api/register", async (req, res) => {
    try {
      const input = insertUserSchema.parse(req.body);
      
      // التأكد من أن الرقم غير مسجل مسبقاً
      const existingUser = await storage.getUserByPhone(input.phone);
      if (existingUser) {
        return res.status(400).json({ message: "رقم الهاتف هذا مسجل مسبقاً كزبون" });
      }

      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "حدث خطأ أثناء إنشاء الحساب" });
    }
  });

  // 2. مسار تسجيل الدخول الخاص بالزبائن (تم الحفاظ عليه كما هو في كودك)
  app.post("/api/login", async (req, res) => {
    try {
      const { phone, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByPhone(phone);

      if (!user) {
        return res.status(401).json({ message: "الحساب غير موجود" });
      }

      if (user.password !== password) {
        return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
      }

      res.json(user);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });


  // --- مسارات السائقين (Drivers) ---
  // (تم الحفاظ على كل الكود أدناه بدون تغيير حرف واحد لضمان سلامة العمليات السابقة)

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

  app.get("/api/drivers", async (_req, res) => {
    const drivers = await storage.getDrivers();
    res.json(drivers);
  });

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

  app.patch("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rawBody = req.body;
      const updateData: any = {};

      if (rawBody.status) updateData.status = rawBody.status;
      else if (rawBody.approvalStatus) updateData.status = rawBody.approvalStatus;

      if (typeof rawBody.isOnline === "boolean") updateData.isOnline = rawBody.isOnline;
      if (rawBody.walletBalance !== undefined) updateData.walletBalance = rawBody.walletBalance;
      
      if (rawBody.avatarUrl) updateData.avatarUrl = rawBody.avatarUrl;

      if (rawBody.lastLat) updateData.lastLat = rawBody.lastLat;
      if (rawBody.lastLng) updateData.lastLng = rawBody.lastLng;

      const updated = await storage.updateDriver(id, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/drivers/:id/upload-avatar", upload.single("image"), async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ message: "لم يتم اختيار صورة" });

      const imageUrl = `/uploads/avatars/${req.file.filename}`;
      await storage.updateDriver(driverId, { avatarUrl: imageUrl });
      res.json({ url: imageUrl });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "فشل في رفع الصورة" });
    }
  });

  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDriver(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(400).json({ message: "فشل حذف حساب السائق" });
    }
  });

  app.post("/api/drivers/:id/deposit-request", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const { amount, paymentMethod, referenceId } = req.body;

      await storage.createTransaction({
        driverId,
        amount: amount.toString(),
        type: "deposit",
        referenceId: referenceId || `${paymentMethod}-${Date.now()}`,
      });

      res.json({ message: "تم إرسال طلب الشحن للمراجعة" });
    } catch (err) {
      res.status(500).json({ message: "فشل إرسال طلب الشحن" });
    }
  });

  app.post("/api/drivers/:id/deposit", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const { amount, referenceId } = req.body;

      if (!amount || amount <= 0) return res.status(400).json({ message: "المبلغ غير صحيح" });

      const driver = await storage.getDriver(driverId);
      if (!driver) return res.status(404).json({ message: "السائق غير موجود" });

      const newBalance = Number(driver.walletBalance) + Number(amount);
      await storage.updateDriver(driverId, { walletBalance: newBalance.toString() });

      await storage.createTransaction({
        driverId,
        amount: amount.toString(),
        type: "deposit",
        referenceId: referenceId || "ZAIN-" + Date.now(),
      });

      res.json({ message: "تم الشحن بنجاح", balance: newBalance });
    } catch (err: any) {
      res.status(500).json({ message: "فشل في عملية الشحن" });
    }
  });

  app.get("/api/drivers/:id/transactions", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const txs = await storage.getDriverTransactions(driverId);
      res.json(txs);
    } catch (err) {
      res.status(500).json({ message: "فشل في جلب السجل المالي" });
    }
  });

  app.post(api.requests.create.path, async (req, res) => {
    try {
      const input = api.requests.create.input.parse(req.body);
      const request = await storage.createRequest(input);
      res.status(201).json(request);
    } catch (err) {
      res.status(500).json({ message: "خطأ في إنشاء الطلب" });
    }
  });

  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const driver = await storage.getDriver(driverId);
      
      if (Number(driver?.walletBalance) < 1000) {
        return res.status(400).json({ message: "رصيدك غير كافٍ لقبول الطلبات، يرجى شحن المحفظة." });
      }

      const result = await storage.acceptRequest(driverId, Number(req.params.requestId));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/drivers/:id/complete/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const requestId = Number(req.params.requestId);
      const fee = 1000; 

      await storage.updateRequestStatus(requestId, "completed");

      const driver = await storage.getDriver(driverId);
      const newBalance = Number(driver!.walletBalance) - fee;
      await storage.updateDriver(driverId, { walletBalance: newBalance.toString() });

      await storage.createTransaction({
        driverId,
        amount: (-fee).toString(),
        type: "fee",
        referenceId: `REQ-${requestId}`
      });

      res.json({ message: "تم إكمال الطلب وخصم العمولة", balance: newBalance });
    } catch (err: any) {
      res.status(500).json({ message: "فشل في إكمال الطلب" });
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

  app.post("/api/admin/requests/:requestId/cancel-assignment", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const updated = await storage.cancelRequestAssignment(requestId);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: "فشل في إلغاء تعيين السائق" });
    }
  });

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
      } catch (e) { console.log("Seed failed"); }
    }
  };
  seed().catch(console.error);

  return httpServer;
}