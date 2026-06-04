import React, { useEffect, useState } from "react";
import { Plus, Trash, Edit3, Languages, Save, ShoppingBag, FolderOpen, Image as ImageIcon } from "lucide-react";
import { MenuItem, Category, UpsellSuggestion } from "../types";
import { useI18n } from "../i18n";

interface MenuEditorProps {
  categories: Category[];
  menuItems: MenuItem[];
  onAddItem: (item: Partial<MenuItem>) => void;
  onUpdateItem: (id: string, updated: Partial<MenuItem>) => void;
  currencySymbol: string;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1561651823-34fed0225408?w=500&auto=format&fit=crop";

function emptyUpsellSuggestion(): UpsellSuggestion {
  return {
    id: `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    suggestedItemName: { ar: "", de: "", en: "" },
    suggestedItemId: "",
    price: 0,
    description: { ar: "", de: "", en: "" },
    isActive: true,
  };
}

function normalizeUpsellSuggestions(upsells: UpsellSuggestion[] = []): UpsellSuggestion[] {
  return upsells.map((upsell) => ({
    id: upsell.id || `up-${Math.random().toString(36).slice(2, 8)}`,
    suggestedItemName: {
      ar: upsell.suggestedItemName?.ar || "",
      de: upsell.suggestedItemName?.de || "",
      en: upsell.suggestedItemName?.en || "",
    },
    suggestedItemId: upsell.suggestedItemId || "",
    price: Number(upsell.price) || 0,
    description: upsell.description || { ar: "", de: "", en: "" },
    isActive: upsell.isActive !== false,
  }));
}

export default function MenuEditor({
  categories,
  menuItems,
  onAddItem,
  onUpdateItem,
  currencySymbol,
}: MenuEditorProps) {
  const { t, text } = useI18n();
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form Fields State
  const [nameAr, setNameAr] = useState("");
  const [nameDe, setNameDe] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descDe, setDescDe] = useState("");
  const [descEn, setDescEn] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [sku, setSku] = useState("");
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [prepMinutes, setPrepMinutes] = useState(10);
  const [upsellDrafts, setUpsellDrafts] = useState<UpsellSuggestion[]>([]);

  const [activeTranslationTab, setActiveTranslationTab] = useState<"de" | "ar" | "en">("de");

  useEffect(() => {
    if (!activeCategoryId && categories[0]?.id) {
      setActiveCategoryId(categories[0].id);
    }
  }, [activeCategoryId, categories]);

  const filteredItems = menuItems.filter((i) => i.categoryId === activeCategoryId);
  const selectableUpsellItems = menuItems.filter((item) => item.id !== editingItemId);

  const handleStartEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setNameAr(item.name.ar);
    setNameDe(item.name.de);
    setNameEn(item.name.en);
    setDescAr(item.description.ar);
    setDescDe(item.description.de);
    setDescEn(item.description.en);
    setBasePrice(item.basePrice);
    setSku(item.skucode);
    setIsBestSeller(item.isBestSeller);
    setImageUrl(item.image || "");
    setPrepMinutes(item.preparationTimeMinutes || 10);
    setUpsellDrafts(normalizeUpsellSuggestions(item.upsellSuggestions));
  };

  const handleSaveEdit = (id: string) => {
    onUpdateItem(id, {
      name: { ar: nameAr, de: nameDe, en: nameEn },
      description: { ar: descAr, de: descDe, en: descEn },
      basePrice: Number(basePrice),
      image: imageUrl.trim(),
      skucode: sku,
      preparationTimeMinutes: Number(prepMinutes) || 0,
      isBestSeller,
      upsellSuggestions: normalizeUpsellSuggestions(upsellDrafts).filter((upsell) => upsell.suggestedItemName.ar || upsell.suggestedItemName.de || upsell.suggestedItemName.en),
    });
    setEditingItemId(null);
  };

  const updateUpsellDraft = (index: number, patch: Partial<UpsellSuggestion>) => {
    setUpsellDrafts((prev) => prev.map((upsell, i) => i === index ? { ...upsell, ...patch } : upsell));
  };

  const updateUpsellName = (index: number, lang: "ar" | "de" | "en", value: string) => {
    setUpsellDrafts((prev) => prev.map((upsell, i) => i === index
      ? { ...upsell, suggestedItemName: { ...upsell.suggestedItemName, [lang]: value } }
      : upsell
    ));
  };

  const handleUpsellLinkedItemChange = (index: number, suggestedItemId: string) => {
    const linkedItem = menuItems.find((item) => item.id === suggestedItemId);
    setUpsellDrafts((prev) => prev.map((upsell, i) => {
      if (i !== index) return upsell;
      if (!linkedItem) return { ...upsell, suggestedItemId: "" };
      return {
        ...upsell,
        suggestedItemId,
        suggestedItemName: linkedItem.name,
        price: linkedItem.basePrice,
      };
    }));
  };

  const handleAddNewItem = () => {
    const defaultNew: Partial<MenuItem> = {
      categoryId: activeCategoryId,
      name: { ar: "شاورما جديدة", de: "Neues Shawarma", en: "New Shawarma" },
      description: {
        ar: "تفاصيل الساندويتش اللذيذ",
        de: "Leckerer neuer Shawarma Wrap",
        en: "Tasty classic new custom wrapper",
      },
      basePrice: 5.90,
      image: "https://images.unsplash.com/photo-1561651823-34fed0225408?w=500&auto=format&fit=crop",
      skucode: "SHW-NEW-" + Math.floor(Math.random() * 100),
      preparationTimeMinutes: 8,
      modifierGroups: [],
      upsellSuggestions: [],
    };
    onAddItem(defaultNew);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">
      
      {/* Category filters sidebar list */}
      <div className="md:col-span-3 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center gap-1.5">
          <FolderOpen size={16} className="text-orange-500" />
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">{t("menu.categories")}</h3>
        </div>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategoryId(cat.id);
              setEditingItemId(null);
            }}
            className={`w-full p-3 px-4 text-left font-serif text-sm font-medium transition flex items-center justify-between ${
              activeCategoryId === cat.id
                ? "bg-orange-50 text-orange-900 border-l-4 border-orange-500 font-bold"
                : "text-gray-600 hover:bg-neutral-50/50"
            }`}
          >
            {text(cat.name)}
            <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full font-mono">
              {menuItems.filter((i) => i.categoryId === cat.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Main product editing panel list representation */}
      <div className="md:col-span-9 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        
        {/* Header toolbar */}
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag size={15} className="text-neutral-500" />
            {t("menu.items")}
          </h3>
          <button
            onClick={handleAddNewItem}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition leading-none active:scale-95"
          >
            <Plus size={13} />
            {t("menu.addDish")}
          </button>
        </div>

        {/* List of dynamic items */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 divide-y divide-gray-100 divide-dashed">
          {filteredItems.length === 0 ? (
            <div className="text-center p-8 text-xs text-gray-400">
              {t("menu.empty")}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isEditing = editingItemId === item.id;
              const activeUpsells = (item.upsellSuggestions || []).filter((upsell) => upsell.isActive !== false);
              return (
                <div key={item.id} className="pt-4 first:pt-0 flex flex-col md:flex-row gap-4 items-start">
                  
                  {/* Product thumbnail visualization */}
                  <img
                    src={item.image || FALLBACK_IMAGE}
                    alt={item.name.en}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMAGE;
                    }}
                    className="w-20 h-20 rounded-lg object-cover border border-gray-100 shrink-0 shadow-sm"
                  />

                  {isEditing ? (
                    /* Inline comprehensive multi language editing screen representation */
                    <div className="flex-1 w-full space-y-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100 text-xs">
                      
                      {/* Language toggler headers labels */}
                      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                        <span className="font-bold text-neutral-800 flex items-center gap-1">
                          <Languages size={13} />
                          {t("menu.translationFields")}
                        </span>
                        
                        <div className="flex gap-1">
                          {(["de", "ar", "en"] as const).map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setActiveTranslationTab(lang)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                                activeTranslationTab === lang
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                              }`}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Translatable Inputs Fields */}
                      {activeTranslationTab === "ar" && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.nameAr")}:</label>
                            <input
                              type="text"
                              value={nameAr}
                              onChange={(e) => setNameAr(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.descAr")}:</label>
                            <textarea
                              rows={2}
                              value={descAr}
                              onChange={(e) => setDescAr(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                        </div>
                      )}

                      {activeTranslationTab === "de" && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.nameDe")}:</label>
                            <input
                              type="text"
                              value={nameDe}
                              onChange={(e) => setNameDe(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.descDe")}:</label>
                            <textarea
                              rows={2}
                              value={descDe}
                              onChange={(e) => setDescDe(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                        </div>
                      )}

                      {activeTranslationTab === "en" && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.nameEn")}:</label>
                            <input
                              type="text"
                              value={nameEn}
                              onChange={(e) => setNameEn(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.descEn")}:</label>
                            <textarea
                              rows={2}
                              value={descEn}
                              onChange={(e) => setDescEn(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                        </div>
                      )}

                      {/* Generic Numerical Fields */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-neutral-200">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("common.price")} ({currencySymbol}):</label>
                          <input
                            type="number"
                            step="0.1"
                            value={basePrice}
                            onChange={(e) => setBasePrice(Number(e.target.value))}
                            className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("common.sku")}:</label>
                          <input
                            type="text"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.prepMinutes")}:</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={prepMinutes}
                            onChange={(e) => setPrepMinutes(Number(e.target.value))}
                            className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-2 pt-3">
                          <input
                            type="checkbox"
                            id={`best-${item.id}`}
                            checked={isBestSeller}
                            onChange={(e) => setIsBestSeller(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`best-${item.id}`} className="font-bold text-neutral-700 select-none">
                            {t("menu.bestsellerFlag")} 🔥
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[88px_1fr] gap-3 pt-3 border-t border-neutral-200">
                        <img
                          src={imageUrl || item.image || FALLBACK_IMAGE}
                          alt={nameEn || item.name.en}
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMAGE;
                          }}
                          className="w-20 h-20 rounded-lg object-cover border border-neutral-200 bg-white"
                        />
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1 flex items-center gap-1">
                            <ImageIcon size={12} />
                            {t("menu.imageUrl")}
                          </label>
                          <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">{t("menu.imageHint")}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[11px] font-bold text-neutral-800 uppercase">{t("menu.suggestedExtras")}</h4>
                            <p className="text-[10px] text-gray-400">{t("menu.suggestedExtrasHint")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUpsellDrafts((prev) => [...prev, emptyUpsellSuggestion()])}
                            className="px-2 py-1 bg-white border border-neutral-200 hover:border-orange-400 text-neutral-700 rounded text-[10px] font-bold flex items-center gap-1"
                          >
                            <Plus size={11} />
                            {t("menu.addExtra")}
                          </button>
                        </div>

                        {upsellDrafts.length === 0 ? (
                          <div className="text-[11px] text-gray-400 bg-white border border-dashed border-neutral-200 rounded-lg p-3">
                            {t("menu.noExtras")}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {upsellDrafts.map((upsell, index) => (
                              <div key={upsell.id} className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="flex items-center gap-2 text-[11px] font-bold text-neutral-700">
                                    <input
                                      type="checkbox"
                                      checked={upsell.isActive}
                                      onChange={(e) => updateUpsellDraft(index, { isActive: e.target.checked })}
                                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                    />
                                    {t("menu.extraActive")}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => setUpsellDrafts((prev) => prev.filter((_, i) => i !== index))}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    aria-label={t("menu.removeExtra")}
                                  >
                                    <Trash size={13} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.linkedItem")}</label>
                                    <select
                                      value={upsell.suggestedItemId || ""}
                                      onChange={(e) => handleUpsellLinkedItemChange(index, e.target.value)}
                                      className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                                    >
                                      <option value="">{t("menu.customOffer")}</option>
                                      {selectableUpsellItems.map((candidate) => (
                                        <option key={candidate.id} value={candidate.id}>
                                          {text(candidate.name)} ({candidate.basePrice.toFixed(2)}{currencySymbol})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.extraName")}</label>
                                    <input
                                      type="text"
                                      value={upsell.suggestedItemName[activeTranslationTab] || ""}
                                      onChange={(e) => updateUpsellName(index, activeTranslationTab, e.target.value)}
                                      className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.extraPrice")} ({currencySymbol})</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={upsell.price}
                                      onChange={(e) => updateUpsellDraft(index, { price: Number(e.target.value) })}
                                      className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Control buttons */}
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="px-3 py-1.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 rounded text-xs font-semibold"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1"
                        >
                          <Save size={12} />
                          {t("menu.save")}
                        </button>
                      </div>

                    </div>
                  ) : (
                    /* General display mode */
                    <div className="flex-1 flex flex-col md:flex-row items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif text-sm font-bold text-gray-950">
                            {text(item.name)} | {item.name.ar}
                          </h4>
                          {item.isBestSeller && (
                            <span className="bg-orange-100 text-orange-850 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                              🔥 {t("common.bestseller")}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 leading-normal max-w-lg">
                          {text(item.description)} 
                          <span className="block text-gray-400 italic text-[11px] mt-0.5">"{item.description.ar}"</span>
                        </p>

                        <div className="flex gap-4 text-[10px] text-gray-400 font-mono pt-1">
                          <span>SKU: {item.skucode}</span>
                          <span>{t("common.prep")}: {item.preparationTimeMinutes} {t("common.minutes")}</span>
                        </div>

                        {activeUpsells.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {activeUpsells.map((upsell) => (
                              <span key={upsell.id} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">
                                + {text(upsell.suggestedItemName)} ({upsell.price.toFixed(2)}{currencySymbol})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2.5 shrink-0">
                        <span className="text-sm font-bold text-orange-600 font-mono">
                          {item.basePrice.toFixed(2)}{currencySymbol}
                        </span>

                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1 px-2.5 border border-neutral-200 hover:border-orange-500 hover:text-orange-600 text-neutral-600 rounded text-xs font-semibold flex items-center gap-1.5 transition leading-none shadow-sm"
                        >
                          <Edit3 size={11} />
                          {t("menu.edit")}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}
