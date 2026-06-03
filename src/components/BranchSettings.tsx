import React, { useState, useEffect } from "react";
import { Store, MapPin, Clock, Bike, CreditCard, Save, Loader2, CheckCircle2 } from "lucide-react";

interface Branch {
  _id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  openingHours: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minOrderAmount: number;
}

export default function BranchSettings() {
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
      const res = await fetch("/api/branches");
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
        headers: { "Content-Type": "application/json" },
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
        <span className="text-xs text-gray-500">Loading branch settings...</span>
      </div>
    );
  }

  if (!selectedBranch) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <Store size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No branches found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Branch Settings</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage delivery, pickup, and branch info</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={14} />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Branch selector */}
      {branches.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">Select Branch</label>
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
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">General Info</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Branch Name</label>
            <input
              type="text"
              value={selectedBranch.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Phone</label>
            <input
              type="text"
              value={selectedBranch.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Opening Hours</label>
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
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} className="text-red-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Address</h4>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Street Address</label>
            <input
              type="text"
              value={selectedBranch.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">City</label>
              <input
                type="text"
                value={selectedBranch.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Postal Code</label>
              <input
                type="text"
                value={selectedBranch.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Country</label>
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
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Delivery Settings</h4>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBranch.deliveryEnabled}
                onChange={(e) => updateField("deliveryEnabled", e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Delivery Enabled</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Radius (km)</label>
              <input
                type="number"
                step="0.1"
                value={selectedBranch.deliveryRadiusKm}
                onChange={(e) => updateField("deliveryRadiusKm", parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Fee (€)</label>
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
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Min Order (€)</label>
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
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Pickup & Payment</h4>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBranch.pickupEnabled}
                onChange={(e) => updateField("pickupEnabled", e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Pickup Enabled</span>
            </label>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500">
              Payment methods are currently managed per branch. The system supports Cash on Delivery and Cash on Pickup by default.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
