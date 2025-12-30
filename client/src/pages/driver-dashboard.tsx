import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, LogOut, MapPin, Navigation, Wallet, BellRing, X, Phone, CheckCircle2, CreditCard, Banknote, User, MessageSquare } from "lucide-react";
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

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [orderStage, setOrderStage] = useState<"heading_to_pickup" | "arrived_pickup" | "heading_to_dropoff" | "payment">("heading_to_pickup");
  const [countdown, setCountdown] = useState(30);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let timer: any;
    if (isOnline && !activeRequest && !pendingRequest) {
      timer = setTimeout(() => {
        setPendingRequest({
          id: 1,
          customerName: "محمد الرافدين",
          location: "المنصور، شارع 14 رمضان",
          price: "30,000 د.ع",
          lat: 33.3152,
          lng: 44.3661
        });
        setCountdown(30);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isOnline, activeRequest, pendingRequest]);

  const acceptOrder = () => {
    setActiveRequest(pendingRequest);
    setPendingRequest(null);
    setOrderStage("heading_to_pickup");
    toast({ title: "تم قبول الطلب", description: "بدأت رحلتك الآن" });
  };

  const finalizeTrip = () => {
    setActiveRequest(null);
    setOrderStage("heading_to_pickup");
    toast({ title: "اكتملت العملية", description: "تم استلام المبلغ بنجاح" });
  };

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden relative" dir="rtl">
      
      <AnimatePresence>
        {/* الهيدر يختفي فقط عند وجود طلب نشط لإعطاء مساحة للخريطة */}
        {!activeRequest && (
          <motion.header 
            initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }}
            className="bg-[#FFD700] p-4 flex justify-between items-center shadow-lg z-[1001]"
          >
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-black">
                <LogOut className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-2 bg-black/5 px-3 py-1 rounded-full">
                <span className="text-[10px] font-bold text-black">{isOnline ? "متصل" : "غير متصل"}</span>
                <div onClick={() => setIsOnline(!isOnline)} className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}>
                  <motion.div animate={{ x: isOnline ? -26 : -2 }} className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow-md" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 font-black italic text-black">
              <span className="text-xl tracking-tighter">SATHA PRO</span>
              <Truck className="w-7 h-7" />
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className="flex-1 relative">
        <MapContainer center={[33.3152, 44.3661]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[33.3152, 44.3661]} />
        </MapContainer>

        <AnimatePresence>
          {/* طلب جديد - التصميم الأصلي المطور */}
          {pendingRequest && (
            <motion.div 
              initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
              className="absolute inset-x-4 bottom-28 z-[1000]"
            >
              <Card className="rounded-[25px] border-2 border-[#FFD700] shadow-2xl bg-white overflow-hidden">
                <div className="bg-[#FFD700]/10 p-3 flex justify-between items-center border-b border-[#FFD700]/20">
                   <div className="flex items-center gap-2">
                     <BellRing className="w-5 h-5 text-[#FFD700] animate-pulse" />
                     <span className="font-bold text-sm">طلب شحن جديد!</span>
                   </div>
                   <X onClick={() => setPendingRequest(null)} className="w-5 h-5 text-gray-400 cursor-pointer" />
                </div>
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-4 text-right">
                    <div>
                      <p className="text-gray-500 text-xs mb-1 font-bold">موقع التحميل:</p>
                      <p className="font-black text-black">{pendingRequest.location}</p>
                    </div>
                    <div className="bg-gray-100 p-2 rounded-lg text-left">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">السعر</p>
                      <p className="text-lg font-black text-green-600">{pendingRequest.price}</p>
                    </div>
                  </div>
                  <Button onClick={acceptOrder} className="w-full h-14 bg-[#FFD700] text-black font-black rounded-2xl text-xl shadow-lg border-b-4 border-yellow-600 active:border-b-0">
                    قبول الطلب ({countdown})
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* واجهة الرحلة العصرية - بنفس ستايل واجهة الزبون */}
          {activeRequest && orderStage !== "payment" && (
            <motion.div 
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              className="absolute inset-x-0 bottom-0 z-[1005] bg-white rounded-t-[40px] shadow-[0_-15px_40px_rgba(0,0,0,0.15)] border-t border-gray-100"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-5" />
              
              <div className="px-6 pb-8">
                <div className="flex justify-center mb-6">
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    orderStage === "heading_to_pickup" ? "bg-amber-100 text-amber-600" :
                    orderStage === "arrived_pickup" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                  }`}>
                    {orderStage === "heading_to_pickup" && "متوجه للزبون"}
                    {orderStage === "arrived_pickup" && "وصلت لموقع التحميل"}
                    {orderStage === "heading_to_dropoff" && "جاري النقل للوجهة"}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shadow-inner border border-slate-200">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-right">
                      <h4 className="font-black text-xl text-slate-900 leading-none mb-1">{activeRequest.customerName}</h4>
                      <p className="text-xs text-slate-400 font-bold flex items-center gap-1 italic"><MapPin className="w-3 h-3"/> {activeRequest.location}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 border-none">
                      <MessageSquare className="w-5 h-5" />
                    </Button>
                    <Button size="icon" className="w-12 h-12 rounded-2xl bg-green-500 hover:bg-green-600 text-white shadow-lg active:scale-90 transition-transform">
                      <Phone className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    if(orderStage === "heading_to_pickup") setOrderStage("arrived_pickup");
                    else if(orderStage === "arrived_pickup") setOrderStage("heading_to_dropoff");
                    else setOrderStage("payment");
                  }}
                  className={`w-full h-16 rounded-[22px] font-black text-xl shadow-xl transition-all active:scale-95 ${
                    orderStage === "heading_to_pickup" ? "bg-black text-white" :
                    orderStage === "arrived_pickup" ? "bg-[#FFD700] text-black" : "bg-green-600 text-white"
                  }`}
                >
                  {orderStage === "heading_to_pickup" && "أنا في الموقع"}
                  {orderStage === "arrived_pickup" && "تم التحميل - انطلاق"}
                  {orderStage === "heading_to_dropoff" && "تم التفريغ في الموقع"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* نافذة الدفع */}
          {orderStage === "payment" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 text-center">
              <Card className="w-full max-w-sm rounded-[40px] bg-white p-8 border-4 border-[#FFD700] shadow-3xl">
                <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-gray-900 mb-6">اكتملت الرحلة!</h2>
                <div className="grid grid-cols-2 gap-4 mb-8 font-black">
                  <button onClick={finalizeTrip} className="flex flex-col items-center gap-3 p-5 rounded-3xl border-2 border-gray-100 bg-gray-50 active:scale-95 transition-transform">
                    <Banknote className="w-10 h-10 text-[#FFD700]" />
                    <span>نقدي</span>
                  </button>
                  <button onClick={finalizeTrip} className="flex flex-col items-center gap-3 p-5 rounded-3xl border-2 border-gray-100 bg-gray-50 active:scale-95 transition-transform">
                    <CreditCard className="w-10 h-10 text-blue-500" />
                    <span>إلكتروني</span>
                  </button>
                </div>
                <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 font-black">
                  <p className="text-[10px] text-gray-400 mb-1">المبلغ المطلوب</p>
                  <p className="text-2xl text-black">{activeRequest?.price}</p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* المحفظة - تختفي أثناء الرحلة */}
      <AnimatePresence>
        {!activeRequest && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="bg-white p-6 rounded-t-[35px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-50 z-[1001]"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4 text-right">
                <div className="bg-yellow-400/20 p-3 rounded-2xl text-[#FFD700]"><Wallet className="w-7 h-7" /></div>
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">الرصيد</p>
                  <h3 className="text-2xl font-black text-black leading-none">50,000 <span className="text-xs italic text-gray-500 font-medium">د.ع</span></h3>
                </div>
              </div>
              <Button className="bg-black text-white hover:bg-gray-800 rounded-2xl h-12 px-8 font-black text-sm shadow-lg">سحب الأرباح</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
