import { motion, AnimatePresence } from "framer-motion";
import { Bell, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";

interface NotificationProps {
  show: boolean;
  message: string;
  onClose: () => void;
  type?: "new_order" | "success" | "error" | "info";
}

export function ProfessionalNotification({ show, message, onClose, type = "new_order" }: NotificationProps) {
  const [shouldVibrate, setShouldVibrate] = useState(false);

  useEffect(() => {
    if (show && type === "new_order") {
      setShouldVibrate(true);
      
      // Play notification sound
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi2J1fDTgjMGHm7A7+OZRA0PVqzn77BdGQlCm9vyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+Dyv3MgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUHGmu/7NyYQg0PU6nn7ahVFApGn+DyvnMgBjiH0vDWhzUH");
      audio.volume = 0.5;
      audio.play().catch(() => {});
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [show, type, onClose]);

  const getNotificationStyle = () => {
    switch (type) {
      case "new_order":
        return {
          bg: "bg-gradient-to-br from-orange-500 via-orange-600 to-red-500",
          icon: <Truck className="w-8 h-8 text-white" />,
          accentColor: "bg-white/20"
        };
      case "success":
        return {
          bg: "bg-gradient-to-br from-green-500 to-emerald-600",
          icon: <Bell className="w-8 h-8 text-white" />,
          accentColor: "bg-white/20"
        };
      case "error":
        return {
          bg: "bg-gradient-to-br from-red-500 to-rose-600",
          icon: <X className="w-8 h-8 text-white" />,
          accentColor: "bg-white/20"
        };
      default:
        return {
          bg: "bg-gradient-to-br from-blue-500 to-indigo-600",
          icon: <Bell className="w-8 h-8 text-white" />,
          accentColor: "bg-white/20"
        };
    }
  };

  const style = getNotificationStyle();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -200, opacity: 0, scale: 0.8 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: shouldVibrate ? [1, 1.05, 0.95, 1.02, 1] : 1,
          }}
          exit={{ y: -200, opacity: 0, scale: 0.8 }}
          transition={{ 
            type: "spring", 
            stiffness: 500, 
            damping: 25,
            duration: 0.3 
          }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md"
        >
          <div className={`${style.bg} rounded-[32px] shadow-2xl p-6 relative overflow-hidden`}>
            {/* Animated background pattern */}
            <motion.div
              className="absolute inset-0 opacity-10"
              animate={{
                backgroundPosition: ["0% 0%", "100% 100%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, white 2px, transparent 2px), radial-gradient(circle at 80% 80%, white 2px, transparent 2px)",
                backgroundSize: "50px 50px",
              }}
            />
            
            {/* Accent bar */}
            <motion.div
              className={`absolute top-0 left-0 right-0 h-2 ${style.accentColor}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 5 }}
            />
            
            <div className="flex items-center gap-4 relative z-10">
              {/* Icon with pulse animation */}
              <motion.div
                animate={{
                  scale: type === "new_order" ? [1, 1.2, 1] : 1,
                }}
                transition={{
                  duration: 1,
                  repeat: type === "new_order" ? Infinity : 0,
                  repeatDelay: 0.5,
                }}
                className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
              >
                {style.icon}
              </motion.div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className="text-white font-black text-xl leading-tight mb-1">
                  {type === "new_order" ? "طلب جديد!" : "إشعار"}
                </h3>
                <p className="text-white/90 font-bold text-sm leading-snug">
                  {message}
                </p>
              </div>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* Decorative elements */}
            <motion.div
              className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
