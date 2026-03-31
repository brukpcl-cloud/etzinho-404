global.crypto = require("crypto").webcrypto;

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const prefixo = "!";

// ================= CONTROLE =================
const controleGrupo = {};
const usuarios = {};

function podeResponderGrupo(grupo) {
    if (!controleGrupo[grupo]) controleGrupo[grupo] = { tempo: 0 };

    const agora = Date.now();
    if (agora - controleGrupo[grupo].tempo < 10000) return false;

    controleGrupo[grupo].tempo = agora;
    return true;
}

function antiSpamUser(user) {
    if (!usuarios[user]) usuarios[user] = { tempo: 0 };

    const agora = Date.now();
    if (agora - usuarios[user].tempo < 5000) return false;

    usuarios[user].tempo = agora;
    return true;
}

// ================= BOT =================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 CONEXÃO + QR
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log("📲 Escaneia o QR abaixo:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ BOT ONLINE!");
        }

        if (connection === "close") {
            console.log("🔴 Reconectando...");
            startBot();
        }
    });

    // ================= MENSAGENS =================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message) return;
            if (msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith("@g.us");
            const sender = msg.key.participant || from;

            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            if (!body) return;

            // 🚫 ANTI LINK
            if (body.includes("http") || body.includes("www.")) {
                await delay(1500);
                await sock.sendMessage(from, {
                    text: "🚫 LINK NÃO É PERMITIDO!"
                });

                try {
                    if (isGroup) {
                        await sock.groupParticipantsUpdate(from, [sender], "remove");
                    }
                } catch {}

                return;
            }

            // 🚫 ANTI FLOOD GRUPO
            if (isGroup && !podeResponderGrupo(from)) return;

            // 🚫 ANTI SPAM
            if (!antiSpamUser(sender)) return;

            // 📌 PREFIXO
            if (!body.startsWith(prefixo)) return;

            const comando = body.slice(1).toLowerCase();

            // ================= COMANDOS =================

            if (comando === "oi") {
                await delay(2000);
                await sock.sendMessage(from, {
                    text: "Tá na Nárnia não kkk 😎"
                });
            }

            if (comando === "menu") {
                await delay(2000);
                await sock.sendMessage(from, {
                    text: `📋 MENU:

!oi - resposta
!menu - comandos

🛡️ Proteções ativas`
                });
            }

        } catch (err) {
            console.log("❌ Erro:", err);
        }
    });
}


startBot();
