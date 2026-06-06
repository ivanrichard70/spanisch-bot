// netlify/functions/lektion.mjs
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";   // <-- deine echte Voice-ID wieder eintragen!

const SYSTEM = `Du bist Spanischlehrer und erstellst kurze HÖR-Lektionen
für einen Anfänger (Niveau A1), der sie beim Autofahren anhört.
Schreibe ein gesprochenes Skript von ca. 2 Minuten: ein einfacher,
LANGSAMER spanischer Mini-Dialog. Führe neue Wörter so ein: zuerst
Spanisch, dann kurz die deutsche Bedeutung, dann nochmal Spanisch.
Gib NUR den vorzulesenden Text aus – kein Markdown, keine Überschriften.`;

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
      const err = await claudeRes.text();
      return new Response(`CLAUDE-FEHLER ${claudeRes.status}: ${err}`, { status: 500 });
    }

    const data = await claudeRes.json();
    const skript = data.content.filter(b => b.type === "text").map(b => b.text).join("");

    // 2) TTS bei ElevenLabs
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: skript, model_id: "eleven_multilingual_v2" }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      return new Response(`ELEVENLABS-FEHLER ${ttsRes.status}: ${err}\n\nSKRIPT WAR:\n${skript}`, { status: 500 });
    }

    const audio = await ttsRes.arrayBuffer();
    return new Response(audio, { headers: { "content-type": "audio/mpeg" } });

  } catch (e) {
    return new Response(`ALLGEMEINER FEHLER: ${e.message}`, { status: 500 });
  }
};
