import React, { useState, useEffect } from "react";
import { Store, MapPin, Clock, Bike, CreditCard, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";

interface Branch {
  _id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  openingHours: string;
  closedDays?: number[];
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minOrderAmount: number;
  printerSettings?: {
    type?: "network" | "usb";
    ip?: string;
    port?: number;
    vendorId?: string;
    productId?: string;
    width?: "58mm" | "80mm";
    modelName?: string;
    autoPrint?: boolean;
    buzzer?: boolean;
  };
}

export default function BranchSettings() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setBranches(data);
      if (data.length > 0) setSelectedBranch(data[0]);
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/branches/${selectedBranch._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(selectedBranch),
      });
      if (res.ok) {
        const updated = await res.json();
        setBranches((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
        setSelectedBranch(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save branch:", err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Branch, value: any) => {
    if (!selectedBranch) return;
    setSelectedBranch({ ...selectedBranch, [field]: value });
  };

  const updatePrinterField = (field: string, value: any) => {
    if (!selectedBranch) return;
    const currentSettings = selectedBranch.printerSettings || {};
    setSelectedBranch({
      ...selectedBranch,
      printerSettings: {
        ...currentSettings,
        [field]: value,
      },
    });
  };

  const [testingPrint, setTestingPrint] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestPrint = async () => {
    if (!selectedBranch) return;
    setTestingPrint(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/branches/${selectedBranch._id}/test-print`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setTestResult("Test job dispatched!");
      } else {
        setTestResult("Error sending test job.");
      }
    } catch (err) {
      setTestResult("Request failed.");
    } finally {
      setTestingPrint(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
        <span className="text-xs text-gray-500">{t("branch.loading")}</span>
      </div>
    );
  }

  if (!selectedBranch) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <Store size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t("branch.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("branch.title")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t("branch.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={14} />
              {t("common.saved")}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {t("common.saveChanges")}
          </button>
        </div>
      </div>

      {/* Branch selector */}
      {branches.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">{t("branch.select")}</label>
          <select
            value={selectedBranch._id}
            onChange={(e) => {
              const b = branches.find((x) => x._id === e.target.value);
              if (b) setSelectedBranch(b);
            }}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
          >
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* General Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Store size={16} className="text-orange-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("branch.general")}</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("branch.branchName")}</label>
            <input
              type="text"
              value={selectedBranch.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.phone")}</label>
            <input
              type="text"
              value={selectedBranch.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("branch.openingHours")}</label>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <input
                type="text"
                value={selectedBranch.openingHours}
                onChange={(e) => updateField("openingHours", e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{t("branch.closedDays")}</label>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => {
                const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const dayLabel = t(`days.${dayKeys[dayNum]}`);
                const isClosed = selectedBranch.closedDays?.includes(dayNum) || false;
                
                const handleToggle = () => {
                  const currentClosed = selectedBranch.closedDays || [];
                  const updatedClosed = isClosed
                    ? currentClosed.filter((d: number) => d !== dayNum)
                    : [...currentClosed, dayNum];
                  updateField("closedDays", updatedClosed);
                };

                return (
                  <label key={dayNum} className="flex items-center gap-1 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg py-1 px-2 transition text-xs">
                    <input
                      type="checkbox"
                      checked={isClosed}
                      onChange={handleToggle}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3 h-3"
                    />
                    <span>{dayLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} className="text-red-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("common.address")}</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("branch.street")}</label>
            <input
              type="text"
              value={selectedBranch.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.city")}</label>
              <input
                type="text"
                value={selectedBranch.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.postalCode")}</label>
              <input
                type="text"
                value={selectedBranch.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.country")}</label>
            <input
              type="text"
              value={selectedBranch.country}
              onChange={(e) => updateField("country", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bike size={16} className="text-blue-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("branch.deliverySettings")}</h4>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBranch.deliveryEnabled}
                onChange={(e) => updateField("deliveryEnabled", e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">{t("branch.deliveryEnabled")}</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("branch.radius")}</label>
              <input
                type="number"
                step="0.1"
                value={selectedBranch.deliveryRadiusKm}
                onChange={(e) => updateField("deliveryRadiusKm", parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("branch.fee")}</label>
              <input
                type="number"
                step="0.01"
                value={selectedBranch.deliveryFee}
                onChange={(e) => updateField("deliveryFee", parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("branch.minOrder")}</label>
            <input
              type="number"
              step="0.01"
              value={selectedBranch.minOrderAmount}
              onChange={(e) => updateField("minOrderAmount", parseFloat(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Pickup Settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={16} className="text-emerald-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("branch.pickupPayment")}</h4>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBranch.pickupEnabled}
                onChange={(e) => updateField("pickupEnabled", e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">{t("branch.pickupEnabled")}</span>
            </label>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500">
              {t("branch.paymentNote")}
            </p>
          </div>
        </div>

        {/* Printer Settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Store size={16} className="text-purple-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("printer.settings")}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Connection Type</label>
              <select
                value={selectedBranch.printerSettings?.type || "network"}
                onChange={(e) => updatePrinterField("type", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="network">Network / LAN (TCP/IP)</option>
                <option value="usb">USB Port</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Printer Model Name</label>
              <input
                type="text"
                placeholder="EPSON TM-T20III"
                value={selectedBranch.printerSettings?.modelName || ""}
                onChange={(e) => updatePrinterField("modelName", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("printer.paperWidth")}</label>
              <select
                value={selectedBranch.printerSettings?.width || "80mm"}
                onChange={(e) => updatePrinterField("width", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </div>
          </div>

          {/* Conditional parameters based on type */}
          {(selectedBranch.printerSettings?.type || "network") === "network" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-50 pt-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Printer IP Address</label>
                <input
                  type="text"
                  placeholder="192.168.1.150"
                  value={selectedBranch.printerSettings?.ip || ""}
                  onChange={(e) => updatePrinterField("ip", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Printer Port</label>
                <input
                  type="number"
                  placeholder="9100"
                  value={selectedBranch.printerSettings?.port || 9100}
                  onChange={(e) => updatePrinterField("port", parseInt(e.target.value) || 9100)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-50 pt-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">USB Vendor ID (Hex)</label>
                <input
                  type="text"
                  placeholder="0x04b8"
                  value={selectedBranch.printerSettings?.vendorId || ""}
                  onChange={(e) => updatePrinterField("vendorId", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">USB Product ID (Hex)</label>
                <input
                  type="text"
                  placeholder="0x0202"
                  value={selectedBranch.printerSettings?.productId || ""}
                  onChange={(e) => updatePrinterField("productId", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 border-t border-gray-100 pt-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBranch.printerSettings?.autoPrint !== false}
                onChange={(e) => updatePrinterField("autoPrint", e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
              />
              <div className="leading-tight">
                <span className="text-xs font-semibold text-gray-700 block">Auto-Print incoming orders</span>
                <span className="text-[10px] text-gray-400 block">Print orders instantly when they are confirmed</span>
              </div>
            </label>

            <label className="flex items-center gap-2 cursor-pointer sm:ml-6">
              <input
                type="checkbox"
                checked={selectedBranch.printerSettings?.buzzer !== false}
                onChange={(e) => updatePrinterField("buzzer", e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
              />
              <div className="leading-tight">
                <span className="text-xs font-semibold text-gray-700 block">Trigger kitchen buzzer</span>
                <span className="text-[10px] text-gray-400 block">Sound an alarm trigger on the printer upon receipt</span>
              </div>
            </label>
          </div>

          <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-4">
            <div className="text-[10px] text-gray-500 leading-snug">
              Connection Status: Connect the standalone local print bridge to Room <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[9px]">branch:{selectedBranch._id}:printer</code> to process prints.
            </div>
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={testingPrint}
              className="px-4 py-2 border border-purple-200 hover:border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
            >
              {testingPrint ? <Loader2 size={12} className="animate-spin" /> : null}
              Send Test Print
            </button>
          </div>
          {testResult && (
            <div className={`text-xs font-bold mt-2 ${testResult.includes("dispatched") ? "text-emerald-600" : "text-rose-600"}`}>
              {testResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
