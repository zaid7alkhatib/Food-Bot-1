import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, Shield, UserPlus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { UserAccount, UserRole } from "../types";

const ALL_ROLES: UserRole[] = ["super_admin", "restaurant_admin", "branch_manager", "staff", "support_agent"];
const RESTAURANT_ADMIN_ROLES: UserRole[] = ["branch_manager", "staff", "support_agent"];

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "staff" as UserRole,
};

export default function UserManagement() {
  const { token, user: currentUser } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const creatableRoles = currentUser?.role === "super_admin" ? ALL_ROLES : RESTAURANT_ADMIN_ROLES;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fetchUsers = async () => {
    try {
      setError("");
      const res = await fetch("/api/auth/users", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setUsers((prev) => [data.user, ...prev]);
      setForm(emptyForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (account: UserAccount, patch: Partial<UserAccount>) => {
    setActionUserId(account.id);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/auth/users/${account.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setUsers((prev) => prev.map((entry) => (entry.id === account.id ? data.user : entry)));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update user");
    } finally {
      setActionUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
        <span className="text-xs text-gray-500">{t("users.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("users.title")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t("users.subtitle")}</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
            <CheckCircle2 size={14} />
            {t("common.saved")}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg px-4 py-3 text-xs font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-orange-500" />
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("users.createTitle")}</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.name")}</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("common.email")}</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("users.password")}</label>
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">{t("users.role")}</label>
            <select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
            >
              {creatableRoles.map((role) => (
                <option key={role} value={role}>
                  {t(`app.role.${role}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            disabled={creating}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {creating ? t("users.creating") : t("users.create")}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-neutral-50 p-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-neutral-500" />
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{t("users.accounts")}</h4>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("users.empty")}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((account) => {
              const canAssignRole = creatableRoles.includes(account.role);
              const isSelf = account.id === currentUser?.id;
              return (
                <div key={account.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className={account.isActive ? "text-emerald-500" : "text-gray-300"} />
                      <h5 className="font-bold text-sm text-gray-900 truncate">{account.name}</h5>
                      {isSelf && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                          {t("users.you")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{account.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canAssignRole ? (
                      <select
                        value={account.role}
                        disabled={actionUserId === account.id}
                        onChange={(e) => updateUser(account, { role: e.target.value as UserRole })}
                        className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-700 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                      >
                        {creatableRoles.map((role) => (
                          <option key={role} value={role}>
                            {t(`app.role.${role}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700">
                        {t(`app.role.${account.role}`)}
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isSelf || actionUserId === account.id}
                      onClick={() => updateUser(account, { isActive: !account.isActive })}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition disabled:opacity-50 ${
                        account.isActive
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {actionUserId === account.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : account.isActive ? (
                        t("users.active")
                      ) : (
                        t("users.inactive")
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
