#!/usr/bin/env python3
"""Werkzeug fuer das Schreiben der Thesis-Kapitel (Skill thesis-schreiben).

Drei Aufgaben, die von Hand jedes Mal schiefgehen:

`lint`     prueft eine Kapitel-Arbeitsdatei gegen die Schreibregeln des Skills.
           Die Regeln stehen in SKILL.md als Prosa; hier stehen sie als Test,
           damit sie beim Schreiben nicht in Vergessenheit geraten.
`umfang`   zaehlt Woerter je Abschnitt und stellt sie dem Zielkorridor des
           Kapitels gegenueber. Ohne Zahl faellt erst am Ende auf, dass ein
           Kapitel halb so lang ist wie geplant.
`storage`  uebersetzt die Arbeitsdatei (Markdown) in Confluence-Storage-XHTML,
           damit `contract.py --page <id> set-body` sie speichern kann.
`attach`   haengt eine Bilddatei an eine Kapitelseite, damit der Bildverweis aus
           `storage` auch etwas anzeigt. Ohne diesen Schritt steht in Confluence
           ein leerer Rahmen, und der Fehler faellt erst beim Pruefer auf.

Nur Standardbibliothek, damit keine neue Abhaengigkeit entsteht
(CLAUDE.md, Backend-Regel 9). Den Seitentext holt und speichert weiterhin
`contract.py`; ins Netz greift hier allein `attach`, mit denselben Zugangsdaten
aus `.env.atlassian`. Das Token wird nie ausgegeben.
"""

from __future__ import annotations

import argparse
import html.entities
import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
	sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
	sys.stderr.reconfigure(encoding="utf-8", errors="replace")

WOERTER_JE_SEITE = 300
SEITENZIEL = (70, 85)

# Zielkorridor je Kapitel in Woertern. Die Verteilung folgt der Gliederung des
# unterschriebenen Exposes v3 und der Vorgabe des Zweitpruefers, dass die
# Ergebnisse der Kern der Forschung sind: Kapitel 6 und 7 tragen zusammen so
# viel wie Kapitel 4 und 5. Die Summen treffen SEITENZIEL, `korridore` prueft es.
#
# Seit dem 26.09.2026 traegt Kapitel 8 einen groesseren Korridor: Die Kapitel 1
# bis 7 schliessen seit dem 23.09.2026 ohne eigene Zusammenfassung (Vermerk auf
# der Gliederungsseite), die Antworten auf alle Teilfragen stehen allein in 8.1.
# Die Korridore der uebrigen Kapitel bleiben bewusst unveraendert. Ihre Summe
# liegt damit bei 72,2 bis 87,0 Seiten und ueber SEITENZIEL; `korridore` meldet
# das mit Absicht als Befund, entschieden am 26.09.2026. Massgeblich ist der
# gemessene Umfang der Kapitel, an diesem Tag rund 82 Seiten.
KORRIDOR = {
	1: (1550, 1800),
	2: (2700, 3200),
	3: (3150, 3800),
	4: (3500, 4200),
	5: (2850, 3450),
	6: (2700, 3300),
	7: (3500, 4250),
	8: (1700, 2100),
}

# Nachnamen, die als Beleg auftreten duerfen. Alles andere ist entweder ein
# Tippfehler oder eine erfundene Quelle, und beides muss auffallen.
# Gefuehrt in der Literaturuebersicht, Seite 2097153.
KERNQUELLEN = {
	"Nielsen",
	"Molich",
	"Davis",
	"Lorenzo",
	"Ittelson",
	"Mahasneh",
	"Shroff",
	"Deneen",
	"Ng",
	"Brooke",
	"McKenney",
	"Bosch",
	# Die Namenserkennung liest bei "Van den Bosch et al." nur das erste Wort.
	"Van",
	"W3C",
	"WCAG",
	"Sauro",
	# Seit 03.09.2026 in der Literaturuebersicht gefuehrt (Kuerzel LS18). Traegt
	# den SUS-Zielwert von 68 Punkten und ersetzt darin Sauro (2011), das als
	# kostenpflichtiger Selbstverlag nicht im Volltext vorlag.
	"Lewis",
	# Die Hochschule selbst als Primaerquelle der Ordnungsstruktur aus fuenf
	# Fakultaeten, 75 Studiengaengen und den Modullisten (Kuerzel HSB26,
	# eingetragen am 03.09.2026). Beide Woerter, weil der Beleg im Text
	# "(Hochschule Bremen, 2026)" lautet.
	"Hochschule",
	"Bremen",
	# Primaerquellen der drei Sekundaerzitate, seit 02.10.2026 in der
	# Literaturuebersicht gefuehrt (Kuerzel Kah01, ePo03, SL16). Im Text stehen
	# sie nur mit "zitiert nach" Lorenzo und Ittelson (2005) bzw. Lewis und
	# Sauro (2018). "PortConsortium" deckt ab, dass die Namenserkennung des
	# Linters erst ab dem ersten Grossbuchstaben liest.
	"Kahn",
	"ePortConsortium",
	"PortConsortium",
}
# Belegt, aber noch nicht in der Literaturuebersicht gefuehrt. Erlaubt, mit
# Hinweis, damit die Tabelle in Confluence nachgezogen wird. Bangor, Kortum,
# Miller, Landauer und Sauro stammen aus dem Testplan vom 29.08.2026.
RANDQUELLEN = {
	"Bringhurst",
	"Wertheimer",
	"Bangor",
	"Kortum",
	"Miller",
	"Landauer",
	"ISO",
	"WAI",
}
# Woerter, die in einer Klammer vor einer Jahreszahl stehen koennen, ohne ein
# Nachname zu sein. Ohne sie meldet der Linter "(Stand 2026)" als erfundene Quelle.
STOPWOERTER = {
	"Stand", "Kapitel", "Abschnitt", "Contract", "Seite", "Seiten", "Version",
	"Abbildung", "Tabelle", "Anhang", "Jahr", "Quelle", "Fassung", "Exposé",
	"Sommersemester", "Wintersemester", "Januar", "Februar", "März", "April",
	"Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember",
}

# Regulaere Ausdruecke, kleingeschrieben geprueft. Als Muster statt als feste
# Zeichenkette, damit Beugungen mitgehen (spielt/spielen).
FLOSKELN = [
	r"spiel(?:t|en) eine (?:entscheidende|zentrale|wichtige|wesentliche|große) rolle",
	r"nimmt eine (?:zentrale|entscheidende) rolle ein",
	"ganzheitlicher ansatz",
	"ganzheitliche betrachtung",
	"tiefes eintauchen",
	"facettenreich",
	"vielschichtig und",
	"essenziell",
	"essentiell",
	"von grundlegender bedeutung",
	"von zentraler bedeutung",
	"von entscheidender bedeutung",
	"nicht zuletzt",
	"in der heutigen zeit",
	"in der heutigen digitalen welt",
	"im zeitalter der digitalisierung",
	"zusammenfassend laesst sich sagen",
	"zusammenfassend lässt sich sagen",
	"zusammenfassend lässt sich festhalten",
	"abschliessend laesst sich",
	"abschließend lässt sich",
	"es sei angemerkt, dass",
	"es ist wichtig zu betonen",
	"es gilt zu betonen",
	"letztendlich zeigt sich",
	"insgesamt zeigt sich, dass",
	"eine schluesselrolle",
	"eine schlüsselrolle",
	"maßgeschneidert",
	"nahtlos integriert",
	"das herzstueck",
	"das herzstück",
	"ein wesentlicher baustein",
	"in diesem sinne",
	"vor diesem hintergrund lässt sich festhalten",
]

META_EINLEITUNG = re.compile(
	r"^(Im Folgenden|Nachfolgend|Im Anschluss daran|Zunächst einmal|"
	r"In diesem (Kapitel|Abschnitt) (wird|werden|soll|sollen)|"
	r"Dieses Kapitel (beschäftigt|befasst|widmet|behandelt|stellt|gibt)|"
	r"Dieser Abschnitt (beschäftigt|befasst|widmet|behandelt|stellt|gibt)|"
	r"Bevor (im Folgenden|nun)|Wie eingangs erwähnt)",
	re.IGNORECASE,
)

UEBERTREIBUNG = re.compile(
	r"\b(drastisch\w*|enorm\w*|bahnbrechend\w*|revolutionär\w*|immens\w*|"
	r"gewaltig\w*|äußerst|überaus|hochgradig|massiv\w*|erheblich verbessert|"
	r"deutlich überlegen|perfekt\w*|optimal\w*|nahtlos)\b",
	re.IGNORECASE,
)

# „meinen“ und „meint“ bleiben aussen vor: das Verb kollidiert mit dem Pronomen.
ICH_WIR = re.compile(r"\b(ich|mir|mich|wir|uns|unser(?:e[rsnm]?)?|mein(?:e[rsm]?)?)\b", re.IGNORECASE)

PLATZHALTER = re.compile(r"\[(Beleg erforderlich|Quelle:|Platzhalter|TODO|offen:)[^\]]*\]", re.IGNORECASE)

# Dreiergruppe: „A, B und C“, jedes Glied hoechstens drei Woerter lang.
DREIERGRUPPE = re.compile(
	r"\b([\wäöüßÄÖÜ]+(?:\s+[\wäöüßÄÖÜ]+){0,2}),\s+([\wäöüßÄÖÜ]+(?:\s+[\wäöüßÄÖÜ]+){0,2})\s+und\s+([\wäöüßÄÖÜ]+(?:\s+[\wäöüßÄÖÜ]+){0,2})\b"
)

ZITAT_KLAMMER = re.compile(r"\(([^()]{2,80}?),\s*((?:1[89]|20)\d{2})[^)]*\)")
ZITAT_JAHR = re.compile(
	r"\b([A-ZÄÖÜ][A-Za-z0-9äöüßÄÖÜ\-]+"
	r"(?:\s+(?:und|&)\s+[A-ZÄÖÜ][A-Za-z0-9äöüßÄÖÜ\-]+)?"
	r"(?:\s+et\s+al\.)?)\s*\(((?:1[89]|20)\d{2})\)"
)

# Nachnamen in einem Beleg. Ziffern sind zugelassen, sonst faellt "W3C" heraus
# und der Eintrag in KERNQUELLEN waere toter Code.
NAME_IM_BELEG = re.compile(r"[A-ZÄÖÜ][A-Za-z0-9äöüßÄÖÜ\-]+")

DOPPELWORT = re.compile(r"\b([A-Za-zÄÖÜäöüß]{3,})\s+\1\b")
DOPPELTES_LEERZEICHEN = re.compile(r"\S {2,}\S")
LEER_VOR_SATZZEICHEN = re.compile(r"\s[,.;:!?]")
FEHLENDES_LEERZEICHEN = re.compile(r"[a-zäöüß][,;][A-Za-zÄÖÜäöüß]|[a-zäöüß]:(?!in)[A-Za-zÄÖÜäöüß]|[a-zäöüß]{2,}\.[A-ZÄÖÜ]")

SATZENDE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÄÖÜ„])")


# ------------------------------------------------------------------ Grundlagen


def die(message: str) -> "NoReturn":  # type: ignore[valid-type]
	print("FEHLER: " + message, file=sys.stderr)
	raise SystemExit(1)


def lies(pfad: Path) -> list[str]:
	if not pfad.is_file():
		die("Datei nicht gefunden: %s" % pfad)
	return pfad.read_text(encoding="utf-8").splitlines()


def kapitelnummer(pfad: Path, angabe: int | None) -> int | None:
	if angabe:
		return angabe
	treffer = re.search(r"(\d+)", pfad.stem)
	if treffer:
		nummer = int(treffer.group(1))
		if nummer in KORRIDOR:
			return nummer
	return None


def klassifiziere(zeilen: list[str]) -> list[str]:
	"""Je Zeile eine Art: code, heading, table, list, comment, quote, blank, text."""
	arten: list[str] = []
	im_code = False
	for zeile in zeilen:
		blank = zeile.strip()
		if blank.startswith("```"):
			im_code = not im_code
			arten.append("code")
			continue
		if im_code:
			arten.append("code")
		elif not blank:
			arten.append("blank")
		elif blank.startswith("<!--"):
			arten.append("comment")
		elif blank.startswith("#"):
			arten.append("heading")
		elif blank.startswith("|"):
			arten.append("table")
		elif blank.startswith(">"):
			arten.append("quote")
		elif re.match(r"^([-*+]\s|\d+[.)]\s)", blank):
			arten.append("list")
		elif blank.startswith("[[abbildung:") or blank.startswith("[[tabelle:"):
			arten.append("figure")
		else:
			arten.append("text")
	return arten


def roh_felder(zeile: str) -> list[str]:
	"""Felder eines Bildplatzes `[[abbildung: nr | titel | herkunft | datei]]`."""
	inhalt = zeile.strip()[2:-2]
	_, _, rest = inhalt.partition(":")
	return [feld.strip() for feld in rest.split("|")]


def woerter(text: str) -> int:
	return len(re.findall(r"[^\W\d_][\w\-äöüßÄÖÜ]*", text))


def sprachpruefung(zeilen: list[str], arten: list[str], befunde: "Befunde") -> None:
	"""Mechanische Fehler, die eine Rechtschreibpruefung sonst erst spaet findet.

	Ersetzt keine Rechtschreibpruefung. Der Zweitpruefer verlangt saubere
	Rechtschreibung, Grammatik und Formulierung; was ohne Woerterbuch pruefbar
	ist, wird hier geprueft, der Rest bleibt Aufgabe von Mensch und Programm.
	"""
	for i, zeile in enumerate(zeilen):
		if arten[i] not in ("text", "quote", "list", "heading", "table"):
			continue
		nummer = i + 1
		treffer = DOPPELWORT.search(zeile)
		if treffer:
			befunde.add("BEFUND", nummer, "doppelwort", "Wort doppelt: „%s“." % treffer.group(1))
		if DOPPELTES_LEERZEICHEN.search(zeile):
			befunde.add("BEFUND", nummer, "leerzeichen", "Zwei Leerzeichen hintereinander.")
		if LEER_VOR_SATZZEICHEN.search(zeile):
			befunde.add("BEFUND", nummer, "leerzeichen", "Leerzeichen vor einem Satzzeichen.")
		treffer = FEHLENDES_LEERZEICHEN.search(zeile)
		if treffer:
			befunde.add("PRUEFEN", nummer, "leerzeichen", "Fehlendes Leerzeichen nach einem Satzzeichen: „%s“." % treffer.group(0))
		if zeile.count("(") != zeile.count(")"):
			befunde.add("BEFUND", nummer, "klammer", "Unbalancierte runde Klammern in dieser Zeile.")
		if zeile.count("„") != zeile.count("“"):
			befunde.add("BEFUND", nummer, "anfuehrung", "Unbalancierte deutsche Anführungszeichen in dieser Zeile.")


# ------------------------------------------------------------------ Befund lint


class Befunde:
	def __init__(self) -> None:
		self.eintraege: list[tuple[str, int, str, str]] = []

	def add(self, stufe: str, zeile: int, code: str, text: str) -> None:
		self.eintraege.append((stufe, zeile, code, text))

	def ausgeben(self, datei: Path) -> int:
		hart = [e for e in self.eintraege if e[0] == "BEFUND"]
		weich = [e for e in self.eintraege if e[0] == "PRUEFEN"]
		for stufe, nummer, code, text in sorted(self.eintraege, key=lambda e: (e[1], e[2])):
			print("%s  %s:%d  [%s] %s" % (stufe, datei.name, nummer, code, text))
		print("")
		print("%d Befunde, %d Punkte zum Prüfen." % (len(hart), len(weich)))
		return 1 if hart else 0


def cmd_lint(args: argparse.Namespace) -> None:
	pfad = Path(args.datei)
	zeilen = lies(pfad)
	arten = klassifiziere(zeilen)
	befunde = Befunde()
	fliesstext = [i for i, art in enumerate(arten) if art in ("text", "quote")]
	ganzer_text = "\n".join(zeilen[i] for i in fliesstext)

	for i, zeile in enumerate(zeilen):
		nummer = i + 1
		art = arten[i]
		if art == "code":
			continue

		if "—" in zeile:
			befunde.add("BEFUND", nummer, "gedankenstrich", "Em-Dash „—“ gefunden. CLAUDE.md verbietet ihn überall.")
		if re.search(r"\s–\s", zeile):
			befunde.add("BEFUND", nummer, "halbgeviert", "Halbgeviertstrich „–“ als Stilmittel. Komma, Doppelpunkt oder zwei Sätze verwenden.")
		if re.search(r'["”]', zeile):
			befunde.add("BEFUND", nummer, "anfuehrung", "Gerade oder englische Anführungszeichen. Im Deutschen „so“.")

		if art in ("text", "quote"):
			if re.search(r"\*\*[^*]+\*\*", zeile) or re.search(r"__[^_]+__", zeile):
				befunde.add("BEFUND", nummer, "fettdruck", "Fettdruck im Fließtext. Erlaubt nur in Überschriften und Tabellenköpfen.")
			if META_EINLEITUNG.match(zeile.strip()):
				befunde.add("BEFUND", nummer, "meta", "Meta-Einleitung. Absatz direkt mit dem Argument beginnen.")
			for treffer in UEBERTREIBUNG.finditer(zeile):
				befunde.add("PRUEFEN", nummer, "uebertreibung", "Wertendes Adjektiv „%s“. Relevanz über Sachargumente zeigen." % treffer.group(0))
			for treffer in ICH_WIR.finditer(zeile):
				befunde.add("BEFUND", nummer, "person", "Personalform „%s“. Die Arbeit formuliert unpersönlich („die vorliegende Arbeit“)." % treffer.group(0))
			for treffer in PLATZHALTER.finditer(zeile):
				befunde.add("PRUEFEN", nummer, "platzhalter", "Offener Platzhalter: %s" % treffer.group(0))

		if art == "figure":
			felder = roh_felder(zeile)
			ist_tabelle = zeile.strip().startswith("[[tabelle:")
			if (len(felder) < 4 or not felder[3]) and not ist_tabelle:
				befunde.add("PRUEFEN", nummer, "bildstelle", "Bildplatz ohne Dateiname. Erst `attach`, dann den Dateinamen als viertes Feld eintragen, sonst bleibt in Confluence ein Hinweiskasten stehen.")
			elif len(felder) < 3 or not felder[2]:
				befunde.add("PRUEFEN", nummer, "bildherkunft", "Bildplatz ohne Herkunft. Jede Abbildung nennt ihre Quelle, eigene Darstellungen ausdruecklich.")

		if art == "list":
			befunde.add(
				"PRUEFEN",
				nummer,
				"liste",
				"Aufzählung. Im Haupttext nur zulässig, wenn sie einen Katalog trägt (FA/NFA, Testaufgaben, Rechtematrix) und in Prosa eingeführt und ausgewertet wird.",
			)

		tief = zeile.lower()
		for floskel in FLOSKELN:
			treffer = re.search(floskel, tief)
			if treffer:
				befunde.add("BEFUND", nummer, "floskel", "Floskel „%s“." % treffer.group(0))

	sprachpruefung(zeilen, arten, befunde)

	# Quellen. Geprueft wird JEDER Nachname eines Belegs, nicht nur einer davon:
	# frueher brach die Pruefung bei der ersten bekannten Kernquelle ab, weshalb
	# "Nielsen und Landauer (1993)" durchlief, obwohl Landauer nicht gefuehrt ist.
	vorkommen: dict[str, list[int]] = {}
	for i in fliesstext:
		nummer = i + 1
		zeile = zeilen[i]
		kandidaten: list[str] = []
		for treffer in ZITAT_KLAMMER.finditer(zeile):
			kandidaten.append(treffer.group(1))
		for treffer in ZITAT_JAHR.finditer(zeile):
			kandidaten.append(treffer.group(1))
		for kandidat in kandidaten:
			roh = set(NAME_IM_BELEG.findall(kandidat))
			namen = {n for n in roh if n not in STOPWOERTER}
			if not namen:
				continue
			for name in sorted(namen & (KERNQUELLEN | RANDQUELLEN)):
				vorkommen.setdefault(name, []).append(nummer)
			unbekannt = sorted(namen - KERNQUELLEN - RANDQUELLEN)
			nachzutragen = sorted(namen & RANDQUELLEN)
			if unbekannt:
				befunde.add(
					"BEFUND",
					nummer,
					"quelle-unbekannt",
					"Beleg „%s“: %s gehört zu keiner geführten Quelle. Erfundene Zitate sind ausgeschlossen; sonst Platzhalter [Beleg erforderlich]."
					% (kandidat.strip(), ", ".join(unbekannt)),
				)
			elif nachzutragen:
				befunde.add(
					"PRUEFEN",
					nummer,
					"quelle-neu",
					"Beleg „%s“: %s steht noch nicht in der Literaturübersicht (Seite 2097153). Erst dort eintragen, dann zitieren."
					% (kandidat.strip(), ", ".join(nachzutragen)),
				)

	# Related Work: eine Quelle, die genau einmal vorkommt, wurde eingefuehrt und
	# fallengelassen. Genau das beanstandet der Zweitpruefer.
	umfangreich = woerter(ganzer_text) >= 800
	for name in sorted(vorkommen):
		stellen = vorkommen[name]
		if umfangreich and len(stellen) == 1:
			befunde.add(
				"PRUEFEN",
				stellen[0],
				"related-work",
				"Quelle „%s“ kommt im Kapitel genau einmal vor. Eingeführtes fremdes Wissen wird mit dem eigenen Projekt verbunden und später wieder aufgegriffen, sonst steht es unverbunden da."
				% name,
			)

	# Satzrhythmus und Dreiergruppen ueber den gesamten Fliesstext
	saetze = [s.strip() for s in SATZENDE.split(ganzer_text) if s.strip()]
	laengen = [woerter(s) for s in saetze if woerter(s) > 2]
	if laengen:
		mittel = sum(laengen) / len(laengen)
		abweichung = (sum((laenge - mittel) ** 2 for laenge in laengen) / len(laengen)) ** 0.5
		lang = [laenge for laenge in laengen if laenge > 45]
		print("Satzrhythmus: %d Sätze, im Mittel %.1f Wörter, Streuung %.1f, %d Sätze über 45 Wörter." % (len(laengen), mittel, abweichung, len(lang)))
		if abweichung < 6 and len(laengen) >= 15:
			befunde.add("PRUEFEN", 1, "rhythmus", "Streuung der Satzlänge unter 6 Wörtern. Der Text läuft monoton; kurze Hauptsätze und Satzgefüge mischen.")
		if lang:
			befunde.add("PRUEFEN", 1, "satzlaenge", "%d Sätze über 45 Wörter. Prüfen, ob sie noch lesbar sind." % len(lang))
	gesamt = woerter(ganzer_text)
	dreier = len(DREIERGRUPPE.findall(ganzer_text))
	if gesamt and dreier * 1000 / gesamt > 6:
		befunde.add("PRUEFEN", 1, "dreiergruppe", "%d Dreiergruppen auf %d Wörter. Die „Rule of Three“ wird zum Muster; einige auf zwei oder vier Glieder bringen." % (dreier, gesamt))

	raise SystemExit(befunde.ausgeben(pfad))


# ---------------------------------------------------------------- Befund umfang


def cmd_umfang(args: argparse.Namespace) -> None:
	pfad = Path(args.datei)
	zeilen = lies(pfad)
	arten = klassifiziere(zeilen)
	abschnitte: list[tuple[str, int]] = []
	aktuell = "(vor der ersten Überschrift)"
	zaehler = 0
	for zeile, art in zip(zeilen, arten):
		if art == "heading" and zeile.strip().startswith("## "):
			abschnitte.append((aktuell, zaehler))
			aktuell = zeile.strip().lstrip("#").strip()
			zaehler = 0
		elif art in ("text", "quote", "list", "table", "figure"):
			zaehler += woerter(zeile)
	abschnitte.append((aktuell, zaehler))

	gesamt = sum(anzahl for _, anzahl in abschnitte)
	for name, anzahl in abschnitte:
		if not anzahl and name.startswith("(vor"):
			continue
		anteil = (anzahl * 100 / gesamt) if gesamt else 0
		print("%6d Wörter  %4.1f Seiten  %5.1f %%  %s" % (anzahl, anzahl / WOERTER_JE_SEITE, anteil, name))
	print("")
	print("Summe: %d Wörter, rund %.1f Seiten bei %d Wörtern je Seite." % (gesamt, gesamt / WOERTER_JE_SEITE, WOERTER_JE_SEITE))

	nummer = kapitelnummer(pfad, args.kapitel)
	if nummer:
		unten, oben = KORRIDOR[nummer]
		lage = "im Korridor" if unten <= gesamt <= oben else ("zu kurz" if gesamt < unten else "zu lang")
		print("Kapitel %d: Zielkorridor %d bis %d Wörter (%.0f bis %.0f Seiten). Stand: %s, %+d Wörter zur Untergrenze." % (nummer, unten, oben, unten / WOERTER_JE_SEITE, oben / WOERTER_JE_SEITE, lage, gesamt - unten))
	else:
		print("Kein Kapitel erkannt (Dateiname ohne Nummer). Mit --kapitel <n> angeben.")


def cmd_korridore(args: argparse.Namespace) -> None:
	"""Zeigt die Korridore und prueft, ob ihre Summe das Seitenziel trifft.

	Diese Pruefung gibt es, weil genau hier schon einmal etwas auseinanderlief:
	die Korridore summierten sich auf 79 bis 93 Seiten, waehrend der Skill 70 bis
	85 versprach. Eine Zahl, die niemand nachrechnet, wird irgendwann falsch.
	"""
	unten_ziel, oben_ziel = SEITENZIEL
	unten = sum(k[0] for k in KORRIDOR.values())
	oben = sum(k[1] for k in KORRIDOR.values())
	print("Kapitel   Woerter          Seiten        Anteil")
	for nummer in sorted(KORRIDOR):
		u, o = KORRIDOR[nummer]
		print("   %d      %5d bis %5d   %4.1f bis %4.1f   %4.1f %%" % (nummer, u, o, u / WOERTER_JE_SEITE, o / WOERTER_JE_SEITE, (u + o) * 100 / (unten + oben)))
	print("")
	print("Summe     %5d bis %5d   %4.1f bis %4.1f Seiten" % (unten, oben, unten / WOERTER_JE_SEITE, oben / WOERTER_JE_SEITE))
	print("Ziel                        %4.1f bis %4.1f Seiten" % (unten_ziel, oben_ziel))
	ergebnisse = 100 * sum(KORRIDOR[n][0] + KORRIDOR[n][1] for n in (6, 7)) / (unten + oben)
	entwurf = 100 * sum(KORRIDOR[n][0] + KORRIDOR[n][1] for n in (4, 5)) / (unten + oben)
	print("Ergebnisteil (6 und 7): %.1f %%, Entwurfsteil (4 und 5): %.1f %%" % (ergebnisse, entwurf))
	fehler = []
	if abs(unten / WOERTER_JE_SEITE - unten_ziel) > 1.5:
		fehler.append("Untergrenze verfehlt das Seitenziel um mehr als 1,5 Seiten.")
	if abs(oben / WOERTER_JE_SEITE - oben_ziel) > 1.5:
		fehler.append("Obergrenze verfehlt das Seitenziel um mehr als 1,5 Seiten.")
	if ergebnisse < entwurf - 2:
		fehler.append("Der Ergebnisteil wiegt leichter als der Entwurfsteil. Der Zweitpruefer verlangt das Gegenteil.")
	if fehler:
		for f in fehler:
			print(chr(10) + "BEFUND: " + f)
		raise SystemExit(1)
	print(chr(10) + "In Ordnung: Summen treffen das Seitenziel, Ergebnisteil traegt genug Gewicht.")


# --------------------------------------------------------------- Befund storage


def escape(text: str) -> str:
	return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(text: str) -> str:
	text = escape(text)
	text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
	text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
	text = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", text)
	text = re.sub(r"(?<![\w_])_([^_\n]+)_(?![\w_])", r"<em>\1</em>", text)
	text = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', text)
	return text


def entitaeten(text: str) -> str:
	"""Nicht-ASCII in benannte Entities, wie es die vorhandenen Seiten halten."""
	stuecke: list[str] = []
	for zeichen in text:
		punkt = ord(zeichen)
		if punkt < 128:
			stuecke.append(zeichen)
			continue
		name = html.entities.codepoint2name.get(punkt)
		if name and (name + ";") in html.entities.html5:
			stuecke.append("&%s;" % name)
		else:
			stuecke.append(zeichen)
	return "".join(stuecke)


def tabelle(block: list[str]) -> str:
	reihen = [[zelle.strip() for zelle in zeile.strip().strip("|").split("|")] for zeile in block]
	kopf = bool(len(reihen) > 1 and all(re.fullmatch(r":?-{2,}:?", zelle) for zelle in reihen[1]))
	teile = ["<table><tbody>"]
	for index, reihe in enumerate(reihen):
		if kopf and index == 1:
			continue
		tag = "th" if (kopf and index == 0) else "td"
		teile.append("<tr>" + "".join("<%s><p>%s</p></%s>" % (tag, inline(zelle), tag) for zelle in reihe) + "</tr>")
	teile.append("</tbody></table>")
	return "".join(teile)


def attribut(text: str) -> str:
	return escape(text).replace('"', "&quot;")


def abbildung(zeile: str) -> str:
	"""`[[abbildung: 4.2 | Titel | Herkunft | datei.png]]` nach Storage.

	Mit Dateinamen entsteht ein echter Bildverweis auf einen Seitenanhang, den
	`attach` vorher hochgeladen hat. Ohne Dateinamen bleibt bewusst ein
	sichtbarer Hinweiskasten stehen: eine offene Bildstelle soll in Confluence
	auffallen und nicht als stiller Leerraum durchgehen.
	"""
	inhalt = zeile.strip()[2:-2]
	art, _, rest = inhalt.partition(":")
	felder = [feld.strip() for feld in rest.split("|")]
	nummer = felder[0] if felder else "?"
	titel = felder[1] if len(felder) > 1 else "Titel offen"
	herkunft = felder[2] if len(felder) > 2 else "Herkunft offen"
	datei = felder[3] if len(felder) > 3 else ""
	wort = "Abbildung" if art.strip() == "abbildung" else "Tabelle"
	beschriftung = "%s %s: %s" % (wort, nummer, titel)

	if not datei:
		# Eine Tabelle steht im Kapiteltext als echte Tabelle und braucht kein
		# Bild. Ihr Platzhalter traegt deshalb nur die Beschriftung, die sonst
		# als Fettdruck im Fliesstext stehen muesste und dort ein Befund waere.
		if art.strip() == "tabelle":
			return "<p><strong>%s</strong> (%s)</p>" % (inline(beschriftung), inline(herkunft))
		hinweis = "%s (%s) [Bilddatei fehlt noch]" % (beschriftung, herkunft)
		return (
			'<ac:structured-macro ac:name="info" ac:schema-version="1">'
			"<ac:rich-text-body><p><strong>%s</strong></p></ac:rich-text-body>"
			"</ac:structured-macro>" % inline(hinweis)
		)

	return (
		'<p><ac:image ac:align="center" ac:layout="center" ac:alt="%s">'
		'<ri:attachment ri:filename="%s" /></ac:image></p>'
		"<p><strong>%s</strong> (%s)</p>"
		% (attribut("%s: %s" % (beschriftung, herkunft)), attribut(datei), inline(beschriftung), inline(herkunft))
	)


def codeblock(sprache: str, block: list[str]) -> str:
	sprache = sprache.strip() or "text"
	return (
		'<ac:structured-macro ac:name="code" ac:schema-version="1">'
		'<ac:parameter ac:name="language">%s</ac:parameter>'
		"<ac:plain-text-body><![CDATA[%s]]></ac:plain-text-body>"
		"</ac:structured-macro>" % (sprache, "\n".join(block).replace("]]>", "]] >"))
	)


def nach_storage(zeilen: list[str]) -> str:
	arten = klassifiziere(zeilen)
	teile: list[str] = []
	i = 0
	while i < len(zeilen):
		zeile = zeilen[i]
		art = arten[i]
		roh = zeile.strip()

		if art == "comment" or (art == "blank"):
			i += 1
			continue

		if roh.startswith("```"):
			sprache = roh[3:]
			block: list[str] = []
			i += 1
			while i < len(zeilen) and not zeilen[i].strip().startswith("```"):
				block.append(zeilen[i])
				i += 1
			i += 1
			teile.append(codeblock(sprache, block))
			continue

		if art == "heading":
			ebene = len(roh) - len(roh.lstrip("#"))
			ebene = min(max(ebene, 1), 6)
			teile.append("<h%d>%s</h%d>" % (ebene, inline(roh.lstrip("#").strip()), ebene))
			i += 1
			continue

		if art == "figure":
			teile.append(abbildung(roh))
			i += 1
			continue

		if art == "table":
			block = []
			while i < len(zeilen) and arten[i] == "table":
				block.append(zeilen[i])
				i += 1
			teile.append(tabelle(block))
			continue

		if art == "list":
			geordnet = bool(re.match(r"^\d+[.)]\s", roh))
			block = []
			while i < len(zeilen) and arten[i] == "list":
				block.append(re.sub(r"^([-*+]|\d+[.)])\s+", "", zeilen[i].strip()))
				i += 1
			tag = "ol" if geordnet else "ul"
			teile.append("<%s>%s</%s>" % (tag, "".join("<li><p>%s</p></li>" % inline(eintrag) for eintrag in block), tag))
			continue

		if art == "quote":
			block = []
			while i < len(zeilen) and arten[i] == "quote":
				block.append(zeilen[i].strip().lstrip(">").strip())
				i += 1
			teile.append("<blockquote><p>%s</p></blockquote>" % inline(" ".join(block)))
			continue

		block = []
		while i < len(zeilen) and arten[i] == "text":
			block.append(zeilen[i].strip())
			i += 1
		if block:
			teile.append("<p>%s</p>" % inline(" ".join(block)))

	return "".join(teile)


def cmd_storage(args: argparse.Namespace) -> None:
	pfad = Path(args.datei)
	zeilen = lies(pfad)
	koerper = nach_storage(zeilen)
	if "—" in koerper:
		die("Em-Dash im Ergebnis. Erst `lint` grün bekommen.")
	if not args.roh:
		koerper = entitaeten(koerper)
	ziel = Path(args.out) if args.out else pfad.with_suffix(".xhtml")
	ziel.write_text(koerper, encoding="utf-8", newline="")
	print("Geschrieben: %s (%d Zeichen)" % (ziel, len(koerper)))
	print("Nächster Schritt:")
	print("  py .claude/skills/api-contract-sync/contract.py --page <id> pull --force")
	print("  py .claude/skills/api-contract-sync/contract.py --page <id> set-body --file %s" % ziel)
	print("  py .claude/skills/api-contract-sync/contract.py --page <id> check --shrink-limit 100000")
	print("  py .claude/skills/api-contract-sync/contract.py --page <id> diff --plain")
	print("  py .claude/skills/api-contract-sync/contract.py --page <id> push --message \"...\"")


# ---------------------------------------------------------------- Befund attach


def zugangsdaten(env_datei: Path | None) -> tuple[str, str, str]:
	"""Wie in contract.py: `.env.atlassian` im Wurzelverzeichnis, Umgebung zuerst."""
	pfad = env_datei or (Path(__file__).resolve().parents[3] / ".env.atlassian")
	werte: dict[str, str] = {}
	if pfad.is_file():
		for zeile in pfad.read_text(encoding="utf-8").splitlines():
			zeile = zeile.strip()
			if not zeile or zeile.startswith("#") or "=" not in zeile:
				continue
			schluessel, _, wert = zeile.partition("=")
			werte[schluessel.strip()] = wert.strip().strip('"').strip("'")
	basis = os.environ.get("ATLASSIAN_BASE_URL") or werte.get("ATLASSIAN_BASE_URL", "")
	mail = os.environ.get("ATLASSIAN_EMAIL") or werte.get("ATLASSIAN_EMAIL", "")
	token = os.environ.get("ATLASSIAN_API_TOKEN") or werte.get("ATLASSIAN_API_TOKEN", "")
	fehlt = [n for n, w in (("ATLASSIAN_BASE_URL", basis), ("ATLASSIAN_EMAIL", mail), ("ATLASSIAN_API_TOKEN", token)) if not w]
	if fehlt:
		die("In %s fehlen: %s" % (pfad, ", ".join(fehlt)))
	return basis.rstrip("/"), mail, token


def kopf(mail: str, token: str) -> dict[str, str]:
	import base64

	roh = base64.b64encode(("%s:%s" % (mail, token)).encode()).decode()
	return {"Authorization": "Basic " + roh, "Accept": "application/json"}


def hole(url: str, mail: str, token: str) -> dict:
	anfrage = urllib.request.Request(url, headers=kopf(mail, token))
	try:
		with urllib.request.urlopen(anfrage, timeout=60) as antwort:
			return json.loads(antwort.read().decode("utf-8"))
	except urllib.error.HTTPError as fehler:
		die("HTTP %s bei GET %s: %s" % (fehler.code, url, fehler.read().decode("utf-8", "replace")[:400]))


def sende_datei(url: str, mail: str, token: str, datei: Path, kommentar: str) -> dict:
	"""multipart/form-data von Hand, damit keine Bibliothek dazukommt."""
	crlf = chr(13) + chr(10)
	anfuehrung = chr(34)
	grenze = "----thesis" + uuid.uuid4().hex
	typ = mimetypes.guess_type(datei.name)[0] or "application/octet-stream"
	teile: list[bytes] = []

	def kopfzeile(zusatz: str) -> str:
		return "--" + grenze + crlf + zusatz

	def benannt(name: str) -> str:
		return "name=" + anfuehrung + name + anfuehrung

	def feld(name: str, wert: str) -> None:
		text = kopfzeile("Content-Disposition: form-data; " + benannt(name) + crlf + crlf + wert + crlf)
		teile.append(text.encode("utf-8"))

	dateikopf = (
		"Content-Disposition: form-data; "
		+ benannt("file")
		+ "; filename="
		+ anfuehrung
		+ datei.name
		+ anfuehrung
		+ crlf
		+ "Content-Type: "
		+ typ
		+ crlf
		+ crlf
	)
	teile.append(kopfzeile(dateikopf).encode("utf-8"))
	teile.append(datei.read_bytes())
	teile.append(crlf.encode("utf-8"))
	feld("comment", kommentar)
	feld("minorEdit", "true")
	teile.append(("--" + grenze + "--" + crlf).encode("utf-8"))
	koerper = b"".join(teile)

	kopfzeilen = kopf(mail, token)
	kopfzeilen["X-Atlassian-Token"] = "no-check"
	kopfzeilen["Content-Type"] = "multipart/form-data; boundary=" + grenze
	anfrage = urllib.request.Request(url, data=koerper, headers=kopfzeilen, method="POST")
	try:
		with urllib.request.urlopen(anfrage, timeout=180) as antwort:
			return json.loads(antwort.read().decode("utf-8"))
	except urllib.error.HTTPError as fehler:
		die("HTTP %s bei POST %s: %s" % (fehler.code, url, fehler.read().decode("utf-8", "replace")[:400]))


def cmd_attach(args: argparse.Namespace) -> None:
	datei = Path(args.datei)
	if not datei.is_file():
		die("Bilddatei nicht gefunden: %s" % datei)
	grenze_mb = 10
	if datei.stat().st_size > grenze_mb * 1024 * 1024:
		die("%s ist groesser als %d MB. Vor dem Hochladen verkleinern." % (datei.name, grenze_mb))

	basis, mail, token = zugangsdaten(args.env_file)
	vorhanden = hole(
		"%s/wiki/rest/api/content/%s/child/attachment?filename=%s"
		% (basis, args.page, urllib.parse.quote(datei.name)),
		mail,
		token,
	)
	treffer = vorhanden.get("results", [])
	if treffer:
		ziel = "%s/wiki/rest/api/content/%s/child/attachment/%s/data" % (basis, args.page, treffer[0]["id"])
		art = "ersetzt"
	else:
		ziel = "%s/wiki/rest/api/content/%s/child/attachment" % (basis, args.page)
		art = "neu angelegt"

	ergebnis = sende_datei(ziel, mail, token, datei, args.message)
	eintrag = ergebnis.get("results", [ergebnis])[0]
	print("Anhang %s: %s (%d Bytes) an Seite %s." % (art, datei.name, datei.stat().st_size, args.page))
	print("Version: %s" % eintrag.get("version", {}).get("number", "?"))
	print("Im Kapiteltext als letztes Feld des Bildplatzes eintragen:")
	print("  [[abbildung: <nr> | <Titel> | <Herkunft> | %s]]" % datei.name)


# ----------------------------------------------------------------- Verdrahtung


def main() -> None:
	parser = argparse.ArgumentParser(description="Werkzeug fuer die Thesis-Kapitel (Skill thesis-schreiben).")
	sub = parser.add_subparsers(dest="befehl", required=True)

	p = sub.add_parser("lint", help="Schreibregeln auf einer Kapitel-Arbeitsdatei pruefen")
	p.add_argument("datei")
	p.set_defaults(func=cmd_lint)

	p = sub.add_parser("umfang", help="Woerter je Abschnitt gegen den Zielkorridor")
	p.add_argument("datei")
	p.add_argument("--kapitel", type=int, default=None, help="Kapitelnummer, falls der Dateiname sie nicht traegt")
	p.set_defaults(func=cmd_umfang)

	p = sub.add_parser("korridore", help="Umfangsverteilung zeigen und gegen das Seitenziel pruefen")
	p.set_defaults(func=cmd_korridore)

	p = sub.add_parser("attach", help="Bilddatei an eine Kapitelseite haengen")
	p.add_argument("datei")
	p.add_argument("--page", required=True, help="Seiten-ID der Kapitelseite")
	p.add_argument("--message", default="Abbildung fuer die Thesis", help="Kommentar am Anhang")
	p.add_argument("--env-file", default=None, type=Path, help="Standard: <repo>/.env.atlassian")
	p.set_defaults(func=cmd_attach)

	p = sub.add_parser("storage", help="Markdown nach Confluence-Storage-XHTML")
	p.add_argument("datei")
	p.add_argument("-o", "--out", default=None, help="Zieldatei (Standard: gleiche Datei mit .xhtml)")
	p.add_argument("--roh", action="store_true", help="Umlaute als UTF-8 statt als benannte Entities")
	p.set_defaults(func=cmd_storage)

	args = parser.parse_args()
	args.func(args)


if __name__ == "__main__":
	main()
