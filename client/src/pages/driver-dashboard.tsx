import { useState, useEffect, useCallback, memo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, 
  Phone, CheckCircle2, User, Banknote, BellRing, MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- إعدادات أيقونات الخريطة ---
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// --- مكون التنبيهات المخصص ---
const InAppNotification = ({ message, type, isVisible }: { message: string, type: 'success' | 'error', isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-20 left-0 right-0 z-[2000] flex justify-center pointer-events-none"
      >
        <div className={`
          flex items-center gap-2 px-6 py-3 rounded-full shadow-xl backdrop-blur-md
          ${type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}
        `}>
          {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
          <span className="font-bold text-sm">{message}</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// --- الهيدر العلوي ---
const DashboardHeader = memo(({ isOnline, onToggleStatus, onLogout }: any) => (
  <header className="fixed top-0 left-0 right-0 h-16 bg-[#FFD700] px-4 flex justify-between items-center shadow-md z-[1500]">
    <Button variant="ghost" size="icon" onClick={onLogout} className="text-black hover:bg-black/10">
      <LogOut className="w-5 h-5" />
    </Button>
    <div 
      onClick={onToggleStatus}
      className={`
        flex items-center gap-3 px-4 py-1.5 rounded-full cursor-pointer transition-all duration-300
        ${isOnline ? 'bg-black text-[#FFD700]' : 'bg-gray-200 text-gray-500'}
      `}
    >
        <span className="text-xs font-black">{isOnline ? "متاح للعمل" : "غير متاح"}</span>
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
    </div>
    <div className="flex items-center gap-1">
      <span className="font-black text-lg italic tracking-tighter">SATHA</span>
      <Truck className="w-6 h-6" />
    </div>
  </header>
));

// --- الخريطة ---
const MapView = memo(({ center }: { center: [number, number] }) => (
  <div className="absolute inset-0 z-0">
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={center} />
    </MapContainer>
  </div>
));

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [requestData, setRequestData] = useState<any>(null);
  const [orderStage, setOrderStage] = useState<"heading_to_pickup" | "arrived_pickup" | "heading_to_dropoff" | "payment">("heading_to_pickup");
  const [countdown, setCountdown] = useState(30);
  const [, setLocation] = useLocation();
  const [notification, setNotification] = useState({ show: false, message: "", type: "success" as "success" | "error" });

  const showNotification = (msg: string, type: "success" | "error") => {
    setNotification({ show: true, message: msg, type });
    setTimeout(() => setNotification(n => ({ ...n, show: false })), 3000);
  };

  // 📡 مراقبة الطلبات النشطة
  useEffect(() => {
    const checkRequest = () => {
        const savedRequest = localStorage.getItem("satha_active_request");
        if (savedRequest) {
            try {
                const parsed = JSON.parse(savedRequest);
                setRequestData(parsed);
            } catch (e) {
                console.error("Parse error", e);
            }
        } else {
            setRequestData(null);
        }
    };

    let interval: any;
    if (isOnline || requestData) {
        interval = setInterval(checkRequest, 1500);
    }
    return () => clearInterval(interval);
  }, [isOnline, requestData]);

  // --- إجراءات السائق المحدثة للإصلاح ---

  const acceptOrder = () => {
    if (!requestData) return;
    const updatedRequest = { ...requestData, status: "accepted" };
    localStorage.setItem("satha_active_request", JSON.stringify(updatedRequest));
    setRequestData(updatedRequest);
    setOrderStage("heading_to_pickup");
    showNotification("تم قبول الطلب، توجه للزبون 🚀", "success");
  };

  const rejectOrder = () => {
    localStorage.removeItem("satha_active_request"); // مسح من localStorage فوراً
    setRequestData(null);
    setCountdown(30);
    showNotification("تم تجاهل الطلب", "error");
  };

  const completeOrder = () => {
    // 1. مسح الطلب نهائياً من الذاكرة (هذا سيجعل واجهة الزبون تعرف أن الرحلة انتهت)
    localStorage.removeItem("satha_active_request");
    
    // 2. إعادة تعيين واجهة السائق للوضع الطبيعي
    showNotification("تم استلام المبلغ وإنهاء الرحلة ✅", "success");
    setRequestData(null);
    setOrderStage("heading_to_pickup");
    setCountdown(30);
  };

  // عداد التنازلي للقبول
  useEffect(() => {
    let timer: any;
    if (requestData?.status === "pending" && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && requestData?.status === "pending") { 
        rejectOrder(); // رفض تلقائي عند انتهاء الوقت
    }
    return () => clearInterval(timer);
  }, [requestData, countdown]);

  const handleToggleStatus = useCallback(() => setIsOnline(prev => !prev), []);
  const handleLogout = useCallback(() => setLocation("/"), [setLocation]);

  const isPending = requestData?.status === "pending";
  const isActive = requestData?.status === "accepted";

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden relative" dir="rtl">
      
      {(!isActive || orderStage !== "payment") && (
        <DashboardHeader isOnline={isOnline} onToggleStatus={handleToggleStatus} onLogout={handleLogout} />
      )}

      <InAppNotification 
        isVisible={notification.show} 
        message={notification.message} 
        type={notification.type} 
      />

      <div className="flex-1 relative overflow-hidden mt-16">
        <MapView center={[33.3152, 44.3661]} />

        <AnimatePresence mode="wait">
            {isOnline && !requestData && (
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute inset-x-0 bottom-0 z-[1000]">
                    <section className="bg-white p-6 rounded-t-[35px] shadow-[0_-5px_30px_rgba(0,0,0,0.15)] border-t border-gray-100">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4 text-right">
                                <div className="bg-yellow-50 p-3 rounded-2xl text-[#FFD700]">
                                    <Wallet className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase">الرصيد المتوفر</p>
                                    <h3 className="text-3xl font-black text-black leading-none">50,000 <span className="text-xs text-gray-400">د.ع</span></h3>
                                </div>
                            </div>
                            <Button className="bg-black text-white rounded-2xl h-12 px-6 font-bold shadow-lg active:scale-95 transition-transform">سحب</Button>
                        </div>
                    </section>
                </motion.div>
            )}

            {isOnline && isPending && (
                <motion.div key="incoming-request" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-x-0 bottom-0 z-[1100] bg-white rounded-t-[35px] shadow-[0_-10px_50px_rgba(0,0,0,0.2)] overflow-hidden">
                    <div className="bg-black text-[#FFD700] text-center py-2 text-xs font-bold animate-pulse">
                         طلب جديد ينتهي خلال {countdown} ثانية
                    </div>
                    <div className="p-6">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex gap-3">
                                <div className="bg-green-50 p-3 rounded-full"><MapPin className="text-green-600 w-6 h-6"/></div>
                                <div>
                                    <h3 className="font-black text-xl text-gray-900">{requestData.pickupAddress}</h3>
                                    <p className="text-sm text-gray-500 font-bold">اسم الزبون: {requestData.customerName}</p>
                                </div>
                            </div>
                            <div className="text-left shrink-0">
                                <span className="block text-2xl font-black text-green-600">{requestData.price}</span>
                                <span className="text-xs text-gray-400 font-bold uppercase">د.ع</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <Button onClick={rejectOrder} variant="outline" className="col-span-1 h-14 rounded-2xl border-2 border-red-50 text-red-500 hover:bg-red-50 hover:text-red-600">
                                <X className="w-6 h-6" />
                            </Button>
                            <Button onClick={acceptOrder} className="col-span-3 h-14 bg-[#FFD700] hover:bg-[#ffe033] text-black font-black text-lg rounded-2xl shadow-lg active:scale-95">
                                قبول الطلب الآن
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {isActive && orderStage !== "payment" && (
                <motion.div key="active-trip" initial={{ y: "100%" }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1100] bg-white rounded-t-[35px] p-6 shadow-2xl">
                    <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                                <User className="text-slate-500 w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="font-black text-lg">{requestData.customerName}</h4>
                                <div className="flex items-center gap-1 text-xs text-gray-500 font-bold mt-1">
                                    <Phone className="w-3 h-3 text-green-500" />
                                    <span>{requestData.customerPhone}</span>
                                </div>
                            </div>
                        </div>
                        <Button 
                            onClick={() => window.location.href = `tel:${requestData.customerPhone}`}
                            size="icon" 
                            className="rounded-full w-12 h-12 bg-green-500 hover:bg-green-600 shadow-lg shadow-green-100"
                        >
                            <Phone className="w-5 h-5 text-white" />
                        </Button>
                    </div>
                    <Button 
                        onClick={() => {
                            if (orderStage === "heading_to_pickup") setOrderStage("arrived_pickup");
                            else if (orderStage === "arrived_pickup") setOrderStage("heading_to_dropoff");
                            else setOrderStage("payment");
                        }} 
                        className="w-full h-16 rounded-2xl bg-black text-white font-black text-xl shadow-xl active:scale-95 transition-all"
                    >
                        {orderStage === "heading_to_pickup" ? "وصلت للزبون" : 
                         orderStage === "arrived_pickup" ? "تم تحميل المركبة" : "وصلت للتفريغ (نهاية)"}
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {isActive && orderStage === "payment" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[2000] bg-white flex flex-col items-center justify-center p-6 text-center">
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </motion.div>
                    <h2 className="text-3xl font-black mb-2 text-black">تحصيل المبلغ</h2>
                    <p className="text-gray-500 font-bold mb-10">يرجى استلام المبلغ نقداً من الزبون</p>
                    <div className="bg-slate-50 p-8 rounded-[30px] border border-slate-100 w-full mb-8 shadow-inner">
                        <div className="text-5xl font-black text-black tracking-tighter mb-2">
                            {requestData.price}
                        </div>
                        <span className="text-gray-400 font-black">دينار عراقي</span>
                    </div>
                    <Button onClick={completeOrder} className="w-full h-16 bg-[#FFD700] hover:bg-[#ffe033] text-black font-black text-xl rounded-2xl shadow-xl active:scale-95">
                        تأكيد الاستلام والعودة للرئيسية
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}