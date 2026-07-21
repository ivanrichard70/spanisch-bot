import { getStore } from "@netlify/blobs";
import { TOPICS, generateEpisodeAudio } from "./lesson-generator.src.mjs";

// Wie viele Lektionen pro Tag erzeugt werden. Gemini-TTS-Tageskontingent ist 10
// Anfragen/Tag (siehe CLAUDE.md) – 5 lässt Puffer für manuelle Aufrufe/Tests.
const EPISODES_PER_DAY = 5;

async function generateAndStore(store, topic) {
  const mp3 = await generateEpisodeAudio(topic);
  const ab = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength);
  const created = new Date().toISOString();
  const episodeKey = `episodes/${created.replace(/[:.]/g, "-")}.mp3`;
  await store.set(episodeKey, ab, { metadata: { created, bytes: mp3.length, topic } });
  return { episodeKey, created, ab, bytes: mp3.length, topic };
}

// Wird von generate-daily-trigger.mjs (Scheduled Function) per HTTP angestoßen.
// Läuft als Background Function (bis 15 Min erlaubt). Die Themen für alle
// EPISODES_PER_DAY Lektionen werden VORAB aus der aktuellen Episoden-Anzahl
// berechnet (nicht erst nach jeder einzelnen Erzeugung neu abgefragt) – so
// können alle Lektionen parallel erzeugt werden, ohne dass zwei Aufrufe
// versehentlich denselben Rotations-Index/Thema berechnen.
export default async () => {
  const store = getStore("lektionen");
  const { blobs } = await store.list({ prefix: "episodes/" });
  const baseCount = blobs.length;
  const topics = Array.from({ length: EPISODES_PER_DAY }, (_, i) => TOPICS[(baseCount + i) % TOPICS.length]);

  const results = await Promise.allSettled(topics.map((topic) => generateAndStore(store, topic)));

  const successes = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      successes.push(r.value);
      console.log("Lektion gespeichert:", topics[i], "->", r.value.episodeKey);
    } else {
      console.error("FEHLER bei Thema", topics[i], ":", r.reason?.message ?? r.reason);
    }
  });

  if (successes.length === 0) {
    console.error("ALLGEMEINER FEHLER: keine der", EPISODES_PER_DAY, "Lektionen konnte erzeugt werden");
    return;
  }

  const newest = successes.reduce((a, b) => (a.created > b.created ? a : b));
  await store.set("latest", newest.ab, {
    metadata: { created: newest.created, bytes: newest.bytes, topic: newest.topic }
  });
  console.log(`Tages-Erzeugung fertig: ${successes.length}/${EPISODES_PER_DAY} Lektionen, "latest" ->`, newest.episodeKey);
};
