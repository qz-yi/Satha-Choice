import { useState, useEffect, useRef } from "react"; 
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, Menu, RefreshCw,
  Phone, CheckCircle2, User, MapPin, Navigation, List, ExternalLink,
  Star, Clock, TrendingUp, ChevronRight, Settings, History, GripHorizontal,
  Loader2, ShieldAlert, ArrowRight, Camera, MessageSquare, Send, Target, Power,
  PlusCircle, CreditCard, Info, ShieldCheck
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

const MapViewHandler = ({ center, isFollowMode }: { center: [number, number], isFollowMode: boolean }) => {
  const map = useMap();
  useEffect(() => { 
    if (center && isFollowMode) {
      map.setView(center, map.getZoom(), { animate: true, duration: 1 }); 
    }
  }, [center, isFollowMode, map]);

  return null;
};

const Sidebar = ({ isOpen, onClose, driverData, onLogout, onNavigate }: any) => (
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
        <div className="w-20 h-20 bg-orange-50 rounded-full mb-3 flex items-center justify-center border-4 border-orange-100 text-3xl shadow-inner text-orange-500 font-black overflow-hidden">
          {driverData?.avatarUrl ? <img src={driverData.avatarUrl} className="w-full h-full object-cover"/> : (driverData?.name?.charAt(0) || "👤")}
        </div>
        <h3 className="font-black text-xl text-gray-800">{driverData?.name}</h3>
        <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black mt-1 flex items-center gap-1">
          <Star className="w-3 h-3 fill-orange-600" /> كابتن في {driverData?.city}
        </span>
      </div>

      <nav className="flex-1 space-y-1">
        {[ 
          { icon: <History className="w-5 h-5"/>, label: "رحلاتي", key: "history" }, 
          { icon: <Wallet className="w-5 h-5"/>, label: "المحفظة", key: "wallet" }, 
          { icon: <Settings className="w-5 h-5"/>, label: "الإعدادات", key: "settings" } 
        ].map((item, i) => (
          <button 
            key={i} 
            onClick={() => { onNavigate(item.key); onClose(); }}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50 rounded-2xl transition-all group"
          >
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
  const [activeTab, setActiveTab] = useState<"map" | "history" | "wallet" | "settings">("map");

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false); 
  const [paymentMethod, setPaymentMethod] = useState<'zain' | 'card' | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("25000"); 

  const [isFollowMode, setIsFollowMode] = useState(true); 
  // الحالة الجديدة للتحكم في ظهور واختفاء قائمة الطلبات
  const [isRequestsSheetOpen, setIsRequestsSheetOpen] = useState(true);

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0); 

  const currentId = localStorage.getItem("currentDriverId");

  const { data: driverInfo, isLoading, refetch } = useQuery<Driver>({ 
    queryKey: [currentId ? `/api/driver/me/${currentId}` : "/api/driver/me"],
    refetchInterval: 3000, 
  });

  const { data: transactions } = useQuery<any[]>({
    queryKey: [`/api/drivers/${driverInfo?.id}/transactions`],
    enabled: !!driverInfo?.id && activeTab === "wallet",
  });

  const { data: settings } = useQuery<{ commissionAmount: number }>({
    queryKey: ["/api/admin/settings"],
  });

  const handleDeposit = async (method: 'zain' | 'master') => {
    if (!driverInfo) {
      toast({ variant: "destructive", title: "خطأ", description: "لم يتم العثور على بيانات السائق" });
      return;
    }

    const amountValue = parseInt(depositAmount);

    if (isNaN(amountValue) || amountValue < 1000) {
      toast({ variant: "destructive", title: "مبلغ غير صحيح", description: "أقل مبلغ للشحن هو 1000 دينار" });
      return;
    }

    setIsDepositing(true);
    try {
      const response = await fetch("/api/zaincash/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          userId: Number(driverInfo.id),
          userType: "driver"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "فشل السيرفر في معالجة الطلب");
      }

      const data = await response.json();

      if (data.url) {
        window.location.assign(data.url);
      } else {
        throw new Error("لم يتم استلام رابط الدفع من البوابة");
      }
    } catch (err: any) {
      console.error("Deposit Error:", err);
      toast({ 
        variant: "destructive", 
        title: "فشل في عملية الربط", 
        description: err.message || "تأكد من إعدادات السيرفر وحاول مجدداً" 
      });
    } finally { 
      setIsDepositing(false); 
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !driverInfo) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      toast({ title: "جاري الرفع...", description: "يتم الآن حفظ صورتك الجديدة" });
      const res = await fetch(`/api/drivers/${driverInfo.id}/upload-avatar`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        await apiRequest("PATCH", `/api/drivers/${driverInfo.id}`, { avatarUrl: data.url });
        await refetch();
        toast({ title: "نجاح", description: "تم تحديث الصورة الشخصية بنجاح" });
        setIsEditingPhoto(false);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل رفع الصورة" });
    }
  };

  const handleCompleteOrder = async () => {
    if (!activeOrder || !driverInfo) return;
    try {
      const res = await apiRequest("POST", `/api/drivers/${driverInfo.id}/complete/${activeOrder.id}`);
      if (res.ok) {
        // إرسال إشارة اكتمال واضحة للزبون
        socket.emit("update_order_status", { 
          orderId: activeOrder.id, 
          status: "completed" 
        });

        setNotification({ show: true, message: "تم إكمال الطلب وخصم العمولة بنجاح", type: "success" });
        setActiveOrder(null);
        setOrderStage("heading_to_pickup");
        setActiveTab("map");
        refetch();
      }
    } catch (err) {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إكمال الطلب مالياً" });
    }
  };

  const handleAcceptOrder = async (req: any) => {
    const currentCommission = settings?.commissionAmount || 1000;
    if (Number(driverInfo?.walletBalance) < currentCommission) {
      toast({ 
        variant: "destructive", 
        title: "رصيدك غير كافٍ", 
        description: `يرجى شحن محفظتك بـ ${currentCommission.toLocaleString()} دينار على الأقل لقبول الطلب` 
      });
      setActiveTab("wallet");
      return;
    }

    // تجهيز بيانات السائق الكاملة
    const driverPayload = {
      id: driverInfo?.id,
      name: driverInfo?.name,
      phone: driverInfo?.phone,
      avatarUrl: driverInfo?.avatarUrl,
      vehicleType: driverInfo?.vehicleType,
      lat: currentCoords?.[0],
      lng: currentCoords?.[1]
    };

    // إرسال إشارة القبول مع بيانات السائق الكاملة ليراها الزبون فوراً
    socket.emit("accept_order", { 
      orderId: req.id, 
      driverId: driverInfo?.id,
      driverInfo: driverPayload
    });

    // إرسال تحديث حالة صريح ليغير واجهة الزبون
    socket.emit("update_order_status", {
      orderId: req.id,
      status: "accepted",
      driverInfo: driverPayload
    });

    setActiveOrder(req);
    setOrderStage("heading_to_pickup");
  };

  useEffect(() => {
    if (!driverInfo?.isOnline || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading: deviceHeading } = pos.coords;
        setCurrentCoords(prev => {
           if (!prev) return [latitude, longitude];
           const dist = Math.sqrt(Math.pow(latitude - prev[0], 2) + Math.pow(longitude - prev[1], 2));
           return dist > 0.00002 ? [latitude, longitude] : prev;
        });
        if (deviceHeading !== null && deviceHeading !== undefined) setHeading(deviceHeading);

        // تحديث الموقع في قاعدة البيانات
        apiRequest("PATCH", `/api/drivers/${driverInfo.id}`, {
          lastLat: latitude.toString(), lastLng: longitude.toString()
        }).catch(() => {});

        // إرسال الموقع المباشر للسوكيت ليراه الزبون فوراً
        if (activeOrder) {
          socket.emit("driver_location_update", {
            orderId: activeOrder.id,
            driverId: driverInfo.id,
            lat: latitude,
            lng: longitude,
            heading: deviceHeading || 0,
            driverName: driverInfo.name,
            driverAvatar: driverInfo.avatarUrl
          });
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverInfo?.isOnline, driverInfo?.id, activeOrder]);

  const toggleOnlineStatus = async () => {
    if (!driverInfo || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const newOnlineStatus = !driverInfo.isOnline;
      const res = await apiRequest("PATCH", `/api/drivers/${driverInfo.id}`, { isOnline: newOnlineStatus });
      if (res.ok) {
        await refetch();
        setNotification({ show: true, message: newOnlineStatus ? "أنت الآن متصل وتستقبل الطلبات" : "تم قطع الاتصال، أنت أوفلاين الآن", type: "success" });
        setTimeout(() => setNotification(n => ({ ...n, show: false })), 3000);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ في الشبكة", description: "تعذر تحديث حالتك" });
    } finally { setIsUpdatingStatus(false); }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch(); 
      const response = await fetch('/api/requests');
      if (response.ok) {
        const allRequests = await response.json();
        const myCityRequests = allRequests.filter((req: any) => 
          req.city?.trim() === driverInfo?.city?.trim() && req.status === "pending"
        );
        setAvailableRequests(myCityRequests);
      }
      setNotification({ show: true, message: "تم تحديث طلبات منطقتك", type: "success" });
    } catch (err) {
      setNotification({ show: true, message: "فشل التحديث", type: "error" });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setNotification(n => ({ ...n, show: false })), 2000);
    }
  };

  useEffect(() => {
    if (driverInfo?.isOnline && driverInfo?.status === "approved") {
      socket.on("new_request_available", (data: any) => { 
        if (!activeOrder && data.city?.trim() === driverInfo?.city?.trim()) {
          setAvailableRequests(prev => {
             if (prev.find(r => r.id === data.id)) return prev;
             return [data, ...prev];
          });
        }
      });

      socket.on("receive_message", (msg: any) => {
        setMessages(prev => [...prev, { ...msg, id: Date.now() }]);
        if (!isChatOpen) setUnreadCount(prev => prev + 1);
      });

      return () => { 
        socket.off("new_request_available"); 
        socket.off("receive_message");
      };
    }
  }, [driverInfo?.isOnline, activeOrder, driverInfo?.status, isChatOpen, driverInfo?.city]);

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      <p className="mt-4 font-bold text-gray-400 font-sans">جاري تحميل عالمك الجميل...</p>
    </div>
  );

if (!driverInfo || driverInfo.status !== "approved") {
    const isBlocked = driverInfo?.status === "blocked";
    return (
      <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-[#F3F4F6] font-sans" dir="rtl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
          className={`bg-white p-10 rounded-[45px] shadow-2xl max-w-md w-full border-t-[12px] ${isBlocked ? 'border-red-500' : 'border-orange-500'}`}>
          <div className={`w-24 h-24 ${isBlocked ? 'bg-red-50' : 'bg-orange-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {isBlocked ? <ShieldAlert className="w-12 h-12 text-red-500" /> : <Clock className="w-12 h-12 text-orange-500 animate-pulse" />}
          </div>
          <h2 className={`text-3xl font-black mb-4 italic ${isBlocked ? 'text-red-600' : 'text-gray-800'}`}>
            {isBlocked ? "الحساب مغلق" : "طلبك قيد المراجعة"}
          </h2>
          <p className="text-gray-500 font-bold mb-8 text-lg leading-relaxed">
            {isBlocked 
              ? <>عذراً كابتن <span className="text-red-600 font-black">"{driverInfo?.name}"</span>، تم إيقاف حسابك من قبل الإدارة. يرجى التواصل مع الدعم.</>
              : <>أهلاً بك كابتن <span className="text-orange-600 font-black">"{driverInfo?.name || 'الجديد'}"</span>. يتم تدقيق بياناتك حالياً.</>}
          </p>
          <Button onClick={() => refetch()} className={`w-full h-14 rounded-2xl font-black gap-2 mb-4 ${isBlocked ? 'bg-red-500' : 'bg-orange-500'}`}>
            <RefreshCw className="w-4 h-4" /> تحديث الحالة
          </Button>
          <Button onClick={() => setLocation("/")} variant="outline" className="w-full h-14 rounded-2xl font-black border-2">العودة للرئيسية</Button>
        </motion.div>
      </div>
    );
}

  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative font-sans" dir="rtl">

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        driverData={driverInfo} 
        onNavigate={(tab: any) => {
           setActiveTab(tab);
           setIsEditingPhoto(false);
           setShowVehicleDetails(false);
        }}
        onLogout={() => { localStorage.removeItem("currentDriverId"); setLocation("/"); }} 
      />

      <header className="bg-white px-5 py-4 flex justify-between items-center shadow-sm z-[1000] border-b border-gray-100">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="bg-gray-50 rounded-xl"><Menu className="w-6 h-6 text-gray-700" /></Button>
        <div className="flex items-center gap-1.5 font-black text-2xl italic tracking-tighter text-orange-600">SATHA <Truck className="w-7 h-7 text-orange-500" /></div>
        <div onClick={toggleOnlineStatus} className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-300 border ${isUpdatingStatus ? 'opacity-50' : ''} ${driverInfo.isOnline ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-100' : 'bg-gray-100 border-gray-200'}`}>
          {isUpdatingStatus ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <div className={`w-2.5 h-2.5 rounded-full ${driverInfo.isOnline ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />}
          <span className={`text-xs font-black ${driverInfo.isOnline ? 'text-white' : 'text-gray-500'}`}>{driverInfo.isOnline ? "متصل" : "أوفلاين"}</span>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col">

        {activeTab === "map" && (
          <>
            <div className={`absolute inset-0 z-0 transition-all duration-1000 ${driverInfo.isOnline ? 'opacity-100' : 'opacity-40 grayscale'}`}>
              <MapContainer 
                center={[33.3152, 44.3661]} 
                zoom={15} 
                style={{ height: "100%", width: "100%" }} 
                zoomControl={false}
                onDragstart={() => setIsFollowMode(false)}
              >
                <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="© Google Maps" detectRetina={true} />
                {currentCoords && (
                  <Marker position={currentCoords} icon={getOrangeArrowIcon(heading)}>
                    <Popup><div className="text-right font-black font-sans">أنت هنا كابتن {driverInfo.name} <br/><span className="text-orange-500 text-[10px]">جاري تتبع موقعك المباشر</span></div></Popup>
                  </Marker>
                )}
                <MapViewHandler center={currentCoords || [33.3152, 44.3661]} isFollowMode={isFollowMode} />
              </MapContainer>
            </div>

            <Button 
              onClick={() => {
                setIsFollowMode(true);
                if (currentCoords) setCurrentCoords([...currentCoords]);
              }} 
              className={`absolute bottom-40 right-6 z-[1000] w-14 h-14 rounded-2xl shadow-2xl border-none transition-all ${isFollowMode ? 'bg-orange-500 text-white' : 'bg-white text-orange-500'}`}
            >
              <Target className={`w-7 h-7 ${isFollowMode ? 'animate-pulse' : ''}`} />
            </Button>

            {!activeOrder && driverInfo.isOnline && (
              <div className="relative z-10 p-4 grid grid-cols-2 gap-4 pointer-events-none">
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                        <div className="bg-orange-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><Wallet className="w-4 h-4 text-orange-600" /></div>
                        <p className="text-[10px] text-gray-400 font-black uppercase">المحفظة</p>
                        <h4 className="text-xl font-black text-gray-800">{driverInfo?.walletBalance} <span className="text-[10px]">د.ع</span></h4>
                    </motion.div>
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white/90 backdrop-blur-md p-4 rounded-[28px] shadow-xl border border-white">
                        <div className="bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center mb-2"><Truck className="w-4 h-4 text-blue-600" /></div>
                        <p className="text-[10px] text-gray-400 font-black uppercase">نوع السطحة</p>
                        <h4 className="text-[11px] font-black text-gray-800 truncate">{driverInfo?.vehicleType}</h4>
                    </motion.div>
              </div>
            )}
            <AnimatePresence>
              {driverInfo.isOnline && !activeOrder && (
                <motion.div 
                  drag="y" 
                  dragConstraints={{ top: 0, bottom: 0 }} 
                  dragElastic={0.1}
                  // التحكم في الموقع: إذا كانت مغلقة، تنزل للأسفل ويبقى 70 بكسل فقط
                  animate={{ y: isRequestsSheetOpen ? 0 : "calc(100% - 70px)" }}
                  onDragEnd={(e, info) => {
                    // إذا سحب المستخدم للأسفل بقوة أو مسافة كافية، يتم الإغلاق الجزئي
                    if (info.offset.y > 100) {
                      setIsRequestsSheetOpen(false);
                    } else if (info.offset.y < -50) {
                      setIsRequestsSheetOpen(true);
                    }
                  }}
                  className="absolute inset-x-0 bottom-0 z-[1200] bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[70vh] transition-colors duration-300"
                >
                  {/* منطقة المقبض: الآن تعمل كزر أيضاً عند الضغط */}
                  <div 
                    className="w-full flex flex-col items-center py-4 cursor-grab active:cursor-grabbing"
                    onClick={() => setIsRequestsSheetOpen(!isRequestsSheetOpen)}
                  >
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-1" />
                    <GripHorizontal className={`w-5 h-5 transition-transform duration-300 ${isRequestsSheetOpen ? 'text-gray-300' : 'text-orange-500 rotate-180'}`} />
                    {!isRequestsSheetOpen && (
                      <span className="text-[10px] font-black text-orange-500 mt-1 animate-pulse">اسحب للأعلى لرؤية الطلبات</span>
                    )}
                  </div>

                  <div className="px-6 flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2"><span className="bg-orange-500 w-2 h-6 rounded-full" /><h3 className="text-lg font-black text-gray-800">طلبات السحب المتاحة</h3></div>
                    <Button onClick={handleRefresh} variant="ghost" disabled={isRefreshing} className="bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-2xl gap-2 font-bold px-4"><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> تحديث</Button>
                  </div>

                  <div className="overflow-y-auto px-6 pb-12 space-y-4">
                    {availableRequests.length === 0 ? (
                      <div className="py-10 text-center opacity-40"><Navigation className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p className="font-bold text-gray-400">لا توجد طلبات حالياً، اضغط تحديث</p></div>
                    ) : (
                      availableRequests.map((req) => (
                        <div key={req.id} className="bg-gray-50 border border-gray-100 p-5 rounded-[32px] flex items-center justify-between group">
                          <div className="flex-1 ml-4 space-y-3 text-right">
                            <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span className="text-sm font-black text-gray-700">{req.pickupAddress || req.location}</span></div>
                            <div className="flex items-center gap-3 pr-1"><div className="w-2 h-2 rounded-full bg-gray-300" /><span className="text-xs text-gray-400 font-bold">{req.destination || "موقع محدد"}</span></div>
                          </div>
                          <div className="flex flex-col items-center gap-2 border-r pr-5 border-gray-200 min-w-[100px]"><span className="text-xl font-black text-orange-600">{req.price}</span><Button onClick={() => handleAcceptOrder(req)} className="bg-black hover:bg-orange-600 text-white rounded-2xl h-10 px-6 font-black text-xs transition-all">قبول</Button></div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {activeTab === "history" && (
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="absolute inset-0 z-[2000] bg-white flex flex-col">
            <div className="p-6 flex items-center gap-4 border-b">
              <Button variant="ghost" size="icon" onClick={() => setActiveTab("map")} className="rounded-full bg-gray-50"><ArrowRight className="w-6 h-6"/></Button>
              <h2 className="text-2xl font-black italic">سجل الرحلات</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {transactions?.filter(t => t.type === 'fee').map((tx) => (
                <div key={tx.id} className="p-5 bg-gray-50 rounded-[30px] border border-gray-100 flex items-center justify-between">
                  <div className="text-right space-y-1"><p className="font-black text-gray-800">رحلة مكتملة</p><p className="text-xs text-gray-400 font-bold">{new Date(tx.createdAt).toLocaleDateString('ar-EG')}</p></div>
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded-2xl font-black">-{tx.amount} د.ع عمولة</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "wallet" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="absolute inset-0 z-[2000] bg-white flex flex-col font-sans text-right"
            dir="rtl"
          >
            <div className="p-6 flex items-center justify-between border-b border-gray-50 bg-white">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveTab("map")} 
                className="rounded-full bg-gray-100 h-10 w-10"
              >
                <ArrowRight className="w-6 h-6 text-black" />
              </Button>
              <h2 className="text-xl font-black text-gray-800 italic">المحفظة</h2>
              <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">

              <div className="bg-[#FF7A00] p-7 rounded-[30px] text-white shadow-lg relative overflow-hidden">
                <p className="text-white/80 text-xs font-bold mb-1">رصيدك الحالي المتاح</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-black tracking-tight">
                    {Number(driverInfo?.walletBalance || 0).toLocaleString()}
                  </h3>
                  <span className="text-lg font-bold opacity-90">د.ع</span>
                </div>
                <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              </div>

              <div className="space-y-3">
                <label className="text-gray-500 text-sm font-bold block px-2">مبلغ الشحن المطلوب</label>
                <div className="relative">
                  <input 
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    type="number" 
                    placeholder="أدخل المبلغ بالدينار..."
                    className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-[22px] px-6 text-xl font-black text-gray-800 focus:border-orange-500 focus:outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-gray-800 font-black text-lg pr-2">وسائل الشحن</h4>

                <button 
                  disabled={isDepositing}
                  onClick={() => setPaymentMethod('zain')}
                  className={`w-full p-5 bg-white border-2 rounded-[25px] flex items-center justify-between active:scale-[0.98] transition-all group ${paymentMethod === 'zain' ? 'border-orange-500 bg-orange-50/20' : 'border-gray-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center p-1 overflow-hidden border border-gray-800 shadow-sm">
                      <img src="/zain-logo.png" className="w-full h-full object-contain" alt="Zain" />
                    </div>
                    <span className="font-bold text-gray-700 text-lg">زين كاش</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'zain' ? 'border-orange-500' : 'border-gray-200'}`}>
                    {paymentMethod === 'zain' && <div className="w-3 h-3 bg-orange-500 rounded-full"></div>}
                  </div>
                </button>

                <button 
                  disabled={isDepositing}
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full p-5 bg-white border-2 rounded-[25px] flex items-center justify-between active:scale-[0.98] transition-all group ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-sm border border-blue-500">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-gray-700 text-lg">ماستر كارد / فيزا</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'card' ? 'border-blue-500' : 'border-gray-200'}`}>
                    {paymentMethod === 'card' && <div className="w-3 h-3 bg-blue-500 rounded-full"></div>}
                  </div>
                </button>
              </div>

              <div className="pt-4 pb-20">
                <h4 className="text-gray-800 font-black text-lg pr-2 mb-4 flex items-center gap-2">
                   سجل العمليات
                </h4>
                <div className="space-y-0">
                  {transactions && transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-5 border-b border-gray-50 px-2">
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{tx.type === 'deposit' ? 'شحن رصيد' : 'عمولة رحلة'}</p>
                          <p className="text-[11px] text-gray-400 font-bold">{new Date(tx.createdAt).toLocaleDateString('ar-EG')}</p>
                        </div>
                        <div className={`text-lg font-black ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 opacity-30 italic font-bold">لا توجد عمليات مسجلة حالياً</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-gray-50 pb-8">
              <Button 
                disabled={isDepositing || !paymentMethod}
                onClick={() => handleDeposit(paymentMethod === 'card' ? 'master' : 'zain')}
                className="w-full h-16 rounded-[22px] bg-orange-500 hover:bg-orange-600 text-white text-xl font-black shadow-lg shadow-orange-100 transition-all active:scale-[0.97]"
              >
                {isDepositing ? <Loader2 className="w-6 h-6 animate-spin" /> : "تأكيد عملية الشحن"}
              </Button>
            </div>
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="absolute inset-0 z-[2000] bg-white flex flex-col">
            <div className="p-6 flex items-center gap-4 border-b">
              <Button variant="ghost" size="icon" onClick={() => {
                if (isEditingPhoto || showVehicleDetails) {
                  setIsEditingPhoto(false);
                  setShowVehicleDetails(false);
                } else {
                  setActiveTab("map");
                }
              }} className="rounded-full bg-gray-50">
                <ArrowRight className="w-6 h-6"/>
              </Button>
              <h2 className="text-2xl font-black italic">
                {isEditingPhoto ? "تعديل الصورة" : showVehicleDetails ? "بيانات السطحة" : "الإعدادات"}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isEditingPhoto ? (
                <div className="flex flex-col items-center py-10">
                  <div className="relative group">
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                    <div className="w-40 h-40 bg-orange-50 rounded-full border-8 border-orange-100 flex items-center justify-center text-5xl shadow-inner overflow-hidden">
                       {driverInfo?.avatarUrl ? <img src={driverInfo.avatarUrl} className="w-full h-full object-cover"/> : "👤"}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 bg-black text-white p-3 rounded-full shadow-lg border-4 border-white active:scale-90 transition-all cursor-pointer">
                      <Camera className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="mt-8 text-gray-400 font-bold text-center px-6 leading-relaxed">اجعل صورتك واضحة وودودة لتزيد من ثقة الزبائن بك.</p>
                  <Button onClick={() => setIsEditingPhoto(false)} className="w-full h-16 border-2 border-orange-500 text-orange-600 rounded-2xl mt-12 font-black text-lg">العودة للإعدادات</Button>
                </div>
              ) : showVehicleDetails ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-6 rounded-[35px] border-2 border-dashed border-gray-200 flex flex-col items-center">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-4"><Truck className="w-10 h-10 text-orange-500" /></div>
                    <h3 className="font-black text-xl text-gray-800">{driverInfo?.vehicleType || "سطحة هيدروليك"}</h3>
                  </div>
                  <div className="space-y-3 mt-6">
                     {[
                       { label: "رقم اللوحة", value: driverInfo?.plateNumber || "بدون رقم", icon: <GripHorizontal /> },
                       { label: "حالة المركبة", value: "جاهزة للعمل", icon: <CheckCircle2 className="text-green-500"/> },
                       { label: "تاريخ انتهاء الفحص", value: "2026-12-01", icon: <Clock /> }
                     ].map((info, idx) => (
                       <div key={idx} className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl">
                         <div className="flex items-center gap-3 text-gray-400 font-bold text-sm">{info.icon} {info.label}</div>
                         <div className="font-black text-gray-700">{info.value}</div>
                       </div>
                     ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setIsEditingPhoto(true)} className="w-full p-6 bg-gray-50 rounded-[30px] flex items-center justify-between group active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4 font-black text-gray-700"><div className="bg-white p-3 rounded-2xl shadow-sm"><User className="w-6 h-6 text-orange-500"/></div>تعديل الصورة الشخصية</div><ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                  <button onClick={() => setShowVehicleDetails(true)} className="w-full p-6 bg-gray-50 rounded-[30px] flex items-center justify-between group active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4 font-black text-gray-700"><div className="bg-white p-3 rounded-2xl shadow-sm"><Truck className="w-6 h-6 text-orange-500"/></div>بيانات السطحة</div><ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                  <button onClick={() => toast({ title: "التنبيهات", description: "إشعارات النظام مفعلة حالياً" })} className="w-full p-6 bg-gray-50 rounded-[30px] flex items-center justify-between group active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4 font-black text-gray-700"><div className="bg-white p-3 rounded-2xl shadow-sm"><ShieldAlert className="w-6 h-6 text-orange-500"/></div>تنبيهات النظام</div><ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeOrder && orderStage !== "payment" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1300] bg-white rounded-t-[45px] p-8 shadow-2xl border-t-4 border-orange-500">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center border-2 border-white shadow-sm text-2xl text-orange-500 font-bold">{activeOrder.customerName?.charAt(0) || "👤"}</div>
                <div className="text-right">
                  <h4 className="font-black text-xl text-gray-800">{activeOrder.customerName || "زبون جديد"}</h4>
                  <p className="text-xs text-blue-500 font-bold flex items-center gap-1 cursor-pointer" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentCoords?.[0]},${currentCoords?.[1]}&destination=${activeOrder.pickupLat},${activeOrder.pickupLng}`)}>فتح الخريطة الخارجية <ExternalLink className="w-3 h-3"/></p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative active:scale-95 transition-all">
                  <MessageSquare className="w-7 h-7 text-white" />
                  {unreadCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</span>}
                </button>
                <a href={`tel:${activeOrder.customerPhone || '000'}`} className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
                  <Phone className="w-7 h-7 text-white" />
                </a>
              </div>
            </div>
            <Button onClick={() => {
                let nextStage = "";
                let nextStatus = "";

                if (orderStage === "heading_to_pickup") {
                    nextStage = "arrived_pickup";
                    nextStatus = "arrived";
                } else if (orderStage === "arrived_pickup") {
                    nextStage = "heading_to_dropoff";
                    nextStatus = "in_progress";
                } else {
                    nextStage = "payment";
                    nextStatus = "arrived_dropoff";
                }

                setOrderStage(nextStage);
                socket.emit("update_order_status", { 
                  orderId: activeOrder.id, 
                  status: nextStatus,
                  driverId: driverInfo.id
                });

            }} className="w-full h-18 bg-black hover:bg-orange-600 text-white rounded-[26px] font-black text-xl shadow-xl py-4">
              {orderStage === "heading_to_pickup" ? "وصلت لموقع الزبون" : orderStage === "arrived_pickup" ? "تأكيد رفع السيارة" : "إتمام الرحلة"}
            </Button>
          </motion.div>
        )}

        <AnimatePresence>
          {isChatOpen && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[7000] bg-white flex flex-col">
              <div className="p-6 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600">{activeOrder?.customerName?.charAt(0)}</div>
                  <h4 className="font-black">{activeOrder?.customerName}</h4>
                </div>
                <Button variant="ghost" onClick={() => setIsChatOpen(false)}><X className="w-6 h-6"/></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'driver' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`p-4 rounded-2xl max-w-[80%] font-bold ${msg.sender === 'driver' ? 'bg-orange-500 text-white rounded-bl-none' : 'bg-white text-gray-800 rounded-br-none shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t flex gap-2">
                <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="اكتب رسالة..." className="flex-1 bg-gray-100 rounded-xl px-4 text-right font-bold focus:outline-none"/>
                <Button onClick={() => {
                  if(!chatMessage.trim()) return;
                  const newMsg = { text: chatMessage, sender: 'driver', id: Date.now() };
                  socket.emit("send_message", { ...newMsg, orderId: activeOrder.id });
                  setMessages([...messages, newMsg]);
                  setChatMessage("");
                }} className="bg-orange-500 rounded-xl"><Send className="w-5 h-5 rotate-180"/></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeOrder && orderStage === "payment" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[5000] bg-white flex flex-col items-center justify-center p-8 text-center">
             <div className="w-28 h-28 bg-orange-50 rounded-full flex items-center justify-center mb-8 border-4 border-white shadow-2xl shadow-orange-100"><CheckCircle2 className="w-14 h-14 text-orange-500" /></div>
             <h2 className="text-gray-400 font-black mb-2 uppercase tracking-widest text-sm">استلم النقد من الزبون</h2>
             <p className="text-6xl font-black text-gray-900 mb-12">{activeOrder.price} <span className="text-xl">د.ع</span></p>
             <Button onClick={handleCompleteOrder} className="w-full h-20 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl rounded-[30px] shadow-2xl shadow-orange-100">تأكيد الاستلام</Button>
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