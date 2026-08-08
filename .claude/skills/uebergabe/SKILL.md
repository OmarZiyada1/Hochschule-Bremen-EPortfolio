---
name: uebergabe
description: Abschluss jeder Arbeit im E-Portfolio-Repository. Claude committet, pusht und öffnet keine Pull Requests, sondern liefert fertigen Commit-Text, PR-Titel und PR-Beschreibung zum manuellen Übernehmen. Immer verwenden, wenn ein Ticket, ein Modul oder eine Änderung fertig ist.
---

# Übergabe statt Push

Git führt Omar selbst aus: Branch anlegen, `add`, `commit`, `push`, PR öffnen
und mergen. Claude schreibt den Code und liefert am Ende die **Texte** dazu.
Sonst nichts.

## Harte Grenze: keine schreibenden Git-/GitHub-Befehle

Verboten, auch „nur schnell", auch auf einem Feature-Branch, auch wenn ein
Ticket es nahelegt:

`git add` · `git commit` · `git push` · `git merge` · `git rebase` ·
`git reset` · `git restore` · `git checkout -b` / `git switch -c` ·
`git stash` · `git tag` · `gh pr create` · `gh pr merge` · `gh release …`

Erlaubt und erwünscht sind lesende Befehle zum Formulieren der Übergabe:
`git status`, `git diff`, `git diff --stat`, `git log`,
`git branch --show-current`.

**Einzige Ausnahme:** Omar fordert in genau dieser Nachricht ausdrücklich
einen Git-Befehl an („commit das bitte"). Dann genau diesen einen Befehl
ausführen, ohne Push und ohne PR als Dreingabe.

Das Arbeitsverzeichnis bleibt also unangetastet: geänderte Dateien liegen
ungestaged da, damit Omar den Diff selbst sieht, bevor er ihn übernimmt.

## Übergabeblock (am Ende jeder abgeschlossenen Arbeit)

Immer in dieser Form ausgeben, mit Code-Fences, damit sich alles direkt
kopieren lässt:

````markdown
## Übergabe

**Branch:** `KAN-<nr>-<kurzbeschreibung>` (bestehend / neu anzulegen)

### Commit

```text
KAN-<nr>: <Was ist jetzt da, eine Zeile, höchstens 72 Zeichen>

- <Warum/Was, ein Punkt je fachlicher Änderung>
- <Migration, Fehlercode, Contract-Bezug, falls betroffen>
```

### PR-Titel

```text
KAN-<nr>: <dieselbe Kurzfassung wie Zeile 1 des Commits>
```

### PR-Beschreibung

```markdown
## Ziel
Ein bis zwei Sätze: Was kann das System danach, das es vorher nicht konnte.

## Änderungen
- `pfad/zur/Datei.java`: was und warum
- Migration `V…__….sql`: welche Spalte/Constraint (falls vorhanden)

## Tests
`./mvnw test`: <Ergebnis, z. B. „147 Tests, alle grün">. Oder ehrlich
„nicht ausgeführt, weil <Grund>".

## Contract
Datenmodell & API-Contract v<N>, §…: deckungsgleich / Nachtrag nötig für …
Bei erhöhter Version zusätzlich die Fundstellen-Tabelle „alt → neu" aus dem
Skill `api-contract-sync`. Confluence und Jira sind dort bereits erledigt und
werden als erledigt gemeldet; offen bleiben nur die Code-Stellen, die über
diesen Übergabeblock gehen.

## Entscheidungen
Was in der Klärungsrunde entschieden wurde, je Punkt eine Zeile:
Frage, gewählte Antwort, Umsetzung. Sonst „keine".

## Hinweise für das Review
Bewusste Abwägungen und Stolpersteine. Sonst „keine".
```
````

## Regeln für die Texte

1. **Commit-Betreff wie im bestehenden Log:** `KAN-<nr>: <Kurzfassung>`,
   Deutsch, kein Punkt am Ende (Vorbild:
   `KAN-15: Optimistic Locking für Projekt (version-Spalte, 409-Handling)`).
2. **Body erklärt das Warum**, nicht die Dateiliste; die steht im Diff.
3. **Mehrere Commits, wenn die Arbeit fachlich zerfällt** (z. B. Migration
   getrennt von Endpoints): mehrere Commit-Blöcke in der Reihenfolge, in der
   sie gesetzt werden sollen, jeweils mit einem Satz, welche Dateien dazu
   gehören.
4. **Nichts behaupten, was nicht geprüft ist.** Testergebnisse nur nennen,
   wenn der Lauf tatsächlich stattgefunden hat; sonst „nicht ausgeführt" mit
   Grund. Ein geschönter PR-Text ist wertlos.
5. **Kein Push-Angebot.** Nicht fragen „soll ich pushen?": die Übergabe ist
   das Ergebnis, Omar macht den Rest.
6. **Keine offenen Fragen im Übergabeblock.** Fragen werden vor der
   Umsetzung gestellt (`CLAUDE.md`, Abschnitt „Fragen vor der Umsetzung"),
   nicht hier gesammelt. Taucht beim Schreiben der Übergabe doch noch eine
   auf: Übergabe zurückstellen, Frage stellen, Antwort einarbeiten, dann
   liefern. Nur ausdrücklich von Omar vertagte Punkte stehen hier, benannt
   als „vertagt, Jira KAN-…", nie als stille Annahme.
7. **Contract-Versionsnummern gehören in den PR-Text.** Wurde der Contract
   erhöht, steht die Tabelle „alt → neu" mit Datei und Zeile im Abschnitt
   „Contract", getrennt nach „im Diff enthalten" und „von Omar zu ändern"
   (Skill `api-contract-sync`).
8. **Kein Em-Dash `—`** in Commit-Text, PR-Titel und PR-Beschreibung
   (Schreibstil-Regel aus `CLAUDE.md`).
9. Läuft die Arbeit über mehrere Tickets, je Ticket ein eigener
   Übergabeblock.
10. **Der Jira-Kommentar berichtet, er schreibt nicht vor.** Er hält fest, was
    umgesetzt und entschieden wurde. Fällt beim Abschluss auf, dass sich der
    **Sollzustand** eines Tickets verschoben hat, gehört das nicht als
    Nachtrag in den Kommentarbereich: Beim eigenen Ticket wird die
    Beschreibung überarbeitet, bei einem fremden das betroffene Ticket
    refined (Skill `ticket-refinement`). Ein Kommentar „Nachtrag: der
    Endpoint heißt jetzt anders" wird von der nächsten Person übersehen, die
    oben anfängt zu lesen.

## Definition of Done

- [ ] Kein schreibender Git-/GitHub-Befehl ausgeführt
- [ ] Übergabeblock vollständig: Branch, Commit-Text, PR-Titel, PR-Beschreibung
- [ ] Testaussage entspricht dem tatsächlichen Lauf
- [ ] Kein `—` in den gelieferten Texten
- [ ] Keine offene Frage im Übergabeblock; getroffene Entscheidungen stehen
      im PR-Text **und** im Jira-Kommentar
- [ ] Der Jira-Kommentar berichtet nur die Umsetzung; verschobener
      Sollzustand ist in der Beschreibung nachgezogen, nicht als Nachtrag
      angehängt
- [ ] Bei erhöhter Contract-Version: Fundstellen-Tabelle „alt → neu" im
      PR-Text, mit Trennung Diff / von Omar zu ändern
