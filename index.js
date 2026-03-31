global.crypto = require("crypto").webcrypto;

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

// 🌐 manter Railway ligado (opcional)
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Bot online 🚀");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🌐 Servidor ativo");
});

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

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        // 🔥 QR CODE (FUNCIONA NO TERMUX)
        if (qr) {
            console.log("\n📲 ESCANEIA O QR:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ BOT ONLINE!");
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

        // 👽 RESPOSTA AUTOMÁTICA
        if (!msg.key.fromMe && body.toLowerCase() === "oi") {
            await sock.sendMessage(from, {
                text: "👽 Cheguei terráqueos, vim em paz!"
            });
        }

        // 🏓 PING
        if (["ping", "!ping", ".ping"].includes(body.toLowerCase())) {
            return sock.sendMessage(from, { text: "🏓 Pong!" });
        }

        // 🔗 ANTI-LINK HARD
        if (isGroup) {
            const isLink = /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me|discord\.gg|bit\.ly|\.com|\.net|\.org)/i.test(body);

            if (isLink) {
                try {
                    const metadata = await sock.groupMetadata(from);
                    const bot = sock.user.id.split(":")[0] + "@s.whatsapp.net";

                    const isBotAdmin = metadata.participants.find(p => p.id === bot)?.admin;
                    const isUserAdmin = metadata.participants.find(p => p.id === sender)?.admin;

                    if (!isBotAdmin || isUserAdmin) return;

                    // 🗑️ apagar mensagem
                    await sock.sendMessage(from, {
                        delete: {
                            remoteJid: from,
                            fromMe: false,
                            id: msg.key.id,
                            participant: sender
                        }
                    });

                    // 🚫 ban
                    await sock.groupParticipantsUpdate(from, [sender], "remove");

                    await sock.sendMessage(from, {
                        text: "🚫 LINK DETECTADO = BAN AUTOMÁTICO"
                    });

                } catch (e) {
                    console.log("Erro anti-link:", e);
                }
            }
        }
    });
}

startBot();
