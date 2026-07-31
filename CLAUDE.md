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
  **Curriculum** (`CURRICULUM`-Array, s. „Themenrotation & Niveau-Progression" unter
  „Aktueller Stand") und `pickForIndex(n)`, das aus der n-ten Episode Thema, Niveau
  und passenden System-Prompt bestimmt.
- **`netlify/functions/generate-background.mjs`** (Quelle: `generate-background.src.mjs`)
  – Hintergrund-Funktion (Name endet auf `-background` – bis 15 Min Laufzeit erlaubt).
  Manueller Einzel-Trigger: erzeugt genau **eine** Lektion (Thema per Rotation aus der
  bisherigen Episoden-Anzahl), speichert in Blobs sowohl unter `latest` als auch unter
  `episodes/<Zeitstempel>.mp3` (Episoden-Historie).
- **`netlify/functions/generate-daily-background.mjs`** (Quelle:
  `generate-daily-background.src.mjs`) – Hintergrund-Funktion für die **tägliche
  Batch-Erzeugung** von 5 Lektionen. Berechnet alle 5 Themen EINMALIG vorab aus der
  aktuellen Episoden-Anzahl (nicht nach jeder Einzel-Erzeugung neu), erzeugt dann alle
  5 **parallel** (`Promise.allSettled`) – damit bleibt die Gesamtlaufzeit nah an der
  einer Einzel-Erzeugung (statt 5× hintereinander, was das 15-Min-Limit riskieren würde)
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
- Erzeugen (5 Lektionen, Batch – normalerweise nur vom Scheduler aufgerufen): `/.netlify/functions/generate-daily-background`
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
  bewusst nur **5** Lektionen/Tag (statt bis zu 10), damit Puffer für manuelle Aufrufe/
  Tests am selben Tag bleibt. Bei manueller Massen-Erzeugung zusätzlich zur Batch-Funktion:
  **Gesamt (Batch + manuell) max. ~9 pro Tag einplanen** (ein Puffer, da auch
  fehlgeschlagene Versuche zählen).
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
- **Themenrotation & Niveau-Progression, Cap bei B1 (2026-07-21 erste Version,
  2026-07-31 überarbeitet – Cap+Reset noch nicht live beobachtet):** `CURRICULUM`-Array
  in `lesson-generator.src.mjs`. Themen sind in Blöcken nach Niveau sortiert, **gedeckelt
  bei B1** (A1: 18 Themen, A2: 15, B1: 15 – kein B2/C1 mehr, s. u.), jedes Niveau mit
  eigenem Ton (`LEVEL_TONE`: Tempo/Übersetzungsanteil steigt von Block zu Block) UND
  jedes Thema mit einem **Typ** (`TYPE_FORMAT`): `dialog` (Standard) sowie die
  Sonderformen `vokabular` (strukturierte Wortschatz-Liste, aktuell 3× im Curriculum),
  `verben` (wichtige Alltagsverben, 1×), `beschreibung` (Personen/Orte beschreiben, 1×)
  und `fragen` (W-Fragewörter, 1×) – System-Prompt wird aus Niveau-Ton + Typ-Formatierung
  zusammengesetzt (`buildSystem(level, type)`). `pickForIndex(n)` (n = Anzahl bisheriger
  Episoden) arbeitet sich block für block durch: ein Thema wiederholt sich erst, wenn
  sein ganzer Niveau-Block durch ist. Ist der letzte Block (B1) einmal komplett durch,
  wird nur noch er zyklisch wiederholt (kein Rücksprung auf A1, aber auch kein Steigen
  über B1 hinaus). `topic`, `level` und `type` werden in den Blob-Metadaten gespeichert
  und im Feed-Titel angezeigt (`Spanisch-Lektion (B1) – Vokabular: <Thema>`).
  **`CURRICULUM_RESET_AT = 63`** (Konstante in `lesson-generator.src.mjs`): `pickForIndex`
  rechnet intern mit `index - CURRICULUM_RESET_AT`, damit die Rotation ab Episode 63
  wieder bei A1 beginnt, OHNE die vorhandenen 63 Episoden zu löschen (bleiben unverändert
  in Blobs erhalten, zählen für die Themenwahl aber nicht mehr mit). Grund: Ursprünglich
  lief die Progression bis C1 (Cap+Themenzahl der ersten Version), aber nach 10 Tagen
  automatischem Batch-Betrieb (14→63 Episoden) Nutzer-Feedback: zu schwierig/zu schnelle
  Wiederholung auf C1-Niveau, gewünscht war ein Neustart bei A1 mit Deckel bei B1 und mehr
  Varianz (Sonder-Typen) im unteren Bereich. Falls das Curriculum je wieder neu gestartet
  werden soll: `CURRICULUM_RESET_AT` auf die dann aktuelle Episoden-Anzahl setzen.

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
- Nach dem B1-Block (48 Themen ab `CURRICULUM_RESET_AT` durch) wiederholen sich dessen
  15 B1-Themen alle 3 Tage (bei 5/Tag) endlos – das ist ab jetzt so gewollt (Cap bei B1),
  aber falls die Wiederholung auf Dauer zu eintönig wird: `CURRICULUM` in
  `lesson-generator.src.mjs` um weitere B1-Themen ergänzen (Block einfach länger machen,
  keine Struktur-Änderung nötig).

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
  Nutzers – nicht als separater Feed pro Level/Typ).

---

## Nächster konkreter Schritt

Der automatische Cron-Trigger ist bereits bestätigt zuverlässig gelaufen (10 Nächte
in Folge, s. „Aktueller Stand"). Offen ist jetzt der **Curriculum-Reset selbst**
(2026-07-31 gebaut, deployed, lokal mit `pickForIndex`-Testaufrufen verifiziert, aber
noch nicht durch eine echte Claude-Erzeugung gehört):

- Nächste Fünfer-Charge (heute Nacht, 03:00 UTC) sollte 5 neue A1-Themen aus dem
  erweiterten Curriculum liefern, inkl. ggf. eines der neuen Sonder-Typen
  (Vokabular/Verben/Beschreibung/Fragen), je nachdem welche Indizes ab
  `CURRICULUM_RESET_AT = 63` genau dran sind.
- Nutzer-Feedback einholen: Kommt der Neustart bei A1 richtig an (spürbar leichter
  nach dem C1-Ausflug)? Funktionieren die neuen Lektionstypen inhaltlich wie gedacht
  (Vokabular-Liste statt Dialog, Verben-Drill, Beschreibung, W-Fragen)? Bei Bedarf
  `TYPE_FORMAT`/`LEVEL_TONE` in `lesson-generator.src.mjs` nachjustieren.
- Titel im Feed sollten jetzt Typ-Label zeigen, z. B. „Spanisch-Lektion (A1) –
  Vokabular: Grundwortschatz…" – nach dem nächsten Batch-Lauf im Feed gegenprüfen.
