import { useState, useEffect, useCallback, memo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertRequestSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { VehicleCard } from "@/components/vehicle-card";
import { 
  MapPin, Check, Search, Loader2, X, Menu, 
  User, MessageSquare, History, Settings, Wallet, Phone, Truck, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
  pickupLat: z.number(),
  pickupLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
  price: z.string(),
  timeMode: z.enum(["now", "later"]),
});

type FormValues = z.infer<typeof formSchema>;

const SidebarLink = memo(({ icon, label, extra, color = "text-blue-600" }: { 
  icon: React.ReactNode; 
  label: string; 
  extra?: string; 
  color?: string; 
}) => (
  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-2xl group text-right">
    <div className="flex items-center gap-4">
      <div className={`${color} group-active:scale-90 transition-transform`}>{icon}</div>
      <span className="text-[15px] font-bold text-gray-800">{label}</span>
    </div>
    {extra && <span className="text-xs font-black text-gray-400">{extra}</span>}
  </button>
));

const SearchOverlay = memo(({ isOpen, onClose, onSelect }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSelect: (lat: number, lng: number) => void; 
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const map = useMap();

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 3) { setResults([]); return; }
    setLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${val}&countrycodes=iq&limit=5`);
      const data = await response.json();
      setResults(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          className="absolute top-0 inset-x-0 z-[3000] p-4 bg-white/95 backdrop-blur-xl shadow-2xl rounded-b-[30px] border-b border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="w-5 h-5" /></Button>
            <div className="relative flex-1">
              <Input 
                autoFocus placeholder="أين تريد الذهاب؟" value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-12 pr-10 rounded-xl bg-gray-100 border-none font-bold text-right shadow-inner"
              />
              <Search className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
            </div>
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {loading && <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-black" /></div>}
            {results.map((res, i) => (
              <button
                key={i}
                onClick={() => {
                  const lat = parseFloat(res.lat);
                  const lon = parseFloat(res.lon);
                  onSelect(lat, lon);
                  map.flyTo([lat, lon], 16);
                  onClose();
                }}
                className="w-full p-4 text-right hover:bg-gray-50 rounded-xl flex items-center justify-between transition-colors"
              >
                <MapPin className="w-4 h-4 text-black opacity-40" />
                <span className="text-sm font-bold truncate text-gray-700">{res.display_name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const CenterPinHandler = memo(({ onLocationChange }: { onLocationChange: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  useMapEvents({ moveend: () => onLocationChange(map.getCenter()) });
  return null;
});export default function RequestFlow() {
  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [viewState, setViewState] = useState<"booking" | "success" | "tracking">("booking");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState("pending");
  
  const DRIVER_PHONE = "07701234567";
  const { mutate, isPending } = useCreateRequest();
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "المنصور، بغداد", 
      destination: "اليرموك",
      pickupLat: 33.3152, 
      pickupLng: 44.3661,
      destLat: 33.3152,
      destLng: 44.3661,
      vehicleType: "", 
      price: "", 
      timeMode: "now",
    },
  });

  const startNewOrder = useCallback(() => {
    localStorage.removeItem("satha_active_request");
    setViewState("booking");
    setStep("pickup");
    setRequestStatus("pending");
    form.reset();
  }, [form]);

  useEffect(() => {
    if (viewState !== "tracking") return;
    const interval = setInterval(() => {
      const savedRequest = localStorage.getItem("satha_active_request");
      if (!savedRequest) {
        setRequestStatus("completed");
        return;
      }
      try {
        const parsed = JSON.parse(savedRequest);
        if (parsed.status === "accepted") {
          setRequestStatus("accepted");
        } else if (parsed.status === "completed" || parsed.status === "canceled") {
          setRequestStatus("completed");
        }
      } catch (e) { console.error(e); }
    }, 1500);
    return () => clearInterval(interval);
  }, [viewState]);

  const handleNextStep = useCallback(() => {
    if (step === "pickup") {
      setStep("dropoff");
      toast({ title: "تم التحديد", description: "الآن حدد وجهة التوصيل" });
    } else { 
      setStep("vehicle"); 
    }
  }, [step, toast]);

  const onSubmit = useCallback((data: FormValues) => {
    const driverPayload = {
        id: Date.now(),
        pickupAddress: data.location,
        price: data.price,
        status: "pending",
        customerName: "علي كريم",
        customerPhone: "07700000000",
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng
    };
    localStorage.setItem("satha_active_request", JSON.stringify(driverPayload));
    mutate({
      ...data,
      pickupLat: data.pickupLat.toString(), 
      pickupLng: data.pickupLng.toString(),
      destLat: data.destLat.toString(), 
      destLng: data.destLng.toString(),
      pickupAddress: data.location,
    }, { 
      onSuccess: () => { setViewState("success"); },
      onError: () => { setViewState("success"); } 
    });
  }, [mutate]);

  const handleLocationUpdate = useCallback((latlng: L.LatLng) => {
    if (step === "pickup") { 
      form.setValue("pickupLat", latlng.lat); 
      form.setValue("pickupLng", latlng.lng); 
    } else { 
      form.setValue("destLat", latlng.lat); 
      form.setValue("destLng", latlng.lng); 
    }
  }, [step, form]);

  const handleSearchSelect = useCallback((lat: number, lng: number) => {
    if (step === "pickup") { 
      form.setValue("pickupLat", lat); 
      form.setValue("pickupLng", lng); 
    } else { 
      form.setValue("destLat", lat); 
      form.setValue("destLng", lng); 
    }
  }, [step, form]);

  if (viewState === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 text-right" dir="rtl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-black text-black">تم إرسال طلبك!</h2>
          <p className="text-gray-500 font-bold">السائقين في منطقتك استلموا طلبك الآن</p>
          <Button onClick={() => setViewState("tracking")} className="w-full h-14 bg-black text-white rounded-2xl font-bold px-12 italic tracking-tighter shadow-2xl active:scale-95 transition-all">تتبع السطحة الآن</Button>
        </motion.div>
      </div>
    );
  }

  if (viewState === "tracking") {
      return (
        <div className="h-screen w-full bg-slate-50 flex flex-col relative" dir="rtl">
            <div className="absolute inset-0 z-0">
                <MapContainer center={[33.3152, 44.3661]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[33.3152, 44.3661]} />
                </MapContainer>
            </div>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1000] p-4">
                <div className="bg-white rounded-[30px] shadow-2xl p-6 border border-gray-100">
                    {requestStatus === "pending" ? (
                        <div className="text-center space-y-4">
                             <div className="flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#FFD700]" /></div>
                             <h3 className="text-xl font-black">جاري انتظار قبول السائق...</h3>
                             <p className="text-gray-400 text-sm">تم إشعار السائقين القريبين منك</p>
                             <Button variant="outline" className="w-full rounded-xl" onClick={startNewOrder}>إلغاء البحث</Button>
                        </div>
                    ) : requestStatus === "accepted" ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"><User className="w-8 h-8 text-slate-500" /></div>
                                <div>
                                    <h3 className="font-black text-lg">أحمد السائق</h3>
                                    <div className="flex items-center gap-1 text-yellow-500"><span className="text-sm font-bold">★ 4.9</span></div>
                                </div>
                                <div className="mr-auto">
                                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">قادم إليك</div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center gap-3">
                                <div className="flex-1">
                                    <p className="text-xs text-gray-400 font-bold mb-1">نوع المركبة</p>
                                    <div className="flex items-center gap-2"><Truck className="w-5 h-5" /><span className="font-bold">هيونداي سطحة</span></div>
                                </div>
                                <div className="flex-1 text-left">
                                     <p className="text-xs text-gray-400 font-bold mb-1">رقم اللوحة</p>
                                     <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono font-bold">ب غ د 5592</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl h-12 gap-2" onClick={() => window.location.href = `tel:${DRIVER_PHONE}`}><Phone className="w-4 h-4" /> اتصال مباشر</Button>
                                <Button className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl h-12 gap-2" onClick={() => window.open(`https://wa.me/964${DRIVER_PHONE.substring(1)}?text=مرحبا، أنا الزبون بانتظار وصولك`, '_blank')}><MessageSquare className="w-4 h-4" /> واتساب</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                            <h3 className="font-black text-2xl">انتهت الرحلة</h3>
                            <p className="text-gray-400 font-bold">شكراً لاستخدامك تطبيق سطحة</p>
                            <Button onClick={startNewOrder} className="mt-6 w-full h-14 bg-black text-white rounded-2xl font-black">طلب جديد</Button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
      )
  }

  return (
        <div className="h-screen w-full bg-white flex flex-col overflow-hidden relative" dir="rtl">
      {/* --- HEADER SECTION --- */}
      <header className="absolute top-0 inset-x-0 z-40 p-4 flex items-start gap-2 pointer-events-none">
        
        {/* زر القائمة الجانبية */}
        <div className="pointer-events-auto">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full shadow-xl bg-white text-black w-12 h-12 shrink-0 border border-gray-100">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] sm:w-[350px] p-0 border-l-0 rounded-l-[30px] overflow-hidden z-[2000]">
              <div className="flex flex-col h-full bg-white text-right" dir="rtl">
                <div className="p-6 pt-12 border-b border-gray-50 bg-gradient-to-b from-gray-50 to-white">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center border-2 border-white shadow-md"><User className="w-8 h-8 text-gray-400" /></div>
                     <div>
                        <h2 className="text-2xl font-black text-black tracking-tight">علي كريم</h2>
                        <p className="text-[10px] text-gray-400 font-black uppercase">مرحباً بك</p>
                     </div>
                  </div>
                </div>
                <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                  <SidebarLink icon={<MessageSquare className="w-5 h-5" />} label="الرسائل" color="text-blue-500" />
                  <SidebarLink icon={<MapPin className="w-5 h-5" />} label="العناوين المفضلة" color="text-indigo-600" />
                  <SidebarLink icon={<History className="w-5 h-5" />} label="الرحلات" color="text-black" />
                  <SidebarLink icon={<Settings className="w-5 h-5" />} label="الإعدادات" color="text-gray-600" />
                  <div className="border-t border-gray-100 my-4" />
                  <SidebarLink icon={<Wallet className="w-5 h-5" />} label="تعبئة الرصيد" extra="دينار" color="text-emerald-500" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* --- شريط العنوان والبحث (مفعل بالكامل) --- */}
        <div 
          onClick={() => {
            if (step === "pickup" || step === "dropoff") {
              setIsSearchOpen(true);
            }
          }}
          className={`bg-white/95 backdrop-blur-md shadow-xl border border-gray-100 rounded-[24px] flex-1 flex flex-col justify-center px-5 py-3 min-h-[60px] pointer-events-auto transition-all ${
            (step === "pickup" || step === "dropoff") 
              ? "cursor-pointer active:scale-95 hover:bg-gray-50" 
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-black text-black leading-tight">
                {step === "pickup" ? "حدد موقع التحميل" : step === "dropoff" ? "حدد وجهة التوصيل" : "اختر نوع السطحة"}
              </h1>
              
              {(step === "pickup" || step === "dropoff") ? (
                 <p className="text-xs text-gray-400 font-bold truncate mt-1 flex items-center gap-1">
                   <Search className="w-3 h-3" />
                   اضغط هنا للبحث عن موقع...
                 </p>
              ) : (
                 <p className="text-xs text-gray-400 font-bold mt-1">الأسعار تعتمد على المسافة ونوع المركبة</p>
              )}
            </div>

            {(step === "pickup" || step === "dropoff") && (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-black shadow-sm">
                 <Search className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --- محتوى الخريطة --- */}
      {(step === "pickup" || step === "dropoff") && (
        <div className="flex-1 relative z-0">
          
          <MapContainer center={[33.3152, 44.3661]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleSearchSelect} />
            <CenterPinHandler onLocationChange={handleLocationUpdate} />
          </MapContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="flex flex-col items-center -mt-10">
              <div className={`px-4 py-1 rounded-full text-white text-[10px] font-black mb-1 shadow-2xl ${step === "pickup" ? "bg-black" : "bg-red-600"}`}>
                {step === "pickup" ? "نقطة التحميل" : "نقطة التوصيل"}
              </div>
              <div className="w-1 bg-black h-6"></div>
              <div className="w-5 h-5 bg-black rounded-full border-[4px] border-white shadow-2xl"></div>
            </motion.div>
          </div>
        </div>
      )}

      {/* تم زيادة البادئة العلوية pt-36 لمنع اختفاء السيارات خلف العنوان */}
      {step === "vehicle" && (
        <div className="flex-1 overflow-y-auto p-4 pt-36 pb-32 bg-gray-50 z-0">
          <Form {...form}>
            <form className="space-y-4">
              {VEHICLE_OPTIONS.map((option) => (
                <VehicleCard
                  key={option.id}
                  {...option}
                  isSelected={form.watch("vehicleType") === option.id}
                  onSelect={() => {
                     form.setValue("vehicleType", option.id);
                     form.setValue("price", option.price.toString());
                  }}
                />
              ))}
            </form>
          </Form>
        </div>
      )}

      {/* --- FOOTER ACTION BUTTON --- */}
      <footer className="fixed bottom-0 inset-x-0 bg-white p-6 pt-4 pb-8 rounded-t-[35px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30 border-t border-gray-100">
        <Button 
          onClick={step === "vehicle" ? form.handleSubmit(onSubmit) : handleNextStep}
          disabled={isPending || (step === "vehicle" && !form.watch("vehicleType"))}
          className={`w-full h-16 rounded-[24px] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${
            step === "vehicle" 
              ? "bg-[#FFD700] text-black hover:bg-[#FFC000] shadow-yellow-200" 
              : "bg-black text-white hover:bg-gray-900 shadow-gray-300"
          }`}
        >
          {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
          {step === "vehicle" 
             ? (isPending ? "جاري الحجز..." : "تأكيد وحجز السطحة") 
             : (step === "pickup" ? "تأكيد موقع التحميل" : "تأكيد الوجهة")}
          {!isPending && <ChevronRight className="w-5 h-5 opacity-60" />}
        </Button>
      </footer>
    </div>
  );
}