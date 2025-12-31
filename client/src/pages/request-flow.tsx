import { useState, useEffect, useCallback, memo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertRequestSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { VehicleCard } from "@/components/vehicle-card";
import { 
  MapPin, Check, Search, Loader2, X, Menu, 
  User, MessageSquare, History, Gift, Settings, HelpCircle, Wallet 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// --- Leaflet Icon Fix ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const formSchema = insertRequestSchema.extend({
  location: z.string().min(1),
  destination: z.string().min(1),
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

SidebarLink.displayName = "SidebarLink";

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
          className="absolute top-0 inset-x-0 z-[2000] p-4 bg-white/95 backdrop-blur-xl shadow-2xl rounded-b-[30px] border-b border-gray-100"
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

SearchOverlay.displayName = "SearchOverlay";

const CenterPinHandler = memo(({ onLocationChange }: { onLocationChange: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  useMapEvents({ moveend: () => onLocationChange(map.getCenter()) });
  return null;
});

CenterPinHandler.displayName = "CenterPinHandler";

export default function RequestFlow() {
  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { mutate, isPending } = useCreateRequest();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "موقع محدد", destination: "وجهة محددة",
      pickupLat: 33.3152, pickupLng: 44.3661,
      destLat: 0, destLng: 0, vehicleType: "", price: "", timeMode: "now",
    },
  });

  const handleNextStep = useCallback(() => {
    if (step === "pickup") {
      setStep("dropoff");
      toast({ title: "تم التحديد", description: "الآن حدد وجهة التوصيل" });
    } else { 
      setStep("vehicle"); 
    }
  }, [step, toast]);

  // --- التعديل الجوهري للربط مع السائق ---
  const onSubmit = useCallback((data: FormValues) => {
    mutate({
      ...data,
      status: "pending", // نضمن إرسال الطلب بحالة "pending" ليظهر للسائق
      pickupLat: data.pickupLat.toString(), 
      pickupLng: data.pickupLng.toString(),
      destLat: data.destLat.toString(), 
      destLng: data.destLng.toString(),
      pickupAddress: data.location, // تطابق الأسماء مع واجهة السائق
    }, { 
      onSuccess: () => {
        setIsSuccess(true);
        toast({ title: "تم إرسال الطلب ✅", description: "جاري البحث عن أقرب سطحة" });
      },
      onError: () => {
        toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال الطلب، حاول ثانية" });
      }
    });
  }, [mutate, toast]);

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

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 text-right" dir="rtl">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center space-y-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-black text-black">تم إرسال طلبك!</h2>
          <p className="text-gray-500 font-bold">السائقين في منطقتك استلموا طلبك الآن</p>
          <Button 
            onClick={() => setLocation("/track/1")}
            className="w-full h-14 bg-black text-white rounded-2xl font-bold px-12 italic tracking-tighter shadow-2xl active:scale-95 transition-all"
          >
             تتبع السطحة الآن
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden relative" dir="rtl">
      <header className="absolute top-0 inset-x-0 z-[1010] p-4 flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="secondary" size="icon" 
              className="rounded-full shadow-xl bg-white text-black w-12 h-12 shrink-0 border border-gray-100 active:scale-90 transition-transform"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85%] sm:w-[350px] p-0 border-l-0 rounded-l-[30px] overflow-hidden">
            <div className="flex flex-col h-full bg-white text-right" dir="rtl">
              <div className="p-6 pt-12 border-b border-gray-50 bg-gradient-to-b from-gray-50 to-white">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                      <User className="w-8 h-8 text-gray-400" />
                   </div>
                   <div className="space-y-1">
                      <h2 className="text-2xl font-black text-black tracking-tight">علي كريم</h2>
                      <p className="text-[10px] text-gray-400 font-black uppercase">عرض معلومات المستخدم</p>
                   </div>
                </div>
              </div>
              <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                <SidebarLink icon={<MessageSquare className="w-5 h-5" />} label="الرسائل" color="text-blue-500" />
                <SidebarLink icon={<MapPin className="w-5 h-5" />} label="العناوين المفضلة" color="text-indigo-600" />
                <SidebarLink icon={<History className="w-5 h-5" />} label="الرحلات" color="text-black" />
                <SidebarLink icon={<Gift className="w-5 h-5" />} label="قسائم الخصومات والجوائز" color="text-blue-400" />
                <SidebarLink icon={<Settings className="w-5 h-5" />} label="الإعدادات" color="text-gray-600" />
                <SidebarLink icon={<HelpCircle className="w-5 h-5" />} label="مساعدة" color="text-sky-500" />
                <div className="border-t border-gray-100 my-4" />
                <SidebarLink icon={<Wallet className="w-5 h-5" />} label="تعبئة الرصيد" extra="دينار" color="text-emerald-500" />
                <SidebarLink icon={<Gift className="w-5 h-5" />} label="رحلة مجانية" color="text-purple-500" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <div className="bg-white shadow-xl border border-gray-100 rounded-2xl flex-1 flex items-center justify-between px-4 h-12 overflow-hidden">
          <h1 className="text-sm font-black text-black truncate italic">
            {step === "pickup" ? "حدد موقع التحميل" : step === "dropoff" ? "حدد وجهة التوصيل" : "اختر نوع السطحة"}
          </h1>
          {(step === "pickup" || step === "dropoff") && (
            <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="w-8 h-8 rounded-full bg-gray-50 text-black hover:bg-gray-100 transition-colors">
              <Search className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {(step === "pickup" || step === "dropoff") && (
        <div className="flex-1 relative">
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
              <div className="w-1 bg-black h-6 shadow-lg"></div>
              <div className="w-5 h-5 bg-black rounded-full border-[4px] border-white shadow-2xl"></div>
            </motion.div>
          </div>
        </div>
      )}

      {step === "vehicle" && (
        <div className="flex-1 overflow-y-auto p-4 pt-24 bg-gray-50">
          <Form {...form}>
            <form className="grid gap-3">
              {VEHICLE_OPTIONS.map((option) => (
                <VehicleCard
                  key={option.id}
                  {...option}
                  isSelected={form.watch("vehicleType") === option.id}
                  onSelect={() => { 
                    form.setValue("vehicleType", option.id); 
                    form.setValue("price", option.price); 
                  }}
                />
              ))}
            </form>
          </Form>
        </div>
      )}

      <footer className="bg-white p-6 rounded-t-[40px] shadow-[0_-15px_50px_rgba(0,0,0,0.1)] z-[1010] border-t border-gray-50">
        <Button 
          onClick={step === "vehicle" ? form.handleSubmit(onSubmit) : handleNextStep}
          disabled={isPending || (step === "vehicle" && !form.watch("vehicleType"))}
          className={`w-full h-16 rounded-[22px] font-black text-xl shadow-xl active:scale-95 transition-all ${
            step === "vehicle" ? "bg-[#FFD700] text-black shadow-[#FFD700]/20" : "bg-black text-white"
          }`}
        >
          {step === "vehicle" ? (isPending ? "جاري الحجز..." : "تأكيد وحجز") : `تأكيد الموقع`}
        </Button>
      </footer>
    </div>
  );
}