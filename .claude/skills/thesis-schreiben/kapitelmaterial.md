# Material je Kapitel

Nachschlagewerk zum Skill `thesis-schreiben`. Für das Kapitel, das gerade
geschrieben wird, wird die zugehörige Zeile abgearbeitet, bevor der erste Satz
entsteht. Alle Nummern sind Confluence-Seiten-IDs im Space BEH und werden mit
`contract.py --page <id> --cache .thesis-cache pull` gelesen.

Stand der Erhebung: 31.08.2026, geprüft gegen Repository, Jira und Confluence.

## Viele Seiten sind Platzhalter, und das steht hier dabei

Der Space stammt in Teilen aus der Planungsphase. Etliche Seiten tragen nur
ihren Beschreibungssatz oder gar nichts. Wer sie für Materialquellen hält, sucht
dort vergeblich und schreibt am Ende doch aus dem Gedächtnis. Deshalb ist bei
jeder genannten Seite vermerkt, was sie tatsächlich trägt. Drei Fälle kommen
vor: Text (brauchbar), Diagramm oder Einbettung (brauchbar als Bildquelle, nicht
als Textquelle), Platzhalter (unbrauchbar, aber als Ablageort für eigene
Ergebnisse vorgesehen).

## Vorspann und Anhang

Der Vorspann besteht aus Eigenständigkeitserklärung und Zusammenfassung
(Abstract), der Anhang aus Literaturverzeichnis, Abbildungsverzeichnis und
Abkürzungsverzeichnis. Der Abstract wird zuletzt geschrieben, wenn Kapitel 8
steht. Die Eigenständigkeitserklärung ist blockierend: fehlt sie bei der Abgabe,
gilt die Thesis als nicht bestanden.

Grundlage für die Formalia ist die Seite Eckdaten (`2129939`, Text): Titel der
Arbeit, Studiengang Internationaler Studiengang Medieninformatik (B. Sc.), die
Bearbeitenden Omar Ziyada und Mohamad Alaskari mit Matrikelnummern, Erstprüfer
Prof. Andreas Teufel, Zweitprüfer Jendrik Bulk, Starttermin 06.08.2026,
Bearbeitungsdauer neun Wochen, geplante Abgabe 08.10.2026, Kolloquium 30
Minuten.

Das Abbildungsverzeichnis entsteht aus der Seite Bildverzeichnis / eigene
Abbildungen (`2064410`). Sie ist derzeit ein Platzhalter mit einem einzigen
Satz und wird beim Abschluss jedes Kapitels gefüllt.

## Kapitel 1: Einleitung

Seite `34504705`, Korridor 1550 bis 1800 Wörter, Register: ohne System.
Abschnitte nach Exposé: 1.1 Problemfeld, 1.2 Ziele der Arbeit, 1.3
Lösungsansatz, 1.4 Aufbau der Arbeit.

Material: Forschungsfrage & Ziele (`2424870`, Text), Gliederung (`2949121`,
Text), Eckdaten (`2129939`, Text), Lorenzo & Ittelson (`2195457`, Text),
Mahasneh (`131089`, Text).

Nicht brauchbar, obwohl es der Titel nahelegt: die Seite Exposé (aktuelle
Version + Versionen) (`819202`) enthält den Exposétext nicht, sondern nur einen
Verweissatz. Wer das Exposé wörtlich braucht, nimmt `2949121` für den Aufbau und
`2424870` für Forschungsfrage und Teilfragen. Ebenfalls Platzhalter: Übersicht &
Projektsteckbrief (`2293769`) ist vollständig leer.

Besonderheiten: Forschungsfrage und die drei Teilfragen stehen in 1.2 wörtlich
wie auf `2424870`. Abschnitt 1.4 wird zuletzt geschrieben, wenn die
Kapitelstruktur endgültig ist; bis dahin bleibt dort ein benannter Platzhalter.
Die vier Akteurgruppen werden hier eingeführt, mit dem Hinweis, dass drei davon
kontogebunden sind und die externen Nutzenden der Zustand „nicht angemeldet“
und zugleich die Hauptzielgruppe sind. Lorenzo & Ittelson und Mahasneh stehen
hier nur als Kurzform und werden in Kapitel 3 ausgeführt; beide müssen schon in
1.1 an das eigene Vorhaben angebunden werden, sonst stehen sie unverbunden da.

## Kapitel 2: Anforderungsanalyse

Seite `34701325`, Korridor 2700 bis 3200 Wörter, Register: Akteure und Bedarfe,
keine Technik. Trägt zusammen mit Kapitel 3 die Antwort auf TF 1, beantwortet
wird sie in 2.6.

Das Exposé nennt nur 2.1 Funktionale Anforderungen, 2.2 Nicht-funktionale
Anforderungen und 2.3 Zusammenfassung. Der Entwurf gliedert in 2.1 Stakeholder
und Zielgruppen, 2.2 Methodisches Vorgehen, 2.3 Funktionale Anforderungen, 2.4
Nicht-funktionale Anforderungen, 2.5 User Stories und Use Cases, 2.6
Zusammenfassung. Diese Erweiterung ist auf der Gliederungsseite als bewusste
Abweichung vermerkt und mit den Prüfern zu bestätigen. Sie wird beibehalten, und
zwar auch deshalb, weil der Zweitprüfer die ausdrückliche Nennung der
wissenschaftlichen Methode verlangt: 2.2 ist ihr Ort für die
Anforderungserhebung.

Material: Anforderungsanalyse (`1114113`, Text), Stakeholder & Zielgruppen
(`1409042`, Text), Funktionale Anforderungen (`884747`, Text),
Nicht-funktionale Anforderungen (`1474569`, Text), User Stories / Use Cases
(`65752`, Text), Glossar / Begriffe (`851993`, Text), Informationsarchitektur
(`1441819`, wenig Text, trägt zwei Diagramme als Anhänge), Fakultäten Hierarchie
(`34439171`, leer, aber mit fünf Unterseiten je Fakultät, die den Inhalt
tragen).

Offen: Die FA-IDs (FA-01 bis FA-43) sind im Fließtext noch nicht referenziert.
Dafür muss zuerst die Seite `884747` aktualisiert werden; sie führt noch vier
Rollen, FA-34 als offene Frage und FA-31 mit direkter Veröffentlichung. Ebenso
offen für die Prüfer: dass die Mitarbeitendendomain unmittelbar
Redaktionsrechte ergibt.

## Kapitel 3: Grundlagen und verwandte Arbeiten

Seite `34373645`, Korridor 3150 bis 3800 Wörter, Register: reine Literatur, kein
Bezug auf die eigene Umsetzung. Beantwortet TF 1 in 3.5 und legt in 3.3 die
Kriterien für TF 2.

Abschnitte: 3.1 E-Portfolio: Begriffe und Kategorien, 3.2
Technologieakzeptanzmodell (TAM), 3.3 Usability und Gestaltungsprinzipien, 3.4
Verwandte Arbeiten und Referenzplattformen, 3.5 Zusammenfassung. Das Exposé
kennt 3.5 nicht; der Abschnitt ist eine additive Abweichung und mit den Prüfern
zu bestätigen.

Dieses Kapitel trägt die Hauptlast der Forderung des Zweitprüfers. Related Work
steht hier nicht als Referat fremden Wissens, sondern als Herleitung: je Quelle
ein Satz, warum sie für diese Arbeit relevant ist, und ein späterer Ort, an dem
sie wieder aufgegriffen wird. 3.4 ist der Ort, an dem die Referenzplattform der
HfG Schwäbisch Gmünd zum Vergleichsmaßstab wird, nicht zur Anekdote.

Material mit Text: Lorenzo & Ittelson (`2195457`), Mahasneh (`131089`), Davis
1989 TAM (`851985`), Shroff et al. 2011 (`1802257`), Nielsen & Molich 1990
(`5570572`), Nielsen 1994 (`12877896`), Nielsen 2024 (`13303846`), Brooke 1996
(`8978451`), W3C WCAG 2.2 Kontrast (`33423361`), Van den Bosch 2005 / McKenney
2020 (`32210974`), HfG Schwäbisch Gmünd Heuristische Analyse (`950275`),
Verwandte Arbeiten / Benchmark (`2293761`).

Platzhalter ohne Inhalt, trotz vielversprechender Titel: Methodik (Heuristik
nach Nielsen + TAM) (`1703980`) trägt einen einzigen Satz, Kriterienkatalog
(`2424862`) ebenfalls, Ergebnisse (`262160`) ebenfalls. Sie sind Ablageorte,
keine Materialquellen. Der Bewertungsrahmen wird aus den Primärquellen
hergeleitet, nicht von diesen Seiten abgeschrieben.

Besonderheit: Die heuristische Analyse der Referenzplattform ist eigene
Vorarbeit, keine Literatur, und wird als solche gekennzeichnet.

## Kapitel 4: Konzeption

Seite `51740676`, Korridor 3500 bis 4200 Wörter, Register: Entwurf auf
Konzeptebene. Konzipiert TF 3 in 4.3 und 4.4 und beantwortet sie in 4.7; liefert
in 4.5 den gestalterischen Teil von TF 2.

Abschnitte: 4.1 Systemarchitektur, 4.2 Benutzerrollen und Rechtemodell, 4.3
Blockbasiertes Inhaltsmodell, 4.4 Workflow- und Statussystem, 4.5 Design des
User Interfaces (Figma-Prototyp), 4.6 Datenbankmodell, 4.7 Zusammenfassung.

Material mit Text: Datenmodell & API-Contract (`36732929`, Abschnitte 2 bis 7),
Datenmodell (`131097`), Architekturübersicht (`1474585`), Designentscheidungen
(`950283`), Foundation (`27885570`), Components (`28180481`), Token-Verwendung
(`51052545`), Template-Abdeckung (`53739521`).

Nur Bild oder Einbettung, kein Text: die fünf Flow-Seiten Projekt einreichen
(`32866305`), Review & Freigabe (`32997377`), Projekt finden (`31784976`),
Statusänderung in der Administrationsseite (`31555587`) und Änderungswunsch
bearbeiten (`32866321`) tragen null Zeichen Fließtext, aber je ein Diagramm als
Anhang. Sie taugen als Bildquelle und als Beleg für den entworfenen Ablauf,
nicht als Textquelle. Figma-Prototype (Embed) (`917511`) trägt einen
Beschreibungssatz und eine Einbettung. Leer ist Designsystem (`27820033`); die
Inhalte liegen auf Foundation und Components.

Material aus dem Repository: `docs/ARCHITEKTUR.md` (Paketbaum, Security-Ablauf,
Tabelle „Wo kommt was hin“), `docs/NAMENSSCHEMA.md`, die Flyway-Migrationen
unter `backend/src/main/resources/db/migration/` für 4.6.

Bildmaterial: Figma-Datei `o6SECXRMKGOzCfG5xZebPV`, Seite `Template` (`4:611`),
frameweise über `get_screenshot`; die Frame-ID je Template steht auf
`53739521`. Miro-Board `uXjVHJa5VEY=` für den Prozessabschnitt in 4.5. Zwölf
Abbildungen: fünf Konzeptdiagramme (Systemarchitektur, Rollen- und
Rechtemodell, Blockmodell, Zustandsautomat, Datenmodell), drei Figma-Screens und
vier Prozessabbildungen. Keine Screenshots der laufenden Anwendung: die gehören
nach Kapitel 5.

Offen: drei markierte Punkte auf der Kapitelseite. Erstens Admin-Editorzugriff
und Vier-Augen-Prinzip für Admin (Contract, Abschnitt 7) in 4.2. Zweitens die
Wertequelle der Facettengruppe Semester in 4.5. Drittens, ebenfalls in 4.5, der
Zeilenabstand der Überschriftenstile Heading/H1 und Heading/H2, der fehlende
gestaltete Wert von Numeral/Rank und die Mobile-Zeilenhöhe von Heading/Display
(Foundation 5.3). Die Zusammenfassung 4.7 der Seite selbst spricht von „zwei
markierten Punkten“ vor einer dreigliedrigen Aufzählung; das ist ein Fehler der
Seite und wird beim Neuschreiben behoben.

## Kapitel 5: Realisierung

Seite `51642372`, Korridor 2850 bis 3450 Wörter, Register: Technik ist hier der
Gegenstand. Erprobt TF 3 und beantwortet sie in 5.4.

Abschnitte: 5.1 Wahl der Realisierungsplattform, 5.2 Ausgewählte
Realisierungsaspekte, 5.3 Qualitätssicherung, 5.4 Zusammenfassung.

Der Kapiteltitel im Exposé lautet „Realisierung“, die Confluence-Seite heißt
„Prototypische Realisierung“. Verbindlich ist das Exposé; die Abweichung im
Seitentitel bleibt bestehen und ist kein Inhaltsfehler. Der vorhandene
Teilentwurf nennt im Kopf den Umsetzungsstand vom 08.08.2026 und ist damit
überholt: seither sind unter anderem KAN-40 bis KAN-96 hinzugekommen.

Material aus Confluence: Tech-Stack & Begründung (`1474577`, Text),
Realisierungstagebuch (`2424854`, Text), Architekturübersicht (`1474585`, Text),
Datenmodell (`131097`, Text), Realisierung (`1146889`, Text), Setup /
Repository-Link (`917519`, Text), Barrierefreiheit Prüfprotokoll KAN-42
(`69664779`, Text), Template-Abdeckung (`53739521`, Text).

Ein belegbarer Realisierungsaspekt für 5.2 steht auf `53739521`: „Hilfe &
Dokumentation“ ist das 27. Template und das erste ohne Figma-Frame. Der Entwurf
hat die Seite nicht vorgesehen, gebaut wurde sie in der Formensprache der
bestehenden Textseiten, und die Confluence-Vorlage ist nachgezogen statt
vorweggenommen. Das ist ein Fall, in dem die Umsetzung dem Entwurf vorausging,
und als solcher interessanter als ein weiteres gelungenes Modul.

Bildmaterial: 24 Aufnahmen der laufenden Anwendung in
`frontend/src/assets/help/`, 2560 mal 1600 Bildpunkte, erzeugt mit
`pnpm screenshots` gegen den Dev-Stack (Konfiguration
`frontend/playwright.screenshots.config.ts`, Fälle in
`frontend/e2e/screenshots.spec.ts`). Sieben davon kommen in Kapitel 5.

Material aus dem Repository: der Code selbst unter `backend/` und `frontend/`,
`docs/ARCHITEKTUR.md`, `docs/SETUP.md`, die Migrationen, die Testklassen. Der
Code ist eingefroren; der Stand des ausgecheckten Branches ist der Stand, über
den geschrieben wird. Aussagen über Module, Endpoints und Fehlercodes werden am
Code und am Contract geprüft, nicht aus Tickets übernommen.

## Kapitel 6: Test

Seite `51642395`, derzeit leer (29 Zeichen), Korridor 2700 bis 3300 Wörter,
Register: Methodik und Rohdaten, keine Bewertung. Erhebt den empirischen Teil
von TF 2; die Bewertung folgt in 7.2.

Abschnitte: 6.1 Testkonzept und Methodik, 6.2 Testdesign (Teilnehmende,
Aufgaben, Ablauf), 6.3 Durchführung des Usability-Tests, 6.4 Zusammenfassung.

Grundlage ist der ausgearbeitete Testplan vom 29.08.2026 (zweite Fassung),
lokal unter `Downloads/اختبار قابلية الاستخدام E-Portfolio HSB_files/saved_resource.html`.
Er ist auf Arabisch verfasst; für die Thesis entsteht daraus deutscher
Fließtext, keine Übersetzung Satz für Satz. Er ist die einzige Stelle, an der
Methodik, Aufgaben und Zeitplan zusammen stehen.

Das Testdesign in Zahlen: drei Methoden im Verbund, elf moderierte
Thinking-Aloud-Sitzungen zu je 80 Minuten, elf SUS-Bögen mit zehn Items, zwei
Evaluierende mit je drei Durchgängen für die heuristische Evaluation, 23
vollständig ausformulierte Aufgaben in vier Blöcken (A öffentlich ohne
Anmeldung, B Studierende, C Redaktion, D Administration), Testwoche über fünf
Tage, SUS-Zielwert mindestens 68.

Die Reihenfolge ist begründet und gehört so in 6.1: Die heuristische Evaluation
läuft vor dem Nutzertest (Tag 1), Befunde ab Schweregrad 3 werden am Vormittag
von Tag 2 behoben, danach wird die getestete Fassung eingefroren, am Nachmittag
von Tag 2 läuft der Pilottest mit einer Person, an den Tagen 3 bis 5 die elf
Sitzungen mit höchstens vier je Tag. Der Grund steht im Plan: ein Verstoß gegen
H9, den zwei Personen in zwei Tagen finden, würde sonst elf Sitzungen
verbrennen.

Material aus Confluence: Test (`10223617`) mit den zehn Unterseiten, darunter
Testkonzept & Methodik (`8978441`), Testaufgaben & Szenarien (`12779529`),
Teilnehmer & Rekrutierung (`12877841`), Testdurchführung & Protokolle
(`12910629`), Moderationsleitfaden und Einwilligung (`67698689`), Pilottest
(`68059137`), Glossar & Begriffe der Testphase (`13369391`), dazu die elf
Sitzungsseiten TN01 bis TN11: `68157441`, `67928075`, `68190209`, `68190229`,
`68091915`, `68059158`, `67764246`, `68222977`, `67731468`, `68288513`,
`68321281`. Die Sitzungsseiten sind am 27.08.2026 als Vorlagen angelegt und
noch nicht ausgefüllt: der Test ist geplant, nicht durchgeführt. Abschnitt 6.3
kann erst nach der Testwoche geschrieben werden.

Methodische Quellen laut Testplan: Brooke (1996), Bangor, Kortum und Miller
(2008), Davis (1989), Nielsen und Landauer (1993), Nielsen und Molich (1990),
Nielsen (1994), Nielsen (2000), Nielsen (2024), Sauro (2011), Shroff, Deneen
und Ng (2011). Vier davon fehlen in der Literaturübersicht (`2097153`, elf
Einträge) und müssen dort eingetragen werden, bevor sie im Kapiteltext
auftauchen: Bangor, Kortum und Miller (2008), Nielsen und Landauer (1993),
Nielsen (2000) und Sauro (2011). Der Linter meldet sie bis dahin als noch nicht
geführt.

Eine Richtigstellung aus dem Testplan gehört in 6.1: Die Methode der
heuristischen Evaluation stammt von Nielsen und Molich (1990), die Liste H1 bis
H10 dagegen von Nielsen (1994), gültig in der von der Nielsen Norman Group
gepflegten und im Januar 2024 aktualisierten Fassung. Wer beides derselben
Quelle zuschreibt, zitiert falsch.

Fünf Punkte sind noch nicht entschieden (Nummern 9 bis 13 im Testplan) und
müssen vor der Durchführung geklärt sein: ob H10 aufgenommen oder der Anspruch
auf alle zehn Heuristiken zurückgezogen wird, wie lange die externe Sitzung
tatsächlich dauert, ob „mit Mühe gelöst“ in die Erfolgsquote eingeht, ob die
Blockdauern korrigiert oder die Übergangszeiten ausgewiesen werden, und ob
Block D vor dem Testtag trocken geprobt wird.

## Kapitel 7: Evaluation

Seite `51642418`, derzeit leer (29 Zeichen), Korridor 3500 bis 4250 Wörter,
Register: Bewertung, keine neue Systembeschreibung. Beantwortet TF 2 in 7.2.

Abschnitte: 7.1 Bewertungsrahmen auf Basis der Forschungsliteratur, 7.2
Bewertung der Testergebnisse, 7.3 Überprüfung funktionaler Anforderungen, 7.4
Überprüfung nicht-funktionaler Anforderungen, 7.5 Zusammenfassung.

Dieses Kapitel ist zusammen mit 6.3 der Kern der Arbeit im Sinne des
Zweitprüfers. Die Ergebnisse werden umfassend und vollständig dargestellt, nicht
zusammengefasst. Deshalb trägt es den zweitgrößten Korridor.

Die Grenze zwischen Kapitel 6 und 7 ist im Testplan scharf gezogen und wird
eingehalten: Kapitel 6 zeigt Rohdaten deskriptiv, ohne Bewertung und ohne
Abgleich mit den Anforderungen. Erst Kapitel 7 ordnet ein, vergleicht mit der
Referenzplattform und beantwortet TF 2. Ein Werturteil in 6.3 ist ein Befund.

Je Methode ein Datentyp: aus dem Thinking-Aloud kommen Usability-Probleme je
Aufgabe samt gehörter Ursache, aus dem SUS je Person ein Wert zwischen 0 und 100
nebst Mittelwert, Median und Spannweite, aus der heuristischen Evaluation
Befunde je Heuristik H1 bis H10 mit Schweregrad 1 bis 4. Der SUS-Wert ist keine
Prozentangabe; 72 heißt nicht „72 Prozent Zufriedenheit“. Expertenbefunde und
Nutzerbefunde werden nicht in einer Liste vermischt.

Material: Ergebnisse & Erkenntnisse (`12910637`), SUS-Auswertung (`13369345`),
Heuristische Evaluation (`67764225`), Funktionale Anforderungen (`884747`),
Nicht-funktionale Anforderungen (`1474569`), Von der Analyse zur Entscheidung
(`58621985`), HfG Schwäbisch Gmünd Heuristische Analyse (`950275`) für den
Vergleich mit der Referenzplattform. Nicht brauchbar sind die Platzhalterseiten
Kriterienkatalog (`2424862`) und Methodik Heuristik und TAM (`1703980`); der
Bewertungsrahmen wird aus den Primärquellen hergeleitet.

Der Bewertungsrahmen in 7.1 stützt sich auf die TAM-Konstrukte Perceived
Usefulness und Perceived Ease of Use nach Davis (1989), auf die von Mahasneh
(2020) ermittelten Komponenten eines universitären E-Portfolios und auf die
Heuristiken nach Nielsen. Für 7.3 und 7.4 wird jede Anforderung einzeln gegen
den Systemstand geprüft; ein Abgleich ohne Beleg im Code ist wertlos.

## Kapitel 8: Zusammenfassung und Ausblick

Seite `58097676`, Korridor 1150 bis 1400 Wörter, Register: ohne Technik.
Beantwortet in 8.1 die übergeordnete Forschungsfrage, indem die drei
Teilantworten aus 2.6, 3.5, 4.7, 5.4 und 7.2 zusammengeführt werden.

Abschnitte: 8.1 Zusammenfassung, 8.2 Ausblick. Der Entwurf enthält bereits
Teilantworten auf TF 1 und TF 3 und den Ausblick; die Teilantwort auf TF 2 und
die Gesamtantwort warten auf Kapitel 7.2.

Der Abschnitt „Grenzen der Arbeit“ existiert bereits als dritte
Überschriftenebene am Ende von 8.1, vor 8.2 Ausblick, mit einem benannten
Platzhalter, der vier Grenzen nennt: Stichprobengröße des Usability-Tests, die
nur nicht authentifizierte Perspektive der heuristischen Analyse der
Referenzplattform (vgl. Kapitel 3.4), die Beschränkung auf eine einzelne
Referenzplattform und den Prototypcharakter des Systems, das nicht unter realen
Betriebsbedingungen mit echtem Inhaltsbestand erprobt wurde. Er wird
ausformuliert, nicht neu erfunden, und hängt anders als die Teilantwort auf TF 2
nicht an Kapitel 7.2: die vier Grenzen speisen sich aus den Kapiteln 3.4 und 6
und aus dem Systemstand. Die Statusseite `34471937` behauptet, der Abschnitt
„folge danach“; das ist einer ihrer überholten Punkte.

Material: Forschungsfrage & Ziele (`2424870`), die fertigen
Kapitelzusammenfassungen, Offene Fragen an Prüfer (`1802249`), Zeitplan &
Meilensteine (`1441796`).

## Projektstand: was vor jedem Kapitel neu geholt wird

Drei Angaben veralten schneller, als eine Datei nachgezogen wird, und werden
deshalb hier bewusst nicht festgeschrieben, sondern vor jedem Kapitel geholt:

- **Contract-Version**: `py .claude/skills/api-contract-sync/contract.py --page 36732929 --cache .thesis-cache pull`.
  Sie ist inzwischen zweistellig weit fortgeschritten; jede in einem Dokument
  festgehaltene Nummer war nach wenigen Tagen falsch.
- **Ticketstand**: über Jira, Projekt KAN. Stand 31.08.2026 ist **kein Vorgang
  mehr offen**; KAN-93, KAN-94, KAN-95 und KAN-96 sind auf `main` gemergt. Eine
  frühere Fassung dieser Datei behauptete, KAN-94 und KAN-95 würden nicht mehr
  umgesetzt. Das war falsch.
- **Systemstand**: über das Repository. Der ausgecheckte Branch ist `main` und
  gleichauf mit `origin/main`.

Die Statusseite `34471937` ist keine dieser Quellen. Sie nennt eine längst
überholte Contract-Version, führt erledigte Tickets als offen und beschreibt
Kapitel 8 falsch. Sie wird gelesen, um zu sehen, was jemand einmal gedacht hat,
und nach jedem fertigen Kapitel fortgeschrieben.

Fachlich offen bleiben: Abstimmung der Kapitel 1 bis 8 mit Prof. Teufel und
J. Bulk, die Abweichung „vier Akteurgruppen, drei kontogebundene Rollen“
gegenüber dem Exposé, die beiden Gliederungsabweichungen in Kapitel 2 und 3, die
Referenz der FA-IDs in 2.3, die drei markierten Punkte auf der Seite zu
Kapitel 4, die fünf Entscheidungen 9 bis 13 aus dem Testplan und die vier
Quellen der Testphase, die noch in die Literaturübersicht müssen.
