const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

const senha = "12345";

// 📁 grupos liberados
const arquivo = "./grupos.json";

if (!fs.existsSync(arquivo)) {
    fs.writeFileSync(arquivo, JSON.stringify([]));
}

let gruposLiberados = JSON.parse(fs.readFileSync(arquivo));

// 📊 controle de links
let controle = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log("📲 ESCANEIA O QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("👽 ONLINE");
        }

        if (connection === "close") {
            startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const sender = msg.key.participant || msg.key.remoteJid;

        const texto =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        const msgLower = texto.toLowerCase();

        // 🔐 LIBERAÇÃO
        if (isGroup && msgLower.startsWith("!liberar")) {
            const senhaDigitada = texto.split(" ")[1];

            if (!senhaDigitada) {
                return sock.sendMessage(from, {
                    text: "⚠️ Use: !liberar 12345"
                });
            }

            if (senhaDigitada === senha) {
                if (!gruposLiberados.includes(from)) {
                    gruposLiberados.push(from);
                    fs.writeFileSync(arquivo, JSON.stringify(gruposLiberados, null, 2));
                }

                return sock.sendMessage(from, {
                    text: "✅ BOT LIBERADO NESTE GRUPO 🚀"
                });
            } else {
                return sock.sendMessage(from, {
                    text: "❌ SENHA INCORRETA"
                });
            }
        }

        // 🔒 BLOQUEIO
        if (isGroup && !gruposLiberados.includes(from)) {
            return sock.sendMessage(from, {
                text: "🔒 Bot bloqueado\nUse: !liberar 12345"
            });
        }

        // 💀 ANTI-LINK COM ALERTA + BAN
        const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me|instagram\.com|youtu\.be|youtube\.com|facebook\.com|wa\.me)/i;

        if (isGroup && linkRegex.test(texto)) {
            try {
                const metadata = await sock.groupMetadata(from);
                const participantes = metadata.participants;

                const isAdmin = participantes.find(p => p.id === sender)?.admin;
                const botNumero = sock.user.id.split(":")[0] + "@s.whatsapp.net";
                const botAdmin = participantes.find(p => p.id === botNumero)?.admin;

                if (!botAdmin) {
                    return sock.sendMessage(from, {
                        text: "⚠️ Preciso ser ADMIN pra proteger o grupo!"
                    });
                }

                if (isAdmin) return;

                const userTag = "@" + sender.split("@")[0];
                const agora = Date.now();

                // 📊 controle
                if (!controle[sender]) {
                    controle[sender] = { count: 1, time: agora };
                } else {
                    controle[sender].count++;
                }

                // ⏱️ reset em 2 minutos
                if (agora - controle[sender].time > 120000) {
                    controle[sender] = { count: 1, time: agora };
                }

                // 🗑️ apagar mensagem
                await sock.sendMessage(from, { delete: msg.key });

                // 🔥 BAN NA SEGUNDA
                if (controle[sender].count >= 2) {
                    await new Promise(r => setTimeout(r, 300));

                    await sock.groupParticipantsUpdate(from, [sender], "remove");

                    await sock.sendMessage(from, {
                        text: `💨 𝙑𝙄𝙍𝙊𝙐 𝙍𝘼𝘾̧𝘼̃𝙊 𝘿𝙀 𝙀𝙏 𝙀𝙈 𝙉𝘼́𝙍𝙉𝙄𝘼! 👽`,
                        mentions: [sender]
                    });

                    delete controle[sender];
                    return;
                }

                // ⚠️ ALERTA
                await sock.sendMessage(from, {
                    text: `🚫 ${userTag} 𝙈𝘼𝙉𝘿𝙊𝙐 𝙇𝙄𝙉𝙆 𝙄𝙉𝙐́𝙏𝙄𝙇 🛸👽
⚠️ quem manda link aqui já sabe o caminho...`,
                    mentions: [sender]
                });

            } catch (e) {
                console.log("Erro:", e);
            }

            return;
        }

        // MENU
        if (msgLower === "!menu") {
            await sock.sendMessage(from, {
                text: "👽 BOT ONLINE\n\n!ping"
            });
        }

        // PING
        if (msgLower === "!ping") {
            await sock.sendMessage(from, {
                text: "🏓 Pong!"
            });
        }
    });
}

startBot()
