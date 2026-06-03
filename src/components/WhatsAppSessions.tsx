import React, { useState, useEffect } from "react";
import { Smartphone, QrCode, Power, PowerOff, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface Session {
  _id: string;
  sessionName: string;
  branchId?: { _id: string; name: string };
  qrCode?: string;
  qrStatus: string;
  connected: boolean;
  phoneNumber?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  isActive: boolean;
}

export default function WhatsAppSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<Session | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/whatsapp/sessions");
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/whatsapp/sessions/${id}/connect`, { method: "POST" });
      await fetchSessions();
    } catch (err) {
      console.error("Connect failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/whatsapp/sessions/${id}/disconnect`, { method: "POST" });
      await fetchSessions();
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
        <span className="text-xs text-gray-500">Loading WhatsApp sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">WhatsApp Sessions</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage Baileys connections per branch</p>
        </div>
        <button
          onClick={fetchSessions}
          className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Smartphone size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No WhatsApp sessions configured yet.</p>
          <p className="text-xs text-gray-400 mt-1">Run the seed script to create default sessions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <div
              key={session._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      session.connected ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{session.sessionName}</h4>
                    <p className="text-[11px] text-gray-500">
                      {session.branchId?.name || "No branch assigned"}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    session.connected
                      ? "bg-emerald-100 text-emerald-700"
                      : session.qrStatus === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {session.connected ? "Connected" : session.qrStatus === "pending" ? "QR Pending" : "Disconnected"}
                </span>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                {session.phoneNumber && (
                  <p>
                    <span className="text-gray-400">Phone:</span>{" "}
                    <span className="font-mono font-medium text-gray-700">{session.phoneNumber}</span>
                  </p>
                )}
                {session.lastConnectedAt && (
                  <p>
                    <span className="text-gray-400">Last Connected:</span>{" "}
                    {new Date(session.lastConnectedAt).toLocaleString()}
                  </p>
                )}
                {session.lastDisconnectedAt && (
                  <p>
                    <span className="text-gray-400">Last Disconnected:</span>{" "}
                    {new Date(session.lastDisconnectedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                {!session.connected ? (
                  <>
                    <button
                      onClick={() => handleConnect(session._id)}
                      disabled={actionLoading === session._id}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                      {actionLoading === session._id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Power size={12} />
                      )}
                      Connect
                    </button>
                    {session.qrCode && (
                      <button
                        onClick={() => setQrModal(session)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                      >
                        <QrCode size={12} />
                        QR
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleDisconnect(session._id)}
                    disabled={actionLoading === session._id}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    {actionLoading === session._id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <PowerOff size={12} />
                    )}
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-gray-900 mb-1">Scan QR Code</h4>
            <p className="text-xs text-gray-500 mb-4">
              Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
            </p>

            {qrModal.qrCode ? (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    qrModal.qrCode
                  )}`}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48"
                />
              </div>
            ) : (
              <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-orange-500" />
                <span className="text-xs text-gray-500">Generating QR code...</span>
              </div>
            )}

            <button
              onClick={() => setQrModal(null)}
              className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
