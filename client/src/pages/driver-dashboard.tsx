import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, Menu, RefreshCw,
  Phone, CheckCircle2, User, MapPin, Navigation, List, ExternalLink,
  Star, Clock, TrendingUp, ChevronRight, Settings, History, GripHorizontal,
  Loader2, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet"; 
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import { Driver } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient"; 
import { useToast } from "@/hooks/use-toast"; 

// --- وظيفة توليد الأيقونة البرتقالية مع خاصية الدوران ---
const getOrangeArrowIcon = (rotation: number) => L.divIcon({
  html: `
    <div style="transform: rotate(${rotation}deg); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.3));">
      <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 5L92 90L50 72L8 90L50 5Z" fill="#f97316" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>`,
  className: "", 
  iconSize: [45, 45],
  iconAnchor: [22.5, 22.5], 
});

const socket = io();

// مكون لتحريك الخريطة برفق
const MapViewHandler = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15); }, [center]);
  return null;
};

// --- Sidebar (كما هو في كودك تماماً دون أي تغيير) ---
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
        {[ 
          { icon: <History className="w-5 h-5"/>, label: "رحلاتي" }, 
          { icon: <Wallet className="w-5 h-5"/>, label: "المحفظة" }, 
          { icon: <Settings className="w-5 h-5"/>, label: "الإعدادات" } 
        ].map((item, i) => (
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

  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0); // إضافة حالة تخزين اتجاه الحركة

  const currentId = localStorage.getItem("currentDriverId");

  const { data: driverInfo, isLoading, refetch } = useQuery<Driver>({ 
    queryKey: [currentId ? `/api/driver/me/${currentId}` : "/api/driver/me"],
    refetchInterval: 3000, 
  });

  useEffect(() => {
    if (!driverInfo?.isOnline || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading: deviceHeading } = pos.coords;
        setCurrentCoords([latitude, longitude]);
        
        // تحديث اتجاه السهم إذا كانت القيمة متاحة من الـ GPS
        if (deviceHeading !== null && deviceHeading !== undefined) {
          setHeading(deviceHeading);
        }

        apiRequest("PATCH", `/api/drivers/${driverInfo.id}/location`, {
          lat: latitude.toString(),
          lng: longitude.toString(),
          heading: deviceHeading?.toString() || "0"
        }).catch(() => {});
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverInfo?.isOnline, driverInfo?.id]);

  const toggleOnlineStatus = async () => {
    if (!driverInfo || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const newOnlineStatus = !driverInfo.isOnline;
      const res = await apiRequest("PATCH", `/api/drivers/${driverInfo.id}`, {
        isOnline: newOnlineStatus
      });
      if (res.ok) {
        await refetch();
        setNotification({ 
          show: true, 
          message: newOnlineStatus ? "أنت الآن متصل وتستقبل الطلبات" : "تم قطع الاتصال، أنت أوفلاين الآن", 
          type: "success" 
        });
        setTimeout(() => setNotification(n => ({ ...n, show: false })), 3000);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في الشبكة",
        description: "تعذر تحديث حالتك"
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch(); 
    setTimeout(() => {
        setIsRefreshing(false);
        setNotification({ show: true, message: "تم تحديث القائمة بنجاح", type: "success" });
        setTimeout(() => setNotification(n => ({ ...n, show: false })), 2000);
    }, 1000);
  };

  useEffect(() => {
    if (driverInfo?.isOnline && driverInfo?.status === "approved") {
      socket.on("receive_request", (data: any) => {
        if (!activeOrder) {
          setAvailableRequests(prev => [...prev, data]);
        }
      });
      return () => { socket.off("receive_request"); };
    }
  }, [driverInfo?.isOnline, activeOrder, driverInfo?.status]);

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      <p className="mt-4 font-bold text-gray-400 font-sans">جاري تحميل عالمك الجميل...</p>
    </div>
  );

  if (!driverInfo || driverInfo.status === "pending" || !driverInfo.status) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-[#F3F4F6] font-sans" dir="rtl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-[45px] shadow-2xl max-w-md w-full border-t-[12px] border-orange-500">
          <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-12 h-12 text-orange-500 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 mb-4 italic">طلبك قيد المراجعة</h2>
          <p className="text-gray-500 font-bold mb-8 text-lg leading-relaxed">
            أهلاً بك كابتن <span className="text-orange-600 font-black">"{driverInfo?.name || 'الجديد'}"</span>. <br/> 
            يتم تدقيق بياناتك حالياً. سيتم تفعيل حسابك فور الانتهاء.
          </p>
          <Button onClick={() => refetch()} className="w-full h-14 rounded-2xl font-black bg-orange-500 hover:bg-orange-600 gap-2 mb-4">
              <RefreshCw className="w-4 h-4" /> تحديث الحالة الآن
          </Button>
          <Button onClick={() => setLocation("/")} variant="outline" className="w-full h-14 rounded-2xl font-black border-2">العودة للرئيسية</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative font-sans" dir="rtl">
      
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} driverData={driverInfo} onLogout={() => {
          localStorage.removeItem("currentDriverId");
          setLocation("/");
      }} />

      <header className="bg-white px-5 py-4 flex justify-between items-center shadow-sm z-[1000] border-b border-gray-100">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="bg-gray-50 rounded-xl">
          <Menu className="w-6 h-6 text-gray-700" />
        </Button>
        
        <div className="flex items-center gap-1.5 font-black text-2xl italic tracking-tighter text-orange-600">
          SATHA <Truck className="w-7 h-7 text-orange-500" />
        </div>

        <div 
          onClick={toggleOnlineStatus} 
          className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-300 border ${isUpdatingStatus ? 'opacity-50' : ''} ${driverInfo.isOnline ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-100' : 'bg-gray-100 border-gray-200'}`}
        >
          {isUpdatingStatus ? (
            <Loader2 className="w-3 h-3 animate-spin text-white" />
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full ${driverInfo.isOnline ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
          )}
          <span className={`text-xs font-black ${driverInfo.isOnline ? 'text-white' : 'text-gray-500'}`}>
            {driverInfo.isOnline ? "متصل" : "أوفلاين"}
          </span>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col">
        
        <div className={`absolute inset-0 z-0 transition-all duration-1000 ${driverInfo.isOnline ? 'opacity-100' : 'opacity-40 grayscale'}`}>
          <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* ✅ استخدام الأيقونة البرتقالية مع خاصية الدوران المباشر */}
            {currentCoords && (
              <Marker position={currentCoords} icon={getOrangeArrowIcon(heading)}>
                <Popup>
                   <div className="text-right font-black font-sans">
                      أنت هنا كابتن {driverInfo.name} <br/>
                      <span className="text-orange-500 text-[10px]">جاري تتبع موقعك المباشر</span>
                   </div>
                </Popup>
              </Marker>
            )}

            <MapViewHandler center={currentCoords || [33.3152, 44.3661]} />
          </MapContainer>
        </div>

        {!activeOrder && driverInfo.isOnline && (
           <div className="relative z-10 p-4 grid grid-cols-2 gap-4 pointer-events-none">
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                    <div className="bg-orange-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 text-orange-600" /></div>
                    <p className="text-[10px] text-gray-400 font-black uppercase">أرباح اليوم</p>
                    <h4 className="text-xl font-black text-gray-800">{driverInfo?.walletBalance} <span className="text-[10px]">د.ع</span></h4>
                </motion.div>
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                    <div className="bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><Clock className="w-4 h-4 text-blue-600" /></div>
                    <p className="text-[10px] text-gray-400 font-black uppercase">نوع السطحة</p>
                    <h4 className="text-[11px] font-black text-gray-800 truncate">{driverInfo?.vehicleType}</h4>
                </motion.div>
           </div>
        )}

        <AnimatePresence>
          {driverInfo.isOnline && !activeOrder && (
            <motion.div 
              drag="y"
              dragConstraints={{ top: 0, bottom: 400 }}
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="absolute inset-x-0 bottom-0 z-[1200] bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[70vh]"
            >
              <div className="w-full flex flex-col items-center py-4 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-1" />
                <GripHorizontal className="w-5 h-5 text-gray-300" />
              </div>

              <div className="px-6 flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                   <span className="bg-orange-500 w-2 h-6 rounded-full" />
                   <h3 className="text-lg font-black text-gray-800">طلبات السحب المتاحة</h3>
                </div>
                <Button onClick={handleRefresh} variant="ghost" disabled={isRefreshing} className="bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-2xl gap-2 font-bold px-4">
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> تحديث
                </Button>
              </div>

              <div className="overflow-y-auto px-6 pb-12 space-y-4">
                {availableRequests.length === 0 ? (
                  <div className="py-10 text-center opacity-40">
                    <Navigation className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="font-bold text-gray-400">لا توجد طلبات حالياً، اضغط تحديث</p>
                  </div>
                ) : (
                  availableRequests.map((req) => (
                    <div key={req.id} className="bg-gray-50 border border-gray-100 p-5 rounded-[32px] flex items-center justify-between group">
                      <div className="flex-1 ml-4 space-y-3 text-right">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                            <span className="text-sm font-black text-gray-700">{req.pickupAddress || req.location}</span>
                        </div>
                        <div className="flex items-center gap-3 pr-1">
                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                            <span className="text-xs text-gray-400 font-bold">{req.destination || "موقع محدد"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2 border-r pr-5 border-gray-200 min-w-[100px]">
                        <span className="text-xl font-black text-orange-600">{req.price}</span>
                        <Button onClick={() => setActiveOrder(req)} className="bg-black hover:bg-orange-600 text-white rounded-2xl h-10 px-6 font-black text-xs transition-all">قبول</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeOrder && orderStage !== "payment" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1300] bg-white rounded-t-[45px] p-8 shadow-2xl border-t-4 border-orange-500">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center border-2 border-white shadow-sm text-2xl text-orange-500 font-bold">👤</div>
                <div className="text-right">
                  <h4 className="font-black text-xl text-gray-800">{activeOrder.customerName || "زبون جديد"}</h4>
                  <p className="text-xs text-blue-500 font-bold flex items-center gap-1 cursor-pointer" onClick={() => window.open(`https://www.google.com/maps?q=${activeOrder.pickupLat},${activeOrder.pickupLng}`)}>فتح الخريطة الخارجية <ExternalLink className="w-3 h-3"/></p>
                </div>
              </div>
              <a href={`tel:${activeOrder.customerPhone || '000'}`} className="w-15 h-15 bg-green-500 rounded-3xl flex items-center justify-center shadow-lg shadow-green-100 hover:scale-105 transition-transform p-4">
                <Phone className="w-7 h-7 text-white" />
              </a>
            </div>
            <Button onClick={() => {
                if (orderStage === "heading_to_pickup") setOrderStage("arrived_pickup");
                else if (orderStage === "arrived_pickup") setOrderStage("heading_to_dropoff");
                else setOrderStage("payment");
            }} className="w-full h-18 bg-black hover:bg-orange-600 text-white rounded-[26px] font-black text-xl shadow-xl py-4">
              {orderStage === "heading_to_pickup" ? "وصلت لموقع الزبون" : orderStage === "arrived_pickup" ? "تأكيد رفع السيارة" : "إتمام الرحلة"}
            </Button>
          </motion.div>
        )}

        {activeOrder && orderStage === "payment" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[5000] bg-white flex flex-col items-center justify-center p-8 text-center">
             <div className="w-28 h-28 bg-orange-50 rounded-full flex items-center justify-center mb-8 border-4 border-white shadow-2xl shadow-orange-100"><CheckCircle2 className="w-14 h-14 text-orange-500" /></div>
             <h2 className="text-gray-400 font-black mb-2 uppercase tracking-widest text-sm">استلم النقد من الزبون</h2>
             <p className="text-6xl font-black text-gray-900 mb-12">{activeOrder.price} <span className="text-xl">د.ع</span></p>
             <Button onClick={() => { setActiveOrder(null); setOrderStage("heading_to_pickup"); }} className="w-full h-20 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl rounded-[30px] shadow-2xl shadow-orange-100">تأكيد الاستلام</Button>
          </motion.div>
        )}

      </div>
      
      <AnimatePresence>
        {notification.show && (
          <motion.div initial={{ y: -100 }} animate={{ y: 20 }} exit={{ y: -100 }} className="fixed top-0 left-0 right-0 z-[6000] flex justify-center px-6">
            <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
               {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
               <span className="font-black text-sm">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}