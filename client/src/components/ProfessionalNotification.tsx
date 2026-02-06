import { useEffect } from "react";

interface NotificationProps {
  show: boolean;
  message: string;
  onClose: () => void;
  type?: "new_order" | "success" | "error" | "info";
}

export function ProfessionalNotification({ show, message, onClose, type = "new_order" }: NotificationProps) {
  useEffect(() => {
    if (show && type === "new_order") {
      // Request notification permission if not granted
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      
      // Show native browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("SATHA - سطحة", {
          body: "هناك طلب نقل جديد",
          icon: "/logo.png",
          badge: "/logo.png",
          tag: "new-order",
          requireInteraction: false,
          vibrate: [200, 100, 200],
          silent: false // Uses device's default notification sound
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
          onClose();
        }, 5000);
      } else {
        // Fallback: just close after 5 seconds if permission denied
        const timer = setTimeout(() => {
          onClose();
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [show, type, onClose, message]);

  // Native notifications don't need visual component
  // The browser handles the UI in the system tray
  return null;
}
