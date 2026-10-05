"""Anhang D (Testunterlagen) aus Testmaterial/_generator erzeugen.

Aufruf aus dem Wurzelverzeichnis des Repositorys:
    py thesis/werkzeuge/anhang_d.py Testmaterial/_generator thesis/anhang/anhang_d.tex [anhang-d.md]
Das optionale dritte Argument schreibt zusaetzlich das Markdown fuer die
Confluence-Anhangsseite (thesis.py storage).

Wortlaut wie auf den gedruckten Karten und Boegen: Szenario mit den
eingesetzten Seed-Werten (werte.KARTE), Startzustand (werte.START),
SUS-Items und TAM-Items aus p4_druck.py, Bezugssaetze aus make_docs.BEZUG.
make_docs.py selbst wird nicht importiert, weil es python-docx braucht.
"""
import ast
import html
import re
import sys
from pathlib import Path

GEN = Path(sys.argv[1])
ZIEL = Path(sys.argv[2])
sys.path.insert(0, str(GEN))

import aufgaben  # noqa: E402
import werte  # noqa: E402


def listen_aus(datei, namen):
	"""Nur die Listen-Zuweisungen aus einer Datei lesen, ohne sie auszufuehren."""
	baum = ast.parse(Path(datei).read_text(encoding="utf-8"))
	ergebnis = {}
	for knoten in baum.body:
		if isinstance(knoten, ast.Assign) and isinstance(knoten.targets[0], ast.Name):
			name = knoten.targets[0].id
			if name in namen:
				ergebnis[name] = ast.literal_eval(knoten.value)
	return ergebnis


fragen = listen_aus(GEN / "p4_druck.py", {"SUS", "PU", "PEOU"})
bezug = listen_aus(GEN / "make_docs.py", {"BEZUG"})["BEZUG"]


def txt(s):
	s = re.sub(r"<[^>]+>", "", s)
	return html.unescape(s)


def tex(s):
	s = txt(s)
	ersatz = {
		"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
		"_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
	}
	return "".join(ersatz.get(z, z) for z in s)


ANMELDUNG = {k for k, _ in werte.ANMELDEKARTEN}
BLOCKNAMEN = {"A": "Block A: ohne Anmeldung", "B": "Block B: Studierende",
              "C": "Block C: Redaktion", "D": "Block D: Administration"}

aus = []
w = aus.append

w("% ---------------------------------------------------------------------------")
w("% Anhang D: Testunterlagen")
w("% Erzeugt aus Testmaterial/_generator (aufgaben.py, werte.py, p4_druck.py,")
w("% BEZUG aus make_docs.py) mit thesis/werkzeuge/anhang_d.py.")
w("% Nicht von Hand aendern, sondern neu erzeugen.")
w("% ---------------------------------------------------------------------------")
w("")
w(r"\chapter{Testunterlagen}")
w(r"\label{anh:testunterlagen}")
w("")
w(r"Die Unterlagen stehen hier im Wortlaut der gedruckten Fassungen, die in den elf Sitzungen "
  r"verwendet wurden (Abschnitt~\ref{sec:testdesign}). Jede Aufgabenkarte war eine eigene Seite, "
  r"auf der allein der Kartentext stand; Startzustand und Erfolgskriterium kannte nur die "
  r"Testleitung. Zeitbudget und Kennzahlen je Aufgabe nennt Tabelle~\ref{tab:aufgaben}.")
w("")
w(r"\section*{Aufgabenkarten}")
w("")

for block in "ABCD":
	liste = [a for a in aufgaben.AUFGABEN if a["block"] == block]
	w(r"\begingroup")
	w(r"\scriptsize")
	w(r"\setlength{\tabcolsep}{3pt}")
	w(r"\renewcommand{\arraystretch}{1.12}")
	w(r"\setlength{\LTcapwidth}{\textwidth}")
	w(r"\begin{longtable}{@{}L{0.6cm}L{6.1cm}L{3.8cm}L{4.2cm}@{}}")
	w(r"	\caption[Aufgabenkarten %s]{Aufgabenkarten %s, Kartentext wortgleich mit "
	  r"Startzustand und Erfolgskriterium der Testleitung (eigene Darstellung)}" % (BLOCKNAMEN[block], BLOCKNAMEN[block]))
	w(r"	\label{tab:karten-%s}\\" % block.lower())
	kopf = r"	\toprule" + "\n" + r"	\textbf{ID} & \textbf{Kartentext} & \textbf{Startzustand} & \textbf{Erfolgskriterium} \\" + "\n" + r"	\midrule"
	w(kopf)
	w(r"	\endfirsthead")
	w(kopf)
	w(r"	\endhead")
	w(r"	\bottomrule")
	w(r"	\endfoot")
	for a in liste:
		karte = werte.einsetzen(txt(a["szenario"]), werte.KARTE.get(a["kennung"]))
		karte_tex = tex(karte)
		if a["kennung"] in ANMELDUNG:
			karte_tex += r" \newline \textit{Darunter je Sitzung: E-Mail und Passwort des Testkontos.}"
		start = werte.start(a["kennung"], txt(a["start"]))
		w("	%s & %s & %s & %s \\\\" % (a["kennung"], karte_tex, tex(start), tex(a["erfolg"])))
	w(r"\end{longtable}")
	w(r"\endgroup")
	w("")

# --- SUS ---------------------------------------------------------------------
w(r"\section*{Fragebogen zur Gebrauchstauglichkeit (SUS)}")
w("")
w(r"Deutsche Übersetzung über dem englischen Original nach Brooke (1996). Einleitung auf dem Bogen: "
  r"„Mit ‚dem System‘ ist in allen zehn Aussagen das Portal gemeint, das du gerade benutzt hast. "
  r"Bitte kreuze in jeder Zeile genau ein Feld an. Es gibt kein richtig und kein falsch.“ "
  r"Skala: 1 = stimme überhaupt nicht zu, 5 = stimme voll zu.")
w("")
w(r"\begingroup")
w(r"\footnotesize")
w(r"\setlength{\tabcolsep}{4pt}")
w(r"\renewcommand{\arraystretch}{1.15}")
w(r"\setlength{\LTcapwidth}{\textwidth}")
w(r"\begin{longtable}{@{}L{0.7cm}L{9.6cm}*{5}{>{\centering\arraybackslash}p{0.62cm}}@{}}")
w(r"	\caption[SUS-Bogen]{SUS-Bogen in der eingesetzten deutschen Fassung mit englischem Original (nach Brooke, 1996)}")
w(r"	\label{tab:sus-bogen}\\")
w(r"	\toprule")
w(r"	\textbf{Nr.} & \textbf{Aussage} & \textbf{1} & \textbf{2} & \textbf{3} & \textbf{4} & \textbf{5} \\")
w(r"	\midrule")
w(r"	\endfirsthead")
w(r"	\toprule")
w(r"	\textbf{Nr.} & \textbf{Aussage} & \textbf{1} & \textbf{2} & \textbf{3} & \textbf{4} & \textbf{5} \\")
w(r"	\midrule")
w(r"	\endhead")
w(r"	\bottomrule")
w(r"	\endfoot")
for nr, _pol, de, en in fragen["SUS"]:
	w(r"	%d & %s \newline {\scriptsize\itshape %s} & $\square$ & $\square$ & $\square$ & $\square$ & $\square$ \\" % (nr, tex(de), tex(en)))
w(r"\end{longtable}")
w(r"\endgroup")
w("")

# --- TAM ---------------------------------------------------------------------
w(r"\section*{Fragebogen zur Einschätzung des Portals (TAM)}")
w("")
w(r"Deutsche Übersetzung über dem englischen Original nach Davis (1989); [X] steht im Original "
  r"für den Namen des Systems. Für BI1 und BI2 stand kein englisches Original auf dem Bogen. Der Bogen "
  r"lag in vier Fassungen vor, die sich allein im Bezugssatz über den Aussagen unterscheiden:")
w("")
w(r"\begin{itemize}[topsep=0.3em, itemsep=0.2em]")
for fassung in "ABCD":
	aufgabe, satz = bezug[fassung]
	w(r"	\item Fassung %s (%s): „%s“" % (fassung, tex(aufgabe), tex(satz)))
w(r"\end{itemize}")
w("")
w(r"Einleitung auf dem Bogen: „Vierzehn Aussagen. Kreuze in jeder Zeile genau ein Feld an, je nachdem, "
  r"wie wahrscheinlich die Aussage für dich ist. Es gibt keine richtigen und keine falschen Antworten.“ "
  r"Die Felder trugen auf dem Bogen keine Zahlen, sondern Beschriftungen; in Teil 1, Teil 2 und bei BI1 "
  r"von links: äußerst wahrscheinlich, ziemlich wahrscheinlich, etwas wahrscheinlich, weder noch, "
  r"etwas unwahrscheinlich, ziemlich unwahrscheinlich, äußerst unwahrscheinlich. Kodiert wurde nach "
  r"Position, das linke Feld mit 7 und das rechte mit 1, sodass hohe Werte Zustimmung bedeuten; die "
  r"Spaltenköpfe der Tabelle geben diese Kodierung wieder. Bei BI2 sind die Endpunkte vertauscht "
  r"gedruckt (links nicht zu erwarten, rechts zu erwarten); der Wert ging deshalb als 8 minus Rohwert ein.")
w("")
bi = [("BI1", "Angenommen, das Portal stünde mir zur Verfügung: Ich sage voraus, dass ich es künftig "
              "regelmäßig nutzen werde.", ""),
      ("BI2", "Angenommen, das Portal stünde mir zur Verfügung: Ich sage voraus, dass ich es künftig "
              "regelmäßig nutzen werde. (Endpunkte vertauscht gedruckt, Wert = 8 minus Rohwert)", "")]
teile = [("Teil 1: Nutzen für deine Aufgaben", fragen["PU"]),
         ("Teil 2: Umgang mit dem Portal", fragen["PEOU"]),
         ("Teil 3: Künftige Nutzung", bi)]
w(r"\begingroup")
w(r"\footnotesize")
w(r"\setlength{\tabcolsep}{3pt}")
w(r"\renewcommand{\arraystretch}{1.15}")
w(r"\setlength{\LTcapwidth}{\textwidth}")
w(r"\begin{longtable}{@{}L{1.15cm}L{8.45cm}*{7}{>{\centering\arraybackslash}p{0.5cm}}@{}}")
w(r"	\caption[TAM-Bogen]{TAM-Bogen in der eingesetzten deutschen Fassung mit englischem Original (nach Davis, 1989)}")
w(r"	\label{tab:tam-bogen}\\")
kopf = (r"	\toprule" + "\n" + r"	\textbf{Item} & \textbf{Aussage} & \textbf{7} & \textbf{6} & \textbf{5} & "
        r"\textbf{4} & \textbf{3} & \textbf{2} & \textbf{1} \\" + "\n" + r"	\midrule")
w(kopf)
w(r"	\endfirsthead")
w(kopf)
w(r"	\endhead")
w(r"	\bottomrule")
w(r"	\endfoot")
for n, (ueberschrift, items) in enumerate(teile):
	if n:
		w(r"	\midrule")
	w(r"	\multicolumn{9}{@{}l}{\textbf{%s}} \\" % tex(ueberschrift))
	for kennung, de, en in items:
		zelle = tex(de)
		if en:
			zelle += r" \newline {\scriptsize\itshape %s}" % tex(en)
		w(r"	%s & %s & $\square$ & $\square$ & $\square$ & $\square$ & $\square$ & $\square$ & $\square$ \\" % (kennung, zelle))
w(r"\end{longtable}")
w(r"\endgroup")
w("")

ZIEL.write_text("\n".join(aus), encoding="utf-8", newline="\n")
print("geschrieben", ZIEL)

# --- Markdown fuer die Confluence-Anhangsseite (thesis.py storage) ----------
if len(sys.argv) > 3:
	def md(s):
		return txt(s).replace("|", "/")

	m = []
	m.append("# Anhang D: Testunterlagen")
	m.append("")
	m.append("Die Unterlagen stehen hier im Wortlaut der gedruckten Fassungen, die in den elf Sitzungen "
	         "verwendet wurden (Abschnitt 6.2). Jede Aufgabenkarte war eine eigene Seite, auf der allein der "
	         "Kartentext stand; Startzustand und Erfolgskriterium kannte nur die Testleitung. Zeitbudget und "
	         "Kennzahlen je Aufgabe nennt Tabelle 6.3.")
	m.append("")
	for n, block in enumerate("ABCD", start=1):
		m.append("[[tabelle: D.%d | Aufgabenkarten %s, Kartentext wortgleich mit Startzustand und Erfolgskriterium "
		         "der Testleitung | eigene Darstellung]]" % (n, BLOCKNAMEN[block]))
		m.append("")
		m.append("| ID | Kartentext | Startzustand | Erfolgskriterium |")
		m.append("|---|---|---|---|")
		for a in [x for x in aufgaben.AUFGABEN if x["block"] == block]:
			karte = werte.einsetzen(txt(a["szenario"]), werte.KARTE.get(a["kennung"]))
			if a["kennung"] in ANMELDUNG:
				karte += " Darunter je Sitzung: E-Mail und Passwort des Testkontos."
			m.append("| %s | %s | %s | %s |" % (a["kennung"], md(karte),
			                                     md(werte.start(a["kennung"], txt(a["start"]))), md(a["erfolg"])))
		m.append("")
	m.append("Fragebogen zur Gebrauchstauglichkeit (SUS): deutsche Fassung über dem englischen Original nach "
	         "Brooke (1996), Skala 1 = stimme überhaupt nicht zu bis 5 = stimme voll zu.")
	m.append("")
	m.append("[[tabelle: D.5 | SUS-Bogen in der eingesetzten deutschen Fassung mit englischem Original | nach Brooke, 1996]]")
	m.append("")
	m.append("| Nr. | Aussage | Original |")
	m.append("|---|---|---|")
	for nr, _pol, de, en in fragen["SUS"]:
		m.append("| %d | %s | %s |" % (nr, md(de), md(en)))
	m.append("")
	m.append("Fragebogen zur Einschätzung des Portals (TAM): deutsche Fassung über dem englischen Original nach "
	         "Davis (1989), siebenstufig von äußerst wahrscheinlich (links) bis äußerst unwahrscheinlich (rechts). "
	         "Kodiert wurde nach Position, das linke Feld mit 7 und das rechte mit 1, sodass hohe Werte Zustimmung "
	         "bedeuten. Bei BI2 sind die Endpunkte vertauscht gedruckt (nicht zu erwarten bis zu erwarten); der Wert "
	         "ging als 8 minus Rohwert ein. Für BI1 und BI2 stand kein englisches Original auf dem Bogen. "
	         "Die vier Fassungen unterscheiden sich "
	         "allein im Bezugssatz: " + "; ".join("Fassung %s: „%s“" % (f, md(bezug[f][1])) for f in "ABCD") + ".")
	m.append("")
	m.append("[[tabelle: D.6 | TAM-Bogen in der eingesetzten deutschen Fassung mit englischem Original | nach Davis, 1989]]")
	m.append("")
	m.append("| Item | Aussage | Original |")
	m.append("|---|---|---|")
	for ueberschrift, items in teile:
		for kennung, de, en in items:
			m.append("| %s | %s | %s |" % (kennung, md(de), md(en) if en else "keines"))
	m.append("")
	Path(sys.argv[3]).write_text("\n".join(m), encoding="utf-8", newline="\n")
	print("geschrieben", sys.argv[3])
