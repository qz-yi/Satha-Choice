import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { 
  MapPin, Check, Search, Loader2, Menu, 
  MessageSquare, History, Wallet, Phone, Truck, ChevronRight,
  LocateFixed, RotateCcw, X, Star, Navigation, Target, Send, LogOut, Camera, User, Lock, Home
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MapContainer, TileLayer, useMapEvents, Marker, useMap, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { io } from "socket.io-client";

const socket = io("http://192.168.0.104:3000");

// --- Helper Components & Icons ---
const getOrangeArrowIcon = (rotation: number) => L.divIcon({
  html: `
    <div style="transform: rotate(${rotation}deg); transition: transform 0.4s; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.3));">
      <svg width="45" height="45" viewBox="0 0 100 100" fill="none">
        <path d="M50 5L92 90L50 72L8 90L50 5Z" fill="#f97316" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>`,
  className: "", iconSize: [45, 45], iconAnchor: [22.5, 22.5], 
});

function FlyToMarker({ center, shouldFly }: { center: [number, number], shouldFly: boolean }) {
  const map = useMap();
  useEffect(() => { if (shouldFly) map.flyTo(center, 16, { duration: 1.5 }); }, [center, map, shouldFly]);
  return null;
}

const SidebarLink = memo(({ icon, label, extra, onClick, color = "text-orange-600" }: any) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-orange-50 active:scale-[0.98] transition-all rounded-2xl text-right group mb-2">
    <div className="flex items-center gap-4">
      <div className={`${color} p-2 rounded-xl bg-gray-50 group-hover:bg-white transition-colors shadow-sm`}>{icon}</div>
      <span className="text-[15px] font-black text-gray-700">{label}</span>
    </div>
    {extra && <span className="text-xs font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{extra}</span>}
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
  // --- Auth & Profile State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"choice" | "login" | "signup">("choice");
  const [userProfile, setUserProfile] = useState({
    name: "",
    phone: "",
    password: "",
    address: "",
    image: null as string | null,
    wallet: "0",
    trips: "0"
  });

  // --- Main App States ---
  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [viewState, setViewState] = useState<"booking" | "success" | "tracking">("booking");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [shouldFly, setShouldFly] = useState(false); 
  const [requestStatus, setRequestStatus] = useState("pending");
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    location: "", destination: "",
    pickupLat: 33.3152, pickupLng: 44.3661,
    destLat: 33.3152, destLng: 44.3661,
    vehicleType: "", price: "", timeMode: "now" as "now" | "later",
  });

  // --- Load Saved Session ---
  useEffect(() => {
    const saved = localStorage.getItem("sat7a_user");
    if (saved) {
      setUserProfile(JSON.parse(saved));
      setIsLoggedIn(true);
    }
  }, []);

  // --- Socket Listeners ---
  useEffect(() => {
    socket.on("receive_location", (data) => {
        setDriverLocation([data.lat, data.lng]);
        if (data.heading) setDriverHeading(parseFloat(data.heading));
    });
    socket.on("order_accepted", () => { setRequestStatus("heading_to_pickup"); setViewState("tracking"); });
    socket.on("order_status_updated", (data) => setRequestStatus(data.status));
    socket.on("receive_message", (msg: any) => {
        setMessages(prev => [...prev, { ...msg, id: Date.now() }]);
        if (!isChatOpen) setUnreadCount(prev => prev + 1);
    });
    return () => { 
        socket.off("receive_location"); socket.off("order_accepted");
        socket.off("order_status_updated"); socket.off("receive_message");
    };
  }, [isChatOpen]);

  // --- Auth Handlers ---
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("sat7a_user", JSON.stringify(userProfile));
    setIsLoggedIn(true);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = localStorage.getItem("sat7a_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.phone === userProfile.phone && parsed.password === userProfile.password) {
        setUserProfile(parsed);
        setIsLoggedIn(true);
      } else {
        alert("خطأ في الرقم أو كلمة السر");
      }
    } else {
      alert("الحساب غير موجود، يرجى إنشاء حساب جديد");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sat7a_user");
    setIsLoggedIn(false);
    setAuthMode("choice");
    window.location.reload();
  };

  // --- Map & Logic Handlers ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUserProfile(prev => ({ ...prev, image: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const searchLocation = async (query: string) => {
    if (query.length < 3) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=iq`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) { console.error(error); } finally { setIsSearching(false); }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setShouldFly(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      if (step === "pickup") setFormData(p => ({ ...p, pickupLat: latitude, pickupLng: longitude }));
      else setFormData(p => ({ ...p, destLat: latitude, destLng: longitude }));
      setTimeout(() => setShouldFly(false), 2000);
    });
  };

  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setShouldFly(true);
    if (step === "pickup") setFormData(p => ({ ...p, pickupLat: lat, pickupLng: lon, location: result.display_name.split(',')[0] }));
    else setFormData(p => ({ ...p, destLat: lat, destLng: lon, destination: result.display_name.split(',')[0] }));
    setIsSearchOpen(false);
    setTimeout(() => setShouldFly(false), 2000);
  };

  // --- Rendering Conditional Logic ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3">
            <Truck className="text-white w-10 h-10" />
          </div>

          {authMode === "choice" && (
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-gray-900 italic text-center">أهلاً بك في سطحة</h2>
              <div className="space-y-4">
                <Button onClick={() => setAuthMode("signup")} className="w-full h-16 bg-orange-500 rounded-2xl text-xl font-black shadow-lg">أنا زبون جديد</Button>
                <Button onClick={() => setAuthMode("login")} variant="outline" className="w-full h-16 rounded-2xl text-lg font-black border-2 border-gray-100">تسجيل دخول</Button>
              </div>
            </div>
          )}

          {(authMode === "signup" || authMode === "login") && (
            <form onSubmit={authMode === "signup" ? handleSignUp : handleLogin} className="space-y-4">
              <h3 className="text-2xl font-black mb-6">{authMode === "signup" ? "إنشاء حساب زبون" : "مرحباً بعودتك"}</h3>
              
              {authMode === "signup" && (
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 bg-gray-50 rounded-[32px] border-2 border-dashed border-orange-300 flex items-center justify-center overflow-hidden relative group">
                    {userProfile.image ? <img src={userProfile.image} className="w-full h-full object-cover" /> : <Camera className="text-orange-400" />}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageChange} />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 mt-2">اضف صورتك الشخصية</span>
                </div>
              )}

              <div className="space-y-3">
                {authMode === "signup" && (
                  <div className="relative">
                    <User className="absolute right-4 top-4 text-gray-400 w-5 h-5" />
                    <input required placeholder="الاسم الكامل" className="w-full h-14 bg-gray-50 rounded-2xl pr-12 font-bold outline-none border border-transparent focus:border-orange-500 transition-all" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} />
                  </div>
                )}
                <div className="relative">
                  <Phone className="absolute right-4 top-4 text-gray-400 w-5 h-5" />
                  <input required type="tel" placeholder="رقم الهاتف" className="w-full h-14 bg-gray-50 rounded-2xl pr-12 font-bold outline-none border border-transparent focus:border-orange-500 transition-all" value={userProfile.phone} onChange={e => setUserProfile({...userProfile, phone: e.target.value})} />
                </div>
                <div className="relative">
                  <Lock className="absolute right-4 top-4 text-gray-400 w-5 h-5" />
                  <input required type="password" placeholder="كلمة السر" className="w-full h-14 bg-gray-50 rounded-2xl pr-12 font-bold outline-none border border-transparent focus:border-orange-500 transition-all" value={userProfile.password} onChange={e => setUserProfile({...userProfile, password: e.target.value})} />
                </div>
                {authMode === "signup" && (
                  <div className="relative">
                    <Home className="absolute right-4 top-4 text-gray-400 w-5 h-5" />
                    <input required placeholder="عنوانك الحالي" className="w-full h-14 bg-gray-50 rounded-2xl pr-12 font-bold outline-none border border-transparent focus:border-orange-500 transition-all" value={userProfile.address} onChange={e => setUserProfile({...userProfile, address: e.target.value})} />
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full h-16 bg-black text-white rounded-2xl font-black mt-6 shadow-xl active:scale-95 transition-transform">
                {authMode === "signup" ? "تأكيد وإنشاء الحساب" : "دخول"}
              </Button>
              <button type="button" onClick={() => setAuthMode("choice")} className="w-full text-center text-gray-400 font-bold text-sm mt-4">رجوع</button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  // --- Main Customer Interface ---
  if (viewState === "success") return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center" dir="rtl">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
        <div className="w-32 h-32 bg-orange-500 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl rotate-12"><Check className="w-16 h-16 text-white" /></div>
        <div className="space-y-2">
            <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter">تم الإرسال!</h2>
            <p className="text-gray-400 font-bold">طلبك الآن متاح لجميع السائقين القريبين</p>
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
                <FlyToMarker center={driverLocation || [formData.pickupLat, formData.pickupLng]} shouldFly={!!driverLocation} />
            </MapContainer>
        </div>
        {/* Tracking Header */}
        <header className="absolute top-6 inset-x-6 z-[1000] flex justify-between items-center">
            <Button onClick={() => setViewState("booking")} className="bg-white/90 backdrop-blur-md text-black rounded-2xl w-12 h-12 shadow-xl border-none"><X className="w-5 h-5" /></Button>
            <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl shadow-xl font-black italic flex items-center gap-2"><Navigation className="w-4 h-4 animate-pulse" /> مباشر</div>
        </header>

        {/* Chat System */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[7000] bg-white flex flex-col">
              <div className="p-6 border-b flex justify-between items-center bg-white shadow-sm">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-600">ك</div><h4 className="font-black">دردشة مع الكابتن</h4></div>
                <Button variant="ghost" onClick={() => setIsChatOpen(false)}><X className="w-6 h-6"/></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`p-4 rounded-2xl max-w-[80%] font-bold shadow-sm ${msg.sender === 'customer' ? 'bg-orange-500 text-white rounded-bl-none' : 'bg-white text-gray-800 rounded-br-none'}`}>{msg.text}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t flex gap-2 bg-white">
                <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="اكتب رسالة..." className="flex-1 bg-gray-100 rounded-xl px-4 text-right font-bold outline-none"/>
                <Button onClick={() => {
                  if(!chatMessage.trim()) return;
                  const newMsg = { text: chatMessage, sender: 'customer', id: Date.now() };
                  socket.emit("send_message", { ...newMsg, orderId: activeOrderId });
                  setMessages([...messages, newMsg]); setChatMessage("");
                }} className="bg-orange-500 rounded-xl"><Send className="w-5 h-5 rotate-180"/></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Driver Tracking Info */}
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1000] p-6">
            <div className="bg-white rounded-[40px] shadow-2xl p-8 border-t-4 border-orange-500">
                <div className="text-center space-y-6">
                     <div className="flex items-center justify-center gap-3">
                        {requestStatus === "pending" && <Loader2 className="w-6 h-6 animate-spin text-orange-500" />}
                        <h3 className="text-2xl font-black text-gray-800 italic">جاري التتبع...</h3>
                     </div>
                     {requestStatus !== "pending" && (
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-[30px] border border-gray-100">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl">👤</div>
                            <div className="flex-1 text-right">
                                <h3 className="font-black text-lg text-gray-800">أحمد جاسم</h3>
                                <div className="flex items-center gap-1 text-orange-500 text-xs font-black"><Star className="w-3 h-3 fill-orange-500" /> 4.9 ممتاز</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} className="bg-blue-500 rounded-2xl w-14 h-14 shadow-lg flex items-center justify-center relative">
                                    <MessageSquare className="w-6 h-6 text-white" />
                                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</span>}
                                </button>
                                <a href="tel:07701234567" className="bg-green-500 rounded-2xl w-14 h-14 shadow-lg flex items-center justify-center"><Phone className="w-6 h-6 text-white" /></a>
                            </div>
                        </div>
                     )}
                </div>
            </div>
        </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative" dir="rtl">
      <header className="absolute top-0 inset-x-0 z-[4000] p-6 flex flex-col gap-3">
          <div className="flex items-start gap-3 w-full">
              <Sheet>
                <SheetTrigger asChild><Button variant="secondary" size="icon" className="rounded-2xl shadow-xl bg-white text-black w-14 h-14 border-none"><Menu className="w-6 h-6" /></Button></SheetTrigger>
                <SheetContent side="right" className="w-[85%] p-0 z-[6000] border-none text-right flex flex-col bg-white">
                    <div className="p-8 pt-20 bg-orange-500 text-right rounded-bl-[50px] shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"><Truck className="w-64 h-64 -rotate-12 absolute -right-10 -bottom-10" /></div>
                        <div className="relative group w-24 h-24 mb-6">
                            <div className="w-24 h-24 bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-white/20 flex items-center justify-center">
                                {userProfile.image ? <img src={userProfile.image} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-4xl">👤</span>}
                            </div>
                            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-xl shadow-lg active:scale-90 transition-transform"><Camera className="w-4 h-4" /></button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                        </div>
                        <h2 className="text-2xl font-black text-white">{userProfile.name || "مستخدم جديد"}</h2>
                        <p className="text-white/70 text-sm font-bold mt-1 italic">{userProfile.address || "بغداد"}</p>
                    </div>

                    <div className="p-6 flex-1">
                      <SidebarLink icon={<History />} label="سجل الرحلات" extra={`${userProfile.trips} رحلة`} />
                      <SidebarLink icon={<Wallet />} label="المحفظة" extra={`${userProfile.wallet} د.ع`} color="text-green-600" />
                      <SidebarLink icon={<Star />} label="التقييم" extra="4.9" color="text-yellow-500" />
                      <SidebarLink icon={<Phone />} label="الدعم الفني" color="text-blue-600" />
                    </div>

                    <div className="p-8 border-t border-gray-100">
                        <Button variant="ghost" className="w-full justify-start gap-4 text-red-500 font-black h-14 rounded-2xl hover:bg-red-50 transition-all" onClick={handleLogout}>
                            <div className="bg-red-50 p-2 rounded-xl"><LogOut className="w-5 h-5" /></div>
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

      <div className="flex-1 relative z-0">
        {(step === "pickup" || step === "dropoff") && (
          <>
            <MapContainer center={[33.3152, 44.3661]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" detectRetina={true} tileSize={256}/>
              <FlyToMarker center={step === "pickup" ? [formData.pickupLat, formData.pickupLng] : [formData.destLat, formData.destLng]} shouldFly={shouldFly} />
              <MapEventsHandler onMove={(center) => {
                 setShouldFly(false);
                 if (step === "pickup") setFormData(prev => ({...prev, pickupLat: center.lat, pickupLng: center.lng}));
                 else setFormData(prev => ({...prev, destLat: center.lat, destLng: center.lng}));
              }} />
            </MapContainer>
            <Button onClick={handleGetCurrentLocation} className="absolute bottom-40 right-6 z-[1000] w-14 h-14 rounded-2xl bg-white text-orange-500 shadow-2xl border-none active:scale-90 transition-transform"><Target className="w-7 h-7" /></Button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                <div className="flex flex-col items-center -mt-12">
                    <div className={`px-5 py-2 rounded-2xl text-white text-xs font-black mb-2 shadow-2xl ${step === "pickup" ? "bg-orange-500" : "bg-black"}`}>{step === "pickup" ? "تحميل من هنا" : "توصيل لهنا"}</div>
                    <div className={`w-1.5 h-8 ${step === "pickup" ? "bg-orange-500" : "bg-black"} rounded-full shadow-lg`}></div>
                </div>
            </div>
          </>
        )}

        {step === "vehicle" && (
          <div className="h-full overflow-y-auto p-6 pt-36 pb-48 space-y-4 bg-gray-50">
            {VEHICLE_OPTIONS.map((opt) => (
              <div key={opt.id} onClick={() => setFormData(p => ({...p, vehicleType: opt.id, price: opt.price.toString()}))}
                   className={`p-5 rounded-[32px] border-2 transition-all flex justify-between items-center ${formData.vehicleType === opt.id ? 'bg-orange-500 border-orange-500 text-white shadow-xl scale-[1.02]' : 'bg-white border-transparent shadow-sm'}`}>
                  <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${formData.vehicleType === opt.id ? 'bg-white/20' : 'bg-orange-50 text-orange-500'}`}><Truck className="w-8 h-8" /></div>
                      <div><h4 className="font-black text-lg">{opt.label}</h4><p className="text-[10px]">تصل خلال 10 دقائق</p></div>
                  </div>
                  <span className="text-xl font-black">{opt.price} <span className="text-xs">د.ع</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 inset-x-0 bg-white p-8 pb-10 rounded-t-[45px] shadow-2xl z-[4000] border-t border-gray-50">
          <Button 
            onClick={() => {
                if (step === "pickup") setStep("dropoff");
                else if (step === "dropoff") setStep("vehicle");
                else setViewState("success");
            }}
            disabled={step === "vehicle" && !formData.vehicleType}
            className={`w-full h-18 rounded-[28px] font-black text-xl transition-all shadow-xl ${step === "vehicle" ? "bg-orange-500 text-white" : "bg-black text-white"}`}
          >
            {step === "vehicle" ? "تأكيد الطلب الآن" : "تأكيد الموقع"}
          </Button>
          {step !== "pickup" && (
            <button onClick={() => setStep(step === "dropoff" ? "pickup" : "dropoff")} className="w-full mt-5 text-gray-400 font-black text-xs flex items-center justify-center gap-2"><RotateCcw className="w-3 h-3" /> رجوع للخطوة السابقة</button>
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
      </AnimatePresence>
    </div>
  );
}

function MapEventsHandler({ onMove }: { onMove: (center: L.LatLng) => void }) {
  const map = useMapEvents({ moveend: () => onMove(map.getCenter()) });
  return null;
}