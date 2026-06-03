import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  ShoppingBag,
  MessageSquare,
  Printer,
  Megaphone,
  Settings,
  Languages,
  Activity,
  HelpCircle,
  LogOut,
  Zap,
  Smartphone,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import PhoneSimulator from "./components/PhoneSimulator";
import DashboardOverview from "./components/DashboardOverview";
import LiveOrdersList from "./components/LiveOrdersList";
import ThermalPrinter from "./components/ThermalPrinter";
import ChatCenter from "./components/ChatCenter";
import CampaignTab from "./components/CampaignTab";
import MenuEditor from "./components/MenuEditor";
import WhatsAppSessions from "./components/WhatsAppSessions";
import LoginPage from "./components/LoginPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Order, OrderStatus, Conversation, MenuItem, Category, Campaign, Feedback } from "./types";

function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "chat" | "campaigns" | "menu" | "hardware" | "whatsapp">("overview");

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
  const [socketConnected, setSocketConnected] = useState(false);

  // Active printing order
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<Order | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);

  // Loading flags
  const [isLoading, setIsLoading] = useState(true);

  const socketRef = useRef<Socket | null>(null);

  // ------------------------------------------------------------------
  // Socket.io + initial data fetch
  // ------------------------------------------------------------------
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
      }
    } catch (err) {
      console.error("Failed to sync client state:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSystemState();

    // Setup Socket.io
    const socket = io({
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket.io] Connected:", socket.id);
      setSocketConnected(true);
      socket.emit("join", "dashboard");
    });

    socket.on("disconnect", () => {
      console.log("[Socket.io] Disconnected");
      setSocketConnected(false);
    });

    socket.on("order:new", (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      playAlertNotification();
      if (autoPrintEnabled && newOrder.status === "received") {
        setSelectedOrderToPrint(newOrder);
      }
    });

    socket.on("order:updated", ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o))
      );
      playAlertNotification();
    });

    socket.on("conversation:updated", (updatedConvo: Conversation) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === updatedConvo.id);
        if (exists) {
          return prev.map((c) => (c.id === updatedConvo.id ? updatedConvo : c));
        }
        return [updatedConvo, ...prev];
      });
    });

    socket.on("campaign:sent", () => {
      fetchSystemState();
    });

    socket.on("feedback:new", () => {
      fetchSystemState();
    });

    socket.on("menu:updated", () => {
      fetchSystemState();
    });

    // Fallback polling every 10s if socket is disconnected
    const pollInterval = setInterval(() => {
      if (!socket.connected) {
        fetchSystemState();
      }
    }, 10000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [autoPrintEnabled]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
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

  const playAlertNotification = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio permission limits in browser
    }
  };

  const handleSendAdminMessage = async (convoId: string, text: string) => {
    try {
      const response = await fetch(`/api/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sender: "human" }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => prev.map((c) => (c.id === convoId ? data : c)));
      }
    } catch (err) {
      console.error("Admin chat failed", err);
    }
  };

  const handleToggleTakeover = async (convoId: string, botEnabled: boolean) => {
    try {
      const response = await fetch(`/api/conversations/${convoId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botEnabled }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => prev.map((c) => (c.id === convoId ? data : c)));
      }
    } catch (err) {
      console.error("Takeover toggle error:", err);
    }
  };

  const handleDispatchCampaign = async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? data.campaign : c))
        );
      }
    } catch (err) {
      console.error("Campaign dispatch failed:", err);
    }
  };

  const handleAddMenuItem = async (item: Partial<MenuItem>) => {
    try {
      const response = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (response.ok) {
        const newItem = await response.json();
        setMenuItems((prev) => [...prev, newItem]);
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
        const data = await response.json();
        setMenuItems((prev) => prev.map((item) => (item.id === id ? data : item)));
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
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-xl border-b-4 border-orange-500 z-30 select-none">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
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

          {/* Status + User */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Socket.io status */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
              <Zap size={14} className={socketConnected ? "text-green-400" : "text-red-400"} />
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                {socketConnected ? "Live" : "Polling"}
              </span>
            </div>

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

            {/* User + Logout */}
            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right text-xs leading-tight text-slate-400">
                  <span className="font-bold text-white">{user.name}</span>
                  <span className="capitalize">{user.role.replace("_", " ")}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

            <div className="hidden md:flex flex-col text-right text-xs leading-tight text-slate-400">
              <span className="font-bold text-white">Berliner Str. 179</span>
              <span>42277 Wuppertal, Germany</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        {/* Left column: Smartphone simulator */}
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

        {/* Right column: Admin dashboards */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Tab triggers */}
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

            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer ${
                activeTab === "whatsapp"
                  ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
              }`}
            >
              <Smartphone size={14} />
              WhatsApp
            </button>
          </div>

          {/* Dynamic Tab Panels */}
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

                {activeTab === "whatsapp" && <WhatsAppSessions />}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-gray-400 py-6 border-t border-neutral-800 text-center text-xs mt-auto">
        <p>© 2026 MR. Tabboush Ordering & engagement system. Designed for Farman GmbH Syrian Cuisine operations.</p>
        <p className="text-[10px] text-gray-600 mt-1">Powered by MongoDB + Socket.io + Baileys on Node.js 20</p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------
// Root App with Auth Provider
// ------------------------------------------------------------------
export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

function AppWithAuth() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard />;
}
