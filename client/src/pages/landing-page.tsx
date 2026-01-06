import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, User, ArrowLeftRight, ChevronLeft, ShieldCheck, Globe } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans" dir="rtl">
      
      {/* لمسة خلفية جمالية */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-black/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-md w-full space-y-10 z-10"
      >
        {/* الشعار والترحيب */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <div className="relative inline-block">
             <motion.div 
               animate={{ scale: [1, 1.05, 1] }} 
               transition={{ repeat: Infinity, duration: 3 }}
               className="bg-orange-500 p-5 rounded-[30px] shadow-2xl shadow-orange-500/30 flex items-center justify-center mx-auto"
             >
                <Truck className="w-12 h-12 text-white" />
             </motion.div>
             {/* أيقونة الدرع تفتح لوحة المدير */}
             <div 
                onClick={() => setLocation("/admin-login")}
                className="absolute -bottom-2 -right-2 bg-black text-white p-1.5 rounded-xl border-4 border-[#F3F4F6] cursor-pointer hover:bg-orange-600 transition-colors"
             >
                <ShieldCheck className="w-4 h-4" />
             </div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-5xl font-black tracking-tighter text-gray-900 italic">
                SATHA <span className="text-orange-500 text-3xl">IQ</span>
            </h1>
            <p className="text-gray-400 font-bold text-lg">أسرع سطحة في العراق بكبسة زر</p>
          </div>
        </motion.div>

        {/* خيارات الدخول */}
        <div className="grid gap-5">
          {/* كرت الزبون */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLocation("/request")}
          >
            <Card className="group cursor-pointer transition-all border-none bg-white rounded-[35px] shadow-xl shadow-gray-200/50 hover:shadow-orange-500/10 overflow-hidden relative border-2 border-transparent hover:border-orange-500/20">
              <CardContent className="p-8 flex items-center gap-6">
                <div className="bg-orange-500 p-5 rounded-[25px] text-white shadow-lg shadow-orange-500/30 group-hover:rotate-6 transition-transform">
                  <User className="w-8 h-8" />
                </div>
                <div className="flex-1 text-right">
                  <h2 className="text-2xl font-black text-gray-900 mb-1 leading-none">أنا زبون</h2>
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">طلب نقل سيارة فوري</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-full">
                   <ChevronLeft className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* كرت السائق ✅ تم التحديث للمسار الجديد */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLocation("/driver-signup")}
          >
            <Card className="group cursor-pointer transition-all border-none bg-slate-900 rounded-[35px] shadow-xl shadow-slate-900/20 overflow-hidden relative border-2 border-transparent hover:border-orange-500/40">
              <CardContent className="p-8 flex items-center gap-6">
                <div className="bg-white/10 p-5 rounded-[25px] text-orange-500 shadow-inner group-hover:-rotate-6 transition-transform">
                  <Truck className="w-8 h-8" />
                </div>
                <div className="flex-1 text-right">
                  <h2 className="text-2xl font-black text-white mb-1 leading-none">أنا سائق</h2>
                  <p className="text-white/40 font-bold text-[10px] uppercase tracking-widest">تسجيل دخول أو انضمام</p>
                </div>
                <div className="bg-white/5 p-2 rounded-full">
                   <ChevronLeft className="w-5 h-5 text-white/20 group-hover:text-orange-50 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* قسم الإحصائيات السريع */}
        <motion.div variants={itemVariants} className="pt-4">
            <div className="flex items-center justify-between px-4 py-3 bg-white/50 backdrop-blur-sm rounded-[24px] border border-white">
                <div className="flex flex-col items-center flex-1 border-l border-gray-100">
                    <span className="text-orange-500 font-black text-lg">100%</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">أمان</span>
                </div>
                <div className="flex flex-col items-center flex-1 border-l border-gray-100">
                    <span className="text-gray-800 font-black text-lg">24/7</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">دعم</span>
                </div>
                <div className="flex flex-col items-center flex-1">
                    <span className="text-gray-800 font-black text-lg">★ 4.9</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">تقييمنا</span>
                </div>
            </div>
        </motion.div>

        {/* تذييل الصفحة */}
        <motion.div variants={itemVariants} className="text-center">
            <button className="text-gray-400 font-black text-xs hover:text-orange-500 transition-colors flex items-center justify-center gap-2 mx-auto px-4 py-2">
                <Globe className="w-3 h-3" />
                <span>العربية (العراق) | 2026</span>
            </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
