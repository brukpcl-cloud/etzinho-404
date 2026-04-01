const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) {
      console.log("📱 Escaneia o QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ BOT ONLINE!");
    }

    if (connection === "close") {
      startBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!from.endsWith("@g.us")) return;

    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants;

    const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

    const isBotAdmin = participants.find(p => p.id === botNumber)?.admin;
    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;

    if (!isBotAdmin) return;

    // 🔥 ANTI LINK PESADO
    const isLink =
      /https?:\/\//i.test(text) ||
      /www/i.test(text) ||
      /\.(com|net|org|io|xyz|gg|br)/i.test(text);

    if (isLink && !isSenderAdmin) {
      await sock.sendMessage(from, {
        delete: msg.key
      });
      await sock.groupParticipantsUpdate(from, [sender], "remove");
      return;
    }

    // 🔨 BAN SEM PREFIXO
    const permitido = ["oi", "menu"];

    if (!permitido.includes(text.toLowerCase()) && !isSenderAdmin) {
      await sock.sendMessage(from, {
        delete: msg.key
      });
      await sock.groupParticipantsUpdate(from, [sender], "remove");
      return;
    }
  });
}

startBot();
