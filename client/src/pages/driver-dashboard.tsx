import { useState, useEffect, useRef } from "react"; 
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, Menu, RefreshCw,
  Phone, CheckCircle2, User, MapPin, Navigation, List, ExternalLink,
  Star, Clock, TrendingUp, ChevronRight, Settings, History, GripHorizontal,
  Loader2, ShieldAlert, ArrowRight, Camera, MessageSquare, Send, Target, Power,
  PlusCircle, CreditCard, Info, ShieldCheck, Receipt, DollarSign, ArrowDownCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet"; 
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getSocket } from "@/lib/socket";
import { useQuery } from "@tantml:function_calls>
<invoke name="Driver } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient"; 
import { useToast } from "@/hooks/use-toast";
import { RoutingPolyline } from "@/components/RoutingPolyline";
import { ProfessionalNotification } from "@/components/ProfessionalNotification"; 

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

// CRITICAL: Use singleton socket instance
let socket: any;
if (typeof window !== 'undefined') {
  socket = getSocket();
  console.log("✅ [Socket] Driver socket initialized");
  
  // Setup reconnection handler
  socket.on("connect", () => {
    console.log("✅ [Socket] Driver connected with ID:", socket.id);
    
    // On reconnection, rejoin rooms automatically
    const driverId = localStorage.getItem("currentDriverId");
    if (driverId) {
      socket.emit("join_driver_room", parseInt(driverId));
      console.log(`🔄 [Socket Reconnect] Rejoined driver room: ${driverId}`);
    }
  });
}

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
  const [professionalNotif, setProfessionalNotif] = useState({ show: false, message: "", type: "new_order" as any });
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
  const [isRequestsSheetOpen, setIsRequestsSheetOpen] = useState(true);
  const [isActiveOrderExpanded, setIsActiveOrderExpanded] = useState(true); // Smart handle for active order card

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
    enabled: !!driverInfo?.id && (activeTab === "wallet" || activeTab === "history"),
  });

  const { data: settings } = useQuery<{ commissionAmount: number }>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    console.log("الوضع الحالي للطلب:", orderStage);
  }, [orderStage]);
  
  // SINGLE-USE recovery flag to prevent continuous loops
  const hasAttemptedDriverRecovery = useRef(false);
  
  // CRITICAL: State Recovery on App Mount/Reload - SINGLE-USE ONLY
  useEffect(() => {
    // CRITICAL: SINGLE-USE check - runs ONCE per session
    if (hasAttemptedDriverRecovery.current) {
      console.log("⏭️ [DRIVER RECOVERY] Already attempted, skipping");
      return;
    }
    
    if (!driverInfo?.activeOrder || activeOrder) {
      // No order to recover OR already have active order
      return;
    }
    
    console.log("🚀 [DRIVER RECOVERY] Starting SINGLE-USE recovery check");
    hasAttemptedDriverRecovery.current = true;
    
    const recoveredOrder = driverInfo.activeOrder;
    console.log("📡 [DRIVER RECOVERY] Found order in driverInfo:", {
      id: recoveredOrder.id,
      status: recoveredOrder.status
    });
    
    // CRITICAL FIX: Use BLACKLIST approach - reject ONLY completed/cancelled/delivered
    // This ensures transferred/assigned orders are recovered regardless of specific status
    const INVALID_STATUSES = ['delivered', 'completed', 'cancelled', 'pending'];
    
    if (INVALID_STATUSES.includes(recoveredOrder.status)) {
      console.log("🚫 [DRIVER RECOVERY] Recovery aborted: Order status is", recoveredOrder.status);
      console.log("🧹 [DRIVER RECOVERY] Reason:", 
        recoveredOrder.status === 'pending' ? 'Order not yet accepted by any driver' : 
        'Order is already completed/cancelled/delivered'
      );
      console.log("🧹 [DRIVER RECOVERY] Clearing ALL LocalStorage for this order");
      localStorage.removeItem(`driver_active_order_${driverInfo.id}`);
      localStorage.removeItem("sat7a_active_order_id");
      return; // ABORT restoration
    }
    
    console.log("✅ [DRIVER RECOVERY] Order is in valid active status:", recoveredOrder.status);
    console.log("✅ [DRIVER RECOVERY] This includes admin-assigned and transferred orders");
    
    console.log("✅ [DRIVER RECOVERY] VALID active order found, proceeding with restoration");
    console.log("🔄 [DRIVER RECOVERY] Step 1: Setting active order state");
    
    setActiveOrder(recoveredOrder);
    
    // Determine stage based on order status
    console.log("🔄 [DRIVER RECOVERY] Step 2: Determining order stage");
    if (recoveredOrder.status === "accepted" || recoveredOrder.status === "confirmed") {
      setOrderStage("heading_to_pickup");
      setActiveTab("map");
      console.log("✅ [DRIVER RECOVERY] Stage: heading_to_pickup");
    } else if (recoveredOrder.status === "arrived") {
      setOrderStage("arrived_at_pickup");
      setActiveTab("map");
      console.log("✅ [DRIVER RECOVERY] Stage: arrived_at_pickup");
    } else if (recoveredOrder.status === "picked_up" || recoveredOrder.status === "in_progress") {
      setOrderStage("in_progress");
      setActiveTab("map");
      console.log("✅ [DRIVER RECOVERY] Stage: in_progress");
    } else if (recoveredOrder.status === "arrived_dropoff") {
      setOrderStage("arrived_at_destination");
      setActiveTab("map");
      console.log("✅ [DRIVER RECOVERY] Stage: arrived_at_destination");
    } else {
      // Default fallback for any other active status
      setOrderStage("heading_to_pickup");
      setActiveTab("map");
      console.log("⚠️ [DRIVER RECOVERY] Unknown status, defaulting to heading_to_pickup");
    }
    
    // Re-join order room for socket updates
    console.log("🔄 [DRIVER RECOVERY] Step 3: Rejoining socket room");
    if (socket.connected && recoveredOrder.id) {
      socket.emit("join_order", recoveredOrder.id);
      console.log(`✅ [DRIVER RECOVERY] Rejoined order room: ${recoveredOrder.id}`);
    }
    
    console.log("🎉 [DRIVER RECOVERY] Recovery complete successfully!");
    
    toast({
      title: "✅ تم استرجاع الطلب",
      description: "تم استعادة طلبك النشط بنجاح",
      className: "bg-green-600 text-white font-black rounded-[24px]"
    });
  }, [driverInfo?.id]); // CRITICAL: Changed dependency - only run when driverInfo.id changes (once on load)
  
  // CRITICAL FIX: Driver must join their private room to receive admin assignments
  useEffect(() => {
    if (driverInfo?.id) {
      // Ensure socket is connected before joining rooms
      if (!socket.connected) {
        console.log("[Socket] Waiting for connection...");
        socket.connect();
      }
      
      // Wait a moment for connection, then join rooms
      const joinTimer = setTimeout(() => {
        socket.emit("join_driver_room", driverInfo.id);
        socket.emit("join_city", driverInfo.city);
        console.log(`[Socket] Driver ${driverInfo.id} FORCEFULLY joined rooms:`, {
          driverRoom: `driver_${driverInfo.id}`,
          cityRoom: `city_${driverInfo.city}`,
          connected: socket.connected
        });
        
        // CRITICAL: If there's an active order, rejoin its room immediately
        if (activeOrder?.id) {
          socket.emit("join_order", activeOrder.id);
          console.log(`[Socket] Rejoined order room: ${activeOrder.id}`);
        }
      }, 500);
      
      return () => clearTimeout(joinTimer);
    }
  }, [driverInfo?.id, driverInfo?.city]);

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

  const handleCompleteOrder = async (orderId: any) => {
    if (!driverInfo || !orderId) return;

    try {
      const dId = Number(driverInfo.id);
      const oId = Number(orderId);

      console.log("🚀 [ORDER COMPLETE] Starting completion process for order:", oId);

      // IMMEDIATE STATE CLEANUP - BEFORE API call
      // This prevents any race conditions with recovery logic
      console.log("🧹 [CLEANUP] Step 1: Clearing local state IMMEDIATELY");
      setActiveOrder(null);
      setOrderStage("heading_to_pickup");
      setActiveTab("map");
      
      // IMMEDIATE localStorage cleanup - BOTH keys
      console.log("🧹 [CLEANUP] Step 2: Removing ALL localStorage keys");
      localStorage.removeItem(`driver_active_order_${dId}`);
      localStorage.removeItem("sat7a_active_order_id"); // Customer-side key
      
      // IMMEDIATE socket room cleanup
      console.log("🧹 [CLEANUP] Step 3: Leaving socket room");
      socket.emit("leave_order", oId);

      // NOW make the API call
      console.log("📡 [API CALL] Calling completion endpoint");
      const response = await apiRequest("POST", `/api/drivers/${dId}/complete/${oId}`);

      // CRITICAL: Emit FINAL_CLEANUP to force both parties to reset
      console.log("📡 [FINAL_CLEANUP] Emitting FINAL_CLEANUP event to all parties");
      socket.emit("FINAL_CLEANUP", { 
        orderId: oId,
        driverId: dId,
        status: "completed",
        message: "Order completed - forcing state reset"
      });
      
      // Emit status update after successful API call
      socket.emit("update_order_status", { 
        orderId: oId, 
        status: "completed",
        driverId: dId
      });
      
      console.log("✅ [ORDER COMPLETE] Completion successful, cleanup events emitted for order:", oId);

      // Show success notification
      setNotification({ show: true, message: "تم إكمال الطلب بنجاح", type: "success" });

      setTimeout(() => {
        setNotification(n => ({ ...n, show: false }));
      }, 3500);

      // Invalidate queries to refresh driver data
      await queryClient.invalidateQueries({ 
        queryKey: [currentId ? `/api/driver/me/${currentId}` : "/api/driver/me"] 
      });
      await refetch();

    } catch (err: any) {
      console.error("Faliure:", err);
      alert(err.message || "حدث خطأ غير متوقع أثناء إكمال الطلب");
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

    try {
      // إرسال طلب API للخادم لتسجيل القبول
      const res = await apiRequest("POST", `/api/drivers/${driverInfo?.id}/accept/${req.id}`);
      
      if (res.ok) {
        console.log("✅ [ACCEPT] Order accepted, fetching full order details with customer image");
        
        // CRITICAL: Fetch FULL order object including customer image from database
        const fullOrderRes = await fetch(`/api/requests/${req.id}`);
        let fullOrder = req; // Fallback to basic req if fetch fails
        
        if (fullOrderRes.ok) {
          fullOrder = await fullOrderRes.json();
          console.log("✅ [ACCEPT] Full order fetched with customer data");
          console.log("✅ [ACCEPT] Customer Image:", fullOrder.user?.image || fullOrder.customerImage);
        } else {
          console.warn("⚠️ [ACCEPT] Failed to fetch full order, using basic data");
        }
        
        // تفعيل الطلب محلياً with FULL data including customer image
        setActiveOrder({
          ...fullOrder,
          customerImage: fullOrder.user?.image || fullOrder.customerImage || null
        });
        setOrderStage("heading_to_pickup");
        
        console.log("✅ [ACCEPT] Active order set with customer image");
        
        // الانضمام لغرفة الدردشة الخاصة بالطلب
        socket.emit("join_order", req.id);
        
        // إزالة الطلب من القائمة المتاحة فوراً
        setAvailableRequests(prev => prev.filter(r => r.id !== req.id));
        
        setNotification({ show: true, message: "تم قبول الطلب بنجاح", type: "success" });
        
        // إخفاء التنبيه بعد 3 ثواني
        setTimeout(() => {
          setNotification(n => ({ ...n, show: false }));
        }, 3000);
      } else {
        const data = await res.json();
        toast({ 
          variant: "destructive", 
          title: "خطأ", 
          description: data.message || "فشل في قبول الطلب" 
        });
      }
    } catch (err) {
      toast({ 
        variant: "destructive", 
        title: "خطأ", 
        description: "تعذر الاتصال بالخادم" 
      });
    }
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

        apiRequest("PATCH", `/api/drivers/${driverInfo.id}`, {
          lastLat: latitude.toString(), lastLng: longitude.toString()
        }).catch(() => {});

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
        // تصفية الطلبات: فقط pending وفي نفس المدينة وليس مكتملاً
        const myCityRequests = allRequests.filter((req: any) => 
          req.city?.trim() === driverInfo?.city?.trim() && 
          (req.status === "pending" || req.status === "confirmed") &&
          req.status !== "completed"
        );
        setAvailableRequests(myCityRequests);
      }
      setNotification({ show: true, message: "تم تحديث طلبات منطقتك", type: "success" });
    } catch (err) {
      setNotification({ show: true, message: "فشل التحديث", type: "error" });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setNotification(n => ({ ...n, show: false })), 3000);
    }
  };

  useEffect(() => {
    if (driverInfo?.isOnline && driverInfo?.status === "approved") {
      // 1. استقبال طلبات جديدة - WITH PROFESSIONAL NOTIFICATION
      socket.on("new_request_available", (data: any) => { 
        if (!activeOrder && data.city?.trim() === driverInfo?.city?.trim()) {
          setAvailableRequests(prev => {
             if (prev.find(r => r.id === data.id)) return prev;
             return [data, ...prev];
          });
          
          // Show professional notification
          setProfessionalNotif({
            show: true,
            message: "هناك طلب نقل جديد! افتح قائمة الطلبات المتاحة",
            type: "new_order"
          });
        }
      });

      // 2. حذف الطلب فوراً إذا قبله سائق آخر (الحل لمشكلتك)
      socket.on("request_removed", (data: any) => {
        setAvailableRequests(prev => prev.filter(r => r.id !== data.id));
      });

      // 3. حذف الطلب إذا تغيرت حالته (حماية إضافية)
      socket.on("update_order_status", (data: any) => {
         if (data.status === 'completed' || data.status === 'accepted' || data.status === 'confirmed') {
            setAvailableRequests(prev => prev.filter(r => r.id !== data.orderId));
         }
      });

      // CRITICAL FIX: FORCE UI TRANSITION - Admin Dispatch
      const handleOrderAssigned = (data: any) => {
        console.log("🚨 [CRITICAL] Admin assigned order to driver:", data);
        console.log("🚨 [CRITICAL] Current activeOrder:", activeOrder);
        console.log("🚨 [CRITICAL] Socket connected:", socket.connected);
        
        if (!activeOrder) {
          // FORCE UI TRANSITION - Set activeOrder immediately
          const forceOrderData = {
            ...data,
            id: data.id,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            pickupLat: data.pickupLat,
            pickupLng: data.pickupLng,
            pickupAddress: data.pickupAddress || data.location,
            destination: data.destination,
            price: data.price,
            vehicleType: data.vehicleType,
            status: "accepted"
          };
          
          console.log("🚨 [CRITICAL] FORCING activeOrder to:", forceOrderData);
          
          // FORCE STATE UPDATES
          setActiveOrder(forceOrderData);
          setOrderStage("heading_to_pickup");
          setActiveTab("map"); // Force switch to map tab
          setIsRequestsSheetOpen(false); // Close requests sheet
          
          // Join chat room
          socket.emit("join_order", data.id);
          
          // Remove from available list
          setAvailableRequests(prev => prev.filter(r => r.id !== data.id));
          
          // Show aggressive notification
          setNotification({ 
            show: true, 
            message: "🚨 طلب جديد من الإدارة! ابدأ التوجه للزبون الآن", 
            type: "success" 
          });
          
          setTimeout(() => {
            setNotification(n => ({ ...n, show: false }));
          }, 5000);
          
          // Force refetch
          refetch();
          
          console.log("✅ [CRITICAL] UI FORCED TO ACTIVE ORDER STATE");
        } else {
          // إذا كان لديه طلب نشط، أضف الطلب الجديد للقائمة
          setAvailableRequests(prev => {
            const exists = prev.find(r => r.id === data.id);
            if (exists) return prev;
            return [data, ...prev];
          });
          setNotification({ 
            show: true, 
            message: "تم تحويل طلب إضافي لك - أكمل الطلب الحالي أولاً", 
            type: "success" 
          });
        }
      };
      
      socket.on("order_assigned", handleOrderAssigned);
      socket.on("ORDER_UPDATED", handleOrderAssigned);
      socket.on("NEW_ORDER_ASSIGNED", handleOrderAssigned); // New explicit event
      
      // CRITICAL FIX: Handle order removal when admin transfers to another driver
      socket.on("order_removed_from_driver", (data: any) => {
        console.log("🚨 [ADMIN TRANSFER] Order removed from this driver by admin:", data);
        // Check if the order being removed is the current active order
        if (activeOrder && activeOrder.id === data.orderId) {
          console.log("🧹 [ADMIN TRANSFER] This driver's active order was transferred - IMMEDIATE UI clearance");
          
          // IMMEDIATE cleanup - BEFORE any other operations
          socket.emit("leave_order", data.orderId);
          localStorage.removeItem(`driver_active_order_${driverInfo?.id}`);
          localStorage.removeItem("sat7a_active_order_id");
          console.log("🧹 [ADMIN TRANSFER] All localStorage keys cleared");
          
          // FORCE UI RESET TO AVAILABLE MODE IMMEDIATELY
          setActiveOrder(null);
          setOrderStage("heading_to_pickup");
          setActiveTab("map");
          
          // Invalidate queries to refresh available orders list
          queryClient.invalidateQueries(["driverOrders", driverInfo?.id]);
          queryClient.invalidateQueries(["availableRequests"]);
          
          setNotification({ 
            show: true, 
            message: data.message || "تم نقل الطلب إلى سائق آخر من قبل الإدارة", 
            type: "error" 
          });
          setTimeout(() => {
            setNotification(n => ({ ...n, show: false }));
          }, 5000);
          
          console.log("✅ [ADMIN TRANSFER] Driver UI reset to available home screen - NO REFRESH REQUIRED");
        } else {
          console.log("ℹ️ [ADMIN TRANSFER] Order removal event received but doesn't match active order");
        }
      });
      
      // Handle order deletion by admin
      socket.on("order_deleted_by_admin", (data: any) => {
        console.log("[Driver] Order deleted by admin:", data);
        if (activeOrder && activeOrder.id === data.requestId) {
          setActiveOrder(null);
          setOrderStage("heading_to_pickup");
          setNotification({ 
            show: true, 
            message: data.message || "تم حذف الطلب من قبل الإدارة", 
            type: "error" 
          });
          setTimeout(() => {
            setNotification(n => ({ ...n, show: false }));
          }, 5000);
        }
        setAvailableRequests(prev => prev.filter(r => r.id !== data.requestId));
      });
      
      // Handle order cancellation by customer
      // CRITICAL: Listen for FINAL_CLEANUP event
      socket.on("FINAL_CLEANUP", (data: any) => {
        console.log("🚨 [FINAL_CLEANUP] Received FINAL_CLEANUP event:", data);
        
        if (activeOrder && (data.orderId === activeOrder.id || data.orderId === Number(activeOrder.id))) {
          console.log("🧹 [FINAL_CLEANUP] Forcing immediate state reset for driver");
          
          // FORCE RESET ALL STATE
          setActiveOrder(null);
          setOrderStage("heading_to_pickup");
          setActiveTab("map");
          
          // FORCE CLEANUP localStorage
          localStorage.removeItem(`driver_active_order_${driverInfo?.id}`);
          localStorage.removeItem("sat7a_active_order_id");
          
          console.log("✅ [FINAL_CLEANUP] Driver state forcefully reset to idle");
        }
      });
      
      socket.on("order_cancelled_by_customer", (data: any) => {
        console.log("🚨 [DRIVER] Order cancelled by customer:", data);
        if (activeOrder && activeOrder.id === data.requestId) {
          // CRITICAL: Leave socket room and cleanup
          console.log("🧹 [CLEANUP] Customer cancellation - starting cleanup");
          socket.emit("leave_order", data.requestId);
          localStorage.removeItem(`driver_active_order_${driverInfo?.id}`);
          localStorage.removeItem("sat7a_active_order_id");
          console.log("🧹 [CLEANUP] All localStorage keys cleared");
          
          setActiveOrder(null);
          setOrderStage("heading_to_pickup");
          setNotification({ 
            show: true, 
            message: "قام الزبون بإلغاء الطلب", 
            type: "error" 
          });
          setTimeout(() => {
            setNotification(n => ({ ...n, show: false }));
          }, 3000);
        }
        setAvailableRequests(prev => prev.filter(r => r.id !== data.requestId));
      });
      
      // CRITICAL: Handle Admin Force Complete
      socket.on("ADMIN_FORCE_COMPLETE", (data: any) => {
        console.log("🚨 [ADMIN] Force completing order:", data);
        if (activeOrder && activeOrder.id === data.requestId) {
          // CRITICAL: Leave socket room and cleanup ALL keys
          console.log("🧹 [CLEANUP] Admin force complete - starting cleanup");
          socket.emit("leave_order", data.requestId);
          localStorage.removeItem(`driver_active_order_${driverInfo?.id}`);
          localStorage.removeItem("sat7a_active_order_id");
          console.log("🧹 [CLEANUP] All localStorage keys cleared");
          
          // FORCE CLEAR activeOrder
          setActiveOrder(null);
          setOrderStage("heading_to_pickup");
          setActiveTab("map");
          setNotification({ 
            show: true, 
            message: "تم إتمام الطلب من قبل الإدارة - تم خصم العمولة", 
            type: "success" 
          });
          setTimeout(() => {
            setNotification(n => ({ ...n, show: false }));
          }, 5000);
          
          // Force refetch to update wallet
          refetch();
        }
      });

      socket.on("new_message", (msg: any) => {
        if (activeOrder && Number(msg.orderId) === Number(activeOrder.id)) {
          setMessages(prev => {
            const exists = prev.find(m => m.id === msg.id);
            if (exists) return prev;
            return [...prev, { 
              id: msg.id, 
              text: msg.content || msg.message, 
              sender: msg.senderType === 'driver' ? 'driver' : 'customer',
              senderName: msg.senderName,
              timestamp: msg.createdAt
            }];
          });
          if (!isChatOpen) setUnreadCount(prev => prev + 1);
        }
      });
      
      // CRITICAL: Receive and merge customer info (including profile image) when order is accepted
      socket.on("customer_info", (customerData: any) => {
        console.log("👤 [CUSTOMER INFO] Received customer data from server:", customerData);
        console.log("👤 [CUSTOMER INFO] Customer Image URL:", customerData.image);
        
        // CRITICAL: Merge customer data into activeOrder state
        setActiveOrder((prevOrder: any) => {
          if (!prevOrder) {
            console.log("⚠️ [CUSTOMER INFO] No active order to update");
            return prevOrder;
          }
          
          const updated = {
            ...prevOrder,
            customerName: customerData.name || prevOrder.customerName,
            customerPhone: customerData.phone || prevOrder.customerPhone,
            customerImage: customerData.image || null, // ← CRITICAL: Add customer image to activeOrder
            pickupLat: customerData.pickupLat || prevOrder.pickupLat,
            pickupLng: customerData.pickupLng || prevOrder.pickupLng,
            destLat: customerData.dropoffLat || prevOrder.destLat,
            destLng: customerData.dropoffLng || prevOrder.destLng,
            pickupAddress: customerData.pickupAddress || prevOrder.pickupAddress,
            destination: customerData.dropoffAddress || prevOrder.destination
          };
          
          console.log("✅ [CUSTOMER INFO] Active order updated with customer image");
          console.log("✅ [CUSTOMER INFO] Customer Name:", updated.customerName);
          console.log("✅ [CUSTOMER INFO] Customer Image:", updated.customerImage);
          
          return updated;
        });
      });

      return () => { 
        socket.off("new_request_available"); 
        socket.off("order_assigned");
        socket.off("ORDER_UPDATED");
        socket.off("NEW_ORDER_ASSIGNED");
        socket.off("order_removed_from_driver"); // CRITICAL: Clean up admin transfer listener
        socket.off("order_deleted_by_admin");
        socket.off("order_cancelled_by_customer");
        socket.off("ADMIN_FORCE_COMPLETE");
        socket.off("FINAL_CLEANUP"); // CRITICAL: Clean up FINAL_CLEANUP listener
        socket.off("new_message");
        socket.off("customer_info");
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
                {/* خط الملاحة بين السائق والزبون عند وجود طلب نشط - باستخدام الطرق الفعلية */}
                {activeOrder && currentCoords && (
                  <RoutingPolyline 
                    start={currentCoords}
                    end={[activeOrder.pickupLat, activeOrder.pickupLng]} 
                    color="#f97316" 
                    weight={4} 
                    opacity={0.7}
                  />
                )}
                {activeOrder && (
                  <Marker position={[activeOrder.pickupLat, activeOrder.pickupLng]}>
                    <Popup><div className="text-right font-black">موقع الزبون: {activeOrder.customerName}</div></Popup>
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
                  animate={{ y: isRequestsSheetOpen ? 0 : "calc(100% - 70px)" }}
                  onDragEnd={(e, info) => {
                    if (info.offset.y > 100) setIsRequestsSheetOpen(false);
                    else if (info.offset.y < -50) setIsRequestsSheetOpen(true);
                  }}
                  className="absolute inset-x-0 bottom-0 z-[1200] bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[70vh] transition-colors duration-300"
                >
                  <div 
                    className="w-full flex flex-col items-center py-4 cursor-grab active:cursor-grabbing"
                    onClick={() => setIsRequestsSheetOpen(!isRequestsSheetOpen)}
                  >
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-1" />
                    <GripHorizontal className={`w-5 h-5 transition-transform duration-300 ${isRequestsSheetOpen ? 'text-gray-300' : 'text-orange-500 rotate-180'}`} />
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
              <Button variant="ghost" size="icon" onClick={() => setActiveTab("map")} className="rounded-full bg-gray-100 h-10 w-10">
                <ArrowRight className="w-6 h-6 text-black" />
              </Button>
              <h2 className="text-xl font-black text-gray-800 italic">المحفظة</h2>
              <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
              <div className="bg-[#FF7A00] p-7 rounded-[30px] text-white shadow-lg relative overflow-hidden">
                <p className="text-white/80 text-xs font-bold mb-1">رصيدك الحالي المتاح</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-black tracking-tight">{Number(driverInfo?.walletBalance || 0).toLocaleString()}</h3>
                  <span className="text-lg font-bold opacity-90">د.ع</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-gray-500 text-sm font-bold block px-2">مبلغ الشحن المطلوب</label>
                <input 
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  type="number" 
                  placeholder="أدخل المبلغ..."
                  className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-[22px] px-6 text-xl font-black text-gray-800 focus:border-orange-500 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-gray-800 font-black text-lg pr-2">وسائل الشحن</h4>
                <button 
                  onClick={() => setPaymentMethod('zain')}
                  className={`w-full p-5 bg-white border-2 rounded-[25px] flex items-center justify-between transition-all ${paymentMethod === 'zain' ? 'border-orange-500 bg-orange-50/20' : 'border-gray-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center p-1"><img src="/zain-logo.png" className="w-full h-full object-contain" alt="Zain" /></div>
                    <span className="font-bold text-gray-700 text-lg">زين كاش</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'zain' ? 'border-orange-500' : 'border-gray-200'}`}>
                    {paymentMethod === 'zain' && <div className="w-3 h-3 bg-orange-500 rounded-full"></div>}
                  </div>
                </button>
                <button 
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full p-5 bg-white border-2 rounded-[25px] flex items-center justify-between transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white"><CreditCard className="w-6 h-6" /></div>
                    <span className="font-bold text-gray-700 text-lg">ماستر كارد / فيزا</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'card' ? 'border-blue-500' : 'border-gray-200'}`}>
                    {paymentMethod === 'card' && <div className="w-3 h-3 bg-blue-500 rounded-full"></div>}
                  </div>
                </button>
              </div>

              <div className="pt-4 pb-20">
                <h4 className="text-gray-800 font-black text-lg pr-2 mb-4">سجل العمليات</h4>
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
                ) : <div className="text-center py-10 opacity-30 italic font-bold">لا توجد عمليات مسجلة</div>}
              </div>
            </div>

            <div className="p-6 bg-white border-t border-gray-50 pb-8">
              <Button 
                disabled={isDepositing || !paymentMethod}
                onClick={() => handleDeposit(paymentMethod === 'card' ? 'master' : 'zain')}
                className="w-full h-16 rounded-[22px] bg-orange-500 text-white text-xl font-black shadow-lg"
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
              }} className="rounded-full bg-gray-50"><ArrowRight className="w-6 h-6"/></Button>
              <h2 className="text-2xl font-black italic">{isEditingPhoto ? "تعديل الصورة" : showVehicleDetails ? "بيانات السطحة" : "الإعدادات"}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isEditingPhoto ? (
                <div className="flex flex-col items-center py-10">
                  <div className="relative">
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                    <div className="w-40 h-40 bg-orange-50 rounded-full border-8 border-orange-100 flex items-center justify-center text-5xl overflow-hidden">
                       {driverInfo?.avatarUrl ? <img src={driverInfo.avatarUrl} className="w-full h-full object-cover"/> : "👤"}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 bg-black text-white p-3 rounded-full border-4 border-white"><Camera className="w-5 h-5" /></button>
                  </div>
                  <Button onClick={() => setIsEditingPhoto(false)} className="w-full h-16 border-2 border-orange-500 text-orange-600 rounded-2xl mt-12 font-black">العودة للإعدادات</Button>
                </div>
              ) : showVehicleDetails ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-6 rounded-[35px] border-2 border-dashed border-gray-200 flex flex-col items-center">
                    <Truck className="w-10 h-10 text-orange-500 mb-4" />
                    <h3 className="font-black text-xl text-gray-800">{driverInfo?.vehicleType || "سطحة هيدروليك"}</h3>
                  </div>
                  <div className="space-y-3 mt-6">
                    <div className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl">
                      <span className="text-gray-400 font-bold">رقم اللوحة</span>
                      <span className="font-black text-gray-700">{driverInfo?.plateNumber || "بدون رقم"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setIsEditingPhoto(true)} className="w-full p-6 bg-gray-50 rounded-[30px] flex items-center justify-between">
                    <div className="flex items-center gap-4 font-black text-gray-700"><User className="text-orange-500"/> تعديل الصورة الشخصية</div><ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                  <button onClick={() => setShowVehicleDetails(true)} className="w-full p-6 bg-gray-50 rounded-[30px] flex items-center justify-between">
                    <div className="flex items-center gap-4 font-black text-gray-700"><Truck className="text-orange-500"/> بيانات السطحة</div><ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeOrder && orderStage !== "payment" && (
          <motion.div 
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            initial={{ y: "100%" }}
            animate={{ 
              y: isActiveOrderExpanded ? 0 : "calc(100% - 140px)" // Expanded: Full | Minimized: 140px peek
            }}
            onDragEnd={(e, info) => {
              // Smart snapping based on drag direction
              if (info.offset.y > 100) {
                setIsActiveOrderExpanded(false); // Drag down = minimize
              } else if (info.offset.y < -50) {
                setIsActiveOrderExpanded(true);  // Drag up = expand
              }
            }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-[1300] bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          >
            {/* SMART HANDLE - Click to toggle, Drag to move */}
            <div 
              className="w-full flex flex-col items-center py-4 cursor-grab active:cursor-grabbing"
              onClick={(e) => {
                e.stopPropagation();
                setIsActiveOrderExpanded(!isActiveOrderExpanded);
              }}
              style={{ touchAction: 'none' }}
            >
              <div className="w-16 h-2 bg-gray-300 rounded-full mb-2" />
              <GripHorizontal className={`w-6 h-6 transition-all duration-300 ${isActiveOrderExpanded ? 'text-gray-300' : 'text-orange-500 rotate-180'}`} />
            </div>

            {/* PROFESSIONAL CUSTOMER PROFILE SECTION */}
            <div className="px-6 pb-8 space-y-6">
              {/* Customer Header Row */}
              <div className="flex items-center gap-4">
                {/* Customer Profile Image */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full border-4 border-blue-500 overflow-hidden shadow-lg bg-white">
                    {activeOrder.customerImage ? (
                      <img 
                        src={activeOrder.customerImage} 
                        className="w-full h-full object-cover" 
                        onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/147/147144.png" }} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-100">
                        <User className="w-10 h-10 text-blue-400" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-orange-500 w-5 h-5 rounded-full border-2 border-white"></div>
                </div>

                {/* Customer Name & Info */}
                <div className="flex-1 text-right">
                  <h4 className="text-xl font-black text-gray-900 leading-tight mb-0.5">
                    {activeOrder.customerName || "زبون جديد"}
                  </h4>
                  <p className="text-xs text-gray-500 font-bold mb-2">عميل سطحة</p>
                  <div className="flex items-center gap-1 text-blue-500 text-[11px] font-black bg-blue-50 w-fit px-3 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-blue-500" />
                    <span>4.8</span>
                    <span className="text-gray-400">• موثوق</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button 
                    onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} 
                    className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 relative active:scale-90 transition-transform"
                  >
                    <MessageSquare className="w-6 h-6 text-white" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[22px] h-5 rounded-full flex items-center justify-center border-2 border-white font-black animate-bounce">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <a 
                    href={`tel:${activeOrder.customerPhone || '000'}`} 
                    className="w-14 h-14 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 active:scale-90 transition-transform"
                  >
                    <Phone className="w-6 h-6 text-white" />
                  </a>
                </div>
              </div>

              {/* Navigation Button */}
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.pickupLat},${activeOrder.pickupLng}`, '_blank');
                }}
                className="w-full h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-[24px] font-black text-sm shadow-lg shadow-orange-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Navigation className="w-5 h-5" />
                <span>فتح في خرائط جوجل</span>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Primary Action Button */}
            <div className="px-6 pb-6">
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
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
                  
                  // CRITICAL: Trigger System Notification when driver arrives
                  if (nextStatus === "arrived" && "Notification" in window) {
                    Notification.requestPermission().then(permission => {
                      if (permission === "granted") {
                        new Notification("SATHA - سطحة", {
                          body: "تم تحديث حالة الطلب",
                          icon: "/logo.png",
                          badge: "/logo.png"
                        });
                      }
                    });
                  }
                  
                  socket.emit("update_order_status", { 
                    orderId: activeOrder.id, 
                    status: nextStatus, 
                    driverId: driverInfo.id,
                    customerPhone: activeOrder.customerPhone // Pass customer phone for targeted notification
                  });
                }} 
                className="w-full h-16 bg-gradient-to-r from-black to-gray-800 hover:from-orange-500 hover:to-orange-600 text-white rounded-[26px] font-black text-lg shadow-xl transition-all active:scale-95"
              >
                {orderStage === "heading_to_pickup" ? "وصلت لموقع الزبون" : 
                 orderStage === "arrived_pickup" ? "تأكيد رفع السيارة" : "إتمام الرحلة"}
              </Button>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {isChatOpen && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[7000] bg-white flex flex-col">
              <div className="p-6 border-b flex justify-between items-center">
                <div className="flex items-center gap-3"><h4 className="font-black">{activeOrder?.customerName}</h4></div>
                <Button variant="ghost" onClick={() => setIsChatOpen(false)}><X className="w-6 h-6"/></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'driver' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`p-4 rounded-2xl max-w-[80%] font-bold ${msg.sender === 'driver' ? 'bg-orange-500 text-white rounded-bl-none' : 'bg-white text-gray-800 rounded-br-none shadow-sm'}`}>{msg.text}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t flex gap-2">
                <input 
                  type="text" 
                  value={chatMessage} 
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && chatMessage.trim() && activeOrder) {
                      const payload = {
                        orderId: activeOrder.id,
                        message: chatMessage,
                        senderId: driverInfo?.id,
                        senderType: 'driver',
                        senderName: driverInfo?.name || 'السائق'
                      };
                      socket.emit("send_message", payload);
                      setChatMessage("");
                    }
                  }}
                  placeholder="اكتب رسالة..." 
                  className="flex-1 bg-gray-100 rounded-xl px-4 text-right font-bold focus:outline-none"
                />
                <Button onClick={() => {
                  if(!chatMessage.trim() || !activeOrder) return;
                  const payload = {
                    orderId: activeOrder.id,
                    message: chatMessage,
                    senderId: driverInfo?.id,
                    senderType: 'driver',
                    senderName: driverInfo?.name || 'السائق'
                  };
                  socket.emit("send_message", payload);
                  setChatMessage("");
                }} className="bg-orange-500 rounded-xl"><Send className="w-5 h-5 rotate-180"/></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- واجهة إتمام الطلب الاحترافية المحدثة --- */}
        {activeOrder && orderStage === "payment" && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 z-[9999] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center"
          >
            {/* الخلفية الديكورية */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-orange-500 to-transparent opacity-10" />

            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-orange-100 p-8 relative overflow-hidden border border-gray-100"
            >
              {/* أيقونة النجاح */}
              <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-orange-100">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <DollarSign className="w-12 h-12 text-orange-500" />
                </motion.div>
              </div>

              <h2 className="text-gray-400 font-black mb-2 uppercase tracking-[0.2em] text-xs">ملخص الرحلة المكتملة</h2>
              <div className="h-[2px] w-12 bg-orange-500 mx-auto mb-6 rounded-full" />

              {/* تفاصيل الزبون */}
              <div className="flex items-center justify-center gap-3 mb-8 bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700 font-black text-lg">{activeOrder.customerName || "عميل سطحة"}</span>
              </div>

              {/* المبلغ الكبير */}
              <div className="space-y-1 mb-10">
                <p className="text-gray-400 font-bold text-sm">المبلغ المطلوب استلامه نقداً</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-6xl font-black text-gray-900 tabular-nums">{activeOrder.price}</span>
                  <span className="text-xl font-black text-orange-500">د.ع</span>
                </div>
              </div>

              {/* تنبيه العمولة المباشر */}
              <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-2xl mb-10 text-right">
                <div className="bg-blue-500 p-2 rounded-lg text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-blue-800 font-bold leading-relaxed">
                  عند الضغط على تأكيد، سيتم خصم عمولة التطبيق من محفظتك وإغلاق الطلب نهائياً.
                </p>
              </div>

              {/* زر التأكيد الضخم */}
              <Button 
                onClick={() => handleCompleteOrder(activeOrder.id)} 
                className="w-full h-20 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-black text-2xl rounded-[28px] shadow-[0_15px_30px_rgba(249,115,22,0.3)] flex items-center justify-center gap-4"
              >
                تأكيد استلام النقد
                <ArrowDownCircle className="w-7 h-7" />
              </Button>
            </motion.div>

            {/* رقم الطلب للتوثيق */}
            <p className="mt-8 text-gray-400 text-[10px] font-bold">رقم مرجع الطلب: #{activeOrder.id || 'N/A'}</p>
          </motion.div>
        )}

      </div>

      {/* Professional Notification System */}
      <ProfessionalNotification 
        show={professionalNotif.show}
        message={professionalNotif.message}
        type={professionalNotif.type}
        onClose={() => setProfessionalNotif({ ...professionalNotif, show: false })}
      />

      <AnimatePresence>
        {notification.show && (
          <motion.div 
            initial={{ y: -100 }} 
            animate={{ y: 20 }} 
            exit={{ y: -100 }} 
            className="fixed top-0 left-0 right-0 z-[10000] flex justify-center px-6 pointer-events-none"
          >
            <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md pointer-events-auto ${notification.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
               {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
               <span className="font-black text-sm">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}