# CLAUDE.md — Projektkontext für den Spanisch-Bot

Diese Datei gibt dir (Claude Code) den vollständigen Kontext für dieses Projekt.
Lies sie zu Beginn jeder Session.

---

## Worum es geht

Ein System, das **spanische Hör-Lektionen automatisch erzeugt**, damit der Nutzer
sie **freihändig anhören** kann – beim Autofahren, Kochen oder Putzen. Kein Lesen,
keine Bedienung. Späteres Ziel: Die Lektionen erscheinen automatisch in einer
Podcast-App und laufen über CarPlay / Android Auto.

Aktueller Fokus: der **Audio-Weg** (Lektionen zum Anhören).

---

## Architektur

> **Claude (Anthropic API)** schreibt ein spanisches Skript – **Google Gemini (TTS)**
> spricht es – Audio wird zu **MP3** konvertiert und in **Netlify Blobs** gespeichert
> – eine zweite Funktion **liefert die MP3 aus**.

Kern-Designentscheidung: **Erzeugen** und **Ausliefern** sind getrennt, weil das
Erzeugen ~30–40 Sek dauert (zu lang für eine normale Funktion mit ~10–26 Sek Limit).

- **`netlify/functions/generate-background.mjs`** – Hintergrund-Funktion (Name endet
  auf `-background` – bis 15 Min Laufzeit erlaubt). Erzeugt Skript (Claude) – TTS
  (Gemini) – schneidet End-Stille ab – MP3 (lamejs) – speichert in Blobs sowohl unter
  `latest` als auch unter `episodes/<Zeitstempel>.mp3` (Episoden-Historie).
- **`netlify/functions/lektion.mjs`** – liest eine MP3 aus Blobs und gibt sie als
  `audio/mpeg` zurück. Ohne Parameter: `latest`. Mit `?id=episodes/<Zeitstempel>.mp3`:
  genau diese Episode (für die Enclosure-URLs im RSS-Feed). Braucht keine API-Keys.
- **`netlify/functions/feed.mjs`** (Quelle: `feed.src.mjs`) – listet alle Blobs unter
  `episodes/` und erzeugt daraus einen RSS-2.0-Feed (iTunes-Tags) zum Abonnieren in
  Podcast-Apps. Braucht keine API-Keys.

Drei Endpunkte (online):
- Erzeugen: `/.netlify/functions/generate-background` (liefert 202 „Accepted", läuft im Hintergrund)
- Anhören (aktuellste Lektion): `/.netlify/functions/lektion`
- Anhören (bestimmte Episode): `/.netlify/functions/lektion?id=episodes/<Zeitstempel>.mp3`
- Abonnieren (RSS): `/.netlify/functions/feed`

---

## Tech-Stack

- **Netlify** – Hosting, Serverless Functions, Blobs-Speicher, (später) Scheduling.
- **Netlify Blobs** (`@netlify/blobs`) – Speicher für die MP3s (Store `lektionen`, Key `latest`).
- **Anthropic API** – erzeugt das Lektions-Skript. Modell: `claude-sonnet-4-6`.
- **Google Gemini API (TTS)** – Text-to-Speech. Modell: `gemini-2.5-flash-preview-tts`, Stimme `Kore`.
- **lamejs** (`@breezystack/lamejs`) – wandelt rohes PCM in MP3 um.
- **esbuild** – bündelt Funktionen samt Bibliotheken in eine einzige Datei.
- **GitHub** – Repo `ivanrichard70/spanisch-bot`.

---

## WICHTIG: Env-Var-Konvention (gerade gefixt)

Netlify hat ein **AI Gateway**, das die reservierten Namen `ANTHROPIC_API_KEY` und
`GEMINI_API_KEY` **automatisch mit einem eigenen signierten JWT überschreibt** (auch
lokal in `netlify dev`), solange nicht zusätzlich die passende `*_BASE_URL` gesetzt
ist. Das führte dazu, dass die Funktionen ein 415-Zeichen-JWT (`eyJ…`) statt der
echten Keys bekamen, obwohl `netlify env:get` korrekt `sk-ant…` zeigte.

**Lösung (bereits umgesetzt):** eigene Variablennamen außerhalb des reservierten
Namespace verwenden.

- `MY_ANTHROPIC_API_KEY`  (echter Anthropic-Key, `sk-ant-…`)
- `MY_GEMINI_API_KEY`     (echter Gemini-Key, `AQ.…` oder `AIza…`)

Im Code werden diese über `process.env.MY_ANTHROPIC_API_KEY` bzw.
`process.env.MY_GEMINI_API_KEY` gelesen. **Nie zu den reservierten Namen
zurückwechseln.** Die zwei Variablen sind im Netlify-Dashboard angelegt (nicht als
„secret", All scopes). Für die Codespace-Umgebung müssen sie zusätzlich als
**Codespaces Secrets** existieren.

---

## Konventionen & Stolpersteine

- **Deployte .mjs-Dateien sind mit esbuild gebündelt** (lamejs + @netlify/blobs fest
  eingebaut), daher groß (~250 KB). Grund: frühere „Cannot find package"-Fehler, weil
  Netlify Abhängigkeiten nicht zuverlässig bündelte. Kleine Edits (z. B. Env-Var-Namen,
  Prompt, Stimme) können direkt in der Datei gemacht werden. Bei größeren Änderungen an
  der Logik: aus lesbarer Quelle neu mit esbuild bündeln
  (`esbuild <src> --bundle --platform=node --format=esm --outfile=<ziel>`).
- **`netlify/functions-src/feed.src.mjs` ist die lesbare Quelle von `feed.mjs`.**
  WICHTIG: Quelldateien dürfen NIE in `netlify/functions/` liegen – Netlify behandelt
  jede Datei dort als eigene Funktion, und ein Punkt im Dateinamen (z. B. `feed.src.mjs`)
  ergibt einen ungültigen Funktionsnamen und lässt den Deploy fehlschlagen (bereits
  passiert, siehe Git-Historie). Quellen gehören nach `netlify/functions-src/`. Bei
  Änderungen an der RSS-Logik: `.src.mjs` dort bearbeiten, dann neu bündeln
  (`esbuild netlify/functions-src/feed.src.mjs --bundle --platform=node --format=esm
  --outfile=netlify/functions/feed.mjs`) – nicht nur die gebündelte Datei direkt patchen,
  sonst laufen Quelle und Bundle auseinander.
- **Hintergrund-Funktion:** Der Dateiname MUSS auf `-background` enden, sonst greift das
  15-Min-Limit nicht und lange Lektionen laufen in einen Timeout (502).
- **MP3, nicht WAV:** WAV ist zu groß (2 Min ≈ 6 MB, sprengt Netlify-Limits). MP3 ≈ 1 MB.
- **Gemini hängt am Ende Stille an** – wird im Code abgeschnitten (Amplituden-Schwelle,
  0,3 s Auslauf bleibt).
- **Credits:** Jeder Netlify-Deploy kostet Credits. Möglichst lokal / im Codespace mit
  `netlify dev` testen und selten deployen.
- **Fehlerausgabe:** Die Funktionen loggen Fehler als `CLAUDE-FEHLER`, `GEMINI-FEHLER`,
  `KEIN AUDIO`, `ALLGEMEINER FEHLER`. Erfolg: `Lektion gespeichert: <bytes> bytes`.

---

## Referenzwerte

- Repo: `https://github.com/ivanrichard70/spanisch-bot`
- Netlify-Site: `spanishforivi` – `https://spanishforivi.netlify.app`
- Env-Vars: `MY_ANTHROPIC_API_KEY`, `MY_GEMINI_API_KEY`
- Modelle: Claude `claude-sonnet-4-6`, Gemini `gemini-2.5-flash-preview-tts`
- Stimme: `Kore`
- Blobs: Store `lektionen`, Keys `latest` (neueste Lektion) und `episodes/<Zeitstempel>.mp3`
  (Historie, unbegrenzt aufbewahrt; Zeitstempel = ISO-Datum mit `:`/`.` → `-` ersetzt)

---

## Aktueller Stand

**Funktioniert:**
- Erzeugung (Claude → Gemini → MP3, inkl. End-Stille-Trim), Speichern (Blobs),
  Ausliefern (Funktion). Eine saubere 2-Minuten-Lektion lief online bereits durch.
- Der AI-Gateway-Bug ist diagnostiziert; Umstellung auf `MY_…`-Namen ist im Code
  gemacht und gepusht; die `MY_…`-Variablen sind in Netlify angelegt.
- **Episoden-Historie:** jede Erzeugung speichert zusätzlich zu `latest` eine dauerhafte
  Kopie unter `episodes/<Zeitstempel>.mp3` (unbegrenzte Aufbewahrung, bewusste Entscheidung).
- **RSS-Feed:** `/.netlify/functions/feed` listet alle Episoden aus Blobs und baut daraus
  einen abonnierbaren RSS-2.0-Feed (iTunes-Tags). Enclosure-URLs zeigen auf
  `/.netlify/functions/lektion?id=episodes/<Zeitstempel>.mp3`, das `lektion.mjs` jetzt
  zusätzlich zu `latest` unterstützt.

**Bekannte Lücken im Feed (bewusst zurückgestellt):**
- Kein `<itunes:image>` (Cover-Art) – noch kein Bild-Asset im Projekt.
- `feed.mjs` macht pro Aufruf eine `getMetadata`-Anfrage je Episode (N HEAD-Requests).
  Bei manueller/seltener Erzeugung unkritisch; bei vielen Episoden ggf. später cachen.

**Als Nächstes zu bauen:**
1. **Scheduled Function** – täglich automatisch eine neue Lektion erzeugen (aktuell
   bewusst manuell, siehe unten).
2. Optional: Cover-Bild ergänzen, damit Apple Podcasts & Co. das Artwork anzeigen.

**Spätere Ausbaustufen:**
- Lernermodell: Wortschatz & Schwächen mitführen, Lektionen daran anpassen
  (z. B. gezielt Fragewörter üben).
- Wechselnde Themen statt festem „sich vorstellen und begrüßen" (bewusst zurückgestellt).
- Optionaler Gesprächs-Modus (Sprechen + Antworten) für Situationen mit freien Händen.

---

## Nächster konkreter Schritt

Deploy nach dem Fix erneut anstoßen (Netlify-Dashboard → „Trigger deploy"), dann prüfen,
dass `https://spanishforivi.netlify.app/.netlify/functions/feed` gültiges RSS-XML liefert
(nicht mehr 404) und in einer Podcast-App (z. B. Apple Podcasts über „Sendung per URL
abonnieren", AntennaPod, Overcast) abonnierbar ist. Danach entscheiden, ob/wann die
Scheduled Function für tägliche automatische Erzeugung gebaut wird.

**Bekannter, bereits gefixter Fehler:** Ein erster Deploy-Versuch scheiterte, weil
`feed.src.mjs` fälschlich in `netlify/functions/` statt `netlify/functions-src/` lag –
Netlify hält jede Datei dort für eine Funktion, und der Punkt im Namen ergab einen
ungültigen Funktionsnamen (`feed.src`). Behoben durch Verschieben der Quelldatei.
