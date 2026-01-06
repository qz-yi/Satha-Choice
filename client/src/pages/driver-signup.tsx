import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDriverSchema, loginSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, User, Phone, MapPin, CreditCard, Loader2, Lock, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DriverAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  // ✅ فحص إذا كان السائق مسجلاً دخوله مسبقاً (ميزة حفظ الجلسة)
  useEffect(() => {
    const savedId = localStorage.getItem("currentDriverId");
    if (savedId) {
      setLocation("/driver"); // أو المسار الذي تفضله لواجهة السائق
    }
  }, [setLocation]);

  // فورم إنشاء حساب جديد (نفس الكود الذي تعبنا به)
  const registerForm = useForm({
    resolver: zodResolver(insertDriverSchema),
    defaultValues: {
      name: "", phone: "", password: "", city: "", vehicleType: "", plateNumber: ""
    }
  });

  // فورم تسجيل الدخول (الإضافة الجديدة)
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" }
  });

  // ✅ تنفيذ تسجيل الدخول (Login)
  async function onLogin(data: any) {
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/drivers/login", data);
      const driver = await res.json();
      
      localStorage.setItem("currentDriverId", driver.id.toString());
      toast({ title: "أهلاً بك مجدداً كابتن", description: driver.name });
      setLocation("/driver");
    } catch (error: any) {
      toast({ variant: "destructive", title: "فشل الدخول", description: "رقم الهاتف أو الرمز غير صحيح" });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ✅ تنفيذ إنشاء حساب جديد (Register - نفس منطقك السابق)
  async function onRegister(data: any) {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        name: data.name.trim(),
        approvalStatus: "pending",
        isOnline: false
      };

      const res = await apiRequest("POST", "/api/drivers", payload);
      if (!res.ok) throw new Error("رقم الهاتف مسجل مسبقاً أو هناك خطأ في البيانات");

      const newDriver = await res.json();
      localStorage.setItem("currentDriverId", newDriver.id.toString());
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });

      toast({ title: "تم إرسال طلبك بنجاح", description: "سيقوم المسؤول بمراجعة حسابك وتفعيله قريباً." });
      setLocation("/driver"); 
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في التسجيل", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center p-6 font-sans" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-6 mt-10">
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tight">SATHA <span className="text-orange-500">CAPTAIN</span></h1>
          <p className="text-gray-500 font-bold">
            {authMode === "register" ? "أنشئ حسابك وانضم للأبطال" : "سجل دخولك لمتابعة عملك"}
          </p>
        </div>

        {/* ✅ زر التبديل بين الدخول والتسجيل */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={() => setAuthMode("register")} className={`flex-1 py-3 rounded-xl font-black transition-all ${authMode === "register" ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400'}`}>سائق جديد</button>
          <button onClick={() => setAuthMode("login")} className={`flex-1 py-3 rounded-xl font-black transition-all ${authMode === "login" ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>تسجيل دخول</button>
        </div>

        <Card className="border-none shadow-2xl rounded-[35px] overflow-hidden bg-white border-t-8 border-t-orange-500">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {authMode === "register" ? (
                <motion.div key="reg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      {/* الاسم */}
                      <FormField control={registerForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2 text-xs text-slate-500"><User className="w-3 h-3 text-orange-500"/> الاسم الكامل</FormLabel>
                          <FormControl><Input placeholder="أدخل اسمك الثلاثي" {...field} className="rounded-xl border-slate-100 h-11 bg-slate-50 font-bold text-sm" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {/* الهاتف والرمز */}
                      <div className="grid grid-cols-1 gap-4">
                        <FormField control={registerForm.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold flex items-center gap-2 text-xs text-slate-500"><Phone className="w-3 h-3 text-orange-500"/> رقم الهاتف</FormLabel>
                            <FormControl><Input placeholder="07XXXXXXXXX" {...field} className="rounded-xl border-slate-100 h-11 bg-slate-50 font-bold text-sm" dir="ltr" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={registerForm.control} name="password" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold flex items-center gap-2 text-xs text-slate-500"><Lock className="w-3 h-3 text-orange-500"/> كلمة المرور</FormLabel>
                            <FormControl><Input type="password" placeholder="••••••••" {...field} className="rounded-xl border-slate-100 h-11 bg-slate-50 font-bold text-sm" dir="ltr" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      {/* المدينة والسطحة واللوحة */}
                      <div className="grid grid-cols-2 gap-3">
                         <FormField control={registerForm.control} name="city" render={({ field }) => (
                            <FormItem><FormLabel className="font-bold text-xs text-slate-500">المدينة</FormLabel>
                            <FormControl><Input placeholder="بغداد" {...field} className="rounded-xl h-11 bg-slate-50 font-bold text-sm" /></FormControl></FormItem>
                         )} />
                         <FormField control={registerForm.control} name="plateNumber" render={({ field }) => (
                            <FormItem><FormLabel className="font-bold text-xs text-slate-500">اللوحة</FormLabel>
                            <FormControl><Input placeholder="1234 بابل" {...field} className="rounded-xl h-11 bg-slate-50 font-bold text-sm" /></FormControl></FormItem>
                         )} />
                      </div>
                      <FormField control={registerForm.control} name="vehicleType" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs text-slate-500">نوع السطحة</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="rounded-xl h-11 bg-slate-50 font-bold text-sm"><SelectValue placeholder="اختر النوع" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl font-bold">{VEHICLE_OPTIONS.map((opt) => (<SelectItem key={opt.id} value={opt.label}>{opt.label}</SelectItem>))}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-14 text-lg font-black mt-4 transition-all shadow-lg shadow-orange-200">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "إنشاء الحساب والتقديم"}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              ) : (
                /* ✅ واجهة تسجيل الدخول للأعضاء السابقين */
                <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                      <FormField control={loginForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2"><Phone className="w-4 h-4 text-orange-500"/> رقم الهاتف</FormLabel>
                          <FormControl><Input placeholder="07XXXXXXXXX" {...field} className="rounded-2xl border-slate-100 h-14 bg-slate-50 font-black text-center" dir="ltr" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-orange-500"/> كلمة المرور</FormLabel>
                          <FormControl><Input type="password" placeholder="••••••••" {...field} className="rounded-2xl border-slate-100 h-14 bg-slate-50 font-black text-center" dir="ltr" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-orange-500 text-white rounded-2xl h-16 text-xl font-black transition-all shadow-xl shadow-slate-900/20">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "دخول إلى لوحة التحكم"}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}