import { cn } from "@/lib/utils";
import { Check, Car, Truck, ArrowUpCircle } from "lucide-react";
import { motion } from "framer-motion";

interface VehicleOptionProps {
  id: string;
  label: string;
  price: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function VehicleCard({ id, label, price, description, isSelected, onSelect }: VehicleOptionProps) {
  // Map ID to Icon
  const getIcon = () => {
    switch (id) {
      case "small": return <Car className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
      case "large": return <Truck className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
      case "hydraulic": return <ArrowUpCircle className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
      default: return <Car className="w-8 h-8 md:w-10 md:h-10 text-primary" />;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={cn(
        "relative flex items-center p-4 md:p-6 mb-4 rounded-xl border-2 cursor-pointer transition-all duration-300 shadow-sm bg-card",
        isSelected 
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10" 
          : "border-border hover:border-primary/40 hover:shadow-md"
      )}
    >
      {/* Icon Container */}
      <div className="flex-shrink-0 ml-4 p-3 bg-primary/10 rounded-full">
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-grow">
        <h3 className={cn("text-lg md:text-xl font-bold mb-1", isSelected ? "text-primary-dark" : "text-foreground")}>
          {label}
        </h3>
        <p className="text-sm text-muted-foreground font-medium">
          التسعيرة التقريبية: <span className="text-foreground font-bold font-mono">{price}</span>
        </p>
      </div>

      {/* Radio Indicator */}
      <div className={cn(
        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200",
        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
      )}>
        {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
      </div>
    </motion.div>
  );
}
