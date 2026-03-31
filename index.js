const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
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

        // 👽 mensagem automática (1 vez por conversa)
        if (!msg.key.fromMe && body.toLowerCase() === "oi") {
            await sock.sendMessage(from, {
                text: "👽 Cheguei terráqueos, vim em paz!"
            });
        }

        // 🏓 PING
        if (["ping", "!ping", ".ping"].includes(body.toLowerCase())) {
            return sock.sendMessage(from, { text: "🏓 Pong!" });
        }

        // 🔨 BAN (somente comando exato)
        if (["ban", "!ban", ".ban"].includes(body.toLowerCase())) {
            if (!isGroup) return;

            try {
                const metadata = await sock.groupMetadata(from);
                const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

                const isBotAdmin = metadata.participants.find(p => p.id === botNumber)?.admin;
                if (!isBotAdmin) {
                    return sock.sendMessage(from, { text: "❌ Preciso ser ADMIN!" });
                }

                let target =
                    msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                    msg.message.extendedTextMessage?.contextInfo?.participant;

                if (!target) {
                    return sock.sendMessage(from, {
                        text: "⚠️ Marque ou responda a pessoa!"
                    });
                }

                await sock.groupParticipantsUpdate(from, [target], "remove");

                return sock.sendMessage(from, {
                    text: "🚫 Usuário banido!"
                });

            } catch (e) {
                console.log("Erro BAN:", e);
            }
        }

        // 🔗 ANTI-LINK (ULTRA + BACKUP)
        if (isGroup && !msg.key.fromMe) {

            const regexUltra = /(https?:\/\/|www\.|\.(com|com\.br|net|org|xyz|io|gg|gov|edu))/i;

            if (!regexUltra.test(body)) return;

            try {
                const metadata = await sock.groupMetadata(from);
                const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

                const isBotAdmin = metadata.participants.find(p => p.id === botNumber)?.admin;
                const isUserAdmin = metadata.participants.find(p => p.id === sender)?.admin;

                if (isUserAdmin) return;

                if (!isBotAdmin) {
                    return sock.sendMessage(from, {
                        text: "❌ Preciso ser ADMIN!"
                    });
                }

                await sock.groupParticipantsUpdate(from, [sender], "remove");

                return sock.sendMessage(from, {
                    text: "🚫 Link detectado! BAN automático."
                });

            } catch (e) {
                console.log("Erro anti-link principal:", e);

                // 🔁 BACKUP
                try {
                    const regexBackup = /(https?:\/\/|www\.)/i;

                    if (!regexBackup.test(body)) return;

                    await sock.groupParticipantsUpdate(from, [sender], "remove");

                    await sock.sendMessage(from, {
                        text: "🚫 Link detectado (backup)!"
                    });

                } catch (err) {
                    console.log("Erro geral:", err);
                }
            }
        }

    });
}

startBot();
