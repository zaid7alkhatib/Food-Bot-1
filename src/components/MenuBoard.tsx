import React, { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Category, MenuItem, Translation } from "../types";

type BoardLanguage = "ar" | "de" | "en";

type MenuBoardPayload = {
  screen: string;
  language: BoardLanguage;
  enabled: boolean;
  languageMode: "fixed" | "rotate" | "bilingual";
  fixedLanguage: BoardLanguage;
  rotationSeconds: number;
  tickerEnabled: boolean;
  tickerText: Translation;
  layout?: {
    name?: string;
    template?: "grid" | "split" | "highlights";
    orientation?: "landscape" | "portrait";
  } | null;
  promoSlides: {
    id: string;
    title: Translation;
    imageUrl: string;
    priceText: Translation;
  }[];
};

function text(value: any, lang: BoardLanguage): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.de || value.en || value.ar || "";
}

function normalizeCategory(raw: any): Category {
  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
  };
}

function normalizeItem(raw: any): MenuItem {
  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
    categoryId: raw.categoryId?.toString?.() || raw.categoryId,
  };
}

const boardLabels: Record<BoardLanguage, Record<string, string>> = {
  de: {
    screen: "Bildschirm",
    title: "Digitales Menü-Board",
    disabled: "Das Menü-Board ist für diese Filiale derzeit deaktiviert. Aktivieren Sie es in den Menü-Board Einstellungen.",
    soldOut: "Ausverkauft",
    noPromoImage: "Kein Promo-Bild",
  },
  ar: {
    screen: "الشاشة",
    title: "لوحة قائمة رقمية",
    disabled: "شاشة القائمة معطلة حاليا لهذا الفرع. يرجى تفعيلها من إعدادات شاشة القائمة.",
    soldOut: "غير متوفر",
    noPromoImage: "لا توجد صورة عرض",
  },
  en: {
    screen: "Screen",
    title: "Digital Menu Board",
    disabled: "Menu board is currently disabled for this branch. Enable it from Menu Board settings.",
    soldOut: "Sold Out",
    noPromoImage: "No promo image",
  },
};

export default function MenuBoard() {
  const params = new URLSearchParams(window.location.search);
  const branchId = params.get("branchId") || params.get("branch") || "";
  const screen = params.get("screen") || "1";
  const langParam = params.get("lang");

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [board, setBoard] = useState<MenuBoardPayload | null>(null);
  const [restaurantName, setRestaurantName] = useState("MR. Tabboush");
  const [branchName, setBranchName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [clock, setClock] = useState(() => new Date());
  const [rotationLang, setRotationLang] = useState<BoardLanguage>("de");
  const [activeSlide, setActiveSlide] = useState(0);
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    if (restaurant) {
      if (restaurant.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', restaurant.primaryColor);
      }
      if (restaurant.secondaryColor) {
        document.documentElement.style.setProperty('--brand-secondary', restaurant.secondaryColor);
      }
    }
  }, [restaurant]);

  const activeLang: BoardLanguage = useMemo(() => {
    if (!board) return "de";
    if (board.languageMode === "fixed") return board.fixedLanguage;
    if (board.languageMode === "rotate") return rotationLang;
    return (langParam === "ar" || langParam === "en" || langParam === "de" ? langParam : board.language) as BoardLanguage;
  }, [board, rotationLang, langParam]);

  const fetchBoard = async () => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    query.set("screen", screen);
    if (langParam) query.set("lang", langParam);

    const response = await fetch(`/api/public/menu-board?${query.toString()}`);
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    setRestaurant(data.restaurant || null);
    setRestaurantName(data.restaurant?.name || "MR. Tabboush");
    setBranchName(data.branch?.name || "");
    setCurrencySymbol(data.currency?.symbol || "€");
    setCategories((data.categories || []).map(normalizeCategory));
    setMenuItems((data.menuItems || []).map(normalizeItem));
    setBoard(data.menuBoard || null);
  };

  useEffect(() => {
    fetchBoard().catch((err) => console.error("Failed to load menu board:", err));
  }, [branchId, screen, langParam]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!board || board.languageMode !== "rotate") return;
    const step = Math.max(5, Number(board.rotationSeconds) || 15) * 1000;
    const langs: BoardLanguage[] = ["de", "ar", "en"];
    const rotate = setInterval(() => {
      setRotationLang((prev) => langs[(langs.indexOf(prev) + 1) % langs.length]);
    }, step);
    return () => clearInterval(rotate);
  }, [board]);

  useEffect(() => {
    const slides = board?.promoSlides || [];
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [board?.promoSlides]);

  useEffect(() => {
    const socket: Socket = io({ transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("join", "dashboard"));
    socket.on("menu:updated", () => fetchBoard().catch(() => {}));
    socket.on("branch:updated", () => fetchBoard().catch(() => {}));

    return () => socket.disconnect();
  }, [branchId, screen, langParam]);

  const grouped = useMemo(() => {
    return categories.map((cat) => ({
      category: cat,
      items: menuItems.filter((item) => String(item.categoryId) === String(cat.id)),
    })).filter((group) => group.items.length > 0);
  }, [categories, menuItems]);

  const currentSlide = (board?.promoSlides || [])[activeSlide] || null;

  const showBilingual = board?.languageMode === "bilingual";
  const labels = boardLabels[activeLang] || boardLabels.en;

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 text-white p-6 md:p-10 transition-colors"
      style={{
        background: `linear-gradient(135deg, #0a0a0a 0%, #171717 50%, ${restaurant?.primaryColor ? restaurant.primaryColor + '15' : '#ea580c15'} 100%)`
      }}
    >
      <div className="mx-auto max-w-[1800px] h-[calc(100vh-3rem)] flex flex-col gap-5">
        <header className="flex items-end justify-between border-b border-white/15 pb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">{restaurantName}</h1>
            <p className="text-lg md:text-2xl font-semibold text-brand-primary">
              {branchName ? `${branchName} • ` : ""}{labels.screen} {screen}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl md:text-4xl font-bold tabular-nums">{clock.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-sm text-white/70 uppercase tracking-wider">{labels.title}</p>
          </div>
        </header>

        {!board?.enabled && (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-5 py-4 text-yellow-100 text-lg">
            {labels.disabled}
          </div>
        )}

        <main className={`grid flex-1 min-h-0 gap-5 ${currentSlide ? "grid-cols-12" : "grid-cols-1"}`}>
          <section className={`${currentSlide ? "col-span-8" : "col-span-12"} rounded-3xl border border-white/10 bg-black/25 p-5 overflow-hidden`}>
            <div className="h-full overflow-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped.map(({ category, items }) => (
                  <article key={category.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h2 className="text-2xl md:text-3xl font-extrabold mb-3 text-brand-primary uppercase tracking-wide">
                      {text(category.name, activeLang)}
                      {showBilingual && <span className="block text-base md:text-lg text-white/75 normal-case">{text(category.name, "ar")}</span>}
                    </h2>
                    <div className="space-y-2.5">
                      {items.map((item) => {
                        const soldOut = item.isAvailableForDelivery === false && item.isAvailableForPickup === false;
                        return (
                          <div key={item.id} className={`rounded-xl px-3 py-2 border ${soldOut ? "border-red-300/50 bg-red-500/10" : "border-white/10 bg-black/25"}`}>
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-xl md:text-2xl font-bold leading-tight">
                                  {text(item.name, activeLang)}
                                </p>
                                {showBilingual && (
                                  <p className="text-sm md:text-base text-white/70 leading-tight mt-0.5">{text(item.name, "ar")}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xl md:text-2xl font-black text-brand-primary/90 whitespace-nowrap">{Number(item.basePrice || 0).toFixed(2)} {currencySymbol}</p>
                                {soldOut && <span className="text-xs md:text-sm uppercase font-bold text-red-200">{labels.soldOut}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {currentSlide && (
            <aside className="col-span-4 rounded-3xl border border-white/10 bg-black/25 p-4 flex flex-col min-h-0">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/35 flex-1">
                {currentSlide.imageUrl ? (
                  <img src={currentSlide.imageUrl} alt={text(currentSlide.title, activeLang)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/50 text-lg">{labels.noPromoImage}</div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent">
                  <p className="text-2xl font-black">{text(currentSlide.title, activeLang)}</p>
                  {showBilingual && <p className="text-sm text-white/75">{text(currentSlide.title, "ar")}</p>}
                  {text(currentSlide.priceText, activeLang) && (
                    <p className="text-3xl font-black text-brand-primary mt-1">{text(currentSlide.priceText, activeLang)}</p>
                  )}
                </div>
              </div>
            </aside>
          )}
        </main>

        {board?.tickerEnabled && text(board.tickerText, activeLang) && (
          <footer 
            className="rounded-xl border py-2 overflow-hidden"
            style={{
              borderColor: `${restaurant?.primaryColor || '#ea580c'}30`,
              backgroundColor: `${restaurant?.primaryColor || '#ea580c'}20`
            }}
          >
            <div className="whitespace-nowrap animate-[marquee_22s_linear_infinite] px-4 text-xl md:text-2xl font-bold text-orange-50">
              {text(board.tickerText, activeLang)}
            </div>
          </footer>
        )}
      </div>

      <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
    </div>
  );
}
