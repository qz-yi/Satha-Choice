import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Truck, LogOut, Wallet, X, 
  Phone, User, Navigation 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// إصلاح أيقونات الخريطة
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// --- مكون زر السحب الاحترافي (Mini & Super Fast) ---
const StatusSlider = memo(({ isOnline, onToggle }: { isOnline: boolean, onToggle: () => void }) => {
  // مسافة السحب المحسوبة بدقة للزر المصغر (28 بكسل)
  const slidePath = 80; 

  return (
    <div className="relative w-28 h-8 bg-black/20 rounded-full p-0.5 flex items-center overflow-hidden border border-white/5 backdrop-blur-md shadow-inner touch-none">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-[7px] font-black transition-all duration-300 ${isOnline ? 'text-green-500 opacity-100' : 'text-white/40'}`}>
          {isOnline ? "متصل" : "اسحب للعمل >>>"}
        </span>
      </div>
      
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: slidePath }}
        dragElastic={0.02}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          // تفعيل سريع جداً بمجرد تجاوز 30% من المسار
          if (info.offset.x > 25 && !isOnline) onToggle();
          else if (info.offset.x < -25 && isOnline) onToggle();
        }}
        animate={{ x: isOnline ? slidePath : 0 }}
        // سرعة استجابة فائقة (High Stiffness)
        transition={{ type: "spring", stiffness: 800, damping: 30, mass: 0.5 }}
        className={`w-7 h-7 rounded-full shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center transition-colors duration-200 z-10 ${isOnline ? 'bg-green-500' : 'bg-white'}`}
      >
        <motion.div 
          animate={isOnline ? { scale: [1, 1.4, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-white' : 'bg-gray-400'}`} 
        />
      </motion.div>
    </div>
  );
});

export default function DriverDashboard() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [orderStage, setOrderStage] = useState<"heading" | "arrived" | "dropped">("heading");
  const [countdown, setCountdown] = useState(30);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: requests } = useQuery({
    queryKey: ["/api/requests"],
    enabled: isOnline && !activeRequest,
    refetchInterval: 3000,
  });

  const pendingRequest = requests?.find((r: any) => r.status === "pending");

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      queryClient.setQueryData(["/api/requests"], (old: any) => old?.filter((r: any) => r.id !== id));
      return { success: true };
    },
    onSuccess: () => { setCountdown(30); toast({ title: "تم تجاهل الطلب" }); }
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return { id: requestId, pickupAddress: "المنصور، شارع الاميرات", price: "25,000" };
    },
    onSuccess: (data) => { 
      setActiveRequest(data); 
      setOrderStage("heading"); 
    }
  });

  useEffect(() => {
    let timer: any;
    if (pendingRequest && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && pendingRequest) {
      rejectMutation.mutate(pendingRequest.id);
    }
    return () => clearInterval(timer);
  }, [pendingRequest, countdown]);

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden relative" dir="rtl">
      {/* Header - مصغر ومنظم */}
      {!activeRequest && (
        <header className="bg-[#FFD700] px-4 py-3 flex justify-between items-center shadow-md z-[1001] relative touch-none">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-black h-8 w-8 active:scale-90 transition-transform p-0">
              <LogOut className="w-5 h-5" />
            </Button>
            <StatusSlider isOnline={isOnline} onToggle={() => setIsOnline(!isOnline)} />
          </div>
          <div className="flex items-center gap-2 font-black italic text-black">
            <span className="text-xs tracking-tighter">SATHA PRO</span>
            <Truck className="w-5 h-5" />
          </div>
        </header>
      )}

      <div className="flex-1 relative">
        <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[33.3152, 44.3661]} />
        </MapContainer>

        <AnimatePresence>
          {isOnline && pendingRequest && !activeRequest && (
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="absolute inset-x-4 bottom-10 z-[1000]">
              <Card className="rounded-[30px] border-none shadow-2xl bg-white p-1">
                <CardContent className="p-5 relative text-right">
                  <button onClick={() => rejectMutation.mutate(pendingRequest.id)} className="absolute top-2 left-2 p-2 text-gray-300 hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
                  <div className="flex justify-between items-start mb-5">
                    <div className="pt-2">
                      <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mb-1 inline-block">طلب متاح</span>
                      <p className="font-black text-black text-lg leading-tight truncate w-40">{pendingRequest.pickupAddress}</p>
                    </div>
                    <div className="pt-2 font-black text-2xl text-green-600 tracking-tighter">{pendingRequest.price} <span className="text-[10px]">د.ع</span></div>
                  </div>
                  <Button onClick={() => acceptMutation.mutate(pendingRequest.id)} className="w-full h-14 bg-[#FFD700] text-black font-black rounded-2xl text-lg shadow-lg active:scale-95 transition-all">
                    قبول الطلب ({countdown})
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeRequest && (
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1005] bg-white rounded-t-[40px] shadow-2xl p-6 border-t border-gray-100">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4 text-right">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400"><User className="w-6 h-6" /></div>
                  <div>
                    <h4 className="font-black text-black text-base leading-tight">زبون سطحة</h4>
                    <p className="text-[10px] text-slate-400 font-bold truncate w-32">{activeRequest.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 p-0 flex items-center justify-center"><Navigation className="w-5 h-5" /></Button>
                  <Button className="w-10 h-10 rounded-xl bg-green-50 text-green-600 p-0 flex items-center justify-center"><Phone className="w-5 h-5" /></Button>
                </div>
              </div>
              <Button 
                onClick={() => {
                  if (orderStage === "heading") setOrderStage("arrived");
                  else if (orderStage === "arrived") setOrderStage("dropped");
                  else { setActiveRequest(null); toast({ title: "تمت المهمة بنجاح!" }); }
                }} 
                className="w-full h-14 rounded-2xl bg-black text-white font-black text-lg shadow-xl active:scale-95 transition-all"
              >
                {orderStage === "heading" ? "وصلت لموقع التحميل" : 
                 orderStage === "arrived" ? "تم التحميل بنجاح" : "إنهاء المهمة"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!activeRequest && (
        <section className="bg-white p-5 rounded-t-[35px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-50 z-[1001]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-right">
              <div className="bg-yellow-400/10 p-2.5 rounded-xl text-[#FFD700]"><Wallet className="w-6 h-6" /></div>
              <div>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">الأرباح</p>
                <h3 className="text-xl font-black text-black leading-none">50,000 <span className="text-[10px] italic text-gray-500 font-bold">د.ع</span></h3>
              </div>
            </div>
            <Button className="bg-black text-white rounded-xl h-10 px-6 font-black text-xs active:scale-95 transition-all">سحب</Button>
          </div>
        </section>
      )}
    </div>
  );
}