import { useState, useEffect, useCallback, memo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, Menu, RefreshCw,
  Phone, CheckCircle2, User, MapPin, Navigation, List, ExternalLink,
  Star, Clock, TrendingUp, ChevronRight, Settings, History, GripHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io } from "socket.io-client";

// ✅ الربط الصحيح
const socket = io("http://192.168.0.104:3000");

// مكون لتحديث الخريطة عند قبول طلب
const MapViewHandler = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 15); }, [center]);
  return null;
};

// --- Sidebar (محفوظ كما هو في تعديلك الجميل) ---
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
        <div className="w-20 h-20 bg-orange-50 rounded-full mb-3 flex items-center justify-center border-4 border-orange-100 text-3xl shadow-inner text-orange-500">👤</div>
        <h3 className="font-black text-xl text-gray-800">{driverData.name}</h3>
        <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black mt-1 flex items-center gap-1"><Star className="w-3 h-3 fill-orange-600" /> كابتن مميز</span>
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
  const [isOnline, setIsOnline] = useState(false);
  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [orderStage, setOrderStage] = useState<any>("heading_to_pickup");
  const [notification, setNotification] = useState({ show: false, message: "", type: "success" as any });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setLocation] = useLocation();

  const driverInfo = { name: "أحمد العبيدي", earnings: "82,500", trips: 15 };

  // 📡 1. استقبال الطلبات المباشرة (تمت المطابقة)
  useEffect(() => {
    socket.on("receive_request", (data: any) => {
      if (isOnline && !activeOrder) {
        setAvailableRequests(prev => {
          if (prev.find(r => r.id === data.id)) return prev;
          setNotification({ show: true, message: "وصل طلب جديد الآن! 📢", type: "success" });
          return [...prev, data];
        });
      }
    });
    return () => { socket.off("receive_request"); };
  }, [isOnline, activeOrder]);

  // 📡 2. إرسال الموقع للزبون (كان مفقوداً في تعديلك)
  useEffect(() => {
    let interval: any;
    if (isOnline) {
      interval = setInterval(() => {
        socket.emit("send_location", { lat: 33.3152, lng: 44.3661, driverId: "driver_001" });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isOnline]);

  // ✅ 3. قبول الطلب وإشعار السيرفر
  const handleAcceptOrder = (order: any) => {
    setActiveOrder(order);
    setAvailableRequests([]);
    setOrderStage("heading_to_pickup");
    socket.emit("accept_order", { orderId: order.id, driverName: driverInfo.name });
  };

  // ✅ 4. تحديث المرحلة وإرسالها للزبون (كان مفقوداً في تعديلك)
  const handleNextStage = () => {
    let next: any = orderStage;
    if (orderStage === "heading_to_pickup") next = "arrived_pickup";
    else if (orderStage === "arrived_pickup") next = "heading_to_dropoff";
    else if (orderStage === "heading_to_dropoff") next = "payment";

    setOrderStage(next);
    socket.emit("update_order_status", { orderId: activeOrder.id, status: next });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
        setIsRefreshing(false);
        setNotification({ show: true, message: "تم تحديث القائمة بنجاح", type: "success" });
        setTimeout(() => setNotification(n => ({ ...n, show: false })), 2000);
    }, 1000);
  };

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
          <span className={`text-xs font-black ${isOnline ? 'text-white' : 'text-gray-500'}`}>
            {isOnline ? "متصل" : "أوفلاين"}
          </span>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col">
        <div className={`absolute inset-0 z-0 transition-all duration-1000 ${isOnline ? 'opacity-100' : 'opacity-40 grayscale'}`}>
          <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {activeOrder && (
                <>
                  <Marker position={[activeOrder.pickupLat, activeOrder.pickupLng]} />
                  <MapViewHandler center={[activeOrder.pickupLat, activeOrder.pickupLng]} />
                </>
            )}
          </MapContainer>
        </div>

        {/* إحصائيات علوية */}
        {!activeOrder && isOnline && (
           <div className="relative z-10 p-4 grid grid-cols-2 gap-4 pointer-events-none">
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                    <div className="bg-orange-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 text-orange-600" /></div>
                    <p className="text-[10px] text-gray-400 font-black uppercase">أرباحك اليوم</p>
                    <h4 className="text-xl font-black text-gray-800">{driverInfo.earnings} <span className="text-[10px]">د.ع</span></h4>
                </motion.div>
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                    <div className="bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><Clock className="w-4 h-4 text-blue-600" /></div>
                    <p className="text-[10px] text-gray-400 font-black uppercase">الرحلات</p>
                    <h4 className="text-xl font-black text-gray-800">{driverInfo.trips}</h4>
                </motion.div>
           </div>
        )}

        {/* لوحة الطلبات القابلة للسحب */}
        <AnimatePresence>
          {isOnline && !activeOrder && (
            <motion.div drag="y" dragConstraints={{ top: 0, bottom: 400 }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="absolute inset-x-0 bottom-0 z-[1200] bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[70vh]">
              <div className="w-full flex flex-col items-center py-4 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-1" />
                <GripHorizontal className="w-5 h-5 text-gray-300" />
              </div>
              <div className="px-6 flex justify-between items-center mb-4">
                <div className="flex items-center gap-2"><span className="bg-orange-500 w-2 h-6 rounded-full" /><h3 className="text-lg font-black text-gray-800">الطلبات المتاحة</h3></div>
                <Button onClick={handleRefresh} variant="ghost" className="bg-orange-50 text-orange-600 rounded-2xl gap-2 font-bold px-4">
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> تحديث
                </Button>
              </div>
              <div className="overflow-y-auto px-6 pb-12 space-y-4">
                {availableRequests.length === 0 ? (
                  <div className="py-10 text-center opacity-30"><Navigation className="w-12 h-12 mx-auto mb-2" /><p className="font-bold">بانتظار طلبات جديدة...</p></div>
                ) : (
                  availableRequests.map((req) => (
                    <div key={req.id} className="bg-gray-50 border border-gray-100 p-5 rounded-[32px] flex items-center justify-between">
                      <div className="flex-1 ml-4 space-y-2">
                        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span className="text-sm font-black text-gray-700 truncate block max-w-[150px]">{req.pickupAddress}</span></div>
                        <div className="flex items-center gap-3 pr-1"><div className="w-2 h-2 rounded-full bg-gray-300" /><span className="text-xs text-gray-400 font-bold truncate block max-w-[150px]">{req.dropoffAddress}</span></div>
                      </div>
                      <div className="flex flex-col items-center gap-2 border-r pr-5 border-gray-200">
                        <span className="text-xl font-black text-orange-600">{req.price}</span>
                        <Button onClick={() => handleAcceptOrder(req)} className="bg-black text-white rounded-2xl h-10 px-6 font-black text-xs">قبول</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* واجهة الرحلة النشطة */}
        {activeOrder && orderStage !== "payment" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1300] bg-white rounded-t-[45px] p-8 shadow-2xl border-t-4 border-orange-500">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center border-2 border-white shadow-sm text-2xl text-orange-500 font-bold">👤</div>
                <div>
                  <h4 className="font-black text-xl text-gray-800">{activeOrder.customerName}</h4>
                  <p className="text-xs text-blue-500 font-bold flex items-center gap-1 cursor-pointer" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.pickupLat},${activeOrder.pickupLng}`)}>
                    <ExternalLink className="w-3 h-3"/> فتح الخرائط
                  </p>
                </div>
              </div>
              <a href={`tel:${activeOrder.customerPhone}`} className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <Phone className="w-6 h-6 text-white" />
              </a>
            </div>
            <Button onClick={handleNextStage} className="w-full h-18 bg-black hover:bg-orange-600 text-white rounded-[26px] font-black text-xl shadow-xl transition-all">
              {orderStage === "heading_to_pickup" ? "وصلت لموقع الزبون" : orderStage === "arrived_pickup" ? "تأكيد رفع السيارة" : "إتمام الرحلة"}
            </Button>
          </motion.div>
        )}

        {/* واجهة الدفع */}
        {activeOrder && orderStage === "payment" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[5000] bg-white flex flex-col items-center justify-center p-8 text-center">
             <div className="w-28 h-28 bg-orange-50 rounded-full flex items-center justify-center mb-8 border-4 border-white shadow-2xl"><CheckCircle2 className="w-14 h-14 text-orange-500" /></div>
             <h2 className="text-gray-400 font-black mb-2 uppercase tracking-widest text-sm">استلم النقد من الزبون</h2>
             <p className="text-6xl font-black text-gray-900 mb-12">{activeOrder.price} <span className="text-xl">د.ع</span></p>
             <Button onClick={() => { setActiveOrder(null); setOrderStage("heading_to_pickup"); }} className="w-full h-20 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl rounded-[30px] shadow-2xl">تأكيد الاستلام</Button>
          </motion.div>
        )}
      </div>

      <InAppNotification isVisible={notification.show} message={notification.message} type={notification.type} />
    </div>
  );
}

const InAppNotification = ({ message, type, isVisible }: any) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div initial={{ y: -100 }} animate={{ y: 20 }} exit={{ y: -100 }} className="fixed top-0 left-0 right-0 z-[6000] flex justify-center px-6">
        <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md ${type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
           {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
           <span className="font-black text-sm">{message}</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);