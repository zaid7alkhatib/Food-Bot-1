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

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/reports/dashboard", {
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
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
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
    <div className="space-y-6">
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
