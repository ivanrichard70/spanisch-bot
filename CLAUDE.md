# CLAUDE.md — Projektkontext für den Spanisch-Bot

Diese Datei gibt dir (Claude Code) den vollständigen Kontext für dieses Projekt.
Lies sie zu Beginn jeder Session.

---

## Worum es geht

Ein System, das **spanische Hör-Lektionen automatisch erzeugt**, damit der Nutzer
sie **freihändig anhören** kann – beim Autofahren, Kochen oder Putzen. Kein Lesen,
keine Bedienung. Späteres Ziel: Die Lektionen erscheinen automatisch in einer
Podcast-App und laufen über CarPlay / Android Auto.

**Lernerin (seit 2026-09-13): Corinne**, absolute Anfängerin ohne Vorkenntnisse.
Ziel ist südamerikanisches Spanisch mit Fokus auf Paraguay (voseo, Guaraníes als
Währung – s. `REGION_HINT`). **Bewusst NUR Spanisch, kein Guaraní** (kurz
eingeführt am 2026-09-13, noch am selben Tag auf Nutzerwunsch wieder entfernt –
s. Git-Historie `lesson-generator.src.mjs`, ehemals `GUARANI_HINT`/type
`"guarani"`). Bewusst **ohne Grammatik-Erklärungen und ohne verschiedene
Zeitformen** – nur die wichtigsten Wörter, feste einfache Sätze mit den
nützlichsten Verben und Adjektiven, mit eingebauter Wiederholung. Das Niveau
steigt **nur auf ausdrücklichen Wunsch**, nicht automatisch mit der Zeit (s.
„Themenrotation & Niveau-Steuerung" unten).

Aktueller Fokus: der **Audio-Weg** (Lektionen zum Anhören).

---

## Architektur

> **Claude (Anthropic API)** schreibt ein spanisches Skript – **Google Gemini (TTS)**
> spricht es – Audio wird zu **MP3** konvertiert und in **Netlify Blobs** gespeichert
> – eine zweite Funktion **liefert die MP3 aus**.

Kern-Designentscheidung: **Erzeugen** und **Ausliefern** sind getrennt, weil das
Erzeugen ~30–40 Sek dauert (zu lang für eine normale Funktion mit ~10–26 Sek Limit).
Aus demselben Grund sind **Scheduling** (Cron) und **eigentliche Erzeugung** ebenfalls
getrennt: Netlify Scheduled Functions haben ein hartes 30-Sek-Limit und lassen sich
NICHT mit dem `-background`-Suffix (15 Min Laufzeit) kombinieren (offiziell gegenseitig
ausgeschlossen) – daher stößt eine schlanke Scheduled Function nur eine separate
Background-Funktion per HTTP an, statt selbst zu generieren.

- **`netlify/functions-src/lesson-generator.src.mjs`** – gemeinsame Kernlogik (kein
  eigener Endpunkt): Skript (Claude) – TTS (Gemini) – schneidet End-Stille ab – MP3
  (lamejs). Wird sowohl von `generate-background.mjs` als auch von
  `generate-daily-background.mjs` importiert (Single Source of Truth für Prompt,
  Curriculum/Themen, Claude-/Gemini-Aufruf, PCM→MP3-Konvertierung). Enthält das
  **Curriculum** (`CURRICULUM`-Array, s. „Themenrotation & Niveau-Steuerung" unter
  „Aktueller Stand") und `pickForIndex(n)`, das aus der n-ten Episode Thema, Niveau
  und passenden System-Prompt bestimmt.
- **`netlify/functions/generate-background.mjs`** (Quelle: `generate-background.src.mjs`)
  – Hintergrund-Funktion (Name endet auf `-background` – bis 15 Min Laufzeit erlaubt).
  Manueller Einzel-Trigger: erzeugt genau **eine** Lektion (Thema per Rotation aus der
  bisherigen Episoden-Anzahl), speichert in Blobs sowohl unter `latest` als auch unter
  `episodes/<Zeitstempel>.mp3` (Episoden-Historie).
- **`netlify/functions/generate-daily-background.mjs`** (Quelle:
  `generate-daily-background.src.mjs`) – Hintergrund-Funktion für die **tägliche
  Batch-Erzeugung** von **3–5 Lektionen** (`EPISODES_PER_DAY`, zufällig gewürfelt bei
  jedem Lauf, s. Nutzerwunsch 2026-09-13). Berechnet alle Themen EINMALIG vorab aus der
  aktuellen Episoden-Anzahl (nicht nach jeder Einzel-Erzeugung neu), erzeugt dann alle
  **parallel** (`Promise.allSettled`) – damit bleibt die Gesamtlaufzeit nah an der
  einer Einzel-Erzeugung (statt hintereinander, was das 15-Min-Limit riskieren würde)
  und zwei gleichzeitige Themen-Berechnungen können sich nicht in die Quere kommen.
  Setzt `latest` am Ende explizit auf die tatsächlich neueste der erfolgreich erzeugten
  Episoden (Timestamp-Vergleich) – bei paralleler Erzeugung ist die Fertigstellungs-
  Reihenfolge nicht deterministisch.
- **`netlify/functions/generate-daily-trigger.mjs`** (Quelle:
  `generate-daily-trigger.src.mjs`) – **Scheduled Function**, `export const config =
  { schedule: "0 3 * * *" }` (täglich 03:00 UTC, läuft immer in UTC, keine automatische
  Sommerzeit-Anpassung). Ruft nur `generate-daily-background` per `fetch()` auf und
  wartet nicht auf dessen Fertigstellung (Background Functions antworten sofort mit
  202 „Accepted"). Braucht `process.env.URL` (von Netlify automatisch gesetzt) oder
  fällt auf die feste Produktions-URL zurück.
- **`netlify/functions/lektion.mjs`** (Quelle: `lektion.src.mjs`) – liest eine MP3 aus
  Blobs und gibt sie als `audio/mpeg` zurück. Ohne Parameter: `latest`. Mit
  `?id=episodes/<Zeitstempel>.mp3`: genau diese Episode (für die Enclosure-URLs im
  RSS-Feed). Unterstützt HTTP-Range-Requests (`206 Partial Content`) – nötig, damit
  Podcast-Player (v. a. Apple Podcasts) scrubben/vorspulen können, sonst brechen sie
  die Wiedergabe ab. Braucht keine API-Keys.
- **`netlify/functions/feed.mjs`** (Quelle: `feed.src.mjs`) – listet alle Blobs unter
  `episodes/` und erzeugt daraus einen RSS-2.0-Feed (iTunes-Tags, inkl. `itunes:image`/
  `itunes:author`) zum Abonnieren in Podcast-Apps. Braucht keine API-Keys.

Endpunkte (online):
- Erzeugen (1 Lektion, manuell): `/.netlify/functions/generate-background` (liefert 202 „Accepted", läuft im Hintergrund)
- Erzeugen (3–5 Lektionen, Batch – normalerweise nur vom Scheduler aufgerufen): `/.netlify/functions/generate-daily-background`
- Automatisch täglich 03:00 UTC: `generate-daily-trigger` (Scheduled Function, kein manueller Aufruf nötig)
- Anhören (aktuellste Lektion): `/.netlify/functions/lektion`
- Anhören (bestimmte Episode): `/.netlify/functions/lektion?id=episodes/<Zeitstempel>.mp3`
- Abonnieren (RSS): `/.netlify/functions/feed`

---

## Tech-Stack

- **Netlify** – Hosting, Serverless Functions, Blobs-Speicher, (später) Scheduling.
- **Netlify Blobs** (`@netlify/blobs`) – Speicher für die MP3s (Store `lektionen`, Details siehe „Referenzwerte").
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
- **Alle deployten Funktionen haben mittlerweile eine lesbare Quelle in
  `netlify/functions-src/`:** `feed.src.mjs`, `lektion.src.mjs`,
  `generate-background.src.mjs`, `generate-daily-background.src.mjs`,
  `generate-daily-trigger.src.mjs`, plus `lesson-generator.src.mjs` (gemeinsame
  Kernlogik, kein eigener Endpunkt – siehe „Architektur").
  WICHTIG: Quelldateien dürfen NIE in `netlify/functions/` liegen – Netlify behandelt
  jede Datei dort als eigene Funktion, und ein Punkt im Dateinamen (z. B. `feed.src.mjs`)
  ergibt einen ungültigen Funktionsnamen und lässt den Deploy fehlschlagen (bereits
  passiert, siehe Git-Historie). Quellen gehören nach `netlify/functions-src/`. Bei
  Änderungen an deren Logik: `.src.mjs` dort bearbeiten, dann neu bündeln, z. B.
  (`esbuild netlify/functions-src/feed.src.mjs --bundle --platform=node --format=esm
  --outfile=netlify/functions/feed.mjs`) – nicht nur die gebündelte Datei direkt patchen,
  sonst laufen Quelle und Bundle auseinander. Zum Bündeln werden `@netlify/blobs` und
  (für die Erzeugungs-Funktionen) `@breezystack/lamejs` als Node-Module benötigt (im
  Repo selbst kein `node_modules`/`package.json` vorhanden) – ggf. temporär in einem
  Scratch-Verzeichnis installieren und via `NODE_PATH` einbinden, z. B.
  `NODE_PATH=<scratch>/node_modules npx esbuild …`.
- **Scheduled Functions (Netlify) haben ein hartes 30-Sek-Limit und lassen sich NICHT
  mit dem `-background`-Namenssuffix kombinieren** (offiziell gegenseitig
  ausgeschlossen, s. Netlify-Doku). Deshalb: die eigentliche Lektions-Erzeugung liegt
  in `generate-daily-background.mjs` (Background Function, per HTTP aufrufbar, 15 Min
  Limit), und `generate-daily-trigger.mjs` (Scheduled Function, `export const config =
  { schedule: "..." }`) ruft diese nur per `fetch()` auf, ohne auf Fertigstellung zu
  warten. Cron läuft immer in UTC, keine automatische Sommerzeit-Anpassung – bei
  Bedarf `schedule` in `generate-daily-trigger.src.mjs` anpassen und neu bündeln.
- **`cover.jpg` liegt im Repo-Root** (nicht in `netlify/functions*`) – es gibt **keine
  `netlify.toml`**, Netlify nutzt daher das Repo-Root als Publish-Verzeichnis (Default
  ohne Build-Konfiguration). Ausgeliefert unter `https://spanishforivi.netlify.app/cover.jpg`.
  Falls je eine `netlify.toml` mit eigenem `publish`-Verzeichnis angelegt wird: `cover.jpg`
  mit umziehen, sonst 404 im Feed.
- **Hintergrund-Funktion:** Der Dateiname MUSS auf `-background` enden, sonst greift das
  15-Min-Limit nicht und lange Lektionen laufen in einen Timeout (502).
- **MP3, nicht WAV:** WAV ist zu groß (2 Min ≈ 6 MB, sprengt Netlify-Limits). MP3 ≈ 1 MB.
- **Gemini hängt am Ende Stille an** – wird im Code abgeschnitten (Amplituden-Schwelle,
  0,3 s Auslauf bleibt).
- **Gemini-TTS-Tageskontingent: 10 Anfragen/Tag** (kostenloser Tarif von
  `gemini-2.5-flash-preview-tts`, Preview-Modelle haben oft enge Limits). Danach schlagen
  alle Erzeugungs-Aufrufe kommentarlos fehl (kein Audio, kein Fehler-Log in
  Netlify sichtbar – nur in Google AI Studio unter Kontingenten erkennbar, z. B. „11 / 10").
  Reset vermutlich Mitternacht Pacific Time. Die tägliche Scheduled Function erzeugt
  bewusst nur **3–5** Lektionen/Tag (zufällig, statt bis zu 10), damit Puffer für
  manuelle Aufrufe/Tests am selben Tag bleibt. Bei manueller Massen-Erzeugung
  zusätzlich zur Batch-Funktion: **Gesamt (Batch + manuell) max. ~9 pro Tag
  einplanen** (ein Puffer, da auch fehlgeschlagene Versuche zählen).
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
- Cover-Art: `cover.jpg` im Repo-Root (1400×1400px), ausgeliefert unter
  `https://spanishforivi.netlify.app/cover.jpg`, aktuell ein generierter Platzhalter
  (rot-gelber Verlauf, „¡Hola! Spanisch Lektionen") – kann jederzeit durch ein
  eigenes Bild ersetzt werden (Datei einfach überschreiben, gleicher Dateiname/Pfad).

---

## Aktueller Stand

**Funktioniert:**
- Erzeugung (Claude → Gemini → MP3, inkl. End-Stille-Trim), Speichern (Blobs),
  Ausliefern (Funktion). Eine saubere 2-Minuten-Lektion lief online bereits durch.
- Feed ist live und in Apple Podcasts abonniert (per „Sendung per URL abonnieren",
  normale Katalog-Suche findet private Feeds nicht). Die tägliche Batch-Erzeugung lief
  seit dem Deploy 10 Nächte durch (2026-07-21 bis 2026-07-31) ohne manuelles Zutun:
  14 → 63 Episoden, Niveau stieg dabei automatisch bis C1 – **genau das war der Auslöser
  für den Reset/Cap auf B1**, s. „Themenrotation & Niveau-Progression". Der ursprüngliche
  „15 Start-Lektionen"-Meilenstein ist damit obsolet (längst überschritten, Curriculum
  inzwischen neu strukturiert).
- Der AI-Gateway-Bug ist diagnostiziert; Umstellung auf `MY_…`-Namen ist im Code
  gemacht und gepusht; die `MY_…`-Variablen sind in Netlify angelegt.
- **Episoden-Historie:** jede Erzeugung speichert zusätzlich zu `latest` eine dauerhafte
  Kopie unter `episodes/<Zeitstempel>.mp3` (unbegrenzte Aufbewahrung, bewusste Entscheidung).
- **RSS-Feed:** `/.netlify/functions/feed` listet alle Episoden aus Blobs und baut daraus
  einen abonnierbaren RSS-2.0-Feed (iTunes-Tags). Enclosure-URLs zeigen auf
  `/.netlify/functions/lektion?id=episodes/<Zeitstempel>.mp3`, das `lektion.mjs` jetzt
  zusätzlich zu `latest` unterstützt. Episoden-Titel im Feed zeigen das Thema
  (`Spanisch-Lektion: <Thema>`), Fallback aufs Datum bei alten Episoden ohne Thema-Metadatum.
- **Umbau auf Corinne/absolute Anfängerin, Niveau A0 (2026-09-13, committed,
  gepusht, deployed, per Testläufen verifiziert):** Nutzerwunsch: Lektionen
  jetzt für Corinne, komplette Anfängerin, südamerikanisches Spanisch mit Fokus
  Paraguay, ohne Grammatik-Erklärungen und ohne verschiedene Zeitformen, 3–5
  statt fest 5 Lektionen/Tag, Niveau steigt nur auf ausdrücklichen Wunsch statt
  automatisch. Umgesetzt: neuer Block `level: "A0"` in `CURRICULUM` (18 Themen:
  Begrüßung, Ja/Nein/Entschuldigung, Zahlen, die wichtigsten Verb-Sätze ohne
  Konjugationslehre, Farben, Familie, Essen, Adjektive, Wochentage, Zuhause,
  Einkaufen, Gefühle, Wegbeschreibung, Fragewörter, zwei Wiederholungs-
  Lektionen), neue Konstante `ACTIVE_LEVELS = ["A0"]` ersetzt die alte
  episodenzahl-basierte Automatik komplett (`pickForIndex` rotiert jetzt endlos
  nur durch die aktiven Blöcke, `CURRICULUM_RESET_AT` entfernt – nicht mehr
  nötig), `EPISODES_PER_DAY` in `generate-daily-background.src.mjs` würfelt
  jetzt 3–5 statt fest 5. Im selben Zug (noch am 2026-09-13) wieder komplett
  entfernt: jeglicher Guaraní-Inhalt (Hin-und-her s. „Kein Guaraní" unter
  „Themenrotation & Niveau-Steuerung" – kurz eingeführt, dann verschärft, dann
  auf Nutzerwunsch ganz rausgenommen). Fünf Test-Lektionen live erzeugt;
  Nutzer-Feedback zur letzten (finalen) davon: **"klingt gut, kein Guaraní"**
  – Umbau damit inhaltlich bestätigt. Details unter „Themenrotation &
  Niveau-Steuerung".
- **Neuausrichtung auf die Paraguay-Reise (2026-08-23, live seit ca. 2026-08-24,
  Vorgänger-Curriculum der obigen A0-Anpassung):** `CURRICULUM` in `lesson-generator.src.mjs`
  komplett neu geschrieben – statt generischer Alltagsthemen jetzt konkret auf eine
  bevorstehende Paraguay-Reise zugeschnitten (Ankunft Flughafen Asunción, Airbnb-
  Check-in, Mietwagen, Behördengänge, Markt/Verhandeln, Rückfragen beim Gastgeber
  usw.), weiterhin je 15 Themen pro Niveau (A1/A2/B1, gedeckelt bei B1). Neu:
  - **`REGION_HINT`** (in JEDEM System-Prompt, unabhängig vom Typ): erzwingt
    paraguayisches Spanisch statt Standard-/Spanien-Spanisch – voseo („vos tenés",
    „vení", „mirá", „dale" statt „tú tienes" etc.), Preise in Guaraníes statt Euro.
  - **`GUARANI_HINT`** (in jeder Lektion außer Typ `guarani` selbst): baute 2–3
    Guaraní-Wörter/Floskeln passend zum Thema ein. **Inzwischen wieder komplett
    entfernt** (2026-09-13, s. „Kein Guaraní" unter „Themenrotation &
    Niveau-Steuerung") – hier nur noch als Historie stehen gelassen.
  - ein neuer `type`-Wert in `TYPE_FORMAT`: **`zusammenfassung`**
    (Wiederholungs-Lektion mit kurzer Selbstabfrage samt hörbarer Denkpause,
    auch in `feed.src.mjs` → `TYPE_LABELS` ergänzt). Es gab hier auch kurzzeitig
    einen Typ `guarani` – ebenfalls wieder entfernt, s. o.
  - **`CURRICULUM_RESET_AT`** von `63` auf `169` hochgesetzt (Rotation beginnt ab
    Episode 169 wieder bei A1, ältere Episoden bleiben in Blobs erhalten und zählen
    nicht mehr für die Themenwahl).
  Stand: committed, gepusht und deployed (Commit `053ba31`), live per Feed
  verifiziert (2026-09-13: 248 Episoden, Paraguay-Themen, `guarani`- und
  `zusammenfassung`-Typen erscheinen korrekt im Feed). `CURRICULUM_RESET_AT` gab
  es hier noch, ist aber mit dem A0-Umbau oben inzwischen entfernt worden.
- **Themenrotation & Niveau-Steuerung (2026-09-13 komplett umgebaut für Corinne,
  absolute Anfängerin – ersetzt die vorherige automatische Niveau-Progression;
  ältere Versionen dieses Abschnitts sind überholt):**
  `CURRICULUM`-Array in `lesson-generator.src.mjs`. Themen sind in Blöcken nach Niveau
  sortiert, jedes Niveau mit eigenem Ton (`LEVEL_TONE`) UND jedes Thema mit einem
  **Typ** (`TYPE_FORMAT`): `dialog` (Standard, wird im A0-Block bewusst NICHT
  verwendet – freie Dialoge sind für absolute Anfänger zu unvorhersehbar),
  `vokabular` (strukturierte Wortschatz-Liste), `verben` (nützliche feste Sätze mit
  den wichtigsten Alltagsverben – bewusst OHNE Konjugations-/Grammatik-Erklärung),
  `beschreibung` (Adjektive/Gefühle) und `fragen` (W-Fragewörter) sowie
  `zusammenfassung` (Wiederholung mit Selbstabfrage). Es gab kurzzeitig auch einen
  Typ `guarani` (Guaraní-Wortschatz) – am 2026-09-13 auf Nutzerwunsch wieder
  entfernt, s. u. System-Prompt wird aus Niveau-Ton + Typ-Formatierung zusammengesetzt
  (`buildSystem(level, type)`). `topic`, `level` und `type` werden in den
  Blob-Metadaten gespeichert und im Feed-Titel angezeigt
  (`Spanisch-Lektion (A0) – Vokabular: <Thema>`).

  **Niveau steigt NICHT mehr automatisch.** Eine Konstante `ACTIVE_LEVELS` (aktuell
  `["A0"]`) legt fest, welche Blöcke aus `CURRICULUM` überhaupt verwendet werden.
  `pickForIndex(n)` flacht nur die aktiven Blöcke zu einem Pool ab und rotiert
  endlos hindurch (`ACTIVE_POOL[n % ACTIVE_POOL.length]`) – ein Thema wiederholt
  sich erst, wenn der ganze aktive Pool durchgelaufen ist. Soll das Niveau steigen,
  MUSS das ausdrücklich gewünscht werden (z. B. „jetzt A1 dazu nehmen") – dann wird
  der nächste Level-String zu `ACTIVE_LEVELS` hinzugefügt (z. B. `["A0", "A1"]`) und
  neu gebündelt/deployed. Alte Themen bleiben dabei bewusst im Pool: durchmischtes
  Wiederholen von A0-Wortschatz zusammen mit neuem A1-Stoff ist gewollt (erfüllt den
  Wunsch nach ständiger Wiederholung der wichtigsten Wörter/Verben/Adjektive auch
  über einen Niveau-Sprung hinweg).

  **A0-Block** (neu, aktuell einziger aktiver Block, 18 Themen): absolute
  Grundlagen – Begrüßung, Ja/Nein/Entschuldigung, Zahlen 0–20, die nützlichsten
  Verb-Sätze (quiero/tengo/hay/es/está/puedo/me gusta/necesito) als fertige Sätze
  ohne Grammatik-Erklärung, Farben, Familie, Essen/Trinken, Adjektive, Wochentage,
  Zuhause, Einkaufen, Gefühle, Wegbeschreibung, die 3 wichtigsten
  Fragewörter – dazwischen zwei `zusammenfassung`-Lektionen, die die jeweils
  vorherigen Themen NAMENTLICH auflisten (nicht nur "wiederhole die letzten
  Themen"), weil das TTS-Skript pro Lektion frisch von Claude erzeugt wird und
  KEIN Gedächtnis über frühere Lektionen hinweg hat – echte Wiederholung
  bestimmter Wörter funktioniert nur, wenn sie explizit im Topic-Text stehen.
  `LEVEL_TONE.A0` verbietet explizit Grammatik-Fachbegriffe und unterschiedliche
  Zeitformen (nur Präsens, ohne die Bildung zu erklären). Guaraní ist bewusst
  NICHT Teil der Themen (s. u.).

  **Kein Guaraní (Entscheidung 2026-09-13):** Ursprünglich (Paraguay-
  Neuausrichtung 2026-08-23) sollte jede Lektion 2–3 Guaraní-Wörter enthalten
  (`GUARANI_HINT`) plus einen eigenen Typ `guarani`. Das wurde am selben Tag wie
  der A0-Umbau zunächst noch verschärft (Guaraní verpflichtend statt optional),
  dann aber auf ausdrücklichen Nutzerwunsch ("nur Spanisch, ohne Guaraní")
  wieder VOLLSTÄNDIG entfernt – `GUARANI_HINT` und `TYPE_FORMAT.guarani`
  existieren nicht mehr, `REGION_HINT` verbietet Guaraní jetzt sogar explizit.
  Alle `type: "guarani"`-Einträge im gesamten `CURRICULUM` (auch in den
  dormanten A1/A2/B1-Blöcken) wurden durch reine Spanisch-Themen ersetzt, damit
  beim späteren Freischalten höherer Level nicht unbemerkt wieder Guaraní
  auftaucht. Die Währung heißt weiterhin „Guaraní" (Guaraníes) – das ist nur der
  Name der Landeswährung, keine Sprachlektion, und bleibt in `REGION_HINT`.
  **Falls Guaraní je wieder gewünscht wird:** nicht die alte Pflicht-Version
  reaktivieren, sondern erst mit dem Nutzer klären, in welcher Dosierung
  (optional/gelegentlich vs. verpflichtend) – das war zweimal in Folge falsch
  kalibriert.

  **A1/A2/B1-Blöcke bleiben im Code, sind aber dormant** (nicht in
  `ACTIVE_LEVELS`) – ursprünglich für die Paraguay-Reise geschrieben
  (2026-08-23, Flughafen/Airbnb/Mietwagen/Behörden/Markt), enthalten mehr
  Dialog und implizit mehr Grammatikvielfalt als der A0-Block. Vor dem
  Freischalten (A1 zu `ACTIVE_LEVELS` hinzufügen) ggf. prüfen, ob sie noch zum
  "ohne Grammatik/Zeitformen"-Prinzip passen oder erst angepasst werden sollten.

- **Cover-Art & Range-Requests (2026-07-19 behoben, deployed & verifiziert):** Feedback
  (vermutlich aus einem Podcast-Validator) bemängelte fehlendes `<itunes:image>` (Pflichtfeld
  bei Apple Podcasts/Spotify) sowie fehlende HTTP-Range-Unterstützung in `lektion.mjs`
  (Player können ohne `206 Partial Content` nicht scrubben/vorspulen, brechen teils die
  Wiedergabe ab). Beides behoben: `cover.jpg` (Platzhalter) im Repo-Root ergänzt,
  `feed.src.mjs` liefert jetzt `itunes:image`/`itunes:author`/`<image>`, `lektion.mjs`
  hat jetzt eine lesbare Quelle (`lektion.src.mjs`) mit Range-Support. Live geprüft:
  `cover.jpg` lädt (200, image/jpeg), `lektion` liefert bei `Range: bytes=...` korrekt
  `206` + `content-range`-Header.

- **Tägliche automatische Batch-Erzeugung (2026-07-21 gebaut, deployed & verifiziert):**
  `generate-daily-trigger.mjs` (Scheduled Function, täglich 03:00 UTC) stößt
  `generate-daily-background.mjs` an, das 5 Lektionen parallel erzeugt (Themen vorab
  aus der aktuellen Episoden-Anzahl berechnet, `latest` danach deterministisch auf die
  neueste gesetzt). Gemeinsame Erzeugungslogik in `lesson-generator.src.mjs`
  ausgelagert; `generate-background.mjs` (manueller Einzel-Trigger) nutzt dieselbe
  Logik und verhält sich unverändert. Live per manuellem Aufruf von
  `generate-daily-background` getestet: 5 neue Episoden mit 5 unterschiedlichen,
  korrekt rotierten Themen (kein Duplikat), `latest` zeigte danach bytegenau auf die
  chronologisch neueste davon. Einzig noch nicht beobachtet: der automatische
  Cron-Lauf selbst (erster echter Auslöser ist die kommende Nacht, 03:00 UTC) – falls
  der ausbleibt, im Netlify-Dashboard unter Functions prüfen, ob
  `generate-daily-trigger` mit „Scheduled"-Badge gelistet ist.

**Bekannte Lücken im Feed (bewusst zurückgestellt):**
- `feed.mjs` macht pro Aufruf eine `getMetadata`-Anfrage je Episode (N HEAD-Requests).
  Bei manueller/seltener Erzeugung unkritisch; bei vielen Episoden ggf. später cachen.
- Der aktive A0-Pool hat 18 Themen und wiederholt sich bei 3–5 Lektionen/Tag alle
  ca. 4–6 Tage komplett (inkl. der beiden Wiederholungs-Lektionen) – das ist
  gewollt (s. Nutzerwunsch nach ständiger Wiederholung), falls es Corinne auf
  Dauer zu eintönig wird: `CURRICULUM`-Block `A0` in `lesson-generator.src.mjs`
  um weitere Themen ergänzen (Block einfach länger machen, keine
  Struktur-Änderung nötig, `ACTIVE_POOL` passt sich automatisch an).

**Spätere Ausbaustufen:**
- Lernermodell: Wortschatz & Schwächen mitführen, Lektionen daran anpassen
  (z. B. gezielt Fragewörter üben).
- Optionaler Gesprächs-Modus (Sprechen + Antworten) für Situationen mit freien Händen.
- **Weitere Lektionstypen über `vokabular`/`verben`/`beschreibung`/`fragen` hinaus**
  (z. B. gezieltes Grammatik-Üben wie Vergangenheitsformen oder Subjuntivo als eigener
  `type`): die `type`-Dimension existiert jetzt (s. „Themenrotation & Niveau-
  Progression"), aktuell mit vier Sonderformen. Bei Bedarf `TYPE_FORMAT` in
  `lesson-generator.src.mjs` um weitere Typen ergänzen und im `CURRICULUM` an
  passenden Stellen einstreuen – gemischt in denselben Feed (bewusste Entscheidung des
  Nutzers – nicht als separater Feed pro Level/Typ). Details zur type-Dimension
  s. „Themenrotation & Niveau-Steuerung".

---

## Nächster konkreter Schritt

Der Corinne/A0-Umbau vom 2026-09-13 ist committed, gepusht, deployed und vom
Nutzer per Testlektion bestätigt: **kein Guaraní mehr, klingt gut** (bestätigt
anhand der Episode `episodes/2026-09-13T02-18-18-550Z.mp3`, Thema Begrüßung,
erster Test mit dem endgültigen Code-Stand nach der Guaraní-Entfernung). Damit
ist dieser Umbau inhaltlich abgeschlossen. Insgesamt 5 manuelle Test-Lektionen
heute erzeugt (Tageskontingent 10) – vor dem nächtlichen Cron-Lauf (03:00 UTC,
3–5 weitere) daher an diesem Tag keine weiteren manuellen Erzeugungen mehr
auslösen, um das Tageslimit nicht zu sprengen.

Noch nicht einzeln gegengehört (kein Blocker, aber bei Gelegenheit prüfen):
  - Klingt es wirklich wie für eine absolute Anfängerin (sehr langsam, kurze
    Sätze, deutsche Übersetzung bei jedem Wort)?
  - Wurden Grammatik-Fachbegriffe und unterschiedliche Zeitformen tatsächlich
    vermieden (nur feste Präsens-Sätze, keine Konjugationstabellen)?
  - Klingt das Voseo/Paraguay-Spanisch weiterhin korrekt (REGION_HINT gilt
    unverändert auch für A0)?
  - Funktioniert eine der beiden `zusammenfassung`-Lektionen (Wiederholung 1/2)
    wie gedacht – werden die zuvor genannten Wörter wirklich nochmal genannt?
- Corinne über einen längeren Zeitraum hören lassen (der nächtliche Cron läuft
  automatisch mit 3–5 A0-Lektionen/Tag) und Feedback einholen – ggf.
  `CURRICULUM` (A0-Block) in `lesson-generator.src.mjs` nachjustieren
  (Reihenfolge, fehlende Grundwörter, zu schnelles/langsames Tempo).
- Wenn Corinne bereit für mehr ist: **nur auf ihre/Nutzer-Ansage hin** `"A1"` zu
  `ACTIVE_LEVELS` hinzufügen (und vorher den A1-Block auf Grammatik-/Zeitformen-
  Freiheit prüfen, s. o.) – niemals von selbst eskalieren.
