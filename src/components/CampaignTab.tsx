import React, { useState } from "react";
import { Megaphone, Plus, Sparkles, Send, Globe, Trash, RefreshCw, Edit } from "lucide-react";
import { Campaign } from "../types";
import { useI18n } from "../i18n";

interface CampaignTabProps {
  campaigns: Campaign[];
  onCreateCampaign: (campaign: Omit<Campaign, "id" | "status">) => void;
  onUpdateCampaign: (id: string, campaign: Omit<Campaign, "id" | "status">) => void;
  onDispatchCampaign: (id: string) => void;
  onSendTestCampaign: (id: string, phone: string) => Promise<boolean>;
}

export default function CampaignTab({ campaigns, onCreateCampaign, onUpdateCampaign, onDispatchCampaign, onSendTestCampaign }: CampaignTabProps) {
  const { t } = useI18n();
  const [activeCamFilter, setActiveCamFilter] = useState<"all" | "draft" | "sent">("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  
  // Create / Edit state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLang, setNewLang] = useState<"all" | "ar" | "de" | "en" | "tr">("all");
  const [newSegment, setNewSegment] = useState<"all" | "active" | "dormant">("all");
  const [msgAr, setMsgAr] = useState("");
  const [msgDe, setMsgDe] = useState("");
  const [msgEn, setMsgEn] = useState("");
  const [msgTr, setMsgTr] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; msg: string } | null>(null);

  const resetFormState = () => {
    setNewTitle("");
    setNewDesc("");
    setNewLang("all");
    setNewSegment("all");
    setMsgAr("");
    setMsgDe("");
    setMsgEn("");
    setMsgTr("");
    setEditingCampaignId(null);
    setShowCreateModal(false);
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeCamFilter === "all") return true;
    return c.status === activeCamFilter;
  });

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

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
              onClick={() => {
                resetFormState();
                setShowCreateModal(true);
              }}
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
            <div
              key={c.id}
              onClick={() => {
                setSelectedCampaignId(c.id);
                resetFormState();
              }}
              className={`p-4 flex flex-col gap-1.5 cursor-pointer transition ${
                selectedCampaignId === c.id
                  ? "bg-orange-50/20 border-l-4 border-orange-500"
                  : "hover:bg-neutral-50/50"
              }`}
            >
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
              {editingCampaignId ? t("campaign.editTitle") : t("campaign.newTitle")}
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
                  <option value="en">{t("campaign.enOnly")} (English)</option>
                  <option value="tr">{t("campaign.trOnly")} (Türkçe)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.segment")}:</label>
                <select
                  value={newSegment}
                  onChange={(e) => setNewSegment(e.target.value as any)}
                  className="w-full bg-white p-2 border border-neutral-300 rounded outline-none text-xs"
                >
                  <option value="all">{t("campaign.allContacts")}</option>
                  <option value="active">{t("campaign.activeCustomers")}</option>
                  <option value="dormant">{t("campaign.dormantContacts")}</option>
                </select>
              </div>
            </div>

            {/* Language Textareas */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.arText")} (العربية):</label>
                <textarea
                  rows={2}
                  value={msgAr}
                  onChange={(e) => setMsgAr(e.target.value)}
                  placeholder="أهلاً بك! خصم خاص 20% على البروستد هذا الويكند..."
                  className="w-full bg-white p-2 border border-neutral-300 rounded text-xs outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.deText")} (Deutsch):</label>
                <textarea
                  rows={2}
                  value={msgDe}
                  onChange={(e) => setMsgDe(e.target.value)}
                  placeholder="Hallo! Dieses Wochenende gibt es 20% Rabatt auf alle Broasted Hähnchen..."
                  className="w-full bg-white p-2 border border-neutral-300 rounded text-xs outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.enText")} (English):</label>
                <textarea
                  rows={2}
                  value={msgEn}
                  onChange={(e) => setMsgEn(e.target.value)}
                  placeholder="Hello! This weekend we have a 20% discount on all roasted chicken..."
                  className="w-full bg-white p-2 border border-neutral-300 rounded text-xs outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-1 uppercase">{t("campaign.trText")} (Türkçe):</label>
                <textarea
                  rows={2}
                  value={msgTr}
                  onChange={(e) => setMsgTr(e.target.value)}
                  placeholder="Merhaba! Bu hafta sonu tüm kızarmış tavuklarda %20 indirim var..."
                  className="w-full bg-white p-2 border border-neutral-300 rounded text-xs outline-none font-sans"
                />
              </div>
            </div>

            {/* Confirm Actions */}
            <div className="flex justify-end gap-2 border-t pt-3 mt-auto">
              <button
                onClick={() => resetFormState()}
                className="px-4 py-2 border border-gray-350 text-gray-700 bg-white hover:bg-gray-100 rounded text-xs font-semibold"
              >
                {t("campaign.cancelDraft")}
              </button>
              <button
                onClick={async () => {
                  if (!newTitle.trim() || (!msgAr.trim() && !msgDe.trim() && !msgEn.trim() && !msgTr.trim())) {
                    alert(t("campaign.validation"));
                    return;
                  }
                  
                  const campaignData = {
                    title: newTitle,
                    description: newDesc,
                    language: newLang,
                    segment: newSegment,
                    message: {
                      ar: msgAr,
                      de: msgDe,
                      en: msgEn || msgDe || msgAr,
                      tr: msgTr || msgDe || msgAr
                    }
                  };

                  if (editingCampaignId) {
                    await onUpdateCampaign(editingCampaignId, campaignData);
                  } else {
                    await onCreateCampaign(campaignData);
                  }

                  resetFormState();
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold"
              >
                {t("common.saveDraft")}
              </button>
            </div>

          </div>
        ) : selectedCampaign ? (
          <div className="flex-1 flex flex-col gap-4 text-xs overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3.5">
              <div>
                <h4 className="font-bold text-neutral-900 text-sm">{selectedCampaign.title}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">{selectedCampaign.description || "No description"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold border px-2.5 py-0.5 rounded-full uppercase ${
                  selectedCampaign.status === "sent"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : selectedCampaign.status === "sending"
                    ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                    : "bg-neutral-50 text-neutral-500 border-neutral-200"
                }`}>
                  {selectedCampaign.status}
                </span>
                {selectedCampaign.status === "draft" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCampaignId(selectedCampaign.id);
                        setNewTitle(selectedCampaign.title);
                        setNewDesc(selectedCampaign.description || "");
                        setNewLang(selectedCampaign.language as any);
                        setNewSegment(selectedCampaign.segment as any);
                        setMsgAr(selectedCampaign.message.ar || "");
                        setMsgDe(selectedCampaign.message.de || "");
                        setMsgEn(selectedCampaign.message.en || "");
                        setMsgTr(selectedCampaign.message.tr || "");
                        setShowCreateModal(true);
                      }}
                      className="p-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold rounded flex items-center gap-1 transition uppercase leading-none font-sans"
                    >
                      <Edit size={10} />
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => onDispatchCampaign(selectedCampaign.id)}
                      className="p-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold rounded flex items-center gap-1 transition uppercase leading-none font-sans"
                    >
                      <Send size={10} />
                      {t("campaign.sendNow")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Test Send Input - only show for Drafts */}
            {selectedCampaign.status === "draft" && (
              <div className="p-3.5 bg-orange-50/15 border border-orange-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-orange-700 uppercase">Test Campaign Send</span>
                  <p className="text-[11px] text-gray-500 mt-0.5">Send a test message to a single contact before broadcasting to everyone.</p>
                </div>
                <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => {
                        setTestPhone(e.target.value);
                        setTestSendResult(null);
                      }}
                      placeholder="e.g., +491512345678"
                      className="bg-white p-2 border border-neutral-300 rounded outline-none text-xs w-full sm:w-48"
                    />
                    <button
                      onClick={async () => {
                        if (!testPhone.trim()) return;
                        setIsTestingSend(true);
                        setTestSendResult(null);
                        const success = await onSendTestCampaign(selectedCampaign.id, testPhone);
                        setIsTestingSend(false);
                        if (success) {
                          setTestSendResult({ success: true, msg: "Test message sent successfully!" });
                          setTestPhone("");
                        } else {
                          setTestSendResult({ success: false, msg: "Failed to send test message. Check active session." });
                        }
                      }}
                      disabled={isTestingSend || !testPhone.trim()}
                      className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-bold rounded flex items-center gap-1.5 whitespace-nowrap transition"
                    >
                      {isTestingSend ? "Sending..." : "Send Test"}
                    </button>
                  </div>
                  {testSendResult && (
                    <span className={`text-[10px] font-semibold ${testSendResult.success ? "text-emerald-600" : "text-rose-600"}`}>
                      {testSendResult.msg}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Campaign Stats Card */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-neutral-50 p-3 rounded-lg border border-gray-100">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Total Targets</span>
                <p className="text-sm font-extrabold text-neutral-900 mt-1">{selectedCampaign.totalTarget || 0}</p>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg border border-gray-100">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Delivered</span>
                <p className="text-sm font-extrabold text-emerald-600 mt-1">{selectedCampaign.sentCount || 0}</p>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg border border-gray-100">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Failed</span>
                <p className="text-sm font-extrabold text-rose-600 mt-1">{selectedCampaign.failedCount || 0}</p>
              </div>
            </div>

            {/* Translation Details Tab/Grid */}
            <div className="space-y-3">
              <h5 className="font-bold text-neutral-900 text-xs border-b pb-1">Broadcast Messages</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {selectedCampaign.message.ar && (
                  <div className="p-3 bg-neutral-50 rounded-lg border border-gray-100">
                    <span className="text-[8px] font-bold text-orange-600 uppercase">Arabic (العربية)</span>
                    <p className="text-xs text-neutral-800 font-sans leading-relaxed mt-1">{selectedCampaign.message.ar}</p>
                  </div>
                )}
                {selectedCampaign.message.de && (
                  <div className="p-3 bg-neutral-50 rounded-lg border border-gray-100">
                    <span className="text-[8px] font-bold text-orange-600 uppercase">German (Deutsch)</span>
                    <p className="text-xs text-neutral-800 font-sans leading-relaxed mt-1">{selectedCampaign.message.de}</p>
                  </div>
                )}
                {selectedCampaign.message.en && (
                  <div className="p-3 bg-neutral-50 rounded-lg border border-gray-100">
                    <span className="text-[8px] font-bold text-orange-600 uppercase">English</span>
                    <p className="text-xs text-neutral-800 font-sans leading-relaxed mt-1">{selectedCampaign.message.en}</p>
                  </div>
                )}
                {selectedCampaign.message.tr && (
                  <div className="p-3 bg-neutral-50 rounded-lg border border-gray-100">
                    <span className="text-[8px] font-bold text-orange-600 uppercase">Turkish (Türkçe)</span>
                    <p className="text-xs text-neutral-800 font-sans leading-relaxed mt-1">{selectedCampaign.message.tr}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recipients Section */}
            <div className="mt-2 flex-1 flex flex-col min-h-[180px]">
              <h5 className="font-bold text-neutral-900 text-xs border-b pb-1 mb-2">Recipients Log</h5>
              {selectedCampaign.recipients && selectedCampaign.recipients.length > 0 ? (
                <div className="flex-1 overflow-y-auto max-h-[220px] bg-neutral-50 rounded-lg border border-gray-100 p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedCampaign.recipients.map((phone, index) => (
                      <div key={index} className="flex items-center gap-1.5 p-1 px-2.5 bg-white border border-gray-100 rounded text-[10px] font-mono text-gray-700 shadow-sm animate-fade-in">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-neutral-50 border border-dashed rounded-lg text-neutral-400 text-center text-[11px]">
                  {selectedCampaign.status === "draft"
                    ? "No recipients yet. Click 'Send Now' to dispatch."
                    : "No successful transmissions recorded."}
                </div>
              )}
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
              onClick={() => {
                resetFormState();
                setShowCreateModal(true);
              }}
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
