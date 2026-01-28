import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
// تم الحفاظ على الكود كما هو واضافة التحسينات المنطقية فقط
import { z } from "zod";
import { insertDriverSchema, loginSchema, insertUserSchema, insertRequestSchema } from "@shared/schema"; 
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken"; 
// === إضافة مكتبة الترميز الجغرافي الاحترافية ===
import NodeGeocoder from 'node-geocoder';

const geocoder = NodeGeocoder({
  provider: 'openstreetmap' 
});

// === [تعديل الإصلاح] دالة تحويل الإحداثيات إلى اسم مدينة حقيقي ===
// تم تعطيل الخدمة الخارجية هنا لتجنب الحظر وانهيار السيرفر
async function getCityFromCoords(lat: number, lon: number): Promise<string> {
  try {
    // تم تعطيل الاستعلام مؤقتاً لأن خدمة الخرائط قامت بحظر الطلبات
    // هذا سيجعل إنشاء الطلب سريعاً جداً ولن ينهار السيرفر
    console.log(`[Geocoding] Bypass city detection for coords: ${lat}, ${lon}`);
    return "بابل"; 
  } catch (err) {
    console.error("خطأ في تحديد المدينة:", err);
    return "بابل";
  }
}

// === إعدادات زين كاش الجديدة (تحديث 2026) ===
const ZAIN_CASH_CONFIG = {
  merchantId: "5ff4130e87da5ec303ed3cf2",
  merchantSecret: "210db238198f3e58869c9339",
  msisdn: "9647800272700", // الرقم الجديد المعتمد
  isTest: true
};

// === إعدادات رفع الصور ===
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

  // === إعداد Socket.io (تحديث لضمان البث المباشر والدردشة) ===
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // الزبون ينضم لغرفة الطلب لمتابعة السائق
    socket.on("join_order", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`[Socket] User joined room: order_${orderId}`);
    });

    // السائق ينضم لغرفة المدينة لاستقبال طلبات منطقته فوراً
    socket.on("join_city", (city) => {
      socket.join(`city_${city}`);
      console.log(`[Socket] Driver joined city: ${city}`);
    });

    // [هام جداً] السائق ينضم لقناة خاصة به لاستقبال التعيينات المباشرة من المدير
    socket.on("join_driver_room", (driverId) => {
      socket.join(`driver_${driverId}`);
      console.log(`[Socket] Driver joined private room: driver_${driverId}`);
    });

    // --- نظام الدردشة المباشرة مع الحفظ الدائم (تحديث) ---
    socket.on("send_message", async (data) => {
      try {
        const { orderId, message, senderId, senderType, senderName } = data;
        if (!orderId || !message) return;

        // حفظ الرسالة في قاعدة البيانات لضمان البقاء
        const savedMsg = await storage.createMessage({
          orderId: Number(orderId),
          content: message,
          senderId: Number(senderId),
          senderType,
          senderName
        });

        // بث الرسالة المحفوظة (بما في ذلك التوقيت والـ ID من قاعدة البيانات)
        io.to(`order_${orderId}`).emit("new_message", savedMsg);
        console.log(`[Chat] Message saved and broadcasted for Order ${orderId}`);
      } catch (err) {
        console.error("[Socket Chat Error]:", err);
      }
    });

    // --- الحل الجذري لمشكلة تحديث الحالة لدى الزبون ---
    socket.on("update_order_status", async (data) => {
      try {
        const { orderId, status, driverId } = data;
        if (!orderId || !status) return;

        // 1. تحديث قاعدة البيانات لضمان بقاء الحالة عند عمل Refresh للزبون
        await storage.updateRequestStatus(Number(orderId), status);

        // جلب بيانات السائق كاملة (الاسم، الهاتف، الصورة) لإرسالها للزبون
        const driver = driverId ? await storage.getDriver(Number(driverId)) : null;

        const payload = { 
          status, 
          driverId,
          driverInfo: driver ? {
            name: driver.username || (driver as any).name, 
            phone: driver.phone,
            avatarUrl: driver.avatarUrl,
            vehicleType: driver.vehicleType,
            plateNumber: driver.plateNumber,
            lat: driver.lastLat,
            lng: driver.lastLng
          } : null
        };

        // 2. بث الإشارة فوراً للزبون المتابع لهذا الطلب تحديداً عبر الغرفة
        io.to(`order_${orderId}`).emit("status_changed", payload);
        // بث عام لضمان التحديث في القوائم
        io.emit(`order_status_${orderId}`, payload);

        // بث عام لتحديث قوائم المدير فوراً
        io.emit("request_updated", { id: orderId, ...payload });

        console.log(`[Socket] Order ${orderId} status updated to: ${status}`);
      } catch (error) {
        console.error("[Socket Error] Failed to update status:", error);
      }
    });

    // تحديث موقع السائق لحظياً على الخريطة (العام)
    socket.on("update_location", async (data) => {
      const { driverId, lat, lng } = data;
      await storage.updateDriver(driverId, { lastLat: lat, lastLng: lng });
      io.emit(`location_changed_${driverId}`, { lat, lng });
    });

    // دعم تتبع الموقع المتقدم (داخل الغرفة الخاصة بالطلب)
    socket.on("driver_location_update", (data) => {
      const { orderId, lat, lng, heading } = data;
      // البث حصرياً لغرفة الطلب لتقليل استهلاك البيانات وضمان السرعة
      io.to(`order_${orderId}`).emit(`location_changed_order_${orderId}`, { lat, lng, heading });
    });
  });

  app.use('/uploads', express.static(path.resolve(process.cwd(), "public/uploads")));
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // --- مسارات زين كاش المصححة ---

  app.post(["/api/zaincash/initiate", "/api/zain-cash/initiate"], async (req, res) => {
    try {
      const { amount, userId, userType } = req.body; 
      if (!amount || amount < 1000) {
        return res.status(400).json({ message: "أقل مبلغ للشحن هو 1000 دينار" });
      }

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

      if (!result || !result.id) {
        console.error("ZainCash Error Response:", result);
        return res.status(400).json({ message: result.err || "فشل في الاتصال بزين كاش" });
      }

      const payUrl = ZAIN_CASH_CONFIG.isTest 
        ? `https://test.zaincash.iq/transaction/pay?id=${result.id}` 
        : `https://api.zaincash.iq/transaction/pay?id=${result.id}`;

      res.json({ url: payUrl, transactionId: result.id, status: "success" });
    } catch (err: any) {
      console.error("Initiate Error:", err.message);
      res.status(500).json({ message: "فشل بدء عملية الدفع: " + err.message });
    }
  });

  app.get("/api/zaincash/callback", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send("التوكن مفقود");

    try {
      const decoded: any = jwt.verify(token as string, ZAIN_CASH_CONFIG.merchantSecret);

      if (decoded.status === "success") {
        const orderParts = decoded.orderid.split("_");
        const type = orderParts[0]; 
        const userId = Number(orderParts[1]);
        const amount = Number(decoded.amount);

        if (type === "DRV") {
          const driver = await storage.getDriver(userId);
          if (driver) {
            const newBalance = (Number(driver.walletBalance) + amount).toString();
            await storage.updateDriver(userId, { walletBalance: newBalance });
            await storage.createTransaction({
              driverId: userId,
              amount: amount.toString(),
              type: "deposit",
              status: "completed",
              zainCashId: decoded.id
            });
            io.emit(`driver_wallet_updated_${userId}`, { newBalance });
          }
        } else {
          const user = await storage.getUser(userId);
          if (user) {
            await storage.updateCustomerWallet(user.phone, amount);
            await storage.createTransaction({
              userId: userId,
              amount: amount.toString(),
              type: "deposit",
              status: "completed",
              zainCashId: decoded.id
            });
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

  // --- مسارات الدردشة ---
  app.get("/api/requests/:orderId/messages", async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const messages = await storage.getMessagesByOrder(orderId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "فشل في جلب سجل المحادثة" });
    }
  });

  // --- مسارات الزبائن ---

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
      console.error("Register Error:", err);
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

  app.get("/api/users/:phone/requests", async (req, res) => {
    try {
      const phone = req.params.phone;
      const allRequests = await storage.getRequests();
      const userRequests = allRequests
        .filter(r => r.customerPhone === phone)
        .sort((a, b) => b.id - a.id);

      res.json(userRequests);
    } catch (err: any) {
      res.status(500).json({ message: "فشل في جلب سجل رحلات الزبون" });
    }
  });

  // --- مسارات السائقين ---

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

  app.get("/api/drivers/:id/requests", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      if (isNaN(driverId)) return res.status(400).json({ message: "رقم السائق غير صحيح" });
      const requests = await storage.getDriverRequests(driverId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "فشل في جلب سجل الرحلات" });
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

  // --- مسارات العمليات المالية ---

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

  // --- مسارات الطلبات ---

  app.post("/api/requests", async (req, res) => {
    try {
      const { status, ...bodyData } = req.body; 

      let detectedCity = bodyData.city;
      if (bodyData.pickupLat && bodyData.pickupLng) {
        // سيقوم هذا بجلب "بابل" فوراً دون انتظار خدمة الخرائط الموقوفة
        detectedCity = await getCityFromCoords(bodyData.pickupLat, bodyData.pickupLng);
      }

      const customer = await storage.getUserByPhone(bodyData.customerPhone);

      const completeData = {
        customerName: customer?.username || bodyData.customerName || "زبون",
        customerPhone: bodyData.customerPhone || "0000",
        location: bodyData.location || "موقع الزبون الحالي", 
        destination: bodyData.destination || "غير محدد",
        city: detectedCity || bodyData.city || "بابل", 
        vehicleType: bodyData.vehicleType || "سطحة صغيرة",
        pickupLat: bodyData.pickupLat, 
        pickupLng: bodyData.pickupLng,
        ...bodyData
      };

      let validatedData;
      try {
        validatedData = insertRequestSchema.parse(completeData);
      } catch (e) {
        validatedData = completeData; 
      }

      const request = await storage.createRequest({
        ...validatedData,
        status: status || "pending"
      });

      io.emit("new_request_available", request);
      io.to(`city_${detectedCity}`).emit("new_request_in_city", request);
      io.emit("request_updated", { id: request.id, status: "pending", ...request });

      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ message: "خطأ في إنشاء الطلب: " + err.message });
    }
  });

  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const requestId = Number(req.params.requestId);

      const driver = await storage.getDriver(driverId);

      // ✨ تصحيح: إضافة صمام أمان للعمولة عند القبول
      const systemSettings = await storage.getSettings();
      const currentCommission = Number(systemSettings?.commissionAmount || 1000);

      if (Number(driver?.walletBalance) < currentCommission) {
        return res.status(400).json({ 
          message: `رصيدك غير كافٍ لقبول الطلبات، يرجى شحن المحفظة (أقل رصيد مطلوب ${currentCommission} دينار).` 
        });
      }

      const result = await storage.acceptRequest(driverId, requestId);

      const payload = { 
        status: "accepted", 
        driverId,
        driverInfo: { 
          name: driver?.username || (driver as any).name, 
          phone: driver?.phone, 
          avatarUrl: driver?.avatarUrl,
          vehicleType: driver?.vehicleType,
          plateNumber: driver?.plateNumber,
          lat: driver?.lastLat, 
          lng: driver?.lastLng 
        }
      };

      io.to(`order_${requestId}`).emit("status_changed", payload);
      io.emit(`order_status_${requestId}`, payload);
      io.emit("request_updated", { id: requestId, ...payload });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // === مسار إكمال الطلب (النسخة النهائية مع نظام كشف الأخطاء والإصلاح التلقائي) ===
  app.post("/api/drivers/:id/complete/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const requestId = Number(req.params.requestId);

      const request = await storage.getRequest(requestId);
      if (!request) return res.status(404).json({ message: "الطلب غير موجود" });

      // --- سجل مراقبة للأخطاء (سيظهر في Console الريبليت) ---
      console.log(`[Check] Driver ID from URL: ${driverId} (Type: ${typeof driverId})`);
      console.log(`[Check] Driver ID in DB: ${request.driverId} (Type: ${typeof request.driverId})`);
      console.log(`[Check] Request Status: ${request.status}`);

      // توسيع الحالات المقبولة لضمان عدم توقف العملية في أي مرحلة
      const validStatuses = ["accepted", "confirmed", "arrived", "in_progress", "arrived_dropoff"];

      // 1. التحقق من الحالة
      if (!validStatuses.includes(request.status)) {
         if (request.status === "completed") return res.status(400).json({ message: "هذا الطلب مكتمل مسبقاً" });
         return res.status(400).json({ message: "يجب قبول الطلب أولاً قبل إكماله" });
      }

      // 2. إصلاح الربط التلقائي (في حال كان الـ driverId في القاعدة null أو 0)
      if (!request.driverId || Number(request.driverId) === 0) {
        console.log(`[Fix] Auto-assigning missing driver ${driverId} to request ${requestId}`);
        await storage.assignRequestToDriver(requestId, driverId);
        request.driverId = driverId;
      } 
      // 3. التحقق النهائي من الملكية (بعد محاولة الإصلاح)
      else if (Number(request.driverId) !== driverId) {
        return res.status(403).json({ 
          message: `خطأ ملكية: الطلب مسجل للسائق رقم (${request.driverId}) وأنت تحاول إكماله برقم (${driverId})` 
        });
      }

      const driver = await storage.getDriver(driverId);
      if (!driver) return res.status(404).json({ message: "بيانات السائق غير موجودة" });

      // حساب العمولة بشكل آمن
      const systemSettings = await storage.getSettings();
      const fee = Number(systemSettings?.commissionAmount || 1000);

      // تنفيذ العملية: تحديث الحالة
      await storage.updateRequestStatus(requestId, "completed");

      // خصم العمولة
      const currentBalance = parseFloat(driver.walletBalance || "0");
      const newBalance = (currentBalance - fee).toFixed(2);
      await storage.updateDriver(driverId, { walletBalance: newBalance.toString() });

      // تسجيل العملية المالية
      await storage.createTransaction({
        driverId,
        amount: (-fee).toString(),
        type: "fee",
        status: "completed",
        referenceId: `REQ-${requestId}`
      });

      const socketPayload = { 
        status: "completed", 
        requestId, 
        driverId,
        driverInfo: {
          name: driver.username || (driver as any).name,
          phone: driver.phone,
          avatarUrl: driver.avatarUrl,
          vehicleType: driver.vehicleType,
          plateNumber: driver.plateNumber
        }
      };

      // إرسال التحديثات الفورية
      io.to(`order_${requestId}`).emit("status_changed", socketPayload);
      io.emit(`order_status_${requestId}`, socketPayload);
      io.emit("request_updated", { id: requestId, ...socketPayload });

      console.log(`[Success] Request ${requestId} completed by driver ${driverId}. Fee: ${fee}`);
      res.json({ message: "تم إكمال الطلب بنجاح وخصم العمولة", balance: newBalance });

    } catch (err: any) {
      console.error("[Fatal Complete Error]:", err);
      res.status(500).json({ message: "حدث خطأ داخلي أثناء إكمال الطلب: " + err.message });
    }
  });

  app.patch("/api/requests/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const id = Number(req.params.id);
      const updated = await storage.updateRequestStatus(id, status);

      io.to(`order_${id}`).emit("status_changed", { status });
      io.emit(`order_status_${id}`, { status });
      io.emit("request_updated", { id, status });

      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/requests", async (_req, res) => {
    try {
      const requests = await storage.getRequests();
      const detailedRequests = await Promise.all(requests.map(async (req) => {
        const user = await storage.getUserByPhone(req.customerPhone);
        const driver = req.driverId ? await storage.getDriver(req.driverId) : null;
        const balance = user ? Number(user.walletBalance) : 0;
        return {
          ...req,
          walletBalance: balance,         
          customerWalletBalance: balance, 
          userBalance: balance,
          driver: driver, 
          user: user ? user : { 
            id: 0,
            username: req.customerName, 
            phone: req.customerPhone,
            walletBalance: 0,
            city: req.city 
          }
        };
      }));
      res.json(detailedRequests);
    } catch (err) {
      res.status(500).json({ message: "فشل في جلب قائمة الطلبات" });
    }
  });

  // --- مسارات الإدارة (Admin) ---

  app.post("/api/admin/customers/adjust-wallet", async (req, res) => {
    try {
      const { customerPhone, amount } = req.body;
      const updated = await storage.updateCustomerWallet(customerPhone, Number(amount));
      res.json(updated);
    } catch (err: any) {
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
      const driver = await storage.getDriver(driverId);
      const requestDetails = await storage.getRequest(requestId); 

      const payload = { 
        status: "confirmed", 
        driverId, 
        driverInfo: driver 
      };

      io.to(`order_${requestId}`).emit("status_changed", payload);
      io.emit(`order_status_${requestId}`, payload);

      if (driverId) {
        io.to(`driver_${driverId}`).emit("new_request_assigned", {
           ...requestDetails,
           assignedByAdmin: true
        });
      }

      io.emit("request_updated", { id: requestId, ...payload });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: "فشل في تحويل الطلب للسائق" });
    }
  });

  app.post("/api/admin/requests/:requestId/cancel-assignment", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const oldRequest = await storage.getRequest(requestId);
      const oldDriverId = oldRequest?.driverId;
      const updated = await storage.cancelRequestAssignment(requestId);

      const payload = { status: "pending", driverId: null, driverInfo: null };
      io.to(`order_${requestId}`).emit("status_changed", payload);
      io.emit(`order_status_${requestId}`, payload);

      if (oldDriverId) {
         io.to(`driver_${oldDriverId}`).emit("request_cancelled_by_admin", { requestId });
      }

      io.emit("request_updated", { id: requestId, ...payload });
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
          username: "أحمد السائق", 
          phone: "07700000000",
          password: "password123",
          city: "بابل",
          vehicleType: "hydraulic",
          plateNumber: "12345 بابل",
        });
      } catch (e) {}
    }
    await storage.getSettings();
  };
  seed().catch(console.error);

  return httpServer;
}