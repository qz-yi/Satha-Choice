import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { 
  MapPin, Check, Search, Loader2, Menu, 
  MessageSquare, History, Wallet, Phone, Truck, ChevronRight,
  LocateFixed, RotateCcw, X, Star, Navigation, Target, Send, LogOut, Camera, User, Lock, Home, ShieldCheck, CreditCard, QrCode
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MapContainer, TileLayer, useMapEvents, Marker, useMap, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { io } from "socket.io-client";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { RoutingPolyline } from "@/components/RoutingPolyline"; 

// إعداد السوكيت مع خيارات إعادة الاتصال لضمان الثبات
const socket = io(window.location.origin, {
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
}); 

const getOrangeArrowIcon = (rotation: number) => L.divIcon({
  html: `
    <div style="transform: rotate(${rotation}deg); transition: transform 0.4s; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.3));">
      <svg width="45" height="45" viewBox="0 0 100 100" fill="none">
        <path d="M50 5L92 90L50 72L8 90L50 5Z" fill="#f97316" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>`,
  className: "", iconSize: [45, 45], iconAnchor: [22.5, 22.5], 
});

const normalizeCity = (city: string): string => {
  if (!city) return "بابل";
  const c = city.toLowerCase();
  if (c.includes("babil") || c.includes("بابل") || c.includes("hilla") || c.includes("حلة")) return "بابل";
  if (c.includes("baghdad") || c.includes("بغداد")) return "بغداد";
  if (c.includes("karbala") || c.includes("كربلاء")) return "كربلاء";
  if (c.includes("najaf") || c.includes("نجف")) return "النجف";
  if (c.includes("basra") || c.includes("بصرة")) return "البصرة";
  return city; 
};

function FlyToMarker({ center, shouldFly }: { center: [number, number], shouldFly: boolean }) {
  const map = useMap();
  useEffect(() => { 
    if (shouldFly && center && center[0] && center[1]) {
      map.flyTo(center, 16, { duration: 1.5 }); 
    }
  }, [center, map, shouldFly]);
  return null;
}

const SidebarLink = memo(({ icon, label, extra, onClick, color = "text-orange-600", extraColor = "bg-gray-100 text-gray-500" }: any) => (
  <button 
    onClick={onClick} 
    className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-orange-50 active:scale-[0.97] transition-all rounded-2xl text-right group mb-3 border border-transparent hover:border-orange-100"
  >
    <div className="flex items-center gap-4">
      <div className={`${color} p-2.5 rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <span className="text-[15px] font-black text-gray-700">{label}</span>
    </div>
    {extra && (
      <span className={`text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm ${extraColor}`}>
        {extra}
      </span>
    )}
  </button>
));

const StepIndicator = ({ step }: { step: string }) => {
    const steps = [{ id: 'pickup' }, { id: 'dropoff' }, { id: 'vehicle' }];
    return (
        <div className="flex items-center justify-center gap-2 mb-2">
            {steps.map((s) => (
                <div key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${step === s.id ? 'w-8 bg-orange-500' : 'w-4 bg-gray-200'}`} />
            ))}
        </div>
    );
};

export default function RequestFlow() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"choice" | "login" | "signup">("choice");
  const [userProfile, setUserProfile] = useState({
    id: null as number | null, username: "", phone: "", password: "", address: "قيد التحديد", image: null as string | null, wallet: "0", trips: "0"
  });

  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [viewState, setViewState] = useState<"booking" | "success" | "tracking">("booking");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCharging, setIsCharging] = useState(false); 
  const [shouldFly, setShouldFly] = useState(false); 
  const [requestStatus, setRequestStatus] = useState("pending");
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null); 
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [tripsHistory, setTripsHistory] = useState<any[]>([]);
  const [chargeAmount, setChargeAmount] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    location: "", destination: "", pickupLat: 32.4846, pickupLng: 44.4209, 
    destLat: 32.4846, destLng: 44.4209, vehicleType: "", price: "", timeMode: "now" as "now" | "later",
    city: "بابل" 
  });

  const scrollChatToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const refreshUserData = useCallback(async (phone: string, pass: string) => {
    try {
      const response = await fetch(`/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone, password: pass }),
      });
      if (response.ok) {
        const data = await response.json();
        const updatedProfile = { 
          ...userProfile, 
          id: data.id,
          username: data.username || data.name,
          phone: phone,
          password: pass,
          wallet: data.walletBalance?.toString() || "0",
          trips: data.tripsCount?.toString() || "0"
        };
        setUserProfile(updatedProfile);
        localStorage.setItem("sat7a_user", JSON.stringify(updatedProfile));
      }
    } catch (err) {
      console.error("خطأ في تحديث البيانات", err);
    }
  }, [userProfile]);

  // جلب الرسائل القديمة عند فتح الدردشة
  useEffect(() => {
    if (isChatOpen && activeOrderId) {
      fetch(`/api/requests/${activeOrderId}/messages`)
        .then(res => res.json())
        .then(data => {
          setMessages(data);
          setTimeout(scrollChatToBottom, 100);
        })
        .catch(err => console.error("Error fetching messages:", err));
    }
  }, [isChatOpen, activeOrderId]);
  
  // جلب سجل الرحلات عند فتح القائمة
  useEffect(() => {
    if (isHistoryOpen && userProfile.phone) {
      fetch(`/api/users/${userProfile.phone}/requests`)
        .then(res => res.json())
        .then(data => {
          // فلترة الرحلات المكتملة فقط
          const completedTrips = data.filter((trip: any) => trip.status === 'completed');
          setTripsHistory(completedTrips);
        })
        .catch(err => {
          console.error("Error fetching trip history:", err);
          toast({
            variant: "destructive",
            title: "فشل تحميل سجل الرحلات",
            description: "يرجى المحاولة مرة أخرى"
          });
        });
    }
  }, [isHistoryOpen, userProfile.phone, toast]);

  // استعادة الجلسة والبحث عن طلبات نشطة عند التحميل
  useEffect(() => {
    const savedUser = localStorage.getItem("sat7a_user");
    const sessionActive = localStorage.getItem("sat7a_session_active");
    const savedOrderId = localStorage.getItem("sat7a_active_order_id");

    if (savedUser && sessionActive === "true") { 
      const parsed = JSON.parse(savedUser);
      setUserProfile(parsed); 
      setIsLoggedIn(true); 
      if (parsed.phone && parsed.password) refreshUserData(parsed.phone, parsed.password);

      if (savedOrderId) {
        setActiveOrderId(Number(savedOrderId));
        setViewState("tracking");
      }
    }
  }, []);

  useEffect(() => {
    if (activeOrderId) {
      socket.emit("join_order", activeOrderId);
      localStorage.setItem("sat7a_active_order_id", activeOrderId.toString());

      const handleStatusChange = (data: any) => {
        if (data.status) {
          setRequestStatus(data.status);

          if (data.status === "accepted" || data.driverInfo || data.status === "arrived" || data.status === "picked_up") {
            setViewState("tracking");
            const info = data.driverInfo || data;
            setDriverInfo({
              id: info.driverId || info.id,
              name: info.username || info.name || info.driverName || "كابتن سطحة",
              phone: info.phone || info.driverPhone || "07XXXXXXXXX",
              avatarUrl: info.avatarUrl || info.driverAvatar || "",
              vehicleType: info.vehicleType || "سطحة هيدروليك",
              plateNumber: info.plateNumber || "أربيل - 12345"
            });

            if (info.lat && info.lng) {
              setDriverLocation([Number(info.lat), Number(info.lng)]);
            }

            if (data.status === "accepted") {
                toast({ 
                  title: "✅ تم قبول طلبك", 
                  description: `الكابتن ${info.username || info.name || 'قادم'} في الطريق إليك`,
                  className: "bg-green-600 text-white font-black rounded-2xl shadow-2xl border-none"
                });
            }
          }

          if (data.status === "completed") {
            toast({ title: "وصلت بالسلامة", description: "تم إكمال الطلب بنجاح" });
            localStorage.removeItem("sat7a_active_order_id");
            // إعادة التوجيه الفوري إلى صفحة Booking عند الاستكمال
            setViewState("booking");
            setActiveOrderId(null);
            setDriverInfo(null);
            setRequestStatus("pending");
            setMessages([]);
            setDriverLocation(null);
          }
        }
      };

      socket.on("status_changed", handleStatusChange);
      socket.on(`order_status_${activeOrderId}`, handleStatusChange);

      socket.on("driver_location_update", (data: any) => {
          if (Number(data.orderId) === Number(activeOrderId)) {
              setDriverLocation([Number(data.lat), Number(data.lng)]);
              if (data.heading !== undefined) setDriverHeading(data.heading);
          }
      });
      
      // CRITICAL FIX: Handle order deletion by admin
      socket.on("order_deleted_by_admin", (data: any) => {
        console.log("[Customer] Order deleted by admin:", data);
        localStorage.removeItem("sat7a_active_order_id");
        setViewState("booking");
        setActiveOrderId(null);
        setDriverInfo(null);
        setRequestStatus("pending");
        setMessages([]);
        setDriverLocation(null);
        toast({ 
          variant: "destructive",
          title: "تم إلغاء الطلب", 
          description: data.message || "تم إلغاء طلبك من قبل الإدارة" 
        });
      });

      return () => {
        socket.off("status_changed", handleStatusChange);
        socket.off(`order_status_${activeOrderId}`, handleStatusChange);
        socket.off("driver_location_update");
        socket.off("order_deleted_by_admin");
      };
    }
  }, [activeOrderId, toast]);

  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      if (Number(msg.orderId) === Number(activeOrderId)) {
        setMessages(prev => {
          const exists = prev.find(m => m.id === msg.id);
          if (exists) return prev;
          return [...prev, {
            id: msg.id,
            orderId: msg.orderId,
            content: msg.content || msg.message,
            senderId: msg.senderId,
            senderType: msg.senderType,
            senderName: msg.senderName,
            createdAt: msg.createdAt,
            timestamp: msg.createdAt
          }];
        });
        if (!isChatOpen) setUnreadCount(prev => prev + 1);
        setTimeout(scrollChatToBottom, 100);
      }
    };

    socket.on("new_message", handleNewMessage);
    
    return () => { 
      socket.off("new_message", handleNewMessage);
    };
  }, [isChatOpen, activeOrderId]);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !activeOrderId) return;

    const payload = {
      orderId: activeOrderId,
      message: chatMessage,
      senderId: userProfile.id,
      senderType: 'customer',
      senderName: userProfile.username
    };

    socket.emit("send_message", payload);
    setChatMessage("");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userProfile.username,
          phone: userProfile.phone,
          password: userProfile.password,
          city: normalizeCity(formData.city)
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "فشل التسجيل");

      const completeProfile = { ...userProfile, id: data.id, wallet: data.walletBalance?.toString() || "0", address: normalizeCity(formData.city) };
      setUserProfile(completeProfile);
      localStorage.setItem("sat7a_user", JSON.stringify(completeProfile));
      localStorage.setItem("sat7a_session_active", "true");
      setIsLoggedIn(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: userProfile.phone, password: userProfile.password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "بيانات الدخول غير صحيحة");

      const completeProfile = { 
        ...userProfile, 
        id: data.id, 
        username: data.username || data.name,
        wallet: data.walletBalance?.toString() || "0",
        trips: data.tripsCount?.toString() || "0"
      };
      setUserProfile(completeProfile);
      localStorage.setItem("sat7a_user", JSON.stringify(completeProfile));
      localStorage.setItem("sat7a_session_active", "true");
      setIsLoggedIn(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل الدخول", description: err.message });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sat7a_session_active");
    localStorage.removeItem("sat7a_active_order_id");
    setIsLoggedIn(false); 
    setAuthMode("choice");
    setActiveOrderId(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setUserProfile(prev => {
           const updated = { ...prev, image: base64 };
           localStorage.setItem("sat7a_user", JSON.stringify(updated));
           return updated;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const searchLocation = async (query: string) => {
    if (query.length < 3) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=iq`);
      const data = await res.json(); 
      setSearchResults(data);
    } catch (error) { console.error(error); } finally { setIsSearching(false); }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      const data = await res.json();
      if (data.address) {
        const detectedCity = data.address.state || data.address.city || data.address.province || data.address.governorate || "بابل";
        const locationName = data.display_name.split(',')[0];
        setFormData(prev => ({ 
          ...prev, 
          city: normalizeCity(detectedCity),
          ...(step === "pickup" ? { location: locationName } : { destination: locationName })
        }));
      }
    } catch (err) {
      console.error("فشل في تحديد العنوان:", err);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setShouldFly(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      if (step === "pickup") {
        setFormData(p => ({ ...p, pickupLat: latitude, pickupLng: longitude }));
        reverseGeocode(latitude, longitude); 
      }
      else {
        setFormData(p => ({ ...p, destLat: latitude, destLng: longitude }));
        reverseGeocode(latitude, longitude);
      }
      setTimeout(() => setShouldFly(false), 2000);
    });
  };

  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat); 
    const lon = parseFloat(result.lon);
    const resultCity = result.address?.state || result.address?.city || result.address?.province || result.address?.governorate || "بابل";

    setShouldFly(true);
    if (step === "pickup") {
      setFormData(p => ({ ...p, pickupLat: lat, pickupLng: lon, location: result.display_name.split(',')[0], city: normalizeCity(resultCity) }));
    } else {
      setFormData(p => ({ ...p, destLat: lat, destLng: lon, destination: result.display_name.split(',')[0] }));
    }
    setIsSearchOpen(false); 
    setTimeout(() => setShouldFly(false), 2000);
  };

  const handleTopUp = async (method: string) => {
    if (method === "Zain Cash") {
      if (!chargeAmount || Number(chargeAmount) < 1000) {
        toast({ variant: "destructive", title: "المبلغ غير صالح", description: "الحد الأدنى للشحن عبر زين كاش هو 1000 د.ع" });
        return;
      }
      setIsCharging(true);
      try {
        const response = await fetch("/api/zaincash/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(chargeAmount),
            userId: userProfile.id,
            userName: userProfile.username,
            userType: "customer"
          }),
        });
        const data = await response.json();
        if (data.url) { window.location.href = data.url; } 
        else { throw new Error(data.message || "لم يتم استلام رابط الدفع"); }
      } catch (err: any) {
        toast({ variant: "destructive", title: "فشل الاتصال بزين كاش", description: err.message });
      } finally { setIsCharging(false); }
    } else {
      toast({ title: "قريباً", description: `بوابة ${method} ستتوفر قريباً.` });
    }
  };

  const handleFinalOrder = async () => {
    if (!userProfile.id) {
      toast({ title: "تنبيه", description: "يرجى تسجيل الدخول مجدداً لإتمام عملية الطلب." });
      setIsLoggedIn(false); setAuthMode("login"); return;
    }

    const numericPrice = parseFloat(formData.price.replace(/[^\d]/g, '')) || 0;
    if (paymentMethod === "wallet" && parseFloat(userProfile.wallet) < numericPrice) {
      toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "يرجى شحن محفظتك أو اختيار الدفع النقدي." });
      return;
    }

    try {
      const orderPayload = {
        customerName: userProfile.username || "زبون",
        customerPhone: userProfile.phone || "0000",
        location: formData.location || "موقعي الحالي",
        destination: formData.destination || "وجهة غير محددة",
        pickupLat: Number(formData.pickupLat), 
        pickupLng: Number(formData.pickupLng),
        destLat: Number(formData.destLat),
        destLng: Number(formData.destLng),
        vehicleType: formData.vehicleType,
        price: numericPrice, 
        city: normalizeCity(formData.city), 
        paymentMethod: paymentMethod,
        status: "pending",
        customerId: userProfile.id
      };

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "فشل في إرسال الطلب");

      socket.emit("new_request_created", { ...orderPayload, id: result.id });
      setActiveOrderId(result.id); 
      setViewState("success");
    } catch (err: any) { 
      toast({ variant: "destructive", title: "خطأ في الطلب", description: err.message });
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-white flex flex-col p-6 relative overflow-hidden font-sans" dir="rtl">
        <motion.button 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          onClick={() => setLocation("/")}
          className="absolute top-8 right-8 z-[50] bg-white p-3 px-5 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all text-gray-900 font-black"
        >
          <Home className="w-5 h-5 text-orange-500" />
          <span className="text-sm">الرئيسية</span>
        </motion.button>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-orange-500 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3 shadow-orange-200">
              <Truck className="text-white w-10 h-10" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter">
              {authMode === "choice" ? "أهلاً بك" : authMode === "signup" ? "كُن عضواً" : "عودة حميدة"}
            </h2>
            <p className="text-gray-400 font-bold mt-2">تطبيق سطحة لخدمتك أينما كنت</p>
          </div>

          {authMode === "choice" && (
            <div className="space-y-4">
              <Button onClick={() => setAuthMode("signup")} className="w-full h-20 bg-orange-500 hover:bg-orange-600 rounded-[30px] text-2xl font-black shadow-xl shadow-orange-100 transition-all">أنا زبون جديد</Button>
              <Button onClick={() => setAuthMode("login")} variant="ghost" className="w-full h-20 rounded-[30px] text-xl font-black bg-gray-50 text-gray-600 border-2 border-transparent hover:border-gray-200">تسجيل دخول</Button>
            </div>
          )}

          {(authMode === "signup" || authMode === "login") && (
            <form onSubmit={authMode === "signup" ? handleSignUp : handleLogin} className="space-y-4">
              {authMode === "signup" && (
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => handleImageChange(e as any);
                        input.click();
                      }}
                      className="w-24 h-24 bg-gray-50 rounded-[35px] border-4 border-white flex items-center justify-center overflow-hidden shadow-2xl ring-2 ring-orange-100 cursor-pointer hover:ring-orange-300 transition-all"
                    >
                      {userProfile.image ? <img src={userProfile.image} className="w-full h-full object-cover" /> : <User className="text-orange-200 w-10 h-10" />}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-black text-white p-2 rounded-xl shadow-lg border-2 border-white pointer-events-none">
                      <Camera className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 font-bold">اضغط لتحميل صورة</p>
                </div>
              )}
              <div className="bg-white rounded-[35px] p-6 shadow-[0_10_40px_rgba(0,0,0,0.04)] border border-gray-50 space-y-4">
                {authMode === "signup" && (
                  <div className="bg-gray-50 rounded-2xl p-3 px-5 flex items-center justify-between group focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 mb-1">الاسم الكامل</p>
                      <input required placeholder="أدخل اسمك" className="bg-transparent border-none outline-none w-full font-black text-gray-700 text-right" value={userProfile.username} onChange={e => setUserProfile({...userProfile, username: e.target.value})} />
                    </div>
                    <User className="text-orange-500 w-5 h-5 mr-3" />
                  </div>
                )}
                <div className="bg-gray-50 rounded-2xl p-3 px-5 flex items-center justify-between focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 mb-1">رقم الهاتف</p>
                    <input required type="tel" placeholder="07XXXXXXXXX" className="bg-transparent border-none outline-none w-full font-black text-gray-700 text-right" value={userProfile.phone} onChange={e => setUserProfile({...userProfile, phone: e.target.value})} />
                  </div>
                  <Phone className="text-orange-500 w-5 h-5 mr-3" />
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 px-5 flex items-center justify-between focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 mb-1">كلمة السر</p>
                    <input required type="password" placeholder="••••••••" className="bg-transparent border-none outline-none w-full font-black text-gray-700 text-right" value={userProfile.password} onChange={e => setUserProfile({...userProfile, password: e.target.value})} />
                  </div>
                  <Lock className="text-orange-500 w-5 h-5 mr-3" />
                </div>
              </div>
              <Button type="submit" className="w-full h-18 bg-gray-900 hover:bg-black text-white rounded-[25px] font-black text-xl mt-4 shadow-2xl transition-all active:scale-95">
                {authMode === "signup" ? "تأكيد وإنشاء" : "دخول مباشر"}
              </Button>
              <button type="button" onClick={() => setAuthMode("choice")} className="w-full text-center text-gray-400 font-black text-xs mt-4 hover:text-orange-500">إلغاء والعودة</button>
            </form>
          )}
        </motion.div>
        <div className="mt-auto text-center pb-4">
           <p className="text-[10px] font-black text-gray-300 flex items-center justify-center gap-2 tracking-widest uppercase">
             <ShieldCheck className="w-3 h-3" /> نظام حماية البيانات 2026
           </p>
        </div>
      </div>
    );
  }

  if (viewState === "success") return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center" dir="rtl">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
        <div className="w-32 h-32 bg-orange-500 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl rotate-12"><Check className="w-16 h-16 text-white" /></div>
        <div className="space-y-2">
            <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter">تم الإرسال!</h2>
            <p className="text-gray-400 font-bold">طلبك الآن متاح لجميع السائقين القريبين</p>
            <p className="text-orange-500 font-black">طريقة الدفع: {paymentMethod === "wallet" ? "المحفظة" : "نقدي"}</p>
        </div>
        <Button onClick={() => setViewState("tracking")} className="w-full h-16 bg-black text-white rounded-[24px] font-black text-xl shadow-2xl">تتبع الرحلة</Button>
      </motion.div>
    </div>
  );

  if (viewState === "tracking") return (
    <div className="h-screen w-full bg-slate-50 flex flex-col relative" dir="rtl">
        <div className="absolute inset-0 z-0">
            <MapContainer center={[formData.pickupLat, formData.pickupLng]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" detectRetina={true} tileSize={256}/>
                {driverLocation && <Marker position={driverLocation} icon={getOrangeArrowIcon(driverHeading)} />}
                <Marker position={[formData.pickupLat, formData.pickupLng]} />
                {/* خط الملاحة بين السائق والزبون باستخدام الطرق الفعلية */}
                {driverLocation && (
                  <RoutingPolyline 
                    start={driverLocation}
                    end={[formData.pickupLat, formData.pickupLng]} 
                    color="#f97316" 
                    weight={4} 
                    opacity={0.7}
                  />
                )}
                <FlyToMarker center={driverLocation || [formData.pickupLat, formData.pickupLng]} shouldFly={!!driverLocation} />
            </MapContainer>
        </div>
        <header className="absolute top-6 inset-x-6 z-[1000] flex justify-between items-center">
            <div className="w-12"></div>
            <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl shadow-xl font-black italic flex items-center gap-2"><Navigation className="w-4 h-4 animate-pulse" /> مباشر</div>
        </header>

        <AnimatePresence>
          {isChatOpen && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[7000] bg-white flex flex-col">
              <div className="p-6 border-b flex justify-between items-center bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center font-black text-orange-600 overflow-hidden">
                    {driverInfo?.avatarUrl ? <img src={driverInfo.avatarUrl} className="w-full h-full object-cover" /> : <User />}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800">{driverInfo?.name || "الكابتن"}</h4>
                    <p className="text-[10px] text-gray-400 font-bold">متصل الآن</p>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setIsChatOpen(false)} className="rounded-2xl"><X className="w-6 h-6"/></Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((msg, index) => (
                  <div key={msg.id || index} className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-4 rounded-2xl max-w-[80%] font-bold shadow-sm ${msg.senderType === 'customer' ? 'bg-orange-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}>
                      {msg.content || msg.text}
                      <p className={`text-[8px] mt-1 opacity-60 ${msg.senderType === 'customer' ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t flex gap-2 bg-white pb-10">
                <input 
                  type="text" 
                  value={chatMessage} 
                  onChange={(e) => setChatMessage(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="اكتب رسالة للكابتن..." 
                  className="flex-1 bg-gray-100 rounded-2xl px-5 text-right font-bold outline-none border-2 border-transparent focus:border-orange-200 transition-all"
                />
                <Button onClick={handleSendMessage} className="bg-orange-500 rounded-2xl w-14 h-14 shadow-lg shadow-orange-100"><Send className="w-5 h-5 rotate-180"/></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1000] p-6 pb-10">
            <div className="bg-white rounded-[40px] shadow-2xl p-6 border-t-4 border-orange-500">
                <div className="text-center space-y-6">
                     <div className="flex items-center justify-center gap-3">
                        {requestStatus === "pending" && <Loader2 className="w-6 h-6 animate-spin text-orange-500" />}
                        <h3 className="text-xl font-black text-gray-800 italic">
                          {requestStatus === "pending" ? "جاري البحث عن سائق..." : 
                           requestStatus === "accepted" ? "الكابتن قادم إليك" : 
                           requestStatus === "arrived" ? "الكابتن في الموقع" : "في الطريق للوجهة"}
                        </h3>
                     </div>
                     {driverInfo && (
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-[30px] border border-gray-100 shadow-inner">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md overflow-hidden border-2 border-white aspect-square shrink-0">
                              {driverInfo.avatarUrl ? (
                                <img 
                                  src={driverInfo.avatarUrl} 
                                  className="w-full h-full object-cover" 
                                  onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/147/147144.png" }} 
                                />
                              ) : (
                                <User className="text-orange-200 w-8 h-8" />
                              )}
                            </div>
                            <div className="flex-1 text-right min-w-0">
                                <h3 className="font-black text-base text-gray-800 leading-tight truncate">{driverInfo.name || "كابتن سطحة"}</h3>
                                <p className="text-[10px] font-bold text-gray-400 mb-1 truncate">{driverInfo.vehicleType || "سطحة"} • {driverInfo.plateNumber || "أربيل - 12345"}</p>
                                <div className="flex items-center gap-1 text-orange-500 text-[10px] font-black bg-orange-50 w-fit px-2 py-0.5 rounded-full"><Star className="w-2.5 h-2.5 fill-orange-500" /> 4.9 ممتاز</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} className="bg-green-500 rounded-2xl w-12 h-12 shadow-lg shadow-green-100 flex items-center justify-center relative active:scale-90 transition-transform">
                                  <MessageSquare className="w-5 h-5 text-white" />
                                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[20px] h-5 rounded-full flex items-center justify-center border-2 border-white font-black animate-bounce">{unreadCount}</span>}
                                </button>
                                <a href={`tel:${driverInfo.phone}`} className="bg-blue-500 rounded-2xl w-12 h-12 shadow-lg shadow-blue-100 flex items-center justify-center active:scale-90 transition-transform"><Phone className="w-5 h-5 text-white" /></a>
                            </div>
                        </div>
                     )}
                </div>
                
                {/* Cancel Trip Button - Professional Design at Bottom */}
                <div className="fixed bottom-0 inset-x-0 p-6 bg-white/95 backdrop-blur-md border-t border-gray-100 z-[2000]">
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full h-16 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-[24px] font-black text-lg shadow-2xl shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <X className="w-6 h-6" />
                    إلغاء الطلب
                  </button>
                </div>
            </div>
        </motion.div>
    </div>
  );

  // Professional Cancel Confirmation Modal
  const handleCancelTrip = async () => {
    try {
      if (!activeOrderId) return;
      
      // Call DELETE endpoint to properly remove order
      const response = await fetch(`/api/requests/${activeOrderId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("فشل في إلغاء الطلب");
      }
      
      // Clear local state
      localStorage.removeItem("sat7a_active_order_id");
      setViewState("booking");
      setActiveOrderId(null);
      setDriverInfo(null);
      setRequestStatus("pending");
      setMessages([]);
      setDriverLocation(null);
      setShowCancelModal(false);
      
      toast({
        title: "تم إلغاء الطلب بنجاح",
        description: "يمكنك إنشاء طلب جديد الآن",
        className: "bg-green-600 text-white"
      });
    } catch (error) {
      console.error("Cancel trip error:", error);
      toast({
        variant: "destructive",
        title: "خطأ في الإلغاء",
        description: "حاول مرة أخرى"
      });
    }
  };

  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative" dir="rtl">
      <header className="absolute top-0 inset-x-0 z-[4000] p-6 flex flex-col gap-3">
          <div className="flex items-start gap-3 w-full">
              <Sheet>
                <SheetTrigger asChild><Button variant="secondary" size="icon" className="rounded-2xl shadow-xl bg-white text-black w-14 h-14 border-none hover:bg-gray-50"><Menu className="w-6 h-6" /></Button></SheetTrigger>
                <SheetContent side="right" className="w-[85%] p-0 z-[6000] border-none text-right flex flex-col bg-white">
                    <div className="p-8 pt-20 bg-orange-500 text-right rounded-bl-[60px] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"><Truck className="w-64 h-64 -rotate-12 absolute -right-10 -bottom-10" /></div>
                        <div className="relative group w-24 h-24 mb-6">
                            <div className="w-24 h-24 bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-white/20 flex items-center justify-center">
                                {userProfile.image ? <img src={userProfile.image} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-4xl">👤</span>}
                            </div>
                            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-xl shadow-lg active:scale-90 transition-transform"><Camera className="w-4 h-4" /></button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight">{userProfile.username || "مستخدم جديد"}</h2>
                        <p className="text-white/80 text-sm font-bold mt-1 italic">{userProfile.address || formData.city}</p>
                    </div>

                    <div className="p-6 pt-10 flex-1 overflow-y-auto">
                      <SidebarLink onClick={() => setIsHistoryOpen(true)} icon={<History className="w-5 h-5"/>} label="سجل الرحلات" extra={`${userProfile.trips} رحلة`} />
                      <SidebarLink onClick={() => setIsWalletOpen(true)} icon={<Wallet className="w-5 h-5"/>} label="المحفظة" extra={`${userProfile.wallet} د.ع`} color="text-green-600" extraColor="bg-green-50 text-green-700" />
                      <SidebarLink icon={<Star className="w-5 h-5"/>} label="التقييم" extra="4.9 ★" color="text-yellow-500" extraColor="bg-yellow-50 text-yellow-700" />
                      <SidebarLink icon={<Phone className="w-5 h-5"/>} label="الدعم الفني" color="text-blue-600" />
                    </div>

                    <div className="p-8 border-t border-gray-50">
                        <Button variant="ghost" className="w-full justify-start gap-4 text-red-500 font-black h-14 rounded-2xl hover:bg-red-50 transition-all" onClick={handleLogout}>
                            <div className="bg-red-50 p-2.5 rounded-xl"><LogOut className="w-5 h-5" /></div>
                            <span>تسجيل الخروج</span>
                        </Button>
                    </div>
                </SheetContent>
              </Sheet>

              <div onClick={() => step !== "vehicle" && setIsSearchOpen(true)} className="flex-1 bg-white shadow-2xl rounded-[28px] p-4 flex flex-col justify-center border border-white cursor-pointer transition-transform active:scale-95">
                <StepIndicator step={step} />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-gray-800 truncate">
                        {step === "pickup" ? (formData.location || "حدد موقع التحميل") : 
                         step === "dropoff" ? (formData.destination || "حدد وجهة التوصيل") : "اختر نوع السطحة"}
                    </span>
                    <Search className="w-5 h-5 text-orange-500" />
                </div>
              </div>
          </div>
      </header>

      <div className="flex-1 relative z-0 flex flex-col">
        {(step === "pickup" || step === "dropoff") && (
          <div className="flex-1 relative">
            <MapContainer center={[formData.pickupLat, formData.pickupLng]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" detectRetina={true} tileSize={256}/>
              <FlyToMarker center={step === "pickup" ? [formData.pickupLat, formData.pickupLng] : [formData.destLat, formData.destLng]} shouldFly={shouldFly} />
              <MapEventsHandler onMove={(center) => {
                 setShouldFly(false);
                 if (step === "pickup") {
                   setFormData(prev => ({...prev, pickupLat: center.lat, pickupLng: center.lng}));
                   reverseGeocode(center.lat, center.lng); 
                 } else {
                   setFormData(prev => ({...prev, destLat: center.lat, destLng: center.lng}));
                   reverseGeocode(center.lat, center.lng);
                 }
              }} />
            </MapContainer>
            <Button onClick={handleGetCurrentLocation} className="absolute bottom-40 right-6 z-[1000] w-14 h-14 rounded-2xl bg-white text-orange-500 shadow-2xl border-none active:scale-90 transition-transform"><Target className="w-7 h-7" /></Button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                <div className="flex flex-col items-center -mt-12">
                    <div className={`px-5 py-2 rounded-2xl text-white text-xs font-black mb-2 shadow-2xl ${step === "pickup" ? "bg-orange-500" : "bg-black"}`}>{step === "pickup" ? "تحميل من هنا" : "توصيل لهنا"}</div>
                    <div className={`w-1.5 h-8 ${step === "pickup" ? "bg-orange-500" : "bg-black"} rounded-full shadow-lg`}></div>
                </div>
            </div>
          </div>
        )}

        {step === "vehicle" && (
          <div className="absolute inset-0 z-10 bg-gray-50 overflow-y-auto px-4 pt-28 scroll-smooth" style={{ height: '100%' }}>
            <h3 className="font-black text-gray-800 text-lg pr-2 mb-4">اختر السطحة المناسبة</h3>
            <div className="space-y-4">
              {VEHICLE_OPTIONS.map((opt) => (
                <div key={opt.id} onClick={() => setFormData(p => ({...p, vehicleType: opt.id, price: opt.price.toString()}))}
                     className={`p-4 rounded-[28px] border-2 transition-all flex justify-between items-center ${formData.vehicleType === opt.id ? 'bg-orange-500 border-orange-500 text-white shadow-lg scale-[1.01]' : 'bg-white border-transparent shadow-sm hover:border-orange-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${formData.vehicleType === opt.id ? 'bg-white/20' : 'bg-orange-50 text-orange-500'}`}><Truck className="w-6 h-6" /></div>
                        <div><h4 className="font-black text-base">{opt.label}</h4><p className="text-[10px] opacity-80">تصل خلال 10 دقائق</p></div>
                    </div>
                    <span className="text-lg font-black">{opt.price} <span className="text-xs">د.ع</span></span>
                </div>
              ))}
              <div className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-100 space-y-3 mt-4">
                  <h4 className="font-black text-gray-800 text-xs">طريقة الدفع</h4>
                  <div className="flex gap-2">
                      <button onClick={() => setPaymentMethod("cash")} className={`flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${paymentMethod === "cash" ? "bg-black text-white shadow-md" : "bg-gray-50 text-gray-400"}`}>
                          <RotateCcw className="w-4 h-4" /> كاش
                      </button>
                      <button onClick={() => setPaymentMethod("wallet")} className={`flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${paymentMethod === "wallet" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-400"}`}>
                          <Wallet className="w-4 h-4" /> المحفظة
                      </button>
                  </div>
              </div>
            </div>
            <div className="h-[220px] w-full"></div>
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 inset-x-0 bg-white p-8 pb-10 rounded-t-[45px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] z-[5000] border-t border-gray-100">
          <Button onClick={() => { if (step === "pickup") setStep("dropoff"); else if (step === "dropoff") setStep("vehicle"); else handleFinalOrder(); }}
            disabled={step === "vehicle" && !formData.vehicleType} className={`w-full h-18 rounded-[28px] font-black text-xl transition-all shadow-xl ${step === "vehicle" ? "bg-orange-500 text-white" : "bg-black text-white"}`}>
            {step === "vehicle" ? "تأكيد الطلب الآن" : "تأكيد الموقع"}
          </Button>
          {step !== "pickup" && (
            <button onClick={() => setStep(step === "dropoff" ? "pickup" : "dropoff")} className="w-full mt-5 text-gray-400 font-black text-xs flex items-center justify-center gap-2 hover:text-orange-500 transition-colors"><RotateCcw className="w-3 h-3" /> رجوع للخطوة السابقة</button>
          )}
      </footer>

      <AnimatePresence>
          {isSearchOpen && (
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-0 z-[9999] bg-white p-6 flex flex-col">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" onClick={() => setIsSearchOpen(false)} className="rounded-2xl bg-gray-50"><X className="w-6 h-6" /></Button>
                    <h3 className="font-black text-xl">البحث عن موقع</h3>
                </div>
                <div className="bg-gray-50 rounded-[28px] p-4 border border-gray-100 flex items-center gap-3 mb-6">
                    <Search className="w-6 h-6 text-gray-400" />
                    <input autoFocus placeholder="ادخل اسم المنطقة..." className="bg-transparent border-none outline-none w-full font-bold text-right" onChange={(e) => searchLocation(e.target.value)} />
                    {isSearching && <Loader2 className="animate-spin text-orange-500" />}
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                    {searchResults.map((res, i) => (
                        <div key={i} onClick={() => handleSelectResult(res)} className="flex items-center gap-4 p-4 hover:bg-orange-50 rounded-2xl cursor-pointer">
                            <div className="bg-white p-2 rounded-xl shadow-sm"><MapPin className="w-5 h-5 text-orange-500" /></div>
                            <div className="flex-1 truncate text-right">
                                <h4 className="font-bold text-gray-700 truncate">{res.display_name.split(',')[0]}</h4>
                                <p className="text-[10px] text-gray-400 truncate">{res.display_name}</p>
                            </div>
                        </div>
                    ))}
                </div>
              </motion.div>
          )}

          {isHistoryOpen && (
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute inset-0 z-[9000] bg-white flex flex-col">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="font-black text-xl">سجل الرحلات</h3>
                <Button variant="ghost" onClick={() => setIsHistoryOpen(false)} className="rounded-2xl"><X /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {tripsHistory.length > 0 ? tripsHistory.map((trip) => (
                  <div key={trip.id} className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-100">
                    <div className="flex justify-between mb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <span>رقم الرحلة #{trip.id}</span>
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded-lg">مكتملة</span>
                    </div>
                    <div className="space-y-3 relative">
                        <div className="flex items-center gap-3 font-bold text-sm"><MapPin className="text-orange-500 w-4 h-4"/> {trip.pickupLocation}</div>
                        <div className="flex items-center gap-3 font-bold text-sm"><Target className="text-black w-4 h-4"/> {trip.destination}</div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center font-black">
                        <span className="text-orange-600">{trip.price} د.ع</span>
                        <span className="text-gray-300 text-[10px]">{new Date(trip.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )) : <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-black">لا توجد رحلات سابقة</div>}
              </div>
            </motion.div>
          )}

          {isWalletOpen && (
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} className="absolute inset-0 z-[9000] bg-white flex flex-col overflow-hidden">
               <div className="relative bg-gradient-to-br from-orange-500 to-orange-400 rounded-b-[45px] p-6 pt-10 shadow-lg overflow-hidden z-20">
                  <Truck className="absolute -right-10 -bottom-10 w-48 h-48 text-white/10 -rotate-12 pointer-events-none" />
                  <div className="relative z-30 flex justify-between items-center">
                    <div>
                      <p className="text-orange-50 font-black text-xs mb-0.5 tracking-wide opacity-90">الرصيد المتاح</p>
                      <h2 className="text-4xl font-black text-white tracking-tighter italic">{userProfile.wallet} <span className="text-xl text-orange-100 not-italic">د.ع</span></h2>
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsWalletOpen(false)} className="bg-white/20 hover:bg-white/30 text-white rounded-2xl w-10 h-10 flex items-center justify-center backdrop-blur-md shadow-lg border border-white/20">
                        <X className="w-5 h-5" />
                    </motion.button>
                  </div>
               </div>
               <div className="flex-1 p-6 -mt-5 overflow-y-auto space-y-6 bg-white rounded-t-[35px] z-10 relative">
                  <div className="space-y-4">
                    <h4 className="font-black text-slate-800 text-sm flex items-center gap-2 px-1"><Wallet className="w-4 h-4 text-orange-500"/> تعبئة الرصيد</h4>
                    <div className="relative group">
                      <input type="number" inputMode="numeric" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="أدخل مبلغ الشحن بالدينار..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pr-12 pl-4 font-black text-base outline-none focus:border-orange-500 focus:bg-white transition-all shadow-sm group-hover:border-orange-200" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs pointer-events-none">د.ع</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <motion.button whileTap={{ scale: 0.96 }} disabled={isCharging} onClick={() => handleTopUp("Zain Cash")} className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-[28px] border-2 border-slate-50 hover:border-orange-500 shadow-sm hover:shadow-md transition-all">
                           <div className="w-12 h-12 flex items-center justify-center">{isCharging ? <Loader2 className="animate-spin text-orange-500 w-5 h-5"/> : <QrCode className="text-orange-500 w-8 h-8" />}</div>
                           <span className="font-black text-xs text-slate-700">زين كاش</span>
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleTopUp("MasterCard")} className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-[28px] border-2 border-slate-50 hover:border-orange-500 shadow-sm hover:shadow-md transition-all">
                           <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center"><CreditCard className="text-slate-600 w-6 h-6" /></div>
                           <span className="font-black text-xs text-slate-700">ماستر كارد</span>
                        </motion.button>
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 flex gap-3 items-center backdrop-blur-sm">
                    <div className="bg-orange-100 p-2 rounded-lg shrink-0"><ShieldCheck className="w-5 h-5 text-orange-500" /></div>
                    <div><h5 className="font-black text-orange-700 text-[11px] mb-0.5">عملية آمنة وموثوقة</h5><p className="text-[10px] text-orange-600 leading-tight font-bold opacity-80">سيتم تحديث رصيدك فور نجاح عملية الدفع.</p></div>
                  </div>
               </div>
            </motion.div>
          )}
          
          {/* Professional Cancel Confirmation Modal */}
          {showCancelModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[40px] shadow-2xl max-w-md w-full p-8 relative overflow-hidden"
              >
                {/* Decorative gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 opacity-50" />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-200">
                    <X className="w-10 h-10 text-white" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-2xl font-black text-center text-gray-900 mb-3">
                    إلغاء الرحلة؟
                  </h3>
                  
                  {/* Description */}
                  <p className="text-center text-gray-600 font-bold text-sm leading-relaxed mb-8">
                    هل أنت متأكد من إلغاء هذا الطلب؟ سيتم حذف الطلب نهائياً ولن يتم إشعار السائق.
                  </p>
                  
                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelTrip}
                      className="flex-1 h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-[20px] font-black text-base shadow-lg shadow-red-200 transition-all active:scale-95"
                    >
                      موافق، ألغِ الرحلة
                    </button>
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="flex-1 h-14 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-[20px] font-black text-base transition-all active:scale-95"
                    >
                      لا، لا تلغِ
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

function MapEventsHandler({ onMove }: { onMove: (center: L.LatLng) => void }) {
  const map = useMapEvents({ moveend: () => onMove(map.getCenter()) });
  return null;
}
