import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, Menu, RefreshCw,
  CheckCircle2, Star, Clock, ChevronRight, Settings, History, GripHorizontal, Loader2, Navigation, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import { Driver } from "@shared/schema";

const socket = io();

const MapViewHandler = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15); }, [center]);
  return null;
};

// --- Sidebar المطور (تم الحفاظ عليه بالكامل كما في كودك الأصلي) ---
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
        <div className="w-20 h-20 bg-orange-50 rounded-full mb-3 flex items-center justify-center border-4 border-orange-100 text-3xl shadow-inner text-orange-500 font-black uppercase">
          {driverData?.name?.charAt(0) || "S"}
        </div>
        <h3 className="font-black text-xl text-gray-800">{driverData?.name}</h3>
        <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black mt-1 flex items-center gap-1">
            <Star className="w-3 h-3 fill-orange-600" /> كابتن في {driverData?.city}
        </span>
      </div>
      <nav className="flex-1 space-y-1 text-right">
        {[ 
          { icon: <History className="w-5 h-5"/>, label: "رحلاتي السابقة" }, 
          { icon: <Wallet className="w-5 h-5"/>, label: "المحفظة المالية" }, 
          { icon: <Settings className="w-5 h-5"/>, label: "إعدادات الحساب" } 
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
  const [isOnline, setIsOnline] = useState(false);
  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [, setLocation] = useLocation();

  // ✅ الإضافة 1: جلب المعرف الفعلي من الـ LocalStorage (لحل مشكلة الاسم الثابت)
  const currentId = localStorage.getItem("currentDriverId");

  // ✅ الإضافة 2: تحديث الاستعلام ليقرأ المعرف ويقوم بالـ Polling (لحل مشكلة التفعيل)
  const { data: driverInfo, isLoading } = useQuery<Driver>({ 
    queryKey: [currentId ? `/api/drivers/${currentId}` : "/api/driver/me"],
    refetchInterval: 2000, 
  });

  useEffect(() => {
    if (isOnline && driverInfo?.approvalStatus === "approved") {
      const interval = setInterval(() => {
        socket.emit("send_location", { lat: 33.3152, lng: 44.3661, driverId: driverInfo.id });
      }, 5000);
      
      socket.on("receive_request", (data: any) => {
          setAvailableRequests(prev => [...prev, data]);
      });

      return () => {
        clearInterval(interval);
        socket.off("receive_request");
      };
    }
  }, [isOnline, driverInfo]);

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      <p className="mt-4 font-bold text-gray-400 font-sans">جاري تحميل البيانات...</p>
    </div>
  );

  // شاشة الانتظار الأصلية كما هي
  if (!driverInfo || driverInfo.approvalStatus === "pending" || !driverInfo.approvalStatus) {
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
          <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 justify-center text-slate-400 text-xs font-black mb-6">
              <ShieldAlert className="w-5 h-5 text-orange-400" /> يرجى عدم إغلاق هذه الصفحة
          </div>
          <Button onClick={() => setLocation("/")} variant="outline" className="w-full h-14 rounded-2xl font-black border-2">العودة للرئيسية</Button>
        </motion.div>
      </div>
    );
  }

  // الواجهة الرئيسية كما هي تماماً
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
        <div className="w-10" />
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto pb-24 text-right">
        <div className={`relative w-full h-[40vh] min-h-[300px] z-0 transition-all duration-1000 ${isOnline ? 'opacity-100' : 'opacity-40 grayscale'}`}>
          <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </MapContainer>
          {!isOnline && (
            <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] flex items-center justify-center z-10">
                <span className="bg-white/90 px-4 py-2 rounded-full text-xs font-black text-gray-400 shadow-sm">وضع عدم الاتصال</span>
            </div>
          )}
        </div>

        <div className="px-6 space-y-6 -mt-10 relative z-20">
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button 
              onClick={() => setIsOnline(!isOnline)} 
              className={`w-full h-20 rounded-[30px] font-black text-xl shadow-2xl transition-all duration-500 flex flex-col ${
                isOnline 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
              }`}
            >
              {isOnline ? "إيقاف استقبال الطلبات" : "تفعيل استقبال الطلبات"}
              <span className="text-[10px] font-bold opacity-70">أنت الآن {isOnline ? "متاح للعمل" : "غير متاح"}</span>
            </Button>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-50">
                <p className="text-[10px] text-gray-400 font-black mb-1">رصيد المحفظة</p>
                <h4 className="text-xl font-black text-gray-800 italic">{driverInfo?.walletBalance} <span className="text-xs">د.ع</span></h4>
            </div>
            <div className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-50 flex flex-col justify-center">
                <p className="text-[10px] text-gray-400 font-black mb-1">نوع السطحة</p>
                <h4 className="text-[11px] font-black text-orange-600 truncate">{driverInfo?.vehicleType}</h4>
            </div>
          </div>

          {isOnline && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-lg font-black text-gray-800 italic">طلبات قريبة</h3>
                 <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black">
                   {availableRequests.length} متاح
                 </span>
              </div>
              
              {availableRequests.length === 0 ? (
                <div className="bg-white py-14 text-center rounded-[40px] border-2 border-dashed border-gray-100">
                  <Navigation className="w-12 h-12 mx-auto mb-3 text-gray-200 animate-pulse" />
                  <p className="font-black text-gray-300 italic">بانتظار وصول طلبات...</p>
                </div>
              ) : (
                availableRequests.map((req) => (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={req.id} 
                    className="bg-white p-6 rounded-[35px] shadow-md border border-gray-50 flex items-center justify-between">
                     <div className="space-y-1">
                        <p className="text-xs font-black text-gray-400">موقع الزبون</p>
                        <h5 className="font-bold text-gray-700">{req.pickupAddress}</h5>
                     </div>
                     <Button className="bg-black text-white rounded-2xl font-black h-12 px-6">قبول</Button>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}