import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertDriverSchema, loginSchema, insertUserSchema, insertRequestSchema } from "@shared/schema"; 
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken"; 
import NodeGeocoder from 'node-geocoder';
import { calculateDynamicFare, calculateSimpleFare, getSurgeMultiplier, getVehicleConfig } from './services/PricingService';
import axios from 'axios';
import * as PricingConfig from './services/PricingConfig';

// FEATURE 2: Google Polyline decoder
function decodeGooglePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

const geocoder = NodeGeocoder({
  provider: 'openstreetmap' 
});

async function getCityFromCoords(lat: number, lon: number): Promise<string> {
  try {
    console.log(`[Geocoding] Bypass city detection for coords: ${lat}, ${lon}`);
    return "بابل"; 
  } catch (err) {
    console.error("خطأ في تحديد المدينة:", err);
    return "بابل";
  }
}

const ZAIN_CASH_CONFIG = {
  merchantId: "5ff4130e87da5ec303ed3cf2",
  merchantSecret: "210db238198f3e58869c9339",
  msisdn: "9647800272700",
  isTest: true
};

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

// === دالة مساعدة لتحديد الحالات النشطة ===
// CRITICAL FIX: Include 'picked_up' status for proper recovery of transferred/assigned orders
const ACTIVE_STATUSES = ["accepted", "confirmed", "arrived", "picked_up", "in_progress", "arrived_dropoff"];

export async function registerRoutes(arg1: any, arg2: any): Promise<Server> {
  const app: Express = arg1.post ? arg1 : arg2;
  const httpServer: Server = arg1.post ? arg2 : arg1;

  // PRODUCTION-READY CORS Configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:5000'];
  
  console.log('🔒 [CORS] Allowed origins:', allowedOrigins);

  const io = new SocketIOServer(httpServer, {
    cors: { 
      origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    socket.on("join_order", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`[Socket] User joined room: order_${orderId}`);
    });

    socket.on("join_city", (city) => {
      socket.join(`city_${city}`);
      console.log(`[Socket] Driver joined city: ${city}`);
    });

    socket.on("join_driver_room", (driverId) => {
      socket.join(`driver_${driverId}`);
      console.log(`[Socket] Driver joined private room: driver_${driverId}`);
    });

    socket.on("send_message", async (data) => {
      try {
        const { orderId, message, senderId, senderType, senderName } = data;
        if (!orderId || !message) return;

        const savedMsg = await storage.createMessage({
          orderId: Number(orderId),
          content: message,
          senderId: Number(senderId),
          senderType,
          senderName
        });

        io.to(`order_${orderId}`).emit("new_message", savedMsg);
      } catch (err) {
        console.error("[Socket Chat Error]:", err);
      }
    });

    socket.on("update_order_status", async (data) => {
      try {
        const { orderId, status, driverId } = data;
        if (!orderId || !status) return;

        await storage.updateRequestStatus(Number(orderId), status);

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

        io.to(`order_${orderId}`).emit("status_changed", payload);
        io.emit(`order_status_${orderId}`, payload);
        io.emit("request_updated", { id: orderId, ...payload });

        console.log(`[Socket] Order ${orderId} status updated to: ${status}`);
      } catch (error) {
        console.error("[Socket Error] Failed to update status:", error);
      }
    });

    socket.on("update_location", async (data) => {
      const { driverId, lat, lng } = data;
      await storage.updateDriver(driverId, { lastLat: lat, lastLng: lng });
      io.emit(`location_changed_${driverId}`, { lat, lng });
      // بث الموقع لجميع المسؤولين
      io.emit("driver_location_broadcast", { driverId, lat, lng });
    });

    socket.on("driver_location_update", (data) => {
      const { orderId, lat, lng, heading } = data;
      io.to(`order_${orderId}`).emit(`location_changed_order_${orderId}`, { lat, lng, heading });
    });
  });

  app.use('/uploads', express.static(path.resolve(process.cwd(), "public/uploads")));
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // --- مسارات زين كاش ---
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
        return res.status(400).json({ message: result.err || "فشل في الاتصال بزين كاش" });
      }

      const payUrl = ZAIN_CASH_CONFIG.isTest 
        ? `https://test.zaincash.iq/transaction/pay?id=${result.id}` 
        : `https://api.zaincash.iq/transaction/pay?id=${result.id}`;

      res.json({ url: payUrl, transactionId: result.id, status: "success" });
    } catch (err: any) {
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

  app.get("/api/requests/:orderId/messages", async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const messages = await storage.getMessagesByOrder(orderId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "فشل في جلب سجل المحادثة" });
    }
  });
  
  // FEATURE 1: Google Maps Distance Matrix API Proxy
  app.post("/api/distance-matrix", async (req, res) => {
    try {
      const { origin, destination } = req.body;
      
      console.log('🗺️ [DISTANCE MATRIX] Request received');
      console.log(`📍 Origin: ${origin}, Destination: ${destination}`);
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.log('⚠️ [DISTANCE MATRIX] No API key configured - using fallback');
        return res.status(200).json({ status: 'FALLBACK', message: 'Using Haversine calculation' });
      }
      
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;
      
      const response = await axios.get(url);
      
      console.log('✅ [DISTANCE MATRIX] Google API responded');
      
      res.json(response.data);
    } catch (error: any) {
      console.error('❌ [DISTANCE MATRIX] Error:', error.message);
      res.status(500).json({ status: 'ERROR', message: error.message });
    }
  });
  
  // CRITICAL FIX #3: Calculate fare endpoint (with admin-configured pricing)
  app.post("/api/calculate-fare", async (req, res) => {
    try {
      const { distanceKm, durationMinutes, vehicleType } = req.body;
      
      console.log('💰 [CALCULATE FARE] Request:', { distanceKm, durationMinutes, vehicleType });
      
      if (!distanceKm || !vehicleType) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }
      
      // CRITICAL FIX #3: Get admin-configured surge multiplier
      const surgeMultiplier = await PricingConfig.getSurgeMultiplier();
      console.log(`📊 [CALCULATE FARE] Current surge multiplier: ${surgeMultiplier}x`);
      
      // CRITICAL FIX #3: Get admin-configured vehicle pricing
      const vehicleConfig = PricingConfig.getVehiclePricing(vehicleType);
      console.log(`📊 [CALCULATE FARE] Vehicle config for ${vehicleType}:`, vehicleConfig);
      
      // Calculate fare
      const pricingResult = calculateDynamicFare(
        parseFloat(distanceKm),
        parseFloat(durationMinutes || 0),
        vehicleType,
        surgeMultiplier,
        vehicleConfig
      );
      
      console.log('✅ [CALCULATE FARE] Result:', pricingResult);
      
      res.json(pricingResult);
    } catch (error: any) {
      console.error('❌ [CALCULATE FARE] Error:', error);
      res.status(500).json({ message: 'فشل في حساب السعر: ' + error.message });
    }
  });
  
  // CRITICAL FIX #3: Admin Pricing Management Endpoints
  
  // Get current surge multiplier
  app.get("/api/admin/pricing/surge", async (req, res) => {
    try {
      const surge = await PricingConfig.getSurgeMultiplier();
      res.json({ surgeMultiplier: surge });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch surge multiplier' });
    }
  });
  
  // Update surge multiplier (Peak Hour Mode toggle)
  app.post("/api/admin/pricing/surge", async (req, res) => {
    try {
      const { surgeMultiplier } = req.body;
      
      if (typeof surgeMultiplier !== 'number' || surgeMultiplier < 1 || surgeMultiplier > 3) {
        return res.status(400).json({ message: 'Surge multiplier must be between 1.0 and 3.0' });
      }
      
      await PricingConfig.updateSurgeMultiplier(surgeMultiplier);
      
      // Broadcast to all clients that pricing has changed
      io.emit('pricing_updated', { surgeMultiplier });
      
      res.json({ success: true, surgeMultiplier });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update surge multiplier' });
    }
  });
  
  // Get all vehicle pricing configurations
  app.get("/api/admin/pricing/vehicles", async (req, res) => {
    try {
      const allPricing = PricingConfig.getAllVehiclePricing();
      res.json(allPricing);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch vehicle pricing' });
    }
  });
  
  // Update vehicle pricing configuration
  app.put("/api/admin/pricing/vehicles/:vehicleType", async (req, res) => {
    try {
      const { vehicleType } = req.params;
      const { baseFare, kmRate, minuteRate, minimumFare } = req.body;
      
      const updated = PricingConfig.updateVehiclePricing(vehicleType, {
        baseFare: baseFare !== undefined ? parseFloat(baseFare) : undefined,
        kmRate: kmRate !== undefined ? parseFloat(kmRate) : undefined,
        minuteRate: minuteRate !== undefined ? parseFloat(minuteRate) : undefined,
        minimumFare: minimumFare !== undefined ? parseFloat(minimumFare) : undefined
      });
      
      // Broadcast to all clients that pricing has changed
      io.emit('pricing_updated', { vehicleType, config: updated });
      
      res.json({ success: true, config: updated });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update pricing' });
    }
  });
  
  // FEATURE 2: Get route points for navigation polyline
  app.post("/api/route", async (req, res) => {
    try {
      const { origin, destination } = req.body;
      
      console.log('🗺️ [ROUTE] Request:', origin, '->', destination);
      
      if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
        return res.status(400).json({ message: 'Missing coordinates' });
      }
      
      // Try OSRM first (free, open-source routing)
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        
        console.log('🌐 [ROUTE] Calling OSRM...');
        
        const response = await axios.get(osrmUrl);
        
        if (response.data?.code === 'Ok' && response.data?.routes?.[0]?.geometry?.coordinates) {
          const coordinates = response.data.routes[0].geometry.coordinates;
          // OSRM returns [lng, lat], we need [lat, lng] for Leaflet
          const points = coordinates.map((coord: number[]) => [coord[1], coord[0]]);
          
          console.log(`✅ [ROUTE] OSRM returned ${points.length} points`);
          
          return res.json({ 
            points, 
            source: 'OSRM',
            distance: response.data.routes[0].distance,
            duration: response.data.routes[0].duration
          });
        }
      } catch (osrmError) {
        console.warn('⚠️ [ROUTE] OSRM failed, trying fallback');
      }
      
      // Fallback: Google Directions API (if key is configured)
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (apiKey) {
        try {
          const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}`;
          
          console.log('🌐 [ROUTE] Calling Google Directions...');
          
          const response = await axios.get(googleUrl);
          
          if (response.data?.status === 'OK' && response.data?.routes?.[0]?.overview_polyline?.points) {
            // Decode Google polyline
            const points = decodeGooglePolyline(response.data.routes[0].overview_polyline.points);
            
            console.log(`✅ [ROUTE] Google Directions returned ${points.length} points`);
            
            return res.json({ 
              points, 
              source: 'Google',
              distance: response.data.routes[0].legs[0].distance.value,
              duration: response.data.routes[0].legs[0].duration.value
            });
          }
        } catch (googleError) {
          console.warn('⚠️ [ROUTE] Google Directions failed');
        }
      }
      
      // Last resort: straight line
      console.log('⚠️ [ROUTE] Using straight line fallback');
      res.json({ 
        points: [[origin.lat, origin.lng], [destination.lat, destination.lng]], 
        source: 'straight-line' 
      });
    } catch (error: any) {
      console.error('❌ [ROUTE] Error:', error);
      res.status(500).json({ message: 'فشل في حساب المسار' });
    }
  });

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
  
  // CRITICAL: Customer profile image update endpoint
  app.patch("/api/users/:phone/update-image", async (req, res) => {
    try {
      const { phone } = req.params;
      const { image } = req.body;
      
      console.log(`📸 [CUSTOMER IMAGE] Updating profile image for customer: ${phone}`);
      
      if (!image) {
        return res.status(400).json({ message: "لم يتم تقديم صورة" });
      }
      
      const updatedUser = await storage.updateUser(phone, { image });
      
      console.log(`✅ [CUSTOMER IMAGE] Profile image updated successfully for customer: ${phone}`);
      
      res.json({ 
        success: true, 
        user: updatedUser,
        message: "تم تحديث الصورة بنجاح" 
      });
    } catch (err: any) {
      console.error("❌ [CUSTOMER IMAGE ERROR]:", err);
      res.status(500).json({ message: "فشل في تحديث الصورة: " + err.message });
    }
  });

  // --- مسارات السائقين ---

  app.post("/api/drivers", async (req, res) => {
    try {
      const input = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(input);
      res.status(201).json(driver);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: `خطأ في التحقق: ${err.errors[0].message}` });
      }
      if (err.message && err.message.includes("unique constraint")) {
        return res.status(400).json({ message: "رقم الهاتف هذا مسجل مسبقاً" });
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

      const driverRequests = await storage.getDriverRequests(driver.id);
      const activeOrder = driverRequests.find(req => ACTIVE_STATUSES.includes(req.status));

      res.json({
        ...driver,
        activeOrder: activeOrder || null
      });

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

      const driverRequests = await storage.getDriverRequests(driverId);
      const activeOrder = driverRequests.find(req => ACTIVE_STATUSES.includes(req.status));

      res.json({
        ...driver,
        activeOrder: activeOrder || null
      });

    } catch (err: any) {
      console.error("[Driver Me Error]:", err);
      res.status(500).json({ message: "حدث خطأ داخلي" });
    }
  });

  app.get("/api/drivers/:id/requests", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
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

      // CRITICAL: Check wallet payment and deduct balance BEFORE creating order
      if (bodyData.paymentMethod === "wallet") {
        console.log("💰 [ORDER CREATE] Wallet payment selected - checking balance");
        
        if (!customer) {
          return res.status(400).json({ message: "لم يتم العثور على حساب الزبون" });
        }
        
        const customerBalance = parseFloat(customer.walletBalance || "0");
        const orderAmount = parseFloat(bodyData.price || "0");
        
        console.log(`💰 [ORDER CREATE] Customer balance: ${customerBalance} IQD`);
        console.log(`💰 [ORDER CREATE] Order amount: ${orderAmount} IQD`);
        
        if (customerBalance < orderAmount) {
          console.log("❌ [ORDER CREATE] Insufficient balance");
          return res.status(400).json({ 
            message: `رصيدك غير كافٍ. الرصيد الحالي: ${customerBalance} د.ع، المبلغ المطلوب: ${orderAmount} د.ع` 
          });
        }
        
        // CRITICAL: Deduct amount from customer wallet
        const newBalance = customerBalance - orderAmount;
        await storage.updateCustomerWallet(customer.phone, -orderAmount); // Negative to deduct
        
        console.log(`✅ [ORDER CREATE] Wallet deducted successfully`);
        console.log(`✅ [ORDER CREATE] Customer ${customer.phone} - Old Balance: ${customerBalance} → New Balance: ${newBalance} IQD`);
        
        // Create transaction record for the deduction
        await storage.createTransaction({
          userId: customer.id,
          amount: (-orderAmount).toString(),
          type: "order_payment",
          status: "completed",
          referenceId: `ORDER_PAYMENT_${Date.now()}`
        });
        
        console.log(`✅ [ORDER CREATE] Transaction record created for wallet payment`);
        
        // Emit socket event to update customer's wallet in real-time
        io.emit(`customer_wallet_updated_${customer.id}`, {
          newBalance: newBalance.toFixed(2),
          amount: -orderAmount,
          type: "debit",
          message: `تم خصم ${orderAmount} د.ع مقابل الطلب`
        });
        
        console.log(`✅ [ORDER CREATE] Socket event emitted to update customer wallet UI`);
      }

      const request = await storage.createRequest({
        ...validatedData,
        status: status || "pending"
      });

      // CRITICAL FIX #1: STRICT Vehicle Type Filtering - 100% Isolation
      console.log(`\n╔════════════════════════════════════════════════════════╗`);
      console.log(`║  🚗 VEHICLE TYPE FILTER - Request #${request.id}`)
      console.log(`║  Type Requested: "${request.vehicleType}"`);
      console.log(`╚════════════════════════════════════════════════════════╝\n`);
      
      const requestVehicleType = request.vehicleType || "سطحة";
      
      // STEP 1: Get ALL drivers
      const allDrivers = await storage.getDrivers();
      console.log(`📊 [FILTER] Total drivers in DB: ${allDrivers.length}`);
      
      // STEP 2: Filter by ONLINE status
      const onlineDrivers = allDrivers.filter(d => d.isOnline);
      console.log(`📊 [FILTER] Online drivers: ${onlineDrivers.length}`);
      
      // STEP 3: STRICT vehicle type matching
      const matchingDrivers = onlineDrivers.filter(driver => {
        const match = driver.vehicleType === requestVehicleType;
        console.log(`  ${match ? '✅' : '❌'} Driver #${driver.id} (${driver.name}): "${driver.vehicleType}" ${match ? '==' : '!='} "${requestVehicleType}"`);
        return match;
      });
      
      console.log(`\n✅ [FILTER] RESULT: ${matchingDrivers.length} matching drivers\n`);
      
      if (matchingDrivers.length === 0) {
        console.warn(`⚠️  [FILTER] NO MATCHING DRIVERS for "${requestVehicleType}"`);
        console.warn(`⚠️  Request #${request.id} will wait for matching driver to come online\n`);
      }
      
      // STEP 4: Emit to ONLY matching drivers (targeted rooms)
      matchingDrivers.forEach(driver => {
        io.to(`driver_${driver.id}`).emit("new_request_available", request);
        console.log(`📤 [EMIT] Sent to driver_${driver.id} (${driver.name})`);
      });
      
      // STEP 5: City broadcast (admin tracking only)
      io.to(`city_${detectedCity}`).emit("new_request_in_city", {
        ...request,
        matchingDriversCount: matchingDrivers.length
      });
      
      // STEP 6: Admin dashboard update
      io.emit("request_updated", { 
        id: request.id, 
        status: "pending", 
        matchingDriversCount: matchingDrivers.length,
        ...request 
      });
      
      console.log(`✅ [BROADCAST] Complete for Request #${request.id}\n`);

      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ message: "خطأ في إنشاء الطلب: " + err.message });
    }
  });

  app.post("/api/drivers/:id/accept/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const requestId = Number(req.params.requestId);

      // [تصليح]: فحص حالة الطلب في قاعدة البيانات أولاً لمنع القبول المزدوج
      const currentRequest = await storage.getRequest(requestId);
      if (!currentRequest) return res.status(404).json({ message: "الطلب لم يعد متاحاً" });
      if (currentRequest.status !== "pending") {
        return res.status(400).json({ message: "عذراً، هذا الطلب تم قبوله بالفعل من قبل سائق آخر" });
      }

      // [تصليح]: فحص إذا كان السائق مشغولاً
      const driverRequests = await storage.getDriverRequests(driverId);
      const isBusy = driverRequests.some(r => ACTIVE_STATUSES.includes(r.status));
      if (isBusy) {
        return res.status(400).json({ message: "لديك رحلة نشطة حالياً، أكملها أولاً" });
      }

      const driver = await storage.getDriver(driverId);
      const systemSettings = await storage.getSettings();
      const currentCommission = Number(systemSettings?.commissionAmount || 1000);

      if (Number(driver?.walletBalance) < currentCommission) {
        return res.status(400).json({ 
          message: `رصيدك غير كافٍ، يرجى شحن المحفظة (أقل رصيد مطلوب ${currentCommission} دينار).` 
        });
      }

      const result = await storage.acceptRequest(driverId, requestId);
      
      // جلب معلومات الطلب لإرسالها للسائق
      const request = await storage.getRequest(requestId);

      const payload = { 
        status: "accepted", 
        driverId,
        driverInfo: { 
          name: driver?.name, 
          phone: driver?.phone, 
          avatarUrl: driver?.avatarUrl,
          vehicleType: driver?.vehicleType,
          plateNumber: driver?.plateNumber,
          lat: driver?.lastLat, 
          lng: driver?.lastLng 
        },
        // إضافة معلومات الزبون للسائق (including customer image)
        customerInfo: {
          name: request?.customerName,
          phone: request?.customerPhone,
          image: (request as any)?.customerImage || null, // Include customer profile image
          pickupLat: request?.pickupLat,
          pickupLng: request?.pickupLng,
          dropoffLat: request?.destLat,
          dropoffLng: request?.destLng,
          pickupAddress: request?.pickupAddress,
          dropoffAddress: request?.destination
        }
      };

      // إشعار الزبون بمعلومات السائق الكاملة
      io.to(`order_${requestId}`).emit("status_changed", payload);
      io.emit(`order_status_${requestId}`, payload);
      
      // إشعار السائق بمعلومات الزبون الكاملة
      io.to(`driver_${driverId}`).emit("customer_info", payload.customerInfo);

      // [تصحيح] إشعار لوحة تحكم المدير فوراً لتحديث القائمة دون Refresh
      io.emit("request_updated", { id: requestId, ...payload });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/drivers/:id/complete/:requestId", async (req, res) => {
    try {
      const driverId = Number(req.params.id);
      const requestId = Number(req.params.requestId);

      const request = await storage.getRequest(requestId);
      if (!request) return res.status(404).json({ message: "الطلب غير موجود" });

      if (!ACTIVE_STATUSES.includes(request.status)) {
         if (request.status === "completed") return res.status(400).json({ message: "هذا الطلب مكتمل مسبقاً" });
         return res.status(400).json({ message: "يجب قبول الطلب أولاً قبل إكماله" });
      }

      if (!request.driverId || Number(request.driverId) === 0) {
        await storage.assignRequestToDriver(requestId, driverId);
        request.driverId = driverId;
      } else if (Number(request.driverId) !== driverId) {
        return res.status(403).json({ 
          message: `خطأ ملكية: الطلب مسجل للسائق رقم (${request.driverId})` 
        });
      }

      const driver = await storage.getDriver(driverId);
      if (!driver) return res.status(404).json({ message: "بيانات السائق غير موجودة" });

      const systemSettings = await storage.getSettings();
      const fee = Number(systemSettings?.commissionAmount || 1000);

      await storage.updateRequestStatus(requestId, "completed");

      const currentBalance = parseFloat(driver.walletBalance || "0");
      const newBalance = (currentBalance - fee).toFixed(2);
      await storage.updateDriver(driverId, { walletBalance: newBalance.toString() });

      await storage.createTransaction({
        driverId,
        amount: (-fee).toString(),
        type: "fee",
        status: "completed",
        referenceId: `REQ-${requestId}`
      });

      // إشعار الزبون بالاستكمال وإعادة التوجيه لصفحة Booking
      io.to(`order_${requestId}`).emit("status_changed", { status: "completed", resetToBooking: true });
      io.emit(`order_status_${requestId}`, { status: "completed", resetToBooking: true });
      
      // إشعار جميع السائقين لإزالة هذا الطلب من قوائمهم
      io.emit("request_removed", { id: requestId });
      io.emit("update_order_status", { orderId: requestId, status: "completed" });

      // إشعار المدير باكتمال الطلب
      io.emit("request_updated", { id: requestId, status: "completed" });

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

  // [تصليح جوهري]: تعديل مسار جلب الطلبات ليعيد الطلبات حسب المستخدم
  app.get("/api/requests", async (req, res) => {
    try {
      const allRequests = await storage.getRequests();
      
      // للإدارة: إرجاع كل الطلبات غير المكتملة
      // للسائقين: إرجاع الطلبات المعلقة فقط
      const isAdminRequest = req.query.role === 'admin';
      
      const filteredRequests = isAdminRequest 
        ? allRequests.filter(r => r.status !== "completed") // Admin sees all active orders
        : allRequests.filter(r => r.status === "pending");  // Drivers see only pending

      const detailedRequests = await Promise.all(filteredRequests.map(async (req) => {
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
  
  // CRITICAL FIX: Endpoint for customer trip history
  app.get("/api/users/:phone/requests", async (req, res) => {
    try {
      const { phone } = req.params;
      console.log(`[Trip History] Fetching requests for customer: ${phone}`);
      
      const allRequests = await storage.getRequests();
      const userRequests = allRequests.filter(r => r.customerPhone === phone);
      
      console.log(`[Trip History] Found ${userRequests.length} requests for ${phone}`);
      console.log(`[Trip History] Statuses:`, userRequests.map(r => ({ id: r.id, status: r.status })));
      
      // CRITICAL FIX: Include FULL driver data with JOIN for complete state hydration
      const detailedRequests = await Promise.all(userRequests.map(async (req) => {
        const driver = req.driverId ? await storage.getDriver(req.driverId) : null;
        return {
          // Order fields
          id: req.id,
          status: req.status,
          pickupLat: req.pickupLat,
          pickupLng: req.pickupLng,
          pickupAddress: req.pickupAddress || req.location || "غير محدد",
          destLat: req.destLat,
          destLng: req.destLng,
          dropoffLat: req.destLat, // Alias for compatibility
          dropoffLng: req.destLng, // Alias for compatibility
          destination: req.destination || "غير محدد",
          location: req.pickupAddress || req.location,
          price: req.price,
          vehicleType: req.vehicleType,
          customerName: req.customerName,
          customerPhone: req.customerPhone,
          createdAt: req.createdAt,
          driverId: req.driverId,
          
          // CRITICAL: Full driver object for immediate state hydration
          driver: driver ? {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            avatarUrl: driver.avatarUrl || "",
            vehicleType: driver.vehicleType || "سطحة",
            plateNumber: driver.plateNumber || "",
            lat: driver.lastLat || driver.lat, // Live location
            lng: driver.lastLng || driver.lng, // Live location
            lastLat: driver.lastLat,
            lastLng: driver.lastLng
          } : null,
          
          // Legacy fields for backwards compatibility
          driverName: driver?.name || "غير معروف",
          driverPhone: driver?.phone
        };
      }));
      
      console.log(`[Trip History] Returning ${detailedRequests.length} detailed requests with driver data`);
      res.json(detailedRequests);
    } catch (err: any) {
      console.error("[Trip History Error]:", err);
      res.status(500).json({ message: err.message || "فشل في جلب سجل الرحلات" });
    }
  });
  
  // جلب طلب محدد مع تفاصيل الزبون الكاملة (للإدارة)
  app.get("/api/requests/:id", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const request = await storage.getRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }
      
      // جلب بيانات الزبون الحقيقية من قاعدة البيانات
      const user = await storage.getUserByPhone(request.customerPhone);
      const driver = request.driverId ? await storage.getDriver(request.driverId) : null;
      
      const balance = user ? Number(user.walletBalance) : 0;
      
      const detailedRequest = {
        ...request,
        walletBalance: balance,
        customerWalletBalance: balance,
        userBalance: balance,
        driver: driver,
        user: user ? {
          id: user.id,
          username: user.username,
          phone: user.phone,
          walletBalance: user.walletBalance,
          city: user.city
        } : {
          id: 0,
          username: request.customerName,
          phone: request.customerPhone,
          walletBalance: "0",
          city: request.city
        }
      };
      
      res.json(detailedRequest);
    } catch (err) {
      console.error("Error fetching request:", err);
      res.status(500).json({ message: "فشل في جلب تفاصيل الطلب" });
    }
  });

  // --- مسارات الإدارة ---
  app.post("/api/admin/customers/adjust-wallet", async (req, res) => {
    try {
      const { customerPhone, amount, adminId } = req.body;
      const amountNum = Number(amount);
      
      console.log(`💰 [ADMIN WALLET] Admin ${adminId || 'Unknown'} initiating wallet adjustment for customer ${customerPhone}`);
      console.log(`💰 [ADMIN WALLET] Amount: ${amountNum} IQD`);
      
      // CRITICAL: Update customer balance in database
      const updated = await storage.updateCustomerWallet(customerPhone, amountNum);
      
      console.log(`✅ [ADMIN WALLET] Database updated successfully`);
      console.log(`✅ [ADMIN WALLET] Customer ${customerPhone} - Old Balance: ${(parseFloat(updated.walletBalance) - amountNum).toFixed(2)} → New Balance: ${updated.walletBalance} IQD`);
      
      // CRITICAL: Create transaction record for audit trail
      await storage.createTransaction({
        userId: updated.id,
        amount: amountNum.toString(),
        type: amountNum > 0 ? "admin_credit" : "admin_debit",
        status: "completed",
        referenceId: `ADMIN_ADJUST_${Date.now()}`
      });
      
      console.log(`✅ [ADMIN WALLET] Transaction record created in database`);
      
      // CRITICAL: Emit real-time socket event to customer
      io.emit(`customer_wallet_updated_${updated.id}`, { 
        newBalance: updated.walletBalance,
        amount: amountNum,
        type: amountNum > 0 ? "credit" : "debit",
        message: amountNum > 0 ? "تم إضافة رصيد من الإدارة" : "تم خصم رصيد من الإدارة"
      });
      
      console.log(`✅ [ADMIN WALLET] Socket event emitted to customer (customer_wallet_updated_${updated.id})`);
      console.log(`🎉 [ADMIN WALLET] Admin ${adminId || 'Unknown'} successfully adjusted Customer ${updated.id} wallet. Final Balance: ${updated.walletBalance} IQD`);
      
      res.json({ 
        success: true,
        user: updated,
        message: "تم تحديث المحفظة بنجاح"
      });
    } catch (err: any) {
      console.error("❌ [ADMIN WALLET ERROR]:", err);
      res.status(500).json({ message: "فشل في تحديث محفظة الزبون: " + err.message });
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
      
      console.log(`[Admin Assign] Request ${requestId} → Driver ${driverId}`);
      
      // CRITICAL: Check if this is a TRANSFER (order already has a different driver)
      const currentRequest = await storage.getRequest(requestId);
      const previousDriverId = currentRequest?.driverId;
      const isTransfer = previousDriverId && previousDriverId !== driverId;
      
      if (isTransfer) {
        console.log(`🔄 [TRANSFER] Moving order ${requestId} from Driver ${previousDriverId} to Driver ${driverId}`);
      }
      
      // تعيين الطلب للسائق في قاعدة البيانات
      const updated = await storage.assignRequestToDriver(requestId, driverId);
      const driver = await storage.getDriver(driverId);
      const requestDetails = await storage.getRequest(requestId); 

      if (!driver) {
        return res.status(404).json({ message: "السائق غير موجود" });
      }
      
      if (!requestDetails) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      // إعداد البيانات الكاملة للسائق والزبون
      const fullOrderData = {
        ...requestDetails,
        id: requestId,
        status: "accepted",
        driverId,
        assignedByAdmin: true,
        customerName: requestDetails.customerName,
        customerPhone: requestDetails.customerPhone,
        pickupLat: requestDetails.pickupLat,
        pickupLng: requestDetails.pickupLng,
        pickupAddress: requestDetails.pickupAddress,
        destination: requestDetails.destination,
        price: requestDetails.price,
        vehicleType: requestDetails.vehicleType
      };
      
      const payload = { 
        status: "accepted",
        driverId, 
        driverInfo: {
          name: driver.name,
          phone: driver.phone,
          avatarUrl: driver.avatarUrl,
          vehicleType: driver.vehicleType,
          plateNumber: driver.plateNumber,
          lat: driver.lastLat,
          lng: driver.lastLng
        },
        customerInfo: {
          name: requestDetails.customerName,
          phone: requestDetails.customerPhone,
          image: (requestDetails as any).customerImage || null, // Include customer profile image
          pickupLat: requestDetails.pickupLat,
          pickupLng: requestDetails.pickupLng,
          dropoffLat: requestDetails.destLat,
          dropoffLng: requestDetails.destLng,
          pickupAddress: requestDetails.pickupAddress,
          dropoffAddress: requestDetails.destination
        }
      };

      // إشعار الزبون بقبول الطلب
      io.to(`order_${requestId}`).emit("status_changed", payload);
      io.emit(`order_status_${requestId}`, payload);

      // CRITICAL: If this is a TRANSFER, notify the previous driver to IMMEDIATELY clear their UI
      if (isTransfer && previousDriverId) {
        console.log(`🔄 [TRANSFER] Notifying previous driver ${previousDriverId} to remove order from their screen`);
        io.to(`driver_${previousDriverId}`).emit("order_removed_from_driver", {
          orderId: requestId,
          newDriverId: driverId,
          message: "تم نقل الطلب إلى سائق آخر من قبل الإدارة",
          reason: "admin_transfer"
        });
        console.log(`✅ [TRANSFER] Previous driver ${previousDriverId} notified via order_removed_from_driver event`);
      }

      // CRITICAL: إشعار السائق بالطلب الجديد مع كل التفاصيل - FORCE UI TRANSITION
      if (driverId) {
        console.log(`🚨 [CRITICAL] Emitting to driver_${driverId}:`, fullOrderData);
        
        // EMIT MULTIPLE EVENTS FOR REDUNDANCY AND FORCE UI UPDATE
        io.to(`driver_${driverId}`).emit("order_assigned", fullOrderData);
        io.to(`driver_${driverId}`).emit("ORDER_UPDATED", fullOrderData);
        io.to(`driver_${driverId}`).emit("NEW_ORDER_ASSIGNED", fullOrderData); // NEW explicit event
        
        // إرسال معلومات الزبون للسائق
        io.to(`driver_${driverId}`).emit("customer_info", payload.customerInfo);
        
        console.log(`✅ [CRITICAL] Successfully emitted ALL assignment events to driver_${driverId}`);
      }

      // إزالة الطلب من قوائم السائقين الآخرين
      io.emit("request_removed", { id: requestId });
      io.emit("update_order_status", { orderId: requestId, status: "accepted", driverId });
      io.emit("request_updated", { id: requestId, ...payload, driverId });

      res.json({ success: true, updated, driver, request: requestDetails, fullOrderData });
    } catch (err: any) {
      console.error("Admin assign error:", err);
      res.status(400).json({ message: err.message || "فشل في تحويل الطلب للسائق" });
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
  
  // Customer cancels their own order
  app.delete("/api/requests/:id", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      console.log(`[Customer Cancel] Deleting request ${requestId}`);
      
      const request = await storage.getRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }
      
      const driverId = request.driverId;
      
      // Delete from database
      await storage.deleteRequest(requestId);
      
      // Notify driver if assigned
      if (driverId) {
        io.to(`driver_${driverId}`).emit("order_cancelled_by_customer", { 
          requestId,
          message: "قام الزبون بإلغاء الطلب"
        });
      }
      
      // Notify admin
      io.emit("request_deleted", { id: requestId });
      
      // Remove from all drivers' available lists (no new_request broadcast)
      io.emit("request_removed", { id: requestId });
      
      console.log(`✅ [Customer Cancel] Request ${requestId} deleted successfully`);
      
      res.json({ success: true, message: "تم إلغاء الطلب بنجاح" });
    } catch (err: any) {
      console.error("[Customer Cancel Error]:", err);
      res.status(500).json({ message: "فشل في إلغاء الطلب" });
    }
  });
  
  // حذف طلب بدون خصم عمولة من السائق
  app.delete("/api/admin/requests/:requestId/delete-without-commission", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const request = await storage.getRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }
      
      const driverId = request.driverId;
      
      // حذف الطلب من قاعدة البيانات بدون خصم عمولة
      await storage.deleteRequest(requestId);
      
      // إشعار الزبون بإلغاء الطلب
      io.to(`order_${requestId}`).emit("order_deleted_by_admin", { 
        message: "تم إلغاء طلبك من قبل الإدارة" 
      });
      
      // إشعار السائق بإلغاء الطلب
      if (driverId) {
        io.to(`driver_${driverId}`).emit("order_deleted_by_admin", { 
          requestId,
          message: "تم حذف الطلب من قبل الإدارة" 
        });
      }
      
      // إشعار الإدارة بالحذف
      io.emit("request_deleted", { id: requestId });
      
      res.json({ success: true, message: "تم حذف الطلب بنجاح بدون خصم عمولة" });
    } catch (err: any) {
      console.error("Delete order error:", err);
      res.status(500).json({ message: "فشل في حذف الطلب" });
    }
  });

  // CRITICAL: Admin Force Complete Order
  app.post("/api/admin/requests/:requestId/force-complete", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      console.log(`🚨 [ADMIN] Force completing request ${requestId}`);
      
      const request = await storage.getRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }
      
      const driverId = request.driverId;
      if (!driverId) {
        return res.status(400).json({ message: "لا يوجد سائق مرتبط بهذا الطلب" });
      }
      
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "السائق غير موجود" });
      }
      
      // Get commission settings
      const settingsData = await storage.getSettings();
      const fee = parseFloat(settingsData.commissionAmount?.toString() || "0");
      
      // Update order status to completed
      await storage.updateRequestStatus(requestId, "completed");
      
      // Deduct commission from driver
      const currentBalance = parseFloat(driver.walletBalance || "0");
      const newBalance = (currentBalance - fee).toFixed(2);
      await storage.updateDriver(driverId, { walletBalance: newBalance.toString() });
      
      // Create transaction record
      await storage.createTransaction({
        driverId,
        amount: (-fee).toString(),
        type: "fee",
        status: "completed",
        referenceId: `ADMIN_COMPLETE_${requestId}`
      });
      
      console.log(`✅ [ADMIN] Order ${requestId} force-completed. Driver ${driverId} balance: ${currentBalance} → ${newBalance}`);
      
      // FORCE CLEAR Driver's activeOrder via socket
      io.to(`driver_${driverId}`).emit("ADMIN_FORCE_COMPLETE", { 
        requestId,
        newBalance,
        message: `تم إتمام الطلب #${requestId} من قبل الإدارة`
      });
      
      // Notify customer
      io.to(`order_${requestId}`).emit("status_changed", { 
        status: "completed", 
        resetToBooking: true 
      });
      io.emit(`order_status_${requestId}`, { 
        status: "completed", 
        resetToBooking: true 
      });
      
      // Notify all drivers to remove from lists
      io.emit("request_removed", { id: requestId });
      io.emit("update_order_status", { orderId: requestId, status: "completed" });
      
      // Update admin dashboard
      io.emit("request_updated", { id: requestId, status: "completed" });
      
      res.json({ 
        success: true, 
        message: "تم إتمام الطلب بنجاح من قبل الإدارة",
        newBalance,
        fee
      });
    } catch (err: any) {
      console.error("[Admin Force Complete Error]:", err);
      res.status(500).json({ message: "فشل في إتمام الطلب: " + err.message });
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