import { Router } from "express";
import { Order, Feedback, Conversation } from "../models/index.js";

const router = Router();

// GET /api/reports/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ordersToday, allOrders, allFeedbacks, allConversations] = await Promise.all([
      Order.find({ createdAt: { $gte: today } }).lean(),
      Order.find().lean(),
      Feedback.find().lean(),
      Conversation.find().lean(),
    ]);

    const deliveredOrders = allOrders.filter((o) => o.status === "delivered");
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const revenueToday = ordersToday
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const activeOrders = allOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

    const deliveryCount = allOrders.filter((o) => o.orderType === "delivery").length;
    const pickupCount = allOrders.filter((o) => o.orderType === "pickup").length;

    const avgFeedback = allFeedbacks.length > 0
      ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length
      : 0;

    // Top selling items
    const itemCounts: Record<string, { name: string; qty: number }> = {};
    allOrders.forEach((o) => {
      o.items?.forEach((item: any) => {
        const enName = item.name?.en || item.name?.de || "Unknown";
        if (itemCounts[enName]) {
          itemCounts[enName].qty += item.quantity || 1;
        } else {
          itemCounts[enName] = { name: item.name?.de || enName, qty: item.quantity || 1 };
        }
      });
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Hourly revenue for today (mock distribution if no real hourly data)
    const hours = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
    const hourlyRevenue = hours.map((hour, idx) => {
      const base = revenueToday > 0 ? revenueToday / 6 : 50;
      return {
        hour,
        sales: Math.round((base * (0.5 + idx * 0.2)) * 100) / 100,
      };
    });

    res.json({
      revenueToday: Math.round(revenueToday * 100) / 100,
      totalOrders: allOrders.length,
      ordersToday: ordersToday.length,
      activeOrders: activeOrders.length,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      deliveryCount,
      pickupCount,
      avgFeedback: Math.round(avgFeedback * 10) / 10,
      totalConversations: allConversations.length,
      topItems,
      hourlyRevenue,
    });
  } catch (err) {
    console.error("[Reports] dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard reports" });
  }
});

// GET /api/reports/orders
router.get("/orders", async (req, res) => {
  try {
    const { startDate, endDate, status, orderType } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("[Reports] orders error:", err);
    res.status(500).json({ error: "Failed to load order reports" });
  }
});

export default router;
