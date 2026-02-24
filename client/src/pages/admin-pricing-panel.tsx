/**
 * Admin Pricing Control Panel — Professional redesign
 * Full control over vehicle pricing + surge multiplier
 */

import { API_BASE } from "@/lib/http";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Save, AlertCircle,
  Loader2, Truck, Clock, MapPin, Zap, Check,
  RefreshCw, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface VehiclePricing {
  vehicleType: string;
  baseFare: number;
  kmRate: number;
  minuteRate: number;
  minimumFare: number;
}

const DEFAULTS: VehiclePricing[] = [
  { vehicleType: "سطحة",    baseFare: 25000, kmRate: 1250, minuteRate: 500,  minimumFare: 35000 },
  { vehicleType: "سحب",     baseFare: 20000, kmRate: 1000, minuteRate: 400,  minimumFare: 30000 },
  { vehicleType: "هيدروليك",baseFare: 50000, kmRate: 2500, minuteRate: 1000, minimumFare: 70000 },
];

const VEHICLE_COLORS: Record<string, { bg: string; badge: string; text: string; border: string }> = {
  "سطحة":    { bg: "from-orange-500 to-orange-600", badge: "bg-orange-100 text-orange-700", text: "text-orange-600", border: "border-orange-200" },
  "سحب":     { bg: "from-blue-500 to-blue-600",    badge: "bg-blue-100 text-blue-700",    text: "text-blue-600",   border: "border-blue-200"   },
  "هيدروليك":{ bg: "from-violet-500 to-violet-600",badge: "bg-violet-100 text-violet-700",text: "text-violet-600", border: "border-violet-200" },
};

export default function AdminPricingPanel() {
  const { toast } = useToast();

  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [isSaved, setIsSaved]       = useState(false);

  const [surgeMultiplier, setSurgeMultiplier]       = useState(1.0);
  const [originalSurge, setOriginalSurge]           = useState(1.0);
  const [vehiclePricing, setVehiclePricing]         = useState<VehiclePricing[]>(DEFAULTS);
  const [editedPricing, setEditedPricing]           = useState<Record<string, Partial<VehiclePricing>>>({});

  // ── Load current settings ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [surgeRes, vehicleRes] = await Promise.allSettled([
          fetch("/api/admin/pricing/surge"),
          fetch("/api/admin/pricing/vehicles"),
        ]);

        if (surgeRes.status === "fulfilled" && surgeRes.value.ok) {
          const d = await surgeRes.value.json();
          const v = Number(d.surgeMultiplier) || 1.0;
          setSurgeMultiplier(v);
          setOriginalSurge(v);
        }

        if (vehicleRes.status === "fulfilled" && vehicleRes.value.ok) {
          const d = await vehicleRes.value.json();
          if (Array.isArray(d) && d.length > 0) setVehiclePricing(d);
          else setVehiclePricing(DEFAULTS);
        } else {
          setVehiclePricing(DEFAULTS);
        }
      } catch {
        setVehiclePricing(DEFAULTS);
        setSurgeMultiplier(1.0);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getCurrentValue = (vehicleType: string, field: keyof VehiclePricing): number =>
    Number(editedPricing[vehicleType]?.[field] ??
      vehiclePricing.find(v => v.vehicleType === vehicleType)?.[field] ?? 0);

  const handleChange = (vehicleType: string, field: keyof VehiclePricing, value: number) => {
    setEditedPricing(prev => ({
      ...prev,
      [vehicleType]: { ...prev[vehicleType], [field]: value },
    }));
  };

  const handleStepper = (vehicleType: string, field: keyof VehiclePricing, delta: number) => {
    handleChange(vehicleType, field, Math.max(0, getCurrentValue(vehicleType, field) + delta));
  };

  const surgeChanged  = surgeMultiplier !== originalSurge;
  const pricingChanged = Object.keys(editedPricing).length > 0;
  const hasChanges    = surgeChanged || pricingChanged;

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);

      // Always save surge (even if unchanged — ensures DB is in sync)
      const surgeRes = await fetch(`${API_BASE}/api/admin/pricing/surge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surgeMultiplier }),
      });
      if (!surgeRes.ok) throw new Error("فشل في حفظ معامل الذروة");
      setOriginalSurge(surgeMultiplier);

      // Save vehicle pricing changes
      for (const [vt, changes] of Object.entries(editedPricing)) {
        if (Object.keys(changes).length === 0) continue;
        const res = await fetch(`${API_BASE}/api/admin/pricing/vehicles/${vt}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        if (!res.ok) throw new Error(`فشل في حفظ تسعيرة ${vt}`);
        setVehiclePricing(prev => prev.map(v => v.vehicleType === vt ? { ...v, ...changes } : v));
      }

      setEditedPricing({});
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);

      toast({
        title: "تم الحفظ بنجاح",
        description: "ستُطبَّق التغييرات على جميع الطلبات الجديدة فوراً",
        className: "bg-green-600 text-white font-black border-0",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في الحفظ", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-slate-500 font-bold text-sm">جاري تحميل إعدادات التسعير...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-200">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            إعدادات التسعير
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-1 mr-[58px]">
            التعديلات تُطبَّق فوراً على كل الطلبات الجديدة
          </p>
        </div>

        <Button
          onClick={handleSaveAll}
          disabled={!hasChanges || isSaving}
          className={`h-14 px-8 rounded-2xl font-black text-white shadow-xl transition-all gap-2
            ${hasChanges
              ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-green-200 scale-100 hover:scale-105"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
        >
          <AnimatePresence mode="wait">
            {isSaving ? (
              <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ...
              </motion.span>
            ) : isSaved ? (
              <motion.span key="saved" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                <Check className="w-5 h-5" /> تم الحفظ ✓
              </motion.span>
            ) : (
              <motion.span key="idle" className="flex items-center gap-2">
                <Save className="w-5 h-5" /> حفظ التغييرات
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-amber-800 font-bold text-sm">
            لديك تغييرات غير محفوظة — اضغط "حفظ التغييرات" لتفعيلها
          </span>
        </motion.div>
      )}

      {/* ── Surge / Peak Hour ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-xl shadow-lg ${surgeMultiplier > 1 ? "bg-orange-500" : "bg-slate-700"} transition-colors`}>
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black">وضع ساعات الذروة</h3>
                <p className="text-slate-400 text-xs font-bold">
                  {surgeMultiplier > 1 ? "🔴 مُفعَّل — جميع الأسعار مضاعفة ×1.2" : "⚪ غير مُفعَّل — الأسعار العادية"}
                </p>
              </div>
              <span className={`text-lg font-black px-4 py-1 rounded-full border ${surgeMultiplier > 1 ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "bg-white/5 border-white/10 text-slate-400"}`}>
                {surgeMultiplier}×
              </span>
            </div>
            <p className="text-slate-400 text-sm font-bold leading-relaxed max-w-md">
              عند التفعيل، تُضرَب جميع الأسعار بـ <strong className="text-white">1.2×</strong> لتغطية الطلب المرتفع في ساعات الذروة. لا تنسَ الضغط على "حفظ" بعد التبديل.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setSurgeMultiplier(surgeMultiplier > 1 ? 1.0 : 1.2)}
              className={`relative w-20 h-10 rounded-full transition-all duration-300 shadow-inner ${surgeMultiplier > 1 ? "bg-orange-500 shadow-orange-500/30" : "bg-slate-600"}`}
            >
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className={`absolute top-1 w-8 h-8 bg-white rounded-full shadow-lg ${surgeMultiplier > 1 ? "left-10" : "left-1"}`}
              />
            </button>
            <span className={`text-xs font-black ${surgeMultiplier > 1 ? "text-orange-400" : "text-slate-500"}`}>
              {surgeMultiplier > 1 ? "مُفعَّل" : "موقوف"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Vehicle Pricing Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {vehiclePricing.map((vehicle, index) => {
          const colors = VEHICLE_COLORS[vehicle.vehicleType] || VEHICLE_COLORS["سطحة"];
          const changed = editedPricing[vehicle.vehicleType] && Object.keys(editedPricing[vehicle.vehicleType]).length > 0;

          const fields: { key: keyof VehiclePricing; label: string; icon: any; color: string; step: number; unit: string }[] = [
            { key: "baseFare",    label: "السعر الأساسي (أول 7 كم)", icon: MapPin,     color: "text-orange-500", step: 500,  unit: "د.ع" },
            { key: "kmRate",      label: "سعر الكيلومتر الإضافي",    icon: TrendingUp, color: "text-blue-500",   step: 250,  unit: "د.ع / كم" },
            { key: "minuteRate",  label: "سعر الدقيقة",              icon: Clock,      color: "text-purple-500", step: 100,  unit: "د.ع / دقيقة" },
            { key: "minimumFare", label: "الحد الأدنى للرحلة",       icon: AlertCircle,color: "text-red-500",    step: 1000, unit: "د.ع" },
          ];

          return (
            <motion.div
              key={vehicle.vehicleType}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`bg-white rounded-[32px] shadow-sm border-2 transition-all duration-300 overflow-hidden
                ${changed ? "border-amber-300 shadow-amber-100" : "border-gray-100 hover:border-gray-200"}`}
            >
              {/* Card header */}
              <div className={`bg-gradient-to-r ${colors.bg} p-6 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2.5 rounded-2xl">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-white">{vehicle.vehicleType}</h3>
                </div>
                {changed && (
                  <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full">
                    معدَّل
                  </span>
                )}
              </div>

              {/* Fields */}
              <div className="p-5 space-y-4">
                {fields.map(({ key, label, icon: Icon, color, step, unit }) => {
                  const value = getCurrentValue(vehicle.vehicleType, key);
                  return (
                    <div key={key} className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm font-black text-gray-600">
                          <Icon className={`w-4 h-4 ${color}`} />
                          {label}
                        </span>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${colors.badge}`}>{unit}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStepper(vehicle.vehicleType, key, -step)}
                          className="w-9 h-9 rounded-xl border-2 border-gray-200 bg-white font-black text-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center leading-none"
                        >−</button>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => handleChange(vehicle.vehicleType, key, Number(e.target.value) || 0)}
                          className="flex-1 h-9 text-center bg-white border-2 border-gray-200 rounded-xl font-black text-gray-800 text-base outline-none focus:border-orange-400 transition-colors"
                        />
                        <button
                          onClick={() => handleStepper(vehicle.vehicleType, key, step)}
                          className="w-9 h-9 rounded-xl border-2 border-gray-200 bg-white font-black text-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center leading-none"
                        >+</button>
                      </div>
                    </div>
                  );
                })}

                {/* Live price preview — exact same formula as server calculateDynamicFare */}
                {(() => {
                  const bF  = getCurrentValue(vehicle.vehicleType, "baseFare");
                  const kR  = getCurrentValue(vehicle.vehicleType, "kmRate");
                  const mR  = getCurrentValue(vehicle.vehicleType, "minuteRate");
                  const minF= getCurrentValue(vehicle.vehicleType, "minimumFare");
                  // 10 km / 20 min preview
                  const addKm      = Math.max(0, 10 - 7);           // 3 km
                  const subtotal   = bF + addKm * kR + 20 * mR;
                  const afterSurge = subtotal * surgeMultiplier;
                  const preview    = Math.round(Math.max(afterSurge, minF));
                  return (
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 text-white">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">
                        معاينة — رحلة 10 كم / 20 دقيقة{surgeMultiplier > 1 ? ` × ${surgeMultiplier} ذروة` : ""}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{preview.toLocaleString()}</span>
                        <span className="text-slate-400 font-bold text-sm">د.ع</span>
                        {surgeMultiplier > 1 && (
                          <span className="text-orange-400 font-black text-xs bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            شامل ×{surgeMultiplier}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        {bF.toLocaleString()} + {(addKm * kR).toLocaleString()} + {(20 * mR).toLocaleString()} = {Math.round(afterSurge).toLocaleString()} → بعد الحد الأدنى: {preview.toLocaleString()}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Formula Info ────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-[28px] p-7">
        <h3 className="text-base font-black text-blue-900 flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-blue-500" />
          آلية حساب السعر (قاعدة الـ 7 كم)
        </h3>
        <div className="bg-white rounded-2xl p-5 font-mono text-sm text-gray-700 font-bold mb-4">
          السعر = السعر الأساسي + (المسافة الزائدة عن 7 كم × سعر الكم) + (الدقائق × سعر الدقيقة)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-bold">
          <div className="bg-white rounded-2xl p-4 border border-blue-100">
            <p className="text-blue-600 font-black mb-1">📌 أول 7 كم</p>
            <p className="text-gray-600">مشمولة في السعر الأساسي بالكامل</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-100">
            <p className="text-blue-600 font-black mb-1">📌 ما بعد 7 كم</p>
            <p className="text-gray-600">يُضاف سعر الكيلومتر الإضافي لكل كم</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-100">
            <p className="text-blue-600 font-black mb-1">📌 الحد الأدنى</p>
            <p className="text-gray-600">السعر لا ينزل أبداً عن الحد الأدنى</p>
          </div>
        </div>
      </div>
    </div>
  );
}
