import * as lamejs from "@breezystack/lamejs";

export const VOICE_NAME = "Kore";
export const TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Ton/Tempo/Übersetzungsanteil pro Niveau (unabhängig vom Lektionstyp).
const LEVEL_TONE = {
  A1: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion (ca. 2 Minuten)
für einen Anfänger (A1), der sie beim Autofahren anhört. Sprich LANGSAM und
deutlich. Neue Wörter: zuerst Spanisch, dann kurz die deutsche Bedeutung,
dann nochmal Spanisch. Wiederhole wichtige Wörter/Sätze mehrfach.`,
  A2: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion (ca. 2–3 Minuten)
für einen fortgeschrittenen Anfänger (A2), der sie beim Autofahren anhört.
Normales, aber noch deutliches Sprechtempo. Neue oder schwierige Wörter
kurz auf Deutsch erklären, aber nicht mehr jedes Wort übersetzen.
Wiederhole wichtige neue Wendungen einmal.`,
  B1: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion (ca. 3 Minuten)
für einen Lernenden auf Mittelstufen-Niveau (B1), der sie beim Autofahren
anhört. Natürliches Sprechtempo. Nur wirklich seltene oder schwierige
Wörter kurz auf Deutsch erklären – die meisten Sätze bleiben unübersetzt.`
};

// Regionale Ausrichtung: Der Nutzer reist nach Paraguay – das Spanisch soll
// klingen wie dort gesprochen, nicht wie in Spanien. Gilt für JEDE Lektion.
const REGION_HINT = `WICHTIG – Region: Der Lernende reist nach Paraguay.
Verwende paraguayisches Spanisch: „vos" statt „tú" (vos tenés, vos querés,
vení, mirá, dale), Anrede und Höflichkeitsformen wie in Asunción üblich.
Preise immer in Guaraníes (der Landeswährung), nicht in Euro.`;

// Guaraní ist zweite Amtssprache in Paraguay. Wird in JEDE Lektion eingestreut
// (außer bei type "guarani" – dort ist Guaraní schon das ganze Thema).
const GUARANI_HINT = `Guaraní: Paraguay ist zweisprachig. Baue in diese Lektion
2–3 einfache Guaraní-Wörter oder -Floskeln ein, die zum Thema passen (z. B.
maitei = Grüße/hallo, mba'éichapa = wie geht's?, aguyje = danke, heẽ = ja,
nahániri = nein). Nenne jeweils das Guaraní-Wort LANGSAM und Silbe für Silbe,
dann die deutsche Bedeutung, dann das Guaraní-Wort noch einmal. Erfinde nichts:
wenn Paraguayer für einen Begriff im Alltag das spanische Wort benutzen, sag das
ehrlich statt ein Guaraní-Wort zu konstruieren. Wiederhole die Guaraní-Wörter am
Ende der Lektion einmal kurz.`;

// Aufbau/Form der Lektion je nach Typ (unabhängig vom Niveau).
const TYPE_FORMAT = {
  dialog: `Erstelle dazu einen kurzen Dialog zwischen zwei Personen zum
genannten Thema.`,
  vokabular: `Erstelle dazu KEINEN Dialog, sondern eine strukturierte
Wortschatz-Lektion: Stelle 10–15 zentrale spanische Wörter/Ausdrücke zum
genannten Thema vor. Für jedes Wort: zuerst das spanische Wort, dann kurz
die deutsche Bedeutung, dann das spanische Wort noch einmal in einem
kurzen Beispielsatz.`,
  verben: `Erstelle dazu KEINEN Dialog, sondern eine Verben-Lektion: Stelle
10–12 besonders wichtige spanische Alltagsverben vor (passend zum
genannten Thema, z. B. ser, estar, tener, ir, hacer, querer, poder). Für
jedes Verb: nenne den Infinitiv mit deutscher Bedeutung, dann 1–2 wichtige
konjugierte Beispielsätze im Präsens.`,
  beschreibung: `Erstelle dazu KEINEN Dialog, sondern eine Lektion zum
Beschreiben: Beschreibe Personen, Orte oder Dinge zum genannten Thema in
mehreren kurzen, klaren Sätzen (z. B. Aussehen, Eigenschaften, Lage). Baue
dabei wichtiges Beschreibungs-Vokabular (Adjektive) ein und erkläre neue
Adjektive kurz auf Deutsch.`,
  fragen: `Erstelle dazu KEINEN Dialog, sondern eine Lektion zu
Fragewörtern: Stelle die wichtigsten spanischen W-Fragewörter vor (qué,
quién, dónde, cuándo, por qué, cómo, cuánto) – jeweils mit deutscher
Bedeutung – und bilde zu jedem Fragewort 1–2 passende Beispielfragen zum
genannten Thema, inklusive kurzer beispielhafter Antwort.`,
  guarani: `Erstelle dazu KEINEN Dialog, sondern eine GUARANÍ-Lektion: Stelle
8–12 einfache Guaraní-Wörter oder Floskeln zum genannten Thema vor – nur
solche, die man in Paraguay im Alltag wirklich hört. Für jedes Wort: zuerst
das Guaraní-Wort LANGSAM und Silbe für Silbe, dann die deutsche Bedeutung,
dann das spanische Äquivalent, dann das Guaraní-Wort noch einmal in einem
kurzen Beispielsatz. Erfinde keine Wörter – wo Paraguayer im Alltag das
spanische Wort benutzen, sag das ausdrücklich. Wiederhole am Ende alle Wörter
noch einmal als kurze Liste.`,
  zusammenfassung: `Erstelle dazu KEINEN neuen Dialog, sondern eine
WIEDERHOLUNGS-Lektion: Fasse das Wichtigste zu den genannten Situationen
zusammen. Gehe die Situationen der Reihe nach durch und nenne je Situation
die 3–5 Sätze, die man dort wirklich braucht – jeweils Spanisch, kurze
deutsche Bedeutung, Spanisch. Baue am Ende eine kleine Selbst-Abfrage ein:
nenne die deutsche Bedeutung, dann eine hörbare Denkpause (schreibe dafür
„… uno … dos … tres …"), dann die spanische Lösung.`
};

function buildSystem(level, type) {
  const parts = [LEVEL_TONE[level], TYPE_FORMAT[type], REGION_HINT];
  if (type !== "guarani") parts.push(GUARANI_HINT);
  parts.push("Gib NUR den vorzulesenden Text aus – kein Markdown, keine Überschriften.");
  return parts.join("\n");
}

// Curriculum: Themen sind in Blöcken nach Niveau sortiert, gedeckelt bei B1
// (bewusst kein B2/C1 – Nutzerwunsch). Jedes Thema ist entweder ein reiner
// String (= normale Dialog-Lektion) oder ein { topic, type }-Objekt für die
// speziellen Lektionstypen (Vokabular/Verben/Beschreibung/Fragen). Die
// Auswahl (siehe pickForIndex) arbeitet sich block für block durch – so
// wiederholt sich ein Thema erst, wenn sein ganzer Niveau-Block durch ist,
// UND das Niveau steigt mit der Zeit. Ist der letzte Block (B1) einmal
// komplett durch, wird nur noch er wiederholt (kein Rücksprung auf A1, aber
// auch kein Steigen über B1 hinaus).
export const CURRICULUM = [
  {
    level: "A1",
    topics: [
      { topic: "die ersten Guaraní-Wörter: hallo, danke, ja, nein, entschuldigung", type: "guarani" },
      "am Flughafen Asunción ankommen: Einreise und Passkontrolle",
      { topic: "Wortschatz: Flughafen, Gepäck und Dokumente", type: "vokabular" },
      "die Gepäckausgabe finden und durch den Zoll gehen",
      "vom Flughafen ein Taxi oder einen Fahrdienst nehmen",
      { topic: "die wichtigsten Fragewörter – nach Weg, Preis und Uhrzeit fragen", type: "fragen" },
      "beim Airbnb ankommen und den Gastgeber begrüßen",
      "beim Check-in nach Schlüssel, WLAN und Klimaanlage fragen",
      { topic: "Wortschatz: Wohnung, Schlüssel, WLAN und Haushalt", type: "vokabular" },
      "einen Mietwagen am Flughafen abholen und die Reservierung bestätigen",
      { topic: "Wortschatz: Mietwagen, Tanken und Versicherung", type: "vokabular" },
      "Zahlen und Preise in Guaraníes verstehen",
      { topic: "höflich grüßen und sich bedanken – auf Spanisch und Guaraní", type: "guarani" },
      "im Supermarkt in Asunción einkaufen",
      { topic: "Wiederholung A1: Ankunft am Flughafen, Airbnb-Check-in und Mietwagen", type: "zusammenfassung" }
    ]
  },
  {
    level: "A2",
    topics: [
      "am Flughafen verlorenes Gepäck melden",
      "beim Airbnb etwas melden, das nicht funktioniert (Warmwasser, Klimaanlage)",
      "die Mietwagen-Übergabe: Schäden und Tankregelung besprechen",
      { topic: "die wichtigsten Reise-Verben (llegar, recoger, alquilar, pagar, esperar)", type: "verben" },
      "an der Tankstelle tanken und nach dem Parken fragen",
      { topic: "Wortschatz: Auto, Straße und Wegbeschreibung in Paraguay", type: "vokabular" },
      "bei einer Verkehrskontrolle ruhig und höflich reagieren",
      "Smalltalk mit dem Gastgeber: woher kommst du, wie lange bleibst du",
      { topic: "Guaraní im Alltag: Wörter, die Paraguayer mitten im Spanischen benutzen", type: "guarani" },
      "im Restaurant typisch paraguayisch bestellen (Chipa, Sopa paraguaya, Tereré)",
      { topic: "die Unterkunft und die Umgebung beschreiben", type: "beschreibung" },
      "einen Ausflug planen und nach dem Weg fragen",
      "Geld wechseln und mit Karte bezahlen",
      "den Aufenthalt im Airbnb um ein paar Tage verlängern",
      { topic: "Wiederholung A2: Probleme melden, Auto fahren und Guaraní-Basics", type: "zusammenfassung" }
    ]
  },
  {
    level: "B1",
    topics: [
      "ein Missverständnis mit dem Autovermieter klären (Extrakosten auf der Rechnung)",
      "eine Beschwerde beim Airbnb-Gastgeber höflich aber deutlich vortragen",
      "eine Panne oder einen kleinen Unfall melden",
      "mit Nachbarn über die Gegend und den Alltag in Paraguay sprechen",
      { topic: "Wortschatz: Geld, Bank und Bezahlen in Paraguay", type: "vokabular" },
      "bei einer Behörde eine Auskunft einholen",
      "in der Apotheke oder beim Arzt ein Problem schildern",
      { topic: "Jopara: wie Paraguayer Spanisch und Guaraní im Alltag mischen", type: "guarani" },
      "auf dem Markt oder mit einem Handwerker über den Preis verhandeln",
      "ein Haus oder eine Wohnung längerfristig mieten",
      "über Klima, Menschen und das Leben in Paraguay sprechen",
      { topic: "Menschen, Orte und Situationen lebendig beschreiben", type: "beschreibung" },
      "die eigenen Reisepläne für die nächsten Wochen erklären",
      "eine Einladung annehmen oder höflich ablehnen",
      { topic: "Wiederholung B1: Ankunft, Wohnen, Auto und Kommunikation in Paraguay", type: "zusammenfassung" }
    ]
  }
];

// Episoden-Anzahl, ab der das Curriculum neu bei A1 startet. Ältere Episoden
// (Index < CURRICULUM_RESET_AT) bleiben in den Blobs unverändert erhalten,
// zählen für die Themenwahl aber nicht mehr mit – die Rotation rechnet ab hier
// wieder bei 0.
// Historie: 63 = Reset am 2026-07-31 (Cap bei B1 statt C1).
//          169 = Reset am 2026-08-23 (Neuausrichtung auf die Paraguay-Reise:
//                Flughafen/Airbnb/Mietwagen + Guaraní, s. CURRICULUM oben).
const CURRICULUM_RESET_AT = 169;

// Wählt Thema, Niveau, Typ und System-Prompt für die n-te Lektion (0-basiert;
// n = Anzahl bisher erzeugter Episoden). Arbeitet sich block für block durchs
// Curriculum; ist der letzte Block einmal komplett durch, wird nur noch er
// wiederholt.
export function pickForIndex(index) {
  let remaining = Math.max(0, index - CURRICULUM_RESET_AT);
  for (let i = 0; i < CURRICULUM.length; i++) {
    const block = CURRICULUM[i];
    const isLast = i === CURRICULUM.length - 1;
    if (remaining < block.topics.length || isLast) {
      const entry = block.topics[remaining % block.topics.length];
      const { topic, type } = typeof entry === "string" ? { topic: entry, type: "dialog" } : entry;
      return { level: block.level, topic, type, system: buildSystem(block.level, type) };
    }
    remaining -= block.topics.length;
  }
}

export function pcmToMp3(pcmBase64, sampleRate) {
  const bytes = Uint8Array.from(Buffer.from(pcmBase64, "base64"));
  let samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
  const threshold = 200;
  let end = samples.length;
  while (end > 0 && Math.abs(samples[end - 1]) < threshold) end--;
  end = Math.min(samples.length, end + Math.floor(sampleRate * 0.3));
  samples = samples.subarray(0, end);
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const chunks = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const buf = encoder.encodeBuffer(samples.subarray(i, i + 1152));
    if (buf.length > 0) chunks.push(Buffer.from(buf));
  }
  const last = encoder.flush();
  if (last.length > 0) chunks.push(Buffer.from(last));
  return Buffer.concat(chunks);
}

// Erzeugt Skript (Claude) + Audio (Gemini TTS) für ein Thema/Niveau/Typ und
// gibt die fertige MP3 zurück. Wirft bei jedem Fehlschlag (Claude, Gemini,
// kein Audio) mit einer sprechenden Meldung.
export async function generateEpisodeAudio(topic, system) {
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.MY_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: `Thema: ${topic}.` }]
    })
  });
  if (!claudeRes.ok) {
    throw new Error(`CLAUDE-FEHLER ${claudeRes.status}: ${await claudeRes.text()}`);
  }
  const data = await claudeRes.json();
  const skript = data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();

  const ttsRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": process.env.MY_GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: skript }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } }
        }
      })
    }
  );
  if (!ttsRes.ok) {
    throw new Error(`GEMINI-FEHLER ${ttsRes.status}: ${await ttsRes.text()}`);
  }
  const ttsData = await ttsRes.json();
  const part = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) {
    throw new Error(`KEIN AUDIO: ${JSON.stringify(ttsData).slice(0, 500)}`);
  }
  const rate = Number(part.mimeType?.match(/rate=(\d+)/)?.[1]) || 24000;
  return pcmToMp3(part.data, rate);
}
