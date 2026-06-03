import {
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { WhatsAppSession } from "../models/index.js";

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

function getCustomerPhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, "");
}

async function processIncomingBotMessage(sock: WASocket, remoteJid: string, text: string) {
  const response = await fetch(`${getInternalBotUrl()}/api/bot-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: getCustomerPhone(remoteJid),
      message: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bot endpoint returned ${response.status}`);
  }

  const data = await response.json();
  if (data?.botReplyText) {
    await sock.sendMessage(remoteJid, { text: data.botReplyText });
  }
}

export async function startWhatsAppSession(sessionName: string, onQR?: (qr: string) => void) {
  const sessionDir = path.join(process.cwd(), "bailey_sessions", sessionName);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: !onQR,
    browser: ["MR. Tabboush", "Chrome", "1.0"],
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

      await WhatsAppSession.findOneAndUpdate(
        { sessionName },
        { connected: false, lastDisconnectedAt: new Date() }
      );

      console.log(`[WhatsApp] ${sessionName} connection closed. Reconnecting:`, shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => startWhatsAppSession(sessionName, onQR), 3000);
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
          const text = getMessageText(msg.message);
          if (!text.trim()) continue;

          const phone = getCustomerPhone(remoteJid);
          console.log(`[WhatsApp] Message from ${phone}: ${text}`);

          try {
            await processIncomingBotMessage(sock, remoteJid, text);
          } catch (err) {
            console.error(`[WhatsApp] Bot reply failed for ${phone}:`, err);
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

  const jid = phone.includes("@g.us") ? phone : `${phone.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}
