const qrcode = require("qrcode"); 
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require('pino');
const app = express();
const NodeCache = require("node-cache");

// Set view engine to ejs
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public'));

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper function to send messages
async function sendMessage(botInstance, runType, runId, message) {
    if (runType === 'number') {
        await botInstance.sendMessage(`${runId}@s.whatsapp.net`, { text: message });
        console.log(`Sent message to number: ${runId}`);
    } else if (runType === 'group') {
        await botInstance.sendMessage(runId, { text: message });
        console.log(`Sent message to group: ${runId}`);
    }
}

// QR code generator and authentication
async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/anox.json`);
    const msgRetryCounterCache = new NodeCache();
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Disable terminal QR print
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

    // Generate and return the QR code image
    XeonBotInc.ev.on('connection.update', (s) => {
        const { qr } = s;
        if (qr) {
            console.log('QR received:', qr);
            return qr;  // Send this QR to the frontend to render in HTML
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    return XeonBotInc;
}

// Handle GET request for the form
app.get('/', async (req, res) => {
    const qr = await qr(); // Generate the QR code
    res.render('index', { qr });
});

// Handle form submission
app.post('/submit', upload.single('messageFile'), async (req, res) => {
    const runCount = req.body.runCount;
    const timeInterval = req.body.timeInterval;
    const messageFile = req.file;  // Uploaded message file

    // Read message from the uploaded file
    const messages = fs.readFileSync(path.join(__dirname, messageFile.path), 'utf-8').split('\n').filter(Boolean);

    const XeonBotInc = await qr(); // Connect to WhatsApp

    // Iterate over each run and send message
    for (let i = 0; i < runCount; i++) {
        const runType = req.body[`runType${i}`]; // Get type (number/group)
        const runId = req.body[`runId${i}`];     // Get number or group UID

        // Send each message in sequence from the file
        for (let msg of messages) {
            await sendMessage(XeonBotInc, runType, runId, msg); // Send message
            await new Promise(resolve => setTimeout(resolve, timeInterval * 1000)); // Delay for the next message
        }
    }

    res.send("Messages sent successfully!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
