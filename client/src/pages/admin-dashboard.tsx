import { useState } from "react";
import {
  Users, Truck, Map as MapIcon, ShieldCheck,
  Power, CheckCircle2, XCircle, Menu, Activity,
  Search, Trash2, ArrowLeftRight,
  UserPlus, AlertCircle, Phone, MapPin, Wallet, TrendingUp, CreditCard, Clock
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Driver, Request } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const driverIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("map");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [assigningRequest, setAssigningRequest] = useState<Request | null>(null);
  const [selectedDriverForAssign, setSelectedDriverForAssign] = useState<Driver | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // جلب البيانات مع تحديث تلقائي
  const { data: allDrivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: allRequests = [] } = useQuery<Request[]>({ 
    queryKey: ["/api/requests"], 
    refetchInterval: 5000 
  });

  // إضافة جلب سجلات المالية
  const { data: allTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: activeTab === "finance"
  });

  // حساب إجمالي أرباح النظام (العمولات)
  const systemEarnings = allTransactions
    .filter(t => t.type === 'fee')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  // --- المبيشنات الأصلية ---

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/drivers/${id}`, { status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم تفعيل الكابتن بنجاح" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ variant: "destructive", title: "تم حذف البيانات نهائياً" });
    }
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/requests/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ variant: "destructive", title: "تم حذف الطلب بنجاح" });
    }
  });

  const completeRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/requests/${id}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "تم إكمال الطلب بنجاح" });
    }
  });

  const assignMutation = useMutation({
    mutationFn: async ({ requestId, driverId }: { requestId: number, driverId: number }) => {
      return await apiRequest("PATCH", `/api/requests/${requestId}`, { 
        driverId: driverId, 
        status: "accepted" 
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setAssigningRequest(null);
      setSelectedDriverForAssign(null);
      setShowConfirmModal(false);
      toast({ title: "تم تحويل الطلب للكابتن بنجاح" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "فشل التحويل، حاول مرة أخرى" });
    }
  });

  // منطق الفلترة
  const filteredDrivers = allDrivers.filter(d => {
    const searchLower = searchQuery.toLowerCase().trim();
    return (d.name || "").toLowerCase().includes(searchLower) || (d.phone || "").includes(searchLower);
  });

  const pendingDrivers = filteredDrivers.filter(d => !d.status || d.status === "pending");
  const approvedDrivers = filteredDrivers.filter(d => d.status === "approved");
  const onlineDrivers = allDrivers.filter(d => d.isOnline && d.status === 'approved');
  const activeRequests = allRequests.filter(r => r.status === "pending" || r.status === "accepted");

  const stats = [
    { id: "online-drivers-tab", label: "سائقين متصلين", value: onlineDrivers.length.toString(), icon: <Activity className="text-green-500" />, color: "bg-green-50" },
    { id: "active-requests-tab", label: "طلبات نشطة", value: activeRequests.length.toString(), icon: <Truck className="text-orange-500" />, color: "bg-orange-50" },
    { id: "finance", label: "أرباح النظام (د.ع)", value: systemEarnings.toLocaleString(), icon: <TrendingUp className="text-blue-500" />, color: "bg-blue-50" },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F3F4F6] font-sans" dir="rtl">

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 fixed md:relative z-[5000] w-72 h-full bg-slate-950 text-white flex flex-col p-6 shadow-2xl transition-transform duration-500`}>
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
            <div className="flex items-center gap-4"><UserPlus className="w-5 h-5" /> طلبات الانضمام</div>
            {pendingDrivers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingDrivers.length}</span>}
          </button>
          <button onClick={() => { setActiveTab("all-drivers"); setIsSidebarOpen(false); }} className={`w-full flex items-center p-4 rounded-[20px] font-black transition-all ${activeTab === "all-drivers" ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
            <Users className="w-5 h-5 ml-4" /> إدارة السائقين
          </button>
          <button onClick={() => { setActiveTab("finance"); setIsSidebarOpen(false); }} className={`w-full flex items-center p-4 rounded-[20px] font-black transition-all ${activeTab === "finance" ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
            <Wallet className="w-5 h-5 ml-4" /> المالية والأرباح
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-900">
            <Button onClick={() => setLocation("/")} variant="ghost" className="w-full text-red-400 gap-3 justify-start font-black hover:bg-red-500/10 rounded-2xl h-14 transition-all">
                <Power className="w-5 h-5" /> تسجيل الخروج
            </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden text-right">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 md:px-10 flex items-center justify-between z-[1000]">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-3 bg-gray-100 rounded-2xl"><Menu className="w-6 h-6 text-slate-600" /></button>
            <div className="relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="ابحث عن كابتن..." 
                    className="bg-gray-100/50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none rounded-2xl pr-12 pl-6 py-3 w-64 md:w-[450px] font-bold text-sm transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {stats.map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} 
                    onClick={() => setActiveTab(stat.id)}
                    className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-orange-200"
                  >
                      <div>
                          <p className="text-xs font-black text-gray-400 mb-1">{stat.label}</p>
                          <h3 className="text-3xl font-black text-slate-900 italic">{stat.value}</h3>
                      </div>
                      <div className={`${stat.color} p-4 rounded-2xl`}>{stat.icon}</div>
                  </motion.div>
              ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "map" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="map-view" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 h-[500px] bg-white rounded-[45px] shadow-2xl overflow-hidden border-[12px] border-white relative">
                            <MapContainer center={[33.3152, 44.3661]} zoom={11} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                                {onlineDrivers.map(driver => {
                                  const lat = parseFloat(driver.lastLat || "");
                                  const lng = parseFloat(driver.lastLng || "");
                                  if (isNaN(lat) || isNaN(lng)) return null; 

                                  return (
                                    <Marker key={driver.id} position={[lat, lng]} icon={driverIcon}>
                                      <Popup><div className="text-right font-black">{driver.name}</div></Popup>
                                    </Marker>
                                  );
                                })}
                            </MapContainer>
                        </div>
                        <div className="space-y-4 overflow-y-auto max-h-[500px] pb-10">
                            <h3 className="font-black text-xl italic p-2 flex items-center gap-2">
                                <Truck className="text-orange-500 w-5 h-5"/> الطلبات النشطة
                            </h3>
                            {activeRequests.map(req => (
                                <div key={req.id} className="bg-white p-5 rounded-[30px] shadow-sm border-r-4 border-orange-500">
                                    <div className="flex justify-between mb-2 text-[10px] font-black">
                                        <span className="text-gray-400">#ID: {req.id}</span>
                                        <span className="text-orange-600">{req.customerPhone}</span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-600 mb-4 truncate">{req.pickupAddress}</p>
                                    <div className="flex gap-2">
                                        <Button onClick={() => setAssigningRequest(req)} className="flex-1 bg-slate-900 rounded-xl h-10 text-[10px] font-black">تحويل</Button>
                                        <Button onClick={() => deleteRequestMutation.mutate(req.id)} variant="ghost" className="w-10 h-10 bg-red-50 text-red-500 rounded-xl"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === "requests" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="requests-view" className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 italic px-2">طلبات الانضمام ({pendingDrivers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingDrivers.map((driver) => (
                            <div key={driver.id} className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-orange-500" />
                                <div className="flex gap-4 mb-6">
                                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-xl text-orange-500 font-bold">{driver.name?.charAt(0)}</div>
                                    <div>
                                        <h4 className="font-black text-lg text-slate-800">{driver.name}</h4>
                                        <p className="text-xs text-gray-400 font-bold">{driver.city}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button onClick={() => approveMutation.mutate(driver.id)} className="flex-1 bg-orange-500 text-white rounded-[20px] font-black h-14">تفعيل</Button>
                                    <Button onClick={() => deleteMutation.mutate(driver.id)} variant="ghost" className="w-14 h-14 bg-red-50 text-red-500 rounded-[20px]"><Trash2 /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === "all-drivers" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="all-drivers" className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 italic px-2">إدارة السائقين ({approvedDrivers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {approvedDrivers.map(driver => (
                            <div key={driver.id} className="bg-white p-5 rounded-[30px] shadow-sm flex items-center justify-between border border-gray-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <span className="font-black text-slate-800 text-lg">{driver.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Wallet className="w-3 h-3 text-orange-500" />
                                        <span className="text-[10px] font-black text-blue-600">{driver.walletBalance} د.ع</span>
                                    </div>
                                </div>
                                <Button onClick={() => deleteMutation.mutate(driver.id)} variant="ghost" className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl"><Trash2 className="w-5 h-5" /></Button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* FINANCE TAB - الإضافة الجديدة */}
            {activeTab === "finance" && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key="finance-view" className="space-y-6">
                    <h2 className="text-2xl font-black italic px-2">السجل المالي العام</h2>
                    <div className="bg-white rounded-[40px] shadow-sm overflow-hidden border border-gray-100">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase">
                                <tr>
                                    <th className="px-6 py-4">التاريخ</th>
                                    <th className="px-6 py-4">نوع العملية</th>
                                    <th className="px-6 py-4">المبلغ</th>
                                    <th className="px-6 py-4">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {allTransactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(tx.createdAt).toLocaleString('ar-EG')}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {tx.type === 'deposit' ? <CreditCard className="w-4 h-4 text-green-500"/> : <TrendingUp className="w-4 h-4 text-blue-500"/>}
                                                <span className="font-black text-slate-700 text-sm">{tx.type === 'deposit' ? 'شحن محفظة' : 'عمولة رحلة'}</span>
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 font-black ${tx.amount > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                                            {tx.amount.toLocaleString()} د.ع
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-green-100 text-green-600 text-[10px] px-2 py-1 rounded-full font-black">مكتمل</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {allTransactions.length === 0 && (
                            <div className="py-20 text-center text-gray-400 font-bold">لا توجد عمليات مالية مسجلة بعد</div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* بقية التبويبات (Online Drivers, Active Requests) تبقى كما هي في كودك الأصلي */}
            {activeTab === "online-drivers-tab" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key="online-view" className="space-y-6">
                    <h2 className="text-2xl font-black italic px-2">السائقين المتصلين الآن</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {onlineDrivers.map(driver => {
                            const currentJob = allRequests.find(r => r.driverId === driver.id && r.status === 'accepted');
                            return (
                                <div key={driver.id} className="bg-white p-6 rounded-[35px] shadow-sm border-t-4 border-green-500">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-black text-lg">{driver.name}</h4>
                                            <p className="text-[10px] font-black text-orange-500">المحفظة: {driver.walletBalance} د.ع</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${currentJob ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {currentJob ? 'مشغول بطلب' : 'متاح'}
                                        </span>
                                    </div>
                                    {currentJob && (
                                        <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-xs font-bold">
                                            <p className="mb-2">الطلب: {currentJob.pickupAddress}</p>
                                            <div className="flex gap-2 mt-2">
                                                <Button onClick={() => completeRequestMutation.mutate(currentJob.id)} className="flex-1 bg-green-600 h-8 text-[10px] font-black">إنهاء الطلب</Button>
                                                <Button onClick={() => setAssigningRequest(currentJob)} className="flex-1 bg-slate-800 h-8 text-[10px] font-black">تحويل</Button>
                                            </div>
                                        </div>
                                    )}
                                    <Button onClick={() => deleteMutation.mutate(driver.id)} variant="ghost" className="w-full text-red-500 text-[10px] hover:bg-red-50 rounded-xl h-10 mt-2">حذف بيانات السائق</Button>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}
            
            {activeTab === "active-requests-tab" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key="requests-active-view" className="space-y-6">
                    <h2 className="text-2xl font-black italic px-2">جميع الطلبات النشطة</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeRequests.map(req => (
                            <div key={req.id} className="bg-white p-6 rounded-[30px] shadow-sm flex justify-between items-center border-l-8 border-orange-500">
                                <div>
                                    <p className="font-black text-slate-800">#ID: {req.id} - {req.customerPhone}</p>
                                    <p className="text-xs text-gray-400 font-bold italic">{req.pickupAddress}</p>
                                    <p className="text-[10px] mt-2 font-black text-orange-600 uppercase">{req.status === 'accepted' ? 'جاري التنفيذ' : 'ينتظر سائق'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => setAssigningRequest(req)} className="bg-orange-500 rounded-xl text-[10px] h-10 font-black px-4">تحويل لكابتن</Button>
                                    <Button onClick={() => deleteRequestMutation.mutate(req.id)} variant="ghost" className="bg-red-50 text-red-500 rounded-xl h-10 w-10"><Trash2 className="w-4 h-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modals Section (Keep as originally implemented) */}
        <AnimatePresence>
          {assigningRequest && (
            <div className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b flex justify-between items-center">
                  <h3 className="font-black">تحويل الطلب #{assigningRequest.id}</h3>
                  <button onClick={() => setAssigningRequest(null)}><XCircle /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {onlineDrivers.length > 0 ? (
                    onlineDrivers.map(driver => (
                      <div 
                        key={driver.id} onClick={() => setSelectedDriverForAssign(driver)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${selectedDriverForAssign?.id === driver.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}
                      >
                        <div className="flex flex-col">
                            <span className="font-black text-sm">{driver.name}</span>
                            <span className="text-[10px] text-gray-400">الرصيد: {driver.walletBalance} د.ع</span>
                        </div>
                        {selectedDriverForAssign?.id === driver.id && <CheckCircle2 className="text-orange-500" />}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-400 py-10 font-bold">لا يوجد سائقين متصلين حالياً</p>
                  )}
                </div>
                <div className="p-6">
                   <Button 
                    disabled={!selectedDriverForAssign} 
                    onClick={() => setShowConfirmModal(true)} 
                    className="w-full bg-orange-500 h-14 rounded-2xl font-black shadow-lg shadow-orange-500/20"
                   >
                    تحويل الآن
                   </Button>
                </div>
              </div>
            </div>
          )}

          {showConfirmModal && (
            <div className="fixed inset-0 z-[7000] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
              <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center">
                <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
                <h4 className="text-xl font-black mb-2">تأكيد التحويل</h4>
                <p className="text-gray-500 text-sm mb-8 font-bold">سيتم تحويل الطلب للكابتن {selectedDriverForAssign?.name}</p>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => assignMutation.mutate({ requestId: assigningRequest!.id, driverId: selectedDriverForAssign!.id })} 
                    className="flex-1 bg-black text-white h-14 rounded-2xl font-black"
                  >
                    نعم، حول
                  </Button>
                  <Button 
                    onClick={() => setShowConfirmModal(false)} 
                    variant="outline" 
                    className="flex-1 h-14 rounded-2xl font-black border-2"
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}