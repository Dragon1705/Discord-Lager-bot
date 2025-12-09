const { Client, GatewayIntentBits } = require("discord.js");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// HIER DEINE EXEC URL EINTRAGEN:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbznGzitMO1e2_9HyyIj2uquSgdsKwTVwEHQhnxImiRqax40IZe05qq0X4i6VHbQmd9Xug/exec";

// DER CHANNEL, IN DEM !lager ERLAUBT IST:
const LAGER_CHANNEL = "buchhaltung";

// HAUPTARTIKEL FÜR LAGERANZEIGE
const ARTIKEL_LISTE = [
  "WM 29",
  "Ceramic Pistole",
  "SNS",
  "SNS MK2",
  "Pistole MK2",
  "Tec9",
  "50er",
  "Bullpup Rifle",
  "SMG MK2",
  "Pistole",
  "Micro SMG",
  "Mini SMG",
  "Westen",
  "Munition",
  "Leichte Munition",
  "Schwere Munition",
  "Waffenteile",
  "Kokskisten",
  "Grüngeld",
  "Schwarzgeld"
];

// ALIAS-FUZZY SYSTEM
const ARTIKEL_ALIAS = {
  "WM 29": ["wm29", "wm 29", "29"],
  "Ceramic Pistole": ["ceramic", "keramik", "keramik pistole"],
  "SNS": ["sns"],
  "SNS MK2": ["sns mk2", "snsmk2", "mk2 sns"],
  "Pistole MK2": ["pistole mk2", "pistol mk2", "mk2 pistole", "mk2"],
  "Tec9": ["tec9", "tec 9", "tec"],
  "50er": ["50er", "50-er", "50"],
  "Bullpup Rifle": ["bullpup", "bpr", "bullpup rifle"],
  "SMG MK2": ["smg mk2", "smgmk2", "mk2 smg"],
  "Pistole": ["pistole", "pistol"],
  "Micro SMG": ["micro", "micro smg", "microsmg"],
  "Mini SMG": ["mini", "mini smg", "minismg"],
  "Westen": ["weste", "westen", "armor"],

  // WICHTIG: Munition wird extra priorisiert — hier stehen NUR Zusätze!
  "Munition": ["ammo"],
  "Leichte Munition": ["lm", "light ammo", "leicht"],
  "Schwere Munition": ["sm", "heavy ammo", "schwer"],

  "Waffenteile": ["teile", "waffenteil", "waffenteile"],
  "Kokskisten": ["koks", "kiste", "kisten", "crate"],
  "Grüngeld": ["grün", "grüngeld", "green", "gruen"],
  "Schwarzgeld": ["schwarz", "schwarzgeld", "black"]
};

// 🔥 ***NEUE KORREKTE MUNITIONSERKENNUNG (PRIORISIERT)***
function findeArtikel(input) {
  const norm = input.toLowerCase().trim();

  // 1️⃣ Schwere Munition
  if (norm.includes("schwere") || norm.includes("heavy") || norm === "sm") {
    return "Schwere Munition";
  }

  // 2️⃣ Leichte Munition
  if (norm.includes("leichte") || norm.includes("light") || norm === "lm") {
    return "Leichte Munition";
  }

  // 3️⃣ Normale Munition
  if (norm.includes("muni") || norm.includes("munition") || norm === "ammo") {
    return "Munition";
  }

  // Rest fuzzy
  for (const [artikel, aliasListe] of Object.entries(ARTIKEL_ALIAS)) {
    if (aliasListe.includes(norm)) return artikel;
    if (aliasListe.some(a => norm.includes(a))) return artikel;
  }

  return null;
}

// DISCORD BOT INITIALISIEREN
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// BOT READY
client.on("ready", () => {
  console.log(`Bot ist online als ${client.user.tag}`);
});

// !lager Handler
async function handleLagerBefehl(msg) {
  if (msg.channel.name !== LAGER_CHANNEL) {
    return msg.reply("❌ Der Befehl `!lager` ist nur im Kanal **#" + LAGER_CHANNEL + "** erlaubt.");
  }

  try {
    const response = await fetch(SCRIPT_URL);
    const data = await response.json();

    let text = "📦 **Aktueller Lagerbestand:**\n\n";

    let ausgabeGruenHeute = 0;
    let ausgabeSchwarzHeute = 0;

    let ausgabeGruenWoche = 0;
    let ausgabeSchwarzWoche = 0;

    data.forEach(item => {
      // Bestand anzeigen
      if (ARTIKEL_LISTE.includes(item.artikel)) {
        text += `• **${item.artikel}** : ${item.menge}\n`;
      }

      // Tagesausgaben
      if (item.artikel === "Grüngeld") {
        ausgabeGruenHeute += Number(item.tagesausgaben) || 0;
        ausgabeGruenWoche += Number(item.wochausgaben) || 0;
      }
      if (item.artikel === "Schwarzgeld") {
        ausgabeSchwarzHeute += Number(item.tagesausgaben) || 0;
        ausgabeSchwarzWoche += Number(item.wochausgaben) || 0;
      }
    });

    // Finanzübersicht
    text += "\n💸 **Ausgaben Heute:**\n";
    text += `• Grüngeld: **${ausgabeGruenHeute}**\n`;
    text += `• Schwarzgeld: **${ausgabeSchwarzHeute}**\n`;

    text += "\n📅 **Ausgaben Diese Woche:**\n";
    text += `• Grüngeld: **${ausgabeGruenWoche}**\n`;
    text += `• Schwarzgeld: **${ausgabeSchwarzWoche}**\n`;

    msg.reply(text);

  } catch (err) {
    console.error(err);
    msg.reply("❌ Fehler beim Abrufen der Lagerdaten.");
  }
}

// MESSAGE HANDLING
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.trim();

  // LAGERABFRAGE
  if (content.startsWith("!lager")) {
    return handleLagerBefehl(msg);
  }

  // Nur Buchungen verarbeiten
  if (!(content.includes("+") || content.includes("-"))) return;

  // Mehrere Buchungen extrahieren
  const teile = content.match(/[+-]\s*\d+\s+[A-Za-zÄÖÜäöüß ]+/g);

  if (!teile) {
    return msg.reply("❌ Ungültiges Format! Beispiel:\n`-5 Westen +10 Koks -2 Teile`");
  }

  let antwort = "📦 **Lager aktualisiert:**\n";

  for (const teil of teile) {
    const split = teil.trim().split(" ");
    const nummer = Number(split[0]);
    const artikelInput = split.slice(1).join(" ");

    if (isNaN(nummer)) {
      antwort += `❌ Ungültige Zahl: ${split[0]}\n`;
      continue;
    }

    const artikel = findeArtikel(artikelInput);
    if (!artikel) {
      antwort += `❌ Artikel nicht gefunden: **${artikelInput}**\n`;
      continue;
    }

    // Anfrage an Google Script
    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artikel, anzahl: nummer })
      });

      const text = await response.text();
      antwort += `➡️ **${nummer} ${artikel}** (Google: ${text})\n`;

    } catch (err) {
      antwort += `❌ Google Fehler bei: **${artikel}**\n`;
      console.error(err);
    }
  }

  msg.reply(antwort);
});

// BOT STARTEN — TOKEN HIER EINTRAGEN:
client.login(process.env.BOT_TOKEN);
