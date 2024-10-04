const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve the index page
app.get('/', (req, res) => {
    res.render('index');
});

// Function to start WhatsApp bot
async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/anox.json`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        msgRetryCounterCache,
    });

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
            console.log("Connection opened, sending login success.");
            // Send login success status to HTML
            setLoginStatus("Login Successful");
        } else if (s.qr) {
            // Send QR code to HTML
            setQRCode(s.qr);
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            startWhatsAppBot();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

// Initialize the bot and QR code handling
startWhatsAppBot();

// Handle message sending
app.post('/send-messages', async (req, res) => {
    const { sendTo, timeInterval } = req.body;
    const messageFile = req.files.messageFile;

    // Read messages from the uploaded file
    const messages = fs.readFileSync(messageFile.tempFilePath, 'utf-8').split('\n').filter(Boolean);

    const sendMessage = async () => {
        let messageIndex = 0;

        while (true) {
            let message = messages[messageIndex];
            await XeonBotInc.sendMessage(sendTo + "@s.whatsapp.net", { text: message });
            console.log(`Sent message to ${sendTo}: ${message}`);

            messageIndex = (messageIndex + 1) % messages.length;
            await delay(timeInterval * 1000); // Wait for specified time interval
        }
    };

    sendMessage();
    res.json({ success: true, message: 'Messages will be sent.' });
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
