import React from "react";
import { useI18n } from "../i18n";
import { Info, Shield, Cpu, Award } from "lucide-react";

const LOCALIZED_CONTENT = {
  de: {
    subtitle: "Farman FoodSuite Plattform-Status und technische Prüfspezifikationen",
    statusBadge: "Aktiv / Zertifiziert",
    softSpecs: "Software- & Umgebungsspezifikationen",
    safeguards: "Änderungsprotokollierung & Schutzparameter",
    platform: "Plattform-Suite:",
    platformVal: "Farman FoodSuite v1.0",
    node: "Node.js-Version:",
    nodeVal: "v20 (LTS)",
    db: "Datenbank-Engine:",
    dbVal: "MongoDB Community v7.0",
    hosting: "Hosting-Infrastruktur:",
    hostingVal: "🇩🇪 Deutschland (EU-Region)",
    privacy: "Rechenzentrums-Datenschutz:",
    privacyVal: "DSGVO / GDPR konform (ISO 27001)",
    immutability: "Bestellungs-Unveränderlichkeit:",
    immutabilityVal: "Aktiviert (GoBD-konform)",
    audit: "Änderungsprotokoll (Status-Verlauf):",
    auditVal: "Aktiv",
    retention: "Datenaufbewahrungsfrist:",
    retentionVal: "10 Jahre (Gesetzliche Aufbewahrungsfrist)",
    routing: "Zahlungs-Routing-Architektur:",
    routingVal: "Direktabrechnung (Option A Stripe)",
    reconcile: "Kassenabgleich-Zuständigkeit:",
    reconcileVal: "Alleinige Verantwortung des Restaurants",
    certTrail: "Technischer & rechtlicher Zertifizierungspfad",
    desc: "Farman FoodSuite arbeitet ausschließlich als Bestell- und Kundenbindungsplattform in Übereinstimmung mit den deutschen Richtlinien zur SaaS-Positionierung. Sie fungiert ausschließlich als Kommunikationsbrücke zwischen dem Restaurant und den Kunden und erleichtert direkte Verkaufsbestellungen über WhatsApp.",
    tax: "§ Steuerkonformität",
    taxDesc: "Alle Bestellzusammenfassungen und Belege stellen lediglich Plattformschätzungen dar. Die endgültigen Geschäftsvorfälle müssen auf einer zertifizierten KassenSichV-Kasse erfasst werden.",
    gdpr: "§ DSGVO-Datenverarbeitung",
    gdprDesc: "Der Kunde behält die vollständige Datenhoheit. Die verarbeiteten Daten werden auf sicheren deutschen Servern gespeichert und unterliegen unseren standardmäßigen AVV/DPA-Bedingungen.",
    api: "§ API-Zahlungsprüfung",
    apiDesc: "Die direkte Integration mit Stripe stellt sicher, dass Zahlungen direkt vom Kundenkonto auf das Bankkonto des Restaurants fließen, ohne Farman GmbH zu berühren."
  },
  ar: {
    subtitle: "حالة منصة Farman FoodSuite والمواصفات الفنية للتدقيق والامتثال",
    statusBadge: "نشط / معتمد",
    softSpecs: "مواصفات البرمجيات والبيئة التشغيلية",
    safeguards: "سجل التدقيق ومعايير الحفظ الآمن",
    platform: "حزمة المنصة:",
    platformVal: "Farman FoodSuite v1.0",
    node: "محرك Node.js:",
    nodeVal: "v20 (LTS)",
    db: "محرك قاعدة البيانات:",
    dbVal: "MongoDB Community v7.0",
    hosting: "البنية التحتية للاستضافة:",
    hostingVal: "🇩🇪 ألمانيا (منطقة الاتحاد الأوروبي)",
    privacy: "معايير خصوصية مركز البيانات:",
    privacyVal: "متوافق مع GDPR / DSGVO (ISO 27001)",
    immutability: "حماية عدم قابليّة التعديل:",
    immutabilityVal: "مفعّل (مطابق لمعايير GoBD)",
    audit: "تسجيل سجل تغييرات الحالات:",
    auditVal: "نشط",
    retention: "معيار الاحتفاظ بالبيانات:",
    retentionVal: "١٠ سنوات (المدة القانونية الألمانية)",
    routing: "بنية توجيه المدفوعات:",
    routingVal: "مباشر إلى التاجر (حساب Stripe الخيار أ)",
    reconcile: "سلطة مطابقة الكاشير:",
    reconcileVal: "المسؤولية الكاملة للمطعم",
    certTrail: "مسار الاعتماد الفني والقانوني للمنصة",
    desc: "تعمل منصة Farman FoodSuite بشكل صارم كمنصة لطلب الوجبات وجذب العملاء بما يتماشى مع قواعد تحديد موقع SaaS الألمانية. وهي تعمل فقط كجسر اتصال بين العميل المطعم والمستهلكين، لتسهيل طلبات المبيعات المباشرة عبر واتساب.",
    tax: "§ الامتثال الضريبي",
    taxDesc: "تمثل جميع ملخصات الطلبات والإيصالات تقديرات للمنصة فقط. يجب تسجيل المعاملات النهائية في سجل نقدي معتمد ومتوافق مع KassenSichV.",
    gdpr: "§ معالجة بيانات GDPR",
    gdprDesc: "يحتفظ العملاء بملكية البيانات الكاملة. يتم تخزين البيانات المعالجة على خوادم ألمانية آمنة وتخضع لشروط AVV / DPA القياسية الخاصة بنا.",
    api: "§ تدقيق مدفوعات API",
    apiDesc: "يضمن التكامل المباشر مع Stripe تسوية أموال الدفع مباشرة من بطاقة العميل إلى الحساب البنكي للمطعم، متجاوزًا Farman GmbH."
  },
  en: {
    subtitle: "Farman FoodSuite Platform Status and Technical Auditing Specifications",
    statusBadge: "Active / Certified",
    softSpecs: "Software & Environment Specifications",
    safeguards: "Audit Logging & Safe-Keep Parameters",
    platform: "Platform Suite:",
    platformVal: "Farman FoodSuite v1.0",
    node: "Node.js Engine:",
    nodeVal: "v20 (LTS)",
    db: "Database Engine:",
    dbVal: "MongoDB Community v7.0",
    hosting: "Hosting Infrastructure:",
    hostingVal: "🇩🇪 Germany (EU Region)",
    privacy: "Data Center Privacy Standard:",
    privacyVal: "GDPR / DSGVO Compliant (ISO 27001)",
    immutability: "Order Immutability Safeguard:",
    immutabilityVal: "Enabled (GoBD Enforced)",
    audit: "Audit Status History Logging:",
    auditVal: "Active",
    retention: "Data Retention Standard:",
    retentionVal: "10 Years (German Statutory Period)",
    routing: "Payment Routing Architecture:",
    routingVal: "Direct to Merchant (Option A Stripe Account)",
    reconcile: "POS Reconciliation Authority:",
    reconcileVal: "Restaurant Sole Owner",
    certTrail: "Technical & Legal Certification Trail",
    desc: "Farman FoodSuite operates strictly as an Ordering and Customer Engagement Platform in compliance with German SaaS positioning rules. It acts solely as a communication bridge between the restaurant client and customers, facilitating direct sales order requests over WhatsApp.",
    tax: "§ Tax Compliance",
    taxDesc: "All order summaries and receipts represent platform estimates only. Final transactions must be recorded on a certified KassenSichV cash register.",
    gdpr: "§ GDPR Data Processing",
    gdprDesc: "Customers retain complete data ownership. Processed data is stored on secure German servers and governed by our standard AVV / DPA terms.",
    api: "§ API Payment Auditing",
    apiDesc: "Direct integration with Stripe ensures payment funds settle directly from customer card to restaurant bank account, bypassing Farman GmbH."
  },
  tr: {
    subtitle: "Farman FoodSuite Platform Durumu ve Teknik Denetim Özellikleri",
    statusBadge: "Aktif / Sertifikalı",
    softSpecs: "Yazılım & Ortam Özellikleri",
    safeguards: "Denetim Günlüğü & Güvenli Saklama Parametreleri",
    platform: "Platform Paketi:",
    platformVal: "Farman FoodSuite v1.0",
    node: "Node.js Motoru:",
    nodeVal: "v20 (LTS)",
    db: "Veritabanı Motoru:",
    dbVal: "MongoDB Topluluğu v7.0",
    hosting: "Barındırma Altyapısı:",
    hostingVal: "🇩🇪 Almanya (AB Bölgesi)",
    privacy: "Veri Merkezi Gizlilik Standardı:",
    privacyVal: "GDPR / DSGVO Uyumlu (ISO 27001)",
    immutability: "Sipariş Değiştirilemezlik Koruması:",
    immutabilityVal: "Etkin (GoBD Zorunlu)",
    audit: "Denetim Durumu Geçmiş Günlüğü:",
    auditVal: "Aktif",
    retention: "Veri Saklama Standardı:",
    retentionVal: "10 Yıl (Alman Yasal Süresi)",
    routing: "Ödeme Yönlendirme Mimarisi:",
    routingVal: "Doğrudan Üye İşyerine (Seçenek A Stripe Hesabı)",
    reconcile: "POS Mutabakat Yetkisi:",
    reconcileVal: "Restoran Tek Sahibi",
    certTrail: "Teknik & Yasal Sertifikasyon Süreci",
    desc: "Farman FoodSuite, Alman SaaS konumlandırma kurallarına uygun olarak yalnızca bir Sipariş ve Müşteri Etkileşim Platformu olarak faaliyet gösterir. Restoran istemcisi ile müşteriler arasında yalnızca bir iletişim köprüsü görevi görerek WhatsApp üzerinden doğrudan satış siparişi taleplerini kolaylaştırır.",
    tax: "§ Vergi Uyumluluğu",
    taxDesc: "Tüm sipariş özetleri ve makbuzlar yalnızca platform tahminlerini temsil eder. Nihai işlemler sertifikalı bir KassenSichV yazar kasasına kaydedilmelidir.",
    gdpr: "§ GDPR Veri İşleme",
    gdprDesc: "Müşteriler veri sahipliğini tamamen elinde tutar. İşlenen veriler güvenli Alman sunucularında saklanır ve standart AVV / DPA şartlarımıza tabidir.",
    api: "§ API Ödeme Denetimi",
    apiDesc: "Stripe ile doğrudan entegrasyon, ödeme fonlarının Farman GmbH'yi baypas ederek doğrudan müşteri kartından restoran banka hesabına geçmesini sağlar."
  }
};

export default function SystemInfo() {
  const { t, language } = useI18n();

  // Safeguard fallback language to 'de' or 'en' if not matched
  const activeLang = (language === "de" || language === "ar" || language === "en" || language === "tr") 
    ? language 
    : "de";

  const content = LOCALIZED_CONTENT[activeLang];

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
              {content.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-xl border border-emerald-100/60 font-mono text-xs font-bold uppercase tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {content.statusBadge}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specifications Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3 select-none">
            <Cpu size={14} className="text-orange-500" />
            {content.softSpecs}
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.platform}</span>
              <span className="font-bold text-slate-800">{content.platformVal}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.node}</span>
              <span className="font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-700">{content.nodeVal}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.db}</span>
              <span className="font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-700">{content.dbVal}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.hosting}</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span>{content.hostingVal}</span>
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.privacy}</span>
              <span className="text-emerald-600 font-medium">{content.privacyVal}</span>
            </div>
          </div>
        </div>

        {/* Auditing and Immutability Safeguards */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3 select-none">
            <Shield size={14} className="text-emerald-500" />
            {content.safeguards}
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.immutability}</span>
              <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/60 uppercase text-[9px] tracking-wider">
                {content.immutabilityVal}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.audit}</span>
              <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/60 uppercase text-[9px] tracking-wider">
                {content.auditVal}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.retention}</span>
              <span className="font-bold text-slate-800">{content.retentionVal}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.routing}</span>
              <span className="font-bold text-slate-800">{content.routingVal}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{content.reconcile}</span>
              <span className="text-amber-600 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100/60 uppercase text-[9px] tracking-wider">
                {content.reconcileVal}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview of compliance items card */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3 select-none">
          <Award size={14} className="text-blue-500" />
          {content.certTrail}
        </h4>
        <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
          <p>
            {content.desc}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">{content.tax}</h5>
              <p className="text-[10px] text-slate-500 leading-normal">
                {content.taxDesc}
              </p>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">{content.gdpr}</h5>
              <p className="text-[10px] text-slate-500 leading-normal">
                {content.gdprDesc}
              </p>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">{content.api}</h5>
              <p className="text-[10px] text-slate-500 leading-normal">
                {content.apiDesc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
