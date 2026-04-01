const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
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

  // CONEXÃO (SEM LOOP BUGADO)
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📱 Escaneia o QR:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log("🌐 Reconectando em 5s...");
        setTimeout(() => startBot(), 5000);
      } else {
        console.log("❌ Deslogado, escaneie novamente");
      }
    }

    if (connection === "open") {
      console.log("✅ BOT ONLINE!");
    }
  });

  // SISTEMA DE MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!text) return;

    console.log("MSG:", text);

    // só grupo
    if (!from.endsWith("@g.us")) return;

    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants;

    const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

    const isBotAdmin = participants.find(p => p.id === botNumber)?.admin !== null;
    const isSenderAdmin = participants.find(p => p.id === sender)?.admin !== null;

    if (!isBotAdmin) {
      console.log("⚠️ BOT NÃO É ADMIN");
      return;
    }

    // 🔥 ANTI-LINK INSANO
    const isLink = /(https?:\/\/|www\.|\.\w{2,})/i.test(text);

    if (isLink && !isSenderAdmin) {
      console.log("🚫 LINK DETECTADO:", text);

      await sock.sendMessage(from, { delete: msg.key });
      await sock.groupParticipantsUpdate(from, [sender], "remove");
      return;
    }

    // 🔨 BAN SEM PREFIXO
    const permitido = ["oi", "menu"];

    if (!permitido.includes(text.toLowerCase()) && !isSenderAdmin) {
      console.log("🚫 MENSAGEM PROIBIDA:", text);

      await sock.sendMessage(from, { delete: msg.key });
      await sock.groupParticipantsUpdate(from, [sender], "remove");
      return;
    }
  });
}

startBot();
