import cron from "node-cron";
import { Order, Feedback, Campaign, Conversation } from "../models/index.js";
import { sendWhatsAppMessage } from "./whatsapp.js";

const orderStatusMessages: Record<string, { ar: string; de: string; en: string }> = {
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

export function startCronJobs() {
  // Feedback reminder: Check for delivered orders older than 30 minutes without feedback
  cron.schedule("*/5 * * * *", async () => {
    console.log("[Cron] Running feedback reminder job");
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const orders = await Order.find({
        status: "delivered",
        updatedAt: { $lte: thirtyMinutesAgo },
      });

      for (const order of orders) {
        const existing = await Feedback.findOne({ orderId: order.orderNumber });
        if (!existing) {
          // Send feedback request via WhatsApp
          try {
            // TODO: Implement actual WhatsApp send when session is active
            console.log(`[Cron] Would send feedback request for order ${order.orderNumber}`);
          } catch (e) {
            console.error(`[Cron] Failed to send feedback for ${order.orderNumber}:`, e);
          }
        }
      }
    } catch (err) {
      console.error("[Cron] Feedback job error:", err);
    }
  });

  // Campaign scheduler: Send scheduled campaigns
  cron.schedule("*/1 * * * *", async () => {
    console.log("[Cron] Running campaign scheduler");
    try {
      const now = new Date();
      const campaigns = await Campaign.find({
        status: "scheduled",
        scheduledTime: { $lte: now },
      });

      for (const campaign of campaigns) {
        campaign.status = "sending";
        await campaign.save();

        // TODO: Implement actual broadcast sending with rate limiting
        console.log(`[Cron] Would send campaign: ${campaign.title}`);

        campaign.status = "sent";
        await campaign.save();
      }
    } catch (err) {
      console.error("[Cron] Campaign job error:", err);
    }
  });

  // Cleanup old conversations (older than 90 days)
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Running cleanup job");
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const result = await Conversation.deleteMany({ updatedAt: { $lt: ninetyDaysAgo } });
      console.log(`[Cron] Cleaned up ${result.deletedCount} old conversations`);
    } catch (err) {
      console.error("[Cron] Cleanup job error:", err);
    }
  });

  console.log("[Cron] All background jobs scheduled");
}
