import React, { useState } from "react";
import { Printer, Settings, Volume2, CheckCircle2, RotateCw, Wifi } from "lucide-react";
import { Order } from "../types";
import { useI18n } from "../i18n";

interface ThermalPrinterProps {
  activeOrderToPrint: Order | null;
  autoPrintEnabled: boolean;
  onToggleAutoPrint: (enabled: boolean) => void;
  currencySymbol: string;
}

export default function ThermalPrinter({
  activeOrderToPrint,
  autoPrintEnabled,
  onToggleAutoPrint,
  currencySymbol,
}: ThermalPrinterProps) {
  const { t, text } = useI18n();
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [printerLogs, setPrinterLogs] = useState<string[]>([
    "Prn-Svr connected to port 9100 on 192.168.1.150",
    "Auto-Print daemon active",
  ]);

  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);

  const simulateTestBuzzer = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch whistle
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      
      setTimeout(() => {
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      }, 150);
      
      osc.stop(audioCtx.currentTime + 0.35);
      
      setPrinterLogs((prev) => [`[${new Date().toLocaleTimeString()}] Buzzer alarm signal: OK`, ...prev]);
    } catch (e) {
      console.warn("Audio blocked");
    }
  };

  const handlePrintAction = () => {
    if (!activeOrderToPrint) return;
    setIsSimulatingPrint(true);
    if (buzzerEnabled) {
      simulateTestBuzzer();
    }
    
    setTimeout(() => {
      setIsSimulatingPrint(false);
      setPrinterLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Print SUCCESS: ${activeOrderToPrint.orderNumber}`,
        ...prev,
      ]);
    }, 1500);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">
      
      {/* Printer settings & connectivity panel */}
      <div className="md:col-span-5 flex flex-col bg-white p-5 rounded-xl border border-gray-100 shadow-sm gap-4 h-full">
        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-3">
          <Settings size={14} className="text-orange-500 animate-spin-slow" />
          {t("printer.settings")}
        </h4>

        {/* IP connection status */}
        <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-100 rounded-lg">
          <div className="flex items-center gap-2">
            <Wifi size={14} className="text-emerald-500" />
            <div className="leading-tight">
              <span className="text-xs font-semibold text-neutral-800">EPSON TM-T88VI</span>
              <span className="block text-[9px] font-mono text-gray-400">IP: 192.168.1.150 (Port 9100)</span>
            </div>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
            {t("printer.online")}
          </span>
        </div>

        {/* Form controls */}
        <div className="space-y-3.5 text-xs text-neutral-700">
          
          <div className="flex items-center justify-between">
            <label className="font-medium">{t("printer.paperWidth")}:</label>
            <div className="flex gap-1">
              {(["58mm", "80mm"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={`px-3 py-1 text-[10px] font-bold rounded transit ${
                    paperWidth === w
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-100 text-gray-600 hover:bg-neutral-200"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium block">{t("printer.autoPrint")}:</span>
              <span className="text-[10px] text-gray-400 block">{t("printer.autoPrintHint")}</span>
            </div>
            
            <input
              type="checkbox"
              checked={autoPrintEnabled}
              onChange={(e) => onToggleAutoPrint(e.target.checked)}
              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <span className="font-medium block text-neutral-800">{t("printer.buzzer")}:</span>
              <span className="text-[9px] text-gray-400 block">{t("printer.buzzerHint")}</span>
            </div>
            
            <input
              type="checkbox"
              checked={buzzerEnabled}
              onChange={(e) => setBuzzerEnabled(e.target.checked)}
              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={simulateTestBuzzer}
              className="w-full py-2 border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-[10px] rounded font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition"
            >
              <Volume2 size={13} />
              {t("printer.testBuzzer")}
            </button>
          </div>
        </div>

        {/* Embedded terminal prints */}
        <div className="flex-1 flex flex-col pt-3 border-t border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
            {t("printer.logs")}:
          </span>
          <div className="flex-1 bg-black text-emerald-400 font-mono text-[9px] p-2.5 rounded-lg overflow-y-auto space-y-1 h-36">
            {printerLogs.map((log, i) => (
              <div key={i} className="leading-snug break-all">{log}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual thermal receipt paper emulator wrapper */}
      <div className="md:col-span-7 flex flex-col bg-[#e1e2e4] p-5 rounded-2xl border border-neutral-300 justify-start items-center overflow-y-auto max-h-[550px] relative">
        
        {activeOrderToPrint ? (
          <div className="w-full flex flex-col items-center">
            
            {/* Control Print floating trigger */}
            <button
              onClick={handlePrintAction}
              disabled={isSimulatingPrint}
              className="mb-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2 px-5 rounded-xl shadow-lg flex items-center gap-2 transition leading-none active:scale-95 disabled:bg-neutral-400 cursor-pointer"
            >
              {isSimulatingPrint ? (
                <>
                  <RotateCw size={13} className="animate-spin" />
                  {t("printer.printing")}
                </>
              ) : (
                <>
                  <Printer size={13} />
                  {t("printer.printCopy", { width: paperWidth })}
                </>
              )}
            </button>

            {/* Thermal paper visual sheet design */}
            <div
              className={`bg-white text-black p-6 shadow-2xl relative border-neutral-45 border-t-8 border-b-8 font-mono text-xs flex flex-col ${
                paperWidth === "58mm" ? "w-[240px] px-3 text-[10px]" : "w-[300px]"
              }`}
              style={{
                filter: isSimulatingPrint ? "contrast(1.5) opacity(0.75)" : "none",
                transition: "filter 0.5s ease"
              }}
            >
              {/* Jagged border helper using styling rules */}
              <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-[linear-gradient(45deg,transparent_33.33%,#fff_33.33%,#fff_66.66%,transparent_66.66%),linear-gradient(-45deg,transparent_33.33%,#fff_33.33%,#fff_66.66%,transparent_66.66%)] bg-[size:6px_6px]"></div>

              {/* Header Title alignment */}
              <div className="text-center space-y-1 pb-4 border-b border-dashed border-neutral-400">
                <span className="text-base font-bold uppercase tracking-wider block">MR. TABBOUSH</span>
                <span className="text-[10px] block font-serif"> Damascus Fine Dining</span>
                <span className="text-[9px] block">Berliner Str. 179, Wuppertal</span>
                <span className="text-[9px] block">Tel: +49 202 1234567</span>
              </div>

              {/* Order specifications */}
              <div className="py-3 border-b border-dashed border-neutral-400 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{t("printer.order").toUpperCase()}#: {activeOrderToPrint.orderNumber}</span>
                  <span className="uppercase text-[9px] bg-neutral-200 px-1 rounded">
                    {activeOrderToPrint.orderType}
                  </span>
                </div>
                <div>{t("printer.date").toUpperCase()}: {new Date(activeOrderToPrint.createdAt).toLocaleDateString()} {new Date(activeOrderToPrint.createdAt).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</div>
                <div>{t("printer.customer").toUpperCase()}: {activeOrderToPrint.customerName}</div>
                <div>{t("printer.tel").toUpperCase()}: {activeOrderToPrint.whatsAppPhone}</div>
                
                {/* Specific coordinates */}
                {activeOrderToPrint.orderType === "delivery" ? (
                  <div className="border-t border-neutral-200 pt-1 text-[9px] leading-snug">
                    <span className="font-bold">{t("printer.deliveryAddr").toUpperCase()}:</span>
                    <p className="whitespace-normal">{activeOrderToPrint.deliveryAddress}</p>
                  </div>
                ) : (
                  <div className="border-t border-neutral-200 pt-1 text-[9px]">
                    <span className="font-bold">{t("printer.pickupTime").toUpperCase()}:</span> {activeOrderToPrint.pickupTime || t("common.asap")}
                  </div>
                )}
              </div>

              {/* Cart Items listing */}
              <div className="py-3 border-b border-dashed border-neutral-400 space-y-2">
                <div className="flex justify-between font-bold text-[10px] uppercase text-neutral-500">
                  <span>{t("printer.description").toUpperCase()}</span>
                  <span>{t("common.total").toUpperCase()}</span>
                </div>
                
                {activeOrderToPrint.items.map((item, id) => (
                  <div key={id} className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between font-bold">
                      <span>{item.quantity}x {text(item.name)}</span>
                      <span>{item.totalPrice.toFixed(2)}{currencySymbol}</span>
                    </div>
                    {item.selectedModifiers.map((mod, mId) => (
                      <div key={mId} className="text-[9px] text-neutral-600 pl-2">
                        + {text(mod.groupName)}: {text(mod.option.name)}
                      </div>
                    ))}
                    {item.selectedUpsell && (
                      <div className="text-[9px] text-neutral-600 pl-2">
                        + {t("orders.combo")}: {text(item.selectedUpsell.name)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals Summary */}
              <div className="py-3 border-b border-dashed border-neutral-400 space-y-1 text-right">
                <div className="flex justify-between">
                  <span>{t("common.subtotal").toUpperCase()}:</span>
                  <span>{activeOrderToPrint.subtotal.toFixed(2)}{currencySymbol}</span>
                </div>
                {activeOrderToPrint.orderType === "delivery" && (
                  <div className="flex justify-between">
                    <span>{t("common.deliveryFee").toUpperCase()}:</span>
                    <span>{activeOrderToPrint.deliveryFee.toFixed(2)}{currencySymbol}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-neutral-200 pt-1 text-sm">
                  <span>{t("printer.grandTotal").toUpperCase()}:</span>
                  <span>{activeOrderToPrint.total.toFixed(2)}{currencySymbol}</span>
                </div>
              </div>

              {/* Cash stamp validation info */}
              <div className="pt-4 text-center space-y-2">
                <div className="p-1 px-4 border border-black inline-block font-bold text-xs uppercase rotate-[-2deg] tracking-widest text-[#000] border-dashed">
                  💰 {t("printer.cash").toUpperCase()}
                </div>
                <div className="text-[9px] leading-snug">
                  {t("printer.thanks")}<br />
                  شكرًا عظيمًا لطلبكم من مستر طابوش!
                </div>
                
                {/* Visual printed barcode simulator */}
                <div className="flex flex-col items-center pt-2 gap-1 justify-center">
                  <div className="h-6 w-36 bg-[repeating-linear-gradient(90deg,#000,#000_1px,transparent_1px,transparent_3px,#000_3px,#000_5px,transparent_5px,transparent_6px)]"></div>
                  <span className="text-[8px] font-mono tracking-widest">*{activeOrderToPrint.id.substring(4)}*</span>
                </div>
              </div>

              <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 bg-[linear-gradient(45deg,transparent_33.33%,#fff_33.33%,#fff_66.66%,transparent_66.66%),linear-gradient(-45deg,transparent_33.33%,#fff_33.33%,#fff_66.66%,transparent_66.66%)] bg-[size:6px_6px]"></div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center text-xs">
            <Printer size={40} className="stroke-1 text-neutral-300 mb-2" />
            {t("printer.empty")}<br />
            {t("printer.emptyHint")}
          </div>
        )}
      </div>

    </div>
  );
}
