import React, { useState } from "react";
import { Check, Clock, Truck, Play, ShieldAlert, X, Printer, MapPin, User, CheckCircle2, ChevronRight, Volume2, Utensils } from "lucide-react";
import { Order, OrderStatus } from "../types";
import { useI18n } from "../i18n";
import { isWhatsAppPhone } from "../utils/whatsappContact";

interface LiveOrdersListProps {
  orders: Order[];
  onUpdateStatus: (id: string, nextStatus: OrderStatus) => void;
  onSelectPrintOrder: (order: Order) => void;
  currencySymbol: string;
}

export default function LiveOrdersList({
  orders,
  onUpdateStatus,
  onSelectPrintOrder,
  currencySymbol,
}: LiveOrdersListProps) {
  const { t, text } = useI18n();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orders[0]?.id || null);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const statusColors: { [key in OrderStatus]: { bg: string; text: string; label: string } } = {
    received: { bg: "bg-red-50", text: "text-red-700 border-red-200", label: t("status.received") },
    under_review: { bg: "bg-indigo-50", text: "text-indigo-700 border-indigo-200", label: t("status.under_review") },
    accepted: { bg: "bg-blue-50", text: "text-blue-700 border-blue-200", label: t("status.accepted") },
    preparing: { bg: "bg-orange-100", text: "text-orange-600 border-orange-200", label: t("status.preparing") },
    ready_for_pickup: { bg: "bg-yellow-50", text: "text-yellow-700 border-yellow-200", label: t("status.ready_for_pickup") },
    out_for_delivery: { bg: "bg-purple-50", text: "text-purple-700 border-purple-200", label: t("status.out_for_delivery") },
    delivered: { bg: "bg-emerald-50", text: "text-emerald-700 border-emerald-200", label: t("status.delivered") },
    cancelled: { bg: "bg-neutral-100", text: "text-neutral-500 border-neutral-200", label: t("status.cancelled") },
  };

  const toAmount = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const money = (value: unknown): string => toAmount(value).toFixed(2);

  const getItemTotal = (item: any): number => {
    if (Number.isFinite(Number(item?.totalPrice))) return Number(item.totalPrice);

    const base = toAmount(item?.basePrice) * Math.max(1, toAmount(item?.quantity) || 1);
    const modifiersTotal = Array.isArray(item?.selectedModifiers)
      ? item.selectedModifiers.reduce((sum: number, mod: any) => sum + toAmount(mod?.option?.priceAdjustment), 0)
      : 0;
    const upsellTotal = toAmount(item?.selectedUpsell?.price);

    return base + modifiersTotal + upsellTotal;
  };

  const getOrderItems = (order?: Order | null) => Array.isArray(order?.items) ? order.items : [];

  const getOrderSubtotal = (order: Order): number => {
    if (Number.isFinite(Number(order.subtotal))) return Number(order.subtotal);
    return getOrderItems(order).reduce((sum, item) => sum + getItemTotal(item), 0);
  };

  const getOrderTotal = (order: Order): number => {
    if (Number.isFinite(Number(order.total))) return Number(order.total);
    return getOrderSubtotal(order) + toAmount(order.deliveryFee);
  };

  const getStatusInfo = (status?: OrderStatus) => (
    status && statusColors[status]
      ? statusColors[status]
      : { bg: "bg-gray-50", text: "text-gray-500 border-gray-200", label: status || t("common.status") }
  );

  const getOrderStatusFlow = (status: OrderStatus, type: "delivery" | "pickup" | "dine_in"): OrderStatus[] => {
    if (status === "cancelled" || status === "delivered") return [];
    if (status === "received") return ["accepted", "cancelled"];
    if (status === "accepted") return ["preparing", "cancelled"];
    if (status === "preparing") {
      return type === "delivery" ? ["out_for_delivery"] : (type === "dine_in" ? ["delivered"] : ["ready_for_pickup"]);
    }
    if (status === "ready_for_pickup" || status === "out_for_delivery") return ["delivered"];
    return [];
  };

  // Sound generator
  const triggerDoorbellSpeaker = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      
      setTimeout(() => {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      }, 250);
      
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Web audio blocked by iframe bounds");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full min-h-[500px]">
      
      {/* Sidebar List panel */}
      <div className="md:col-span-5 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full max-h-[550px]">
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">{t("orders.liveQueue")}</h3>
            <span className="bg-red-100 text-red-700 text-[10px] leading-none px-2 py-0.5 rounded-full font-bold">
              {orders.filter((o) => o.status === "received" || o.status === "preparing").length} {t("common.active")}
            </span>
          </div>
          <button
            onClick={triggerDoorbellSpeaker}
            className="p-1 px-1.5 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200 rounded text-[10px] font-semibold flex items-center gap-1 transition"
            title={t("orders.alertSound")}
          >
            <Volume2 size={12} />
            {t("orders.alertSound")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              {t("orders.empty")}
            </div>
          ) : (
            orders.map((order) => {
              const info = getStatusInfo(order.status);
              const isSelected = order.id === selectedOrderId;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`p-3.5 cursor-pointer flex flex-col gap-2 transition duration-150 ${
                    isSelected ? "bg-orange-50/50 border-l-4 border-orange-500" : "hover:bg-neutral-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-gray-900">
                      {order.orderNumber}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-700 font-medium">
                    <span className="flex items-center gap-1.5 max-w-[140px] truncate text-neutral-900">
                      <User size={12} className="text-gray-400" />
                      {order.customerName}
                    </span>
                    <span className="font-bold text-neutral-900">
                      {money(getOrderTotal(order))}{currencySymbol}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-[9px] uppercase tracking-wider font-semibold border px-2 py-0.5 rounded-full ${
                      order.orderType === "delivery"
                        ? "bg-orange-100 text-orange-800 border-orange-200"
                        : order.orderType === "dine_in"
                        ? "bg-blue-100 text-blue-800 border-blue-200"
                        : "bg-emerald-100 text-emerald-850 border-emerald-200"
                    }`}>
                      {order.orderType === "delivery"
                        ? `🛵 ${t("orders.delivery")}`
                        : order.orderType === "dine_in"
                        ? `🍽️ ${t("orders.dineIn")} (${t("orders.table")} ${order.tableNumber})`
                        : `📦 ${t("orders.pickup")}`}
                    </span>
                    
                    <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded ${info.bg} ${info.text}`}>
                      {info.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Order Details & Geolocation checker Panel */}
      <div className="md:col-span-7 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full max-h-[550px]">
        {selectedOrder ? (
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Header section with printing action */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-950 font-mono flex items-center gap-1.5">
                  {t("orders.details")}: {selectedOrder.orderNumber}
                </h4>
                <p className="text-[10px] text-gray-400">
                  {t("orders.placedVia", { date: new Date(selectedOrder.createdAt).toLocaleDateString(), time: new Date(selectedOrder.createdAt).toLocaleTimeString() })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectPrintOrder(selectedOrder)}
                  className="px-3 py-1.5 border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition leading-none"
                >
                  <Printer size={13} />
                  {t("orders.printReceipt")}
                </button>
              </div>
            </div>

            {/* Scrolling itemized list details */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Quick Status Bar */}
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="text-xs font-semibold text-neutral-800">
                    {t("orders.currentStatus")}: <span className="uppercase text-orange-700 font-mono">{getStatusInfo(selectedOrder.status).label}</span>
                  </span>
                </div>
                
                {/* Geocode distance calculation simulator display */}
                {selectedOrder.orderType === "delivery" && (
                  <div className="text-right leading-none">
                    <span className="text-[10px] bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-bold uppercase inline-block">
                      📍 {t("orders.radiusChecked")}
                    </span>
                    <span className="text-[9px] block text-gray-400 mt-1 font-mono">{t("orders.distance")}</span>
                  </div>
                )}
              </div>

              {/* Customer summary */}
              <div>
                <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">{t("orders.customerContext")}</h5>
                <div className="grid grid-cols-2 gap-3 text-xs p-3.5 bg-neutral-55/40 border border-neutral-100 rounded-lg bg-neutral-50/50">
                  <div>
                    <span className="text-gray-400 block">{t("common.name")}:</span>
                    <span className="font-semibold text-gray-800">{selectedOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">
                      {isWhatsAppPhone(selectedOrder.whatsAppPhone) ? t("orders.whatsappPhone") : "WhatsApp ID"}:
                    </span>
                    <span className="font-mono font-semibold text-gray-800">{selectedOrder.whatsAppPhone}</span>
                  </div>
                  {selectedOrder.orderType === "delivery" ? (
                    <div className="col-span-2 border-t border-gray-100 pt-2.5 flex items-start gap-1">
                      <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block">{t("orders.deliveryAddress")}:</span>
                        <span className="font-medium text-gray-800">{selectedOrder.deliveryAddress}</span>
                      </div>
                    </div>
                  ) : selectedOrder.orderType === "dine_in" ? (
                    <div className="col-span-2 border-t border-gray-100 pt-2.5 flex items-start gap-1">
                      <Utensils size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block">{t("orders.tableNumber")}:</span>
                        <span className="font-semibold text-gray-800">{selectedOrder.tableNumber}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-2 border-t border-gray-100 pt-2.5 flex items-start gap-1">
                      <Clock size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-400 block">{t("orders.pickupTime")}:</span>
                        <span className="font-semibold text-gray-800">{selectedOrder.pickupTime || t("common.asap")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Breakdown details */}
              <div>
                <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">{t("orders.orderedDishes")}</h5>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 overflow-hidden text-xs">
                  {getOrderItems(selectedOrder).map((item, idx) => (
                    <div key={idx} className="p-3 bg-white flex flex-col gap-1">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-gray-900 font-bold">
                          {item.quantity || 1}x {text(item.name)}
                        </span>
                        <span className="font-bold text-gray-950 font-mono">
                          {money(getItemTotal(item))}{currencySymbol}
                        </span>
                      </div>
                      
                      {/* Modifiers List */}
                      {(item.selectedModifiers || []).map((mod, mIdx) => (
                        <div key={mIdx} className="text-[11px] text-gray-500 ml-3 flex justify-between">
                          <span>└ ➕ {text(mod.groupName)}: {text(mod.option?.name)}</span>
                          {toAmount(mod.option?.priceAdjustment) > 0 && (
                            <span>+{money(mod.option?.priceAdjustment)}{currencySymbol}</span>
                          )}
                        </div>
                      ))}

                      {/* Upsell Sugesstion details */}
                      {item.selectedUpsell && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-100 ml-3 flex justify-between mt-1 items-center">
                          <span className="font-medium">└ ⚡ {t("orders.combo")}: {text(item.selectedUpsell.name)}</span>
                          <span className="font-bold font-mono">+{money(item.selectedUpsell.price)}{currencySymbol}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Total Calculations summary */}
                  <div className="p-3 bg-neutral-50/50 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>{t("common.subtotal")}:</span>
                      <span className="font-mono">{money(getOrderSubtotal(selectedOrder))}{currencySymbol}</span>
                    </div>
                    {selectedOrder.orderType === "delivery" && (
                      <div className="flex justify-between text-gray-500">
                        <span>{t("orders.deliveryFeeRadius")}:</span>
                        <span className="font-mono">{money(selectedOrder.deliveryFee)}{currencySymbol}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-900 font-bold border-t border-gray-100 pt-2 text-sm">
                      <span>{t("common.total")}:</span>
                      <span className="font-mono text-orange-600">{money(getOrderTotal(selectedOrder))}{currencySymbol}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-medium">
                      💶 {t("common.paymentMethod")}: *{selectedOrder.paymentMethod}*
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div>
                  <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">{t("orders.customerNote")}</h5>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-xs text-orange-850 italic">
                    "{selectedOrder.notes}"
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions flow footer */}
            <div className="p-4 bg-neutral-50 border-t border-gray-100 flex flex-wrap gap-2 items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                {t("orders.flowControl")}:
              </span>
              
              <div className="flex gap-2">
                {getOrderStatusFlow(selectedOrder.status, selectedOrder.orderType).map((nextSt) => {
                  const info = getStatusInfo(nextSt);
                  return (
                    <button
                      key={nextSt}
                      onClick={() => {
                        onUpdateStatus(selectedOrder.id, nextSt);
                        triggerDoorbellSpeaker();
                      }}
                      className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition leading-none active:scale-95 shadow-sm"
                    >
                      <Play size={12} className="fill-current" />
                      {t("orders.markStatus", { status: info.label })}
                    </button>
                  );
                })}

                {selectedOrder.status !== "cancelled" && selectedOrder.status !== "delivered" && (
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedOrder.id, "cancelled");
                      triggerDoorbellSpeaker();
                    }}
                    className="px-3.5 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition leading-none active:scale-95"
                  >
                    <X size={12} />
                    {t("orders.cancel")}
                  </button>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <Clock size={40} className="stroke-1 text-gray-300 mb-2" />
            {t("orders.select")}
          </div>
        )}
      </div>

    </div>
  );
}
