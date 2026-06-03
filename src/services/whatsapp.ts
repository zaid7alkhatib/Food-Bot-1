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
        if (!msg.key.fromMe && msg.message) {
          const phone = msg.key.remoteJid?.replace(/@s\.whatsapp\.net|@g\.us/, "");
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
          console.log(`[WhatsApp] Message from ${phone}: ${text}`);
          // TODO: Integrate with bot engine to process incoming orders
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
