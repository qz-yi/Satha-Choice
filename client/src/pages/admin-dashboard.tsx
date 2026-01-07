import { useState } from "react";
import { 
  Users, Truck, Map as MapIcon, ShieldCheck, 
  Power, CheckCircle2, XCircle, Menu, Activity,
  MapPin, Search, Loader2, Trash2, Phone, ArrowLeftRight,
  UserPlus
} from "lucide-react";
import { MapContainer, TileLayer } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Driver, Request, VEHICLE_OPTIONS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("map");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // جلب البيانات الأساسية
  const { data: allDrivers = [], isLoading: loadingDrivers } = useQuery<Driver[]>({ 
    queryKey: ["/api/drivers"] 
  });

  const { data: allRequests = [] } = useQuery<Request[]>({ 
    queryKey: ["/api/requests"] 
  });

  // مبيشن التفعيل
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/drivers/${id}`, { 
        status: "approved" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم تفعيل الكابتن بنجاح" });
    }
  });

  // مبيشن الحذف
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/drivers/${id}`); 
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ variant: "destructive", title: "تم حذف البيانات نهائياً" });
    }
  });

  // ✅ مبيشن تحويل الطلب لسائق محدد
  const assignMutation = useMutation({
    mutationFn: async ({ requestId, driverId }: { requestId: number, driverId: number }) => {
      return await apiRequest("POST", `/api/admin/requests/${requestId}/assign`, { driverId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "تم تحويل الطلب للكابتن بنجاح" });
    }
  });

  // ✅ مبيشن المرجوع (إلغاء التعيين)
  const cancelAssignmentMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return await apiRequest("POST", `/api/admin/requests/${requestId}/cancel-assignment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "تم إلغاء تعيين السائق وإعادة الطلب للعام" });
    }
  });

  // ✅ إصلاح منطق البحث ليكون شاملاً ومقاوماً للأخطاء
  const filteredDrivers = allDrivers.filter(d => {
    const searchLower = searchQuery.toLowerCase().trim();
    const nameMatch = (d.name || "").toLowerCase().includes(searchLower);
    const phoneMatch = (d.phone || "").includes(searchLower);
    return nameMatch || phoneMatch;
  });

  const pendingDrivers = filteredDrivers.filter(d => !d.status || d.status === "pending");
  const approvedDrivers = filteredDrivers.filter(d => d.status === "approved");
  
  // تصفية الطلبات النشطة فقط في قسم الخريطة
  const activeRequests = allRequests.filter(r => 
    r.status !== "completed" && (r.customerPhone || "").includes(searchQuery.trim())
  );

  const stats = [
    { label: "سائقين متصلين", value: allDrivers.filter(d => d.isOnline).length.toString(), icon: <Activity className="text-green-500" />, color: "bg-green-50" },
    { label: "طلبات نشطة", value: allRequests.filter(r => r.status === "pending").length.toString(), icon: <Truck className="text-orange-500" />, color: "bg-orange-50" },
    { label: "إجمالي السائقين", value: allDrivers.length.toString(), icon: <Users className="text-blue-500" />, color: "bg-blue-50" },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F3F4F6] font-sans" dir="rtl">
      
      <aside className={`${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 fixed md:relative z-[5000] w-72 h-full bg-slate-950 text-white flex flex-col p-6 shadow-2xl transition-transform duration-500 ease-in-out`}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2.5 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldCheck className="w-6 h-6 text-white" /></div>
            <div>
                <h1 className="text-xl font-black italic tracking-tighter">SATHA <span className="text-orange-500">ADMIN</span></h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">لوحة التحكم المركزية</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><XCircle /></button>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button onClick={() => { setActiveTab("map"); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-[20px] font-black transition-all ${activeTab === "map" ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
            <div className="flex items-center gap-4"><MapIcon className="w-5 h-5" /> الخريطة الحية</div>
          </button>
          
          <button onClick={() => { setActiveTab("requests"); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-[20px] font-black transition-all ${activeTab === "requests" ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
            <div className="flex items-center gap-4"><Users className="w-5 h-5" /> طلبات الانضمام</div>
            {pendingDrivers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingDrivers.length}</span>}
          </button>

          <button onClick={() => { setActiveTab("all-drivers"); setIsSidebarOpen(false); }} className={`w-full flex items-center p-4 rounded-[20px] font-black transition-all ${activeTab === "all-drivers" ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
            <Activity className="w-5 h-5 ml-4" /> إدارة السائقين
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-900">
            <Button onClick={() => setLocation("/")} variant="ghost" className="w-full text-red-400 gap-3 justify-start font-black hover:bg-red-500/10 hover:text-red-400 rounded-2xl h-14 transition-all">
                <Power className="w-5 h-5" /> تسجيل الخروج
            </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden text-right relative">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 md:px-10 flex items-center justify-between z-[1000]">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-3 bg-gray-100 rounded-2xl"><Menu className="w-6 h-6 text-slate-600" /></button>
            <div className="relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="ابحث عن كابتن (اسم أو هاتف)..." 
                    className="bg-gray-100/50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none rounded-2xl pr-12 pl-6 py-3 w-64 md:w-[450px] font-bold text-sm transition-all shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {stats.map((stat, i) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-xs font-black text-gray-400 mb-1">{stat.label}</p>
                          <h3 className="text-3xl font-black text-slate-900 italic">{stat.value}</h3>
                      </div>
                      <div className={`${stat.color} p-4 rounded-2xl`}>{stat.icon}</div>
                  </motion.div>
              ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "map" ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="map-view" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 h-[500px] bg-white rounded-[45px] shadow-2xl overflow-hidden border-[12px] border-white">
                            <MapContainer center={[33.3152, 44.3661]} zoom={11} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            </MapContainer>
                        </div>
                        
                        {/* ✅ قسم إدارة الطلبات المحدث مع ميزة التحويل والمرجوع */}
                        <div className="space-y-4 overflow-y-auto max-h-[500px] pb-10">
                            <h3 className="font-black text-xl italic p-2 flex items-center gap-2">
                                <Truck className="text-orange-500 w-5 h-5"/> إدارة الطلبات الحالية
                            </h3>
                            {activeRequests.map(req => (
                                <div key={req.id} className="bg-white p-5 rounded-[30px] shadow-sm border-r-4 border-orange-500 hover:shadow-md transition-all">
                                    <div className="flex justify-between mb-2 text-sm font-black">
                                        <span className="text-gray-400 text-[10px]">الزبون:</span>
                                        <span className="text-orange-600 flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3"/> {req.customerPhone}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-bold mb-3 bg-gray-50 p-2 rounded-lg">الموقع: {req.pickupAddress}</div>
                                    
                                    <div className="flex flex-col gap-2 mt-4">
                                        {/* زر التحويل */}
                                        <Button 
                                            onClick={() => {
                                                const onlineDrivers = allDrivers.filter(d => d.isOnline && d.status === 'approved');
                                                if (onlineDrivers.length === 0) return toast({ title: "لا يوجد سائقين متصلين حالياً", variant: "destructive" });
                                                
                                                const driverName = prompt(`اختر اسم الكابتن للتحويل:\n${onlineDrivers.map(d => `- ${d.name} (ID: ${d.id})`).join('\n')}`);
                                                const selectedDriver = onlineDrivers.find(d => d.name === driverName || d.id.toString() === driverName);
                                                
                                                if(selectedDriver) {
                                                    assignMutation.mutate({ requestId: req.id, driverId: selectedDriver.id });
                                                }
                                            }}
                                            className="w-full bg-slate-900 hover:bg-orange-500 rounded-xl h-10 text-[10px] font-black transition-colors flex gap-2"
                                        >
                                            <ArrowLeftRight className="w-4 h-4"/> تحويل لسائق محدد
                                        </Button>

                                        {/* زر مرجوع (يظهر فقط إذا كان الطلب عند سائق) */}
                                        {req.driverId && (
                                            <Button 
                                                variant="outline"
                                                onClick={() => {
                                                    if(window.confirm("مرجوع: هل تريد سحب الطلب من السائق وإعادته متاحاً للجميع؟")) {
                                                        cancelAssignmentMutation.mutate(req.id);
                                                    }
                                                }}
                                                className="w-full border-red-100 text-red-500 hover:bg-red-50 rounded-xl h-10 text-[10px] font-black transition-colors flex gap-2"
                                            >
                                                <XCircle className="w-4 h-4"/> مرجوع (إلغاء السائق)
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {activeRequests.length === 0 && (
                                <div className="text-center py-10 text-gray-400 font-bold text-xs">لا توجد طلبات نشطة حالياً</div>
                            )}
                        </div>
                    </div>
                </motion.div>
            ) : activeTab === "requests" ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="requests-view" className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 italic px-2">طلبات الانضمام ({pendingDrivers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingDrivers.map((driver) => (
                            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={driver.id} className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-orange-500" />
                                <div className="flex gap-4 mb-6 text-right">
                                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-xl text-orange-500 font-bold">
                                      {driver.name ? driver.name.charAt(0) : "?"}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-lg text-slate-800 mb-1">{driver.name}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold"><MapPin className="w-3 h-3" /> {driver.city}</div>
                                    </div>
                                </div>
                                <div className="space-y-3 mb-8">
                                    <div className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-2xl">
                                        <span className="text-gray-400 font-bold">نوع السطحة</span>
                                        <span className="font-black text-slate-700 italic">{driver.vehicleType}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-2xl">
                                        <span className="text-gray-400 font-bold">رقم الهاتف</span>
                                        <span className="font-black text-slate-700 italic">{driver.phone}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button onClick={() => approveMutation.mutate(driver.id)} className="flex-1 bg-orange-500 hover:bg-black text-white rounded-[20px] font-black h-14 transition-all gap-2">
                                        <CheckCircle2 className="w-5 h-5" /> تفعيل
                                    </Button>
                                    <Button onClick={() => { if(window.confirm("حذف الطلب؟")) deleteMutation.mutate(driver.id) }} variant="ghost" className="w-14 h-14 bg-red-50 text-red-500 rounded-[20px] hover:bg-red-500 hover:text-white transition-all">
                                        <Trash2 className="w-6 h-6" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="all-drivers" className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 italic px-2">السائقين المعتمدين ({approvedDrivers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {approvedDrivers.map(driver => (
                            <div key={driver.id} className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-100 flex items-center justify-between transition-all">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                                        <span className="font-black text-slate-800 text-lg">{driver.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-400 font-bold" dir="ltr">{driver.phone}</span>
                                    <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-lg w-fit mt-1">{driver.city}</span>
                                </div>
                                <Button 
                                    onClick={() => {
                                        if(window.confirm(`هل أنت متأكد من حذف الكابتن ${driver.name}؟`)) {
                                            deleteMutation.mutate(driver.id);
                                        }
                                    }} 
                                    variant="ghost" 
                                    className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}