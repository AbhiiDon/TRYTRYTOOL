const express = require("express");
const { default: makeWASocket, Browsers, fetchLatestBaileysVersion, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const fs = require("fs");
const pino = require("pino");
const chalk = require("chalk");
const NodeCache = require("node-cache");
const readline = require("readline");
const cors = require("cors");

const app = express();
const port = 3000;
const msgRetryCounterCache = new NodeCache(); // For retry messages
let pairingCode = "";

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serve static files from 'public' folder

// Function to initialize WhatsApp socket
async function initializeSocket(phoneNumber) {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);

    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        msgRetryCounterCache,
    });

    socket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green("Connection opened!"));
            // Send welcome message here
            // Add your logic for sending messages or handling groups
        } else if (connection === "close" && lastDisconnect.error) {
            console.log(chalk.red("Connection closed! Reconnecting..."));
            initializeSocket(phoneNumber); // Reconnect
        }
    });

    return socket;
}

// Endpoint to get the pairing code
app.post("/get-pairing-code", async (req, res) => {
    const { phoneNumber } = req.body;
    if (phoneNumber) {
        pairingCode = await requestPairingCode(phoneNumber);
        return res.json({ pairingCode });
    }
    res.status(400).json({ error: "Phone number is required" });
});

// Function to request pairing code
async function requestPairingCode(phoneNumber) {
    let code = phoneNumber.match(/.{1,4}/g)?.join("-") || "1234-5678"; // Simulated pairing code
    console.log(chalk.black(chalk.bgGreen(`Your pairing code: `)), chalk.black(chalk.white(code)));
    return code;
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
