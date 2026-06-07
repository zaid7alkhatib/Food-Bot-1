import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { useI18n } from "../i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const { language, setLanguage, t, dir } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branding, setBranding] = useState<{
    name: string;
    legalName?: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/public/config")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setBranding(data);
          if (data.primaryColor) {
            document.documentElement.style.setProperty("--brand-primary", data.primaryColor);
          }
          if (data.secondaryColor) {
            document.documentElement.style.setProperty("--brand-secondary", data.secondaryColor);
          }
        }
      })
      .catch((err) => console.error("Failed to load branding:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || t("login.invalid"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div dir={dir} className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          {branding?.logo ? (
            <img
              src={branding.logo}
              alt={branding.name}
              className="w-16 h-16 rounded-xl object-cover shadow-lg ring-2 ring-white/20 mx-auto mb-4 transform rotate-[-2deg]"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-2xl shadow-lg ring-2 ring-white/20 mx-auto mb-4 transform rotate-[-2deg]">
              🌯
            </div>
          )}
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight">
            {branding?.name || "Restaurant"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("login.subtitle")}
          </p>
          <div className="mt-4 inline-flex rounded-xl bg-slate-800 border border-slate-700 p-1">
            {(["de", "ar", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`h-8 min-w-10 px-3 rounded-lg text-[11px] font-bold uppercase transition ${
                  language === lang
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">{t("login.welcome")}</h2>
          <p className="text-xs text-gray-500 mb-6">
            {t("login.helper")}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("login.email")}
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                  placeholder={branding ? `admin@${branding.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.de` : "admin@restaurant.de"}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("login.password")}
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("login.signingIn")}
                </>
              ) : (
                t("login.signIn")
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              {t("login.default")}: <span className="font-mono text-gray-600">{branding ? `admin@${branding.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.de` : "admin@restaurant.de"}</span> /{" "}
              <span className="font-mono text-gray-600">tabboush2024</span>
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          © 2026 {branding?.legalName || "System"} — {branding?.name || "Restaurant"} Ordering System
        </p>
      </div>
    </div>
  );
}
