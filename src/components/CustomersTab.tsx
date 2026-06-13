import React, { useState } from "react";
import { 
  Users, 
  Search, 
  ArrowUpDown, 
  Globe, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  MessageSquare, 
  TrendingUp,
  UserCheck,
  UserMinus,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Customer } from "../types";
import { useI18n } from "../i18n";

interface CustomersTabProps {
  customers: Customer[];
  onStartChat?: (phone: string) => void;
  currencySymbol: string;
}

export default function CustomersTab({ customers, onStartChat, currencySymbol }: CustomersTabProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<"all" | "active" | "dormant">("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"lastSeen" | "ordersCount" | "totalSpend" | "name">("lastSeen");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);

  // Filter & Search Logic
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone.includes(searchQuery);
    
    const matchesSegment = 
      selectedSegment === "all" || 
      c.segment === selectedSegment;

    const matchesSource = 
      selectedSource === "all" || 
      c.sources.includes(selectedSource);

    return matchesSearch && matchesSegment && matchesSource;
  });

  // Sorting Logic
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortBy === "lastSeen") {
      return new Date(b.lastInteractionDate).getTime() - new Date(a.lastInteractionDate).getTime();
    }
    if (sortBy === "ordersCount") {
      return b.ordersCount - a.ordersCount;
    }
    if (sortBy === "totalSpend") {
      return b.totalSpend - a.totalSpend;
    }
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const selectedCustomer = customers.find((c) => c.phone === selectedCustomerPhone);

  // Aggregated Stats
  const totalUnique = customers.length;
  const activeCount = customers.filter(c => c.segment === "active").length;
  const dormantCount = customers.filter(c => c.segment === "dormant").length;
  const totalRevenues = customers.reduce((sum, c) => sum + c.totalSpend, 0);
  const averageLTV = activeCount > 0 ? Math.round((totalRevenues / activeCount) * 100) / 100 : 0;

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "-";
    }
  };

  const getSourceLabel = (src: string) => {
    switch (src) {
      case "whatsapp": return "WhatsApp";
      case "qr": return "QR Table";
      case "pos": return "POS Cashier";
      case "website": return "Web";
      case "reservation": return "Reservation";
      default: return src.toUpperCase();
    }
  };

  const getSourceBadgeColor = (src: string) => {
    switch (src) {
      case "whatsapp": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "qr": return "bg-orange-50 text-orange-700 border-orange-200";
      case "pos": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "website": return "bg-blue-50 text-blue-700 border-blue-200";
      case "reservation": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
      
      {/* Sidebar stats and customer table */}
      <div className="lg:col-span-8 flex flex-col gap-4 h-full overflow-hidden">
        
        {/* Stats Dashboard Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg">
              <Users size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">{t("customers.total")}</span>
              <span className="text-base font-extrabold text-gray-900 mt-0.5 block">{totalUnique}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <UserCheck size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">{t("customers.active")}</span>
              <span className="text-base font-extrabold text-emerald-600 mt-0.5 block">{activeCount}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <UserMinus size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">{t("customers.dormant")}</span>
              <span className="text-base font-extrabold text-rose-600 mt-0.5 block">{dormantCount}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">{t("customers.avgLTV")}</span>
              <span className="text-base font-extrabold text-blue-600 mt-0.5 block">{currencySymbol}{averageLTV}</span>
            </div>
          </div>
        </div>

        {/* List of Customers Content Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[350px]">
          
          {/* Header & Controls bar */}
          <div className="p-4 border-b border-gray-100 bg-neutral-50 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <h4 className="font-bold text-neutral-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                <Users size={16} className="text-orange-500" />
                {t("customers.directory")}
              </h4>

              {/* Quick search */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-450 text-neutral-450" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("customers.searchPlaceholder")}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-250 rounded text-xs outline-none"
                />
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[9px] uppercase font-bold text-neutral-400 mb-0.5">{t("campaign.segment")}</label>
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value as any)}
                  className="w-full bg-white p-1.5 border border-gray-250 rounded text-xs outline-none"
                >
                  <option value="all">{t("common.all")}</option>
                  <option value="active">{t("campaign.activeCustomers")}</option>
                  <option value="dormant">{t("campaign.dormantContacts")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-neutral-400 mb-0.5">{t("customers.channel")}</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-white p-1.5 border border-gray-250 rounded text-xs outline-none"
                >
                  <option value="all">{t("common.all")}</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="qr">QR Table Menu</option>
                  <option value="pos">POS Cashier</option>
                  <option value="website">Website</option>
                  <option value="reservation">Reservation</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-neutral-400 mb-0.5">{t("customers.sortBy")}</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-white p-1.5 border border-gray-250 rounded text-xs outline-none"
                >
                  <option value="lastSeen">{t("customers.lastSeen")}</option>
                  <option value="ordersCount">{t("customers.totalOrders")}</option>
                  <option value="totalSpend">{t("customers.totalSpend")}</option>
                  <option value="name">{t("customers.name")}</option>
                </select>
              </div>

              <div className="flex items-end text-neutral-450 justify-end text-[10px] font-semibold py-2">
                <span>{t("customers.found")}: {sortedCustomers.length}</span>
              </div>
            </div>
          </div>

          {/* Table list */}
          <div className="flex-1 overflow-auto max-h-[500px]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-neutral-50/50 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                  <th className="p-3 pl-4">{t("customers.name")}</th>
                  <th className="p-3">{t("customers.phone")}</th>
                  <th className="p-3">{t("customers.sources")}</th>
                  <th className="p-3 text-center">{t("customers.orders")}</th>
                  <th className="p-3 text-right">{t("customers.spend")}</th>
                  <th className="p-3 text-right pr-4">{t("customers.lastSeen")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium text-gray-800">
                {sortedCustomers.length > 0 ? (
                  sortedCustomers.map((c) => (
                    <tr
                      key={c.phone || c.name}
                      onClick={() => setSelectedCustomerPhone(c.phone)}
                      className={`hover:bg-neutral-50/50 cursor-pointer transition ${
                        selectedCustomerPhone === c.phone ? "bg-orange-50/15" : ""
                      }`}
                    >
                      <td className="p-3 pl-4 font-bold text-gray-900 flex items-center gap-1.5">
                        {c.name}
                        {c.segment === "active" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" title="Dormant" />
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-gray-500">{c.phone ? `+${c.phone}` : "-"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {c.sources.map((src) => (
                            <span
                              key={src}
                              className={`text-[8px] font-bold border px-1.5 py-0.5 rounded uppercase ${getSourceBadgeColor(src)}`}
                            >
                              {getSourceLabel(src)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-gray-900">{c.ordersCount}</td>
                      <td className="p-3 text-right font-extrabold text-orange-600">{currencySymbol}{c.totalSpend.toFixed(2)}</td>
                      <td className="p-3 text-right text-gray-500 pr-4">{formatDate(c.lastInteractionDate).split(",")[0]}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-neutral-400">
                      {t("customers.emptyList")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Drawer: Selected Customer Profile Details */}
      <div className="lg:col-span-4 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-5 h-full min-h-[400px]">
        {selectedCustomer ? (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto text-xs">
            {/* Header info */}
            <div className="border-b pb-3.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-neutral-900 text-sm">{selectedCustomer.name}</h4>
                <span className={`text-[8px] font-bold border px-2 py-0.5 rounded uppercase ${
                  selectedCustomer.segment === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                    : "bg-gray-50 text-gray-500 border-gray-250"
                }`}>
                  {selectedCustomer.segment === "active" ? t("campaign.activeCustomers") : t("campaign.dormantContacts")}
                </span>
              </div>
              <p className="font-mono text-gray-500 text-[11px]">+{selectedCustomer.phone}</p>
              
              {/* Preferred language if any */}
              {selectedCustomer.preferredLanguage && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                  <Globe size={11} />
                  <span>{t("customers.language")}: <strong className="uppercase">{selectedCustomer.preferredLanguage}</strong></span>
                </div>
              )}
            </div>

            {/* Core Customer Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 p-3 rounded-lg border border-gray-100 flex flex-col">
                <span className="text-[8px] uppercase font-bold text-neutral-450">{t("customers.totalOrders")}</span>
                <span className="text-base font-extrabold text-neutral-900 mt-1.5 flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-orange-500" />
                  {selectedCustomer.ordersCount}
                </span>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg border border-gray-100 flex flex-col">
                <span className="text-[8px] uppercase font-bold text-neutral-450">{t("customers.totalSpend")}</span>
                <span className="text-base font-extrabold text-orange-600 mt-1.5 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-orange-500" />
                  {currencySymbol}{selectedCustomer.totalSpend.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quick action chat */}
            {selectedCustomer.phone && onStartChat && (
              <button
                onClick={() => onStartChat(selectedCustomer.phone)}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11px] uppercase py-2 rounded flex items-center justify-center gap-1.5 transition leading-none shadow-sm"
              >
                <MessageSquare size={12} />
                {t("customers.startChat")}
              </button>
            )}

            {/* Recent Orders section */}
            <div className="flex-1 flex flex-col min-h-[160px] border-t pt-3">
              <h5 className="font-bold text-neutral-900 text-xs mb-2 flex items-center gap-1">
                <ShoppingBag size={12} className="text-orange-500" />
                {t("customers.recentOrders")}
              </h5>
              
              <div className="space-y-2 overflow-y-auto max-h-[200px] pr-1">
                {selectedCustomer.recentOrders.length > 0 ? (
                  selectedCustomer.recentOrders.map((o) => (
                    <div key={o.id} className="p-2.5 bg-neutral-50 border border-gray-100 rounded-lg flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-800">#{o.orderNumber}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{formatDate(o.createdAt).split(",")[0]}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-extrabold text-gray-900">{currencySymbol}{o.total}</span>
                        <span className={`text-[8px] font-bold border px-1 rounded uppercase ${getSourceBadgeColor(o.source)}`}>
                          {getSourceLabel(o.source)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-neutral-450 italic text-[11px] text-center py-4">{t("customers.noOrders")}</p>
                )}
              </div>
            </div>

            {/* Recent Reservations section */}
            <div className="flex-1 flex flex-col min-h-[140px] border-t pt-3">
              <h5 className="font-bold text-neutral-900 text-xs mb-2 flex items-center gap-1">
                <Calendar size={12} className="text-orange-500" />
                {t("customers.recentReservations")}
              </h5>
              
              <div className="space-y-2 overflow-y-auto max-h-[150px] pr-1">
                {selectedCustomer.recentReservations.length > 0 ? (
                  selectedCustomer.recentReservations.map((r) => (
                    <div key={r.id} className="p-2.5 bg-neutral-50 border border-gray-100 rounded-lg flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-800">Table {r.tableNumber || "TBD"}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{formatDate(r.dateTime)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-gray-900">{r.numPeople || r.guestCount || 2} People</span>
                        <span className="text-[9px] font-bold text-neutral-500 uppercase">{r.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-neutral-450 italic text-[11px] text-center py-4">{t("customers.noReservations")}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center gap-2.5">
            <Users size={44} className="stroke-1 text-orange-500 animate-pulse" />
            <h5 className="font-bold text-gray-800 text-sm">{t("customers.emptyProfileTitle")}</h5>
            <p className="text-xs max-w-sm leading-relaxed text-gray-500">
              {t("customers.emptyProfileText")}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
