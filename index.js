const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

let sock;
const dono = "553173456532";
let liberado = false;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["ETZINHO 404", "Chrome", "1.0.0"],
        printQRInTerminal: false // usamos manual
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log("📲 ESCANEIA O QR ABAIXO:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("👽 ONLINE");
        }

        if (connection === "close") {
            console.log("❌ CONEXÃO FECHADA, REINICIANDO...");
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
        if (!isGroup && texto === "01") {
            liberado = true;
            await sock.sendMessage(from, { text: "👽 BOT LIBERADO" });
        }

        if (!liberado) return;

        // 💀 ANTI LINK
        const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com)/i;

        if (isGroup && linkRegex.test(texto)) {
            await sock.sendMessage(from, { delete: msg.key });

            await sock.groupParticipantsUpdate(from, [sender], "remove");

            await sock.sendMessage(from, {
                text: "💀 LINK DETECTADO - USUÁRIO REMOVIDO"
            });

            return;
        }

        // MENU
        if (msgLower === "!menu") {
            await sock.sendMessage(from, {
                text: `👽 Olá terráqueo(a)

📡 COMANDOS DISPONÍVEIS:

!menu
!ping
!status
!ban
!kick
!mute
!unmute
!antilink
!welcome
!tagall
!delete
!sticker
!tomp3
!translate
!weather
!ai
!play
!search
!meme
!prefix
!join
!leave
!bc
!restart
!antiflood
!antitrava
!antiadmin
!block
!lock
!unlock
!tiktok
!ig
!twitter
!pinterest
!yts
!ocr
!perfil
!rank
!daily
!bet
!casar
!exec
!term
!stats
!afk
!escolher
!ship
!anuncio`
            });
        }

        // PING
        if (msgLower === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong!" });
        }

        // STATUS
        if (msgLower === "!status") {
            await sock.sendMessage(from, { text: "🤖 Online e funcionando" });
        }

        // IA SIMPLES
        if (msgLower.includes("oi")) {
            return sock.sendMessage(from, { text: "👽 Opa terráqueo 🛸" });
        }

        if (msgLower.includes("tudo bem")) {
            return sock.sendMessage(from, { text: "👽 Tudo sob controle 🛸" });
        }
    });
}

startBot()
