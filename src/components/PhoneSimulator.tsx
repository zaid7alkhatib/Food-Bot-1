import React, { useState, useEffect, useRef } from "react";
import { Send, Smartphone, Wifi, Battery, ArrowLeft, CheckCheck, Loader2, Star, MessageSquare } from "lucide-react";
import { Conversation, Message, Order } from "../types";
import { useI18n } from "../i18n";

interface PhoneSimulatorProps {
  onOrderPlaced: () => void;
  onRefreshState: () => void;
  conversations: Conversation[];
  activeConvoId: string | null;
  setActiveConvoId: (id: string | null) => void;
  currencySymbol: string;
}

export default function PhoneSimulator({
  onOrderPlaced,
  onRefreshState,
  conversations,
  activeConvoId,
  setActiveConvoId,
  currencySymbol,
}: PhoneSimulatorProps) {
  const { t } = useI18n();
  const [phoneNumber, setPhoneNumber] = useState("+491571234567");
  const [inputText, setInputText] = useState("");
  const [isQrConnected, setIsQrConnected] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [custLang, setCustLang] = useState<"de" | "ar" | "en">("de");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active chat thread
  const activeChat = conversations.find((c) => c.whatsAppPhone === phoneNumber);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChat?.messages, isTyping]);

  const handleQrConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsQrConnected(true);
      onRefreshState();
    }, 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend || inputText;
    if (!rawText.trim()) return;

    if (!textToSend) setInputText("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/bot-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          message: rawText,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Check if a new order was finalized in this transaction
        const lastStepBefore = activeChat?.currentStep;
        const currentStepAfter = data.conversation?.currentStep;

        if (lastStepBefore === "confirming" && currentStepAfter === "completed") {
          onOrderPlaced(); // Sound the doorbell alert!
        }
        
        onRefreshState();
      }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setIsTyping(false);
    }
  };

  // Submit mock feedback review rating
  const handleFeedbackSubmit = async (rating: number, comment: string) => {
    try {
      const response = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ord-" + Math.floor(100 + Math.random() * 900),
          rating,
          comment,
          customerName: activeChat?.customerName || "Gast " + phoneNumber.substring(phoneNumber.length - 4),
        }),
      });
      if (response.ok) {
        await handleSendMessage(
          custLang === "ar"
            ? `⭐ لقد قيمت الطلب بـ ${rating} نجوم! ${comment}`
            : custLang === "en"
            ? `⭐ I rated the order ${rating} stars! ${comment}`
            : `⭐ Ich habe die Bestellung mit ${rating} Sternen bewertet! ${comment}`
        );
        onRefreshState();
        if (rating === 5) {
          // Open mock Google review link
          setTimeout(() => {
            alert(
              custLang === "ar"
                ? "شكراً لتقييمك بـ 5 نجوم! سيتم الآن توجيهك لصفحة تقييمات Google لدعم مستر طابوش."
                : "Thank you for the 5-star review! You are now being guided to our official Google Maps reviewer page."
            );
          }, 600);
        }
      }
    } catch (err) {
      console.error("Feedback submit broken", err);
    }
  };

  return (
    <div className="w-full flex flex-col items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100 max-w-sm mx-auto shadow-sm">
      {/* Phone framing layout */}
      <div className="w-full h-[620px] bg-neutral-900 rounded-[3rem] p-3 shadow-2xl relative border-4 border-neutral-800 flex flex-col overflow-hidden">
        
        {/* Dynamic Speaker notch */}
        <div className="absolute top-[10px] left-1/2 transform -translate-x-1/2 w-32 h-6 bg-neutral-950 rounded-full z-20 flex items-center justify-between px-3">
          <div className="w-2 h-2 rounded-full bg-neutral-800"></div>
          <div className="w-16 h-1 bg-neutral-800 rounded-full"></div>
          <div className="w-3 h-3 rounded-full bg-blue-900 border border-neutral-900"></div>
        </div>

        {/* Screen layout */}
        <div className="w-full h-full bg-[#efeae2] rounded-[2.5rem] flex flex-col relative overflow-hidden text-neutral-800 pt-6">
          
          {/* Status Indicators bar */}
          <div className="w-full bg-[#075e54] text-white flex items-center justify-between px-6 py-1 z-10 text-[11px] font-medium">
            <span>20:46</span>
            <div className="flex items-center gap-1">
              <Wifi size={11} />
              <Battery size={11} className="rotate-270" />
            </div>
          </div>

          {!isQrConnected ? (
            /* QR scanner mode */
            <div className="flex-1 flex flex-col items-center justify-center bg-white p-5 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                <Smartphone size={30} />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900">{t("phone.qrTitle")}</h4>
              <p className="text-xs text-neutral-500 mt-1 mb-4">
                {t("phone.qrHint")}
              </p>

              {isConnecting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                  <span className="text-[11px] text-emerald-700 font-medium">{t("phone.pairing")}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="border-4 border-dashed border-gray-200 p-2 rounded-lg bg-gray-50 mb-4 cursor-pointer hover:border-emerald-500 transition duration-200" onClick={handleQrConnect}>
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=mrtabboush-wa-session"
                      alt="WhatsApp Web QR Code"
                      className="w-28 h-28"
                    />
                  </div>
                  <button
                    onClick={handleQrConnect}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs leading-none font-medium shadow-sm transition"
                  >
                    {t("phone.simulateLink")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Active WhatsApp chat screen */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* WhatsApp AppHeader bar */}
              <div className="bg-[#075e54] text-white px-3 py-2 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-1.5">
                  <button className="text-white hover:bg-[#128c7e] p-1 rounded-full" onClick={() => setIsQrConnected(false)}>
                    <ArrowLeft size={16} />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/30">
                    🌯
                  </div>
                  <div className="leading-tight">
                    <h3 className="font-semibold text-xs flex items-center gap-1">
                      MR. Tabboush Bot 
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    </h3>
                    <p className="text-[9px] text-[#b3e5fc]">{t("phone.onlineSystem")}</p>
                  </div>
                </div>
                
                {/* Contact phone toggler */}
                <select
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    onRefreshState();
                  }}
                  className="bg-emerald-900 border-none text-[10px] text-white py-0.5 px-1.5 rounded outline-none font-medium"
                >
                  <option value="+491571234567">+49 157 1234567 (Ahmad)</option>
                  <option value="+4917633221144">+49 176 33221144 (Thomas)</option>
                  <option value="+491789998888">+49 178 9998888 (Neuer Gast)</option>
                </select>
              </div>

              {/* Chat Thread message logs container */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 flex flex-col bg-[#e5ddd5] relative">
                
                {/* Safe info bubble */}
                <div className="bg-[#e1f5fe] text-neutral-700 text-[10px] rounded-lg p-2 text-center border border-[#b3e5fc] mx-6 self-center select-none shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
                  🔐 {t("phone.safeBubble")}
                </div>

                {activeChat && activeChat.messages.map((m) => {
                  const isBotOrAdmin = m.sender === "bot" || m.sender === "human";
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-xs shadow-[0_1px_1px_rgba(0,0,0,0.1)] relative flex flex-col ${
                        isBotOrAdmin
                          ? "bg-white text-neutral-800 self-start rounded-tl-none border border-neutral-100"
                          : "bg-[#dcf8c6] text-neutral-800 self-end rounded-tr-none"
                      }`}
                    >
                      {/* Badge if message was sent by manual Human override */}
                      {m.sender === "human" && (
                        <span className="text-[8px] uppercase tracking-wider text-amber-700 bg-amber-100 px-1 py-0.25 rounded self-start font-bold mb-0.5">
                          {t("phone.supportAgent")}
                        </span>
                      )}
                      
                      <div className="whitespace-pre-wrap leading-normal font-sans break-words">{m.text}</div>
                      
                      <div className="flex items-center gap-1 justify-end self-end text-[8px] text-neutral-400 mt-1 font-mono">
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {!isBotOrAdmin && <CheckCheck size={11} className="text-blue-500" />}
                      </div>
                    </div>
                  );
                })}

                {/* Simulated feedback micro panel triggers when order delivered */}
                {activeChat && activeChat.currentStep === "completed" && (
                  <div className="self-center w-full max-w-[85%] bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-lg flex flex-col items-center text-center gap-1.5 animate-bounce">
                    <div className="text-lg">🌟</div>
                    <h4 className="text-xs font-semibold text-amber-900 leading-none">{t("phone.rate")}</h4>
                    <p className="text-[10px] text-amber-700 leading-snug">
                      {t("phone.rateHint")}
                    </p>
                    <div className="flex gap-1.5 my-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => {
                            const c = prompt(
                              custLang === "ar"
                                ? "أدخل تعليقك لمساعدتنا على التطور:"
                                : t("phone.feedbackPrompt")
                            ) || "";
                            handleFeedbackSubmit(star, c);
                          }}
                          className="hover:scale-125 transition text-amber-500"
                        >
                          <Star size={16} fill="#f59e0b" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isTyping && (
                  <div className="bg-white rounded-lg px-2.5 py-1.5 text-xs shadow-sm self-start flex items-center gap-1.5">
                    <span className="text-[10px] text-emerald-600 font-medium font-sans">{t("phone.botTyping")}</span>
                    <span className="flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce delay-100"></span>
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce delay-200"></span>
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce delay-300"></span>
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Bot Step Cheat Sheets */}
              <div className="bg-neutral-100 border-t border-neutral-200 px-2.5 py-1.5 flex flex-wrap gap-1 items-center justify-center">
                <span className="text-[9px] font-bold text-neutral-500 uppercase">{t("phone.shortcuts")}</span>
                <button
                  onClick={() => handleSendMessage(custLang === "ar" ? "أهلاً" : "Hallo")}
                  className="bg-white hover:bg-emerald-50 border border-neutral-200 text-neutral-700 text-[10px] font-medium leading-none px-2 py-1 rounded transition whitespace-nowrap active:scale-95"
                >
                  💬 {t("phone.start")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("1")}
                  className="bg-white hover:bg-emerald-50 border border-neutral-200 text-neutral-700 text-[10px] font-medium leading-none px-2 py-1 rounded transition active:scale-95"
                >
                  🛵 {t("orders.delivery")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("Berliner Str. 110, Wuppertal")}
                  className="bg-white hover:bg-emerald-50 border border-neutral-200 text-neutral-700 text-[10px] font-medium leading-none px-2 py-1 rounded transition active:scale-95"
                >
                  📍 {t("phone.address")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("1")}
                  className="bg-white hover:bg-emerald-50 border border-neutral-200 text-neutral-700 text-[10px] font-medium leading-none px-2 py-1 rounded transition active:scale-95"
                >
                  🌯 {t("phone.choose1")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(custLang === "ar" ? "نعم" : "Ja")}
                  className="bg-white hover:bg-emerald-50 border border-neutral-200 text-neutral-700 text-[10px] font-medium leading-none px-2 py-1 rounded transition active:scale-95 animate-pulse"
                >
                  ✅ {t("phone.confirm")}
                </button>
              </div>

              {/* Interactive bottom chat send bar */}
              <div className="bg-[#f0f0f0] p-2 flex items-center justify-between gap-1.5 border-t border-neutral-200">
                
                {/* Language selection switches */}
                <div className="flex gap-0.5">
                  {(["ar", "de", "en"] as const).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setCustLang(tag)}
                      className={`w-5 h-5 rounded-md text-[8px] font-bold border flex items-center justify-center uppercase leading-none transition ${
                        custLang === tag
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-100"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder={
                      custLang === "ar"
                        ? "اكتب رسالة..."
                        : custLang === "en"
                        ? "Type a message..."
                        : t("phone.input")
                    }
                    className="w-full bg-white text-xs py-2 pl-3 pr-8 rounded-full outline-none border border-neutral-200 focus:border-emerald-500 transition duration-150 shadow-inner"
                  />
                </div>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition active:scale-95 ${
                    inputText.trim() ? "bg-[#0b6656] hover:bg-[#075e54]" : "bg-neutral-300"
                  }`}
                >
                  <Send size={13} className="ml-0.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
