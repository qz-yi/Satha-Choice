import { useState, useEffect, useCallback, memo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { 
  MapPin, Check, Search, Loader2, Menu, 
  MessageSquare, History, Wallet, Phone, Truck, ChevronRight,
  LocateFixed, RotateCcw, X, Star, Navigation
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MapContainer, TileLayer, useMapEvents, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { io } from "socket.io-client";

// ✅ توحيد الـ IP ليتطابق مع السيرفر والسائق
const socket = io("http://192.168.0.104:3000");

const truckIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3163/3163211.png",
  iconSize: [45, 45],
  iconAnchor: [22, 22],
});

const formSchema = z.object({
  location: z.string().optional(),
  destination: z.string().optional(),
  pickupLat: z.number(), pickupLng: z.number(),
  destLat: z.number(), destLng: z.number(),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
  price: z.string(),
  timeMode: z.enum(["now", "later"]).default("now"),
});

type FormValues = z.infer<typeof formSchema>;

const SidebarLink = memo(({ icon, label, extra, color = "text-orange-600" }: any) => (
  <button className="w-full flex items-center justify-between p-4 hover:bg-orange-50 active:scale-[0.98] transition-all rounded-2xl text-right group">
    <div className="flex items-center gap-4">
      <div className={`${color} p-2 rounded-xl bg-gray-50 group-hover:bg-white transition-colors`}>{icon}</div>
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
  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [viewState, setViewState] = useState<"booking" | "success" | "tracking">("booking");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState("pending");
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  
  const { mutate, isPending } = useCreateRequest();
  
  const [formData, setFormData] = useState<FormValues>({
    location: "", destination: "",
    pickupLat: 33.3152, pickupLng: 44.3661,
    destLat: 33.3152, destLng: 44.3661,
    vehicleType: "", price: "", timeMode: "now",
  });

  // 📡 الاستماع للسيرفر (تم تصحيح المسميات لتطابق السائق)
  useEffect(() => {
    socket.on("receive_location", (data) => setDriverLocation([data.lat, data.lng]));
    
    // التحديث عند قبول السائق للطلب
    socket.on("order_accepted", (data) => {
        setRequestStatus("heading_to_pickup");
        setViewState("tracking");
    });

    // التحديث عند تغيير المرحلة (وصلت، تم التحميل.. إلخ)
    socket.on("order_status_updated", (data) => {
        setRequestStatus(data.status);
    });

    return () => { 
        socket.off("receive_location"); 
        socket.off("order_accepted");
        socket.off("order_status_updated"); 
    };
  }, []);

  const getStatusMessage = (status: string) => {
    switch(status) {
      case "heading_to_pickup": return "الكابتن متوجه لموقعك الآن";
      case "arrived_pickup": return "وصل الكابتن لموقع التحميل";
      case "heading_to_dropoff": return "جاري نقل المركبة للوجهة";
      case "payment": return "وصلنا! يرجى دفع المبلغ";
      default: return "جاري البحث عن أقرب صطحة...";
    }
  };

  const handleConfirmOrder = () => {
    const orderId = Date.now();
    setActiveOrderId(orderId);
    const orderPayload = {
      id: orderId, status: "pending", customerName: "علي كريم",
      pickupAddress: formData.location || "موقع محدد على الخريطة",
      dropoffAddress: formData.destination || "موقع محدد على الخريطة",
      price: formData.price, 
      pickupLat: formData.pickupLat, pickupLng: formData.pickupLng,
      destLat: formData.destLat, destLng: formData.destLng, 
      vehicleType: formData.vehicleType,
      customerPhone: "07701234567"
    };
    socket.emit("new_request", orderPayload);
    setViewState("success");
  };

  if (viewState === "success") return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center" dir="rtl">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
        <div className="w-32 h-32 bg-orange-500 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl rotate-12">
            <Check className="w-16 h-16 text-white" />
        </div>
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
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {driverLocation && <Marker position={driverLocation} icon={truckIcon} />}
                <Marker position={[formData.pickupLat, formData.pickupLng]} />
            </MapContainer>
        </div>
        
        <header className="absolute top-6 inset-x-6 z-[1000] flex justify-between items-center">
            <Button onClick={() => setViewState("booking")} className="bg-white/90 backdrop-blur-md text-black rounded-2xl w-12 h-12 shadow-xl border-none"><X className="w-5 h-5" /></Button>
            <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl shadow-xl font-black italic flex items-center gap-2">
                <Navigation className="w-4 h-4 animate-pulse" /> مباشر
            </div>
        </header>

        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1000] p-6">
            <div className="bg-white rounded-[40px] shadow-2xl p-8 border-t-4 border-orange-500">
                <div className="text-center space-y-6">
                     <div className="flex items-center justify-center gap-3">
                        {requestStatus === "pending" && <Loader2 className="w-6 h-6 animate-spin text-orange-500" />}
                        <h3 className="text-2xl font-black text-gray-800">{getStatusMessage(requestStatus)}</h3>
                     </div>
                     
                     {requestStatus !== "pending" && (
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-[30px] border border-gray-100">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl">👤</div>
                            <div className="flex-1 text-right">
                                <h3 className="font-black text-lg text-gray-800">أحمد جاسم</h3>
                                <div className="flex items-center gap-1 text-orange-500 text-xs font-black"><Star className="w-3 h-3 fill-orange-500" /> 4.9 ممتاز</div>
                            </div>
                            <a href="tel:07701234567" className="bg-green-500 rounded-2xl w-14 h-14 shadow-lg flex items-center justify-center"><Phone className="w-6 h-6 text-white" /></a>
                        </div>
                     )}
                </div>
            </div>
        </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative" dir="rtl">
      <header className="absolute top-0 inset-x-0 z-[5000] p-6 flex flex-col gap-3">
          <div className="flex items-start gap-3 w-full">
              <Sheet>
                <SheetTrigger asChild><Button variant="secondary" size="icon" className="rounded-2xl shadow-xl bg-white text-black w-14 h-14 border-none"><Menu className="w-6 h-6" /></Button></SheetTrigger>
                <SheetContent side="right" className="w-[80%] p-0 z-[6000] border-none">
                    <div className="p-8 pt-16 bg-orange-500 text-right rounded-bl-[40px]">
                        <div className="w-20 h-20 bg-white/20 rounded-3xl mb-4 flex items-center justify-center text-3xl">👤</div>
                        <h2 className="text-2xl font-black text-white">علي كريم</h2>
                    </div>
                    <div className="p-6">
                      <SidebarLink icon={<History />} label="سجل الرحلات" extra="12 رحلة" />
                      <SidebarLink icon={<Wallet />} label="المحفظة" extra="25,000 د.ع" color="text-green-600" />
                    </div>
                </SheetContent>
              </Sheet>
            
              <div onClick={() => step !== "vehicle" && setIsSearchOpen(true)} className="flex-1 bg-white shadow-2xl rounded-[28px] p-4 flex flex-col justify-center border border-white">
                <StepIndicator step={step} />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-gray-800 truncate">
                        {step === "pickup" ? (formData.location || "موقع التحميل") : 
                         step === "dropoff" ? (formData.destination || "وجهة التوصيل") : "اختر نوع السطحة"}
                    </span>
                    <Search className="w-5 h-5 text-orange-500" />
                </div>
              </div>
          </div>
      </header>

      <div className="flex-1 relative z-0">
        {(step === "pickup" || step === "dropoff") && (
          <MapContainer center={[33.3152, 44.3661]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapEventsHandler onMove={(center) => {
               if (step === "pickup") setFormData(prev => ({...prev, pickupLat: center.lat, pickupLng: center.lng}));
               else setFormData(prev => ({...prev, destLat: center.lat, destLng: center.lng}));
            }} />
          </MapContainer>
        )}

        {step === "vehicle" && (
          <div className="h-full overflow-y-auto p-6 pt-36 pb-48 space-y-4">
            {VEHICLE_OPTIONS.map((opt) => (
              <div key={opt.id} onClick={() => setFormData(p => ({...p, vehicleType: opt.id, price: opt.price.toString()}))}
                   className={`p-5 rounded-[32px] border-2 transition-all flex justify-between items-center ${formData.vehicleType === opt.id ? 'bg-orange-500 border-orange-500 text-white shadow-xl' : 'bg-white border-transparent'}`}>
                  <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${formData.vehicleType === opt.id ? 'bg-white/20' : 'bg-orange-50 text-orange-500'}`}><Truck className="w-8 h-8" /></div>
                      <div><h4 className="font-black text-lg">{opt.label}</h4><p className="text-[10px]">تصل خلال 10 دقائق</p></div>
                  </div>
                  <span className="text-xl font-black">{opt.price} <span className="text-xs">د.ع</span></span>
              </div>
            ))}
          </div>
        )}

        {step !== "vehicle" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                <div className="flex flex-col items-center -mt-12 transition-transform duration-300">
                    <div className={`px-5 py-2 rounded-2xl text-white text-xs font-black mb-2 shadow-2xl ${step === "pickup" ? "bg-orange-500" : "bg-black"}`}>
                        {step === "pickup" ? "التحميل من هنا" : "التوصيل لهنا"}
                    </div>
                    <div className={`w-1.5 h-8 ${step === "pickup" ? "bg-orange-500" : "bg-black"} rounded-full shadow-lg`}></div>
                </div>
            </div>
        )}
      </div>

      <footer className="fixed bottom-0 inset-x-0 bg-white p-8 pb-10 rounded-t-[45px] shadow-2xl z-[4000] border-t border-gray-50">
          <Button 
            onClick={() => {
                if (step === "pickup") setStep("dropoff");
                else if (step === "dropoff") setStep("vehicle");
                else handleConfirmOrder();
            }}
            disabled={step === "vehicle" && !formData.vehicleType}
            className={`w-full h-18 rounded-[28px] font-black text-xl transition-all ${step === "vehicle" ? "bg-orange-500 text-white" : "bg-black text-white"}`}
          >
            {step === "vehicle" ? "تأكيد الطلب الآن" : "تأكيد الموقع"}
          </Button>
          
          {step !== "pickup" && (
            <button onClick={() => setStep(step === "dropoff" ? "pickup" : "dropoff")} className="w-full mt-5 text-gray-400 font-black text-xs flex items-center justify-center gap-2">
                <RotateCcw className="w-3 h-3" /> رجوع للخطوة السابقة
            </button>
          )}
      </footer>

      <AnimatePresence>
          {isSearchOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[9999] bg-white p-6 text-right">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(false)} className="rounded-2xl bg-gray-50"><X className="w-6 h-6" /></Button>
                    <h3 className="font-black text-xl">البحث عن موقع</h3>
                </div>
                <div className="bg-gray-50 rounded-[28px] p-4 border border-gray-100 flex items-center gap-3 mb-6">
                    <Search className="w-6 h-6 text-gray-400" />
                    <input autoFocus placeholder="ادخل اسم المنطقة..." className="bg-transparent border-none outline-none w-full font-bold text-right" 
                           onChange={(e) => {
                               if (step === "pickup") setFormData(p => ({...p, location: e.target.value}));
                               else setFormData(p => ({...p, destination: e.target.value}));
                           }} />
                </div>
                <p className="text-[10px] font-black text-gray-400 px-2 uppercase tracking-widest mb-4">نتائج البحث</p>
                <div className="space-y-4">
                    <div onClick={() => setIsSearchOpen(false)} className="flex items-center gap-4 p-4 hover:bg-orange-50 rounded-2xl cursor-pointer">
                        <div className="bg-white p-2 rounded-xl shadow-sm"><MapPin className="w-5 h-5 text-orange-500" /></div>
                        <div><h4 className="font-bold text-gray-700">بغداد، المنصور</h4><p className="text-[10px] text-gray-400">شارع الأميرات</p></div>
                    </div>
                </div>
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

// مكون فرعي للتعامل مع أحداث الخريطة
function MapEventsHandler({ onMove }: { onMove: (center: L.LatLng) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onMove(map.getCenter());
    },
  });
  return null;
}