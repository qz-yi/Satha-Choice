import { useState, useEffect } from "react";
import { Users, Truck, Map as MapIcon, ShieldCheck, BarChart3, Search, Bell, Power, CheckCircle2, XCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import { useLocation } from "wouter";

const socket = io("http://192.168.0.104:3000");

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("map");
  const [, setLocation] = useLocation();
  const [pendingDrivers, setPendingDrivers] = useState([
    { id: 101, name: "سامر القيسي", phone: "07801122334", vehicle: "سطحة هيدروليك", city: "بغداد", date: "2026-01-01" },
  ]);

  const handleApprove = (id: number) => {
    setPendingDrivers(prev => prev.filter(d => d.id !== id));
    // هنا سنضيف كود Socket لإبلاغ السائق لاحقاً
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-indigo-500 p-2 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
          <h1 className="text-xl font-black italic">SATHA ADMIN</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab("map")} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold ${activeTab === "map" ? 'bg-indigo-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <MapIcon className="w-5 h-5" /> الخريطة الحية
          </button>
          <button onClick={() => setActiveTab("requests")} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold ${activeTab === "requests" ? 'bg-indigo-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Users className="w-5 h-5" /> طلبات الانضمام
          </button>
        </nav>
        <Button onClick={() => setLocation("/admin-login")} variant="ghost" className="mt-auto text-red-400 gap-2 justify-start font-bold">
          <Power className="w-5 h-5" /> خروج
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden text-right">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-2xl w-96 font-bold text-sm">
            <Search className="w-5 h-5 text-slate-400" /> بحث سريع...
          </div>
          <div className="flex items-center gap-4 border-r pr-4 font-black">لوحة التحكم المركزية</div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === "map" && (
            <div className="h-[600px] bg-white rounded-[40px] shadow-xl overflow-hidden border-8 border-white">
              <MapContainer center={[33.3152, 44.3661]} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              </MapContainer>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingDrivers.map(driver => (
                <motion.div layout key={driver.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-xl">👤</div>
                      <div>
                        <h4 className="font-black text-slate-800">{driver.name}</h4>
                        <p className="text-xs text-slate-400 font-bold">{driver.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <Button onClick={() => handleApprove(driver.id)} className="flex-1 bg-green-500 hover:bg-green-600 rounded-xl font-black h-12 gap-2 text-white">
                      <CheckCircle2 className="w-4 h-4" /> تفعيل الحساب
                    </Button>
                    <Button variant="ghost" className="flex-1 bg-red-50 text-red-500 rounded-xl font-black h-12 gap-2">
                      <XCircle className="w-4 h-4" /> رفض
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}