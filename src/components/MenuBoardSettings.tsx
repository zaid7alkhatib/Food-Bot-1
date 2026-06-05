import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { MenuBoardSettings as MenuBoardSettingsType, Category, Translation } from "../types";
import { useI18n } from "../i18n";

type BranchRecord = {
  _id: string;
  name: string;
  menuBoardSettings?: Partial<MenuBoardSettingsType>;
};

const emptyTranslation = (): Translation => ({ ar: "", de: "", en: "" });

const defaultSettings = (): MenuBoardSettingsType => ({
  enabled: false,
  languageMode: "rotate",
  fixedLanguage: "de",
  rotationSeconds: 15,
  tickerEnabled: false,
  tickerText: emptyTranslation(),
  layouts: [
    {
      screenId: "1",
      name: "Main Screen",
      categoryIds: [],
      orientation: "landscape",
      template: "grid",
      isActive: true,
    },
  ],
  promoSlides: [],
});

function normalizeTranslation(value: any): Translation {
  if (!value || typeof value !== "object") return emptyTranslation();
  return {
    ar: value.ar || "",
    de: value.de || "",
    en: value.en || "",
  };
}

function normalizeSettings(value?: Partial<MenuBoardSettingsType>): MenuBoardSettingsType {
  const base = defaultSettings();
  return {
    ...base,
    ...value,
    tickerText: normalizeTranslation(value?.tickerText),
    layouts: (value?.layouts || base.layouts).map((layout, index) => ({
      screenId: layout.screenId || String(index + 1),
      name: layout.name || `Screen ${index + 1}`,
      categoryIds: (layout.categoryIds || []).map((id) => String(id)),
      orientation: layout.orientation === "portrait" ? "portrait" : "landscape",
      template: layout.template || "grid",
      isActive: layout.isActive !== false,
    })),
    promoSlides: (value?.promoSlides || []).map((slide, index) => ({
      id: slide.id || `promo-${Date.now()}-${index}`,
      title: normalizeTranslation(slide.title),
      imageUrl: slide.imageUrl || "",
      priceText: normalizeTranslation(slide.priceText),
      screenIds: (slide.screenIds || []).map((id) => String(id)),
      isActive: slide.isActive !== false,
      sortOrder: Number(slide.sortOrder || index + 1),
    })),
  };
}

export default function MenuBoardSettings() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [settings, setSettings] = useState<MenuBoardSettingsType>(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [branchesRes, categoriesRes] = await Promise.all([
          fetch("/api/branches", { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          fetch("/api/menu/categories", { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        ]);

        const branchData = branchesRes.ok ? await branchesRes.json() : [];
        const categoryData = categoriesRes.ok ? await categoriesRes.json() : [];

        setBranches(branchData || []);
        setCategories((categoryData || []).map((cat: any) => ({ ...cat, id: String(cat.id || cat._id || "") })));

        if ((branchData || []).length > 0) {
          const first = branchData[0];
          setSelectedBranchId(first._id);
          setSettings(normalizeSettings(first.menuBoardSettings));
        }
      } catch (err) {
        console.error("Failed to load menu board settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const selectedBranch = branches.find((b) => b._id === selectedBranchId) || null;

  const updateSettings = (patch: Partial<MenuBoardSettingsType>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateLayout = (index: number, patch: Partial<MenuBoardSettingsType["layouts"][number]>) => {
    setSettings((prev) => ({
      ...prev,
      layouts: prev.layouts.map((layout, i) => (i === index ? { ...layout, ...patch } : layout)),
    }));
  };

  const updateSlide = (index: number, patch: Partial<MenuBoardSettingsType["promoSlides"][number]>) => {
    setSettings((prev) => ({
      ...prev,
      promoSlides: prev.promoSlides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)),
    }));
  };

  const openScreenUrl = (screenId: string, language?: MenuBoardSettingsType["fixedLanguage"]) => {
    const url = buildScreenUrl(screenId, language);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const buildScreenUrl = (screenId: string, language?: MenuBoardSettingsType["fixedLanguage"]) => {
    const params = new URLSearchParams();
    params.set("branchId", selectedBranchId);
    params.set("screen", screenId.trim());
    if (language) params.set("lang", language);
    return `${window.location.origin}/menu-board?${params.toString()}`;
  };

  const copyScreenUrl = async (screenId: string, language?: MenuBoardSettingsType["fixedLanguage"]) => {
    const url = buildScreenUrl(screenId, language);
    const key = `${screenId}-${language || "auto"}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1800);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      window.alert(t("menuBoard.copyFailed"));
    }
  };

  const isLikelyImageUrl = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return true;

    const hasValidPrefix = /^https?:\/\//i.test(trimmed);
    const hasImageExt = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(trimmed);
    const allowsCdnStyle = /[?&](format|fm|auto)=/i.test(trimmed) || /images\.unsplash\.com/i.test(trimmed);

    return hasValidPrefix && (hasImageExt || allowsCdnStyle);
  };

  const validateSettings = (): string | null => {
    const minRotation = 5;
    const maxRotation = 120;
    const normalizedRotation = Number(settings.rotationSeconds);

    if (!Number.isFinite(normalizedRotation) || normalizedRotation < minRotation || normalizedRotation > maxRotation) {
      return t("menuBoard.validation.rotationRange", { min: minRotation, max: maxRotation });
    }

    const ids = settings.layouts.map((layout) => layout.screenId.trim()).filter(Boolean);
    if (ids.length !== settings.layouts.length) {
      return t("menuBoard.validation.screenRequired");
    }

    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      return t("menuBoard.validation.screenUnique");
    }

    for (let i = 0; i < settings.promoSlides.length; i += 1) {
      const imageUrl = settings.promoSlides[i].imageUrl || "";
      if (!isLikelyImageUrl(imageUrl)) {
        return t("menuBoard.validation.promoImage", { index: i + 1 });
      }
    }

    return null;
  };

  const save = async () => {
    if (!selectedBranchId) return;

    const validationError = validateSettings();
    if (validationError) {
      window.alert(validationError);
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch(`/api/branches/${selectedBranchId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ menuBoardSettings: settings }),
      });
      if (response.ok) {
        const updated = await response.json();
        setBranches((prev) => prev.map((branch) => (branch._id === selectedBranchId ? updated : branch)));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error("Failed to save menu board settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
        <span className="text-xs text-gray-500">{t("menuBoard.loading")}</span>
      </div>
    );
  }

  if (!selectedBranch) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-500">
        {t("menuBoard.noBranch")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("menuBoard.title")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t("menuBoard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={14} />
              {t("common.saved")}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {t("common.saveChanges")}
          </button>
        </div>
      </div>

      {branches.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">{t("branch.select")}</label>
          <select
            value={selectedBranchId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedBranchId(id);
              const branch = branches.find((candidate) => candidate._id === id);
              setSettings(normalizeSettings(branch?.menuBoardSettings));
            }}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
          >
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            {t("menuBoard.enable")}
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={settings.tickerEnabled}
              onChange={(e) => updateSettings({ tickerEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            {t("menuBoard.enableTicker")}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("menuBoard.languageMode")}</label>
            <select
              value={settings.languageMode}
              onChange={(e) => updateSettings({ languageMode: e.target.value as MenuBoardSettingsType["languageMode"] })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
            >
              <option value="rotate">{t("menuBoard.language.rotate")}</option>
              <option value="bilingual">{t("menuBoard.language.bilingual")}</option>
              <option value="fixed">{t("menuBoard.language.fixed")}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("menuBoard.fixedLanguage")}</label>
            <select
              value={settings.fixedLanguage}
              onChange={(e) => updateSettings({ fixedLanguage: e.target.value as MenuBoardSettingsType["fixedLanguage"] })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
            >
              <option value="de">{t("common.language.de")}</option>
              <option value="ar">{t("common.language.ar")}</option>
              <option value="en">{t("common.language.en")}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("menuBoard.rotationSeconds")}</label>
            <input
              type="number"
              min={5}
              value={settings.rotationSeconds}
              onChange={(e) => updateSettings({ rotationSeconds: Math.max(5, Number(e.target.value) || 15) })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("menuBoard.tickerText")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["de", "ar", "en"] as const).map((lang) => (
            <input
              key={lang}
              type="text"
              placeholder={`Ticker (${lang.toUpperCase()})`}
              value={settings.tickerText[lang] || ""}
              onChange={(e) => updateSettings({ tickerText: { ...settings.tickerText, [lang]: e.target.value } })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
            />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("menuBoard.screenLayouts")}</h4>
          <button
            type="button"
            onClick={() => updateSettings({
              layouts: [
                ...settings.layouts,
                {
                  screenId: String(settings.layouts.length + 1),
                  name: `Screen ${settings.layouts.length + 1}`,
                  categoryIds: [],
                  orientation: "landscape",
                  template: "grid",
                  isActive: true,
                },
              ],
            })}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 font-semibold flex items-center gap-1"
          >
            <Plus size={12} /> {t("menuBoard.addScreen")}
          </button>
        </div>

        {settings.layouts.map((layout, index) => (
          <div key={`${layout.screenId}-${index}`} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={layout.screenId}
                onChange={(e) => updateLayout(index, { screenId: e.target.value })}
                placeholder={t("menuBoard.placeholder.screenId")}
                className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
              />
              <input
                type="text"
                value={layout.name || ""}
                onChange={(e) => updateLayout(index, { name: e.target.value })}
                placeholder={t("common.name")}
                className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
              />
              <select
                value={layout.template}
                onChange={(e) => updateLayout(index, { template: e.target.value as any })}
                className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
              >
                <option value="grid">{t("menuBoard.template.grid")}</option>
                <option value="split">{t("menuBoard.template.split")}</option>
                <option value="highlights">{t("menuBoard.template.highlights")}</option>
              </select>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={layout.isActive !== false}
                    onChange={(e) => updateLayout(index, { isActive: e.target.checked })}
                  />
                  {t("common.active")}
                </label>
                <button
                  type="button"
                  onClick={() => updateSettings({ layouts: settings.layouts.filter((_, i) => i !== index) })}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 size={12} /> {t("common.remove")}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openScreenUrl(layout.screenId)}
                disabled={!layout.screenId.trim()}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold disabled:opacity-40"
              >
                {t("menuBoard.openScreenUrl")}
              </button>
              <button
                type="button"
                onClick={() => copyScreenUrl(layout.screenId)}
                disabled={!layout.screenId.trim()}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold disabled:opacity-40"
              >
                {copiedKey === `${layout.screenId}-auto` ? t("menuBoard.copied") : t("menuBoard.copyScreenUrl")}
              </button>
              <button
                type="button"
                onClick={() => openScreenUrl(layout.screenId, settings.fixedLanguage)}
                disabled={!layout.screenId.trim()}
                className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold disabled:opacity-40"
              >
                {t("menuBoard.openFixedUrl")}
              </button>
              <button
                type="button"
                onClick={() => copyScreenUrl(layout.screenId, settings.fixedLanguage)}
                disabled={!layout.screenId.trim()}
                className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold disabled:opacity-40"
              >
                {copiedKey === `${layout.screenId}-${settings.fixedLanguage}` ? t("menuBoard.copied") : t("menuBoard.copyFixedUrl")}
              </button>
            </div>

            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">{t("menuBoard.visibleCategories")}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-40 overflow-auto pr-1">
                {categories.map((category) => {
                  const checked = layout.categoryIds.includes(category.id);
                  return (
                    <label key={category.id} className="text-xs flex items-center gap-2 border border-gray-100 rounded-md px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...layout.categoryIds, category.id]
                            : layout.categoryIds.filter((id) => id !== category.id);
                          updateLayout(index, { categoryIds: next });
                        }}
                      />
                      {category.name?.de || category.name?.en || category.name?.ar || "Category"}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("menuBoard.promoSlides")}</h4>
          <button
            type="button"
            onClick={() => updateSettings({
              promoSlides: [
                ...settings.promoSlides,
                {
                  id: `promo-${Date.now().toString(36)}`,
                  title: emptyTranslation(),
                  imageUrl: "",
                  priceText: emptyTranslation(),
                  screenIds: [],
                  isActive: true,
                  sortOrder: settings.promoSlides.length + 1,
                },
              ],
            })}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 font-semibold flex items-center gap-1"
          >
            <Plus size={12} /> {t("menuBoard.addSlide")}
          </button>
        </div>

        {settings.promoSlides.length === 0 && (
          <p className="text-xs text-gray-500">{t("menuBoard.noSlides")}</p>
        )}

        {settings.promoSlides.map((slide, index) => (
          <div key={slide.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-600 uppercase">{t("menuBoard.slide", { index: index + 1 })}</p>
              <button
                type="button"
                onClick={() => updateSettings({ promoSlides: settings.promoSlides.filter((_, i) => i !== index) })}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={12} /> {t("common.remove")}
              </button>
            </div>

            <input
              type="text"
              placeholder={t("menu.imageUrl")}
              value={slide.imageUrl}
              onChange={(e) => updateSlide(index, { imageUrl: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["de", "ar", "en"] as const).map((lang) => (
                <input
                  key={`title-${lang}`}
                  type="text"
                  placeholder={`${t("campaign.title")} (${lang.toUpperCase()})`}
                  value={slide.title[lang] || ""}
                  onChange={(e) => updateSlide(index, { title: { ...slide.title, [lang]: e.target.value } })}
                  className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["de", "ar", "en"] as const).map((lang) => (
                <input
                  key={`price-${lang}`}
                  type="text"
                  placeholder={`${t("common.price")} (${lang.toUpperCase()})`}
                  value={slide.priceText[lang] || ""}
                  onChange={(e) => updateSlide(index, { priceText: { ...slide.priceText, [lang]: e.target.value } })}
                  className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={slide.screenIds.join(",")}
                onChange={(e) => updateSlide(index, { screenIds: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                placeholder={t("menuBoard.placeholder.screenIds")}
                className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
              />
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={slide.isActive !== false}
                  onChange={(e) => updateSlide(index, { isActive: e.target.checked })}
                />
                {t("common.active")}
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
