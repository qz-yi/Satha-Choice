import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import RequestFlow from "@/pages/request-flow";
import DriverDashboard from "@/pages/driver-dashboard";
import LandingPage from "@/pages/landing-page";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/splash-screen";
import DriverTracking from "@/pages/driver-tracking";
function Router() {
  return (
    <Switch>
      {/* واجهة الزبون الرئيسية */}
      <Route path="/" component={LandingPage} />
      
      {/* صفحة طلب السطحة */}
      <Route path="/request" component={RequestFlow} />
 {/* صفحة تتبع السطحة */}
<Route path="/track/:id" component={DriverTracking} />
      
      {/* واجهة السائق */}
      <Route path="/driver" component={DriverDashboard} />
      
      {/* صفحة الخطأ */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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

export default App;
