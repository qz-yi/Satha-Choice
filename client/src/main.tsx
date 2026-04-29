import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Persistent caching: نسجّل Service Worker في بيئة الإنتاج فقط
// (في وضع التطوير قد يتعارض مع HMR التابع لـ Vite). يقوم بتخزين
// كل بلاطة خريطة يتم تحميلها في cache دائم بحيث يعمل التطبيق
// أوفلاين بعد أول تصفح للمناطق.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* noop */
    });
  });
}
