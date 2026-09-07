# Testmaterial: Druckvorlagen für die Usability-Testwoche

20 Word-Dateien, direkt zum Drucken. Dieselben Dateien hängen in Confluence an der Seite,
die sie beschreibt, damit beide Beteiligten sie haben.

## Was die Testperson bekommt

| Datei | Wie oft | Seiten | Confluence |
| --- | --- | --- | --- |
| `00_Druckanleitung.docx` | einmal lesen | 2 | 4 Druckvorlagen |
| `01_Einwilligung.docx` | je Sitzung **zweimal** | 1 | 4 Druckvorlagen |
| `02_Kurzbogen.docx` | je Sitzung | 1 | 4 Druckvorlagen |
| `03_Aufgabenkarten_Block_A.docx` | einmal für die Woche | 5 | 4 Druckvorlagen |
| `04_Aufgabenkarten_Block_B.docx` | einmal, Karte B1 je Sitzung neu | 7 | 4 Druckvorlagen |
| `05_Aufgabenkarten_Block_C.docx` | einmal für die Woche | 5 | 4 Druckvorlagen |
| `06_Aufgabenkarten_Block_D.docx` | einmal für die Woche | 6 | 4 Druckvorlagen |
| `07_SUS-Bogen.docx` | je Sitzung | 1 | 4 Druckvorlagen |
| `08_TAM-Bogen_Fassung_A.docx` | TN08 und TN11 | 4 | 4 Druckvorlagen |
| `09_TAM-Bogen_Fassung_B.docx` | TN00 bis TN05 | 4 | 4 Druckvorlagen |
| `10_TAM-Bogen_Fassung_C.docx` | TN06 und TN07 | 4 | 4 Druckvorlagen |
| `11_TAM-Bogen_Fassung_D.docx` | TN09 und TN10 | 4 | 4 Druckvorlagen |

Eine Aufgabenkarte ist eine ganze Seite. Es wird nichts ausgeschnitten.

## Was die Testleitung braucht

| Datei | Wie oft | Seiten | Wer hält es |
| --- | --- | --- | --- |
| `12_Moderation.docx` | je Sitzung | 7 | Moderation |
| `13_Protokoll_Block_A_und_B.docx` | TN00 bis TN05 | 4 | Protokoll |
| `14_Protokoll_Block_A_und_C.docx` | TN06 und TN07 | 3 | Protokoll |
| `15_Protokoll_Block_A_und_D.docx` | TN09 und TN10 | 4 | Protokoll |
| `16_Protokoll_nur_Block_A_extern.docx` | TN08 und TN11 | 3 | Protokoll |
| `17_Vor_der_Sitzung.docx` | je Testtag | 3 | Testumgebung |
| `18_Zugangsdatenblatt.docx` | je Testtag, danach vernichten. Nicht bei TN08 und TN11 | 1 (quer) | Moderation |
| `19_Nach_der_Sitzung.docx` | je Testtag, enthält das Rücksetzprotokoll | 2 | beide Rollen |

Rolle, Blöcke und TAM-Fassung sind in den vier Protokollfassungen bereits vorgedruckt.

Auf dem Protokoll wird je Aufgabe **ein Kreuz** in einer von drei Spalten gesetzt: geschafft,
mit Mühe, nicht geschafft. Welche Wertung gilt, sagt die Moderation laut an. Zu merken sind nur
zwei Kürzel: **N** für einen falschen Weg, **E** für eine Überraschung. Alles Übrige wird in
normalen Worten mit Zeitmarke notiert. Fehlversuche kommen als Strichliste in die eigene Spalte.

## Vor dem ersten Druck ausfüllen

Sieben Stellen in den Aufgabenkarten stehen in roten eckigen Klammern. Sie werden in Word
durch den echten Wert ersetzt. Eine Karte mit roter Klammer darf nicht auf den Tisch.

| Karte | Wert |
| --- | --- |
| `A2` | Baustoffbörse |
| `A3` | Elektrotechnik und Informatik, WiSe 2025/26 |
| `B1` | beide Adressen und das Passwort des Testkontos, je Sitzung neu |
| `B2` | ein frei gewählter Projekttitel |
| `C2` | Zahlungsbereitschaft für regionale Milch in Bremen |
| `C3` | Wiederverwendung von Ziegeln aus einem Abbruch in Walle |
| `D2` | Nele Ostermann |

Diese Werte legt der Seed-Bestand fest. Sie werden am Ende jedes Laufs von Menüpunkt `s3`
in `eportfolio.ps1` ausgegeben, die Titel für `C2` und `C3` auch von `s5`. Wird der Bestand
inhaltlich neu aufgesetzt, gilt die Ausgabe des Skripts und nicht diese Tabelle. Auf der
Karte `A3` steht der Name der Fakultät und nicht das Kürzel FK4: in der Filterleiste steht
der Name.

## Nach dem Pilottest neu erzeugen

Ändert der Pilottest an Tag 2 einen Wortlaut oder ein Zeitbudget, wird zuerst der
Aufgabenkatalog in Confluence geändert. Danach lassen sich die Dateien neu erzeugen:

```bash
pip install python-docx
cd Testmaterial/_generator
python make_docs.py
```

Das Skript schreibt alle 20 Dateien nach `Testmaterial/` und überschreibt die alten. Die
Aufgabentexte stehen in `_generator/aufgaben.py`, die Bogenitems in `_generator/p4_druck.py`,
die Blätter der Testleitung in `_generator/docs_leitung.py`. Werden sie geändert, müssen sie
in Confluence ebenfalls nachgezogen werden.

## Woher der Datenbestand kommt

Nicht von Hand. Das Menü `eportfolio.ps1` im Wurzelverzeichnis führt die Gruppe `s1` bis
`s7`: `s1` legt die Stammdaten an (Fakultäten, Studiengänge, Module), `s3` den gemeinsamen
Testbestand, `s5` je Sitzung Konto und Rollenblock, `s7` zählt gegen die Seed-Prüfliste. Zu
jedem Punkt gibt es einen zum Entfernen. Die Betriebsart muss ARTIFACT sein. Begründung und
Sollzahlen stehen in Confluence auf „Vorlauf 2“, Abschnitt 9.

`s5` ist zugleich der Rücksetzschritt zwischen zwei Sitzungen: der Lauf räumt die vorige
Sitzung desselben Pseudonyms weg und stellt in einem Zug her, was der nächste Rollenblock
braucht.

## Was hier nicht liegt

Die Begründungen hinter den Regeln, der Aufgabenkatalog mit Fokus und Bezug je Aufgabe, die
Sitzungsübersicht mit dem Terminplan und die Auswertung. Das steht in Confluence im Bereich
„Sitzung durchführen“ und in den Nachlauf-Seiten.
