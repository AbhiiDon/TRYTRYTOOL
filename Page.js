const express = require("express");
const pino = require('pino');
const qrcode = require("qrcode-terminal");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Function to fetch group list
async function fetchGroupList(botInstance) {
    const groups = await botInstance.groupFetchAllParticipating();
    return Object.keys(groups).map(id => ({ id, name: groups[id].subject }));
}

async function sendMessage(botInstance, type, id, message) {
    if (type === 'number') {
        await botInstance.sendMessage(id + "@s.whatsapp.net", { text: message });
        console.log(`Sent message to number ${id}: ${message}`);
    } else if (type === 'group') {
        await botInstance.sendMessage(id, { text: message });
        console.log(`Sent message to group ${id}: ${message}`);
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
            qrcode.generate(qr, { small: true });
            res.render('index', { qr });
        }

        if (connection == "open") {
            console.log("Connection opened.");
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);

    return XeonBotInc;
}

// Serve the HTML form
app.get('/', async (req, res) => {
    await qr(res);
});

// Handle the form submission
app.post('/submit', async (req, res) => {
    const runCount = req.body.runCount;
    const runType = req.body.runType;
    const timeInterval = req.body.timeInterval;
    const message = req.body.message;

    console.log({ runCount, runType, timeInterval, message });

    // Process based on user input
    const XeonBotInc = await qr();
    if (runType === 'number') {
        for (let i = 0; i < runCount; i++) {
            const number = await question("Please enter the phone number: ");
            await sendMessage(XeonBotInc, 'number', number, message);
        }
    } else if (runType === 'group') {
        for (let i = 0; i < runCount; i++) {
            const groupId = await question("Please enter the group UID: ");
            await sendMessage(XeonBotInc, 'group', groupId, message);
        }
    }

    res.send("Messages sent successfully!");
});

// Route to fetch group list
app.get('/groups', async (req, res) => {
    const XeonBotInc = await qr();
    const groups = await fetchGroupList(XeonBotInc);
    res.json(groups);
});

// Start the server
app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
