import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { MenuItem, Category, OrderItem, ModifierGroup, ModifierOption } from "../types";
import { io, Socket } from "socket.io-client";
import { 
  ShoppingBag, 
  ChevronRight, 
  Utensils, 
  Check, 
  Plus, 
  Minus, 
  Clock, 
  Languages, 
  HelpCircle, 
  ArrowLeft,
  ThumbsUp,
  Sparkles,
  DollarSign,
  Flame,
  Bell,
  Droplet,
  FileText,
  MessageSquare
} from "lucide-react";

interface SmartMenuProps {
  tableNumber?: string;
  branchId: string;
  convoId?: string;
}

export default function SmartMenu({ tableNumber, branchId, convoId }: SmartMenuProps) {
  const { language, setLanguage, t, text, dir } = useI18n();
  const isWhatsAppMode = !!convoId;

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [currency, setCurrency] = useState({ code: "EUR", symbol: "€" });
  const [branchName, setBranchName] = useState("");
  const [restaurantName, setRestaurantName] = useState("MR. Tabboush");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandStyles, setBrandStyles] = useState<React.CSSProperties>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncedSuccess, setIsSyncedSuccess] = useState(false);

  // Cart State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Modifiers Selection State
  const [selectedItemForMod, setSelectedItemForMod] = useState<MenuItem | null>(null);
  const [modSelections, setModSelections] = useState<Record<string, ModifierOption[]>>({});
  const [modQuantity, setModQuantity] = useState(1);

  // Upsell Intercept State
  const [pendingUpsellItem, setPendingUpsellItem] = useState<{
    cartIndex: number;
    itemId: string;
    upsell: { id: string; suggestedItemName: any; price: number };
  } | null>(null);

  // Order Placement State
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Service Request State (Call Waiter / Request Bill)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isServiceSubmitting, setIsServiceSubmitting] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState<string | null>(null);
  const [activeServiceRequests, setActiveServiceRequests] = useState<string[]>([]);

  // Load public menu
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const url = `/api/public/menu?branchId=${branchId}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          setMenuItems(data.menuItems || []);
          setCurrency(data.currency || { code: "EUR", symbol: "€" });
          setBranchName(data.branch?.name || data.restaurant?.name || "MR. Tabboush");
          if (data.restaurant) {
            setRestaurantName(data.restaurant.name || "MR. Tabboush");
            setLogoUrl(data.restaurant.logo || "");
            setBrandStyles({
              "--brand-primary": data.restaurant.primaryColor || "#ea580c",
              "--brand-secondary": data.restaurant.secondaryColor || "#1f2937",
            } as React.CSSProperties);
          }
        }
      } catch (err) {
        console.error("Failed to fetch menu:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, [branchId]);

  // Connect to Socket.io for order tracking
  useEffect(() => {
    if (placedOrder && placedOrder.id) {
      const socket = io({
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join", `order:${placedOrder.id}`);
      });

      socket.on("order:updated", ({ orderId, status }: { orderId: string; status: any }) => {
        if (orderId === placedOrder.id) {
          setPlacedOrder((prev: any) => prev ? { ...prev, status } : null);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [placedOrder]);

  // Handle category scrolling/selection
  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    if (catId === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.getElementById(`cat-section-${catId}`);
      if (element) {
        const yOffset = -90; 
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  };

  // Modifier Selection Handlers
  const handleOpenModifiers = (item: MenuItem) => {
    setSelectedItemForMod(item);
    setModQuantity(1);
    
    // Auto-select required/default single modifiers
    const defaults: Record<string, ModifierOption[]> = {};
    (item.modifierGroups || []).forEach((group) => {
      if (group.isRequired && group.type === "single" && group.options.length > 0) {
        defaults[group.id] = [group.options[0]];
      } else {
        defaults[group.id] = [];
      }
    });
    setModSelections(defaults);
  };

  const getSelectedModsAdjustment = () => {
    if (!selectedItemForMod) return 0;
    let extraPrice = 0;
    Object.entries(modSelections).forEach(([groupId, optionsVal]) => {
      const options = optionsVal as ModifierOption[];
      const group = (selectedItemForMod.modifierGroups || []).find((g) => g.id === groupId);
      if (group && options.length > 0) {
        options.forEach((opt) => {
          extraPrice += opt.priceAdjustment || 0;
        });
      }
    });
    return extraPrice;
  };

  const handleSelectModifier = (group: ModifierGroup, option: ModifierOption) => {
    setModSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.type === "single") {
        return { ...prev, [group.id]: [option] };
      } else {
        const exists = current.some((o) => o.id === option.id);
        const next = exists 
          ? current.filter((o) => o.id !== option.id)
          : [...current, option];
        
        if (group.maxSelections && next.length > group.maxSelections) {
          return prev; // Exceeded limit
        }
        return { ...prev, [group.id]: next };
      }
    });
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedItemForMod) return;

    // Check if required modifier groups are filled
    for (const group of (selectedItemForMod.modifierGroups || [])) {
      if (group.isRequired) {
        const selections = modSelections[group.id] || [];
        if (selections.length < (group.minSelections || 1)) {
          alert(language === "ar" 
            ? `الرجاء تحديد الخيارات المطلوبة لـ ${text(group.name)}`
            : `Bitte wählen Sie Optionen für ${text(group.name)}`);
          return;
        }
      }
    }

    // Prepare Cart Item Modifiers structure
    const selectedMods: any[] = [];
    Object.entries(modSelections).forEach(([groupId, optionsVal]) => {
      const options = optionsVal as ModifierOption[];
      const group = (selectedItemForMod.modifierGroups || []).find((g) => g.id === groupId);
      if (group && options.length > 0) {
        options.forEach((opt) => {
          selectedMods.push({
            groupId: group.id,
            groupName: group.name,
            option: opt,
          });
        });
      }
    });

    const modifiersPriceAdjustment = selectedMods.reduce(
      (sum, m) => sum + (m.option.priceAdjustment || 0), 
      0
    );

    const basePrice = selectedItemForMod.basePrice;
    const itemTotal = (basePrice + modifiersPriceAdjustment) * modQuantity;

    const cartItem: OrderItem = {
      itemId: selectedItemForMod.id,
      name: selectedItemForMod.name,
      basePrice: basePrice,
      quantity: modQuantity,
      selectedModifiers: selectedMods,
      totalPrice: itemTotal,
    };

    setCart((prev) => {
      const nextCart = [...prev, cartItem];
      
      // Look for active upsells
      const activeUpsell = selectedItemForMod.upsellSuggestions.find((u) => u.isActive !== false);
      if (activeUpsell) {
        // Intercept checkout after closing modal
        setTimeout(() => {
          setPendingUpsellItem({
            cartIndex: nextCart.length - 1,
            itemId: selectedItemForMod.id,
            upsell: {
              id: activeUpsell.id,
              suggestedItemName: activeUpsell.suggestedItemName,
              price: activeUpsell.price,
            }
          });
        }, 300);
      }
      
      return nextCart;
    });

    setSelectedItemForMod(null);
  };

  // Quick add (no modifiers)
  const handleQuickAdd = (item: MenuItem) => {
    if (item.modifierGroups.length > 0) {
      handleOpenModifiers(item);
    } else {
      const cartItem: OrderItem = {
        itemId: item.id,
        name: item.name,
        basePrice: item.basePrice,
        quantity: 1,
        selectedModifiers: [],
        totalPrice: item.basePrice,
      };
      
      setCart((prev) => {
        const nextCart = [...prev, cartItem];
        const activeUpsell = item.upsellSuggestions.find((u) => u.isActive !== false);
        if (activeUpsell) {
          setPendingUpsellItem({
            cartIndex: nextCart.length - 1,
            itemId: item.id,
            upsell: {
              id: activeUpsell.id,
              suggestedItemName: activeUpsell.suggestedItemName,
              price: activeUpsell.price,
            }
          });
        }
        return nextCart;
      });
    }
  };

  const handleApplyUpsell = (accept: boolean) => {
    if (!pendingUpsellItem) return;

    if (accept) {
      setCart((prev) => {
        const nextCart = [...prev];
        const item = nextCart[pendingUpsellItem.cartIndex];
        if (item) {
          item.selectedUpsell = {
            id: pendingUpsellItem.upsell.id,
            name: pendingUpsellItem.upsell.suggestedItemName,
            price: pendingUpsellItem.upsell.price,
          };
          item.totalPrice += pendingUpsellItem.upsell.price;
        }
        return nextCart;
      });
    }

    setPendingUpsellItem(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const nextCart = [...prev];
      const item = nextCart[index];
      if (item) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
          nextCart.splice(index, 1);
        } else {
          const modAdj = item.selectedModifiers.reduce((s, m) => s + (m.option.priceAdjustment || 0), 0);
          item.quantity = newQty;
          item.totalPrice = (item.basePrice + modAdj) * newQty + (item.selectedUpsell?.price || 0);
        }
      }
      return nextCart;
    });
  };

  const getCartSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const getCheckoutTotal = () => {
    return getCartSubtotal();
  };

  // Submit dine-in or WhatsApp synced order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      if (isWhatsAppMode) {
        const orderData = {
          convoId,
          items: cart.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            selectedModifiers: item.selectedModifiers.map((m) => ({
              groupId: m.groupId,
              option: { id: m.option.id },
            })),
            selectedUpsell: item.selectedUpsell 
              ? { id: item.selectedUpsell.id } 
              : undefined,
          })),
        };

        const response = await fetch("/api/public/whatsapp-cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (response.ok) {
          setIsSyncedSuccess(true);
          setCart([]);
          setIsCartOpen(false);
        } else {
          const errorData = await response.json();
          alert(errorData.error || "Failed to sync cart with WhatsApp.");
        }
      } else {
        const orderData = {
          branchId,
          customerName: customerName.trim() || undefined,
          whatsAppPhone: customerPhone.trim() || undefined,
          tableNumber,
          items: cart.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            selectedModifiers: item.selectedModifiers.map((m) => ({
              groupId: m.groupId,
              optionId: m.option.id,
            })),
            selectedUpsell: item.selectedUpsell 
              ? { id: item.selectedUpsell.id, added: true } 
              : undefined,
          })),
          notes: notes.trim() || undefined,
        };

        const response = await fetch("/api/public/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (response.ok) {
          const order = await response.json();
          setPlacedOrder(order);
          setCart([]);
          setIsCartOpen(false);
        } else {
          const errorData = await response.json();
          alert(errorData.error || "Failed to submit order.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed. Connection issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Service Request
  const handleServiceRequest = async (type: string) => {
    if (isServiceSubmitting) return;
    setIsServiceSubmitting(true);

    try {
      // Emit real-time Socket.io event for dashboard listener
      if (socketRef.current) {
        socketRef.current.emit("service:request", {
          orderId: placedOrder?.id || placedOrder?._id,
          tableNumber,
          branchId,
          type,
          timestamp: new Date().toISOString(),
        });
      }

      // Simulate a server roundtrip of 800ms
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Show beautiful toast feedback
      let msg = "";
      if (language === "ar") {
        if (type === "waiter") msg = "تم إرسال نداء للنادل، سيصلك في أقرب وقت!";
        else if (type === "bill") msg = "تم طلب الفاتورة، سيحضرها النادل لطاولتك!";
        else if (type === "water") msg = "تم طلب الماء، سيصلك قريباً!";
        else msg = "تم إرسال طلب الخدمة بنجاح!";
      } else if (language === "de") {
        if (type === "waiter") msg = "Der Service wurde gerufen! Ein Kellner kommt gleich.";
        else if (type === "bill") msg = "Die Rechnung wurde angefordert! Der Kellner bringt sie an Ihren Tisch.";
        else if (type === "water") msg = "Wasser wurde angefordert! Wird gleich serviert.";
        else msg = "Service-Anfrage erfolgreich übermittelt!";
      } else {
        if (type === "waiter") msg = "Service summoned! A waiter will be with you shortly.";
        else if (type === "bill") msg = "Bill requested! A waiter will bring it to your table.";
        else if (type === "water") msg = "Water requested! Serving shortly.";
        else msg = "Service request sent successfully!";
      }

      setServiceSuccessMsg(msg);
      setActiveServiceRequests((prev) => [...prev, type]);

      // Close the modal after a short delay and clear message
      setTimeout(() => {
        setIsServiceModalOpen(false);
        setServiceSuccessMsg(null);
      }, 3000);
    } catch (err) {
      console.error("Failed to summon service:", err);
      alert("Failed to send service request.");
    } finally {
      setIsServiceSubmitting(false);
    }
  };

  const getOrderStatusProgress = (status: string) => {
    const steps = ["received", "preparing", "ready_for_pickup", "delivered"];
    const statusMap: Record<string, string> = {
      received: "received",
      under_review: "received",
      accepted: "received",
      preparing: "preparing",
      ready_for_pickup: "ready_for_pickup",
      out_for_delivery: "ready_for_pickup",
      delivered: "delivered",
      cancelled: "cancelled",
    };

    const currentStep = statusMap[status] || "received";
    if (currentStep === "cancelled") return -1;
    return steps.indexOf(currentStep);
  };

  // Render Loader
  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50/20 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin mb-4"></div>
        <span className="text-sm text-neutral-500 font-medium">{t("common.loading")}</span>
      </div>
    );
  }

  // Render Sync Success Screen
  if (isSyncedSuccess) {
    return (
      <div dir={dir} style={brandStyles} className="min-h-screen bg-stone-50 text-neutral-800 font-sans flex flex-col animate-fade-in relative select-none">
        {/* Success Header */}
        <header className="bg-slate-900/95 backdrop-blur-md border-b border-orange-500/20 text-white text-center py-5 shadow-lg sticky top-0 z-40">
          <h1 className="text-lg font-bold font-serif tracking-tight flex items-center justify-center gap-1.5">
            {logoUrl ? (
              <img src={logoUrl} alt={restaurantName} className="w-8 h-8 rounded-lg object-cover shadow-sm" />
            ) : (
              <span className="text-orange-500">🌯</span>
            )}
            <span>{branchName.toUpperCase()}</span>
          </h1>
          <p className="text-[9px] text-orange-400 font-mono font-bold tracking-widest uppercase mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/50">
            {t("orders.whatsappOrdering")}
          </p>
        </header>

        {/* Tracking Card */}
        <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-center gap-5 py-6">
          <div className="bg-white rounded-2xl border border-stone-200/50 p-6 text-center shadow-sm relative overflow-hidden animate-scale-in">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400"></div>
            
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100/60 shadow-sm animate-pulse-subtle">
              <MessageSquare size={28} className="text-emerald-500" />
            </div>
            
            <h2 className="text-base font-bold text-neutral-900 leading-tight">
              {t("orders.cartSyncedTitle")}
            </h2>
            <p className="text-[11px] text-neutral-500 mt-3 max-w-xs mx-auto leading-relaxed">
              {t("orders.cartSyncedMessage")}
            </p>

            {/* Total Paid Stamp */}
            <div className="mt-5 p-2 px-3.5 bg-stone-50 border border-stone-200/50 rounded-2xl inline-flex items-center gap-2 text-[11px] text-neutral-600 font-semibold shadow-xs">
              <span>{t("common.total")}:</span>
              <span className="text-orange-600 font-bold font-mono text-xs">
                {getCheckoutTotal().toFixed(2)}{currency.symbol}
              </span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Render Placed Order Success Screen
  if (placedOrder) {
    const stepIdx = getOrderStatusProgress(placedOrder.status);
    const orderNum = placedOrder.orderNumber;
    
    return (
      <div dir={dir} style={brandStyles} className="min-h-screen bg-stone-50 text-neutral-800 font-sans flex flex-col animate-fade-in relative select-none">
        {/* Success Header */}
        <header className="bg-slate-900/95 backdrop-blur-md border-b border-orange-500/20 text-white text-center py-5 shadow-lg sticky top-0 z-40">
          <h1 className="text-lg font-bold font-serif tracking-tight flex items-center justify-center gap-1.5">
            {logoUrl ? (
              <img src={logoUrl} alt={restaurantName} className="w-8 h-8 rounded-lg object-cover shadow-sm" />
            ) : (
              <span className="text-orange-500">🌯</span>
            )}
            <span>{branchName.toUpperCase()}</span>
          </h1>
          <p className="text-[9px] text-orange-400 font-mono font-bold tracking-widest uppercase mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/50">
            {t("orders.dineIn")} • {t("orders.table")} {tableNumber}
          </p>
        </header>

        {/* Tracking Card */}
        <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-start gap-5 py-6">
          <div className="bg-white rounded-2xl border border-stone-200/50 p-6 text-center shadow-sm relative overflow-hidden animate-scale-in">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400"></div>
            
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100/60 shadow-sm animate-pulse-subtle">
              <Check size={28} />
            </div>
            
            <h2 className="text-base font-bold text-neutral-900 leading-tight">
              {language === "ar" ? "تم إرسال طلبك بنجاح!" : "Bestellung erfolgreich übermittelt!"}
            </h2>
            <p className="text-[11px] text-neutral-400 mt-2 max-w-xs mx-auto leading-relaxed">
              {language === "ar" 
                ? `طلبك رقم ${orderNum} تم إرساله مباشرة لمطبخ المطعم للتحضير.`
                : `Ihre Bestellnummer ist ${orderNum}. Sie wurde direkt in die Küche übertragen.`}
            </p>

            {/* Total Paid Stamp */}
            <div className="mt-4 p-2 px-3.5 bg-stone-50 border border-stone-200/50 rounded-2xl inline-flex items-center gap-2 text-[11px] text-neutral-600 font-semibold shadow-xs">
              <span>{t("common.total")}:</span>
              <span className="text-orange-600 font-bold font-mono text-xs">
                {placedOrder.total.toFixed(2)}{currency.symbol}
              </span>
              <span className="text-[9px] uppercase bg-stone-200 text-neutral-700 px-2 py-0.5 rounded-md font-bold tracking-wider">
                {language === "ar" ? "دفع عند الطاولة" : "Pay at Table"}
              </span>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="bg-white rounded-2xl border border-stone-200/50 p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-2">
              <Clock size={14} className="text-orange-500" />
              {language === "ar" ? "حالة تحضير الطلب" : "Zubereitungsstatus"}
            </h3>

            {placedOrder.status === "cancelled" ? (
              <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-2xl text-xs flex items-center gap-2.5 animate-pulse-subtle">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                <span className="font-semibold">{t("status.cancelled")}</span>
              </div>
            ) : (
              <div className="space-y-6 relative pl-6 ml-2.5 border-l-2 border-stone-100">
                {/* Step 1: Received */}
                <div className="relative">
                  <div className={`absolute -left-[35px] w-6.5 h-6.5 rounded-full flex items-center justify-center border font-bold text-[10px] transition-all duration-300 ${
                    stepIdx >= 0 
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                      : "bg-white border-stone-200 text-neutral-400"
                  }`}>
                    {stepIdx > 0 ? <Check size={11} /> : <ShoppingBag size={11} />}
                  </div>
                  <div className="leading-tight">
                    <h4 className={`text-xs font-bold ${stepIdx === 0 ? "text-orange-600" : "text-neutral-900"}`}>{t("status.received")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {language === "ar" ? "تم استلام الطلب وتأكيده بالكامل" : "Bestellung empfangen und bestätigt"}
                    </p>
                  </div>
                </div>

                {/* Step 2: Preparing */}
                <div className="relative">
                  <div className={`absolute -left-[35px] w-6.5 h-6.5 rounded-full flex items-center justify-center border font-bold text-[10px] transition-all duration-300 ${
                    stepIdx >= 1 
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                      : "bg-white border-stone-200 text-neutral-400"
                  } ${stepIdx === 1 ? "animate-pulse-subtle border-emerald-400 ring-4 ring-emerald-100" : ""}`}>
                    {stepIdx > 1 ? <Check size={11} /> : <Flame size={11} />}
                  </div>
                  <div className="leading-tight">
                    <h4 className={`text-xs font-bold ${stepIdx === 1 ? "text-orange-600" : "text-neutral-900"}`}>{t("status.preparing")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {language === "ar" ? "وجبتك تحضّر الآن طازجة في المطبخ" : "Wird frisch in der Küche zubereitet"}
                    </p>
                  </div>
                </div>

                {/* Step 3: Ready */}
                <div className="relative">
                  <div className={`absolute -left-[35px] w-6.5 h-6.5 rounded-full flex items-center justify-center border font-bold text-[10px] transition-all duration-300 ${
                    stepIdx >= 2 
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                      : "bg-white border-stone-200 text-neutral-400"
                  } ${stepIdx === 2 ? "animate-pulse-subtle border-emerald-400 ring-4 ring-emerald-100" : ""}`}>
                    {stepIdx > 2 ? <Check size={11} /> : <Bell size={11} />}
                  </div>
                  <div className="leading-tight">
                    <h4 className={`text-xs font-bold ${stepIdx === 2 ? "text-orange-600" : "text-neutral-900"}`}>{t("status.ready_for_pickup")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {language === "ar" ? "وجبتك جاهزة وسيقوم النادل بتقديمها فوراً" : "Gerichte fertig zum Servieren"}
                    </p>
                  </div>
                </div>

                {/* Step 4: Delivered */}
                <div className="relative">
                  <div className={`absolute -left-[35px] w-6.5 h-6.5 rounded-full flex items-center justify-center border font-bold text-[10px] transition-all duration-300 ${
                    stepIdx >= 3 
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                      : "bg-white border-stone-200 text-neutral-400"
                  }`}>
                    <Utensils size={11} />
                  </div>
                  <div className="leading-tight">
                    <h4 className={`text-xs font-bold ${stepIdx === 3 ? "text-orange-600" : "text-neutral-900"}`}>{t("status.delivered")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {language === "ar" ? "بالهناء والشفاء! نتمنى أن تنال وجبتنا إعجابك" : "Guten Appetit! Genießen Sie Ihr Essen"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Need help service section */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 text-white flex items-center justify-between shadow-md">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-orange-400 font-mono tracking-widest uppercase block">
                {language === "ar" ? "خدمة الطاولة المباشرة" : "DINE-IN SERVICE"}
              </span>
              <h4 className="text-xs font-bold">
                {language === "ar" ? "بحاجة لمساعدة أو طلب الخدمة؟" : "Unterstützung am Tisch?"}
              </h4>
              <p className="text-[9px] text-slate-400">
                {language === "ar" ? "اطلب النادل، ماء، أو الفاتورة بضغطة واحدة" : "Kellner rufen, Wasser oder Rechnung bitten"}
              </p>
            </div>
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold px-4 py-2 rounded-xl transition shadow active:scale-95 shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Bell size={12} className="animate-pulse" />
              {language === "ar" ? "طلب الخدمة" : "Service rufen"}
            </button>
          </div>

          {/* Order Details list for verification */}
          <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm text-xs space-y-2.5">
            <h4 className="font-bold text-neutral-900 pb-1.5 border-b border-stone-100 flex justify-between items-center">
              <span>{language === "ar" ? "تفاصيل الطلب" : "Bestelldetails"}</span>
              <span className="font-mono text-[10px] text-neutral-400">#{orderNum}</span>
            </h4>
            {placedOrder.items && placedOrder.items.map((it: any, itIdx: number) => (
              <div key={itIdx} className="flex justify-between items-start text-stone-600">
                <div className="min-w-0 pr-2">
                  <span className="font-mono font-bold text-neutral-900 mr-1.5">{it.quantity}x</span>
                  <span>{text(it.name)}</span>
                </div>
                <span className="font-mono text-neutral-800 font-semibold shrink-0">{it.totalPrice.toFixed(2)}{currency.symbol}</span>
              </div>
            ))}
          </div>

          {/* New Order Button */}
          <button
            onClick={() => setPlacedOrder(null)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3.5 rounded-xl transition shadow-md active:scale-98 cursor-pointer"
          >
            {language === "ar" ? "طلب أطباق أخرى" : "Weitere Gerichte bestellen"}
          </button>
        </main>

        <footer className="py-4 text-center text-[9px] text-neutral-400 border-t border-stone-200/40 mt-auto bg-stone-100 select-none">
          {restaurantName.toUpperCase()} SMART TABLE MENU
        </footer>

        {/* Service Request Drawer Modal */}
        {isServiceModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-55 flex items-end justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-stone-200/50">
              {/* Header */}
              <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50 select-none">
                <div className="flex items-center gap-2">
                  <Bell className="text-orange-500 animate-bounce" size={18} />
                  <h3 className="font-bold text-sm text-neutral-900">
                    {language === "ar" ? "نداء الخدمة" : "Service anfordern"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsServiceModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 bg-white border border-stone-200 rounded-lg text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {serviceSuccessMsg ? (
                  <div className="py-8 text-center space-y-3 animate-scale-in">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <Check size={24} />
                    </div>
                    <p className="text-xs font-bold text-neutral-800 px-4 leading-relaxed">
                      {serviceSuccessMsg}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-neutral-400 text-center leading-relaxed">
                      {language === "ar"
                        ? "اختر نوع الخدمة التي تحتاجها، وسيقوم أحد موظفينا بتلبيتك فوراً."
                        : "Wählen Sie Ihren Wunsch. Unser Team wird Sie umgehend am Tisch bedienen."}
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {[
                        {
                          id: "waiter",
                          icon: <Bell size={20} />,
                          labelDE: "Kellner rufen",
                          labelAR: "نداء النادل",
                          labelEN: "Call Waiter",
                        },
                        {
                          id: "bill",
                          icon: <FileText size={20} />,
                          labelDE: "Rechnung bitten",
                          labelAR: "طلب الفاتورة",
                          labelEN: "Request Bill",
                        },
                        {
                          id: "water",
                          icon: <Droplet size={20} />,
                          labelDE: "Wasser bitten",
                          labelAR: "طلب ماء",
                          labelEN: "Request Water",
                        },
                        {
                          id: "custom",
                          icon: <MessageSquare size={20} />,
                          labelDE: "Anderer Wunsch",
                          labelAR: "خدمة أخرى",
                          labelEN: "Other Request",
                        },
                      ].map((srv) => {
                        const alreadySent = activeServiceRequests.includes(srv.id);
                        return (
                          <button
                            key={srv.id}
                            disabled={isServiceSubmitting || alreadySent}
                            onClick={() => handleServiceRequest(srv.id)}
                            className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center transition cursor-pointer select-none ${
                              alreadySent
                                ? "bg-emerald-50/50 border-emerald-200 text-emerald-600 cursor-not-allowed opacity-90"
                                : "bg-white border-stone-200/80 hover:border-orange-300 hover:bg-orange-50/10 text-neutral-700 active:scale-95"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl ${alreadySent ? "bg-emerald-100" : "bg-stone-50 border border-stone-100 text-neutral-500"} transition`}>
                              {srv.icon}
                            </div>
                            <span className="text-[11px] font-bold leading-tight">
                              {alreadySent 
                                ? (language === "ar" ? "تم الإرسال" : "Gesendet")
                                : (language === "ar" ? srv.labelAR : language === "de" ? srv.labelDE : srv.labelEN)
                              }
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  return (
    <div dir={dir} style={brandStyles} className="min-h-screen bg-stone-50 text-neutral-800 font-sans flex flex-col pb-24 relative select-none">
      
      {/* Smart Menu Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-orange-500/20 text-white py-3.5 px-4 sticky top-0 z-40 shadow-md transition-all duration-300">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={restaurantName} className="w-9 h-9 rounded-xl object-cover shadow-md rotate-[-2deg] border border-stone-250/20" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-lg rotate-[-2deg] shadow-md shadow-orange-500/20 border border-orange-400/30">
                🌯
              </div>
            )}
            <div>
              <h1 className="text-xs font-serif font-bold tracking-tight uppercase">{branchName}</h1>
              <p className="text-[9px] text-orange-400 font-mono font-bold inline-flex items-center gap-1 leading-none mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                {isWhatsAppMode ? t("orders.whatsappOrdering") : `${t("orders.dineIn")} • ${t("orders.table")} ${tableNumber}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60 shadow-inner">
              {(["de", "ar", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`h-6 px-2.5 rounded-lg text-[9px] font-bold uppercase transition-all duration-200 select-none cursor-pointer ${
                    language === lang 
                      ? "bg-orange-500 text-white shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 flex flex-col gap-5">
        
        {/* Welcome greeting card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-orange-950/40 border border-orange-500/10 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex items-center gap-4 animate-scale-in">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>
          <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-2xl text-orange-400 rotate-[-8deg] shrink-0 animate-pulse-subtle shadow-inner">
            {isWhatsAppMode ? <MessageSquare size={28} /> : <Utensils size={28} />}
          </div>
          
          <div className="leading-tight space-y-1 relative z-10">
            <span className="text-[9px] font-bold tracking-widest text-orange-400/90 uppercase block font-mono">
              {restaurantName.toUpperCase()} • Authentic Grill
            </span>
            <h3 className="font-bold text-sm text-slate-100">
              {isWhatsAppMode 
                ? (language === "ar" ? "اختر وجباتك المفضلة وسنرسلها لواتساب" : "Stellen Sie Ihre Bestellung zusammen")
                : (language === "ar" ? "اطلب طعامك طازجاً من طاولتك" : "Bestellen Sie direkt am Tisch")}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              {isWhatsAppMode
                ? (language === "ar" 
                  ? "تصفح قائمتنا الشامية المميزة، اختر وجباتك، وسنقوم بمزامنتها مع محادثة واتساب لإتمام الطلب." 
                  : "Wählen Sie Ihre Lieblingsgerichte und wir synchronisieren sie direkt mit Ihrem WhatsApp-Chat.")
                : (language === "ar" 
                  ? "تصفح قائمتنا الشامية المميزة وسيتم تحضير وجبتك وتقديمها فوراً." 
                  : "Wählen Sie Ihre Lieblingsgerichte, wir bringen sie frisch zubereitet an Ihren Tisch.")}
            </p>
          </div>
        </div>

        {/* Categories Tab slider */}
        <div className="sticky top-[69px] z-30 bg-stone-50/95 backdrop-blur-md py-3.5 -mx-4 px-4 overflow-x-auto flex gap-2 scrollbar-none select-none border-b border-stone-200/30">
          <button
            onClick={() => handleCategoryClick("all")}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 border select-none active:scale-95 ${
              activeCategory === "all"
                ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                : "bg-white border-stone-200/80 text-neutral-500 hover:bg-stone-100/50 hover:text-neutral-700"
            }`}
          >
            {language === "ar" ? "كل الأصناف" : "Alle Speisen"}
          </button>
          
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 border select-none active:scale-95 ${
                activeCategory === cat.id
                  ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-white border-stone-200/80 text-neutral-500 hover:bg-stone-100/50 hover:text-neutral-700"
              }`}
            >
              {text(cat.name)}
            </button>
          ))}
        </div>

        {/* Items Listing grouped by categories */}
        <div className="space-y-6">
          {categories.map((category) => {
            const itemsInCategory = menuItems.filter(
              (item) => item.categoryId === category.id && item.isActive !== false
            );

            if (itemsInCategory.length === 0) return null;

            return (
              <div key={category.id} id={`cat-section-${category.id}`} className="space-y-3 Scroll-mt-24">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 border-b border-stone-200/60 pb-1 flex justify-between items-center">
                  <span>{text(category.name)}</span>
                  <span className="text-[10px] font-normal font-serif capitalize italic text-neutral-400">
                    {text(category.description)}
                  </span>
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {itemsInCategory.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white rounded-2xl border border-stone-200/60 p-3.5 flex gap-4 shadow-xs hover:shadow-md hover:border-orange-500/10 hover:scale-[1.015] active:scale-[0.995] transition-all duration-300 cursor-pointer group"
                      onClick={() => handleOpenModifiers(item)}
                    >
                      {/* Product image */}
                      {item.image ? (
                        <div className="relative w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-stone-50 border border-stone-100">
                          <img 
                            src={item.image} 
                            alt={text(item.name)} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          {item.isBestSeller && (
                            <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm flex items-center gap-0.5">
                              <Flame size={8} /> HOT
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-stone-50 to-stone-100/80 border border-stone-200/30 flex items-center justify-center text-stone-300">
                          <Utensils size={24} />
                          {item.isBestSeller && (
                            <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm flex items-center gap-0.5">
                              <Flame size={8} /> HOT
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Content details */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-neutral-900 group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                            {text(item.name)}
                            {item.isBestSeller && !item.image && (
                              <span className="text-[8px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0">
                                🔥 Bestseller
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-2 pr-1">
                            {text(item.description)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-stone-100/80">
                          <div className="flex items-baseline gap-0.5">
                            <span className="font-bold text-xs text-orange-600 font-mono">
                              {item.basePrice.toFixed(2)}
                            </span>
                            <span className="text-[9px] font-bold text-orange-500 font-mono">
                              {currency.symbol}
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(item);
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-1.5 px-3.5 text-[10px] font-extrabold flex items-center gap-1 transition-all duration-200 shadow-xs hover:shadow-md active:scale-90 select-none cursor-pointer"
                          >
                            <Plus size={11} className="stroke-[3px]" />
                            {language === "ar" ? "أضف" : "Hinzufügen"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Persistent Bottom Cart Trigger Sheet */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 shadow-2xl z-40 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-orange-100 text-orange-600 rounded-lg p-2 relative">
                <ShoppingBag size={18} />
                <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <div className="leading-tight text-left">
                <span className="text-[10px] text-neutral-400 font-bold block uppercase">{t("orders.liveQueue")}</span>
                <span className="text-xs font-bold text-neutral-900 font-mono">
                  {getCheckoutTotal().toFixed(2)}{currency.symbol}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer active:scale-95"
            >
              {language === "ar" ? "استعراض السلة" : "Warenkorb ansehen"}
              <ChevronRight size={14} className={dir === "rtl" ? "rotate-180" : ""} />
            </button>
          </div>
        </div>
      )}

      {/* 8. Premium Product Detail Modal */}
      {selectedItemForMod && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-50 flex items-end justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl rounded-b-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-stone-100">
            
            {/* Cover Image Header */}
            {selectedItemForMod.image ? (
              <div className="relative w-full h-48 bg-stone-50 shrink-0 border-b border-stone-100">
                <img 
                  src={selectedItemForMod.image} 
                  alt={text(selectedItemForMod.name)} 
                  className="w-full h-full object-cover" 
                />
                <button 
                  onClick={() => setSelectedItemForMod(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/60 text-white flex items-center justify-center font-bold text-sm hover:bg-slate-950/80 transition cursor-pointer"
                >
                  ✕
                </button>
                {selectedItemForMod.isBestSeller && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shadow-md">
                    <Flame size={8} /> {language === "ar" ? "الأكثر طلباً" : "HOT"}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full h-12 bg-stone-50 shrink-0 border-b border-stone-150 flex items-center justify-between px-4">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  {language === "ar" ? "تفاصيل الوجبة" : "Details"}
                </span>
                <button 
                  onClick={() => setSelectedItemForMod(null)}
                  className="w-6 h-6 rounded-full bg-stone-200 text-neutral-600 flex items-center justify-center font-bold text-xs hover:bg-stone-300 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Title & Info Header */}
            <div className="p-4 border-b border-stone-100 flex justify-between items-start bg-stone-50 shrink-0">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
                  {text(selectedItemForMod.name)}
                  {selectedItemForMod.isBestSeller && !selectedItemForMod.image && (
                    <span className="text-[8px] bg-red-550/10 text-red-600 border border-red-200/50 px-1.5 py-0.5 rounded font-extrabold">
                      🔥 {language === "ar" ? "الأكثر طلباً" : "HOT"}
                    </span>
                  )}
                </h3>
                <span className="text-xs font-mono text-brand-primary font-bold block">
                  {selectedItemForMod.basePrice.toFixed(2)}{currency.symbol}
                </span>
              </div>
            </div>

            {/* Scrollable details body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Description box */}
              {text(selectedItemForMod.description) && (
                <p className="text-xs text-neutral-500 leading-relaxed bg-stone-50 border border-stone-200/50 p-3 rounded-xl">
                  {text(selectedItemForMod.description)}
                </p>
              )}

              {/* Modifier options selection */}
              {(selectedItemForMod.modifierGroups || []).map((group) => (
                <div key={group.id} className="space-y-2 border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      {text(group.name)}
                      {group.isRequired && (
                        <span className="text-[8px] bg-red-50 text-red-650 border border-red-150 px-1.5 py-0.5 rounded font-extrabold uppercase">
                          {language === "ar" ? "إجباري" : "Erforderlich"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-neutral-450 font-bold">
                      {group.type === "single" 
                        ? (language === "ar" ? "اختر واحداً" : "Wählen Sie 1") 
                        : (group.maxSelections ? `${language === "ar" ? "حد أقصى" : "Max"} ${group.maxSelections}` : "")
                      }
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {group.options.map((opt) => {
                      const selected = (modSelections[group.id] || []).some(o => o.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectModifier(group, opt)}
                          className={`p-3 rounded-xl border text-xs font-semibold text-left flex justify-between items-center transition cursor-pointer select-none ${
                            selected 
                              ? "border-brand-primary bg-brand-primary/5 text-neutral-900 font-bold" 
                              : "border-stone-200 bg-white text-neutral-650 hover:bg-stone-50"
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              selected ? "border-brand-primary bg-brand-primary text-white" : "border-stone-300"
                            }`}>
                              {selected && <Check size={10} className="stroke-[3px]" />}
                            </span>
                            {text(opt.name)}
                          </span>
                          {opt.priceAdjustment > 0 && (
                            <span className="font-mono text-[10px] font-bold text-brand-primary">
                              +{opt.priceAdjustment.toFixed(2)}{currency.symbol}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quantity Adjuster */}
              <div className="flex items-center justify-between border-t border-stone-100 pt-4">
                <span className="text-xs font-bold text-neutral-800">{language === "ar" ? "الكمية" : "Menge"}</span>
                <div className="flex items-center bg-stone-50 border border-stone-200 rounded-xl p-1 gap-3">
                  <button 
                    onClick={() => setModQuantity(q => Math.max(1, q - 1))}
                    className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                  >
                    <Minus size={11} className="stroke-[3px]" />
                  </button>
                  <span className="font-mono font-bold text-xs min-w-4 text-center">{modQuantity}</span>
                  <button 
                    onClick={() => setModQuantity(q => q + 1)}
                    className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                  >
                    <Plus size={11} className="stroke-[3px]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Add Action */}
            <div className="p-4 border-t border-stone-100 bg-stone-50 shrink-0">
              <button 
                onClick={handleAddToCart}
                className="w-full bg-brand-primary hover:bg-brand-primary/95 text-white font-bold py-3.5 rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{language === "ar" ? "إضافة إلى السلة" : "In den Warenkorb"}</span>
                <span className="w-1 h-1 bg-white/40 rounded-full font-mono"></span>
                <span>{((selectedItemForMod.basePrice + getSelectedModsAdjustment()) * modQuantity).toFixed(2)}{currency.symbol}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer Dialog Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50 select-none">
              <div className="flex items-center gap-1.5">
                <ShoppingBag size={16} className="text-orange-500" />
                <h3 className="font-bold text-sm text-neutral-900">{language === "ar" ? "سلة طلباتك" : "Ihr Warenkorb"}</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 bg-white border border-stone-200 rounded-lg text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.map((item, idx) => (
                <div key={idx} className="p-3 bg-stone-50 border border-stone-200/50 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">{text(item.name)}</h4>
                      {(item.selectedModifiers || [])
                        .filter((m: any) => m && typeof m === "object")
                        .map((m: any, mIdx: number) => {
                          const groupNameText = m.groupName ? text(m.groupName) : "";
                          const optionNameText = m.option?.name ? text(m.option.name) : "";
                          if (!groupNameText && !optionNameText) return null;
                          return (
                            <span key={mIdx} className="text-[10px] text-neutral-400 block mt-0.5">
                              └ {groupNameText}: {optionNameText}
                            </span>
                          );
                        })}
                      {item.selectedUpsell && (
                        <span className="text-[10px] text-amber-600 font-bold block mt-1">
                          └ ⚡ {t("orders.combo")}: {text(item.selectedUpsell.name)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-neutral-900">
                      {item.totalPrice.toFixed(2)}{currency.symbol}
                    </span>
                  </div>

                  {/* Quantity & Remove operations */}
                  <div className="flex justify-between items-center border-t border-stone-200/30 pt-2.5 mt-0.5">
                    <span className="text-[10px] text-neutral-400 font-semibold">{language === "ar" ? "الكمية" : "Menge"}</span>
                    <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5 gap-2.5">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="p-1 text-neutral-500 hover:text-red-500 transition active:scale-90"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="font-mono font-bold text-xs min-w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="p-1 text-neutral-500 hover:text-orange-500 transition active:scale-90"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Checkout details Form */}
              {!isWhatsAppMode && (
                <div className="border-t border-stone-100 pt-4 space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                    {language === "ar" ? "بيانات الدفع والاستلام" : "Angaben zur Abrechnung"}
                  </h4>
                  
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1 font-medium">
                        {language === "ar" ? "اسم الضيف (اختياري)" : "Name des Gastes (Optional)"}
                      </label>
                      <input
                        type="text"
                        placeholder={language === "ar" ? "مثال: أحمد" : "z.B. Alex"}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-orange-500 bg-stone-50"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1 font-medium">
                        {language === "ar" ? "رقم الهاتف (اختياري)" : "Telefonnummer (Optional)"}
                      </label>
                      <input
                        type="tel"
                        placeholder="+49..."
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-orange-500 bg-stone-50"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1 font-medium">
                        {language === "ar" ? "ملاحظات خاصة للمطبخ" : "Hinweise für das Küchenteam"}
                      </label>
                      <textarea
                        placeholder={language === "ar" ? "مثال: بدون فلفل حار..." : "z.B. Keine Zwiebeln..."}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-orange-500 bg-stone-50 h-16 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Checkout Footer */}
            <div className="p-4 border-t border-stone-100 bg-stone-50 space-y-3">
              <div className="flex justify-between items-center text-xs text-neutral-800 font-semibold px-1">
                <span>{language === "ar" ? "إجمالي الفاتورة" : "Rechnungssumme"}</span>
                <span className="font-mono text-sm font-bold text-orange-600">
                  {getCheckoutTotal().toFixed(2)}{currency.symbol}
                </span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-stone-300 text-white text-xs font-bold py-3.5 rounded-xl transition shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    {t("common.loading")}
                  </>
                ) : (
                  <>
                    {isWhatsAppMode ? <MessageSquare size={14} /> : <Utensils size={14} />}
                    {isWhatsAppMode 
                      ? t("orders.sendCartToWhatsApp") 
                      : (language === "ar" ? "تأكيد وإرسال الطلب للمطبخ" : "Bestellung in die Küche schicken")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upsell Intercept Drawer Dialog */}
      {pendingUpsellItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6 text-center animate-slide-up space-y-4">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-100 animate-bounce">
              <Sparkles size={22} />
            </div>

            <div className="space-y-1.5 select-none">
              <h3 className="font-bold text-sm text-neutral-900">
                {language === "ar" ? "ترقية وجبة كومبو مذهلة!" : "Combo-Upgrade verfügbar!"}
              </h3>
              <p className="text-[11px] text-neutral-400 leading-snug">
                {language === "ar" 
                  ? `هل ترغب في إضافة *${text(pendingUpsellItem.upsell.suggestedItemName)}* مقابل +${pendingUpsellItem.upsell.price.toFixed(2)}€ فقط؟`
                  : `Möchten Sie *${text(pendingUpsellItem.upsell.suggestedItemName)}* für nur +${pendingUpsellItem.upsell.price.toFixed(2)} € hinzufügen?`}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleApplyUpsell(false)}
                className="flex-1 py-2.5 border border-stone-200 hover:bg-neutral-50 text-xs font-bold text-neutral-600 rounded-xl transition cursor-pointer active:scale-95"
              >
                {language === "ar" ? "لا، شكراً" : "Nein, danke"}
              </button>
              <button
                onClick={() => handleApplyUpsell(true)}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer active:scale-95"
              >
                {language === "ar" ? "نعم، أضف للوجبة" : "Ja, hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
