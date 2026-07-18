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
- **Gemini-TTS-Tageskontingent: 10 Anfragen/Tag** (kostenloser Tarif von
  `gemini-2.5-flash-preview-tts`, Preview-Modelle haben oft enge Limits). Danach schlagen
  alle `generate-background`-Aufrufe kommentarlos fehl (kein Audio, kein Fehler-Log in
  Netlify sichtbar – nur in Google AI Studio unter Kontingenten erkennbar, z. B. „11 / 10").
  Reset vermutlich Mitternacht Pacific Time. Bei Massen-Erzeugung mehrerer Lektionen
  hintereinander: **max. ~9 pro Tag einplanen** (ein Puffer, da auch fehlgeschlagene
  Versuche zählen), Rest am Folgetag nachholen. Für den späteren Normalbetrieb
  (1x täglich automatisch) ist das Limit unkritisch.
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
- Feed ist live und in Apple Podcasts abonniert (per „Sendung per URL abonnieren",
  normale Katalog-Suche findet private Feeds nicht). Aktuell **9 von 15** geplanten
  Start-Lektionen erzeugt (Rest s. „Nächster konkreter Schritt").
- Der AI-Gateway-Bug ist diagnostiziert; Umstellung auf `MY_…`-Namen ist im Code
  gemacht und gepusht; die `MY_…`-Variablen sind in Netlify angelegt.
- **Episoden-Historie:** jede Erzeugung speichert zusätzlich zu `latest` eine dauerhafte
  Kopie unter `episodes/<Zeitstempel>.mp3` (unbegrenzte Aufbewahrung, bewusste Entscheidung).
- **RSS-Feed:** `/.netlify/functions/feed` listet alle Episoden aus Blobs und baut daraus
  einen abonnierbaren RSS-2.0-Feed (iTunes-Tags). Enclosure-URLs zeigen auf
  `/.netlify/functions/lektion?id=episodes/<Zeitstempel>.mp3`, das `lektion.mjs` jetzt
  zusätzlich zu `latest` unterstützt. Episoden-Titel im Feed zeigen das Thema
  (`Spanisch-Lektion: <Thema>`), Fallback aufs Datum bei alten Episoden ohne Thema-Metadatum.
- **Themenrotation:** `TOPICS`-Array in `generate-background.mjs` (10 Alltagsthemen, A1).
  Bei jedem Aufruf wird `TOPICS[bisherige-Episoden-Anzahl % TOPICS.length]` gewählt – kein
  Zufall, sondern deterministisch reihum, rein aus der Anzahl vorhandener `episodes/`-Blobs
  berechnet (kein separater Zähler nötig). Thema wird auch in den Blob-Metadaten gespeichert.

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
- Optionaler Gesprächs-Modus (Sprechen + Antworten) für Situationen mit freien Händen.
- **Grammatik-Lektionen & fortgeschrittene Gespräche (B1+):** in denselben Feed gemischt
  mit den A1-Alltagsdialogen (bewusste Entscheidung des Nutzers – nicht als separater Feed
  pro Level). Umsetzung voraussichtlich: `TOPICS`-Einträge um `level`/`type` erweitern
  (z. B. `{ topic, level: "A1"|"B1", type: "dialog"|"grammatik" }`) und passend dazu
  mehrere `SYSTEM`-Prompt-Varianten (Tempo, Übersetzungsanteil, Erklärungstiefe unterscheiden
  sich je nach Level/Typ deutlich vom aktuellen A1-Dialog-Prompt).

---

## Nächster konkreter Schritt

Deploy und Feed funktionieren (`/.netlify/functions/feed` liefert gültiges RSS, in
Apple Podcasts abonniert). Themenrotation ist live. Beim Befüllen mit einem
Start-Vorrat (Ziel: 15 Lektionen) griff nach 9 erfolgreichen Erzeugungen das
Gemini-TTS-Tageskontingent (10/Tag, siehe „Konventionen & Stolpersteine") – **9 von 15
Lektionen sind fertig**, die restlichen 6 fehlen noch.

**Um fortzusetzen (an einem neuen Tag, nach Kontingent-Reset):** 6x
`https://spanishforivi.netlify.app/.netlify/functions/generate-background` aufrufen,
zwischen den Aufrufen jeweils warten, bis die vorherige Episode im Feed auftaucht
(nicht parallel feuern – sonst berechnen mehrere Aufrufe gleichzeitig denselben
Rotations-Index aus `TOPICS[bisherige-Episoden-Anzahl % TOPICS.length]` und erzeugen
doppelte Themen). Jeder Aufruf dauert eher 1,5–3 Min als die ursprünglich angenommenen
30–40 Sek – beim Warten großzügig timeouten (mind. 200s), bevor man einen Fehler
vermutet.

**Danach:** Cover-Bild ergänzen, dann Scheduled Function für 1x tägliche automatische
Erzeugung bauen (Tageskontingent von 10 reicht dafür locker).
