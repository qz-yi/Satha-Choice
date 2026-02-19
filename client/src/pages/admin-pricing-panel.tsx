/**
 * CRITICAL FIX #3: Admin Pricing Control Panel
 * Professional interface for managing dynamic pricing
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, TrendingUp, Settings, Save, AlertCircle, 
  Loader2, Check, Truck, Clock, MapPin, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface VehiclePricing {
  vehicleType: string;
  baseFare: number;
  kmRate: number;
  minuteRate: number;
  minimumFare: number;
}

export default function AdminPricingPanel() {
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [vehiclePricing, setVehiclePricing] = useState<VehiclePricing[]>([]);
  const [editedPricing, setEditedPricing] = useState<Record<string, Partial<VehiclePricing>>>({});

  // STEP 1: Load pricing with STRICT array validation
  useEffect(() => {
    const loadPricing = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 [ADMIN PRICING] Loading configuration from database...');
        
        // Fetch surge multiplier
        try {
          const surgeRes = await fetch('/api/admin/pricing/surge');
          if (surgeRes.ok) {
            const data = await surgeRes.json();
            // STEP 3: Ensure valid number
            setSurgeMultiplier(data.surgeMultiplier || 1.0);
            console.log(`✅ [ADMIN PRICING] Surge: ${data.surgeMultiplier || 1.0}x`);
          } else {
            setSurgeMultiplier(1.0); // Fallback
          }
        } catch (err) {
          console.warn('⚠️ [ADMIN PRICING] Surge fetch failed, using 1.0');
          setSurgeMultiplier(1.0);
        }
        
        // Fetch vehicle pricing from database
        try {
          const vehicleRes = await fetch('/api/admin/pricing/vehicles');
          if (vehicleRes.ok) {
            const data = await vehicleRes.json();
            
            // STEP 1: CRITICAL - Validate array before setting state
            if (Array.isArray(data) && data.length > 0) {
              setVehiclePricing(data);
              console.log(`✅ [ADMIN PRICING] Loaded ${data.length} vehicle configs`);
            } else {
              console.warn('⚠️ [ADMIN PRICING] Invalid data, using defaults');
              // STEP 1: Use safe defaults if data is invalid
              setVehiclePricing([
                { vehicleType: 'سطحة', baseFare: 25000, kmRate: 1250, minuteRate: 500, minimumFare: 35000 },
                { vehicleType: 'سحب', baseFare: 20000, kmRate: 1000, minuteRate: 400, minimumFare: 30000 },
                { vehicleType: 'هيدروليك', baseFare: 50000, kmRate: 2500, minuteRate: 1000, minimumFare: 70000 }
              ]);
            }
          } else {
            throw new Error('API response not OK');
          }
        } catch (err) {
          console.error('❌ [ADMIN PRICING] Vehicle fetch failed:', err);
          // STEP 1: Set safe defaults on error
          setVehiclePricing([
            { vehicleType: 'سطحة', baseFare: 25000, kmRate: 1250, minuteRate: 500, minimumFare: 35000 },
            { vehicleType: 'سحب', baseFare: 20000, kmRate: 1000, minuteRate: 400, minimumFare: 30000 },
            { vehicleType: 'هيدروليك', baseFare: 50000, kmRate: 2500, minuteRate: 1000, minimumFare: 70000 }
          ]);
        }
      } catch (error) {
        console.error('❌ [ADMIN PRICING] Load error:', error);
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "تم تحميل القيم الافتراضية"
        });
        // STEP 1: Ensure state is valid even on total failure
        setVehiclePricing([
          { vehicleType: 'سطحة', baseFare: 25000, kmRate: 1250, minuteRate: 500, minimumFare: 35000 },
          { vehicleType: 'سحب', baseFare: 20000, kmRate: 1000, minuteRate: 400, minimumFare: 30000 },
          { vehicleType: 'هيدروليك', baseFare: 50000, kmRate: 2500, minuteRate: 1000, minimumFare: 70000 }
        ]);
        setSurgeMultiplier(1.0);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPricing();
  }, [toast]);

  // Update a specific vehicle's pricing field
  const handlePricingChange = (vehicleType: string, field: keyof VehiclePricing, value: number) => {
    setEditedPricing(prev => ({
      ...prev,
      [vehicleType]: {
        ...prev[vehicleType],
        [field]: value
      }
    }));
  };

  // Save all changes
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      
      // Save surge multiplier
      const surgeRes = await fetch('/api/admin/pricing/surge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeMultiplier })
      });
      
      if (!surgeRes.ok) throw new Error('Failed to save surge multiplier');
      
      // Save vehicle pricing updates
      for (const [vehicleType, changes] of Object.entries(editedPricing)) {
        if (Object.keys(changes).length > 0) {
          const res = await fetch(`/api/admin/pricing/vehicles/${vehicleType}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes)
          });
          
          if (!res.ok) throw new Error(`Failed to update ${vehicleType}`);
          
          // Update local state
          setVehiclePricing(prev => prev.map(v => 
            v.vehicleType === vehicleType ? { ...v, ...changes } : v
          ));
        }
      }
      
      // Clear edited state
      setEditedPricing({});
      
      toast({
        title: "✅ تم الحفظ بنجاح",
        description: "تم تحديث إعدادات التسعير لجميع الطلبات الجديدة",
        className: "bg-green-600 text-white font-black"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل في حفظ التغييرات"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Peak Hour Mode (1.2x surge)
  const togglePeakHourMode = async () => {
    const newSurge = surgeMultiplier === 1.0 ? 1.2 : 1.0;
    setSurgeMultiplier(newSurge);
  };

  const getCurrentValue = (vehicleType: string, field: keyof VehiclePricing): number => {
    return editedPricing[vehicleType]?.[field] ?? 
           vehiclePricing.find(v => v.vehicleType === vehicleType)?.[field] ?? 
           0;
  };

  const hasChanges = Object.keys(editedPricing).length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
            <div className="bg-orange-500 p-3 rounded-2xl">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            إعدادات التسعير
          </h1>
          <p className="text-gray-500 font-bold mt-2">إدارة الأسعار الديناميكية وساعات الذروة</p>
        </div>
        
        <Button
          onClick={handleSaveAll}
          disabled={!hasChanges || isSaving}
          className="h-14 px-8 rounded-[20px] font-black bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-xl disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              حفظ التغييرات
            </>
          )}
        </Button>
      </div>

      {/* Surge Pricing (Peak Hour Mode) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-[30px] p-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-orange-500 p-2 rounded-xl">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-800">وضع ساعات الذروة</h3>
              <span className={`text-sm font-black px-4 py-1.5 rounded-full ${surgeMultiplier > 1 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {surgeMultiplier}x
              </span>
            </div>
            <p className="text-gray-600 font-bold text-sm leading-relaxed">
              عند التفعيل، يتم ضرب جميع الأسعار بمعامل <span className="font-black">1.2x</span> لتغطية زيادة الطلب في ساعات الذروة
            </p>
          </div>
          
          <button
            onClick={togglePeakHourMode}
            className={`relative w-20 h-10 rounded-full transition-all ${surgeMultiplier > 1 ? 'bg-orange-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 left-1 w-8 h-8 bg-white rounded-full shadow-lg transition-transform ${surgeMultiplier > 1 ? 'translate-x-10' : 'translate-x-0'}`} />
          </button>
        </div>
      </motion.div>

      {/* Vehicle Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.isArray(vehiclePricing) && vehiclePricing.length > 0 ? (vehiclePricing.map((vehicle, index) => {
          const icons: Record<string, any> = {
            "سطحة": Truck,
            "سحب": Truck,
            "هيدروليك": Truck
          };
          
          const Icon = icons[vehicle.vehicleType] || Truck;
          
          return (
            <motion.div
              key={vehicle.vehicleType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border-2 border-gray-100 rounded-[30px] p-6 shadow-lg hover:shadow-xl transition-all"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-2xl">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-800">{vehicle.vehicleType}</h3>
              </div>

              {/* Pricing Fields */}
              <div className="space-y-4">
                {/* Base Fare */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    السعر الأساسي (أول 10 كم)
                  </label>
                  <input
                    type="number"
                    value={getCurrentValue(vehicle.vehicleType, 'baseFare')}
                    onChange={(e) => handlePricingChange(vehicle.vehicleType, 'baseFare', parseFloat(e.target.value))}
                    className="w-full h-12 px-4 rounded-[15px] border-2 border-gray-200 font-black text-gray-800 text-lg focus:border-orange-500 outline-none transition-all"
                    placeholder="25000"
                  />
                </div>

                {/* KM Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    السعر لكل كيلومتر إضافي
                  </label>
                  <input
                    type="number"
                    value={getCurrentValue(vehicle.vehicleType, 'kmRate')}
                    onChange={(e) => handlePricingChange(vehicle.vehicleType, 'kmRate', parseFloat(e.target.value))}
                    className="w-full h-12 px-4 rounded-[15px] border-2 border-gray-200 font-black text-gray-800 text-lg focus:border-orange-500 outline-none transition-all"
                    placeholder="1250"
                  />
                </div>

                {/* Minute Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    السعر لكل دقيقة
                  </label>
                  <input
                    type="number"
                    value={getCurrentValue(vehicle.vehicleType, 'minuteRate')}
                    onChange={(e) => handlePricingChange(vehicle.vehicleType, 'minuteRate', parseFloat(e.target.value))}
                    className="w-full h-12 px-4 rounded-[15px] border-2 border-gray-200 font-black text-gray-800 text-lg focus:border-orange-500 outline-none transition-all"
                    placeholder="500"
                  />
                </div>

                {/* Minimum Fare */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    الحد الأدنى للسعر
                  </label>
                  <input
                    type="number"
                    value={getCurrentValue(vehicle.vehicleType, 'minimumFare')}
                    onChange={(e) => handlePricingChange(vehicle.vehicleType, 'minimumFare', parseFloat(e.target.value))}
                    className="w-full h-12 px-4 rounded-[15px] border-2 border-gray-200 font-black text-gray-800 text-lg focus:border-orange-500 outline-none transition-all"
                    placeholder="35000"
                  />
                </div>

                {/* Change indicator */}
                {editedPricing[vehicle.vehicleType] && Object.keys(editedPricing[vehicle.vehicleType]).length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-[15px] p-3 flex items-center gap-2 text-yellow-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-bold">تم التعديل - اضغط "حفظ التغييرات"</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })
        ) : (
          // STEP 1: Fallback UI if array is invalid
          <div className="col-span-3 text-center py-12">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-orange-500 animate-spin" />
            <p className="text-gray-600 font-bold">جاري تحميل إعدادات التسعير...</p>
          </div>
        )}
      </div>

      {/* CRITICAL FIX #3: Formula Explanation with 7KM Rule */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-[30px] p-8">
        <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          قاعدة الـ 7 كيلومتر (THE 7KM RULE)
        </h3>
        <div className="bg-white rounded-[20px] p-6 space-y-3">
          <div className="font-mono text-sm text-gray-700 font-bold">
            السعر النهائي = (السعر الأساسي + (المسافة الإضافية × معدل الكم) + (الوقت × معدل الدقيقة)) × معامل الذروة
          </div>
          <div className="bg-blue-50 p-4 rounded-xl text-sm font-bold text-blue-900 space-y-2">
            <p>🔵 السعر الأساسي يغطي أول <span className="font-black text-xl">7 كيلومتر</span> فقط</p>
            <p>🔵 أي مسافة بعد 7 كم تُحسب كـ"مسافة إضافية" وتُضرب في معدل الكيلومتر</p>
            <p>🔵 مثال: رحلة 10 كم = السعر الأساسي + (3 كم × معدل الكم)</p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600 font-bold space-y-1">
          <p>✅ يتم تطبيق <span className="font-black">الحد الأدنى للسعر</span> تلقائياً إذا كان الناتج أقل منه</p>
          <p>✅ الحد الأقصى المطلق: <span className="font-black">100,000 د.ع</span> (لا يمكن تجاوزه)</p>
          <p>✅ <span className="font-black text-orange-600">هيدروليك:</span> الحد الأدنى 70,000 د.ع (لا يمكن النزول عنه)</p>
        </div>
      </div>
    </div>
  );
}
