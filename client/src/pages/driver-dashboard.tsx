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
    <div className="min-h-screen bg-[#121212] p-4 md:p-8 flex flex-col gap-6" dir="rtl">
      {/* Header with Logout */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[#FFD700]">
          <Truck className="w-8 h-8" />
          <h1 className="text-xl font-black italic tracking-tighter">SATHA PRO</h1>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/")}
          className="text-[#FFD700] hover:bg-white/10"
        >
          <LogOut className="w-6 h-6" />
        </Button>
      </header>

      {/* 1. Centered ON/OFF Toggle */}
      <div className="flex justify-center items-center">
        <Card className="bg-[#1e1e1e] border-[#FFD700]/20 shadow-2xl p-4 w-full max-w-sm">
          <div className="flex flex-col items-center gap-4">
            <span className={`text-lg font-bold ${isOnline ? 'text-[#FFD700]' : 'text-gray-500'}`}>
              {isOnline ? "أنت متصل ومتاح للطلبات" : "أنت حالياً غير متصل"}
            </span>
            <button 
              onClick={toggleStatus}
              className={`relative inline-flex h-12 w-24 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${isOnline ? 'bg-[#FFD700]' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isOnline ? '-translate-x-14' : '-translate-x-2'}`} />
              <span className={`absolute ${isOnline ? 'right-4 text-black' : 'left-4 text-white'} font-black text-sm uppercase`}>
                {isOnline ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </Card>
      </div>

      {/* 2. Large Map Area */}
      <div className="flex-1 min-h-[450px] relative rounded-[2rem] overflow-hidden border-4 border-[#FFD700]/30 shadow-2xl bg-[#1e1e1e]">
        <MapContainer center={currentPos} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            className="grayscale brightness-[0.6] invert-[0.1]"
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
            className="rounded-full shadow-xl bg-[#FFD700] hover:bg-[#FFC000] text-black"
          >
            <MapPin className="w-5 h-5" />
          </Button>
        </div>

        {/* Active Request Overlay */}
        {activeRequest && (
          <div className="absolute bottom-6 left-6 right-6 z-[1000]">
            <Card className="bg-black/90 border-[#FFD700] border-2 text-white backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-[#FFD700] font-black text-xl mb-1">طلب نشط</h3>
                    <p className="text-sm opacity-80 flex items-center gap-1">
                      <Navigation className="w-4 h-4" /> {activeRequest.location}
                    </p>
                  </div>
                  <div className="bg-[#FFD700] text-black px-3 py-1 rounded-lg font-bold">
                    {activeRequest.price}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => completeRide('cash')} className="h-12 font-black bg-[#FFD700] text-black hover:bg-[#FFC000]">إنهاء كاش</Button>
                  <Button onClick={() => completeRide('wallet')} className="h-12 font-black bg-white text-black hover:bg-gray-200">إنهاء محفظة</Button>
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
              className="absolute inset-0 z-[1001] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            >
              <Card className="w-full max-w-sm bg-[#1e1e1e] border-4 border-[#FFD700] shadow-[0_0_50px_rgba(255,215,0,0.3)]">
                <CardContent className="p-6 space-y-6 text-center">
                  <div className="flex justify-center">
                    <div className="bg-[#FFD700]/10 p-4 rounded-full">
                      <Truck className="w-12 h-12 text-[#FFD700] animate-bounce" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-black text-white italic">طلب جديد!</h2>
                  <div className="bg-black/40 p-4 rounded-2xl text-white space-y-2">
                    <p className="text-[#FFD700] font-bold text-xl">{pendingRequest.price}</p>
                    <p className="text-sm opacity-60">{pendingRequest.vehicleType === 'small' ? 'سطحة صغيرة' : pendingRequest.vehicleType === 'large' ? 'سطحة كبيرة' : 'سطحة هيدروليك'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={acceptRequest} 
                      className="h-14 bg-[#FFD700] hover:bg-[#FFC000] text-black text-xl font-black rounded-xl shadow-lg"
                    >
                      قـبـول ({countdown})
                    </Button>
                    <Button 
                      onClick={() => setPendingRequest(null)} 
                      variant="ghost" 
                      className="text-white/40 hover:text-red-500 font-bold"
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

      {/* 3. Separate Wallet Card */}
      <section>
        <Card className="bg-[#1e1e1e] border-[#FFD700]/10 shadow-xl overflow-hidden group">
          <div className="bg-[#FFD700] h-1 w-full" />
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-[#FFD700]/20 p-3 rounded-2xl">
                <Wallet className="w-8 h-8 text-[#FFD700]" />
              </div>
              <div>
                <p className="text-gray-400 text-sm font-bold">رصيد المحفظة الحالي</p>
                <h2 className="text-3xl font-black text-white font-mono tracking-tighter">
                  {driver ? parseFloat(driver.walletBalance).toLocaleString() : '0'} <span className="text-xs text-[#FFD700]">د.ع</span>
                </h2>
              </div>
            </div>
            <div className="hidden sm:block">
              <Button variant="outline" className="border-[#FFD700]/20 text-[#FFD700] hover:bg-[#FFD700] hover:text-black">
                سحب الرصيد
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer Status Bar */}
      <footer className="flex items-center justify-center gap-4 text-[10px] uppercase font-black tracking-widest text-white/20">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#FFD700]' : 'bg-red-500'}`} />
        {isOnline ? 'System Online & Protected' : 'System Offline'}
      </footer>
    </div>
  );
}
