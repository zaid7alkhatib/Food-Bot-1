import React, { useState, useEffect, useRef } from "react";
import { Send, User, Bot, AlertTriangle, ShieldCheck, CheckCheck, RefreshCw } from "lucide-react";
import { Conversation, Message } from "../types";
import { useI18n } from "../i18n";

interface ChatCenterProps {
  conversations: Conversation[];
  onSendAdminMessage: (convoId: string, text: string) => void;
  onToggleTakeover: (convoId: string, botEnabled: boolean) => void;
}

export default function ChatCenter({
  conversations,
  onSendAdminMessage,
  onToggleTakeover,
}: ChatCenterProps) {
  const { t } = useI18n();
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(
    conversations[0]?.id || null
  );
  const [replyText, setReplyText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId);

  useEffect(() => {
    if ((!selectedConvoId || !selectedConvo) && conversations[0]?.id) {
      setSelectedConvoId(conversations[0].id);
    }
  }, [conversations, selectedConvo, selectedConvoId]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConvo?.messages]);

  const handleSend = () => {
    if (!replyText.trim() || !selectedConvoId) return;
    onSendAdminMessage(selectedConvoId, replyText);
    setReplyText("");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full min-h-[500px]">
      
      {/* Sidebar - list of conversations */}
      <div className="md:col-span-4 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full max-h-[520px]">
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">{t("chat.title")}</h3>
          <span className="bg-orange-100 text-orange-900 border border-orange-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
            {conversations.filter((c) => !c.botEnabled).length} {t("chat.manualAgent")}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {conversations.map((convo) => {
            if (!convo.id) return null;
            const lastMsg = convo.messages[convo.messages.length - 1];
            const isSelected = convo.id === selectedConvoId;
            return (
              <div
                key={convo.id}
                onClick={() => setSelectedConvoId(convo.id)}
                className={`p-3.5 cursor-pointer transition duration-150 flex flex-col gap-1.5 ${
                  isSelected ? "bg-orange-50/50 border-l-4 border-orange-500" : "hover:bg-neutral-50/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <User size={13} className="text-gray-400" />
                    {convo.customerName}
                  </span>
                  {!convo.botEnabled ? (
                    <span className="text-[8px] bg-orange-100 border border-orange-200 text-orange-700 font-bold px-1.5 py-0.5 rounded uppercase">
                      👤 {t("chat.agentMode")}
                    </span>
                  ) : (
                    <span className="text-[8px] bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase">
                      🤖 {t("chat.autoBot")}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 truncate max-w-[200px]">
                  {lastMsg ? lastMsg.text : "N/A"}
                </p>

                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>{t("chat.step")}: {convo.currentStep || "welcome"}</span>
                  <span>{new Date(convo.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Support chat log thread */}
      <div className="md:col-span-8 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full max-h-[520px]">
        {selectedConvo ? (
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Header toolbar */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-neutral-50">
              <div className="leading-tight">
                <h4 className="text-xs font-bold text-gray-950 flex items-center gap-1.5">
                  {t("chat.withCustomer", { name: selectedConvo.customerName })}
                </h4>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5">{t("common.phone")}: {selectedConvo.whatsAppPhone}</p>
              </div>

              {/* Takeover Control buttons */}
              <div className="flex items-center gap-2">
                {selectedConvo.botEnabled ? (
                  <button
                    onClick={() => onToggleTakeover(selectedConvo.id, false)}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 leading-none transition duration-150 uppercase"
                  >
                    <AlertTriangle size={13} />
                    {t("chat.takeover")}
                  </button>
                ) : (
                  <button
                    onClick={() => onToggleTakeover(selectedConvo.id, true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 leading-none transition duration-150 uppercase"
                  >
                    <ShieldCheck size={13} />
                    {t("chat.reactivate")}
                  </button>
                )}
              </div>
            </div>

            {/* Conversation Log bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]">
              {selectedConvo.messages.map((m) => {
                const isAdminOrBot = m.sender === "bot" || m.sender === "human";
                return (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-xs shadow-sm flex flex-col ${
                      isAdminOrBot
                        ? m.sender === "human"
                          ? "bg-orange-50 text-orange-900 border border-orange-200 self-end rounded-tr-none"
                          : "bg-white text-neutral-800 self-start rounded-tl-none border border-neutral-100"
                        : "bg-[#dcf8c6] text-neutral-800 self-end rounded-tr-none"
                    }`}
                  >
                    {/* Badge identifier */}
                    {m.sender === "human" && (
                      <span className="text-[8px] font-bold uppercase text-orange-700 tracking-wider mb-0.5">
                        👤 {t("chat.supportAgent")}
                      </span>
                    )}
                    {m.sender === "bot" && (
                      <span className="text-[8px] font-bold uppercase text-emerald-800 tracking-wider mb-0.5">
                        🤖 {t("chat.aiBot")}
                      </span>
                    )}

                    <div className="whitespace-pre-wrap leading-normal font-sans break-words">{m.text}</div>
                    
                    <span className="text-[8px] text-gray-400 font-mono mt-1 self-end flex items-center gap-0.5">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {m.sender !== "bot" && <CheckCheck size={11} className="text-blue-500" />}
                    </span>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Message composer input bar */}
            <div className="p-3.5 border-t border-gray-100 bg-neutral-50 flex items-center justify-between gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={
                    selectedConvo.botEnabled
                      ? `⚠️ ${t("chat.placeholderBot")}`
                      : t("chat.placeholderHuman")
                  }
                  className="w-full bg-white text-xs py-2 px-3.5 border border-neutral-200 focus:border-orange-500 rounded-lg outline-none transition"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!replyText.trim()}
                className={`py-2 px-5 rounded-lg text-white font-bold text-xs leading-none transition duration-150 flex items-center gap-1 shadow-sm ${
                  replyText.trim() ? "bg-orange-500 hover:bg-orange-600 active:scale-95 cursor-pointer" : "bg-neutral-300 cursor-not-allowed"
                }`}
              >
                <Send size={12} className="ml-0.5" />
                {t("chat.reply")}
              </button>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 text-xs">
            {t("chat.select")}
          </div>
        )}
      </div>

    </div>
  );
}
