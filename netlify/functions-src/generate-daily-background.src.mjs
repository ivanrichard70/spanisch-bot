import { getStore } from "@netlify/blobs";
import { pickForIndex, generateEpisodeAudio } from "./lesson-generator.src.mjs";

// Wie viele Lektionen pro Tag erzeugt werden: zufällig 3–5 (Nutzerwunsch
// 2026-09-13), neu gewürfelt bei jedem Lauf. Gemini-TTS-Tageskontingent ist
// 10 Anfragen/Tag (siehe CLAUDE.md) – auch bei 5 bleibt Puffer für manuelle
// Aufrufe/Tests.
const EPISODES_PER_DAY = 3 + Math.floor(Math.random() * 3);

async function generateAndStore(store, topic, level, type, system) {
  const mp3 = await generateEpisodeAudio(topic, system);
  const ab = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength);
  const created = new Date().toISOString();
  const episodeKey = `episodes/${created.replace(/[:.]/g, "-")}.mp3`;
  await store.set(episodeKey, ab, { metadata: { created, bytes: mp3.length, topic, level, type } });
  return { episodeKey, created, ab, bytes: mp3.length, topic, level, type };
}

// Wird von generate-daily-trigger.mjs (Scheduled Function) per HTTP angestoßen.
// Läuft als Background Function (bis 15 Min erlaubt). Thema+Niveau+Typ für alle
// EPISODES_PER_DAY Lektionen werden VORAB aus der aktuellen Episoden-Anzahl
// berechnet (nicht erst nach jeder einzelnen Erzeugung neu abgefragt) – so
// können alle Lektionen parallel erzeugt werden, ohne dass zwei Aufrufe
// versehentlich denselben Rotations-Index/Thema berechnen.
export default async () => {
  const store = getStore("lektionen");
  const { blobs } = await store.list({ prefix: "episodes/" });
  const baseCount = blobs.length;
  const picks = Array.from({ length: EPISODES_PER_DAY }, (_, i) => pickForIndex(baseCount + i));

  const results = await Promise.allSettled(
    picks.map(({ topic, level, type, system }) => generateAndStore(store, topic, level, type, system))
  );

  const successes = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      successes.push(r.value);
      console.log("Lektion gespeichert:", picks[i].topic, `(${picks[i].level}, ${picks[i].type})`, "->", r.value.episodeKey);
    } else {
      console.error("FEHLER bei Thema", picks[i].topic, ":", r.reason?.message ?? r.reason);
    }
  });

  if (successes.length === 0) {
    console.error("ALLGEMEINER FEHLER: keine der", EPISODES_PER_DAY, "Lektionen konnte erzeugt werden");
    return;
  }

  const newest = successes.reduce((a, b) => (a.created > b.created ? a : b));
  await store.set("latest", newest.ab, {
    metadata: { created: newest.created, bytes: newest.bytes, topic: newest.topic, level: newest.level, type: newest.type }
  });
  console.log(`Tages-Erzeugung fertig: ${successes.length}/${EPISODES_PER_DAY} Lektionen, "latest" ->`, newest.episodeKey);
};
