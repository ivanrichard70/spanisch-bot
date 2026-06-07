// netlify/functions/lektion.mjs
import lamejs from "@breezystack/lamejs";

const VOICE_NAME = "Kore";
const TTS_MODEL  = "gemini-2.5-flash-preview-tts";

const SYSTEM = `Du bist Spanischlehrer und erstellst eine kurze HÖR-Lektion
(ca. 1 Minute) für einen Anfänger (A1), der sie unterwegs anhört.
Ein einfacher, LANGSAMER spanischer Mini-Dialog zu einem Alltagsthema.
Neue Wörter: zuerst Spanisch, dann kurz die deutsche Bedeutung, dann
nochmal Spanisch. Gib NUR den vorzulesenden Text aus – kein Markdown.`;

// Roh-PCM (16-bit, mono) zu MP3 kodieren
function pcmToMp3(pcmBase64, sampleRate) {
  const bytes = Uint8Array.from(Buffer.from(pcmBase64, "base64"));
  const samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const chunks = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const buf = encoder.encodeBuffer(samples.subarray(i, i + 1152));
    if (buf.length > 0) chunks.push(Buffer.from(buf));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

export default async () => {
  try {
    // 1) Skript von Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: "Thema: sich vorstellen und begrüßen." }],
      }),
    });
    if (!claudeRes.ok) {
      return new Response(`CLAUDE-FEHLER ${claudeRes.status}: ${await claudeRes.text()}`, { status: 500 });
    }
    const data = await claudeRes.json();
    const skript = data.content.filter(b => b.type === "text").map(b => b.text).join("");

    // 2) TTS von Gemini
    const ttsRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: skript }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
            },
          },
        }),
      }
    );
    if (!ttsRes.ok) {
      return new Response(`GEMINI-FEHLER ${ttsRes.status}: ${await ttsRes.text()}\n\nSKRIPT WAR:\n${skript}`, { status: 500 });
    }

    const ttsData = await ttsRes.json();
    const part = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!part?.data) {
      return new Response(`KEIN AUDIO. Antwort:\n${JSON.stringify(ttsData).slice(0, 800)}`, { status: 500 });
    }

    // 3) PCM -> MP3
    const rate = Number(part.mimeType?.match(/rate=(\d+)/)?.[1]) || 24000;
    const mp3 = pcmToMp3(part.data, rate);

    return new Response(mp3, { headers: { "content-type": "audio/mpeg" } });

  } catch (e) {
    return new Response(`ALLGEMEINER FEHLER: ${e.message}`, { status: 500 });
  }
};
