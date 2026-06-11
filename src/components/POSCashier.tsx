import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Calculator,
  User,
  Phone,
  MapPin,
  Clock,
  Utensils,
  Percent,
  X,
  Check,
  ShoppingBag,
  AlertCircle,
  HelpCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { Category, MenuItem, Branch, OrderItem, ModifierGroup, ModifierOption, OrderType, Order, Table, Reservation } from "../types";

interface POSCashierProps {
  categories: Category[];
  menuItems: MenuItem[];
  branchInfo: any;
  branches: any[];
  currencySymbol: string;
  token: string | null;
  tables?: Table[];
  reservations?: Reservation[];
  orders?: Order[];
  onOrderPlaced: () => void;
}

export default function POSCashier({
  categories,
  menuItems,
  branchInfo,
  branches,
  currencySymbol,
  token,
  tables = [],
  reservations = [],
  orders = [],
  onOrderPlaced
}: POSCashierProps) {
  const { language, t, text, dir } = useI18n();
  const { user } = useAuth();

  // Selected branch state
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  useEffect(() => {
    if (user?.branchId) {
      setSelectedBranchId(user.branchId);
    } else if (branchInfo?.id) {
      setSelectedBranchId(branchInfo.id);
    } else if (branchInfo?._id) {
      setSelectedBranchId(branchInfo._id);
    } else if (branches.length > 0) {
      setSelectedBranchId(branches[0].id || branches[0]._id);
    }
  }, [user, branchInfo, branches]);

  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId || b._id === selectedBranchId) || branchInfo;
  }, [branches, selectedBranchId, branchInfo]);

  // POS Layout States
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  
  // Checkout/Customer Info States
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [pickupTime, setPickupTime] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  // Filter tables active in the selected branch
  const branchTables = useMemo(() => {
    return tables.filter((t) => (t.branchId === selectedBranchId || t.branchId === activeBranch?.id || t.branchId === activeBranch?._id) && t.isActive);
  }, [tables, selectedBranchId, activeBranch]);

  // Helper to determine active order at table
  const getActiveOrderForTable = (tableNum: string) => {
    return orders.find(
      (o) =>
        o.orderType === "dine_in" &&
        o.tableNumber === tableNum &&
        !["delivered", "cancelled"].includes(o.status)
    );
  };

  // Helper to determine current seated reservation
  const getSeatedReservationForTable = (tableId: string) => {
    return reservations.find(
      (r) => r.tableId === tableId && r.status === "seated"
    );
  };

  // Helper to determine upcoming reservation (next 45 minutes)
  const getUpcomingReservationForTable = (tableId: string) => {
    const now = new Date();
    const fortyFiveMinutesLater = new Date(now.getTime() + 45 * 60 * 1000);

    return reservations.find((r) => {
      if (r.tableId !== tableId || ["cancelled", "completed"].includes(r.status)) return false;
      const resvTime = new Date(r.dateTime);
      return resvTime >= now && resvTime <= fortyFiveMinutesLater;
    });
  };

  // Determine Table Color Status
  const getTableStatus = (table: Table) => {
    const activeOrder = getActiveOrderForTable(table.number);
    const seatedResv = getSeatedReservationForTable(table.id);
    if (activeOrder || seatedResv) {
      return "busy";
    }
    const upcoming = getUpcomingReservationForTable(table.id);
    if (upcoming) {
      return "reserved";
    }
    return "free";
  };

  const selectedTableObj = useMemo(() => {
    return branchTables.find(t => t.number === tableNumber);
  }, [branchTables, tableNumber]);

  const selectedTableConflict = useMemo(() => {
    if (!selectedTableObj) return null;
    const status = getTableStatus(selectedTableObj);
    if (status === "busy") {
      const activeOrder = getActiveOrderForTable(selectedTableObj.number);
      const seatedResv = getSeatedReservationForTable(selectedTableObj.id);
      if (activeOrder) {
        return {
          type: "busy",
          message: language === "ar" 
            ? `تنبيه: الطاولة ${selectedTableObj.number} مشغولة حالياً بالطلب #${activeOrder.orderNumber}`
            : `Warnung: Tisch ${selectedTableObj.number} ist bereits belegt (Bestellung #${activeOrder.orderNumber}).`
        };
      }
      if (seatedResv) {
        return {
          type: "busy",
          message: language === "ar"
            ? `تنبيه: الطاولة ${selectedTableObj.number} مشغولة حالياً بحجز العميل ${seatedResv.customerName}`
            : `Warnung: Tisch ${selectedTableObj.number} ist bereits belegt durch Reservierung von ${seatedResv.customerName}.`
        };
      }
    }
    if (status === "reserved") {
      const upcoming = getUpcomingReservationForTable(selectedTableObj.id);
      if (upcoming) {
        const timeStr = new Date(upcoming.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          type: "reserved",
          message: language === "ar"
            ? `تنبيه: الطاولة ${selectedTableObj.number} محجوزة قريباً للعميل ${upcoming.customerName} الساعة ${timeStr}`
            : `Warnung: Tisch ${selectedTableObj.number} ist bald reserviert für ${upcoming.customerName} um ${timeStr}.`
        };
      }
    }
    return null;
  }, [selectedTableObj, orders, reservations, language]);

  // Modifiers & Upsell popup states
  const [selectedItemForMod, setSelectedItemForMod] = useState<MenuItem | null>(null);
  const [modSelections, setModSelections] = useState<Record<string, ModifierOption[]>>({});
  const [modQuantity, setModQuantity] = useState<number>(1);
  const [activeUpsellSelections, setActiveUpsellSelections] = useState<Record<string, boolean>>({});

  // Submission States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Determine allowed roles for branch switching
  const canSwitchBranch = user?.role === "super_admin" || user?.role === "restaurant_admin";

  // Filter menu items by active category and search input
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.categoryId === activeCategory;
      const itemName = text(item.name).toLowerCase();
      const sku = (item.skucode || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = itemName.includes(query) || sku.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, activeCategory, searchQuery, text]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const deliveryFee = useMemo(() => {
    if (orderType === "delivery") {
      return activeBranch?.deliveryFee || 0;
    }
    return 0;
  }, [orderType, activeBranch]);

  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    // Cap manual discount to the subtotal amount
    return Math.min(discountValue, subtotal);
  }, [discountValue, subtotal]);

  const total = useMemo(() => {
    return Math.max(0, subtotal + deliveryFee - discountAmount);
  }, [subtotal, deliveryFee, discountAmount]);

  // Click on menu item handler
  const handleItemClick = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setSelectedItemForMod(item);
      setModQuantity(1);
      setActiveUpsellSelections({});
      
      // Auto-select required single-choice modifiers
      const defaults: Record<string, ModifierOption[]> = {};
      item.modifierGroups.forEach((group) => {
        if (group.isRequired && group.type === "single" && group.options.length > 0) {
          defaults[group.id] = [group.options[0]];
        } else {
          defaults[group.id] = [];
        }
      });
      setModSelections(defaults);
    } else {
      // Add directly to cart if no modifiers
      addToCartDirectly(item);
    }
  };

  const addToCartDirectly = (item: MenuItem, qty = 1) => {
    const existingIndex = cart.findIndex((i) => i.itemId === item.id && i.selectedModifiers.length === 0 && !i.selectedUpsell);
    
    if (existingIndex > -1) {
      setCart((prev) => {
        const next = [...prev];
        const newQty = next[existingIndex].quantity + qty;
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: newQty,
          totalPrice: item.basePrice * newQty
        };
        return next;
      });
    } else {
      const orderItem: OrderItem = {
        itemId: item.id,
        name: item.name,
        basePrice: item.basePrice,
        quantity: qty,
        selectedModifiers: [],
        totalPrice: item.basePrice * qty
      };
      setCart((prev) => [...prev, orderItem]);
    }
  };

  // Modifiers Dialog Handlers
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
          return prev; // Lock selection additions beyond max
        }
        return { ...prev, [group.id]: next };
      }
    });
  };

  const getModSelectionsPrice = () => {
    if (!selectedItemForMod) return 0;
    let extra = 0;
    Object.entries(modSelections).forEach(([groupId, optionsVal]) => {
      const options = optionsVal as ModifierOption[];
      options.forEach((opt) => {
        extra += opt.priceAdjustment || 0;
      });
    });
    return extra;
  };

  const handleUpsellToggle = (upsellId: string) => {
    setActiveUpsellSelections(prev => ({
      ...prev,
      [upsellId]: !prev[upsellId]
    }));
  };

  const handleAddCustomizedItemToCart = () => {
    if (!selectedItemForMod) return;

    // Validate required groups
    for (const group of selectedItemForMod.modifierGroups || []) {
      if (group.isRequired) {
        const selections = modSelections[group.id] || [];
        if (selections.length < (group.minSelections || 1)) {
          alert(
            language === "ar"
              ? `يرجى اختيار الخيارات المطلوبة لمجموعة ${text(group.name)}`
              : `Bitte wählen Sie die erforderlichen Optionen für ${text(group.name)}`
          );
          return;
        }
      }
    }

    // Format selected modifiers
    const selectedMods: any[] = [];
    Object.entries(modSelections).forEach(([groupId, optionsVal]) => {
      const options = optionsVal as ModifierOption[];
      const group = selectedItemForMod.modifierGroups.find((g) => g.id === groupId);
      if (group && options.length > 0) {
        options.forEach((opt) => {
          selectedMods.push({
            groupId: group.id,
            groupName: group.name,
            option: opt
          });
        });
      }
    });

    const modifierPriceDiff = selectedMods.reduce((sum, m) => sum + (m.option.priceAdjustment || 0), 0);
    const itemTotalPrice = (selectedItemForMod.basePrice + modifierPriceDiff) * modQuantity;

    const mainCartItem: OrderItem = {
      itemId: selectedItemForMod.id,
      name: selectedItemForMod.name,
      basePrice: selectedItemForMod.basePrice,
      quantity: modQuantity,
      selectedModifiers: selectedMods,
      totalPrice: itemTotalPrice
    };

    setCart((prev) => [...prev, mainCartItem]);

    // Handle Selected Upsells (if cashier checked any upsell suggestions)
    selectedItemForMod.upsellSuggestions.forEach((suggestion) => {
      if (activeUpsellSelections[suggestion.id]) {
        // Upsell items are added as their own distinct line items for cashier convenience
        const matchingMenuItem = menuItems.find(item => item.id === suggestion.suggestedItemId);
        if (matchingMenuItem) {
          addToCartDirectly(matchingMenuItem, 1);
        } else {
          // If suggested item doesn't map, add custom upsell object
          const upsellItem: OrderItem = {
            itemId: suggestion.suggestedItemId || suggestion.id,
            name: suggestion.suggestedItemName,
            basePrice: suggestion.price,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: suggestion.price,
            selectedUpsell: {
              id: suggestion.id,
              name: suggestion.suggestedItemName,
              price: suggestion.price
            }
          };
          setCart((prev) => [...prev, upsellItem]);
        }
      }
    });

    // Close mod drawer
    setSelectedItemForMod(null);
  };

  // Cart row handlers
  const updateCartItemQty = (index: number, change: number) => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[index];
      const newQty = item.quantity + change;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.option.priceAdjustment || 0), 0);
        next[index] = {
          ...item,
          quantity: newQty,
          totalPrice: (item.basePrice + modPrice) * newQty
        };
      }
      return next;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setOrderType("dine_in");
    setTableNumber("");
    setPickupTime("");
    setDeliveryAddress("");
    setDiscountValue(0);
    setNotes("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  // Submit checkout to server
  const handlePlaceOrder = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    // Validations
    if (cart.length === 0) {
      setErrorMsg(language === "ar" ? "سلة التسوق فارغة." : "Der Warenkorb ist leer.");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg(language === "ar" ? "يرجى إدخال اسم العميل." : "Bitte geben Sie den Kundennamen ein.");
      return;
    }
    if (!selectedBranchId) {
      setErrorMsg(language === "ar" ? "لم يتم تحديد أي فرع." : "Keine Filiale ausgewählt.");
      return;
    }

    if (orderType === "dine_in" && !tableNumber.trim()) {
      setErrorMsg(language === "ar" ? "يرجى تحديد رقم الطاولة." : "Bitte geben Sie die Tischnummer ein.");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      setErrorMsg(language === "ar" ? "يرجى تحديد عنوان التوصيل." : "Bitte geben Sie die Lieferadresse ein.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        branchId: selectedBranchId,
        customerName: customerName.trim(),
        whatsAppPhone: customerPhone.trim() || undefined,
        orderType,
        items: cart,
        subtotal,
        deliveryFee,
        discount: discountAmount,
        total,
        paymentMethod,
        tableNumber: orderType === "dine_in" ? tableNumber.trim() : undefined,
        pickupTime: orderType === "pickup" ? (pickupTime.trim() || "ASAP") : undefined,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        source: "pos" // Clearly demarcate this as originating from the cashier POS
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order on server.");
      }

      setSuccessMsg(
        language === "ar"
          ? `تم إنشاء الطلب بنجاح! رقم الطلب: #${data.orderNumber}`
          : `Bestellung erfolgreich erstellt! Bestellnummer: #${data.orderNumber}`
      );
      
      // Flash success and reset cart
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setTableNumber("");
      setPickupTime("");
      setDeliveryAddress("");
      setDiscountValue(0);
      setNotes("");

      // Notify parent to sync orders and view
      if (onOrderPlaced) {
        setTimeout(() => {
          onOrderPlaced();
        }, 1500);
      }
    } catch (err: any) {
      console.error("POS order submit failed:", err);
      setErrorMsg(err.message || "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" dir={dir}>
      {/* LEFT COLUMN: Menu Categories, Search, and Items Grid */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
        {/* Branch Selector (Visible to global admins only) */}
        {canSwitchBranch && branches.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <ShoppingBag size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  {language === "ar" ? "فرع الطلب" : "Bestellfiliale"}
                </h4>
                <p className="text-[10px] text-gray-500">
                  {language === "ar" ? "اختر الفرع لتسجيل الطلب فيه" : "Wählen Sie die Filiale für die Bestellung"}
                </p>
              </div>
            </div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-700 focus:outline-none focus:border-orange-500 w-full sm:w-64"
            >
              {branches.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search & Categories Bar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={
                language === "ar" 
                  ? "البحث عن صنف بالاسم أو الرمز..." 
                  : "Artikel nach Name oder SKU suchen..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Categories Horizontal Scrolling List */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition ${
                activeCategory === "all"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-slate-50 text-gray-600 hover:bg-slate-100"
              }`}
            >
              {language === "ar" ? "الكل" : "Alle"}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition ${
                  activeCategory === cat.id
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-slate-50 text-gray-600 hover:bg-slate-100"
                }`}
              >
                {text(cat.name)}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        {filteredMenuItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
            <ShoppingBag size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-xs text-gray-500 font-medium">
              {language === "ar" ? "لم يتم العثور على وجبات مطابقة." : "Keine passenden Artikel gefunden."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="group flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 text-left cursor-pointer relative"
              >
                {/* Image or glyph placeholder */}
                {item.image ? (
                  <div className="w-full h-32 overflow-hidden bg-slate-50 relative">
                    <img
                      src={item.image}
                      alt={text(item.name)}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {item.isBestSeller && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider shadow">
                        ★ {language === "ar" ? "الأكثر مبيعاً" : "Beststeller"}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-32 bg-orange-50 flex items-center justify-center relative">
                    <span className="text-3xl">🌯</span>
                    {item.isBestSeller && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider shadow">
                        ★ {language === "ar" ? "الأكثر مبيعاً" : "Beststeller"}
                      </span>
                    )}
                  </div>
                )}

                {/* Info block */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-1 w-full">
                  <div className="w-full">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="text-xs font-bold text-gray-800 line-clamp-2">{text(item.name)}</h4>
                    </div>
                    {item.skucode && (
                      <span className="text-[10px] text-gray-400 font-mono block mt-0.5">SKU: {item.skucode}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-xs font-extrabold text-orange-600">
                      {item.basePrice.toFixed(2)} {currencySymbol}
                    </span>
                    <span className="p-1 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition duration-200">
                      <Plus size={14} />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Cart Receipt & Checkout Settings */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-[500px] overflow-hidden sticky top-6">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-orange-500">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {language === "ar" ? "سلة الفواتير" : "Beleg-Kasse"}
              </h3>
            </div>
            <button
              onClick={handleClearCart}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
              title="Clear Cart"
            >
              <Trash2 size={13} />
              <span className="text-[10px] uppercase font-bold">{language === "ar" ? "مسح" : "Leeren"}</span>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 max-h-[300px] divide-y divide-gray-50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <ShoppingBag size={28} className="text-gray-300 mb-2" />
                <p className="text-[11px] text-gray-400 font-medium">
                  {language === "ar" ? "لا توجد أصناف في السلة." : "Keine Artikel im Warenkorb."}
                </p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-start justify-between gap-3 group">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-gray-800 truncate">{text(item.name)}</h5>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                        {item.selectedModifiers.map(m => `${text(m.option.name)} (+${m.option.priceAdjustment.toFixed(2)}${currencySymbol})`).join(", ")}
                      </p>
                    )}
                    {item.selectedUpsell && (
                      <span className="inline-block text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-bold mt-1">
                        🎁 {language === "ar" ? "توصية إضافية" : "Zusatzangebot"}
                      </span>
                    )}
                  </div>
                  
                  {/* Quantity and pricing */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => updateCartItemQty(idx, -1)}
                        className="p-1 hover:bg-white text-gray-500 hover:text-gray-800 rounded transition"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="text-xs font-bold px-1 text-gray-800">{item.quantity}</span>
                      <button
                        onClick={() => updateCartItemQty(idx, 1)}
                        className="p-1 hover:bg-white text-gray-500 hover:text-gray-800 rounded transition"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <span className="text-xs font-extrabold text-gray-800 w-16 text-right">
                      {item.totalPrice.toFixed(2)} {currencySymbol}
                    </span>
                    <button
                      onClick={() => removeCartItem(idx)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer & Checkout Configurations */}
          <div className="border-t border-gray-100 bg-slate-50 p-4 space-y-4">
            {/* Fulfillment Type Selection */}
            <div className="grid grid-cols-3 gap-1 bg-white border border-gray-200 rounded-xl p-1">
              {(["dine_in", "pickup", "delivery"] as OrderType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition tracking-wider flex flex-col items-center justify-center gap-1 ${
                    orderType === type
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {type === "dine_in" && <Utensils size={12} />}
                  {type === "pickup" && <Clock size={12} />}
                  {type === "delivery" && <MapPin size={12} />}
                  {type === "dine_in" ? (language === "ar" ? "طاولة" : "Dine-In") : null}
                  {type === "pickup" ? (language === "ar" ? "سفري" : "Pickup") : null}
                  {type === "delivery" ? (language === "ar" ? "توصيل" : "Lieferung") : null}
                </button>
              ))}
            </div>

            {/* Dynamic fields based on Order Type */}
            {orderType === "dine_in" && (
              <div className="animate-fade-in bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {language === "ar" ? "رقم الطاولة" : "Tischnummer"} *
                  </label>
                  {activeBranch?.reservationEnabled && branchTables.length > 0 ? (
                    <select
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500 font-semibold"
                    >
                      <option value="">
                        {language === "ar" ? "-- اختر طاولة --" : "-- Tisch wählen --"}
                      </option>
                      {branchTables.map((t) => {
                        const status = getTableStatus(t);
                        let label = `Table ${t.number} (${t.capacity}p)`;
                        if (language === "ar") {
                          label = `طاولة ${t.number} (${t.capacity} مقاعد)`;
                        }

                        if (status === "busy") {
                          label += ` - [${language === "ar" ? "مشغولة 🔴" : "Belegt 🔴"}]`;
                        } else if (status === "reserved") {
                          label += ` - [${language === "ar" ? "محجوزة قريباً 🟡" : "Bald reserviert 🟡"}]`;
                        } else {
                          label += ` - [${language === "ar" ? "متاحة 🟢" : "Frei 🟢"}]`;
                        }

                        return (
                          <option key={t.id} value={t.number}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Table 5"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500 font-semibold"
                    />
                  )}
                </div>

                {selectedTableConflict && (
                  <div className={`p-2 rounded-lg text-[10px] font-semibold flex items-start gap-1.5 border transition animate-fade-in ${
                    selectedTableConflict.type === "busy"
                      ? "bg-red-50 border-red-100 text-red-800"
                      : "bg-amber-50 border-amber-100 text-amber-800"
                  }`}>
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>{selectedTableConflict.message}</span>
                  </div>
                )}
              </div>
            )}

            {orderType === "pickup" && (
              <div className="animate-fade-in bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {language === "ar" ? "وقت الاستلام" : "Abholzeit"}
                </label>
                <input
                  type="text"
                  placeholder={language === "ar" ? "مثال: بعد 20 دقيقة" : "z.B. in 20 min"}
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500 font-semibold"
                />
              </div>
            )}

            {orderType === "delivery" && (
              <div className="animate-fade-in bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {language === "ar" ? "عنوان التوصيل" : "Lieferadresse"} *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Street, City, Postal Code"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
                {activeBranch?.deliveryFee > 0 && (
                  <div className="flex justify-between items-center text-[10px] bg-blue-50 text-blue-800 p-2 rounded-lg font-semibold border border-blue-100">
                    <span>{language === "ar" ? "رسوم التوصيل المضافة:" : "Liefergebühr:"}</span>
                    <span>{activeBranch.deliveryFee.toFixed(2)} {currencySymbol}</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Contact Card */}
            <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {language === "ar" ? "اسم العميل" : "Kundenname"} *
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-orange-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {language === "ar" ? "رقم الهاتف / واتساب" : "WhatsApp-Telefonnummer"}
                </label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input
                    type="tel"
                    placeholder="+491761234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-orange-500 font-mono text-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {language === "ar" ? "طريقة الدفع" : "Zahlungsart"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Cash", "Card", "WhatsApp Link"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 rounded-lg border text-[10px] font-bold uppercase transition ${
                      paymentMethod === method
                        ? "bg-slate-900 border-slate-950 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {method === "Cash" && (language === "ar" ? "نقدي" : "Bar")}
                    {method === "Card" && (language === "ar" ? "بطاقة" : "Karte")}
                    {method === "WhatsApp Link" && (language === "ar" ? "رابط دفع" : "Link")}
                  </button>
                ))}
              </div>
            </div>

            {/* Cashier Discount & Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {language === "ar" ? "خصم أمين الصندوق" : "Kassiererrabatt"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-3 pr-7 text-xs focus:outline-none focus:border-orange-500 text-right font-bold text-red-600"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">
                    {currencySymbol}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {language === "ar" ? "ملاحظات إضافية" : "Bestellnotiz"}
                </label>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500 text-gray-600 font-medium"
                />
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-1 text-xs font-medium text-gray-600">
              <div className="flex justify-between">
                <span>{language === "ar" ? "المجموع الفرعي" : "Zwischensumme"}</span>
                <span className="font-bold text-gray-800">{subtotal.toFixed(2)} {currencySymbol}</span>
              </div>
              {orderType === "delivery" && (
                <div className="flex justify-between">
                  <span>{language === "ar" ? "رسوم التوصيل" : "Liefergebühr"}</span>
                  <span className="font-bold text-gray-800">+{deliveryFee.toFixed(2)} {currencySymbol}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>{language === "ar" ? "خصم يدوي" : "Rabatt"}</span>
                  <span className="font-bold">-{discountAmount.toFixed(2)} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                <span>{language === "ar" ? "المجموع الكلي" : "Gesamtsumme"}</span>
                <span className="text-orange-600">{total.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>

            {/* Status alerts */}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 text-xs font-semibold flex items-center gap-1.5">
                <Check size={14} className="text-emerald-500" />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-3 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-500" />
                {errorMsg}
              </div>
            )}

            {/* Place Order Button */}
            <button
              onClick={handlePlaceOrder}
              disabled={submitting || cart.length === 0}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white disabled:text-gray-400 font-bold uppercase rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 text-xs tracking-wider"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{language === "ar" ? "جار معالجة الطلب..." : "Wird verarbeitet..."}</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{language === "ar" ? "تأكيد وإرسال الطلب" : "Bestellung abschicken"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: Modifier Selections */}
      {selectedItemForMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 animate-scale-in">
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-orange-500">
              <div>
                <h4 className="text-sm font-bold">{text(selectedItemForMod.name)}</h4>
                <p className="text-[10px] text-slate-400">
                  {language === "ar" ? "تعديل وتخصيص الوجبة" : "Artikel anpassen"}
                </p>
              </div>
              <button
                onClick={() => setSelectedItemForMod(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Modifier Groups */}
              {selectedItemForMod.modifierGroups && selectedItemForMod.modifierGroups.map((group) => {
                const selections = modSelections[group.id] || [];
                const isGroupFilled = group.isRequired ? selections.length >= (group.minSelections || 1) : true;
                
                return (
                  <div key={group.id} className="space-y-2 pb-5 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-800">{text(group.name)}</span>
                        {group.isRequired ? (
                          <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-bold">
                            {language === "ar" ? "مطلوب" : "Pflichtfeld"}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-50 text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded-full">
                            {language === "ar" ? "اختياري" : "Optional"}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {group.type === "single" 
                          ? (language === "ar" ? "اختيار واحد" : "Einzelwahl") 
                          : (group.maxSelections 
                              ? `${language === "ar" ? "أقصى حد:" : "Max:"} ${group.maxSelections}` 
                              : (language === "ar" ? "اختيارات متعددة" : "Mehrfachwahl")
                            )}
                      </span>
                    </div>

                    {/* Modifier options grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.options.map((option) => {
                        const isSelected = selections.some((o) => o.id === option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSelectModifier(group, option)}
                            className={`p-3 rounded-xl border text-xs text-left font-semibold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? "bg-orange-50 border-orange-200 text-orange-700"
                                : "bg-slate-50 border-gray-200 text-gray-600 hover:bg-slate-100"
                            }`}
                          >
                            <span className="truncate">{text(option.name)}</span>
                            <span className="text-[10px] font-bold text-orange-600 shrink-0 ml-2">
                              {option.priceAdjustment > 0 ? `+${option.priceAdjustment.toFixed(2)}` : "0.00"} {currencySymbol}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Upsell Suggestions */}
              {selectedItemForMod.upsellSuggestions && selectedItemForMod.upsellSuggestions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 border-b border-gray-100 pb-2">
                    <span>🎁</span>
                    <span>{language === "ar" ? "وجبات مقترحة إضافية" : "Zusatzangebote (Upsell)"}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedItemForMod.upsellSuggestions.map((suggestion) => {
                      const isSelected = !!activeUpsellSelections[suggestion.id];
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleUpsellToggle(suggestion.id)}
                          className={`p-3 rounded-xl border text-xs text-left font-semibold flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? "bg-purple-50 border-purple-200 text-purple-700"
                              : "bg-slate-50 border-gray-200 text-gray-600 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="block truncate font-bold">{text(suggestion.suggestedItemName)}</span>
                            {suggestion.description && (
                              <span className="block text-[10px] text-gray-400 font-medium truncate mt-0.5">
                                {text(suggestion.description)}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-purple-600 shrink-0 ml-2">
                            +{suggestion.price.toFixed(2)} {currencySymbol}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Controls + Add Button) */}
            <div className="bg-slate-50 p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Quantity selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-semibold">
                  {language === "ar" ? "الكمية:" : "Menge:"}
                </span>
                <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => setModQuantity(q => Math.max(1, q - 1))}
                    className="p-1.5 hover:bg-slate-50 text-gray-500 hover:text-gray-800 rounded-lg transition"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-bold px-3 text-gray-800">{modQuantity}</span>
                  <button
                    onClick={() => setModQuantity(q => q + 1)}
                    className="p-1.5 hover:bg-slate-50 text-gray-500 hover:text-gray-800 rounded-lg transition"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Total + Action button */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block leading-none">
                    {language === "ar" ? "إجمالي الوجبة" : "Einzelpreis"}
                  </span>
                  <span className="text-xs font-extrabold text-gray-800">
                    {((selectedItemForMod.basePrice + getModSelectionsPrice()) * modQuantity).toFixed(2)} {currencySymbol}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={handleAddCustomizedItemToCart}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 uppercase tracking-wider transition cursor-pointer"
                >
                  {language === "ar" ? "إضافة إلى السلة" : "Hinzufügen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
