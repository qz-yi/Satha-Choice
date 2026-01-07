import { memo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, ArrowRight, Truck, MapPin, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

// --- Leaflet Icon Fix ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icons
const driverIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1048/1048314.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

const userIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15);
  }, [center, map]);
  return null;
};

const DarkMap = memo(({ driverPos, userPos }: { driverPos: [number, number], userPos: [number, number] }) => (
  <MapContainer 
    center={userPos} 
    zoom={13} 
    style={{ height: "100%", width: "100%", background: "#1a1a1a" }}
    zoomControl={false}
  >
    {/* Dark Mode Tile Layer using Stadia Alidade Smooth Dark */}
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    />
    <Marker position={driverPos} icon={driverIcon}>
      <Popup>السائق هنا</Popup>
    </Marker>
    <Marker position={userPos} icon={userIcon}>
      <Popup>موقعك الحالي</Popup>
    </Marker>
    <MapController center={driverPos} />
  </MapContainer>
));

DarkMap.displayName = "DarkMap";

export default function DriverTracking() {
  const [, setLocation] = useLocation();
  const [driverPos, setDriverPos] = useState<[number, number]>([33.3152, 44.3661]);
  const userPos: [number, number] = [33.3122, 44.3631];

  // Simulate driver movement
  useEffect(() => {
    const interval = setInterval(() => {
      setDriverPos(prev => [prev[0] - 0.0001, prev[1] - 0.0001]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-full bg-[#1a1a1a] flex flex-col overflow-hidden relative" dir="rtl">
      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-[1010] p-4 flex items-center justify-between pointer-events-none">
        <Button 
          variant="secondary" size="icon" 
          onClick={() => setLocation("/")}
          className="rounded-full shadow-2xl bg-white/10 backdrop-blur-md text-white border-none pointer-events-auto active:scale-95 transition-transform"
        >
          <ArrowRight className="w-6 h-6" />
        </Button>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
          <p className="text-white font-black text-sm italic tracking-tighter">SATHA TRACKING</p>
        </div>
      </header>

      {/* Map View */}
      <div className="flex-1 relative">
        <DarkMap driverPos={driverPos} userPos={userPos} />
        
        {/* Floating ETA Badge */}
        <div className="absolute top-20 right-4 z-[1000]">
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-[#FFD700] p-3 rounded-2xl shadow-2xl flex items-center gap-3 border-b-4 border-yellow-600"
          >
            <div className="bg-black p-2 rounded-xl text-white">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] text-black/50 font-black uppercase leading-none mb-1">وقت الوصول</p>
              <p className="text-xl font-black text-black leading-none">8 دقائق</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Driver Info Card */}
      <div className="p-6 pb-10 bg-[#1a1a1a] rounded-t-[40px] shadow-[0_-15px_50px_rgba(0,0,0,0.5)] z-[1010] border-t border-white/5">
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=driver" alt="Driver" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-5 h-5 rounded-full border-4 border-[#1a1a1a]" />
            </div>
            <div className="text-right">
              <h4 className="font-black text-xl text-white leading-none mb-2">أحمد السطحة</h4>
              <div className="flex items-center gap-2">
                <span className="bg-[#FFD700] text-black px-2 py-0.5 rounded-lg text-[10px] font-black">4.9 ★</span>
                <span className="text-white/40 text-[10px] font-bold italic">هينو - هيدروليك</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white border-none shadow-xl active:scale-90 transition-transform">
              <MessageSquare className="w-6 h-6" />
            </Button>
            <Button size="icon" className="w-14 h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white border-none shadow-xl active:scale-90 transition-transform">
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-3xl border border-white/5 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFD700]/10 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-[#FFD700]" />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">رقم اللوحة</p>
              <p className="text-sm font-black text-white">1234 بغداد - خصوصي</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">المسافة</p>
            <p className="text-sm font-black text-white">2.4 كم</p>
          </div>
        </div>
      </div>
    </div>
  );
}
