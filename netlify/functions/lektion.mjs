// netlify/functions/lektion.mjs
const VOICE_ID = "Gubgw9l4dtIoQA9YZHgx";

const SYSTEM = `Du bist Spanischlehrer und erstellst kurze HÖR-Lektionen
für einen Anfänger (Niveau A1), der sie beim Autofahren anhört.
Schreibe ein gesprochenes Skript von ca. 2 Minuten: ein einfacher,
LANGSAMER spanischer Mini-Dialog oder eine kleine Geschichte zu einem
Alltagsthema. Führe neue Wörter so ein: zuerst Spanisch, dann kurz die
deutsche Bedeutung, dann nochmal Spanisch. Wiederhole Schlüsselsätze.
Gib NUR den vorzulesenden Text aus – keine Überschriften, keine
Regieanweisungen, kein Markdown.`;

export default async () => {
  // 1) Skript von Claude
  const claude = await fetch("https://api.anthropic.com/v1/messages", {
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
  const data = await claude.json();
  const skript = data.content.filter(b => b.type === "text").map(b => b.text).join("");

  // 2) TTS bei ElevenLabs
  const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: skript,
      model_id: "eleven_multilingual_v2",
    }),
  });
  const audio = await tts.arrayBuffer();

  // 3) MP3 zurückgeben
  return new Response(audio, { headers: { "content-type": "audio/mpeg" } });
};
