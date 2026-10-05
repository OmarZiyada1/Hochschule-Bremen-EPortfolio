# Bachelorthesis in LaTeX

E-Portfolio Hochschule Bremen, Omar Ziyada und Mohamad Alaskari.

**Kurzfassung vom 04.10.2026.** Kapitel 2 bis 8 sind auf etwa die Hälfte
gekürzt und neu geschrieben, Kapitel 1 entspricht dem aktuellen Stand der
Confluence-Seite. Kapitel 1 bis 8 belegen die Seiten 1 bis 49. Die
Confluence-Kapitelseiten tragen denselben Text; die Langfassung steht dort in
der Versionshistorie und hier im Ordner `langfassung/`.

## Dateien

```
Thesis.tex                 Präambel, Layout, Reihenfolge der Bestandteile
vorlagen/                  Deckblatt, Eigenständigkeitserklärung,
                           Zusammenfassung (nur deutsch), Abkürzungsverzeichnis
kapitel/kapitel01.tex      Einleitung
kapitel/kapitel02.tex      Anforderungsanalyse
kapitel/kapitel03.tex      Grundlagen und verwandte Arbeiten
kapitel/kapitel04.tex      Konzeption
kapitel/kapitel05.tex      Realisierung
kapitel/kapitel06.tex      Test
kapitel/kapitel07.tex      Evaluation
kapitel/kapitel08.tex      Zusammenfassung und Ausblick
anhang/anhang.tex          Anhang A bis C, aus Confluence (Seite 101220353)
anhang/anhang_d.tex        Anhang D, Testunterlagen; erzeugt, nicht von Hand ändern
werkzeuge/anhang_d.py      erzeugt Anhang D aus Testmaterial/_generator
literatur/literatur.bib    13 Quellen im BibTeX-Format
bilder/                    alle Abbildungen
BILDER-LISTE.md            welche Abbildung welchen Dateinamen braucht
langfassung/               die Kapitel 1 bis 8 vor der Kürzung, dazu das PDF
```

## Kompilieren

In TeXstudio:

1. **F5** (pdflatex)
2. **F8** (Bibliographie, biber)
3. **F5**, dann noch einmal **F5**

Auf der Kommandozeile:

```
pdflatex Thesis.tex
biber Thesis
pdflatex Thesis.tex
pdflatex Thesis.tex
```

`latexmk` blieb auf diesem Rechner ohne Ausgabe hängen; die vier Einzelaufrufe
laufen dagegen durch.

Geprüft am 05.10.2026: 79 Seiten insgesamt mit Anhang D, Kapitel 1 bis 8
auf den Seiten 1 bis 49, keine Fehler, keine überstehenden Zeilen, keine
offenen Verweise. Bis zur Grenze von 50 Seiten bleibt eine Seite Luft.

## Korrekturen nach der externen Durchsicht (05.10.2026)

- Literaturverzeichnis nach der Confluence-Seite 101351425 neu aufgebaut
  (Hochschule Bremen 2026a bis e, HfG, McKenney ergänzt; Nielsen 1994b und
  1994c über `sorttitle` in der Reihenfolge der Literaturübersicht;
  „Taylor & Francis“ statt Semikolon). Der API-Contract steht bewusst nicht
  im Verzeichnis, Abschnitt 4.1 kennzeichnet ihn als eigene, unveröffentlichte
  Projektdokumentation.
- P17 steht unter H1; H1 ist im eigenen System damit teilweise erfüllt.
- Abbildung 4.3 nachgebessert (Zuweisung abgeben auch aus Eingereicht,
  „Änderungsaufforderung“), Abbildungen 5.1 und 5.2 als lesbare Ausschnitte.
  Die Originale liegen in `langfassung/bilder/`.
- Eigenständigkeitserklärung mit KI-Angabe und Einzelbeiträgen aus Confluence
  (101482498), Titel nach der Genehmigung. Die KI-Angabe nennt auf Wunsch
  der Verfassenden zwei Bereiche: Softwareentwicklung nach eigenen Regeln,
  Skills und Agents sowie Ausformulieren und grammatische Korrektur.

## Was sich mit der Kürzung geändert hat

**Abbildungen.** 12 statt 29. Entfallen sind Doppelungen zwischen Figma und
Screenshot, die zweite Wireframe-Reihe, die Code-Abbildung der Blocktabelle
und die Diagramme, deren Inhalt jetzt in einer Tabelle steht. Abbildungen
werden höchstens 62 Prozent der Satzhöhe hoch gesetzt, damit die
hochformatigen Screenshots auf eine Seite passen.

**Tabellen.** Gekürzt im Haupttext: Tabelle 3.1 führt Heuristiken, Kriterium
und Befund der Referenzplattform zusammen, Tabelle 6.3 Aufgabenkatalog und
Kennzahlen, Tabelle 7.3 Erfüllungsstatus und Befundzahlen, Tabelle 7.4 den
Status aller 60 Anforderungen nach Bereich.

**Zusammenfassungen der Kapitel.** Die Abschnitte 2.6, 3.5, 4.7, 5.4, 6.4 und
7.5 entfallen; nach der Gliederungsseite schließen die Kapitel 1 bis 7 ohne
eigene Zusammenfassung, die Antworten stehen in 8.1.

**Vorspann.** Die Zusammenfassung ist aus Confluence übernommen (Seite
101416961), nur die deutsche Fassung; ein Abstract steht nicht mehr in der
Arbeit. Die Eigenständigkeitserklärung steht im PDF und muss unterschrieben werden;
fehlt sie bei der Abgabe, gilt die Thesis als nicht bestanden.

**Anhänge A bis C** sind vollständig aus Confluence übernommen.

Platzhalter erscheinen als grauer Kasten im PDF. Vor der Abgabe darf keiner
mehr darin stehen. Zum Ausblenden in `Thesis.tex` die Zeile
`\newcommand{\platzhalterAn}{}` auskommentieren.

## Literaturverzeichnis

Die Belege stehen im Text noch als reiner Text, genau wie in Confluence.
`\nocite{*}` in `Thesis.tex` sorgt dafür, dass trotzdem alle Einträge aus
`literatur/literatur.bib` im Verzeichnis erscheinen.

Fünf Einträge sind aus den PDFs im Projektordner übernommen und stimmen:
Davis (1989), Mahasneh (2020), Lorenzo und Ittelson (2005), Shroff et al.
(2011), Nielsen und Molich (1990). Die übrigen acht sind nach den Angaben in
den Kapiteln angelegt und vor der Abgabe gegen die Confluence-Seite
„Literaturübersicht" (2097153) zu prüfen.

## Was wo geändert wird

Alle Angaben des Deckblatts stehen als Makros oben in `Thesis.tex`.
`vorlagen/titelseite.tex` selbst wird nicht angefasst.

Der Titel stammt aus der Genehmigung des Prüfungsamtes vom 17.06.2026:
„Entwicklung eines studentischen E-Portfolio-Portals für die Hochschule
Bremen".

## Seitenzahlen

Deckblatt ohne Zahl, Vorspann römisch, ab Kapitel 1 arabisch mit Neustart
bei 1. Kopfzeile links mit der Kapitelangabe und Linie darunter, Seitenzahl
mittig im Fuß. Auf Kapitelanfangsseiten entfällt die Kopfzeile.
