import React, { useState } from "react";
import { Megaphone, Plus, Sparkles, Send, Globe, Trash, RefreshCw } from "lucide-react";
import { Campaign } from "../types";
import { useI18n } from "../i18n";

interface CampaignTabProps {
  campaigns: Campaign[];
  onDispatchCampaign: (id: string) => void;
}

export default function CampaignTab({ campaigns, onDispatchCampaign }: CampaignTabProps) {
  const { t } = useI18n();
  const [activeCamFilter, setActiveCamFilter] = useState<"all" | "draft" | "sent">("all");
  
  // Create state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLang, setNewLang] = useState<"all" | "ar" | "de">("all");
  const [msgAr, setMsgAr] = useState("");
  const [msgDe, setMsgDe] = useState("");

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeCamFilter === "all") return true;
    return c.status === activeCamFilter;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
      
      {/* Sidebar - list of campaigns */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full">
        
        {/* Toolbar headers */}
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Megaphone size={16} className="text-orange-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-950 uppercase tracking-widest">{t("campaign.broadcasts")}</span>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 px-2.2 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold rounded flex items-center gap-1 transition leading-none uppercase"
            >
              <Plus size={10} />
              {t("common.draft")}
            </button>
          </div>
        </div>

        {/* Tab filters links */}
        <div className="flex border-b border-gray-100 bg-neutral-520 text-neutral-500 text-[10px] uppercase font-bold">
          {(["all", "draft", "sent"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveCamFilter(filter)}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeCamFilter === filter
                  ? "border-orange-500 text-orange-800 bg-orange-50/20"
                  : "border-transparent hover:bg-neutral-50"
              }`}
            >
              {filter === "all" ? t("common.all") : filter === "draft" ? t("common.draft") : t("common.sent")}
            </button>
          ))}
        </div>

        {/* List items block */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filteredCampaigns.map((c) => (
            <div key={c.id} className="p-4 flex flex-col gap-1.5 hover:bg-neutral-50/50 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">{c.title}</span>
                
                {/* Status indicator badges */}
                <span className={`text-[8px] font-bold border px-2 py-0.5 rounded uppercase ${
                  c.status === "sent"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                    : c.status === "sending"
                    ? "bg-blue-50 text-blue-700 border-blue-250 animate-pulse"
                    : "bg-neutral-50 text-neutral-500 border-neutral-250"
                }`}>
                  {c.status}
                </span>
              </div>

              <p className="text-[11px] text-gray-500 leading-snug">{c.description}</p>

              <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mt-1 pt-1.5 border-t border-dashed border-neutral-100">
                <span>{t("campaign.targets")}: {c.totalTarget || t("campaign.allContacts")}</span>
                {c.sentCount !== undefined && <span>{t("campaign.delivered")}: {c.sentCount} {t("campaign.chats")}</span>}
              </div>

              {/* Action buttons triggers */}
              {c.status === "draft" && (
                <button
                  onClick={() => onDispatchCampaign(c.id)}
                  className="w-full mt-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] uppercase py-1.5 rounded flex items-center justify-center gap-1.5 transition leading-none shadow-sm active:scale-95"
                >
                  <Send size={10} />
                  {t("campaign.sendNow")}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Campaign details / custom template draft panels */}
      <div className="lg:col-span-7 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-5 h-full min-h-[400px]">
        {showCreateModal ? (
          <div className="flex-1 flex flex-col gap-4 text-xs">
            <h4 className="font-bold text-neutral-900 text-sm border-b pb-2 flex items-center gap-1.5">
              <Megaphone size={16} className="text-orange-500" />
              {t("campaign.newTitle")}
            </h4>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2">
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.title")}:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Weekend Special Discount"
                  className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.internalDescription")}:</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Summarize the core target or goal"
                  className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.targetLanguage")}:</label>
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value as any)}
                  className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs"
                >
                  <option value="all">{t("campaign.bothLanguages")}</option>
                  <option value="ar">{t("campaign.arOnly")} (العربية)</option>
                  <option value="de">{t("campaign.deOnly")} (Deutsch)</option>
                </select>
              </div>
            </div>

            {/* Language Textareas */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.arText")} (العربية):</label>
                <textarea
                  rows={3}
                  value={msgAr}
                  onChange={(e) => setMsgAr(e.target.value)}
                  placeholder="أهلاً بك! خصم خاص 20% على البروستد هذا الويكند..."
                  className="w-full bg-white p-2 border border-neutral-300 rounded text-xs outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.deText")} (Deutsch):</label>
                <textarea
                  rows={3}
                  value={msgDe}
                  onChange={(e) => setMsgDe(e.target.value)}
                  placeholder="Hallo! Dieses Wochenende gibt es 20% Rabatt auf alle Broasted Hähnchen..."
                  className="w-full bg-white p-2 border border-neutral-300 rounded text-xs outline-none font-sans"
                />
              </div>
            </div>

            {/* Confirm Actions */}
            <div className="flex justify-end gap-2 border-t pt-3 mt-auto">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-350 text-gray-700 bg-white hover:bg-gray-100 rounded text-xs font-semibold"
              >
                {t("campaign.cancelDraft")}
              </button>
              <button
                onClick={() => {
                  if (!newTitle.trim() || (!msgAr.trim() && !msgDe.trim())) {
                    alert(t("campaign.validation"));
                    return;
                  }
                  campaigns.push({
                    id: "camp-" + Math.floor(Math.random() * 100),
                    title: newTitle,
                    description: newDesc,
                    status: "draft",
                    language: newLang,
                    message: { ar: msgAr, de: msgDe, en: msgDe || msgAr },
                    createdAt: new Date().toISOString()
                  });
                  setNewTitle("");
                  setNewDesc("");
                  setMsgAr("");
                  setMsgDe("");
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold"
              >
                {t("common.saveDraft")}
              </button>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center gap-2.5">
            <Sparkles size={44} className="stroke-1 text-orange-500 animate-bounce" />
            <h5 className="font-bold text-gray-800 text-sm">{t("campaign.emptyTitle")}</h5>
            <p className="text-xs max-w-sm leading-relaxed text-gray-500">
              {t("campaign.emptyText")}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow"
            >
              <Plus size={14} />
              {t("campaign.draftNew")}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
