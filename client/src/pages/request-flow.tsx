import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertRequestSchema, VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { VehicleCard } from "@/components/vehicle-card";
import { MapPin, Loader2, Phone, CalendarCheck, Truck, Clock, Navigation, ArrowLeftRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Extend schema to ensure fields are required in UI
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapController({ onPickupChange }: { onPickupChange: (pos: [number, number]) => void }) {
  const map = useMap();
  
  const handleCurrentLocation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onPickupChange([latlng.lat, latlng.lng]);
        map.flyTo(latlng, 15);
      }, () => {
        alert("يرجى تفعيل صلاحية الوصول للموقع.");
      });
    } else {
      alert("متصفحك لا يدعم خاصية تحديد الموقع.");
    }
  };

  return (
    <Button 
      type="button"
      size="default"
      variant="secondary"
      className="absolute top-4 left-4 z-[1000] shadow-xl bg-white hover:bg-gray-100 text-black font-bold flex items-center gap-2 px-4 h-12 rounded-full border-2 border-primary"
      onClick={handleCurrentLocation}
    >
      <MapPin className="w-5 h-5 text-primary" />
      <span>تحديد موقعي</span>
    </Button>
  );
}

function LocationPicker({ 
  pickup, 
  destination, 
  onPickupChange, 
  onDestinationChange 
}: { 
  pickup: [number, number] | null, 
  destination: [number, number] | null,
  onPickupChange: (pos: [number, number]) => void,
  onDestinationChange: (pos: [number, number]) => void
}) {
  const [mode, setMode] = useState<"pickup" | "destination">("pickup");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        <Button 
          type="button" 
          variant="outline"
          onClick={() => setMode("pickup")}
          className={`flex-1 border-2 font-bold ${mode === "pickup" ? "bg-green-50 border-green-500 text-green-700" : "border-green-500/30 text-green-600"}`}
        >
          🟢 تحديد موقع التحميل
        </Button>
        <Button 
          type="button" 
          variant="outline"
          onClick={() => setMode("destination")}
          className={`flex-1 border-2 font-bold ${mode === "destination" ? "bg-red-50 border-red-500 text-red-700" : "border-red-500/30 text-red-600"}`}
        >
          🔴 تحديد موقع التوصيل
        </Button>
      </div>
      <div className="h-[450px] rounded-xl overflow-hidden border-2 border-border relative z-0">
        <MapContainer center={[33.3152, 44.3661]} zoom={11} style={{ height: "100%", width: "100%" }}>
          <MapController onPickupChange={onPickupChange} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents mode={mode} setMode={setMode} onPickupChange={onPickupChange} onDestinationChange={onDestinationChange} />
          {pickup && <Marker position={pickup} />}
          {destination && <Marker position={destination} />}
        </MapContainer>
      </div>
    </div>
  );
}

function MapEvents({ mode, setMode, onPickupChange, onDestinationChange }: any) {
  useMapEvents({
    click(e) {
      if (mode === "pickup") {
        onPickupChange([e.latlng.lat, e.latlng.lng]);
        setMode("destination");
      } else {
        onDestinationChange([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

const formSchema = insertRequestSchema.extend({
  location: z.string().min(3, "يرجى تحديد موقع التحميل"),
  destination: z.string().min(3, "يرجى تحديد موقع التوصيل"),
  pickupLat: z.number(),
  pickupLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
  vehicleType: z.string().min(1, "يرجى اختيار نوع السطحة"),
  price: z.string(),
  timeMode: z.enum(["now", "later"]),
  scheduledAt: z.string().optional(),
});

const BASE_RATES = {
  small: 15000,
  large: 30000,
  hydraulic: 25000
};

const KM_RATE = 2000;

export default function RequestFlow() {
  const [isSuccess, setIsSuccess] = useState(false);
  const { mutate, isPending } = useCreateRequest();
  const [, setLocation] = useLocation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "موقع محدد من الخريطة",
      destination: "وجهة محددة من الخريطة",
      pickupLat: 0,
      pickupLng: 0,
      destLat: 0,
      destLng: 0,
      vehicleType: "",
      price: "",
      timeMode: "now" as const,
    },
  });

  const watchVehicle = form.watch("vehicleType");
  const watchPickup = [form.watch("pickupLat"), form.watch("pickupLng")] as [number, number];
  const watchDest = [form.watch("destLat"), form.watch("destLng")] as [number, number];

  useEffect(() => {
    if (watchVehicle && form.getValues("pickupLat") !== 0 && form.getValues("destLat") !== 0) {
      const p1 = L.latLng(form.getValues("pickupLat"), form.getValues("pickupLng"));
      const p2 = L.latLng(form.getValues("destLat"), form.getValues("destLng"));
      const distance = p1.distanceTo(p2) / 1000; // in km
      
      const base = BASE_RATES[watchVehicle as keyof typeof BASE_RATES] || 20000;
      const total = base + (distance * KM_RATE);
      form.setValue("price", `${Math.round(total / 250) * 250} د.ع`);
    }
  }, [watchVehicle, form.watch("pickupLat"), form.watch("pickupLng"), form.watch("destLat"), form.watch("destLng")]);

  const onSubmit = (data: FormValues) => {
    const formattedData = {
      ...data,
      pickupLat: data.pickupLat.toString(),
      pickupLng: data.pickupLng.toString(),
      destLat: data.destLat.toString(),
      destLng: data.destLng.toString(),
    };
    mutate(formattedData, {
      onSuccess: () => setIsSuccess(true),
    });
  };

  const handleVehicleSelect = (id: string, price: string) => {
    form.setValue("vehicleType", id);
    form.setValue("price", price);
    form.clearErrors("vehicleType");
  };

  const [driverBalance, setDriverBalance] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    // Polling for request status updates
    const interval = setInterval(() => {
      fetch("/api/requests")
        .then(res => res.json())
        .then(data => {
          const current = data.find((r: any) => r.status === "confirmed" || r.status === "completed");
          if (current) {
            setActiveRequest(current);
            if (current.status === "completed" && !current.rating) {
              // Show rating modal logic would go here
            }
          }
        })
        .catch(console.error);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const submitRating = async (stars: number) => {
    if (!activeRequest) return;
    try {
      await apiRequest("PATCH", `/api/requests/${activeRequest.id}`, { 
        status: "rated", 
        rating: stars 
      });
      setActiveRequest(null);
      toast({ title: "شكراً لتقييمك!", description: "تم إرسال تقييمك بنجاح." });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل إرسال التقييم" });
    }
  };

  useEffect(() => {
    fetch("/api/drivers/1")
      .then(res => res.json())
      .then(data => setDriverBalance(data.walletBalance))
      .catch(console.error);
  }, []);

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
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-0" dir="rtl">
      {/* Rating Overlay */}
      <AnimatePresence>
        {activeRequest && activeRequest.status === "completed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <Card className="w-full max-w-sm border-2 border-primary shadow-2xl text-center">
              <CardContent className="pt-8 pb-8 px-6 space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Truck className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">تقييم الخدمة</h2>
                <p className="text-muted-foreground">كيف كانت تجربتك مع السائق؟</p>
                
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-4xl transition-transform active:scale-90 ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={() => submitRating(rating)}
                  disabled={rating === 0}
                  className="w-full h-12 text-lg font-bold rounded-xl mt-4"
                >
                  إرسال التقييم
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver Balance Info (Simulating Driver View) */}
      {driverBalance !== null && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex justify-between items-center text-sm">
          <span className="font-bold text-orange-800">رصيد المحفظة:</span>
          <span className="font-mono font-bold text-orange-900">{parseFloat(driverBalance).toLocaleString()} د.ع</span>
        </div>
      )}
      {/* Header / AppBar */}
      <header className="bg-primary shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/")}
              className="text-black hover:bg-black/10"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </Button>
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
              
              {/* Location & Time Section */}
              <Card className="border-border shadow-sm overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-4 mb-4 sr-only">
                    <FormField
                      control={form.control}
                      name="timeMode"
                      render={({ field }) => (
                        <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="now" className="gap-2">
                              <Clock className="w-4 h-4" /> الآن
                            </TabsTrigger>
                            <TabsTrigger value="later" className="gap-2">
                              <CalendarCheck className="w-4 h-4" /> لاحقاً
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      )}
                    />
                  </div>

                  <LocationPicker 
                    pickup={form.getValues("pickupLat") !== 0 ? [form.watch("pickupLat"), form.watch("pickupLng")] : null}
                    destination={form.getValues("destLat") !== 0 ? [form.watch("destLat"), form.watch("destLng")] : null}
                    onPickupChange={(pos) => {
                      form.setValue("pickupLat", pos[0]);
                      form.setValue("pickupLng", pos[1]);
                    }}
                    onDestinationChange={(pos) => {
                      form.setValue("destLat", pos[0]);
                      form.setValue("destLng", pos[1]);
                    }}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sr-only">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>موقع التحميل</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="destination"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>وجهة التوصيل</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
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
