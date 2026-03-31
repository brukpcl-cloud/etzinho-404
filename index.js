
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot online 🚀");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor web ativo");
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("ESCANEIA O QR CODE:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Bot conectado!");
    }

    if (connection === "close") {
      console.log("❌ Conexão caiu, reiniciando...");
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startBot();
