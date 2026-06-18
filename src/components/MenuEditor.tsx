import React, { useEffect, useState } from "react";
import { Plus, Trash, Edit3, Languages, Save, ShoppingBag, FolderOpen, Image as ImageIcon, X } from "lucide-react";
import { MenuItem, Category, UpsellSuggestion, ModifierGroup, ModifierOption } from "../types";
import { useI18n } from "../i18n";

interface MenuEditorProps {
  categories: Category[];
  menuItems: MenuItem[];
  onAddItem: (item: Partial<MenuItem>) => void;
  onUpdateItem: (id: string, updated: Partial<MenuItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddCategory: (category: Partial<Category>) => void;
  onUpdateCategory: (id: string, updated: Partial<Category>) => void;
  onDeleteCategory: (id: string) => void;
  currencySymbol: string;
}

type LocalCopy = Record<"de" | "ar" | "en" | "tr", string>;

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1561651823-34fed0225408?w=500&auto=format&fit=crop";

function emptyUpsellSuggestion(): UpsellSuggestion {
  return {
    id: `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    suggestedItemName: { ar: "", de: "", en: "", tr: "" },
    suggestedItemId: "",
    price: 0,
    description: { ar: "", de: "", en: "", tr: "" },
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
      tr: upsell.suggestedItemName?.tr || "",
    },
    suggestedItemId: upsell.suggestedItemId || "",
    price: Number(upsell.price) || 0,
    description: upsell.description || { ar: "", de: "", en: "", tr: "" },
    isActive: upsell.isActive !== false,
  }));
}

function normalizeModifierGroups(groups: ModifierGroup[] = []): ModifierGroup[] {
  return groups.map((g) => ({
    id: g.id || `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: {
      ar: g.name?.ar || "",
      de: g.name?.de || "",
      en: g.name?.en || "",
      tr: g.name?.tr || "",
    },
    type: g.type === "multiple" ? "multiple" : "single",
    isRequired: g.isRequired === true,
    minSelections: Number(g.minSelections) || 0,
    maxSelections: Number(g.maxSelections) || 1,
    options: (g.options || []).map((opt) => ({
      id: opt.id || `opt-${Math.random().toString(36).slice(2, 8)}`,
      name: {
        ar: opt.name?.ar || "",
        de: opt.name?.de || "",
        en: opt.name?.en || "",
        tr: opt.name?.tr || "",
      },
      priceAdjustment: Number(opt.priceAdjustment) || 0,
    })),
  }));
}

export default function MenuEditor({
  categories,
  menuItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  currencySymbol,
}: MenuEditorProps) {
  const { language, t, text } = useI18n();
  const copy = (values: LocalCopy) => values[language] || values.de;
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // Form Fields State
  const [nameAr, setNameAr] = useState("");
  const [nameDe, setNameDe] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameTr, setNameTr] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descDe, setDescDe] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descTr, setDescTr] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [sku, setSku] = useState("");
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [prepMinutes, setPrepMinutes] = useState(10);
  const [upsellDrafts, setUpsellDrafts] = useState<UpsellSuggestion[]>([]);
  const [modGroupsDraft, setModGroupsDraft] = useState<ModifierGroup[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | "new" | null>(null);
  const [categoryNameAr, setCategoryNameAr] = useState("");
  const [categoryNameDe, setCategoryNameDe] = useState("");
  const [categoryNameEn, setCategoryNameEn] = useState("");
  const [categoryNameTr, setCategoryNameTr] = useState("");
  const [categoryDescAr, setCategoryDescAr] = useState("");
  const [categoryDescDe, setCategoryDescDe] = useState("");
  const [categoryDescEn, setCategoryDescEn] = useState("");
  const [categoryDescTr, setCategoryDescTr] = useState("");

  const [activeTranslationTab, setActiveTranslationTab] = useState<"de" | "ar" | "en" | "tr">("de");

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategoryId("");
      return;
    }
    if (!activeCategoryId || !categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
    }
  }, [activeCategoryId, categories]);

  const filteredItems = menuItems.filter((i) => i.categoryId === activeCategoryId);
  const selectableUpsellItems = menuItems.filter((item) => item.id !== editingItemId);

  const handleStartEdit = (item: MenuItem) => {
    setShowAddItemModal(false);
    setEditingItemId(item.id);
    setNameAr(item.name.ar);
    setNameDe(item.name.de);
    setNameEn(item.name.en);
    setNameTr(item.name.tr || "");
    setDescAr(item.description.ar);
    setDescDe(item.description.de);
    setDescEn(item.description.en);
    setDescTr(item.description.tr || "");
    setBasePrice(item.basePrice);
    setSku(item.skucode);
    setIsBestSeller(item.isBestSeller);
    setImageUrl(item.image || "");
    setPrepMinutes(item.preparationTimeMinutes || 10);
    setUpsellDrafts(normalizeUpsellSuggestions(item.upsellSuggestions));
    setModGroupsDraft(normalizeModifierGroups(item.modifierGroups));
  };

  const handleStartAddCategory = () => {
    setEditingCategoryId("new");
    setCategoryNameAr("فئة جديدة");
    setCategoryNameDe("Neue Kategorie");
    setCategoryNameEn("New Category");
    setCategoryNameTr("Yeni Kategori");
    setCategoryDescAr("");
    setCategoryDescDe("");
    setCategoryDescEn("");
    setCategoryDescTr("");
  };

  const handleStartEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryNameAr(category.name.ar || "");
    setCategoryNameDe(category.name.de || "");
    setCategoryNameEn(category.name.en || "");
    setCategoryNameTr(category.name.tr || "");
    setCategoryDescAr(category.description?.ar || "");
    setCategoryDescDe(category.description?.de || "");
    setCategoryDescEn(category.description?.en || "");
    setCategoryDescTr(category.description?.tr || "");
  };

  const handleSaveCategory = () => {
    const payload: Partial<Category> = {
      name: { ar: categoryNameAr, de: categoryNameDe, en: categoryNameEn, tr: categoryNameTr },
      description: { ar: categoryDescAr, de: categoryDescDe, en: categoryDescEn, tr: categoryDescTr },
      sortOrder: editingCategoryId === "new" ? categories.length + 1 : categories.find((category) => category.id === editingCategoryId)?.sortOrder || 0,
      isActive: true,
    };

    if (editingCategoryId === "new") {
      onAddCategory(payload);
    } else if (editingCategoryId) {
      onUpdateCategory(editingCategoryId, payload);
    }
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = (category: Category) => {
    const itemCount = menuItems.filter((item) => item.categoryId === category.id).length;
    if (itemCount > 0) {
      window.alert(t("menu.deleteCategoryBlocked").replace("{count}", String(itemCount)));
      return;
    }
    if (window.confirm(t("menu.confirmDeleteCategory").replace("{name}", text(category.name)))) {
      onDeleteCategory(category.id);
      if (activeCategoryId === category.id) {
        setActiveCategoryId(categories.find((candidate) => candidate.id !== category.id)?.id || "");
      }
    }
  };

  const handleSaveEdit = (id: string) => {
    onUpdateItem(id, {
      name: { ar: nameAr, de: nameDe, en: nameEn, tr: nameTr },
      description: { ar: descAr, de: descDe, en: descEn, tr: descTr },
      basePrice: Number(basePrice),
      image: imageUrl.trim(),
      skucode: sku,
      preparationTimeMinutes: Number(prepMinutes) || 0,
      isBestSeller,
      upsellSuggestions: normalizeUpsellSuggestions(upsellDrafts).filter((upsell) => upsell.suggestedItemName.ar || upsell.suggestedItemName.de || upsell.suggestedItemName.en || upsell.suggestedItemName.tr),
      modifierGroups: normalizeModifierGroups(modGroupsDraft),
    });
    setEditingItemId(null);
  };

  const updateUpsellDraft = (index: number, patch: Partial<UpsellSuggestion>) => {
    setUpsellDrafts((prev) => prev.map((upsell, i) => i === index ? { ...upsell, ...patch } : upsell));
  };

  const updateUpsellName = (index: number, lang: "ar" | "de" | "en" | "tr", value: string) => {
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

  // Helper to add a new modifier group
  const handleAddNewModGroup = () => {
    setModGroupsDraft((prev) => [
      ...prev,
      {
        id: `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: { ar: "", de: "", en: "", tr: "" },
        type: "single",
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
        options: [],
      },
    ]);
  };

  // Helper to update a modifier group's fields
  const handleUpdateModGroup = (index: number, patch: Partial<ModifierGroup>) => {
    setModGroupsDraft((prev) =>
      prev.map((g, i) => (i === index ? { ...g, ...patch } : g))
    );
  };

  // Helper to update a modifier group's name translation
  const handleUpdateModGroupName = (index: number, lang: "ar" | "de" | "en" | "tr", value: string) => {
    setModGroupsDraft((prev) =>
      prev.map((g, i) =>
        i === index
          ? { ...g, name: { ...g.name, [lang]: value } }
          : g
      )
    );
  };

  // Helper to remove a modifier group
  const handleRemoveModGroup = (index: number) => {
    setModGroupsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to add a new option to a modifier group
  const handleAddNewModOption = (groupIndex: number) => {
    setModGroupsDraft((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          options: [
            ...g.options,
            {
              id: `opt-${Math.random().toString(36).slice(2, 8)}`,
              name: { ar: "", de: "", en: "", tr: "" },
              priceAdjustment: 0,
            },
          ],
        };
      })
    );
  };

  // Helper to update an option inside a modifier group
  const handleUpdateModOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<ModifierOption>
  ) => {
    setModGroupsDraft((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          options: g.options.map((opt, oIdx) =>
            oIdx === optionIndex ? { ...opt, ...patch } : opt
          ),
        };
      })
    );
  };

  // Helper to update an option's name translation inside a modifier group
  const handleUpdateModOptionName = (
    groupIndex: number,
    optionIndex: number,
    lang: "ar" | "de" | "en" | "tr",
    value: string
  ) => {
    setModGroupsDraft((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          options: g.options.map((opt, oIdx) =>
            oIdx === optionIndex
              ? { ...opt, name: { ...opt.name, [lang]: value } }
              : opt
          ),
        };
      })
    );
  };

  // Helper to remove an option from a modifier group
  const handleRemoveModOption = (groupIndex: number, optionIndex: number) => {
    setModGroupsDraft((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          options: g.options.filter((_, oIdx) => oIdx !== optionIndex),
        };
      })
    );
  };

  const resetItemDraft = () => {
    setNameAr("");
    setNameDe("");
    setNameEn("");
    setNameTr("");
    setDescAr("");
    setDescDe("");
    setDescEn("");
    setDescTr("");
    setBasePrice(0);
    setSku("");
    setIsBestSeller(false);
    setImageUrl("");
    setPrepMinutes(10);
    setUpsellDrafts([]);
    setModGroupsDraft([]);
    setActiveTranslationTab("de");
  };

  const handleStartAddItem = () => {
    if (!activeCategoryId) return;
    setEditingItemId(null);
    resetItemDraft();
    setShowAddItemModal(true);
  };

  const handleCreateItem = () => {
    if (!activeCategoryId) return;
    if (!nameAr.trim() && !nameDe.trim() && !nameEn.trim() && !nameTr.trim()) {
      window.alert(t("menu.nameRequired"));
      return;
    }

    const fallbackName = nameDe.trim() || nameEn.trim() || nameAr.trim() || nameTr.trim();
    const fallbackDescription = descDe.trim() || descEn.trim() || descAr.trim() || descTr.trim();
    const item: Partial<MenuItem> = {
      categoryId: activeCategoryId,
      name: {
        ar: nameAr.trim() || fallbackName,
        de: nameDe.trim() || fallbackName,
        en: nameEn.trim() || fallbackName,
        tr: nameTr.trim() || fallbackName,
      },
      description: {
        ar: descAr.trim() || fallbackDescription,
        de: descDe.trim() || fallbackDescription,
        en: descEn.trim() || fallbackDescription,
        tr: descTr.trim() || fallbackDescription,
      },
      basePrice: Number(basePrice) || 0,
      image: imageUrl.trim() || FALLBACK_IMAGE,
      skucode: sku.trim() || `ITEM-${Date.now().toString(36).toUpperCase()}`,
      preparationTimeMinutes: Number(prepMinutes) || 0,
      isAvailableForDelivery: true,
      isAvailableForPickup: true,
      isActive: true,
      isBestSeller,
      modifierGroups: normalizeModifierGroups(modGroupsDraft),
      upsellSuggestions: normalizeUpsellSuggestions(upsellDrafts).filter((upsell) => upsell.suggestedItemName.ar || upsell.suggestedItemName.de || upsell.suggestedItemName.en || upsell.suggestedItemName.tr),
    };
    onAddItem(item);
    setShowAddItemModal(false);
    resetItemDraft();
  };

  const handleAddNewItem = () => {
    handleStartAddItem();
  };

  const handleDeleteItem = (item: MenuItem) => {
    if (window.confirm(t("menu.confirmDeleteItem").replace("{name}", text(item.name)))) {
      onDeleteItem(item.id);
      if (editingItemId === item.id) {
        setEditingItemId(null);
      }
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">
      
      {/* Category filters sidebar list */}
      <div className="md:col-span-3 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderOpen size={16} className="text-orange-500 shrink-0" />
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider truncate">{t("menu.categories")}</h3>
          </div>
          <button
            type="button"
            onClick={handleStartAddCategory}
            className="p-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white transition"
            aria-label={t("menu.addCategory")}
            title={t("menu.addCategory")}
          >
            <Plus size={13} />
          </button>
        </div>
        {editingCategoryId && (
          <div className="p-3 bg-orange-50/60 border-b border-orange-100 space-y-2">
            <div className="grid grid-cols-4 gap-1">
              <input
                type="text"
                value={categoryNameDe}
                onChange={(e) => setCategoryNameDe(e.target.value)}
                placeholder="DE"
                className="min-w-0 bg-white p-2 border border-orange-100 rounded text-[11px] outline-none"
              />
              <input
                type="text"
                value={categoryNameAr}
                onChange={(e) => setCategoryNameAr(e.target.value)}
                placeholder="AR"
                className="min-w-0 bg-white p-2 border border-orange-100 rounded text-[11px] outline-none"
              />
              <input
                type="text"
                value={categoryNameEn}
                onChange={(e) => setCategoryNameEn(e.target.value)}
                placeholder="EN"
                className="min-w-0 bg-white p-2 border border-orange-100 rounded text-[11px] outline-none"
              />
              <input
                type="text"
                value={categoryNameTr}
                onChange={(e) => setCategoryNameTr(e.target.value)}
                placeholder="TR"
                className="min-w-0 bg-white p-2 border border-orange-100 rounded text-[11px] outline-none"
              />
            </div>
            <textarea
              rows={2}
              value={categoryDescDe}
              onChange={(e) => {
                setCategoryDescDe(e.target.value);
                setCategoryDescAr((prev) => prev || e.target.value);
                setCategoryDescEn((prev) => prev || e.target.value);
                setCategoryDescTr((prev) => prev || e.target.value);
              }}
              placeholder={t("common.description")}
              className="w-full bg-white p-2 border border-orange-100 rounded text-[11px] outline-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingCategoryId(null)}
                className="px-2 py-1 text-[10px] font-bold rounded bg-white border border-neutral-200 text-neutral-600"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-600 text-white"
              >
                {t("common.saveChanges")}
              </button>
            </div>
          </div>
        )}
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`w-full p-3 px-4 text-left font-serif text-sm font-medium transition flex items-center gap-2 ${
              activeCategoryId === cat.id
                ? "bg-orange-50 text-orange-900 border-l-4 border-orange-500 font-bold"
                : "text-gray-600 hover:bg-neutral-50/50"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveCategoryId(cat.id);
                setEditingItemId(null);
              }}
              className="flex-1 min-w-0 text-left truncate"
            >
              {text(cat.name)}
            </button>
            <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full font-mono shrink-0">
              {menuItems.filter((i) => i.categoryId === cat.id).length}
            </span>
            <button
              type="button"
              onClick={() => handleStartEditCategory(cat)}
              className="p-1 text-neutral-400 hover:text-orange-600 rounded"
              aria-label={t("menu.editCategory")}
              title={t("menu.editCategory")}
            >
              <Edit3 size={11} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteCategory(cat)}
              className="p-1 text-neutral-400 hover:text-red-600 rounded"
              aria-label={t("menu.deleteCategory")}
              title={t("menu.deleteCategory")}
            >
              <Trash size={11} />
            </button>
          </div>
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
                          {(["de", "ar", "en", "tr"] as const).map((lang) => (
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

                      {activeTranslationTab === "tr" && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.nameTr")}:</label>
                            <input
                              type="text"
                              value={nameTr}
                              onChange={(e) => setNameTr(e.target.value)}
                              className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 font-bold mb-1">{t("menu.descTr")}:</label>
                            <textarea
                              rows={2}
                              value={descTr}
                              onChange={(e) => setDescTr(e.target.value)}
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

                      {/* Modifier Groups Section */}
                      <div className="pt-3 border-t border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[11px] font-bold text-neutral-800 uppercase">
                              {copy({ ar: "خيارات التعديل والتخصيص", de: "Anpassungsoptionen & Modifikatoren", en: "Customization Options & Modifiers", tr: "Özelleştirme Seçenekleri ve Düzenleyiciler" })}
                            </h4>
                            <p className="text-[10px] text-gray-400">
                              {copy({
                                ar: "إضافة مجموعات خيارات مثل (الصلصات، درجة الحرارة، الإضافات) مع تحديد الأسعار والخيارات",
                                de: "Fügen Sie Gruppen wie Soßen oder Beilagen hinzu, um Kunden Auswahlmöglichkeiten zu geben.",
                                en: "Add option groups like sauces, doneness, or extras with prices and choices.",
                                tr: "Soslar, pişirme derecesi veya ekstralar gibi seçenek gruplarını fiyat ve seçeneklerle ekleyin.",
                              })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddNewModGroup}
                            className="px-2 py-1 bg-white border border-neutral-200 hover:border-orange-400 text-neutral-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer select-none"
                          >
                            <Plus size={11} />
                            {copy({ ar: "إضافة مجموعة جديدة", de: "Gruppe hinzufügen", en: "Add Group", tr: "Grup Ekle" })}
                          </button>
                        </div>

                        {modGroupsDraft.length === 0 ? (
                          <div className="text-[11px] text-gray-400 bg-white border border-dashed border-neutral-200 rounded-lg p-3">
                            {copy({
                              ar: "لا توجد خيارات تعديل مضافة لهذا الصنف.",
                              de: "Keine Anpassungsgruppen für dieses Gericht.",
                              en: "No customization groups have been added for this item.",
                              tr: "Bu ürün için henüz özelleştirme grubu eklenmedi.",
                            })}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {modGroupsDraft.map((group, gIdx) => (
                              <div key={group.id} className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-3 shadow-xs">
                                {/* Group Title / Remove button */}
                                <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-100">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-500 font-mono text-[10px] font-bold flex items-center justify-center">
                                      {gIdx + 1}
                                    </span>
                                    <span className="text-[11px] font-bold text-neutral-800 font-sans">
                                      {group.name[activeTranslationTab] || `Group #${gIdx + 1}`}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveModGroup(gIdx)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded transition cursor-pointer select-none"
                                    title={copy({ ar: "حذف", de: "Löschen", en: "Delete", tr: "Sil" })}
                                  >
                                    <Trash size={13} />
                                  </button>
                                </div>

                                {/* Group Parameters */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                                  <div className="col-span-1 md:col-span-2">
                                    <label className="block text-[10px] text-gray-400 font-bold mb-1">
                                      {copy({ ar: "اسم المجموعة", de: "Gruppenname", en: "Group Name", tr: "Grup Adı" })} ({activeTranslationTab.toUpperCase()})
                                    </label>
                                    <input
                                      type="text"
                                      value={group.name[activeTranslationTab] || ""}
                                      onChange={(e) => handleUpdateModGroupName(gIdx, activeTranslationTab, e.target.value)}
                                      className="w-full bg-white p-2 border border-neutral-300 rounded outline-none font-sans"
                                      placeholder={copy({ ar: "مثال: صوصات إضافية", de: "z.B. Extra Soßen", en: "e.g. Extra sauces", tr: "örn. Ekstra soslar" })}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-gray-400 font-bold mb-1">
                                      {copy({ ar: "نوع الاختيار", de: "Auswahltyp", en: "Selection Type", tr: "Seçim Türü" })}
                                    </label>
                                    <select
                                      value={group.type}
                                      onChange={(e) => handleUpdateModGroup(gIdx, { type: e.target.value as "single" | "multiple" })}
                                      className="w-full bg-white p-2 border border-neutral-300 rounded outline-none"
                                    >
                                      <option value="single">{copy({ ar: "اختيار واحد فقط (Radio)", de: "Einzelne Auswahl (Radio)", en: "Single Selection (Radio)", tr: "Tek Seçim (Radio)" })}</option>
                                      <option value="multiple">{copy({ ar: "اختيارات متعددة (Checkbox)", de: "Mehrfachauswahl (Checkbox)", en: "Multiple Selection (Checkbox)", tr: "Çoklu Seçim (Checkbox)" })}</option>
                                    </select>
                                  </div>

                                  <div className="flex items-center gap-2 pt-3">
                                    <input
                                      type="checkbox"
                                      id={`req-${group.id}`}
                                      checked={group.isRequired}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        handleUpdateModGroup(gIdx, { 
                                          isRequired: checked,
                                          minSelections: checked ? 1 : 0
                                        });
                                      }}
                                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                                    />
                                    <label htmlFor={`req-${group.id}`} className="font-bold text-neutral-700 select-none cursor-pointer">
                                      {copy({ ar: "إجباري للطلب", de: "Erforderlich", en: "Required", tr: "Zorunlu" })}
                                    </label>
                                  </div>
                                </div>

                                {/* Rules details (min/max selection) */}
                                {group.type === "multiple" && (
                                  <div className="grid grid-cols-2 gap-3 p-2 bg-stone-50 rounded-lg border border-stone-100 text-xs">
                                    <div>
                                      <label className="block text-[9px] text-gray-400 font-bold mb-1">
                                        {copy({ ar: "الحد الأدنى للاختيارات", de: "Min. Auswahl", en: "Min. Selections", tr: "Min. Seçim" })}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={group.minSelections}
                                        onChange={(e) => handleUpdateModGroup(gIdx, { minSelections: Number(e.target.value) })}
                                        className="w-full bg-white p-1.5 border border-stone-200 rounded text-[11px] outline-none font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-gray-400 font-bold mb-1">
                                        {copy({ ar: "الحد الأقصى للاختيارات", de: "Max. Auswahl", en: "Max. Selections", tr: "Maks. Seçim" })}
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={group.maxSelections}
                                        onChange={(e) => handleUpdateModGroup(gIdx, { maxSelections: Number(e.target.value) })}
                                        className="w-full bg-white p-1.5 border border-stone-200 rounded text-[11px] outline-none font-mono"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Options list inside the group */}
                                <div className="pl-4 border-l-2 border-stone-100 space-y-2 mt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wide">
                                      {copy({ ar: "الخيارات المتاحة", de: "Optionen", en: "Options", tr: "Seçenekler" })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddNewModOption(gIdx)}
                                      className="text-orange-500 hover:text-orange-600 text-[10px] font-bold flex items-center gap-1 select-none cursor-pointer"
                                    >
                                      <Plus size={10} />
                                      {copy({ ar: "إضافة خيار", de: "Option hinzufügen", en: "Add Option", tr: "Seçenek Ekle" })}
                                    </button>
                                  </div>

                                  {group.options.length === 0 ? (
                                    <div className="text-[10px] text-gray-400 bg-stone-50/50 border border-stone-100 rounded-lg p-2 text-center">
                                      {copy({ ar: "لا توجد خيارات مضافة بعد.", de: "Keine Optionen hinzugefügt.", en: "No options added yet.", tr: "Henüz seçenek eklenmedi." })}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {group.options.map((opt, oIdx) => (
                                        <div key={opt.id} className="bg-stone-50/50 border border-neutral-150 rounded-lg p-2 flex items-center gap-2 text-xs">
                                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                              <input
                                                type="text"
                                                value={opt.name[activeTranslationTab] || ""}
                                                onChange={(e) => handleUpdateModOptionName(gIdx, oIdx, activeTranslationTab, e.target.value)}
                                                className="w-full bg-white p-1.5 border border-stone-200 rounded text-[11px] outline-none font-medium font-sans"
                                                placeholder={copy({ ar: "مثال: بدون بصل", de: "z.B. Extra Käse", en: "e.g. Extra cheese", tr: "örn. Ekstra peynir" })}
                                              />
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] text-stone-400 font-mono">+</span>
                                              <input
                                                type="number"
                                                step="0.05"
                                                value={opt.priceAdjustment}
                                                onChange={(e) => handleUpdateModOption(gIdx, oIdx, { priceAdjustment: Number(e.target.value) })}
                                                className="w-full bg-white p-1.5 border border-stone-200 rounded text-[11px] outline-none font-mono"
                                                placeholder="0.00"
                                              />
                                              <span className="text-[10px] text-stone-400 font-mono">{currencySymbol}</span>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveModOption(gIdx, oIdx)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition cursor-pointer select-none"
                                            title={copy({ ar: "حذف", de: "Löschen", en: "Delete", tr: "Sil" })}
                                          >
                                            <Trash size={12} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 px-2.5 border border-red-100 hover:border-red-400 hover:text-red-600 text-red-500 rounded text-xs font-semibold flex items-center gap-1.5 transition leading-none shadow-sm"
                        >
                          <Trash size={11} />
                          {t("menu.deleteItem")}
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
    {showAddItemModal && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleCreateItem();
          }}
          className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
        >
          <div className="bg-neutral-50 border-b border-gray-100 p-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("menu.addDish")}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t("menu.addDishDetails")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddItemModal(false);
                resetItemDraft();
              }}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition"
              aria-label={t("common.cancel")}
              title={t("common.cancel")}
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t("menu.categories")}</label>
                <select
                  value={activeCategoryId}
                  onChange={(e) => setActiveCategoryId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {text(category.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t("common.price")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t("menu.prepMinutes")}</label>
                <input
                  type="number"
                  min="0"
                  value={prepMinutes}
                  onChange={(e) => setPrepMinutes(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl p-4 bg-neutral-50/70 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-xs text-neutral-800 flex items-center gap-1">
                  <Languages size={13} />
                  {t("menu.translationFields")}
                </span>
                <div className="flex gap-1">
                  {(["de", "ar", "en", "tr"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveTranslationTab(lang)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
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

              {activeTranslationTab === "ar" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.nameAr")}</label>
                    <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.descAr")}</label>
                    <input value={descAr} onChange={(e) => setDescAr(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                </div>
              )}

              {activeTranslationTab === "de" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.nameDe")}</label>
                    <input value={nameDe} onChange={(e) => setNameDe(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" autoFocus />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.descDe")}</label>
                    <input value={descDe} onChange={(e) => setDescDe(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                </div>
              )}

              {activeTranslationTab === "en" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.nameEn")}</label>
                    <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.descEn")}</label>
                    <input value={descEn} onChange={(e) => setDescEn(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                </div>
              )}

              {activeTranslationTab === "tr" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.nameTr")}</label>
                    <input value={nameTr} onChange={(e) => setNameTr(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold mb-1">{t("menu.descTr")}</label>
                    <input value={descTr} onChange={(e) => setDescTr(e.target.value)} className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t("common.sku")}</label>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ITEM-001"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t("menu.imageUrl")}</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={FALLBACK_IMAGE}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 select-none">
              <input
                type="checkbox"
                checked={isBestSeller}
                onChange={(e) => setIsBestSeller(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              {t("menu.bestsellerFlag")}
            </label>
          </div>

          <div className="bg-neutral-50 border-t border-gray-100 p-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddItemModal(false);
                resetItemDraft();
              }}
              className="px-3 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
            >
              <Save size={12} />
              {t("menu.addDish")}
            </button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
