// netlify/functions/lektion.mjs
const VOICE_NAME = "Kore";                          // Gemini-Stimme (mehrsprachig)
const TTS_MODEL  = "gemini-2.5-flash-preview-tts";  // Gemini TTS-Modell

const SYSTEM = `Du bist Spanischlehrer und erstellst eine SEHR KURZE Hör-Lektion
(nur ca. 20-30 Sekunden, 3-4 kurze Sätze) für einen Anfänger (A1).
Ein einfacher, langsamer spanischer Gruß-Dialog. Neue Wörter: zuerst
Spanisch, dann kurz Deutsch. Gib NUR den vorzulesenden Text aus.`;

// Verpackt rohes PCM-Audio in einen abspielbaren WAV-Container
function pcmToWav(pcm, sampleRate) {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(numChannels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
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

    const rate = (part.mimeType?.match(/rate=(\d+)/)?.[1]) || 24000;
    const wav = pcmToWav(Buffer.from(part.data, "base64"), Number(rate));

    return new Response(wav, { headers: { "content-type": "audio/wav" } });

  } catch (e) {
    return new Response(`ALLGEMEINER FEHLER: ${e.message}`, { status: 500 });
  }
};
