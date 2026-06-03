import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ShoppingBag,
  MessageSquare,
  Printer,
  Megaphone,
  Settings,
  Grid,
  Bell,
  Languages,
  Activity,
  UserCheck,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import PhoneSimulator from "./components/PhoneSimulator";
import DashboardOverview from "./components/DashboardOverview";
import LiveOrdersList from "./components/LiveOrdersList";
import ThermalPrinter from "./components/ThermalPrinter";
import ChatCenter from "./components/ChatCenter";
import CampaignTab from "./components/CampaignTab";
import MenuEditor from "./components/MenuEditor";
import { Order, OrderStatus, Conversation, MenuItem, Category, Campaign, Feedback } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "chat" | "campaigns" | "menu" | "hardware">("overview");

  // State populated from the server
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [geminiStatus, setGeminiStatus] = useState(false);

  // Active printing order
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<Order | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);

  // Loading flags
  const [isLoading, setIsLoading] = useState(true);

  // Poll state every 3 seconds to keep phone simulator events & cashiers dashboards in absolute lock-step real-time sync!
  const fetchSystemState = async () => {
    try {
      const response = await fetch("/api/state");
      if (response.ok) {
        const data = await response.json();
        setBranchInfo(data.branch);
        setCategories(data.categories);
        setMenuItems(data.menuItems);
        setOrders(data.orders);
        setConversations(data.conversations);
        setCampaigns(data.campaigns);
        setFeedbacks(data.feedbacks);
        setGeminiStatus(data.geminiStatus);

        // Auto print logic simulation if enabled and a new "received" order emerges
        if (autoPrintEnabled) {
          const freshReceived = data.orders.find((o: Order) => o.status === "received");
          if (freshReceived && (!selectedOrderToPrint || selectedOrderToPrint.id !== freshReceived.id)) {
            setSelectedOrderToPrint(freshReceived);
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync client state:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemState();
    const interval = setInterval(fetchSystemState, 3000);
    return () => clearInterval(interval);
  }, [autoPrintEnabled]);

  // Update order status on server
  const handleUpdateOrderStatus = async (id: string, nextStatus: OrderStatus) => {
    try {
      const response = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
        setConversations(data.conversations);
        
        // Update printing reference if active
        if (selectedOrderToPrint?.id === id) {
          const matched = data.orders.find((o: Order) => o.id === id);
          if (matched) setSelectedOrderToPrint(matched);
        }
        
        playAlertNotification();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Sound generator helper for state events
  const playAlertNotification = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // Pitch A4
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio permission limits in browser
    }
  };

  // Direct support chat messaging
  const handleSendAdminMessage = async (convoId: string, text: string) => {
    try {
      const response = await fetch(`/api/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sender: "human" }),
      });
      if (response.ok) {
        fetchSystemState();
      }
    } catch (err) {
      console.error("Admin chat failed", err);
    }
  };

  // Autopilot toggle
  const handleToggleTakeover = async (convoId: string, botEnabled: boolean) => {
    try {
      const response = await fetch(`/api/conversations/${convoId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botEnabled }),
      });
      if (response.ok) {
        fetchSystemState();
      }
    } catch (err) {
      console.error("Takeover toggle error:", err);
    }
  };

  // Marketing dispatch
  const handleDispatchCampaign = async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
      });
      if (response.ok) {
        fetchSystemState();
      }
    } catch (err) {
      console.error("Campaign dispatch failed:", err);
    }
  };

  // Dynamic add item
  const handleAddMenuItem = async (item: Partial<MenuItem>) => {
    try {
      const response = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (response.ok) {
        fetchSystemState();
      }
    } catch (err) {
      console.error("Failed adding product:", err);
    }
  };

  const handleUpdateMenuItem = async (id: string, updated: Partial<MenuItem>) => {
    try {
      const response = await fetch(`/api/menu/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (response.ok) {
        fetchSystemState();
      }
    } catch (err) {
      console.error("Failed update product:", err);
    }
  };

  const handleSelectPrintOrder = (order: Order) => {
    setSelectedOrderToPrint(order);
    setActiveTab("hardware");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-neutral-800">
      
      {/* Upper Damascus Syrian Header bar */}
      <header className="bg-slate-900 text-white shadow-xl border-b-4 border-orange-500 z-30 select-none">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Brand logos */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xl shadow-lg ring-2 ring-white/20 transform rotate-[-2deg] select-none hover:rotate-[6deg] transition duration-200">
              🌯
            </div>
            <div className="leading-snug text-center sm:text-left">
              <h1 className="text-lg sm:text-xl font-serif font-bold tracking-tight flex items-center justify-center sm:justify-start gap-2">
                MR. Tabboush
                <span className="text-xs bg-orange-500 text-white px-2.5 py-0.5 rounded-full font-sans tracking-wide">SYSTEM</span>
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                Wuppertal Branch • WhatsApp Automated Ordering Ecosystem
              </p>
            </div>
          </div>

          {/* Core Telemetry status */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Gemini API Indicator */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-1.5">
              <Activity size={14} className={geminiStatus ? "text-green-400 animate-pulse" : "text-orange-400 animate-pulse"} />
              <div className="text-left leading-none">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">NLP AGENT:</span>
                <span className="text-xs font-semibold text-white">
                  {geminiStatus ? "Gemini 3.5 Active" : "Local Rule-based Simulator"}
                </span>
              </div>
            </div>

            {/* Quick address badge */}
            <div className="hidden md:flex flex-col text-right text-xs leading-tight text-slate-400">
              <span className="font-bold text-white">Berliner Str. 179</span>
              <span>42277 Wuppertal, Germany</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace frame splitter */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* Left column: Smartphone interactive simulator */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="sticky top-6 space-y-4">
            
            <div className="flex items-center justify-between pb-1 border-b border-gray-200">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                <Languages size={15} />
                WhatsApp Simulator
              </h2>
              <span className="text-[10px] text-gray-400 font-serif italic">Test bot flows live here</span>
            </div>

            <PhoneSimulator
              onOrderPlaced={() => {
                playAlertNotification();
                setActiveTab("orders");
              }}
              onRefreshState={fetchSystemState}
              conversations={conversations}
              activeConvoId={null}
              setActiveConvoId={() => {}}
              currencySymbol={currencySymbol}
            />

            {/* Extra guide tips below the phone */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-950 leading-relaxed shadow-sm">
              <h5 className="font-bold flex items-center gap-1 mb-1 text-orange-950">
                <HelpCircle size={13} />
                Developer Test Guide:
              </h5>
              <p>
                How to order: Try typing <strong>"Hallo"</strong> or <strong>"أريد طلب شاورما"</strong> in the chat to link with the ordering assistant. Choose <strong>Delivery</strong> or <strong>Pickup</strong>, select items, and reply <strong>"1"</strong> to place!
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Admin command control dashboards */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Main workspace Tab triggers */}
          <div className="flex flex-wrap border-b border-gray-200 gap-1 select-none">
            
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer ${
                activeTab === "overview"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <TrendingUp size={14} />
              Overview
            </button>

            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer relative ${
                activeTab === "orders"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <ShoppingBag size={14} />
              Live Orders
              {orders.filter((o) => o.status === "received").length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute top-1 right-2"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer ${
                activeTab === "chat"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <MessageSquare size={14} />
              Live Chats
            </button>

            <button
              onClick={() => setActiveTab("campaigns")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer ${
                activeTab === "campaigns"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <Megaphone size={14} />
              Marketing
            </button>

            <button
              onClick={() => setActiveTab("menu")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer ${
                activeTab === "menu"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <Settings size={14} />
              Menu Editor
            </button>

            <button
              onClick={() => setActiveTab("hardware")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer ${
                activeTab === "hardware"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <Printer size={14} />
              Printer
            </button>
          </div>

          {/* Dynamic Tab Render panels */}
          <div className="flex-1 min-h-[500px]">
            {isLoading ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center flex flex-col items-center justify-center gap-2 shadow-sm">
                <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
                <span className="text-xs text-gray-500 font-medium">Bundling workspace states...</span>
              </div>
            ) : (
              <>
                {activeTab === "overview" && (
                  <DashboardOverview
                    orders={orders}
                    feedbacks={feedbacks}
                    conversations={conversations}
                    currencySymbol={currencySymbol}
                  />
                )}

                {activeTab === "orders" && (
                  <LiveOrdersList
                    orders={orders}
                    onUpdateStatus={handleUpdateOrderStatus}
                    onSelectPrintOrder={handleSelectPrintOrder}
                    currencySymbol={currencySymbol}
                  />
                )}

                {activeTab === "chat" && (
                  <ChatCenter
                    conversations={conversations}
                    onSendAdminMessage={handleSendAdminMessage}
                    onToggleTakeover={handleToggleTakeover}
                  />
                )}

                {activeTab === "campaigns" && (
                  <CampaignTab
                    campaigns={campaigns}
                    onDispatchCampaign={handleDispatchCampaign}
                  />
                )}

                {activeTab === "menu" && (
                  <MenuEditor
                    categories={categories}
                    menuItems={menuItems}
                    onAddItem={handleAddMenuItem}
                    onUpdateItem={handleUpdateMenuItem}
                    currencySymbol={currencySymbol}
                  />
                )}

                {activeTab === "hardware" && (
                  <ThermalPrinter
                    activeOrderToPrint={selectedOrderToPrint}
                    autoPrintEnabled={autoPrintEnabled}
                    onToggleAutoPrint={setAutoPrintEnabled}
                    currencySymbol={currencySymbol}
                  />
                )}
              </>
            )}
          </div>
        </div>

      </main>

      {/* Humble Footer brandings */}
      <footer className="bg-neutral-900 text-gray-400 py-6 border-t border-neutral-800 text-center text-xs mt-auto">
        <p>© 2026 MR. Tabboush Ordering & engagement system. Designed for Farman GmbH Syrian Cuisine operations.</p>
        <p className="text-[10px] text-gray-600 mt-1">Simulated VPS Node running on Cloud container environment.</p>
      </footer>
    </div>
  );
}
