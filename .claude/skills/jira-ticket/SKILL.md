---
name: jira-ticket
description: Hausstil für Jira-Tickets im Projekt KAN (E-Portfolio Hochschule Bremen). Verwenden, wenn neue Tickets angelegt oder bestehende überarbeitet werden.
---

# Jira-Ticket im Hausstil schreiben

Projekt `KAN`, Issue-Typ in der Regel `Task`. Ein Ticket ist ein
abgeschlossener, testbarer Schnitt, kein Sammelbecken.

## Struktur (Markdown in der Beschreibung)

```
## Ziel
Ein bis zwei Sätze: Was existiert danach, und warum jetzt.

## Umfang
Aufzählung der konkreten Arbeitspakete, mit exakten Pfaden
(`GET /api/…`), DTO-/Klassennamen, ErrorCodes und HTTP-Statuscodes.

## Technische Hinweise   (nur wenn nötig)
Stolpersteine, bewusste Entscheidungen, was NICHT dazugehört.

## Definition of Done
Nachprüfbare Punkte: Tests, validate grün, konkrete Verhaltensbelege.

## Bezug
Referenz: Datenmodell & API-Contract, §… · Vorgänger: KAN-… ·
Blockiert: KAN-…
```

## Regeln

1. **Contract-§§ immer nennen**: ein Ticket ohne §-Referenz ist unvollständig,
   sobald es Endpoints, Entities oder Rechte berührt. **Ohne Versionsnummer**:
   die §§ bleiben stabil, die Version steigt mit jedem Nachtrag und wäre im
   Ticket am Tag nach dem Anlegen falsch. Nur wo ein Ticket bewusst gegen
   einen alten Stand gebaut wurde, gehört die Version dazu (so hält es KAN-9
   mit v9). Der aktuelle Stand steht im Skill `api-contract-sync`.
2. Nur beschreiben, was verifiziert ist: Aussagen über den Repo-Stand müssen
   im Repo gesehen worden sein („Grundregel" aus KAN-12). Unklares als
   **unklar** kennzeichnen statt plausibel zu erfinden.
3. **Vor dem Anlegen klären, nicht im Ticket sammeln.** Was den Zuschnitt des
   Tickets verändert (Umfang, Endpoint-Menge, Statuscodes, Abgrenzung), wird
   vorher gefragt (`CLAUDE.md`, Abschnitt „Fragen vor der Umsetzung"); das
   fertige Ticket enthält Entscheidungen, keine Rückfragen an Omar. Nur
   ausdrücklich vertagte Punkte stehen als markierte Annahme mit dem
   Merkposten „wird mit v<N> festgeschrieben" darin, wenn der Contract die
   Frage offenlässt.
4. **Versionsnummer in der Bezug-Zeile aktuell halten.** Sie nennt die
   Version, die beim Anlegen gilt. Steigt der Contract später und ist das
   Ticket inhaltlich betroffen, wird die Zeile nachgezogen; die Fundstellen
   dafür liefert der Skill `api-contract-sync` (Tabelle „alt → neu"). Nicht
   betroffene Tickets bleiben auf ihrer alten Nummer stehen.
5. Deutsch, präzise, keine Füllsätze; Code- und Pfadnamen in Backticks.
   **Kein Em-Dash `—`** in Titel, Beschreibung oder Kommentaren
   (Schreibstil-Regel aus `CLAUDE.md`): Doppelpunkt, Komma, Klammern oder
   zwei Sätze verwenden.
6. Abhängigkeiten ehrlich pflegen (Vorgänger/Blockiert): die Reihenfolge auf
   dem Board folgt daraus.
7. Descope-Kandidaten (Zeitrisiko der 9 Wochen) offen als solche benennen.
