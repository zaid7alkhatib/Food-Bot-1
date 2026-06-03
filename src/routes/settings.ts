import { Router } from "express";
import { Restaurant, Branch } from "../models/index.js";
import { requireRole } from "../lib/auth.js";

const router = Router();

const ADMIN_ROLES = ["super_admin", "restaurant_admin"];
const MANAGER_ROLES = ["super_admin", "restaurant_admin", "branch_manager"];

// GET /api/settings/restaurant
router.get("/restaurant", requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ isActive: true }).lean();
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json(restaurant);
  } catch (err) {
    console.error("[Settings] GET /restaurant error:", err);
    res.status(500).json({ error: "Failed to load restaurant settings" });
  }
});

// PUT /api/settings/restaurant/:id
router.put("/restaurant/:id", requireRole(...ADMIN_ROLES) as any, async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json(restaurant);
  } catch (err) {
    console.error("[Settings] PUT /restaurant/:id error:", err);
    res.status(500).json({ error: "Failed to update restaurant settings" });
  }
});

// GET /api/settings/branches
router.get("/branches", requireRole(...MANAGER_ROLES) as any, async (req, res) => {
  try {
    const branches = await Branch.find({ isActive: true }).lean();
    res.json(branches);
  } catch (err) {
    console.error("[Settings] GET /branches error:", err);
    res.status(500).json({ error: "Failed to load branches" });
  }
});

// GET /api/settings/order-status-messages
router.get("/order-status-messages", requireRole(...MANAGER_ROLES) as any, async (req, res) => {
  // For now, return the default messages from mockData
  // In the future, these should come from the Restaurant document
  const messages = {
    received: {
      ar: "✅ تم استلام طلبك رقم *{orderNumber}* بنجاح! وهو قيد المراجعة والتدقيق الآن من قبل فريق طابوش. سنخطرك فور قبوله والبدء في التحضير.",
      de: "✅ Ihre Bestellung *{orderNumber}* wurde erfolgreich empfangen! Unser Team prüft sie jetzt. Wir informieren Sie, sobald mit der Zubereitung begonnen wird.",
      en: "✅ Your order *{orderNumber}* has been successfully received and is currently under review by the MR. Tabboush team. We will notify you once accepted and preparing.",
    },
    accepted: {
      ar: "👍 تم قبول طلبك رقم *{orderNumber}* من قبل الكاشير. إجمالي الطلب: {total}. طريقة الدفع: {paymentMethod}.",
      de: "👍 Ihre Bestellung *{orderNumber}* wurde akzeptiert. Gesamtbetrag: {total}. Zahlungsmethode: {paymentMethod}.",
      en: "👍 Your order *{orderNumber}* has been accepted. Total amount: {total}. Payment method: {paymentMethod}.",
    },
    preparing: {
      ar: "👨‍🍳 بدأت رائحة الشواء تفوح! طلبك رقم *{orderNumber}* الآن في المطبخ قيد التحضير الطازج والدقيق. وقت التحضير المتوقع هو {prepTime} دقيقة.",
      de: "👨‍🍳 Frisch in der Küche! Ihre Bestellung *{orderNumber}* wird jetzt sorgfältig zubereitet. Erwartete Zubereitungszeit: {prepTime} Minuten.",
      en: "👨‍🍳 Cooking fresh in the kitchen! Your order *{orderNumber}* is now being lovingly prepared. Expected preparation time: {prepTime} minutes.",
    },
    ready_for_pickup: {
      ar: "📦 طلبك الساخن رقم *{orderNumber}* جاهز تماماً للاستلام الآن في فرعنا! ننتظر تشريفك.",
      de: "📦 Ihre heiße Bestellung *{orderNumber}* steht jetzt in unserem Restaurant zur Abholung bereit! Wir freuen uns auf Ihren Besuch.",
      en: "📦 Your hot order *{orderNumber}* is now packed and ready for pickup at our branch! We look forward to seeing you.",
    },
    out_for_delivery: {
      ar: "🛵 انطلق الكابتن! طلبك رقم *{orderNumber}* في طريقه إليك الآن مع سائق التوصيل. يرجى إبقاء الهاتف متاحاً لاستقبال الاتصال.",
      de: "🛵 Lieferfahrer ist unterwegs! Ihre Bestellung *{orderNumber}* wurde an den Kurier übergeben und ist auf dem Weg zu Ihnen. Bitte halten Sie Ihr Handy bereit.",
      en: "🛵 Delivery hero dispatched! Your order *{orderNumber}* is on its way. Please keep your phone active for the delivery feedback.",
    },
    delivered: {
      ar: "🍽️ بالهناء والشفاء! تم تسليم الطلب رقم *{orderNumber}*. نأمل أن تنال الوجبة إعجابكم. شكرًا لاختياركم مستر طابوش!",
      de: "🍽️ Guten Appetit! Ihre Bestellung *{orderNumber}* wurde erfolgreich geliefert. Wir hoffen, es schmeckt Ihnen. Vielen Dank für Ihre Wahl!",
      en: "🍽️ Enjoy your meal! Your order *{orderNumber}* has been delivered successfully. We hope you love the taste of Syria. Thank you for choosing MR. Tabboush!",
    },
    cancelled: {
      ar: "❌ نعتذر منك بشدة، تم إلغاء طلبك رقم *{orderNumber}*. للتعرف على السبب أو للاستفسار، يمكنك الرد بكلمة 'وكيل' للتحدث مع الدعم الفني.",
      de: "❌ Es tut uns leid, Ihre Bestellung *{orderNumber}* musste storniert werden. Für Fragen antworten Sie mit 'SUPPORT', um einen Mitarbeiter zu kontaktieren.",
      en: "❌ We are deeply sorry, your order *{orderNumber}* has been cancelled. For details or questions, reply with 'AGENT' to speak with our support representative.",
    },
  };
  res.json(messages);
});

export default router;
