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
  Building2,
  Users,
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
import BranchSettings from "./components/BranchSettings";
import RestaurantSettings from "./components/RestaurantSettings";
import UserManagement from "./components/UserManagement";
import LoginPage from "./components/LoginPage";
import SmartMenu from "./components/SmartMenu";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { I18nProvider, useI18n, AppLanguage } from "./i18n";
import { Order, OrderStatus, Conversation, MenuItem, Category, Campaign, Feedback, UserRole } from "./types";

type DashboardTab =
  | "overview"
  | "orders"
  | "chat"
  | "campaigns"
  | "menu"
  | "hardware"
  | "whatsapp"
  | "settings"
  | "restaurant"
  | "users";

const ROLE_TABS: Record<UserRole, DashboardTab[]> = {
  super_admin: ["overview", "orders", "chat", "campaigns", "menu", "hardware", "whatsapp", "settings", "restaurant", "users"],
  restaurant_admin: ["overview", "orders", "chat", "campaigns", "menu", "hardware", "whatsapp", "settings", "restaurant", "users"],
  branch_manager: ["overview", "orders", "chat", "menu", "hardware", "settings"],
  staff: ["orders", "hardware"],
  support_agent: ["chat"],
};

const TAB_CONFIG: {
  id: DashboardTab;
  labelKey: string;
  Icon: React.ComponentType<{ size?: number }>;
}[] = [
  { id: "overview", labelKey: "nav.overview", Icon: TrendingUp },
  { id: "orders", labelKey: "nav.orders", Icon: ShoppingBag },
  { id: "chat", labelKey: "nav.chat", Icon: MessageSquare },
  { id: "campaigns", labelKey: "nav.campaigns", Icon: Megaphone },
  { id: "menu", labelKey: "nav.menu", Icon: Settings },
  { id: "hardware", labelKey: "nav.printer", Icon: Printer },
  { id: "whatsapp", labelKey: "nav.whatsapp", Icon: Smartphone },
  { id: "settings", labelKey: "nav.branch", Icon: Settings },
  { id: "restaurant", labelKey: "nav.restaurant", Icon: Building2 },
  { id: "users", labelKey: "nav.users", Icon: Users },
];

function normalizeConversation(conversation: any): Conversation {
  const id = conversation.id || conversation._id;
  return {
    ...conversation,
    id: id ? String(id) : "",
  };
}

function normalizeConversations(conversations: any[] = []): Conversation[] {
  return conversations.map(normalizeConversation).filter((conversation) => conversation.id);
}

function normalizeCategory(category: any): Category {
  const id = category.id || category._id;
  return {
    ...category,
    id: id ? String(id) : "",
  };
}

function normalizeMenuItem(item: any): MenuItem {
  const id = item.id || item._id;
  return {
    ...item,
    id: id ? String(id) : "",
    categoryId: item.categoryId?.toString?.() || item.categoryId,
  };
}

function mergeConversation(prev: Conversation[], incoming: any): Conversation[] {
  const normalized = normalizeConversation(incoming);
  if (!normalized.id) return prev;

  return [
    normalized,
    ...prev.filter((conversation) => conversation.id !== normalized.id),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function Dashboard() {
  const { user, logout, token } = useAuth();
  const { language, setLanguage, t, dir } = useI18n();

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const allowedTabs = user ? ROLE_TABS[user.role] ?? ROLE_TABS.staff : [];
  const visibleTabs = TAB_CONFIG.filter((tab) => allowedTabs.includes(tab.id));
  const showSimulator = user?.role === "super_admin" || user?.role === "restaurant_admin" || user?.role === "branch_manager";
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // State populated from the server
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [restaurantInfo, setRestaurantInfo] = useState<any>(null);
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

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabs]);

  // ------------------------------------------------------------------
  // Socket.io + initial data fetch
  // ------------------------------------------------------------------
  const fetchSystemState = async () => {
    try {
      const response = await fetch("/api/state", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (response.ok) {
        const data = await response.json();
        setBranchInfo(data.branch);
        setRestaurantInfo(data.restaurant);
        setCategories(data.categories);
        setMenuItems(data.menuItems);
        setOrders(data.orders);
        setConversations(normalizeConversations(data.conversations));
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
      setConversations((prev) => mergeConversation(prev, updatedConvo));
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
        headers: authHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
        setConversations(normalizeConversations(data.conversations));

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
        headers: authHeaders(),
        body: JSON.stringify({ text, sender: "human" }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => mergeConversation(prev, data));
      }
    } catch (err) {
      console.error("Admin chat failed", err);
    }
  };

  const handleToggleTakeover = async (convoId: string, botEnabled: boolean) => {
    try {
      const response = await fetch(`/api/conversations/${convoId}/takeover`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ botEnabled }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => mergeConversation(prev, data));
      }
    } catch (err) {
      console.error("Takeover toggle error:", err);
    }
  };

  const handleDispatchCampaign = async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}/send`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (response.ok) {
        const data = await response.json();
        setConversations(normalizeConversations(data.conversations));
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
        headers: authHeaders(),
        body: JSON.stringify(item),
      });
      if (response.ok) {
        const newItem = normalizeMenuItem(await response.json());
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
        headers: authHeaders(),
        body: JSON.stringify(updated),
      });
      if (response.ok) {
        const data = normalizeMenuItem(await response.json());
        setMenuItems((prev) => prev.map((item) => (item.id === id ? data : item)));
      }
    } catch (err) {
      console.error("Failed update product:", err);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    try {
      const response = await fetch(`/api/menu/items/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (response.ok) {
        setMenuItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = await response.json().catch(() => null);
        window.alert(data?.error || t("menu.deleteItemFailed"));
      }
    } catch (err) {
      console.error("Failed delete product:", err);
    }
  };

  const handleAddCategory = async (category: Partial<Category>) => {
    try {
      const response = await fetch("/api/menu/categories", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(category),
      });
      if (response.ok) {
        const data = normalizeCategory(await response.json());
        setCategories((prev) => [...prev, data].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      } else {
        const data = await response.json().catch(() => null);
        window.alert(data?.error || t("menu.saveCategoryFailed"));
      }
    } catch (err) {
      console.error("Failed adding category:", err);
    }
  };

  const handleUpdateCategory = async (id: string, updated: Partial<Category>) => {
    try {
      const response = await fetch(`/api/menu/categories/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(updated),
      });
      if (response.ok) {
        const data = normalizeCategory(await response.json());
        setCategories((prev) => prev.map((category) => (category.id === id ? data : category)));
      } else {
        const data = await response.json().catch(() => null);
        window.alert(data?.error || t("menu.saveCategoryFailed"));
      }
    } catch (err) {
      console.error("Failed update category:", err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/menu/categories/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (response.ok) {
        setCategories((prev) => prev.filter((category) => category.id !== id));
      } else {
        const data = await response.json().catch(() => null);
        window.alert(
          data?.activeItemCount
            ? t("menu.deleteCategoryBlocked").replace("{count}", String(data.activeItemCount))
            : data?.error || t("menu.deleteCategoryFailed")
        );
      }
    } catch (err) {
      console.error("Failed delete category:", err);
    }
  };

  const handleSelectPrintOrder = (order: Order) => {
    setSelectedOrderToPrint(order);
    setActiveTab("hardware");
  };

  const adminRole = user ? t(`app.role.${user.role}`) : "";

  return (
    <div dir={dir} className="min-h-screen bg-slate-50 flex flex-col font-sans text-neutral-800">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-xl border-b-4 border-orange-500 z-30 select-none">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            {restaurantInfo?.logo ? (
              <img src={restaurantInfo.logo} alt={restaurantInfo.name} className="w-12 h-12 rounded-xl object-cover shadow-lg ring-2 ring-white/20 transform rotate-[-2deg] hover:rotate-[6deg] transition duration-200" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xl shadow-lg ring-2 ring-white/20 transform rotate-[-2deg] select-none hover:rotate-[6deg] transition duration-200">
                🌯
              </div>
            )}
            <div className="leading-snug text-center sm:text-left">
              <h1 className="text-lg sm:text-xl font-serif font-bold tracking-tight flex items-center justify-center sm:justify-start gap-2">
                {restaurantInfo?.name || "MR. Tabboush"}
                <span className="text-xs bg-orange-500 text-white px-2.5 py-0.5 rounded-full font-sans tracking-wide">{t("app.system")}</span>
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                {t("app.subtitle")}
              </p>
            </div>
          </div>

          {/* Status + User */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Socket.io status */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
              <Zap size={14} className={socketConnected ? "text-green-400" : "text-red-400"} />
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                {socketConnected ? t("app.live") : t("app.polling")}
              </span>
            </div>

            {/* Gemini API Indicator */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-1.5">
              <Activity size={14} className={geminiStatus ? "text-green-400 animate-pulse" : "text-orange-400 animate-pulse"} />
              <div className="text-left leading-none">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{t("app.nlpAgent")}</span>
                <span className="text-xs font-semibold text-white">
                  {geminiStatus ? t("app.geminiActive") : t("app.localSimulator")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1" title={t("app.language")}>
              {(["de", "ar", "en"] as AppLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`h-7 min-w-8 px-2 rounded-lg text-[10px] font-bold uppercase transition ${
                    language === lang
                      ? "bg-orange-500 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* User + Logout */}
            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right text-xs leading-tight text-slate-400">
                  <span className="font-bold text-white">{user.name}</span>
                  <span className="capitalize">{adminRole}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition"
                  title={t("app.signOut")}
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

            <div className="hidden md:flex flex-col text-right text-xs leading-tight text-slate-400">
              <span className="font-bold text-white">{branchInfo?.address || "Berliner Str. 179"}</span>
              <span>{branchInfo?.city || t("app.addressLine")}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 ${showSimulator ? "lg:grid-cols-12" : "lg:grid-cols-1"} gap-6 pb-12`}>
        {/* Left column: Smartphone simulator */}
        {showSimulator && (
        <div className="lg:col-span-4 flex flex-col">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-gray-200">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                <Languages size={15} />
                {t("app.whatsappSimulator")}
              </h2>
              <span className="text-[10px] text-gray-400 font-serif italic">{t("app.simulatorHint")}</span>
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
              restaurantName={restaurantInfo?.name || "MR. Tabboush"}
            />

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-950 leading-relaxed shadow-sm">
              <h5 className="font-bold flex items-center gap-1 mb-1 text-orange-950">
                <HelpCircle size={13} />
                {t("app.testGuide")}
              </h5>
              <p>{t("app.testGuideText")}</p>
            </div>
          </div>
        </div>
        )}

        {/* Right column: Admin dashboards */}
        <div className={`${showSimulator ? "lg:col-span-8" : ""} flex flex-col gap-5`}>
          {/* Tab triggers */}
          <div className="flex flex-wrap border-b border-gray-200 gap-1 select-none">
            {visibleTabs.map(({ id, labelKey, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl flex items-center gap-2 transition cursor-pointer relative ${
                  activeTab === id
                    ? "bg-white border-t-2 border-orange-500 text-orange-700 font-semibold shadow-sm"
                    : "text-gray-500 hover:text-orange-600 hover:bg-neutral-100"
                }`}
              >
                <Icon size={14} />
                {t(labelKey)}
                {id === "orders" && orders.filter((o) => o.status === "received").length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute top-1 right-2"></span>
                )}
              </button>
            ))}
          </div>

          {/* Dynamic Tab Panels */}
          <div className="flex-1 min-h-[500px]">
            {isLoading ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center flex flex-col items-center justify-center gap-2 shadow-sm">
                <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
                <span className="text-xs text-gray-500 font-medium">{t("app.loading")}</span>
              </div>
            ) : (
              <>
                {activeTab === "overview" && (
                  <DashboardOverview currencySymbol={currencySymbol} />
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
                    onDeleteItem={handleDeleteMenuItem}
                    onAddCategory={handleAddCategory}
                    onUpdateCategory={handleUpdateCategory}
                    onDeleteCategory={handleDeleteCategory}
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

                {activeTab === "settings" && <BranchSettings />}

                {activeTab === "restaurant" && <RestaurantSettings />}

                {activeTab === "users" && <UserManagement />}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-gray-400 py-6 border-t border-neutral-800 text-center text-xs mt-auto">
        <p>{t("app.footer")}</p>
        <p className="text-[10px] text-gray-600 mt-1">{t("app.poweredBy")}</p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------
// Root App with Auth Provider
// ------------------------------------------------------------------
export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </I18nProvider>
  );
}

function AppWithAuth() {
  const { user, isLoading } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const tableNumber = searchParams.get("table");
  const branchId = searchParams.get("branch") || "";

  if (tableNumber) {
    return <SmartMenu tableNumber={tableNumber} branchId={branchId} />;
  }

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
