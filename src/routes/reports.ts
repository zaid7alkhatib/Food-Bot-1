import { Router } from "express";
import { Order, Feedback, Conversation, Restaurant, Branch } from "../models/index.js";

const router = Router();

// GET /api/reports/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const rangeFilter: any = {};
    if (startDate || endDate) {
      rangeFilter.createdAt = {};
      if (startDate) rangeFilter.createdAt.$gte = new Date(startDate as string);
      if (endDate) rangeFilter.createdAt.$lte = new Date(endDate as string);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      rangeFilter.createdAt = { $gte: today };
    }

    const paidOrdersFilter = {
      $or: [
        { paymentMethod: { $ne: "Stripe" } },
        { paymentMethod: "Stripe", paymentStatus: "paid" }
      ]
    };

    const [ordersInRange, allFeedbacks, allConversations] = await Promise.all([
      Order.find({ ...rangeFilter, ...paidOrdersFilter }).lean(),
      Feedback.find(rangeFilter.createdAt ? { createdAt: rangeFilter.createdAt } : {}).lean(),
      Conversation.find(rangeFilter.createdAt ? { updatedAt: rangeFilter.createdAt } : {}).lean(),
    ]);

    const deliveredOrders = ordersInRange.filter((o) => o.status === "delivered");
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const revenueToday = totalRevenue; // range revenue
    const activeOrders = ordersInRange.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

    const deliveryCount = ordersInRange.filter((o) => o.orderType === "delivery").length;
    const pickupCount = ordersInRange.filter((o) => o.orderType === "pickup").length;

    const avgFeedback = allFeedbacks.length > 0
      ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length
      : 0;

    // Top selling items
    const itemCounts: Record<string, { name: string; qty: number }> = {};
    ordersInRange.forEach((o) => {
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
      totalOrders: ordersInRange.length,
      ordersToday: ordersInRange.length,
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

    const paidOrdersFilter = {
      $or: [
        { paymentMethod: { $ne: "Stripe" } },
        { paymentMethod: "Stripe", paymentStatus: "paid" }
      ]
    };
    const orders = await Order.find({ ...filter, ...paidOrdersFilter }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("[Reports] orders error:", err);
    res.status(500).json({ error: "Failed to load order reports" });
  }
});

function csvEscape(val: any): string {
  if (val === undefined || val === null) return "";
  let str = String(val);
  str = str.replace(/"/g, '""');
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str}"`;
  }
  return str;
}

// GET /api/reports/orders/export (Detailed Accountant Export)
router.get("/orders/export", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const paidOrdersFilter = {
      $or: [
        { paymentMethod: { $ne: "Stripe" } },
        { paymentMethod: "Stripe", paymentStatus: "paid" }
      ]
    };

    const [orders, restaurant, branches] = await Promise.all([
      Order.find({ ...filter, ...paidOrdersFilter }).sort({ createdAt: -1 }).lean(),
      Restaurant.findOne({ isActive: true }).lean(),
      Branch.find().lean()
    ]);

    const branchMap = new Map(branches.map((b: any) => [b._id.toString(), b.name]));
    const taxRate = restaurant?.taxVatRate !== undefined ? restaurant.taxVatRate : 7;

    const headers = [
      "Order Number",
      "Order Date",
      "Customer Name",
      "Customer Phone",
      "Order Type",
      "Payment Method",
      "Payment Status",
      "Amount Net",
      "VAT Amount",
      "Amount Gross",
      "Stripe Payment ID",
      "Order Status",
      "Branch",
      "Created By",
      "Completed At"
    ];

    const rows = [headers.join(",")];

    for (const order of orders) {
      const gross = order.total || 0;
      const net = gross / (1 + (taxRate / 100));
      const vat = gross - net;

      const branchName = order.branchId ? (branchMap.get(order.branchId.toString()) || "Unknown Branch") : "";

      // Determine Completed At
      let completedAt = "";
      if (order.status === "delivered" || order.status === "cancelled") {
        const finalTransition = order.statusHistory?.find((h: any) => h.to === "delivered" || h.to === "cancelled");
        completedAt = finalTransition?.timestamp ? new Date(finalTransition.timestamp).toISOString() : new Date(order.updatedAt).toISOString();
      }

      // Determine Created By
      const createdBy = order.statusHistory?.[0]?.by || order.source || "customer";

      const stripeId = order.paymentAudit?.paymentIntentId || order.stripeSessionId || "";

      const row = [
        csvEscape(order.orderNumber),
        csvEscape(order.createdAt ? new Date(order.createdAt).toISOString() : ""),
        csvEscape(order.customerName),
        csvEscape(order.whatsAppPhone),
        csvEscape(order.orderType),
        csvEscape(order.paymentMethod),
        csvEscape(order.paymentStatus),
        csvEscape(net.toFixed(2)),
        csvEscape(vat.toFixed(2)),
        csvEscape(gross.toFixed(2)),
        csvEscape(stripeId),
        csvEscape(order.status),
        csvEscape(branchName),
        csvEscape(createdBy),
        csvEscape(completedAt)
      ];
      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=accountant_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error("[Reports] accountant export error:", err);
    res.status(500).json({ error: "Failed to generate CSV export" });
  }
});

// GET /api/reports/orders/reconcile (POS Cashier Reconciliation Export)
router.get("/orders/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const paidOrdersFilter = {
      $or: [
        { paymentMethod: { $ne: "Stripe" } },
        { paymentMethod: "Stripe", paymentStatus: "paid" }
      ]
    };

    const orders = await Order.find({ ...filter, ...paidOrdersFilter }).sort({ createdAt: -1 }).lean();

    const headers = ["Date", "Order Number", "Amount", "Payment Method", "Status"];
    const rows = [headers.join(",")];

    for (const order of orders) {
      const row = [
        csvEscape(order.createdAt ? new Date(order.createdAt).toISOString() : ""),
        csvEscape(order.orderNumber),
        csvEscape((order.total || 0).toFixed(2)),
        csvEscape(order.paymentMethod),
        csvEscape(order.status)
      ];
      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=pos_reconciliation_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error("[Reports] reconciliation export error:", err);
    res.status(500).json({ error: "Failed to generate reconciliation export" });
  }
});

export default router;
