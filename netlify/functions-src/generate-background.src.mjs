import { getStore } from "@netlify/blobs";
import { pickForIndex, generateEpisodeAudio } from "./lesson-generator.src.mjs";

// Manueller Einzel-Trigger: erzeugt genau eine Lektion, Thema+Niveau per
// Curriculum-Rotation aus der bisherigen Episoden-Anzahl (siehe
// lesson-generator.src.mjs). Für die tägliche automatische Erzeugung
// mehrerer Lektionen siehe generate-daily-background.src.mjs.
export default async () => {
  try {
    const store = getStore("lektionen");
    const { blobs } = await store.list({ prefix: "episodes/" });
    const { topic, level, system } = pickForIndex(blobs.length);

    const mp3 = await generateEpisodeAudio(topic, system);
    const ab = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength);
    const created = new Date().toISOString();
    const episodeKey = `episodes/${created.replace(/[:.]/g, "-")}.mp3`;

    await store.set(episodeKey, ab, { metadata: { created, bytes: mp3.length, topic, level } });
    await store.set("latest", ab, { metadata: { created, bytes: mp3.length, topic, level } });
    console.log("Lektion gespeichert:", mp3.length, "bytes ->", episodeKey, "| Thema:", topic, "| Niveau:", level);
  } catch (e) {
    console.error("ALLGEMEINER FEHLER:", e.message);
  }
};
