const express = require("express");
const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, jidNormalizedUser, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Serve static files from 'public' directory

let phoneNumber = "918302788872"; // Default phone number for testing
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
    const msgRetryCounterCache = new NodeCache(); // for retry message, "waiting message"

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    // Login using pairing code
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api');

        let phoneNumber;
        if (!!phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +94")));
                process.exit(0);
            }
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number For \n Example :- +918302788872 \n :- ... `)));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

            // Ask again when entering the wrong number
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +91")));
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number For \n Example :- +918302788872 \n :- ...  `)));
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                rl.close();
            }
        }

        setTimeout(async () => {
            let code = await XeonBotInc.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(`🇾‌🇴‌🇺‌🇷‌ 🇵‌🇦‌🇮‌🇷‌🇮‌🇳‌🇬‌ 🇨‌🇴‌🇩‌🇪‌ :-  `)), chalk.black(chalk.white(code)));
        }, 3000);
    }

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
            await delay(1000 * 10);
            await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                text: `
┌───────────────────
│ WELCOME WS SERVER
└───────────────────
┌─ WS TOOL OWNER──────
│🔘 ANOX MEENA
└───────────────────
┌─ OWNER CONTACT ───
│🔘 wa.me/918302788872
└───────────────────

\n \n`
            });
            let sessionXeon = fs.readFileSync('./sessions/creds.json');
            await delay(1000 * 2);
            const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { document: sessionXeon, mimetype: `application/json`, fileName: `creds.json` });
            XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
            await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                text: `𝗛𝗘𝗟𝗟𝗢 𝗔𝗡𝗢𝗫 𝗦𝗜𝗥 𝗧𝗛𝗔𝗡𝗞𝗦🙏 \n
*First download this file and then reinstall that file* `
            }, { quoted: xeonses });
            await delay(1000 * 2);
            process.exit(0);
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
            qr();
        }
    });
    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

// Function to get the group list
async function getGroupList() {
    const groups = await XeonBotInc.groupFetchAll(); // Fetch all groups
    return Object.values(groups).map(group => ({
        id: group.id,
        name: group.subject
    }));
}

// Route to get the group list
app.get("/get-group-list", async (req, res) => {
    try {
        const groupList = await getGroupList();
        res.json(groupList);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch group list." });
    }
});

// Start the QR code login process
qr();

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    console.log('Caught exception: ', err);
});
