import * as lamejs from "@breezystack/lamejs";

export const VOICE_NAME = "Kore";
export const TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Ton/Tempo/Übersetzungsanteil pro Niveau (unabhängig vom Lektionstyp).
const LEVEL_TONE = {
  A0: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion (ca. 1,5–2 Minuten)
für eine ABSOLUTE Anfängerin ohne jede Vorkenntnis, die sie nebenbei anhört
(Autofahren, Kochen, Putzen). Sprich SEHR LANGSAM, in kurzen Sätzen. KEINE
Grammatik-Erklärungen und KEINE Fachbegriffe (nicht "Verb", "Konjugation",
"Subjekt" o. Ä. erwähnen). KEINE unterschiedlichen Zeitformen – benutze
ausschließlich einfache, direkt im Alltag nützliche Wörter und feste kurze
Sätze im Präsens, ohne die Bildung zu erklären (z. B. einfach "quiero agua"
sagen, nicht erklären, wie "querer" gebildet wird). Für jedes Wort/jeden Satz:
zuerst Spanisch, dann kurz die deutsche Bedeutung, dann Spanisch noch einmal.
Wiederhole die 3–5 wichtigsten Wörter der Lektion am Ende noch einmal als
kurze Liste.`,
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
// Bewusst NUR Spanisch (kein Guaraní, s. Nutzerentscheidung 2026-09-13 –
// vorheriger GUARANI_HINT/type "guarani" wieder entfernt, s. Git-Historie).
const REGION_HINT = `WICHTIG – Region: Der Lernende reist nach Paraguay.
Verwende paraguayisches Spanisch: „vos" statt „tú" (vos tenés, vos querés,
vení, mirá, dale), Anrede und Höflichkeitsformen wie in Asunción üblich.
Preise immer in Guaraníes (der Landeswährung), nicht in Euro. Bleib dabei
ausschließlich beim Spanischen – KEINE Guaraní-Wörter oder -Floskeln
einbauen, auch nicht vereinzelt.`;

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
6–10 besonders nützliche kurze Redewendungen mit den wichtigsten
spanischen Alltagsverben vor (passend zum genannten Thema, z. B. quiero,
tengo, hay, es, está, puedo, me gusta) – IMMER als fertigen, direkt
nutzbaren kurzen Satz, NIE als Grammatik-Erklärung oder Konjugationstabelle
und ohne die Verb-Bildung zu erklären. Für jeden Satz: zuerst Spanisch,
dann kurz die deutsche Bedeutung, dann Spanisch noch einmal.`,
  beschreibung: `Erstelle dazu KEINEN Dialog, sondern eine Lektion zum
Beschreiben: Beschreibe Personen, Orte oder Dinge zum genannten Thema in
mehreren kurzen, klaren Sätzen (z. B. Aussehen, Eigenschaften, Lage). Baue
dabei wichtiges Beschreibungs-Vokabular (Adjektive) ein und erkläre neue
Adjektive kurz auf Deutsch.`,
  fragen: `Erstelle dazu KEINEN Dialog, sondern eine Lektion zu
Fragewörtern: Stelle die im genannten Thema angegebenen (oder sonst die
alltäglichsten) spanischen W-Fragewörter vor – jeweils mit deutscher
Bedeutung – und bilde zu jedem Fragewort 1 kurze, sehr einfache
Beispielfrage zum genannten Thema, inklusive kurzer beispielhafter Antwort.`,
  zusammenfassung: `Erstelle dazu KEINEN neuen Dialog, sondern eine
WIEDERHOLUNGS-Lektion: Fasse das Wichtigste zu den genannten Themen oder
Situationen zusammen. Gehe sie der Reihe nach durch und nenne je Thema die
2–5 Wörter oder Sätze, die man davon am meisten braucht – jeweils Spanisch,
kurze deutsche Bedeutung, Spanisch. Baue am Ende eine kleine Selbst-Abfrage
ein: nenne die deutsche Bedeutung, dann eine hörbare Denkpause (schreibe
dafür „… uno … dos … tres …"), dann die spanische Lösung.`
};

function buildSystem(level, type) {
  const parts = [LEVEL_TONE[level], TYPE_FORMAT[type], REGION_HINT];
  parts.push("Gib NUR den vorzulesenden Text aus – kein Markdown, keine Überschriften.");
  return parts.join("\n");
}

// Curriculum: Themen sind in Blöcken nach Niveau sortiert. Jedes Thema ist
// entweder ein reiner String (= normale Dialog-Lektion) oder ein
// { topic, type }-Objekt für die speziellen Lektionstypen (Vokabular/Verben/
// Beschreibung/Fragen/Wiederholung).
//
// Niveau-Steuerung (2026-09-13, Nutzerwunsch für Corinne, absolute
// Anfängerin): das Niveau steigt NICHT mehr automatisch mit der Episoden-
// Anzahl. Aktiv sind nur die Blöcke, deren level in ACTIVE_LEVELS steht
// (aktuell nur A0). pickForIndex rotiert endlos durch genau diese Blöcke
// (in Reihenfolge, älteste Themen zuerst) – ein Thema wiederholt sich erst,
// wenn der komplette aktive Pool durchgelaufen ist. Soll das Niveau steigen,
// MUSS das explizit gewünscht werden: dann weiteren Level-String in
// ACTIVE_LEVELS aufnehmen (z. B. ["A0", "A1"]) und neu bündeln/deployen –
// alte Themen bleiben dabei im Pool (bewusst: durchmischtes Wiederholen
// alter mit neuer Vokabel ist gewünscht, s. CLAUDE.md).
const ACTIVE_LEVELS = ["A0"];

export const CURRICULUM = [
  {
    // Absoluter Anfänger-Block für Corinne: nur die wichtigsten Wörter,
    // einfache feste Sätze mit den nützlichsten Verben, keine Grammatik,
    // keine Zeitformen (s. LEVEL_TONE.A0). Bewusst kein "dialog"-Typ hier –
    // freie Dialoge wären für absolute Anfänger zu komplex/unvorhersehbar.
    // Die beiden "zusammenfassung"-Einträge fassen die jeweils vorherigen
    // Themen namentlich zusammen, damit Wortschatz wirklich wiederholt wird
    // (das TTS-Modell hat kein Gedächtnis über frühere Lektionen hinweg).
    level: "A0",
    topics: [
      { topic: "Begrüßung und Höflichkeit: hola, buenas, cómo estás, bien, por favor, gracias, de nada, chau", type: "vokabular" },
      { topic: "Ja und Nein sagen, sich entschuldigen: sí, no, perdón, disculpa, permiso", type: "vokabular" },
      { topic: "Zahlen von 0 bis 10", type: "vokabular" },
      { topic: "Zahlen von 11 bis 20 und wichtige Mengenwörter: un poco, mucho, todo, nada", type: "vokabular" },
      { topic: "die wichtigsten Sätze zum Sagen, was man will oder hat: quiero, tengo, hay, es, está", type: "verben" },
      { topic: "die wichtigsten Sätze für Können, Mögen und Brauchen: puedo, me gusta, necesito", type: "verben" },
      { topic: "Farben", type: "vokabular" },
      { topic: "Familie: mamá, papá, hijo/hija, hermano/hermana, abuelo/abuela", type: "vokabular" },
      { topic: "Essen und Trinken: agua, comida, pan, carne, fruta, tereré, chipa, mandioca", type: "vokabular" },
      { topic: "Wiederholung 1: Begrüßung, Ja/Nein/Entschuldigung, Zahlen 0–20, quiero/tengo/hay/es/está/puedo/me gusta, Farben, Familie und Essen – von jeder Gruppe nur die 2–3 wichtigsten Wörter", type: "zusammenfassung" },
      { topic: "wichtige Adjektive: bueno/malo, grande/chico, lindo/feo, caro/barato", type: "beschreibung" },
      { topic: "Wochentage und Tageszeiten: hoy, mañana, la mañana, la tarde, la noche", type: "vokabular" },
      { topic: "Zu Hause: casa, cuarto, baño, cocina, cama", type: "vokabular" },
      { topic: "beim Einkaufen: cuánto cuesta, quiero comprar, el precio, caro, barato", type: "vokabular" },
      { topic: "wichtige Wörter für Gefühle: feliz, cansado/a, tengo hambre, tengo sed", type: "beschreibung" },
      { topic: "Wegbeschreibung: cerca, lejos, aquí, allí, a la derecha, a la izquierda", type: "vokabular" },
      { topic: "die 3 wichtigsten Fragewörter: qué, dónde, cuánto", type: "fragen" },
      { topic: "Wiederholung 2: Adjektive, Wochentage, Zuhause, Einkaufen, Gefühle, Wegbeschreibung und Fragewörter – von jeder Gruppe nur die 2–3 wichtigsten Wörter", type: "zusammenfassung" }
    ]
  },
  {
    // Dormant – erst aktiv, wenn "A1" zu ACTIVE_LEVELS hinzugefügt wird.
    // Ursprünglich für die Paraguay-Reise geschrieben (2026-08-23); enthält
    // mehr Grammatik/Dialog als der A0-Block und sollte vor dem Freischalten
    // ggf. nochmal auf "ohne Grammatik/Zeitformen" geprüft werden.
    level: "A1",
    topics: [
      { topic: "Begrüßung, Danke sagen, Ja und Nein, sich entschuldigen", type: "vokabular" },
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
      "höflich grüßen und sich bedanken",
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
      { topic: "Wortschatz: Verkehr, Busse und sich in der Stadt bewegen", type: "vokabular" },
      "im Restaurant typisch paraguayisch bestellen (Chipa, Sopa paraguaya, Tereré)",
      { topic: "die Unterkunft und die Umgebung beschreiben", type: "beschreibung" },
      "einen Ausflug planen und nach dem Weg fragen",
      "Geld wechseln und mit Karte bezahlen",
      "den Aufenthalt im Airbnb um ein paar Tage verlängern",
      { topic: "Wiederholung A2: Probleme melden, Auto fahren und wichtige Alltagswörter", type: "zusammenfassung" }
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
      { topic: "Wortschatz: Behörden, Formulare und offizielle Angelegenheiten", type: "vokabular" },
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

// Flacher Pool aus allen Themen der aktiven Level (Reihenfolge: Level-Block-
// Reihenfolge in CURRICULUM, innerhalb eines Blocks wie dort aufgelistet).
const ACTIVE_POOL = CURRICULUM
  .filter((block) => ACTIVE_LEVELS.includes(block.level))
  .flatMap((block) => block.topics.map((entry) => ({ level: block.level, entry })));

// Wählt Thema, Niveau, Typ und System-Prompt für die n-te Lektion (0-basiert;
// n = Anzahl bisher erzeugter Episoden). Rotiert endlos durch ACTIVE_POOL –
// ein Thema wiederholt sich erst, wenn der ganze aktive Pool durch ist.
export function pickForIndex(index) {
  const { level, entry } = ACTIVE_POOL[index % ACTIVE_POOL.length];
  const { topic, type } = typeof entry === "string" ? { topic: entry, type: "dialog" } : entry;
  return { level, topic, type, system: buildSystem(level, type) };
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
