import { useState, useEffect, useCallback, memo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, LogOut, Wallet, X, Phone, User, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 1. إصلاح رابط الأيقونات (تم التصحيح هنا)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker.png", // تم تصحيح الامتداد
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// --- مكون التبديل بتصميم عريض ومنظم ---
const StatusToggle = memo(({ isOnline, onToggle }: any) => (
  <div 
    onClick={onToggle}
    className={`relative w-28 h-9 rounded-full p-1 cursor-pointer transition-all duration-500 shadow-inner flex items-center ${
      isOnline ? 'bg-green-500' : 'bg-slate-300'
    }`}
  >
    <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none font-black text-[9px]">
      <span className={isOnline ? 'text-white' : 'opacity-0'}>متصل</span>
      <span className={!isOnline ? 'text-slate-600' : 'opacity-0'}>أوفلاين</span>
    </div>
    <motion.div
      animate={{ x: isOnline ? 72 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="w-7 h-7 bg-white rounded-full shadow-lg z-10"
    />
  </div>
));

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
    refetchInterval: 2000,
  });

  const pendingRequest = requests?.find((r: any) => r.status === "pending");

  // تفعيل القبول الفوري الحقيقي
  const acceptMutation = useMutation({
    mutationFn: async (req: any) => req,
    onSuccess: (data) => {
      setActiveRequest(data);
      setOrderStage("heading");
      toast({ title: "تم القبول فورا" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      queryClient.setQueryData(["/api/requests"], (old: any) => 
        old?.filter((r: any) => r.id !== id)
      );
      return id;
    },
    onSuccess: () => {
      setCountdown(30);
      toast({ title: "تم التجاهل" });
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
      {!activeRequest && (
        <header className="bg-[#FFD700] px-4 py-4 flex justify-between items-center shadow-md z-[1001]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-black"><LogOut /></Button>
            <StatusToggle isOnline={isOnline} onToggle={() => setIsOnline(!isOnline)} />
          </div>
          <div className="font-black italic text-black flex items-center gap-2">
            <span className="text-lg">SATHA PRO</span>
            <Truck />
          </div>
        </header>
      )}

      <div className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[33.3152, 44.3661]} />
          </MapContainer>
        </div>

        <AnimatePresence>
          {isOnline && pendingRequest && !activeRequest && (
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="absolute inset-x-4 bottom-28 z-[1000]">
              <Card className="rounded-[35px] border-none shadow-2xl bg-white overflow-hidden p-6 relative">
                <button onClick={() => rejectMutation.mutate(pendingRequest.id)} className="absolute top-4 left-4 p-2 bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                <div className="text-right mt-2">
                  <h2 className="text-3xl font-black text-black">{pendingRequest.price} <span className="text-sm font-normal text-slate-400">د.ع</span></h2>
                  <p className="text-slate-500 font-bold text-xs mt-1">{pendingRequest.pickupAddress}</p>
                </div>
                <Button onClick={() => acceptMutation.mutate(pendingRequest)} className="w-full h-14 mt-6 bg-[#FFD700] text-black font-black rounded-2xl text-xl shadow-lg border-b-4 border-black/10">
                  قبول الطلب ({countdown})
                </Button>
              </Card>
            </motion.div>
          )}

          {activeRequest && (
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} className="absolute inset-x-0 bottom-0 z-[1005] bg-white rounded-t-[40px] shadow-2xl p-6 border-t border-gray-100">
               <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
               <Button 
                onClick={() => {
                  if (orderStage === "heading") setOrderStage("arrived");
                  else if (orderStage === "arrived") setOrderStage("dropped");
                  else { setActiveRequest(null); toast({ title: "تم بنجاح" }); }
                }} 
                className="w-full h-16 rounded-2xl bg-black text-white font-black text-xl shadow-xl active:scale-95"
              >
                {orderStage === "heading" ? "أنا في الموقع" : orderStage === "arrived" ? "تم التحميل" : "إنهاء المهمة"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!activeRequest && (
        <footer className="bg-white p-6 rounded-t-[35px] shadow-2xl border-t z-[1001] flex justify-between items-center">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-black">الأرباح</p>
            <h3 className="text-xl font-black">50,000 د.ع</h3>
          </div>
          <Button className="bg-black text-white rounded-xl px-8 font-black">سحب</Button>
        </footer>
      )}
    </div>
  );
}