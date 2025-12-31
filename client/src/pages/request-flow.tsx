import { useState, useEffect, useCallback, memo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertRequestSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { VehicleCard } from "@/components/vehicle-card";
import { 
  MapPin, Check, Search, Loader2, X, Menu, 
  User, MessageSquare, History, Settings, Wallet, Phone, Truck, ChevronRight,
  LocateFixed, AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MapContainer, TileLayer, useMapEvents, useMap, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// --- Fix Leaflet Icons ---
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const formSchema = insertRequestSchema.extend({
  location: z.string().min(1, "موقع التحميل مطلوب"),
  destination: z.string().min(1, "وجهة التوصيل مطلوبة"),
  pickupLat: z.number(), pickupLng: z.number(),
  destLat: z.number(), destLng: z.number(),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
  price: z.string(),
  timeMode: z.enum(["now", "later"]),
});

type FormValues = z.infer<typeof formSchema>;

// --- مكون زر تحديد الموقع المعدل ليرسل الخطأ للأعلى ---
const LocateMeButton = ({ onError }: { onError: (msg: string) => void }) => {
  const map = useMap();

  const handleLocate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!navigator.geolocation) {
      onError("المتصفح لا يدعم تحديد الموقع");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 16, { duration: 1.5 });
      },
      () => {
        onError("يرجى تفعيل إذن الوصول للموقع من الإعدادات");
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <button
      type="button"
      onClick={handleLocate}
      className="absolute bottom-32 left-6 z-[1000] bg-white w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border border-gray-100 active:scale-90 transition-all pointer-events-auto"
    >
      <LocateFixed className="w-6 h-6 text-black" />
    </button>
  );
};

const SidebarLink = memo(({ icon, label, extra, color = "text-blue-600" }: { 
  icon: React.ReactNode; label: string; extra?: string; color?: string; 
}) => (
  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-2xl group text-right">
    <div className="flex items-center gap-4">
      <div className={`${color} group-active:scale-90 transition-transform`}>{icon}</div>
      <span className="text-[15px] font-bold text-gray-800">{label}</span>
    </div>
    {extra && <span className="text-xs font-black text-gray-400">{extra}</span>}
  </button>
));

const SmartSearchInput = ({ step, onSelect, onClose }: { step: string, onSelect: (lat: number, lng: number) => void, onClose: () => void }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const map = useMap();

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 3) { setResults([]); return; }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${val}&countrycodes=iq&limit=5`);
      const data = await response.json();
      setResults(data);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="absolute top-4 inset-x-4 z-[9999] pointer-events-auto">
      <div className="bg-white shadow-2xl border-2 border-black rounded-[24px] flex items-center px-4 py-2 min-h-[60px]">
        <Search className="w-5 h-5 text-gray-400 ml-3 shrink-0" />
        <input 
          autoFocus type="text" value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={step === "pickup" ? "ابحث عن موقع التحميل..." : "ابحث عن وجهة التوصيل..."}
          className="flex-1 bg-transparent border-none outline-none text-right font-bold text-black text-base"
        />
        <button 
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} 
          className="mr-2 text-xs font-black text-red-500 bg-red-50 px-4 py-2 rounded-full hover:bg-red-100 active:scale-90 transition-all"
        >
          إلغاء
        </button>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden p-2">
            {results.map((res, i) => (
              <button key={i} onClick={() => {
                const lat = parseFloat(res.lat);
                const lon = parseFloat(res.lon);
                onSelect(lat, lon);
                map.flyTo([lat, lon], 16);
                onClose();
              }} className="w-full p-4 text-right hover:bg-gray-50 rounded-xl flex items-center justify-between border-b last:border-0">
                <MapPin className="w-4 h-4 text-gray-300" />
                <span className="text-sm font-bold truncate text-gray-700">{res.display_name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CenterPinHandler = memo(({ onLocationChange }: { onLocationChange: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  useMapEvents({ moveend: () => onLocationChange(map.getCenter()) });
  return null;
});

export default function RequestFlow() {
  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [viewState, setViewState] = useState<"booking" | "success" | "tracking">("booking");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState("pending");
  const [locationError, setLocationError] = useState<string | null>(null); // حالة جديدة لرسالة الخطأ
  
  const DRIVER_PHONE = "07701234567";
  const { mutate, isPending } = useCreateRequest();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "المنصور، بغداد", destination: "اليرموك",
      pickupLat: 33.3152, pickupLng: 44.3661,
      destLat: 33.3152, destLng: 44.3661,
      vehicleType: "", price: "", timeMode: "now",
    },
  });

  // مسح رسالة الخطأ تلقائياً بعد 4 ثواني
  useEffect(() => {
    if (locationError) {
      const timer = setTimeout(() => setLocationError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [locationError]);

  const startNewOrder = useCallback(() => {
    localStorage.removeItem("satha_active_request");
    setViewState("booking"); setStep("pickup"); setRequestStatus("pending");
    form.reset();
  }, [form]);

  useEffect(() => {
    if (viewState !== "tracking") return;
    const interval = setInterval(() => {
      const savedRequest = localStorage.getItem("satha_active_request");
      if (!savedRequest) { setRequestStatus("completed"); return; }
      try {
        const parsed = JSON.parse(savedRequest);
        if (parsed.status === "accepted") setRequestStatus("accepted");
        else if (parsed.status === "completed" || parsed.status === "canceled") setRequestStatus("completed");
      } catch (e) { console.error(e); }
    }, 1500);
    return () => clearInterval(interval);
  }, [viewState]);

  const handleNextStep = useCallback(() => {
    if (step === "pickup") { setStep("dropoff"); }
    else { setStep("vehicle"); }
  }, [step]);

  const onSubmit = useCallback((data: FormValues) => {
    const driverPayload = { id: Date.now(), status: "pending", customerName: "علي كريم" };
    localStorage.setItem("satha_active_request", JSON.stringify(driverPayload));
    mutate({ ...data, pickupLat: data.pickupLat.toString(), pickupLng: data.pickupLng.toString(), destLat: data.destLat.toString(), destLng: data.destLng.toString(), pickupAddress: data.location }, 
    { onSuccess: () => setViewState("success"), onError: () => setViewState("success") });
  }, [mutate]);

  const handleLocationUpdate = useCallback((latlng: L.LatLng) => {
    if (step === "pickup") { form.setValue("pickupLat", latlng.lat); form.setValue("pickupLng", latlng.lng); }
    else { form.setValue("destLat", latlng.lat); form.setValue("destLng", latlng.lng); }
  }, [step, form]);

  if (viewState === "success") return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 text-right" dir="rtl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner"><Check className="w-12 h-12 text-green-600" /></div>
        <h2 className="text-3xl font-black text-black">تم إرسال طلبك!</h2>
        <Button onClick={() => setViewState("tracking")} className="w-full h-14 bg-black text-white rounded-2xl font-bold px-12 italic shadow-2xl active:scale-95 transition-all">تتبع السطحة الآن</Button>
      </motion.div>
    </div>
  );

  if (viewState === "tracking") return (
    <div className="h-screen w-full bg-slate-50 flex flex-col relative" dir="rtl">
        <div className="absolute inset-0 z-0">
            <MapContainer center={[33.3152, 44.3661]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[33.3152, 44.3661]} />
            </MapContainer>
        </div>
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1000] p-4">
            <div className="bg-white rounded-[30px] shadow-2xl p-6 border border-gray-100 text-right">
                {requestStatus === "pending" ? (
                    <div className="text-center space-y-4">
                         <div className="flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#FFD700]" /></div>
                         <h3 className="text-xl font-black">جاري انتظار قبول السائق...</h3>
                         <Button variant="outline" className="w-full rounded-xl" onClick={startNewOrder}>إلغاء البحث</Button>
                    </div>
                ) : requestStatus === "accepted" ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b pb-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"><User className="w-8 h-8 text-slate-500" /></div>
                            <div><h3 className="font-black text-lg">أحمد السائق</h3><div className="text-yellow-500 font-bold">★ 4.9</div></div>
                            <div className="mr-auto"><div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">قادم إليك</div></div>
                        </div>
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-green-500 text-white rounded-xl h-12 gap-2" onClick={() => window.location.href = `tel:${DRIVER_PHONE}`}><Phone className="w-4 h-4" /> اتصال</Button>
                            <Button className="flex-1 bg-green-50 text-green-700 border border-green-200 rounded-xl h-12 gap-2" onClick={() => window.open(`https://wa.me/964${DRIVER_PHONE.substring(1)}`, '_blank')}><MessageSquare className="w-4 h-4" /> واتساب</Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <h3 className="font-black text-2xl">انتهت الرحلة</h3>
                        <Button onClick={startNewOrder} className="mt-6 w-full h-14 bg-black text-white rounded-2xl font-black">طلب جديد</Button>
                    </div>
                )}
            </div>
        </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden relative" dir="rtl">
      
      {!isSearchOpen && (
        <header className="absolute top-0 inset-x-0 z-[5000] p-4 flex flex-col gap-3 pointer-events-none">
          
          {/* الرسالة الحمراء: تظهر هنا في أعلى الشاشة عند حدوث خطأ في تحديد الموقع */}
          <AnimatePresence>
            {locationError && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="w-full bg-red-600 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-center gap-2 pointer-events-auto border-2 border-white/20"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-black">{locationError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start gap-2 w-full">
            <div className="pointer-events-auto">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="icon" className="rounded-full shadow-xl bg-white text-black w-12 h-12 border border-gray-100"><Menu className="w-6 h-6" /></Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85%] p-0 z-[6000]">
                    <div className="p-6 pt-12 border-b bg-gray-50"><h2 className="text-2xl font-black text-right">علي كريم</h2></div>
                    <div className="p-4 space-y-1 text-right">
                      <SidebarLink icon={<History className="w-5 h-5" />} label="الرحلات" color="text-black" />
                      <SidebarLink icon={<Settings className="w-5 h-5" />} label="الإعدادات" color="text-gray-500" />
                    </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex-1 pointer-events-auto">
              <div onClick={() => step !== "vehicle" && setIsSearchOpen(true)} className="bg-white/95 backdrop-blur-md shadow-xl border border-gray-100 rounded-[24px] flex items-center justify-between px-5 py-3 min-h-[60px] cursor-pointer active:scale-95 transition-all">
                <div>
                  <h1 className="text-base font-black text-black leading-tight">
                    {step === "pickup" ? "حدد موقع التحميل" : step === "dropoff" ? "حدد وجهة التوصيل" : "اختر نوع السطحة"}
                  </h1>
                  {step !== "vehicle" && <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tighter">اضغط للبحث عن عنوان...</p>}
                </div>
                {step !== "vehicle" && <Search className="w-5 h-5 text-gray-300" />}
              </div>
            </div>
          </div>

          {/* الرسالة السوداء: بقيت في مكانها الأصلي تحت شريط البحث كما في التصميم */}
          <AnimatePresence>
            {step === "dropoff" && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex justify-center">
                <div className="bg-black/90 backdrop-blur-sm text-white px-5 py-2 rounded-2xl shadow-2xl text-[11px] font-black border border-white/10 pointer-events-auto">
                  📍 حرك الخريطة لتحديد موقع التوصيل بدقة
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      )}

      {(step === "pickup" || step === "dropoff") && (
        <div className="flex-1 relative z-0">
          <MapContainer center={[33.3152, 44.3661]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <CenterPinHandler onLocationChange={handleLocationUpdate} />
            
            {/* زر تحديد الموقع يمرر رسالة الخطأ للأعلى */}
            {!isSearchOpen && <LocateMeButton onError={(msg) => setLocationError(msg)} />}

            {isSearchOpen && (
              <SmartSearchInput step={step} onClose={() => setIsSearchOpen(false)} onSelect={(lat, lng) => {
                  if (step === "pickup") { form.setValue("pickupLat", lat); form.setValue("pickupLng", lng); }
                  else { form.setValue("destLat", lat); form.setValue("destLng", lng); }
                  setIsSearchOpen(false);
              }} />
            )}
          </MapContainer>

          {!isSearchOpen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              <div className="flex flex-col items-center -mt-10">
                <div className={`px-4 py-1 rounded-full text-white text-[10px] font-black mb-1 shadow-2xl ${step === "pickup" ? "bg-black" : "bg-red-600"}`}>
                  {step === "pickup" ? "نقطة التحميل" : "نقطة التوصيل"}
                </div>
                <div className="w-1 bg-black h-6"></div>
                <div className="w-5 h-5 bg-black rounded-full border-[4px] border-white shadow-2xl"></div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "vehicle" && (
        <div className="flex-1 overflow-y-auto p-4 pt-36 pb-32 bg-gray-50 z-0">
          <Form {...form}><form className="space-y-4">
            {VEHICLE_OPTIONS.map((opt) => (
              <VehicleCard key={opt.id} {...opt} isSelected={form.watch("vehicleType") === opt.id} onSelect={() => { form.setValue("vehicleType", opt.id); form.setValue("price", opt.price.toString()); }} />
            ))}
          </form></Form>
        </div>
      )}

      {!isSearchOpen && (
        <footer className="fixed bottom-0 inset-x-0 bg-white p-6 pb-8 rounded-t-[35px] shadow-2xl z-[4000] border-t">
          <Button onClick={step === "vehicle" ? form.handleSubmit(onSubmit) : handleNextStep} disabled={isPending || (step === "vehicle" && !form.watch("vehicleType"))}
            className={`w-full h-16 rounded-[24px] font-black text-lg ${step === "vehicle" ? "bg-[#FFD700] text-black shadow-yellow-100" : "bg-black text-white"}`}>
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === "vehicle" ? "تأكيد وحجز السطحة" : step === "pickup" ? "تأكيد موقع التحميل" : "تأكيد الوجهة")}
            {!isPending && <ChevronRight className="w-5 h-5 mr-2 opacity-50" />}
          </Button>
        </footer>
      )}
    </div>
  );
}