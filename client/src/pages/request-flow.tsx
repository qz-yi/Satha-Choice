import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertRequestSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { VehicleCard } from "@/components/vehicle-card";
import { MapPin, Loader2, Phone, CalendarCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

// Extend schema to ensure fields are required in UI
const formSchema = insertRequestSchema.extend({
  location: z.string().min(3, "يرجى تحديد الموقع بدقة"),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
  price: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function RequestFlow() {
  const [isSuccess, setIsSuccess] = useState(false);
  const { mutate, isPending } = useCreateRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      vehicleType: "",
      price: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    mutate(data, {
      onSuccess: () => setIsSuccess(true),
    });
  };

  const handleVehicleSelect = (id: string, price: string) => {
    form.setValue("vehicleType", id);
    form.setValue("price", price);
    form.clearErrors("vehicleType");
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-primary/20 shadow-xl shadow-primary/5">
            <CardContent className="pt-10 pb-8 px-6 text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CalendarCheck className="w-10 h-10 text-green-600" />
              </div>
              
              <h2 className="text-3xl font-bold text-foreground">تم استلام طلبك!</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                شكراً لك. سيقوم أحد السائقين بالتواصل معك قريباً لتأكيد تفاصيل الحجز والموقع.
              </p>
              
              <div className="bg-muted p-4 rounded-xl mt-6">
                <p className="text-sm text-muted-foreground font-semibold">رقم الطلب</p>
                <p className="text-2xl font-mono font-bold text-primary mt-1">#{(Math.random() * 10000).toFixed(0)}</p>
              </div>

              <Button 
                onClick={() => {
                  setIsSuccess(false);
                  form.reset();
                }}
                className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl mt-6"
              >
                طلب جديد
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-0">
      {/* Header / AppBar */}
      <header className="bg-primary shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-black/10 p-2 rounded-lg">
              <Truck className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-black tracking-tight">
              طلب سطحة
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
             <Phone className="w-4 h-4" />
             <span className="text-sm font-bold font-mono">1900-500-20</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8 text-center md:text-right">
            <h2 className="text-2xl md:text-4xl font-extrabold text-foreground mb-3">
              اختر نوع السيارة
            </h2>
            <p className="text-muted-foreground text-lg">
              اختر نوع السطحة المناسبة لاحتياجك وسنقوم بالباقي
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Location Input Section */}
              <Card className="border-border shadow-sm overflow-hidden">
                <CardContent className="p-6">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-bold flex items-center gap-2 mb-2">
                          <MapPin className="w-5 h-5 text-primary" />
                          موقع التحميل
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="مثال: الرياض، حي الملقا، شارع أنس بن مالك..." 
                              className="h-14 pr-11 text-lg rounded-xl border-2 focus-visible:ring-primary focus-visible:border-primary transition-all bg-background"
                              {...field} 
                            />
                            <MapPin className="absolute right-4 top-4 text-muted-foreground w-5 h-5" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Vehicle Options List */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="vehicleType"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormLabel className="sr-only">نوع السيارة</FormLabel>
                      <FormControl>
                        <div className="grid gap-2">
                          {VEHICLE_OPTIONS.map((option, index) => (
                            <motion.div
                              key={option.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <VehicleCard
                                id={option.id}
                                label={option.label}
                                price={option.price}
                                description={option.description}
                                isSelected={field.value === option.id}
                                onSelect={() => handleVehicleSelect(option.id, option.price)}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage className="text-lg font-medium text-destructive mt-2" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Bottom Action Bar (Fixed on Mobile) */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border md:static md:bg-transparent md:border-none md:p-0 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-none">
                <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="hidden md:block">
                     <p className="text-sm text-muted-foreground">التكلفة المتوقعة</p>
                     <p className="text-2xl font-bold font-mono">
                       {form.watch("price") || "---"}
                     </p>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isPending}
                    size="lg"
                    className="w-full md:w-auto md:min-w-[300px] h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      "تأكيد الطلب وحجز الموقع"
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Spacer for fixed bottom bar on mobile */}
              <div className="h-20 md:hidden" />

            </form>
          </Form>
        </motion.div>
      </main>
    </div>
  );
}
