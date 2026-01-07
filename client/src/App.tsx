import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

// استيراد الصفحات
import RequestFlow from "@/pages/request-flow";
import DriverDashboard from "@/pages/driver-dashboard";
import LandingPage from "@/pages/landing-page";
import NotFound from "@/pages/not-found";
import DriverTracking from "@/pages/driver-tracking";
import { SplashScreen } from "@/components/splash-screen";
import AdminLogin from "@/pages/admin-login"; 
import AdminDashboard from "@/pages/admin-dashboard";
import DriverAuth from "@/pages/driver-signup"; 

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/request" component={RequestFlow} />
      <Route path="/tracking" component={DriverTracking} />
      <Route path="/track/:id" component={DriverTracking} />
      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver-signup" component={DriverAuth} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/satha-control-center-2026" component={AdminDashboard} />
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
          {showSplash ? <SplashScreen isLoaded={!showSplash} /> : <Router />}
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
