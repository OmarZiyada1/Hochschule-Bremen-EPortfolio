---
name: api-contract-sync
description: Abgleich zwischen Backend-Code und der Confluence-Seite „Datenmodell & API-Contract" (Seiten-ID 36732929) für das E-Portfolio Hochschule Bremen. Verwenden, wenn eine Abweichung auffällt, ein neuer Fehlercode/Endpoint entsteht oder ein Modul abgeschlossen wird. Claude veröffentlicht die neue Contract-Version selbst über `contract.py` und zieht alle Fundstellen der Versionsnummer selbst nach.
---

# Code ↔ API-Contract synchron halten

Der Contract (Space BEH, Seiten-ID `36732929`) ist die verbindliche gemeinsame
Grundlage von Backend und Frontend. Er ist nur dann etwas wert, wenn er stimmt;
deshalb wird **jede** Abweichung behandelt, keine still hingenommen.

Die geltende Versionsnummer steht nirgends in diesem Skill, sondern wird
ermittelt:

```bash
python .claude/skills/api-contract-sync/contract.py pull
```

Maßgeblich ist die letzte Zeile der Tabelle in §10 („Änderungshistorie
(fachlich)"), nicht die Seitenversion von Confluence. Die beiden laufen
auseinander, sobald jemand die Seite ohne fachliche Änderung speichert.

`contract.py` spricht die REST-API aus `.env.atlassian` an und läuft deshalb
auch dann, wenn der Atlassian-Konnektor tot ist. Die Nachführung braucht ihn
trotzdem: Jira-Beschreibungen und das Veröffentlichungsprotokoll laufen über
`mcp__claude_ai_Atlassian_Rovo__*`. Deshalb wird vor der Veröffentlichung
einer neuen Contract-Version der Konnektor geprüft
(`mcp__claude_ai_Atlassian_Rovo__atlassianUserInfo`, erwartet: ein Konto mit
`account_status: active`), und das Ergebnis genannt. Antwortet er nicht, wird
die Contract-Seite **nicht** halb veröffentlicht: erst anhalten und bitten,
den Konnektor auf claude.ai neu zu verbinden und die IDE neu zu starten,
danach laufen Veröffentlichung und Nachführung in einem Zug (`CLAUDE.md`,
Abschnitt „Konnektoren prüfen, bevor ein Ticket beginnt").

## Claude veröffentlicht selbst

Diese Arbeit wird **nicht** an Omar zurückgegeben. Weder der Seitentext noch
eine Versionsnummer wird bei ihm angefordert. Claude zieht die Seite, ändert
sie, speichert sie und zieht danach alle Fundstellen im Repo und in Jira nach.

Der Grund für die frühere Rückgabe ist behoben: Die Seite hat rund 270.000
Zeichen Storage-Format. Das MCP-Werkzeug `updateConfluencePage` verlangt den
gesamten Seiteninhalt als Aufrufparameter, also müsste der komplette Text durch
das Kontextfenster laufen, was scheitert. **Für diese Seite wird das
MCP-Werkzeug deshalb nicht mehr benutzt.** Stattdessen läuft der große Text
ausschließlich über die Platte, und Claude sieht nur den Abschnitt, den es
tatsächlich bearbeitet.

Ausgenommen bleibt allein die inhaltliche Frage: Ist fachlich unklar, *was*
gelten soll (Berechtigung, Statusübergang, Feldsemantik), wird nach der Regel
„Fragen vor der Umsetzung" in `CLAUDE.md` **vorher** gefragt. Gefragt wird nach
der Entscheidung, nie nach dem Handgriff.

## Entscheidungsbaum bei einer Abweichung

1. **Code ist falsch, Contract richtig** (Regelfall): Code anpassen.
2. **Contract ist lückenhaft oder überholt**: Contract in einer neuen Version
   ergänzen (siehe unten), erst dann den Code bauen.
3. **Fachlich unklar** (z. B. Berechtigungsfrage): **zuerst fragen**, nicht
   annehmen. Die Frage mit Optionen über `AskUserQuestion` vorlegen, bevor Code
   oder Contract-Text entsteht. Die Antwort wird zur Contract-Ergänzung.
   Vertagt Omar die Entscheidung ausdrücklich, erst dann der bisherige Weg:
   offener Punkt in §7 des Contracts und auf der Seite „Offene Fragen"
   (ID `1802249`), Default-Annahme dokumentieren, konfigurierbar umsetzen
   (Vorbild `app.berechtigung.*`).

Die Wahl zwischen Zweig 1 und Zweig 2 ist selbst entscheidungsrelevant, sobald
beide vertretbar sind: dann gehört sie in die Klärungsrunde, denn „Code
anpassen" und „Contract erhöhen" führen zu völlig verschiedenen Ergebnissen.

## Das Werkzeug `contract.py`

Zugangsdaten liest es aus `.env.atlassian` im Wurzelverzeichnis
(`ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`; Erläuterung in
`.env.example`). Nur Standardbibliothek, keine neue Abhängigkeit. Die
Arbeitskopie liegt unter `.contract-cache/<seiten-id>/` und ist von `.gitignore`
erfasst: `remote.xhtml` ist die gezogene Fassung und wird nie angefasst,
`working.xhtml` ist die bearbeitete.

Alle Aufrufe aus dem Wurzelverzeichnis, `PY=python .claude/skills/api-contract-sync/contract.py`:

| Befehl | Zweck |
|--------|-------|
| `$PY pull` | Seite holen, Arbeitskopie anlegen, Contract-Version melden |
| `$PY status` | Steht eine Arbeitskopie? Ist sie geändert? |
| `$PY outline --depth 2` | Überschriften mit Größe und Offset |
| `$PY show 6.2` | **nur diesen Abschnitt** ausgeben (`--plain` ohne Tags, `--full` ungekürzt) |
| `$PY find "PROJECT_[A-Z_]+" --plain` | Suche mit Abschnittsangabe je Treffer |
| `$PY replace --old-file a.xhtml --new-file b.xhtml` | eindeutige Stelle ersetzen, bricht ab, wenn nicht genau einmal gefunden |
| `$PY set-section 6.2 --file neu.xhtml` | ganzen Abschnitt ersetzen (für größere Umbauten) |
| `$PY history-add --version v24 --sections "&sect;6.1, &sect;6.2" --text-file grund.xhtml` | Zeile ans Ende der Tabelle in §10 |
| `$PY check` | Wohlgeformtheit, unbekannte Entities, neue Gedankenstriche, Schrumpfung |
| `$PY diff --plain` | Arbeitskopie gegen die gezogene Fassung |
| `$PY push --message "v24: … (KAN-42)"` | speichern, mit `--dry-run` erst probelaufen |
| `$PY verify` | nach dem Speichern gegen die Online-Fassung prüfen |

`--page 1802249` richtet dieselben Befehle auf die Seite „Offene Fragen".

**Storage-Format beim Ersetzen.** Die Seite enthält HTML-Entities, nicht die
Zeichen selbst: `&auml;` `&ouml;` `&uuml;` `&szlig;` `&sect;` `&bdquo;`
`&quot;` `&rarr;` `&middot;`. Ein `replace` mit „§6.2" findet deshalb nichts,
eines mit `&sect;6.2` schon. Suchtexte immer aus der Ausgabe von `show` oder
`find` übernehmen, nie von Hand tippen. `check` fängt die Fälle ab, in denen
dabei etwas kaputtgeht, aber es fängt nicht ab, dass an der falschen Stelle
ersetzt wurde: dafür ist `diff` da.

## Contract-Version erhöhen: der Ablauf

1. `pull`. Die gemeldete Contract-Version ist die alte Nummer, die neue ist die
   nächste ganze Zahl.
2. Mit `outline`, `show` und `find` **nur die betroffenen §§** lesen. Die ganze
   Seite wird nie geladen; das ist der ganze Zweck des Werkzeugs.
3. Ändern mit `replace` oder `set-section`. **Bestehenden Inhalt nie löschen
   oder umformulieren**, nur ergänzen und präzisieren; Widersprüche über
   Hinweiskästen auflösen (so arbeiten v9 bis v11). `check` bricht ab, wenn die
   Seite kürzer wird, genau dafür.
4. `history-add` für den Eintrag in §10: betroffene §§, was, warum. Im Stil der
   bestehenden Einträge, also mit Begründung und mit dem Ticket, bei dem es
   aufgefallen ist.
5. Neue Absätze ohne Gedankenstrich `—` formulieren (Schreibstil-Regel in
   `CLAUDE.md`); `check` prüft das. Bestehender Seitentext bleibt unangetastet.
6. `check`, dann `diff` lesen, dann `push --message "v<N>: <Kurzfassung> (KAN-<nr>)"`.
   Das Format des Versionskommentars erzwingt `push`.
7. `verify`.
8. Fundstellen der Nummer nachziehen (nächster Abschnitt) und das
   Veröffentlichungsprotokoll ins **auslösende** Jira-Ticket kommentieren.
   Betroffene **andere** Tickets werden nicht kommentiert, sondern refined.

Meldet `push`, die Seite stehe inzwischen auf einer höheren Version, hat jemand
anders gespeichert: `pull`, Änderung erneut setzen, `push`. Nicht `--force`, das
verwirft die fremde Änderung.

## Betroffene Tickets: refinen, nicht kommentieren

Eine neue Contract-Version verschiebt regelmäßig die Grundlage offener Tickets:
ein Endpoint heißt anders, ein Fehlercode kommt hinzu, ein Filter wird
umbenannt. Das ist die häufigste Quelle von „Nachtrag"-Kommentaren, und genau
die entstehen hier **nicht**.

**Bei jedem inhaltlich betroffenen offenen Ticket wird die Beschreibung
geändert** (Skill `ticket-refinement`), nicht ein Kommentar angehängt. Wer das
Ticket zur Umsetzung öffnet, liest oben; ein Nachtrag in Kommentar drei wird
übersehen und gegen den alten Stand gebaut.

Für einen einzelnen ergänzten Satz ist `editJiraIssue` das falsche Werkzeug: es
ersetzt die ganze Beschreibung, also muss sie vollständig durch den Kontext
laufen und die Formatierung wird dabei neu erfunden. Sicherer ist derselbe
Handgriff wie bei Confluence, nämlich chirurgisch auf der Struktur:

```bash
curl -sS -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
  "$ATLASSIAN_BASE_URL/rest/api/3/issue/KAN-33?fields=description" -o issue.json
# Ankertext im ADF suchen, Knoten einfügen, dann:
# PUT /rest/api/3/issue/KAN-33  mit {"fields":{"description": <adf>}}
```

Der Ankertext muss genau einmal vorkommen; das Skript bricht sonst ab. Eine
vollständig neu geschriebene Beschreibung geht dagegen weiter über
`editJiraIssue` mit `contentFormat: markdown`.

| Fall | Was geschieht |
| --- | --- |
| Offenes Ticket, Inhalt betroffen | Beschreibung nachziehen: Umfang, Technische Hinweise, DoD, Bezug-Zeile. Kein Kommentar |
| Offenes Ticket, nur Versionsnummer betroffen | Bezug-Zeile nachziehen. In der Regel entfällt die Nummer dort ganz, weil die §§ stabil sind (Skill `jira-ticket`, Regel 1) |
| Erledigtes Ticket | Nichts ändern. Die Beschreibung beschreibt, wogegen gebaut wurde; der Übergabekommentar hält den Stand fest |
| Auslösendes Ticket | Ein Kommentar mit dem Veröffentlichungsprotokoll (Schritt 8). Verändert die Version zusätzlich seine eigene Umsetzung, gehört **dieser** Teil in die Beschreibung |

Trägt ein betroffenes Ticket bereits einen älteren Nachtrag-Kommentar, wird er
bei dieser Gelegenheit aufgelöst: Inhalt in die Beschreibung, Kommentar-ID zum
Löschen melden. Claude löscht selbst keine Jira-Kommentare, das Werkzeug kann
sie nur anlegen und ändern.

## Versionsnummer nachziehen: alle Fundstellen

Eine erhöhte Contract-Version ist erst fertig, wenn **jede** Stelle, die die
alte Nummer nennt, geprüft und geändert ist. Eine Nummer nur in Confluence zu
erhöhen erzeugt genau den Zustand, den `docs/STAND.md` schon einmal festgehalten
hat („`OpenApiConfig` nennt weiterhin v10, der Contract steht auf v11"), und den
umgekehrten Fall gab es mit v23 auch schon: im Code vergeben, in Confluence nie
veröffentlicht.

### Schritt 1: Fundstellen ermitteln, nicht raten

Im Repo suchen, jedes Mal neu, weil neue Stellen dazukommen:

```bash
grep -rn "Contract v[0-9]\|API-Contract v[0-9]\|version(\"v[0-9]" \
  --include=*.java --include=*.md --include=*.yml --include=*.ts --include=*.tsx \
  backend frontend/src docs .claude *.md
```

Das Frontend gehört ausdrücklich dazu: beim Nachzug auf v43 ist der
Stand-Satz in `frontend/src/api/errors.ts` durchgerutscht, weil die Suche
nur Backend, Doku und Skills umfasste (Befund des contract-pruefers zu
KAN-31).

Bekannte Stellen als Ausgangspunkt, jede einzeln ansehen:

| Ort | Fundstelle | Was steht dort |
|-----|-----------|----------------|
| Code | `backend/src/main/java/de/hsbremen/eportfolio/config/OpenApiConfig.java` | zwei Stellen: `.version("v<N>")` und im `description`-Text „Stand entspricht dem API-Contract v<N>, §6" |
| Code | `backend/src/main/java/de/hsbremen/eportfolio/common/error/ErrorCodes.java` | Javadoc-Kopf „Stand Contract v<N> steht jede Konstante …" |
| Code | weitere Javadoc-/Kommentarsätze mit „v<N>" | nur der **Stand**-Satz wird nachgezogen; historische Sätze („war bis v14 nur hier geführt", „mit v15 nachgetragen", „seit v21 Azure Blob Storage") bleiben unverändert stehen, sie beschreiben die Vergangenheit |
| Doku | `docs/ARCHITEKTUR.md` | nennt bislang keine Versionsnummer, aber §-Verweise: prüfen, ob die Änderung einen §-Verweis oder eine Tabellenzeile verschiebt |
| Doku | `docs/NAMENSSCHEMA.md` | „Grundlage ist der Bestand aus Contract v17": historische Aussage, bleibt stehen. Bringt die neue Version neue Bezeichner, kommt die **Zuordnung** dazu, nicht die Nummer |
| Doku | `README.md` | nennt nur die Seiten-ID `36732929`, keine Version: in der Regel nichts zu tun |
| Doku | `docs/STAND.md` | **nicht anfassen**, veraltet bewusst (`CLAUDE.md`) |
| Skill | dieser Skill | nennt bewusst **keine** Nummer mehr, damit sie hier nicht veralten kann: nichts zu tun |
| Jira | auslösendes Ticket | Abschnitt „Bezug" in der Beschreibung plus Veröffentlichungsprotokoll als Kommentar |
| Jira | offene Tickets mit älterer Nummer, deren Inhalt betroffen ist | Suche: `project = KAN AND statusCategory != Done AND text ~ "API-Contract v"`; nur **inhaltlich betroffene** Tickets nachziehen, nicht pauschal alle Nummern hochzählen. Nachgezogen wird **in der Beschreibung**, nie als Kommentar |
| Confluence | Contract-Seite `36732929` | Änderungshistorie §10 und Versionskommentar beim Speichern |
| Confluence | Seite „Offene Fragen" (ID `1802249`) | mit dieser Version entschiedene Punkte als entschieden markieren, mit Verweis auf v<N>. Über `contract.py --page 1802249` |
| Confluence | weitere Seiten im Space BEH | Suche im Space nach `text ~ "API-Contract v"`; jede Trefferseite kurz prüfen |

### Schritt 2: Fundstellen melden, nachdem sie geändert wurden

Diesen Block immer ausgeben, damit Omar Stelle für Stelle sieht, welche Nummer
wo gewechselt hat. Keine Sammelaussage wie „Versionsnummern aktualisiert". Es
ist ein Protokoll des Geschehenen, keine Bitte um Erledigung:

```markdown
## Contract-Version v<alt> → v<neu>

| Ort | Fundstelle | alt | neu | Stand |
|-----|-----------|-----|-----|-------|
| Confluence | Seite 36732929, §10 + Versionskommentar | v23 | v24 | veröffentlicht, Seitenversion 25 |
| Code | `config/OpenApiConfig.java:51` (`.version`) | v23 | v24 | geändert, im Diff |
| Code | `config/OpenApiConfig.java:55` (Beschreibungstext) | v23 | v24 | geändert, im Diff |
| Code | `common/error/ErrorCodes.java:6` (Javadoc-Kopf) | v23 | v24 | geändert, im Diff |
| Jira | KAN-42, Kommentar | - | v24 | Veröffentlichungsprotokoll gesetzt |
| Jira | KAN-18, Beschreibung „Bezug" | v23 | v24 | refined |

Unverändert und warum: `StorageProvider.java:27` („seit v21", historisch),
`docs/NAMENSSCHEMA.md:13` („Bestand aus v17", historisch), `docs/STAND.md`
(veraltet bewusst), `README.md` (nennt nur die Seiten-ID).
```

Regeln dazu:

- **Zeilennummer und Datei nennen**, nicht nur die Datei. „Irgendwo in
  `OpenApiConfig`" ist keine Meldung.
- **Code-Änderungen** landen im normalen Diff und gehen über den Übergabeblock
  (Skill `uebergabe`), nie über einen Commit von Claude. Das ist die einzige
  Stelle, an der Omar noch selbst tätig wird, und sie betrifft ausschließlich
  Git.
- **Confluence und Jira** erledigt Claude im selben Durchgang und meldet sie
  hier als erledigt, nicht als Aufgabe.
- **Bewusst unverändert gelassene Treffer** werden mit Begründung aufgeführt,
  sonst sieht das Review nicht, ob sie übersehen oder geprüft wurden.

## ErrorCodes (häufigster Sync-Fall)

Ein Fehlercode existiert erst, wenn er an **beiden** Orten steht:

- Konstante in `common/error/ErrorCodes.java` mit Javadoc
  (HTTP-Status + Auslöser),
- Zeile in Contract §6.2 (und ggf. §6.3, falls neuer Statuscode).

Beim Modul-Abschluss diffen:

```bash
python .claude/skills/api-contract-sync/contract.py show 6.2 --plain --full
grep -n "String [A-Z_]* =" backend/src/main/java/de/hsbremen/eportfolio/common/error/ErrorCodes.java
```

Jede einseitige Konstante ist ein Befund und löst eine neue Contract-Version
aus.

## Endpoint-Abgleich beim Modul-Abschluss

Für jede Endpoint-Zeile des Moduls in §6.1 prüfen: Pfad · Methode ·
Rollenspalte (gegen `SecurityConfig` + `may…`-Aufruf) · Statuscodes ·
Body-/Response-Form. Die maschinenlesbare Fassung ist `/v3/api-docs`
(springdoc, Profil dev); es gibt bewusst keine gepflegte `openapi.yaml` im Repo.

## Definition of Done

- [ ] Abweichung klassifiziert (Code-Fehler / Contract-Lücke / offene Frage)
- [ ] Fachlich unklare Punkte **vorher** gefragt und beantwortet, nicht als
      Annahme in Code oder Contract-Text gewandert
- [ ] Contract-Version über `contract.py push` veröffentlicht, mit
      Historieneintrag in §10, `check` grün, nichts gelöscht
- [ ] `verify` bestätigt die Online-Fassung
- [ ] Fundstellen der alten Versionsnummer gesucht (Repo, Jira, Confluence),
      geändert und als Tabelle „alt → neu" mit Datei und Zeile gemeldet
- [ ] `ErrorCodes.java` ↔ §6.2 deckungsgleich
- [ ] Auslösendes Jira-Ticket kommentiert (Veröffentlichungsprotokoll)
- [ ] Betroffene offene Tickets in der **Beschreibung** nachgezogen, kein
      Nachtrag-Kommentar angelegt; dabei aufgelöste Altkommentare mit ID zum
      Löschen gemeldet
- [ ] Nichts davon an Omar delegiert außer den Git-Schritten aus dem
      Übergabeblock (Skill `uebergabe`)
