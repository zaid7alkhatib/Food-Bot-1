import React from "react";
import { useI18n } from "../i18n";
import { Info, Server, Shield, Database, Cpu, Award } from "lucide-react";

export default function SystemInfo() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-50 text-orange-500 rounded-xl">
            <Info size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {t("nav.systemInfo") || "System Info"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Farman FoodSuite Platform Status and Technical Auditing Specifications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-xl border border-emerald-100/60 font-mono text-xs font-bold uppercase tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Active / Certified
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specifications Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3 select-none">
            <Cpu size={14} className="text-orange-500" />
            Software & Environment Specifications
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Platform Suite:</span>
              <span className="font-bold text-slate-800">Farman FoodSuite v1.0</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Node.js Engine:</span>
              <span className="font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-700">v20 (LTS)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Database Engine:</span>
              <span className="font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-700">MongoDB Community v7.0</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Hosting Infrastructure:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span>🇩🇪 Germany (EU Region)</span>
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Data Center Privacy Standard:</span>
              <span className="text-emerald-600 font-medium">GDPR / DSGVO Compliant (ISO 27001)</span>
            </div>
          </div>
        </div>

        {/* Auditing and Immutability Safeguards */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3 select-none">
            <Shield size={14} className="text-emerald-500" />
            Audit Logging & Safe-Keep Parameters
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Order Immutability Safeguard:</span>
              <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/60 uppercase text-[9px] tracking-wider">
                Enabled (GoBD Enforced)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Audit Status History Logging:</span>
              <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/60 uppercase text-[9px] tracking-wider">
                Active
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Data Retention Standard:</span>
              <span className="font-bold text-slate-800">10 Years (German Statutory Period)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Payment Routing Architecture:</span>
              <span className="font-bold text-slate-800">Direct to Merchant (Option A Stripe Account)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">POS Reconciliation Authority:</span>
              <span className="text-amber-600 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100/60 uppercase text-[9px] tracking-wider">
                Restaurant Sole Owner
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview of compliance items card */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3 select-none">
          <Award size={14} className="text-blue-500" />
          Technical & Legal Certification Trail
        </h4>
        <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
          <p>
            Farman FoodSuite operates strictly as an **Ordering and Customer Engagement Platform** in compliance with German SaaS positioning rules. It acts solely as a communication bridge between the restaurant client and customers, facilitating direct sales order requests over WhatsApp.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">§ Tax Compliance</h5>
              <p className="text-[10px] text-slate-500">
                All order summaries and receipts represent platform estimates only. Final transactions must be recorded on a certified KassenSichV cash register.
              </p>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">§ GDPR Data Processing</h5>
              <p className="text-[10px] text-slate-500">
                Customers retain complete data ownership. Processed data is stored on secure German servers and governed by our standard AVV / DPA terms.
              </p>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">§ API Payment Auditing</h5>
              <p className="text-[10px] text-slate-500">
                Direct integration with Stripe ensures payment funds settle directly from customer card to restaurant bank account, bypassing Farman GmbH.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
