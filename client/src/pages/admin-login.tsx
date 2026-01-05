import { useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Lock, ArrowLeft, Eye, EyeOff, AlertCircle, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const ADMIN_PASS = "SATHA2026"; // الرمز السري المستخرج

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    setTimeout(() => {
      if (password === ADMIN_PASS) {
        setLocation("/satha-control-center-2026");
      } else {
        setError(true);
        setIsLoading(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans" dir="rtl">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors mb-12 text-sm font-bold group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> العودة للتطبيق الرئيسي
        </button>
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[30px] mb-6 shadow-2xl">
            <ShieldCheck className="w-12 h-12 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter mb-2">نظام الإدارة المركزي</h1>
          <p className="text-slate-400 font-bold text-sm">يرجى إدخال رمز الوصول للوحة التحكم</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-500 transition-colors"><Lock className="w-5 h-5" /></div>
            <Input type={showPassword ? "text" : "password"} placeholder="رمز الدخول السري" value={password} onChange={(e) => setPassword(e.target.value)} className="h-16 bg-slate-900/50 border-slate-800 text-white pr-14 pl-14 rounded-[24px] font-black tracking-widest focus:ring-indigo-500 focus:border-indigo-500 text-center" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 left-5 flex items-center text-slate-500 hover:text-white">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 bg-red-400/10 p-4 rounded-2xl border border-red-400/20 text-xs font-bold">
                <AlertCircle className="w-4 h-4" /> خطأ في رمز الدخول.
              </motion.div>
            )}
          </AnimatePresence>
          <Button disabled={isLoading || !password} className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black text-lg">
            {isLoading ? <span className="flex items-center gap-2"><Fingerprint className="w-5 h-5 animate-pulse" /> جاري التحقق...</span> : "دخول النظام"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
} // ✅ تم إصلاح إغلاق الدالة هنا