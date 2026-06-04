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

type CustomerLanguage = "ar" | "de" | "en";

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

function getLanguageSelectionPrompt(): string {
  return [
    "Willkommen bei MR. Tabboush! 🌯",
    "أهلاً بك في مستر طابوش! 🌯",
    "Welcome to MR. Tabboush! 🌯",
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

function getWelcomeReply(lang: CustomerLanguage): string {
  if (lang === "ar") {
    return "أهلاً بك في مستر طابوش! 🌯 أشهى المأكولات الشامية في فوبيرتال.\n\nكيف ترغب في استلام طلبك؟\nالرجاء كتابة:\n*1* للتوصيل المنزلي (دليفري)\n*2* للاستلام من المطعم (تيك أواي)" + getShortHelpLine(lang);
  }
  if (lang === "en") {
    return "Welcome to MR. Tabboush! 🌯 Finest Damascus Shawarma in Wuppertal.\n\nHow would you like to receive your food?\nReply with:\n*1* for Home Delivery\n*2* for Self Pickup" + getShortHelpLine(lang);
  }
  return "Willkommen bei MR. Tabboush! 🌯 Feinstes syrisches Shawarma in Wuppertal.\n\nWie möchten Sie Ihre Bestellung erhalten?\nAntworten Sie mit:\n*1* für Hauslieferung (Delivery)\n*2* für Abholung (Pickup)" + getShortHelpLine(lang);
}

function getLanguageSwitchReply(lang: CustomerLanguage): string {
  if (lang === "ar") return "تم تغيير اللغة إلى العربية. تابع طلبك من فضلك، وسأرد عليك بالعربية. ✅";
  if (lang === "en") return "Language switched to English. Please continue your order and I will reply in English. ✅";
  return "Sprache auf Deutsch geändert. Bitte fahren Sie mit Ihrer Bestellung fort, ich antworte jetzt auf Deutsch. ✅";
}

function getAddressPrompt(lang: CustomerLanguage): string {
  if (lang === "ar") return "رائع! خدمة التوصيل متوفرة داخل 4 كم. يرجى إرسال عنوان التوصيل بالتفصيل في فوبيرتال:" + getShortHelpLine(lang);
  if (lang === "en") return "Great! Home delivery is available within 4 km of our branch. Please type your detailed delivery address in Wuppertal:" + getShortHelpLine(lang);
  return "Super! Der Lieferservice ist innerhalb von 4 km verfügbar. Bitte senden Sie uns Ihre Lieferadresse in Wuppertal:" + getShortHelpLine(lang);
}

function getPickupTimePrompt(lang: CustomerLanguage): string {
  if (lang === "ar") return "ممتاز! تفضل بالاستلام من المطعم بـ Berliner Str. 179.\nما هو وقت الاستلام المناسب لك؟ (مثال: 19:30)" + getShortHelpLine(lang);
  if (lang === "en") return "Great choice! Pickup is ready at Berliner Str. 179.\nWhat time would you like to pick up your order? (e.g., 20:15)" + getShortHelpLine(lang);
  return "Alles klar! Sie können Ihre Bestellung in der Berliner Str. 179 abholen.\nUm wie viel Uhr möchten Sie Ihr Essen abholen? (z.B., 19:45)" + getShortHelpLine(lang);
}

function getMenuPrompt(lang: CustomerLanguage): string {
  if (lang === "ar") {
    return "إليك قائمة الطعام المتوفرة لدينا:\n\n1. وجبة شاورما عربي دجاج - 9.50€\n2. شاورما دجاج سوبر - 6.50€\n3. بروستد دجاج 4 قطع - 11.00€\n4. دجاجة مشوية عالفحم - 14.50€\n5. لبن عيران طازج - 1.80€\n\nاكتب اسم الوجبة أو الرقم للطلب:" + getShortHelpLine(lang);
  }
  if (lang === "en") {
    return "Here is our current hot menu:\n\n1. Arabic Chicken Shawarma Meal - €9.50\n2. Chicken Shawarma Super (Wrap) - €6.50\n3. Crispy Broasted Chicken (4 Pcs) - €11.00\n4. Whole Charcoal Grilled Chicken - €14.50\n5. Cold Yogurt Ayran - €1.80\n\nPlease type the item name or number to add to your cart:" + getShortHelpLine(lang);
  }
  return "Hier ist unsere leckere Speisekarte:\n\n1. Arabisches Hähnchen-Shawarma Teller - 9,50 €\n2. Hähnchen Shawarma Super (Wrap) - 6,50 €\n3. Knusper-Broasted Hähnchen (4 Stck) - 11,00 €\n4. Ganzes Grillhähnchen - 14,50 €\n5. Yogurt Ayran erfrischend - 1,80 €\n\nBitte antworten Sie mit der Nummer oder dem Namen, um zu wählen:" + getShortHelpLine(lang);
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

function buildEmptyUnsubmittedOrder(convo: any) {
  return {
    branchId: convo.branchId?._id?.toString?.() || convo.branchId?.toString?.() || "",
    customerName: convo.customerName,
    whatsAppPhone: convo.whatsAppPhone,
    items: [],
    subtotal: 0,
    deliveryFee: 1.5,
    total: 1.5,
    status: "received",
    paymentMethod: "Cash on Delivery",
  };
}

function resetOrderItems(convo: any) {
  const deliveryFee = convo.unsubmittedOrder?.orderType === "delivery" ? 1.5 : 0;
  convo.unsubmittedOrder = {
    ...convo.unsubmittedOrder,
    items: [],
    subtotal: 0,
    deliveryFee,
    total: deliveryFee,
  };
}

function applyRestart(convo: any, lang: CustomerLanguage) {
  convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
  return {
    botReplyText: getWelcomeReply(lang),
    nextStep: "type",
  };
}

function applyBack(convo: any, lang: CustomerLanguage, currentStep: string) {
  if (currentStep === "address" || currentStep === "pickup_time") {
    convo.unsubmittedOrder = {
      ...convo.unsubmittedOrder,
      orderType: undefined,
      deliveryFee: 1.5,
      total: convo.unsubmittedOrder?.subtotal || 1.5,
      deliveryAddress: undefined,
      pickupTime: undefined,
    };
    return { botReplyText: getWelcomeReply(lang), nextStep: "type" };
  }

  if (currentStep === "menu") {
    if (convo.unsubmittedOrder?.orderType === "pickup") {
      convo.unsubmittedOrder = { ...convo.unsubmittedOrder, pickupTime: undefined };
      return { botReplyText: getPickupTimePrompt(lang), nextStep: "pickup_time" };
    }
    convo.unsubmittedOrder = { ...convo.unsubmittedOrder, deliveryAddress: undefined };
    return { botReplyText: getAddressPrompt(lang), nextStep: "address" };
  }

  if (currentStep === "customizing" || currentStep === "confirming") {
    resetOrderItems(convo);
    return { botReplyText: getMenuPrompt(lang), nextStep: "menu" };
  }

  if (currentStep === "completed") {
    return applyRestart(convo, lang);
  }

  if (currentStep === "type" || currentStep === "welcome") {
    return { botReplyText: getWelcomeReply(lang), nextStep: "type" };
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

    const [branches, categories, menuItems, orders, campaigns, feedbacks, conversations] =
      await Promise.all([
        Branch.find({ isActive: true }).lean(),
        Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        MenuItem.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        Order.find().sort({ createdAt: -1 }).lean(),
        Campaign.find().sort({ createdAt: -1 }).lean(),
        Feedback.find().sort({ createdAt: -1 }).lean(),
        Conversation.find().sort({ updatedAt: -1 }).lean(),
      ]);

    res.json({
      branch: branches[0] || null,
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

// POST /api/orders
app.post("/api/orders", authMiddleware as any, requireRole(...ORDER_ROLES) as any, async (req, res) => {
  try {
    const count = await Order.countDocuments();
    const newOrder = new Order({
      orderNumber: req.body.orderNumber || `TAB-${1004 + count}`,
      ...req.body,
    });
    await newOrder.save();

    emitGlobal("order:new", newOrder);
    res.status(201).json(newOrder);
  } catch (err) {
    console.error("[API] POST /api/orders error:", err);
    res.status(500).json({ error: "Failed to create order" });
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
    const convo = await Conversation.findOne({ whatsAppPhone: order.whatsAppPhone });
    if (convo) {
      const template = (orderStatusMessages as any)[status];
      if (template) {
        const lastCustMsg = convo.messages.filter((m: any) => m.sender === "customer").pop();
        const text = lastCustMsg ? lastCustMsg.text.toLowerCase() : "";
        const lang: CustomerLanguage = isCustomerLanguage(convo.customerLanguage)
          ? convo.customerLanguage
          : detectCustomerLanguage(text) || "de";

        let msgText = template[lang] || template.de;
        msgText = msgText
          .replace("{orderNumber}", order.orderNumber)
          .replace("{total}", `${(order.total || 0).toFixed(2)}${defaultCurrency.symbol}`)
          .replace("{paymentMethod}", order.paymentMethod)
          .replace("{prepTime}", String(order.items?.[0]?.basePrice ? 12 : 15))
          .replace("{address}", order.deliveryAddress || "");

        convo.messages.push({
          id: "msg-" + Math.random().toString(36).substr(2, 9),
          sender: "bot",
          text: msgText,
          timestamp: new Date().toISOString(),
        });
        convo.updatedAt = new Date();
        await convo.save();
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
    const dbMenuItems = await MenuItem.find({ isActive: true }).lean();
    const dbOrders = await Order.find().sort({ createdAt: -1 }).lean();

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
          deliveryFee: 1.5,
          total: 1.5,
          status: "received",
          paymentMethod: "Cash on Delivery",
        },
      });
    } else {
      await updateConversationIdentity(convo, identity);
    }

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
      res.json({ conversation: serializeDoc(convo), dbOrders, botReplyText: null });
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

    if (nextStep === "language_selection") {
      const selectedLanguage = parseLanguageSelection(message);
      const selectionCommand = detectFlowCommand(message);
      if (selectedLanguage) {
        lang = selectedLanguage;
        convo.customerLanguage = selectedLanguage;
        botReplyText = getWelcomeReply(selectedLanguage);
        nextStep = "type";
      } else if (selectionCommand === "cancel") {
        convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
        botReplyText = getCancelReply(lang);
        nextStep = "welcome";
      } else if (selectionCommand === "help") {
        botReplyText = `${getHelpReply(lang)}\n\n${getLanguageSelectionPrompt()}`;
        nextStep = "language_selection";
      } else if (selectionCommand === "restart" || selectionCommand === "back") {
        botReplyText = getLanguageSelectionPrompt();
        nextStep = "language_selection";
      } else {
        botReplyText = getLanguageSelectionPrompt();
        nextStep = "language_selection";
      }
    } else if (!storedLanguage && nextStep === "welcome") {
      if (detectedLanguage) {
        lang = detectedLanguage;
        convo.customerLanguage = detectedLanguage;
      } else {
        botReplyText = getLanguageSelectionPrompt();
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
      const result = applyRestart(convo, lang);
      botReplyText = result.botReplyText;
      nextStep = result.nextStep;
    } else if (flowCommand === "cancel") {
      convo.unsubmittedOrder = buildEmptyUnsubmittedOrder(convo);
      botReplyText = getCancelReply(lang);
      nextStep = "welcome";
    } else if (flowCommand === "back") {
      const result = applyBack(convo, lang, nextStep);
      botReplyText = result.botReplyText;
      nextStep = result.nextStep;
    } else if (flowCommand === "change_language") {
      botReplyText = getLanguageSelectionPrompt();
      nextStep = "language_selection";
    } else if (flowCommand === "change_address") {
      convo.unsubmittedOrder = {
        ...convo.unsubmittedOrder,
        orderType: "delivery",
        deliveryFee: 1.5,
        deliveryAddress: undefined,
        total: (convo.unsubmittedOrder?.subtotal || 0) + 1.5,
      };
      botReplyText = getAddressPrompt(lang);
      nextStep = "address";
    } else if (flowCommand === "change_pickup_time") {
      convo.unsubmittedOrder = {
        ...convo.unsubmittedOrder,
        orderType: "pickup",
        deliveryFee: 0,
        pickupTime: undefined,
        total: convo.unsubmittedOrder?.subtotal || 0,
      };
      botReplyText = getPickupTimePrompt(lang);
      nextStep = "pickup_time";
    } else if (flowCommand === "change_type") {
      convo.unsubmittedOrder = {
        ...convo.unsubmittedOrder,
        orderType: undefined,
        deliveryAddress: undefined,
        pickupTime: undefined,
      };
      botReplyText = getWelcomeReply(lang);
      nextStep = "type";
    } else if (flowCommand === "change_order") {
      resetOrderItems(convo);
      botReplyText = getMenuPrompt(lang);
      nextStep = "menu";
    }

    if (aiClient && !botReplyText) {
      try {
        const parsedMenu = dbMenuItems.map((item: any) => ({
          id: item._id?.toString() || item.id,
          name: item.name,
          basePrice: item.basePrice,
          description: item.description,
          modifiers: item.modifierGroups,
          upsells: item.upsellSuggestions,
        }));

        const contextPrompt = `
You are the AI WhatsApp Ordering Agent of "MR. Tabboush" Syrian restaurant in Berliner Str. 179, Wuppertal, Germany.
The current step of the customer order is: "${nextStep}"
Current state of their incomplete order schema: ${JSON.stringify(convo.unsubmittedOrder)}

Customer Phone: ${phone}
Customer Name: ${convo.customerName}
Stored Customer Language: ${lang}
Delivery Area: Only within 4 km of Berliner Str. 179. Delivery fee is 1.50€. Minimum order is 10.00€. Payment is Cash only.

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
   - "welcome" state: Say hello, state that we do Delivery (1.50€ fee within 4km) or Pickup. Ask them to choose Type (Delivery or Pickup).
   - "type" state: Read choice. If they say pickup, set currentStep to "pickup_time" and ask what time they will pick it up (e.g. "19:30"). If delivery, set currentStep to "address" and ask for their delivery address in Wuppertal.
   - "address"/"pickup_time" state: Save address or pickup time. Transition to "menu" and list our delicious categories (Shawarma, Broasted, Grilled Chicken, Drinks) and recommend things, ask them what they'd like to eat.
   - "menu" state: If they specify what dish they want, parse it, add it to the unsubmittedOrder items list. If the item has Modifiers, list those options and ask them to choose. Or present their upsell suggestion as an irresistible offer. If they want nothing else, advance to "confirming".
   - "customizing" state: Apply modifiers based on their choices. Ask if they want to add anything else from drinks or desserts, or confirm.
   - "confirming" state: Display a gorgeous, formatted receipt / order summary in their language:
     * Order Type: Delivery (+1.50€) or Pickup
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
  "placedOrderPayload": <If they confirmed the order in this turn, provide the complete Order object. Otherwise return null. MUST generate unique random orderNumber like TAB-1004>
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
        botReplyText = getWelcomeReply(lang);
        nextStep = "type";
      } else if (step === "type") {
        if (text.includes("1") || text.includes("towsil") || text.includes("delivery") || text.includes("توصيل")) {
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            orderType: "delivery",
            deliveryFee: 1.5,
          };
          botReplyText = getAddressPrompt(lang);
          nextStep = "address";
        } else {
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            orderType: "pickup",
            deliveryFee: 0,
          };
          botReplyText = getPickupTimePrompt(lang);
          nextStep = "pickup_time";
        }
      } else if (step === "address") {
        convo.unsubmittedOrder = { ...convo.unsubmittedOrder, deliveryAddress: message };
        botReplyText = isAr
          ? `حفظنا العنوان بنجاح! 📍\n${getMenuPrompt(lang)}`
          : isEn
          ? `Delivery Address saved! 📍\n${getMenuPrompt(lang)}`
          : `Lieferadresse gespeichert! 📍\n${getMenuPrompt(lang)}`;
        nextStep = "menu";
      } else if (step === "pickup_time") {
        convo.unsubmittedOrder = { ...convo.unsubmittedOrder, pickupTime: message };
        botReplyText = isAr
          ? `تم تأكيد وقت الاستلام! ⏰\n${getMenuPrompt(lang)}`
          : isEn
          ? `Pickup time confirmed! ⏰\n${getMenuPrompt(lang)}`
          : `Abholzeit vermerkt! ⏰\n${getMenuPrompt(lang)}`;
        nextStep = "menu";
      } else if (step === "menu") {
        let selectedItem: any;
        if (text.includes("1") || text.includes("teller") || text.includes("عربي") || text.includes("arabic")) {
          selectedItem = dbMenuItems.find((i: any) => i.skucode === "SHW-ARAB-02");
        } else if (text.includes("3") || text.includes("broasted") || text.includes("بروستد")) {
          selectedItem = dbMenuItems.find((i: any) => i.skucode === "BRST-4PC-01");
        } else if (text.includes("4") || text.includes("grilled") || text.includes("مشوي")) {
          selectedItem = dbMenuItems.find((i: any) => i.skucode === "GRILL-WHL-01");
        } else if (text.includes("5") || text.includes("ayran") || text.includes("عيران")) {
          selectedItem = dbMenuItems.find((i: any) => i.skucode === "DRK-AYRN-01");
        } else {
          selectedItem = dbMenuItems.find((i: any) => i.skucode === "SHW-CHIK-01");
        }

        if (selectedItem) {
          const orderItem = {
            itemId: selectedItem._id?.toString() || selectedItem.id,
            name: selectedItem.name,
            basePrice: selectedItem.basePrice,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: selectedItem.basePrice,
          };
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            items: [orderItem],
            subtotal: selectedItem.basePrice,
            total: selectedItem.basePrice + (convo.unsubmittedOrder?.deliveryFee || 0),
          };

          botReplyText = isAr
            ? `📝 تمت إضافة *${selectedItem.name.ar}* لقائمتك برصيد ${selectedItem.basePrice.toFixed(2)}€.\n\n⚡ هل ترغب في ترقية الوجبة بكوكا كولا أو بطاطا مقرمشة إضافية مقابل +3.00€ فقط؟\nأجب بـ:\n*نعم* للإضافة الكومبو\n*لا* للانتقال لتأكيد الفاتورة مباشرة`
            : isEn
            ? `📝 Added *${selectedItem.name.en}* to your order for €${selectedItem.basePrice.toFixed(2)}.\n\n⚡ Would you like to upgrade with our special French fries and Coca Cola soft drink for only +€3.00?\nReply:\n*YES* to add combo upgrade\n*NO* to proceed with checkout`
            : `📝 *${selectedItem.name.de}* wurde für ${selectedItem.basePrice.toFixed(2)} € hinzugefügt.\n\n⚡ Möchten Sie Ihre Bestellung für nur +3,00 € mit knusprigen Pommes und einer kalten Cola upgraden?\nAntworten Sie:\n*JA* für das Spar-Combo-Upgrade\n*NEIN* um die Bestellung direkt abzuschließen`;
          nextStep = "customizing";
        } else {
          botReplyText = isAr
            ? "نعتذر منك، لم نفهم اختيارك بشكل دقيق. يرجى كتابة اسم الوجبة أو رقمها (مثال: شاورما أو 1):"
            : "Entschuldigung, wir haben die Auswahl nicht verstanden. Bitte nennen Sie den Artikel als Zahl (z.B. 1) oder Name:";
        }
      } else if (step === "customizing") {
        let addedCombo = text.includes("ja") || text.includes("yes") || text.includes("نعم") || text.includes("com");
        const items = convo.unsubmittedOrder?.items || [];
        if (addedCombo && items.length > 0) {
          const item = items[0];
          item.selectedUpsell = {
            id: "up-fries",
            name: { ar: "ترقية وجبة كومبو دبل مع كولا وبطاطا", de: "Unde Combo upgrade Pommes + Cola", en: "Fries + Cola drink combo upgrade" },
            price: 3.0,
          };
          item.totalPrice += 3.0;
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            items,
            subtotal: (convo.unsubmittedOrder?.subtotal || 0) + 3.0,
            total: (convo.unsubmittedOrder?.total || 0) + 3.0,
          };
        }

        const sub = convo.unsubmittedOrder?.subtotal || 0;
        const fee = convo.unsubmittedOrder?.deliveryFee || 0;
        const total = sub + fee;

        let billSummary = "";
        if (isAr) {
          billSummary = `📋 *ملخص طلبك النهائي من مستر طابوش*\n--------------\n`;
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
          billSummary += `\nيرجى الرد بـ *1* أو *تأكيد* لتأكيد الطلب وإرساله فوراً للمطبخ طازجاً!`;
          billSummary += getShortHelpLine(lang);
        } else if (isEn) {
          billSummary = `📋 *MR. Tabboush Order Receipt*\n--------------\n`;
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
          billSummary += `\nReply with *1* or *CONFIRM* to submit your order to the kitchen!`;
          billSummary += getShortHelpLine(lang);
        } else {
          billSummary = `📋 *Rechnungsübersicht MR. Tabboush*\n--------------\n`;
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
          billSummary += `\nAntworten Sie mit *1* oder *BESTÄTIGEN*, um die Bestellung abzuschicken!`;
          billSummary += getShortHelpLine(lang);
        }
        botReplyText = billSummary;
        nextStep = "confirming";
      } else if (step === "confirming") {
        if (text.includes("1") || text.includes("yes") || text.includes("best") || text.includes("ta") || text.includes("نعم") || text.includes("تأكيد")) {
          const count = await Order.countDocuments();
          const ordNum = `TAB-${1004 + count}`;

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
            ? `🎉 رائع! تم إرسال طلبك رقم *${ordNum}* بنجاح للمطبخ وسينتهي تحضيره قريباً.\nسوف نرسل لك تحديثاً فور البدء بالتحضير. شكراً لطلبك من مستر طابوش! ❤️`
            : isEn
            ? `🎉 Wonderful! Your order *${ordNum}* has been submitted to our kitchen. We will start preparing it shortly.\nYou will receive automatic status alerts here. Thank you! ❤️`
            : `🎉 Super! Ihre Bestellung *${ordNum}* wurde an das Küchenteam übermittelt und wird zubereitet.\nWir benachrichtigen Sie gleich über den Status. Vielen Dank! ❤️`;
          nextStep = "completed";
        } else {
          botReplyText = isAr
            ? "لم يتم تأكيد طلبك بشكل صحيح. لتأكيده، اكتب *1* أو *تأكيد*."
            : "Bestellung nicht bestätigt. Schreiben Sie *1* oder *JA* zur Bestätigung.";
        }
      } else {
        botReplyText = isAr
          ? "أهلاً بك مجدداً في مستر طابوش! اطلب أي وقت بكتابة 'أهلاً' أو 'طلب' لمشاهدة القائمة."
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
      emitGlobal("order:new", newOrder);
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
    res.json({ conversation: serializeDoc(convo), dbOrders: allOrders, botReplyText });
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
