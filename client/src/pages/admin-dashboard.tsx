import { useState, useMemo, useEffect } from "react";
import {
  Users, Truck, Map as MapIcon, ShieldCheck,
  CheckCircle2, XCircle, Menu, Activity,
  Search, Trash2, ChevronRight,
  UserPlus, AlertCircle, Phone, MapPin, Wallet, TrendingUp,
  Coins, Plus, Minus, ExternalLink, Loader2, Clock,
  DollarSign, BarChart3, ArrowUpRight, Bell, LogOut,
  Star, Zap, Navigation
} from "lucide-react";
import AdminPricingPanel from "./admin-pricing-panel";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getSocket } from "@/lib/socket";

type Driver  = any;
type Request = any;

const VEHICLE_COLORS: Record<string, string> = {
  "سطحة":    "#f97316",
  "سحب":     "#3b82f6",
  "هيدروليك":"#8b5cf6",
};

const getDriverIcon = (vehicleType: string, isOnline: boolean) => {
  const color   = VEHICLE_COLORS[vehicleType] || "#f97316";
  const opacity = isOnline ? "1" : "0.4";
  return L.divIcon({
    html: `<div style="position:relative;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35))">
      <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="46" fill="${color}" opacity="${opacity}" stroke="white" stroke-width="6"/>
        <text x="50" y="65" font-size="42" text-anchor="middle" fill="white">🚛</text>
      </svg>
      ${isOnline ? '<div style="position:absolute;top:2px;right:2px;width:13px;height:13px;background:#22c55e;border:2.5px solid white;border-radius:50%"></div>' : ""}
    </div>`,
    className: "",
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  });
};

const socket = getSocket();

// ── Stat Card ──────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
  onClick?: () => void;
}
const StatCard = ({ label, value, icon, accent, sub, onClick }: StatCardProps) => (
  <motion.button
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
    onClick={onClick}
    className="bg-white rounded-[28px] p-7 text-right shadow-sm border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all w-full group"
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`${accent} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>{icon}</div>
      <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
    </div>
    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    <h3 className="text-4xl font-black text-slate-900 leading-none">{value}</h3>
    {sub && <p className="text-xs text-gray-400 font-bold mt-2">{sub}</p>}
  </motion.button>
);

// ── Nav Item ───────────────────────────────────────────────────────────────
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}
const NavItem = ({ icon, label, active, badge, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-black text-sm transition-all ${
      active
        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`}
  >
    <div className="flex items-center gap-3">{icon}<span>{label}</span></div>
    {badge !== undefined && badge > 0 && (
      <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
        {badge}
      </span>
    )}
  </button>
);

export default function AdminDashboard() {
  const [activeTab, setActiveTab]   = useState("map");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newCommission, setNewCommission] = useState("");

  const [assigningRequest, setAssigningRequest]       = useState<Request | null>(null);
  const [selectedDriver, setSelectedDriver]           = useState<Driver | null>(null);
  const [showConfirmModal, setShowConfirmModal]       = useState(false);
  const [selectedOrderId, setSelectedOrderId]         = useState<number | null>(null);
  const [customerWalletAmount, setCustomerWalletAmount] = useState("");
  const [driverToDelete, setDriverToDelete]           = useState<number | null>(null);
  const [driverLocations, setDriverLocations]         = useState<Record<number, { lat: number; lng: number }>>({});

  const [, setLocation] = useLocation();
  const { toast }       = useToast();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: allDrivers = [], refetch: refetchDrivers }   = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
    staleTime: 30_000,
  });

  const { data: allRequests = [], refetch: refetchRequests } = useQuery<Request[]>({
    queryKey: ["/api/requests?role=admin"],
    staleTime: 30_000,
  });

  const { data: specificOrder } = useQuery<Request>({
    queryKey: ["/api/requests", selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const res = await apiRequest("GET", `/api/requests/${selectedOrderId}`);
      return res.json();
    },
    enabled:   !!selectedOrderId,
    staleTime: 10_000,
  });

  const { data: allTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/transactions"],
    enabled:  activeTab === "finance",
  });

  const { data: systemSettings } = useQuery<any>({
    queryKey: ["/api/admin/settings"],
    enabled:  activeTab === "finance",
  });

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onRequestUpdated = () => {
      refetchRequests();
      if (selectedOrderId) {
        queryClient.invalidateQueries({ queryKey: ["/api/requests", selectedOrderId] });
      }
    };
    socket.on("request_updated",         onRequestUpdated);
    socket.on("request_deleted",         () => refetchRequests());
    socket.on("new_driver_registration", () => refetchDrivers());
    socket.on("order_accepted",          () => { refetchRequests(); refetchDrivers(); });
    socket.on("order_completed",         () => { refetchRequests(); refetchDrivers(); });
    return () => {
      socket.off("request_updated");
      socket.off("request_deleted");
      socket.off("new_driver_registration");
      socket.off("order_accepted");
      socket.off("order_completed");
    };
  }, [refetchRequests, refetchDrivers, selectedOrderId]);

  useEffect(() => {
    socket.on("driver_location_broadcast", (d: { driverId: number; lat: number; lng: number }) => {
      setDriverLocations(prev => ({ ...prev, [d.driverId]: { lat: d.lat, lng: d.lng } }));
    });
    allDrivers.forEach(driver => {
      socket.on(`location_changed_${driver.id}`, (d: { lat: number; lng: number }) => {
        setDriverLocations(prev => ({ ...prev, [driver.id]: d }));
      });
    });
    return () => {
      socket.off("driver_location_broadcast");
      allDrivers.forEach(driver => socket.off(`location_changed_${driver.id}`));
    };
  }, [allDrivers]);

  // ── Merged order detail ───────────────────────────────────────────────────
  const selectedOrderDetails = useMemo(() => {
    const fromList = allRequests.find(r => r.id === selectedOrderId);
    if (specificOrder) {
      const balance =
        specificOrder.customerWalletBalance ??
        specificOrder.walletBalance ??
        fromList?.customerWalletBalance ?? 0;
      return { ...specificOrder, customerWalletBalance: Number(balance) };
    }
    return fromList;
  }, [allRequests, specificOrder, selectedOrderId]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const onlineDrivers     = allDrivers.filter(d => d.isOnline && d.status === "approved");
  const approvedDrivers   = allDrivers.filter(d => d.status === "approved" || d.status === "blocked");
  const pendingDrivers    = allDrivers.filter(d => d.status === "pending");
  const pendingRequests   = allRequests.filter(r =>
    r.status === "pending" &&
    (r.customerPhone?.includes(searchQuery) || (r.location || "").includes(searchQuery))
  );
  const filteredDrivers   = approvedDrivers.filter(d =>
    (d.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.phone || "").includes(searchQuery)
  );
  const systemEarnings    = useMemo(() =>
    allTransactions.filter(t => t.type === "fee" || t.type === "commission")
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
    [allTransactions]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const adjustCustomerWallet = useMutation({
    mutationFn: ({ customerPhone, amount }: { customerPhone: string; amount: number }) =>
      apiRequest("POST", "/api/admin/customers/adjust-wallet", { customerPhone, amount: Number(amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", selectedOrderId] });
      toast({ title: "تم تحديث المحفظة", className: "bg-green-600 text-white" });
      setCustomerWalletAmount("");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ requestId, driverId }: { requestId: number; driverId: number }) => {
      const res = await apiRequest("POST", `/api/admin/requests/${requestId}/assign`, { driverId: Number(driverId) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setAssigningRequest(null); setSelectedDriver(null); setShowConfirmModal(false); setSelectedOrderId(null);
      toast({ title: "تم تحويل الطلب بنجاح", className: "bg-green-600 text-white" });
    },
    onError: () => toast({ variant: "destructive", title: "فشل في التحويل" }),
  });

  const updateCommission = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/admin/settings/commission", { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "تم تحديث العمولة", className: "bg-green-600 text-white" });
      setNewCommission("");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/drivers/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/drivers"] }),
  });

  const toggleOnline = useMutation({
    mutationFn: ({ id, status }: { id: number; status: boolean }) =>
      apiRequest("PATCH", `/api/drivers/${id}`, { isOnline: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/drivers"] }),
  });

  const updateWallet = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      apiRequest("PATCH", `/api/drivers/${id}`, { walletBalance: Number(amount).toString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم تحديث المحفظة" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/drivers/${id}`, { status: "approved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم تفعيل الكابتن", className: "bg-green-600 text-white" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/drivers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      refetchDrivers();
      toast({ title: "تم حذف الكابتن", description: "تم حذف الحساب بنجاح", className: "bg-red-600 text-white" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحذف", description: e?.message || "حاول مرة أخرى" }),
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ variant: "destructive", title: "تم حذف الطلب" });
    },
  });

  const forceComplete = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/requests/${id}/force-complete`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم إتمام الطلب", description: `خُصم ${data.fee} د.ع من السائق`, className: "bg-green-600 text-white" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإتمام", description: e.message }),
  });

  const deleteNoCommission = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/requests/${id}/delete-without-commission`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests?role=admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "تم حذف الطلب بدون عمولة", className: "bg-green-600 text-white" });
    },
  });

  const switchTab = (tab: string) => { setActiveTab(tab); setSidebarOpen(false); };

  // ── Driver Card ───────────────────────────────────────────────────────────
  const DriverCard = ({ driver }: { driver: Driver }) => {
    const job      = allRequests.find(r => r.driverId === driver.id && ["accepted","confirmed"].includes(r.status));
    const isActive = driver.status === "approved";
    const isOnline = !!driver.isOnline;
    const [walletInput, setWalletInput] = useState("");

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-[28px] border-2 overflow-hidden transition-all ${
          isActive ? "bg-white border-gray-100" : "bg-gray-50 border-red-100"
        }`}
      >
        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${isOnline && isActive ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gray-200"}`} />

        <div className="p-6">
          {/* Header row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black
                ${isOnline && isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {driver.name?.charAt(0) || "؟"}
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-base leading-tight">{driver.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${isOnline && isActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                  <span className={`text-[11px] font-black ${isOnline && isActive ? "text-green-600" : "text-gray-400"}`}>
                    {isOnline && isActive ? "متصل" : "غير متصل"}
                  </span>
                  {!isActive && <span className="text-[10px] text-red-500 font-black bg-red-50 px-2 py-0.5 rounded-full">موقوف</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Online toggle */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-gray-400">اتصال</span>
                <div
                  onClick={() => isActive && toggleOnline.mutate({ id: driver.id, status: !isOnline })}
                  className={`w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors flex items-center
                    ${isOnline && isActive ? "bg-green-500" : "bg-gray-300"} ${!isActive ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <motion.div layout transition={{ type: "spring", stiffness: 700, damping: 30 }}
                    className={`w-5 h-5 bg-white rounded-full shadow ${isOnline && isActive ? "ml-auto" : ""}`} />
                </div>
              </div>
              {/* Account toggle */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-gray-400">الحساب</span>
                <div
                  onClick={() => {
                    const next = isActive ? "blocked" : "approved";
                    toggleStatus.mutate({ id: driver.id, status: next });
                    if (isActive) toggleOnline.mutate({ id: driver.id, status: false });
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors flex items-center
                    ${isActive ? "bg-orange-500" : "bg-red-500"}`}
                >
                  <motion.div layout transition={{ type: "spring", stiffness: 700, damping: 30 }}
                    className={`w-5 h-5 bg-white rounded-full shadow flex items-center justify-center ${isActive ? "ml-auto" : ""}`}>
                    {isActive
                      ? <CheckCircle2 className="w-3 h-3 text-orange-500" />
                      : <XCircle className="w-3 h-3 text-red-500" />}
                  </motion.div>
                </div>
              </div>
              {/* Delete */}
              <button
                onClick={() => setDriverToDelete(driver.id)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Vehicle type + phone */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-black bg-orange-50 text-orange-600 px-3 py-1 rounded-xl">
              {driver.vehicleType || "سطحة"}
            </span>
            <a href={`tel:${driver.phone}`} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-green-600 transition-colors">
              <Phone className="w-3 h-3" /> {driver.phone}
            </a>
          </div>

          {/* Active job */}
          {job ? (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-orange-600 uppercase">طلب نشط #{job.id}</span>
                <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">مشغول</span>
              </div>
              <p className="text-xs font-bold text-gray-700 truncate mb-3">{job.location || job.pickupAddress}</p>
              <div className="flex gap-2">
                <button onClick={() => { if (confirm("إتمام الطلب؟")) forceComplete.mutate(job.id); }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black py-2 rounded-xl transition-all active:scale-95">
                  ✓ إتمام
                </button>
                <button onClick={() => { setAssigningRequest(job); setSelectedOrderId(null); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black py-2 rounded-xl transition-all active:scale-95">
                  ↻ تحويل
                </button>
                <button onClick={() => { if (confirm("حذف الطلب بدون عمولة؟")) deleteNoCommission.mutate(job.id); }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black py-2 rounded-xl transition-all active:scale-95">
                  🗑
                </button>
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl mb-4">
              <span className="text-[11px] font-bold text-gray-300">متاح للطلبات</span>
            </div>
          )}

          {/* Wallet */}
          <div className="space-y-2.5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-gray-400">الرصيد</span>
              <span className="text-sm font-black text-orange-600">{Number(driver.walletBalance).toLocaleString()} د.ع</span>
            </div>
            <div className="flex gap-2">
              <input
                value={walletInput}
                onChange={e => setWalletInput(e.target.value)}
                type="number"
                placeholder="المبلغ..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs font-bold h-9 outline-none focus:border-orange-400"
              />
              <button
                disabled={updateWallet.isPending || !walletInput}
                onClick={() => { if (walletInput) updateWallet.mutate({ id: driver.id, amount: Number(walletInput) }); setWalletInput(""); }}
                className="bg-slate-900 text-white rounded-xl text-[10px] h-9 px-3 font-black hover:bg-slate-800 disabled:opacity-50 transition-all"
              >
                تحديث
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden" dir="rtl">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {/* Mobile backdrop: tap outside to close */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[4999] bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <AnimatePresence>
        {/* Always render on md+; on mobile only render when open to avoid
            the translated-off-screen overlay that blocks all touch events */}
        <aside className={`
            ${sidebarOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none md:pointer-events-auto"}
            md:translate-x-0 fixed md:relative z-[5000] w-72 h-full
            bg-[#0C1427] text-white flex flex-col py-8 px-5 shadow-2xl
            transition-transform duration-300
          `}>
            {/* Logo */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-2xl shadow-lg shadow-orange-500/25">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight">
                    SATHA <span className="text-orange-500">CTRL</span>
                  </h1>
                  <p className="text-[10px] text-slate-500 font-bold">لوحة التحكم الرئيسية</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-1.5">
              <NavItem icon={<MapIcon className="w-5 h-5" />}     label="الخريطة الحية"    active={activeTab === "map"}          onClick={() => switchTab("map")} />
              <NavItem icon={<DollarSign className="w-5 h-5" />}  label="إعدادات التسعير"  active={activeTab === "pricing"}      onClick={() => switchTab("pricing")} />
              <NavItem icon={<Truck className="w-5 h-5" />}       label="إدارة الكباتن"    active={activeTab === "all-drivers"}  onClick={() => switchTab("all-drivers")} />
              <NavItem icon={<UserPlus className="w-5 h-5" />}    label="طلبات الانضمام"  active={activeTab === "requests"}     badge={pendingDrivers.length} onClick={() => switchTab("requests")} />
              <NavItem icon={<Activity className="w-5 h-5" />}    label="الطلبات النشطة"  active={activeTab === "active-requests-tab"} badge={pendingRequests.length} onClick={() => switchTab("active-requests-tab")} />
              <NavItem icon={<BarChart3 className="w-5 h-5" />}   label="المالية"          active={activeTab === "finance"}     onClick={() => switchTab("finance")} />
            </nav>

            {/* Bottom stats */}
            <div className="bg-white/5 rounded-2xl p-4 space-y-3 border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ملخص سريع</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">متصلون الآن</span>
                <span className="text-sm font-black text-green-400">{onlineDrivers.length} كابتن</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">طلبات معلقة</span>
                <span className="text-sm font-black text-orange-400">{pendingRequests.length} طلب</span>
              </div>
            </div>

            <button
              onClick={() => { localStorage.removeItem("adminAuth"); setLocation("/admin-login"); }}
              className="mt-5 flex items-center gap-2 text-slate-500 hover:text-red-400 text-xs font-black transition-colors px-2"
            >
              <LogOut className="w-4 h-4" /> تسجيل الخروج
            </button>
          </aside>
      </AnimatePresence>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-20 bg-white border-b border-gray-100 px-6 md:px-8 flex items-center justify-between shrink-0 z-50">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2.5 bg-gray-100 rounded-xl">
            <Menu className="w-5 h-5" />
          </button>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث عن كابتن أو طلب..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pr-11 pl-5 py-3 text-sm font-bold outline-none focus:border-orange-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-2 rounded-2xl">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-black text-green-700">{onlineDrivers.length} متصل</span>
            </div>
            {pendingRequests.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 px-4 py-2 rounded-2xl">
                <Bell className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-black text-orange-700">{pendingRequests.length} طلب</span>
              </div>
            )}
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard
              label="كباتن متصلين"
              value={onlineDrivers.length.toString()}
              icon={<Navigation className="w-5 h-5 text-green-600" />}
              accent="bg-green-50"
              sub="متاحون لاستقبال الطلبات"
              onClick={() => switchTab("all-drivers")}
            />
            <StatCard
              label="طلبات بانتظار سائق"
              value={pendingRequests.length.toString()}
              icon={<Zap className="w-5 h-5 text-orange-600" />}
              accent="bg-orange-50"
              sub="تحتاج إلى تعيين سائق"
              onClick={() => switchTab("active-requests-tab")}
            />
            <StatCard
              label="أرباح النظام"
              value={systemEarnings.toLocaleString()}
              icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
              accent="bg-blue-50"
              sub="إجمالي العمولات المحصلة (د.ع)"
              onClick={() => switchTab("finance")}
            />
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">

            {/* ── Pricing ── */}
            {activeTab === "pricing" && (
              <motion.div key="pricing" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AdminPricingPanel />
              </motion.div>
            )}

            {/* ── Map ── */}
            {activeTab === "map" && (
              <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-white rounded-[40px] overflow-hidden border-[10px] border-white shadow-2xl"
                style={{ height: "560px" }}
              >
                <MapContainer center={[33.3152, 44.3661]} zoom={11} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                  {onlineDrivers.map(driver => {
                    const loc = driverLocations[driver.id];
                    const lat = loc?.lat || parseFloat(driver.lastLat || "");
                    const lng = loc?.lng || parseFloat(driver.lastLng || "");
                    if (isNaN(lat) || isNaN(lng)) return null;
                    const job = allRequests.find(r => r.driverId === driver.id && r.status !== "completed");
                    return (
                      <Marker key={driver.id} position={[lat, lng]} icon={getDriverIcon(driver.vehicleType, driver.isOnline)}>
                        <Popup minWidth={220}>
                          <div className="text-right p-3 space-y-3" dir="rtl">
                            <div className="border-b pb-2">
                              <h3 className="font-black text-base">{driver.name}</h3>
                              <p className="text-sm text-orange-600 font-bold">{driver.vehicleType}</p>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">الرصيد:</span>
                                <span className="font-black text-orange-600">{Number(driver.walletBalance).toLocaleString()} د.ع</span>
                              </div>
                              {job && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">الطلب الحالي:</span>
                                  <span className="font-black text-blue-600">#{job.id}</span>
                                </div>
                              )}
                            </div>
                            <a href={`tel:${driver.phone}`}
                              className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-xl text-sm hover:bg-green-700 transition-colors">
                              <Phone className="w-3.5 h-3.5" /> اتصال
                            </a>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </motion.div>
            )}

            {/* ── Drivers ── */}
            {(activeTab === "all-drivers" || activeTab === "online-drivers-tab") && (
              <motion.div key="drivers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <h2 className="text-2xl font-black text-slate-900">
                  إدارة الكباتن
                  <span className="mr-3 text-sm font-bold text-gray-400">
                    ({filteredDrivers.length} كابتن)
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredDrivers.map(d => <DriverCard key={d.id} driver={d} />)}
                </div>
              </motion.div>
            )}

            {/* ── Active Requests ── */}
            {activeTab === "active-requests-tab" && (
              <motion.div key="requests-active" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <h2 className="text-2xl font-black text-slate-900">
                  الطلبات النشطة
                  <span className="mr-3 text-sm font-bold text-gray-400">({pendingRequests.length} بانتظار سائق)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingRequests.map(req => (
                    <div key={req.id} onClick={() => setSelectedOrderId(req.id)}
                      className="bg-white rounded-[24px] p-6 flex justify-between items-center border-2 border-gray-100 cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2.5 py-1 rounded-xl">#طلب {req.id}</span>
                          <span className="text-[10px] text-gray-400 font-bold">{req.customerPhone}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-700 truncate w-52">{req.location || req.pickupAddress}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                          <span className="text-[11px] text-orange-600 font-black">بانتظار تعيين سائق</span>
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <Button onClick={() => setAssigningRequest(req)}
                          className="bg-orange-500 hover:bg-orange-600 rounded-xl text-[11px] h-10 px-4 font-black">
                          تحويل
                        </Button>
                        <Button onClick={() => { if (confirm("حذف الطلب؟")) deleteRequest.mutate(req.id); }}
                          variant="ghost" className="bg-red-50 text-red-500 rounded-xl h-10 w-10 hover:bg-red-100">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendingRequests.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-gray-300">
                      <CheckCircle2 className="w-12 h-12 mb-3" />
                      <p className="font-black text-gray-400">لا توجد طلبات معلقة حالياً</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Pending Drivers ── */}
            {activeTab === "requests" && (
              <motion.div key="pending-drivers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <h2 className="text-2xl font-black text-slate-900">طلبات الانضمام
                  <span className="mr-3 text-sm font-bold text-gray-400">({pendingDrivers.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pendingDrivers.map(driver => (
                    <div key={driver.id} className="bg-white rounded-[28px] border-2 border-gray-100 overflow-hidden shadow-sm">
                      <div className="h-1.5 bg-gradient-to-r from-orange-400 to-orange-500" />
                      <div className="p-6">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl font-black text-orange-500">
                            {driver.name?.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 text-lg">{driver.name}</h4>
                            <p className="text-xs text-gray-400 font-bold">{driver.city} • {driver.vehicleType}</p>
                            <p className="text-xs text-gray-400 font-bold">{driver.phone}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(driver.id)}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black h-12 shadow-lg shadow-orange-200 hover:shadow-xl"
                          >
                            {approveMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "✓ قبول"}
                          </Button>
                          <Button onClick={() => setDriverToDelete(driver.id)}
                            variant="ghost" className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingDrivers.length === 0 && (
                    <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-300">
                      <Users className="w-12 h-12 mb-3" />
                      <p className="font-black text-gray-400">لا توجد طلبات انضمام جديدة</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Finance ── */}
            {activeTab === "finance" && (
              <motion.div key="finance" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
                <h2 className="text-2xl font-black text-slate-900">إدارة المالية والعمولات</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Commission card */}
                  <div className="bg-gradient-to-br from-slate-900 to-[#0C1427] rounded-[36px] p-8 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-orange-500/20 border border-orange-500/30 p-3 rounded-2xl">
                          <Coins className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                          <h4 className="font-black text-lg">عمولة النظام</h4>
                          <p className="text-slate-500 text-xs font-bold">تُخصم من كل رحلة مكتملة</p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-widest">القيمة الحالية</p>
                      <div className="flex items-baseline gap-2 mb-8">
                        <span className="text-5xl font-black text-orange-400">
                          {systemSettings?.commissionAmount?.toLocaleString() || "1,000"}
                        </span>
                        <span className="text-slate-500 font-bold text-sm">د.ع / رحلة</span>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="number"
                          value={newCommission}
                          onChange={e => setNewCommission(e.target.value)}
                          placeholder="أدخل القيمة الجديدة..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm font-black text-white placeholder:text-slate-600 focus:border-orange-500 outline-none transition-colors"
                        />
                        <Button
                          disabled={updateCommission.isPending || !newCommission}
                          onClick={() => { if (newCommission) updateCommission.mutate(Number(newCommission)); }}
                          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 h-14 rounded-2xl font-black text-white shadow-xl shadow-orange-500/20 hover:shadow-2xl transition-all"
                        >
                          {updateCommission.isPending ? <Loader2 className="animate-spin" /> : "تحديث العمولة الآن"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Total earnings */}
                  <div className="bg-white rounded-[36px] border-2 border-gray-100 p-8 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-blue-50 p-3 rounded-2xl">
                          <TrendingUp className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-900">إجمالي الأرباح</h4>
                          <p className="text-gray-400 text-xs font-bold">مجموع العمولات المحصلة</p>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-5xl font-black text-slate-900">{systemEarnings.toLocaleString()}</span>
                        <span className="text-gray-400 font-bold">د.ع</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 text-xs font-bold text-gray-500">
                      يتم تحديث هذه الأرقام تلقائياً عند إتمام كل رحلة جديدة
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AnimatePresence>

        {/* Order Detail Modal */}
        {selectedOrderDetails && (
          <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOrderId(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative bg-[#0D1526] w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] shadow-2xl border border-white/10 flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-7 py-5 flex justify-between items-center border-b border-white/5 sticky top-0 z-10 bg-[#0D1526]">
                <Button variant="ghost" size="icon" onClick={() => setSelectedOrderId(null)}
                  className="rounded-full bg-white/5 hover:bg-white/10 text-white w-10 h-10">
                  <XCircle className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <h3 className="font-black text-lg text-white">تفاصيل الطلب</h3>
                  <span className="text-[11px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-0.5 rounded-full">
                    #{selectedOrderDetails.id}
                  </span>
                </div>
                <div className="w-10" />
              </div>

              <div className="overflow-y-auto flex-1 px-7 py-6 space-y-5">
                {/* Customer */}
                <div className="flex items-center gap-4 bg-white/5 p-5 rounded-[24px] border border-white/5">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl border border-white/5">👤</div>
                  <div className="flex-1">
                    <h4 className="font-black text-lg text-white">{selectedOrderDetails.customerName || "زبون"}</h4>
                    <p className="text-gray-400 text-xs font-bold flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" /> {selectedOrderDetails.customerPhone}
                    </p>
                  </div>
                  <a href={`tel:${selectedOrderDetails.customerPhone}`}
                    className="bg-green-600 hover:bg-green-500 text-white p-4 rounded-2xl shadow-lg transition-all active:scale-95">
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                {/* Wallet */}
                <div className="bg-gradient-to-br from-slate-900 to-black rounded-[28px] p-6 border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full -mr-10 -mt-10" />
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">رصيد المحفظة</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black text-white">
                            {(selectedOrderDetails.customerWalletBalance || 0).toLocaleString()}
                          </span>
                          <span className="text-orange-500 font-bold text-sm">د.ع</span>
                        </div>
                      </div>
                      <div className="bg-orange-500/15 p-3 rounded-2xl">
                        <Wallet className="w-5 h-5 text-orange-400" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="number"
                          value={customerWalletAmount}
                          onChange={e => setCustomerWalletAmount(e.target.value)}
                          placeholder="أدخل المبلغ..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white font-black text-sm placeholder:text-slate-600 focus:border-orange-500 outline-none transition-colors"
                        />
                        <Coins className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          disabled={adjustCustomerWallet.isPending || !customerWalletAmount}
                          onClick={() => adjustCustomerWallet.mutate({ customerPhone: selectedOrderDetails.customerPhone, amount: Math.abs(Number(customerWalletAmount)) })}
                          className="flex-1 bg-green-600 hover:bg-green-500 h-11 rounded-xl font-black text-white gap-1.5 active:scale-95 transition-all"
                        >
                          {adjustCustomerWallet.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4" />إيداع</>}
                        </Button>
                        <Button
                          disabled={adjustCustomerWallet.isPending || !customerWalletAmount}
                          onClick={() => adjustCustomerWallet.mutate({ customerPhone: selectedOrderDetails.customerPhone, amount: -Math.abs(Number(customerWalletAmount)) })}
                          className="flex-1 bg-red-600 hover:bg-red-500 h-11 rounded-xl font-black text-white gap-1.5 active:scale-95 transition-all"
                        >
                          {adjustCustomerWallet.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <><Minus className="w-4 h-4" />خصم</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-black mb-2">نوع المركبة</p>
                    <div className="flex items-center gap-2 text-white text-sm font-black">
                      <Truck className="w-4 h-4 text-orange-400" /> {selectedOrderDetails.vehicleType || "عادية"}
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-black mb-2">حالة الطلب</p>
                    <div className="flex items-center gap-2 text-blue-400 text-sm font-black">
                      <Clock className="w-4 h-4" /> {selectedOrderDetails.status === "pending" ? "بانتظار سائق" : selectedOrderDetails.status}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white/5 p-5 rounded-[24px] border border-white/5 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-500/15 p-2 rounded-xl mt-0.5">
                      <MapPin className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-black mb-1">موقع الاستلام</p>
                      <p className="text-gray-300 text-sm font-bold">{selectedOrderDetails.location || selectedOrderDetails.pickupAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-7 py-5 bg-[#0D1526] border-t border-white/10 flex gap-3 sticky bottom-0">
                <Button onClick={() => setAssigningRequest(selectedOrderDetails)}
                  className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 font-black text-white text-base shadow-xl shadow-orange-500/20 hover:shadow-2xl transition-all">
                  تحويل لسائق
                </Button>
                <Button
                  onClick={() => { if (confirm("حذف الطلب نهائياً؟")) { deleteRequest.mutate(selectedOrderDetails.id); setSelectedOrderId(null); } }}
                  variant="ghost" className="h-14 w-14 rounded-2xl bg-white/5 text-red-500 hover:bg-red-500/10">
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Assign Driver Modal */}
        {assigningRequest && (
          <div className="fixed inset-0 z-[6000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="px-7 py-5 border-b flex justify-between items-center">
                <h3 className="font-black text-lg text-slate-900">تحويل الطلب #{assigningRequest.id}</h3>
                <button onClick={() => setAssigningRequest(null)}><XCircle className="text-gray-400 w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {onlineDrivers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 font-bold text-sm">لا يوجد سائقون متصلون حالياً</div>
                ) : onlineDrivers.map(driver => (
                  <div key={driver.id} onClick={() => setSelectedDriver(driver)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                      selectedDriver?.id === driver.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200 bg-white"
                    }`}
                  >
                    <div>
                      <span className="font-black text-slate-800">{driver.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-gray-400">{driver.vehicleType}</span>
                        <span className="text-[10px] font-bold text-orange-600">{Number(driver.walletBalance).toLocaleString()} د.ع</span>
                      </div>
                    </div>
                    {selectedDriver?.id === driver.id && <CheckCircle2 className="text-orange-500 w-5 h-5" />}
                  </div>
                ))}
              </div>
              <div className="p-5 border-t">
                <Button
                  disabled={!selectedDriver}
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 h-14 rounded-2xl font-black text-white shadow-lg shadow-orange-200 hover:shadow-xl transition-all disabled:opacity-50"
                >
                  تأكيد التحويل
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[7000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white p-8 rounded-[36px] shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">تأكيد الإرسال</h4>
              <p className="text-gray-500 text-sm font-bold mb-8 leading-relaxed">
                سيتلقى الكابتن <strong className="text-slate-900">{selectedDriver?.name}</strong> إشعاراً فورياً بالطلب وسيتوجه لموقع الاستلام.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => assignMutation.mutate({ requestId: assigningRequest!.id, driverId: selectedDriver!.id })}
                  disabled={assignMutation.isPending}
                  className="flex-1 bg-slate-900 text-white h-14 rounded-2xl font-black hover:bg-slate-800"
                >
                  {assignMutation.isPending ? <Loader2 className="animate-spin" /> : "تأكيد الآن"}
                </Button>
                <Button onClick={() => setShowConfirmModal(false)} variant="outline" className="flex-1 h-14 rounded-2xl font-black">
                  إلغاء
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete driver confirmation modal */}
        {driverToDelete !== null && (
          <div className="fixed inset-0 z-[8000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white p-8 rounded-[36px] shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">حذف الكابتن نهائياً؟</h4>
              <p className="text-gray-500 text-sm font-bold mb-8 leading-relaxed">
                لا يمكن التراجع عن هذه العملية. سيتم حذف حساب الكابتن وجميع بياناته بشكل نهائي.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => { deleteMutation.mutate(driverToDelete!); setDriverToDelete(null); }}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white h-14 rounded-2xl font-black"
                >
                  {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : "تأكيد الحذف"}
                </Button>
                <Button onClick={() => setDriverToDelete(null)} variant="outline" className="flex-1 h-14 rounded-2xl font-black">
                  إلغاء
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
