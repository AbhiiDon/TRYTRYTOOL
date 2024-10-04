const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const fs = require("fs");
const pino = require("pino");
const {
    default: makeWASocket,
    Browsers,
    delay,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let botInstance;

// Initialize WhatsApp Bot
async function initBot() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/anox.json`);

    botInstance = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.windows("Chrome"),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        }
    });

    botInstance.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            io.emit("login-success", { status: true });
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
            initBot();
        }
    });

    botInstance.ev.on("creds.update", saveCreds);
}

// Start the server and the bot
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    initBot();
});

// Socket connection
io.on("connection", (socket) => {
    socket.on("sendMessages", async (data) => {
        const { runCount, timeDelay, messages, identifiers } = data;

        for (let i = 0; i < runCount; i++) {
            const identifier = identifiers[i];

            for (const message of messages) {
                await botInstance.sendMessage(identifier, { text: message });
                console.log(`Sent message to ${identifier}: ${message}`);
                await delay(timeDelay * 1000);
            }
        }
    });

    // Handle QR code generation
    botInstance.ev.on("qr", (qr) => {
        const qrImage = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`;
        socket.emit("qr-code", qrImage);
    });
});
