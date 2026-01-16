import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";

interface SplashScreenProps {
  isLoaded: boolean;
}

export function SplashScreen({ isLoaded }: SplashScreenProps) {
  // مراجع الملف الصوتي لضمان الأداء
  const wooshRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // إعداد ملف الصوت الجديد
    wooshRef.current = new Audio("/sounds/deep-woosh.mp3");
    if (wooshRef.current) wooshRef.current.volume = 0.6;

    const playWoosh = () => {
      // تشغيل الصوت ليتزامن مع حركة صعود كلمة "سطحة"
      setTimeout(() => {
        wooshRef.current?.play().catch(() => {
          console.log("Audio waiting for interaction");
        });
      }, 200);
    };

    // محاولة التشغيل التلقائي
    playWoosh();

    // التفعيل عند أول لمسة أو نقرة لضمان عمل الصوت في المتصفح
    const handleInteraction = () => {
      playWoosh();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isLoaded && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ y: "-100%", transition: { duration: 0.8, ease: "easeInOut" } }}
          className="fixed inset-0 bg-zinc-950 z-[9999] flex flex-col items-center justify-center overflow-hidden font-sans"
          dir="rtl"
        >
          {/* الخلفية المزخرفة */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="w-full h-full">
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* الإضاءة الخلفية */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-600/20 blur-[100px] rounded-full pointer-events-none" />

          {/* المحتوى النصي */}
          <div className="relative z-10 flex flex-col items-center">
            
            {/* كلمة سطحة */}
            <div className="overflow-hidden px-4 mb-2">
              <motion.h1
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: "circOut", delay: 0.2 }}
                className="text-8xl md:text-9xl font-black text-white tracking-tighter leading-none select-none"
                style={{ fontFamily: "sans-serif" }}
              >
                سطحـة
              </motion.h1>
            </div>

            {/* الخط الفاصل */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="h-2 bg-orange-500 rounded-full mb-6"
            />

            {/* النص الإنجليزي */}
            <div className="overflow-hidden">
              <motion.span
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="text-orange-500 font-bold text-xl tracking-[0.5em] uppercase block"
              >
                SATHA PRO
              </motion.span>
            </div>

            {/* العنوان الفرعي */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="flex items-center gap-2 mt-4 text-gray-400 text-sm"
            >
                <MapPin className="w-4 h-4 text-orange-500" />
                <span>نصلك أينما كنت</span>
            </motion.div>

          </div>

          {/* شريط التحميل السفلي */}
          <div className="absolute bottom-12 w-64">
            <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                    className="h-full bg-white w-full origin-left"
                />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono uppercase">
                <span>Loading</span>
                <span>100%</span>
            </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}