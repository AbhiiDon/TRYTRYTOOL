const express = require("express");
const fs = require('fs');
const pino = require('pino');
const qrcode = require("qrcode-terminal");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');  // For rendering HTML using EJS

// Messages will be read from message.txt
let messages = fs.readFileSync('message.txt', 'utf-8').split('\n').filter(Boolean);

async function sendMessageToNumber(botInstance, number) {
    let messageIndex = 0;
    while (true) {
        let message = messages[messageIndex];
        await botInstance.sendMessage(number + "@s.whatsapp.net", { text: message });
        console.log(`Sent message to number ${number}: ${message}`);
        messageIndex = (messageIndex + 1) % messages.length;
        await delay(30 * 1000);
    }
}

async function sendMessagesToGroup(botInstance, groupId) {
    let messageIndex = 0;
    while (true) {
        let message = messages[messageIndex];
        await botInstance.sendMessage(groupId, { text: message });
        console.log(`Sent message to group ${groupId}: ${message}`);
        messageIndex = (messageIndex + 1) % messages.length;
        await delay(30 * 1000);
    }
}

async function qr(res) {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/anox.json`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;
        if (qr) {
            // Generate QR code
            qrcode.generate(qr, { small: true });
            res.render('index', { qr });  // Send QR code to the browser
        }

        if (connection == "open") {
            console.log("Connection opened.");
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
}

// Serve the HTML form
app.get('/', (req, res) => {
    qr(res);
});

// Handle the form submission
app.post('/submit', (req, res) => {
    const runCount = req.body.runCount;
    const runType = req.body.runType;
    const timeInterval = req.body.timeInterval;
    const msgFile = req.body.msgFile;
    
    // Process the input data
    console.log({ runCount, runType, timeInterval, msgFile });

    res.send("Form submitted successfully!");
});

// Start the server
app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
