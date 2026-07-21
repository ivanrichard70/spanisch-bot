// Scheduled Function (30-Sek-Limit, per Cron ausgeführt, immer in UTC).
// Stößt nur die eigentliche Erzeugung in generate-daily-background.mjs an
// (Background Function, bis 15 Min erlaubt) und wartet NICHT auf deren
// Fertigstellung – Background Functions antworten sofort mit 202 "Accepted",
// bevor die eigentliche Arbeit läuft. Scheduled und Background Functions
// lassen sich laut Netlify-Doku nicht in einer einzigen Funktion kombinieren
// (schedule + "-background"-Suffix sind gegenseitig ausgeschlossen), daher
// die Aufteilung in zwei Funktionen.
//
// 03:00 UTC = ca. 4-5 Uhr deutscher Zeit (je nach Winter-/Sommerzeit) – früh
// morgens, Netlify-Cron läuft immer in UTC und stellt sich nicht automatisch
// auf die Sommerzeit um.
export const config = {
  schedule: "0 3 * * *"
};

export default async () => {
  const base = process.env.URL || "https://spanishforivi.netlify.app";
  try {
    const res = await fetch(`${base}/.netlify/functions/generate-daily-background`);
    console.log("Tages-Erzeugung angestoßen, Status:", res.status);
  } catch (e) {
    console.error("TRIGGER-FEHLER:", e.message);
  }
};
