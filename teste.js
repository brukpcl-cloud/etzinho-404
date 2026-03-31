import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import qrcode from "qrcode-terminal";
import pino from "pino";

// 👑 seu número
const dono = "5531999999999";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["ResenhaBot", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // 🔌 CONEXÃO
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;
   
     if (qr) {
  console.log("📲 Escaneia o QR abaixo:\n");
  qrcode.generate(qr, { small: true });
}

    if (connection === "open") {
      console.log("✅ BOT ONLINE");
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("❌ Caiu:", reason);

      if (reason !== 401) {
        console.log("🔄 Reconectando em 5s...");
        setTimeout(() => startBot(), 5000);
      } else {
        console.log("🚫 Escaneia o QR novamente");
      }
    }
  });

  // 💬 MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // 👀 RESPOSTA AUTOMÁTICA
    if (body.toLowerCase() === "oi") {
      await sock.sendMessage(from, {
        text: "👀 Quem chamou o brabo? Fala aí 😎🔥"
      });
    }

    // 📜 MENU
    if (body === "!menu") {
      await sock.sendMessage(from, {
        text: `😈 *PAINEL DO SISTEMA*

⚡ !ping → status da nave
👤 !perfil → perfil do bot
🎲 !vd → verdade ou desafio
📡 !menu → ver comandos

💬 manda "oi" aí pra testar 😎`
      });
    }

    // 👤 PERFIL
    if (body === "!perfil") {
      await sock.sendMessage(from, {
        text: `😈 *PERFIL DO BOT*

🤖 Nome: ResenhaBot
🧠 IA: Ativa
⚡ Energia: 100%
📡 Status: Online
🌍 Missão: dominar os grupos kkk

💬 Personalidade:
😎 Zueiro
🔥 Rápido
🧠 Inteligente
🚫 Anti-spam

👑 Dono: o mais brabo`
      });
    }

    // 🚀 PING
    if (body === "!ping") {
      const speed = Math.floor(Math.random() * 100) + 30;
      const cpu = Math.floor(Math.random() * 50) + 10;
      const ram = Math.floor(Math.random() * 70) + 20;

      await sock.sendMessage(from, {
        text: `🌐 *CENTRAL ONLINE*

🚀 Velocidade: ${speed}ms
📡 Status: ONLINE
🛰️ Satélite: conectado
🌍 Região: global

💻 *SISTEMA*
⚡ CPU: ${cpu}%
💾 RAM: ${ram}%
🧠 IA: ativa

🔐 Segurança: ON
📶 Conexão: lisa

🔥 Melhor que Wi-Fi do vizinho 😈`
      });
    }

    // 🎲 VERDADE OU DESAFIO
    if (body === "!vd") {
      const perguntas = [
        "😏 Qual foi sua maior vergonha?",
        "👀 Já gostou de alguém daqui?",
        "🤫 Um segredo seu?",
        "💀 Já fez algo proibido?",
        "😈 Quem você beijaria aqui?"
      ];

      const desafios = [
        "🔥 Manda áudio cantando",
        "😂 Fica 1 min sem falar",
        "📸 Manda uma careta",
        "💬 Marca alguém e elogia",
        "😎 Troca a foto por 10 min"
      ];

      const tipo = Math.random() > 0.5 ? "verdade" : "desafio";

      if (tipo === "verdade") {
        const pergunta = perguntas[Math.floor(Math.random() * perguntas.length)];
        await sock.sendMessage(from, {
          text: `🎲 *VERDADE*\n\n${pergunta}`
        });
      } else {
        const desafio = desafios[Math.floor(Math.random() * desafios.length)];
        await sock.sendMessage(from, {
          text: `🎲 *DESAFIO*\n\n${desafio}`
        });
      }
    }

    // 🚫 ANTI LINK
    if (isGroup && body.includes("chat.whatsapp.com")) {
      await sock.sendMessage(from, {
        text: "🚫 Link detectado 🤨 aqui não patrão 😎"
      });
    }
  });
}

startBot();
