import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { MenuItem, Category, OrderItem, ModifierGroup, ModifierOption } from "../types";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Globe, 
  Utensils, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Flame, 
  MessageSquare, 
  Menu as MenuIcon, 
  X, 
  Check, 
  Instagram, 
  Facebook, 
  Lock,
  MessageCircle
} from "lucide-react";

// Local static dictionary for brand website
const siteT = {
  de: {
    heroOrder: "Online bestellen",
    heroChat: "Mit WhatsApp Chatten",
    menuTitle: "Unsere Speisekarte",
    menuSubtitle: "Frisch zubereitet aus besten Zutaten",
    aboutTitle: "Über Uns",
    aboutSubtitle: "Authentische Küche mit Leidenschaft",
    reviewsTitle: "Gästebewertungen",
    reviewsSubtitle: "Was unsere Besucher über uns schreiben",
    contactTitle: "Kontakt & Öffnungszeiten",
    contactOpen: "Jetzt geöffnet",
    contactClosed: "Derzeit geschlossen",
    contactAddress: "Adresse",
    contactPhone: "Telefon",
    contactEmail: "E-Mail",
    cartTitle: "Ihre Auswahl",
    cartEmpty: "Ihr Warenkorb ist leer.",
    checkoutBtn: "Per WhatsApp bestellen",
    itemAdded: "Hinzugefügt!",
    bestseller: "Beliebt",
    spicy: "Scharf",
    adminLink: "Admin-Bereich",
    imprint: "Impressum",
    privacy: "Datenschutz",
    close: "Schließen",
    quantity: "Menge",
    add: "In den Warenkorb",
    notes: "Besondere Wünsche / Notizen",
    customerName: "Ihr Name (für die Bestellung)",
    pickupTime: "Gewünschte Abholzeit"
  },
  ar: {
    heroOrder: "اطلب أونلاين",
    heroChat: "تواصل عبر واتساب",
    menuTitle: "قائمة طعامنا",
    menuSubtitle: "محضرة طازجة من أفضل المكونات",
    aboutTitle: "من نحن",
    aboutSubtitle: "شغف الطعم الشامي الأصيل",
    reviewsTitle: "آراء العملاء",
    reviewsSubtitle: "ماذا يقول زبائننا الكرام عن وجباتنا",
    contactTitle: "الاتصال وساعات العمل",
    contactOpen: "مفتوح الآن",
    contactClosed: "مغلق حالياً",
    contactAddress: "العنوان",
    contactPhone: "الهاتف",
    contactEmail: "البريد الإلكتروني",
    cartTitle: "سلة طلباتك",
    cartEmpty: "السلة فارغة حالياً.",
    checkoutBtn: "إرسال الطلب عبر واتساب",
    itemAdded: "تمت الإضافة!",
    bestseller: "الأكثر طلباً",
    spicy: "حار",
    adminLink: "بوابة المشرف",
    imprint: "إخلاء المسؤولية",
    privacy: "الخصوصية",
    close: "إغلاق",
    quantity: "الكمية",
    add: "إضافة للسلة",
    notes: "ملاحظات خاصة للمطبخ",
    customerName: "الاسم الكريم",
    pickupTime: "وقت الاستلام المفضل"
  },
  en: {
    heroOrder: "Order Online",
    heroChat: "Chat via WhatsApp",
    menuTitle: "Our Menu",
    menuSubtitle: "Freshly prepared with premium ingredients",
    aboutTitle: "About Us",
    aboutSubtitle: "Authentic cuisine made with passion",
    reviewsTitle: "Guest Testimonials",
    reviewsSubtitle: "What our lovely customers say about us",
    contactTitle: "Contact & Hours",
    contactOpen: "Open Now",
    contactClosed: "Currently Closed",
    contactAddress: "Address",
    contactPhone: "Phone",
    contactEmail: "Email",
    cartTitle: "Your Selection",
    cartEmpty: "Your cart is empty.",
    checkoutBtn: "Order via WhatsApp",
    itemAdded: "Added!",
    bestseller: "Bestseller",
    spicy: "Spicy",
    adminLink: "Admin Dashboard",
    imprint: "Imprint",
    privacy: "Privacy Policy",
    close: "Close",
    quantity: "Quantity",
    add: "Add to Cart",
    notes: "Special Requests / Notes",
    customerName: "Your Name",
    pickupTime: "Preferred Pickup Time"
  }
};

interface RestaurantBranding {
  name: string;
  legalName?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  defaultCurrency?: string;
  timezone?: string;
  heroTagline?: { ar: string; de: string; en: string };
  heroBannerImage?: string;
  aboutText?: { ar: string; de: string; en: string };
  socialInstagram?: string;
  socialFacebook?: string;
  socialTikTok?: string;
}

interface Review {
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function BrandWebsite() {
  const { language, setLanguage, t, text, dir } = useI18n();
  const localized = siteT[language] || siteT.de;

  // States
  const [restaurant, setRestaurant] = useState<RestaurantBranding | null>(null);
  const [branch, setBranch] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  
  // Cart & Modifiers states
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  const [selectedItemForMod, setSelectedItemForMod] = useState<MenuItem | null>(null);
  const [modSelections, setModSelections] = useState<Record<string, ModifierOption[]>>({});
  const [modQuantity, setModQuantity] = useState(1);

  // Review Slider State
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Realtime Open Status
  const [isOpenNow, setIsOpenNow] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      // 1. Fetch public config & menu
      const [configRes, menuRes, reviewsRes] = await Promise.all([
        fetch("/api/public/config"),
        fetch("/api/public/menu"),
        fetch("/api/public/feedbacks")
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setRestaurant(configData);
        if (configData.primaryColor) {
          document.documentElement.style.setProperty("--brand-primary", configData.primaryColor);
        }
        if (configData.secondaryColor) {
          document.documentElement.style.setProperty("--brand-secondary", configData.secondaryColor);
        }
      }

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setCategories(menuData.categories || []);
        setMenuItems(menuData.menuItems || []);
        setBranch(menuData.branch || null);
      }

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData);
      }
    } catch (err) {
      console.error("Failed to fetch public brand site data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check Open/Closed status reactive logic
  useEffect(() => {
    if (!branch) return;
    const checkOpenStatus = () => {
      const isCurrentlyOpen = isOpen(branch.openingHours, restaurant?.timezone || "Europe/Berlin");
      setIsOpenNow(isCurrentlyOpen);
    };

    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [branch, restaurant]);

  // Dynamic Open Calculation helper
  const isOpen = (openingHoursStr: string, timezone: string): boolean => {
    try {
      if (!openingHoursStr) return false;
      const parts = openingHoursStr.split("-");
      if (parts.length !== 2) return false;

      const now = new Date();
      const localTimeStr = now.toLocaleTimeString("en-US", { timeZone: timezone, hour12: false });
      const [currH, currM] = localTimeStr.split(":").map(Number);
      const currMinutes = currH * 60 + currM;

      const [startH, startM] = parts[0].trim().split(":").map(Number);
      const [endH, endM] = parts[1].trim().split(":").map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (endMinutes < startMinutes) {
        // Handles overnight hours, e.g. 18:00 - 02:00
        return currMinutes >= startMinutes || currMinutes <= endMinutes;
      }

      return currMinutes >= startMinutes && currMinutes <= endMinutes;
    } catch (err) {
      console.error("Error computing open state:", err);
      return false;
    }
  };

  // Star Rating elements generator
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, idx) => (
      <Star 
        key={idx} 
        size={14} 
        className={idx < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} 
      />
    ));
  };

  // Scroll to section helper
  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80; // height of navbar
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Add Item to Cart
  const handleQuickAdd = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setSelectedItemForMod(item);
      setModSelections({});
      setModQuantity(1);
    } else {
      const orderItem: OrderItem = {
        itemId: item.id,
        name: item.name,
        basePrice: item.basePrice,
        quantity: 1,
        totalPrice: item.basePrice,
        selectedModifiers: []
      };
      addToCartState(orderItem);
    }
  };

  const handleOpenItemDetails = (item: MenuItem) => {
    setSelectedItemForMod(item);
    setModSelections({});
    setModQuantity(1);
  };

  const getSelectedModsAdjustment = () => {
    if (!selectedItemForMod) return 0;
    let extraPrice = 0;
    Object.keys(modSelections).forEach((groupId) => {
      const group = (selectedItemForMod.modifierGroups || []).find(g => g.id === groupId);
      const options = modSelections[groupId];
      if (group && options) {
        options.forEach(opt => {
          extraPrice += opt.priceAdjustment || 0;
        });
      }
    });
    return extraPrice;
  };

  const handleSelectModifier = (group: ModifierGroup, option: ModifierOption) => {
    const current = modSelections[group.id] || [];
    if (group.type === "single") {
      setModSelections({ ...modSelections, [group.id]: [option] });
    } else {
      const exists = current.some((o) => o.id === option.id);
      let updated;
      if (exists) {
        updated = current.filter((o) => o.id !== option.id);
      } else {
        if (group.maxSelections && current.length >= group.maxSelections) {
          // Remove the first selected one and append the new one
          updated = [...current.slice(1), option];
        } else {
          updated = [...current, option];
        }
      }
      setModSelections({ ...modSelections, [group.id]: updated });
    }
  };

  const handleAddToCartFromModifiers = () => {
    if (!selectedItemForMod) return;

    // Validate required selections
    for (const group of (selectedItemForMod.modifierGroups || [])) {
      if (group.isRequired) {
        const selections = modSelections[group.id] || [];
        if (selections.length === 0) {
          alert(language === "ar" 
            ? `الرجاء تحديد خيار للمجموعة: ${text(group.name)}`
            : `Bitte wählen Sie Optionen für ${text(group.name)}`
          );
          return;
        }
      }
    }

    // Prepare selections list
    const selectedModsList: any[] = [];
    let extraPrice = 0;

    Object.keys(modSelections).forEach((groupId) => {
      const group = (selectedItemForMod.modifierGroups || []).find(g => g.id === groupId);
      const options = modSelections[groupId];
      if (group && options) {
        options.forEach(opt => {
          selectedModsList.push({
            groupId: group.id,
            groupName: group.name,
            option: opt
          });
          extraPrice += opt.priceAdjustment || 0;
        });
      }
    });

    const itemPrice = selectedItemForMod.basePrice + extraPrice;

    const orderItem: OrderItem = {
      itemId: selectedItemForMod.id,
      name: selectedItemForMod.name,
      basePrice: selectedItemForMod.basePrice,
      quantity: modQuantity,
      totalPrice: itemPrice,
      selectedModifiers: selectedModsList
    };

    addToCartState(orderItem);
    setSelectedItemForMod(null);
  };

  const addToCartState = (orderItem: OrderItem) => {
    // Check if duplicate item exists (same id and same selections)
    const duplicateIdx = cart.findIndex((i) => {
      if (i.itemId !== orderItem.itemId) return false;
      if (i.selectedModifiers?.length !== orderItem.selectedModifiers?.length) return false;
      
      const m1 = i.selectedModifiers || [];
      const m2 = orderItem.selectedModifiers || [];
      return m1.every((mod) => m2.some((m) => m.option.id === mod.option.id));
    });

    if (duplicateIdx >= 0) {
      const updated = [...cart];
      updated[duplicateIdx].quantity += orderItem.quantity;
      setCart(updated);
    } else {
      setCart([...cart, orderItem]);
    }
  };

  const updateQuantity = (idx: number, delta: number) => {
    const updated = [...cart];
    updated[idx].quantity += delta;
    if (updated[idx].quantity <= 0) {
      setCart(updated.filter((_, i) => i !== idx));
    } else {
      setCart(updated);
    }
  };

  const getCheckoutTotal = () => {
    return cart.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0);
  };

  // Launch prefilled checkout text directly into wa.me
  const handlePlaceOrder = () => {
    if (cart.length === 0) return;

    const isDelivery = orderType === "delivery";

    let message = "";
    if (language === "ar") {
      message += `*طلب جديد من الموقع الإلكتروني (${isDelivery ? "توصيل" : "استلام"})*\n\n`;
    } else if (language === "en") {
      message += `*New Order from Brand Website (${isDelivery ? "Delivery" : "Pickup"})*\n\n`;
    } else {
      message += `*Neue Bestellung über die Webseite (${isDelivery ? "Lieferung" : "Abholung"})*\n\n`;
    }

    cart.forEach(item => {
      message += `• ${item.quantity}x ${text(item.name)}`;
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        const mods = item.selectedModifiers.map(m => text(m.option.name)).join(", ");
        message += ` (${mods})`;
      }
      message += ` - ${(item.totalPrice * item.quantity).toFixed(2)} €\n`;
    });

    const deliveryFee = isDelivery ? (branch?.deliveryFee || 0) : 0;
    const subtotal = getCheckoutTotal();
    const total = subtotal + deliveryFee;

    message += `\n`;
    if (isDelivery && deliveryFee > 0) {
      message += `Subtotal: ${subtotal.toFixed(2)} €\n`;
      message += `Delivery Fee: ${deliveryFee.toFixed(2)} €\n`;
    }
    message += `*Total: ${total.toFixed(2)} €*\n\n`;

    if (customerName.trim()) {
      message += `Name: ${customerName.trim()}\n`;
    }
    if (customerPhone.trim()) {
      message += `Phone: ${customerPhone.trim()}\n`;
    }
    if (isDelivery) {
      if (deliveryAddress.trim()) {
        message += `Address: ${deliveryAddress.trim()}\n`;
      }
    } else {
      if (pickupTime.trim()) {
        message += `Time: ${pickupTime.trim()}\n`;
      }
    }
    if (notes.trim()) {
      message += `Notes: ${notes.trim()}\n`;
    }

    const waNumber = restaurant?.whatsappNumber || branch?.whatsappNumber || "";
    const cleanNumber = waNumber.replace(/[^0-9]/g, "");

    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleDirectCheckout = () => {
    if (cart.length === 0) return;
    if (!customerPhone.trim()) {
      alert(language === "ar" ? "رقم الهاتف مطلوب" : "Telefonnummer ist erforderlich");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      alert(language === "ar" ? "عنوان التوصيل مطلوب" : "Lieferadresse ist erforderlich");
      return;
    }
    if (orderType === "pickup" && !pickupTime.trim()) {
      alert(language === "ar" ? "وقت الاستلام مطلوب" : "Abholzeit ist erforderlich");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      branchId: branch?._id || "",
      customerName: customerName.trim() || undefined,
      whatsAppPhone: customerPhone.trim(),
      orderType,
      deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
      pickupTime: orderType === "pickup" ? pickupTime.trim() : undefined,
      notes: notes.trim() || undefined,
      items: cart.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        selectedModifiers: item.selectedModifiers?.map(m => ({
          groupId: m.groupId,
          optionId: m.option.id
        })) || [],
        selectedUpsell: item.selectedUpsell ? {
          id: item.selectedUpsell.id,
          added: true
        } : undefined
      }))
    };

    fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          return res.json().then(data => { throw new Error(data.error || "Failed to place order"); });
        }
      })
      .then(data => {
        setPlacedOrder(data);
        setCart([]); // clear cart
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setPickupTime("");
        setNotes("");
      })
      .catch(err => {
        console.error(err);
        alert(err.message || "Failed to place order.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleWhatsAppRedirect = () => {
    const waNumber = restaurant?.whatsappNumber || branch?.whatsappNumber || "";
    const cleanNumber = waNumber.replace(/[^0-9]/g, "");
    const welcomeText = language === "ar" ? "مرحباً! أود طلب الطعام" : "Hallo! Ich möchte gerne bestellen.";
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(welcomeText)}`;
    window.open(url, "_blank");
  };

  // Carousel slider navigations
  const prevReview = () => {
    setActiveReviewIdx((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const nextReview = () => {
    setActiveReviewIdx((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
  };

  // Auto scroll testimonials
  useEffect(() => {
    if (reviews.length === 0) return;
    const interval = setInterval(nextReview, 6000000000000000000000); // very large number to not auto scroll during testing, but we can do normal 8s
    const activeInterval = setInterval(nextReview, 8000);
    return () => clearInterval(activeInterval);
  }, [reviews]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-primary border-t-transparent animate-spin"></div>
        <p className="text-xs font-mono text-slate-400 mt-4">Loading Brand Website...</p>
      </div>
    );
  }

  const brandName = restaurant?.name || "MR. TABBOUSH";
  const heroTaglineText = restaurant?.heroTagline ? text(restaurant.heroTagline) : "Syrian Fine Dining & Authentic Charcoal Grills";
  const aboutBodyText = restaurant?.aboutText ? text(restaurant.aboutText) : "";
  const logoSrc = restaurant?.logo || "";
  const heroBanner = restaurant?.heroBannerImage || "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&auto=format&fit=crop&q=80";
  const address = branch?.address || restaurant?.address || "";

  return (
    <div dir={dir} className="min-h-screen bg-white text-slate-800 font-sans flex flex-col scroll-smooth">
      
      {/* 1. Transparent Floating Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            {logoSrc ? (
              <img src={logoSrc} alt={brandName} className="w-10 h-10 rounded-xl object-cover shadow border border-slate-100 rotate-[-2deg]" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center font-bold text-xl rotate-[-2deg] shadow">
                🌯
              </div>
            )}
            <span className="font-serif font-bold text-lg tracking-tight uppercase text-slate-900">{brandName}</span>
          </div>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <button onClick={() => scrollToSection("menu")} className="hover:text-brand-primary transition">
              {localized.menuTitle}
            </button>
            <button onClick={() => scrollToSection("about")} className="hover:text-brand-primary transition">
              {localized.aboutTitle}
            </button>
            {reviews.length > 0 && (
              <button onClick={() => scrollToSection("testimonials")} className="hover:text-brand-primary transition">
                {localized.reviewsTitle}
              </button>
            )}
            <button onClick={() => scrollToSection("location")} className="hover:text-brand-primary transition">
              {localized.contactTitle}
            </button>
          </nav>

          {/* Header Action CTAs */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              {(["de", "ar", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition ${
                    language === lang 
                      ? "bg-brand-primary text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Cart Button */}
            {cart.length > 0 && (
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 bg-brand-primary text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition"
              >
                <ShoppingBag size={16} />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[9px] font-bold">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            >
              {isMobileMenuOpen ? <X size={22} /> : <MenuIcon size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 p-4 space-y-3 flex flex-col font-bold text-slate-700 animate-slide-up">
            <button onClick={() => scrollToSection("menu")} className="text-left py-2 hover:text-brand-primary">
              {localized.menuTitle}
            </button>
            <button onClick={() => scrollToSection("about")} className="text-left py-2 hover:text-brand-primary">
              {localized.aboutTitle}
            </button>
            {reviews.length > 0 && (
              <button onClick={() => scrollToSection("testimonials")} className="text-left py-2 hover:text-brand-primary">
                {localized.reviewsTitle}
              </button>
            )}
            <button onClick={() => scrollToSection("location")} className="text-left py-2 hover:text-brand-primary">
              {localized.contactTitle}
            </button>
          </div>
        )}
      </header>

      {/* 2. Hero Presentation Banner Section */}
      <section className="relative pt-24 min-h-[85vh] flex items-center bg-slate-950 text-white overflow-hidden">
        {/* Background Banner with Parallax-feel overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBanner} 
            alt="Hero Banner" 
            className="w-full h-full object-cover opacity-35 scale-105 transition duration-1000 transform"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
          {isOpenNow ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full shadow-sm animate-pulse-subtle">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {localized.contactOpen}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              {localized.contactClosed}
            </span>
          )}

          <h1 className="text-4xl md:text-6xl font-serif font-extrabold tracking-tight leading-none">
            {brandName}
          </h1>

          <p className="text-lg md:text-2xl font-light text-slate-300 max-w-2xl mx-auto italic font-serif leading-relaxed">
            "{heroTaglineText}"
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => scrollToSection("menu")}
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition hover:scale-105 active:scale-95 shadow-lg shadow-brand-primary/25 cursor-pointer"
            >
              <Utensils size={18} />
              {localized.heroOrder}
              <ArrowRight size={16} className={dir === "rtl" ? "rotate-180" : ""} />
            </button>
            <button 
              onClick={handleWhatsAppRedirect}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <MessageCircle size={18} className="text-emerald-400 animate-pulse" />
              {localized.heroChat}
            </button>
          </div>
        </div>

        {/* Dynamic bottom waves decorative divider */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white transform translate-y-1 select-none pointer-events-none" style={{ clipPath: "ellipse(60% 80% at 50% 100%)" }}></div>
      </section>

      {/* 3. Live Menu Section */}
      <section id="menu" className="py-16 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 space-y-8">
          
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-serif font-bold tracking-tight text-slate-900">{localized.menuTitle}</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">{localized.menuSubtitle}</p>
          </div>

          {/* Sticky Tab Category Bar */}
          <div className="sticky top-16 z-30 bg-white/95 backdrop-blur py-3 flex gap-2 overflow-x-auto scrollbar-none border-b border-slate-100 select-none">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                activeCategory === "all"
                  ? "bg-slate-900 border-slate-900 text-white shadow-md"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {language === "ar" ? "كل الأصناف" : "Alle Speisen"}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                  activeCategory === cat.id
                    ? "bg-slate-900 border-slate-900 text-white shadow-md"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {text(cat.name)}
              </button>
            ))}
          </div>

          {/* Menu Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {menuItems
              .filter(item => item.isActive !== false && (activeCategory === "all" || item.categoryId === activeCategory))
              .map((item) => (
                <div 
                  key={item.id}
                  className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-4 hover:scale-[1.02] hover:shadow-md hover:border-brand-primary/10 transition-all duration-300 group cursor-pointer"
                  onClick={() => handleOpenItemDetails(item)}
                >
                  {/* Item Image */}
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={text(item.name)} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Utensils size={28} />
                      </div>
                    )}
                    {item.isBestSeller && (
                      <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 shadow-sm animate-pulse-subtle">
                        <Flame size={8} /> {localized.bestseller.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-brand-primary transition-colors flex items-center gap-2">
                        {text(item.name)}
                        {item.isSpicy && (
                          <span className="text-[8px] bg-red-550/10 text-red-600 border border-red-200/50 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5">
                            🔥 {localized.spicy}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {text(item.description)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-2">
                      <span className="font-mono text-sm font-bold text-brand-primary">
                        {item.basePrice.toFixed(2)} €
                      </span>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(item);
                        }}
                        className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white text-[10px] font-bold rounded-xl flex items-center gap-1 transition shadow-sm hover:shadow active:scale-90 cursor-pointer"
                      >
                        <Plus size={11} className="stroke-[3px]" />
                        {localized.add}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

        </div>
      </section>

      {/* 4. Brand Narrative Story Section */}
      <section id="about" className="py-16 bg-slate-50 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
          
          <div className="md:col-span-6 space-y-5">
            <span className="text-xs font-bold text-brand-primary tracking-widest uppercase block font-mono">
              {localized.aboutTitle}
            </span>
            <h2 className="text-3xl font-serif font-bold tracking-tight text-slate-900">
              {localized.aboutSubtitle}
            </h2>
            <p className="text-slate-650 text-sm leading-relaxed whitespace-pre-line font-light">
              {aboutBodyText || "We craft authentic Levant dishes prepared over wood embers, with fresh herbs and home-made signature recipes passed down through generations."}
            </p>
            
            <div className="pt-2 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-500" />
                <span>100% Halal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-500" />
                <span>Fresh Ingredients</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-500" />
                <span>Charcoal Smoked</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-video md:aspect-square">
              <img 
                src="https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80" 
                alt="Grill cuisine" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent"></div>
            </div>
            {/* Background design dots */}
            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-brand-primary/10 rounded-full blur-xl pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* 5. Star Reviews Section */}
      {reviews.length > 0 && (
        <section id="testimonials" className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-8 select-none">
            
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-bold tracking-tight text-slate-900">{localized.reviewsTitle}</h2>
              <p className="text-sm text-slate-500">{localized.reviewsSubtitle}</p>
            </div>

            {/* Carousel display */}
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 md:p-12 shadow-sm relative min-h-[180px] flex flex-col justify-between transition-all duration-300">
              <div className="absolute top-6 left-6 text-slate-200 font-serif text-6xl">“</div>
              
              <div className="space-y-4 relative z-10">
                <div className="flex justify-center gap-0.5">
                  {renderStars(reviews[activeReviewIdx].rating)}
                </div>
                
                <p className="text-base font-light text-slate-700 italic max-w-xl mx-auto leading-relaxed">
                  "{reviews[activeReviewIdx].comment}"
                </p>

                <div className="text-xs font-bold text-slate-900 mt-4 font-serif uppercase tracking-wider">
                  — {reviews[activeReviewIdx].customerName}
                </div>
              </div>

              {/* Slider actions */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <button 
                  onClick={prevReview}
                  className="w-8 h-8 rounded-full bg-white border border-slate-250 flex items-center justify-center text-slate-650 hover:text-brand-primary hover:border-brand-primary/30 hover:scale-105 active:scale-95 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                  {activeReviewIdx + 1} / {reviews.length}
                </span>
                <button 
                  onClick={nextReview}
                  className="w-8 h-8 rounded-full bg-white border border-slate-250 flex items-center justify-center text-slate-650 hover:text-brand-primary hover:border-brand-primary/30 hover:scale-105 active:scale-95 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* 6. Contact & Timing Hours Section */}
      <section id="location" className="py-16 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Info card */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 md:p-8 space-y-6">
            <h2 className="text-2xl font-serif font-bold text-slate-900">{localized.contactTitle}</h2>
            
            <div className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{localized.contactAddress}</h4>
                  <p className="text-slate-800 mt-0.5">{branch?.address || restaurant?.address || "Wuppertal, Germany"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{localized.contactPhone}</h4>
                  <p className="text-slate-800 mt-0.5">{branch?.phone || restaurant?.phone || ""}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{localized.contactEmail}</h4>
                  <p className="text-slate-800 mt-0.5">{branch?.email || restaurant?.email || ""}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-slate-100 pt-4">
                <Clock size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Business Hours</h4>
                  <p className="text-slate-800 mt-0.5 font-mono">{branch?.openingHours || "12:00 - 22:30"}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-light">Daily service Monday - Sunday</p>
                </div>
              </div>
            </div>
          </div>

          {/* Embedded maps simulator */}
          <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-md relative min-h-[300px] bg-slate-50">
            {address ? (
              <iframe
                title="Map Location"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0, minHeight: "300px" }}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                allowFullScreen
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <MapPin size={40} className="text-brand-primary animate-bounce" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900">{brandName} Location</h4>
                  <p className="text-xs text-slate-500 max-w-xs">Address not configured</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* 7. Slide-Out Shopping Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-stretch md:justify-end">
          <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-t-none flex flex-col h-[85vh] md:h-screen shadow-2xl overflow-hidden animate-slide-up">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-brand-primary" />
                <h3 className="font-bold text-sm text-slate-900">{localized.cartTitle}</h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-650 bg-white border border-slate-200 rounded-lg text-xs font-bold transition select-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {placedOrder ? (
                <div className="py-8 text-center space-y-5 animate-scale-in">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm animate-pulse-subtle">
                    <Check size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-slate-950">
                      {language === "ar" ? "تم استلام طلبك بنجاح!" : "Bestellung erfolgreich empfangen!"}
                    </h3>
                    <p className="text-xs text-slate-500 px-6 leading-relaxed">
                      {language === "ar" 
                        ? `طلبك رقم ${placedOrder.orderNumber} تم إرساله مباشرة لمطبخ المطعم للتحضير.`
                        : `Ihre Bestellnummer ist ${placedOrder.orderNumber}. Sie wurde direkt in die Küche übertragen.`}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl inline-flex flex-col gap-1.5 text-xs text-slate-700 min-w-[200px] mx-auto select-text">
                    <div className="flex justify-between font-medium gap-4">
                      <span>Total:</span>
                      <span className="font-mono font-bold text-brand-primary">{placedOrder.total.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Method:</span>
                      <span className="font-semibold">{placedOrder.paymentMethod}</span>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => {
                        setPlacedOrder(null);
                        setIsCartOpen(false);
                      }}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {language === "ar" ? "موافق" : "Fertig"}
                    </button>
                  </div>
                </div>
              ) : cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ShoppingBag size={36} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold">{localized.cartEmpty}</p>
                </div>
              ) : (
                <>
                  {/* Order Type Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setOrderType("delivery")}
                      className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        orderType === "delivery"
                          ? "bg-brand-primary text-white shadow"
                          : "text-slate-500 hover:text-slate-850"
                      }`}
                    >
                      {language === "ar" ? "توصيل" : language === "en" ? "Delivery" : "Lieferung"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("pickup")}
                      className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        orderType === "pickup"
                          ? "bg-brand-primary text-white shadow"
                          : "text-slate-500 hover:text-slate-855"
                      }`}
                    >
                      {language === "ar" ? "استلام" : language === "en" ? "Pickup" : "Abholung"}
                    </button>
                  </div>

                  {cart.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{text(item.name)}</h4>
                          {(item.selectedModifiers || []).map((m, mIdx) => (
                            <span key={mIdx} className="text-[10px] text-slate-400 block mt-0.5">
                              └ {text(m.groupName)}: {text(m.option.name)}
                            </span>
                          ))}
                        </div>
                        <span className="font-mono text-xs font-bold text-brand-primary">
                          {(item.totalPrice * item.quantity).toFixed(2)} €
                        </span>
                      </div>

                      {/* Quantity toggle */}
                      <div className="flex justify-between items-center border-t border-slate-200/50 pt-2.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{localized.quantity}</span>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 gap-2">
                          <button 
                            onClick={() => updateQuantity(idx, -1)}
                            className="p-1 text-slate-500 hover:text-red-500 transition active:scale-90"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="font-mono font-bold text-xs min-w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(idx, 1)}
                            className="p-1 text-slate-500 hover:text-brand-primary transition active:scale-90"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Checkout inputs */}
                  <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1">{localized.customerName}</label>
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="z.B. Alexander"
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-brand-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1">
                        {language === "ar" ? "رقم الهاتف" : language === "en" ? "Phone Number" : "Telefonnummer"} *
                      </label>
                      <input 
                        type="tel" 
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="z.B. +49176..."
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-brand-primary"
                      />
                    </div>

                    {orderType === "delivery" ? (
                      <div>
                        <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">
                          {language === "ar" ? "عنوان التوصيل" : language === "en" ? "Delivery Address" : "Lieferadresse"} *
                        </label>
                        <input 
                          type="text" 
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="z.B. Berliner Str. 179, Wuppertal"
                          required
                          className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">{localized.pickupTime} *</label>
                        <input 
                          type="text" 
                          value={pickupTime}
                          onChange={(e) => setPickupTime(e.target.value)}
                          placeholder="z.B. 19:30"
                          required
                          className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">{localized.notes}</label>
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="z.B. Extra Knoblauchsoße..."
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-brand-primary h-16 resize-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && !placedOrder && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-800 font-bold">
                  <span>Subtotal</span>
                  <span className="font-mono text-sm font-bold text-brand-primary">{getCheckoutTotal().toFixed(2)} €</span>
                </div>

                <button 
                  onClick={handleDirectCheckout}
                  disabled={isSubmitting}
                  className="w-full bg-brand-primary hover:bg-brand-primary/95 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></span>
                  ) : (
                    <ShoppingBag size={14} />
                  )}
                  {language === "ar" ? "تأكيد وإرسال الطلب للمطبخ" : language === "en" ? "Confirm Order Direct (Web)" : "Direkt Bestellen (Web)"}
                </button>

                <button 
                  onClick={handlePlaceOrder}
                  className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm cursor-pointer"
                >
                  <MessageSquare size={14} className="text-emerald-400" />
                  {localized.checkoutBtn}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 8. Premium Product Detail Modal */}
      {selectedItemForMod && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-t-3xl rounded-b-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-slate-100">
            
            {/* Cover Image Header */}
            {selectedItemForMod.image ? (
              <div className="relative w-full h-48 bg-slate-100 shrink-0 border-b border-slate-100">
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
                    <Flame size={8} /> {localized.bestseller.toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full h-12 bg-slate-50 shrink-0 border-b border-slate-150 flex items-center justify-between px-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Details</span>
                <button 
                  onClick={() => setSelectedItemForMod(null)}
                  className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs hover:bg-slate-300 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Title & Info Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50 shrink-0">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2">
                  {text(selectedItemForMod.name)}
                  {selectedItemForMod.isSpicy && (
                    <span className="text-[8px] bg-red-50 text-red-650 border border-red-150 px-1.5 py-0.5 rounded font-extrabold">
                      🔥 {localized.spicy}
                    </span>
                  )}
                </h3>
                <span className="text-xs font-mono text-brand-primary font-bold block">
                  {selectedItemForMod.basePrice.toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Scrollable details body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Description box */}
              {text(selectedItemForMod.description) && (
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                  {text(selectedItemForMod.description)}
                </p>
              )}

              {/* Modifier options selection */}
              {(selectedItemForMod.modifierGroups || []).map((group) => (
                <div key={group.id} className="space-y-2 border-b border-slate-50 pb-4 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {text(group.name)}
                      {group.isRequired && (
                        <span className="text-[8px] bg-red-50 text-red-650 border border-red-150 px-1.5 py-0.5 rounded font-extrabold uppercase">
                          Required
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-450 font-bold">
                      {group.type === "single" ? "Choose 1" : group.maxSelections ? `Max ${group.maxSelections}` : ""}
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
                              ? "border-brand-primary bg-brand-primary/5 text-slate-950 font-bold" 
                              : "border-slate-200 bg-white text-slate-650 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              selected ? "border-brand-primary bg-brand-primary text-white" : "border-slate-350"
                            }`}>
                              {selected && <Check size={10} className="stroke-[3px]" />}
                            </span>
                            {text(opt.name)}
                          </span>
                          {opt.priceAdjustment > 0 && (
                            <span className="font-mono text-[10px] font-bold text-brand-primary">
                              +{opt.priceAdjustment.toFixed(2)} €
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quantity Adjuster */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-bold text-slate-800">{localized.quantity}</span>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-3">
                  <button 
                    onClick={() => setModQuantity(q => Math.max(1, q - 1))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Minus size={11} className="stroke-[3px]" />
                  </button>
                  <span className="font-mono font-bold text-xs min-w-4 text-center">{modQuantity}</span>
                  <button 
                    onClick={() => setModQuantity(q => q + 1)}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Plus size={11} className="stroke-[3px]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Add Action */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button 
                onClick={handleAddToCartFromModifiers}
                className="w-full bg-brand-primary hover:bg-brand-primary/95 text-white font-bold py-3.5 rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{localized.add}</span>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <span>{((selectedItemForMod.basePrice + getSelectedModsAdjustment()) * modQuantity).toFixed(2)} €</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 9. Premium Footer */}
      <footer className="bg-slate-900 text-slate-450 border-t border-slate-800 py-12 text-xs select-none">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Logo & About */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center font-bold text-lg rotate-[-2deg]">
                🌯
              </div>
              <span className="font-serif font-extrabold text-base tracking-tight text-white uppercase">{brandName}</span>
            </div>
            <p className="text-[11px] font-light leading-relaxed max-w-xs">
              {aboutBodyText ? (aboutBodyText.substring(0, 120) + "...") : "Delicious dishes crafted with love and fresh ingredients."}
            </p>
          </div>

          {/* Site Navigation */}
          <div className="space-y-3 font-semibold text-slate-350">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Navigation</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button onClick={() => scrollToSection("menu")} className="text-left hover:text-white transition">{localized.menuTitle}</button>
              <button onClick={() => scrollToSection("about")} className="text-left hover:text-white transition">{localized.aboutTitle}</button>
              {reviews.length > 0 && (
                <button onClick={() => scrollToSection("testimonials")} className="text-left hover:text-white transition">{localized.reviewsTitle}</button>
              )}
              <button onClick={() => scrollToSection("location")} className="text-left hover:text-white transition">{localized.contactTitle}</button>
            </div>
          </div>

          {/* Social Links & Legal */}
          <div className="space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Connect & Legal</h4>
            <div className="flex items-center gap-3">
              {restaurant?.socialInstagram && (
                <a href={restaurant.socialInstagram} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-brand-primary text-slate-400 hover:text-white rounded-lg transition">
                  <Instagram size={16} />
                </a>
              )}
              {restaurant?.socialFacebook && (
                <a href={restaurant.socialFacebook} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-brand-primary text-slate-400 hover:text-white rounded-lg transition">
                  <Facebook size={16} />
                </a>
              )}
              {restaurant?.socialTikTok && (
                <a href={restaurant.socialTikTok} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-brand-primary text-slate-400 hover:text-white rounded-lg transition flex items-center justify-center font-bold font-sans">
                  TikTok
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-[10px] font-light text-slate-500">
              <a href="#" className="hover:text-white transition">{localized.imprint}</a>
              <a href="#" className="hover:text-white transition">{localized.privacy}</a>
              
              {/* Backoffice Admin entrance portal */}
              <a 
                href="/admin" 
                className="hover:text-white font-semibold flex items-center gap-1 transition text-slate-400"
              >
                <Lock size={10} />
                {localized.adminLink}
              </a>
            </div>
          </div>

        </div>

        {/* Corporate line */}
        <div className="max-w-5xl mx-auto px-4 mt-8 pt-8 border-t border-slate-800/60 text-center text-[10px] text-slate-600 font-light tracking-wide">
          <p>© 2026 {restaurant?.legalName || brandName}. All Rights Reserved.</p>
          <p className="mt-1">Powered by Farman GmbH White-Label Restaurant Cloud Suite</p>
        </div>
      </footer>

    </div>
  );
}
