import React, { useState, useEffect } from "react";
import { Building2, Globe, Coins, MessageCircle, Save, Loader2, CheckCircle2, Link2 } from "lucide-react";
import { useI18n } from "../i18n";

interface Restaurant {
  _id: string;
  name: string;
  legalName?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  phone: string;
  whatsappNumber: string;
  email?: string;
  address?: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultCurrency: string;
  timezone: string;
  googleMapsReviewLink?: string;
  taxVatRate?: number;
  orderPrefix?: string;
  heroTagline?: { ar: string; de: string; en: string };
  heroBannerImage?: string;
  aboutText?: { ar: string; de: string; en: string };
  socialInstagram?: string;
  socialFacebook?: string;
  socialTikTok?: string;
  geminiEnabled?: boolean;
}

export default function RestaurantSettings() {
  const { t } = useI18n();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchRestaurant();
  }, []);

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
      console.error("Failed to load restaurant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/settings/restaurant/${restaurant._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(restaurant),
      });
      if (res.ok) {
        const updated = await res.json();
        setRestaurant(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save restaurant:", err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Restaurant, value: any) => {
    if (!restaurant) return;
    setRestaurant({ ...restaurant, [field]: value });
  };

  const updateNestedField = (field: "heroTagline" | "aboutText", lang: "ar" | "de" | "en", value: string) => {
    if (!restaurant) return;
    const current = restaurant[field] || { ar: "", de: "", en: "" };
    setRestaurant({
      ...restaurant,
      [field]: {
        ...current,
        [lang]: value,
      },
    });
  };

  const toggleLanguage = (lang: string) => {
    if (!restaurant) return;
    const current = restaurant.supportedLanguages || [];
    if (current.includes(lang)) {
      updateField("supportedLanguages", current.filter((l) => l !== lang));
    } else {
      updateField("supportedLanguages", [...current, lang]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
        <span className="text-xs text-gray-500">{t("restaurant.loading")}</span>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t("restaurant.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("restaurant.title")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t("restaurant.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={14} />
              {t("common.saved")}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {t("common.saveChanges")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-orange-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("restaurant.brand")}</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.restaurantName")}</label>
            <input
              type="text"
              value={restaurant.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.legalName")}</label>
            <input
              type="text"
              value={restaurant.legalName || ""}
              onChange={(e) => updateField("legalName", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Order Prefix (e.g., TAB, PIZ, BURG)</label>
            <input
              type="text"
              value={restaurant.orderPrefix || ""}
              onChange={(e) => updateField("orderPrefix", e.target.value.toUpperCase())}
              placeholder="TAB"
              maxLength={5}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.logoUrl")}</label>
            <input
              type="text"
              value={restaurant.logo || ""}
              onChange={(e) => updateField("logo", e.target.value)}
              placeholder="https://..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.primaryColor")}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={restaurant.primaryColor || "#ea580c"}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="w-10 h-9 p-0 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden shrink-0"
                />
                <input
                  type="text"
                  value={restaurant.primaryColor || "#ea580c"}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  maxLength={7}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 font-mono uppercase"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.secondaryColor")}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={restaurant.secondaryColor || "#1f2937"}
                  onChange={(e) => updateField("secondaryColor", e.target.value)}
                  className="w-10 h-9 p-0 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden shrink-0"
                />
                <input
                  type="text"
                  value={restaurant.secondaryColor || "#1f2937"}
                  onChange={(e) => updateField("secondaryColor", e.target.value)}
                  maxLength={7}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 font-mono uppercase"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.phone")}</label>
              <input
                type="text"
                value={restaurant.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.whatsapp")}</label>
              <input
                type="text"
                value={restaurant.whatsappNumber}
                onChange={(e) => updateField("whatsappNumber", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.email")}</label>
            <input
              type="email"
              value={restaurant.email || ""}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.address")}</label>
            <input
              type="text"
              value={restaurant.address || ""}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Localization */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={16} className="text-blue-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("restaurant.localization")}</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.defaultLanguage")}</label>
            <select
              value={restaurant.defaultLanguage}
              onChange={(e) => updateField("defaultLanguage", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="de">{t("common.language.de")} (de)</option>
              <option value="ar">{t("common.language.ar")} (ar)</option>
              <option value="en">{t("common.language.en")} (en)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("restaurant.supportedLanguages")}</label>
            <div className="flex gap-2">
              {["ar", "de", "en"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                    restaurant.supportedLanguages?.includes(lang)
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.timezone")}</label>
            <input
              type="text"
              value={restaurant.timezone}
              onChange={(e) => updateField("timezone", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.currency")}</label>
            <select
              value={restaurant.defaultCurrency}
              onChange={(e) => updateField("defaultCurrency", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="EUR">Euro (€)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="GBP">British Pound (£)</option>
              <option value="SAR">Saudi Riyal (﷼)</option>
            </select>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={16} className="text-purple-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("restaurant.integrations")}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                {t("restaurant.reviewLink")}
              </label>
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className="text-gray-400" />
                <input
                  type="url"
                  value={restaurant.googleMapsReviewLink || ""}
                  onChange={(e) => updateField("googleMapsReviewLink", e.target.value)}
                  placeholder="https://g.page/..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {t("restaurant.reviewHint")}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                {t("common.taxVat")}
              </label>
              <div className="flex items-center gap-2">
                <Coins size={14} className="text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  value={restaurant.taxVatRate || 0}
                  onChange={(e) => updateField("taxVatRate", parseFloat(e.target.value))}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {t("restaurant.taxHint")}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              Gemini AI Chatbot
            </label>
            <div className="flex items-start gap-2.5 mt-2">
              <input
                type="checkbox"
                id="geminiEnabled"
                checked={restaurant.geminiEnabled !== false}
                onChange={(e) => updateField("geminiEnabled", e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-4 w-4 shrink-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <label htmlFor="geminiEnabled" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                  {t("restaurant.geminiEnabled")}
                </label>
                <p className="text-[10px] text-gray-400">
                  When enabled, incoming WhatsApp messages will be processed dynamically using Gemini AI. When disabled, the bot will follow the standard, rule-based chatbot menus and flows.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Website Settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={16} className="text-orange-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Public Brand Website Settings</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Media & Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Hero Banner Image URL</label>
                <input
                  type="text"
                  value={restaurant.heroBannerImage || ""}
                  onChange={(e) => updateField("heroBannerImage", e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-gray-500 uppercase -mb-1">Hero Tagline</label>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">German (DE)</span>
                  <input
                    type="text"
                    value={restaurant.heroTagline?.de || ""}
                    onChange={(e) => updateNestedField("heroTagline", "de", e.target.value)}
                    placeholder="Feine syrische Küche"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 mt-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Arabic (AR)</span>
                  <input
                    type="text"
                    value={restaurant.heroTagline?.ar || ""}
                    onChange={(e) => updateNestedField("heroTagline", "ar", e.target.value)}
                    placeholder="أشهى المأكولات الشامية"
                    dir="rtl"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 mt-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">English (EN)</span>
                  <input
                    type="text"
                    value={restaurant.heroTagline?.en || ""}
                    onChange={(e) => updateNestedField("heroTagline", "en", e.target.value)}
                    placeholder="Delicious Syrian Cuisine"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Instagram Link</label>
                  <input
                    type="url"
                    value={restaurant.socialInstagram || ""}
                    onChange={(e) => updateField("socialInstagram", e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Facebook Link</label>
                  <input
                    type="url"
                    value={restaurant.socialFacebook || ""}
                    onChange={(e) => updateField("socialFacebook", e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">TikTok Link</label>
                  <input
                    type="url"
                    value={restaurant.socialTikTok || ""}
                    onChange={(e) => updateField("socialTikTok", e.target.value)}
                    placeholder="https://tiktok.com/..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: About Narrative */}
            <div className="space-y-4">
              <label className="block text-[11px] font-bold text-gray-500 uppercase -mb-1">About Narrative Text</label>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">German (DE)</span>
                <textarea
                  value={restaurant.aboutText?.de || ""}
                  onChange={(e) => updateNestedField("aboutText", "de", e.target.value)}
                  placeholder="Wir bringen Ihnen..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 mt-1 resize-y"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Arabic (AR)</span>
                <textarea
                  value={restaurant.aboutText?.ar || ""}
                  onChange={(e) => updateNestedField("aboutText", "ar", e.target.value)}
                  placeholder="نقدم لكم..."
                  rows={3}
                  dir="rtl"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 mt-1 resize-y"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">English (EN)</span>
                <textarea
                  value={restaurant.aboutText?.en || ""}
                  onChange={(e) => updateNestedField("aboutText", "en", e.target.value)}
                  placeholder="We bring you..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 mt-1 resize-y"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
