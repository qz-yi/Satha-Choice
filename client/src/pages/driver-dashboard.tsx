import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, Menu, RefreshCw,
  Phone, CheckCircle2, User, MapPin, Navigation, List, ExternalLink,
  Star, Clock, TrendingUp, ChevronRight, Settings, History, GripHorizontal,
  Loader2, ShieldAlert, BellRing 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import { Driver, Request } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient"; 
import { useToast } from "@/hooks/use-toast"; 

const socket = io();

// مكون لتحريك الخريطة برفق
const MapViewHandler = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15); }, [center]);
  return null;
};

// دالة لحساب المسافة بين نقطتين (للتتبع الذكي)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // نصف قطر الأرض بالمتر
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // المسافة بالمتر
};

const Sidebar = ({ isOpen, onClose, driverData, onLogout }: any) => (
  <>
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[4000]" />
      )}
    </AnimatePresence>
    <motion.div 
      initial={{ x: "100%" }} animate={{ x: isOpen ? 0 : "100%" }} transition={{ type: "spring", damping: 25 }}
      className="fixed top-0 right-0 bottom-0 w-[75%] max-w-[280px] bg-white z-[4001] shadow-2xl p-6 flex flex-col text-right"
    >
      <div className="flex justify-between items-center mb-8">
        <div className="bg-orange-500 p-2 rounded-xl text-white"><Truck className="w-5 h-5" /></div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-6 h-6" /></Button>
      </div>
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-orange-50 rounded-full mb-3 flex items-center justify-center border-4 border-orange-100 text-3xl shadow-inner text-orange-500 font-black">
          {driverData?.name?.charAt(0) || "👤"}
        </div>
        <h3 className="font-black text-xl text-gray-800">{driverData?.name}</h3>
        <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black mt-1 flex items-center gap-1">
          <Star className="w-3 h-3 fill-orange-600" /> كابتن في {driverData?.city}
        </span>
      </div>
      <nav className="flex-1 space-y-1">
        {[ { icon: <History className="w-5 h-5"/>, label: "رحلاتي" }, { icon: <Wallet className="w-5 h-5"/>, label: "المحفظة" }, { icon: <Settings className="w-5 h-5"/>, label: "الإعدادات" } ].map((item, i) => (
          <button key={i} className="w-full flex items-center justify-between p-4 hover:bg-orange-50 rounded-2xl transition-all group">
             <div className="flex items-center gap-4 font-bold text-gray-600 group-hover:text-orange-600">{item.icon} <span>{item.label}</span></div>
             <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        ))}
      </nav>
      <Button onClick={onLogout} variant="ghost" className="mt-auto w-full h-14 rounded-2xl gap-2 font-black text-red-500 hover:bg-red-50">
        <LogOut className="w-5 h-5" /> تسجيل الخروج
      </Button>
    </motion.div>
  </>
);

export default function DriverDashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [orderStage, setOrderStage] = useState<any>("heading_to_pickup");
  const [notification, setNotification] = useState({ show: false, message: "", type: "success" as any });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // States للتتبع والإشعارات
  const [lastNotifiedId, setLastNotifiedId] = useState<number | null>(null);
  const [lastSentCoords, setLastSentCoords] = useState<{lat: number, lng: number} | null>(null);

  const currentId = localStorage.getItem("currentDriverId");
  const { data: driverInfo, isLoading, refetch } = useQuery<Driver>({ 
    queryKey: [currentId ? `/api/driver/me/${currentId}` : "/api/driver/me"],
    refetchInterval: 3000, 
  });

  const { data: allRequests = [] } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
    refetchInterval: 3000,
  });

  // 1. ميزة التتبع الذكي (Smart Tracking)
  useEffect(() => {
    if (!driverInfo?.isOnline || !("geolocation" in navigator)) return;

    const intervalTime = activeOrder ? 5000 : 20000; // تحديث سريع في الرحلة، بطيء في الانتظار

    const watchId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        
        // التحقق من المسافة (فلترة 50 متر)
        if (lastSentCoords) {
          const dist = calculateDistance(latitude, longitude, lastSentCoords.lat, lastSentCoords.lng);
          if (dist < 50) return; // توفير البيانات والبطارية إذا لم يتحرك 50م
        }

        try {
          await apiRequest("PATCH", `/api/drivers/${driverInfo.id}/location`, {
            lat: latitude,
            lng: longitude
          });
          setLastSentCoords({ lat: latitude, lng: longitude });
          socket.emit("update_location", { driverId: driverInfo.id, lat: latitude, lng: longitude });
        } catch (e) { console.error("Location update failed", e); }
      });
    }, intervalTime);

    return () => clearInterval(watchId);
  }, [driverInfo?.isOnline, activeOrder, lastSentCoords]);

  // 2. ميزة الإشعارات الذكية (التحويل والعام)
  useEffect(() => {
    if (!driverInfo?.isOnline || allRequests.length === 0) return;
    const privateRequest = allRequests.find(r => r.driverId === driverInfo.id && r.status === "confirmed");
    const publicRequest = allRequests.find(r => r.status === "pending" && !r.driverId);

    if (privateRequest && privateRequest.id !== lastNotifiedId) {
      toast({ title: "⚠️ طلب محول من الإدارة", description: "تم اختيارك لطلب جديد، يرجى المباشرة.", variant: "destructive" });
      setLastNotifiedId(privateRequest.id);
      setActiveOrder(privateRequest); 
      new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3").play().catch(() => {});
    } 
    else if (publicRequest && publicRequest.id !== lastNotifiedId && !activeOrder) {
      toast({ title: "📢 طلب جديد متاح", description: "يوجد زبون يبحث عن سطحة حالياً." });
      setLastNotifiedId(publicRequest.id);
      setAvailableRequests(allRequests.filter(r => r.status === "pending"));
      new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3").play().catch(() => {});
    }
  }, [allRequests, driverInfo, lastNotifiedId, activeOrder]);  const handleAcceptRequest = async (requestId: number) => {
    setIsRefreshing(true);
    try {
      const res = await apiRequest("POST", `/api/requests/${requestId}/accept`, { driverId: driverInfo?.id });
      const updated = await res.json();
      setActiveOrder(updated);
      setOrderStage("heading_to_pickup");
      toast({ title: "تم قبول الطلب", description: "توجه إلى موقع الزبون الآن." });
    } catch (e) {
      toast({ title: "خطأ", description: "عذراً، ربما تم قبول الطلب من قبل سائق آخر.", variant: "destructive" });
    } finally { setIsRefreshing(false); }
  };

  const updateOrderStatus = async (status: string, stage?: string) => {
    if (!activeOrder) return;
    setIsUpdatingStatus(true);
    try {
      const res = await apiRequest("PATCH", `/api/requests/${activeOrder.id}/status`, { status, stage });
      const updated = await res.json();
      if (status === "completed") {
        setActiveOrder(null);
        toast({ title: "تمت المهمة!", description: "تم إكمال الرحلة بنجاح، الله يرزقك." });
      } else {
        setActiveOrder(updated);
        if (stage) setOrderStage(stage);
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل تحديث حالة الطلب.", variant: "destructive" });
    } finally { setIsUpdatingStatus(false); }
  };

  if (isLoading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-orange-500 text-white p-6 text-center">
      <Loader2 className="w-16 h-16 animate-spin mb-4" />
      <h2 className="text-2xl font-black">جاري التحميل...</h2>
    </div>
  );

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden font-sans" dir="rtl">
      {/* الهيدر العلوي */}
      <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm z-50">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-xl hover:bg-orange-50">
          <Menu className="w-7 h-7 text-gray-800" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <h1 className="text-lg font-black text-gray-900 leading-none">سطحة كابتن</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-tighter">لوحة التحكم الذكية</p>
          </div>
          <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-200">
            <Truck className="w-5 h-5 text-white" />
          </div>
        </div>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} driverData={driverInfo} onLogout={() => { localStorage.clear(); setLocation("/auth"); }} />

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* الخريطة الخلفية */}
        <div className="absolute inset-0 z-0">
          <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {lastSentCoords && <MapViewHandler center={[lastSentCoords.lat, lastSentCoords.lng]} />}
          </MapContainer>
        </div>

        {/* حالة الاتصال (Online/Offline) */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className={`p-4 rounded-3xl shadow-xl flex items-center justify-between backdrop-blur-md border ${driverInfo?.isOnline ? 'bg-green-500/90 border-green-400' : 'bg-gray-800/90 border-gray-700'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full animate-pulse ${driverInfo?.isOnline ? 'bg-white' : 'bg-gray-400'}`} />
              <span className="text-white font-black text-sm">{driverInfo?.isOnline ? "أنت الآن متصل ومستعد" : "أنت غير متصل حالياً"}</span>
            </div>
            <Button size="sm" className={`rounded-2xl font-black px-5 ${driverInfo?.isOnline ? 'bg-white text-green-600 hover:bg-gray-100' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
              onClick={async () => {
                await apiRequest("PATCH", `/api/drivers/${driverInfo?.id}/status`, { isOnline: !driverInfo?.isOnline });
                refetch();
              }}>
              {driverInfo?.isOnline ? "إيقاف" : "تشغيل"}
            </Button>
          </div>
        </div>

        {/* جزء التحكم السفلي (الطلبات أو الرحلة النشطة) */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="max-w-xl mx-auto w-full p-4 pointer-events-auto">
            <AnimatePresence mode="wait">
              {!activeOrder ? (
                // قائمة الطلبات المتاحة
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-white rounded-t-[40px] shadow-2xl p-6 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                      <div className="w-2 h-8 bg-orange-500 rounded-full" /> طلبات قريبة
                    </h2>
                    <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-black">{availableRequests.length} متاح</span>
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableRequests.length === 0 ? (
                      <div className="py-10 text-center flex flex-col items-center opacity-40">
                        <RefreshCw className="w-12 h-12 mb-2 animate-spin-slow" />
                        <p className="font-bold">بانتظار طلبات جديدة...</p>
                      </div>
                    ) : (
                      availableRequests.map((req) => (
                        <div key={req.id} className="bg-gray-50 p-5 rounded-[28px] border border-gray-100 flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-2 text-right">
                            <div className="flex items-center gap-2 text-gray-400 font-bold text-xs"><MapPin className="w-3 h-3" /> {req.pickupAddress}</div>
                            <div className="flex items-center gap-2 text-orange-600 font-bold text-xs"><Navigation className="w-3 h-3" /> {req.dropoffAddress}</div>
                          </div>
                          <Button onClick={() => handleAcceptRequest(req.id)} className="bg-orange-500 hover:bg-orange-600 rounded-2xl h-14 px-6 shadow-lg shadow-orange-200 font-black">قبول</Button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : (
                // واجهة الرحلة النشطة
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[40px] shadow-2xl p-6 border border-orange-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-orange-100">
                    <motion.div className="h-full bg-orange-500" initial={{ width: "0%" }} animate={{ width: orderStage === "heading_to_pickup" ? "33%" : orderStage === "car_loaded" ? "66%" : "100%" }} />
                  </div>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 font-black"><User /></div>
                      <div>
                        <h4 className="font-black text-gray-800 leading-none">{activeOrder.customerPhone}</h4>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">طلب رقم #{activeOrder.id}</span>
                      </div>
                    </div>
                    <a href={`tel:${activeOrder.customerPhone}`} className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-100 active:scale-95 transition-transform"><Phone className="w-5 h-5" /></a>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center"><MapPin className="w-3 h-3 text-orange-600" /></div>
                      <div className="text-right flex-1">
                        <p className="text-[10px] text-gray-400 font-black">موقع الاستلام</p>
                        <p className="text-sm font-bold text-gray-700 leading-tight">{activeOrder.pickupAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><Navigation className="w-3 h-3 text-blue-600" /></div>
                      <div className="text-right flex-1">
                        <p className="text-[10px] text-gray-400 font-black">وجهة التوصيل</p>
                        <p className="text-sm font-bold text-gray-700 leading-tight">{activeOrder.dropoffAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {orderStage === "heading_to_pickup" && (
                      <Button onClick={() => updateOrderStatus("in_progress", "car_loaded")} className="h-16 bg-orange-500 hover:bg-orange-600 rounded-[24px] text-lg font-black shadow-xl shadow-orange-200 gap-3" disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="animate-spin" /> : <><CheckCircle2 /> تم تحميل السيارة</>}
                      </Button>
                    )}
                    {orderStage === "car_loaded" && (
                      <Button onClick={() => updateOrderStatus("completed")} className="h-16 bg-green-500 hover:bg-green-600 rounded-[24px] text-lg font-black shadow-xl shadow-green-100 gap-3" disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="animate-spin" /> : <><CheckCircle2 /> تم التوصيل بنجاح</>}
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}