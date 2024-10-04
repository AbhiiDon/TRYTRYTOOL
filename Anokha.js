const qrcode = require("qrcode-terminal");
const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC } = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const readline = require("readline");
const NodeCache = require("node-cache");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// यहाँ फोन नंबर को परिभाषित करें
let phoneNumber = ""; // या इसे एक डिफ़ॉल्ट मान के साथ सेट करें, जैसे: "918302788872"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

async function qr() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`anox1.json`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        msgRetryCounterCache,
    });

    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        // Pairing code logic here...
        // (Existing code for handling pairing code)

        if (!phoneNumber) {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना WhatsApp नंबर दर्ज करें \n उदाहरण: +918302788872 \n`)));
        }
        
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +91")));
            process.exit(0);
        }
    }

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            console.log(chalk.black(chalk.bgGreen(`सफलता से लॉगिन`)));
            
            // समूह UID और नाम दिखाने का विकल्प
            const displayGroups = await question(chalk.bgBlack(chalk.greenBright(`क्या आप सभी समूह UID और नाम देखना चाहते हैं? (हाँ/नहीं) `)));
            if (displayGroups.toLowerCase() === 'हाँ') {
                // समूह UID और नामों की सूची
                const groups = [
                    { id: "Kjm8rnDFcpb04gQNSTbW2d", name: "ग्रुप 1" },
                    { id: "Kjm8rnDFcpb04gQNSTbW2d", name: "ग्रुप 2" },
                    { id: "Kjm8rnDFcpb04gQNSTbW2d", name: "ग्रुप 3" },
                ];

                console.log(chalk.black(chalk.bgGreen(`आपके समूह UID और नाम:`)));
                groups.forEach(group => {
                    console.log(chalk.black(chalk.bgWhite(`UID: ${group.id}, Name: ${group.name}`)));
                });
            }

            // कितनी बार चलाना है
            const runCount = await question(chalk.bgBlack(chalk.greenBright(`कितनी बार चलाना चाहते हैं? `)));
            
            for (let i = 0; i < runCount; i++) {
                const messageType = await question(chalk.bgBlack(chalk.greenBright(`क्या आप ग्रुप UID या नंबर पर संदेश भेजना चाहते हैं? (UID/नंबर) `)));
                const targetID = await question(chalk.bgBlack(chalk.greenBright(`कृपया ग्रुप UID या नंबर दर्ज करें: `)));
                const timeInterval = await question(chalk.bgBlack(chalk.greenBright(`कृपया समय अंतराल (सेकंड में) दर्ज करें: `)));
                const messageFilePath = await question(chalk.bgBlack(chalk.greenBright(`कृपया संदेश फ़ाइल का पथ दर्ज करें: `)));

                // संदेश भेजने का लॉजिक
                const messageArray = fs.readFileSync(messageFilePath, 'utf-8').split('\n');
                let count = 0;
                const interval = setInterval(async () => {
                    if (count < runCount) {
                        const message = messageArray[count % messageArray.length]; // संदेश का चयन करें
                        await XeonBotInc.sendMessage(targetID, { text: message });
                        console.log(chalk.black(chalk.bgGreen(`संदेश भेजा: ${message}`)));
                        count++;
                    } else {
                        clearInterval(interval);
                    }
                }, timeInterval * 1000); // समय अंतराल को मिलीसेकंड में बदलें
            }

            process.exit(0);
        }

        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

qr();

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
