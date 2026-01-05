import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDriverSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Truck, User, Phone, MapPin, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DriverSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertDriverSchema),
    defaultValues: {
      name: "",
      phone: "",
      city: "",
      vehicleType: "",
      plateNumber: ""
    }
  });

  async function onSubmit(data: any) {
    setIsSubmitting(true);

    try {
      // ✅ التأكد من إرسال الاسم والحالة بشكل صريح لضمان ظهورها عند المدير
      const payload = {
        ...data,
        name: data.name.trim(), // تنظيف الاسم من الفراغات الزائدة
        approvalStatus: "pending", // تحديد الحالة كـ 'قيد الانتظار' ليراها المدير
        isOnline: false
      };

      console.log("إرسال بيانات الكابتن:", payload);

      const res = await apiRequest("POST", "/api/drivers", payload);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "فشل السيرفر في معالجة الطلب");
      }

      // ✅ استخراج بيانات السائق الجديد (بما فيها ID) من الرد
      const newDriver = await res.json();

      // ✅ تخزين المعرف في localStorage ليتمكن التطبيق من مراقبة حالة الموافقة
      localStorage.setItem("currentDriverId", newDriver.id.toString());

      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });

      toast({
        title: "تم إرسال طلبك بنجاح",
        description: "سيقوم المسؤول بمراجعة حسابك وتفعيله قريباً.",
      });

      // التوجه لصفحة السائق الرئيسية
      setLocation("/driver"); 

    } catch (error: any) {
      console.error("تفاصيل الخطأ:", error);
      toast({
        variant: "destructive",
        title: "خطأ في التسجيل",
        description: error.message || "يرجى التأكد من البيانات أو المحاولة لاحقاً.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center p-6 font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 mt-10"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tight">SATHA <span className="text-orange-500">CAPTAIN</span></h1>
          <p className="text-gray-500 font-bold">أدخل بياناتك لإنشاء ملفك الاحترافي</p>
        </div>

        <Card className="border-none shadow-2xl rounded-[35px] overflow-hidden bg-white border-t-8 border-t-orange-500">
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* الحقول بقيت كما هي لضمان سلامة الهيكل */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold flex items-center gap-2"><User className="w-4 h-4 text-orange-500"/> الاسم الكامل (كما يظهر للمدير)</FormLabel>
                      <FormControl>
                        <Input placeholder="أدخل اسمك الثلاثي" {...field} className="rounded-2xl border-slate-100 h-12 bg-slate-50 focus:bg-white transition-all font-bold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold flex items-center gap-2"><Phone className="w-4 h-4 text-orange-500"/> رقم الهاتف</FormLabel>
                      <FormControl>
                        <Input placeholder="07XXXXXXXXX" {...field} className="rounded-2xl border-slate-100 h-12 bg-slate-50 font-bold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500"/> المدينة</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: بغداد، بابل، البصرة..." {...field} className="rounded-2xl border-slate-100 h-12 bg-slate-50 font-bold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-orange-500"/> نوع السطحة</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-2xl border-slate-100 h-12 bg-slate-50 font-bold">
                            <SelectValue placeholder="اختر نوع السطحة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl font-bold">
                          {VEHICLE_OPTIONS.map((option) => (
                            <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plateNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-orange-500"/> رقم اللوحة</FormLabel>
                      <FormControl>
                        <Input placeholder="رقم السيارة (مثال: 12345 بابل)" {...field} className="rounded-2xl border-slate-100 h-12 bg-slate-50 font-bold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-orange-500 text-white rounded-2xl h-14 text-lg font-black transition-all shadow-lg shadow-slate-900/20"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "إرسال طلب الانضمام"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}