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
genannten Thema, inklusive kurzer beispielhafter Antwort.`
};

function buildSystem(level, type) {
  return `${LEVEL_TONE[level]}\n${TYPE_FORMAT[type]}\nGib NUR den vorzulesenden Text aus – kein Markdown, keine Überschriften.`;
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
      "sich vorstellen und begrüßen",
      "im Restaurant bestellen",
      "nach dem Weg fragen",
      "einkaufen gehen",
      "die Uhrzeit sagen",
      "über das Wetter sprechen",
      "die Familie vorstellen",
      "Zahlen und Preise",
      "ein Taxi rufen",
      "im Hotel einchecken",
      "im Café einen Kaffee bestellen",
      "sich für einen Termin verabreden",
      "Kleidung im Geschäft kaufen",
      "nach der Speisekarte und Allergien fragen",
      "sich verabschieden und gute Besserung wünschen",
      { topic: "Grundwortschatz: Zahlen, Farben und Wochentage", type: "vokabular" },
      { topic: "die wichtigsten Fragewörter – W-Fragen stellen", type: "fragen" },
      "der eigene Tagesablauf"
    ]
  },
  {
    level: "A2",
    topics: [
      "eine Wohnung besichtigen",
      "beim Arzt einen Termin machen",
      "eine Zugfahrkarte kaufen und nach Verspätungen fragen",
      "eine Unterkunft im Reisebüro buchen",
      "eine Reklamation im Geschäft",
      "Freizeitpläne fürs Wochenende besprechen",
      "das eigene Zuhause beschreiben",
      "eine Wegbeschreibung mit mehreren Stationen geben",
      "sich im Fitnessstudio anmelden",
      "ein Missverständnis am Telefon klären",
      { topic: "die wichtigsten Verben im Alltag (ser, estar, tener, ir, hacer)", type: "verben" },
      { topic: "Wortschatz: Reisen und Verkehrsmittel", type: "vokabular" },
      "ein Restaurant für eine Feier reservieren",
      "über Hobbys und Interessen sprechen",
      "eine Verabredung kurzfristig verschieben"
    ]
  },
  {
    level: "B1",
    topics: [
      "die Vor- und Nachteile des Stadtlebens diskutieren",
      "von den letzten Ferien erzählen",
      "einen Streit zwischen Freunden schlichten",
      "ein Vorstellungsgespräch führen",
      "über gesunde Ernährung sprechen",
      "ein Missverständnis in der WG klären",
      "eine Meinung zu einem Film austauschen",
      "Zukunftspläne besprechen",
      "über Nachhaltigkeit im Alltag sprechen",
      "eine Beschwerde im Restaurant vortragen",
      { topic: "Menschen und Orte lebendig beschreiben", type: "beschreibung" },
      { topic: "Wortschatz: Gefühle und Meinungen ausdrücken", type: "vokabular" },
      "eine Feier oder ein Fest planen",
      "über ein aktuelles Ereignis sprechen",
      "Ratschläge zu einem Problem geben"
    ]
  }
];

// Episoden-Anzahl, ab der das Curriculum am 2026-07-31 neu bei A1 gestartet
// wurde (Nutzerwunsch: Cap bei B1 statt bis C1 hochzulaufen, mehr Themen im
// Bereich A1–B1). Ältere Episoden (Index < CURRICULUM_RESET_AT) bleiben in
// den Blobs unverändert erhalten, zählen für die Themenwahl aber nicht mehr
// mit – die Rotation rechnet ab hier wieder bei 0.
const CURRICULUM_RESET_AT = 63;

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
