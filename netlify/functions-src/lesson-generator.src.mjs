import * as lamejs from "@breezystack/lamejs";

export const VOICE_NAME = "Kore";
export const TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const SYSTEM = `Du bist Spanischlehrer und erstellst eine HÖR-Lektion
(ca. 2 Minuten) für einen Anfänger (A1), der sie beim Autofahren anhört.
Ein einfacher, LANGSAMER spanischer Mini-Dialog zu einem Alltagsthema.
Neue Wörter: zuerst Spanisch, dann kurz die deutsche Bedeutung, dann
nochmal Spanisch. Wiederhole Schlüsselsätze. Gib NUR den vorzulesenden
Text aus – kein Markdown, keine Überschriften.`;

export const TOPICS = [
  "sich vorstellen und begrüßen",
  "im Restaurant bestellen",
  "nach dem Weg fragen",
  "einkaufen gehen",
  "die Uhrzeit sagen",
  "über das Wetter sprechen",
  "die Familie vorstellen",
  "Zahlen und Preise",
  "ein Taxi rufen",
  "im Hotel einchecken"
];

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

// Erzeugt Skript (Claude) + Audio (Gemini TTS) für ein Thema und gibt die fertige MP3 zurück.
// Wirft bei jedem Fehlschlag (Claude, Gemini, kein Audio) mit einer sprechenden Meldung.
export async function generateEpisodeAudio(topic) {
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
      system: SYSTEM,
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
