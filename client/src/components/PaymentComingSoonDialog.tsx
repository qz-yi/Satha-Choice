import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";
import { motion } from "framer-motion";

interface PaymentComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentComingSoonDialog({
  open,
  onOpenChange,
}: PaymentComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-sm mx-auto p-0 border-none rounded-[32px] overflow-hidden bg-gradient-to-b from-[#1a1a1a] to-black shadow-2xl"
        data-testid="dialog-payment-coming-soon"
      >
        <div className="relative px-7 pt-10 pb-8 text-center">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_10px_40px_rgba(255,122,0,0.45)]"
          >
            <motion.div
              animate={{ rotate: [0, 180, 360] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Hourglass className="w-11 h-11 text-white" strokeWidth={2.2} />
            </motion.div>
          </motion.div>

          <h2
            className="relative text-white text-2xl font-black mb-3 tracking-tight"
            data-testid="text-payment-coming-soon-title"
          >
            الدفع الإلكتروني غير متاح حالياً
          </h2>
          <p
            className="relative text-white/70 text-sm font-bold leading-relaxed mb-2"
            data-testid="text-payment-coming-soon-subtitle"
          >
            سوف يتوفر قريباً
          </p>
          <p className="relative text-white/40 text-xs font-bold leading-relaxed mb-8">
            نعمل على تجهيز بوابات الدفع لخدمتكم بأفضل تجربة ممكنة
          </p>

          <Button
            onClick={() => onOpenChange(false)}
            className="relative w-full h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-lg font-black shadow-lg shadow-orange-500/30 transition-all"
            data-testid="button-payment-coming-soon-close"
          >
            حسناً
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
