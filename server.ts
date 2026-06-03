import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { connectDB } from "./src/lib/db.js";
import { authMiddleware } from "./src/lib/auth.js";
import authRoutes from "./src/routes/auth.js";
import branchesRoutes from "./src/routes/branches.js";
import categoriesRoutes from "./src/routes/categories.js";
import { initSocket, emitGlobal } from "./src/services/socket.js";
import { startCronJobs } from "./src/services/cron.js";
import { startWhatsAppSession, stopWhatsAppSession } from "./src/services/whatsapp.js";
import {
  Branch,
  Category,
  MenuItem,
  Order,
  Conversation,
  Campaign,
  Feedback,
  WhatsAppSession,
} from "./src/models/index.js";
import { defaultCurrency, orderStatusMessages } from "./src/mockData.js";

// ------------------------------------------------------------------
// 1. Connect to MongoDB
// ------------------------------------------------------------------
await connectDB();

// ------------------------------------------------------------------
// 2. Express + HTTP + Socket.io setup
// ------------------------------------------------------------------
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const app = express();
const httpServer = http.createServer(app);
app.use(express.json());

// Initialize Socket.io
initSocket(httpServer);

// Start background cron jobs
startCronJobs();

// ------------------------------------------------------------------
// 3. Auth Routes
// ------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/branches", authMiddleware as any, branchesRoutes);
app.use("/api/menu/categories", authMiddleware as any, categoriesRoutes);

// ------------------------------------------------------------------
// 4. Gemini lazy init
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

// ------------------------------------------------------------------
// 5. REST API Routes (MongoDB backed)
// ------------------------------------------------------------------

// GET /api/state — Full system snapshot (public for now, can be protected later)
app.get("/api/state", async (req, res) => {
  try {
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

    // Convert _id to id strings for frontend compatibility
    const serialize = (arr: any[]) =>
      arr.map((doc: any) => ({
        ...doc,
        id: doc._id?.toString() || doc.id,
      }));

    res.json({
      branch: branches[0] || null,
      branches: serialize(branches),
      categories: serialize(categories),
      menuItems: serialize(menuItems),
      orders: serialize(orders).map((o: any) => ({
        ...o,
        id: o._id?.toString() || o.id,
        branchId: o.branchId?.toString?.() || o.branchId,
      })),
      campaigns: serialize(campaigns),
      feedbacks: serialize(feedbacks),
      conversations: serialize(conversations).map((c: any) => ({
        ...c,
        id: c._id?.toString() || c.id,
      })),
      currency: defaultCurrency,
      geminiStatus: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
    });
  } catch (err) {
    console.error("[API] /api/state error:", err);
    res.status(500).json({ error: "Failed to load system state" });
  }
});

// POST /api/orders
app.post("/api/orders", authMiddleware as any, async (req, res) => {
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
app.put("/api/orders/:id/status", authMiddleware as any, async (req, res) => {
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
        let lang: "ar" | "de" | "en" = "de";
        if (/[\u0600-\u06FF]/.test(text)) lang = "ar";
        else if (/hello|hi|order|pickup/i.test(text)) lang = "en";

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
    if (convo) emitGlobal("conversation:updated", convo);

    res.json({
      order: { ...order, id: order._id?.toString() || order.id },
      orders: orders.map((o: any) => ({ ...o, id: o._id?.toString() || o.id })),
      conversations: conversations.map((c: any) => ({ ...c, id: c._id?.toString() || c.id })),
    });
  } catch (err) {
    console.error("[API] PUT /api/orders/:id/status error:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/conversations/:convoId/messages
app.post("/api/conversations/:convoId/messages", authMiddleware as any, async (req, res) => {
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
      convo.botEnabled = false;
    }

    await convo.save();
    emitGlobal("conversation:updated", convo);
    res.json(convo);
  } catch (err) {
    console.error("[API] POST /api/conversations/:convoId/messages error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/conversations/:convoId/takeover
app.post("/api/conversations/:convoId/takeover", authMiddleware as any, async (req, res) => {
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
      convo.messages.push({
        id: "msg-" + Math.random().toString(36).substr(2, 9),
        sender: "bot",
        text: "🤖 تم إعادة تفعيل المساعد الآلي لخدمتك!\n🤖 Der Bestell-Bot ist wieder aktiv und bereit für Sie!",
        timestamp: new Date().toISOString(),
      });
    }

    await convo.save();
    emitGlobal("conversation:updated", convo);
    res.json(convo);
  } catch (err) {
    console.error("[API] POST /api/conversations/:convoId/takeover error:", err);
    res.status(500).json({ error: "Failed to toggle takeover" });
  }
});

// POST /api/campaigns/:id/send
app.post("/api/campaigns/:id/send", authMiddleware as any, async (req, res) => {
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
app.post("/api/feedbacks", authMiddleware as any, async (req, res) => {
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
app.post("/api/menu/items", authMiddleware as any, async (req, res) => {
  try {
    const count = await MenuItem.countDocuments();
    const item = new MenuItem({
      ...req.body,
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
app.put("/api/menu/items/:id", authMiddleware as any, async (req, res) => {
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
// 6. Bot Reply Route (Gemini + Rule-Based Fallback)
// ------------------------------------------------------------------
app.post("/api/bot-reply", async (req, res) => {
  try {
    const { phone, message } = req.body;

    let convo = await Conversation.findOne({ whatsAppPhone: phone });
    const dbMenuItems = await MenuItem.find({ isActive: true }).lean();
    const dbOrders = await Order.find().sort({ createdAt: -1 }).lean();

    if (!convo) {
      convo = new Conversation({
        customerName: "Gast " + phone.substring(phone.length - 4),
        whatsAppPhone: phone,
        botEnabled: true,
        messages: [],
        currentStep: "welcome",
        unsubmittedOrder: {
          branchId: "wuppertal-1",
          customerName: "Gast " + phone.substring(phone.length - 4),
          whatsAppPhone: phone,
          items: [],
          subtotal: 0,
          deliveryFee: 1.5,
          total: 1.5,
          status: "received",
          paymentMethod: "Cash on Delivery",
        },
      });
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
      res.json({ conversation: convo, dbOrders });
      return;
    }

    const aiClient = getGeminiClient();
    let botReplyText = "";
    let nextStep = convo.currentStep || "welcome";
    let finalPlacedOrder: any = null;

    if (aiClient) {
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
Delivery Area: Only within 4 km of Berliner Str. 179. Delivery fee is 1.50€. Minimum order is 10.00€. Payment is Cash only.

Available Menu items to offer:
${JSON.stringify(parsedMenu)}

Here is the conversation history so far:
${convo.messages.slice(-8).map((m: any) => m.sender.toUpperCase() + ": " + m.text).join("\n")}

NEW incoming customer message is: "${message}"

Your task is to:
1. Understand the message (support Arabic, German, or English dynamically depending on how the user talks to you).
2. Move the customer through the ordering flowchart:
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
  "nextStep": "welcome" | "type" | "menu" | "customizing" | "address" | "pickup_time" | "confirming" | "completed",
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
      const text = message.toLowerCase();
      let lang: "ar" | "de" | "en" = "de";
      if (/[\u0600-\u06FF]/.test(message)) lang = "ar";
      else if (/hi|hello|english|menu|order/i.test(text)) lang = "en";

      const isAr = lang === "ar";
      const isEn = lang === "en";

      const step = convo.currentStep || "welcome";

      if (step === "welcome") {
        botReplyText = isAr
          ? "أهلاً بك في مستر طابوش! 🌯 أشهى المأكولات الشامية في فوبيرتال.\n\nكيف ترغب في استلام طلبك؟\nالرجاء كتابة:\n*1* للتوصيل المنزلي (دليفري)\n*2* للاستلام من المطعم (تيك أواي)"
          : isEn
          ? "Welcome to MR. Tabboush! 🌯 Finest Damascus Shawarma in Wuppertal.\n\nHow would you like to receive your food?\nReply with:\n*1* for Home Delivery\n*2* for Self Pickup"
          : "Willkommen bei MR. Tabboush! 🌯 Feinstes syrisches Shawarma in Wuppertal.\n\nWie möchten Sie Ihre Bestellung erhalten?\nAntworten Sie mit:\n*1* für Hauslieferung (Delivery)\n*2* für Abholung (Pickup)";
        nextStep = "type";
      } else if (step === "type") {
        if (text.includes("1") || text.includes("towsil") || text.includes("delivery") || text.includes("توصيل")) {
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            orderType: "delivery",
            deliveryFee: 1.5,
          };
          botReplyText = isAr
            ? "رائع! خدمة التوصيل متوفرة داخل 4 كم دليفري. يرجى إرسال عنوان التوصيل بالتفصيل في مدينة فوبيرتال (مثال: Berliner Str. 179 Wuppertal):"
            : isEn
            ? "Great! Home delivery is available within 4 km of our branch. Please type your detailed delivery address in Wuppertal:"
            : "Super! Der Lieferservice ist innerhalb von 4 km für eine kleine Gebühr von 1,50 € verfügbar. Bitte senden Sie uns Ihre Lieferadresse in Wuppertal:";
          nextStep = "address";
        } else {
          convo.unsubmittedOrder = {
            ...convo.unsubmittedOrder,
            orderType: "pickup",
            deliveryFee: 0,
          };
          botReplyText = isAr
            ? "ممتاز! تفضل بالاستلام من المطعم بـ Berliner Str. 179.\nما هو وقت الاستلام المناسب لك؟ (مثال: 19:30)"
            : isEn
            ? "Great choice! Pickup is ready at Berliner Str. 179.\nWhat time would you like to pickup your order? (e.g., 20:15)"
            : "Alles klar! Sie können Ihre Bestellung in der Berliner Str. 179 abholen.\nUm wie viel Uhr möchten Sie Ihr Essen abholen? (z.B., 19:45)";
          nextStep = "pickup_time";
        }
      } else if (step === "address") {
        convo.unsubmittedOrder = { ...convo.unsubmittedOrder, deliveryAddress: message };
        botReplyText = isAr
          ? "حفظنا العنوان بنجاح! 📍\nإليك قائمة الطعام المتوفرة لدينا:\n\n1. وجبة شاورما عربي دجاج - 9.50€\n2. شاورما دجاج سوبر - 6.50€\n3. بروستد دجاج 4 قطع - 11.00€\n4. دجاجة مشوية عالفحم - 14.50€\n5. لبن عيران طازج - 1.80€\n\nاكتب اسم الوجبة أو الرقم للطلب:"
          : isEn
          ? "Delivery Address saved! 📍\nHere is our current hot menu:\n\n1. Arabic Chicken Shawarma Meal - €9.50\n2. Chicken Shawarma Super (Wrap) - €6.50\n3. Crispy Broasted Chicken (4 Pcs) - €11.00\n4. Whole Charcoal Grilled Chicken - €14.50\n5. Cold Yogurt Ayran - €1.80\n\nPlease type the item name or number to add to your cart:"
          : "Lieferadresse gespeichert! 📍\nHier ist unsere leckere Speisekarte:\n\n1. Arabisches Hähnchen-Shawarma Teller - 9,50 €\n2. Hähnchen Shawarma Super (Wrap) - 6,50 €\n3. Knusper-Broasted Hähnchen (4 Stck) - 11,00 €\n4. Ganzes Grillhähnchen - 14,50 €\n5. Yogurt Ayran erfrischend - 1,80 €\n\nBitte antworten Sie mit der Nummer oder dem Namen, um zu wählen:";
        nextStep = "menu";
      } else if (step === "pickup_time") {
        convo.unsubmittedOrder = { ...convo.unsubmittedOrder, pickupTime: message };
        botReplyText = isAr
          ? "تم تأكيد وقت الاستلام! ⏰\nإليك قائمة الطعام المتوفرة لدينا:\n\n1. وجبة شاورما عربي دجاج - 9.50€\n2. شاورما دجاج سوبر - 6.50€\n3. بروستد دجاج 4 قطع - 11.00€\n4. دجاجة مشوية عالفحم - 14.50€\n5. لبن عيران طازج - 1.80€\n\nاكتب اسم الوجبة أو الرقم للطلب:"
          : isEn
          ? "Pickup time confirmed! ⏰\nHere is our menu:\n\n1. Arabic Chicken Shawarma Meal - €9.50\n2. Chicken Shawarma Super (Wrap) - €6.50\n3. Crispy Broasted Chicken (4 Pcs) - €11.00\n4. Whole Charcoal Grilled Chicken - €14.50\n5. Cold Yogurt Ayran - €1.80\n\nPlease reply with the number or name of what you want to eat:"
          : "Abholzeit vermerkt! ⏰\nHier ist unsere Speisekarte:\n\n1. Arabisches Hähnchen-Shawarma Teller - 9,50 €\n2. Hähnchen Shawarma Super (Wrap) - 6,50 €\n3. Knusper-Broasted Hähnchen (4 Stck) - 11,00 €\n4. Ganzes Grillhähnchen - 14,50 €\n5. Yogurt Ayran erfrischend - 1,80 €\n\nBitte wählen Sie mit Name oder Ziffer:";
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
            billSummary += `▪️ ${i.quantity}x ${i.name.ar} (${i.basePrice.toFixed(2)}€)\n`;
            if (i.selectedUpsell) billSummary += ` └ ➕ ${i.selectedUpsell.name.ar} (+${i.selectedUpsell.price.toFixed(2)}€)\n`;
          });
          billSummary += `--------------\n`;
          billSummary += `المجموع الفرعي: ${sub.toFixed(2)}€\n`;
          if (fee > 0) billSummary += `أجرة التوصيل: ${fee.toFixed(2)}€\n`;
          billSummary += `*الإجمالي النهائي: ${total.toFixed(2)}€*\n\n`;
          billSummary += convo.unsubmittedOrder?.orderType === "delivery"
            ? `📍 التوصيل إلى: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
            : `⏰ الاستلام من المطعم الساعة: _${convo.unsubmittedOrder?.pickupTime}_\n`;
          billSummary += `💶 طريقة الدفع: *كاش نقداً عند الاستلام*\n`;
          billSummary += `\nيرجى الرد بـ *1* أو *تأكيد* لتأكيد الطلب وإرساله فوراً للمطبخ طازجاً!`;
        } else if (isEn) {
          billSummary = `📋 *MR. Tabboush Order Receipt*\n--------------\n`;
          (convo.unsubmittedOrder?.items || []).forEach((i: any) => {
            billSummary += `▪️ ${i.quantity}x ${i.name.en} (€${i.basePrice.toFixed(2)})\n`;
            if (i.selectedUpsell) billSummary += ` └ ➕ ${i.selectedUpsell.name.en} (+€${i.selectedUpsell.price.toFixed(2)})\n`;
          });
          billSummary += `--------------\n`;
          billSummary += `Subtotal: €${sub.toFixed(2)}\n`;
          if (fee > 0) billSummary += `Delivery Fee: €${fee.toFixed(2)}\n`;
          billSummary += `*Grand Total: €${total.toFixed(2)}*\n\n`;
          billSummary += convo.unsubmittedOrder?.orderType === "delivery"
            ? `📍 Ship Address: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
            : `⏰ Self pickup at: _${convo.unsubmittedOrder?.pickupTime}_\n`;
          billSummary += `💶 Payment: *CASH ONLY upon delivery*\n`;
          billSummary += `\nReply with *1* or *CONFIRM* to submit your order to the kitchen!`;
        } else {
          billSummary = `📋 *Rechnungsübersicht MR. Tabboush*\n--------------\n`;
          (convo.unsubmittedOrder?.items || []).forEach((i: any) => {
            billSummary += `▪️ ${i.quantity}x ${i.name.de} (${i.basePrice.toFixed(2)} €)\n`;
            if (i.selectedUpsell) billSummary += ` └ ➕ ${i.selectedUpsell.name.de} (+${i.selectedUpsell.price.toFixed(2)} €)\n`;
          });
          billSummary += `--------------\n`;
          billSummary += `Zwischensumme: ${sub.toFixed(2)} €\n`;
          if (fee > 0) billSummary += `Liefergebühr: ${fee.toFixed(2)} €\n`;
          billSummary += `*Gesamtbetrag: ${total.toFixed(2)} €*\n\n`;
          billSummary += convo.unsubmittedOrder?.orderType === "delivery"
            ? `📍 Lieferadresse: _${convo.unsubmittedOrder?.deliveryAddress}_\n`
            : `⏰ Abholzeit: _${convo.unsubmittedOrder?.pickupTime} Uhr_\n`;
          billSummary += `💶 Zahlung: *BARZAHLUNG bei Übergabe*\n`;
          billSummary += `\nAntworten Sie mit *1* oder *BESTÄTIGEN*, um die Bestellung abzuschicken!`;
        }
        botReplyText = billSummary;
        nextStep = "confirming";
      } else if (step === "confirming") {
        if (text.includes("1") || text.includes("yes") || text.includes("best") || text.includes("ta") || text.includes("نعم") || text.includes("تأكيد")) {
          const count = await Order.countDocuments();
          const ordNum = `TAB-${1004 + count}`;

          finalPlacedOrder = {
            orderNumber: ordNum,
            restaurantId: convo.restaurantId,
            branchId: convo.branchId || (await Branch.findOne())?._id,
            customerName: convo.customerName,
            whatsAppPhone: convo.whatsAppPhone,
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

    emitGlobal("conversation:updated", convo);

    const allOrders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json({ conversation: convo, dbOrders: allOrders });
  } catch (err) {
    console.error("[API] POST /api/bot-reply error:", err);
    res.status(500).json({ error: "Bot processing failed" });
  }
});

// ------------------------------------------------------------------
// 7. WhatsApp Session Routes
// ------------------------------------------------------------------
app.get("/api/whatsapp/sessions", authMiddleware as any, async (req, res) => {
  try {
    const sessions = await WhatsAppSession.find().populate("branchId").lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

app.post("/api/whatsapp/sessions/:id/connect", authMiddleware as any, async (req, res) => {
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

app.post("/api/whatsapp/sessions/:id/disconnect", authMiddleware as any, async (req, res) => {
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
// 8. Serve frontend assets & mount Vite in development
// ------------------------------------------------------------------
const startServer = async () => {
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
  });
};

startServer().catch((err) => {
  console.error("Failed to start full stack server:", err);
});
