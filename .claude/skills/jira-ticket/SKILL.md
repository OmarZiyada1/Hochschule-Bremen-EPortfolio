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

Dazu, **außerhalb der Beschreibung**, im Ticket selbst: je genanntem
Vorgänger und blockiertem Ticket ein Vorgangs-Link vom Typ `Blocks`
(Regel 6). Die Bezug-Zeile allein genügt nicht.

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
6. **Abhängigkeiten zweifach führen: Bezug-Zeile und Vorgangs-Link.** Die
   Zeile nennt `Vorgänger`/`Blockiert` mit dem fachlichen Grund in Klammern
   („KAN-50 (Konfiguration)"); zusätzlich wird am Ticket ein Vorgangs-Link vom
   Typ `Blocks` gesetzt. Das ist keine Doppelung, beides sagt Verschiedenes:
   der Text sagt, **warum** die Abhängigkeit besteht, der Link **stellt sie
   her**. Nur aus dem Link folgen die Reihenfolge auf dem Board, die Warnung
   beim Start eines blockierten Tickets, die Auswertbarkeit per JQL
   (`issueLinkType = "is blocked by"`) und vor allem die Gegenrichtung: ein
   Link erscheint automatisch in beiden Tickets, eine Textzeile steht nur in
   dem, in das sie jemand geschrieben hat. Ein bloßer Ticket-Schlüssel im Text
   sieht wie eine Verknüpfung aus (Jira rendert ihn als Chip mit Status), ist
   aber keine.

   Die Instanz kennt `Blocks`, `Cloners`, `Duplicate` und `Relates`; einen
   eigenen Typ „Vorgänger/Nachfolger" gibt es nicht, `Blocks` deckt beide
   Richtungen der Bezug-Zeile ab. Reine Konventionsverweise (etwa auf das
   Namensschema aus KAN-49) bekommen **keinen** Link: sie sind keine
   Abhängigkeit, und das Panel verliert seine Aussagekraft, wenn jede
   Erwähnung darin landet.

   Beim Anlegen über die REST-API ist `inwardIssue` das Subjekt und
   `outwardIssue` das Objekt, `{"type":{"name":"Blocks"},"inwardIssue":
   {"key":"KAN-51"},"outwardIssue":{"key":"KAN-26"}}` ergibt also
   „KAN-51 blocks KAN-26". Die Richtung nach dem ersten Link nachlesen, bevor
   weitere entstehen: eine verkehrt herum gesetzte Blockade behauptet das
   Gegenteil und ist schlimmer als gar keine.
7. Descope-Kandidaten (Zeitrisiko der 9 Wochen) offen als solche benennen.
