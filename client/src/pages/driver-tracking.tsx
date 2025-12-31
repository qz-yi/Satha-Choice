import React, { memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Phone } from "lucide-react"; // تأكد من استيراد الأيقونة
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useQuery } from "@tanstack/react-query";

// 1. تعريف الأيقونة البرتقالية لـ Satha Choice
const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  iconShadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 2. مكون الخريطة
const DriverMap = memo(({ driverLocation, userLocation }: any) => {
  return (
    <MapContainer center={userLocation} zoom={13} style={{ height: "400px", width: "100%", borderRadius: "15px" }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <Marker position={userLocation}>
        <Popup>موقعك الحالي</Popup>
      </Marker>
      <Marker position={driverLocation} icon={orangeIcon}>
        <Popup>موقع السطحة</Popup>
      </Marker>
    </MapContainer>
  );
});

// 3. واجهة التتبع الرئيسية
export default function DriverTracking({ params }: { params: { id: string } }) {
  // جلب بيانات الطلب والسائق حياً من قاعدة البيانات
  const { data: request, isLoading } = useQuery({
    queryKey: [`/api/requests/${params.id}`],
  });

  if (isLoading) return <div className="p-10 text-center text-white">جاري تحميل بيانات السائق...</div>;

  // استخراج البيانات (إذا لم تتوفر، نستخدم قيم افتراضية مؤقتاً)
  const driver = request?.driver;
  const userLoc: [number, number] = [33.3152, 44.3661]; 
  const driverLoc: [number, number] = [
    Number(driver?.lat) || 33.3252, 
    Number(driver?.lng) || 44.3761
  ];

  return (
    <div className="p-4 bg-zinc-950 min-h-screen text-white" dir="rtl">
      <h1 className="text-xl font-bold mb-4 text-yellow-500">تتبع طلبك #{params.id}</h1>
      
      <DriverMap userLocation={userLoc} driverLocation={driverLoc} />

      <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="flex justify-between mb-6">
          <div>
            <p className="text-zinc-400 text-sm">السائق:</p>
            <p className="font-bold text-white text-lg">{driver?.name || "جاري البحث..."}</p>
          </div>
          <div className="text-left">
            <p className="text-zinc-400 text-sm">الوصول خلال:</p>
            <p className="font-bold text-yellow-500 text-lg">{request?.estimatedArrival || "12 دقيقة"}</p>
          </div>
        </div>

        <button 
          onClick={() => window.location.href = `tel:${driver?.phone || "07700000000"}`}
          className="w-full h-14 bg-green-500 text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 mb-4"
        >
          <Phone className="w-5 h-5" />
          الاتصال بالكابتن الآن
        </button>

        <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 text-center">
          <p className="text-orange-500 text-sm font-bold">يتم تحديث الموقع بشكل حي ومباشر 📡</p>
        </div>
      </div>
    </div>
  );
}