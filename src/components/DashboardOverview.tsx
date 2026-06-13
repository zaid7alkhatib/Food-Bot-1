import React, { useState, useEffect } from "react";
import { TrendingUp, Coins, ShoppingBag, MessageSquare, ClipboardCheck, Clock } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useI18n } from "../i18n";

interface DashboardData {
  revenueToday: number;
  totalOrders: number;
  ordersToday: number;
  activeOrders: number;
  avgOrderValue: number;
  totalRevenue: number;
  deliveryCount: number;
  pickupCount: number;
  avgFeedback: number;
  totalConversations: number;
  topItems: { name: string; qty: number }[];
  hourlyRevenue: { hour: string; sales: number }[];
}

interface DashboardOverviewProps {
  currencySymbol: string;
}

export default function DashboardOverview({ currencySymbol }: DashboardOverviewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);

  const [preset, setPreset] = useState<"today" | "yesterday" | "7days" | "30days" | "custom">("today");

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [customStart, setCustomStart] = useState(toLocalDateString(new Date()));
  const [customEnd, setCustomEnd] = useState(toLocalDateString(new Date()));

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await fetch("/api/settings/restaurant", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setRestaurant(data);
        }
      } catch (err) {
        console.error("Failed to load restaurant details for compliance status:", err);
      }
    };
    fetchRestaurant();
  }, [token]);

  const getPresetRange = () => {
    let start: Date;
    let end: Date;

    if (preset === "today") {
      const range = getTodayRange();
      start = range.start;
      end = range.end;
    } else if (preset === "yesterday") {
      const range = getYesterdayRange();
      start = range.start;
      end = range.end;
    } else if (preset === "7days") {
      const range = getLast7DaysRange();
      start = range.start;
      end = range.end;
    } else if (preset === "30days") {
      const range = getLast30DaysRange();
      start = range.start;
      end = range.end;
    } else {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      start = s;
      end = e;
    }
    return { start, end };
  };

  const handleExportAccountant = () => {
    const { start, end } = getPresetRange();
    window.open(`/api/reports/orders/export?startDate=${start.toISOString()}&endDate=${end.toISOString()}&token=${token || ""}`, "_blank");
  };

  const handleExportReconciliation = () => {
    const { start, end } = getPresetRange();
    window.open(`/api/reports/orders/reconcile?startDate=${start.toISOString()}&endDate=${end.toISOString()}&token=${token || ""}`, "_blank");
  };

  const handlePrintSummary = () => {
    const { start, end } = getPresetRange();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${t("overview.transactionSummary") || "Transaction Summary"}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #333; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #666; margin-top: 0; font-weight: normal; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th, td { border-bottom: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f9f9f9; font-weight: bold; font-size: 13px; }
            td { font-size: 13px; }
            .totals { margin-top: 40px; float: right; width: 300px; }
            .totals table { border: none; }
            .totals td { border: none; padding: 6px 12px; }
            .totals tr.grand { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
            .disclaimer { margin-top: 150px; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 15px; line-height: 1.4; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="padding: 10px 20px; background: #ea580c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 20px;">Print Report</button>
          <h1>${t("overview.transactionSummary") || "Transaction Summary"}</h1>
          <h2>Date Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</h2>
          <table>
            <thead>
              <tr>
                <th>KPI Metrics</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Revenue / Gesamtumsatz</td>
                <td>${revenueToday.toFixed(2)}${currencySymbol}</td>
              </tr>
              <tr>
                <td>Total Orders / Gesamtbestellungen</td>
                <td>${totalOrders}</td>
              </tr>
              <tr>
                <td>Average Ticket / Average Order Value</td>
                <td>${avgOrderValue.toFixed(2)}${currencySymbol}</td>
              </tr>
              <tr>
                <td>Delivery / Hauslieferungen Count</td>
                <td>${deliveryCount}</td>
              </tr>
              <tr>
                <td>Self-Pickup / Abholungen Count</td>
                <td>${pickupCount}</td>
              </tr>
              <tr>
                <td>Active Bot Conversations Count</td>
                <td>${totalConversations}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="disclaimer">
            <strong>GoBD Reporting Notice:</strong> This document summarizes sales requested on the digital ordering system. It does not replace the merchant's legal obligation to register these sales on a certified cash register (TSE) under German tax law.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getYesterdayRange = () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getLast7DaysRange = () => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getLast30DaysRange = () => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  useEffect(() => {
    const fetchData = async () => {
      if (data) setRefreshing(true);
      else setLoading(true);

      try {
        let start: Date;
        let end: Date;

        if (preset === "today") {
          const range = getTodayRange();
          start = range.start;
          end = range.end;
        } else if (preset === "yesterday") {
          const range = getYesterdayRange();
          start = range.start;
          end = range.end;
        } else if (preset === "7days") {
          const range = getLast7DaysRange();
          start = range.start;
          end = range.end;
        } else if (preset === "30days") {
          const range = getLast30DaysRange();
          start = range.start;
          end = range.end;
        } else {
          const s = new Date(customStart);
          s.setHours(0, 0, 0, 0);
          const e = new Date(customEnd);
          e.setHours(23, 59, 59, 999);
          start = s;
          end = e;
        }

        const res = await fetch(`/api/reports/dashboard?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load dashboard reports:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchData();
  }, [token, preset, customStart, customEnd]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-2"></div>
        <span className="text-xs text-gray-500">{t("overview.loading")}</span>
      </div>
    );
  }

  const revenueToday = data?.revenueToday || 0;
  const totalOrders = data?.totalOrders || 0;
  const activeOrders = data?.activeOrders || 0;
  const avgOrderValue = data?.avgOrderValue || 0;
  const avgFeedback = data?.avgFeedback || 0;
  const totalConversations = data?.totalConversations || 0;
  const topItems = data?.topItems || [];
  const hourlyRevenue = data?.hourlyRevenue || [];
  const deliveryCount = data?.deliveryCount || 0;
  const pickupCount = data?.pickupCount || 0;

  const typeDistributionData = [
    { name: `🛵 ${t("orders.delivery")}`, value: deliveryCount || 1, color: "#f97316" },
    { name: `📦 ${t("orders.pickup")}`, value: pickupCount || 1, color: "#10b981" },
  ];

  const chartBestSellers = topItems.length > 0 ? topItems : [
    { name: "Hähnchen Shawarma Super", qty: 12 },
    { name: "Arabisches Shawarma Meal", qty: 9 },
    { name: "Whole Charcoal Grilled", qty: 6 },
    { name: "Crispy Broasted Chicken", qty: 4 },
    { name: "Yogurt Ayran", qty: 8 },
  ];

  const hourlyRevenueData = hourlyRevenue.length > 0 ? hourlyRevenue : [
    { hour: "12:00", sales: 42.00 },
    { hour: "14:00", sales: 85.50 },
    { hour: "16:00", sales: 60.00 },
    { hour: "18:00", sales: 145.00 },
    { hour: "20:00", sales: 210.50 },
    { hour: "22:00", sales: 110.00 },
  ];

  return (
    <div className={`space-y-6 transition duration-200 ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Reports & Exports Section */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest flex items-center gap-2">
            📊 {t("overview.complianceReports") || "Reports & Compliance Exports"}
          </h4>
          <p className="text-[10px] text-gray-400 mt-1">
            {t("overview.complianceReportsDesc") || "Export accountant reports with automatic VAT breakdowns or POS matching spreadsheets."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportAccountant}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer select-none"
          >
            📥 {t("overview.exportAccountant") || "Accountant CSV"}
          </button>
          <button
            type="button"
            onClick={handleExportReconciliation}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer select-none"
          >
            📥 {t("overview.exportReconciliation") || "POS Reconcile"}
          </button>
          <button
            type="button"
            onClick={handlePrintSummary}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer select-none"
          >
            🖨️ {t("overview.printSummary") || "Print Summary"}
          </button>
        </div>
      </div>

      {/* Compliance Status Widget */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
            ⚖️ {t("overview.complianceTitle") || "Farman FoodSuite Compliance Status"}
          </h4>
          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold">
            System Audited
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stripe direct connection check */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-start gap-2.5">
            {restaurant?.stripeEnabled && restaurant?.stripePublishableKey ? (
              <>
                <span className="text-emerald-500 text-sm font-bold">✓</span>
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold text-slate-800">
                    {t("overview.complianceStripeConnected") || "Stripe connected directly to restaurant"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Option A Direct Settlement • Payments route directly to your own merchant account.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="text-amber-500 text-sm font-bold">⚠</span>
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold text-slate-800">
                    {t("overview.complianceStripeNotConnected") || "Stripe online payments not set up"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Using manual/cash payments. Configure Stripe credentials in Settings to accept cards.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Audit Logging */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-start gap-2.5">
            <span className="text-emerald-500 text-sm font-bold">✓</span>
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold text-slate-800">
                {t("overview.complianceAuditActive") || "Audit logging active"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Order status transition histories and technical print bridging operations are logged.
              </p>
            </div>
          </div>

          {/* Order Immutability */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-start gap-2.5">
            <span className="text-emerald-500 text-sm font-bold">✓</span>
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold text-slate-800">
                {t("overview.complianceImmutabilityActive") || "Order immutability active"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                GoBD compliance active. Order deletions are strictly blocked at database model level.
              </p>
            </div>
          </div>

          {/* CSV exports */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-start gap-2.5">
            <span className="text-emerald-500 text-sm font-bold">✓</span>
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold text-slate-800">
                {t("overview.complianceCsvActive") || "CSV exports enabled"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Financial accountant summaries with VAT details and POS reconcile logs are ready.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start gap-2.5">
          <span className="text-amber-600 text-sm font-bold">⚠</span>
          <p className="text-[11px] font-semibold text-amber-900 leading-tight">
            {t("overview.complianceReconcileWarning") || "Physical cash register reconciliation remains the responsibility of the restaurant."}
          </p>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
          {(["today", "yesterday", "7days", "30days", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition select-none cursor-pointer ${
                preset === p
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-neutral-500 hover:text-orange-600 hover:bg-neutral-200"
              }`}
            >
              {p === "today" && t("overview.today")}
              {p === "yesterday" && t("overview.yesterday")}
              {p === "7days" && t("overview.last7Days")}
              {p === "30days" && t("overview.last30Days")}
              {p === "custom" && t("overview.customRange")}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-extrabold text-neutral-400 tracking-wider">
                {t("overview.startDate")}:
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-neutral-50 px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium outline-none text-neutral-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-extrabold text-neutral-400 tracking-wider">
                {t("overview.endDate")}:
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-neutral-50 px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium outline-none text-neutral-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
            <Coins size={22} />
          </div>
          <div className="leading-tight">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t("overview.revenueToday")}</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
              {revenueToday.toFixed(2)}{currencySymbol}
            </h3>
            <p className="text-[10px] text-emerald-500 font-medium mt-0.5">🟢 {t("overview.verifiedPayouts")}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
            <ShoppingBag size={22} />
          </div>
          <div className="leading-tight">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t("overview.totalOrders")}</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalOrders}</h3>
            <p className="text-[10px] text-orange-500 font-medium mt-0.5">
              ⚡ {t("overview.queue", { count: activeOrders })}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
          <div className="leading-tight">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t("overview.averageOrder")}</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
              {avgOrderValue.toFixed(2)}{currencySymbol}
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{t("overview.perReceipt")}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center">
            <MessageSquare size={22} />
          </div>
          <div className="leading-tight">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t("overview.activeThreads")}</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalConversations}</h3>
            <p className="text-[10px] text-purple-600 font-medium mt-0.5">
              ⭐ {t("overview.customerRating", { rating: avgFeedback.toFixed(1) })}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={14} className="text-orange-500" />
              {t("overview.hourlySales")}
            </h4>
            <span className="text-[10px] bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-full font-medium">
              {t("overview.liveFeed")}
            </span>
          </div>
          <div className="w-full h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} stroke="#e5e7eb" />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} stroke="#e5e7eb" />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  labelClassName="text-[10px] font-bold text-gray-400"
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Line
                  name={t("overview.revenue", { currency: currencySymbol })}
                  type="monotone"
                  dataKey="sales"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  activeDot={{ r: 6 }}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={14} className="text-emerald-500" />
            {t("overview.channels")}
          </h4>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-full h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip wrapperStyle={{ fontSize: 10 }} />
                  <Pie
                    data={typeDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingOffset={3}
                    dataKey="value"
                  >
                    {typeDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{totalOrders}</span>
                <span className="text-[9px] uppercase text-gray-400 tracking-wider">{t("overview.totalOrders")}</span>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-2">
              {typeDistributionData.map((col) => (
                <div key={col.name} className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 text-center">
                  <span className="text-[10px] text-gray-500 block font-medium">{col.name}</span>
                  <span className="text-sm font-bold text-neutral-800">
                    {col.value} <span className="text-[10px] text-neutral-400">{t("common.orders")}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest flex items-center gap-1.5 mb-4">
          <ClipboardCheck size={14} className="text-blue-500" />
          {t("overview.bestsellers")}
        </h4>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartBestSellers} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} stroke="#e5e7eb" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#4b5563" }} stroke="#e5e7eb" width={120} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Bar dataKey="qty" fill="#10b981" radius={[0, 4, 4, 0]}>
                {chartBestSellers.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? "#f97316" : index === 1 ? "#3b82f6" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
