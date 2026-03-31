const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["ETZINHO BOT", "Chrome", "1.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 CONEXÃO (ESSENCIAL)
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📱 Escaneia o QR Code:");
            require("qrcode-terminal").generate(qr, { small: true });
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconectando...");
                startBot();
            } else {
                console.log("❌ Sessão desconectada");
            }
        }

        if (connection === "open") {
            console.log("✅ BOT ONLINE!");
        }
    });

    // 📩 MENSAGENS
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");

        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        const sender = msg.key.participant || from;

        if (!body) return;

        console.log("Mensagem:", body);

        // 👽 mensagem automática
        if (!msg.key.fromMe && body.toLowerCase() === "oi") {
            await sock.sendMessage(from, {
                text: "👽 Cheguei terráqueos, vim em paz!"
            });
        }

        // 🏓 ping
        if (["ping", "!ping", ".ping"].includes(body.toLowerCase())) {
            return sock.sendMessage(from, { text: "🏓 Pong!" });
        }

        // 🔗 anti-link
        if (isGroup && /(www\.|https?:\/\/|\.(com|net|org))/i.test(body)) {
            try {
                const metadata = await sock.groupMetadata(from);
                const bot = sock.user.id.split(":")[0] + "@s.whatsapp.net";

                const isBotAdmin = metadata.participants.find(p => p.id === bot)?.admin;
                const isUserAdmin = metadata.participants.find(p => p.id === sender)?.admin;

                if (!isBotAdmin || isUserAdmin) return;

                await sock.groupParticipantsUpdate(from, [sender], "remove");

                await sock.sendMessage(from, {
                    text: "🚫 Link = BAN"
                });

            } catch (e) {
                console.log(e);
            }
        }
    });
}

startBot();
