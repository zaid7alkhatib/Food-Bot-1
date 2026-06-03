import React, { useState, useEffect } from "react";
import { Building2, Globe, Coins, MessageCircle, Save, Loader2, CheckCircle2, Link2 } from "lucide-react";

interface Restaurant {
  _id: string;
  name: string;
  legalName?: string;
  logo?: string;
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
}

export default function RestaurantSettings() {
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
        <span className="text-xs text-gray-500">Loading restaurant settings...</span>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No restaurant found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Restaurant Settings</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage brand, language, currency, and review links</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={14} />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-orange-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Brand Identity</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Restaurant Name</label>
            <input
              type="text"
              value={restaurant.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Legal Name</label>
            <input
              type="text"
              value={restaurant.legalName || ""}
              onChange={(e) => updateField("legalName", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Phone</label>
              <input
                type="text"
                value={restaurant.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">WhatsApp</label>
              <input
                type="text"
                value={restaurant.whatsappNumber}
                onChange={(e) => updateField("whatsappNumber", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Email</label>
            <input
              type="email"
              value={restaurant.email || ""}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Address</label>
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
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Localization</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Default Language</label>
            <select
              value={restaurant.defaultLanguage}
              onChange={(e) => updateField("defaultLanguage", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="de">German (de)</option>
              <option value="ar">Arabic (ar)</option>
              <option value="en">English (en)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Supported Languages</label>
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
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Timezone</label>
            <input
              type="text"
              value={restaurant.timezone}
              onChange={(e) => updateField("timezone", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Currency</label>
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
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Integrations</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                Google Maps Review Link
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
                Sent to customers after 5-star feedback
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                Tax / VAT Rate (%)
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
                Applied to order totals (0 = no tax)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
