import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

// استيراد الصفحات الموجودة مسبقاً
import RequestFlow from "@/pages/request-flow";
import DriverDashboard from "@/pages/driver-dashboard";
import LandingPage from "@/pages/landing-page";
import NotFound from "@/pages/not-found";
import DriverTracking from "@/pages/driver-tracking";
import { SplashScreen } from "@/components/splash-screen";

// ✅ التصحيح النهائي: استخدام حروف صغيرة وشرطة لتطابق أسماء ملفاتك في المجلد
import AdminLogin from "@/pages/admin-login"; 
import AdminDashboard from "@/pages/admin-dashboard";

function Router() {
  return (
    <Switch>
      {/* واجهة الزبون والترحيب */}
      <Route path="/" component={LandingPage} />

      {/* صفحة طلب السطحة وتحديد الموقع */}
      <Route path="/request" component={RequestFlow} />

      {/* صفحة تتبع السطحة (للزبون) */}
      <Route path="/track/:id" component={DriverTracking} />

      {/* واجهة السائق (Dashboard) */}
      <Route path="/driver" component={DriverDashboard} />

      {/* بوابة دخول الإدارة */}
      <Route path="/admin-login" component={AdminLogin} />

      {/* لوحة التحكم المركزية للمدير (الرابط السري) */}
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
    }, 4000);
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