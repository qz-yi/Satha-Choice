import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// استيراد الصفحات الموجودة مسبقاً (دون تغيير)
import RequestFlow from "@/pages/request-flow";
import DriverDashboard from "@/pages/driver-dashboard";
import LandingPage from "@/pages/landing-page";
import NotFound from "@/pages/not-found";
import DriverTracking from "@/pages/driver-tracking";
import { SplashScreen } from "@/components/splash-screen";

// ✅ استيراد الصفحات الجديدة والمسؤول
import AdminLogin from "@/pages/admin-login"; 
import AdminDashboard from "@/pages/admin-dashboard";
// ✅ تم تغيير المسمى هنا ليشمل (التسجيل + تسجيل الدخول) الذي صنعناه مؤخراً
import DriverAuth from "@/pages/driver-signup";

// ── FCM Utilities (shared across login flows) ──────────────────────────────

/**
 * بعد تسجيل الدخول مباشرةً: إرسال التوكن المؤجّل للسيرفر إن وُجد.
 * يُستدعى من صفحات تسجيل الدخول (driver-signup, request-flow).
 */
export async function flushPendingFcmToken(
  role: "driver" | "user",
  identifier: string | number   // driverId أو phone
) {
  if (!Capacitor.isNativePlatform()) return;
  const token = localStorage.getItem("pending_fcm_token");
  if (!token) return;

  const endpoint =
    role === "driver"
      ? "/api/drivers/update-fcm-token"
      : "/api/users/update-fcm-token";
  const body =
    role === "driver"
      ? { driverId: Number(identifier), fcmToken: token }
      : { phone: String(identifier), fcmToken: token };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(`✅ [FCM] Pending token flushed (${role}):`, data);
    localStorage.removeItem("pending_fcm_token");
  } catch (e) {
    console.warn(`⚠️ [FCM] Failed to flush pending ${role} token:`, e);
  }
}

// ── FCM Token Registration ─────────────────────────────────────────────────
async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    console.log("📵 [FCM] Skipped — not a native platform (running in browser)");
    return;
  }

  try {
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.warn("⚠️ [FCM] Push notification permission denied");
      return;
    }

    // إزالة المستمعين القديمة قبل إضافة الجديدة لتجنب التكرار
    await PushNotifications.removeAllListeners();

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      const fcmToken = token.value;
      console.log("🔔 [FCM] Token received:", fcmToken.slice(0, 30) + "...");

      const savedUser = localStorage.getItem("sat7a_user");
      const driverId  = localStorage.getItem("currentDriverId");

      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          const res = await fetch("/api/users/update-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: user.phone, fcmToken }),
          });
          const data = await res.json();
          console.log("✅ [FCM] User token saved:", data);
          localStorage.removeItem("pending_fcm_token");
        } catch (e) {
          console.warn("⚠️ [FCM] Failed to save user token:", e);
        }
      } else if (driverId) {
        try {
          const res = await fetch("/api/drivers/update-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ driverId: Number(driverId), fcmToken }),
          });
          const data = await res.json();
          console.log("✅ [FCM] Driver token saved:", data);
          localStorage.removeItem("pending_fcm_token");
        } catch (e) {
          console.warn("⚠️ [FCM] Failed to save driver token:", e);
        }
      } else {
        // المستخدم لم يسجل دخوله بعد — حفظ التوكن محلياً لإرساله بعد الدخول
        localStorage.setItem("pending_fcm_token", fcmToken);
        console.log("📦 [FCM] Token stored locally — will be sent after login");
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("❌ [FCM] Registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("📩 [FCM] Foreground notification:", notification);
      const title = notification.title || "إشعار جديد";
      const body  = notification.body  || "";
      if (title || body) {
        alert(`${title}${body ? "\n" + body : ""}`);
      }
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("👆 [FCM] Notification tapped:", action);
    });

  } catch (err) {
    console.warn("⚠️ [FCM] Push notification setup failed:", err);
  }
}

function Router() {
  return (
    <Switch>
      {/* واجهة الزبون هي الأساس */}
      <Route path="/" component={LandingPage} />

      {/* صفحة طلب السطحة وتحديد الموقع */}
      <Route path="/request" component={RequestFlow} />

      {/* صفحة تتبع السطحة (للزبون) */}
      <Route path="/track/:id" component={DriverTracking} />

      {/* واجهة السائق (لوحة التحكم الداخلية) */}
      <Route path="/driver" component={DriverDashboard} />

      {/* ✅ الواجهة الجديدة: واجهة تسجيل الدخول أو إنشاء حساب للسائق */}
      <Route path="/driver-signup" component={DriverAuth} />

      {/* بوابة دخول الإدارة */}
      <Route path="/admin-login" component={AdminLogin} />

      {/* لوحة التحكم المركزية للمدير (الرابط السري 2026) */}
      <Route path="/satha-control-center-2026" component={AdminDashboard} />

      {/* صفحة الخطأ 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000); 
    return () => clearTimeout(timer);
  }, []);

  // Register push notifications on app launch (native only)
  useEffect(() => {
    registerPushNotifications();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div dir="rtl" className="font-sans antialiased h-full flex flex-col bg-background text-foreground overflow-hidden">
          {showSplash ? <SplashScreen /> : <Router />}
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}