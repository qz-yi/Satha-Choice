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

const socket = io(); // استخدام المسار الافتراضي للـ socket

const MapViewHandler = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15); }, [center]);
  return null;
};

// --- Sidebar المطور ---
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
  const [notification, setNotification] = useState({ show: false, message: "" });
  const [, setLocation] = useLocation();

  // 1. جلب بيانات السائق من السيرفر
  const { data: driverInfo, isLoading } = useQuery<Driver>({ 
    queryKey: ["/api/driver/me"] 
  });

  // 📡 تحديث الموقع واستقبال الطلبات (يعمل فقط إذا كان مقبولاً)
  useEffect(() => {
    if (isOnline && driverInfo?.status === "approved") {
      const interval = setInterval(() => {
        socket.emit("send_location", { lat: 33.3152, lng: 44.3661, driverId: driverInfo.id });
      }, 5000);
      
      socket.on("receive_request", (data: any) => {
          setAvailableRequests(prev => [...prev, data]);
          setNotification({ show: true, message: "وصلك طلب جديد!" });
          setTimeout(() => setNotification({ show: false, message: "" }), 3000);
      });

      return () => {
        clearInterval(interval);
        socket.off("receive_request");
      };
    }
  }, [isOnline, driverInfo]);

  // 🛑 1. حالة التحميل
  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      <p className="mt-4 font-bold text-gray-400">جاري تحميل بيانات الكابتن...</p>
    </div>
  );

  // 🛑 2. شاشة "قيد المراجعة" - تظهر تلقائياً إذا كانت الحالة pending
  if (!driverInfo || driverInfo.status === "pending") {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-[#F3F4F6] font-sans" dir="rtl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-[45px] shadow-2xl max-w-md w-full border-t-[12px] border-orange-500">
          <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-12 h-12 text-orange-500 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 mb-4 italic">طلبك قيد المراجعة</h2>
          <p className="text-gray-500 font-bold mb-8 text-lg leading-relaxed">
            أهلاً بك كابتن <span className="text-orange-600 font-black">"{driverInfo?.name || 'الجديد'}"</span>. <br/> 
            يتم حالياً تدقيق بياناتك من قبل فريق الإدارة. سيتم تفعيل حسابك فور الانتهاء.
          </p>
          <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 justify-center text-slate-400 text-xs font-black mb-6">
              <ShieldAlert className="w-5 h-5 text-orange-400" /> يرجى عدم إغلاق هذه الصفحة
          </div>
          <Button onClick={() => setLocation("/")} variant="outline" className="w-full h-14 rounded-2xl font-black border-2">العودة للرئيسية</Button>
        </motion.div>
      </div>
    );
  }

  // 🏆 3. واجهة العمل الحقيقية (تظهر فقط عند الموافقة)
  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative font-sans" dir="rtl">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} driverData={driverInfo} onLogout={() => setLocation("/")} />

      <header className="bg-white px-5 py-4 flex justify-between items-center shadow-sm z-[1000] border-b border-gray-100">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="bg-gray-50 rounded-xl">
          <Menu className="w-6 h-6 text-gray-700" />
        </Button>
        <div className="flex items-center gap-1.5 font-black text-2xl italic tracking-tighter text-orange-600">
          SATHA <Truck className="w-7 h-7 text-orange-500" />
        </div>
        <div onClick={() => setIsOnline(!isOnline)} className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-300 border ${isOnline ? 'bg-orange-500 border-orange-400 shadow-lg' : 'bg-gray-100 border-gray-200'}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
          <span className={`text-[10px] font-black ${isOnline ? 'text-white' : 'text-gray-500'}`}>
            {isOnline ? "متصل الآن" : "أوفلاين"}
          </span>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col">
        <div className={`absolute inset-0 z-0 transition-all duration-1000 ${isOnline ? 'opacity-100' : 'opacity-40 grayscale'}`}>
          <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </MapContainer>
        </div>

        {/* إحصائيات علوية حقيقية */}
        {!activeOrder && isOnline && (
           <div className="relative z-10 p-4 grid grid-cols-2 gap-4">
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                    <div className="bg-orange-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><Wallet className="w-4 h-4 text-orange-600" /></div>
                    <p className="text-[10px] text-gray-400 font-black">رصيد المحفظة</p>
                    <h4 className="text-lg font-black text-gray-800">{driverInfo?.walletBalance} <span className="text-[10px]">د.ع</span></h4>
                </motion.div>
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                    <div className="bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><Truck className="w-4 h-4 text-blue-600" /></div>
                    <p className="text-[10px] text-gray-400 font-black">نوع السطحة</p>
                    <h4 className="text-[11px] font-black text-gray-800">{driverInfo?.vehicleType}</h4>
                </motion.div>
           </div>
        )}

        {/* لوحة السحب للطلبات */}
        <AnimatePresence>
          {isOnline && !activeOrder && (
            <motion.div drag="y" dragConstraints={{ top: 0, bottom: 400 }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="absolute inset-x-0 bottom-0 z-[1200] bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[70vh]">
              <div className="w-full flex flex-col items-center py-4">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                <GripHorizontal className="w-5 h-5 text-gray-200 mt-1" />
              </div>
              <div className="px-8 flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-800 italic">الطلبات المتاحة</h3>
                <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black">{availableRequests.length} طلب</span>
              </div>
              <div className="overflow-y-auto px-6 pb-12 space-y-4">
                {availableRequests.length === 0 ? (
                  <div className="py-16 text-center opacity-20">
                    <Navigation className="w-16 h-16 mx-auto mb-4 animate-bounce" />
                    <p className="font-black text-lg">بانتظار زبائن جدد...</p>
                  </div>
                ) : (
                  availableRequests.map((req) => (
                    <div key={req.id} className="bg-gray-50 border border-gray-100 p-6 rounded-[35px] flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all duration-500">
                      <div className="flex-1 ml-4 space-y-3">
                        <div className="flex items-center gap-3 font-bold text-gray-700"><div className="w-3 h-3 rounded-full bg-orange-500" /> {req.pickupAddress}</div>
                        <div className="flex items-center gap-3 font-bold text-gray-400 text-xs"><div className="w-3 h-3 rounded-full bg-gray-200" /> {req.dropoffAddress}</div>
                      </div>
                      <Button className="bg-black text-white rounded-[20px] h-12 px-6 font-black">قبول</Button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}