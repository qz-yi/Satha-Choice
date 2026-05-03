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

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      const fcmToken = token.value;
      console.log("🔔 [FCM] Token received:", fcmToken);

      // Determine role and send token to server
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
        } catch (e) {
          console.warn("⚠️ [FCM] Failed to save driver token:", e);
        }
      } else {
        // Store for later — will be sent after login
        localStorage.setItem("pending_fcm_token", fcmToken);
        console.log("📦 [FCM] Token stored locally (user not logged in yet)");
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("❌ [FCM] Registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("📩 [FCM] Notification received (foreground):", notification);
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