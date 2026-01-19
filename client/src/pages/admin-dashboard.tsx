import { useState, useMemo } from "react";
import {
  Users, Truck, Map as MapIcon, ShieldCheck,
  Power, CheckCircle2, XCircle, Menu, Activity,
  Search, Trash2, ArrowLeftRight, ChevronLeft,
  UserPlus, AlertCircle, Phone, MapPin, Wallet, TrendingUp, CreditCard, Clock, ShieldAlert, Settings2, Coins, Plus, Minus, ExternalLink, Loader2
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

// أيقونة السائق على الخريطة
const driverIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("map");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newCommission, setNewCommission] = useState(""); 

  const [assigningRequest, setAssigningRequest] = useState<Request | null>(null);
  const [selectedDriverForAssign, setSelectedDriverForAssign] = useState<Driver | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // التحكم بنافذة تفاصيل الزبون
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [customerWalletAmount, setCustomerWalletAmount] = useState("");

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // --- Queries ---
  const { data: allDrivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  
  // القائمة العامة للطلبات مع تحديث تلقائي
  const { data: allRequests = [] } = useQuery<Request[]>({ 
    queryKey: ["/api/requests"], 
    refetchInterval: 3000 
  });

  // +++ إضافة (Deep Logic Fix): جلب تفاصيل الطلب الفردي مباشرة من السيرفر لضمان دقة الرصيد +++
  const { data: specificOrderData } = useQuery<Request>({
    queryKey: ["/api/requests", selectedOrderId], 
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const res = await apiRequest("GET", `/api/requests/${selectedOrderId}`);
      return res.json();
    },
    enabled: !!selectedOrderId,
    refetchInterval: 1000, 
  });

  // توحيد مصدر البيانات للنافذة المنبثقة
  const selectedOrderDetails = useMemo(() => {
    if (specificOrderData) return specificOrderData;
    return allRequests.find(r => r.id === selectedOrderId);
  }, [allRequests, specificOrderData, selectedOrderId]);

  const { data: allTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: activeTab === "finance"
  });

  const { data: systemSettings } = useQuery<any>({
    queryKey: ["/api/admin/settings"],
    enabled: activeTab === "finance"
  });

  // حساب أرباح النظام
  const systemEarnings = useMemo(() => {
    return allTransactions
      .filter(t => t.type === 'fee' || t.type === 'commission')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  }, [allTransactions]);

  // دالة فتح الموقع في خرائط جوجل (تم تحسين الرابط)
  const handleOpenLocation = (lat: any, lng: any) => {
    if (!lat || !lng) {
      toast({ variant: "destructive", title: "موقع الزبون غير متاح لهذا الطلب" });
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // --- Mutations ---

  // تحديث محفظة الزبون
  const updateCustomerWalletMutation = useMutation({
    mutationFn: async ({ customerPhone, amount }: { customerPhone: string, amount: number }) => {
      if (!amount || isNaN(amount)) throw new Error("مبلغ غير صالح");
      return await apiRequest("POST", "/api/admin/customers/adjust-wallet", { 
        customerPhone, 
        amount: Number(amount)
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/requests", selectedOrderId] });
      toast({ title: "تم تحديث محفظة الزبون بنجاح" });
      setCustomerWalletAmount("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "فشل تحديث المحفظة", description: error.message });
    }
  });

  // تعيين سائق لطلب
  const assignMutation = useMutation({
    mutationFn: async ({ requestId, driverId }: { requestId: number, driverId: number }) => {
      return await apiRequest("PATCH", `/api/requests/${requestId}`, { 
        driverId: Number(driverId),
        status: "accepted" 
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setAssigningRequest(null);
      setSelectedDriverForAssign(null);
      setShowConfirmModal(false);
      setSelectedOrderId(null);
      toast({ title: "تم تحويل الطلب وتعيين السائق بنجاح" });
    },
    onError: () => {
        toast({ variant: "destructive", title: "فشل في عملية تحويل الطلب" });
    }
  });

  // تحديث العمولة
  const updateCommissionMutation = useMutation({
    mutationFn: async (amount: number) => {
      return await apiRequest("POST", "/api/admin/settings/commission", { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "تم تحديث قيمة العمولة بنجاح" });
      setNewCommission("");
    }
  });

  // تغيير حالة الحساب (حظر/تفعيل)
  const toggleAccountStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      return await apiRequest("PATCH", `/api/drivers/${id}`, { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: variables.status === "blocked" ? "تم إغلاق الحساب" : "تم تفعيل الحساب" });
    }
  });

  // تغيير حالة الاتصال
  const toggleOnlineMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: boolean }) => {
      return await apiRequest("PATCH", `/api/drivers/${id}`, { isOnline: status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/drivers"] })
  });

  // تحديث رصيد السائق
  const updateWalletMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: number, amount: number }) => {
      return await apiRequest("PATCH", `/api/drivers/${id}`, { walletBalance: Number(amount) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم تحديث محفظة السائق" });
    }
  });

  // قبول سائق جديد
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/drivers/${id}`, { status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم تفعيل الكابتن بنجاح" });
    }
  });

  // حذف سائق
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ variant: "destructive", title: "تم الحذف بنجاح" });
    }
  });

  // حذف طلب
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/requests/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ variant: "destructive", title: "تم حذف الطلب" });
    }
  });

  // إكمال طلب يدوياً
  const completeRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/requests/${id}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "تم إكمال الطلب" });
    }
  });

  // --- منطق الفلترة ---
  const filteredDrivers = useMemo(() => {
    return allDrivers.filter(d => {
      const searchLower = searchQuery.toLowerCase().trim();
      return (d.name || "").toLowerCase().includes(searchLower) || (d.phone || "").includes(searchLower);
    });
  }, [allDrivers, searchQuery]);

  const pendingDrivers = filteredDrivers.filter(d => d.status === "pending");
  const approvedDrivers = filteredDrivers.filter(d => d.status === "approved" || d.status === "blocked");
  const onlineDrivers = allDrivers.filter(d => d.isOnline && d.status === 'approved');
  
  const pendingRequestsOnly = useMemo(() => {
    return allRequests.filter(r => 
      r.status === "pending" && 
      (r.customerPhone.includes(searchQuery) || (r.pickupAddress || "").includes(searchQuery))
    );
  }, [allRequests, searchQuery]);

  const stats = [
    { id: "online-drivers-tab", label: "سائقين متصلين", value: onlineDrivers.length.toString(), icon: <Activity className="text-green-500" />, color: "bg-green-50" },
    { id: "active-requests-tab", label: "طلبات بانتظار سائق", value: pendingRequestsOnly.length.toString(), icon: <Truck className="text-orange-500" />, color: "bg-orange-50" },
    { id: "finance", label: "أرباح النظام (د.ع)", value: systemEarnings.toLocaleString(), icon: <TrendingUp className="text-blue-500" />, color: "bg-blue-50" },
  ];

  // مكون بطاقة السائق (DriverCard)
  const DriverCard = ({ driver }: { driver: Driver }) => {
    const currentJob = allRequests.find(r => r.driverId === driver.id && r.status === 'accepted');
    const isAccountActive = driver.status === "approved";
    const isOnline = !!driver.isOnline;
    const isUpdating = toggleOnlineMutation.isPending || toggleAccountStatusMutation.isPending;

    return (
      <div className={`p-6 rounded-[35px] shadow-sm border transition-all duration-300 ${!isAccountActive ? 'bg-gray-100 border-red-100' : 'bg-white border-gray-100'} flex flex-col gap-4 relative overflow-hidden ${isUpdating ? 'opacity-70 pointer-events-none' : ''}`}>
        <div className="flex justify-end gap-6 mb-[-10px] z-10">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">اتصال</span>
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAccountActive) {
                    toggleOnlineMutation.mutate({ id: driver.id, status: !isOnline });
                  } else {
                    toast({ variant: "destructive", title: "الحساب مغلق حالياً" });
                  }
                }}
                className={`relative w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 shadow-inner ${isOnline && isAccountActive ? 'bg-green-500' : 'bg-slate-300'} ${!isAccountActive ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <motion.div layout transition={{ type: "spring", stiffness: 700, damping: 30 }} className={`bg-white w-5 h-5 rounded-full shadow-md flex items-center justify-center ${isOnline && isAccountActive ? 'mr-auto' : 'ml-auto'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isOnline && isAccountActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                </motion.div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">الحساب</span>
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  const nextStatus = isAccountActive ? "blocked" : "approved";
                  toggleAccountStatusMutation.mutate({ id: driver.id, status: nextStatus });
                  if (isAccountActive) toggleOnlineMutation.mutate({ id: driver.id, status: false });
                }}
                className={`relative w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 shadow-inner ${isAccountActive ? 'bg-orange-500' : 'bg-red-500'}`}
              >
                <motion.div layout transition={{ type: "spring", stiffness: 700, damping: 30 }} className={`bg-white w-5 h-5 rounded-full shadow-md flex items-center justify-center ${isAccountActive ? 'mr-auto' : 'ml-auto'}`}>
                    {isAccountActive ? <CheckCircle2 className="w-3 h-3 text-orange-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                </motion.div>
              </div>
            </div>
        </div>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isOnline && isAccountActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                <div className="flex flex-col">
                  <span className="font-black text-slate-800 text-lg leading-tight">{driver.name}</span>
                  {!isAccountActive && <span className="text-[9px] text-red-500 font-black">الحساب مغلق مؤقتاً</span>}
                </div>
            </div>
            <Button onClick={(e) => { e.stopPropagation(); if(confirm('هل أنت متأكد من حذف الكابتن نهائياً؟')) deleteMutation.mutate(driver.id); }} variant="ghost" className="w-10 h-10 text-red-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </Button>
        </div>
        {currentJob ? (
            <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100">
                <p className="text-[10px] font-black text-orange-600 mb-1">الطلب الحالي الموكل إليه:</p>
                <p className="text-xs font-bold text-slate-700 truncate">{currentJob.pickupAddress}</p>
                <div className="flex gap-2 mt-2">
                   <Button onClick={(e) => { e.stopPropagation(); completeRequestMutation.mutate(currentJob.id); }} className="flex-1 bg-green-600 h-8 text-[9px] text-white">إنهاء</Button>
                   <Button onClick={(e) => { e.stopPropagation(); setAssigningRequest(currentJob); }} className="flex-1 bg-slate-800 h-8 text-[9px] text-white">تحويل</Button>
                </div>
            </div>
        ) : (
            <div className="h-[74px] flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl">
                <p className="text-[10px] font-bold text-gray-400 italic">لا يوجد طلب نشط</p>
            </div>
        )}
        <div className="space-y-3 pt-2 border-t">
            <span className="text-[10px] font-black text-gray-400">الرصيد: {driver.walletBalance} د.ع</span>
            <div className="flex gap-2">
                <input id={`wallet-${driver.id}`} type="number" placeholder="المبلغ" className="flex-1 bg-gray-50 border rounded-xl px-3 text-xs font-bold h-10 outline-none" />
                <Button 
                  disabled={updateWalletMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    const val = (document.getElementById(`wallet-${driver.id}`) as HTMLInputElement).value;
                    if(val) updateWalletMutation.mutate({ id: driver.id, amount: Number(val) });
                }} className="bg-slate-950 text-white rounded-xl text-[10px] h-10 px-4 font-black">تحديث</Button>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F3F4F6] font-sans" dir="rtl">
      {/* القائمة الجانبية */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 fixed md:relative z-[5000] w-72 h-full bg-slate-950 text-white flex flex-col p-6 shadow-2xl transition-transform duration-500`}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2.5 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldCheck className="w-6 h-6 text-white" /></div>
            <div>
                <h1 className="text-xl font-black italic">SATHA <span className="text-orange-500">ADMIN</span></h1>
                <p className="text-[10px] text-slate-500 font-bold">لوحة التحكم</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><XCircle /></button>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => { setActiveTab("map"); setIsSidebarOpen(false); }} className={`w-full flex items-center p-4 rounded-[20px] font-black transition-all ${activeTab === "map" ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
            <MapIcon className="w-5 h-5 ml-4" /> الخريطة الحية
          </button>
          <button onClick={() => { setActiveTab("requests"); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-[20px] font-black transition-all ${activeTab === "requests" ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
            <div className="flex items-center gap-4"><UserPlus className="w-5 h-5" /> طلبات الانضمام</div>
            {pendingDrivers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingDrivers.length}</span>}
          </button>
          <button onClick={() => { setActiveTab("all-drivers"); setIsSidebarOpen(false); }} className={`w-full flex items-center p-4 rounded-[20px] font-black transition-all ${activeTab === "all-drivers" ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
            <Users className="w-5 h-5 ml-4" /> إدارة السائقين
          </button>
          <button onClick={() => { setActiveTab("finance"); setIsSidebarOpen(false); }} className={`w-full flex items-center p-4 rounded-[20px] font-black transition-all ${activeTab === "finance" ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
            <Wallet className="w-5 h-5 ml-4" /> المالية والأرباح
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden text-right">
        <header className="h-24 bg-white border-b px-6 flex items-center justify-between z-[1000]">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-3 bg-gray-100 rounded-2xl"><Menu /></button>
          <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="ابحث عن كابتن أو طلب..." className="bg-gray-100 rounded-2xl pr-12 pl-6 py-3 w-64 md:w-[450px] font-bold text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </header>

        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          {/* شريط الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {stats.map((stat) => (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={stat.id} onClick={() => setActiveTab(stat.id)} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer border hover:border-orange-500 transition-all">
                      <div>
                          <p className="text-xs font-black text-gray-400 mb-1">{stat.label}</p>
                          <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
                      </div>
                      <div className={`${stat.color} p-4 rounded-2xl`}>{stat.icon}</div>
                  </motion.div>
              ))}
        </div>

          <AnimatePresence mode="wait">
            {activeTab === "map" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="map-view" className="h-[600px]">
                    <div className="w-full h-full bg-white rounded-[45px] shadow-2xl overflow-hidden border-[12px] border-white relative">
                        <MapContainer center={[33.3152, 44.3661]} zoom={11} style={{ height: "100%", width: "100%" }}>
                            <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                            {onlineDrivers.map(driver => {
                              const lat = parseFloat(driver.lastLat || "");
                              const lng = parseFloat(driver.lastLng || "");
                              if (isNaN(lat) || isNaN(lng)) return null; 
                              return (
                                <Marker key={driver.id} position={[lat, lng]} icon={driverIcon}>
                                  <Popup><div className="text-right font-black">{driver.name}</div></Popup></Marker>
                              );
                            })}
                        </MapContainer>
                    </div>
                </motion.div>
            )}

            {(activeTab === "all-drivers" || activeTab === "online-drivers-tab") && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="drivers-list" className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 italic px-2">إدارة الكباتن</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(activeTab === "online-drivers-tab" ? onlineDrivers : approvedDrivers).map(driver => (
                            <DriverCard key={driver.id} driver={driver} />
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === "active-requests-tab" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key="requests-active-view" className="space-y-6">
                    <h2 className="text-2xl font-black italic px-2">الطلبات النشطة (بانتظار سائق: {pendingRequestsOnly.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingRequestsOnly.map(req => (
                            <div 
                              key={req.id} 
                              onClick={() => setSelectedOrderId(req.id)}
                              className="bg-white p-6 rounded-[30px] shadow-sm flex justify-between items-center border-l-8 border-orange-500 cursor-pointer hover:bg-gray-50 transition-all group"
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-black text-slate-800">#ID: {req.id}</p>
                                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-black">{req.customerPhone}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 font-bold truncate w-48">{req.pickupAddress}</p>
                                    <p className="text-[10px] mt-2 font-black text-orange-600 uppercase flex items-center gap-1">
                                      بانتظار سائق
                                      <ChevronLeft className="w-3 h-3 group-hover:translate-x-[-4px] transition-transform" />
                                    </p>
                                </div>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button onClick={() => setAssigningRequest(req)} className="bg-orange-500 rounded-xl text-[10px] h-10 font-black px-4 text-white hover:bg-orange-600">تحويل للسائق</Button>
                                    <Button onClick={() => {if(confirm('هل تريد حذف هذا الطلب؟')) deleteRequestMutation.mutate(req.id)}} variant="ghost" className="bg-red-50 text-red-500 rounded-xl h-10 w-10 hover:bg-red-100"><Trash2 className="w-4 h-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === "requests" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="requests-view" className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 italic px-2">طلبات الانضمام ({pendingDrivers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingDrivers.map((driver) => (
                            <div key={driver.id} className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 group-hover:w-3 transition-all" />
                                <div className="flex gap-4 mb-6">
                                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-xl text-orange-500 font-bold">{driver.name?.charAt(0)}</div>
                                    <div>
                                        <h4 className="font-black text-lg text-slate-800">{driver.name}</h4>
                                        <p className="text-xs text-gray-400 font-bold">{driver.city}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button 
                                      disabled={approveMutation.isPending}
                                      onClick={() => approveMutation.mutate(driver.id)} 
                                      className="flex-1 bg-orange-500 text-white rounded-[20px] font-black h-14 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                                    >
                                      {approveMutation.isPending ? <Loader2 className="animate-spin" /> : "تفعيل"}
                                    </Button>
                                    <Button onClick={() => {if(confirm('رفض طلب الانضمام؟')) deleteMutation.mutate(driver.id)}} variant="ghost" className="w-14 h-14 bg-red-50 text-red-500 rounded-[20px] hover:bg-red-100"><Trash2 /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === "finance" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key="finance-view" className="space-y-8">
                    <h2 className="text-2xl font-black italic px-2">إدارة المالية والعمولات</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-slate-950 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-orange-500 p-3 rounded-2xl shadow-lg"><Coins className="w-6 h-6 text-white" /></div>
                                    <span className="font-black text-lg italic tracking-tight">عمولة النظام</span>
                                </div>
                                <p className="text-slate-400 text-xs font-bold mb-2">القيمة الحالية لكل طلب</p>
                                <div className="flex items-baseline gap-2 mb-8">
                                    <h4 className="text-4xl font-black text-orange-500">{systemSettings?.commissionAmount?.toLocaleString() || "1,000"}</h4>
                                    <span className="text-xs font-black text-slate-500">د.ع</span>
                                </div>
                                <div className="space-y-4">
                                    <input type="number" value={newCommission} onChange={(e) => setNewCommission(e.target.value)} placeholder="أدخل القيمة الجديدة..." className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 px-4 text-sm font-black text-white focus:border-orange-500 outline-none" />
                                    <Button 
                                      disabled={updateCommissionMutation.isPending}
                                      onClick={() => { if(!newCommission) return toast({ title: "يرجى إدخال مبلغ" }); updateCommissionMutation.mutate(Number(newCommission)); }} 
                                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black h-14 rounded-2xl shadow-xl"
                                    >
                                      {updateCommissionMutation.isPending ? "جاري التحديث..." : "تحديث العمولة الآن"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- النوافذ المنبثقة (Modals) --- */}
        <AnimatePresence>
          {selectedOrderDetails && (
            <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedOrderId(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                
                <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-20">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedOrderId(null)} className="rounded-full bg-gray-100"><XCircle className="w-5 h-5" /></Button>
                  <div className="text-center">
                    <h3 className="font-black text-xl text-gray-800">تفاصيل الزبون والطلب</h3>
                    <p className="text-[11px] text-orange-500 font-bold bg-orange-50 px-3 py-1 rounded-full mt-1">رقم الطلب #{selectedOrderDetails.id}</p>
                  </div>
                  <div className="w-10" />
                </div>

                <div className="overflow-y-auto p-6 space-y-6">
                  <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-[30px] border border-gray-100">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border">👤</div>
                    <div className="flex-1">
                      <h4 className="font-black text-lg text-slate-800">زبون ساطحة</h4>
                      <p className="font-bold text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedOrderDetails.customerPhone}</p>
                    </div>
                    <a href={`tel:${selectedOrderDetails.customerPhone}`} className="bg-green-500 text-white p-4 rounded-2xl shadow-lg shadow-green-500/20 active:scale-95 transition-transform"><Phone className="w-6 h-6" /></a>
                  </div>

                  <div className="bg-slate-950 text-white p-6 rounded-[35px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">رصيد المحفظة الحالي</p>
                          <h3 className="text-4xl font-black text-white flex items-baseline gap-2">
                            {(selectedOrderDetails.customerWalletBalance || 0).toLocaleString()}
                            <span className="text-sm font-bold text-orange-500">د.ع</span>
                          </h3>
                        </div>
                        <Wallet className="w-8 h-8 text-orange-500 opacity-50" />
                      </div>
                      
                      <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                        <div className="relative">
                          <input 
                            type="number" 
                            value={customerWalletAmount} 
                            onChange={(e) => setCustomerWalletAmount(e.target.value)} 
                            placeholder="أدخل المبلغ هنا..." 
                            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white font-black outline-none focus:border-orange-500 transition-all" 
                          />
                          <Coins className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        </div>
                        
                        <div className="flex gap-3">
                          <Button 
                            disabled={updateCustomerWalletMutation.isPending || !customerWalletAmount}
                            onClick={() => updateCustomerWalletMutation.mutate({ customerPhone: selectedOrderDetails.customerPhone, amount: Math.abs(Number(customerWalletAmount)) })} 
                            className="flex-1 bg-green-600 hover:bg-green-700 h-14 rounded-2xl font-black text-white flex items-center justify-center gap-2"
                          >
                            {updateCustomerWalletMutation.isPending ? <Loader2 className="animate-spin" /> : <><Plus className="w-5 h-5" /> إيداع</>}
                          </Button>
                          
                          <Button 
                            disabled={updateCustomerWalletMutation.isPending || !customerWalletAmount}
                            onClick={() => updateCustomerWalletMutation.mutate({ customerPhone: selectedOrderDetails.customerPhone, amount: -Math.abs(Number(customerWalletAmount)) })} 
                            className="flex-1 bg-red-600 hover:bg-red-700 h-14 rounded-2xl font-black text-white flex items-center justify-center gap-2"
                          >
                            {updateCustomerWalletMutation.isPending ? <Loader2 className="animate-spin" /> : <><Minus className="w-5 h-5" /> خصم</>}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                      <p className="text-[10px] text-gray-400 font-black mb-1">نوع السطحة</p>
                      <div className="flex items-center gap-2 font-black text-slate-700 text-sm"><Truck className="w-4 h-4 text-orange-500" /> {selectedOrderDetails.vehicleType || "عادية"}</div>
                    </div>
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[10px] text-gray-400 font-black mb-1">حالة الطلب</p>
                      <div className="flex items-center gap-2 font-black text-blue-600 text-sm"><Clock className="w-4 h-4" /> بانتظار سائق</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleOpenLocation(selectedOrderDetails.pickupLat, selectedOrderDetails.pickupLng)}
                    className="bg-gray-50 p-5 rounded-[25px] border border-gray-100 space-y-4 cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="bg-orange-500/10 p-2 rounded-lg mt-1 group-hover:bg-orange-500 transition-colors">
                          <MapPin className="w-4 h-4 text-orange-600 group-hover:text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-black">موقع الاستلام (اضغط لفتح الخريطة)</p>
                          <p className="font-bold text-sm text-gray-700 leading-relaxed">{selectedOrderDetails.pickupAddress}</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-orange-500" />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border-t flex gap-3 sticky bottom-0 z-20">
                  <Button onClick={() => { setAssigningRequest(selectedOrderDetails); }} className="flex-1 h-15 rounded-2xl bg-orange-500 hover:bg-orange-600 font-black text-white shadow-xl shadow-orange-500/20 text-lg">تحويل الطلب لسائق</Button>
                  <Button onClick={() => { if(confirm('هل أنت متأكد من حذف الطلب نهائياً؟')) deleteRequestMutation.mutate(selectedOrderDetails.id); setSelectedOrderId(null); }} variant="outline" className="h-15 w-15 rounded-2xl border-red-100 text-red-500 hover:bg-red-50"><Trash2 className="w-6 h-6" /></Button>
                </div>
              </motion.div>
            </div>
          )}

          {/* نافذة تحويل الطلب */}
          {assigningRequest && (
            <div className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b flex justify-between items-center font-black">
                  <h3>تحويل الطلب #{assigningRequest.id}</h3>
                  <button onClick={() => setAssigningRequest(null)}><XCircle className="text-gray-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {onlineDrivers.map(driver => (
                    <div key={driver.id} onClick={() => setSelectedDriverForAssign(driver)} className={`p-4 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${selectedDriverForAssign?.id === driver.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <div className="flex flex-col"><span className="font-black text-sm">{driver.name}</span><span className="text-[10px] text-gray-400">الرصيد: {driver.walletBalance} د.ع</span></div>
                      {selectedDriverForAssign?.id === driver.id && <CheckCircle2 className="text-orange-500" />}
                    </div>
                  ))}
                </div>
                <div className="p-6">
                   <Button disabled={!selectedDriverForAssign} onClick={() => setShowConfirmModal(true)} className="w-full bg-orange-500 h-14 rounded-2xl font-black text-white hover:bg-orange-600">تأكيد التحويل الآن</Button>
                </div>
              </div>
            </div>
          )}

          {/* نافذة تأكيد الإرسال */}
          {showConfirmModal && (
            <div className="fixed inset-0 z-[7000] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
              <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center">
                <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
                <h4 className="text-xl font-black mb-2">تأكيد الإرسال</h4>
                <p className="text-gray-500 text-sm mb-8 font-bold">بمجرد التأكيد، سيتم توجيه الكابتن {selectedDriverForAssign?.name} فوراً لموقع الطلب.</p>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => assignMutation.mutate({ requestId: assigningRequest!.id, driverId: selectedDriverForAssign!.id })} 
                    disabled={assignMutation.isPending}
                    className="flex-1 bg-black text-white h-14 rounded-2xl font-black"
                  >
                    {assignMutation.isPending ? "جاري التحويل..." : "نعم، حول الآن"}
                  </Button>
                  <Button onClick={() => setShowConfirmModal(false)} variant="outline" className="flex-1 h-14 rounded-2xl font-black">إلغاء</Button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}