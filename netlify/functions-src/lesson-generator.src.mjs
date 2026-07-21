import * as lamejs from "@breezystack/lamejs";

export const VOICE_NAME = "Kore";
export const TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Curriculum: Themen sind in Blöcken nach Niveau sortiert (A1 -> C1). Die
// Auswahl (siehe pickForIndex) arbeitet sich block für block durch – so
// wiederholt sich ein Thema erst, wenn sein ganzer Niveau-Block durch ist,
// UND das Niveau steigt mit der Zeit spürbar an. Ist der letzte Block (C1)
// einmal komplett durch, wird nur noch er wiederholt (kein Rücksprung auf
// A1, aber auch kein endloses Weitersteigern über C1 hinaus).
export const CURRICULUM = [
  {
    level: "A1",
    system: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion
(ca. 2 Minuten) für einen Anfänger (A1), der sie beim Autofahren anhört.
Ein einfacher, LANGSAMER spanischer Mini-Dialog zu einem Alltagsthema.
Neue Wörter: zuerst Spanisch, dann kurz die deutsche Bedeutung, dann
nochmal Spanisch. Wiederhole Schlüsselsätze. Gib NUR den vorzulesenden
Text aus – kein Markdown, keine Überschriften.`,
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
      "sich verabschieden und gute Besserung wünschen"
    ]
  },
  {
    level: "A2",
    system: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion
(ca. 2–3 Minuten) für einen fortgeschrittenen Anfänger (A2), der sie beim
Autofahren anhört. Ein spanischer Dialog zu einem Alltagsthema, im
normalen, aber noch deutlichen Sprechtempo. Neue oder schwierige Wörter
kurz auf Deutsch erklären, aber nicht mehr jeden Satz übersetzen. Etwas
längere und komplexere Sätze als bei kompletten Anfängern. Wiederhole
wichtige neue Wendungen einmal. Gib NUR den vorzulesenden Text aus – kein
Markdown, keine Überschriften.`,
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
      "ein Missverständnis am Telefon klären"
    ]
  },
  {
    level: "B1",
    system: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion
(ca. 3 Minuten) für einen Lernenden auf Mittelstufen-Niveau (B1), der sie
beim Autofahren anhört. Ein natürlich klingender spanischer Dialog oder
eine kurze Erzählung zu einem etwas anspruchsvolleren Alltagsthema, im
normalen Sprechtempo. Nur wirklich seltene oder schwierige Wörter kurz auf
Deutsch erklären – die meisten Sätze bleiben unübersetzt. Verwende
zusammengesetzte Sätze und einfache Vergangenheitsformen. Gib NUR den
vorzulesenden Text aus – kein Markdown, keine Überschriften.`,
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
      "eine Beschwerde im Restaurant vortragen"
    ]
  },
  {
    level: "B2",
    system: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion
(ca. 3 Minuten) für einen Lernenden auf oberer Mittelstufe (B2), der sie
beim Autofahren anhört. Ein natürliches, etwas zügigeres spanisches
Gespräch oder eine Diskussion zu einem abstrakteren Thema, inklusive
idiomatischer Wendungen. Praktisch keine deutschen Übersetzungen mehr –
höchstens einmal eine wirklich seltene Redewendung kurz einordnen. Nutze
verschiedene Zeitformen und Nebensätze. Gib NUR den vorzulesenden Text aus
– kein Markdown, keine Überschriften.`,
    topics: [
      "eine Diskussion über Arbeit und Work-Life-Balance",
      "kulturelle Unterschiede zwischen Deutschland und Spanien",
      "ein lockeres Streitgespräch über Politik im Freundeskreis",
      "über eine schwierige Entscheidung im Leben sprechen",
      "ein Bewerbungsgespräch für einen Job im Ausland",
      "die Vor- und Nachteile von Homeoffice diskutieren",
      "eine Verhandlung über einen Mietvertrag",
      "über gesellschaftliche Trends und soziale Medien sprechen",
      "eine Debatte über Nachhaltigkeit und Konsum",
      "von Kindheitserinnerungen erzählen"
    ]
  },
  {
    level: "C1",
    system: `Du bist Spanischlehrer und erstellst eine HÖR-Lektion
(ca. 3–4 Minuten) für einen fortgeschrittenen Lernenden (C1), der sie beim
Autofahren anhört. Ein freies, natürliches spanisches Gespräch oder eine
Debatte zu einem anspruchsvollen, abstrakten Thema, in normalem bis
zügigem Sprechtempo, mit komplexer Grammatik (Konjunktiv, Nebensätze,
idiomatische Wendungen). Keine deutschen Übersetzungen. Gib NUR den
vorzulesenden Text aus – kein Markdown, keine Überschriften.`,
    topics: [
      "eine Debatte über künstliche Intelligenz und Arbeitsplätze",
      "eine philosophische Diskussion über Glück",
      "ein Interview über eine ungewöhnliche Karriere",
      "eine kontroverse Diskussion über den Klimawandel",
      "eine Analyse eines Buchs oder Films",
      "ein Streitgespräch über Erziehungsstile",
      "eine Diskussion über Migration und Identität",
      "ein Gespräch über die Zukunft der Städte",
      "eine Verhandlung in einem anspruchsvollen Geschäftskontext",
      "eine Diskussion über Ethik in der Technologie"
    ]
  }
];

// Wählt Thema, Niveau und System-Prompt für die n-te Lektion (0-basiert;
// n = Anzahl bisher erzeugter Episoden). Arbeitet sich block für block durchs
// Curriculum; ist der letzte Block einmal komplett durch, wird nur noch er
// wiederholt.
export function pickForIndex(index) {
  let remaining = index;
  for (let i = 0; i < CURRICULUM.length; i++) {
    const block = CURRICULUM[i];
    const isLast = i === CURRICULUM.length - 1;
    if (remaining < block.topics.length || isLast) {
      const topic = block.topics[remaining % block.topics.length];
      return { level: block.level, topic, system: block.system };
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

// Erzeugt Skript (Claude) + Audio (Gemini TTS) für ein Thema/Niveau und gibt
// die fertige MP3 zurück. Wirft bei jedem Fehlschlag (Claude, Gemini, kein
// Audio) mit einer sprechenden Meldung.
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
