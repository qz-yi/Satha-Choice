import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, User, ArrowLeftRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center p-4 md:p-8" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="bg-primary p-4 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto shadow-lg">
            <Truck className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">تطبيق سطحة</h1>
          <p className="text-muted-foreground text-lg">أهلاً بك، يرجى اختيار نوع الحساب للمتابعة</p>
        </div>

        <div className="grid gap-6">
          <Card 
            className="hover:border-primary cursor-pointer transition-all hover:shadow-xl group overflow-hidden border-2"
            onClick={() => setLocation("/")}
          >
            <CardContent className="p-8 flex items-center gap-6">
              <div className="bg-blue-50 p-4 rounded-xl group-hover:bg-primary transition-colors">
                <User className="w-10 h-10 text-blue-600 group-hover:text-black" />
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold mb-1">أنا زبون</h2>
                <p className="text-muted-foreground">أبحث عن سطحة لنقل سيارتي</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:border-primary cursor-pointer transition-all hover:shadow-xl group overflow-hidden border-2"
            onClick={() => setLocation("/driver")}
          >
            <CardContent className="p-8 flex items-center gap-6">
              <div className="bg-orange-50 p-4 rounded-xl group-hover:bg-primary transition-colors">
                <Truck className="w-10 h-10 text-orange-600 group-hover:text-black" />
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold mb-1">أنا سائق</h2>
                <p className="text-muted-foreground">أريد تقديم خدمات النقل والربح</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-muted-foreground pt-8 flex items-center justify-center gap-2">
          <ArrowLeftRight className="w-4 h-4" />
          <span>يمكنك التغيير بين الواجهات في أي وقت</span>
        </div>
      </motion.div>
    </div>
  );
}
