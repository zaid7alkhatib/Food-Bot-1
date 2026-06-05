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
  DollarSign
} from "lucide-react";

interface SmartMenuProps {
  tableNumber: string;
  branchId: string;
}

export default function SmartMenu({ tableNumber, branchId }: SmartMenuProps) {
  const { language, setLanguage, t, text, dir } = useI18n();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [currency, setCurrency] = useState({ code: "EUR", symbol: "€" });
  const [branchName, setBranchName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
          setBranchName(data.branch?.name || "MR. Tabboush");
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
    item.modifierGroups.forEach((group) => {
      if (group.isRequired && group.type === "single" && group.options.length > 0) {
        defaults[group.id] = [group.options[0]];
      } else {
        defaults[group.id] = [];
      }
    });
    setModSelections(defaults);
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
    for (const group of selectedItemForMod.modifierGroups) {
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
      const group = selectedItemForMod.modifierGroups.find((g) => g.id === groupId);
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

  // Submit dine-in order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
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
    } catch (err) {
      console.error(err);
      alert("Submission failed. Connection issue.");
    } finally {
      setIsSubmitting(false);
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

  // Render Placed Order Success Screen
  if (placedOrder) {
    const stepIdx = getOrderStatusProgress(placedOrder.status);
    const orderNum = placedOrder.orderNumber;
    
    return (
      <div dir={dir} className="min-h-screen bg-stone-50 text-neutral-800 font-sans flex flex-col">
        {/* Success Header */}
        <header className="bg-slate-900 border-b-4 border-orange-500 text-white text-center py-5 shadow-md">
          <h1 className="text-xl font-bold font-serif tracking-tight">MR. TABBOUSH</h1>
          <p className="text-[10px] text-orange-400 font-mono font-bold tracking-wide uppercase mt-1">
            {t("orders.dineIn")} • {t("orders.table")} {tableNumber}
          </p>
        </header>

        {/* Tracking Card */}
        <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-start gap-6 py-8">
          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 text-center shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Check size={28} />
            </div>
            
            <h2 className="text-lg font-bold text-neutral-900 leading-tight">
              {language === "ar" ? "تم إرسال طلبك بنجاح!" : "Bestellung erfolgreich übermittelt!"}
            </h2>
            <p className="text-xs text-neutral-400 mt-1.5">
              {language === "ar" 
                ? `طلبك رقم ${orderNum} تم إرساله مباشرة لمطبخ المطعم.`
                : `Ihre Bestellnummer ist ${orderNum}. Sie wird jetzt frisch zubereitet.`}
            </p>

            {/* Total Paid Stamp */}
            <div className="mt-4 p-2 bg-stone-55/40 bg-neutral-50 border border-stone-200/50 rounded-xl inline-flex items-center gap-1.5 text-xs text-neutral-600 font-semibold">
              <span>{t("common.total")}:</span>
              <span className="text-orange-600 font-bold font-mono">
                {placedOrder.total.toFixed(2)}{currency.symbol}
              </span>
              <span className="text-[9px] uppercase bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded font-bold">
                {language === "ar" ? "دفع عند الطاولة" : "Pay at Table"}
              </span>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-5 flex items-center gap-1.5">
              <Clock size={14} className="text-orange-500" />
              {language === "ar" ? "حالة تحضير الطلب" : "Zubereitungsstatus"}
            </h3>

            {placedOrder.status === "cancelled" ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                <span className="font-semibold">{t("status.cancelled")}</span>
              </div>
            ) : (
              <div className="space-y-6 relative pl-5 border-l border-neutral-100 ml-2">
                {/* Step 1 */}
                <div className="relative">
                  <div className={`absolute -left-[27px] w-4.5 h-4.5 rounded-full flex items-center justify-center border font-bold text-[9px] ${
                    stepIdx >= 0 ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-neutral-200 text-neutral-400"
                  }`}>
                    {stepIdx > 0 ? "✓" : "1"}
                  </div>
                  <div className="pl-4 leading-tight">
                    <h4 className="text-xs font-bold text-neutral-900">{t("status.received")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {language === "ar" ? "تم استلام الطلب وتدقيقه" : "Bestellung empfangen"}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className={`absolute -left-[27px] w-4.5 h-4.5 rounded-full flex items-center justify-center border font-bold text-[9px] ${
                    stepIdx >= 1 ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-neutral-200 text-neutral-400"
                  }`}>
                    {stepIdx > 1 ? "✓" : "2"}
                  </div>
                  <div className="pl-4 leading-tight">
                    <h4 className="text-xs font-bold text-neutral-900">{t("status.preparing")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {language === "ar" ? "يجري تحضير وجبتك طازجة بالمطبخ" : "Wird frisch in der Küche zubereitet"}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className={`absolute -left-[27px] w-4.5 h-4.5 rounded-full flex items-center justify-center border font-bold text-[9px] ${
                    stepIdx >= 2 ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-neutral-200 text-neutral-400"
                  }`}>
                    {stepIdx > 2 ? "✓" : "3"}
                  </div>
                  <div className="pl-4 leading-tight">
                    <h4 className="text-xs font-bold text-neutral-900">{t("status.ready_for_pickup")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {language === "ar" ? "وجبتك جاهزة وسيقوم النادل بتقديمها" : "Gerichte fertig zum Servieren"}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <div className={`absolute -left-[27px] w-4.5 h-4.5 rounded-full flex items-center justify-center border font-bold text-[9px] ${
                    stepIdx >= 3 ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-neutral-200 text-neutral-400"
                  }`}>
                    4
                  </div>
                  <div className="pl-4 leading-tight">
                    <h4 className="text-xs font-bold text-neutral-900">{t("status.delivered")}</h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {language === "ar" ? "بالهناء والشفاء! نتمنى أن تعجبك الوجبة" : "Guten Appetit! Genießen Sie Ihr Essen"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New Order Button */}
          <button
            onClick={() => setPlacedOrder(null)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3.5 rounded-xl transition shadow-md active:scale-98"
          >
            {language === "ar" ? "طلب أطباق أخرى" : "Weitere Gerichte bestellen"}
          </button>
        </main>

        <footer className="py-4 text-center text-[10px] text-neutral-400 border-t border-stone-200/50 mt-auto bg-stone-100">
          MR. Tabboush Smart Table Menu
        </footer>
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-stone-50 text-neutral-800 font-sans flex flex-col pb-24 relative select-none">
      
      {/* Smart Menu Header */}
      <header className="bg-slate-900 border-b-4 border-orange-500 text-white py-4 px-4 sticky top-0 z-40 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-lg rotate-[-2deg]">
              🌯
            </div>
            <div>
              <h1 className="text-sm font-serif font-bold tracking-tight">{branchName}</h1>
              <p className="text-[10px] text-orange-400 font-mono font-bold block leading-none">
                {t("orders.dineIn")} • {t("orders.table")} {tableNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              {(["de", "ar", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`h-6 w-8 rounded text-[9px] font-bold uppercase transition ${
                    language === lang ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
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
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-md flex items-center gap-3">
          <Utensils size={36} className="text-amber-100 opacity-90 rotate-[-12deg] shrink-0" />
          <div className="leading-tight">
            <h3 className="font-bold text-sm">
              {language === "ar" ? "اطلب طعامك طازجاً من طاولتك" : "Bestellen Sie direkt am Tisch"}
            </h3>
            <p className="text-[10px] text-amber-100 mt-1 font-medium">
              {language === "ar" 
                ? "تصفح قائمتنا الشامية المميزة وسيتم تحضير طلبك فوراً." 
                : "Wählen Sie Ihre Lieblingsgerichte, wir bringen sie warm an Ihren Tisch."}
            </p>
          </div>
        </div>

        {/* Categories Tab slider */}
        <div className="sticky top-[73px] z-30 bg-stone-50 py-2 -mx-4 px-4 overflow-x-auto flex gap-1.5 scrollbar-none select-none">
          <button
            onClick={() => handleCategoryClick("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
              activeCategory === "all"
                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                : "bg-white border-stone-200 text-neutral-500 hover:bg-neutral-55"
            }`}
          >
            {language === "ar" ? "كل الأصناف" : "Alle Speisen"}
          </button>
          
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                activeCategory === cat.id
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-white border-stone-200 text-neutral-500 hover:bg-neutral-55"
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

                <div className="grid grid-cols-1 gap-3.5">
                  {itemsInCategory.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white rounded-2xl border border-stone-200/50 p-3 flex gap-3 shadow-sm hover:shadow-md transition active:scale-[0.99] cursor-pointer"
                      onClick={() => handleOpenModifiers(item)}
                    >
                      {/* Product image */}
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={text(item.name)} 
                          className="w-20 h-20 rounded-xl object-cover shrink-0 bg-stone-100 border border-stone-100"
                        />
                      )}
                      
                      {/* Content details */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs text-neutral-900 flex items-center gap-1">
                            {text(item.name)}
                            {item.isBestSeller && (
                              <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">
                                🔥 Bestseller
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-neutral-400 leading-snug line-clamp-2">
                            {text(item.description)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
                          <span className="font-bold text-xs text-orange-600 font-mono">
                            {item.basePrice.toFixed(2)}{currency.symbol}
                          </span>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(item);
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg p-1.5 px-3 text-[10px] font-bold flex items-center gap-1 transition shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Plus size={11} />
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
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer active:scale-95"
            >
              {language === "ar" ? "استعراض السلة" : "Warenkorb ansehen"}
              <ChevronRight size={14} className={dir === "rtl" ? "rotate-180" : ""} />
            </button>
          </div>
        </div>
      )}

      {/* Modifiers Modal Dialog */}
      {selectedItemForMod && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50 select-none">
              <div>
                <h3 className="font-bold text-sm text-neutral-900">{text(selectedItemForMod.name)}</h3>
                <span className="text-[10px] font-mono text-orange-600 font-bold mt-0.5 block">
                  {selectedItemForMod.basePrice.toFixed(2)}{currency.symbol}
                </span>
              </div>
              <button
                onClick={() => setSelectedItemForMod(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700 bg-white border border-stone-200 rounded-lg text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {selectedItemForMod.modifierGroups.map((group) => (
                <div key={group.id} className="space-y-2 border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                      {text(group.name)}
                      {group.isRequired && (
                        <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">
                          {language === "ar" ? "إجباري" : "Erforderlich"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-semibold">
                      {group.type === "single" 
                        ? (language === "ar" ? "اختر واحداً" : "Wählen Sie 1") 
                        : (group.maxSelections ? `${language === "ar" ? "حد أقصى" : "Max"} ${group.maxSelections}` : "")
                      }
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {group.options.map((opt) => {
                      const selected = (modSelections[group.id] || []).some((o) => o.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectModifier(group, opt)}
                          className={`p-2.5 rounded-xl border text-xs font-medium text-left flex justify-between items-center transition cursor-pointer ${
                            selected 
                              ? "border-orange-500 bg-orange-50/40 text-neutral-900" 
                              : "border-stone-200/80 bg-white text-neutral-600 hover:bg-neutral-55"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              selected ? "border-orange-500 bg-orange-500 text-white" : "border-stone-300"
                            }`}>
                              {selected && <Check size={10} />}
                            </span>
                            {text(opt.name)}
                          </span>
                          {opt.priceAdjustment > 0 && (
                            <span className="font-mono text-[11px] font-bold text-neutral-500">
                              +{opt.priceAdjustment.toFixed(2)}{currency.symbol}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quantity Selector */}
              <div className="flex items-center justify-between border-t border-stone-100 pt-4 pb-2">
                <span className="text-xs font-bold text-neutral-800">{language === "ar" ? "الكمية" : "Menge"}</span>
                <div className="flex items-center bg-stone-100 border border-stone-200 rounded-lg p-1 gap-3">
                  <button
                    onClick={() => setModQuantity(q => Math.max(1, q - 1))}
                    className="p-1.5 bg-white border border-stone-200 rounded text-neutral-500 active:scale-90"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="font-mono font-bold text-xs min-w-4 text-center">{modQuantity}</span>
                  <button
                    onClick={() => setModQuantity(q => q + 1)}
                    className="p-1.5 bg-white border border-stone-200 rounded text-neutral-500 active:scale-90"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-100 bg-stone-50">
              <button
                onClick={handleAddToCart}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-3.5 rounded-xl transition shadow-md active:scale-98 cursor-pointer"
              >
                {language === "ar" ? "إضافة إلى السلة" : "In den Warenkorb"}
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
                      {(item.selectedModifiers || []).map((m, mIdx) => (
                        <span key={mIdx} className="text-[10px] text-neutral-400 block mt-0.5">
                          └ {text(m.groupName)}: {text(m.option.name)}
                        </span>
                      ))}
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
                    <Utensils size={14} />
                    {language === "ar" ? "تأكيد وإرسال الطلب للمطبخ" : "Bestellung in die Küche schicken"}
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
