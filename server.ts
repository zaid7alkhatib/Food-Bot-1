import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import path from "path";
import fs from "fs";
import http from "http";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { connectDB } from "./src/lib/db.js";
import { AuthenticatedRequest, authMiddleware, requireRole } from "./src/lib/auth.js";
import authRoutes from "./src/routes/auth.js";
import branchesRoutes from "./src/routes/branches.js";
import categoriesRoutes from "./src/routes/categories.js";
import reportsRoutes from "./src/routes/reports.js";
import settingsRoutes from "./src/routes/settings.js";
import { initSocket, emitGlobal, emitToRoom, getIO } from "./src/services/socket.js";
import { startCronJobs } from "./src/services/cron.js";
import { sendWhatsAppMessage, startWhatsAppSession, stopWhatsAppSession } from "./src/services/whatsapp.js";
import {
  Branch,
  Category,
  MenuItem,
  Order,
  Conversation,
  Campaign,
  Feedback,
  Restaurant,
  WhatsAppSession,
  Table,
  Reservation,
  Payment,
  PaymentTransaction,
} from "./src/models/index.js";
import { defaultCurrency, orderStatusMessages } from "./src/mockData.js";

// ------------------------------------------------------------------
// 1. Express + HTTP + Socket.io setup
// ------------------------------------------------------------------
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const app = express();
app.set("trust proxy", 1);
const httpServer = http.createServer(app);
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", apiLimiter);

// Initialize Socket.io
initSocket(httpServer);

// Start background cron jobs
startCronJobs();

// ------------------------------------------------------------------
// 2. Auth Routes
// ------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use(
  "/api/branches",
  authMiddleware as any,
  requireRole("super_admin", "restaurant_admin", "branch_manager") as any,
  branchesRoutes
);
app.use(
  "/api/menu/categories",
  authMiddleware as any,
  requireRole("super_admin", "restaurant_admin", "branch_manager") as any,
  categoriesRoutes
);
app.use(
  "/api/reports",
  authMiddleware as any,
  requireRole("super_admin", "restaurant_admin", "branch_manager") as any,
  reportsRoutes
);
app.use("/api/settings", authMiddleware as any, settingsRoutes);

// ------------------------------------------------------------------
// 3. Gemini lazy init
// ------------------------------------------------------------------
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value: unknown): string {
  return toFiniteNumber(value).toFixed(2);
}

function translatedText(value: any, lang: "ar" | "de" | "en" | "tr"): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.tr || value.de || value.en || value.ar || "";
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

async function geocodeAddress(addressText: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const encoded = encodeURIComponent(addressText);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MR-Tabboush-Whatsapp-Ordering-System/1.0",
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { latitude: lat, longitude: lon };
        }
      }
    }
  } catch (err) {
    console.error("[Geocode] Failed to geocode address:", addressText, err);
  }
  return null;
}

type CustomerLanguage = "ar" | "de" | "en" | "tr";

type BranchFulfillmentConfig = {
  branchId?: string;
  branchAddress: string;
  branchCity: string;
  branchName: string;
  restaurantName: string;
  legalName?: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minOrderAmount: number;
  branchLatitude?: number;
  branchLongitude?: number;
  orderPrefix?: string;
  openingHours?: string;
  closedDays?: number[];
  reservationEnabled: boolean;
};

const DEFAULT_BRANCH_CONFIG: BranchFulfillmentConfig = {
  branchAddress: "Berliner Str. 179",
  branchCity: "Wuppertal",
  branchName: "Hauptfiliale",
  restaurantName: "MR. Tabboush",
  legalName: "Farman GmbH",
  deliveryEnabled: true,
  pickupEnabled: true,
  reservationEnabled: false,
  deliveryRadiusKm: 4,
  deliveryFee: 1.5,
  minOrderAmount: 10,
  branchLatitude: 51.2667,
  branchLongitude: 7.1833,
  orderPrefix: "TAB",
  openingHours: "12:00 - 22:30",
  closedDays: [],
};

function isCustomerLanguage(value: unknown): value is CustomerLanguage {
  return value === "ar" || value === "de" || value === "en" || value === "tr";
}

function detectCustomerLanguage(message: string): CustomerLanguage | null {
  const text = message.toLowerCase().trim();
  if (!text) return null;
  if (/\b(merhaba|selam|türkçe|turkce|sipariş|siparis|teşekkür|tesekkur|evet|hayır|hayir)\b/i.test(text)) return "tr";
  if (/[\u0600-\u06FF]/.test(message)) return "ar";
  if (/\b(deutsch|german|hallo|guten|bestellen|lieferung|abholung|speisekarte|menü|ja|nein|danke)\b/i.test(text)) return "de";
  if (/\b(english|hello|hi|order|delivery|pickup|menu|yes|no|thanks)\b/i.test(text)) return "en";
  return null;
}

function parseLanguageSelection(message: string): CustomerLanguage | null {
  const text = message.toLowerCase().trim().replace(/^\*+|\*+$/g, "");
  if (/^(1|de|deutsch|german|alemani|allemand)$/.test(text) || text.includes("deutsch")) return "de";
  if (/^(2|ar|arabic|arabisch|عربي|العربية|عربية)$/.test(text) || text.includes("عرب")) return "ar";
  if (/^(3|en|english|englisch|انجليزي|إنجليزي)$/.test(text) || text.includes("english")) return "en";
  if (/^(4|tr|turkish|türkçe|turkce|türk|turk)$/.test(text) || text.includes("türk") || text.includes("turk")) return "tr";
  return null;
}

function detectExplicitLanguageRequest(message: string): CustomerLanguage | null {
  const text = message.toLowerCase().trim();
  if (/(english|englisch|انجليزي|إنجليزي|بالانجليزي|بالإنجليزي)/i.test(text)) return "en";
  if (/(deutsch|german|alemani|allemand|بالألماني|بالالمانi)/i.test(text)) return "de";
  if (/(arabic|arabisch|عربي|العربية|بالعربي)/i.test(text)) return "ar";
  if (/(turkish|türkçe|turkce|türkçe|türkçe|türkçe)/i.test(text)) return "tr";
  return null;
}

function getLanguageSelectionPrompt(branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  const name = branchConfig.restaurantName;
  return [
    `Willkommen bei ${name}! 🌯`,
    `أهلاً بك في ${name}! 🌯`,
    `Welcome to ${name}! 🌯`,
    `Merhaba, ${name}'ye hoş geldiniz! 🌯`,
    "",
    "Bitte wählen Sie Ihre Sprache / الرجاء اختيار اللغة / Please choose your language / Lütfen dilinizi seçin:",
    "*1* Deutsch",
    "*2* العربية",
    "*3* English",
    "*4* Türkçe",
    "",
    "Shortcut / اختصار / Kurzbefehl / Kısayol: *00* Help / Hilfe / مساعدة / Yardım",
  ].join("\n");
}

function getShortHelpLine(lang: CustomerLanguage): string {
  if (lang === "ar") return "\n\nاختصارات: *00* مساعدة، *0* رجوع، *8* اللغة، *9* إلغاء، *99* طلب جديد.";
  if (lang === "en") return "\n\nShortcuts: *00* help, *0* back, *8* language, *9* cancel, *99* new order.";
  if (lang === "tr") return "\n\nKısayollar: *00* yardım, *0* geri, *8* dil seçimi, *9* iptal, *99* yeni sipariş.";
  return "\n\nKurzbefehle: *00* Hilfe, *0* zurück, *8* Sprache, *9* abbrechen, *99* neu starten.";
}

function getHelpReply(lang: CustomerLanguage): string {
  if (lang === "ar") {
    return [
      "يمكنك استخدام هذه الاختصارات أثناء المحادثة:",
      "",
      "*00* - مساعدة",
      "*0* - العودة خطوة للخلف",
      "*8* - اختيار لغة أخرى",
      "*9* - إلغاء مسودة الطلب الحالية",
      "*99* - بدء طلب جديد",
      "",
      "الأوامر النصية التفصيلية تعمل أيضاً:",
      "*تغيير العنوان* - تعديل عنوان التوصيل",
      "*تغيير وقت الاستلام* - تعديل وقت الاستلام",
      "*تغيير طريقة الاستلام* - تغيير توصيل/استلام",
      "*تغيير الطلب* - اختيار الوجبات من جديد",
    ].join("\n");
  }

  if (lang === "en") {
    return [
      "You can use these shortcuts anytime:",
      "",
      "*00* - help",
      "*0* - go one step back",
      "*8* - choose another language",
      "*9* - cancel the current draft order",
      "*99* - start a new order",
      "",
      "Detailed text commands still work:",
      "*change address* - edit delivery address",
      "*change time* - edit pickup time",
      "*change type* - change delivery/pickup",
      "*change order* - choose food again",
    ].join("\n");
  }

  if (lang === "tr") {
    return [
      "İstediğiniz zaman bu kısayolları kullanabilirsiniz:",
      "",
      "*00* - yardım",
      "*0* - bir adım geri git",
      "*8* - başka bir dil seçin",
      "*9* - mevcut sipariş taslağını iptal et",
      "*99* - yeni bir sipariş başlat",
      "",
      "Detaylı metin komutları da çalışır:",
      "*adresi değiştir* - teslimat adresini düzenle",
      "*saati değiştir* - teslim alma saatini düzenle",
      "*türü değiştir* - teslimat/teslim alma olarak değiştir",
      "*siparişi değiştir* - yiyecekleri tekrar seç",
    ].join("\n");
  }

  return [
    "Sie können diese Kurzbefehle jederzeit verwenden:",
    "",
    "*00* - Hilfe",
    "*0* - einen Schritt zurück",
    "*8* - andere Sprache wählen",
    "*9* - aktuelle Bestellskizze abbrechen",
    "*99* - neue Bestellung starten",
    "",
    "Detaillierte Textbefehle funktionieren weiterhin:",
    "*Adresse ändern* - Lieferadresse ändern",
    "*Abholzeit ändern* - Abholzeit ändern",
    "*Lieferung ändern* - Lieferung/Abholung ändern",
    "*Bestellung ändern* - Gerichte neu auswählen",
  ].join("\n");
}

function getLanguageSwitchReply(lang: CustomerLanguage): string {
  if (lang === "ar") return "تم تغيير اللغة إلى العربية. تابع طلبك من فضلك، وسأرد عليك بالعربية. ✅";
  if (lang === "en") return "Language switched to English. Please continue your order and I will reply in English. ✅";
  if (lang === "tr") return "Dil Türkçe olarak değiştirildi. Lütfen siparişinize devam edin, Türkçe olarak cevap vereceğim. ✅";
  return "Sprache auf Deutsch geändert. Bitte fahren Sie mit Ihrer Bestellung fort, ich antworte jetzt auf Deutsch. ✅";
}

function getWelcomeReply(
  lang: CustomerLanguage,
  branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG,
  convoId?: string
): string {
  const fee = formatMoney(branchConfig.deliveryFee);
  const min = formatMoney(branchConfig.minOrderAmount);
  const radius = formatMoney(branchConfig.deliveryRadiusKm);
  const deliveryLine = branchConfig.deliveryEnabled
    ? lang === "ar"
      ? `*1* للتوصيل المنزلي (+${fee}€، ضمن ${radius} كم، الحد الأدنى ${min}€)`
      : lang === "en"
      ? `*1* for Home Delivery (+€${fee}, within ${radius} km, min. €${min})`
      : lang === "tr"
      ? `*1* eve teslimat için (+${fee} €, ${radius} km içinde, min. ${min} €)`
      : `*1* für Hauslieferung (+${fee} €, innerhalb ${radius} km, Mindestbestellwert ${min} €)`
    : null;
  const pickupLine = branchConfig.pickupEnabled
    ? lang === "ar"
      ? "*2* للاستلام من المطعم (تيك أواي)"
      : lang === "en"
      ? "*2* for Self Pickup"
      : lang === "tr"
      ? "*2* kendin teslim al"
      : "*2* für Abholung (Pickup)"
    : null;
  const choices = [deliveryLine, pickupLine].filter(Boolean).join("\n");

  if (!choices) {
    if (lang === "ar") return "نعتذر، التوصيل والاستلام غير متاحين حالياً. يرجى المحاولة لاحقاً.";
    if (lang === "en") return "Sorry, delivery and pickup are currently unavailable. Please try again later.";
    if (lang === "tr") return "Üzgünüz, eve teslimat ve teslim alma şu anda mevcut değil. Lütfen daha sonra tekrar deneyin.";
    return "Entschuldigung, Lieferung und Abholung sind aktuell nicht verfügbar. Bitte versuchen Sie es später erneut.";
  }

  const restaurantName = branchConfig.restaurantName;
  const branchCity = branchConfig.branchCity;

  let linkPrompt = "";
  if (convoId) {
    const appUrl = process.env.APP_URL || `https://moinauto.work`;
    const branchQuery = branchConfig.branchId ? `&branch=${branchConfig.branchId}` : "";
    const url = `${appUrl}/?convo=${convoId}${branchQuery}`;
    if (lang === "ar") {
      linkPrompt = `\n\n🔗 أو يمكنك اختيار وجباتك بشكل مرئي وسهل من هنا أولاً:\n${url}`;
    } else if (lang === "en") {
      linkPrompt = `\n\n🔗 Or select your items visually using our Smart Menu here first:\n${url}`;
    } else if (lang === "tr") {
      linkPrompt = `\n\n🔗 Veya önce buradan Akıllı Menümüzü kullanarak ürünlerinizi görsel olarak seçin:\n${url}`;
    } else {
      linkPrompt = `\n\n🔗 Oder wählen Sie Ihre Gerichte hier zuerst visuell über unser Smart Menu aus:\n${url}`;
    }
  }

  if (lang === "ar") {
    return `أهلاً بك في ${restaurantName}! 🌯 أشهى المأكولات الشامية في ${branchCity}.\n\nكيف ترغب في استلام طلبك؟\nالرجاء كتابة:\n` + choices + linkPrompt + getShortHelpLine(lang);
  }
  if (lang === "en") {
    return `Welcome to ${restaurantName}! 🌯 Finest Damascus Shawarma in ${branchCity}.\n\nHow would you like to receive your food?\nReply with:\n` + choices + linkPrompt + getShortHelpLine(lang);
  }
  if (lang === "tr") {
    return `Welcome to ${restaurantName}! 🌯 ${branchCity}'deki en lezzetli Şam Şavurması.\n\nYemeğinizi nasıl teslim almak istersiniz?\nŞununla yanıtlayın:\n` + choices + linkPrompt + getShortHelpLine(lang);
  }
  return `Willkommen bei ${restaurantName}! 🌯 Feinstes syrisches Shawarma in ${branchCity}.\n\nWie möchten Sie Ihre Bestellung erhalten?\nAntworten Sie mit:\n` + choices + linkPrompt + getShortHelpLine(lang);
}

function getAddressPrompt(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  const radius = formatMoney(branchConfig.deliveryRadiusKm);
  const min = formatMoney(branchConfig.minOrderAmount);
  const branchCity = branchConfig.branchCity;
  if (lang === "ar") return `رائع! خدمة التوصيل متوفرة ضمن ${radius} كم وبحد أدنى ${min}€. يرجى إرسال عنوان التوصيل بالتفصيل في ${branchCity}:` + getShortHelpLine(lang);
  if (lang === "en") return `Great! Home delivery is available within ${radius} km with a minimum order of €${min}. Please type your detailed delivery address in ${branchCity}:` + getShortHelpLine(lang);
  if (lang === "tr") return `Harika! ${radius} km içinde minimum €${min} tutarında eve teslimat mevcuttur. Lütfen ${branchCity}'deki ayrıntılı teslimat adresinizi yazın:` + getShortHelpLine(lang);
  return `Super! Der Lieferservice ist innerhalb von ${radius} km verfügbar. Mindestbestellwert: ${min} €. Bitte senden Sie uns Ihre Lieferadresse in ${branchCity}:` + getShortHelpLine(lang);
}

function getPickupTimePrompt(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  if (lang === "ar") return `ممتاز! تفضل بالاستلام من المطعم بـ ${branchConfig.branchAddress}.\nما هو وقت الاستلام المناسب لك؟ (مثال: 19:30)` + getShortHelpLine(lang);
  if (lang === "en") return `Great choice! Pickup is ready at ${branchConfig.branchAddress}.\nWhat time would you like to pick up your order? (e.g., 20:15)` + getShortHelpLine(lang);
  if (lang === "tr") return `Harika seçim! ${branchConfig.branchAddress} adresinden teslim alabilirsiniz.\nSiparişinizi saat kaçta teslim almak istersiniz? (örn. 20:15)` + getShortHelpLine(lang);
  return `Alles klar! Sie können Ihre Bestellung in der ${branchConfig.branchAddress} abholen.\nUm wie viel Uhr möchten Sie Ihr Essen abholen? (z.B., 19:45)` + getShortHelpLine(lang);
}

function documentId(value: any): string {
  return value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || "";
}

function orderTypeForMenu(convo: any): "delivery" | "pickup" | undefined {
  const orderType = convo?.unsubmittedOrder?.orderType;
  return orderType === "delivery" || orderType === "pickup" ? orderType : undefined;
}

function menuItemCode(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function categoryMatchesBranch(category: any, branchConfig: BranchFulfillmentConfig): boolean {
  const branchIds = Array.isArray(category?.branchIds)
    ? category.branchIds.map(documentId).filter(Boolean)
    : [];
  return !branchConfig.branchId || branchIds.length === 0 || branchIds.includes(branchConfig.branchId);
}

function categoryAvailableForOrderType(category: any, orderType?: "delivery" | "pickup"): boolean {
  if (orderType === "delivery") return category?.availableForDelivery !== false;
  if (orderType === "pickup") return category?.availableForPickup !== false;
  return true;
}

function menuItemAvailableForOrderType(item: any, orderType?: "delivery" | "pickup"): boolean {
  if (orderType === "delivery") return item?.isAvailableForDelivery !== false;
  if (orderType === "pickup") return item?.isAvailableForPickup !== false;
  return true;
}

function buildVisibleMenuEntries(
  menuItems: any[],
  categories: any[],
  branchConfig: BranchFulfillmentConfig,
  orderType?: "delivery" | "pickup"
) {
  const sortedCategories = [...categories]
    .filter((category) => category?.isActive !== false && categoryMatchesBranch(category, branchConfig))
    .sort((a, b) => toFiniteNumber(a?.sortOrder, 0) - toFiniteNumber(b?.sortOrder, 0));
  const allCategoryById = new Map(categories.map((category) => [documentId(category), category]));
  const categoryById = new Map(sortedCategories.map((category) => [documentId(category), category]));

  return [...menuItems]
    .filter((item) => {
      if (item?.isActive === false || !menuItemAvailableForOrderType(item, orderType)) return false;

      const itemCategoryId = documentId(item?.categoryId);
      const rawCategory = itemCategoryId ? allCategoryById.get(itemCategoryId) : null;
      const category = itemCategoryId ? categoryById.get(itemCategoryId) : null;
      if (rawCategory && !category) return false;
      if (!category) return true;

      return categoryAvailableForOrderType(category, orderType);
    })
    .map((item) => ({
      item,
      category: categoryById.get(documentId(item?.categoryId)) || null,
    }))
    .sort((a, b) => {
      const categorySortA = toFiniteNumber(a.category?.sortOrder, 9999);
      const categorySortB = toFiniteNumber(b.category?.sortOrder, 9999);
      if (categorySortA !== categorySortB) return categorySortA - categorySortB;

      const itemSortA = toFiniteNumber(a.item?.sortOrder, 0);
      const itemSortB = toFiniteNumber(b.item?.sortOrder, 0);
      if (itemSortA !== itemSortB) return itemSortA - itemSortB;

      return translatedText(a.item?.name, "de").localeCompare(translatedText(b.item?.name, "de"));
    });
}

function getMenuPrompt(
  lang: CustomerLanguage,
  menuItems: any[],
  categories: any[],
  branchConfig: BranchFulfillmentConfig,
  orderType?: "delivery" | "pickup",
  convoId?: string
): string {
  const entries = buildVisibleMenuEntries(menuItems, categories, branchConfig, orderType);

  if (entries.length === 0) {
    if (lang === "ar") return "القائمة غير متاحة حالياً لهذا الفرع أو طريقة الاستلام. يرجى التواصل مع الموظف للمساعدة." + getShortHelpLine(lang);
    if (lang === "en") return "The menu is currently unavailable for this branch or fulfillment type. Please contact support for help." + getShortHelpLine(lang);
    if (lang === "tr") return "Menü şu anda bu şube veya teslimat türü için mevcut değil. Lütfen yardım için destekle iletişime geçin." + getShortHelpLine(lang);
    return "Die Speisekarte ist für diese Filiale oder Bestellart aktuell nicht verfügbar. Bitte wenden Sie sich an den Support." + getShortHelpLine(lang);
  }

  const body: string[] = [];
  let currentCategory = "";
  entries.forEach(({ item, category }, index) => {
    const categoryName = translatedText(category?.name, lang) || (
      lang === "ar" ? "أصناف أخرى" : lang === "en" ? "Other items" : lang === "tr" ? "Diğer ürünler" : "Weitere Gerichte"
    );
    if (categoryName !== currentCategory) {
      if (body.length > 0) body.push("");
      body.push(`*${categoryName}*`);
      currentCategory = categoryName;
    }

    const itemName = translatedText(item?.name, lang) || translatedText(item?.name, "de") || "Menu item";
    const price = lang === "en" ? `€${formatMoney(item?.basePrice)}` : `${formatMoney(item?.basePrice)} €`;
    const bestSeller = item?.isBestSeller ? " 🔥" : "";
    body.push(`*${menuItemCode(index)}* ${itemName}${bestSeller} - ${price}`);
  });

  const intro = lang === "ar"
    ? "إليك قائمة الطعام المتوفرة لدينا:"
    : lang === "en"
    ? "Here is our current menu:"
    : lang === "tr"
    ? "İşte güncel menümüz:"
    : "Hier ist unsere aktuelle Speisekarte:";
  const instruction = lang === "ar"
    ? "اكتب رمز الصنف مثل *01* أو اسم الوجبة للطلب:"
    : lang === "en"
    ? "Reply with the item code, e.g. *01*, or type the item name:"
    : lang === "tr"
    ? "Sipariş vermek için *01* gibi ürün kodunu girin veya ürün adını yazın:"
    : "Antworten Sie mit dem Artikelcode, z.B. *01*, oder dem Namen:";

  let linkPrompt = "";
  if (convoId) {
    const appUrl = process.env.APP_URL || `https://moinauto.work`;
    const branchQuery = branchConfig.branchId ? `&branch=${branchConfig.branchId}` : "";
    const url = `${appUrl}/?convo=${convoId}${branchQuery}`;
    
    if (lang === "ar") {
      linkPrompt = `🔗 أو يمكنك تصفح القائمة واختيار الأصناف بشكل مرئي وبسيط من هنا:\n${url}\n`;
    } else if (lang === "en") {
      linkPrompt = `🔗 Or browse our menu and add items visually here:\n${url}\n`;
    } else if (lang === "tr") {
      linkPrompt = `🔗 Veya menümüze göz atıp ürünleri buradan görsel olarak ekleyin:\n${url}\n`;
    } else {
      linkPrompt = `🔗 Oder stöbern Sie in unserer Speisekarte und wählen Sie die Artikel hier visuell aus:\n${url}\n`;
    }
  }

  return [intro, "", ...body, "", linkPrompt, instruction].join("\n").replace(/\n\n+/g, "\n\n") + getShortHelpLine(lang);
}

function getCancelReply(lang: CustomerLanguage): string {
  if (lang === "ar") return "تم إلغاء مسودة الطلب الحالية. إذا أردت البدء من جديد، اكتب أهلاً أو طلب جديد. ✅";
  if (lang === "en") return "Your current draft order has been cancelled. Type hello or new order whenever you want to start again. ✅";
  if (lang === "tr") return "Mevcut sipariş taslağınız iptal edildi. Yeniden başlamak istediğinizde merhaba veya yeni sipariş yazın. ✅";
  return "Ihre aktuelle Bestellskizze wurde abgebrochen. Schreiben Sie Hallo oder neue Bestellung, wenn Sie neu starten möchten. ✅";
}

function getBackUnavailableReply(lang: CustomerLanguage): string {
  if (lang === "ar") return "لا توجد خطوة سابقة واضحة حالياً. يمكنني بدء طلب جديد إذا كتبت طلب جديد.";
  if (lang === "en") return "There is no clear previous step right now. Type new order if you want to start over.";
  if (lang === "tr") return "Şu anda net bir önceki adım yok. Baştan başlamak isterseniz yeni sipariş yazın.";
  return "Es gibt aktuell keinen klaren vorherigen Schritt. Schreiben Sie neue Bestellung, wenn Sie neu starten möchten.";
}

type FlowCommand =
  | "help"
  | "restart"
  | "cancel"
  | "back"
  | "change_language"
  | "change_address"
  | "change_pickup_time"
  | "change_type"
  | "change_order";

function detectFlowCommand(message: string): FlowCommand | null {
  const text = message.toLowerCase().trim().replace(/^\*+|\*+$/g, "");
  if (!text) return null;

  if (text === "00") return "help";
  if (text === "0") return "back";
  if (text === "8") return "change_language";
  if (text === "9") return "cancel";
  if (text === "99") return "restart";

  if (/^(help|hilfe|مساعدة|ساعدني|الاوامر|الأوامر|yardım|yardim|destek)$/i.test(text)) return "help";
  if (/(change|switch).*(language)|sprache.*(ändern|wechseln)|تغيير.*(اللغة|اللغه)|بدل.*(اللغة|اللغه)|dil.*(değiştir|degistir)/i.test(text)) return "change_language";
  if (/^(restart|start over|new order|reset order|neu starten|von vorne|neue bestellung|ابدأ من جديد|ابدا من جديد|طلب جديد|إعادة الطلب|اعادة الطلب|yeni sipariş|yeni siparis|yeniden başla|yeniden basla)$/i.test(text)) return "restart";
  if (/^(cancel|cancel order|abort|abbrechen|stornieren|إلغاء|الغاء|ألغي|الغي|iptal)$/i.test(text)) return "cancel";
  if (/^(back|go back|previous|zurück|zurueck|رجوع|ارجع|للخلف|geri)$/i.test(text)) return "back";
  if (/(change|edit).*(address)|address.*(change|edit)|adresse.*(ändern|wechseln)|lieferadresse.*(ändern|wechseln)|تغيير.*(العنوان|عنوان)|غير.*(العنوان|عنوان)|adres.*(değiştir|degistir)/i.test(text)) return "change_address";
  if (/(change|edit).*(pickup time|time)|pickup time.*(change|edit)|abholzeit.*(ändern|wechseln)|تغيير.*(الوقت|وقت الاستلام)|غير.*(الوقت|وقت الاستلام)|saat.*(değiştir|degistir)|zaman.*(değiştir|degistir)/i.test(text)) return "change_pickup_time";
  if (/(change|edit).*(delivery|pickup|type)|lieferung.*(ändern|wechseln)|abholung.*(ändern|wechseln)|تغيير.*(التوصيل|الاستلام|طريقة الاستلام)|غير.*(التوصيل|الاستلام)|tür.*(değiştir|degistir)|tur.*(değiştir|degistir)/i.test(text)) return "change_type";
  if (/(change|edit).*(order|item|meal|food)|bestellung.*(ändern|wechseln)|gericht.*(ändern|wechseln)|تغيير.*(الطلب|الوجبة|الصنف)|غير.*(الطلب|الوجبة|الصنف)|sipariş.*(değiştir|degistir)|siparis.*(değiştir|degistir)/i.test(text)) return "change_order";

  return null;
}

function hasPricedUpsell(value: any): boolean {
  return !!value && Number.isFinite(Number(value.price));
}

function getActiveUpsellSuggestion(menuItem: any) {
  return (menuItem?.upsellSuggestions || []).find((suggestion: any) => suggestion?.isActive !== false && Number.isFinite(Number(suggestion.price)));
}

function normalizeUpsellSuggestion(suggestion: any) {
  return {
    id: suggestion?.id || `up-${Math.random().toString(36).slice(2, 8)}`,
    name: suggestion?.suggestedItemName || suggestion?.name || { ar: "", de: "", en: "" },
    price: toFiniteNumber(suggestion?.price, 0),
  };
}

function getUpsellPrompt(lang: CustomerLanguage, upsell: any): string {
  const price = formatMoney(upsell.price);
  if (lang === "ar") {
    return `⚡ هل ترغب في إضافة *${translatedText(upsell.name, "ar")}* مقابل +${price}€؟\nأجب بـ:\n*نعم* للإضافة\n*لا* للانتقال لتأكيد الفاتورة مباشرة` + getShortHelpLine(lang);
  }
  if (lang === "en") {
    return `⚡ Would you like to add *${translatedText(upsell.name, "en")}* for +€${price}?\nReply:\n*YES* to add it\n*NO* to proceed with checkout` + getShortHelpLine(lang);
  }
  if (lang === "tr") {
    return `⚡ Ek ücret +${price}€ karşılığında *${translatedText(upsell.name, "tr") || translatedText(upsell.name, "de")}* eklemek ister misiniz?\nYazın:\n*EVET* eklemek için\n*HAYIR* doğrudan ödemeye geçmek için` + getShortHelpLine(lang);
  }
  return `⚡ Möchten Sie *${translatedText(upsell.name, "de")}* für +${price} € hinzufügen?\nAntworten Sie:\n*JA* zum Hinzufügen\n*NEIN* um die Bestellung direkt abzuschließen` + getShortHelpLine(lang);
}

function normalizeMenuSearchText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMenuItemFromMessage(
  message: string,
  menuItems: any[],
  categories: any[],
  branchConfig: BranchFulfillmentConfig,
  orderType?: "delivery" | "pickup"
) {
  const entries = buildVisibleMenuEntries(menuItems, categories, branchConfig, orderType);
  const cleaned = message.trim().replace(/^\*+|\*+$/g, "");

  if (/^\d+$/.test(cleaned)) {
    const selectedIndex = Number(cleaned) - 1;
    if (selectedIndex >= 0 && selectedIndex < entries.length) {
      return entries[selectedIndex].item;
    }
  }

  const normalizedMessage = normalizeMenuSearchText(message);
  if (!normalizedMessage) return null;

  const messageWords = normalizedMessage.split(" ").filter((word) => word.length >= 3);
  let bestMatch: { item: any; score: number } | null = null;

  for (const { item } of entries) {
    const searchableValues = [
      item?.skucode,
      item?.name?.ar,
      item?.name?.de,
      item?.name?.en,
      item?.description?.ar,
      item?.description?.de,
      item?.description?.en,
    ].map(normalizeMenuSearchText).filter(Boolean);

    let score = 0;
    for (const value of searchableValues) {
      if (value === normalizedMessage) score = Math.max(score, 100);
      if (normalizedMessage.length >= 3 && value.includes(normalizedMessage)) score = Math.max(score, 80);
    }

    const joinedValues = searchableValues.join(" ");
    if (messageWords.length > 0 && messageWords.every((word) => joinedValues.includes(word))) {
      score = Math.max(score, 50 + messageWords.length);
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { item, score };
    }
  }

  return bestMatch?.item || null;
}

function buildConfirmationSummary(convo: any, lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  const sub = convo.unsubmittedOrder?.subtotal || 0;
  const fee = convo.unsubmittedOrder?.deliveryFee || 0;
  const total = sub + fee;
  const belowMinimum = isBelowDeliveryMinimum(convo, branchConfig);

  if (lang === "ar") {
    let billSummary = `📋 *ملخص طلبك النهائي من ${branchConfig.restaurantName}*\n--------------\n`;
    (convo.unsubmittedOrder?.items || []).forEach((i: any) => {
      billSummary += `▪️ ${i.quantity}x ${translatedText(i.name, "ar")} (${formatMoney(i.basePrice)}€)\n`;
      if (hasPricedUpsell(i.selectedUpsell)) billSummary += ` └ ➕ ${translatedText(i.selectedUpsell.name, "ar")} (+${formatMoney(i.selectedUpsell.price)}€)\n`;
    });
    billSummary += `--------------\n`;
    billSummary += `المجموع الفرعي: ${formatMoney(sub)}€\n`;
    if (fee > 0) billSummary += `أجرة التوصيل: ${formatMoney(fee)}€\n`;
    billSummary += `*الإجمالي النهائي: ${formatMoney(total)}€*\n\n`;
    billSummary += convo.unsubmittedOrder?.orderType === "delivery"
      ? `📍 التوصيل إلى: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
      : `⏰ الاستلام من المطعم الساعة: _${convo.unsubmittedOrder?.pickupTime}_\n`;
    billSummary += `💶 طريقة الدفع: *كاش نقداً عند الاستلام*\n`;
    billSummary += belowMinimum
      ? `\n⚠️ الحد الأدنى للتوصيل هو ${formatMoney(branchConfig.minOrderAmount)}€ قبل رسوم التوصيل. يرجى تعديل الطلب قبل التأكيد.`
      : `\nيرجى الرد بـ *1* أو *تأكيد* لتأكيد الطلب وإرساله فوراً للمطبخ طازجاً!`;
    return billSummary + getShortHelpLine(lang);
  }

  if (lang === "en") {
    let billSummary = `📋 *${branchConfig.restaurantName} Order Receipt*\n--------------\n`;
    (convo.unsubmittedOrder?.items || []).forEach((i: any) => {
      billSummary += `▪️ ${i.quantity}x ${translatedText(i.name, "en")} (€${formatMoney(i.basePrice)})\n`;
      if (hasPricedUpsell(i.selectedUpsell)) billSummary += ` └ ➕ ${translatedText(i.selectedUpsell.name, "en")} (+€${formatMoney(i.selectedUpsell.price)})\n`;
    });
    billSummary += `--------------\n`;
    billSummary += `Subtotal: €${formatMoney(sub)}\n`;
    if (fee > 0) billSummary += `Delivery Fee: €${formatMoney(fee)}\n`;
    billSummary += `*Grand Total: €${formatMoney(total)}*\n\n`;
    billSummary += convo.unsubmittedOrder?.orderType === "delivery"
      ? `📍 Ship Address: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
      : `⏰ Self pickup at: _${convo.unsubmittedOrder?.pickupTime}_\n`;
    billSummary += `💶 Payment: *CASH ONLY upon delivery*\n`;
    billSummary += belowMinimum
      ? `\n⚠️ Minimum delivery order is €${formatMoney(branchConfig.minOrderAmount)} before delivery fee. Please change the order before confirming.`
      : `\nReply with *1* or *CONFIRM* to submit your order to the kitchen!`;
    return billSummary + getShortHelpLine(lang);
  }

  if (lang === "tr") {
    let billSummary = `📋 *${branchConfig.restaurantName} Sipariş Özeti*\n--------------\n`;
    (convo.unsubmittedOrder?.items || []).forEach((i: any) => {
      billSummary += `▪️ ${i.quantity}x ${translatedText(i.name, "tr") || translatedText(i.name, "de")} (${formatMoney(i.basePrice)}€)\n`;
      if (hasPricedUpsell(i.selectedUpsell)) billSummary += ` └ ➕ ${translatedText(i.selectedUpsell.name, "tr") || translatedText(i.selectedUpsell.name, "de")} (+${formatMoney(i.selectedUpsell.price)}€)\n`;
    });
    billSummary += `--------------\n`;
    billSummary += `Ara Toplam: ${formatMoney(sub)}€\n`;
    if (fee > 0) billSummary += `Teslimat Ücreti: ${formatMoney(fee)}€\n`;
    billSummary += `*Genel Toplam: ${formatMoney(total)}€*\n\n`;
    billSummary += convo.unsubmittedOrder?.orderType === "delivery"
      ? `📍 Teslimat Adresi: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
      : `⏰ Teslim Alma Saati: _${convo.unsubmittedOrder?.pickupTime}_\n`;
    billSummary += `💶 Ödeme: *Teslimatta NAKİT*\n`;
    billSummary += belowMinimum
      ? `\n⚠️ Teslimat için minimum sipariş tutarı teslimat ücreti hariç ${formatMoney(branchConfig.minOrderAmount)}€'dir. Lütfen onaylamadan önce siparişi değiştirin.`
      : `\nSiparişi mutfağa göndermek için *1* veya *ONayla* yazarak yanıt verin!`;
    return billSummary + getShortHelpLine(lang);
  }

  let billSummary = `📋 *Rechnungsübersicht ${branchConfig.restaurantName}*\n--------------\n`;
  (convo.unsubmittedOrder?.items || []).forEach((i: any) => {
    billSummary += `▪️ ${i.quantity}x ${translatedText(i.name, "de")} (${formatMoney(i.basePrice)} €)\n`;
    if (hasPricedUpsell(i.selectedUpsell)) billSummary += ` └ ➕ ${translatedText(i.selectedUpsell.name, "de")} (+${formatMoney(i.selectedUpsell.price)} €)\n`;
  });
  billSummary += `--------------\n`;
  billSummary += `Zwischensumme: ${formatMoney(sub)} €\n`;
  if (fee > 0) billSummary += `Liefergebühr: ${formatMoney(fee)} €\n`;
  billSummary += `*Gesamtbetrag: ${formatMoney(total)} €*\n\n`;
  billSummary += convo.unsubmittedOrder?.orderType === "delivery"
    ? `📍 Lieferadresse: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
    : `⏰ Abholzeit: _${convo.unsubmittedOrder?.pickupTime} Uhr_\n`;
  billSummary += `💶 Zahlung: *BARZAHLUNG bei Übergabe*\n`;
  billSummary += belowMinimum
    ? `\n⚠️ Der Mindestbestellwert für Lieferung beträgt ${formatMoney(branchConfig.minOrderAmount)} € vor Liefergebühr. Bitte ändern Sie die Bestellung vor der Bestätigung.`
    : `\nAntworten Sie mit *1* oder *BESTÄTIGEN*, um die Bestellung abzuschicken!`;
  return billSummary + getShortHelpLine(lang);
}

function serializeDoc(doc: any) {
  const raw = typeof doc?.toObject === "function" ? doc.toObject() : doc;
  return {
    ...raw,
    id: raw?._id?.toString?.() || raw?.id,
  };
}

function serializeDocs(docs: any[]) {
  return docs.map(serializeDoc);
}

function getLocalTimeDetails(timezone: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    weekday: "long"
  });

  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  const hour = parseInt(partMap.hour || "0", 10);
  const minute = parseInt(partMap.minute || "0", 10);
  const weekdayName = partMap.weekday || "";

  const daysMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  };
  const dayIndex = daysMap[weekdayName] ?? now.getDay();

  return { hour, minute, dayIndex };
}

function isTimeWithinRange(dateTime: Date, branch: any, timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
      minute: "numeric",
      weekday: "long"
    });
    const parts = formatter.formatToParts(dateTime);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

    const targetH = parseInt(partMap.hour || "0", 10);
    const targetM = parseInt(partMap.minute || "0", 10);
    const weekdayName = partMap.weekday || "";

    const daysMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6
    };
    const dayIndex = daysMap[weekdayName] ?? dateTime.getDay();

    if (branch.closedDays && branch.closedDays.includes(dayIndex)) {
      return false;
    }

    const openingHoursStr = branch.openingHours;
    if (!openingHoursStr) return false;

    const hoursParts = openingHoursStr.split("-");
    if (hoursParts.length !== 2) return false;

    const targetMinutes = targetH * 60 + targetM;
    const [startH, startM] = hoursParts[0].trim().split(":").map(Number);
    const [endH, endM] = hoursParts[1].trim().split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
      return targetMinutes >= startMinutes || targetMinutes <= endMinutes;
    }

    return targetMinutes >= startMinutes && targetMinutes <= endMinutes;
  } catch (err) {
    console.error("[Hours Validation] Error checking custom time range:", err);
    return false;
  }
}

function isBranchOpen(branch: any, timezone: string): boolean {
  return isTimeWithinRange(new Date(), branch, timezone);
}

function getClosedDaysString(lang: string, closedDays: number[]): string {
  if (!closedDays || closedDays.length === 0) return "";
  const daysDE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const daysEN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daysAR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const daysTR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

  if (lang === "ar") {
    const names = closedDays.map(d => daysAR[d]).join("، ");
    return `أيام الإغلاق: ${names}.`;
  } else if (lang === "en") {
    const names = closedDays.map(d => daysEN[d]).join(", ");
    return `Closed on: ${names}.`;
  } else if (lang === "tr") {
    const names = closedDays.map(d => daysTR[d]).join(", ");
    return `Kapalı günler: ${names}.`;
  } else {
    const names = closedDays.map(d => daysDE[d]).join(", ");
    return `Ruhetage: ${names}.`;
  }
}

const ADMIN_ROLES = ["super_admin", "restaurant_admin"];
const MANAGER_ROLES = ["super_admin", "restaurant_admin", "branch_manager"];
const ORDER_ROLES = ["super_admin", "restaurant_admin", "branch_manager", "staff"];
const CHAT_ROLES = ["super_admin", "restaurant_admin", "branch_manager", "support_agent"];
const MENU_ROLES = ["super_admin", "restaurant_admin", "branch_manager"];

function userHasRole(user: AuthenticatedRequest["user"], roles: string[]): boolean {
  return !!user?.role && roles.includes(user.role);
}

function cleanedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strippedJidUser(jid?: string): string | undefined {
  return jid?.split("@")[0]?.split(":")[0] || undefined;
}

function guestName(identifier: string): string {
  return `Gast ${identifier.substring(Math.max(0, identifier.length - 4))}`;
}

function isGuestName(name?: string): boolean {
  return !name || /^Gast\s+\S+$/i.test(name);
}

async function updateConversationIdentity(convo: any, identity: {
  phone: string;
  customerName?: string;
  whatsappJid?: string;
  whatsappPhoneJid?: string;
  whatsappLid?: string;
}) {
  if (identity.customerName && isGuestName(convo.customerName)) {
    convo.customerName = identity.customerName;
  }

  if (identity.phone.startsWith("+") && convo.whatsAppPhone !== identity.phone) {
    const existingPhoneConvo = await Conversation.findOne({
      _id: { $ne: convo._id },
      whatsAppPhone: identity.phone,
    });

    if (!existingPhoneConvo) {
      convo.whatsAppPhone = identity.phone;
    }
  }

  convo.whatsAppJid = identity.whatsappJid || convo.whatsAppJid;
  convo.whatsAppPhoneJid = identity.whatsappPhoneJid || convo.whatsAppPhoneJid;
  convo.whatsAppLid = identity.whatsappLid || convo.whatsAppLid;

  if (convo.unsubmittedOrder) {
    convo.unsubmittedOrder.customerName = convo.customerName;
    convo.unsubmittedOrder.whatsAppPhone = convo.whatsAppPhone;
  }
}

function getConversationWhatsAppTarget(convo: any): string {
  return convo.whatsAppJid || convo.whatsAppPhoneJid || convo.whatsAppPhone;
}

function branchConfigFromBranch(branch: any, restaurant: any): BranchFulfillmentConfig {
  return {
    branchId: branch?._id?.toString?.() || branch?.id?.toString?.(),
    branchAddress: branch?.address || DEFAULT_BRANCH_CONFIG.branchAddress,
    branchCity: branch?.city || DEFAULT_BRANCH_CONFIG.branchCity,
    branchName: branch?.name || DEFAULT_BRANCH_CONFIG.branchName,
    restaurantName: restaurant?.name || DEFAULT_BRANCH_CONFIG.restaurantName,
    legalName: restaurant?.legalName || DEFAULT_BRANCH_CONFIG.legalName,
    deliveryEnabled: branch?.deliveryEnabled !== false,
    pickupEnabled: branch?.pickupEnabled !== false,
    deliveryRadiusKm: toFiniteNumber(branch?.deliveryRadiusKm, DEFAULT_BRANCH_CONFIG.deliveryRadiusKm),
    deliveryFee: toFiniteNumber(branch?.deliveryFee, DEFAULT_BRANCH_CONFIG.deliveryFee),
    minOrderAmount: toFiniteNumber(branch?.minOrderAmount, DEFAULT_BRANCH_CONFIG.minOrderAmount),
    branchLatitude: toFiniteNumber(branch?.latitude, DEFAULT_BRANCH_CONFIG.branchLatitude),
    branchLongitude: toFiniteNumber(branch?.longitude, DEFAULT_BRANCH_CONFIG.branchLongitude),
    orderPrefix: restaurant?.orderPrefix || DEFAULT_BRANCH_CONFIG.orderPrefix,
    openingHours: branch?.openingHours || DEFAULT_BRANCH_CONFIG.openingHours,
    closedDays: branch?.closedDays || DEFAULT_BRANCH_CONFIG.closedDays,
    reservationEnabled: !!branch?.reservationEnabled,
  };
}

async function generateOrderNumber(): Promise<string> {
  const count = await Order.countDocuments();
  const restaurant = await Restaurant.findOne({ isActive: true }).lean();
  const prefix = restaurant?.orderPrefix || "TAB";
  return `${prefix}-${1004 + count}`;
}

async function triggerAutoPrint(order: any): Promise<void> {
  try {
    const branch = await Branch.findById(order.branchId).lean();
    if (!branch || !branch.printerSettings) return;

    const settings = branch.printerSettings;
    // Check if auto-printing is enabled
    if (settings.autoPrint === false) {
      return; // disabled
    }

    const restaurant = await Restaurant.findById(order.restaurantId).lean();
    const restaurantName = restaurant?.name || "Restaurant";

    // Format receipt items
    const formattedItems = order.items.map((item: any) => {
      const modifiers = Array.isArray(item.selectedModifiers)
        ? item.selectedModifiers.map((mod: any) => ({
            groupName: mod.groupName,
            optionName: mod.option?.name,
            priceAdjustment: mod.option?.priceAdjustment || 0,
          }))
        : [];

      const upsell = item.selectedUpsell
        ? {
            name: item.selectedUpsell.name,
            price: item.selectedUpsell.price || 0,
          }
        : undefined;

      return {
        name: item.name,
        quantity: item.quantity || 1,
        basePrice: item.basePrice || 0,
        totalPrice: item.totalPrice || 0,
        modifiers,
        upsell,
      };
    });

    const printJob = {
      orderNumber: order.orderNumber,
      restaurantName,
      paymentMethod: order.paymentMethod || "Cash on Delivery",
      orderType: order.orderType,
      customerName: order.customerName,
      whatsAppPhone: order.whatsAppPhone,
      deliveryAddress: order.deliveryAddress,
      pickupTime: order.pickupTime,
      tableNumber: order.tableNumber,
      notes: order.notes,
      items: formattedItems,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      currency: order.currency || "EUR",
      createdAt: order.createdAt || new Date().toISOString(),
      printerSettings: {
        type: settings.type || "network",
        ip: settings.ip,
        port: settings.port || 9100,
        vendorId: settings.vendorId,
        productId: settings.productId,
        width: settings.width || "80mm",
        modelName: settings.modelName || "Generic ESC/POS",
        buzzer: settings.buzzer !== false,
      }
    };

    const roomName = `branch:${order.branchId?.toString()}:printer`;
    emitToRoom(roomName, "printer:job", printJob);
    console.log(`[Printer] Dispatched print job for order ${order.orderNumber} to room ${roomName}`);
  } catch (err) {
    console.error("[Printer] triggerAutoPrint error:", err);
  }
}

async function loadBranchConfig(branchId?: unknown): Promise<BranchFulfillmentConfig> {
  const id = branchId?.toString?.();
  const branch = id && mongoose.isValidObjectId(id)
    ? await Branch.findById(id).lean()
    : await Branch.findOne({ isActive: true }).lean();

  const restaurant = branch?.restaurantId
    ? await Restaurant.findById(branch.restaurantId).lean()
    : await Restaurant.findOne({ isActive: true }).lean();

  return branchConfigFromBranch(branch, restaurant);
}

function isBelowDeliveryMinimum(convo: any, branchConfig: BranchFulfillmentConfig): boolean {
  return convo.unsubmittedOrder?.orderType === "delivery"
    && branchConfig.minOrderAmount > 0
    && toFiniteNumber(convo.unsubmittedOrder?.subtotal, 0) < branchConfig.minOrderAmount;
}

function getMinimumOrderReply(lang: CustomerLanguage, subtotal: number, branchConfig: BranchFulfillmentConfig): string {
  const missing = Math.max(0, branchConfig.minOrderAmount - subtotal);
  if (lang === "ar") {
    return `الحد الأدنى للتوصيل هو ${formatMoney(branchConfig.minOrderAmount)}€ قبل رسوم التوصيل. مجموع طلبك الحالي ${formatMoney(subtotal)}€، وينقصه ${formatMoney(missing)}€. يرجى اختيار صنف أكبر أو تعديل الطلب.`;
  }
  if (lang === "en") {
    return `Minimum delivery order is €${formatMoney(branchConfig.minOrderAmount)} before the delivery fee. Your current subtotal is €${formatMoney(subtotal)}, so €${formatMoney(missing)} is still missing. Please choose a larger item or change the order.`;
  }
  if (lang === "tr") {
    return `Teslimat için minimum sipariş tutarı teslimat ücreti hariç ${formatMoney(branchConfig.minOrderAmount)}€'dir. Mevcut ara toplamınız ${formatMoney(subtotal)}€, bu nedenle hâlâ ${formatMoney(missing)}€ eksik. Lütfen daha büyük bir ürün seçin veya siparişi değiştirin.`;
  }
  return `Der Mindestbestellwert für Lieferung beträgt ${formatMoney(branchConfig.minOrderAmount)} € vor Liefergebühr. Ihr aktueller Warenwert ist ${formatMoney(subtotal)} €, es fehlen noch ${formatMoney(missing)} €. Bitte wählen Sie einen größeren Artikel oder ändern Sie die Bestellung.`;
}

function getDeliveryUnavailableReply(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig): string {
  if (branchConfig.pickupEnabled) {
    if (lang === "ar") return "التوصيل غير متاح حالياً. يمكنك اختيار الاستلام من المطعم بكتابة *2*.";
    if (lang === "en") return "Delivery is currently unavailable. Please choose pickup by replying with *2*.";
    if (lang === "tr") return "Eve teslimat şu anda mevcut değil. Lütfen *2* yazarak teslim almayı seçin.";
    return "Lieferung ist aktuell nicht verfügbar. Bitte wählen Sie Abholung mit *2*.";
  }
  if (lang === "ar") return "التوصيل غير متاح حالياً.";
  if (lang === "en") return "Delivery is currently unavailable.";
  if (lang === "tr") return "Eve teslimat şu anda mevcut değil.";
  return "Lieferung ist aktuell nicht verfügbar.";
}

function getPickupUnavailableReply(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig): string {
  if (branchConfig.deliveryEnabled) {
    if (lang === "ar") return "الاستلام من المطعم غير متاح حالياً. يمكنك اختيار التوصيل بكتابة *1*.";
    if (lang === "en") return "Pickup is currently unavailable. Please choose delivery by replying with *1*.";
    if (lang === "tr") return "Teslim alma şu anda mevcut değil. Lütfen *1* yazarak eve teslimatı seçin.";
    return "Abholung ist aktuell nicht verfügbar. Bitte wählen Sie Lieferung mit *1*.";
  }
  if (lang === "ar") return "الاستلام من المطعم غير متاح حالياً.";
  if (lang === "en") return "Pickup is currently unavailable.";
  if (lang === "tr") return "Teslim alma şu anda mevcut değil.";
  return "Abholung ist aktuell nicht verfügbar.";
}

function buildEmptyUnsubmittedOrder(convo: any) {
  return {
    branchId: convo.branchId?._id?.toString?.() || convo.branchId?.toString?.() || "",
    customerName: convo.customerName,
    whatsAppPhone: convo.whatsAppPhone,
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    status: "received",
    paymentMethod: "Cash on Delivery",
  };
}

function resetOrderItems(convo: any, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG) {
  const deliveryFee = convo.unsubmittedOrder?.orderType === "delivery" ? branchConfig.deliveryFee : 0;
  convo.unsubmittedOrder = {
    ...convo.unsubmittedOrder,
    items: [],
    subtotal: 0,
    deliveryFee,
    total: deliveryFee,
  };
}

function applyRestart(convo: any, lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG) {
  convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
  return {
    botReplyText: getWelcomeReply(lang, branchConfig),
    nextStep: "type",
  };
}

function applyBack(
  convo: any,
  lang: CustomerLanguage,
  currentStep: string,
  branchConfig: BranchFulfillmentConfig,
  menuItems: any[],
  categories: any[]
) {
  if (currentStep === "address" || currentStep === "pickup_time") {
    convo.unsubmittedOrder = {
      ...convo.unsubmittedOrder,
      orderType: undefined,
      deliveryFee: 0,
      total: convo.unsubmittedOrder?.subtotal || 0,
      deliveryAddress: undefined,
      pickupTime: undefined,
    };
    return { botReplyText: getWelcomeReply(lang, branchConfig), nextStep: "type" };
  }

  if (currentStep === "menu") {
    if (convo.unsubmittedOrder?.orderType === "pickup") {
      convo.unsubmittedOrder = { ...convo.unsubmittedOrder, pickupTime: undefined };
      return { botReplyText: getPickupTimePrompt(lang, branchConfig), nextStep: "pickup_time" };
    }
    convo.unsubmittedOrder = { ...convo.unsubmittedOrder, deliveryAddress: undefined };
    return { botReplyText: getAddressPrompt(lang, branchConfig), nextStep: "address" };
  }

  if (currentStep === "customizing" || currentStep === "confirming") {
    resetOrderItems(convo, branchConfig);
    return { botReplyText: getMenuPrompt(lang, menuItems, categories, branchConfig, orderTypeForMenu(convo)), nextStep: "menu" };
  }

  if (currentStep === "completed") {
    return applyRestart(convo, lang, branchConfig);
  }

  if (currentStep === "type" || currentStep === "welcome") {
    return { botReplyText: getWelcomeReply(lang, branchConfig), nextStep: "type" };
  }

  return { botReplyText: getBackUnavailableReply(lang), nextStep: currentStep || "welcome" };
}

async function sendConversationWhatsAppMessage(convo: any, text: string) {
  const target = getConversationWhatsAppTarget(convo);
  if (!target) {
    throw new Error("Conversation does not have a WhatsApp target");
  }

  const session = await WhatsAppSession.findOne({
    ...(convo.branchId ? { branchId: convo.branchId } : {}),
    isActive: true,
    connected: true,
  }).sort({ updatedAt: -1 });

  if (!session) {
    throw new Error("No connected WhatsApp session is available for this conversation");
  }

  await startWhatsAppSession(session.sessionName);
  await sendWhatsAppMessage(session.sessionName, target, text);
}

async function restoreWhatsAppSessions() {
  const sessions = await WhatsAppSession.find({
    isActive: true,
    connected: true,
    qrStatus: "connected",
  }).lean();

  if (sessions.length === 0) {
    console.log("[WhatsApp] No connected sessions to restore");
    return;
  }

  console.log(`[WhatsApp] Restoring ${sessions.length} connected session(s)`);
  for (const session of sessions) {
    try {
      await startWhatsAppSession(session.sessionName);
    } catch (err) {
      console.error(`[WhatsApp] Failed to restore ${session.sessionName}:`, err);
    }
  }
}

// ------------------------------------------------------------------
// 4. REST API Routes (MongoDB backed)
// ------------------------------------------------------------------

// GET /api/state — Role-filtered system snapshot
app.get("/api/state", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const canViewOrders = userHasRole(user, ORDER_ROLES);
    const canViewChats = userHasRole(user, CHAT_ROLES);
    const canViewMenu = userHasRole(user, MENU_ROLES);
    const canViewMarketing = userHasRole(user, ADMIN_ROLES);
    const canViewReports = userHasRole(user, MANAGER_ROLES);
    const canViewSettings = userHasRole(user, MANAGER_ROLES);

    const [branches, categories, menuItems, orders, campaigns, feedbacks, conversations, restaurant, tables, reservations] =
      await Promise.all([
        Branch.find({ isActive: true }).lean(),
        Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        MenuItem.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        Order.find({
          $or: [
            { paymentMethod: { $ne: "Stripe" } },
            { paymentMethod: "Stripe", paymentStatus: "paid" }
          ]
        }).sort({ createdAt: -1 }).lean(),
        Campaign.find().sort({ createdAt: -1 }).lean(),
        Feedback.find().sort({ createdAt: -1 }).lean(),
        Conversation.find().sort({ updatedAt: -1 }).lean(),
        Restaurant.findOne({ isActive: true }).lean(),
        Table.find({ isActive: true }).lean(),
        Reservation.find().sort({ dateTime: 1 }).lean(),
      ]);

    res.json({
      branch: branches[0] || null,
      restaurant: restaurant ? serializeDoc(restaurant) : null,
      branches: canViewSettings ? serializeDocs(branches) : [],
      categories: canViewMenu ? serializeDocs(categories) : [],
      menuItems: canViewMenu ? serializeDocs(menuItems) : [],
      orders: canViewOrders ? serializeDocs(orders).map((o: any) => ({
        ...o,
        id: o._id?.toString() || o.id,
        branchId: o.branchId?.toString?.() || o.branchId,
      })) : [],
      campaigns: canViewMarketing ? serializeDocs(campaigns) : [],
      feedbacks: canViewReports ? serializeDocs(feedbacks) : [],
      conversations: canViewChats ? serializeDocs(conversations) : [],
      tables: serializeDocs(tables),
      reservations: serializeDocs(reservations),
      currency: defaultCurrency,
      geminiStatus: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
    });
  } catch (err) {
    console.error("[API] /api/state error:", err);
    res.status(500).json({ error: "Failed to load system state" });
  }
});

// GET /api/public/config (unauthenticated branding configuration)
app.get("/api/public/config", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ isActive: true }).lean();
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json({
      name: restaurant.name,
      legalName: restaurant.legalName,
      logo: restaurant.logo,
      primaryColor: restaurant.primaryColor,
      secondaryColor: restaurant.secondaryColor,
      defaultLanguage: restaurant.defaultLanguage,
      supportedLanguages: restaurant.supportedLanguages,
      timezone: restaurant.timezone,
      defaultCurrency: restaurant.defaultCurrency,
      heroTagline: restaurant.heroTagline,
      heroBannerImage: restaurant.heroBannerImage,
      heroOpacity: restaurant.heroOpacity ?? 35,
      aboutSubtitle: restaurant.aboutSubtitle,
      aboutText: restaurant.aboutText,
      aboutImage: restaurant.aboutImage,
      aboutFeatures: restaurant.aboutFeatures,
      socialInstagram: restaurant.socialInstagram,
      socialFacebook: restaurant.socialFacebook,
      socialTikTok: restaurant.socialTikTok,
      stripeEnabled: restaurant.stripeEnabled ?? false,
      stripePublishableKey: restaurant.stripePublishableKey || "",
    });
  } catch (err) {
    console.error("[API] GET /api/public/config error:", err);
    res.status(500).json({ error: "Failed to load public configuration" });
  }
});

// GET /api/public/feedbacks (unauthenticated verified 5-star customer reviews)
app.get("/api/public/feedbacks", async (req, res) => {
  try {
    const reviews = await Feedback.find({ rating: 5, status: "resolved" })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    
    if (reviews.length === 0) {
      res.json([
        {
          customerName: "Ahmad Malkous",
          rating: 5,
          comment: "Best shawarma in town! Super fast and friendly chatbot ordering.",
          createdAt: new Date(),
        },
        {
          customerName: "Thomas Müller",
          rating: 5,
          comment: "Sehr leckeres Broasted Chicken. Die Knoblauchsoße ist genial!",
          createdAt: new Date(),
        },
        {
          customerName: "Majid Al-Saeed",
          rating: 5,
          comment: "Excellent food, still hot on arrival! Highly recommended.",
          createdAt: new Date(),
        }
      ]);
      return;
    }
    
    res.json(reviews);
  } catch (err) {
    console.error("[API] GET /api/public/feedbacks error:", err);
    res.status(500).json({ error: "Failed to load public reviews" });
  }
});

// POST /api/orders
app.post("/api/orders", authMiddleware as any, requireRole(...ORDER_ROLES) as any, async (req, res) => {
  try {
    const { branchId } = req.body;
    if (!branchId) {
      res.status(400).json({ error: "Branch ID is required" });
      return;
    }
    const branch = await Branch.findById(branchId);
    if (!branch) {
      res.status(400).json({ error: "Branch not found" });
      return;
    }

    const orderNumber = req.body.orderNumber || await generateOrderNumber();
    const newOrder = new Order({
      orderNumber,
      restaurantId: branch.restaurantId,
      ...req.body,
    });
    await newOrder.save();

    emitGlobal("order:new", serializeDoc(newOrder));
    triggerAutoPrint(newOrder);
    res.status(201).json(serializeDoc(newOrder));
  } catch (err) {
    console.error("[API] POST /api/orders error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// POST /api/orders/:id/print
app.post("/api/orders/:id/print", authMiddleware as any, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    await triggerAutoPrint(order);
    res.json({ success: true, message: "Manual print job triggered successfully." });
  } catch (err) {
    console.error("[API] POST /api/orders/:id/print error:", err);
    res.status(500).json({ error: "Failed to trigger manual print job" });
  }
});

// GET /api/public/menu (smart table menu data)
app.get("/api/public/menu", async (req, res) => {
  try {
    const branchId = req.query.branchId as string;
    const branch = (branchId && mongoose.isValidObjectId(branchId))
      ? await Branch.findById(branchId).lean()
      : await Branch.findOne({ isActive: true }).lean();

    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const [restaurant, categories, menuItems] = await Promise.all([
      Restaurant.findById(branch.restaurantId).lean(),
      Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
      MenuItem.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    ]);

    const visibleItems = menuItems.map((item) => serializeDoc(item));
    const visibleCategories = categories.map((cat) => serializeDoc(cat));

    res.json({
      restaurant: restaurant ? serializeDoc(restaurant) : null,
      branch: serializeDoc(branch),
      categories: visibleCategories,
      menuItems: visibleItems,
      currency: defaultCurrency,
    });
  } catch (err) {
    console.error("[API] GET /api/public/menu error:", err);
    res.status(500).json({ error: "Failed to load public menu data" });
  }
});

// GET /api/public/menu-board (digital menu board data)
app.get("/api/public/menu-board", async (req, res) => {
  try {
    const branchId = req.query.branchId as string;
    const screen = (req.query.screen as string) || "1";
    const requestedLang = (req.query.lang as string) || "de";
    const lang: CustomerLanguage = requestedLang === "ar" || requestedLang === "en" || requestedLang === "tr" ? (requestedLang as CustomerLanguage) : "de";

    const branch = (branchId && mongoose.isValidObjectId(branchId))
      ? await Branch.findById(branchId).lean()
      : await Branch.findOne({ isActive: true }).lean();

    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const [restaurant, categories, menuItems] = await Promise.all([
      Restaurant.findById(branch.restaurantId).lean(),
      Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
      MenuItem.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    ]);

    const branchData: any = serializeDoc(branch);
    const menuBoardSettings = branchData.menuBoardSettings || {};
    const layouts = Array.isArray(menuBoardSettings.layouts) ? menuBoardSettings.layouts : [];
    const activeLayout = layouts.find((layout: any) => String(layout.screenId) === String(screen) && layout.isActive !== false) || null;

    const categorySet = activeLayout?.categoryIds?.length
      ? new Set(activeLayout.categoryIds.map((id: any) => id?.toString?.() || String(id)))
      : null;

    const serializedCategories = categories.map((cat) => serializeDoc(cat));
    const serializedItems = menuItems.map((item) => serializeDoc(item));

    const visibleCategories = categorySet
      ? serializedCategories.filter((cat: any) => categorySet.has(cat.id))
      : serializedCategories;

    const visibleCategoryIds = new Set(visibleCategories.map((cat: any) => cat.id));
    const visibleItems = serializedItems.filter((item: any) => {
      const itemCategoryId = item.categoryId?.toString?.() || item.categoryId;
      return visibleCategoryIds.has(String(itemCategoryId));
    });

    const promoSlides = (menuBoardSettings.promoSlides || [])
      .filter((slide: any) => slide?.isActive !== false)
      .filter((slide: any) => !Array.isArray(slide.screenIds) || slide.screenIds.length === 0 || slide.screenIds.includes(screen))
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

    res.json({
      branch: branchData,
      restaurant: restaurant ? serializeDoc(restaurant) : null,
      categories: visibleCategories,
      menuItems: visibleItems,
      currency: defaultCurrency,
      menuBoard: {
        screen,
        language: lang,
        enabled: menuBoardSettings.enabled === true,
        languageMode: menuBoardSettings.languageMode || "rotate",
        fixedLanguage: menuBoardSettings.fixedLanguage || "de",
        rotationSeconds: Number(menuBoardSettings.rotationSeconds) > 0 ? Number(menuBoardSettings.rotationSeconds) : 15,
        tickerEnabled: menuBoardSettings.tickerEnabled === true,
        tickerText: menuBoardSettings.tickerText || { ar: "", de: "", en: "" },
        layout: activeLayout,
        promoSlides,
      },
    });
  } catch (err) {
    console.error("[API] GET /api/public/menu-board error:", err);
    res.status(500).json({ error: "Failed to load menu board data" });
  }
});

// POST /api/public/orders (smart table menu ordering)
app.post("/api/public/orders", async (req, res) => {
  try {
    const { branchId, customerName, whatsAppPhone, tableNumber, items, notes } = req.body;
    const orderType = req.body.orderType || "dine_in";

    if (orderType === "dine_in" && !tableNumber) {
      res.status(400).json({ error: "Table number is required for smart menu orders" });
      return;
    }

    const branch = (branchId && mongoose.isValidObjectId(branchId))
      ? await Branch.findById(branchId)
      : await Branch.findOne({ isActive: true });

    if (!branch) {
      res.status(400).json({ error: "Restaurant branch not found" });
      return;
    }

    const restaurant = await Restaurant.findById(branch.restaurantId);
    const timezone = restaurant?.timezone || "Europe/Berlin";
    if (!isBranchOpen(branch, timezone)) {
      res.status(400).json({ error: "Restaurant is currently closed / Restaurant ist derzeit geschlossen" });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Order must contain at least one item" });
      return;
    }

    const menuItemIds = items.map((i: any) => i.itemId).filter(Boolean);
    const dbItems = await MenuItem.find({ _id: { $in: menuItemIds }, isActive: true });
    const dbItemsMap = new Map(dbItems.map((i) => [i._id.toString(), i]));

    let subtotal = 0;
    const validatedItems = [];

    for (const clientItem of items) {
      const dbItem = dbItemsMap.get(clientItem.itemId);
      if (!dbItem) {
        res.status(400).json({ error: `Menu item not found or inactive: ${clientItem.itemId}` });
        return;
      }

      const qty = Math.max(1, parseInt(clientItem.quantity) || 1);
      let itemTotalPrice = dbItem.basePrice * qty;

      // Validate Modifiers
      const validatedModifiers = [];
      if (clientItem.selectedModifiers && Array.isArray(clientItem.selectedModifiers)) {
        for (const clientMod of clientItem.selectedModifiers) {
          const modGroup = dbItem.modifierGroups.find((g) => g.id === clientMod.groupId);
          if (modGroup) {
            const modOption = modGroup.options.find((o) => o.id === clientMod.optionId || o.id === clientMod.option?.id);
            if (modOption) {
              const adj = modOption.priceAdjustment || 0;
              itemTotalPrice += adj * qty;
              validatedModifiers.push({
                groupId: modGroup.id,
                groupName: modGroup.name,
                option: {
                  id: modOption.id,
                  name: modOption.name,
                  priceAdjustment: adj,
                },
              });
            }
          }
        }
      }

      // Validate Upsells
      let validatedUpsell = undefined;
      if (clientItem.selectedUpsell && clientItem.selectedUpsell.added) {
        const clientUpsellId = clientItem.selectedUpsell.id;
        const dbUpsell = dbItem.upsellSuggestions.find((u) => u.id === clientUpsellId && u.isActive !== false);
        if (dbUpsell) {
          const upsellPrice = dbUpsell.price || 0;
          itemTotalPrice += upsellPrice;
          validatedUpsell = {
            id: dbUpsell.id,
            name: dbUpsell.suggestedItemName,
            price: upsellPrice,
          };
        }
      }

      validatedItems.push({
        itemId: dbItem._id.toString(),
        name: dbItem.name,
        basePrice: dbItem.basePrice,
        quantity: qty,
        selectedModifiers: validatedModifiers,
        selectedUpsell: validatedUpsell,
        totalPrice: itemTotalPrice,
      });

      subtotal += itemTotalPrice;
    }

    const orderNumber = await generateOrderNumber();
    const deliveryFee = orderType === "delivery" ? (branch.deliveryFee || 0) : 0;
    const total = subtotal + deliveryFee;

    const payWithStripe = restaurant?.stripeEnabled === true && req.body.paymentMethodSelection === "stripe";

    let paymentMethod = "Pay at Table";
    if (payWithStripe) {
      paymentMethod = "Stripe";
    } else if (orderType === "delivery") {
      paymentMethod = "Cash on Delivery";
    } else if (orderType === "pickup") {
      paymentMethod = "Cash on Pickup";
    }

    const defaultNotes = orderType === "dine_in" 
      ? "Created via Table Smart Menu" 
      : "Created via Public Brand Website";

    const newOrder = new Order({
      orderNumber,
      restaurantId: branch.restaurantId,
      branchId: branch._id,
      customerName: customerName ? customerName.trim() : (orderType === "dine_in" ? `Gast Tisch ${tableNumber}` : "Online Gast"),
      whatsAppPhone: whatsAppPhone ? whatsAppPhone.trim() : "",
      orderType,
      items: validatedItems,
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
      paymentStatus: "pending",
      status: "received",
      tableNumber: orderType === "dine_in" ? String(tableNumber || "") : undefined,
      deliveryAddress: orderType === "delivery" ? (req.body.deliveryAddress || "").trim() : undefined,
      pickupTime: orderType === "pickup" ? (req.body.pickupTime || "").trim() : undefined,
      notes: notes || defaultNotes,
      source: orderType === "dine_in" ? "table" : "website",
    });

    if (payWithStripe) {
      if (!restaurant?.stripeSecretKey) {
        res.status(400).json({ error: "Stripe configuration is incomplete on this restaurant" });
        return;
      }
      
      const stripeInstance = new Stripe(restaurant.stripeSecretKey, {
        apiVersion: "2023-10-16" as any,
      });

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

      const lineItems = validatedItems.map(item => {
        const nameText = item.name.de || item.name.en || item.name.ar || "Menu Item";
        return {
          price_data: {
            currency: "eur",
            product_data: {
              name: nameText,
              metadata: { itemId: item.itemId },
            },
            unit_amount: Math.round((item.totalPrice / item.quantity) * 100),
          },
          quantity: item.quantity,
        };
      });

      if (deliveryFee > 0) {
        lineItems.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: "Delivery Fee / Liefergebühr",
              metadata: { itemId: "delivery" } as any,
            },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${appUrl}/?checkout_status=success&orderId=${newOrder._id}`,
        cancel_url: `${appUrl}/?checkout_status=cancelled`,
        metadata: {
          orderId: newOrder._id.toString(),
          orderNumber: newOrder.orderNumber,
        },
      });

      newOrder.stripeSessionId = session.id;
      await newOrder.save();

      res.status(201).json({
        ...serializeDoc(newOrder),
        checkoutUrl: session.url,
      });
      return;
    }

    await newOrder.save();
    emitGlobal("order:new", serializeDoc(newOrder));
    triggerAutoPrint(newOrder);
    res.status(201).json(serializeDoc(newOrder));
  } catch (err) {
    console.error("[API] POST /api/public/orders error:", err);
    res.status(500).json({ error: "Failed to submit table order" });
  }
});

// GET /api/public/orders/:id (public order lookup for checkout status)
app.get("/api/public/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }
    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(serializeDoc(order));
  } catch (err: any) {
    console.error("[API] GET /api/public/orders/:id error:", err);
    res.status(500).json({ error: "Failed to retrieve order details" });
  }
});

// --- TABLE CRUD ENDPOINTS ---

// GET /api/public/tables (fetch active tables for public website)
app.get("/api/public/tables", async (req, res) => {
  try {
    const branchId = req.query.branchId as string;
    const query = (branchId && mongoose.isValidObjectId(branchId))
      ? { branchId, isActive: true }
      : { isActive: true };
    const tables = await Table.find(query).sort({ number: 1 }).lean();
    res.json(serializeDocs(tables));
  } catch (err: any) {
    console.error("[API] GET /api/public/tables error:", err);
    res.status(500).json({ error: "Failed to load tables list" });
  }
});

// GET /api/public/tables/upcoming-reservation (check table collision warnings for smart menu)
app.get("/api/public/tables/upcoming-reservation", async (req, res) => {
  try {
    const { branchId, tableNumber } = req.query;
    if (!branchId || !mongoose.isValidObjectId(branchId as string) || !tableNumber) {
      res.status(400).json({ error: "branchId and tableNumber are required" });
      return;
    }

    const table = await Table.findOne({ branchId, number: tableNumber, isActive: true });
    if (!table) {
      res.json({ upcoming: null });
      return;
    }

    const now = new Date();
    const fortyFiveMinutesLater = new Date(now.getTime() + 45 * 60 * 1000);

    const upcoming = await Reservation.findOne({
      branchId,
      tableId: table._id,
      status: { $in: ["pending", "confirmed", "seated"] },
      dateTime: { $gte: now, $lte: fortyFiveMinutesLater }
    }).lean();

    res.json({ upcoming: upcoming ? serializeDoc(upcoming) : null });
  } catch (err: any) {
    console.error("[API] GET /api/public/tables/upcoming-reservation error:", err);
    res.status(500).json({ error: "Failed to fetch upcoming reservation" });
  }
});

// POST /api/tables (create or update tables, requires auth)
app.post("/api/tables", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, branchId, number, capacity, shape, posX, posY, section, isActive } = req.body;

    if (!branchId || !mongoose.isValidObjectId(branchId)) {
      res.status(400).json({ error: "Valid branchId is required" });
      return;
    }

    if (!number || number.trim() === "") {
      res.status(400).json({ error: "Table number is required" });
      return;
    }

    let tableObj;
    if (id && mongoose.isValidObjectId(id)) {
      tableObj = await Table.findById(id);
      if (!tableObj) {
        res.status(404).json({ error: "Table not found" });
        return;
      }
      tableObj.number = number.trim();
      tableObj.capacity = Number(capacity) || 4;
      tableObj.shape = shape || "square";
      tableObj.posX = Number(posX) ?? tableObj.posX;
      tableObj.posY = Number(posY) ?? tableObj.posY;
      tableObj.section = section || "Main Hall";
      if (isActive !== undefined) {
        tableObj.isActive = !!isActive;
      }
      await tableObj.save();
    } else {
      tableObj = new Table({
        branchId,
        number: number.trim(),
        capacity: Number(capacity) || 4,
        shape: shape || "square",
        posX: Number(posX) ?? 10,
        posY: Number(posY) ?? 10,
        section: section || "Main Hall",
        isActive: isActive !== undefined ? !!isActive : true,
      });
      await tableObj.save();
    }

    emitGlobal("table:update", serializeDoc(tableObj));
    res.json(serializeDoc(tableObj));
  } catch (err: any) {
    console.error("[API] POST /api/tables error:", err);
    res.status(500).json({ error: "Failed to save table" });
  }
});

// DELETE /api/tables/:id (remove a table, requires auth)
app.delete("/api/tables/:id", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid table ID" });
      return;
    }

    const tableObj = await Table.findById(id);
    if (!tableObj) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    tableObj.isActive = false;
    await tableObj.save();

    emitGlobal("table:delete", { id });
    res.json({ success: true, id });
  } catch (err: any) {
    console.error("[API] DELETE /api/tables/:id error:", err);
    res.status(500).json({ error: "Failed to delete table" });
  }
});

// --- RESERVATION CRUD ENDPOINTS ---

// GET /api/reservations (query bookings list, requires auth)
app.get("/api/reservations", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const branchId = req.query.branchId as string;
    const query = (branchId && mongoose.isValidObjectId(branchId))
      ? { branchId }
      : {};
    const reservations = await Reservation.find(query).sort({ dateTime: 1 }).lean();
    res.json(serializeDocs(reservations));
  } catch (err: any) {
    console.error("[API] GET /api/reservations error:", err);
    res.status(500).json({ error: "Failed to query reservations list" });
  }
});

// POST /api/reservations (create manual dashboard booking, requires auth)
app.post("/api/reservations", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { branchId, tableId, customerName, whatsAppPhone, guestCount, dateTime, durationMinutes, notes, status } = req.body;

    if (!branchId || !mongoose.isValidObjectId(branchId)) {
      res.status(400).json({ error: "Valid branchId is required" });
      return;
    }

    if (!customerName || !customerName.trim()) {
      res.status(400).json({ error: "Customer name is required" });
      return;
    }

    if (!whatsAppPhone || !whatsAppPhone.trim()) {
      res.status(400).json({ error: "WhatsApp phone is required" });
      return;
    }

    if (!dateTime) {
      res.status(400).json({ error: "Date and time are required" });
      return;
    }

    const reservation = new Reservation({
      branchId,
      tableId: tableId && mongoose.isValidObjectId(tableId) ? tableId : undefined,
      customerName: customerName.trim(),
      whatsAppPhone: whatsAppPhone.trim(),
      guestCount: Number(guestCount) || 2,
      dateTime: new Date(dateTime),
      durationMinutes: Number(durationMinutes) || 90,
      notes: notes || "",
      status: status || "confirmed",
      source: "dashboard",
    });

    await reservation.save();

    emitGlobal("reservation:new", serializeDoc(reservation));
    res.status(201).json(serializeDoc(reservation));
  } catch (err: any) {
    console.error("[API] POST /api/reservations error:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

// PUT /api/reservations/:id (update status/table assignment, requires auth)
app.put("/api/reservations/:id", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { tableId, status, dateTime, guestCount, notes, customerName, whatsAppPhone } = req.body;

    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid reservation ID" });
      return;
    }

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      res.status(404).json({ error: "Reservation not found" });
      return;
    }

    if (tableId !== undefined) {
      reservation.tableId = (tableId && mongoose.isValidObjectId(tableId)) ? tableId : undefined;
    }
    if (status !== undefined) {
      reservation.status = status;
    }
    if (dateTime !== undefined) {
      reservation.dateTime = new Date(dateTime);
    }
    if (guestCount !== undefined) {
      reservation.guestCount = Number(guestCount) || 2;
    }
    if (notes !== undefined) {
      reservation.notes = notes;
    }
    if (customerName !== undefined) {
      reservation.customerName = customerName.trim();
    }
    if (whatsAppPhone !== undefined) {
      reservation.whatsAppPhone = whatsAppPhone.trim();
    }

    await reservation.save();

    emitGlobal("reservation:update", serializeDoc(reservation));
    res.json(serializeDoc(reservation));
  } catch (err: any) {
    console.error("[API] PUT /api/reservations/:id error:", err);
    res.status(500).json({ error: "Failed to update reservation" });
  }
});

// POST /api/public/reservations (customer website booking, unauthenticated)
app.post("/api/public/reservations", async (req, res) => {
  try {
    const { branchId, tableId, customerName, whatsAppPhone, guestCount, dateTime, notes, language } = req.body;

    if (!branchId || !mongoose.isValidObjectId(branchId)) {
      res.status(400).json({ error: "Valid branchId is required" });
      return;
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      res.status(400).json({ error: "Branch not found" });
      return;
    }

    if (!branch.reservationEnabled) {
      res.status(400).json({ error: "Table reservation is not enabled on this branch" });
      return;
    }

    if (!customerName || !customerName.trim()) {
      res.status(400).json({ error: "Your name is required" });
      return;
    }

    if (!whatsAppPhone || !whatsAppPhone.trim()) {
      res.status(400).json({ error: "WhatsApp phone number is required" });
      return;
    }

    if (!dateTime) {
      res.status(400).json({ error: "Date and time are required" });
      return;
    }

    const requestedTime = new Date(dateTime);

    // Check branch operational hours for requested time
    const restaurant = await Restaurant.findById(branch.restaurantId);
    const timezone = restaurant?.timezone || "Europe/Berlin";
    if (!isTimeWithinRange(requestedTime, branch, timezone)) {
      res.status(400).json({ error: "Restaurant is closed at the selected time / Das Restaurant ist zur ausgewählten Zeit geschlossen" });
      return;
    }

    const reservation = new Reservation({
      branchId,
      tableId: tableId && mongoose.isValidObjectId(tableId) ? tableId : undefined,
      customerName: customerName.trim(),
      whatsAppPhone: whatsAppPhone.trim(),
      guestCount: Number(guestCount) || 2,
      dateTime: requestedTime,
      durationMinutes: 90,
      notes: notes || "",
      status: "pending",
      source: "website",
    });

    await reservation.save();

    emitGlobal("reservation:new", serializeDoc(reservation));

    // Send direct WhatsApp confirmation to customer if whatsapp service is linked
    try {
      const lang = (language === "ar" || language === "en" || language === "de" || language === "tr") ? language : "de";
      const formattedDate = requestedTime.toLocaleString(
        lang === "ar" ? "ar-EG" : lang === "en" ? "en-US" : lang === "tr" ? "tr-TR" : "de-DE",
        { timeZone: timezone }
      );
      let confirmationMsg = "";
      if (lang === "ar") {
        confirmationMsg = `*تم استلام طلب حجز الطاولة*\n\nمرحباً ${customerName.trim()}،\nلقد تلقينا طلب الحجز الخاص بك لـ *${guestCount} أشخاص* في *${formattedDate}*.\n\nالحالة: *قيد الانتظار* (سنقوم بالرد عليك قريباً!)\n\nشكراً لاختيارك،\n${branch.name}`;
      } else if (lang === "en") {
        confirmationMsg = `*Table Reservation Request Received*\n\nHello ${customerName.trim()},\nwe have received your reservation request for *${guestCount} guests* on *${formattedDate}*.\n\nStatus: *Pending* (We will confirm shortly!)\n\nThank you for choosing us,\n${branch.name}`;
      } else if (lang === "tr") {
        confirmationMsg = `*Masa Rezervasyonu Talebi Alındı*\n\nMerhaba ${customerName.trim()},\n*${guestCount} kişi* için *${formattedDate}* tarihindeki rezervasyon talebinizi aldık.\n\nDurum: *Beklemede* (Yakında onaylayacağız!)\n\nBizi tercih ettiğiniz için teşekkür ederiz,\n${branch.name}`;
      } else {
        confirmationMsg = `*Tischreservierung erhalten*\n\nHallo ${customerName.trim()},\nwir haben Ihre Reservierung für *${guestCount} Personen* am *${formattedDate}* erhalten.\n\nStatus: *Ausstehend* (Wir melden uns in Kürze!)\n\nDanke für Ihre Wahl,\n${branch.name}`;
      }
      await sendWhatsAppMessage(branch._id.toString(), whatsAppPhone.trim(), confirmationMsg);
    } catch (waErr) {
      console.warn("[Reservations Webhook] Failed to send auto-WhatsApp confirm:", waErr);
    }

    res.status(201).json(serializeDoc(reservation));
  } catch (err: any) {
    console.error("[API] POST /api/public/reservations error:", err);
    res.status(500).json({ error: "Failed to request table reservation" });
  }
});

// POST /api/public/whatsapp-cart (sync visual menu selection to WhatsApp convo)
app.post("/api/public/whatsapp-cart", async (req, res) => {
  try {
    const { convoId, items } = req.body;

    if (!convoId || !mongoose.isValidObjectId(convoId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const convo = await Conversation.findById(convoId);
    if (!convo) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Cart items are empty" });
      return;
    }

    const branchConfig = await loadBranchConfig(convo.branchId);
    const dbMenuItems = await MenuItem.find({ isActive: true }).lean();

    let subtotal = 0;
    const validatedItems = items.map((item: any) => {
      const dbItem = dbMenuItems.find((mi) => mi._id.toString() === item.itemId || mi.id === item.itemId);
      if (!dbItem) {
        throw new Error(`Item ${item.itemId} not found in database`);
      }

      let modifiersPrice = 0;
      const selectedModifiers = (item.selectedModifiers || []).map((mod: any) => {
        const group = dbItem.modifierGroups?.find((g: any) => g.id === mod.groupId);
        const option = group?.options?.find((o: any) => o.id === mod.option?.id);
        if (!option) {
          throw new Error(`Modifier option ${mod.option?.id} not found in group ${mod.groupId}`);
        }
        modifiersPrice += toFiniteNumber(option.priceAdjustment, 0);
        return {
          groupId: mod.groupId,
          groupName: group.name,
          option: {
            id: option.id,
            name: option.name,
            priceAdjustment: option.priceAdjustment,
          },
        };
      });

      let upsellPrice = 0;
      let selectedUpsell = undefined;
      if (item.selectedUpsell) {
        const upsell = dbItem.upsellSuggestions?.find((u: any) => u.id === item.selectedUpsell.id);
        if (upsell) {
          upsellPrice = toFiniteNumber(upsell.price, 0);
          selectedUpsell = {
            id: upsell.id,
            name: upsell.suggestedItemName || upsell.name,
            price: upsell.price,
          };
        }
      }

      const basePrice = toFiniteNumber(dbItem.basePrice, 0);
      const quantity = Math.max(1, toFiniteNumber(item.quantity, 1));
      const itemTotal = (basePrice + modifiersPrice) * quantity + upsellPrice;
      subtotal += itemTotal;

      return {
        itemId: dbItem._id.toString(),
        name: dbItem.name,
        basePrice,
        quantity,
        selectedModifiers,
        selectedUpsell,
        totalPrice: itemTotal,
      };
    });

    const deliveryFee = convo.unsubmittedOrder?.orderType === "delivery" ? branchConfig.deliveryFee : 0;
    const total = subtotal + deliveryFee;

    convo.unsubmittedOrder = {
      ...convo.unsubmittedOrder,
      items: validatedItems,
      subtotal,
      deliveryFee,
      total,
      status: "received",
    };

    const hasOrderType = !!convo.unsubmittedOrder?.orderType;
    if (hasOrderType) {
      convo.currentStep = "confirming";
    } else {
      convo.currentStep = "type";
    }
    convo.updatedAt = new Date();
    await convo.save();

    emitGlobal("conversation:updated", serializeDoc(convo));

    const lang = convo.customerLanguage || "de";
    let summaryText = "";
    if (hasOrderType) {
      summaryText = buildConfirmationSummary(convo, lang, branchConfig);
    } else {
      const cartLoadedText = lang === "ar"
        ? "لقد قمت بتحميل سلة طلباتك! 🛒\n\n"
        : lang === "en"
        ? "I have loaded your cart! 🛒\n\n"
        : lang === "tr"
        ? "Sepetinizi yükledim! 🛒\n\n"
        : "Ich habe Ihren Warenkorb geladen! 🛒\n\n";
      summaryText = cartLoadedText + getWelcomeReply(lang, branchConfig, convo._id?.toString() || convo.id);
    }
    
    try {
      await sendConversationWhatsAppMessage(convo, summaryText);
    } catch (wsErr: any) {
      console.warn("[API] Failed to send whatsapp confirmation message for synced cart:", wsErr.message);
    }

    res.json({ success: true, conversation: serializeDoc(convo) });
  } catch (err: any) {
    console.error("[API] POST /api/public/whatsapp-cart error:", err);
    res.status(500).json({ error: err.message || "Failed to sync cart to WhatsApp" });
  }
});

// POST /api/public/payments/webhook (Stripe Payment Completion Webhook)
app.post("/api/public/payments/webhook", async (req: any, res) => {
  const sig = req.headers["stripe-signature"];
  try {
    const restaurant = await Restaurant.findOne({ isActive: true });
    if (!restaurant) {
      res.status(404).json({ error: "Active restaurant not found" });
      return;
    }

    if (!restaurant.stripeSecretKey || !restaurant.stripeWebhookSecret) {
      res.status(400).json({ error: "Stripe configuration is incomplete on the server" });
      return;
    }

    const stripeInstance = new Stripe(restaurant.stripeSecretKey, {
      apiVersion: "2023-10-16" as any,
    });

    let event;
    try {
      event = stripeInstance.webhooks.constructEvent(
        req.rawBody,
        sig || "",
        restaurant.stripeWebhookSecret
      );
    } catch (err: any) {
      console.error(`[Webhook] Signature verification failed:`, err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId;
      if (orderId && mongoose.isValidObjectId(orderId)) {
        const order = await Order.findById(orderId);
        if (order && order.paymentStatus !== "paid") {
          const oldPaymentStatus = order.paymentStatus;
          order.paymentStatus = "paid";
          order.paymentAudit = {
            paymentProvider: "Stripe",
            paymentIntentId: session.payment_intent || session.id,
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || "eur").toUpperCase(),
            status: "succeeded",
            paidAt: new Date(),
          };

          order.statusHistory.push({
            from: `payment:${oldPaymentStatus}`,
            to: `payment:paid`,
            by: "webhook",
            timestamp: new Date(),
          });

          await order.save();

          // Save audit records in Payment and PaymentTransaction
          const payment = await Payment.create({
            orderId: order._id,
            restaurantId: order.restaurantId,
            branchId: order.branchId,
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || "eur").toUpperCase(),
            provider: "Stripe",
            status: "completed",
            transactionId: session.payment_intent || session.id,
          });

          await PaymentTransaction.create({
            paymentId: payment._id,
            orderId: order._id,
            provider: "Stripe",
            eventType: event.type,
            externalId: session.payment_intent || session.id,
            payload: event,
            status: "completed",
          });

          // Now notify dashboard and kitchen printing
          emitGlobal("order:new", serializeDoc(order));
          triggerAutoPrint(order);
          console.log(`[Webhook] Order ${order.orderNumber} successfully marked as PAID`);
        }
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// PUT /api/orders/:id/status
app.put("/api/orders/:id/status", authMiddleware as any, requireRole(...ORDER_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const previousStatus = order.status;
    order.status = status;

    // Log this status transition with user identification
    const updatedBy = (req as any).user?.email || (req as any).user?._id?.toString() || "admin";
    order.statusHistory.push({
      from: previousStatus,
      to: status,
      by: updatedBy,
      timestamp: new Date(),
    });

    await order.save();

    // Push status update message to customer's conversation
    const convo = (order.whatsAppPhone && order.whatsAppPhone.trim())
      ? await Conversation.findOne({ whatsAppPhone: order.whatsAppPhone })
      : null;
    if (convo) {
      const template = (orderStatusMessages as any)[status];
      if (template) {
        const lastCustMsg = convo.messages.filter((m: any) => m.sender === "customer").pop();
        const text = lastCustMsg ? lastCustMsg.text.toLowerCase() : "";
        const lang: CustomerLanguage = isCustomerLanguage(convo.customerLanguage)
          ? convo.customerLanguage
          : detectCustomerLanguage(text) || "de";

        const restaurant = await Restaurant.findOne({ isActive: true }).lean();
        const restaurantName = restaurant?.name || "MR. Tabboush";

        let msgText = template[lang] || template.de;
        msgText = msgText
          .replace(/{orderNumber}/g, order.orderNumber)
          .replace(/{restaurantName}/g, restaurantName)
          .replace(/{total}/g, `${(order.total || 0).toFixed(2)}${defaultCurrency.symbol}`)
          .replace(/{paymentMethod}/g, order.paymentMethod)
          .replace(/{prepTime}/g, String(order.items?.[0]?.basePrice ? 12 : 15))
          .replace(/{address}/g, order.deliveryAddress || "");

        convo.messages.push({
          id: "msg-" + Math.random().toString(36).substr(2, 9),
          sender: "bot",
          text: msgText,
          timestamp: new Date().toISOString(),
        });
        convo.updatedAt = new Date();
        await convo.save();

        // Send actual WhatsApp message if session is active
        try {
          await sendConversationWhatsAppMessage(convo, msgText);
        } catch (wsErr: any) {
          console.warn(`[API] Failed to deliver real WhatsApp status notification:`, wsErr.message);
        }
      }
    }

    const orders = await Order.find({
      $or: [
        { paymentMethod: { $ne: "Stripe" } },
        { paymentMethod: "Stripe", paymentStatus: "paid" }
      ]
    }).sort({ createdAt: -1 }).lean();
    const conversations = await Conversation.find().sort({ updatedAt: -1 }).lean();

    emitGlobal("order:updated", { orderId: id, status });
    if (convo) emitGlobal("conversation:updated", serializeDoc(convo));

    res.json({
      order: { ...order.toObject(), id: order._id?.toString() || order.id },
      orders: orders.map((o: any) => ({ ...o, id: o._id?.toString() || o.id })),
      conversations: serializeDocs(conversations),
    });
  } catch (err) {
    console.error("[API] PUT /api/orders/:id/status error:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/conversations/:convoId/messages
app.post("/api/conversations/:convoId/messages", authMiddleware as any, requireRole(...CHAT_ROLES) as any, async (req, res) => {
  try {
    const { convoId } = req.params;
    const { text, sender } = req.body;

    const convo = await Conversation.findById(convoId);
    if (!convo) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const newMessage = {
      id: "msg-" + Math.random().toString(36).substr(2, 9),
      sender: sender || "human",
      text,
      timestamp: new Date().toISOString(),
    };

    convo.messages.push(newMessage);
    convo.updatedAt = new Date();

    if (sender === "human") {
      await sendConversationWhatsAppMessage(convo, text);
      convo.botEnabled = false;
    }

    await convo.save();
    const serializedConvo = serializeDoc(convo);
    emitGlobal("conversation:updated", serializedConvo);
    res.json(serializedConvo);
  } catch (err) {
    console.error("[API] POST /api/conversations/:convoId/messages error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/conversations/:convoId/takeover
app.post("/api/conversations/:convoId/takeover", authMiddleware as any, requireRole(...CHAT_ROLES) as any, async (req, res) => {
  try {
    const { convoId } = req.params;
    const { botEnabled } = req.body;

    const convo = await Conversation.findById(convoId);
    if (!convo) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    convo.botEnabled = botEnabled;
    convo.updatedAt = new Date();

    if (botEnabled) {
      const reactivationText = "🤖 تم إعادة تفعيل المساعد الآلي لخدمتك!\n🤖 Der Bestell-Bot ist wieder aktiv und bereit für Sie!";
      convo.messages.push({
        id: "msg-" + Math.random().toString(36).substr(2, 9),
        sender: "bot",
        text: reactivationText,
        timestamp: new Date().toISOString(),
      });
      await sendConversationWhatsAppMessage(convo, reactivationText);
    }

    await convo.save();
    const serializedConvo = serializeDoc(convo);
    emitGlobal("conversation:updated", serializedConvo);
    res.json(serializedConvo);
  } catch (err) {
    console.error("[API] POST /api/conversations/:convoId/takeover error:", err);
    res.status(500).json({ error: "Failed to toggle takeover" });
  }
});

// POST /api/campaigns - Create a new campaign draft
app.post("/api/campaigns", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ isActive: true });
    if (!restaurant) {
      res.status(404).json({ error: "Active restaurant context not found" });
      return;
    }

    const { title, description, language, segment, message } = req.body;
    const campaign = new Campaign({
      restaurantId: restaurant._id,
      title,
      description,
      language,
      segment,
      message,
      status: "draft",
    });

    await campaign.save();
    
    res.status(201).json({
      ...campaign.toObject(),
      id: campaign._id.toString(),
    });
  } catch (err) {
    console.error("[API] POST /api/campaigns error:", err);
    res.status(500).json({ error: "Failed to create campaign draft" });
  }
});

// PUT /api/campaigns/:id - Update an existing campaign draft
app.put("/api/campaigns/:id", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, language, segment, message } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    if (campaign.status !== "draft") {
      res.status(400).json({ error: "Only draft campaigns can be updated" });
      return;
    }

    campaign.title = title;
    campaign.description = description;
    campaign.language = language;
    campaign.segment = segment;
    campaign.message = message;
    
    await campaign.save();

    res.json({
      ...campaign.toObject(),
      id: campaign._id.toString(),
    });
  } catch (err) {
    console.error("[API] PUT /api/campaigns/:id error:", err);
    res.status(500).json({ error: "Failed to update campaign draft" });
  }
});

// POST /api/campaigns/:id/send
app.post("/api/campaigns/:id/send", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;

    const tempCampaign = await Campaign.findById(id);
    if (!tempCampaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    let query: any = {};
    if (tempCampaign.language !== "all") {
      if (tempCampaign.language === "de") {
        query = {
          $or: [
            { customerLanguage: "de" },
            { customerLanguage: { $exists: false } },
            { customerLanguage: null }
          ]
        };
      } else {
        query = { customerLanguage: tempCampaign.language };
      }
    }

    let targets = await Conversation.find(query).lean();

    // Segment filtering (Active vs Dormant based on completed order history)
    if (tempCampaign.segment === "active" || tempCampaign.segment === "dormant") {
      const completedOrders = await Order.find({
        status: { $in: ["accepted", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"] }
      }).lean();
      
      const activeCustomerPhones = new Set(
        completedOrders.map((o: any) => o.whatsAppPhone?.trim().replace(/\D/g, "")).filter(Boolean)
      );

      targets = targets.filter((convo: any) => {
        const phone = convo.whatsAppPhone?.trim().replace(/\D/g, "");
        const isActive = activeCustomerPhones.has(phone);
        return tempCampaign.segment === "active" ? isActive : !isActive;
      });
    }

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { status: "sending", totalTarget: targets.length },
      { new: true }
    );

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    setTimeout(async () => {
      let sent = 0;
      let failed = 0;

      for (const convo of targets) {
        try {
          // Determine the correct language version for this customer
          let lang = campaign.language;
          if (lang === "all") {
            lang = convo.customerLanguage || "de";
          }
          const bodyText = (campaign.message as any)[lang] || campaign.message.de || campaign.message.ar || campaign.message.en || campaign.message.tr;
          const fullMessageText = `📢 *${campaign.title}*\n\n${bodyText}`;

          // Append to database conversation messages history
          const messageId = "camp-msg-" + Math.random().toString(36).substr(2, 9);
          const newMsg = {
            id: messageId,
            sender: "bot" as const,
            text: fullMessageText,
            timestamp: new Date().toISOString(),
          };

          await Conversation.findByIdAndUpdate(convo._id, {
            $push: { messages: newMsg },
            updatedAt: new Date(),
          });

          // Send actual WhatsApp message
          await sendConversationWhatsAppMessage(convo, fullMessageText);
          sent++;

          // Add to campaign recipients list
          await Campaign.findByIdAndUpdate(id, {
            $push: { recipients: convo.whatsAppPhone }
          });

          // Real-time socket updates for chat logs
          const updatedConvo = await Conversation.findById(convo._id).lean();
          if (updatedConvo) {
            emitGlobal("conversation:updated", serializeDoc(updatedConvo));
          }
        } catch (e) {
          console.error(`[Campaign Broadcast] Failed to send to ${convo.whatsAppPhone}:`, e);
          failed++;
        }

        // Safe delay of 2 seconds to prevent WhatsApp spam flags/blocks
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      await Campaign.findByIdAndUpdate(id, {
        status: "sent",
        sentCount: sent,
        failedCount: failed,
      });

      emitGlobal("campaign:sent", { campaignId: id });
    }, 1000);

    const conversations = await Conversation.find().sort({ updatedAt: -1 }).lean();
    res.json({
      campaign,
      conversations: conversations.map((c: any) => ({ ...c, id: c._id?.toString() || c.id })),
    });
  } catch (err) {
    console.error("[API] POST /api/campaigns/:id/send error:", err);
    res.status(500).json({ error: "Failed to send campaign" });
  }
});

// POST /api/campaigns/:id/test - Send a test message to a single contact
app.post("/api/campaigns/:id/test", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const { testPhone } = req.body;

    if (!testPhone || !testPhone.trim()) {
      res.status(400).json({ error: "Test phone number is required" });
      return;
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Normalise test phone number
    const normalizedPhone = testPhone.trim();

    // Look up if we have an existing conversation with this customer
    let convo = await Conversation.findOne({
      $or: [
        { whatsAppPhone: normalizedPhone },
        { whatsAppPhone: normalizedPhone.replace("+", "") }
      ]
    }).lean();

    // If no existing conversation exists, mock a temporary conversation object
    if (!convo) {
      convo = {
        whatsAppPhone: normalizedPhone,
        customerName: "Test Contact",
        customerLanguage: campaign.language === "all" ? "de" : campaign.language,
        botEnabled: false,
        messages: [],
      } as any;
    }

    // Determine the correct language version for the test contact
    let lang = campaign.language;
    if (lang === "all") {
      lang = convo.customerLanguage || "de";
    }
    const bodyText = (campaign.message as any)[lang] || campaign.message.de || campaign.message.ar || campaign.message.en || campaign.message.tr;
    const fullMessageText = `📢 *[TEST] ${campaign.title}*\n\n${bodyText}`;

    // Send the WhatsApp message using the helper
    await sendConversationWhatsAppMessage(convo, fullMessageText);

    res.json({ success: true, msg: "Test message dispatched successfully" });
  } catch (err) {
    console.error("[API] POST /api/campaigns/:id/test error:", err);
    res.status(500).json({ error: "Failed to dispatch test message" });
  }
});

// GET /api/customers - Unified customer directory aggregated from conversations, orders, and reservations
app.get("/api/customers", authMiddleware as any, requireRole(...MANAGER_ROLES) as any, async (req, res) => {
  try {
    const [conversations, orders, reservations, tables] = await Promise.all([
      Conversation.find().lean(),
      Order.find().lean(),
      Reservation.find().lean(),
      Table.find().lean(),
    ]);

    const tableMap = new Map<string, string>(
      tables.map((t: any) => [t._id ? t._id.toString() : t.id, t.number])
    );

    // Grouping structure to track unique aggregated client records
    const customerMap = new Map<string, {
      name: string;
      phone: string;
      sources: Set<string>;
      ordersCount: number;
      totalSpend: number;
      lastOrderDate?: string;
      lastInteractionDate: string;
      preferredLanguage?: string;
      segment: "active" | "dormant";
      recentOrders: any[];
      recentReservations: any[];
    }>();

    const normalizePhone = (p: string | undefined | null) => {
      if (!p) return "";
      return p.trim().replace(/\D/g, "");
    };

    const getOrCreateCustomer = (phone: string, fallbackName: string) => {
      const key = phone || `name-${fallbackName.trim().toLowerCase()}`;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: fallbackName || "Guest Customer",
          phone: phone || "",
          sources: new Set<string>(),
          ordersCount: 0,
          totalSpend: 0,
          lastInteractionDate: new Date(0).toISOString(),
          segment: "dormant",
          recentOrders: [],
          recentReservations: [],
        });
      }
      return customerMap.get(key)!;
    };

    // 1. WhatsApp conversation records
    for (const convo of conversations) {
      const phone = normalizePhone(convo.whatsAppPhone);
      const customer = getOrCreateCustomer(phone, convo.customerName);
      
      customer.sources.add("whatsapp");
      if (convo.customerLanguage) {
        customer.preferredLanguage = convo.customerLanguage;
      }
      if (convo.customerName && convo.customerName !== "Test Contact" && convo.customerName !== "Guest Customer") {
        customer.name = convo.customerName;
      }
      
      const convoDate = convo.updatedAt ? new Date(convo.updatedAt).toISOString() : new Date(convo.createdAt || 0).toISOString();
      if (convoDate > customer.lastInteractionDate) {
        customer.lastInteractionDate = convoDate;
      }
    }

    // 2. Order records across all channels (qr table, POS, whatsapp, web)
    for (const order of orders) {
      const phone = normalizePhone(order.whatsAppPhone);
      const customer = getOrCreateCustomer(phone, order.customerName);

      if (order.source) {
        customer.sources.add(order.source);
      } else {
        customer.sources.add("website");
      }

      if (order.customerName && order.customerName !== "Guest Customer") {
        customer.name = order.customerName;
      }

      const countAsOrder = order.status !== "cancelled";
      if (countAsOrder) {
        customer.ordersCount += 1;
        const isPaid = order.paymentStatus === "paid" || 
                       ["Cash on Delivery", "Cash", "Manual"].includes(order.paymentMethod);
        if (isPaid) {
          customer.totalSpend += Number(order.total) || 0;
        }
      }

      const orderDate = new Date(order.createdAt || 0).toISOString();
      if (orderDate > customer.lastInteractionDate) {
        customer.lastInteractionDate = orderDate;
      }

      if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
        customer.lastOrderDate = orderDate;
      }

      customer.recentOrders.push({
        id: order._id ? order._id.toString() : order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        source: order.source || "whatsapp",
        createdAt: order.createdAt,
      });
    }

    // 3. Table reservations
    for (const resv of reservations) {
      const phone = normalizePhone(resv.whatsAppPhone);
      const customer = getOrCreateCustomer(phone, resv.customerName);

      customer.sources.add("reservation");
      if (resv.customerName) {
        customer.name = resv.customerName;
      }

      const resvDate = new Date(resv.dateTime || resv.createdAt || 0).toISOString();
      if (resvDate > customer.lastInteractionDate) {
        customer.lastInteractionDate = resvDate;
      }

      customer.recentReservations.push({
        id: resv._id ? resv._id.toString() : resv.id,
        dateTime: resv.dateTime,
        tableNumber: resv.tableId ? tableMap.get(resv.tableId.toString()) : undefined,
        status: resv.status,
        guestCount: resv.guestCount,
        numPeople: resv.guestCount,
      });
    }

    // Map sets to arrays and format data structure
    const customerList = Array.from(customerMap.values()).map(c => {
      c.segment = c.ordersCount > 0 ? "active" : "dormant";
      
      c.recentOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      c.recentOrders = c.recentOrders.slice(0, 5);

      c.recentReservations.sort((a: any, b: any) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      c.recentReservations = c.recentReservations.slice(0, 5);

      return {
        ...c,
        sources: Array.from(c.sources),
        totalSpend: Math.round(c.totalSpend * 100) / 100,
      };
    });

    // Sort by last active interaction date
    customerList.sort((a, b) => new Date(b.lastInteractionDate).getTime() - new Date(a.lastInteractionDate).getTime());

    res.json(customerList);
  } catch (err) {
    console.error("[API] GET /api/customers error:", err);
    res.status(500).json({ error: "Failed to fetch aggregated customer list" });
  }
});

// POST /api/feedbacks
app.post("/api/feedbacks", async (req, res) => {
  try {
    const { orderId, rating, comment, customerName, whatsAppPhone } = req.body;
    const feedback = new Feedback({
      orderId,
      customerName,
      whatsAppPhone,
      rating,
      comment,
      status: "pending",
    });
    await feedback.save();
    emitGlobal("feedback:new", feedback);
    res.status(201).json(feedback);
  } catch (err) {
    console.error("[API] POST /api/feedbacks error:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

// POST /api/menu/items
app.post("/api/menu/items", authMiddleware as any, requireRole(...MENU_ROLES) as any, async (req, res) => {
  try {
    const restaurant = req.body.restaurantId
      ? await Restaurant.findById(req.body.restaurantId).lean()
      : await Restaurant.findOne({ isActive: true }).lean();

    let category = null;
    if (mongoose.isValidObjectId(req.body.categoryId)) {
      category = await Category.findById(req.body.categoryId).lean();
    }
    if (!category) {
      category = await Category.findOne({ isActive: true }).sort({ sortOrder: 1 }).lean();
    }

    if (!restaurant || !category) {
      res.status(400).json({ error: "Restaurant and category are required before creating menu items" });
      return;
    }

    const count = await MenuItem.countDocuments();
    const item = new MenuItem({
      ...req.body,
      restaurantId: restaurant._id,
      categoryId: category._id,
      sortOrder: req.body.sortOrder || count + 1,
      isActive: true,
      isBestSeller: false,
      isAvailableForPickup: true,
      isAvailableForDelivery: true,
      modifierGroups: req.body.modifierGroups || [],
      upsellSuggestions: req.body.upsellSuggestions || [],
    });
    await item.save();
    emitGlobal("menu:updated", item);
    res.status(201).json(item);
  } catch (err) {
    console.error("[API] POST /api/menu/items error:", err);
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

// PUT /api/menu/items/:id
app.put("/api/menu/items/:id", authMiddleware as any, requireRole(...MENU_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findByIdAndUpdate(id, req.body, { new: true });
    if (!item) {
      res.status(404).send("Item not found");
      return;
    }
    emitGlobal("menu:updated", item);
    res.json(item);
  } catch (err) {
    console.error("[API] PUT /api/menu/items/:id error:", err);
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

// DELETE /api/menu/items/:id — soft delete so historical orders remain intact
app.delete("/api/menu/items/:id", authMiddleware as any, requireRole(...MENU_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    emitGlobal("menu:updated", item);
    res.json({ message: "Menu item deactivated", item });
  } catch (err) {
    console.error("[API] DELETE /api/menu/items/:id error:", err);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
});

// ------------------------------------------------------------------
// 5. Bot Reply Route (Gemini + Rule-Based Fallback)
// ------------------------------------------------------------------
app.post("/api/bot-reply", async (req, res) => {
  try {
    const {
      message,
      customerName,
      whatsappJid,
      whatsappPhoneJid,
      whatsappLid,
    } = req.body;
    const phone = cleanedString(req.body.phone) || strippedJidUser(whatsappJid) || "unknown";
    const cleanCustomerName = cleanedString(customerName);
    const cleanWhatsAppJid = cleanedString(whatsappJid);
    const cleanWhatsAppPhoneJid = cleanedString(whatsappPhoneJid);
    const cleanWhatsAppLid = cleanedString(whatsappLid);
    const identity = {
      phone,
      customerName: cleanCustomerName,
      whatsappJid: cleanWhatsAppJid,
      whatsappPhoneJid: cleanWhatsAppPhoneJid,
      whatsappLid: cleanWhatsAppLid,
    };

    const lookupValues = Array.from(new Set([
      phone,
      cleanWhatsAppJid,
      cleanWhatsAppPhoneJid,
      cleanWhatsAppLid,
      strippedJidUser(cleanWhatsAppJid),
      strippedJidUser(cleanWhatsAppPhoneJid),
      strippedJidUser(cleanWhatsAppLid),
    ].filter(Boolean) as string[]));

    let convo = await Conversation.findOne({
      $or: [
        { whatsAppPhone: { $in: lookupValues } },
        { whatsAppJid: { $in: lookupValues } },
        { whatsAppPhoneJid: { $in: lookupValues } },
        { whatsAppLid: { $in: lookupValues } },
      ],
    });
    const [dbMenuItems, dbCategories, dbOrders] = await Promise.all([
      MenuItem.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
      Category.find().sort({ sortOrder: 1 }).lean(),
      Order.find().sort({ createdAt: -1 }).lean(),
    ]);

    if (!convo) {
      const [defaultRestaurant, defaultBranch] = await Promise.all([
        Restaurant.findOne({ isActive: true }).lean(),
        Branch.findOne({ isActive: true }).lean(),
      ]);
      convo = new Conversation({
        customerName: cleanCustomerName || guestName(phone),
        whatsAppPhone: phone,
        whatsAppJid: cleanWhatsAppJid,
        whatsAppPhoneJid: cleanWhatsAppPhoneJid,
        whatsAppLid: cleanWhatsAppLid,
        restaurantId: defaultRestaurant?._id,
        branchId: defaultBranch?._id,
        botEnabled: true,
        messages: [],
        currentStep: "welcome",
        unsubmittedOrder: {
          branchId: defaultBranch?._id?.toString() || "",
          customerName: cleanCustomerName || guestName(phone),
          whatsAppPhone: phone,
          items: [],
          subtotal: 0,
          deliveryFee: 0,
          total: 0,
          status: "received",
          paymentMethod: "Cash on Delivery",
        },
      });
    } else {
      await updateConversationIdentity(convo, identity);
    }

    const branchConfig = await loadBranchConfig(convo.branchId);

    // Push user message
    const userMsg = {
      id: "msg-" + Math.random().toString(36).substr(2, 9),
      sender: "customer" as const,
      text: message,
      timestamp: new Date().toISOString(),
    };
    convo.messages.push(userMsg);
    convo.updatedAt = new Date();
    await convo.save();

    // If human mode, don't auto-reply
    if (!convo.botEnabled) {
      res.json({ conversation: serializeDoc(convo), dbOrders: serializeDocs(dbOrders), botReplyText: null });
      return;
    }

    const activeRestaurant = await Restaurant.findOne({ isActive: true }).lean();
    const isGeminiEnabled = activeRestaurant ? activeRestaurant.geminiEnabled !== false : true;
    const aiClient = isGeminiEnabled ? getGeminiClient() : null;
    let botReplyText = "";
    let nextStep = convo.currentStep || "welcome";
    let finalPlacedOrder: any = null;
    let finalPlacedReservation: any = null;
    const text = message.toLowerCase();
    const storedLanguage = isCustomerLanguage(convo.customerLanguage) ? convo.customerLanguage : null;
    const detectedLanguage = detectCustomerLanguage(message);
    const explicitLanguage = detectExplicitLanguageRequest(message);
    let lang: CustomerLanguage = storedLanguage || detectedLanguage || "de";

    if (nextStep === "awaiting_feedback") {
      const ratingMatch = message.trim().match(/^[1-5]/);
      const feedbackFlowCmd = detectFlowCommand(message);
      const isOrderStart = /^(هلو|أهلاً|مرحبا|أهلا|طلب|order|hallo|menu|menü|start|bestellen|hi|hello)/i.test(message.trim());

      if (ratingMatch) {
        const rating = parseInt(ratingMatch[0]);
        const comment = message.replace(/^[1-5]\s*[-:]*\s*/, "").trim();

        // Find their last completed order to link to the feedback
        const lastOrder = await Order.findOne({ whatsAppPhone: phone }).sort({ createdAt: -1 });
        const orderNumber = lastOrder?.orderNumber || "whatsapp-review";

        const feedback = new Feedback({
          orderId: orderNumber,
          customerName: convo.customerName || `Guest ${phone.substring(phone.length - 4)}`,
          whatsAppPhone: phone,
          rating,
          comment,
          status: "pending"
        });
        await feedback.save();
        emitGlobal("feedback:new", feedback);

        const restaurant = await Restaurant.findOne({ isActive: true }).lean();
        const googleMapsReviewLink = restaurant?.googleMapsReviewLink || "";

        if (rating === 5 && googleMapsReviewLink) {
          botReplyText = lang === "ar"
            ? `شكراً جزيلاً لتقييمك الرائع بـ 5 نجوم! ⭐⭐⭐⭐⭐\nإذا كان لديك دقيقة، يسعدنا دعمك لنا بتقييم مباشر على Google: ${googleMapsReviewLink} ❤️`
            : lang === "en"
            ? `Thank you so much for your wonderful 5-star review! ⭐⭐⭐⭐⭐\nIf you have a minute, please support us on Google: ${googleMapsReviewLink} ❤️`
            : lang === "tr"
            ? `Harika 5 yıldızlı yorumunuz için çok teşekkür ederiz! ⭐⭐⭐⭐⭐\nBir dakikanız varsa, lütfen bizi Google'da destekleyin: ${googleMapsReviewLink} ❤️`
            : `Vielen Dank für Ihre tolle 5-Sterne-Bewertung! ⭐⭐⭐⭐⭐\nWenn Sie eine Minute Zeit haben, unterstützen Sie uns bitte mit einer Bewertung auf Google: ${googleMapsReviewLink} ❤️`;
        } else {
          botReplyText = lang === "ar"
            ? `شكراً جزيلاً لمشاركتنا تقييمك! سنعمل دائماً على تقديم الأفضل لك. 🌹`
            : lang === "en"
            ? `Thank you for sharing your feedback! We will continue working hard to serve you. 🌹`
            : lang === "tr"
            ? `Geri bildiriminizi paylaştığınız için teşekkür ederiz! Size hizmet etmek için çok çalışmaya devam edeceğiz. 🌹`
            : `Vielen Dank für Ihr Feedback! Wir arbeiten stets daran, unseren Service zu verbessern. 🌹`;
        }
        nextStep = "welcome";
      } else if (feedbackFlowCmd === "restart" || feedbackFlowCmd === "cancel" || isOrderStart) {
        // Customer wants to skip rating and start a new order — allow it
        convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
        nextStep = "type";
        const skipNote = lang === "ar"
          ? "يمكنك دائماً تقييمنا لاحقاً! 🌟 لنبدأ طلبك الجديد:\n\n"
          : lang === "en"
          ? "You can always rate us later! 🌟 Let's start your new order:\n\n"
          : lang === "tr"
          ? "Bizi her zaman daha sonra değerlendirebilirsiniz! 🌟 Yeni siparişinizi başlatalım:\n\n"
          : "Sie können uns jederzeit später bewerten! 🌟 Starten wir Ihre neue Bestellung:\n\n";
        botReplyText = skipNote + getWelcomeReply(lang, branchConfig);
      } else {
        const restaurant = await Restaurant.findOne({ isActive: true }).lean();
        const googleMapsReviewLink = restaurant?.googleMapsReviewLink || "";
        botReplyText = lang === "ar"
          ? `يرجى الرد برقم من 1 إلى 5 لتقييم تجربتك معنا 🌟\nأو اكتب *طلب* أو *99* لبدء طلب جديد.${googleMapsReviewLink ? "\nأو تفضل بزيارة رابط تقييم Google: " + googleMapsReviewLink : ""}`
          : lang === "en"
          ? `Please reply with a number from 1 to 5 to rate your experience 🌟\nOr type *order* or *99* to start a new order.${googleMapsReviewLink ? "\nOr visit our Google review page: " + googleMapsReviewLink : ""}`
          : lang === "tr"
          ? `Deneyiminizi değerlendirmek için lütfen 1 ile 5 arasında bir sayıyla yanıt verin 🌟\nVeya yeni bir sipariş başlatmak için *sipariş* veya *99* yazın.${googleMapsReviewLink ? "\nGoogle yorum sayfamızı ziyaret edin: " + googleMapsReviewLink : ""}`
          : `Bitte antworten Sie mit einer Zahl von 1 bis 5 🌟\nOder schreiben Sie *bestellen* oder *99* für eine neue Bestellung.${googleMapsReviewLink ? "\nOder besuchen Sie Google: " + googleMapsReviewLink : ""}`;
      }
    } else if (nextStep === "language_selection") {
      const selectedLanguage = parseLanguageSelection(message);
      const selectionCommand = detectFlowCommand(message);
      if (selectedLanguage) {
        lang = selectedLanguage;
        convo.customerLanguage = selectedLanguage;
        botReplyText = getWelcomeReply(selectedLanguage, branchConfig);
        nextStep = "type";
      } else if (selectionCommand === "cancel") {
        convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
        botReplyText = getCancelReply(lang);
        nextStep = "welcome";
      } else if (selectionCommand === "help") {
        botReplyText = `${getHelpReply(lang)}\n\n${getLanguageSelectionPrompt(branchConfig)}`;
        nextStep = "language_selection";
      } else if (selectionCommand === "restart" || selectionCommand === "back") {
        botReplyText = getLanguageSelectionPrompt(branchConfig);
        nextStep = "language_selection";
      } else {
        botReplyText = getLanguageSelectionPrompt(branchConfig);
        nextStep = "language_selection";
      }
    } else if (!storedLanguage && nextStep === "welcome") {
      if (detectedLanguage) {
        lang = detectedLanguage;
        convo.customerLanguage = detectedLanguage;
      } else {
        botReplyText = getLanguageSelectionPrompt(branchConfig);
        nextStep = "language_selection";
      }
    } else if (explicitLanguage) {
      lang = explicitLanguage;
      convo.customerLanguage = explicitLanguage;
      if (storedLanguage && explicitLanguage !== storedLanguage) {
        botReplyText = getLanguageSwitchReply(explicitLanguage);
      }
    } else if (!storedLanguage && detectedLanguage) {
      lang = detectedLanguage;
      convo.customerLanguage = detectedLanguage;
    } else if (!storedLanguage && nextStep !== "welcome") {
      convo.customerLanguage = lang;
    }

    const flowCommand = !botReplyText ? detectFlowCommand(message) : null;
    if (flowCommand === "help") {
      botReplyText = getHelpReply(lang);
    } else if (flowCommand === "restart") {
      const result = applyRestart(convo, lang, branchConfig);
      botReplyText = result.botReplyText;
      nextStep = result.nextStep;
    } else if (flowCommand === "cancel") {
      convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
      botReplyText = getCancelReply(lang);
      nextStep = "welcome";
    } else if (flowCommand === "back") {
      const result = applyBack(convo, lang, nextStep, branchConfig, dbMenuItems, dbCategories);
      botReplyText = result.botReplyText;
      nextStep = result.nextStep;
    } else if (flowCommand === "change_language") {
      botReplyText = getLanguageSelectionPrompt(branchConfig);
      nextStep = "language_selection";
    } else if (flowCommand === "change_address") {
      if (!branchConfig.deliveryEnabled) {
        botReplyText = getDeliveryUnavailableReply(lang, branchConfig);
        nextStep = "type";
      } else {
        convo.unsubmittedOrder = {
          ...convo.unsubmittedOrder,
          orderType: "delivery",
          deliveryFee: branchConfig.deliveryFee,
          deliveryAddress: undefined,
          total: (convo.unsubmittedOrder?.subtotal || 0) + branchConfig.deliveryFee,
        };
        botReplyText = getAddressPrompt(lang, branchConfig);
        nextStep = "address";
      }
    } else if (flowCommand === "change_pickup_time") {
      if (!branchConfig.pickupEnabled) {
        botReplyText = getPickupUnavailableReply(lang, branchConfig);
        nextStep = "type";
      } else {
        convo.unsubmittedOrder = {
          ...convo.unsubmittedOrder,
          orderType: "pickup",
          deliveryFee: 0,
          pickupTime: undefined,
          total: convo.unsubmittedOrder?.subtotal || 0,
        };
        botReplyText = getPickupTimePrompt(lang, branchConfig);
        nextStep = "pickup_time";
      }
    } else if (flowCommand === "change_type") {
      convo.unsubmittedOrder = {
        ...convo.unsubmittedOrder,
        orderType: undefined,
        deliveryAddress: undefined,
        pickupTime: undefined,
      };
      botReplyText = getWelcomeReply(lang, branchConfig);
      nextStep = "type";
    } else if (flowCommand === "change_order") {
      resetOrderItems(convo, branchConfig);
      botReplyText = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo));
      nextStep = "menu";
    }

    if (aiClient && !botReplyText) {
      try {
        const parsedMenu = buildVisibleMenuEntries(
          dbMenuItems,
          dbCategories,
          branchConfig,
          orderTypeForMenu(convo)
        ).map(({ item, category }, index) => ({
          code: menuItemCode(index),
          id: documentId(item),
          category: category?.name,
          name: item.name,
          basePrice: item.basePrice,
          description: item.description,
          modifiers: item.modifierGroups,
          upsells: item.upsellSuggestions,
        }));

        const timezone = activeRestaurant?.timezone || "Europe/Berlin";
        const { hour, minute, dayIndex } = getLocalTimeDetails(timezone);
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const currentDayName = daysOfWeek[dayIndex];
        const currentTimeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const isClosed = !isBranchOpen(branchConfig, timezone);

        const contextPrompt = `
You are the AI WhatsApp Ordering Agent of "${branchConfig.restaurantName}" restaurant at ${branchConfig.branchAddress}, ${branchConfig.branchCity}.
The current step of the customer order is: "${nextStep}"
Current state of their incomplete order schema: ${JSON.stringify(convo.unsubmittedOrder)}

Customer Phone: ${phone}
Customer Name: ${convo.customerName}
Stored Customer Language: ${lang}
Fulfillment config:
- Branch address: ${branchConfig.branchAddress}
- Delivery enabled: ${branchConfig.deliveryEnabled}
- Pickup enabled: ${branchConfig.pickupEnabled}
- Table reservations enabled: ${branchConfig.reservationEnabled}
- Current local day of the week: ${currentDayName}
- Current local time: ${currentTimeStr}
- Operational status: ${isClosed ? "CLOSED right now. Do NOT take or confirm orders or reservations. If the customer tries to order, book or checkout, politely refuse, state that the restaurant is closed, and mention the opening hours and closed days." : "OPEN now. You can take orders or book tables."}
- Business hours: ${branchConfig.openingHours}
- Closed days (0=Sun, 1=Mon, etc.): ${JSON.stringify(branchConfig.closedDays || [])}
- Delivery area text: within ${formatMoney(branchConfig.deliveryRadiusKm)} km of the branch. Real geocoding is not available yet.
- Delivery fee: ${formatMoney(branchConfig.deliveryFee)}€.
- Minimum delivery order before delivery fee: ${formatMoney(branchConfig.minOrderAmount)}€.
- Payment is Cash only.

Available Menu items to offer:
${JSON.stringify(parsedMenu)}

Here is the conversation history so far:
${convo.messages.slice(-8).map((m: any) => m.sender.toUpperCase() + ": " + m.text).join("\n")}

NEW incoming customer message is: "${message}"

Your task is to:
1. Understand the message, but always reply in the stored customer language "${lang}" unless the customer explicitly asks to switch language.
2. Move the customer through the ordering flowchart OR table reservation flowchart:
   - If the customer wants to reserve a table:
     * Check if table reservations are enabled ('Table reservations enabled: true'). If 'false', politely inform them that table reservations are not supported by this branch.
     * If enabled, ask for/confirm the details: customer full name, guest count, and reservation date & time.
     * Validate that the requested reservation time falls within open business hours.
     * Once confirmed by the customer, set nextStep to 'completed' and return a 'placedReservationPayload'.
   - Control commands are handled by the server before this prompt, but respect them if visible in history: 00/help/Hilfe/مساعدة means show help; 0/back/zurück/رجوع means one practical step back; 8/change language/Sprache ändern/تغيير اللغة means ask for language again; 9/cancel/abbrechen/إلغاء means cancel the current draft; 99/restart/neue Bestellung/طلب جديد means reset draft and start again; change address/time/type/order should ask for the relevant field again.
   - For welcome, address, pickup time, menu, and confirmation replies, include a short localized note with the numeric shortcuts: 00 help, 0 back, 8 language, 9 cancel, 99 new order.
   - "language_selection" state: If the customer has not selected a language, ask them to choose 1 Deutsch, 2 العربية, or 3 English.
   - "welcome" state: Say hello, state the configured delivery fee/radius/minimum and available fulfillment methods. Ask them to choose Type (Delivery or Pickup), only offering enabled methods.
   - "type" state: Read choice. If they say pickup, set currentStep to "pickup_time" and ask what time they will pick it up (e.g. "19:30"). If delivery, set currentStep to "address" and ask for their delivery address in ${branchConfig.branchCity}.
   - "address"/"pickup_time" state: Save address or pickup time. Transition to "menu" and list the available menu items above using their dynamic item codes, then ask them what they'd like to eat.
   - "menu" state: If they specify an item code like 01 or a dish name, add that item to the unsubmittedOrder items list. If the item has Modifiers, list those options and ask them to choose. Or present their upsell suggestion as an irresistible offer. If they want nothing else, advance to "confirming".
   - "customizing" state: Apply modifiers based on their choices. Ask if they want to add anything else from drinks or desserts, or confirm.
   - "confirming" state: Display a gorgeous, formatted receipt / order summary in their language:
     * Order Type: Delivery (+configured fee) or Pickup
     * Chosen items with selected modifiers/upsells and calculated totals
     * Subtotal, shipping fee, final grand total
     * Delivery Address or Pickup Time
     * Note saying: Payment is CASH ONLY upon arrival/delivery.
     * Say: "Reply with '1' or 'YES' to finalize your order!"
   - If they reply YES or 1 or 'confirm' or 'تاكيد' in confirming state, set currentStep to 'completed', transition to finalized order and create a full Order payload. Our backend will register it.
3. Formulate a very natural, polite WhatsApp chat reply with emojis. Keep messages warm and readable. Never send raw JSON to the user, only return structured state for our server.

You MUST reply with a JSON object in this exact schema structure:
{
  "botReply": "The actual message text to send back to the customer",
  "nextStep": "welcome" | "language_selection" | "type" | "menu" | "customizing" | "address" | "pickup_time" | "confirming" | "completed",
  "updatedUnsubmittedOrder": <Object representing the updated Partial<Order>>,
  "placedOrderPayload": <If they confirmed the order in this turn, provide the complete Order object. Otherwise return null. MUST generate unique random orderNumber like ${branchConfig.orderPrefix || 'TAB'}-1004>,
  "placedReservationPayload": <If they confirmed a table reservation in this turn, return a JSON object with: { "customerName": string, "whatsAppPhone": string, "guestCount": number, "dateTime": "YYYY-MM-DDTHH:mm:ssZ", "notes": string }. Otherwise return null.>
}
`;

        const response = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: contextPrompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        const dataText = response.text || "{}";
        const cleaned = dataText.trim();
        const payload = JSON.parse(cleaned);

        botReplyText = payload.botReply || "I have received your message.";
        nextStep = payload.nextStep || nextStep;
        if (payload.updatedUnsubmittedOrder) {
          convo.unsubmittedOrder = payload.updatedUnsubmittedOrder;
        }
        if (payload.placedOrderPayload) {
          finalPlacedOrder = payload.placedOrderPayload;
        }
        if (payload.placedReservationPayload) {
          finalPlacedReservation = payload.placedReservationPayload;
        }
      } catch (err) {
        console.error("Gemini flow failed, falling back to rule-based:", err);
      }
    }

    // Fallback Rule-Based Bot Engine
    if (!botReplyText) {
      const timezone = activeRestaurant?.timezone || "Europe/Berlin";
      if (!isBranchOpen(branchConfig, timezone)) {
        botReplyText = lang === "ar"
          ? `شكراً لتواصلك معنا! المطعم مغلق حالياً. ساعات العمل لدينا هي: ${branchConfig.openingHours}.`
          : lang === "en"
          ? `Thank you for contacting us! The restaurant is currently closed. Our business hours are: ${branchConfig.openingHours}.`
          : lang === "tr"
          ? `Bizimle iletişime geçtiğiniz için teşekkür ederiz! Restoran şu anda kapalıdır. Çalışma saatlerimiz: ${branchConfig.openingHours}.`
          : `Vielen Dank für Ihre Nachricht! Das Restaurant ist derzeit geschlossen. Unsere Öffnungszeiten sind: ${branchConfig.openingHours}.`;
        if (branchConfig.closedDays && branchConfig.closedDays.length > 0) {
          botReplyText += " " + getClosedDaysString(lang, branchConfig.closedDays);
        }
      }
    }

    if (!botReplyText) {
      const isAr = lang === "ar";
      const isEn = lang === "en";
      const isTr = lang === "tr";

      const step = convo.currentStep || "welcome";

      if (step === "welcome") {
        botReplyText = getWelcomeReply(lang, branchConfig);
        nextStep = "type";
      } else if (step === "type") {
        if (text.includes("1") || text.includes("towsil") || text.includes("delivery") || text.includes("توصيل")) {
          if (!branchConfig.deliveryEnabled) {
            botReplyText = getDeliveryUnavailableReply(lang, branchConfig);
            nextStep = "type";
          } else {
            convo.unsubmittedOrder = {
              ...convo.unsubmittedOrder,
              orderType: "delivery",
              deliveryFee: branchConfig.deliveryFee,
              total: (convo.unsubmittedOrder?.subtotal || 0) + branchConfig.deliveryFee,
            };
            botReplyText = getAddressPrompt(lang, branchConfig);
            nextStep = "address";
          }
        } else {
          if (!branchConfig.pickupEnabled) {
            botReplyText = getPickupUnavailableReply(lang, branchConfig);
            nextStep = "type";
          } else {
            convo.unsubmittedOrder = {
              ...convo.unsubmittedOrder,
              orderType: "pickup",
              deliveryFee: 0,
              total: convo.unsubmittedOrder?.subtotal || 0,
            };
            botReplyText = getPickupTimePrompt(lang, branchConfig);
            nextStep = "pickup_time";
          }
        }
      } else if (step === "address") {
        const latitude = req.body.latitude;
        const longitude = req.body.longitude;
        
        let targetLat: number | undefined = undefined;
        let targetLon: number | undefined = undefined;
        let isGps = false;
        
        const branchCity = branchConfig.branchCity || "Wuppertal";

        if (latitude !== undefined && longitude !== undefined) {
          targetLat = Number(latitude);
          targetLon = Number(longitude);
          isGps = true;
        } else {
          // Geocode typed address text
          const searchQuery = message.toLowerCase().includes(branchCity.toLowerCase())
            ? message
            : `${message}, ${branchCity}`;
            
          const coords = await geocodeAddress(searchQuery);
          if (coords) {
            targetLat = coords.latitude;
            targetLon = coords.longitude;
          }
        }
        
        if (targetLat !== undefined && targetLon !== undefined && Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
          const branchLat = branchConfig.branchLatitude || 51.2667;
          const branchLon = branchConfig.branchLongitude || 7.1833;
          
          const distance = calculateDistance(targetLat, targetLon, branchLat, branchLon);
          const maxRadius = branchConfig.deliveryRadiusKm || 4;
          
          if (distance > maxRadius) {
            botReplyText = isAr
              ? `عذراً، العنوان المدخل (على بعد ${distance.toFixed(2)} كم) خارج نطاق التوصيل الخاص بنا (${maxRadius} كم).\nيرجى إرسال موقع آخر أو كتابة عنوانك يدوياً داخل ${branchCity}، أو اكتب "استلام" لتغيير الطلب إلى استلام من الفرع.`
              : isEn
              ? `Sorry, the address provided (distance: ${distance.toFixed(2)} km) is outside our delivery radius of ${maxRadius} km.\nPlease send another address, or type "pickup" to collect it yourself.`
              : isTr
              ? `Üzgünüz, girilen adres (mesafe: ${distance.toFixed(2)} km) ${maxRadius} km olan teslimat yarıçapımızın dışındadır.\nLütfen başka bir adres gönderin veya kendiniz almak için "teslim alma" yazın.`
              : `Es tut uns leid, die angegebene Adresse (Entfernung: ${distance.toFixed(2)} km) liegt außerhalb unseres Lieferradius von ${maxRadius} km.\nBitte geben Sie eine andere Adresse ein oder schreiben Sie "abholung", um die Bestellung selbst abzuholen.`;
            nextStep = "address";
          } else {
            const addressString = isGps
              ? `WhatsApp Shared Location (Lat: ${targetLat.toFixed(5)}, Lon: ${targetLon.toFixed(5)}, Distance: ${distance.toFixed(2)} km)`
              : `${message} (Verified Distance: ${distance.toFixed(2)} km)`;
              
            convo.unsubmittedOrder = {
              ...convo.unsubmittedOrder,
              deliveryAddress: addressString
            };
            
            const hasItems = (convo.unsubmittedOrder?.items || []).length > 0;
            if (hasItems) {
              convo.unsubmittedOrder.deliveryFee = branchConfig.deliveryFee;
              convo.unsubmittedOrder.total = (convo.unsubmittedOrder.subtotal || 0) + branchConfig.deliveryFee;
              
              const addressVerified = isAr
                ? `تم التحقق من العنوان بنجاح! موقعك على بعد ${distance.toFixed(2)} كم وهو ضمن نطاق التوصيل. 📍`
                : isEn
                ? `Address verified successfully! You are ${distance.toFixed(2)} km away, which is within our delivery zone. 📍`
                : isTr
                ? `Adres başarıyla doğrulandı! ${distance.toFixed(2)} km uzaklıktasınız, bu mesafe teslimat bölgemiz dahilindedir. 📍`
                : `Adresse erfolgreich verifiziert! Sie sind ${distance.toFixed(2)} km entfernt, was innerhalb unseres Liefergebiets liegt. 📍`;
              
              botReplyText = `${addressVerified}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
              nextStep = "confirming";
            } else {
              const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo), convo._id?.toString() || convo.id);
              botReplyText = isAr
                ? `تم التحقق من العنوان بنجاح! موقعك على بعد ${distance.toFixed(2)} كم وهو ضمن نطاق التوصيل. 📍\n\n${menuPrompt}`
                : isEn
                ? `Address verified successfully! You are ${distance.toFixed(2)} km away, which is within our delivery zone. 📍\n\n${menuPrompt}`
                : isTr
                ? `Adres başarıyla doğrulandı! ${distance.toFixed(2)} km uzaklıktasınız, bu mesafe teslimat bölgemiz dahilindedir. 📍\n\n${menuPrompt}`
                : `Adresse erfolgreich verifiziert! Sie sind ${distance.toFixed(2)} km entfernt, was innerhalb unseres Liefergebiets liegt. 📍\n\n${menuPrompt}`;
              nextStep = "menu";
            }
          }
        } else {
          // Geocoding failed and no GPS coordinate was passed
          convo.unsubmittedOrder = { ...convo.unsubmittedOrder, deliveryAddress: message };
          
          const hasItems = (convo.unsubmittedOrder?.items || []).length > 0;
          if (hasItems) {
            convo.unsubmittedOrder.deliveryFee = branchConfig.deliveryFee;
            convo.unsubmittedOrder.total = (convo.unsubmittedOrder.subtotal || 0) + branchConfig.deliveryFee;
            
            const addressSaved = isAr
              ? `حفظنا العنوان: *${message}*. (ملاحظة: لم نتمكن من تحديد موقعك بدقة على الخارطة، يرجى التأكد من كتابة الشارع والرقم بشكل صحيح). 📍`
              : isEn
              ? `Address saved: *${message}*. (Note: We couldn't verify this address on the map, please make sure the street and number are correct). 📍`
              : isTr
              ? `Adres kaydedildi: *${message}*. (Not: Bu adresi haritada doğrulayamadık, lütfen sokak ve numaranın doğru olduğundan emin olun). 📍`
              : `Lieferadresse gespeichert: *${message}*. (Hinweis: Adresse konnte nicht kartiert werden, bitte prüfen Sie Straße und Hausnummer). 📍`;
              
            botReplyText = `${addressSaved}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
            nextStep = "confirming";
          } else {
            const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo), convo._id?.toString() || convo.id);
            botReplyText = isAr
              ? `حفظنا العنوان: *${message}*. (ملاحظة: لم نتمكن من تحديد موقعك بدقة على الخارطة، يرجى التأكد من كتابة الشارع والرقم بشكل صحيح). 📍\n\n${menuPrompt}`
              : isEn
              ? `Address saved: *${message}*. (Note: We couldn't verify this address on the map, please make sure the street and number are correct). 📍\n\n${menuPrompt}`
              : isTr
              ? `Adres kaydedildi: *${message}*. (Not: Bu adresi haritada doğrulayamadık, lütfen sokak ve numaranın doğru olduğundan emin olun). 📍\n\n${menuPrompt}`
              : `Lieferadresse gespeichert: *${message}*. (Hinweis: Adresse konnte nicht kartiert werden, bitte prüfen Sie Straße und Hausnummer). 📍\n\n${menuPrompt}`;
            nextStep = "menu";
          }
        }
      } else if (step === "pickup_time") {
        convo.unsubmittedOrder = { ...convo.unsubmittedOrder, pickupTime: message };
        
        const hasItems = (convo.unsubmittedOrder?.items || []).length > 0;
        if (hasItems) {
          const pickupConfirmed = isAr
            ? `تم تأكيد وقت الاستلام! ⏰`
            : isEn
            ? `Pickup time confirmed! ⏰`
            : isTr
            ? `Teslim alma saati onaylandı! ⏰`
            : `Abholzeit vermerkt! ⏰`;
            
          botReplyText = `${pickupConfirmed}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
          nextStep = "confirming";
        } else {
          const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo), convo._id?.toString() || convo.id);
          botReplyText = isAr
            ? `تم تأكيد وقت الاستلام! ⏰\n${menuPrompt}`
            : isEn
            ? `Pickup time confirmed! ⏰\n${menuPrompt}`
            : isTr
            ? `Teslim alma saati onaylandı! ⏰\n${menuPrompt}`
            : `Abholzeit vermerkt! ⏰\n${menuPrompt}`;
          nextStep = "menu";
        }
      } else if (step === "menu") {
        const selectedItem = findMenuItemFromMessage(
          message,
          dbMenuItems,
          dbCategories,
          branchConfig,
          orderTypeForMenu(convo)
        );

        if (selectedItem) {
          const orderItem = {
            itemId: selectedItem._id?.toString() || selectedItem.id,
            name: selectedItem.name,
            basePrice: selectedItem.basePrice,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: selectedItem.basePrice,
          };
          const activeUpsell = getActiveUpsellSuggestion(selectedItem);
          const pendingUpsell = activeUpsell ? normalizeUpsellSuggestion(activeUpsell) : null;
          if (pendingUpsell) {
            (orderItem as any).pendingUpsell = pendingUpsell;
          }
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            items: [orderItem],
            subtotal: selectedItem.basePrice,
            total: selectedItem.basePrice + (convo.unsubmittedOrder?.deliveryFee || 0),
          };

          const selectedName = translatedText(selectedItem.name, lang);
          const addedText = isAr
            ? `📝 تمت إضافة *${selectedName}* لطلبك بسعر ${formatMoney(selectedItem.basePrice)}€.`
            : isEn
            ? `📝 Added *${selectedName}* to your order for €${formatMoney(selectedItem.basePrice)}.`
            : isTr
            ? `📝 *${selectedName}* siparişinize ${formatMoney(selectedItem.basePrice)}€ karşılığında eklendi.`
            : `📝 *${selectedName}* wurde für ${formatMoney(selectedItem.basePrice)} € hinzugefügt.`;

          if (pendingUpsell) {
            botReplyText = `${addedText}\n\n${getUpsellPrompt(lang, pendingUpsell)}`;
            nextStep = "customizing";
          } else {
            botReplyText = `${addedText}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
            nextStep = "confirming";
          }
        } else {
          const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo));
          botReplyText = isAr
            ? `نعتذر منك، لم نفهم اختيارك بشكل دقيق. يرجى اختيار رمز من القائمة مثل *01* أو كتابة اسم الوجبة:\n\n${menuPrompt}`
            : isEn
            ? `Sorry, I could not match that to a menu item. Please choose an item code like *01* or type the dish name:\n\n${menuPrompt}`
            : isTr
            ? `Üzgünüz, bunu bir menü öğesiyle eşleştiremedik. Lütfen *01* gibi bir ürün kodu seçin veya yemeğin adını yazın:\n\n${menuPrompt}`
            : `Entschuldigung, wir haben die Auswahl nicht verstanden. Bitte wählen Sie einen Artikelcode wie *01* oder nennen Sie den Namen:\n\n${menuPrompt}`;
        }
      } else if (step === "customizing") {
        let addedCombo = text.includes("ja") || text.includes("yes") || text.includes("نعم") || text.includes("com");
        const items = convo.unsubmittedOrder?.items || [];
        if (addedCombo && items.length > 0) {
          const item = items[0];
          const pendingUpsell = item.pendingUpsell;
          item.selectedUpsell = pendingUpsell || {
            id: "up-fries",
            name: { ar: "ترقية وجبة كومبو دبل مع كولا وبطاطا", de: "Combo-Upgrade Pommes + Cola", en: "Fries + Cola drink combo upgrade" },
            price: 3.0,
          };
          item.pendingUpsell = undefined;
          const upsellPrice = toFiniteNumber(item.selectedUpsell.price, 0);
          item.totalPrice += upsellPrice;
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            items,
            subtotal: (convo.unsubmittedOrder?.subtotal || 0) + upsellPrice,
            total: (convo.unsubmittedOrder?.total || 0) + upsellPrice,
          };
        } else {
          items.forEach((item: any) => {
            item.pendingUpsell = undefined;
          });
          convo.unsubmittedOrder = { ...convo.unsubmittedOrder, items };
        }

        botReplyText = buildConfirmationSummary(convo, lang, branchConfig);
        nextStep = "confirming";
      } else if (step === "confirming") {
        if (text.includes("1") || text.includes("yes") || text.includes("best") || text.includes("ta") || text.includes("نعم") || text.includes("تأكيد")) {
          if (isBelowDeliveryMinimum(convo, branchConfig)) {
            botReplyText = `${getMinimumOrderReply(lang, toFiniteNumber(convo.unsubmittedOrder?.subtotal, 0), branchConfig)}\n\n${getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo))}`;
            nextStep = "menu";
          } else {
            const ordNum = await generateOrderNumber();

            finalPlacedOrder = {
              orderNumber: ordNum,
              restaurantId: convo.restaurantId || (await Restaurant.findOne({ isActive: true }))?._id,
              branchId: convo.branchId || (await Branch.findOne({ isActive: true }))?._id,
              customerName: convo.customerName,
              whatsAppPhone: convo.whatsAppPhone,
              whatsAppJid: convo.whatsAppJid,
              whatsAppPhoneJid: convo.whatsAppPhoneJid,
              whatsAppLid: convo.whatsAppLid,
              orderType: convo.unsubmittedOrder?.orderType || "delivery",
              items: convo.unsubmittedOrder?.items || [],
              subtotal: convo.unsubmittedOrder?.subtotal || 0,
              deliveryFee: convo.unsubmittedOrder?.deliveryFee || 0,
              total: convo.unsubmittedOrder?.total || 0,
              status: "received",
              paymentMethod: convo.unsubmittedOrder?.paymentMethod || "Cash on Delivery",
              deliveryAddress: convo.unsubmittedOrder?.deliveryAddress,
              pickupTime: convo.unsubmittedOrder?.pickupTime,
              notes: convo.unsubmittedOrder?.notes || "Created via WhatsApp Bot",
            };

            botReplyText = isAr
              ? `🎉 رائع! تم إرسال طلبك رقم *${ordNum}* بنجاح للمطبخ وسينتهي تحضيره قريباً.\nسوف نرسل لك تحديثاً فور البدء بالتحضير. شكراً لطلبك من ${branchConfig.restaurantName}! ❤️`
              : isEn
              ? `🎉 Wonderful! Your order *${ordNum}* has been submitted to our kitchen. We will start preparing it shortly.\nYou will receive automatic status alerts here. Thank you! ❤️`
              : isTr
              ? `🎉 Harika! *${ordNum}* numaralı siparişiniz mutfağımıza iletildi. Yakında hazırlamaya başlayacağız.\nDurum güncellemelerini buradan otomatik olarak alacaksınız. Teşekkürler! ❤️`
              : `🎉 Super! Ihre Bestellung *${ordNum}* wurde an das Küchenteam übermittelt und wird zubereitet.\nWir benachrichtigen Sie gleich über den Status. Vielen Dank! ❤️`;
            nextStep = "completed";
          }
        } else {
          botReplyText = isAr
            ? "لم يتم تأكيد طلبك بشكل صحيح. لتأكيده، اكتب *1* أو *تأكيد*."
            : isEn
            ? "Your order was not confirmed correctly. Reply with *1* or *CONFIRM* to submit."
            : isTr
            ? "Siparişiniz doğru şekilde onaylanmadı. Göndermek için *1* veya *ONAYLA* ile yanıt verin."
            : "Bestellung nicht bestätigt. Schreiben Sie *1* oder *JA* zur Bestätigung.";
        }
      } else {
        botReplyText = isAr
          ? `أهلاً بك مجدداً في ${branchConfig.restaurantName}! اطلب أي وقت بكتابة 'أهلاً' أو 'طلب' لمشاهدة القائمة.`
          : isEn
          ? `Welcome back to ${branchConfig.restaurantName}! Order anytime by typing 'hello' or 'order' to see the menu.`
          : isTr
          ? `${branchConfig.restaurantName}'ye tekrar hoş geldiniz! Menüyü görmek için istediğiniz zaman 'merhaba' veya 'sipariş' yazarak sipariş verin.`
          : "Hallo! Schreiben Sie 'Hallo' oder 'Menü', um eine neue Bestellung zu starten.";
        nextStep = "welcome";
      }
    }

    // Save final order
    if (finalPlacedOrder) {
      // 1. Ensure orderNumber is present, if not generate it
      if (!finalPlacedOrder.orderNumber) {
        finalPlacedOrder.orderNumber = await generateOrderNumber();
      }

      // 2. Ensure restaurantId and branchId are present and valid ObjectIds
      if (!finalPlacedOrder.restaurantId) {
        finalPlacedOrder.restaurantId = convo.restaurantId || (await Restaurant.findOne({ isActive: true }))?._id;
      }
      if (!finalPlacedOrder.branchId) {
        finalPlacedOrder.branchId = convo.branchId || (await Branch.findOne({ isActive: true }))?._id;
      }

      // 3. Set customer info
      finalPlacedOrder.customerName = convo.customerName || finalPlacedOrder.customerName || "WhatsApp Customer";
      finalPlacedOrder.whatsAppPhone = convo.whatsAppPhone || finalPlacedOrder.whatsAppPhone || "";
      finalPlacedOrder.whatsAppJid = convo.whatsAppJid || finalPlacedOrder.whatsAppJid || "";
      finalPlacedOrder.whatsAppPhoneJid = convo.whatsAppPhoneJid || finalPlacedOrder.whatsAppPhoneJid || "";
      finalPlacedOrder.whatsAppLid = convo.whatsAppLid || finalPlacedOrder.whatsAppLid || "";

      // 4. Ensure orderType is valid
      let rawOrderType = finalPlacedOrder.orderType || convo.unsubmittedOrder?.orderType || "delivery";
      if (typeof rawOrderType === "string") {
        rawOrderType = rawOrderType.toLowerCase().trim();
      }
      if (!["delivery", "pickup", "dine_in"].includes(rawOrderType)) {
        rawOrderType = "delivery";
      }
      finalPlacedOrder.orderType = rawOrderType;

      // 5. Sanitize items
      if (!Array.isArray(finalPlacedOrder.items)) {
        finalPlacedOrder.items = convo.unsubmittedOrder?.items || [];
      }

      const sanitizedItems: any[] = [];
      for (const item of finalPlacedOrder.items) {
        if (!item) continue;

        // Match against dbMenuItems to get valid translation schema, etc.
        const matchedMenuItem = dbMenuItems.find(dbItem => {
          if (item.itemId && (dbItem._id?.toString() === item.itemId?.toString() || dbItem.id === item.itemId)) {
            return true;
          }
          if (typeof item.name === 'string') {
            const lowerName = item.name.toLowerCase();
            return (
              dbItem.name.en?.toLowerCase() === lowerName ||
              dbItem.name.de?.toLowerCase() === lowerName ||
              dbItem.name.ar?.toLowerCase() === lowerName
            );
          } else if (item.name && typeof item.name === 'object') {
            return (
              dbItem.name.en?.toLowerCase() === item.name.en?.toLowerCase() ||
              dbItem.name.de?.toLowerCase() === item.name.de?.toLowerCase() ||
              dbItem.name.ar?.toLowerCase() === item.name.ar?.toLowerCase()
            );
          }
          return false;
        });

        const itemId = item.itemId || matchedMenuItem?._id?.toString() || matchedMenuItem?.id || new mongoose.Types.ObjectId().toString();
        const basePrice = typeof item.basePrice === "number" ? item.basePrice : (matchedMenuItem?.basePrice || 0);
        const quantity = typeof item.quantity === "number" ? item.quantity : 1;
        const totalPrice = typeof item.totalPrice === "number" ? item.totalPrice : (basePrice * quantity);

        let nameSchema = { ar: "", de: "", en: "" };
        if (matchedMenuItem && matchedMenuItem.name) {
          nameSchema = {
            ar: matchedMenuItem.name.ar || "",
            de: matchedMenuItem.name.de || "",
            en: matchedMenuItem.name.en || "",
          };
        } else if (typeof item.name === "object" && item.name) {
          nameSchema = {
            ar: item.name.ar || item.name.en || item.name.de || "",
            de: item.name.de || item.name.en || item.name.ar || "",
            en: item.name.en || item.name.de || item.name.ar || "",
          };
        } else if (typeof item.name === "string") {
          nameSchema = {
            ar: item.name,
            de: item.name,
            en: item.name,
          };
        } else {
          nameSchema = {
            ar: "Item",
            de: "Artikel",
            en: "Item",
          };
        }

        const selectedModifiers: any[] = [];
        if (Array.isArray(item.selectedModifiers)) {
          for (const rawMod of item.selectedModifiers) {
            if (!rawMod || typeof rawMod !== 'object') continue;

            const groupId = rawMod.groupId || "";
            let groupName = rawMod.groupName;
            let optionId = rawMod.option?.id || rawMod.optionId || "";
            let optionName = rawMod.option?.name || rawMod.optionName;
            let priceAdjustment = typeof rawMod.option?.priceAdjustment === 'number'
              ? rawMod.option.priceAdjustment
              : (typeof rawMod.priceAdjustment === 'number' ? rawMod.priceAdjustment : 0);

            // Try to find matching group/option in matchedMenuItem
            let matchedGroup = matchedMenuItem?.modifierGroups?.find((g: any) => {
              if (groupId && g.id === groupId) return true;
              const gName = typeof groupName === 'string' ? groupName.toLowerCase().trim() : '';
              return g.name?.en?.toLowerCase() === gName ||
                     g.name?.de?.toLowerCase() === gName ||
                     g.name?.ar?.toLowerCase() === gName;
            });

            let matchedOption = matchedGroup?.options?.find((o: any) => {
              if (optionId && o.id === optionId) return true;
              const oName = typeof optionName === 'string' ? optionName.toLowerCase().trim() : '';
              return o.name?.en?.toLowerCase() === oName ||
                     o.name?.de?.toLowerCase() === oName ||
                     o.name?.ar?.toLowerCase() === oName;
            });

            let finalGroupName = { ar: "", de: "", en: "" };
            let finalOptionName = { ar: "", de: "", en: "" };

            if (matchedGroup) {
              finalGroupName = {
                ar: matchedGroup.name?.ar || "",
                de: matchedGroup.name?.de || "",
                en: matchedGroup.name?.en || "",
              };
            } else if (typeof groupName === 'object' && groupName) {
              finalGroupName = {
                ar: groupName.ar || groupName.en || groupName.de || "",
                de: groupName.de || groupName.en || groupName.ar || "",
                en: groupName.en || groupName.de || groupName.ar || "",
              };
            } else if (typeof groupName === 'string') {
              finalGroupName = { ar: groupName, de: groupName, en: groupName };
            } else {
              finalGroupName = { ar: "إضافة", de: "Extra", en: "Extra" };
            }

            if (matchedOption) {
              finalOptionName = {
                ar: matchedOption.name?.ar || "",
                de: matchedOption.name?.de || "",
                en: matchedOption.name?.en || "",
              };
              priceAdjustment = typeof matchedOption.priceAdjustment === 'number' ? matchedOption.priceAdjustment : priceAdjustment;
              optionId = matchedOption.id || optionId;
            } else if (typeof optionName === 'object' && optionName) {
              finalOptionName = {
                ar: optionName.ar || optionName.en || optionName.de || "",
                de: optionName.de || optionName.en || optionName.ar || "",
                en: optionName.en || optionName.de || optionName.ar || "",
              };
            } else if (typeof optionName === 'string') {
              finalOptionName = { ar: optionName, de: optionName, en: optionName };
            } else {
              finalOptionName = { ar: "خيار", de: "Option", en: "Option" };
            }

            selectedModifiers.push({
              groupId: matchedGroup?.id || groupId,
              groupName: finalGroupName,
              option: {
                id: optionId,
                name: finalOptionName,
                priceAdjustment
              }
            });
          }
        }

        let sanitizedUpsell: any = undefined;
        if (item.selectedUpsell) {
          const upsellId = item.selectedUpsell.id || "";
          const upsellPrice = typeof item.selectedUpsell.price === "number" ? item.selectedUpsell.price : 0;
          let upsellName = item.selectedUpsell.name;

          // Try to find in matchedMenuItem's upsellSuggestions
          let matchedUpsell = matchedMenuItem?.upsellSuggestions?.find((u: any) => {
            if (upsellId && u.id === upsellId) return true;
            const uName = typeof upsellName === 'string' ? upsellName.toLowerCase().trim() : '';
            return u.suggestedItemName?.en?.toLowerCase() === uName ||
                   u.suggestedItemName?.de?.toLowerCase() === uName ||
                   u.suggestedItemName?.ar?.toLowerCase() === uName;
          });

          let finalUpsellName = { ar: "", de: "", en: "" };
          if (matchedUpsell) {
            finalUpsellName = {
              ar: matchedUpsell.suggestedItemName?.ar || "",
              de: matchedUpsell.suggestedItemName?.de || "",
              en: matchedUpsell.suggestedItemName?.en || "",
            };
          } else if (typeof upsellName === 'object' && upsellName) {
            finalUpsellName = {
              ar: upsellName.ar || upsellName.en || upsellName.de || "",
              de: upsellName.de || upsellName.en || upsellName.ar || "",
              en: upsellName.en || upsellName.de || upsellName.ar || "",
            };
          } else if (typeof upsellName === 'string') {
            finalUpsellName = { ar: upsellName, de: upsellName, en: upsellName };
          } else {
            finalUpsellName = { ar: "عرض خاص", de: "Sonderangebot", en: "Special Offer" };
          }

          sanitizedUpsell = {
            id: matchedUpsell?.id || upsellId,
            name: finalUpsellName,
            price: typeof matchedUpsell?.price === 'number' ? matchedUpsell.price : upsellPrice,
          };
        }

        sanitizedItems.push({
          itemId,
          name: nameSchema,
          basePrice,
          quantity,
          selectedModifiers,
          selectedUpsell: sanitizedUpsell,
          totalPrice,
        });
      }
      finalPlacedOrder.items = sanitizedItems;

      // 6. Recalculate financial totals
      let computedSubtotal = 0;
      for (const item of finalPlacedOrder.items) {
        computedSubtotal += item.totalPrice;
      }
      finalPlacedOrder.subtotal = typeof finalPlacedOrder.subtotal === "number" && finalPlacedOrder.subtotal > 0
        ? finalPlacedOrder.subtotal
        : computedSubtotal;

      finalPlacedOrder.deliveryFee = typeof finalPlacedOrder.deliveryFee === "number"
        ? finalPlacedOrder.deliveryFee
        : (finalPlacedOrder.orderType === "delivery" ? branchConfig.deliveryFee : 0);

      finalPlacedOrder.total = typeof finalPlacedOrder.total === "number" && finalPlacedOrder.total > 0
        ? finalPlacedOrder.total
        : (finalPlacedOrder.subtotal + finalPlacedOrder.deliveryFee);

      const validStatuses = ["received", "under_review", "accepted", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"];
      if (!finalPlacedOrder.status || !validStatuses.includes(finalPlacedOrder.status)) {
        finalPlacedOrder.status = "received";
      }
      finalPlacedOrder.paymentMethod = finalPlacedOrder.paymentMethod || "Cash on Delivery";
      finalPlacedOrder.paymentStatus = finalPlacedOrder.paymentStatus || "pending";
      finalPlacedOrder.source = "whatsapp";

      const newOrder = new Order(finalPlacedOrder);
      await newOrder.save();
      emitGlobal("order:new", serializeDoc(newOrder));
      triggerAutoPrint(newOrder);
    }

    // Save final reservation
    if (finalPlacedReservation && branchConfig.reservationEnabled) {
      const resvDate = new Date(finalPlacedReservation.dateTime);
      const resv = new Reservation({
        branchId: convo.branchId,
        customerName: finalPlacedReservation.customerName || convo.customerName || "WhatsApp Customer",
        whatsAppPhone: finalPlacedReservation.whatsAppPhone || convo.whatsAppPhone || phone,
        guestCount: Number(finalPlacedReservation.guestCount) || 2,
        dateTime: resvDate,
        durationMinutes: 90,
        status: "pending",
        source: "whatsapp",
        notes: finalPlacedReservation.notes || "",
      });
      await resv.save();
      emitGlobal("reservation:new", serializeDoc(resv));

      // Send direct WhatsApp confirmation to customer if whatsapp service is linked
      try {
        const restaurant = await Restaurant.findById(convo.restaurantId);
        const timezone = restaurant?.timezone || "Europe/Berlin";
        const formattedDate = resvDate.toLocaleString(
          lang === "ar" ? "ar-EG" : lang === "en" ? "en-US" : lang === "tr" ? "tr-TR" : "de-DE",
          { timeZone: timezone }
        );
        let confirmationMsg = "";
        if (lang === "ar") {
          confirmationMsg = `*تم استلام طلب حجز الطاولة*\n\nمرحباً ${resv.customerName.trim()}،\nلقد تلقينا طلب الحجز الخاص بك لـ *${resv.guestCount} أشخاص* في *${formattedDate}*.\n\nالحالة: *قيد الانتظار* (سنقوم بالرد عليك قريباً!)\n\nشكراً لاختيارك،\n${branchConfig.restaurantName}`;
        } else if (lang === "en") {
          confirmationMsg = `*Table Reservation Request Received*\n\nHello ${resv.customerName.trim()},\nwe have received your reservation request for *${resv.guestCount} guests* on *${formattedDate}*.\n\nStatus: *Pending* (We will confirm shortly!)\n\nThank you for choosing us,\n${branchConfig.restaurantName}`;
        } else if (lang === "tr") {
          confirmationMsg = `*Masa Rezervasyonu Talebi Alındı*\n\nMerhaba ${resv.customerName.trim()},\n*${resv.guestCount} kişi* için *${formattedDate}* tarihindeki rezervasyon talebinizi aldık.\n\nDurum: *Beklemede* (Yakında onaylayacağız!)\n\nBizi tercih ettiğiniz için teşekkür ederiz,\n${branchConfig.restaurantName}`;
        } else {
          confirmationMsg = `*Tischreservierung erhalten*\n\nHallo ${resv.customerName.trim()},\nwir haben Ihre Reservierung für *${resv.guestCount} Personen* am *${formattedDate}* erhalten.\n\nStatus: *Ausstehend* (Wir melden uns in Kürze!)\n\nDanke für Ihre Wahl,\n${branchConfig.restaurantName}`;
        }
        await sendWhatsAppMessage(convo.branchId.toString(), resv.whatsAppPhone, confirmationMsg);
      } catch (waErr) {
        console.warn("[Reservations Webhook] Failed to send auto-WhatsApp confirm:", waErr);
      }
    }

    // Push bot reply
    convo.messages.push({
      id: "msg-" + Math.random().toString(36).substr(2, 9),
      sender: "bot",
      text: botReplyText,
      timestamp: new Date().toISOString(),
    });
    convo.currentStep = nextStep;
    convo.updatedAt = new Date();
    await convo.save();

    emitGlobal("conversation:updated", serializeDoc(convo));

    const allOrders = await Order.find({
      $or: [
        { paymentMethod: { $ne: "Stripe" } },
        { paymentMethod: "Stripe", paymentStatus: "paid" }
      ]
    }).sort({ createdAt: -1 }).lean();
    res.json({ conversation: serializeDoc(convo), dbOrders: serializeDocs(allOrders), botReplyText, orderPlaced: !!finalPlacedOrder });
  } catch (err) {
    console.error("[API] POST /api/bot-reply error:", err);
    res.status(500).json({ error: "Bot processing failed" });
  }
});

// ------------------------------------------------------------------
// 6. WhatsApp Session Routes
// ------------------------------------------------------------------
app.get("/api/whatsapp/sessions", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const sessions = await WhatsAppSession.find().populate("branchId").lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

app.post("/api/whatsapp/sessions/:id/connect", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await WhatsAppSession.findById(id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await startWhatsAppSession(session.sessionName, async (qr: string) => {
      await WhatsAppSession.findByIdAndUpdate(id, { qrCode: qr, qrStatus: "pending" });
      emitGlobal("whatsapp:qr", { sessionId: id, qr });
    });

    res.json({ message: "Connection initiated", sessionId: id });
  } catch (err) {
    console.error("[API] Connect error:", err);
    res.status(500).json({ error: "Failed to start session" });
  }
});

app.post("/api/whatsapp/sessions/:id/disconnect", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await WhatsAppSession.findById(id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await stopWhatsAppSession(session.sessionName);
    res.json({ message: "Disconnected", sessionId: id });
  } catch (err) {
    console.error("[API] Disconnect error:", err);
    res.status(500).json({ error: "Failed to stop session" });
  }
});

// ------------------------------------------------------------------
// 7. Serve frontend assets & mount Vite in development
// ------------------------------------------------------------------
const startServer = async () => {
  await connectDB();

  if (process.env.DISABLE_HMR === "true" || process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[MR. Tabboush Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Socket.io] Listening for realtime connections`);
    restoreWhatsAppSessions().catch((err) => {
      console.error("[WhatsApp] Session restore failed:", err);
    });
  });
};

startServer().catch((err) => {
  console.error("Failed to start full stack server:", err);
});
