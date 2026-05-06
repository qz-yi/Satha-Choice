import { useState, useEffect, useCallback, memo, useRef } from "react";
import { API_BASE } from "@/lib/http";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VEHICLE_OPTIONS } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import {
  calculateDistance,
  calculatePrice,
  getPricingBreakdown,
} from "@/lib/pricing";
import {
  MapPin,
  Check,
  Search,
  Loader2,
  Menu,
  MessageSquare,
  History,
  Wallet,
  Phone,
  Truck,
  ChevronRight,
  LocateFixed,
  RotateCcw,
  X,
  Star,
  Navigation,
  Target,
  Send,
  LogOut,
  Camera,
  User,
  Lock,
  Home,
  ShieldCheck,
  CreditCard,
  QrCode,
  GripHorizontal,
  DollarSign,
  AlertCircle,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useMapEvents,
  Marker,
  useMap,
  Popup,
  SathaMap,
  L,
} from "@/components/SathaMap";
import { getSocket } from "@/lib/socket";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { RoutingPolyline } from "@/components/RoutingPolyline";
import { PaymentComingSoonDialog } from "@/components/PaymentComingSoonDialog";

// Resolve image URLs — relative paths (/uploads/...) need API_BASE in Capacitor
const resolveImageUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
};

// CRITICAL: Use singleton socket instance
let socket: any;
if (typeof window !== "undefined") {
  socket = getSocket();
}

const getOrangeArrowIcon = (rotation: number) =>
  L.divIcon({
    html: `
    <div style="transform: rotate(${rotation}deg); transition: transform 0.4s; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.3));">
      <svg width="45" height="45" viewBox="0 0 100 100" fill="none">
        <path d="M50 5L92 90L50 72L8 90L50 5Z" fill="#f97316" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>`,
    className: "",
    iconSize: [45, 45],
    iconAnchor: [22.5, 22.5],
  });

// Custom pin icon for a confirmed pickup point visible during destination selection
const getPickupPinIcon = () =>
  L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0px 4px 12px rgba(249,115,22,0.55))">
      <div style="background:#f97316;color:#fff;font-size:11px;font-weight:900;padding:4px 10px;border-radius:12px;white-space:nowrap;font-family:sans-serif;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(249,115,22,0.4)">تحميل</div>
      <div style="width:2px;height:14px;background:linear-gradient(#f97316,rgba(249,115,22,0.3));border-radius:2px"></div>
      <div style="width:12px;height:12px;background:#f97316;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);margin-top:-2px"></div>
    </div>`,
    className: "",
    iconSize: [80, 44],
    iconAnchor: [40, 44],
  });

const getDropoffPinIcon = () =>
  L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0px 4px 12px rgba(0,0,0,0.45))">
      <div style="background:#111827;color:#fff;font-size:11px;font-weight:900;padding:4px 10px;border-radius:12px;white-space:nowrap;font-family:sans-serif;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(0,0,0,0.35)">وجهة</div>
      <div style="width:2px;height:14px;background:linear-gradient(#111827,rgba(17,24,39,0.3));border-radius:2px"></div>
      <div style="width:12px;height:12px;background:#111827;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);margin-top:-2px"></div>
    </div>`,
    className: "",
    iconSize: [70, 44],
    iconAnchor: [35, 44],
  });

const normalizeCity = (city: string): string => {
  if (!city) return "بابل";
  const c = city.toLowerCase();
  if (
    c.includes("babil") ||
    c.includes("بابل") ||
    c.includes("hilla") ||
    c.includes("حلة")
  )
    return "بابل";
  if (c.includes("baghdad") || c.includes("بغداد")) return "بغداد";
  if (c.includes("karbala") || c.includes("كربلاء")) return "كربلاء";
  if (c.includes("najaf") || c.includes("نجف")) return "النجف";
  if (c.includes("basra") || c.includes("بصرة")) return "البصرة";
  return city;
};

function FlyToMarker({
  center,
  shouldFly,
}: {
  center: [number, number];
  shouldFly: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (shouldFly && center && center[0] && center[1]) {
      map.flyTo(center, 16, { duration: 1.5 });
    }
  }, [center, map, shouldFly]);
  return null;
}

const SidebarLink = memo(
  ({
    icon,
    label,
    extra,
    onClick,
    color = "text-orange-600",
    extraColor = "bg-gray-100 text-gray-500",
  }: any) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-orange-50 active:scale-[0.97] transition-all rounded-2xl text-right group mb-3 border border-transparent hover:border-orange-100"
    >
      <div className="flex items-center gap-4">
        <div
          className={`${color} p-2.5 rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform`}
        >
          {icon}
        </div>
        <span className="text-[15px] font-black text-gray-700">{label}</span>
      </div>
      {extra && (
        <span
          className={`text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm ${extraColor}`}
        >
          {extra}
        </span>
      )}
    </button>
  ),
);

const StepIndicator = ({ step }: { step: string }) => {
  const steps = [{ id: "pickup" }, { id: "dropoff" }, { id: "vehicle" }];
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      {steps.map((s) => (
        <div
          key={s.id}
          className={`h-1.5 rounded-full transition-all duration-500 ${step === s.id ? "w-8 bg-orange-500" : "w-4 bg-gray-200"}`}
        />
      ))}
    </div>
  );
};

// Client-side pricing — mirrors server DEFAULT_PRICING, used ONLY as last-resort fallback
// when the /api/calculate-fare endpoint is completely unreachable.
// NOTE: these are DEFAULTS only; if admin changed pricing in DB, this won't reflect that.
const CLIENT_PRICING: Record<string, { baseFare: number; kmRate: number; minuteRate: number; minimumFare: number }> = {
  "سطحة":    { baseFare: 25000, kmRate: 1250, minuteRate: 500,  minimumFare: 35000 },
  "سحب":     { baseFare: 20000, kmRate: 1000, minuteRate: 400,  minimumFare: 30000 },
  "هيدروليك":{ baseFare: 50000, kmRate: 2500, minuteRate: 1000, minimumFare: 70000 },
};
// Applies the same formula as calculateDynamicFare on the server
const getClientFare = (vehicleType: string, distanceKm: number, durationMin = 0, surge = 1.0): number => {
  const cfg    = CLIENT_PRICING[vehicleType] || CLIENT_PRICING["سطحة"];
  const addKm  = Math.max(0, distanceKm - 7);
  const sub    = cfg.baseFare + addKm * cfg.kmRate + durationMin * cfg.minuteRate;
  return Math.round(Math.max(sub * surge, cfg.minimumFare));
};
const getClientMinFare = (vehicleType: string): number =>
  (CLIENT_PRICING[vehicleType] || CLIENT_PRICING["سطحة"]).minimumFare;

export default function RequestFlow() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"choice" | "login" | "signup">(
    "choice",
  );
  const [userProfile, setUserProfile] = useState({
    id: null as number | null,
    username: "",
    phone: "",
    password: "",
    address: "قيد التحديد",
    image: null as string | null,
    wallet: "0",
    trips: "0",
  });

  const [step, setStep] = useState<"pickup" | "dropoff" | "vehicle">("pickup");
  const [viewState, setViewState] = useState<
    "booking" | "success" | "tracking"
  >("booking");
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true); // CRITICAL: Loading state during recovery
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [shouldFly, setShouldFly] = useState(false);
  const [requestStatus, setRequestStatus] = useState("pending");
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(
    null,
  );
  const [driverHeading, setDriverHeading] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [showPaymentSoonModal, setShowPaymentSoonModal] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [tripsHistory, setTripsHistory] = useState<any[]>([]);
  const [chargeAmount, setChargeAmount] = useState("");

  // Professional Wallet States (replicated from Driver)
  const [isDepositing, setIsDepositing] = useState(false);
  const [walletPaymentMethod, setWalletPaymentMethod] = useState<
    "zain" | "card" | null
  >(null);
  const [depositAmount, setDepositAmount] = useState<string>("25000");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderAcceptedAt, setOrderAcceptedAt] = useState<number | null>(null); // timestamp when driver accepted

  // Bottom Sheet Smart Handle State
  const [isSheetExpanded, setIsSheetExpanded] = useState(true); // true = expanded (50%), false = minimized (15%)

  // Fix 3: Confirmed pickup coordinates — set once when user taps "Confirm Pickup",
  // then rendered as a static imperative marker that never follows the map center.
  const [confirmedPickupCoord, setConfirmedPickupCoord] = useState<[number, number] | null>(null);

  // FEATURE 2: Dynamic Pricing State
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false);
  const [isPriceCalculating, setIsPriceCalculating] = useState(false); // CRITICAL FIX #2: Loading state for price

  const fileInputRef = useRef<HTMLInputElement>(null);
  const signupFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Fix 4: Debounce ref for search — prevents firing a request on every keystroke
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formData, setFormData] = useState({
    location: "",
    destination: "",
    pickupLat: 32.4846,
    pickupLng: 44.4209,
    destLat: 32.4846,
    destLng: 44.4209,
    vehicleType: "",
    price: "",
    timeMode: "now" as "now" | "later",
    city: "بابل",
  });

  const handleMarkerDragEnd = async (e: any, type: 'pickup' | 'destination') => {
    const { lat, lng } = e.target.getLatLng();
    setFormData(prev => ({
      ...prev,
      [type === 'pickup' ? 'pickupLat' : 'destLat']: lat,
      [type === 'pickup' ? 'pickupLng' : 'destLng']: lng
    }));
    
    // Auto reverse geocode
    await reverseGeocode(lat, lng, type);
    
    // Only calculate fare if both are set and we are in vehicle step
    if (formData.pickupLat && formData.destLat && formData.vehicleType) {
      calculateFare();
    }
  };

  const scrollChatToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const refreshUserData = useCallback(
    async (phone: string, pass: string) => {
      try {
        const response = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone, password: pass }),
        });
        if (response.ok) {
          const data = await response.json();

          const updatedProfile = {
            ...userProfile,
            id: data.id,
            username: data.username || data.name,
            phone: phone,
            password: pass,
            wallet: data.walletBalance?.toString() || "0",
            trips: data.tripsCount?.toString() || "0",
            image: data.image || userProfile.image || "", // CRITICAL: Include image from DB
          };

          setUserProfile(updatedProfile);
          try {
            localStorage.setItem("sat7a_user", JSON.stringify(updatedProfile));
          } catch (e) {
            localStorage.removeItem("sat7a_user");
            localStorage.setItem("sat7a_user", JSON.stringify(updatedProfile));
          }
        }
      } catch (err) {
      }
    },
    [userProfile],
  );

  // جلب الرسائل القديمة عند فتح الدردشة
  useEffect(() => {
    if (isChatOpen && activeOrderId) {
      fetch(`${API_BASE}/api/requests/${activeOrderId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          setMessages(data);
          setTimeout(scrollChatToBottom, 100);
        })
        .catch(() => {});
    }
  }, [isChatOpen, activeOrderId]);

  // جلب سجل الرحلات عند فتح القائمة
  useEffect(() => {
    if (isHistoryOpen && userProfile.phone) {
      fetch(`${API_BASE}/api/users/${userProfile.phone}/requests`)
        .then((res) => res.json())
        .then((data) => {
          // فلترة الرحلات المكتملة فقط
          const completedTrips = data.filter(
            (trip: any) => trip.status === "completed",
          );
          setTripsHistory(completedTrips);
        })
        .catch((err) => {
          toast({
            variant: "destructive",
            title: "فشل تحميل سجل الرحلات",
            description: "يرجى المحاولة مرة أخرى",
          });
        });
    }
  }, [isHistoryOpen, userProfile.phone, toast]);

  // SINGLE-USE recovery flag to prevent continuous loops
  const hasAttemptedRecovery = useRef(false);

  // EMERGENCY: MANDATORY Recovery check MUST run ONCE on mount to check for active orders
  useEffect(() => {
    // SINGLE-USE recovery check - prevent loops
    if (hasAttemptedRecovery.current) {
      return;
    }
    hasAttemptedRecovery.current = true;

    // FEATURE 3: Check for existing session and auto-login
    const savedUser = localStorage.getItem("sat7a_user");
    const sessionActive = localStorage.getItem("sat7a_session_active");

    if (savedUser && sessionActive === "true") {
      try {
        const parsed = JSON.parse(savedUser);
        setUserProfile(parsed);
        setIsLoggedIn(true);
      } catch (e) {
      }
    }

    // If there's a saved user OR we're already logged in, attempt recovery
    if (savedUser || userProfile.phone) {
      let phoneToCheck = userProfile.phone;

      // If no phone in state but savedUser exists, parse it
      if (!phoneToCheck && savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          phoneToCheck = parsed.phone;

          // Update state if not already set
          if (!userProfile.phone) {
            setUserProfile(parsed);
            setIsLoggedIn(true);
          }

          // Refresh user data if we have credentials
          if (parsed.phone && parsed.password) {
            refreshUserData(parsed.phone, parsed.password);
          }
        } catch (e) {
        }
      }

      // MANDATORY: Always check for active order if we have a phone
      if (phoneToCheck) {
        fetchActiveOrderFromAPI(phoneToCheck);
      } else {
        setIsCheckingRecovery(false);
      }
    } else {
      setIsCheckingRecovery(false);
    }
  }, []); // Empty deps - runs ONCE on mount only

  // CRITICAL: Fetch latest balance whenever wallet is opened
  useEffect(() => {
    if (isWalletOpen && userProfile.phone) {

      const fetchLatestBalance = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: userProfile.phone,
              password: userProfile.password,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const latestBalance = data.walletBalance?.toString() || "0";

            // Update state
            setUserProfile((prev) => {
              const updated = { ...prev, wallet: latestBalance };

              // Update localStorage
              try {
                localStorage.setItem("sat7a_user", JSON.stringify(updated));
              } catch (e) {
              }

              return updated;
            });
          } else {
          }
        } catch (error) {
        }
      };

      fetchLatestBalance();
    }
  }, [isWalletOpen]); // Runs whenever wallet is opened

  // CRITICAL: Customer-side order recovery from API
  const fetchActiveOrderFromAPI = async (customerPhone: string) => {
    try {

      // Use correct endpoint: /api/users/:phone/requests
      const response = await fetch(`${API_BASE}/api/users/${customerPhone}/requests`);

      if (!response.ok) {
        setIsCheckingRecovery(false); // CRITICAL: End loading state
        return;
      }

      const orders = await response.json();

      // MANDATORY FIX: STRICT FILTERING with explicit completed/delivered/cancelled check
      const activeOrder = orders.find((order: any) => {
        // CRITICAL: Exclude completed, delivered, cancelled
        if (
          order.status === "delivered" ||
          order.status === "completed" ||
          order.status === "cancelled"
        ) {
          return false;
        }

        // ONLY restore these statuses
        const validStatuses = [
          "pending",
          "accepted",
          "arrived",
          "picked_up",
          "in_progress",
        ];
        const isValid = validStatuses.includes(order.status);

        if (!isValid) {
        }

        return isValid;
      });

      if (!activeOrder) {
        localStorage.removeItem("sat7a_active_order_id");
        setIsCheckingRecovery(false); // CRITICAL: End loading state - safe to show booking view
        return;
      }

      // DOUBLE-CHECK: Verify status is truly active (redundant safety check)
      if (
        activeOrder.status === "delivered" ||
        activeOrder.status === "completed" ||
        activeOrder.status === "cancelled"
      ) {
        localStorage.removeItem("sat7a_active_order_id");
        setIsCheckingRecovery(false); // CRITICAL: End loading state
        return; // ABORT restoration
      }

      setActiveOrderId(activeOrder.id);
      setRequestStatus(activeOrder.status);

      // EMERGENCY FIX: Force correct view based on status
      if (activeOrder.status === "pending") {
        setViewState("success"); // Show "Searching for driver" state
      } else if (
        ["accepted", "arrived", "picked_up", "in_progress"].includes(
          activeOrder.status,
        )
      ) {
        setViewState("tracking"); // Show tracking state with driver
        setRequestStatus(activeOrder.status); // CRITICAL: Set correct status
      } else {
        setViewState("tracking");
      }

      // CRITICAL FIX: Hydrate driver data for ALL non-pending statuses (especially 'accepted')
      if (activeOrder.driverId) {

        if (activeOrder.driver) {
          // BEST CASE: API response includes full driver object

          // IMMEDIATE STATE HYDRATION - Set ALL driver state from API response
          setDriverInfo({
            id: activeOrder.driver.id,
            name: activeOrder.driver.name,
            phone: activeOrder.driver.phone,
            avatarUrl: activeOrder.driver.avatarUrl || "",
            vehicleType: activeOrder.driver.vehicleType || "سطحة",
            plateNumber: activeOrder.driver.plateNumber || "",
          });

          // CRITICAL: Restore driver's LIVE LOCATION for immediate tracking
          if (activeOrder.driver.lat && activeOrder.driver.lng) {
            const driverLat = Number(activeOrder.driver.lat);
            const driverLng = Number(activeOrder.driver.lng);
            setDriverLocation([driverLat, driverLng]);
          } else if (activeOrder.driver.lastLat && activeOrder.driver.lastLng) {
            const driverLat = Number(activeOrder.driver.lastLat);
            const driverLng = Number(activeOrder.driver.lastLng);
            setDriverLocation([driverLat, driverLng]);
          } else {
          }
        } else {
          // MANDATORY FALLBACK: If driver object is missing from API, fetch separately

          const driverResponse = await fetch(
            `${API_BASE}/api/drivers/${activeOrder.driverId}`,
          );
          if (driverResponse.ok) {
            const driverData = await driverResponse.json();

            setDriverInfo({
              id: driverData.id,
              name: driverData.name,
              phone: driverData.phone,
              avatarUrl: driverData.avatarUrl || "",
              vehicleType: driverData.vehicleType || "سطحة",
              plateNumber: driverData.plateNumber || "",
            });

            if (driverData.lat && driverData.lng) {
              const driverLat = Number(driverData.lat);
              const driverLng = Number(driverData.lng);
              setDriverLocation([driverLat, driverLng]);
            } else if (driverData.lastLat && driverData.lastLng) {
              const driverLat = Number(driverData.lastLat);
              const driverLng = Number(driverData.lastLng);
              setDriverLocation([driverLat, driverLng]);
            }
          } else {
          }
        }
      } else {
      }

      // Restore form data for map display
      setFormData((prev) => ({
        ...prev,
        pickupLat: activeOrder.pickupLat,
        pickupLng: activeOrder.pickupLng,
        destLat: activeOrder.destLat || activeOrder.dropoffLat,
        destLng: activeOrder.destLng || activeOrder.dropoffLng,
        location: activeOrder.pickupAddress || activeOrder.location,
        destination: activeOrder.destination || activeOrder.destAddress,
      }));

      // Rejoin socket room for live updates
      socket.emit("join_order", activeOrder.id);

      // CRITICAL: Emit customer_ready event to notify server/driver that customer is back online
      socket.emit("customer_ready", {
        orderId: activeOrder.id,
        customerPhone: customerPhone,
      });

      // Store order ID in localStorage for persistence
      try {
        localStorage.setItem("sat7a_active_order_id", String(activeOrder.id));
      } catch (e) {
      }

      // CRITICAL: Use setTimeout to ensure ALL state updates are flushed before ending loading
      // This prevents any flash of the booking view
      // CRITICAL: Immediately end loading state - React batches state updates
      setIsCheckingRecovery(false);

      // Show success toast
      toast({
        title: "✅ تم استرجاع الطلب",
        description: "تم استعادة طلبك النشط بنجاح",
        className: "bg-green-600 text-white font-black rounded-[24px]",
      });
    } catch (error) {
      setIsCheckingRecovery(false); // CRITICAL: End loading state even on error
    }
  };

  useEffect(() => {
    if (activeOrderId) {
      socket.emit("join_order", activeOrderId);
      try {
        localStorage.setItem("sat7a_active_order_id", activeOrderId.toString());
      } catch (e) {
      }

      // CRITICAL: Listen for FINAL_CLEANUP event from server
      socket.on("FINAL_CLEANUP", (data: any) => {

        if (
          data.orderId === activeOrderId ||
          data.orderId === Number(activeOrderId)
        ) {

          // FORCE RESET ALL STATE
          setActiveOrderId(null);
          setDriverInfo(null);
          setRequestStatus("pending");
          setMessages([]);
          setDriverLocation(null);
          setShowCancelModal(false);
          setIsChatOpen(false);

          // FORCE CLEANUP localStorage
          localStorage.removeItem("sat7a_active_order_id");

          // FORCE VIEW RESET
          setViewState("booking");
        }
      });

      const handleStatusChange = (data: any) => {
        if (data.status) {
          setRequestStatus(data.status);

          if (
            data.status === "accepted" ||
            data.driverInfo ||
            data.status === "arrived" ||
            data.status === "picked_up"
          ) {
            setViewState("tracking");

            const info = data.driverInfo || data;
            const driverData = {
              id: info.driverId || info.id,
              name:
                info.username || info.name || info.driverName || "كابتن سطحة",
              phone: info.phone || info.driverPhone || "07XXXXXXXXX",
              avatarUrl: info.avatarUrl || info.driverAvatar || "",
              vehicleType: info.vehicleType || "سطحة هيدروليك",
              plateNumber: info.plateNumber || "أربيل - 12345",
            };
            setDriverInfo(driverData);

            if (info.lat && info.lng) {
              setDriverLocation([Number(info.lat), Number(info.lng)]);
            }

            if (data.status === "accepted") {
              setOrderAcceptedAt(Date.now()); // Record acceptance time for 2-min cancel window
              toast({
                title: "✅ تم قبول طلبك",
                description: `الكابتن ${info.username || info.name || "قادم"} في الطريق إليك`,
                className:
                  "bg-green-600 text-white font-black rounded-2xl shadow-2xl border-none",
              });
            }

            // In-app toast when driver arrives
            if (data.status === "arrived") {
              try {
                const audio = new Audio("/notification.mp3");
                audio.play().catch(() => {});
              } catch (e) {}

              toast({
                title: "📍 الكابتن وصل للموقع",
                description: "الرجاء التوجه للموقع المحدد",
                className:
                  "bg-blue-600 text-white font-black rounded-2xl shadow-2xl border-none",
              });
            }
          }

          if (data.status === "completed") {

            // IMMEDIATE STATE CLEANUP - Prevent any restoration attempts
            setActiveOrderId(null);
            setDriverInfo(null);
            setRequestStatus("pending");
            setOrderAcceptedAt(null);
            setMessages([]);
            setDriverLocation(null);

            // IMMEDIATE localStorage cleanup - BOTH keys
            localStorage.removeItem("sat7a_active_order_id");
            localStorage.removeItem(`driver_active_order_${data.driverId}`); // Driver-side key

            // IMMEDIATE socket room cleanup
            if (activeOrderId) {
              socket.emit("leave_order", activeOrderId);
            }

            // CRITICAL: Close ALL modals
            setShowCancelModal(false);
            setIsChatOpen(false);

            // IMMEDIATE view reset
            setViewState("booking");

            // Show completion toast AFTER cleanup
            toast({
              title: "وصلت بالسلامة",
              description: "تم إكمال الطلب بنجاح",
            });
          }
        }
      };

      // EMERGENCY: Multiple listeners for order acceptance
      socket.on("status_changed", handleStatusChange);
      socket.on(`order_status_${activeOrderId}`, handleStatusChange);
      socket.on("order_accepted", handleStatusChange); // CRITICAL: Explicit order_accepted listener

      socket.on("driver_location_update", (data: any) => {
        if (Number(data.orderId) === Number(activeOrderId)) {
          setDriverLocation([Number(data.lat), Number(data.lng)]);
          if (data.heading !== undefined) setDriverHeading(data.heading);
        }
      });

      // CRITICAL: Handle real-time wallet updates from admin
      if (userProfile.id) {
        socket.on(`customer_wallet_updated_${userProfile.id}`, (data: any) => {

          // IMMEDIATE state update
          setUserProfile((prev) => {
            const updated = {
              ...prev,
              wallet: data.newBalance,
            };

            // Update localStorage
            try {
              const savedUser = localStorage.getItem("sat7a_user");
              if (savedUser) {
                const parsed = JSON.parse(savedUser);
                localStorage.setItem(
                  "sat7a_user",
                  JSON.stringify({ ...parsed, wallet: data.newBalance }),
                );
              }
            } catch (e) {
            }

            return updated;
          });

          // Show success notification
          toast({
            title:
              data.type === "credit" ? "💰 تم إضافة رصيد" : "💸 تم خصم رصيد",
            description:
              data.message || `الرصيد الجديد: ${data.newBalance} د.ع`,
            className:
              "bg-green-600 text-white font-black rounded-[24px] shadow-2xl",
          });
        });
      }

      // CRITICAL FIX: Handle order deletion by admin
      socket.on("order_deleted_by_admin", (data: any) => {

        // IMMEDIATE STATE CLEANUP
        const orderIdToLeave = activeOrderId; // Capture before clearing
        setActiveOrderId(null);
        setDriverInfo(null);
        setRequestStatus("pending");
        setMessages([]);
        setDriverLocation(null);

        // IMMEDIATE localStorage cleanup
        localStorage.removeItem("sat7a_active_order_id");

        // IMMEDIATE socket room cleanup
        if (orderIdToLeave) {
          socket.emit("leave_order", orderIdToLeave);
        }

        // CRITICAL: Close ALL modals
        setShowCancelModal(false);
        setIsChatOpen(false);

        // IMMEDIATE view reset
        setViewState("booking");

        // Show notification AFTER cleanup
        toast({
          variant: "destructive",
          title: "تم إلغاء الطلب",
          description: data.message || "تم إلغاء طلبك من قبل الإدارة",
        });
      });

      return () => {
        socket.off("status_changed", handleStatusChange);
        socket.off(`order_status_${activeOrderId}`, handleStatusChange);
        socket.off("order_accepted", handleStatusChange); // CRITICAL: Cleanup order_accepted
        socket.off("driver_location_update");
        socket.off("order_deleted_by_admin");
        socket.off("FINAL_CLEANUP"); // CRITICAL: Clean up FINAL_CLEANUP listener
      };
    }
  }, [activeOrderId, toast]);

  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      if (Number(msg.orderId) === Number(activeOrderId)) {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === msg.id);
          if (exists) return prev;
          return [
            ...prev,
            {
              id: msg.id,
              orderId: msg.orderId,
              content: msg.content || msg.message,
              senderId: msg.senderId,
              senderType: msg.senderType,
              senderName: msg.senderName,
              createdAt: msg.createdAt,
              timestamp: msg.createdAt,
            },
          ];
        });
        if (!isChatOpen) setUnreadCount((prev) => prev + 1);
        setTimeout(scrollChatToBottom, 100);
      }
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [isChatOpen, activeOrderId]);

  // Reset sheet to expanded when driver is found
  useEffect(() => {
    if (requestStatus !== "pending" && driverInfo) {
      setIsSheetExpanded(true); // Driver found - show full details
    }
  }, [requestStatus, driverInfo]);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !activeOrderId) return;

    const payload = {
      orderId: activeOrderId,
      message: chatMessage,
      senderId: userProfile.id,
      senderType: "customer",
      senderName: userProfile.username,
    };

    socket.emit("send_message", payload);
    setChatMessage("");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userProfile.username,
          phone: userProfile.phone,
          password: userProfile.password,
          city: normalizeCity(formData.city),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "فشل التسجيل");

      const completeProfile = {
        ...userProfile,
        id: data.id,
        wallet: data.walletBalance?.toString() || "0",
        address: normalizeCity(formData.city),
        image: data.image || userProfile.image || "", // CRITICAL: Preserve image during signup
      };

      setUserProfile(completeProfile);
      try {
        localStorage.setItem("sat7a_user", JSON.stringify(completeProfile));
        localStorage.setItem("sat7a_session_active", "true");
        localStorage.setItem("sat7a_role", "customer");
      } catch (e) {
        localStorage.clear();
        localStorage.setItem("sat7a_user", JSON.stringify(completeProfile));
        localStorage.setItem("sat7a_session_active", "true");
        localStorage.setItem("sat7a_role", "customer");
      }
      setIsLoggedIn(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: userProfile.phone,
          password: userProfile.password,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "بيانات الدخول غير صحيحة");

      const completeProfile = {
        ...userProfile,
        id: data.id,
        username: data.username || data.name,
        wallet: data.walletBalance?.toString() || "0",
        trips: data.tripsCount?.toString() || "0",
        image: data.image || "", // CRITICAL: Load image from database
      };

      setUserProfile(completeProfile);
      try {
        localStorage.setItem("sat7a_user", JSON.stringify(completeProfile));
        localStorage.setItem("sat7a_session_active", "true");
        localStorage.setItem("sat7a_role", "customer");
      } catch (e) {
      }
      setIsLoggedIn(true);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل الدخول",
        description: err.message,
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sat7a_session_active");
    localStorage.removeItem("sat7a_active_order_id");
    localStorage.removeItem("sat7a_user");
    localStorage.removeItem("sat7a_role");
    setIsLoggedIn(false);
    setAuthMode("choice");
    setActiveOrderId(null);
    // Reset profile so phone/password fields are blank on next visit
    setUserProfile({
      id: null,
      username: "",
      phone: "",
      password: "",
      address: "قيد التحديد",
      image: null,
      wallet: "0",
      trips: "0",
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected later
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى اختيار صورة صحيحة" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "الصورة كبيرة جداً", description: "يجب أن لا تتجاوز الصورة 5 ميغابايت" });
      return;
    }

    try {
      if (userProfile.phone) {
        // Multipart upload — avoids base64 JSON body-size limits entirely
        const formData = new FormData();
        formData.append("image", file);

        const uploadRes = await fetch(
          `${API_BASE}/api/users/${userProfile.phone}/upload-avatar`,
          { method: "POST", body: formData },
        );

        const data = await uploadRes.json();

        if (uploadRes.ok && data.url) {
          // Build the full URL (relative /uploads/... paths need API_BASE in Capacitor)
          const imageUrl = resolveImageUrl(data.url);
          setUserProfile((prev) => {
            const updated = { ...prev, image: imageUrl };
            try { localStorage.setItem("sat7a_user", JSON.stringify(updated)); } catch {}
            return updated;
          });
          toast({
            title: "✅ تم تحديث الصورة",
            description: "تم حفظ صورتك الشخصية بنجاح",
            className: "bg-green-600 text-white font-black rounded-[24px]",
          });
        } else {
          throw new Error(data.message || "فشل الرفع");
        }
      } else {
        // Pre-login: show local preview only — uploaded after registration
        const reader = new FileReader();
        reader.onloadend = () => {
          setUserProfile((prev) => ({ ...prev, image: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل التحميل",
        description: err.message || "يرجى المحاولة مرة أخرى",
      });
    }
  };

  // CRITICAL: Cancel trip handler - must be before return statement
  const handleCancelTrip = async () => {
    try {
      if (!activeOrderId) {
        setShowCancelModal(false);
        return;
      }

      // Allow cancel if: pending, OR accepted within the first 2 minutes
      const withinGracePeriod =
        requestStatus === "accepted" &&
        orderAcceptedAt !== null &&
        Date.now() - orderAcceptedAt < 2 * 60 * 1000;

      if (requestStatus !== "pending" && !withinGracePeriod) {
        setShowCancelModal(false);
        toast({
          variant: "destructive",
          title: "لا يمكن الإلغاء",
          description: "الطلب قيد التنفيذ بالفعل",
        });
        return;
      }

      const response = await fetch(`${API_BASE}/api/requests/${activeOrderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "فشل في إلغاء الطلب");
      }

      // Notify driver if they already accepted (2-min grace period)
      if (withinGracePeriod && driverInfo?.id) {
        socket.emit("customer_cancelled_after_accept", {
          orderId: activeOrderId,
          driverId: driverInfo.id,
        });
      }

      // CRITICAL: Leave socket room and cleanup
      socket.emit("leave_order", activeOrderId);

      // CLOSE modal only after success
      setShowCancelModal(false);

      // Clear local state and return to booking
      localStorage.removeItem("sat7a_active_order_id");
      setViewState("booking");
      setActiveOrderId(null);
      setDriverInfo(null);
      setRequestStatus("pending");
      setOrderAcceptedAt(null);
      setMessages([]);
      setDriverLocation(null);

      toast({
        title: "تم إلغاء الطلب بنجاح",
        description: "يمكنك إنشاء طلب جديد الآن",
        className: "bg-green-600 text-white",
      });
    } catch (error: any) {
      setShowCancelModal(false);
      toast({
        variant: "destructive",
        title: "خطأ في الإلغاء",
        description: error.message || "حاول مرة أخرى",
      });
    }
  };

  // 🔍 محرك بحث مُحسّن — MapTiler Geocoding API:
  // - نتائج مُقرَّبة جغرافياً نحو بابل (Babil Governorate) باستخدام proximity
  // - مقيَّد بالعراق (country=iq) مع إعطاء الأولوية للأسماء العربية
  const MAPTILER_KEY = "ZgzumFORbF7swvFCViRi";
  // مركز بابل للـ proximity — يضمن أن نتائج "مجسر"، "كراج"، ... تعود من بابل أولاً
  const BABIL_PROXIMITY = "44.36,32.48";

  const searchLocation = async (query: string) => {
    const q = query.trim();
    if (q.length < 2) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      // MapTiler Geocoding — no language=ar to maximise result coverage for Arabic queries
      const url =
        `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json` +
        `?key=${MAPTILER_KEY}` +
        `&proximity=${BABIL_PROXIMITY}` +
        `&country=iq` +
        `&fuzzyMatch=true` +
        `&limit=10`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`MapTiler HTTP ${res.status}`);
      const data = await res.json();
      const features = Array.isArray(data.features) ? data.features : [];

      if (features.length > 0) {
        setSearchResults(features);
        return;
      }

      // Fallback: Nominatim (OpenStreetMap) — free, reliable, excellent Arabic support
      const nomUrl =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}` +
        `&format=geojson` +
        `&countrycodes=iq` +
        `&limit=10` +
        `&viewbox=43.8,31.8,45.2,33.2` +
        `&bounded=0` +
        `&accept-language=ar`;

      const nomRes = await fetch(nomUrl, { headers: { "User-Agent": "SathaApp/1.0" } });
      if (!nomRes.ok) throw new Error(`Nominatim HTTP ${nomRes.status}`);
      const nomData = await nomRes.json();
      const nomFeatures = Array.isArray(nomData.features) ? nomData.features : [];

      // Normalise Nominatim features to match MapTiler GeoJSON shape
      const normalised = nomFeatures.map((f: any) => ({
        type: "Feature",
        geometry: f.geometry,
        text: f.properties?.display_name?.split(",")[0] || "موقع",
        place_name: f.properties?.display_name || "",
        center: [f.geometry?.coordinates?.[0], f.geometry?.coordinates?.[1]],
      }));
      setSearchResults(normalised);
    } catch (error) {
      console.error("[Search] Geocoding failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Extract the most meaningful Arabic location label from a MapTiler GeoJSON feature
  const extractArabicLabel = (feature: any): string => {
    // MapTiler returns `text` as the short localised name, `place_name` as full
    return (
      feature.text ||
      feature.place_name?.split(",")[0] ||
      "موقع محدد"
    );
  };

  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);

  const reverseGeocode = async (lat: number, lng: number, currentStep?: "pickup" | "dropoff") => {
    // Cancel any in-flight request to prevent race conditions
    if (reverseGeocodeAbortRef.current) {
      reverseGeocodeAbortRef.current.abort();
    }
    const controller = new AbortController();
    reverseGeocodeAbortRef.current = controller;

    try {
      const MAPTILER_KEY_REV = "ZgzumFORbF7swvFCViRi";
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY_REV}&language=ar`,
        { signal: controller.signal },
      );
      const data = await res.json();
      const feature = Array.isArray(data.features) && data.features[0];
      if (feature) {
        const regionCtx = feature.context?.find(
          (c: any) => c.id?.startsWith("region") || c.id?.startsWith("place"),
        );
        const detectedCity = regionCtx?.text || "بابل";
        const locationName = extractArabicLabel(feature);
        // Use currentStep param when provided to avoid stale closure bugs
        const resolvedStep = currentStep ?? step;
        setFormData((prev) => ({
          ...prev,
          city: normalizeCity(detectedCity),
          ...(resolvedStep === "pickup"
            ? { location: locationName }
            : { destination: locationName }),
        }));
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return; // Cancelled — ignore silently
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "GPS غير متاح على هذا الجهاز",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Update formData state FIRST
        if (step === "pickup") {
          setFormData((p) => ({
            ...p,
            pickupLat: latitude,
            pickupLng: longitude,
          }));
          reverseGeocode(latitude, longitude, "pickup");
        } else {
          setFormData((p) => ({ ...p, destLat: latitude, destLng: longitude }));
          reverseGeocode(latitude, longitude, "dropoff");
        }

        // Trigger fly animation AFTER state update
        setShouldFly(true);
        setTimeout(() => setShouldFly(false), 2000);

        toast({
          title: "تم تحديد موقعك",
          description: "GPS",
          className: "bg-green-600 text-white font-black",
        });
      },
      (error) => {
        toast({
          variant: "destructive",
          title: "فشل تحديد الموقع",
          description: error.message || "تأكد من تفعيل خدمة الموقع",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleSelectResult = (result: any) => {
    // MapTiler GeoJSON format: coordinates are [lng, lat]
    const lon = result.geometry?.coordinates?.[0] ?? parseFloat(result.lon ?? "0");
    const lat = result.geometry?.coordinates?.[1] ?? parseFloat(result.lat ?? "0");

    // Pull city/governorate from MapTiler context array (id starts with "region" or "place")
    const regionCtx = result.context?.find(
      (c: any) => c.id?.startsWith("region") || c.id?.startsWith("place"),
    );
    const resultCity = regionCtx?.text || "بابل";

    setShouldFly(true);
    const locationLabel = extractArabicLabel(result);
    if (step === "pickup") {
      setFormData((p) => ({
        ...p,
        pickupLat: lat,
        pickupLng: lon,
        location: locationLabel,
        city: normalizeCity(resultCity),
      }));
    } else {
      setFormData((p) => ({
        ...p,
        destLat: lat,
        destLng: lon,
        destination: locationLabel,
      }));
    }
    setIsSearchOpen(false);
    setTimeout(() => setShouldFly(false), 2000);
  };

  // Professional Wallet Deposit Handler (replicated from Driver)
  const handleCustomerDeposit = async (method: "zain" | "master") => {
    if (!userProfile.id) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "لم يتم العثور على بيانات المستخدم",
      });
      return;
    }

    const amountValue = parseInt(depositAmount);
    if (isNaN(amountValue) || amountValue < 1000) {
      toast({
        variant: "destructive",
        title: "مبلغ غير صحيح",
        description: "أقل مبلغ للشحن هو 1000 دينار",
      });
      return;
    }

    setIsDepositing(true);
    try {
      const response = await fetch(`${API_BASE}/api/zaincash/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          userId: Number(userProfile.id),
          userType: "customer",
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "فشل في بدء عملية الدفع");

      if (data.url || data.redirectUrl) {
        window.location.href = data.url || data.redirectUrl;
      } else {
        toast({
          title: "✅ تم بدء العملية",
          description: "سيتم تحويلك لإكمال الدفع",
          className: "bg-green-600 text-white font-black rounded-[24px]",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في عملية الشحن",
        description: err.message || "فشلت عملية الشحن",
      });
    } finally {
      setIsDepositing(false);
    }
  };

  // CRITICAL FIX #2: Professional Dynamic Pricing with Loading State + 1.5s Debounce
  useEffect(() => {
    if (
      formData.vehicleType &&
      formData.pickupLat &&
      formData.pickupLng &&
      formData.destLat &&
      formData.destLng
    ) {
      // عرض حالة التحميل فوراً — لا نبدأ الحساب الفعلي إلا بعد 1.5 ثانية
      setIsPriceCalculating(true);
      setCalculatedPrice(0);

      const calculateFare = async () => {

        try {
          // Call backend to get traffic-aware pricing
          const response = await fetch(`${API_BASE}/api/distance-matrix`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: `${formData.pickupLat},${formData.pickupLng}`,
              destination: `${formData.destLat},${formData.destLng}`,
            }),
          });

          let distanceKm, durationMinutes;

          if (response.ok) {
            const data = await response.json();

            if (
              data.status === "OK" &&
              data.rows?.[0]?.elements?.[0]?.status === "OK"
            ) {
              const element = data.rows[0].elements[0];
              distanceKm = element.distance.value / 1000;
              durationMinutes =
                (element.duration_in_traffic?.value || element.duration.value) /
                60;
            } else {
              throw new Error("Google API returned non-OK status");
            }
          } else {
            throw new Error("Distance Matrix API unavailable");
          }

          // Calculate fare using backend pricing engine
          const fareResponse = await fetch(`${API_BASE}/api/calculate-fare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              distanceKm,
              durationMinutes,
              vehicleType: formData.vehicleType,
            }),
          });

          if (fareResponse.ok) {
            const fareData = await fareResponse.json();

            // Use Number() to handle both string and numeric responses from API
            const finalPrice = Math.round(Number(fareData.finalPrice) || 0);
            const finalDistance = Number(fareData.distanceKm) || 0;
            // If server returned 0 for some reason, use client-side minimum
            const confirmedPrice = finalPrice > 0 ? finalPrice : getClientMinFare(formData.vehicleType);

            setDistanceKm(finalDistance);
            setCalculatedPrice(confirmedPrice);
            setFormData((prev) => ({ ...prev, price: confirmedPrice.toString() }));
            setIsPriceCalculating(false);
          } else {
            // API responded but with error — try client-side calculation
            const clientPrice = getClientFare(formData.vehicleType, distanceKm as number || 0, durationMinutes as number || 0);
            setCalculatedPrice(clientPrice);
            setFormData((prev) => ({ ...prev, price: clientPrice.toString() }));
            setIsPriceCalculating(false);
          }
        } catch (error) {

          // ── Haversine fallback ──────────────────────────────────────────────
          try {
            const { calculateHaversineDistance } = await import("@/services/MapService");
            const distance = calculateHaversineDistance(
              formData.pickupLat,
              formData.pickupLng,
              formData.destLat,
              formData.destLng,
            );
            const estimatedDuration = (distance / 40) * 60;

            // Try calling the backend again with the Haversine distance
            try {
              const fareResponse = await fetch(`${API_BASE}/api/calculate-fare`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  distanceKm: distance,
                  durationMinutes: estimatedDuration,
                  vehicleType: formData.vehicleType,
                }),
              });

              if (fareResponse.ok) {
                const fareData = await fareResponse.json();
                const finalPrice = Math.round(Number(fareData.finalPrice) || 0);
                const finalDistance = Number(fareData.distanceKm) || distance;
                const confirmedPrice = finalPrice > 0 ? finalPrice : getClientFare(formData.vehicleType, distance, estimatedDuration);
                setDistanceKm(Math.round(finalDistance * 10) / 10);
                setCalculatedPrice(confirmedPrice);
                setFormData((prev) => ({ ...prev, price: confirmedPrice.toString() }));
              } else {
                // Backend error — use pure client-side calculation (without surge since we can't reach server)
                const clientPrice = getClientFare(formData.vehicleType, distance, estimatedDuration);
                setDistanceKm(Math.round(distance * 10) / 10);
                setCalculatedPrice(clientPrice);
                setFormData((prev) => ({ ...prev, price: clientPrice.toString() }));
              }
            } catch {
              const clientPrice = getClientFare(formData.vehicleType, distance, estimatedDuration);
              setDistanceKm(Math.round(distance * 10) / 10);
              setCalculatedPrice(clientPrice);
              setFormData((prev) => ({ ...prev, price: clientPrice.toString() }));
            }
          } catch (haversineError) {
            const minFare = getClientMinFare(formData.vehicleType);
            setCalculatedPrice(minFare);
            setFormData((prev) => ({ ...prev, price: minFare.toString() }));
          } finally {
            setIsPriceCalculating(false);
          }
        }
      };

      // تأخير 1.5 ثانية لمنع الحسابات المتكررة أثناء تحريك الخريطة
      const debounceTimer = setTimeout(() => { calculateFare(); }, 1500);
      return () => clearTimeout(debounceTimer);
    } else {
      // Reset if incomplete data
      setCalculatedPrice(0);
      setIsPriceCalculating(false);
    }
  }, [
    formData.vehicleType,
    formData.pickupLat,
    formData.pickupLng,
    formData.destLat,
    formData.destLng,
  ]);

  const handleFinalOrder = async () => {
    if (!userProfile.id) {
      toast({
        title: "تنبيه",
        description: "يرجى تسجيل الدخول مجدداً لإتمام عملية الطلب.",
      });
      setIsLoggedIn(false);
      setAuthMode("login");
      return;
    }

    // FEATURE 2: Use calculated price (already set by useEffect)
    const numericPrice =
      calculatedPrice || parseFloat(formData.price?.replace(/[^\d]/g, "")) || 0;

    if (
      paymentMethod === "wallet" &&
      parseFloat(userProfile.wallet) < numericPrice
    ) {
      toast({
        variant: "destructive",
        title: "رصيد غير كافٍ",
        description: "يرجى شحن محفظتك أو اختيار الدفع النقدي.",
      });
      return;
    }

    // FEATURE 2: Show price confirmation before sending
    if (!showPriceConfirmation) {
      setShowPriceConfirmation(true);
      return; // Don't send yet - wait for confirmation
    }

    try {
      const orderPayload = {
        customerName: userProfile.username || "زبون",
        customerPhone: userProfile.phone || "0000",
        location: formData.location || "موقعي الحالي",
        destination: formData.destination || "وجهة غير محددة",
        pickupLat: Number(formData.pickupLat),
        pickupLng: Number(formData.pickupLng),
        destLat: Number(formData.destLat),
        destLng: Number(formData.destLng),
        vehicleType: formData.vehicleType,
        price: numericPrice,
        city: normalizeCity(formData.city),
        paymentMethod: paymentMethod,
        status: "pending",
        customerId: userProfile.id,
      };

      const response = await fetch(`${API_BASE}/api/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "فشل في إرسال الطلب");

      socket.emit("new_request_created", { ...orderPayload, id: result.id });
      setActiveOrderId(result.id);
      setViewState("success");
      setShowPriceConfirmation(false); // Reset for next time
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الطلب",
        description: err.message,
      });
      setShowPriceConfirmation(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div
        className="h-full bg-white flex flex-col p-6 relative overflow-hidden font-sans"
        dir="rtl"
      >
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            localStorage.removeItem("sat7a_role");
            localStorage.removeItem("sat7a_session_active");
            setLocation("/");
          }}
          className="absolute top-8 right-8 z-[50] bg-white p-3 px-5 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all text-gray-900 font-black"
        >
          <Home className="w-5 h-5 text-orange-500" />
          <span className="text-sm">الرئيسية</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-orange-500 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3 shadow-orange-200">
              <Truck className="text-white w-10 h-10" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter">
              {authMode === "choice"
                ? "أهلاً بك"
                : authMode === "signup"
                  ? "كُن عضواً"
                  : "عودة حميدة"}
            </h2>
            <p className="text-gray-400 font-bold mt-2">
              تطبيق سطحة لخدمتك أينما كنت
            </p>
          </div>

          {authMode === "choice" && (
            <div className="space-y-4">
              <Button
                onClick={() => setAuthMode("signup")}
                className="w-full h-20 bg-orange-500 hover:bg-orange-600 rounded-[30px] text-2xl font-black shadow-xl shadow-orange-100 transition-all"
              >
                أنا زبون جديد
              </Button>
              <Button
                onClick={() => setAuthMode("login")}
                variant="ghost"
                className="w-full h-20 rounded-[30px] text-xl font-black bg-gray-50 text-gray-600 border-2 border-transparent hover:border-gray-200"
              >
                تسجيل دخول
              </Button>
            </div>
          )}

          {(authMode === "signup" || authMode === "login") && (
            <form
              onSubmit={authMode === "signup" ? handleSignUp : handleLogin}
              className="space-y-4"
            >
              {authMode === "signup" && (
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div
                      onClick={() => signupFileInputRef.current?.click()}
                      className="w-24 h-24 bg-gray-50 rounded-[35px] border-4 border-white flex items-center justify-center overflow-hidden shadow-2xl ring-2 ring-orange-100 cursor-pointer hover:ring-orange-300 transition-all"
                    >
                      {userProfile.image ? (
                        <img
                          src={userProfile.image}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="text-orange-200 w-10 h-10" />
                      )}
                    </div>
                    {/* Hidden file input — avoids dynamic createElement which is blocked in Capacitor */}
                    <input
                      ref={signupFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-black text-white p-2 rounded-xl shadow-lg border-2 border-white pointer-events-none">
                      <Camera className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 font-bold">
                    اضغط لتحميل صورة
                  </p>
                </div>
              )}
              <div className="bg-white rounded-[35px] p-6 shadow-[0_10_40px_rgba(0,0,0,0.04)] border border-gray-50 space-y-4">
                {authMode === "signup" && (
                  <div className="bg-gray-50 rounded-2xl p-3 px-5 flex items-center justify-between group focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 mb-1">
                        الاسم الكامل
                      </p>
                      <input
                        required
                        placeholder="أدخل اسمك"
                        className="bg-transparent border-none outline-none w-full font-black text-gray-700 text-right"
                        value={userProfile.username}
                        onChange={(e) =>
                          setUserProfile({
                            ...userProfile,
                            username: e.target.value,
                          })
                        }
                      />
                    </div>
                    <User className="text-orange-500 w-5 h-5 mr-3" />
                  </div>
                )}
                <div className="bg-gray-50 rounded-2xl p-3 px-5 flex items-center justify-between focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 mb-1">
                      رقم الهاتف
                    </p>
                    <input
                      required
                      type="tel"
                      placeholder="07XXXXXXXXX"
                      className="bg-transparent border-none outline-none w-full font-black text-gray-700 text-right"
                      value={userProfile.phone}
                      onChange={(e) =>
                        setUserProfile({
                          ...userProfile,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Phone className="text-orange-500 w-5 h-5 mr-3" />
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 px-5 flex items-center justify-between focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 mb-1">
                      كلمة السر
                    </p>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      className="bg-transparent border-none outline-none w-full font-black text-gray-700 text-right"
                      value={userProfile.password}
                      onChange={(e) =>
                        setUserProfile({
                          ...userProfile,
                          password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Lock className="text-orange-500 w-5 h-5 mr-3" />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-18 bg-gray-900 hover:bg-black text-white rounded-[25px] font-black text-xl mt-4 shadow-2xl transition-all active:scale-95"
              >
                {authMode === "signup" ? "تأكيد وإنشاء" : "دخول مباشر"}
              </Button>
              <button
                type="button"
                onClick={() => setAuthMode("choice")}
                className="w-full text-center text-gray-400 font-black text-xs mt-4 hover:text-orange-500"
              >
                إلغاء والعودة
              </button>
            </form>
          )}
        </motion.div>
        <div className="mt-auto text-center pb-4">
          <p className="text-[10px] font-black text-gray-300 flex items-center justify-center gap-2 tracking-widest uppercase">
            <ShieldCheck className="w-3 h-3" /> نظام حماية البيانات 2026
          </p>
        </div>
      </div>
    );
  }

  // CRITICAL: Loading state during recovery check - DO NOT render booking view until check completes
  if (isCheckingRecovery) {
    return (
      <div
        className="h-full bg-white flex flex-col items-center justify-center p-8"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6 text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-orange-500 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900">
              جاري التحقق...
            </h2>
            <p className="text-gray-400 font-bold text-sm">
              يرجى الانتظار بينما نتحقق من طلباتك النشطة
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (viewState === "success")
    return (
      <div
        className="h-full bg-white flex flex-col items-center justify-center p-8 text-center"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-8"
        >
          <div className="w-32 h-32 bg-orange-500 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl rotate-12">
            <Check className="w-16 h-16 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter">
              تم الإرسال!
            </h2>
            <p className="text-gray-400 font-bold">
              طلبك الآن متاح لجميع السائقين القريبين
            </p>
            <p className="text-orange-500 font-black">
              طريقة الدفع: {paymentMethod === "wallet" ? "المحفظة" : "نقدي"}
            </p>
          </div>
          <Button
            onClick={() => setViewState("tracking")}
            className="w-full h-16 bg-black text-white rounded-[24px] font-black text-xl shadow-2xl"
          >
            تتبع الرحلة
          </Button>
        </motion.div>
      </div>
    );

  if (viewState === "tracking")
    return (
      <div
        className="h-full w-full bg-slate-50 flex flex-col relative"
        dir="rtl"
      >
        <div className="absolute inset-0 z-0">
          <SathaMap
            center={[formData.pickupLat, formData.pickupLng]}
            zoom={15}
          >
            {driverLocation && (
              <Marker
                position={driverLocation}
                icon={getOrangeArrowIcon(driverHeading)}
              />
            )}
            <Marker 
              position={[formData.pickupLat, formData.pickupLng]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => handleMarkerDragEnd(e, 'pickup'),
              }}
            />
            {/* خط الملاحة بين السائق واx�زبون باستخدام الطرق الفعلية */}
            {driverLocation && (
              <RoutingPolyline
                start={driverLocation}
                end={[formData.pickupLat, formData.pickupLng]}
                color="#f97316"
                weight={4}
                opacity={0.7}
              />
            )}
            <FlyToMarker
              center={
                driverLocation || [formData.pickupLat, formData.pickupLng]
              }
              shouldFly={!!driverLocation}
            />
          </SathaMap>
        </div>
        <header className="absolute top-6 inset-x-6 z-[1000] flex justify-between items-center">
          <div className="w-12"></div>
          <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl shadow-xl font-black italic flex items-center gap-2">
            <Navigation className="w-4 h-4 animate-pulse" /> مباشر
          </div>
        </header>

        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed inset-0 z-[9997] bg-white flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex justify-between items-center bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center font-black text-orange-600 overflow-hidden">
                    {driverInfo?.avatarUrl ? (
                      <img
                        src={resolveImageUrl(driverInfo.avatarUrl)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800">
                      {driverInfo?.name || "الكابتن"}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-bold">
                      متصل الآن
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setIsChatOpen(false)}
                  className="rounded-2xl"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`flex ${msg.senderType === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`p-4 rounded-2xl max-w-[80%] font-bold shadow-sm ${msg.senderType === "customer" ? "bg-orange-500 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none"}`}
                    >
                      {msg.content || msg.text}
                      <p
                        className={`text-[8px] mt-1 opacity-60 ${msg.senderType === "customer" ? "text-right" : "text-left"}`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t flex gap-2 bg-white pb-10">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="اكتب رسالة للكابتن..."
                  className="flex-1 bg-gray-100 rounded-2xl px-5 text-right font-bold outline-none border-2 border-transparent focus:border-orange-200 transition-all"
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-orange-500 rounded-2xl w-14 h-14 shadow-lg shadow-orange-100"
                >
                  <Send className="w-5 h-5 rotate-180" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════
            SEARCHING STATE — Static sheet, no drag, fully visible
            ══════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {(requestStatus === "pending" && !driverInfo) && (
            <motion.div
              key="searching-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 z-[2000] pointer-events-auto"
            >
              <div className="bg-white rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] px-6 pt-6 pb-10 space-y-4">

                {/* Animated radar / pulse rings */}
                <div className="flex justify-center py-2">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    {[1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="absolute rounded-full border-2 border-orange-400"
                        initial={{ width: 32, height: 32, opacity: 0.8 }}
                        animate={{ width: 96, height: 96, opacity: 0 }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
                      />
                    ))}
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-200 z-10">
                      <Truck className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center">
                  <h3 className="text-xl font-black text-gray-900">جاري البحث عن سائق</h3>
                  <p className="text-sm text-gray-400 font-bold mt-1">نبحث لك عن أقرب كابتن متاح...</p>
                </div>

                {/* Order summary chips */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {calculatedPrice > 0 && (
                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-2xl px-3 py-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-black text-orange-600">{calculatedPrice.toLocaleString()} د.ع</span>
                    </div>
                  )}
                  {distanceKm > 0 && (
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-2xl px-3 py-1.5">
                      <Navigation className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-black text-blue-600">{distanceKm.toFixed(1)} كم</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-black text-gray-600">{formData.vehicleType || "سطحة"}</span>
                  </div>
                </div>

                {/* Animated progress dots */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[0, 0.3, 0.6].map((delay, i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-orange-400 rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay }}
                    />
                  ))}
                </div>

                {/* Cancel button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCancelModal(true); }}
                  className="w-full py-3.5 rounded-[20px] border-2 border-red-100 bg-red-50 text-red-500 font-black text-sm active:scale-95 transition-transform"
                  style={{ pointerEvents: "auto" }}
                >
                  إلغاء الطلب
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════
            DRIVER FOUND STATE — Draggable sheet with handle
            ══════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {driverInfo && (
            <motion.div
              key="driver-sheet"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.1}
              initial={{ y: "100%" }}
              animate={{ y: isSheetExpanded ? 0 : "calc(100% - 120px)" }}
              exit={{ y: "100%" }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100) setIsSheetExpanded(false);
                else if (info.offset.y < -50) setIsSheetExpanded(true);
              }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-[2000] pointer-events-auto"
            >
              <div className="bg-white rounded-t-[45px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] pointer-events-auto">
                {/* SMART HANDLE */}
                <div
                  className="w-full flex flex-col items-center py-5 cursor-grab active:cursor-grabbing"
                  onClick={() => setIsSheetExpanded(!isSheetExpanded)}
                  style={{ touchAction: "none" }}
                >
                  <div className="w-16 h-2 bg-gray-300 rounded-full mb-2" />
                  <GripHorizontal
                    className={`w-6 h-6 transition-all duration-300 ${isSheetExpanded ? "text-gray-300" : "text-orange-500 rotate-180"}`}
                  />
                </div>

                <div className="px-6 pb-16 space-y-5">
                  {/* ── DRIVER FOUND STATE ── Status header */}
                  <div className="text-center pt-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <h3 className="text-lg font-black text-gray-800">
                        {requestStatus === "accepted"
                          ? "الكابتن قادم"
                          : requestStatus === "arrived"
                            ? "وصل الكابتن"
                            : "في الطريق"}
                      </h3>
                    </div>
                    <div className="inline-flex items-center gap-1 bg-orange-50 px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-[11px] font-black text-orange-600">مباشر</span>
                    </div>
                  </div>

              {driverInfo && (
                <>
                  {/* CAR MODEL HEADER */}
                  <div className="text-center py-3 bg-gradient-to-r from-orange-50 to-blue-50 rounded-[24px]">
                    <Truck className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                    <h2 className="text-xl font-black text-gray-800">
                      {driverInfo.vehicleType || "سطحة هيدروليك"}
                    </h2>
                    <p className="text-[10px] text-gray-500 font-bold">
                      نوع السطحة
                    </p>
                  </div>

                  {/* DRIVER INFO ROW */}
                  <div className="flex items-center gap-4">
                    {/* RIGHT: Driver Profile Image */}
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-full border-4 border-orange-500 overflow-hidden shadow-lg bg-white">
                        {driverInfo.avatarUrl ? (
                          <img
                            src={resolveImageUrl(driverInfo.avatarUrl)}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as any).src =
                                "https://cdn-icons-png.flaticon.com/512/147/147144.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-orange-100">
                            <User className="w-10 h-10 text-orange-400" />
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white"></div>
                    </div>

                    {/* CENTER: Driver Name & Type */}
                    <div className="flex-1 text-right">
                      <h3 className="text-lg font-black text-gray-900 leading-tight mb-0.5">
                        {driverInfo.name || "كابتن سطحة"}
                      </h3>
                      <p className="text-xs text-gray-500 font-bold mb-2">
                        سائق معتمد
                      </p>
                      <div className="flex items-center gap-1 text-orange-500 text-[11px] font-black bg-orange-50 w-fit px-3 py-1 rounded-full">
                        <Star className="w-3 h-3 fill-orange-500" />
                        <span>4.9</span>
                        <span className="text-gray-400">• ممتاز</span>
                      </div>
                    </div>

                    {/* LEFT: License Plate Graphic */}
                    <div className="shrink-0">
                      <div className="bg-white border-4 border-gray-800 rounded-xl px-3 py-2 shadow-md">
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-gray-600 mb-0.5">
                            IRAQ
                          </div>
                          <div className="text-xl font-black text-gray-900 leading-none tracking-wider">
                            {driverInfo.plateNumber?.split("-")[1] || "123"}
                          </div>
                          <div className="text-[10px] font-bold text-gray-600 mt-0.5">
                            {driverInfo.plateNumber?.split("-")[0] || "بغداد"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsChatOpen(true);
                        setUnreadCount(0);
                      }}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 rounded-[20px] h-14 shadow-lg shadow-green-200 flex items-center justify-center gap-2 active:scale-95 transition-transform relative"
                    >
                      <MessageSquare className="w-5 h-5 text-white" />
                      <span className="text-white font-black text-sm">
                        مراسلة
                      </span>
                      {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[22px] h-5 rounded-full flex items-center justify-center border-2 border-white font-black animate-bounce">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    <a
                      href={`tel:${driverInfo.phone}`}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-[20px] h-14 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      <Phone className="w-5 h-5 text-white" />
                      <span className="text-white font-black text-sm">
                        اتصال
                      </span>
                    </a>
                  </div>

                  {/* PHONE NUMBER DISPLAY */}
                  <div className="text-center bg-gray-50 py-3 rounded-[20px]">
                    <p className="text-[11px] text-gray-500 font-bold mb-1">
                      رقم الهاتف
                    </p>
                    <p
                      className="text-lg font-black text-gray-800 tracking-wide"
                      dir="ltr"
                    >
                      {driverInfo.phone || "07XXXXXXXXX"}
                    </p>
                  </div>

                  {/* CANCEL BUTTON (Footer) */}
                  {requestStatus !== "pending" && (
                    <>
                      <div className="border-t border-gray-100 -mx-6"></div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCancelModal(true);
                        }}
                        className="w-full py-3 text-center text-red-500 hover:text-red-600 font-bold text-sm transition-colors rounded-[16px] hover:bg-red-50"
                        style={{ pointerEvents: "auto" }}
                      >
                        إلغاء الرحلة
                      </button>
                    </>
                  )}
                </>
              )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Professional Cancel Confirmation Modal - INSIDE TRACKING VIEW */}
        {showCancelModal && (() => {
          const inGrace =
            requestStatus === "accepted" &&
            orderAcceptedAt !== null &&
            Date.now() - orderAcceptedAt < 2 * 60 * 1000;
          return (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
            style={{ zIndex: 99999, pointerEvents: "auto" }}
          >
            <div
              className="bg-white rounded-[40px] shadow-2xl max-w-md w-full p-8 relative overflow-hidden"
              style={{ pointerEvents: "auto" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 opacity-50" />
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-200">
                  <X className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-center text-gray-900 mb-3">
                  إلغاء الرحلة؟
                </h3>
                <p className="text-center text-gray-600 font-bold text-sm leading-relaxed mb-8">
                  {inGrace
                    ? "يمكنك الإلغاء الآن دون أي رسوم — الكابتن سيتلقى إشعاراً فورياً."
                    : "هل أنت متأكد من إلغاء هذا الطلب؟ سيتم حذف الطلب نهائياً."}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelTrip();
                    }}
                    className="flex-1 h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-[20px] font-black text-base shadow-lg shadow-red-200 transition-all active:scale-95"
                  >
                    موافق، ألغِ الرحلة
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCancelModal(false);
                    }}
                    className="flex-1 h-14 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-[20px] font-black text-base transition-all active:scale-95"
                  >
                    لا، لا تلغِ
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    );

  return (
    <div
      className="h-full w-full bg-[#F3F4F6] flex flex-col overflow-hidden relative"
      dir="rtl"
    >
      <header className="absolute top-0 inset-x-0 z-[4000] p-6 flex flex-col gap-3">
        <div className="flex items-start gap-3 w-full">
          <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-2xl shadow-xl bg-white text-black w-14 h-14 border-none hover:bg-gray-50"
                onClick={() => setIsSidebarSheetOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[85%] p-0 z-[9000] border-none text-right flex flex-col bg-white"
            >
              <div className="p-8 pt-20 bg-orange-500 text-right rounded-bl-[60px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <Truck className="w-64 h-64 -rotate-12 absolute -right-10 -bottom-10" />
                </div>
                <div className="relative group w-24 h-24 mb-6">
                  <div className="w-24 h-24 bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-white/20 flex items-center justify-center">
                    {userProfile.image ? (
                      <img
                        src={userProfile.image}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">👤</span>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-xl shadow-lg active:scale-90 transition-transform"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </div>
                <h2 className="text-2xl font-black text-white leading-tight">
                  {userProfile.username || "مستخدم جديد"}
                </h2>
                <p className="text-white/80 text-sm font-bold mt-1 italic">
                  {userProfile.address || formData.city}
                </p>
              </div>

              <div className="p-6 pt-10 flex-1 overflow-y-auto">
                <SidebarLink
                  onClick={() => { setIsSidebarSheetOpen(false); setTimeout(() => setIsHistoryOpen(true), 200); }}
                  icon={<History className="w-5 h-5" />}
                  label="سجل الرحلات"
                  extra={`${userProfile.trips} رحلة`}
                />
                <SidebarLink
                  onClick={() => { setIsSidebarSheetOpen(false); setTimeout(() => setIsWalletOpen(true), 200); }}
                  icon={<Wallet className="w-5 h-5" />}
                  label="المحفظة"
                  extra={`${userProfile.wallet} د.ع`}
                  color="text-green-600"
                  extraColor="bg-green-50 text-green-700"
                />
                <SidebarLink
                  icon={<Star className="w-5 h-5" />}
                  label="التقييم"
                  extra="4.9 ★"
                  color="text-yellow-500"
                  extraColor="bg-yellow-50 text-yellow-700"
                />
                <SidebarLink
                  onClick={() => { setIsSidebarSheetOpen(false); setTimeout(() => setIsSupportOpen(true), 200); }}
                  icon={<Phone className="w-5 h-5" />}
                  label="الدعم الفني"
                  color="text-blue-600"
                />
              </div>

              <div className="p-8 border-t border-gray-50">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-4 text-red-500 font-black h-14 rounded-2xl hover:bg-red-50 transition-all"
                  onClick={() => { setIsSidebarSheetOpen(false); handleLogout(); }}
                >
                  <div className="bg-red-50 p-2.5 rounded-xl">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span>تسجيل الخروج</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div
            onClick={() =>
              !isWalletOpen &&
              !isHistoryOpen &&
              step !== "vehicle" &&
              setIsSearchOpen(true)
            }
            className="flex-1 bg-white shadow-2xl rounded-[28px] p-4 flex flex-col justify-center border border-white cursor-pointer transition-transform active:scale-95"
          >
            <StepIndicator step={step} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-gray-800 truncate">
                {step === "pickup"
                  ? formData.location || "حدد موقع التحميل"
                  : step === "dropoff"
                    ? formData.destination || "حدد وجهة التوصيل"
                    : "اختر نوع السطحة"}
              </span>
              <Search className="w-5 h-5 text-orange-500" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 relative z-0 flex flex-col">
        {(step === "pickup" || step === "dropoff") && (
          <div className="flex-1 relative">
            <SathaMap
              center={[formData.pickupLat, formData.pickupLng]}
              zoom={15}
            >
              <FlyToMarker
                center={
                  step === "pickup"
                    ? [formData.pickupLat, formData.pickupLng]
                    : [formData.destLat, formData.destLng]
                }
                shouldFly={shouldFly}
              />
              {/* Fix 3: Static confirmed pickup marker — uses confirmedPickupCoord which
                  is frozen on confirm, so it NEVER follows the map center again. */}
              {confirmedPickupCoord && step !== "pickup" && (
                <Marker
                  position={confirmedPickupCoord}
                  icon={getPickupPinIcon()}
                />
              )}
              <MapEventsHandler
                onMoveCoords={(center) => {
                  // Update lat/lng instantly during drag — no API call
                  setShouldFly(false);
                  if (step === "pickup") {
                    setFormData((prev) => ({
                      ...prev,
                      pickupLat: center.lat,
                      pickupLng: center.lng,
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      destLat: center.lat,
                      destLng: center.lng,
                    }));
                  }
                }}
                onMoveEnd={(center) => {
                  // Debounced reverse-geocode call when dragging stops
                  // Pass current step explicitly to avoid stale closure
                  const currentStep = step;
                  if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
                  geocodeDebounceRef.current = setTimeout(
                    () => reverseGeocode(center.lat, center.lng, currentStep),
                    400,
                  );
                }}
              />
            </SathaMap>
            <Button
              onClick={handleGetCurrentLocation}
              className="absolute bottom-40 right-6 z-[1000] w-14 h-14 rounded-2xl bg-white text-orange-500 shadow-2xl border-none active:scale-90 transition-transform"
            >
              <Target className="w-7 h-7" />
            </Button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              <div className="flex flex-col items-center -mt-12">
                <div
                  className={`px-5 py-2 rounded-2xl text-white text-xs font-black mb-2 shadow-2xl ${step === "pickup" ? "bg-orange-500" : "bg-black"}`}
                >
                  {step === "pickup" ? "تحميل من هنا" : "توصيل لهنا"}
                </div>
                <div
                  className={`w-1.5 h-8 ${step === "pickup" ? "bg-orange-500" : "bg-black"} rounded-full shadow-lg`}
                ></div>
              </div>
            </div>
          </div>
        )}

        {step === "vehicle" && (
          <div
            className="absolute inset-0 z-10 bg-gray-50 overflow-y-auto px-4 pt-28 scroll-smooth"
            style={{ height: "100%" }}
          >
            <h3 className="font-black text-gray-800 text-lg pr-2 mb-4">
              اختر السطحة المناسبة
            </h3>
            <div className="space-y-4">
              {VEHICLE_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() =>
                    setFormData((p) => ({ ...p, vehicleType: opt.id }))
                  }
                  className={`p-5 rounded-[28px] border-2 transition-all flex items-center justify-between ${formData.vehicleType === opt.id ? "bg-orange-500 border-orange-500 text-white shadow-lg scale-[1.01]" : "bg-white border-gray-100 shadow-sm hover:border-orange-200"}`}
                >
                  {/* CRITICAL FIX #2: Clean text-only design, NO ICONS */}
                  <div className="flex-1">
                    <h4 className="font-black text-xl">{opt.label}</h4>
                    <p className="text-sm font-bold opacity-70 mt-1">
                      {opt.description}
                    </p>
                  </div>
                  {formData.vehicleType === opt.id && (
                    <div className="bg-white/20 p-2 rounded-xl">
                      <Check className="w-6 h-6" />
                    </div>
                  )}
                </div>
              ))}
              {/* CRITICAL FIX #2: REMOVED OLD ORANGE CARD - Using Modal Only */}
              {/* Loading indicator for price calculation */}
              {isPriceCalculating && (
                <div className="flex items-center justify-center gap-3 p-4 mt-4">
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                  <span className="text-sm font-bold text-gray-600">
                    جاري حساب السعر...
                  </span>
                </div>
              )}

              {/* Simple price display (non-intrusive) */}
              {!isPriceCalculating && calculatedPrice > 0 && (
                <div className="flex items-center justify-between px-4 py-3 mt-4 bg-orange-50 rounded-[20px] border border-orange-200">
                  <span className="text-sm font-bold text-gray-700">
                    السعر المقدّر:
                  </span>
                  <span className="text-2xl font-black text-orange-600">
                    {calculatedPrice.toLocaleString()}{" "}
                    <span className="text-sm">د.ع</span>
                  </span>
                </div>
              )}

              <div className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-100 space-y-3 mt-4">
                <h4 className="font-black text-gray-800 text-xs">
                  طريقة الدفع
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${paymentMethod === "cash" ? "bg-black text-white shadow-md" : "bg-gray-50 text-gray-400"}`}
                  >
                    <RotateCcw className="w-4 h-4" /> كاش
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentSoonModal(true)}
                    data-testid="button-pay-with-wallet"
                    className={`flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${paymentMethod === "wallet" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-400"}`}
                  >
                    <Wallet className="w-4 h-4" /> المحفظة
                  </button>
                </div>
              </div>
            </div>
            <div className="h-[220px] w-full"></div>
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 inset-x-0 bg-white p-8 pb-10 rounded-t-[45px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] z-[5000] border-t border-gray-100">
        <Button
          onClick={() => {
            if (step === "pickup") {
              // Fix 3: Freeze the pickup coords into confirmedPickupCoord before
              // advancing to dropoff — the marker will never follow the map again.
              setConfirmedPickupCoord([formData.pickupLat, formData.pickupLng]);
              setStep("dropoff");
            } else if (step === "dropoff") setStep("vehicle");
            else handleFinalOrder();
          }}
          disabled={
            (step === "vehicle" && !formData.vehicleType) ||
            (step === "vehicle" && isPriceCalculating)
          }
          className={`w-full h-18 rounded-[28px] font-black text-xl transition-all shadow-xl ${step === "vehicle" ? "bg-orange-500 text-white" : "bg-black text-white"}`}
        >
          {step === "vehicle"
            ? isPriceCalculating
              ? "جاري احتساب السعر..."
              : showPriceConfirmation
                ? `تأكيد الطلب - ${calculatedPrice?.toLocaleString()} د.ع`
                : "متابعة"
            : "تأكيد الموقع"}
        </Button>
        {step !== "pickup" && (
          <button
            onClick={() => {
              if (showPriceConfirmation) {
                setShowPriceConfirmation(false);
              } else {
                // Fix 3: reset confirmed pickup when going back to pickup step
                if (step === "dropoff") setConfirmedPickupCoord(null);
                setStep(step === "dropoff" ? "pickup" : "dropoff");
              }
            }}
            className="w-full mt-5 text-gray-400 font-black text-xs flex items-center justify-center gap-2 hover:text-orange-500 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />{" "}
            {showPriceConfirmation ? "تعديل الطلب" : "رجوع للخطوة السابقة"}
          </button>
        )}
      </footer>

      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-[9996] bg-white p-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-8">
              <Button
                variant="ghost"
                onClick={() => setIsSearchOpen(false)}
                className="rounded-2xl bg-gray-50"
              >
                <X className="w-6 h-6" />
              </Button>
              <h3 className="font-black text-xl">البحث عن موقع</h3>
            </div>
            <div className="bg-gray-50 rounded-[28px] p-4 border border-gray-100 flex items-center gap-3 mb-6">
              <Search className="w-6 h-6 text-gray-400" />
              <input
                autoFocus
                placeholder="ادخل اسم المنطقة..."
                className="bg-transparent border-none outline-none w-full font-bold text-right"
                onChange={(e) => {
                  // Fix 4: Debounce — wait 350ms after user stops typing before firing
                  const val = e.target.value;
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => searchLocation(val), 350);
                }}
              />
              {isSearching && (
                <Loader2 className="animate-spin text-orange-500" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectResult(res)}
                  className="flex items-center gap-4 p-4 hover:bg-orange-50 rounded-2xl cursor-pointer active:bg-orange-100 transition-colors"
                >
                  <div className={`p-2.5 rounded-xl shadow-sm ${step === "pickup" ? "bg-orange-50" : "bg-gray-100"}`}>
                    <MapPin className={`w-5 h-5 ${step === "pickup" ? "text-orange-500" : "text-gray-700"}`} />
                  </div>
                  <div className="flex-1 truncate text-right">
                    <h4 className="font-bold text-gray-800 truncate">
                      {res.text || res.place_name?.split(",")[0] || "موقع"}
                    </h4>
                    <p className="text-[10px] text-gray-400 truncate">
                      {res.place_name || ""}
                    </p>
                  </div>
                </div>
              ))}
              {searchResults.length === 0 && !isSearching && (
                <div className="text-center py-12 opacity-40 font-bold text-gray-500">
                  ابدأ الكتابة للبحث عن موقع...
                </div>
              )}
            </div>
          </motion.div>
        )}

        {isHistoryOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed inset-0 z-[9998] bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-black text-xl">سجل الرحلات</h3>
              <Button
                variant="ghost"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-2xl"
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {tripsHistory.length > 0 ? (
                tripsHistory.map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-100"
                  >
                    <div className="flex justify-between mb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <span>رقم الرحلة #{trip.id}</span>
                      <span className="text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        مكتملة
                      </span>
                    </div>
                    <div className="space-y-3 relative">
                      <div className="flex items-center gap-3 font-bold text-sm">
                        <MapPin className="text-orange-500 w-4 h-4" />{" "}
                        {trip.pickupLocation}
                      </div>
                      <div className="flex items-center gap-3 font-bold text-sm">
                        <Target className="text-black w-4 h-4" />{" "}
                        {trip.destination}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center font-black">
                      <span className="text-orange-600">{trip.price} د.ع</span>
                      <span className="text-gray-300 text-[10px]">
                        {new Date(trip.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic font-black">
                  لا توجد رحلات سابقة
                </div>
              )}
            </div>
          </motion.div>
        )}

        {isWalletOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 z-[10000] bg-white flex flex-col font-sans text-right"
            dir="rtl"
            style={{ pointerEvents: "auto" }}
          >
            <div
              className="p-6 flex items-center justify-between border-b border-gray-50 bg-white"
              style={{ zIndex: 10001 }}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsWalletOpen(false)}
                className="rounded-full bg-gray-100 h-10 w-10"
                style={{ pointerEvents: "auto" }}
              >
                <X className="w-6 h-6 text-black" />
              </Button>
              <h2 className="text-xl font-black text-gray-800 italic">
                المحفظة
              </h2>
              <div className="w-10"></div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-6 py-8 space-y-8"
              style={{ pointerEvents: "auto" }}
            >
              <div className="bg-[#FF7A00] p-7 rounded-[30px] text-white shadow-lg relative overflow-hidden">
                <p className="text-white/80 text-xs font-bold mb-1">
                  رصيدك الحالي المتاح
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-black tracking-tight">
                    {Number(userProfile.wallet || 0).toLocaleString()}
                  </h3>
                  <span className="text-lg font-bold opacity-90">د.ع</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-gray-500 text-sm font-bold block px-2">
                  مبلغ الشحن المطلوب
                </label>
                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  type="number"
                  placeholder="أدخل المبلغ..."
                  className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-[22px] px-6 text-xl font-black text-gray-800 focus:border-orange-500 focus:outline-none transition-all"
                  style={{ pointerEvents: "auto", userSelect: "auto" }}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-gray-800 font-black text-lg pr-2">
                  وسائل الشحن
                </h4>
                <button
                  onClick={() => setShowPaymentSoonModal(true)}
                  data-testid="button-deposit-zain"
                  className={`w-full p-5 bg-white border-2 rounded-[25px] flex items-center justify-between transition-all ${walletPaymentMethod === "zain" ? "border-orange-500 bg-orange-50/20" : "border-gray-100"}`}
                  style={{ pointerEvents: "auto" }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center p-1">
                      <img
                        src="/zain-logo.png"
                        className="w-full h-full object-contain"
                        alt="Zain"
                      />
                    </div>
                    <span className="font-bold text-gray-700 text-lg">
                      زين كاش
                    </span>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${walletPaymentMethod === "zain" ? "border-orange-500" : "border-gray-200"}`}
                  >
                    {walletPaymentMethod === "zain" && (
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setShowPaymentSoonModal(true)}
                  data-testid="button-deposit-card"
                  className={`w-full p-5 bg-white border-2 rounded-[25px] flex items-center justify-between transition-all ${walletPaymentMethod === "card" ? "border-blue-500 bg-blue-50/20" : "border-gray-100"}`}
                  style={{ pointerEvents: "auto" }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-gray-700 text-lg">
                      ماستر كارد / فيزا
                    </span>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${walletPaymentMethod === "card" ? "border-blue-500" : "border-gray-200"}`}
                  >
                    {walletPaymentMethod === "card" && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </button>
              </div>

              <div className="pt-4 pb-20">
                <h4 className="text-gray-800 font-black text-lg pr-2 mb-4">
                  سجل العمليات
                </h4>
                {tripsHistory && tripsHistory.length > 0 ? (
                  tripsHistory.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between py-5 border-b border-gray-50 px-2"
                    >
                      <div className="text-right">
                        <p className="font-bold text-gray-800">رحلة مكتملة</p>
                        <p className="text-[11px] text-gray-400 font-bold">
                          {new Date(trip.createdAt).toLocaleDateString("ar-EG")}
                        </p>
                      </div>
                      <div className="text-lg font-black text-red-600">
                        -{trip.price?.toLocaleString() || 0} د.ع
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-30 italic font-bold">
                    لا توجد عمليات مسجلة
                  </div>
                )}
              </div>
            </div>

            <div
              className="p-6 bg-white border-t border-gray-50 pb-8"
              style={{ pointerEvents: "auto" }}
            >
              <Button
                disabled={isDepositing}
                onClick={() => setShowPaymentSoonModal(true)}
                data-testid="button-confirm-deposit"
                className="w-full h-16 rounded-[22px] bg-orange-500 text-white text-xl font-black shadow-lg hover:bg-orange-600 disabled:opacity-50"
                style={{ pointerEvents: "auto" }}
              >
                {isDepositing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  "تأكيد عملية الشحن"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentComingSoonDialog
        open={showPaymentSoonModal}
        onOpenChange={setShowPaymentSoonModal}
      />

      {/* CRITICAL FIX #2: Professional Price Confirmation Modal */}
      <Dialog
        open={showPriceConfirmation}
        onOpenChange={setShowPriceConfirmation}
      >
        <DialogContent className="max-w-md mx-auto bg-white rounded-[30px] p-0 border-none shadow-2xl">
          <div className="p-8 text-center space-y-6">
            {/* Header */}
            <div className="flex justify-center">
              <div className="bg-orange-100 p-4 rounded-full">
                <DollarSign className="w-12 h-12 text-orange-600" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-2xl font-black text-gray-800 mb-2">
                تأكيد الطلب
              </h3>
              <p className="text-sm text-gray-500 font-bold">
                يرجى مراجعة التفاصيل قبل التأكيد
              </p>
            </div>

            {/* Price Details */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-[25px] space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-orange-200">
                <span className="text-gray-600 font-bold">نوع السيارة:</span>
                <span className="text-gray-800 font-black">
                  {formData.vehicleType}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-orange-200">
                <span className="text-gray-600 font-bold">المسافة:</span>
                <span className="text-gray-800 font-black">
                  {distanceKm.toFixed(1)} كم
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-orange-200">
                <span className="text-gray-600 font-bold">طريقة الدفع:</span>
                <span className="text-gray-800 font-black">
                  {paymentMethod === "wallet" ? "محفظة" : "نقدي"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3">
                <span className="text-orange-600 font-black text-lg">
                  السعر الإجمالي:
                </span>
                <div className="text-right">
                  <span className="text-4xl font-black text-orange-600">
                    {calculatedPrice?.toLocaleString()}
                  </span>
                  <span className="text-sm text-orange-500 font-bold mr-1">
                    د.ع
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowPriceConfirmation(false)}
                variant="outline"
                className="flex-1 h-14 rounded-[20px] font-black text-gray-700 border-2 hover:bg-gray-50"
              >
                إلغاء
              </Button>
              <Button
                onClick={() => {
                  setShowPriceConfirmation(false);
                  handleFinalOrder();
                }}
                className="flex-1 h-14 rounded-[20px] font-black bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
              >
                تأكيد الطلب
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════
          TECHNICAL SUPPORT PANEL
          ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isSupportOpen && (
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed inset-0 z-[9000] bg-white flex flex-col"
            style={{ pointerEvents: "auto" }}
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <Button variant="ghost" size="icon" onClick={() => setIsSupportOpen(false)} className="rounded-full bg-gray-100 h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
              <h2 className="text-xl font-black text-gray-800">الدعم الفني</h2>
              <div className="w-10" />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-center text-gray-400 font-bold text-sm pb-2">
                تواصل معنا عبر الاتصال أو واتساب
              </p>

              {[
                { name: "علي كريم", phone: "07719820537" },
                { name: "منتظر كريم", phone: "07882992284" },
              ].map((contact) => (
                <div key={contact.phone} className="bg-gray-50 rounded-[28px] p-6 space-y-4 border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                      <Phone className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-lg">{contact.name}</p>
                      <p className="text-gray-400 font-bold text-sm tracking-widest">{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex-1 h-13 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-md shadow-blue-200 transition-all active:scale-95 py-3"
                    >
                      <Phone className="w-4 h-4" />
                      اتصال
                    </a>
                    <a
                      href={`https://wa.me/${contact.phone.replace(/^0/, "964")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-13 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black text-sm shadow-md shadow-green-200 transition-all active:scale-95 py-3"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      واتساب
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MapEventsHandler({
  onMoveCoords,
  onMoveEnd,
}: {
  onMoveCoords: (center: { lat: number; lng: number }) => void;
  onMoveEnd: (center: { lat: number; lng: number }) => void;
}) {
  const map = useMapEvents({
    move: () => onMoveCoords(map.getCenter()),     // live coords during drag
    moveend: () => onMoveEnd(map.getCenter()),     // geocode API call after drag ends
  });
  return null;
}
