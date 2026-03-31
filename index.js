global.crypto = require("crypto").webcrypto;

const fs = require("fs");
const { execSync } = require("child_process");

// 🔥 CARREGAR SESSÃO
if (fs.existsSync("session.zip")) {
    try {
        execSync("unzip -o session.zip");
        console.log("✅ Sessão carregada!");
    } catch {}
}

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const prefixo = "!";

// ================= LISTAS =================

const verdades = [
"Qual sua maior vergonha?",
"Quem você beijaria do grupo?",
"Já mentiu feio pra alguém?",
"Qual segredo ninguém sabe?",
"Já passou vergonha em público?"
];

const desafios = [
"Mandar áudio cantando",
"Chamar alguém no PV",
"Mandar foto engraçada",
"Ficar 1 min sem responder",
"Falar 'sou estranho' no grupo"
];

const zoeira = [
"Esse grupo é só caos 🤣",
"Nem o FBI explica isso aqui",
"Tô só observando 👀",
"Alguém chama o médico kkk"
];

const debocheLink = [
"🚫 Aqui não é feira pra jogar link não 🤡",
"💀 Mandou link achando que ia passar? ERROU",
"🚨 Link detectado... BAN ativado 😈",
"👀 Tentou mandar link escondido kkk",
"⚠️ Aqui não, parceiro... rua 👉"
];

// ================= CONTROLE =================

const controleGrupo = {};
const usuarios = {};

function podeResponderGrupo(grupo) {
    if (!controleGrupo[grupo]) controleGrupo[grupo] = { tempo: 0 };
    if (Date.now() - controleGrupo[grupo].tempo < 10000) return false;
    controleGrupo[grupo].tempo = Date.now();
    return true;
}

function antiSpamUser(user) {
    if (!usuarios[user]) usuarios[user] = { tempo: 0 };
    if (Date.now() - usuarios[user].tempo < 5000) return false;
    usuarios[user].tempo = Date.now();
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

    // 🔥 CONEXÃO
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log("📲 Escaneia o QR:");
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

            // 🚫 ANTI LINK (APAGA + DEBOCHE + BAN)
            if (body.includes("http") || body.includes("www.")) {

                // 🗑️ APAGA MENSAGEM
                await sock.sendMessage(from, {
                    delete: msg.key
                });

                const frase = debocheLink[Math.floor(Math.random() * debocheLink.length)];

                await delay(800);
                await sock.sendMessage(from, { text: frase });

                if (isGroup) {
                    try {
                        await sock.groupParticipantsUpdate(from, [sender], "remove");
                    } catch {}
                }

                return;
            }

            // 🚫 CONTROLES
            if (isGroup && !podeResponderGrupo(from)) return;
            if (!antiSpamUser(sender)) return;

            // 📌 PREFIXO
            if (!body.startsWith(prefixo)) return;

            const comando = body.slice(1).toLowerCase();

            // 🎮 VERDADE
            if (comando === "verdade") {
                const v = verdades[Math.floor(Math.random() * verdades.length)];
                await sock.sendMessage(from, { text: "🟢 VERDADE:\n" + v });
            }

            // 🎮 DESAFIO
            if (comando === "desafio") {
                const d = desafios[Math.floor(Math.random() * desafios.length)];
                await sock.sendMessage(from, { text: "🔴 DESAFIO:\n" + d });
            }

            // 📋 MENU
            if (comando === "menu") {
                await sock.sendMessage(from, {
                    text: `📋 MENU:

!verdade - pergunta
!desafio - desafio
!menu - comandos

🛡️ Anti-link ativo (ban automático)`
                });
            }

            // 🤡 ZOEIRA LEVE
            if (Math.random() < 0.05) {
                const z = zoeira[Math.floor(Math.random() * zoeira.length)];
                await sock.sendMessage(from, { text: z });
            }

        } catch (err) {
            console.log("❌ Erro:", err);
        }
    });
}

startBot();
