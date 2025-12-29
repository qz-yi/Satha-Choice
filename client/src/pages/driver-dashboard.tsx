import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, LogOut, Signal, SignalLow, Clock, MapPin, Navigation, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [countdown, setCountdown] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/drivers/1")
      .then(res => res.json())
      .then(data => {
        setDriver(data);
        setIsOnline(data.isOnline);
      })
      .catch(console.error);

    // Polling for new requests
    const interval = setInterval(() => {
      if (isOnline && !activeRequest && !pendingRequest) {
        fetch("/api/requests")
          .then(res => res.json())
          .then(data => {
            const pending = data.find((r: any) => r.status === "pending");
            if (pending) {
              setPendingRequest(pending);
              setCountdown(30);
            }
          })
          .catch(console.error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOnline, activeRequest, pendingRequest]);

  useEffect(() => {
    let timer: any;
    if (pendingRequest && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (countdown === 0) {
      setPendingRequest(null);
    }
    return () => clearInterval(timer);
  }, [pendingRequest, countdown]);

  const toggleStatus = async () => {
    try {
      const newStatus = !isOnline;
      await apiRequest("PATCH", "/api/drivers/1/status", { isOnline: newStatus });
      setIsOnline(newStatus);
      toast({
        title: newStatus ? "أنت متصل الآن" : "أنت غير متصل",
        description: newStatus ? "يمكنك الآن استقبال طلبات الزبائن" : "لن تصلك أي طلبات جديدة",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث الحالة" });
    }
  };

  const acceptRequest = async () => {
    if (!pendingRequest || !driver) return;
    try {
      const res = await apiRequest("POST", `/api/drivers/${driver.id}/accept/${pendingRequest.id}`, {});
      const data = await res.json();
      setActiveRequest(data.request);
      setPendingRequest(null);
      setDriver(data.driver);
      toast({ title: "تم قبول الطلب", description: "توجه إلى موقع الزبون الآن" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
      setPendingRequest(null);
    }
  };

  const completeRide = async (method: "cash" | "wallet") => {
    if (!activeRequest) return;
    try {
      await apiRequest("PATCH", `/api/requests/${activeRequest.id}`, { 
        status: "completed", 
        paymentMethod: method 
      });
      setActiveRequest(null);
      toast({ title: "تم إنهاء الرحلة", description: "شكراً لك، تم تحديث الحالة بنجاح" });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إنهاء الرحلة" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8" dir="rtl">
      <header className="max-w-md mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">لوحة تحكم السائق</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {/* Pending Request Popup */}
        <AnimatePresence>
          {pendingRequest && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <Card className="w-full max-w-sm border-2 border-primary shadow-2xl">
                <CardHeader className="bg-primary p-4 text-center">
                  <CardTitle className="text-black flex items-center justify-center gap-2">
                    <Clock className="w-5 h-5 animate-spin" />
                    طلب جديد متاح! ({countdown})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">نوع السطحة:</span>
                      <span className="font-bold">{pendingRequest.vehicleType === 'small' ? 'سطحة صغيرة' : pendingRequest.vehicleType === 'large' ? 'سطحة كبيرة' : 'سطحة هيدروليك'}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">السعر:</span>
                      <span className="font-bold text-green-600">{pendingRequest.price}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium">من: {pendingRequest.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Navigation className="w-4 h-4 text-red-500" />
                        <span className="font-medium">إلى: {pendingRequest.destination || 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button onClick={acceptRequest} className="bg-green-600 hover:bg-green-700 h-12 text-lg">قبول</Button>
                    <Button onClick={() => setPendingRequest(null)} variant="outline" className="h-12 text-lg border-red-200 text-red-600">تجاهل</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Ride View */}
        {activeRequest && (
          <Card className="border-primary border-2 shadow-lg">
            <CardHeader className="bg-primary/10 border-b">
              <CardTitle className="text-center text-lg">رحلة جارية الآن</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="h-48 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                <div className="text-center">
                  <Navigation className="w-8 h-8 mx-auto text-primary mb-2 animate-bounce" />
                  <p className="text-sm font-medium">نظام الملاحة (Route Map)</p>
                  <p className="text-xs text-muted-foreground">جاري التوجيه إلى: {activeRequest.location}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => completeRide('cash')} className="h-14 font-bold bg-green-600">إنهاء (دفع نقدي)</Button>
                <Button onClick={() => completeRide('wallet')} className="h-14 font-bold bg-blue-600">إنهاء (من المحفظة)</Button>
              </div>
              <Button variant="outline" className="w-full text-orange-600 border-orange-200">إرجاع مبلغ للزبون</Button>
            </CardContent>
          </Card>
        )}

        {/* Online/Offline Toggle */}
        {!activeRequest && (
          <Card className="border-2">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">حالة السائق</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className={`flex flex-col items-center justify-center p-8 rounded-2xl transition-colors ${isOnline ? 'bg-green-50' : 'bg-red-50'}`}>
                {isOnline ? (
                  <Signal className="w-16 h-16 text-green-600 mb-4 animate-pulse" />
                ) : (
                  <SignalLow className="w-16 h-16 text-red-600 mb-4" />
                )}
                <span className={`text-2xl font-bold ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
                  {isOnline ? "متصل (متاح الآن)" : "غير متصل"}
                </span>
              </div>
              <Button 
                onClick={toggleStatus}
                size="lg"
                variant={isOnline ? "destructive" : "default"}
                className="w-full h-16 text-xl font-bold rounded-xl"
              >
                {isOnline ? "خروج (إيقاف الاستقبال)" : "أنا متاح الآن"}
              </Button>
            </CardContent>
          </Card>
        )}

        {driver && (
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <span className="text-muted-foreground">رصيد المحفظة:</span>
              <span className="text-xl font-bold font-mono">{parseFloat(driver.walletBalance).toLocaleString()} د.ع</span>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
