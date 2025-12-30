import { motion } from "framer-motion";
import { Truck, Shield, Zap, ChevronRight, Star } from "lucide-react";
import { useState } from "react";

const towOptions = [
  {
    id: "normal",
    title: "سطحة عادية",
    subTitle: "الاختيار الاقتصادي",
    price: "٥٠ ر.س",
    icon: <Truck className="w-6 h-6" />,
    color: "from-orange-500 to-orange-700"
  },
  {
    id: "hydraulic",
    title: "سطحة هيدروليك",
    subTitle: "للسيارات الرياضية",
    price: "١٢٠ ر.س",
    icon: <Zap className="w-6 h-6" />,
    color: "from-orange-400 to-orange-600"
  },
  {
    id: "covered",
    title: "سطحة مغطاة",
    subTitle: "أمان وفخامة قصوى",
    price: "٣٥٠ ر.س",
    icon: <Shield className="w-6 h-6" />,
    color: "from-orange-600 to-orange-800"
  }
];

export function TowSelection() {
  const [selected, setSelected] = useState("normal");

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans select-none" dir="rtl">
      
      {/* الرأس */}
      <div className="flex justify-between items-center mb-10 pt-4">
        <h2 className="text-2xl font-black italic tracking-tighter">
          SATHA <span className="text-orange-500">PRO</span>
        </h2>
        <div className="bg-zinc-900 p-2 rounded-full border border-white/5">
          <ChevronRight className="w-6 h-6" />
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">اختر الخدمة</h1>
        <p className="text-zinc-500 text-sm">نخبة من أفضل السائقين بانتظارك</p>
      </div>

      {/* قائمة الخيارات */}
      <div className="space-y-4">
        {towOptions.map((option) => (
          <motion.div
            key={option.id}
            onClick={() => setSelected(option.id)}
            whileTap={{ scale: 0.97 }}
            className={`relative p-5 rounded-3xl cursor-pointer transition-all duration-300 border ${
              selected === option.id 
                ? "bg-zinc-900 border-orange-500/50 shadow-[0_0_20px_rgba(234,88,12,0.1)]" 
                : "bg-zinc-900/50 border-white/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* الأيقونة مع التوهج */}
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${selected === option.id ? option.color : 'bg-zinc-800'} text-white shadow-lg`}>
                  {option.icon}
                </div>
                
                <div>
                  <h3 className={`font-bold text-lg ${selected === option.id ? 'text-white' : 'text-zinc-400'}`}>
                    {option.title}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                    <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                    <span>٤.٩ (١٥٠+ تقييم)</span>
                  </div>
                </div>
              </div>

              <div className="text-left">
                <span className={`text-xl font-black ${selected === option.id ? 'text-orange-500' : 'text-zinc-500'}`}>
                  {option.price}
                </span>
              </div>
            </div>

            {/* تفاصيل إضافية تظهر عند الاختيار فقط */}
            {selected === option.id && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-white/5 text-sm text-zinc-400"
              >
                {option.subTitle} - نضمن لك وصول السطحة في أقل من ١٥ دقيقة.
              </motion.p>
            )}
          </motion.div>
        ))}
      </div>

      {/* زر التأكيد السفلي */}
      <div className="fixed bottom-10 left-6 right-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-black text-lg shadow-[0_10px_30px_rgba(234,88,12,0.3)] flex items-center justify-center gap-3 transition-colors"
        >
          تأكيد ونشر الطلب
          <div className="bg-white/20 p-1 rounded-md">
             <ChevronRight className="w-5 h-5 rotate-180" />
          </div>
        </motion.button>
      </div>
    </div>
  );
}
