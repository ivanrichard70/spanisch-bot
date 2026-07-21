// netlify/functions-src/generate-daily-trigger.src.mjs
var config = {
  schedule: "0 3 * * *"
};
var generate_daily_trigger_src_default = async () => {
  const base = process.env.URL || "https://spanishforivi.netlify.app";
  try {
    const res = await fetch(`${base}/.netlify/functions/generate-daily-background`);
    console.log("Tages-Erzeugung angesto\xDFen, Status:", res.status);
  } catch (e) {
    console.error("TRIGGER-FEHLER:", e.message);
  }
};
export {
  config,
  generate_daily_trigger_src_default as default
};
