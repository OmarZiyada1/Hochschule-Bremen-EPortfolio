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
| `04_Aufgabenkarten_Block_B.docx` | einmal für die Woche, Karte B1 nur als Vorlage | 7 | 4 Druckvorlagen |
| `_sitzung/B1_TN..docx` | je Sitzung eine, danach vernichten | 1 | entsteht auf Aufruf |
| `05_Aufgabenkarten_Block_C.docx` | einmal für die Woche, Karte C1 nur als Vorlage | 6 | 4 Druckvorlagen |
| `_sitzung/C1_TN..docx` | je Sitzung eine, danach vernichten | 1 | entsteht auf Aufruf |
| `06_Aufgabenkarten_Block_D.docx` | einmal für die Woche, Karte D1 nur als Vorlage | 7 | 4 Druckvorlagen |
| `_sitzung/D1_TN..docx` | je Sitzung eine, danach vernichten | 1 | entsteht auf Aufruf |
| `07_SUS-Bogen.docx` | je Sitzung | 1 | 4 Druckvorlagen |
| `08_TAM-Bogen_Fassung_A.docx` | TN08 und TN11 | 4 | 4 Druckvorlagen |
| `09_TAM-Bogen_Fassung_B.docx` | TN01 bis TN05 | 4 | 4 Druckvorlagen |
| `10_TAM-Bogen_Fassung_C.docx` | TN06 und TN07 | 4 | 4 Druckvorlagen |
| `11_TAM-Bogen_Fassung_D.docx` | TN09 und TN10 | 4 | 4 Druckvorlagen |

Eine Aufgabenkarte ist eine ganze Seite. Es wird nichts ausgeschnitten.

## Was die Testleitung braucht

| Datei | Wie oft | Seiten | Wer hält es |
| --- | --- | --- | --- |
| `12_Moderation.docx` | je Sitzung | 7 | Moderation |
| `13_Protokoll_Block_A_und_B.docx` | TN01 bis TN05 | 4 | Protokoll |
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

## Was auf den Karten schon steht

Die Aufgabenkarten sind fertig. In Word ist nichts nachzutragen: die Werte, die der
Seed-Bestand festlegt, sind eingedruckt. Diese Tabelle sagt nur, welcher Wert wo steht,
damit sich das nach einem neu aufgesetzten Bestand nachprüfen lässt.

| Karte | Wert |
| --- | --- |
| `A2` | Baustoffbörse |
| `A3` | Elektrotechnik und Informatik, WiSe 2025/26 |
| `B2` | Lastenrad-Verleih im Bremer Westen |
| `C3` | Zahlungsbereitschaft für regionale Milch in Bremen |
| `C4` | Wiederverwendung von Ziegeln aus einem Abbruch in Walle |
| `C6` | Audiowalk zur Werftgeschichte in Gröpelingen |
| `D3` | Nele Ostermann |
| `D4` | Studienprojekt, Studentisches Projekt |

Dieselben Werte stehen im Moderationsblatt, Abschnitt 9, als Startzustand von `A5`, `C3`,
`C4`, `C5`, `C6` und `D4`. Gepflegt werden sie an einer einzigen Stelle: `_generator/werte.py`. Der
Aufgabenkatalog in `_generator/aufgaben.py` bleibt allgemein, wortgleich mit Confluence,
und behält seine Platzhalter.

Menüpunkt `s3` in `eportfolio.ps1` gibt diese Werte am Ende jedes Laufs aus, die Titel für
`C3`, `C4` und `C6` auch `s5`. Weicht die Ausgabe des Skripts von der Tabelle ab, gilt das
Skript: dann wird `werte.py` nachgezogen und neu erzeugt. Auf der Karte `A3` steht der Name
der Fakultät und nicht das Kürzel FK4, weil in der Filterleiste der Name steht.

## Die drei Karten, die offen bleiben: `B1`, `C1` und `D1`

Auf den Anmeldekarten `B1`, `C1` und `D1` stehen die Anmeldeadresse des Testkontos und das
Passwort; die Hochschuladresse steht nicht darauf, weil sie zum Anmelden nicht gebraucht
wird. Das Passwort gehört nicht ins Repository, deshalb liegen die Karten in
`04_Aufgabenkarten_Block_B.docx`, `05_Aufgabenkarten_Block_C.docx` und
`06_Aufgabenkarten_Block_D.docx` nur als Vorlage mit zwei Linien. Die ausgefüllten Karten,
`B1` für `TN01` bis `TN05`, `C1` für `TN06` und `TN07`, `D1` für `TN09` und `TN10`,
entstehen auf Aufruf:

```bash
cd Testmaterial/_generator
python make_docs.py --passwort            # Wert aus DEV_TEST_PASSWORD der .env
python make_docs.py --passwort geheim123  # oder ein Wert von Hand
```

Sie landen in `Testmaterial/_sitzung/` als `B1_TN01.docx` bis `B1_TN05.docx` sowie
`C1_TN06.docx`, `C1_TN07.docx`, `D1_TN09.docx` und `D1_TN10.docx`, einzeln, damit je Sitzung genau eine gedruckt wird. Der Ordner ist von der Versionsverwaltung
ausgenommen. Die gedruckte Karte wird nach der Sitzung vernichtet, wie das Blatt
„Nach der Sitzung“ es in Abschnitt 1 verlangt.

## Neu erzeugen

Ändert sich ein Wortlaut oder ein Zeitbudget, wird zuerst der
Aufgabenkatalog in Confluence geändert. Danach lassen sich die Dateien neu erzeugen:

```bash
pip install python-docx
cd Testmaterial/_generator
python make_docs.py
```

Das Skript schreibt alle 20 Dateien nach `Testmaterial/` und überschreibt die alten. Die
Aufgabentexte stehen in `_generator/aufgaben.py`, die eingesetzten Werte in
`_generator/werte.py`, die Bogenitems in `_generator/p4_druck.py`, die Blätter der
Testleitung in `_generator/docs_leitung.py`. Werden die Texte geändert, müssen sie in
Confluence ebenfalls nachgezogen werden; `werte.py` steht nur hier, weil es den
Datenbestand beschreibt und nicht die Aufgabe.

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
