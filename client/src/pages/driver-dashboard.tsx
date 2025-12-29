import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, LogOut, Signal, SignalLow, Clock, MapPin, Navigation, Wallet, CreditCard } from "lucide-react";
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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
      });
    }

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
      
      const res = await fetch(`/api/drivers/1`);
      const data = await res.json();
      setDriver(data);
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إنهاء الرحلة" });
    }
  };

  const refundToCustomer = async () => {
    if (!activeRequest || !driver) return;
    try {
      const amount = 5000;
      await apiRequest("POST", `/api/drivers/${driver.id}/refund/${activeRequest.id}`, { amount });
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
    <div className="min-h-screen bg-gray-50/50 flex flex-col" dir="rtl">
      {/* 1. Bright Yellow Header */}
      <header className="bg-primary shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-black">
            <Truck className="w-8 h-8" />
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter">SATHA PRO</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/")}
              className="text-black hover:bg-black/10"
            >
              <LogOut className="w-6 h-6" />
            </Button>
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
               <span className="text-xs font-bold text-black">{isOnline ? 'متصل' : 'غير متصل'}</span>
               <button 
                onClick={toggleStatus}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${isOnline ? 'bg-black' : 'bg-gray-400'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isOnline ? '-translate-x-7' : '-translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* 2. Map Section directly under header */}
        <div className="flex-1 relative min-h-[450px] bg-white border-b-2 border-gray-100">
          <MapContainer center={currentPos} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            />
            <MapController center={currentPos} />
            
            <Marker position={currentPos}>
              <Popup>موقعك الحالي</Popup>
            </Marker>

            {activeRequest && activeRequest.pickupLat && (
              <Marker position={[parseFloat(activeRequest.pickupLat), parseFloat(activeRequest.pickupLng)]}>
                <Popup>موقع الزبون: {activeRequest.location}</Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Floating Map Controls */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <Button 
              onClick={updateLocation}
              size="icon"
              className="rounded-full shadow-xl bg-primary hover:bg-primary/90 text-black"
            >
              <MapPin className="w-5 h-5" />
            </Button>
          </div>

          {/* Active Request Overlay */}
          {activeRequest && (
            <div className="absolute bottom-6 left-6 right-6 z-[1000]">
              <Card className="bg-white border-primary border-2 shadow-2xl text-black rounded-2xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-black font-black text-xl mb-1 flex items-center gap-2">
                        <Truck className="w-6 h-6 text-primary" /> طلب جاري
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1 font-bold">
                        <Navigation className="w-4 h-4 text-primary" /> {activeRequest.location}
                      </p>
                    </div>
                    <div className="bg-primary/10 text-black px-4 py-2 rounded-xl font-black text-lg">
                      {activeRequest.price}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => completeRide('cash')} className="h-14 font-black bg-primary text-black hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">إنهاء كاش</Button>
                    <Button onClick={() => completeRide('wallet')} className="h-14 font-black bg-white border-2 border-gray-200 text-black hover:bg-gray-50 rounded-xl">إنهاء محفظة</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* New Request Popup (Centered on Map) */}
          <AnimatePresence>
            {pendingRequest && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-[1001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
              >
                <Card className="w-full max-w-sm bg-white border-4 border-primary shadow-2xl rounded-3xl">
                  <CardContent className="p-8 space-y-6 text-center">
                    <div className="flex justify-center">
                      <div className="bg-primary/10 p-5 rounded-full">
                        <Truck className="w-12 h-12 text-primary animate-bounce" />
                      </div>
                    </div>
                    <h2 className="text-3xl font-black text-black italic tracking-tighter">طلب جديد قريب!</h2>
                    <div className="bg-gray-50 p-6 rounded-2xl text-black space-y-2 border border-gray-100">
                      <p className="text-primary-foreground bg-primary inline-block px-4 py-1 rounded-full font-black text-sm mb-2">{pendingRequest.price}</p>
                      <p className="text-lg font-bold">{pendingRequest.vehicleType === 'small' ? 'سطحة صغيرة' : pendingRequest.vehicleType === 'large' ? 'سطحة كبيرة' : 'سطحة هيدروليك'}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button 
                        onClick={acceptRequest} 
                        className="h-16 bg-primary hover:bg-primary/90 text-black text-2xl font-black rounded-2xl shadow-xl shadow-primary/20"
                      >
                        قـبـول ({countdown})
                      </Button>
                      <Button 
                        onClick={() => setPendingRequest(null)} 
                        variant="ghost" 
                        className="text-gray-400 hover:text-red-500 font-bold"
                      >
                        تجاهل الطلب
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. Separate Wallet Section in Footer area but inside main */}
        <section className="bg-white border-t border-gray-100 p-6">
          <div className="container mx-auto max-w-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-gray-400 text-xs font-black uppercase tracking-widest">رصيد المحفظة الحالي</p>
                <h2 className="text-2xl font-black text-black font-mono">
                  {driver ? parseFloat(driver.walletBalance).toLocaleString() : '0'} <span className="text-xs opacity-40">د.ع</span>
                </h2>
              </div>
            </div>
            <Button className="bg-primary text-black font-black px-6 h-10 rounded-xl hover:bg-primary/90">
              سحب الأرباح
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
