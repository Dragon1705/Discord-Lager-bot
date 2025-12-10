require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const cron = require("node-cron"); // <-- Cron hinzugefügt
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// =================================================================
//  GOOGLE URL & CHANNEL
// =================================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUCkJPKgdGF7jQDQrYcp2sPCTz86CD0-iYeLY3RTvakqQ2dtLYEXVDz_gWPkKHVPv5AA/exec";
const LAGER_CHANNEL = "buchhaltung";

// =================================================================
//  AUSGABEN & EINNAHMEN SPEICHER
// =================================================================
const STORAGE_FILE = "./ausgaben.json";

if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({
        ausgaben: {
            heute: { gruen: 0, schwarz: 0 },
            woche: { gruen: 0, schwarz: 0 }
        },
        einnahmen: {
            heute: { gruen: 0, schwarz: 0 },
            woche: { gruen: 0, schwarz: 0 }
        }
    }, null, 2));
}

function loadStats() {
    return JSON.parse(fs.readFileSync(STORAGE_FILE));
}

function saveStats(data) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

// =================================================================
//  ARTIKEL / ALIAS
// =================================================================
const ARTIKEL_LISTE = [
  "WM 29", "Ceramic Pistole", "SNS MK2", "SNS", "Pistole MK2",
  "Tec9", "50er", "Bullpup Rifle", "SMG MK2", "Pistole",
  "Micro SMG", "Mini SMG", "Westen", "Munition",
  "Leichte Munition", "Schwere Munition", "Waffenteile",
  "Kokskisten", "Grüngeld", "Schwarzgeld"
];

const ARTIKEL_ALIAS = {
  "SNS MK2": ["sns mk2", "snsmk2", "sns2", "mk2 sns"],
  "SNS": ["sns"],

  "Grüngeld": ["grün", "grüngeld", "green", "gruen"],
  "Schwarzgeld": ["schwarz", "schwarzgeld", "black"],

  "WM 29": ["wm29", "wm 29", "29", "wm"],
  "Ceramic Pistole": ["ceramic", "keramik", "keramik pistole"],
  
  "Pistole MK2": ["pistole mk2", "pistol mk2"],
  "Tec9": ["tec9", "tec 9", "tec"],
  "50er": ["50er", "50"],
  "Bullpup Rifle": ["bullpup", "bpr"],
  "SMG MK2": ["smg mk2"],
  "Pistole": ["pistole", "pistol"],
  "Micro SMG": ["micro", "micro smg"],
  "Mini SMG": ["mini", "mini smg"],
  "Westen": ["weste", "westen"],
  
  "Munition": ["ammo", "munition", "muni"],
  "Leichte Munition": ["lm", "light ammo", "leichte muni", "leichte munition"],
  "Schwere Munition": ["sm", "heavy ammo", "schwere muni", "schwere munition"],
  
  "Waffenteile": ["teile", "waffenteil", "waffenteile"],
  "Kokskisten": ["koks", "kokskisten", "kisten", "kiste", "crate"]
};

function findeArtikel(input) {
    input = input.toLowerCase().trim();
    for (const [artikel, aliasListe] of Object.entries(ARTIKEL_ALIAS)) {
        for (const alias of aliasListe) {
            if (input === alias || input.includes(alias)) {
                return artikel;
            }
        }
    }
    return null;
}

// =================================================================
//  DISCORD CLIENT
// =================================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on("ready", () => {
    console.log(`Bot gestartet als ${client.user.tag}`);
});

// =================================================================
//  AUTOMATISCHE DAILY & WEEKLY CRON-RESETS
// =================================================================

// TAGESRESET – JEDEN TAG 00:00 UHR
cron.schedule("0 0 * * *", () => {
    let stats = loadStats();

    stats.einnahmen.heute = { gruen: 0, schwarz: 0 };
    stats.ausgaben.heute = { gruen: 0, schwarz: 0 };

    saveStats(stats);
    console.log("🔄 Tagesreset durchgeführt (heute)");
});

// WOCHENRESET – JEDEN MONTAG 00:00 UHR
cron.schedule("0 0 * * 1", () => {
    let stats = loadStats();

    stats.einnahmen.woche = { gruen: 0, schwarz: 0 };
    stats.ausgaben.woche = { gruen: 0, schwarz: 0 };

    saveStats(stats);
    console.log("🔁 Wochenreset durchgeführt (woche)");
});

// =================================================================
//  !lager – Anzeige
// =================================================================
async function handleLagerBefehl(msg) {
    const stats = loadStats();

    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();

        let text = "📦 **Aktueller Lagerbestand:**\n\n";

        data.forEach(item => {
            if (ARTIKEL_LISTE.includes(item.artikel)) {
                text += `• **${item.artikel}**: ${item.menge}\n`;
            }
        });

        // Einnahmen
        text += "\n💰 **Einnahmen Heute:**\n";
        text += `• Grüngeld: **${stats.einnahmen.heute.gruen}**\n`;
        text += `• Schwarzgeld: **${stats.einnahmen.heute.schwarz}**\n`;

        text += "\n📅 **Einnahmen Diese Woche:**\n";
        text += `• Grüngeld: **${stats.einnahmen.woche.gruen}**\n`;
        text += `• Schwarzgeld: **${stats.einnahmen.woche.schwarz}**\n`;

        // Ausgaben
        text += "\n💸 **Ausgaben Heute:**\n";
        text += `• Grüngeld: **${stats.ausgaben.heute.gruen}**\n`;
        text += `• Schwarzgeld: **${stats.ausgaben.heute.schwarz}**\n`;

        text += "\n📅 **Ausgaben Diese Woche:**\n";
        text += `• Grüngeld: **${stats.ausgaben.woche.gruen}**\n`;
        text += `• Schwarzgeld: **${stats.ausgaben.woche.schwarz}**\n`;

        msg.reply(text);

    } catch (err) {
        console.error(err);
        msg.reply("❌ Fehler beim Abrufen der Lagerdaten.");
    }
}

// =================================================================
//  BUCHUNGEN + / -
// =================================================================
client.on("messageCreate", async msg => {
    if (msg.author.bot) return;

    const content = msg.content.trim();

    if (content.startsWith("!lager")) return handleLagerBefehl(msg);

    if (!(content.startsWith("+") || content.startsWith("-"))) return;

    const teile = content.match(/[+-]\s*\d+\s*[A-Za-z0-9ÄÖÜäöüß]+(?:\s*[A-Za-z0-9ÄÖÜäöüß]+)*/gi);
    if (!teile) {
        return msg.reply("⚠️ Falsches Format! Beispiel: `-5 Westen`, `+10koks`, `-1sns mk2`");
    }

    let stats = loadStats();
    let fehler = [];

    for (const teil of teile) {
        const match = teil.match(/([+-]\s*\d+)\s*(.*)/);
        if (!match) continue;

        const menge = Number(match[1].replace(" ", ""));
        const artikelInput = match[2].trim().toLowerCase();
        const artikel = findeArtikel(artikelInput);

        if (!artikel) {
            fehler.push(`❌ **${teil}** → Artikel unbekannt`);
            continue;
        }

        if (isNaN(menge)) {
            fehler.push(`❌ **${teil}** → Menge ungültig`);
            continue;
        }

        // Einnahmen
        if (artikel === "Grüngeld" && menge > 0) {
            stats.einnahmen.heute.gruen += menge;
            stats.einnahmen.woche.gruen += menge;
        }
        if (artikel === "Schwarzgeld" && menge > 0) {
            stats.einnahmen.heute.schwarz += menge;
            stats.einnahmen.woche.schwarz += menge;
        }

        // Ausgaben
        if (artikel === "Grüngeld" && menge < 0) {
            stats.ausgaben.heute.gruen += Math.abs(menge);
            stats.ausgaben.woche.gruen += Math.abs(menge);
        }
        if (artikel === "Schwarzgeld" && menge < 0) {
            stats.ausgaben.heute.schwarz += Math.abs(menge);
            stats.ausgaben.woche.schwarz += Math.abs(menge);
        }

        // Google Script senden
        await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artikel, menge })
        });
    }

    saveStats(stats);

    if (fehler.length > 0) {
        return msg.reply(fehler.join("\n"));
    }

    // Kein Fehler → keine Antwort
});
