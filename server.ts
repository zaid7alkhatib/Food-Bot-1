import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
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
import { initSocket, emitGlobal } from "./src/services/socket.js";
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
} from "./src/models/index.js";
import { defaultCurrency, orderStatusMessages } from "./src/mockData.js";

// ------------------------------------------------------------------
// 1. Express + HTTP + Socket.io setup
// ------------------------------------------------------------------
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const app = express();
const httpServer = http.createServer(app);
app.use(express.json());

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

function translatedText(value: any, lang: "ar" | "de" | "en"): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.de || value.en || value.ar || "";
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

type CustomerLanguage = "ar" | "de" | "en";

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
};

const DEFAULT_BRANCH_CONFIG: BranchFulfillmentConfig = {
  branchAddress: "Berliner Str. 179",
  branchCity: "Wuppertal",
  branchName: "Hauptfiliale",
  restaurantName: "MR. Tabboush",
  legalName: "Farman GmbH",
  deliveryEnabled: true,
  pickupEnabled: true,
  deliveryRadiusKm: 4,
  deliveryFee: 1.5,
  minOrderAmount: 10,
  branchLatitude: 51.2667,
  branchLongitude: 7.1833,
  orderPrefix: "TAB",
};

function isCustomerLanguage(value: unknown): value is CustomerLanguage {
  return value === "ar" || value === "de" || value === "en";
}

function detectCustomerLanguage(message: string): CustomerLanguage | null {
  const text = message.toLowerCase().trim();
  if (!text) return null;
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
  return null;
}

function detectExplicitLanguageRequest(message: string): CustomerLanguage | null {
  const text = message.toLowerCase().trim();
  if (/(english|englisch|انجليزي|إنجليزي|بالانجليزي|بالإنجليزي)/i.test(text)) return "en";
  if (/(deutsch|german|alemani|allemand|بالألماني|بالالماني)/i.test(text)) return "de";
  if (/(arabic|arabisch|عربي|العربية|بالعربي)/i.test(text)) return "ar";
  return null;
}

function getLanguageSelectionPrompt(branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  const name = branchConfig.restaurantName;
  return [
    `Willkommen bei ${name}! 🌯`,
    `أهلاً بك في ${name}! 🌯`,
    `Welcome to ${name}! 🌯`,
    "",
    "Bitte wählen Sie Ihre Sprache / الرجاء اختيار اللغة / Please choose your language:",
    "*1* Deutsch",
    "*2* العربية",
    "*3* English",
    "",
    "Shortcut / اختصار / Kurzbefehl: *00* Help / Hilfe / مساعدة",
  ].join("\n");
}

function getShortHelpLine(lang: CustomerLanguage): string {
  if (lang === "ar") return "\n\nاختصارات: *00* مساعدة، *0* رجوع، *8* اللغة، *9* إلغاء، *99* طلب جديد.";
  if (lang === "en") return "\n\nShortcuts: *00* help, *0* back, *8* language, *9* cancel, *99* new order.";
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
      : `*1* für Hauslieferung (+${fee} €, innerhalb ${radius} km, Mindestbestellwert ${min} €)`
    : null;
  const pickupLine = branchConfig.pickupEnabled
    ? lang === "ar"
      ? "*2* للاستلام من المطعم (تيك أواي)"
      : lang === "en"
      ? "*2* for Self Pickup"
      : "*2* für Abholung (Pickup)"
    : null;
  const choices = [deliveryLine, pickupLine].filter(Boolean).join("\n");

  if (!choices) {
    if (lang === "ar") return "نعتذر، التوصيل والاستلام غير متاحين حالياً. يرجى المحاولة لاحقاً.";
    if (lang === "en") return "Sorry, delivery and pickup are currently unavailable. Please try again later.";
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
  return `Willkommen bei ${restaurantName}! 🌯 Feinstes syrisches Shawarma in ${branchCity}.\n\nWie möchten Sie Ihre Bestellung erhalten?\nAntworten Sie mit:\n` + choices + linkPrompt + getShortHelpLine(lang);
}

function getAddressPrompt(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  const radius = formatMoney(branchConfig.deliveryRadiusKm);
  const min = formatMoney(branchConfig.minOrderAmount);
  const branchCity = branchConfig.branchCity;
  if (lang === "ar") return `رائع! خدمة التوصيل متوفرة ضمن ${radius} كم وبحد أدنى ${min}€. يرجى إرسال عنوان التوصيل بالتفصيل في ${branchCity}:` + getShortHelpLine(lang);
  if (lang === "en") return `Great! Home delivery is available within ${radius} km with a minimum order of €${min}. Please type your detailed delivery address in ${branchCity}:` + getShortHelpLine(lang);
  return `Super! Der Lieferservice ist innerhalb von ${radius} km verfügbar. Mindestbestellwert: ${min} €. Bitte senden Sie uns Ihre Lieferadresse in ${branchCity}:` + getShortHelpLine(lang);
}

function getPickupTimePrompt(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig = DEFAULT_BRANCH_CONFIG): string {
  if (lang === "ar") return `ممتاز! تفضل بالاستلام من المطعم بـ ${branchConfig.branchAddress}.\nما هو وقت الاستلام المناسب لك؟ (مثال: 19:30)` + getShortHelpLine(lang);
  if (lang === "en") return `Great choice! Pickup is ready at ${branchConfig.branchAddress}.\nWhat time would you like to pick up your order? (e.g., 20:15)` + getShortHelpLine(lang);
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
    return "Die Speisekarte ist für diese Filiale oder Bestellart aktuell nicht verfügbar. Bitte wenden Sie sich an den Support." + getShortHelpLine(lang);
  }

  const body: string[] = [];
  let currentCategory = "";
  entries.forEach(({ item, category }, index) => {
    const categoryName = translatedText(category?.name, lang) || (
      lang === "ar" ? "أصناف أخرى" : lang === "en" ? "Other items" : "Weitere Gerichte"
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
    : "Hier ist unsere aktuelle Speisekarte:";
  const instruction = lang === "ar"
    ? "اكتب رمز الصنف مثل *01* أو اسم الوجبة للطلب:"
    : lang === "en"
    ? "Reply with the item code, e.g. *01*, or type the item name:"
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
    } else {
      linkPrompt = `🔗 Oder stöbern Sie in unserer Speisekarte und wählen Sie die Artikel hier visuell aus:\n${url}\n`;
    }
  }

  return [intro, "", ...body, "", linkPrompt, instruction].join("\n").replace(/\n\n+/g, "\n\n") + getShortHelpLine(lang);
}

function getCancelReply(lang: CustomerLanguage): string {
  if (lang === "ar") return "تم إلغاء مسودة الطلب الحالية. إذا أردت البدء من جديد، اكتب أهلاً أو طلب جديد. ✅";
  if (lang === "en") return "Your current draft order has been cancelled. Type hello or new order whenever you want to start again. ✅";
  return "Ihre aktuelle Bestellskizze wurde abgebrochen. Schreiben Sie Hallo oder neue Bestellung, wenn Sie neu starten möchten. ✅";
}

function getBackUnavailableReply(lang: CustomerLanguage): string {
  if (lang === "ar") return "لا توجد خطوة سابقة واضحة حالياً. يمكنني بدء طلب جديد إذا كتبت طلب جديد.";
  if (lang === "en") return "There is no clear previous step right now. Type new order if you want to start over.";
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

  if (/^(help|hilfe|مساعدة|ساعدني|الاوامر|الأوامر)$/i.test(text)) return "help";
  if (/(change|switch).*(language)|sprache.*(ändern|wechseln)|تغيير.*(اللغة|اللغه)|بدل.*(اللغة|اللغه)/i.test(text)) return "change_language";
  if (/^(restart|start over|new order|reset order|neu starten|von vorne|neue bestellung|ابدأ من جديد|ابدا من جديد|طلب جديد|إعادة الطلب|اعادة الطلب)$/i.test(text)) return "restart";
  if (/^(cancel|cancel order|abort|abbrechen|stornieren|إلغاء|الغاء|ألغي|الغي)$/i.test(text)) return "cancel";
  if (/^(back|go back|previous|zurück|zurueck|رجوع|ارجع|للخلف)$/i.test(text)) return "back";
  if (/(change|edit).*(address)|address.*(change|edit)|adresse.*(ändern|wechseln)|lieferadresse.*(ändern|wechseln)|تغيير.*(العنوان|عنوان)|غير.*(العنوان|عنوان)/i.test(text)) return "change_address";
  if (/(change|edit).*(pickup time|time)|pickup time.*(change|edit)|abholzeit.*(ändern|wechseln)|تغيير.*(الوقت|وقت الاستلام)|غير.*(الوقت|وقت الاستلام)/i.test(text)) return "change_pickup_time";
  if (/(change|edit).*(delivery|pickup|type)|lieferung.*(ändern|wechseln)|abholung.*(ändern|wechseln)|تغيير.*(التوصيل|الاستلام|طريقة الاستلام)|غير.*(التوصيل|الاستلام)/i.test(text)) return "change_type";
  if (/(change|edit).*(order|item|meal|food)|bestellung.*(ändern|wechseln)|gericht.*(ändern|wechseln)|تغيير.*(الطلب|الوجبة|الصنف)|غير.*(الطلب|الوجبة|الصنف)/i.test(text)) return "change_order";

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
  };
}

async function generateOrderNumber(): Promise<string> {
  const count = await Order.countDocuments();
  const restaurant = await Restaurant.findOne({ isActive: true }).lean();
  const prefix = restaurant?.orderPrefix || "TAB";
  return `${prefix}-${1004 + count}`;
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
  return `Der Mindestbestellwert für Lieferung beträgt ${formatMoney(branchConfig.minOrderAmount)} € vor Liefergebühr. Ihr aktueller Warenwert ist ${formatMoney(subtotal)} €, es fehlen noch ${formatMoney(missing)} €. Bitte wählen Sie einen größeren Artikel oder ändern Sie die Bestellung.`;
}

function getDeliveryUnavailableReply(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig): string {
  if (branchConfig.pickupEnabled) {
    if (lang === "ar") return "التوصيل غير متاح حالياً. يمكنك اختيار الاستلام من المطعم بكتابة *2*.";
    if (lang === "en") return "Delivery is currently unavailable. Please choose pickup by replying with *2*.";
    return "Lieferung ist aktuell nicht verfügbar. Bitte wählen Sie Abholung mit *2*.";
  }
  if (lang === "ar") return "التوصيل غير متاح حالياً.";
  if (lang === "en") return "Delivery is currently unavailable.";
  return "Lieferung ist aktuell nicht verfügbar.";
}

function getPickupUnavailableReply(lang: CustomerLanguage, branchConfig: BranchFulfillmentConfig): string {
  if (branchConfig.deliveryEnabled) {
    if (lang === "ar") return "الاستلام من المطعم غير متاح حالياً. يمكنك اختيار التوصيل بكتابة *1*.";
    if (lang === "en") return "Pickup is currently unavailable. Please choose delivery by replying with *1*.";
    return "Abholung ist aktuell nicht verfügbar. Bitte wählen Sie Lieferung mit *1*.";
  }
  if (lang === "ar") return "الاستلام من المطعم غير متاح حالياً.";
  if (lang === "en") return "Pickup is currently unavailable.";
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

    const [branches, categories, menuItems, orders, campaigns, feedbacks, conversations, restaurant] =
      await Promise.all([
        Branch.find({ isActive: true }).lean(),
        Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        MenuItem.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        Order.find().sort({ createdAt: -1 }).lean(),
        Campaign.find().sort({ createdAt: -1 }).lean(),
        Feedback.find().sort({ createdAt: -1 }).lean(),
        Conversation.find().sort({ updatedAt: -1 }).lean(),
        Restaurant.findOne({ isActive: true }).lean(),
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
      aboutText: restaurant.aboutText,
      socialInstagram: restaurant.socialInstagram,
      socialFacebook: restaurant.socialFacebook,
      socialTikTok: restaurant.socialTikTok,
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
    const orderNumber = req.body.orderNumber || await generateOrderNumber();
    const newOrder = new Order({
      orderNumber,
      ...req.body,
    });
    await newOrder.save();

    emitGlobal("order:new", serializeDoc(newOrder));
    res.status(201).json(serializeDoc(newOrder));
  } catch (err) {
    console.error("[API] POST /api/orders error:", err);
    res.status(500).json({ error: "Failed to create order" });
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
    const lang: "ar" | "de" | "en" = requestedLang === "ar" || requestedLang === "en" ? requestedLang : "de";

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

    if (!tableNumber) {
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

    const newOrder = new Order({
      orderNumber,
      restaurantId: branch.restaurantId,
      branchId: branch._id,
      customerName: customerName ? customerName.trim() : `Gast Tisch ${tableNumber}`,
      whatsAppPhone: whatsAppPhone ? whatsAppPhone.trim() : "",
      orderType: "dine_in",
      items: validatedItems,
      subtotal,
      deliveryFee: 0,
      total: subtotal,
      paymentMethod: "Pay at Table",
      paymentStatus: "pending",
      status: "received",
      tableNumber: String(tableNumber),
      notes: notes || "Created via Table Smart Menu",
      source: "table",
    });

    await newOrder.save();
    emitGlobal("order:new", serializeDoc(newOrder));

    res.status(201).json(serializeDoc(newOrder));
  } catch (err) {
    console.error("[API] POST /api/public/orders error:", err);
    res.status(500).json({ error: "Failed to submit table order" });
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

// PUT /api/orders/:id/status
app.put("/api/orders/:id/status", authMiddleware as any, requireRole(...ORDER_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

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

    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    const conversations = await Conversation.find().sort({ updatedAt: -1 }).lean();

    emitGlobal("order:updated", { orderId: id, status });
    if (convo) emitGlobal("conversation:updated", serializeDoc(convo));

    res.json({
      order: { ...order, id: order._id?.toString() || order.id },
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

// POST /api/campaigns/:id/send
app.post("/api/campaigns/:id/send", authMiddleware as any, requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { status: "sending" },
      { new: true }
    );

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // TODO: Real Baileys broadcast with rate limiting
    const targets = await Conversation.find().lean();
    campaign.totalTarget = targets.length;

    setTimeout(async () => {
      for (const convo of targets) {
        const lang = campaign.language === "all" ? "de" : campaign.language;
        const bodyText = (campaign.message as any)[lang] || campaign.message.de;

        await Conversation.findByIdAndUpdate(convo._id, {
          $push: {
            messages: {
              id: "camp-msg-" + Math.random().toString(36).substr(2, 9),
              sender: "bot",
              text: `📢 *${campaign.title}*\n\n${bodyText}`,
              timestamp: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        });
      }

      await Campaign.findByIdAndUpdate(id, {
        status: "sent",
        sentCount: targets.length,
        failedCount: 0,
      });

      emitGlobal("campaign:sent", { campaignId: id });
    }, 3000);

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

    const aiClient = getGeminiClient();
    let botReplyText = "";
    let nextStep = convo.currentStep || "welcome";
    let finalPlacedOrder: any = null;
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
            : `Vielen Dank für Ihre tolle 5-Sterne-Bewertung! ⭐⭐⭐⭐⭐\nWenn Sie eine Minute Zeit haben, unterstützen Sie uns bitte mit einer Bewertung auf Google: ${googleMapsReviewLink} ❤️`;
        } else {
          botReplyText = lang === "ar"
            ? `شكراً جزيلاً لمشاركتنا تقييمك! سنعمل دائماً على تقديم الأفضل لك. 🌹`
            : lang === "en"
            ? `Thank you for sharing your feedback! We will continue working hard to serve you. 🌹`
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
          : "Sie können uns jederzeit später bewerten! 🌟 Starten wir Ihre neue Bestellung:\n\n";
        botReplyText = skipNote + getWelcomeReply(lang, branchConfig);
      } else {
        const restaurant = await Restaurant.findOne({ isActive: true }).lean();
        const googleMapsReviewLink = restaurant?.googleMapsReviewLink || "";
        botReplyText = lang === "ar"
          ? `يرجى الرد برقم من 1 إلى 5 لتقييم تجربتك معنا 🌟\nأو اكتب *طلب* أو *99* لبدء طلب جديد.${googleMapsReviewLink ? "\nأو تفضل بزيارة رابط تقييم Google: " + googleMapsReviewLink : ""}`
          : lang === "en"
          ? `Please reply with a number from 1 to 5 to rate your experience 🌟\nOr type *order* or *99* to start a new order.${googleMapsReviewLink ? "\nOr visit our Google review page: " + googleMapsReviewLink : ""}`
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
2. Move the customer through the ordering flowchart:
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
   - If they reply YES or 1 or "تاكيد" in confirming state, set currentStep to "completed", transition to finalized order and create a full Order payload. Our backend will register it.
3. Formulate a very natural, polite WhatsApp chat reply with emojis. Keep messages warm and readable. Never send raw JSON to the user, only return structured state for our server.

You MUST reply with a JSON object in this exact schema structure:
{
  "botReply": "The actual message text to send back to the customer",
  "nextStep": "welcome" | "language_selection" | "type" | "menu" | "customizing" | "address" | "pickup_time" | "confirming" | "completed",
  "updatedUnsubmittedOrder": <Object representing the updated Partial<Order>>,
  "placedOrderPayload": <If they confirmed the order in this turn, provide the complete Order object. Otherwise return null. MUST generate unique random orderNumber like ${branchConfig.orderPrefix || 'TAB'}-1004>
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
      } catch (err) {
        console.error("Gemini flow failed, falling back to rule-based:", err);
      }
    }

    // Fallback Rule-Based Bot Engine
    if (!botReplyText) {
      const isAr = lang === "ar";
      const isEn = lang === "en";

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
        
        if (latitude !== undefined && longitude !== undefined) {
          targetLat = Number(latitude);
          targetLon = Number(longitude);
          isGps = true;
        } else {
          // Geocode typed address text
          const branchCity = branchConfig.branchCity || "Wuppertal";
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
              ? `عذراً، العنوان المدخل (على بعد ${distance.toFixed(2)} كم) خارج نطاق التوصيل الخاص بنا (${maxRadius} كم).\nيرجى إرسال موقع آخر أو كتابة عنوانك يدوياً داخل فوبيرتال، أو اكتب "استلام" لتغيير الطلب إلى استلام من الفرع.`
              : isEn
              ? `Sorry, the address provided (distance: ${distance.toFixed(2)} km) is outside our delivery radius of ${maxRadius} km.\nPlease send another address, or type "pickup" to collect it yourself.`
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
                : `Adresse erfolgreich verifiziert! Sie sind ${distance.toFixed(2)} km entfernt, was innerhalb unseres Liefergebiets liegt. 📍`;
              
              botReplyText = `${addressVerified}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
              nextStep = "confirming";
            } else {
              const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo), convo._id?.toString() || convo.id);
              botReplyText = isAr
                ? `تم التحقق من العنوان بنجاح! موقعك على بعد ${distance.toFixed(2)} كم وهو ضمن نطاق التوصيل. 📍\n\n${menuPrompt}`
                : isEn
                ? `Address verified successfully! You are ${distance.toFixed(2)} km away, which is within our delivery zone. 📍\n\n${menuPrompt}`
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
              : `Lieferadresse gespeichert: *${message}*. (Hinweis: Adresse konnte nicht kartiert werden, bitte prüfen Sie Straße und Hausnummer). 📍`;
              
            botReplyText = `${addressSaved}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
            nextStep = "confirming";
          } else {
            const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo), convo._id?.toString() || convo.id);
            botReplyText = isAr
              ? `حفظنا العنوان: *${message}*. (ملاحظة: لم نتمكن من تحديد موقعك بدقة على الخارطة، يرجى التأكد من كتابة الشارع والرقم بشكل صحيح). 📍\n\n${menuPrompt}`
              : isEn
              ? `Address saved: *${message}*. (Note: We couldn't verify this address on the map, please make sure the street and number are correct). 📍\n\n${menuPrompt}`
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
            : `Abholzeit vermerkt! ⏰`;
            
          botReplyText = `${pickupConfirmed}\n\n${buildConfirmationSummary(convo, lang, branchConfig)}`;
          nextStep = "confirming";
        } else {
          const menuPrompt = getMenuPrompt(lang, dbMenuItems, dbCategories, branchConfig, orderTypeForMenu(convo), convo._id?.toString() || convo.id);
          botReplyText = isAr
            ? `تم تأكيد وقت الاستلام! ⏰\n${menuPrompt}`
            : isEn
            ? `Pickup time confirmed! ⏰\n${menuPrompt}`
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
              : `🎉 Super! Ihre Bestellung *${ordNum}* wurde an das Küchenteam übermittelt und wird zubereitet.\nWir benachrichtigen Sie gleich über den Status. Vielen Dank! ❤️`;
            nextStep = "completed";
          }
        } else {
          botReplyText = isAr
            ? "لم يتم تأكيد طلبك بشكل صحيح. لتأكيده، اكتب *1* أو *تأكيد*."
            : "Bestellung nicht bestätigt. Schreiben Sie *1* oder *JA* zur Bestätigung.";
        }
      } else {
        botReplyText = isAr
          ? `أهلاً بك مجدداً في ${branchConfig.restaurantName}! اطلب أي وقت بكتابة 'أهلاً' أو 'طلب' لمشاهدة القائمة.`
          : "Hallo! Schreiben Sie 'Hallo' oder 'Menü', um eine neue Bestellung zu starten.";
        nextStep = "welcome";
      }
    }

    // Save final order
    if (finalPlacedOrder) {
      finalPlacedOrder.customerName = convo.customerName;
      finalPlacedOrder.whatsAppPhone = convo.whatsAppPhone;
      finalPlacedOrder.whatsAppJid = convo.whatsAppJid;
      finalPlacedOrder.whatsAppPhoneJid = convo.whatsAppPhoneJid;
      finalPlacedOrder.whatsAppLid = convo.whatsAppLid;

      const newOrder = new Order(finalPlacedOrder);
      await newOrder.save();
      emitGlobal("order:new", serializeDoc(newOrder));
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

    const allOrders = await Order.find().sort({ createdAt: -1 }).lean();
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
