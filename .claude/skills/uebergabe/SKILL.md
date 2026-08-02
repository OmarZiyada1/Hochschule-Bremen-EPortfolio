---
name: uebergabe
description: Abschluss jeder Arbeit im E-Portfolio-Repository. Claude committet, pusht und öffnet keine Pull Requests, sondern liefert fertigen Commit-Text, PR-Titel und PR-Beschreibung zum manuellen Übernehmen. Immer verwenden, wenn ein Ticket, ein Modul oder eine Änderung fertig ist.
---

# Übergabe statt Push

Git führt Omar selbst aus — Branch anlegen, `add`, `commit`, `push`, PR
öffnen und mergen. Claude schreibt den Code und liefert am Ende die **Texte**
dazu. Sonst nichts.

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
ausführen — kein Push und kein PR als Dreingabe.

Das Arbeitsverzeichnis bleibt also unangetastet: geänderte Dateien liegen
ungestaged da, damit Omar den Diff selbst sieht, bevor er ihn übernimmt.

## Übergabeblock (am Ende jeder abgeschlossenen Arbeit)

Immer in dieser Form ausgeben — Code-Fences, damit sich alles direkt kopieren
lässt:

````markdown
## Übergabe

**Branch:** `KAN-<nr>-<kurzbeschreibung>` (bestehend / neu anzulegen)

### Commit

```text
KAN-<nr>: <Was ist jetzt da — eine Zeile, ≤ 72 Zeichen>

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
- `pfad/zur/Datei.java` — was und warum
- Migration `V…__….sql` — welche Spalte/Constraint (falls vorhanden)

## Tests
`./mvnw test`: <Ergebnis, z. B. „147 Tests, alle grün"> — oder ehrlich
„nicht ausgeführt, weil <Grund>".

## Contract
Datenmodell & API-Contract v<N>, §… — deckungsgleich / Nachtrag nötig für …

## Hinweise für das Review
Bewusste Entscheidungen, Annahmen, offene Fragen. Sonst „keine".
```
````

## Regeln für die Texte

1. **Commit-Betreff wie im bestehenden Log:** `KAN-<nr>: <Kurzfassung>`,
   Deutsch, keine Punkte am Ende (Vorbild:
   `KAN-15: Optimistic Locking für Projekt (version-Spalte, 409-Handling)`).
2. **Body erklärt das Warum**, nicht die Dateiliste — die steht im Diff.
3. **Mehrere Commits, wenn die Arbeit fachlich zerfällt** (z. B. Migration
   getrennt von Endpoints): mehrere Commit-Blöcke in der Reihenfolge, in der
   sie gesetzt werden sollen, jeweils mit einem Satz, welche Dateien dazu
   gehören.
4. **Nichts behaupten, was nicht geprüft ist.** Testergebnisse nur nennen,
   wenn der Lauf tatsächlich stattgefunden hat; sonst „nicht ausgeführt" mit
   Grund. Ein geschönter PR-Text ist wertlos.
5. **Kein Push-Angebot.** Nicht fragen „soll ich pushen?" — die Übergabe ist
   das Ergebnis, Omar macht den Rest.
6. Läuft die Arbeit über mehrere Tickets, je Ticket ein eigener
   Übergabeblock.

## Definition of Done

- [ ] Kein schreibender Git-/GitHub-Befehl ausgeführt
- [ ] Übergabeblock vollständig: Branch, Commit-Text, PR-Titel, PR-Beschreibung
- [ ] Testaussage entspricht dem tatsächlichen Lauf
- [ ] Annahmen/offene Fragen stehen im PR-Text **und** im Jira-Kommentar
