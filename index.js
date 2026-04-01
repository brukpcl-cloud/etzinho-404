import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  // CONEXÃO
  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) {
      console.log("📱 Escaneia o QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ BOT ONLINE!");
    }

    if (connection === "close") {
      console.log("❌ Reconectando...");
      startBot();
    }
  });

  // 🔥 SISTEMA DE MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    // pega texto
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // só grupo
    if (!from.endsWith("@g.us")) return;

    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants;

    const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

    const isBotAdmin = participants.find(p => p.id === botNumber)?.admin;
    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;

    // se bot não for admin, ignora
    if (!isBotAdmin) return;

    // 🔥 ANTI LINK PESADO
    const isLink =
      text.includes("http") ||
      text.includes("https") ||
      text.includes("www.") ||
      text.includes(".com") ||
      text.includes(".net") ||
      text.includes(".org");

    if (isLink && !isSenderAdmin) {
      await sock.sendMessage(from, { text: "🚫 LINK PROIBIDO!" });
      await sock.groupParticipantsUpdate(from, [sender], "remove");
      return;
    }

    // 🔨 BAN SEM PREFIXO (qualquer mensagem não permitida)
    const permitido = ["oi", "menu"]; // só essas podem

    if (!permitido.includes(text.toLowerCase()) && !isSenderAdmin) {
      await sock.sendMessage(from, { text: "❌ Mensagem não permitida!" });
      await sock.groupParticipantsUpdate(from, [sender], "remove");
      return;
    }
  });
}

startBot();
