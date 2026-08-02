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
(`GET /api/…`), DTO-/Klassennamen, Fehlercodes und HTTP-Statuscodes.

## Technische Hinweise   (nur wenn nötig)
Stolpersteine, bewusste Entscheidungen, was NICHT dazugehört.

## Definition of Done
Nachprüfbare Punkte: Tests, validate grün, konkrete Verhaltensbelege.

## Bezug
Referenz: Datenmodell & API-Contract v<N>, §… · Vorgänger: KAN-… ·
Blockiert: KAN-…
```

## Regeln

1. **Contract-§§ immer nennen**: ein Ticket ohne §-Referenz ist unvollständig,
   sobald es Endpoints, Entities oder Rechte berührt.
2. Nur beschreiben, was verifiziert ist: Aussagen über den Repo-Stand müssen
   im Repo gesehen worden sein („Grundregel" aus KAN-12). Unklares als
   **unklar** kennzeichnen statt plausibel zu erfinden.
3. Annahmen explizit als Annahme markieren und mit dem Merkposten „wird mit
   v<N> festgeschrieben" versehen, wenn der Contract die Frage offenlässt.
4. Deutsch, präzise, keine Füllsätze; Code- und Pfadnamen in Backticks.
   **Kein Em-Dash `—`** in Titel, Beschreibung oder Kommentaren
   (Schreibstil-Regel aus `CLAUDE.md`): Doppelpunkt, Komma, Klammern oder
   zwei Sätze verwenden.
5. Abhängigkeiten ehrlich pflegen (Vorgänger/Blockiert): die Reihenfolge auf
   dem Board folgt daraus.
6. Descope-Kandidaten (Zeitrisiko der 9 Wochen) offen als solche benennen.
