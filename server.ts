import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initialCategories, initialMenuItems, initialOrders, initialCampaigns, initialFeedbacks, defaultBranch, defaultCurrency, orderStatusMessages } from "./src/mockData.js";
import { Order, OrderStatus, Conversation, Message, Campaign, Feedback, MenuItem } from "./src/types";

// Setup process variables
const PORT = 3000;
const app = express();
app.use(express.json());

// In-Memory state representing server database
let dbBranches = [defaultBranch];
let dbCategories = [...initialCategories];
let dbMenuItems = [...initialMenuItems];
let dbOrders = [...initialOrders];
let dbCampaigns = [...initialCampaigns];
let dbFeedbacks = [...initialFeedbacks];
let dbConversations: Conversation[] = [
  {
    id: "+491571234567",
    customerName: "Ahmad Malkous",
    whatsAppPhone: "+491571234567",
    botEnabled: true,
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    messages: [
      { id: "m1", sender: "customer", text: "Hallo, ich möchte bestellen", timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      { id: "m2", sender: "bot", text: "أهلاً بك في مستر طابوش! 🌯\nWillkommen bei MR. Tabboush!\n\nFür Lieferung antworten Sie mit *1*.\nFür Abholung antworten Sie mit *2*.\n\nReply with *1* for Delivery or *2* for Pickup.", timestamp: new Date(Date.now() - 39 * 60 * 1000).toISOString() },
      { id: "m3", sender: "customer", text: "1", timestamp: new Date(Date.now() - 38 * 60 * 1000).toISOString() },
      { id: "m4", sender: "bot", text: "رائع! يرجى إرسال عنوان التوصيل الخاص بك في فوبيرتال.\nSuper! Bitte geben Sie Ihre Lieferadresse in Wuppertal an.", timestamp: new Date(Date.now() - 37 * 60 * 1000).toISOString() },
      { id: "m5", sender: "customer", text: "Berliner Str. 110, 42277 Wuppertal", timestamp: new Date(Date.now() - 36 * 60 * 1000).toISOString() },
    ],
    currentStep: "menu"
  },
  {
    id: "+4917633221144",
    customerName: "Thomas Müller",
    whatsAppPhone: "+4917633221144",
    botEnabled: true,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    messages: [
      { id: "m10", sender: "customer", text: "Hallo, Shawarma bitte", timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
    ],
    currentStep: "welcome"
  }
];

// Lazy Gemini client init
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
        }
      }
    });
  }
  return aiInstance;
}

// REST APIs
app.get("/api/state", (req, res) => {
  res.json({
    branch: dbBranches[0],
    branches: dbBranches,
    categories: dbCategories,
    menuItems: dbMenuItems,
    orders: dbOrders,
    campaigns: dbCampaigns,
    feedbacks: dbFeedbacks,
    conversations: dbConversations,
    currency: defaultCurrency,
    geminiStatus: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
  });
});

app.post("/api/orders", (req, res) => {
  const newOrder: Order = {
    id: "ord-" + Math.floor(1000 + Math.random() * 9000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body
  };
  dbOrders.unshift(newOrder);
  res.status(201).json(newOrder);
});

// Update order status with auto feedback schedule simulation and bot chat response integration
app.put("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = dbOrders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  order.status = status as OrderStatus;
  order.updatedAt = new Date().toISOString();

  // Find customer conversation to push status update message
  const convo = dbConversations.find(c => c.whatsAppPhone === order.whatsAppPhone);
  if (convo) {
    let template = orderStatusMessages[status as keyof typeof orderStatusMessages];
    if (template) {
      // Determine language (detect from message, fallback to 'de' or first language)
      const lastCustMsg = convo.messages.filter(m => m.sender === "customer").pop();
      const text = lastCustMsg ? lastCustMsg.text.toLowerCase() : "";
      let lang: "ar" | "de" | "en" = "de";
      if (/[\u0600-\u06FF]/.test(text)) lang = "ar";
      else if (/hello|hi|order|pickup/i.test(text)) lang = "en";

      let msgText = template[lang] || template.de;
      msgText = msgText
        .replace("{orderNumber}", order.orderNumber)
        .replace("{total}", `${order.total.toFixed(2)}${defaultCurrency.symbol}`)
        .replace("{paymentMethod}", order.paymentMethod)
        .replace("{prepTime}", String(order.items[0]?.basePrice ? 12 : 15))
        .replace("{address}", defaultBranch.address);

      const statusMsg: Message = {
        id: "msg-" + Math.random().toString(36).substr(2, 9),
        sender: "bot",
        text: msgText,
        timestamp: new Date().toISOString()
      };
      convo.messages.push(statusMsg);
      convo.updatedAt = new Date().toISOString();
    }
  }

  res.json({ order, conversations: dbConversations });
});

// Post a manual admin/human message
app.post("/api/conversations/:convoId/messages", (req, res) => {
  const { convoId } = req.params;
  const { text, sender } = req.body;

  const convo = dbConversations.find(c => c.id === convoId);
  if (!convo) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const newMessage: Message = {
    id: "msg-" + Math.random().toString(36).substr(2, 9),
    sender: sender || "human",
    text,
    timestamp: new Date().toISOString()
  };

  convo.messages.push(newMessage);
  convo.updatedAt = new Date().toISOString();

  if (sender === "human") {
    convo.botEnabled = false; // Takeover
  }

  res.json(convo);
});

// Explicit toggle for auto bot takeover
app.post("/api/conversations/:convoId/takeover", (req, res) => {
  const { convoId } = req.params;
  const { botEnabled } = req.body;

  const convo = dbConversations.find(c => c.id === convoId);
  if (!convo) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  convo.botEnabled = botEnabled;
  convo.updatedAt = new Date().toISOString();

  // If hand back to bot, notify customer
  if (botEnabled) {
    convo.messages.push({
      id: "msg-" + Math.random().toString(36).substr(2, 9),
      sender: "bot",
      text: "🤖 تم إعادة تفعيل المساعد الآلي لخدمتك!\n🤖 Der Bestell-Bot ist wieder aktiv und bereit für Sie!",
      timestamp: new Date().toISOString()
    });
  }

  res.json(convo);
});

// Send Broad Campaign
app.post("/api/campaigns/:id/send", (req, res) => {
  const { id } = req.params;
  const campaign = dbCampaigns.find(c => c.id === id);
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  campaign.status = "sending";
  
  // Simulate batch distribution
  let targets = dbConversations;
  campaign.totalTarget = targets.length;

  setTimeout(() => {
    targets.forEach(convo => {
      let lang = campaign.language === "all" ? "de" : campaign.language;
      let bodyText = campaign.message[lang as keyof typeof campaign.message] || campaign.message.de;
      
      convo.messages.push({
        id: "camp-msg-" + Math.random().toString(36).substr(2, 9),
        sender: "bot",
        text: `📢 *${campaign.title}*\n\n${bodyText}`,
        timestamp: new Date().toISOString()
      });
      convo.updatedAt = new Date().toISOString();
    });

    campaign.status = "sent";
    campaign.sentCount = targets.length;
    campaign.failedCount = 0;
  }, 3000);

  res.json({ campaign, conversations: dbConversations });
});

// Save client feedbacks
app.post("/api/feedbacks", (req, res) => {
  const { orderId, rating, comment, customerName } = req.body;
  const newFeedback: Feedback = {
    id: "fb-" + Math.floor(100 + Math.random() * 900),
    orderId,
    customerName,
    rating,
    comment,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  dbFeedbacks.unshift(newFeedback);
  res.status(201).json(newFeedback);
});

// Smart Menu configuration edits
app.post("/api/menu/items", (req, res) => {
  const item: MenuItem = {
    id: "item-" + Math.random().toString(36).substr(2, 9),
    modifierGroups: [],
    upsellSuggestions: [],
    sortOrder: dbMenuItems.length + 1,
    isActive: true,
    isBestSeller: false,
    isAvailableForPickup: true,
    isAvailableForDelivery: true,
    ...req.body
  };
  dbMenuItems.push(item);
  res.status(201).json(item);
});

app.put("/api/menu/items/:id", (req, res) => {
  const { id } = req.params;
  const idx = dbMenuItems.findIndex(item => item.id === id);
  if (idx !== -1) {
    dbMenuItems[idx] = { ...dbMenuItems[idx], ...req.body };
    res.json(dbMenuItems[idx]);
  } else {
    res.status(404).send("Item not found");
  }
});

// Core NLP Chat Bot Simulation Route using Gemini with Rule-Based Fallback
app.post("/api/bot-reply", async (req, res) => {
  const { phone, message } = req.body;
  const matchedConvo = dbConversations.find(c => c.whatsAppPhone === phone);

  // Identify or create conversation
  let convo: Conversation;
  if (!matchedConvo) {
    convo = {
      id: phone,
      customerName: "Gast " + phone.substring(phone.length - 4),
      whatsAppPhone: phone,
      botEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      currentStep: "welcome",
      unsubmittedOrder: {
        branchId: "wuppertal-1",
        customerName: "Gast " + phone.substring(phone.length - 4),
        whatsAppPhone: phone,
        items: [],
        subtotal: 0,
        deliveryFee: 1.50,
        total: 1.50,
        status: "received",
        paymentMethod: "Cash on Delivery"
      }
    };
    dbConversations.push(convo);
  } else {
    convo = matchedConvo;
    if (!convo.unsubmittedOrder) {
      convo.unsubmittedOrder = {
        branchId: "wuppertal-1",
        customerName: convo.customerName,
        whatsAppPhone: phone,
        items: [],
        subtotal: 0,
        deliveryFee: 1.50,
        total: 1.50,
        status: "received",
        paymentMethod: "Cash on Delivery"
      };
    }
  }

  // Push user message
  const userMsg: Message = {
    id: "msg-" + Math.random().toString(36).substr(2, 9),
    sender: "customer",
    text: message,
    timestamp: new Date().toISOString()
  };
  convo.messages.push(userMsg);
  convo.updatedAt = new Date().toISOString();

  // If human mode is enabled, do not auto reply, just return conversation
  if (!convo.botEnabled) {
    return res.json({ conversation: convo, dbOrders });
  }

  const aiClient = getGeminiClient();
  let botReplyText = "";
  let nextStep = convo.currentStep || "welcome";
  let finalPlacedOrder: Order | null = null;

  if (aiClient) {
    try {
      const parsedMenu = dbMenuItems.map(item => ({
        id: item.id,
        name: item.name,
        basePrice: item.basePrice,
        description: item.description,
        modifiers: item.modifierGroups,
        upsells: item.upsellSuggestions
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
${convo.messages.slice(-8).map(m => m.sender.toUpperCase() + ": " + m.text).join("\n")}

NEW incoming customer message is: "${message}"

Your task is to:
1. Understand the message (support Arabic, German, or English dynamically depending on how the user talks to you).
2. Move the customer through the ordering flowchart:
   - "welcome" state: Say hello, state that we do Delivery (1.50€ fee within 4km) or Pickup. Ask them to choose Type (Delivery or Pickup).
   - "type" state: Read choice. If they say pickup, set currentStep to "pickup_time" and ask what time they will pick it up (e.g. "19:30"). If delivery, set currentStep to "address" and ask for their delivery address in Wuppertal.
   - "address"/"pickup_time" state: Save address or pickup time. Transition to "menu" and list our delicious categories (Shawarma, Broasted, Grilled Chicken, Drinks) and recommend things, ask them what they'd like to eat.
   - "menu" state: If they specify what dish they want (e.g "Chicken Shawarma Super" or "وجبة شاورما عربي"), parse it, add it to the unsubmittedOrder items list. If the item has Modifiers (like extra garlic, spicy), list those options and ask them to choose. Or present their upsell suggestion (e.g. combo drink + fries for 3.00€) as an irresistible offer. If they want nothing else, advance to "confirming".
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
          responseMimeType: "application/json"
        }
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
      // fallback to rule-based logic below
    }
  }

  // Fallback Rule-Based Bot Engine if Gemini is not set or failed
  if (!botReplyText) {
    const text = message.toLowerCase();
    let lang: "ar" | "de" | "en" = "de";
    if (/[\u0600-\u06FF]/.test(message)) lang = "ar";
    else if (/hi|hello|english|menu|order/i.test(text)) lang = "en";

    const isAr = lang === "ar";
    const isEn = lang === "en";

    if (convo.currentStep === "welcome") {
      botReplyText = isAr 
        ? "أهلاً بك في مستر طابوش! 🌯 أشهى المأكولات الشامية في فوبيرتال.\n\nكيف ترغب في استلام طلبك؟\nالرجاء كتابة:\n*1* للتوصيل المنزلي (دليفري)\n*2* للاستلام من المطعم (تيك أواي)"
        : isEn
        ? "Welcome to MR. Tabboush! 🌯 Finest Damascus Shawarma in Wuppertal.\n\nHow would you like to receive your food?\nReply with:\n*1* for Home Delivery\n*2* for Self Pickup"
        : "Willkommen bei MR. Tabboush! 🌯 Feinstes syrisches Shawarma in Wuppertal.\n\nWie möchten Sie Ihre Bestellung erhalten?\nAntworten Sie mit:\n*1* für Hauslieferung (Delivery)\n*2* für Abholung (Pickup)";
      convo.currentStep = "type";
    } 
    else if (convo.currentStep === "type") {
      if (text.includes("1") || text.includes("towsil") || text.includes("delivery") || text.includes("توصيل")) {
        convo.unsubmittedOrder!.orderType = "delivery";
        convo.unsubmittedOrder!.deliveryFee = 1.50;
        botReplyText = isAr
          ? "رائع! خدمة التوصيل متوفرة داخل 4 كم دليفري. يرجى إرسال عنوان التوصيل بالتفصيل في مدينة فوبيرتال (مثال: Berliner Str. 179 Wuppertal):"
          : isEn
          ? "Greart! Home delivery is available within 4 km of our branch. Please type your detailed delivery address in Wuppertal:"
          : "Super! Der Lieferservice ist innerhalb von 4 km für eine kleine Gebühr von 1,50 € verfügbar. Bitte senden Sie uns Ihre Lieferadresse in Wuppertal:";
        convo.currentStep = "address";
      } else {
        convo.unsubmittedOrder!.orderType = "pickup";
        convo.unsubmittedOrder!.deliveryFee = 0;
        botReplyText = isAr
          ? "ممتاز! تفضل بالاستلام من المطعم بـ Berliner Str. 179.\nما هو وقت الاستلام المناسب لك؟ (مثال: 19:30)"
          : isEn
          ? "Great choice! Pickup is ready at Berliner Str. 179.\nWhat time would you like to pickup your order? (e.g., 20:15)"
          : "Alles klar! Sie können Ihre Bestellung in der Berliner Str. 179 abholen.\nUm wie viel Uhr möchten Sie Ihr Essen abholen? (z.B., 19:45)";
        convo.currentStep = "pickup_time";
      }
    } 
    else if (convo.currentStep === "address") {
      convo.unsubmittedOrder!.deliveryAddress = message;
      botReplyText = isAr
        ? "حفظنا العنوان بنجاح! 📍\nإليك قائمة الطعام المتوفرة لدينا:\n\n1. وجبة شاورما عربي دجاج - 9.50€\n2. شاورما دجاج سوبر - 6.50€\n3. بروستد دجاج 4 قطع - 11.00€\n4. دجاجة مشوية عالفحم - 14.50€\n5. لبن عيران طازج - 1.80€\n\nاكتب اسم الوجبة أو الرقم للطلب:"
        : isEn
        ? "Delivery Address saved! 📍\nHere is our current hot menu:\n\n1. Arabic Chicken Shawarma Meal - €9.50\n2. Chicken Shawarma Super (Wrap) - €6.50\n3. Crispy Broasted Chicken (4 Pcs) - €11.00\n4. Whole Charcoal Grilled Chicken - €14.50\n5. Cold Yogurt Ayran - €1.80\n\nPlease type the item name or number to add to your cart:"
        : "Lieferadresse gespeichert! 📍\nHier ist unsere leckere Speisekarte:\n\n1. Arabisches Hähnchen-Shawarma Teller - 9,50 €\n2. Hähnchen Shawarma Super (Wrap) - 6,50 €\n3. Knusper-Broasted Hähnchen (4 Stck) - 11,00 €\n4. Ganzes Grillhähnchen - 14,50 €\n5. Yogurt Ayran erfrischend - 1,80 €\n\nBitte antworten Sie mit der Nummer oder dem Namen, um zu wählen:";
      convo.currentStep = "menu";
    } 
    else if (convo.currentStep === "pickup_time") {
      convo.unsubmittedOrder!.pickupTime = message;
      botReplyText = isAr
        ? "تم تأكيد وقت الاستلام! ⏰\nإليك قائمة الطعام المتوفرة لدينا:\n\n1. وجبة شاورما عربي دجاج - 9.50€\n2. شاورما دجاج سوبر - 6.50€\n3. بروستد دجاج 4 قطع - 11.00€\n4. دجاجة مشوية عالفحم - 14.50€\n5. لبن عيران طازج - 1.80€\n\nاكتب اسم الوجبة أو الرقم للطلب:"
        : isEn
        ? "Pickup time confirmed! ⏰\nHere is our menu:\n\n1. Arabic Chicken Shawarma Meal - €9.50\n2. Chicken Shawarma Super (Wrap) - €6.50\n3. Crispy Broasted Chicken (4 Pcs) - €11.00\n4. Whole Charcoal Grilled Chicken - €14.50\n5. Cold Yogurt Ayran - €1.80\n\nPlease reply with the number or name of what you want to eat:"
        : "Abholzeit vermerkt! ⏰\nHier ist unsere Speisekarte:\n\n1. Arabisches Hähnchen-Shawarma Teller - 9,50 €\n2. Hähnchen Shawarma Super (Wrap) - 6,50 €\n3. Knusper-Broasted Hähnchen (4 Stck) - 11,00 €\n4. Ganzes Grillhähnchen - 14,50 €\n5. Yogurt Ayran erfrischend - 1,80 €\n\nBitte wählen Sie mit Name oder Ziffer:";
      convo.currentStep = "menu";
    } 
    else if (convo.currentStep === "menu") {
      let selectedItem: MenuItem | undefined;
      if (text.includes("1") || text.includes("teller") || text.includes("عربي") || text.includes("arabic")) {
        selectedItem = dbMenuItems.find(i => i.id === "item-shawarma-arabic-chicken");
      } else if (text.includes("3") || text.includes("broasted") || text.includes("بروستد")) {
        selectedItem = dbMenuItems.find(i => i.id === "item-broasted-4pcs");
      } else if (text.includes("4") || text.includes("grilled") || text.includes("مشوي")) {
        selectedItem = dbMenuItems.find(i => i.id === "item-grilled-whole");
      } else if (text.includes("5") || text.includes("ayran") || text.includes("عيران")) {
        selectedItem = dbMenuItems.find(i => i.id === "item-ayran");
      } else {
        selectedItem = dbMenuItems.find(i => i.id === "item-shawarma-chicken"); // default wrap
      }

      if (selectedItem) {
        const orderItem = {
          itemId: selectedItem.id,
          name: selectedItem.name,
          basePrice: selectedItem.basePrice,
          quantity: 1,
          selectedModifiers: [],
          totalPrice: selectedItem.basePrice
        };
        convo.unsubmittedOrder!.items = [orderItem];
        convo.unsubmittedOrder!.subtotal = selectedItem.basePrice;
        convo.unsubmittedOrder!.total = selectedItem.basePrice + (convo.unsubmittedOrder!.deliveryFee || 0);

        botReplyText = isAr
          ? `📝 تمت إضافة *${selectedItem.name.ar}* لقائمتك برصيد ${selectedItem.basePrice.toFixed(2)}€.\n\n⚡ هل ترغب في ترقية الوجبة بكوكا كولا أو بطاطا مقرمشة إضافية مقابل +3.00€ فقط؟\nأجب بـ:\n*نعم* للإضافة الكومبو\n*لا* للانتقال لتأكيد الفاتورة مباشرة`
          : isEn
          ? `📝 Added *${selectedItem.name.en}* to your order for €${selectedItem.basePrice.toFixed(2)}.\n\n⚡ Would you like to upgrade with our special French fries and Coca Cola soft drink for only +€3.00?\nReply:\n*YES* to add combo upgrade\n*NO* to proceed with checkout`
          : `📝 *${selectedItem.name.de}* wurde für ${selectedItem.basePrice.toFixed(2)} € hinzugefügt.\n\n⚡ Möchten Sie Ihre Bestellung für nur +3,00 € mit knusprigen Pommes und einer kalten Cola upgraden?\nAntworten Sie:\n*JA* für das Spar-Combo-Upgrade\n*NEIN* um die Bestellung direkt abzuschließen`;
        convo.currentStep = "customizing";
      } else {
        botReplyText = isAr 
          ? "نعتذر منك، لم نفهم اختيارك بشكل دقيق. يرجى كتابة اسم الوجبة أو رقمها (مثال: شاورما أو 1):"
          : "Entschuldigung, wir haben die Auswahl nicht verstanden. Bitte nennen Sie den Artikel als Zahl (z.B. 1) oder Name:";
      }
    } 
    else if (convo.currentStep === "customizing") {
      let addedCombo = text.includes("ja") || text.includes("yes") || text.includes("نعم") || text.includes("com");
      if (addedCombo && convo.unsubmittedOrder!.items!.length > 0) {
        const item = convo.unsubmittedOrder!.items![0];
        item.selectedUpsell = {
          id: "up-fries",
          name: { ar: "ترقية وجبة كومبو دبل مع كولا وبطاطا", de: "Unde Combo upgrade Pommes + Cola", en: "Fries + Cola drink combo upgrade" },
          price: 3.00
        };
        item.totalPrice += 3.00;
        convo.unsubmittedOrder!.subtotal! += 3.00;
        convo.unsubmittedOrder!.total! += 3.00;
      }

      // Display Bill
      const sub = convo.unsubmittedOrder!.subtotal || 0;
      const fee = convo.unsubmittedOrder!.deliveryFee || 0;
      const total = sub + fee;

      let billSummary = "";
      if (isAr) {
        billSummary = `📋 *ملخص طلبك النهائي من مستر طابوش*\n--------------\n`;
        convo.unsubmittedOrder!.items!.forEach(i => {
          billSummary += `▪️ ${i.quantity}x ${i.name.ar} (${i.basePrice.toFixed(2)}€)\n`;
          if (i.selectedUpsell) billSummary += ` └ ➕ ${i.selectedUpsell.name.ar} (+${i.selectedUpsell.price.toFixed(2)}€)\n`;
        });
        billSummary += `--------------\n`;
        billSummary += `المجموع الفرعي: ${sub.toFixed(2)}€\n`;
        if (fee > 0) billSummary += `أجرة التوصيل: ${fee.toFixed(2)}€\n`;
        billSummary += `*الإجمالي النهائي: ${total.toFixed(2)}€*\n\n`;
        billSummary += convo.unsubmittedOrder!.orderType === "delivery"
          ? `📍 التوصيل إلى: _${convo.unsubmittedOrder!.deliveryAddress}_\n`
          : `⏰ الاستلام من المطعم الساعة: _${convo.unsubmittedOrder!.pickupTime}_\n`;
        billSummary += `💶 طريقة الدفع: *كاش نقداً عند الاستلام*\n`;
        billSummary += `\nيرجى الرد بـ *1* أو *تأكيد* لتأكيد الطلب وإرساله فوراً للمطبخ طازجاً!`;
      } else if (isEn) {
        billSummary = `📋 *MR. Tabboush Order Receipt*\n--------------\n`;
        convo.unsubmittedOrder!.items!.forEach(i => {
          billSummary += `▪️ ${i.quantity}x ${i.name.en} (€${i.basePrice.toFixed(2)})\n`;
          if (i.selectedUpsell) billSummary += ` └ ➕ ${i.selectedUpsell.name.en} (+€${i.selectedUpsell.price.toFixed(2)})\n`;
        });
        billSummary += `--------------\n`;
        billSummary += `Subtotal: €${sub.toFixed(2)}\n`;
        if (fee > 0) billSummary += `Delivery Fee: €${fee.toFixed(2)}\n`;
        billSummary += `*Grand Total: €${total.toFixed(2)}*\n\n`;
        billSummary += convo.unsubmittedOrder!.orderType === "delivery"
          ? `📍 Ship Address: _${convo.unsubmittedOrder!.deliveryAddress}_\n`
          : `⏰ Self pickup at: _${convo.unsubmittedOrder!.pickupTime}_\n`;
        billSummary += `💶 Payment: *CASH ONLY upon delivery*\n`;
        billSummary += `\nReply with *1* or *CONFIRM* to submit your order to the kitchen!`;
      } else {
        billSummary = `📋 *Rechnungsübersicht MR. Tabboush*\n--------------\n`;
        convo.unsubmittedOrder!.items!.forEach(i => {
          billSummary += `▪️ ${i.quantity}x ${i.name.de} (${i.basePrice.toFixed(2)} €)\n`;
          if (i.selectedUpsell) billSummary += ` └ ➕ ${i.selectedUpsell.name.de} (+${i.selectedUpsell.price.toFixed(2)} €)\n`;
        });
        billSummary += `--------------\n`;
        billSummary += `Zwischensumme: ${sub.toFixed(2)} €\n`;
        if (fee > 0) billSummary += `Liefergebühr: ${fee.toFixed(2)} €\n`;
        billSummary += `*Gesamtbetrag: ${total.toFixed(2)} €*\n\n`;
        billSummary += convo.unsubmittedOrder!.orderType === "delivery"
          ? `📍 Lieferadresse: _${convo.unsubmittedOrder!.deliveryAddress}_\n`
          : `⏰ Abholzeit: _${convo.unsubmittedOrder!.pickupTime} Uhr_\n`;
        billSummary += `💶 Zahlung: *BARZAHLUNG bei Übergabe*\n`;
        billSummary += `\nAntworten Sie mit *1* oder *BESTÄTIGEN*, um die Bestellung abzuschicken!`;
      }
      botReplyText = billSummary;
      convo.currentStep = "confirming";
    } 
    else if (convo.currentStep === "confirming") {
      if (text.includes("1") || text.includes("yes") || text.includes("best") || text.includes("ta") || text.includes("نعم") || text.includes("تأكيد")) {
        const ordId = "ord-" + Math.floor(1000 + Math.random() * 9000);
        const ordNum = "TAB-" + Math.floor(1004 + dbOrders.length);
        
        finalPlacedOrder = {
          id: ordId,
          orderNumber: ordNum,
          branchId: convo.unsubmittedOrder!.branchId || "wuppertal-1",
          customerName: convo.customerName,
          whatsAppPhone: convo.whatsAppPhone,
          orderType: convo.unsubmittedOrder!.orderType as any,
          items: convo.unsubmittedOrder!.items as any,
          subtotal: convo.unsubmittedOrder!.subtotal || 0,
          deliveryFee: convo.unsubmittedOrder!.deliveryFee || 0,
          total: convo.unsubmittedOrder!.total || 0,
          status: "received",
          paymentMethod: convo.unsubmittedOrder!.paymentMethod || "Cash on Delivery",
          deliveryAddress: convo.unsubmittedOrder!.deliveryAddress,
          pickupTime: convo.unsubmittedOrder!.pickupTime,
          notes: convo.unsubmittedOrder!.notes || "Created via WhatsApp Bot",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        botReplyText = isAr
          ? `🎉 رائع! تم إرسال طلبك رقم *${ordNum}* بنجاح للمطبخ وسينتهي تحضيره قريباً.\nسوف نرسل لك تحديثاً فور البدء بالتحضير. شكراً لطلبك من مستر طابوش! ❤️`
          : isEn
          ? `🎉 Wonderful! Your order *${ordNum}* has been submitted to our kitchen. We will start preparing it shortly.\nYou will receive automatic status alerts here. Thank you! ❤️`
          : `🎉 Super! Ihre Bestellung *${ordNum}* wurde an das Küchenteam übermittelt und wird zubereitet.\nWir benachrichtigen Sie gleich über den Status. Vielen Dank! ❤️`;
        convo.currentStep = "completed";
      } else {
        botReplyText = isAr
          ? "لم يتم تأكيد طلبك بشكل صحيح. لتأكيده، اكتب *1* أو *تأكيد*."
          : "Bestellung nicht bestätigt. Schreiben Sie *1* oder *JA* zur Bestätigung.";
      }
    }
    else {
      botReplyText = isAr
        ? "أهلاً بك مجدداً في مستر طابوش! اطلب أي وقت بكتابة 'أهلاً' أو 'طلب' لمشاهدة القائمة."
        : "Hallo! Schreiben Sie 'Hallo' oder 'Menü', um eine neue Bestellung zu starten.";
      convo.currentStep = "welcome";
    }
  }

  // Handle final placed order saving
  if (finalPlacedOrder) {
    dbOrders.unshift(finalPlacedOrder);
  }

  // Push bot reply
  const botMessage: Message = {
    id: "msg-" + Math.random().toString(36).substr(2, 9),
    sender: "bot",
    text: botReplyText,
    timestamp: new Date().toISOString()
  };
  convo.messages.push(botMessage);
  convo.updatedAt = new Date().toISOString();

  res.json({ conversation: convo, dbOrders });
});

// Serve frontend assets & mount Vite in development
const startServer = async () => {
  if (process.env.DISABLE_HMR === "true" || process.env.NODE_ENV === "production") {
    // Production / No HMR (serve static files dynamically)
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      // In development fallback if dist not built yet
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    }
  } else {
    // Normal Development (Vite Middleware)
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MR. Tabboush Server] Running on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch(err => {
  console.error("Failed to start full stack server:", err);
});
