---
name: thesis-schreiben
description: Schreibt die Kapitel der Bachelorarbeit zum E-Portfolio Hochschule Bremen in die Confluence-Kapitelseiten (Space BEH), nach der unterschriebenen Gliederung des Exposés v3, im wissenschaftlichen Fließtext ohne KI-Muster, zitiert nach APA 7 und nur aus geführten Quellen. Immer verwenden, wenn Text für ein Thesis-Kapitel oder einen Abschnitt entsteht oder überarbeitet wird.
---

# Ein Thesis-Kapitel schreiben

## Aufruf

„Schreibe Kapitel 1“ genügt. Ebenso „schreibe Kapitel 1 bis 3“ oder „schreibe
Kapitel 2 und 4“. Der Ablauf unten wird dann je genanntem Kapitel vollständig
durchlaufen, eines nach dem anderen, mit einem eigenen Abschnittsplan und einer
eigenen Übergabe je Kapitel. Mehrere Kapitel werden nicht zu einem Rutsch
verschmolzen: die Klärungsrunde und der Abschnittsplan gehören zu jedem Kapitel
einzeln, sonst fällt eine Schieflage erst am Ende auf.

Auch „schreibe 4.5“ oder „überarbeite 3.3“ ist ein gültiger Auftrag. Dann gilt
derselbe Ablauf, beschränkt auf den Abschnitt, und der Umfang wird gegen den
Anteil dieses Abschnitts am Kapitelkorridor geprüft.

## Was diese Arbeit ist

Sie beantwortet eine Forschungsfrage und drei Teilfragen. Das gebaute System ist
das Werkzeug der Beantwortung, nicht ihr Gegenstand. Der Zweitprüfer formuliert
es so: an der FK4 entstehen überwiegend Arbeiten mit einer Entwicklungsarbeit,
diese Entwicklungsarbeit ist nicht das Thema der Thesis, sie macht einen großen
Teil aus und ist ein Werkzeug zur Beantwortung der Forschungsfrage. Und: die
Thesis ist der Nachweis, wissenschaftlich arbeiten zu können, nicht der Nachweis,
ein gutes Produkt gebaut zu haben.

Daraus folgt die Prüffrage für jeden Absatz: zahlt er auf eine Teilfrage ein,
wertet er eine Quelle aus, oder begründet er eine Entscheidung? Wenn nichts
davon zutrifft, gehört er nicht in die Arbeit.

Der Code ist eingefroren. Was über die Realisierung geschrieben wird, ist am
Repository und am Contract belegt, nicht aus der Erinnerung geschrieben.

## Verbindliche Quellen für den Text (in dieser Reihenfolge)

1. **Exposé v3**, unterschrieben am 10.06.2026. Die Gliederung (Seite `2949121`)
   und der Wortlaut von Forschungsfrage und Teilfragen (Seite `2424870`) geben
   es wieder. Beides wird nicht umformuliert, nicht gekürzt und nicht ergänzt,
   auch nicht sinngemäß. Eine Abweichung ist eine Abstimmung mit Prof. Teufel
   und J. Bulk, keine redaktionelle Entscheidung. Die Seite „Exposé (aktuelle
   Version + Versionen)“ (`819202`) trägt den Text selbst nicht, sondern nur
   einen Verweis; maßgeblich sind `2949121` und `2424870`.
2. **Literaturübersicht** (Seite `2097153`): die Menge zitierbarer Quellen. Was
   dort nicht steht, wird erst eingetragen und dann zitiert.
3. **Materialseiten je Kapitel**: siehe `kapitelmaterial.md` neben diesem Skill.
   Dort steht auch, welche der genannten Seiten leer sind oder nur Diagramme
   tragen. Viele Confluence-Seiten des Space sind Platzhalter aus der
   Planungsphase; wer sie für Materialquellen hält, sucht dort vergeblich.
4. **Repository und API-Contract** für alles Technische: `docs/ARCHITEKTUR.md`,
   `docs/NAMENSSCHEMA.md`, die Contract-Seite `36732929`, der Code selbst.
5. **Statusseite „Schreibfähigkeit der Kapitel“** (Seite `34471937`): nur als
   Hinweis, nie als Beleg. Sie ist nachweislich veraltet und trägt Angaben,
   die überholt sind. Harte Belege sind der Contract selbst, Jira und das
   Repository. Nach jedem fertigen Kapitel wird sie fortgeschrieben.

**Keine Versionsnummer wird in diesem Skill festgeschrieben.** Genau daran ist
die Statusseite gescheitert: sie nannte v22, als der Contract längst weiter war.
Die geltende Nummer wird vor jedem Kapitel geholt:

```bash
py .claude/skills/api-contract-sync/contract.py --page 36732929 --cache .thesis-cache pull
```

## Was der Zweitprüfer verlangt

Diese Punkte stammen aus seinen schriftlichen Hinweisen und sind nicht
verhandelbar. Sie stehen hier mit Herkunft, damit sie beim Überarbeiten nicht
für Geschmacksfragen gehalten werden.

**Related Work trägt die Relevanz.** Fremdes Wissen wird nicht in den Raum
gestellt und dann nie wieder aufgegriffen. Jede Quelle wird mit dem eigenen
Projekt verbunden: warum ist diese Arbeit für diese Thesis relevant, und was
folgt daraus für das eigene Vorgehen. `thesis.py lint` meldet jede Quelle, die
in einem Kapitel genau einmal vorkommt; das ist fast immer eine eingeführte und
fallengelassene Quelle.

**Die wissenschaftliche Methode wird benannt.** Wie erhoben, verifiziert und
überprüft wird, steht ausdrücklich im Text, nicht zwischen den Zeilen. Orte
dafür sind Kapitel 2.2 (methodisches Vorgehen der Anforderungserhebung) und
Kapitel 6.1 (Testkonzept und Methodik).

**Die Ergebnisse sind der Kern.** Sie werden umfassend und vollständig
dargestellt. Deshalb tragen Kapitel 6 und 7 zusammen so viel Umfang wie
Kapitel 4 und 5; `thesis.py korridore` prüft das Verhältnis.

**Keine wertenden Adjektive, jede Aussage belegt.** Siehe Schreibregeln 11
und 13 bis 16.

**Rechtschreibung, Grammatik, Formulierung.** Der Prüfer weist ausdrücklich
darauf hin. `thesis.py lint` findet doppelte Wörter, doppelte Leerzeichen,
Leerzeichen vor Satzzeichen, fehlende Leerzeichen danach und unbalancierte
Klammern und Anführungszeichen. Das ersetzt keine Rechtschreibprüfung: vor der
Abgabe läuft jedes Kapitel durch ein Textverarbeitungsprogramm und wird von
einem Menschen gelesen.

**Ein Zitierstil, konsequent.** Gewählt ist APA 7 in deutscher Anwendung.

**Abbildungsverzeichnis nicht vergessen.** Jede Abbildung wird referenziert,
eigene Abbildungen tragen ausdrücklich den Hinweis, dass sie selbst erstellt
sind.

**Eigenständigkeitserklärung nicht vergessen.** Fehlt sie bei der Abgabe, gilt
die Thesis als nicht bestanden. Sie ist ein blockierender Punkt der Definition
of Done.

Als Nachschlagewerk für Methode und Schreibweise empfiehlt der Prüfer Scribbr:
`https://www.scribbr.de/category/anfang-abschlussarbeit/`.

## Zugang zu Confluence

Der Text entsteht direkt in den vorhandenen Kapitelseiten. Der MCP-Konnektor ist
dafür nicht nötig und oft auch nicht verfügbar; gearbeitet wird über
`contract.py`, das mit `--page <id>` auf jeder Seite läuft:

```bash
py .claude/skills/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache pull
py .claude/skills/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache outline --depth 3
py .claude/skills/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache show 1.2 --plain
```

Unter Windows heißt der Aufruf `py`, nicht `python`. Die Arbeitskopien liegen in
`.thesis-cache/` und sind von Git ausgenommen.

| Seite | ID | Rolle |
| --- | --- | --- |
| Gliederung | `2949121` | verbindlicher Aufbau, Exposé-Fassung |
| Forschungsfrage & Ziele | `2424870` | Wortlaut von FF, TF 1 bis TF 3 |
| Literaturübersicht | `2097153` | zitierbare Quellen, Kürzel, Sekundärzitat |
| Eckdaten | `2129939` | Titel, Prüfer, Abgabe 08.10.2026 |
| Bildverzeichnis / eigene Abbildungen | `2064410` | jede Abbildung mit Herkunft und Dateiname, Stand-Vermerke je Änderung |
| Status: Schreibfähigkeit der Kapitel | `34471937` | veraltet, nur Hinweis |
| Kapitel 1: Einleitung | `34504705` | Entwurf |
| Kapitel 2: Anforderungsanalyse | `34701325` | Entwurf |
| Kapitel 3: Grundlagen und verwandte Arbeiten | `34373645` | Entwurf |
| Kapitel 4: Konzeption | `51740676` | Entwurf, umfangreichster Stand |
| Kapitel 5: Realisierung | `51642372` | Teilentwurf |
| Kapitel 6: Test | `51642395` | Teilentwurf |
| Kapitel 7: Evaluation | `51642418` | Teilentwurf |
| Kapitel 8: Zusammenfassung und Ausblick | `58097676` | Teilentwurf |
| Anhang | `101220353` | A User Stories und Use Cases, B Problemliste P1 bis P30, C TAM-Werte je Block |
| Literaturverzeichnis | `101351425` | APA 7, aus der Literaturübersicht erzeugt |
| Abbildungs- und Tabellenverzeichnis | `101351445` | aus den Unterschriften der Kapitel erzeugt |
| Abkürzungsverzeichnis | `101384193` | |
| Zusammenfassung / Abstract | `101416961` | deutsch und englisch |
| Eigenständigkeitserklärung, KI-Angabe und Einzelbeiträge | `101482498` | Entwurf, von den Verfassenden zu prüfen und zu unterschreiben |

Die sechs Rahmenteile ab „Anhang“ liegen wie die Kapitel unter
„Kapitelentwürfe“ (`1343491`) und tragen im Titel den Zusatz „(Entwurf)“. Eine
neue Abbildung, Tabelle, Quelle oder Abkürzung in einem Kapitel wird dort
nachgezogen.

Seitentitel bleiben unverändert. `contract.py push` übernimmt den bestehenden
Titel; der Zusatz „(Entwurf)“ wird erst entfernt, wenn die Prüfer den Stand
abgenommen haben, und dann von Hand. Einzige Ausnahme bisher: Die Seite von
Kapitel 5 hieß bis zum 02.10.2026 „Prototypische Realisierung“ und trägt seit
dem 03.10.2026 den Kapiteltitel des Exposés.

## Ablauf je Kapitel

1. **Stand holen.** Gliederung und Forschungsfrage-Seite lesen, Contract-Version
   ziehen, dann die Kapitelseite ziehen und den vorhandenen Entwurf vollständig
   lesen. Der Entwurf ist Material, keine Vorlage: er wird neu geschrieben,
   nicht poliert. Was darin schon als benannter Platzhalter steht, wird
   ausformuliert und nicht neu erfunden.
2. **Material sichten.** Die in `kapitelmaterial.md` für dieses Kapitel
   genannten Seiten und Repo-Stellen lesen. Eine Aussage über den Systemstand
   muss im Repository gesehen worden sein.
3. **Klärungsrunde.** Entscheidungsrelevante Fragen gebündelt in einer Runde
   stellen (`AskUserQuestion`, Empfohlenes zuerst), nach `CLAUDE.md`, Abschnitt
   „Fragen vor der Umsetzung“. Entscheidungsrelevant heißt: zwei vertretbare
   Lesarten führen zu anderem Text, anderer Gliederung oder anderer Aussage über
   das System. Routinefragen entscheidet Claude selbst.
4. **Abschnittsplan vorlegen.** Je Abschnitt der Gliederung: Kernaussage in
   einem Satz, tragende Belege mit Angabe, wo im Kapitel sie später wieder
   aufgegriffen werden, und Wortbudget. Der Plan wird gezeigt, bevor Text
   entsteht.
5. **Schreiben.** In die Arbeitsdatei `.thesis-cache/kapitel-<nr>.md`, Abschnitt
   für Abschnitt, nach den Schreibregeln unten. Bildplätze entstehen beim
   Schreiben, nicht danach: erst der Satz, der die Abbildung braucht, dann die
   Abbildung.
6. **Prüfen.** `thesis.py lint` ohne Befund, `thesis.py umfang` im Korridor.
   Danach den Text noch einmal gegen die Kernaussagen aus Schritt 4 lesen.
7. **Übertragen und nachziehen.** Nach Confluence speichern (unten), danach das
   Bildverzeichnis (`2064410`) und die Statusseite (`34471937`) fortschreiben.

## Schreibregeln

Diese Regeln sind hart. `thesis.py lint` prüft sie, soweit sie maschinell
prüfbar sind; der Rest liegt beim Lesen.

### Typografie

1. **Kein Fettdruck im Fließtext.** Weder zur Betonung noch als Absatzeinstieg
   („Analyse und Konzeption: …“). Fett gibt es nur in Überschriften,
   Tabellenköpfen und Abbildungsbeschriftungen. Der vorhandene Entwurf von
   Kapitel 1 verstößt an sieben Stellen dagegen; genau das stellt dieser Skill
   ab.
2. **Kursiv sehr sparsam**, allein bei der Ersteinführung eines zentralen
   Fachbegriffs oder für eine Definition.
3. **Kein Gedankenstrich.** Weder der lange noch der kurze als Stilmittel
   (`CLAUDE.md`). Stattdessen Doppelpunkt, Komma, Klammer oder zwei Sätze.
4. **Deutsche Anführungszeichen** „so“, nie gerade und nie englische.

### Aufbau

5. **Fließtext.** Der Haupttext argumentiert in verknüpften Absätzen. Eine
   Aufzählung ist zulässig, wenn sie einen Katalog trägt, der als Katalog
   gelesen wird (Anforderungen FA/NFA, Testaufgaben, Rechtematrix, Heuristiken),
   und wenn sie in Prosa eingeführt und ausgewertet wird. Als Ersatz für
   Argumentation ist sie ein Befund.
6. **Keine Meta-Einleitung.** Kein „Im Folgenden wird erläutert“, kein „Dieses
   Kapitel beschäftigt sich mit“. Der Absatz beginnt mit der Sache.
7. **Kein Floskel-Abschluss.** Kein „Zusammenfassend lässt sich sagen“. Die
   Abschnitte „Zusammenfassung“ sind echte Abschnitte mit eigenem Inhalt und
   fangen nicht mit dieser Wendung an. Seit dem 23.09.2026 schließen die
   Kapitel 1 bis 7 ohne eigene Zusammenfassung (Vermerk auf der
   Gliederungsseite); einen solchen Abschnitt trägt allein Kapitel 8, und 8.1
   beantwortet dort jede Teilfrage und die Forschungsfrage ausdrücklich.
8. **Keine starren Dreiergruppen.** Nicht jede Aufzählung hat drei Glieder; zwei
   oder vier sind oft die ehrlichere Zahl.

### Sprache

9. **Keine Füllphrasen.** Die Sperrliste steht in `thesis.py` (`FLOSKELN`) und
   wird erweitert, sobald eine neue auffällt.
10. **Satzrhythmus wechseln.** Kurze Hauptsätze neben Satzgefügen. `lint` meldet
    eine Streuung der Satzlänge unter sechs Wörtern als Monotonie.
11. **Nüchtern bleiben.** Keine Superlative, keine wertenden Adjektive („enorm“,
    „bahnbrechend“, „optimal“). Relevanz entsteht aus Sachargumenten und Zahlen.
12. **Unpersönlich formulieren.** „Die vorliegende Arbeit“, nicht „wir“ und
    nicht „ich“. Das Confluence-Material sagt oft „unsere Arbeit“; im
    Kapiteltext steht das nicht.

### Belege

13. **Nur geführte Quellen.** Zitierbar ist, was in der Literaturübersicht
    (`2097153`) steht. Eine neue Quelle wird erst dort eingetragen, dann
    zitiert. `lint` meldet belegte, aber noch nicht eingetragene Quellen als
    Prüfpunkt und unbekannte Namen als Befund.
14. **Nichts erfinden.** Fehlt ein Beleg, steht `[Beleg erforderlich: <was>]` im
    Text, sichtbar und zählbar. Kein Kapitel geht mit einem offenen Platzhalter
    nach Confluence, ohne dass er im Abschlussbericht steht.
15. **Zitierweise APA 7, deutsche Anwendung.** Im Text „Lorenzo und Ittelson
    (2005) definieren …“ oder „(Davis, 1989)“, mehrere Belege als „(Davis, 1989;
    Shroff et al., 2011)“, ab drei Autorinnen und Autoren „Shroff et al.
    (2011)“. Eine Seitenzahl steht nur beim wörtlichen Zitat, dann als
    „(Davis, 1989, S. 320)“; in den vorhandenen Entwürfen kommt kein einziges
    wörtliches Zitat vor, die Form ist also die Ausnahme. Die Kürzel der
    Literaturübersicht (LI05, Dav89) sind allein deren Ordnungsmerkmal und
    erscheinen nicht im Text. Stile werden nicht vermischt.
16. **Sekundärzitat kennzeichnen.** Van den Bosch et al. (2005) lag nicht im
    Volltext vor und wird als „Van den Bosch et al., 2005, zitiert nach
    McKenney, 2020“ geführt.
17. **Related Work anbinden.** Jede Quelle wird an derselben Stelle mit dem
    eigenen Projekt verbunden und später wieder aufgegriffen. Eine Quelle, die
    im Kapitel genau einmal vorkommt, ist ein Prüfpunkt.

## Fachliche Tiefe je Kapitel

Der häufigste Fehler ist, überall so zu schreiben wie in Kapitel 5. Die Register
unterscheiden sich:

| Kapitel | Register | Was hier nichts zu suchen hat |
| --- | --- | --- |
| 1 Einleitung | Problemlage, Ziel, Vorgehen. Fachlich, aber ohne System | Klassennamen, Endpoints, Frameworks, Statuswerte in Codeschreibweise |
| 2 Anforderungsanalyse | Akteure, Bedarfe, Anforderungen als Sätze, methodisches Vorgehen | Entitäten, HTTP-Details, Schemafragen |
| 3 Grundlagen | Literatur, Begriffe, Kriterien, Anbindung an das eigene Vorhaben | jeder Bezug auf die eigene Implementierung |
| 4 Konzeption | Entwurf auf Konzeptebene: Komponenten, Rollen, Inhaltsmodell, Zustände, Datenmodell, Gestaltung | Methodennamen, Konfiguration, Bibliotheksversionen |
| 5 Realisierung | hier ist Technik der Gegenstand: Stack, ausgewählte Aspekte, Codeausschnitte, Contract-Abschnitte, Qualitätssicherung | Wiederholung der Konzeption aus Kapitel 4 |
| 6 Test | Methodik und Ablauf der Erhebung, Rohdaten deskriptiv | Bewertung, Systembeschreibung |
| 7 Evaluation | Bewertung an TAM, Heuristiken, Anforderungen | neue Systembeschreibung; nur Rückverweise |
| 8 Zusammenfassung | Antwort auf die Fragen, Grenzen, Ausblick | jedes technische Detail |

Konkret für die nicht-technischen Kapitel: Rollen heißen „Studierende“,
„Redaktion“, „Administration“ und „externe Nutzende“, nicht `STUDENT`, `EDITOR`,
`ADMIN`. Statuswerte heißen „Entwurf“, „Eingereicht“, „Genehmigt“,
„Veröffentlicht“ und „Überarbeitung“; die englischen Enum-Werte stehen nur in
Kapitel 4 und 5, und dort einmal bei der Einführung.

## Bindung an die Forschungsfrage

Jedes Kapitel arbeitet einer Teilfrage zu. Seit dem 23.09.2026 schließen die
Kapitel 1 bis 7 ohne eigene Zusammenfassung; die Antworten stehen gebündelt in
8.1, die auf TF 2 zusätzlich ausführlich in 7.2. Die Zuordnung ist verbindlich
und stammt von Seite `2424870`:

| Teilfrage | bearbeitet in | beantwortet in |
| --- | --- | --- |
| TF 1: Anforderungen aus der Forschungsliteratur | Kapitel 3 (Herleitung), Kapitel 2 (Übersetzung) | 8.1 |
| TF 2: Merkmale für Auffindbarkeit und Benutzerfreundlichkeit | 3.3, 4.5, Kapitel 6 | 7.2, verdichtet in 8.1 |
| TF 3: Blockbasiertes Inhaltsmodell mit Redaktionsworkflow | 4.3 und 4.4, Kapitel 5 | 8.1 |
| Übergeordnete Forschungsfrage | alle Kapitel | 8.1 |

Ein Kapitel, das keiner Teilfrage zuarbeitet, ist entweder falsch geschnitten
oder überflüssig. Das ist vor dem Schreiben zu klären, nicht danach.

## Umfang

Ziel sind 70 bis 85 Seiten Text ohne Verzeichnisse und Anhang, gerechnet mit 300
Wörtern je Seite. Die Korridore je Kapitel stehen in `thesis.py` (`KORRIDOR`),
`thesis.py umfang` prüft das einzelne Kapitel dagegen, und `thesis.py korridore`
prüft die Verteilung selbst: ob ihre Summe das Seitenziel trifft und ob der
Ergebnisteil aus Kapitel 6 und 7 mindestens so schwer wiegt wie der Entwurfsteil
aus Kapitel 4 und 5. Diese Prüfung gibt es, weil hier schon einmal etwas
auseinanderlief.

Ein Kapitel unter der Untergrenze wird nicht mit Wiederholung aufgefüllt,
sondern um Herleitung, Beleg und Beispiel ergänzt; ein Kapitel über der
Obergrenze verliert zuerst das, was anderswo schon steht.

## Werkzeug

```bash
py .claude/skills/thesis-schreiben/thesis.py korridore
py .claude/skills/thesis-schreiben/thesis.py lint .thesis-cache/kapitel-01.md
py .claude/skills/thesis-schreiben/thesis.py umfang .thesis-cache/kapitel-01.md
py .claude/skills/thesis-schreiben/thesis.py storage .thesis-cache/kapitel-01.md
py .claude/skills/thesis-schreiben/thesis.py attach abb-4-7-projektliste.png --page 51740676
```

`lint` endet mit Rückgabewert 1, sobald ein Befund offen ist. `PRUEFEN`-Punkte
lassen den Rückgabewert bei 0, sind aber kein Freibrief: jeder wird einzeln
beantwortet, und die Antwort steht im Abschlussbericht.

Die Arbeitsdatei ist Markdown mit einer Ergänzung: Abbildungs- und
Tabellenplätze stehen als eigene Zeile, mit Nummer, Titel, Herkunft und
Dateiname des Seitenanhangs.

```
[[abbildung: 4.7 | Projektliste mit Facettenfilter | eigene Darstellung, Figma-Frame Template / Öffentlich | abb-4-7-projektliste.png]]
[[tabelle: 2.1 | Funktionale Anforderungen FA-01 bis FA-12 | Confluence 884747 | abb-2-1-anforderungen.png]]
```

Fehlt das vierte Feld, entsteht in Confluence statt des Bildes ein Hinweiskasten
mit dem Zusatz „Bilddatei fehlt noch“, und `lint` meldet die Stelle.
Kommentarzeilen der Form `<!-- … -->` bleiben lokal und wandern nicht nach
Confluence.

## Abbildungen

Die Arbeit trägt rund 29 Abbildungen, also etwa alle drei Seiten eine. Die
Verteilung folgt dem Gewicht der Kapitel, nicht der Verfügbarkeit von
Bildmaterial:

| Kapitel | Anzahl | Was |
| --- | --- | --- |
| 1 Einleitung | 0 | keine; das Problem wird erklärt, nicht illustriert |
| 2 Anforderungsanalyse | 2 | Akteursübersicht, Use-Case-Überblick |
| 3 Grundlagen | 2 | TAM nach Davis, Ausschnitt der HfG-Referenzplattform |
| 4 Konzeption | 12 | fünf Konzeptdiagramme, drei Figma-Screens, vier Prozessabbildungen aus Miro |
| 5 Realisierung | 7 | Screenshots der laufenden Anwendung, ein Codeausschnitt |
| 6 Test | 2 | Testaufbau, Aufgabenübersicht |
| 7 Evaluation | 4 | SUS-Ergebnis, Heuristikbefunde, Anforderungsabgleich |
| 8 Zusammenfassung | 0 | keine |

### Drei Bildquellen, die nicht vermischt werden

Der Figma-Prototyp zeigt den Entwurf und gehört nach Kapitel 4. Dort ist es in
Ordnung, dass ein Screen einen Zustand zeigt, den es im Code nie gab. Datei
`o6SECXRMKGOzCfG5xZebPV`, Seite `Template` mit der Node-ID `4:611`, immer
frameweise über `get_screenshot`, nie über die unvollständige Seitenliste
(`CLAUDE.md`, Abschnitt zur Figma-Arbeitsdatei). Die Frame-ID je Template steht
auf der Confluence-Seite „Template-Abdeckung“ (`53739521`); sie ist die
zuverlässige Nachschlagestelle, auch wenn der Figma-Konnektor gerade fehlt.

Screenshots der laufenden Anwendung zeigen, was tatsächlich entstanden ist, und
gehören nach Kapitel 5, 6 und 7. Es liegen 24 Aufnahmen in
`frontend/src/assets/help/` mit 2560 mal 1600 Bildpunkten, erzeugt über
`pnpm screenshots` gegen den Dev-Stack. Ein Figma-Bild in Kapitel 5 wäre eine
falsche Behauptung über den gebauten Stand.

Das Miro-Board `uXjVHJa5VEY=` trägt die Vorstufe: frühe Wireframes der
Registrierungsstrecke, der Startseite mit den Top 10, der Administrationsseite
und der Redaktionsansicht. Sein Wert liegt nicht in der Gestaltung, sondern im
Nachweis, dass entworfen und verworfen wurde. Es erscheint ausschließlich im
Prozessabschnitt von 4.5.

Eigene Diagramme (Architektur, Rollenmodell, Zustandsautomat, Datenmodell)
tragen die Herkunft „eigene Darstellung“, bei Ableitung aus einer Quelle
„eigene Darstellung nach Davis (1989)“ oder „nach Contract, Abschnitt 4.1“.

### Der Prozessabschnitt in 4.5

Innerhalb von 4.5 steht ein kurzer Abschnitt zum Entwurfsprozess mit vier bis
fünf Abbildungen, der die Entwicklung von der Handskizze über das
Miro-Wireframe zum Figma-Prototyp nachzeichnet. Er umfasst rund 400 Wörter und
muss argumentieren, nicht bloß zeigen: je Abbildungspaar ein bis zwei Sätze,
was geändert wurde und woraufhin. Zwei belegbare Beispiele liegen auf dem
Board: die Rollenidee lautet dort noch „Student, betreuer“ und damit anders als
das spätere Modell aus vier Akteurgruppen, und die fünf Projektstatus stehen
bereits, während die Registrierungsstrecke noch ohne die getrennte Bestätigung
von privater und HSB-Adresse auskommt.

Das ist eine dritte Überschriftenebene innerhalb von 4.5. Die Gliederungsseite
führt nur zwei Ebenen, der Abschnitt ist deshalb keine Abweichung vom
angemeldeten Aufbau. Beim Abstimmungstermin wird er dennoch genannt, zusammen
mit den beiden vermerkten Abweichungen in Kapitel 2 und 3.

Vor der Verwendung wird das Board durchgesehen: es enthält Arbeitsnotizen wie
den roten Vermerk „Nur anziege“ und Schreibfehler der Entwurfsphase
(„Projecte“, „Redukture“, „Semster“). Schreibfehler in einer Skizze sind
unproblematisch und belegen den Entwurfscharakter; Arbeitsnotizen, die niemand
außerhalb des Teams versteht, werden weggeschnitten.

### Regeln für jede Abbildung

Eine Abbildung wird im Fließtext angekündigt und danach ausgewertet. „Abbildung
4.7 zeigt …“ allein genügt nicht; es folgt, was daran zu sehen ist und warum es
für die Argumentation zählt. Eine Abbildung, über die kein Satz steht, wird
gestrichen.

Jede Abbildung trägt Nummer, Titel und Herkunft. Fremde Abbildungen werden
referenziert wie eine Quelle, eigene tragen ausdrücklich „eigene Darstellung“.
Screenshots entstehen auf Deutsch und im hellen Modus, damit sie zum Satzbild
passen. Bleibt Text im Bild bei 16 cm Satzbreite unlesbar, wird ein Ausschnitt
gezeigt und kein Vollbild.

Die Confluence-Seite „Bildverzeichnis / eigene Abbildungen“ (`2064410`) ist
derzeit leer: sie trägt nur ihren Beschreibungssatz. Sie wird beim Abschluss
jedes Kapitels gefüllt, mit Nummer, Titel, Herkunft und Dateiname. Aus ihr
entsteht am Ende das Abbildungsverzeichnis der Arbeit.

### Bild an eine Kapitelseite hängen

Der Anhang muss an derselben Seite hängen, auf der das Bild erscheint.
Dateinamen klein, ohne Umlaute und Leerzeichen, nach dem Muster
`abb-<kapitel>-<nr>-<kurzwort>`:

```bash
py .claude/skills/thesis-schreiben/thesis.py attach abb-4-7-projektliste.png --page 51740676 --message "Abbildung 4.7"
```

Der Befehl legt den Anhang an oder ersetzt ihn, wenn der Dateiname schon
vergeben ist, und nennt danach die Zeile für den Kapiteltext. Erst danach wird
`storage` neu erzeugt und die Seite gespeichert; ein Bildverweis auf einen
Anhang, den es nicht gibt, erscheint in Confluence als leerer Rahmen.

## Nach Confluence übertragen

```bash
S=.claude/skills
py $S/thesis-schreiben/thesis.py storage .thesis-cache/kapitel-01.md
py $S/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache pull --force
py $S/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache set-body --file .thesis-cache/kapitel-01.xhtml
py $S/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache check --shrink-limit 100000
py $S/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache diff --plain
py $S/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache push --message "Kapitel 1 neu geschrieben"
py $S/api-contract-sync/contract.py --page 34504705 --cache .thesis-cache verify
```

Drei Punkte, an denen es sonst schiefgeht:

- `check` schlägt ohne `--shrink-limit` fehl, weil der Ersatz eines Kapitels
  fast immer erst einmal Zeichen kostet. Der Wert wird bewusst gesetzt und der
  `diff` danach gelesen, nicht überflogen.
- `pull --force` verwirft eine lokale Arbeitskopie. Vor dem Ziehen prüfen, ob in
  `.thesis-cache/<id>/working.xhtml` noch ungespeicherter Text liegt.
- `contract.py` sucht auf jeder Seite die Contract-Versionstabelle und schreibt
  auf einer Kapitelseite `FEHLER: Abschnitt 10 nicht gefunden` nach stderr. Das
  ist kein Fehler des Vorgangs; der Befehl zeigt sein eigenes Ergebnis daneben.

Der Versionskommentar nennt Kapitel und Anlass. Das Format mit Versionsnummer
und Ticketschlüssel gilt allein für die Contract-Seite und hier nicht.

## Definition of Done je Kapitel

- Alle Abschnitte der Gliederung sind vorhanden und in der Reihenfolge des
  Exposés; jede Abweichung ist auf der Gliederungsseite als bewusste Abweichung
  vermerkt.
- `thesis.py lint` meldet keinen Befund; jeder `PRUEFEN`-Punkt ist beantwortet,
  besonders die Punkte der Art `related-work`.
- `thesis.py umfang` liegt im Korridor, und kein Abschnitt trägt mehr als das
  Doppelte seines Anteils.
- Jede Aussage über das System ist im Repository, im Contract oder auf einer
  Materialseite belegt; jede Aussage aus der Literatur trägt eine Quelle aus der
  Literaturübersicht, die im Kapitel mit dem eigenen Projekt verbunden ist.
- Die Kapitel 1 bis 7 schließen ohne eigene Zusammenfassung; Kapitel 8.1
  beantwortet jede Teilfrage und die Forschungsfrage ausdrücklich.
- Jede Abbildung ist angekündigt und ausgewertet, trägt Nummer, Titel und
  Herkunft, hängt als Anhang an derselben Seite und steht im Bildverzeichnis
  (`2064410`).
- Offene Platzhalter und offene Bildstellen sind gezählt und benannt.
- Die Seite ist gespeichert, `verify` ist gelaufen, die Statusseite `34471937`
  ist fortgeschrieben.
- Der Abschlussbericht nennt die getroffenen Entscheidungen mit Begründung und
  keine offenen Fragen (`CLAUDE.md`, „Fragen vor der Umsetzung“).

## Definition of Done für die gesamte Arbeit

Diese Punkte werden nicht je Kapitel geprüft, sondern vor der Abgabe am
08.10.2026. Sie stehen hier, weil zwei davon zum Nichtbestehen führen können.

- **Eigenständigkeitserklärung liegt bei.** Fehlt sie, gilt die Thesis als nicht
  bestanden.
- **Abbildungsverzeichnis liegt bei**, aus dem Bildverzeichnis (`2064410`)
  erzeugt, mit Referenz je fremder Abbildung und dem Hinweis „eigene
  Darstellung“ bei selbst erstellten.
- Literaturverzeichnis nach APA 7, vollständig und deckungsgleich mit den im
  Text verwendeten Belegen.
- Abkürzungsverzeichnis und Anhang liegen bei.
- Abschnitt 1.4 (Aufbau der Arbeit) ist geschrieben; er entsteht zuletzt.
- Jedes Kapitel ist durch eine Rechtschreibprüfung gelaufen und von einem
  Menschen gelesen worden.
- `thesis.py korridore` ist grün, und der Gesamtumfang liegt im Ziel. Ausnahme
  seit dem 26.09.2026: Mit dem angehobenen Korridor von Kapitel 8 liegt die
  Summe der Korridore bewusst über dem Seitenziel (Kopf von `thesis.py`); dann
  zählt allein der gemessene Gesamtumfang.
