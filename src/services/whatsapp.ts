import {
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { WhatsAppSession, Restaurant } from "../models/index.js";

const sessions = new Map<string, WASocket>();

function getInternalBotUrl() {
  return process.env.INTERNAL_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

function getMessageText(message: any): string {
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ""
  );
}

function getJidUser(jid?: string | null): string {
  return jid?.split("@")[0]?.split(":")[0] || "";
}

function getPhoneFromJid(jid?: string | null): string | null {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  const user = getJidUser(jid).replace(/\D/g, "");
  return user ? `+${user}` : null;
}

function getLidJid(jid?: string | null): string | null {
  return jid?.endsWith("@lid") ? jid : null;
}

function getCustomerIdentity(msg: any) {
  const remoteJid = msg.key.remoteJid as string;
  const candidateJids = [
    msg.key.remoteJid,
    msg.key.remoteJidAlt,
    msg.key.participant,
    msg.key.participantAlt,
  ].filter(Boolean) as string[];

  const phoneJid = candidateJids.find((jid) => getPhoneFromJid(jid)) || null;
  const lidJid = candidateJids.find((jid) => getLidJid(jid)) || null;
  const phone = getPhoneFromJid(phoneJid) || getJidUser(remoteJid);
  const customerName = typeof msg.pushName === "string" ? msg.pushName.trim() : "";

  return {
    phone,
    customerName: customerName || undefined,
    whatsappJid: remoteJid,
    whatsappPhoneJid: phoneJid,
    whatsappLid: lidJid,
  };
}

async function processIncomingBotMessage(
  sock: WASocket,
  remoteJid: string,
  text: string,
  identity: ReturnType<typeof getCustomerIdentity>,
  msgKey: any,
  coords?: { latitude: number; longitude: number }
) {
  // Mark message as read instantly (Double Blue Ticks)
  try {
    await sock.readMessages([msgKey]);
  } catch (e) {
    console.error(`[WhatsApp] Failed to mark message as read:`, e);
  }

  // Trigger typing Composer indicator
  try {
    await sock.sendPresenceUpdate("composing", remoteJid);
  } catch (e) {
    console.error(`[WhatsApp] Failed to set composing status:`, e);
  }

  const response = await fetch(`${getInternalBotUrl()}/api/bot-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      message: text,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bot endpoint returned ${response.status}`);
  }

  const data = await response.json();
  if (data?.botReplyText) {
    await sock.sendMessage(remoteJid, { text: data.botReplyText });
  }

  // React to original message on successful order placement
  if (data?.orderPlaced) {
    try {
      await sock.sendMessage(remoteJid, { react: { text: "👍", key: msgKey } });
    } catch (e) {
      console.error(`[WhatsApp] Failed to send reaction:`, e);
    }
  }
}

export async function startWhatsAppSession(sessionName: string, onQR?: (qr: string) => void) {
  const existingSession = sessions.get(sessionName);
  if (existingSession) {
    return existingSession;
  }

  const sessionDir = path.join(process.cwd(), "bailey_sessions", sessionName);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const restaurant = await Restaurant.findOne({ isActive: true }).lean();
  const browserName = restaurant?.name || "WhatsApp Bot";

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: !onQR,
    browser: [browserName, "Chrome", "1.0"],
  });

  sessions.set(sessionName, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && onQR) {
      onQR(qr);
      await WhatsAppSession.findOneAndUpdate(
        { sessionName },
        { qrCode: qr, qrStatus: "pending" }
      );
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      sessions.delete(sessionName);

      await WhatsAppSession.findOneAndUpdate(
        { sessionName },
        { connected: false, lastDisconnectedAt: new Date() }
      );

      console.log(`[WhatsApp] ${sessionName} connection closed. Reconnecting:`, shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => startWhatsAppSession(sessionName, onQR), 3000);
      } else {
        try {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log(`[WhatsApp] Cleared session directory for ${sessionName} due to logout/invalid session`);
          }
          await WhatsAppSession.findOneAndUpdate(
            { sessionName },
            { qrCode: undefined, qrStatus: "pending" }
          );
        } catch (err) {
          console.error(`[WhatsApp] Failed to clear session directory for ${sessionName}:`, err);
        }
      }
    } else if (connection === "open") {
      console.log(`[WhatsApp] ${sessionName} connected`);
      await WhatsAppSession.findOneAndUpdate(
        { sessionName },
        { connected: true, qrStatus: "connected", lastConnectedAt: new Date(), qrCode: undefined }
      );
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async (m) => {
    if (m.type === "notify") {
      for (const msg of m.messages) {
        const remoteJid = msg.key.remoteJid;
        if (!msg.key.fromMe && remoteJid && !remoteJid.endsWith("@g.us") && remoteJid !== "status@broadcast" && msg.message) {
          // Check for location message
          const locMsg = msg.message.locationMessage || msg.message.liveLocationMessage;
          let coords: { latitude: number; longitude: number } | undefined = undefined;
          let text = getMessageText(msg.message);

          if (locMsg && locMsg.degreesLatitude !== undefined && locMsg.degreesLongitude !== undefined) {
            coords = {
              latitude: locMsg.degreesLatitude,
              longitude: locMsg.degreesLongitude,
            };
            text = `location:${coords.latitude},${coords.longitude}`;
          }

          if (!text.trim()) continue;

          const identity = getCustomerIdentity(msg);
          console.log(`[WhatsApp] Message from ${identity.customerName || identity.phone}: ${text}`);

          try {
            await processIncomingBotMessage(sock, remoteJid, text, identity, msg.key, coords);
          } catch (err) {
            console.error(`[WhatsApp] Bot reply failed for ${identity.phone}:`, err);
          }
        }
      }
    }
  });

  return sock;
}

export function getWhatsAppSession(sessionName: string): WASocket | undefined {
  return sessions.get(sessionName);
}

export async function stopWhatsAppSession(sessionName: string) {
  const sock = sessions.get(sessionName);
  if (sock) {
    await sock.logout();
    sessions.delete(sessionName);
  }

  const sessionDir = path.join(process.cwd(), "bailey_sessions", sessionName);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  await WhatsAppSession.findOneAndUpdate(
    { sessionName },
    { connected: false, qrStatus: "pending", qrCode: undefined }
  );
}

export async function sendWhatsAppMessage(sessionName: string, phone: string, text: string) {
  const sock = sessions.get(sessionName);
  if (!sock) {
    throw new Error(`Session ${sessionName} not found or not connected`);
  }

  const jid = phone.includes("@") ? phone : `${phone.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}
