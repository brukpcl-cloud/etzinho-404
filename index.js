const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

let sock;
let liberado = false;

// 👑 SEU NÚMERO (SEM +, SEM ESPAÇO)
const dono = "553173456532";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["ETZINHO 404", "Chrome", "1.0.0"]
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("👽 ETZINHO 404 ONLINE 🚀");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const sender = msg.key.participant || msg.key.remoteJid;

        const texto =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        const msgLower = texto.toLowerCase();

        // 🔐 LIBERAÇÃO
        if (!liberado) {
            if (texto === "01") {
                liberado = true;

                await sock.sendMessage(from, {
                    text: `👽 @${dono}

🚀 ETZINHO 404 LIBERADO
💀 Agora o sistema está ativo...`,
                    mentions: [`${dono}@s.whatsapp.net`]
                });
            }
            return;
        }

        // 💀 ANTI-LINK
        const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com)/i;

        if (isGroup && linkRegex.test(texto)) {
            await sock.sendMessage(from, {
                text: `💀 @${sender.split("@")[0]} FOI DE BASE

🚫 Link proibido detectado`,
                mentions: [sender]
            });

            await sock.groupParticipantsUpdate(from, [sender], "remove");
            return;
        }

        // 👑 CHAMAR DONO
        if (msgLower.includes("dono")) {
            await sock.sendMessage(from, {
                text: `👑 Dono supremo: @${dono}`,
                mentions: [`${dono}@s.whatsapp.net`]
            });
        }

        // MENU
        if (msgLower === "!menu") {
            await sock.sendMessage(from, {
                text: `👽 ⳻⳺ ETZINHO 404 ⳻⳺

📡 Sistema ativo

👑 Dono: @${dono}
💀 Anti-link: ON

Comandos:
!menu
!ping`,
                mentions: [`${dono}@s.whatsapp.net`]
            });
        }

        // PING
        if (msgLower === "!ping") {
            await sock.sendMessage(from, {
                text: "👽 ETZINHO 404 ATIVO 🚀"
            });
        }

        // 🤖 IA LEVE
        if (msgLower.includes("oi") || msgLower.includes("opa")) {
            return sock.sendMessage(from, { text: "👽 Opa terráqueo 🛸" });
        }

        if (msgLower.includes("tudo bem")) {
            return sock.sendMessage(from, { text: "👽 Tudo sob controle 🛸" });
        }

        // fallback
        const respostas = [
            "👽 Interessante...",
            "🛸 Processando...",
            "👽 Fale mais...",
            "📡 Captando sinal..."
        ];

        if (!msgLower.startsWith("!")) {
            return sock.sendMessage(from, {
                text: respostas[Math.floor(Math.random() * respostas.length)]
            });
        }
    });

    // 🔁 AUTO MENSAGENS
    const frases = ["👽 Estou observando vocês...", "🛸 Grupo ativo hoje..."];
    const perguntas = ["🤔 Verdade ou desafio?", "🔥 Quem é o mais doido aqui?"];
    const estados = ["SP", "RJ", "MG"];

    setInterval(async () => {
        const grupos = Object.keys(sock.chats).filter(jid => jid.endsWith("@g.us"));

        for (let grupo of grupos) {
            const tipo = Math.floor(Math.random() * 3);

            if (tipo === 0) {
                await sock.sendMessage(grupo, { text: frases[Math.floor(Math.random() * frases.length)] });
            }

            if (tipo === 1) {
                await sock.sendMessage(grupo, { text: perguntas[Math.floor(Math.random() * perguntas.length)] });
            }

            if (tipo === 2) {
                const estado = estados[Math.floor(Math.random() * estados.length)];
                await sock.sendMessage(grupo, {
                    text: `🌦️ Clima em ${estado}: estranho hoje 👽`
                });
            }
        }
    }, 2 * 60 * 60 * 1000);
}

startBot();
