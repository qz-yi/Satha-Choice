import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, LogOut, Signal, SignalLow } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/drivers/1")
      .then(res => res.json())
      .then(data => {
        setDriver(data);
        setIsOnline(data.isOnline);
      })
      .catch(console.error);
  }, []);

  const toggleStatus = async () => {
    try {
      const newStatus = !isOnline;
      await apiRequest("PATCH", "/api/drivers/1/status", { isOnline: newStatus });
      setIsOnline(newStatus);
      toast({
        title: newStatus ? "أنت متصل الآن" : "أنت غير متصل",
        description: newStatus ? "يمكنك الآن استقبال طلبات الزبائن" : "لن تصلك أي طلبات جديدة",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل تحديث الحالة",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8" dir="rtl">
      <header className="max-w-md mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">لوحة تحكم السائق</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">حالة السائق</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className={`flex flex-col items-center justify-center p-8 rounded-2xl transition-colors ${isOnline ? 'bg-green-50' : 'bg-red-50'}`}>
              {isOnline ? (
                <Signal className="w-16 h-16 text-green-600 mb-4 animate-pulse" />
              ) : (
                <SignalLow className="w-16 h-16 text-red-600 mb-4" />
              )}
              <span className={`text-2xl font-bold ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
                {isOnline ? "متصل (متاح الآن)" : "غير متصل"}
              </span>
            </div>

            <div className="grid gap-4">
              <Button 
                onClick={toggleStatus}
                size="lg"
                variant={isOnline ? "destructive" : "default"}
                className="h-16 text-xl font-bold rounded-xl"
                data-testid="button-toggle-status"
              >
                {isOnline ? "خروج (إيقاف الاستقبال)" : "أنا متاح الآن"}
              </Button>
              
              {!isOnline && (
                <p className="text-center text-muted-foreground text-sm">
                  يجب أن تكون متصلاً لاستقبال طلبات الزبائن
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {driver && (
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <span className="text-muted-foreground">رصيد المحفظة:</span>
              <span className="text-xl font-bold font-mono">{parseFloat(driver.walletBalance).toLocaleString()} د.ع</span>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
