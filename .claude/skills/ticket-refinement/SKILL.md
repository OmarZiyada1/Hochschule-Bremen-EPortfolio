---
name: ticket-refinement
description: Bestehende Jira-Tickets im Projekt KAN gegen den echten Repo-Stand und den API-Contract prüfen und bei Abweichung die Beschreibung neu schreiben. Verwenden, wenn Tickets vor der Umsetzung geschärft werden, wenn ein abgeschlossenes Ticket die Grundlage späterer Tickets verschoben hat, oder wenn ein ganzer Ticketsatz (Frontend, Backend) durchgesehen wird.
---

# Tickets refinen (Beschreibung neu schreiben, nicht kommentieren)

Ein Ticket wird geschrieben, bevor der Code existiert. Danach verschiebt sich
der Boden darunter: ein Setup-Ticket liefert andere Bausteine als geplant, der
Contract steigt eine Version, ein Endpoint kommt später als gedacht. Refinement
ist der Abgleich zwischen dem, was das Ticket behauptet, und dem, was im
Repository und im Contract tatsächlich steht.

Dieser Skill beschreibt **nur** die Überarbeitung bestehender Tickets. Wie ein
Ticket aufgebaut ist und klingt, steht im Skill `jira-ticket`; der gilt hier
unverändert weiter und wird nicht wiederholt.

## Die harte Regel: Refinement steht in der Beschreibung

**Ein refintes Ticket wird neu geschrieben, nicht ergänzt.** Die überarbeitete
Fassung ersetzt die Beschreibung vollständig, sodass ein Leser oben anfängt und
unten fertig ist.

**Der Kommentarbereich bleibt frei.** Dort steht ausschließlich der
Übergabekommentar aus dem Skill `uebergabe`, also das Ergebnis der Umsetzung
mit den getroffenen Entscheidungen. Nichts anderes.

Verboten sind deshalb, auch wenn es bequemer wäre:

- ein Kommentar „Nachtrag: der Endpoint heißt jetzt anders",
- ein Kommentar „siehe Klärung unten" statt einer Korrektur oben,
- ein Abschnitt „Update vom TT.MM." innerhalb der Beschreibung,
- ein durchgestrichener oder als „veraltet" markierter Absatz, der stehen
  bleibt.

Begründung: Wer das Ticket zur Umsetzung öffnet, liest die Beschreibung. Steht
die gültige Fassung in Kommentar drei, baut er nach der ungültigen. Ein Ticket
hat genau einen Sollzustand, und der steht an genau einer Stelle. Die Historie
geht dabei nicht verloren: Jira führt die Versionshistorie der Beschreibung
selbst.

## 0. Grundlage feststellen, bevor ein Ticket bewertet wird

Ein Ticket kann nur gegen einen bekannten Stand geprüft werden. Diese Reihenfolge,
nie abgekürzt:

1. **Repo-Stand verifizieren, nicht aus der Doku übernehmen.** Nachsehen, was
   wirklich da ist: Ordner, Dateien, Exporte, `package.json`, Controller.
   `docs/STAND.md` ist ausdrücklich eine veraltende Momentaufnahme und taugt
   nicht als Beleg (`CLAUDE.md`). Auch ein gemergter Branch belegt nur, was im
   Diff steht, nicht was das Ticket versprochen hat.
2. **Contract-§§ nachschlagen** (Confluence 36732929): mindestens §5
   (Rechtematrix), §6.1 (Endpoint-Zeilen), §6.2 (Fehlercodes), dazu die im
   Ticket genannten. Eine Endpoint-Zeile im Contract ist **kein** Beleg für
   einen umgesetzten Endpoint; §8 nennt den Umsetzungsstand.
3. **Das Ticket vollständig lesen**, inklusive der Verknüpfungen (Vorgänger,
   blockiert, blockiert durch) und der vorhandenen Kommentare.
4. Bei Frontend-Tickets zusätzlich die **Confluence-Template-Seite** unter
   „Figma-Prototype (Embed)" lesen. Sie sagt, *was* auf der Seite steht; der
   Contract sagt, *welche Daten* es gibt (Skill `frontend-modul`).

Wird ein ganzer Ticketsatz durchgesehen, geschieht Schritt 1 **einmal** für alle
und wird als Bestandsliste festgehalten. Sonst wird derselbe Ordner zwanzigmal
unterschiedlich beschrieben.

## 1. Woran man erkennt, dass ein Ticket Refinement braucht

Refinement ist kein Selbstzweck. Ein Ticket, das trägt, bleibt unangetastet.
Ausgelöst wird es durch einen dieser Befunde:

| Auslöser | Woran erkennbar |
| --- | --- |
| **Falsche Tatsachenbehauptung** | Das Ticket beschreibt den Repo-Stand anders, als er ist („baut auf dem vorhandenen API-Client auf", den es nicht gibt) |
| **Unsichtbare Abhängigkeit** | Das Ticket setzt einen Baustein voraus, den kein Ticket liefert, und nennt ihn nicht als Blocker |
| **Contract-Drift** | Endpoint-Pfade, DTO-Namen, Enum-Werte oder Fehlercodes im Ticket stimmen nicht mehr mit dem Contract überein |
| **Namensdrift** | Deutsche Bezeichner, wo `docs/NAMENSSCHEMA.md` inzwischen englische vorschreibt |
| **Zuschnitt zu groß** | Mehrere unabhängig testbare Ergebnisse in einem Ticket; das Ticket kann nicht in einem Zug abgeschlossen werden |
| **Zuschnitt zu klein** | Das Ticket erzeugt für sich genommen nichts Benutzbares und existiert nur als Fragment eines anderen |
| **DoD nicht nachprüfbar** | „funktioniert", „sieht gut aus", „ist getestet" ohne konkreten Beleg |
| **Attrappe eingeplant** | Das Ticket verlangt eine Ansicht für Daten, deren Endpoint fehlt (Frontend-Regel 10 in `CLAUDE.md`) |

Kein Auslöser ist: eine andere Wortwahl, eine andere Reihenfolge der Aufzählung,
ein fehlendes Detail, das Contract oder Skills ohnehin beantworten. Refinement
schärft Entscheidungen, es poliert keine Sprache.

## 2. Klärungsrunde, bevor die neue Fassung entsteht

Refinement verändert oft den Zuschnitt, und der Zuschnitt gehört Omar. Es gilt
`CLAUDE.md`, Abschnitt „Fragen vor der Umsetzung": alle entscheidungsrelevanten
Punkte **gebündelt in einer Runde** über `AskUserQuestion`, je Frage zwei bis
vier Optionen, die empfohlene zuerst und mit „(Empfohlen)" markiert.

Entscheidungsrelevant beim Refinement ist vor allem:

- **Ticket teilen oder zusammenlegen?** Ein Schnitt verändert das Board, die
  Reihenfolge und die Schätzung.
- **Fehlender Baustein: neues Ticket oder Umfangserweiterung?** Fehlt zum
  Beispiel die API-Anbindung, kann sie ein eigenes Vorgänger-Ticket werden oder
  im ersten betroffenen Ticket mitlaufen. Beides ist vertretbar, die Folgen für
  den Board-Verlauf sind verschieden.
- **Template gegen Contract.** Zeigt die Vorlage ein Element ohne Endpoint,
  entscheidet Omar zwischen Contract-Nachtrag und Streichen des Elements
  (Skill `frontend-modul`, Schritt 0b).
- **Descope.** Bei Zeitrisiko benennt der Skill `jira-ticket` Descope-Kandidaten
  offen; ob ein Ticket einer wird, entscheidet Omar.

Nicht gefragt wird nach Formulierung, Abschnittsreihenfolge, Testaufbau oder
Ablageort: das steht in den Skills.

## 3. Die neue Fassung schreiben

Aufbau, Ton und Regeln kommen unverändert aus dem Skill `jira-ticket`
(Abschnitte Ziel, Umfang, Technische Hinweise, Definition of Done, Bezug).
Zusätzlich gilt beim Überschreiben:

1. **Nichts still verlieren.** Vor dem Überschreiben die alte Fassung
   durchgehen und jede Aussage einordnen: übernommen, korrigiert, oder bewusst
   gestrichen. Eine gestrichene Anforderung wird im Refinement-Bericht
   (Abschnitt 4) genannt, nicht kommentarlos entfernt.
2. **Titel mitziehen.** Beschreibt der Titel etwas anderes als der neue Umfang,
   wird er ebenfalls neu geschrieben. Ein Ticket mit passendem Rumpf und
   irreführendem Titel wird auf dem Board falsch eingeplant.
3. **Abhängigkeiten in die Verknüpfungen, nicht nur in den Text.** Ein neu
   erkannter Blocker gehört als Jira-Verknüpfung gesetzt und zusätzlich in die
   Bezug-Zeile. Nur im Fließtext genannt, taucht er in keiner Board-Ansicht auf.
4. **Nur Verifiziertes behaupten** (Regel 2 im Skill `jira-ticket`). Was in
   Schritt 0 nicht gesehen wurde, steht nicht als Tatsache im Ticket. Unklares
   wird als unklar gekennzeichnet.
5. **Contract-§§ ohne Versionsnummer**, außer das Ticket ist bewusst gegen einen
   alten Stand geschnitten (Regel 1 im Skill `jira-ticket`).
6. **Kein Em-Dash `—`** in Titel, Beschreibung oder Kommentar
   (`CLAUDE.md`, Schreibstil).
7. **Der Status bleibt.** Refinement verschiebt kein Ticket auf dem Board und
   schließt keins. Ist ein Ticket durch die Prüfung gegenstandslos geworden,
   wird das im Bericht vorgeschlagen und von Omar entschieden.

## 4. Refinement-Bericht ausgeben

Am Ende eines Durchgangs steht ein Bericht, damit Omar die Änderungen prüfen
kann, ohne jede Ticketversion in Jira zu vergleichen. Eine Zeile je Ticket:

```markdown
## Refinement-Bericht

| Ticket | Befund | Änderung |
| --- | --- | --- |
| KAN-… | Setzt `src/api/client.ts` voraus, existiert nicht | Blocker KAN-… ergänzt, Umfang um … gekürzt |
| KAN-… | Trägt | unverändert |

### Gestrichene Anforderungen
- KAN-…: „…" entfällt, weil …

### Neue Tickets vorgeschlagen
- „…": deckt … ab, blockiert KAN-…
```

Tickets ohne Befund werden **mit aufgeführt** und als „trägt, unverändert"
markiert. Sonst bleibt offen, ob sie geprüft oder übersehen wurden.

Neue Tickets legt dieser Skill **nicht** selbst an: er schlägt sie mit Titel,
Zweck und Verknüpfung vor, angelegt werden sie nach dem Skill `jira-ticket`,
sobald Omar zustimmt.

## 5. Prüffragen je Bereich

### Frontend

Vor der Bewertung eines Frontend-Tickets diese Bestandsfragen gegen
`frontend/src/` beantworten, weil fast jeder Befund daran hängt:

- Gibt es `frontend/src/api/` mit `client.ts`, `errors.ts`, `schema.d.ts`?
  Ohne diese Schicht ist **jede** datentragende Ansicht blockiert
  (`CLAUDE.md`, Frontend-Regeln 2 und 3).
- Ist `schema.d.ts` erzeugt und aktuell, oder existiert nur das Skript
  `gen:api` in der `package.json`?
- Existieren die vorausgesetzten Primitiven unter `components/ui/`, oder ist
  bisher nur `components.json` konfiguriert? Eine konfigurierte shadcn-CLI ist
  keine vorhandene Komponente.
- Existieren `components/layout/` und die Route-Wrapper je Zugriffsebene? Der
  Skill `frontend-modul` (Schritt 4) setzt sie voraus.
- Ist MSW nicht nur installiert, sondern in `src/test/setup.ts` gestartet? Jede
  DoD-Zeile „Serverantworten über MSW" hängt daran.
- Existiert der Endpoint, den die Ansicht braucht, wirklich im Backend
  (Controller oder `/v3/api-docs`), oder nur als Contract-Zeile?
- Nennt das Ticket seine Template-Seite, und deckt der Umfang deren
  „Layout-Bereiche" ab?

### Backend

- Stimmen Endpoint-Pfade, DTO-Namen und Fehlercodes mit §6.1 und §6.2 überein?
- Verlangt das Ticket eine Schemaänderung, ohne die Migration zu nennen
  (Skill `flyway-migration`)?
- Ist die Rechteprüfung auf der richtigen Ebene beschrieben (Rolle über
  `SecurityConfig`, Ressource über `ProjectPermissionService`)?
- Nennt das Ticket die erwarteten Statuscodes, oder bleibt es bei „gibt einen
  Fehler zurück"?

## 6. Definition of Done

- [ ] Repo-Stand vor der Bewertung tatsächlich nachgesehen, nicht aus
      `docs/STAND.md` übernommen
- [ ] Genannte Contract-§§ und, bei Frontend, die Template-Seite gelesen
- [ ] Klärungsrunde vor dem Umschreiben stattgefunden, wo der Zuschnitt betroffen war
- [ ] Jede Änderung steht **in der Beschreibung**, kein Refinement-Kommentar
      angelegt
- [ ] Kommentarbereich enthält weiterhin nur den Übergabekommentar
- [ ] Kein „Update vom …"-Abschnitt und kein als veraltet markierter Absatz in
      der neuen Fassung
- [ ] Titel passt zum neuen Umfang
- [ ] Neu erkannte Blocker als Jira-Verknüpfung gesetzt, nicht nur im Text
- [ ] Keine unbelegte Tatsachenbehauptung über den Repo-Stand
- [ ] Refinement-Bericht ausgegeben, geprüfte Tickets ohne Befund enthalten
- [ ] Gestrichene Anforderungen benannt, nicht stillschweigend entfernt
- [ ] Kein Em-Dash `—` in Titel, Beschreibung und Bericht
- [ ] Kein Ticket verschoben, geschlossen oder neu angelegt ohne Omars Zustimmung
