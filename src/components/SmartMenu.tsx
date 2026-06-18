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

type LocalCopy = Record<"de" | "ar" | "en" | "tr", string>;

export default function SmartMenu({ tableNumber, branchId, convoId }: SmartMenuProps) {
  const { language, setLanguage, t, text, dir } = useI18n();
  const copy = (values: LocalCopy) => values[language] || values.de;
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
  const [heroTagline, setHeroTagline] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncedSuccess, setIsSyncedSuccess] = useState(false);
  const [syncedTotal, setSyncedTotal] = useState<number>(0);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [showImprintModal, setShowImprintModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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
  const [upcomingReservation, setUpcomingReservation] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // Service Request State (Call Waiter / Request Bill)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isServiceSubmitting, setIsServiceSubmitting] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState<string | null>(null);
  const [activeServiceRequests, setActiveServiceRequests] = useState<string[]>([]);

  // Load upcoming table reservation conflicts
  useEffect(() => {
    if (tableNumber && branchId) {
      fetch(`/api/public/tables/upcoming-reservation?branchId=${branchId}&tableNumber=${tableNumber}`)
        .then((res) => res.json())
        .then((data) => setUpcomingReservation(data.upcoming || null))
        .catch((err) => console.error("Failed to load upcoming table reservation:", err));
    }
  }, [tableNumber, branchId]);

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
            setRestaurant(data.restaurant);
            setRestaurantName(data.restaurant.name || "MR. Tabboush");
            setLogoUrl(data.restaurant.logo || "");
            setHeroTagline(data.restaurant.heroTagline || null);
            setBrandStyles({
              "--brand-primary": data.restaurant.primaryColor || "#ea580c",
              "--brand-secondary": data.restaurant.secondaryColor || "#1f2937",
            } as React.CSSProperties);
            if (data.restaurant.name) {
              document.title = `${data.restaurant.name} - Smart Menu`;
            }
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
          alert(copy({
            ar: `الرجاء تحديد الخيارات المطلوبة لـ ${text(group.name)}`,
            de: `Bitte wählen Sie Optionen für ${text(group.name)}`,
            en: `Please choose the required options for ${text(group.name)}`,
            tr: `Lütfen ${text(group.name)} için gerekli seçenekleri seçin`,
          }));
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
      const duplicateIdx = prev.findIndex((i) => {
        if (i.itemId !== cartItem.itemId) return false;
        if (i.selectedModifiers?.length !== cartItem.selectedModifiers?.length) return false;
        
        const m1 = i.selectedModifiers || [];
        const m2 = cartItem.selectedModifiers || [];
        return m1.every((mod) => m2.some((m) => m.option.id === mod.option.id));
      });

      let nextCart;
      if (duplicateIdx >= 0) {
        nextCart = [...prev];
        nextCart[duplicateIdx].quantity += cartItem.quantity;
        const modAdj = nextCart[duplicateIdx].selectedModifiers.reduce((sum, m) => sum + (m.option.priceAdjustment || 0), 0);
        nextCart[duplicateIdx].totalPrice = (nextCart[duplicateIdx].basePrice + modAdj) * nextCart[duplicateIdx].quantity;
      } else {
        nextCart = [...prev, cartItem];
      }
      
      // Look for active upsells
      const activeUpsell = selectedItemForMod.upsellSuggestions.find((u) => u.isActive !== false);
      if (activeUpsell) {
        // Intercept checkout after closing modal
        const targetIndex = duplicateIdx >= 0 ? duplicateIdx : nextCart.length - 1;
        setTimeout(() => {
          setPendingUpsellItem({
            cartIndex: targetIndex,
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
        const duplicateIdx = prev.findIndex((i) => {
          if (i.itemId !== cartItem.itemId) return false;
          if (i.selectedModifiers?.length !== cartItem.selectedModifiers?.length) return false;
          
          const m1 = i.selectedModifiers || [];
          const m2 = cartItem.selectedModifiers || [];
          return m1.every((mod) => m2.some((m) => m.option.id === mod.option.id));
        });

        let nextCart;
        if (duplicateIdx >= 0) {
          nextCart = [...prev];
          nextCart[duplicateIdx].quantity += cartItem.quantity;
          nextCart[duplicateIdx].totalPrice = nextCart[duplicateIdx].basePrice * nextCart[duplicateIdx].quantity;
        } else {
          nextCart = [...prev, cartItem];
        }

        const activeUpsell = item.upsellSuggestions.find((u) => u.isActive !== false);
        if (activeUpsell) {
          const targetIndex = duplicateIdx >= 0 ? duplicateIdx : nextCart.length - 1;
          setPendingUpsellItem({
            cartIndex: targetIndex,
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
          setSyncedTotal(getCheckoutTotal());
          setIsSyncedSuccess(true);
          setCart([]);
          setIsCartOpen(false);
        } else {
          const errorData = await response.json();
          alert(errorData.error || copy({
            ar: "تعذرت مزامنة السلة مع واتساب.",
            de: "Der Warenkorb konnte nicht mit WhatsApp synchronisiert werden.",
            en: "Failed to sync cart with WhatsApp.",
            tr: "Sepet WhatsApp ile senkronize edilemedi.",
          }));
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
          alert(errorData.error || copy({
            ar: "تعذر إرسال الطلب.",
            de: "Die Bestellung konnte nicht übermittelt werden.",
            en: "Failed to submit order.",
            tr: "Sipariş gönderilemedi.",
          }));
        }
      }
    } catch (err) {
      console.error(err);
      alert(copy({
        ar: "فشل الإرسال بسبب مشكلة في الاتصال.",
        de: "Übermittlung fehlgeschlagen. Verbindungsproblem.",
        en: "Submission failed. Connection issue.",
        tr: "Gönderim başarısız. Bağlantı sorunu.",
      }));
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
      if (type === "waiter") msg = copy({
        ar: "تم إرسال نداء للنادل، سيصلك في أقرب وقت!",
        de: "Der Service wurde gerufen! Ein Kellner kommt gleich.",
        en: "Service summoned! A waiter will be with you shortly.",
        tr: "Garson çağrıldı! Kısa süre içinde masanıza gelecek.",
      });
      else if (type === "bill") msg = copy({
        ar: "تم طلب الفاتورة، سيحضرها النادل لطاولتك!",
        de: "Die Rechnung wurde angefordert! Der Kellner bringt sie an Ihren Tisch.",
        en: "Bill requested! A waiter will bring it to your table.",
        tr: "Hesap istendi! Garson masanıza getirecek.",
      });
      else if (type === "water") msg = copy({
        ar: "تم طلب الماء، سيصلك قريباً!",
        de: "Wasser wurde angefordert! Wird gleich serviert.",
        en: "Water requested! Serving shortly.",
        tr: "Su istendi! Kısa süre içinde servis edilecek.",
      });
      else msg = copy({
        ar: "تم إرسال طلب الخدمة بنجاح!",
        de: "Service-Anfrage erfolgreich übermittelt!",
        en: "Service request sent successfully!",
        tr: "Servis isteği başarıyla gönderildi!",
      });

      setServiceSuccessMsg(msg);
      setActiveServiceRequests((prev) => [...prev, type]);

      // Close the modal after a short delay and clear message
      setTimeout(() => {
        setIsServiceModalOpen(false);
        setServiceSuccessMsg(null);
      }, 3000);
    } catch (err) {
      console.error("Failed to summon service:", err);
      alert(copy({
        ar: "تعذر إرسال طلب الخدمة.",
        de: "Die Service-Anfrage konnte nicht gesendet werden.",
        en: "Failed to send service request.",
        tr: "Servis isteği gönderilemedi.",
      }));
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
                {syncedTotal.toFixed(2)}{currency.symbol}
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
              {copy({
                ar: "تم إرسال طلبك بنجاح!",
                de: "Bestellung erfolgreich übermittelt!",
                en: "Order sent successfully!",
                tr: "Sipariş başarıyla gönderildi!",
              })}
            </h2>
            <p className="text-[11px] text-neutral-400 mt-2 max-w-xs mx-auto leading-relaxed">
              {copy({
                ar: `طلبك رقم ${orderNum} تم إرساله مباشرة لمطبخ المطعم للتحضير.`,
                de: `Ihre Bestellnummer ist ${orderNum}. Sie wurde direkt in die Küche übertragen.`,
                en: `Your order number is ${orderNum}. It was sent directly to the kitchen for preparation.`,
                tr: `Sipariş numaranız ${orderNum}. Hazırlanması için doğrudan mutfağa gönderildi.`,
              })}
            </p>

            {/* Total Paid Stamp */}
            <div className="mt-4 p-2 px-3.5 bg-stone-50 border border-stone-200/50 rounded-2xl inline-flex items-center gap-2 text-[11px] text-neutral-600 font-semibold shadow-xs">
              <span>{t("common.total")}:</span>
              <span className="text-orange-600 font-bold font-mono text-xs">
                {placedOrder.total.toFixed(2)}{currency.symbol}
              </span>
              <span className="text-[9px] uppercase bg-stone-200 text-neutral-700 px-2 py-0.5 rounded-md font-bold tracking-wider">
                {copy({ ar: "دفع عند الطاولة", de: "Zahlung am Tisch", en: "Pay at Table", tr: "Masada Ödeme" })}
              </span>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="bg-white rounded-2xl border border-stone-200/50 p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-2">
              <Clock size={14} className="text-orange-500" />
              {copy({ ar: "حالة تحضير الطلب", de: "Zubereitungsstatus", en: "Preparation Status", tr: "Hazırlık Durumu" })}
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
                      {copy({
                        ar: "تم استلام الطلب وتأكيده بالكامل",
                        de: "Bestellung empfangen und bestätigt",
                        en: "Order received and confirmed",
                        tr: "Sipariş alındı ve onaylandı",
                      })}
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
                      {copy({
                        ar: "وجبتك تحضّر الآن طازجة في المطبخ",
                        de: "Wird frisch in der Küche zubereitet",
                        en: "Your meal is being freshly prepared in the kitchen",
                        tr: "Yemeğiniz mutfakta taze olarak hazırlanıyor",
                      })}
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
                      {copy({
                        ar: "وجبتك جاهزة وسيقوم النادل بتقديمها فوراً",
                        de: "Gerichte fertig zum Servieren",
                        en: "Your meal is ready and will be served shortly",
                        tr: "Yemeğiniz hazır ve kısa süre içinde servis edilecek",
                      })}
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
                      {copy({
                        ar: "بالهناء والشفاء! نتمنى أن تنال وجبتنا إعجابك",
                        de: "Guten Appetit! Genießen Sie Ihr Essen",
                        en: "Enjoy your meal! We hope you love it",
                        tr: "Afiyet olsun! Umarız yemeğimizi beğenirsiniz",
                      })}
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
                {copy({ ar: "خدمة الطاولة المباشرة", de: "TISCHSERVICE", en: "DINE-IN SERVICE", tr: "MASA SERVİSİ" })}
              </span>
              <h4 className="text-xs font-bold">
                {copy({ ar: "بحاجة لمساعدة أو طلب الخدمة؟", de: "Unterstützung am Tisch?", en: "Need help at the table?", tr: "Masada yardıma mı ihtiyacınız var?" })}
              </h4>
              <p className="text-[9px] text-slate-400">
                {copy({
                  ar: "اطلب النادل، ماء، أو الفاتورة بضغطة واحدة",
                  de: "Kellner rufen, Wasser oder Rechnung anfordern",
                  en: "Call a waiter, request water, or ask for the bill",
                  tr: "Garson çağırın, su veya hesap isteyin",
                })}
              </p>
            </div>
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold px-4 py-2 rounded-xl transition shadow active:scale-95 shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Bell size={12} className="animate-pulse" />
              {copy({ ar: "طلب الخدمة", de: "Service rufen", en: "Call Service", tr: "Servis İste" })}
            </button>
          </div>

          {/* Order Details list for verification */}
          <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm text-xs space-y-2.5">
            <h4 className="font-bold text-neutral-900 pb-1.5 border-b border-stone-100 flex justify-between items-center">
              <span>{copy({ ar: "تفاصيل الطلب", de: "Bestelldetails", en: "Order Details", tr: "Sipariş Detayları" })}</span>
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
            {copy({ ar: "طلب أطباق أخرى", de: "Weitere Gerichte bestellen", en: "Order More Items", tr: "Başka Ürünler Sipariş Et" })}
          </button>
        </main>

        <footer className="py-4 text-center text-[9px] text-neutral-400 border-t border-stone-200/40 mt-auto bg-stone-100 select-none flex flex-col gap-1.5 items-center justify-center">
          <div>{restaurantName.toUpperCase()} SMART TABLE MENU</div>
          <div className="flex gap-3 text-[10px] text-neutral-500 font-light">
            <button onClick={() => setShowImprintModal(true)} className="hover:text-slate-900 transition cursor-pointer bg-transparent border-none p-0 outline-none">{copy({ ar: "إخلاء المسؤولية", de: "Impressum", en: "Imprint", tr: "Künye" })}</button>
            <span>•</span>
            <button onClick={() => setShowPrivacyModal(true)} className="hover:text-slate-900 transition cursor-pointer bg-transparent border-none p-0 outline-none">{copy({ ar: "الخصوصية", de: "Datenschutz", en: "Privacy Policy", tr: "Gizlilik Politikası" })}</button>
          </div>
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
                    {copy({ ar: "نداء الخدمة", de: "Service anfordern", en: "Service Request", tr: "Servis Çağrısı" })}
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
                      {copy({
                        ar: "اختر نوع الخدمة التي تحتاجها، وسيقوم أحد موظفينا بتلبيتك فوراً.",
                        de: "Wählen Sie Ihren Wunsch. Unser Team wird Sie umgehend am Tisch bedienen.",
                        en: "Choose the service you need and our team will come to your table shortly.",
                        tr: "İhtiyacınız olan servisi seçin; ekibimiz kısa süre içinde masanıza gelecektir.",
                      })}
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {[
                        {
                          id: "waiter",
                          icon: <Bell size={20} />,
                          labelDE: "Kellner rufen",
                          labelAR: "نداء النادل",
                          labelEN: "Call Waiter",
                          labelTR: "Garson Çağır",
                        },
                        {
                          id: "bill",
                          icon: <FileText size={20} />,
                          labelDE: "Rechnung bitten",
                          labelAR: "طلب الفاتورة",
                          labelEN: "Request Bill",
                          labelTR: "Hesap İste",
                        },
                        {
                          id: "water",
                          icon: <Droplet size={20} />,
                          labelDE: "Wasser bitten",
                          labelAR: "طلب ماء",
                          labelEN: "Request Water",
                          labelTR: "Su İste",
                        },
                        {
                          id: "custom",
                          icon: <MessageSquare size={20} />,
                          labelDE: "Anderer Wunsch",
                          labelAR: "خدمة أخرى",
                          labelEN: "Other Request",
                          labelTR: "Diğer Servis",
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
                                ? copy({ ar: "تم الإرسال", de: "Gesendet", en: "Sent", tr: "Gönderildi" })
                                : (language === "ar" ? srv.labelAR : language === "tr" ? srv.labelTR : language === "en" ? srv.labelEN : srv.labelDE)
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
              {(restaurant?.supportedLanguages && restaurant.supportedLanguages.length > 0
                ? restaurant.supportedLanguages
                : ["de", "ar", "en", "tr"]
              ).map((lang: any) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang as any)}
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
        
        {/* Table Reservation Conflict Warning */}
        {upcomingReservation && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 shadow-sm flex items-start gap-3 animate-scale-in text-left">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="space-y-1 text-xs">
              <h4 className="font-bold">
                {copy({ ar: "تنبيه طاولة محجوزة", de: "Tisch reserviert", en: "Upcoming Table Reservation", tr: "Yaklaşan Masa Rezervasyonu" })}
              </h4>
              <p className="text-amber-800 leading-relaxed">
                {t("smartMenu.tableReservedWarning", {
                  time: new Date(upcomingReservation.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                })}
              </p>
            </div>
          </div>
        )}

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
              {restaurantName.toUpperCase()} {heroTagline ? `• ${text(heroTagline)}` : ""}
            </span>
            <h3 className="font-bold text-sm text-slate-100">
              {isWhatsAppMode 
                ? t("smartMenu.welcome.whatsapp.title")
                : t("smartMenu.welcome.dineIn.title")}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              {isWhatsAppMode
                ? t("smartMenu.welcome.whatsapp.desc")
                : t("smartMenu.welcome.dineIn.desc")}
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
            {copy({ ar: "كل الأصناف", de: "Alle Speisen", en: "All Items", tr: "Tüm Ürünler" })}
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
                              <Flame size={8} /> {copy({ ar: "الأكثر طلباً", de: "Beliebt", en: "Popular", tr: "Popüler" })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-stone-50 to-stone-100/80 border border-stone-200/30 flex items-center justify-center text-stone-300">
                          <Utensils size={24} />
                          {item.isBestSeller && (
                            <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm flex items-center gap-0.5">
                              <Flame size={8} /> {copy({ ar: "الأكثر طلباً", de: "Beliebt", en: "Popular", tr: "Popüler" })}
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
                                🔥 {copy({ ar: "الأكثر طلباً", de: "Bestseller", en: "Bestseller", tr: "En Çok Satan" })}
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
                            {copy({ ar: "أضف", de: "Hinzufügen", en: "Add", tr: "Ekle" })}
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
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer active:scale-95"
            >
              {copy({ ar: "استعراض السلة", de: "Warenkorb ansehen", en: "View Cart", tr: "Sepeti Gör" })}
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
                    <Flame size={8} /> {copy({ ar: "الأكثر طلباً", de: "Beliebt", en: "Popular", tr: "Popüler" })}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full h-12 bg-stone-50 shrink-0 border-b border-stone-150 flex items-center justify-between px-4">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  {copy({ ar: "تفاصيل الوجبة", de: "Details", en: "Details", tr: "Detaylar" })}
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
                      🔥 {copy({ ar: "الأكثر طلباً", de: "Beliebt", en: "Popular", tr: "Popüler" })}
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
                          {copy({ ar: "إجباري", de: "Erforderlich", en: "Required", tr: "Zorunlu" })}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-neutral-450 font-bold">
                      {group.type === "single" 
                        ? copy({ ar: "اختر واحداً", de: "Wählen Sie 1", en: "Choose one", tr: "Birini seçin" })
                        : (group.maxSelections ? `${copy({ ar: "حد أقصى", de: "Max", en: "Max", tr: "Maks" })} ${group.maxSelections}` : "")
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
                <span className="text-xs font-bold text-neutral-800">{copy({ ar: "الكمية", de: "Menge", en: "Quantity", tr: "Miktar" })}</span>
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
                <span>{copy({ ar: "إضافة إلى السلة", de: "In den Warenkorb", en: "Add to Cart", tr: "Sepete Ekle" })}</span>
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
                <h3 className="font-bold text-sm text-neutral-900">{copy({ ar: "سلة طلباتك", de: "Ihr Warenkorb", en: "Your Cart", tr: "Sepetiniz" })}</h3>
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
                    <span className="text-[10px] text-neutral-400 font-semibold">{copy({ ar: "الكمية", de: "Menge", en: "Quantity", tr: "Miktar" })}</span>
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
                    {copy({ ar: "بيانات الدفع والاستلام", de: "Angaben zur Abrechnung", en: "Payment & Pickup Details", tr: "Ödeme ve Teslim Alma Bilgileri" })}
                  </h4>
                  
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1 font-medium">
                        {copy({ ar: "اسم الضيف (اختياري)", de: "Name des Gastes (Optional)", en: "Guest Name (Optional)", tr: "Misafir Adı (İsteğe Bağlı)" })}
                      </label>
                      <input
                        type="text"
                        placeholder={copy({ ar: "مثال: أحمد", de: "z.B. Alex", en: "e.g. Alex", tr: "örn. Ahmet" })}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-orange-500 bg-stone-50"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1 font-medium">
                        {copy({ ar: "رقم الهاتف (اختياري)", de: "Telefonnummer (Optional)", en: "Phone Number (Optional)", tr: "Telefon Numarası (İsteğe Bağlı)" })}
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
                        {copy({ ar: "ملاحظات خاصة للمطبخ", de: "Hinweise für das Küchenteam", en: "Special Notes for the Kitchen", tr: "Mutfak İçin Özel Notlar" })}
                      </label>
                      <textarea
                        placeholder={copy({ ar: "مثال: بدون فلفل حار...", de: "z.B. Keine Zwiebeln...", en: "e.g. No onions...", tr: "örn. Acısız..." })}
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
                <span>{copy({ ar: "إجمالي الفاتورة", de: "Rechnungssumme", en: "Bill Total", tr: "Fatura Toplamı" })}</span>
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
                      : copy({ ar: "تأكيد وإرسال الطلب للمطبخ", de: "Bestellung in die Küche schicken", en: "Send Order to Kitchen", tr: "Siparişi Mutfağa Gönder" })}
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
                {copy({ ar: "ترقية وجبة كومبو مذهلة!", de: "Combo-Upgrade verfügbar!", en: "Combo Upgrade Available!", tr: "Harika Combo Yükseltmesi!" })}
              </h3>
              <p className="text-[11px] text-neutral-400 leading-snug">
                {copy({
                  ar: `هل ترغب في إضافة *${text(pendingUpsellItem.upsell.suggestedItemName)}* مقابل +${pendingUpsellItem.upsell.price.toFixed(2)}€ فقط؟`,
                  de: `Möchten Sie *${text(pendingUpsellItem.upsell.suggestedItemName)}* für nur +${pendingUpsellItem.upsell.price.toFixed(2)} € hinzufügen?`,
                  en: `Would you like to add *${text(pendingUpsellItem.upsell.suggestedItemName)}* for only +${pendingUpsellItem.upsell.price.toFixed(2)} €?`,
                  tr: `*${text(pendingUpsellItem.upsell.suggestedItemName)}* ürününü yalnızca +${pendingUpsellItem.upsell.price.toFixed(2)} € karşılığında eklemek ister misiniz?`,
                })}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleApplyUpsell(false)}
                className="flex-1 py-2.5 border border-stone-200 hover:bg-neutral-50 text-xs font-bold text-neutral-600 rounded-xl transition cursor-pointer active:scale-95"
              >
                {copy({ ar: "لا، شكراً", de: "Nein, danke", en: "No, thanks", tr: "Hayır, teşekkürler" })}
              </button>
              <button
                onClick={() => handleApplyUpsell(true)}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer active:scale-95"
              >
                {copy({ ar: "نعم، أضف للوجبة", de: "Ja, hinzufügen", en: "Yes, add", tr: "Evet, ekle" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impressum Modal */}
      {showImprintModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-neutral-100 flex flex-col relative animate-fade-in text-neutral-800">
            <h3 className="font-serif font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
              <span>{copy({ ar: "إخلاء المسؤولية", de: "Impressum", en: "Imprint", tr: "Künye" })}</span>
              <button 
                onClick={() => setShowImprintModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-sans font-bold cursor-pointer bg-transparent border-none p-0"
              >
                ✕
              </button>
            </h3>
            
            <div className="text-xs text-slate-700 space-y-4 leading-relaxed font-sans text-left">
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "معلومات وفقاً للمادة 5 DDG", de: "Angaben gemäß § 5 DDG", en: "Information according to Section 5 DDG", tr: "DDG Madde 5 uyarınca bilgiler" })}
                </h4>
                <p className="font-medium text-slate-800">{restaurant?.legalName || restaurant?.name || restaurantName}</p>
                <p>{restaurant?.address || "Berliner Str. 179, 42277 Wuppertal"}</p>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "يمثله", de: "Vertreten durch", en: "Represented by", tr: "Temsil eden" })}
                </h4>
                <p>{copy({ ar: "إدارة المطعم", de: "Geschäftsführung", en: "Restaurant Management", tr: "Restoran Yönetimi" })}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "التواصل", de: "Kontakt", en: "Contact", tr: "İletişim" })}
                </h4>
                <p>{copy({ ar: "الهاتف", de: "Telefon", en: "Phone", tr: "Telefon" })}: {restaurant?.phone || restaurant?.whatsappNumber}</p>
                {restaurant?.email && (
                  <p>{copy({ ar: "البريد الإلكتروني", de: "E-Mail", en: "Email", tr: "E-posta" })}: {restaurant.email}</p>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "رقم ضريبة القيمة المضافة", de: "Umsatzsteuer-ID", en: "VAT ID", tr: "KDV Kimlik Numarası" })}
                </h4>
                <p>{copy({
                  ar: "رقم التعريف الضريبي للقيمة المضافة وفقاً للمادة 27 أ من قانون ضريبة القيمة المضافة: DE318947510 (رقم تجريبي)",
                  de: "Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: DE318947510 (Muster-ID)",
                  en: "VAT identification number according to Section 27a of the German VAT Act: DE318947510 (sample ID)",
                  tr: "Alman KDV Kanunu Madde 27a uyarınca KDV kimlik numarası: DE318947510 (örnek ID)",
                })}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 space-y-1.5">
                <p>{copy({
                  ar: "إخلاء المسؤولية: على الرغم من الرقابة الدقيقة على المحتوى، لا نتحمل أي مسؤولية عن محتوى الروابط الخارجية.",
                  de: "Haftungsausschluss: Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.",
                  en: "Disclaimer: Although we check content carefully, we accept no liability for the content of external links. The operators of linked pages are solely responsible for their content.",
                  tr: "Sorumluluk reddi: İçerikleri dikkatle kontrol etmemize rağmen harici bağlantıların içeriklerinden sorumlu değiliz. Bağlantılı sayfaların içeriğinden yalnızca ilgili işletmeciler sorumludur.",
                })}</p>
                <p>
                  {copy({
                    ar: "Farman FoodSuite عبارة عن منصة للطلب وجذب العملاء ولا تحل محل الالتزامات القانونية للعميل فيما يتعلق بالتسجيل المالي أو الامتثال لسجل النقد أو التقارير الضريبية أو المحاسبة.",
                    de: "Farman FoodSuite ist eine Bestell- und Kundenbindungsplattform und ersetzt nicht die gesetzlichen Verpflichtungen des Kunden zur steuerlichen Erfassung, Kassenkonformität (TSE), Steuerberichterstattung oder Buchhaltung.",
                    en: "Farman FoodSuite is an ordering and customer engagement platform and does not replace the customer's legal obligations regarding fiscal recording, cash register compliance, tax reporting, or accounting.",
                    tr: "Farman FoodSuite bir sipariş ve müşteri etkileşim platformudur; mali kayıt, kasa uyumluluğu, vergi raporlaması veya muhasebe konularındaki yasal yükümlülüklerin yerine geçmez.",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowImprintModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow"
              >
                {copy({ ar: "إغلاق", de: "Schließen", en: "Close", tr: "Kapat" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-neutral-100 flex flex-col relative animate-fade-in text-neutral-800">
            <h3 className="font-serif font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
              <span>{copy({ ar: "الخصوصية", de: "Datenschutz", en: "Privacy Policy", tr: "Gizlilik Politikası" })}</span>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-sans font-bold cursor-pointer bg-transparent border-none p-0"
              >
                ✕
              </button>
            </h3>
            
            <div className="text-xs text-slate-700 space-y-4 leading-relaxed font-sans overflow-y-auto max-h-[45vh] pr-2 text-left">
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "1. الخصوصية في لمحة", de: "1. Datenschutz auf einen Blick", en: "1. Privacy at a Glance", tr: "1. Gizliliğe Genel Bakış" })}
                </h4>
                <p>{copy({
                  ar: "نحن نأخذ حماية بياناتك الشخصية على محمل الجد. تتم معالجة البيانات الشخصية على هذا الموقع فقط بالقدر الضروري تقنياً، مثل طلبات واتساب أو حجوزات الطاولات.",
                  de: "Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Personenbezogene Daten werden auf dieser Website nur im technisch notwendigen Umfang (z. B. für den Bestellprozess über WhatsApp oder die Tischreservierung) verarbeitet.",
                  en: "We take the protection of your personal data very seriously. Personal data is processed on this website only to the technically necessary extent, such as for WhatsApp ordering or table reservations.",
                  tr: "Kişisel verilerinizin korunmasını çok ciddiye alıyoruz. Bu web sitesinde kişisel veriler yalnızca WhatsApp siparişi veya masa rezervasyonu gibi teknik olarak gerekli kapsamda işlenir.",
                })}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "2. الجهة المسؤولة", de: "2. Verantwortliche Stelle", en: "2. Responsible Party", tr: "2. Sorumlu Taraf" })}
                </h4>
                <p className="font-medium text-slate-800">{restaurant?.legalName || restaurant?.name || restaurantName}</p>
                <p>{restaurant?.address}</p>
                <p>{copy({ ar: "البريد الإلكتروني", de: "E-Mail", en: "Email", tr: "E-posta" })}: {restaurant?.email || "info@mr-tabboush.de"}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "3. جمع البيانات ومعالجتها", de: "3. Erhebung und Verarbeitung von Daten", en: "3. Collection and Processing of Data", tr: "3. Verilerin Toplanması ve İşlenmesi" })}
                </h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>{copy({ ar: "طلبات واتساب", de: "WhatsApp-Bestellungen", en: "WhatsApp Orders", tr: "WhatsApp Siparişleri" })}:</strong> {copy({
                    ar: "عند إرسال طلبك عبر خدمة القائمة الذكية، تتم معالجة البيانات التي تدخلها (الاسم، رقم الهاتف، عنوان التوصيل) لإنشاء نص الطلب وتنفيذ المعاملة التعاقدية (المادة 6 الفقرة 1 ب من DSGVO).",
                    de: "Wenn Sie Ihre Bestellung über den Smart Menu Service abschicken, werden die von Ihnen eingegebenen Daten (Name, Telefonnummer, Lieferadresse) zur Generierung des Bestelltexts und zur vertraglichen Abwicklung verarbeitet (Art. 6 Abs. 1 lit. b DSGVO).",
                    en: "When you submit your order through the Smart Menu service, the data you enter (name, phone number, delivery address) is processed to generate the order text and handle the contract process (Art. 6 para. 1 lit. b DSGVO).",
                    tr: "Siparişinizi Smart Menu hizmeti üzerinden gönderdiğinizde, girdiğiniz veriler (ad, telefon numarası, teslimat adresi) sipariş metnini oluşturmak ve sözleşme sürecini yürütmek için işlenir (DSGVO Madde 6 paragraf 1 bent b).",
                  })}</li>
                  <li><strong>{copy({ ar: "حجز الطاولات", de: "Tischreservierung", en: "Table Reservation", tr: "Masa Rezervasyonu" })}:</strong> {copy({
                    ar: "تتم معالجة الاسم ورقم واتساب وتاريخ الحجز لتوفير خدمة الحجز.",
                    de: "Name, WhatsApp-Telefonnummer und Datum der Reservierung werden zur Bereitstellung des Reservierungsdienstes verarbeitet.",
                    en: "Name, WhatsApp phone number, and reservation date are processed to provide the reservation service.",
                    tr: "Ad, WhatsApp telefon numarası ve rezervasyon tarihi, rezervasyon hizmetini sağlamak için işlenir.",
                  })}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-1">
                  {copy({ ar: "4. حقوقك", de: "4. Ihre Rechte", en: "4. Your Rights", tr: "4. Haklarınız" })}
                </h4>
                <p>{copy({
                  ar: "يحق لك في أي وقت الحصول مجاناً على معلومات حول مصدر بياناتك الشخصية المخزنة والمستلمين والغرض منها، وكذلك طلب تصحيح هذه البيانات أو حظرها أو حذفها. يرجى التواصل عبر جهة الاتصال المذكورة في صفحة البيانات القانونية.",
                  de: "Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten sowie ein Recht auf Berichtigung, Sperrung oder Löschung dieser Daten. Wenden Sie sich hierzu an den im Impressum angegebenen Kontakt.",
                  en: "You have the right at any time to free information about the origin, recipients, and purpose of your stored personal data, as well as the right to correction, blocking, or deletion of this data. Please contact the address listed in the imprint.",
                  tr: "Saklanan kişisel verilerinizin kaynağı, alıcıları ve amacı hakkında ücretsiz bilgi alma, ayrıca bu verilerin düzeltilmesini, engellenmesini veya silinmesini talep etme hakkına her zaman sahipsiniz. Bunun için künyede belirtilen iletişim adresine başvurabilirsiniz.",
                })}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow"
              >
                {copy({ ar: "إغلاق", de: "Schließen", en: "Close", tr: "Kapat" })}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
