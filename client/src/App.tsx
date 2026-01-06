import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div dir="rtl" className="font-sans antialiased min-h-screen bg-background text-foreground">
          {showSplash ? <SplashScreen /> : <Router />}
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}