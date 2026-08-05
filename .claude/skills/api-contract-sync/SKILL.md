---
name: api-contract-sync
description: Abgleich zwischen Backend-Code und der Confluence-Seite „Datenmodell & API-Contract" (Seiten-ID 36732929) für das E-Portfolio Hochschule Bremen. Verwenden, wenn eine Abweichung auffällt, ein neuer Fehlercode/Endpoint entsteht oder ein Modul abgeschlossen wird.
---

# Code ↔ API-Contract synchron halten

Der Contract (Space BEH, Seiten-ID `36732929`, aktuell v20, Stand KAN-50) ist die
verbindliche gemeinsame Grundlage von Backend und Frontend. Er ist nur dann
etwas wert, wenn er stimmt; deshalb wird **jede** Abweichung behandelt, keine
still hingenommen.

## Entscheidungsbaum bei einer Abweichung

1. **Code ist falsch, Contract richtig** (Regelfall): Code anpassen.
2. **Contract ist lückenhaft oder überholt**: Contract in einer neuen
   Version ergänzen (siehe unten), erst dann den Code bauen.
3. **Fachlich unklar** (z. B. Berechtigungsfrage): **zuerst fragen**, nicht
   annehmen. Die Frage mit Optionen über `AskUserQuestion` vorlegen, bevor
   Code oder Contract-Text entsteht (Regel „Fragen vor der Umsetzung" in
   `CLAUDE.md`). Die Antwort wird zur Contract-Ergänzung. Vertagt Omar die
   Entscheidung ausdrücklich, erst dann der bisherige Weg: offener Punkt in
   §7 des Contracts und auf der Seite „Offene Fragen" (ID 1802249),
   Default-Annahme dokumentieren, konfigurierbar umsetzen (Vorbild
   `app.berechtigung.*`).

Die Wahl zwischen Zweig 1 und Zweig 2 ist selbst entscheidungsrelevant,
sobald beide vertretbar sind: dann gehört sie in die Klärungsrunde, denn
„Code anpassen" und „Contract erhöhen" führen zu völlig verschiedenen
Ergebnissen.

## Contract-Version erhöhen (Confluence)

1. Seite 36732929 vollständig laden: das Update-Werkzeug ersetzt den
   **gesamten** Seiteninhalt; es wird immer der komplette, ergänzte Text
   zurückgeschrieben.
2. **Bestehenden Inhalt nie löschen oder umformulieren**, nur ergänzen und
   präzisieren; Widersprüche über Hinweiskästen auflösen (so arbeiten v9 bis
   v11).
3. Kopfbereich: neue Versionsnummer; unten in der „Änderungshistorie
   (fachlich)" einen Eintrag im Stil der bestehenden ergänzen:
   betroffene §§, was, warum.
4. Versionskommentar beim Speichern: `v<N>: <Kurzfassung> (KAN-<Ticket>)`.
5. Im zugehörigen Jira-Ticket kommentieren, dass v<N> veröffentlicht ist.
6. Neu geschriebene Absätze ohne Em-Dash `—` formulieren (Schreibstil-Regel
   aus `CLAUDE.md`); bestehender Seitentext bleibt unangetastet.

## Versionsnummer nachziehen: alle Fundstellen

Eine erhöhte Contract-Version ist erst fertig, wenn **jede** Stelle, die die
alte Nummer nennt, geprüft ist. Eine Nummer nur in Confluence zu erhöhen
erzeugt genau den Zustand, den `docs/STAND.md` schon einmal festgehalten hat
(„`OpenApiConfig` nennt weiterhin v10, der Contract steht auf v11").

### Schritt 1: Fundstellen ermitteln, nicht raten

Im Repo suchen, jedes Mal neu, weil neue Stellen dazukommen:

```bash
grep -rn "Contract v\|API-Contract v\|\bv<alte Nummer>\b" \
  --include=*.java --include=*.md --include=*.sql .
```

Das Beispiel in Schritt 2 nennt die Zeilennummern von v16 (Stand KAN-16).
Sie verschieben sich, also jedes Mal frisch suchen statt abschreiben.

Bekannte Stellen als Ausgangspunkt, jede einzeln ansehen:

| Ort | Fundstelle | Was steht dort |
|-----|-----------|----------------|
| Code | `backend/src/main/java/de/hsbremen/eportfolio/config/OpenApiConfig.java` | zwei Stellen: `.version("v<N>")` und im `description`-Text „Stand entspricht dem API-Contract v<N>, §6" |
| Code | `backend/src/main/java/de/hsbremen/eportfolio/common/error/ErrorCodes.java` | Javadoc-Kopf „Stand Contract v<N> steht jede Konstante …" |
| Code | weitere Javadoc-/Kommentarsätze mit „v<N>" | nur der **Stand**-Satz wird nachgezogen; historische Sätze („war bis v14 nur hier geführt", „mit v15 nachgetragen") bleiben unverändert stehen, sie beschreiben die Vergangenheit |
| Doku | `docs/ARCHITEKTUR.md` | nennt bislang keine Versionsnummer, aber §-Verweise: prüfen, ob die Änderung einen §-Verweis oder eine Tabellenzeile verschiebt |
| Doku | `README.md` | nennt nur die Seiten-ID `36732929`, keine Version: in der Regel nichts zu tun |
| Doku | `docs/STAND.md` | **nicht anfassen**, veraltet bewusst (`CLAUDE.md`) |
| Skill | `.claude/skills/api-contract-sync/SKILL.md`, erster Absatz („aktuell v<N>, Stand KAN-<nr>") | die Nachführung dieser Zeile gehört zu jeder Versionserhöhung dazu |
| Jira | auslösendes Ticket: Abschnitt „Bezug" plus neuer Kommentar | „Referenz: Datenmodell & API-Contract v<N>, §…" |
| Jira | offene Tickets mit älterer Nummer, deren Inhalt betroffen ist | Suche: `project = KAN AND statusCategory != Done AND text ~ "API-Contract v"`; nur **inhaltlich betroffene** Tickets nachziehen, nicht pauschal alle Nummern hochzählen |
| Confluence | Contract-Seite `36732929` | Kopfbereich, Änderungshistorie, Versionskommentar beim Speichern |
| Confluence | Seite „Offene Fragen" (ID `1802249`) | mit dieser Version entschiedene Punkte als entschieden markieren, mit Verweis auf v<N> |
| Confluence | weitere Seiten im Space BEH | Suche im Space nach `text ~ "API-Contract v"`; jede Trefferseite kurz prüfen |

### Schritt 2: Fundstellen melden, bevor etwas geändert wird

Immer diesen Block ausgeben, damit Omar Stelle für Stelle sieht, welche
Nummer wo wechselt. Keine Sammelaussage wie „Versionsnummern aktualisiert":

```markdown
## Contract-Version v<alt> → v<neu>

| Ort | Fundstelle | alt | neu | wer |
|-----|-----------|-----|-----|-----|
| Code | `config/OpenApiConfig.java:51` (`.version`) | v16 | v17 | Claude, im Diff |
| Code | `config/OpenApiConfig.java:55` (Beschreibungstext) | v16 | v17 | Claude, im Diff |
| Code | `common/error/ErrorCodes.java:6` (Javadoc-Kopf) | v16 | v17 | Claude, im Diff |
| Skill | `.claude/skills/api-contract-sync/SKILL.md:8` | v16 | v17 | Claude, im Diff |
| Confluence | Seite 36732929, Kopf + Änderungshistorie | v16 | v17 | Claude, veröffentlicht |
| Jira | KAN-18, Abschnitt „Bezug" | v16 | v17 | Omar, manuell |

Unverändert und warum: `ErrorCodes.java:7` („bis v14"), `docs/STAND.md`
(veraltet bewusst), `README.md` (nennt nur die Seiten-ID).
```

Regeln dazu:

- **Zeilennummer und Datei nennen**, nicht nur die Datei. „Irgendwo in
  `OpenApiConfig`" ist keine Meldung.
- **Was Claude selbst ändert**, landet im normalen Diff und geht über den
  Übergabeblock (Skill `uebergabe`), nie über einen Commit von Claude.
- **Was Omar ändern muss** (Jira-Tickets, fremde Confluence-Seiten), steht mit
  Ticket-Key beziehungsweise Seitenname und exakter alter und neuer Nummer da.
- **Bewusst unverändert gelassene Treffer** werden mit Begründung aufgeführt,
  sonst sieht das Review nicht, ob sie übersehen oder geprüft wurden.

## ErrorCodes (häufigster Sync-Fall)

Ein Fehlercode existiert erst, wenn er an **beiden** Orten steht:

- Konstante in `common/error/ErrorCodes.java` mit Javadoc
  (HTTP-Status + Auslöser),
- Zeile in Contract §6.2 (und ggf. §6.3, falls neuer Statuscode).

Beim Modul-Abschluss `ErrorCodes.java` gegen §6.2 diffen; jede einseitige
Konstante ist ein Befund.

## Endpoint-Abgleich beim Modul-Abschluss

Für jede Endpoint-Zeile des Moduls in §6.1 prüfen: Pfad · Methode ·
Rollenspalte (gegen `SecurityConfig` + `may…`-Aufruf) · Statuscodes ·
Body-/Response-Form. Die maschinenlesbare Fassung ist `/v3/api-docs`
(springdoc, Profil dev); es gibt bewusst keine gepflegte `openapi.yaml`
im Repo.

## Definition of Done

- [ ] Abweichung klassifiziert (Code-Fehler / Contract-Lücke / offene Frage)
- [ ] Fachlich unklare Punkte **vorher** gefragt und beantwortet, nicht als
      Annahme in Code oder Contract-Text gewandert
- [ ] Contract-Version veröffentlicht mit Historieneintrag, nichts gelöscht
- [ ] Fundstellen der alten Versionsnummer gesucht (Repo, Jira, Confluence)
      und als Tabelle „alt → neu" mit Datei und Zeile gemeldet
- [ ] Erster Absatz dieses Skills auf die neue Version nachgezogen
- [ ] `ErrorCodes.java` ↔ §6.2 deckungsgleich
- [ ] Jira-Ticket kommentiert
- [ ] Code-Änderungen daraus gehen über den Übergabeblock (Skill `uebergabe`),
      nicht über einen Commit von Claude
