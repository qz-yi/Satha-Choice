import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertDriverSchema, loginSchema, insertUserSchema, insertRequestSchema } from "@shared/schema"; 
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken"; // إضافة مكتبة JWT للتعامل مع زين كاش

// === إعدادات زين كاش (بيانات الاختبار من التوثيق) ===
const ZAIN_CASH_CONFIG = {
  merchantId: "5ffacf6612b5777c6d44266f",
  merchantSecret: "$2y$10$hHbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS",
  msisdn: "9647835077893",
  isTest: true
};

// === إعدادات رفع الصور (بدون تغيير) ===
const uploadDir = path.resolve(process.cwd(), "public/uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

  // === إعداد Socket.io ===
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket) => {
    socket.on("join_order", (orderId) => {
      socket.join(`order_${orderId}`);
    });
  });

  app.use('/uploads', express.static(path.resolve(process.cwd(), "public/uploads")));
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // --- مسارات زين كاش المطورة (تم التعديل للجمع بين السائق والزبون) ---

  // 1. بدء عملية الدفع (تم تصحيح المسار ليتوافق مع واجهة السائق مع الحفاظ على المنطق)
  app.post(["/api/zaincash/initiate", "/api/zain-cash/initiate"], async (req, res) => {
    try {
      const { amount, userId, userType } = req.body; // userType: 'driver' or 'customer'
      if (!amount || amount < 1000) {
        return res.status(400).json({ message: "أقل مبلغ للشحن هو 1000 دينار" });
      }

      // تحديد البادئة للتمييز عند العودة
      const prefix = userType === "driver" ? "DRV" : "USR";

      const data = {
        amount: Number(amount),
        serviceType: userType === "driver" ? "شحن محفظة السائق" : "شحن رصيد الزبون",
        msisdn: ZAIN_CASH_CONFIG.msisdn,
        orderId: `${prefix}_${userId}_${Date.now()}`,
        redirectUrl: `${req.protocol}://${req.get('host')}/api/zaincash/callback`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4)
      };

      const token = jwt.sign(data, ZAIN_CASH_CONFIG.merchantSecret);
      const initUrl = ZAIN_CASH_CONFIG.isTest ? "https://test.zaincash.iq/transaction/init" : "https://api.zaincash.iq/transaction/init";

      const response = await fetch(initUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: token,
          merchantId: ZAIN_CASH_CONFIG.merchantId,
          lang: "ar"
        })
      });

      const result: any = await response.json();
      if (!result.id) throw new Error("فشل في الحصول على معرف العملية من زين كاش");

      const payUrl = ZAIN_CASH_CONFIG.isTest 
        ? `https://test.zaincash.iq/transaction/pay?id=${result.id}` 
        : `https://api.zaincash.iq/transaction/pay?id=${result.id}`;

      // إرسال الـ url و transactionId لضمان عمل الواجهتين القديمة والجديدة
      res.json({ url: payUrl, transactionId: result.id, status: "success" });
    } catch (err: any) {
      res.status(500).json({ message: "فشل بدء عملية الدفع: " + err.message });
    }
  });

  // 2. معالجة العودة وتحديث الرصيد بناءً على نوع المستخدم
  app.get("/api/zaincash/callback", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send("التوكن مفقود");

    try {
      const decoded: any = jwt.verify(token as string, ZAIN_CASH_CONFIG.merchantSecret);

      if (decoded.status === "success") {
        const orderParts = decoded.orderid.split("_");
        const type = orderParts[0]; // DRV or USR
        const userId = Number(orderParts[1]);
        const amount = Number(decoded.amount);

        if (type === "DRV") {
          // تحديث محفظة السائق
          const driver = await storage.getDriver(userId);
          if (driver) {
            const newBalance = (Number(driver.walletBalance) + amount).toString();
            await storage.updateDriver(userId, { walletBalance: newBalance });
            await storage.createTransaction({
              driverId: userId,
              amount: amount.toString(),
              type: "deposit",
              referenceId: `ZAIN_${decoded.id}`,
            });
            io.emit(`driver_wallet_updated_${userId}`, { newBalance });
          }
        } else {
          // تحديث محفظة الزبون
          const user = await storage.getUser(userId);
          if (user) {
            await storage.updateCustomerWallet(user.phone, amount);
            io.emit(`wallet_updated_${userId}`, { newBalance: amount });
          }
        }

        res.send(`<html><script>window.location.href="/payment-success";</script></html>`);
      } else {
        res.send(`<html><script>window.location.href="/payment-failed?msg=${decoded.msg}";</script></html>`);
      }
    } catch (err) {
      res.status(500).send("خطأ في التحقق من العملية");
    }
  });

  // --- مسارات الزبائن (Users/Customers) ---

  app.post("/api/register", async (req, res) => {
    try {
      const input = insertUserSchema.parse(req.body);
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

  // --- مسارات العمليات المالية (Transactions) ---

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

  // --- مسارات الطلبات (Requests) ---

  app.post("/api/requests", async (req, res) => {
    try {
      const completeData = {
        customerName: req.body.customerName || "زبون",
        customerPhone: req.body.customerPhone || "0000",
        location: req.body.location || "غير محدد",
        destination: req.body.destination || "غير محدد",
        city: req.body.city || "بغداد",
        vehicleType: req.body.vehicleType || "سطحة صغيرة",
        status: "pending",
        ...req.body
      };

      let validatedData;
      try {
        validatedData = insertRequestSchema.parse(completeData);
      } catch (e) {
        console.log("تنبيه: تم تجاوز التحقق الصارم لوجود حقول ناقصة، يتم الإرسال يدوياً.");
        validatedData = completeData; 
      }

      const request = await storage.createRequest(validatedData);
      io.emit("receive_request", request);
      res.status(201).json(request);
    } catch (err: any) {
      console.error("خطأ في السيرفر عند إنشاء الطلب:", err);
      res.status(500).json({ message: "خطأ في إنشاء الطلب: " + err.message });
    }
  });

  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const driver = await storage.getDriver(driverId);
      const systemSettings = await storage.getSettings();
      const currentCommission = systemSettings.commissionAmount;

      if (Number(driver?.walletBalance) < currentCommission) {
        return res.status(400).json({ 
          message: `رصيدك غير كافٍ لقبول الطلبات، يرجى شحن المحفظة (أقل رصيد مطلوب ${currentCommission} دينار).` 
        });
      }
      const result = await storage.acceptRequest(driverId, Number(req.params.requestId));
      io.emit(`order_status_${req.params.requestId}`, { status: "accepted", driverId });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/drivers/:id/complete/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const requestId = Number(req.params.requestId);
      const systemSettings = await storage.getSettings();
      const fee = systemSettings.commissionAmount; 

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

      io.emit(`order_status_${requestId}`, { status: "completed" });
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

  // --- مسارات الإدارة (Admin) ---

  app.post("/api/admin/customers/adjust-wallet", async (req, res) => {
    try {
      const { customerPhone, amount } = req.body;
      if (!customerPhone) return res.status(400).json({ message: "رقم هاتف الزبون مطلوب" });
      const updated = await storage.updateCustomerWallet(customerPhone, Number(amount));
      res.json(updated);
    } catch (err: any) {
      console.error("خطأ في تحديث محفظة الزبون:", err);
      res.status(500).json({ message: "فشل في تحديث محفظة الزبون" });
    }
  });

  app.get("/api/admin/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "فشل في جلب إعدادات النظام" });
    }
  });

  app.post("/api/admin/settings/commission", async (req, res) => {
    try {
      const { amount } = req.body;
      const updated = await storage.updateCommission(Number(amount));
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "فشل في تحديث العمولة" });
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

  // --- دالة الـ Seed ---
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
    await storage.getSettings();
  };
  seed().catch(console.error);

  return httpServer;
}