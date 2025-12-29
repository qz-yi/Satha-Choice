import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, LogOut, Signal, SignalLow, Clock, MapPin, Navigation, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [countdown, setCountdown] = useState(30);
  const [currentPos, setCurrentPos] = useState<[number, number]>([33.3152, 44.3661]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch("/api/drivers/1")
      .then(res => res.json())
      .then(data => {
        setDriver(data);
        setIsOnline(data.isOnline);
      })
      .catch(console.error);

    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
      });
    }

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

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(newPos);
        toast({ title: "تم تحديث الموقع", description: "تم تحديد موقعك الحالي بنجاح." });
      }, () => {
        toast({ variant: "destructive", title: "خطأ", description: "يرجى تفعيل صلاحية الوصول للموقع." });
      });
    }
  };

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

  const refundToCustomer = async () => {
    if (!activeRequest || !driver) return;
    try {
      // For MVP, we'll allow refunding a fixed amount (e.g., 5000 IQD)
      const amount = 5000;
      await apiRequest("POST", `/api/drivers/${driver.id}/refund/${activeRequest.id}`, { amount });
      
      // Refresh driver balance
      const res = await fetch(`/api/drivers/${driver.id}`);
      const data = await res.json();
      setDriver(data);
      
      toast({ 
        title: "تم استرداد المبلغ", 
        description: `تم تحويل ${amount.toLocaleString()} د.ع إلى محفظة الزبون.` 
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8" dir="rtl">
      <header className="max-w-md mx-auto mb-8 flex items-center justify-between bg-[#212121] text-[#fbc02d] p-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8" />
          <h1 className="text-xl font-bold">لوحة السائق</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            className="text-[#fbc02d] hover:bg-white/10"
          >
            <LogOut className="w-5 h-5" />
          </Button>
          <div 
            onClick={toggleStatus}
            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${isOnline ? 'bg-[#fbc02d]' : 'bg-gray-600'}`}
          >
            <div className={`bg-white w-4 h-4 rounded-full transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {/* Pending Request Popup */}
        <AnimatePresence>
          {pendingRequest && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-4"
            >
              <Card className="w-full max-w-md mx-auto border-none shadow-2xl rounded-t-[30px] overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-green-600 text-lg">طلب جديد قريب!</span>
                    <span className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold">3.5 كم</span>
                  </div>
                  
                  <div className="space-y-3 bg-gray-50 p-4 rounded-2xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">نوع السطحة:</span>
                      <span className="font-bold">{pendingRequest.vehicleType === 'small' ? 'سطحة صغيرة' : pendingRequest.vehicleType === 'large' ? 'سطحة كبيرة' : 'سطحة هيدروليك'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">السعر:</span>
                      <span className="font-bold text-green-600">{pendingRequest.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>ينتهي العرض خلال {countdown} ثانية</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={acceptRequest} 
                      className="w-full h-14 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-2xl shadow-lg"
                    >
                      قـبـول الـطـلـب
                    </Button>
                    <Button 
                      onClick={() => setPendingRequest(null)} 
                      variant="ghost" 
                      className="w-full text-red-500 font-bold hover:bg-red-50"
                    >
                      تجاهل
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Ride View */}
        {activeRequest && (
          <Card className="border-primary border-2 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/10 border-b">
              <CardTitle className="text-center text-lg">رحلة جارية الآن</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-0">
              <div className="h-64 relative z-0">
                <MapContainer center={currentPos} zoom={15} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapController center={currentPos} />
                  <Marker position={currentPos}>
                    <Popup>موقعك الحالي</Popup>
                  </Marker>
                  {activeRequest.pickupLat && (
                    <Marker position={[parseFloat(activeRequest.pickupLat), parseFloat(activeRequest.pickupLng)]}>
                      <Popup>موقع الزبون (نقطة التحميل)</Popup>
                    </Marker>
                  )}
                </MapContainer>
                <Button 
                  onClick={updateLocation}
                  size="icon"
                  className="absolute bottom-4 right-4 z-[1000] rounded-full shadow-lg"
                  variant="secondary"
                >
                  <MapPin className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary animate-pulse" />
                    جاري التوجيه إلى: {activeRequest.location}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => completeRide('cash')} className="h-14 font-bold bg-green-600">إنهاء (دفع نقدي)</Button>
                  <Button onClick={() => completeRide('wallet')} className="h-14 font-bold bg-blue-600">إنهاء (من المحفظة)</Button>
                </div>
                <Button onClick={refundToCustomer} variant="outline" className="w-full text-orange-600 border-orange-200">إرجاع مبلغ للزبون</Button>
              </div>
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
