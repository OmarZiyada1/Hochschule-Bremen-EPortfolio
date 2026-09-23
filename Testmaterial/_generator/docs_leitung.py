# -*- coding: utf-8 -*-
"""Word-Druckvorlagen der Testleitung: Moderation, Protokoll, Vor- und Nachbereitung."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx_bau import (neues_dokument, titel, absatz, zwischentitel, linie, kaestchen,
                      tabelle, kastenblock, seitenumbruch, txt)
from aufgaben import AUFGABEN
import werte

GRAU = RGBColor(0x66, 0x66, 0x66)
ROT = RGBColor(0xC0, 0x30, 0x20)

ROLLENBLOCK = {
    "B": ("Studierende", ["B1 Anmelden", "B2 Projekt anlegen", "B3 Inhalt mit Blocktypen",
                          "B4 Metadaten pflegen", "B5 Einreichen",
                          "B6 Wieder bearbeitbar machen", "B7 Profil ergänzen"]),
    "C": ("Redaktion", ["C1 Anmelden", "C2 Arbeitsvorrat überblicken",
                        "C3 Prüfen und zurückgeben", "C4 Genehmigen und veröffentlichen",
                        "C5 Für die Top 10 vorschlagen", "C6 Interne Anmerkung"]),
    "D": ("Administration", ["D1 Anmelden", "D2 Lagebild verschaffen", "D3 Prüfen erlauben",
                             "D4 Doppelte Kategorie aufräumen", "D5 Mehrere Projekte auf einmal",
                             "D6 Top 10 festlegen", "D7 Änderung nachvollziehen"]),
}
BLOCK_A = ["A1 Orientierung", "A2 Projekt finden", "A3 Facettiert einschränken",
           "A4 Zurücknehmen, Profil", "A5 Für später sichern"]


def _kopfzeile(d, felder):
    p = d.add_paragraph()
    for i, (lab, br) in enumerate(felder):
        r = p.add_run(("      " if i else "") + lab + " " + "_" * br)
        r.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(12)


def _vorlesen(d, text):
    kastenblock(d, [("Vorlesen", 8.5, True), (text, 11.5, False)])
    d.add_paragraph().paragraph_format.space_after = Pt(2)


# --------------------------------------------------------------- 12 Moderation
def moderation():
    d = neues_dokument()
    titel(d, "Moderation: Ablauf, Wortlaut, Hilfestellung",
          "Dieses Blatt liegt während der ganzen Sitzung vor der Moderation. "
          "Wer moderiert, protokolliert nicht.")
    _kopfzeile(d, [("Pseudonym", 12), ("Datum", 12), ("Moderation", 16), ("Protokoll", 16)])

    zwischentitel(d, "1 Was ich tue und was verboten ist")
    tabelle(d, ["Meine Aufgabe", "Verboten"], [[
        "Begrüßen, das Verfahren erklären, die Aufgabenkarten übergeben, das laute Denken in Gang "
        "halten, die Zeit stoppen, nach Abschnitt 8 eingreifen und die Wertung laut ansagen",
        "Erklären, wie das System funktioniert. Auf ein Bedienelement zeigen. Eine Vermutung der "
        "Testperson bestätigen oder verneinen"]], breiten=[8.5, 8.5], groesse=10)
    absatz(d, "Der häufigste Fehler ist Helfen. Abschnitt 8 nimmt die Entscheidung ab: nicht früher "
              "eingreifen, als es dort steht, und nicht mehr sagen, als die Spalte hergibt.",
           10, fett=True, vor=6)

    zwischentitel(d, "2 Ablauf im Minutenraster")
    absatz(d, "Vollsitzung, 76 Minuten", 10.5, fett=True, nach=3)
    tabelle(d, ["Nr.", "Schritt", "Dauer", "Abschnitt"], [
        ["1", "Begrüßung vorlesen, Einwilligung unterschreiben lassen, Kurzbogen ausfüllen lassen",
         "8 min", "3 und 4"],
        ["2", "Einweisung ins laute Denken vorlesen, Übungsaufgabe", "4 min", "5"],
        ["3", "Block A, abgemeldet, Aufgaben A1 bis A5", "18 min", "6 bis 9"],
        ["4", "Kurze Unterbrechung, Anmeldung vorbereiten. Nur bereitlegen: das Anmelden ist in "
              "jedem Rollenblock die erste Aufgabe (B1, C1 bzw. D1)", "2 min",
         "Zugangsdatenblatt"],
        ["5", "Rollenblock B, C oder D", "30 min", "6 bis 9"],
        ["6", "SUS-Bogen, allein ausgefüllt, ich trete zurück", "5 min", "11"],
        ["7", "Pause. SUS-Bogen entgegennehmen und weglegen", "1 min", "12"],
        ["8", "TAM-Bogen, allein ausgefüllt, ich bin außer Sichtweite", "5 min", "13"],
        ["9", "Dank, weiterer Ablauf, Verabschiedung", "3 min", "14"],
    ], breiten=[1.0, 11.0, 2.0, 3.0], groesse=9.5)
    absatz(d, "Externe Kurzsitzung: die Schritte 4 und 5 entfallen, das ergibt 44 Minuten "
              "Programm, geplant mit 46 Minuten. Der TAM-Bogen ist die Fassung A, alles übrige "
              "bleibt gleich.", 10, vor=6)

    zwischentitel(d, "3 Vorlesetext: Begrüßung")
    _vorlesen(d, "„Danke, dass du dir die Zeit nimmst. Wir haben im Rahmen unserer Bachelorarbeit "
                 "ein Portal für studentische Projekte der Hochschule Bremen entwickelt und möchten "
                 "herausfinden, ob es sich gut bedienen lässt. Wichtig ist: Wir testen das System, "
                 "nicht dich. Wenn etwas nicht klappt, liegt das an uns, und genau das wollen wir "
                 "erfahren. Du kannst jederzeit abbrechen, ohne einen Grund zu nennen.“")

    zwischentitel(d, "4 Einwilligung und Kurzbogen")
    for t in ["Einwilligung unterschreiben lassen, zwei Exemplare. Eines bleibt bei der Testperson.",
              "Zwei Kreuze abwarten: Teilnahme, und getrennt davon die Aufzeichnung. Ohne das zweite "
              "Kreuz läuft die Sitzung ohne Aufzeichnung weiter.",
              "Kurzbogen ausfüllen lassen, vier Fragen, vor der ersten Aufgabe.",
              "Erst danach die Aufzeichnung starten."]:
        kaestchen(d, t, 10.5)

    zwischentitel(d, "5 Vorlesetext: Einweisung ins laute Denken")
    _vorlesen(d, "„Wir möchten dich bitten, während der Aufgaben laut mitzudenken. Sag einfach "
                 "alles, was dir durch den Kopf geht: was du gerade suchst, was du erwartest, was "
                 "dich wundert. Auch wenn es banal klingt. Ich werde dich zwischendurch nicht "
                 "unterbrechen, und wenn du still wirst, erinnere ich dich kurz daran. Ich "
                 "beantworte während der Aufgaben keine Fragen zum System, das ist keine "
                 "Unhöflichkeit, sondern gehört zum Verfahren.“")
    absatz(d, "Übungsaufgabe außerhalb des Systems, etwa eine Minute:", 10.5, nach=4)
    _vorlesen(d, "„Zeig mir bitte laut denkend, wie du auf deinem Handy die Uhrzeit in Tokio "
                 "herausfindest.“")

    seitenumbruch(d)
    zwischentitel(d, "6 Aufgabenübergabe und Zeitnahme")
    absatz(d, "Die Karte wird einzeln übergeben und bleibt liegen. Startzustand und Erfolgskriterium "
              "stehen in Abschnitt 9 und werden nicht vorgelesen.", 10.5, nach=4)
    for t in ["Start: wenn die Testperson sagt, dass sie anfängt, nicht wenn sie die Karte bekommt. "
              "Lesezeit zählt nicht mit.",
              "Stopp: wenn das Erfolgskriterium sichtbar erfüllt ist, auch wenn die Person noch "
              "weiterspricht.",
              "Abbruch der Aufgabe: beim Zeitbudget plus 50 Prozent. Notiert wird die tatsächliche "
              "Zeit, nicht das Budget.",
              "Start und Stopp laut ansagen, damit das Protokoll mitschreiben kann. Alle Zeiten "
              "laufen ab dem Aufgabenstart."]:
        absatz(d, "•  " + t, 10.5, nach=3)

    zwischentitel(d, "7 Wenn es still wird")
    tabelle(d, ["Situation", "Was ich sage", "Was ich nie sage"], [
        ["Schweigen über etwa zehn Sekunden", "„Was denkst du gerade?“", "„Suchst du den Filter?“"],
        ["„Ist das richtig so?“", "„Was würdest du denn erwarten?“", "„Ja, genau“ oder „Nein“"],
        ["Fragt, wo etwas ist", "„Wo würdest du es zuerst suchen?“", "„Oben rechts.“"],
        ["Entschuldigt sich für einen Fehler", "„Das ist genau die Art von Stelle, die uns "
         "interessiert.“", "„Kein Problem, das ist auch schwierig.“"],
        ["Beschreibt nur, was sie tut", "„Und was erwartest du, dass jetzt passiert?“",
         "nichts sagen und es als lautes Denken werten"],
    ], breiten=[4.6, 6.2, 6.2], groesse=9.5)
    absatz(d, "Die dritte Spalte ist der eigentliche Leitfaden.", 10, fett=True, vor=4)

    zwischentitel(d, "8 Wenn ich eingreife: drei Stufen")
    absatz(d, "Drei Situationen, drei Sätze. Nach jedem Eingriff sage ich dem Protokoll laut die "
              "Wertung an, damit dort nur noch angekreuzt wird. Ich merke mir keine Zahlen.",
           10.5, nach=4)
    tabelle(d, ["Wann", "Was ich sage", "Was ich dem Protokoll ansage"], [
        ["Schweigen über etwa zehn Sekunden", "„Was denkst du gerade?“",
         "nichts, die Aufgabe gilt weiter als geschafft"],
        ["Ratlos über etwa sechzig Sekunden, ohne dass sich etwas bewegt",
         "„Lies dir die Aufgabe gern noch einmal durch.“ Mehr nicht, kein Inhalt.",
         "„mit Mühe“"],
        ["Zeitbudget überschritten oder ausdrückliche Bitte um Hilfe",
         "„Schau dich auf dieser Seite noch einmal um.“ Ein Hinweis auf den Bereich, nie auf das "
         "Bedienelement.", "„nicht geschafft“"],
        ["Geht auch danach nicht weiter, oder sichtbares Unbehagen",
         "Aufgabe abbrechen, zur nächsten überleiten, Startzustand herstellen",
         "„nicht geschafft, abgebrochen“"],
    ], breiten=[4.6, 8.0, 4.4], groesse=9.5)

    seitenumbruch(d)
    zwischentitel(d, "9 Startzustand, Erfolgskriterium und Zeitbudget je Aufgabe")
    absatz(d, "Nur für mich. Der Startzustand wird vor jeder Aufgabe hergestellt, am "
              "Erfolgskriterium halte ich die Stoppuhr an.", 10.5, nach=4)
    zeilen = [[a["kennung"], werte.start(a["kennung"], txt(a["start"])), txt(a["erfolg"]),
               a["budget"], a["abbruch"]] for a in AUFGABEN]
    t = tabelle(d, ["Aufg.", "Startzustand", "Erfolgskriterium", "Budget", "Abbruch"],
                zeilen, breiten=[1.1, 6.4, 6.8, 1.3, 1.4], groesse=7.5)
    # Die Tabelle soll auf eine Seite passen, auch mit 25 Aufgaben: kein
    # Absatzabstand in den Zellen, einfacher Zeilenabstand.
    for r in t.rows:
        for c in r.cells:
            for p in c.paragraphs:
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.0
    absatz(d, "Baut eine spätere Aufgabe auf einer abgebrochenen auf (A4 auf A3, A5 auf A2 oder A4, "
              "B4 auf B3, B5 auf B4, B6 auf B5, C5 auf C4, D7 auf D6), stelle ich den Zustand "
              "schweigend selbst her und lasse das im Protokoll vermerken.", 10, vor=6)

    zwischentitel(d, "10 Abbruch der Sitzung")
    absatz(d, "Jederzeit auf Wunsch der Testperson, ohne Nachfrage. Teilprotokoll auswerten, Abbruch "
              "und Zeitpunkt im Protokollkopf vermerken. Die Person wird nicht stillschweigend "
              "ersetzt.", 10.5)

    seitenumbruch(d)
    zwischentitel(d, "11 SUS-Bogen am Tisch")
    _vorlesen(d, "„Mit dem System ist in allen zehn Aussagen das Portal gemeint, das du gerade "
                 "benutzt hast.“")
    for i, t in enumerate([
        "Bogen hinlegen, den Satz oben vorlesen.",
        "Zurücktreten und nicht auf den Bogen sehen.",
        "Rückfragen zu einzelnen Items nicht inhaltlich beantworten. Wörtlich: „Antworte so, wie du "
        "das Item verstehst; es gibt kein richtig oder falsch.“",
        "Bogen entgegennehmen und auf zehn Markierungen prüfen. Kein Item darf leer bleiben; wer "
        "unschlüssig ist, kreuzt die Mitte an.",
        "Bogen sichtbar weglegen."], 1):
        absatz(d, "%d.  %s" % (i, t), 10.5, nach=3)

    zwischentitel(d, "12 Die eine Minute Pause")
    absatz(d, "Genau eine Minute, in der nicht über die Aufgaben gesprochen wird. Sie trennt die "
              "beiden Bögen hörbar: der SUS fragt nach der Bedienung, der TAM-Bogen nach dem Nutzen.",
           10.5)

    zwischentitel(d, "13 TAM-Bogen am Tisch")
    absatz(d, "Vor der Sitzung prüfen, dass die richtige Fassung im Stapel liegt. Maßgeblich ist der "
              "Rollenblock: Fassung A für TN08 und TN11, sonst B, C oder D.",
           10.5, fett=True, farbe=ROT, nach=4)
    _vorlesen(d, "„Jetzt kommt ein zweiter, kürzerer Bogen mit 14 Aussagen. Er fragt nicht danach, "
                 "wie zufrieden du mit der Bedienung warst, sondern was du von dem Portal für deine "
                 "eigene Arbeit erwartest. Es gibt keine richtigen und keine falschen Antworten, und "
                 "ich sehe nicht mit auf den Bogen. Nimm dir die Zeit, die du brauchst, und sag mir "
                 "Bescheid, wenn du fertig bist.“")
    for i, t in enumerate([
        "Ansagesatz vorlesen, dann den Bogen mit dem passenden Bezugssatz hinlegen.",
        "Zurücktreten, außer Sichtweite des Bogens, und schweigen.",
        "Rückfragen nicht inhaltlich beantworten. Wörtlich: „Beantworte es so, wie du das Item "
        "verstehst.“",
        "Bogen entgegennehmen und ausschließlich auf Vollständigkeit prüfen: Kopf ausgefüllt, "
        "14 Markierungen. Fehlt eine, darauf hinweisen ohne den Inhalt zu besprechen."], 1):
        absatz(d, "%d.  %s" % (i, t), 10.5, nach=3)
    absatz(d, "Beim Piloten TN00 wird nach dem Bogen zusätzlich gefragt, wie die Items PEOU4 "
              "(„flexibel“) und PU3 („Produktivität“) verstanden wurden.", 10, kursiv=True,
           farbe=GRAU)

    zwischentitel(d, "14 Dank und Verabschiedung")
    absatz(d, "Danken, den weiteren Ablauf in zwei Sätzen nennen, verabschieden. Danach die "
              "Nachbereitung nach dem Blatt „Nach der Sitzung“.", 10.5)

    zwischentitel(d, "15 Wenn etwas schiefgeht")
    tabelle(d, ["Fall", "Was sofort zu tun ist"], [
        ["Technik fällt aus", "Uhr anhalten, sachlich sagen, dass es an uns liegt. Bis zu fünf "
         "Minuten reparieren; gelingt es nicht, die Sitzung hier beenden, das Teilprotokoll werten, "
         "Ausfall und Zeitpunkt im Protokollkopf vermerken."],
        ["Die Testperson möchte abbrechen", "Ohne Nachfrage beenden und danken. Teilprotokoll "
         "auswerten, Abbruch und Zeitpunkt vermerken, die Person nicht stillschweigend ersetzen."],
        ["Falsche TAM-Fassung oder ein Formular fehlt", "Nicht während der Sitzung improvisieren. "
         "Vor dem Ausfüllen: richtige Fassung holen, notfalls den Bezugssatz handschriftlich in den "
         "Kopf schreiben. Danach: im Protokollkopf die tatsächlich ausgegebene Fassung eintragen "
         "und unter Besonderheiten vermerken."],
    ], breiten=[4.6, 12.4], groesse=9.5)
    absatz(d, "In allen drei Fällen dem Protokoll ansagen, was unter Besonderheiten einzutragen ist.",
           10, fett=True, vor=4)
    return d, "12_Moderation.docx"


# ------------------------------------------------------- 13 bis 16 Protokoll
def protokoll(block, nummer):
    d = neues_dokument()
    if block:
        rolle, aufgaben = ROLLENBLOCK[block]
        untertitel = "Blöcke A und %s  ·  %s" % (block, rolle)
        dateiname = "%02d_Protokoll_Block_A_und_%s.docx" % (nummer, block)
        tam = "Fassung " + block
    else:
        aufgaben = []
        untertitel = "Nur Block A  ·  externe Kurzsitzung"
        dateiname = "%02d_Protokoll_nur_Block_A_extern.docx" % nummer
        tam = "Fassung A"

    titel(d, "Beobachtungsprotokoll", untertitel +
          "  ·  Dieses Blatt hält, wer protokolliert. Wer moderiert, schreibt nicht mit.")

    zwischentitel(d, "1 Protokollkopf")
    kopfzeilen = [
        ["Pseudonym", "TN ____", "Datum", "____________"],
        ["Beginn", "________", "Ende", "____________"],
        ["Moderation", "____________________", "Protokoll", "____________________"],
        ["Browser und Version", "____________________", "Prüfstand (Commit)", "____________"],
        ["Ausgegebene TAM-Fassung", tam, "Aufzeichnung gestartet", "ja  /  nein"],
    ]
    if block == "C":
        kopfzeilen.append(["Rollenaufgabe?", "ja  /  nein",
                           "(Studierende in der Redaktionsrolle)", ""])
    if block == "D":
        kopfzeilen.append(["Aus dem Umfeld dieser Rolle?", "ja  /  nein",
                           "(sonst wird Erlernbarkeit durch Laien gemessen)", ""])
    tabelle(d, None, kopfzeilen, breiten=[4.4, 4.0, 4.4, 4.2], groesse=10)
    linie(d, "Besonderheiten (Abbruch, Störung, Technik):", 52, 10, nach=4)
    linie(d, "", 88, 10, nach=10)

    zwischentitel(d, "2 Kurzbogen zur Person")
    absatz(d, "Wird vom Kurzbogen abgeschrieben, nicht neu gefragt.", 9.5, kursiv=True,
           farbe=GRAU, nach=4)
    tabelle(d, None, [
        ["Studiengang und Fakultät" if block else "Tätigkeit", ""],
        ["Fachsemester" if block else "Fachsemester (entfällt)", ""],
        ["Sicherheit im Umgang mit Webanwendungen (1 bis 5)", ""],
        ["Schon einmal ein Portfolio-Portal benutzt?", ""],
    ], breiten=[8.0, 9.0], groesse=10)

    def aufgabentabelle(titeltext, liste, a1=False):
        zwischentitel(d, titeltext)
        zeilen = []
        for i, name in enumerate(liste):
            beschriftung = name + "\n(keine Wertung)" if (a1 and i == 0) else name
            zeilen.append([beschriftung, "", "", "", "", "", ""])
        t = tabelle(d, ["Aufgabe", "geschafft", "mit Mühe", "nicht\ngeschafft", "Zeit",
                        "Fehl-\nversuche", "Beobachtungen und Zitate"],
                    zeilen, breiten=[3.0, 1.4, 1.3, 1.4, 1.1, 1.5, 7.3], groesse=9)
        for r in t.rows[1:]:
            for c in r.cells:
                c.paragraphs[0].paragraph_format.space_before = Pt(12)
                c.paragraphs[0].paragraph_format.space_after = Pt(12)
        return t

    aufgabentabelle("3 Block A: ohne Anmeldung", BLOCK_A, a1=True)
    absatz(d, "Ein Kreuz je Zeile in einer der drei Wertungsspalten. Die Wertung sagt die Moderation "
              "laut an. Fehlversuche als Strichliste. A1 bekommt keine Wertung, Zeit und Zitate "
              "werden trotzdem mitgeschrieben.", 9.5, kursiv=True, farbe=GRAU, vor=3)
    if aufgaben:
        seitenumbruch(d)
        aufgabentabelle("4 Block %s: %s" % (block, ROLLENBLOCK[block][0]), aufgaben)

    nr = 5 if aufgaben else 4
    zwischentitel(d, "%d Die drei Wertungen" % nr)
    tabelle(d, ["Kreuz bei", "Wenn"], [
        ["geschafft", "ohne Hilfe gelöst, oder nach der Frage „Was denkst du gerade?“"],
        ["mit Mühe", "gelöst, aber erst nach dem Hinweis auf die Aufgabenkarte"],
        ["nicht geschafft", "erst nach einem Hinweis auf den Bereich gelöst, gar nicht gelöst, "
                            "oder abgebrochen. Bei Abbruch das Wort „abgebrochen“ in die "
                            "Notizspalte schreiben"],
    ], breiten=[3.6, 13.4], groesse=10)
    absatz(d, "Die Moderation sagt die Wertung laut an. Notiert wird die tatsächlich verstrichene "
              "Zeit, nicht das Budget. Eine abgebrochene Aufgabe ist nicht geschafft und kein "
              "fehlender Wert.", 9.5, vor=4, nach=6)
    absatz(d, "Ein Fehlversuch ist eine Aktion ohne Wirkung oder eine, die sofort zurückgenommen "
              "wird, zum Beispiel einen Filter setzen und gleich wieder entfernen. Je Fehlversuch "
              "ein Strich in der Spalte.", 9.5, nach=8)

    zwischentitel(d, "%d Zwei Kürzel, alles andere in Worten" % (nr + 1))
    tabelle(d, ["Kürzel", "Bedeutung", "Beispiel"], [
        ["N", "falscher Weg, falscher Bereich geöffnet",
         "N 1:05 öffnet Kategorie statt Studiengang"],
        ["E", "Überraschung, hat etwas anderes erwartet",
         "E 1:20 „Ich dachte, das setzt sich zurück“"],
    ], breiten=[1.6, 7.8, 7.6], groesse=10)
    absatz(d, "Mehr Kürzel gibt es nicht. Alles Übrige schreibst du in normalen Worten mit "
              "Zeitmarke, zum Beispiel „1:33 setzt Filter, entfernt ihn sofort“.", 10, vor=4)
    absatz(d, "Mitgeschrieben wird beobachtbares Verhalten und wörtliche Rede, nicht die Deutung. "
              "Faustregel: könnte ich das fotografieren? Dann gehört es hinein.",
           10, fett=True, vor=6)

    zwischentitel(d, "%d Fragebögen" % (nr + 2))
    absatz(d, "Während die Testperson die Bögen ausfüllt, wird nicht mitgeschrieben und nicht auf "
              "den Bogen gesehen. Notiert wird nur, was daneben geschieht. Gerechnet wird heute "
              "nichts.", 10.5, nach=4)
    tabelle(d, ["Beobachtung", "Eintrag"], [
        ["Rückfragen zu einzelnen Items (welche?)", ""],
        ["Sichtbares Zögern an einer Stelle", ""],
        ["Dauer SUS-Bogen, falls deutlich abweichend", ""],
        ["Dauer TAM-Bogen, falls deutlich abweichend", ""],
        ["SUS vollständig, zehn Markierungen", "ja  /  nein"],
        ["TAM vollständig, vierzehn Markierungen", "ja  /  nein"],
    ], breiten=[8.0, 9.0], groesse=10)

    return d, dateiname


# ---------------------------------------------------------- 17 Vor der Sitzung
def vor_der_sitzung():
    d = neues_dokument()
    titel(d, "Vor der Sitzung",
          "Für die Person, die die Testumgebung herrichtet. Einmal je Testtag ausdrucken.")
    _kopfzeile(d, [("Testtag", 14), ("Datum", 14), ("Wer richtet her", 20)])

    zwischentitel(d, "1 Druckliste je Sitzung")
    tabelle(d, ["Nr.", "Was", "Menge", "Wer hält es"], [
        ["1", "Einverständniserklärung", "2 Exemplare", "Moderation"],
        ["2", "Kurzbogen zur Person", "1", "Moderation"],
        ["3", "Aufgabenkarten Block A, A1 bis A5", "1 Satz", "Moderation"],
        ["4", "Aufgabenkarten des Rollenblocks", "1 Satz, entfällt bei TN08 und TN11", "Moderation"],
        ["4a", "Anmeldekarte der Sitzung (B1, C1 oder D1), aus Testmaterial/_sitzung",
         "1, entfällt bei TN08 und TN11", "Moderation"],
        ["5", "Beobachtungsprotokoll, passende Fassung", "1", "Protokoll"],
        ["6", "SUS-Bogen", "1", "Moderation"],
        ["7", "TAM-Bogen in der richtigen Fassung", "1", "Moderation"],
        ["8", "Blatt „Moderation“", "1", "Moderation"],
    ], breiten=[1.0, 8.2, 4.6, 3.2], groesse=9.5)
    absatz(d, "Einmal je Testtag: dieses Blatt, das Zugangsdatenblatt und das Blatt „Nach der "
              "Sitzung“. Das Rücksetzprotokoll steht dort in Abschnitt 3, es gibt kein eigenes "
              "Blatt mehr. Bei den externen Sitzungen TN08 und TN11 entfällt das "
              "Zugangsdatenblatt, sie brauchen kein Testkonto.", 10, vor=4)

    zwischentitel(d, "2 Die richtige TAM-Fassung")
    absatz(d, "Maßgeblich ist der Rollenblock, nicht der zuerst bearbeitete Block A. Die Fassung "
              "wird vor der Sitzung gewählt und im Rücksetzprotokoll abgehakt. Eine falsch "
              "ausgegebene Fassung lässt sich hinterher nicht heilen.",
           10.5, fett=True, farbe=ROT, nach=6)
    tabelle(d, ["Sitzung", "Gruppe", "Blöcke", "TAM-Fassung"], [
        ["TN00 (Pilot)", "Pilot, zählt nicht", "A, dann B", "Fassung B"],
        ["TN01 bis TN05", "Studierende", "A, dann B", "Fassung B"],
        ["TN06, TN07", "Redaktion", "A, dann C", "Fassung C"],
        ["TN08, TN11", "Extern", "nur A", "Fassung A"],
        ["TN09, TN10", "Administration", "A, dann D", "Fassung D"],
    ], breiten=[3.6, 4.4, 3.4, 3.6], groesse=10)

    zwischentitel(d, "3 Taktung des Testtags")
    for t in ["Höchstens vier Sitzungen an einem Tag. Vier Vollsitzungen sind mit Puffer gut sieben "
              "Stunden konzentriertes Beobachten. Ab der fünften sinkt die Beobachtungsqualität, "
              "und Beobachten ist hier die Messung.",
              "Zwischen zwei Sitzungen liegen mindestens 30 Minuten für Zurücksetzen und "
              "Protokollnacharbeit. Diese halbe Stunde ist Arbeitszeit, keine Pause.",
              "Die beiden ergiebigsten Blöcke, B und D, nicht ans Tagesende legen.",
              "Der freie Slot an Tag 5 ist der Ersatztermin, kein Puffer für Verspätungen."]:
        absatz(d, "•  " + t, 10.5, nach=4)

    zwischentitel(d, "4 Checkliste vor der ersten Sitzung des Tages")
    for t in ["Gedruckte Sätze aus Abschnitt 1 gezählt, je Sitzung einer, TAM-Fassungen geprüft",
              "Uhrzeit, Moderation und Protokoll der heutigen Sitzungen eingetragen",
              "Rollen je Sitzung festgelegt, Moderation und Protokoll getrennt besetzt",
              "Rechner am Platz, eingefrorener Prüfstand läuft, Commit-Kurzhash notiert",
              "Datenbestand für die erste Sitzung hergestellt (Menüpunkt s5 mit ihrem "
              "Pseudonym), Seed gegen die Prüfliste in Abschnitt 5 gezählt (Menüpunkt s7)",
              "Frisches Browserprofil, keine offenen Anmeldungen, kein Verlauf",
              "Testkonto der ersten Sitzung angelegt (entsteht mit s5) und einmal "
              "probeweise angemeldet",
              "Aufzeichnung vorbereitet, Tonpegel geprüft, Aufnahme noch nicht gestartet",
              "Stoppuhr bereit, Stift und Ersatzstift, Wasser für die Testperson",
              "Zugangsdatenblatt für die heutigen Sitzungen ausgefüllt",
              "Bei Block B, C und D: Anmeldekarte der Sitzung gedruckt (B1, C1 bzw. D1). Sie entsteht "
              "mit „python make_docs.py --passwort“ und liegt in Testmaterial/_sitzung",
              "Erste Zeile im Rücksetzprotokoll ausgefüllt"]:
        kaestchen(d, t, 10.5)

    seitenumbruch(d)
    zwischentitel(d, "5 Seed-Prüfliste, vor jedem Termin")
    absatz(d, "Vor jedem Termin abhaken, nicht nur einmal am Anfang der Woche. Ist der Bestand zu "
              "homogen, messen A3 und A4 nichts.", 10.5, nach=4)
    absatz(d, "Gezählt wird nicht von Hand: Menüpunkt s7 prüft jeden Punkt gegen die Datenbank, "
              "ändert nichts und meldet, was fehlt. Die letzten drei Punkte stehen nicht in der "
              "Datenbank und bleiben Handarbeit.", 10.5, nach=6)
    for t in ["40 bis 60 veröffentlichte Projekte gezählt",
              "mindestens 3 Fakultäten vertreten",
              "6 Kategorien vorhanden",
              "8 Autorinnen und Autoren, davon mindestens 1 mit mehreren Projekten",
              "1 Zielprojekt für A2, unter dem gesetzten Thema auffindbar",
              "1 inhaltsreiches Projekt für A5",
              "Top 10 belegt, je nach Rollenblock der anstehenden Sitzung: 10 Plätze in den "
              "Blöcken A und B, 6 in Block C, keiner in Block D. Gesetzt von Menüpunkt s5, "
              "gezählt mit bash test-seeder-pruefen.sh TN01",
              "Block C: 4 Projekte im Status Eingereicht, davon 2 aus fremder Feder, keine "
              "Nominierung auf ihnen; nominiert wird in C5 das Projekt, das die Testperson in C4 "
              "veröffentlicht",
              "Block D: 2 gleichbedeutende Kategorien mit je mindestens 3 Projekten, 5 Projekte im "
              "Status Genehmigt, mindestens 12 offene Nominierungen ohne gesetzte Top 10, "
              "Änderungsprotokoll mit mehreren Einträgen verschiedener Personen",
              "Zusatzkonto für D3 vorhanden, Rolle STUDENT",
              "Grenzwert für Login-Fehlversuche angehoben: "
              "APP_SECURITY_LOGINATTEMPTS_MAXFAILEDATTEMPTS=50 in der Umgebung des Backends, "
              "danach Backend neu starten. Sonst sperren fünf Fehlversuche 15 Minuten, "
              "gezählt je E-Mail und je Client-IP",
              "Bilddatei für B3 sichtbar auf dem Schreibtisch des Testrechners",
              "Testinstanz läuft auf dem eingefrorenen Commit, kein Deploy seit der Einfrierung"]:
        kaestchen(d, t, 10.5)

    zwischentitel(d, "6 Rücksetzschritte nach jeder Sitzung mit Block D")
    absatz(d, "Diese vier Schritte erledigt Menüpunkt s5 beim Herrichten der nächsten Sitzung "
              "vollständig. Die Liste wird trotzdem abgehakt: sie ist die Kontrolle, dass der "
              "Lauf stattgefunden hat. Der fünfte Punkt ist keine Handlung, sondern eine "
              "Warnung, was nicht angefasst wird.", 10.5, nach=6)
    for t in ["Zusatzkonto aus D3 wieder auf Rolle STUDENT zurückgesetzt",
              "Kategorien aus D4 wiederhergestellt: wieder 2 gleichbedeutende mit je mindestens "
              "3 Projekten",
              "die 5 Projekte aus D5 wieder im Status Genehmigt",
              "Top 10 geleert und die mindestens 12 Nominierungen wieder auf offen gesetzt",
              "Änderungsprotokoll bleibt stehen: D7 braucht mehrere Einträge verschiedener Personen"]:
        kaestchen(d, t, 10.5)
    return d, "17_Vor_der_Sitzung.docx"


# --------------------------------------------------------- 18 Zugangsdatenblatt
def zugangsdaten():
    d = neues_dokument(querformat=True)
    titel(d, "Zugangsdaten für heute",
          "Handschriftlich am Morgen ausfüllen. Der einzige Ort, an dem Konto und Passwort "
          "zusammen stehen.")
    _kopfzeile(d, [("Testtag", 14), ("Datum", 16)])
    absatz(d, "Für die externen Sitzungen TN08 und TN11 wird dieses Blatt nicht gebraucht: "
              "sie bearbeiten nur Block A und melden sich nie an.", 10, kursiv=True, farbe=GRAU,
           nach=8)
    t = tabelle(d, ["Uhrzeit", "Pseudonym", "Testkonto (vollständige Adresse)", "Passwort",
                    "Moderation", "Protokoll"],
                [["", "", "", "", "", ""] for _ in range(4)],
                breiten=[2.6, 2.8, 8.0, 4.4, 4.4, 4.4], groesse=11)
    for r in t.rows[1:]:
        for c in r.cells:
            c.paragraphs[0].paragraph_format.space_before = Pt(14)
            c.paragraphs[0].paragraph_format.space_after = Pt(14)
    absatz(d, "Nach der letzten Sitzung des Tages werden Konto und Passwort auf diesem Blatt "
              "geschwärzt und das Blatt vernichtet. Es wird nicht aufbewahrt, nicht abgetippt und "
              "nicht in Confluence eingetragen. Dasselbe gilt für die Anmeldekarten B1, C1 und D1, auf "
              "denen die Zugangsdaten ebenfalls stehen.", 11, fett=True, farbe=ROT, vor=14)
    kaestchen(d, "Geschwärzt und vernichtet am ________________, durch ________________", 11)
    return d, "18_Zugangsdatenblatt.docx"


# --------------------------------------------------------- 19 Nach der Sitzung
def nach_der_sitzung():
    d = neues_dokument()
    titel(d, "Nach der Sitzung",
          "Für beide Rollen gemeinsam. Einmal je Testtag ausdrucken.")
    absatz(d, "Die ersten fünf Punkte werden erledigt, bevor der Raum verlassen wird. Was auf "
              "später verschoben wird, wird nicht nachgeholt: Beobachtungen verblassen, und ein "
              "Blatt mit Klarnamen fällt hinterher niemandem mehr auf.",
           10.5, fett=True, farbe=ROT, nach=10)

    zwischentitel(d, "1 Sofort, im Raum")
    for t in ["Aufzeichnung stoppen und sofort aus dem Downloadordner an den vereinbarten "
              "Speicherort verschieben, benannt nach dem Pseudonym",
              "Alle Papiere einsammeln: Einwilligung (ein Exemplar), Kurzbogen, "
              "Beobachtungsprotokoll, SUS-Bogen, TAM-Bogen, alle Aufgabenkarten",
              "Auf jedem Blatt prüfen: nur Pseudonym, kein Klarname",
              "Anmeldekarte (B1, C1 oder D1) vernichten, weil das Passwort darauf steht",
              "Protokoll sofort durchgehen und ergänzen, solange die Sitzung frisch ist; "
              "Besonderheiten im Protokollkopf eintragen"]:
        kaestchen(d, t, 10.5)

    zwischentitel(d, "2 Vor der nächsten Person")
    absatz(d, "Zwischen zwei Sitzungen liegen mindestens 30 Minuten. Sie sind für diese beiden "
              "Schritte da.", 10.5, nach=4)
    absatz(d, "Zurücksetzen und Vorbereiten sind derselbe Handgriff: Menüpunkt s5 mit dem "
              "Pseudonym der nächsten Sitzung räumt weg, was die vorige Person angelegt hat, "
              "und stellt in einem Zug den Zustand her, den der nächste Rollenblock braucht. "
              "Einen getrennten Rücksetzschritt gibt es nicht mehr.", 10.5, nach=4)
    for t in ["Datenbestand herstellen: Menüpunkt s5 mit dem Pseudonym der nächsten Sitzung, "
              "danach s7 zum Zählen; dann die Zeile im Rücksetzprotokoll unten ausfüllen",
              "Frisches Browserprofil, Testkonto der nächsten Sitzung prüfen, TAM-Bogen der "
              "nächsten Fassung bereitlegen"]:
        kaestchen(d, t, 10.5)

    zwischentitel(d, "3 Rücksetzprotokoll des Tages")
    absatz(d, "Eine Zeile je Sitzung, ausgefüllt bevor die nächste Person den Raum betritt. Ohne "
              "diese Zeile weiß hinterher niemand mehr, ob die dritte Sitzung auf demselben "
              "Datenbestand lief wie die erste.", 10.5, nach=6)
    t = tabelle(d, ["Pseudo-\nnym", "Daten zurück-\ngesetzt", "Seed gezählt",
                    "Browser-\nprofil frisch", "Testkonto\nangelegt",
                    "TAM-Bogen bereit, Fassung",
                    "Nur Admin: D3, Kategorien, Top 10, Nominierungen", "Wer"],
                [["", "", "", "", "", "", "", ""] for _ in range(4)],
                breiten=[1.8, 2.2, 1.8, 2.0, 2.2, 2.6, 3.4, 1.6], groesse=8.5)
    for r in t.rows[1:]:
        for c in r.cells:
            c.paragraphs[0].paragraph_format.space_before = Pt(10)
            c.paragraphs[0].paragraph_format.space_after = Pt(10)
    absatz(d, "Welche TAM-Fassung zu welcher Sitzung gehört, steht auf dem Blatt „Vor der Sitzung“ "
              "und in der Sitzungsübersicht in Confluence. Bei einer Abweichung gilt die Übersicht.",
           9.5, kursiv=True, farbe=GRAU, vor=4)

    zwischentitel(d, "4 Binnen 24 Stunden, am Rechner")
    absatz(d, "Die Frist gilt für das Vergängliche: Beobachtungen, Zitate und Besonderheiten. Die "
              "ausgefüllten Fragebögen sind Papier und verfallen nicht.", 10.5, nach=4)
    for t in ["Beobachtungsprotokoll auf die Seite „Sitzung TN..“ übertragen, nur Beobachtetes, "
              "Unsicheres als unsicher markiert",
              "Zitate im Wortlaut übernehmen, mit Zeitmarke",
              "Angekreuzte Rohwerte von SUS- und TAM-Bogen eintragen, ohne zu rechnen",
              "PDF-Datei aus Aufgabe A5 vom Testrechner löschen"]:
        kaestchen(d, t, 10.5)
    absatz(d, "Am Sitzungstag wird nicht gerechnet. SUS-Summe und Score sowie die drei "
              "TAM-Kennwerte entstehen erst im Nachlauf, dort wird auch BI2 umgepolt; eingetragen "
              "werden sie dann in den Fragebogenabschnitt derselben Sitzungsseite.",
           10, fett=True, vor=4)

    zwischentitel(d, "5 Am Ende des Testtags")
    for t in ["Zugangsdatenblatt schwärzen und vernichten",
              "Papiere des Tages pseudonymisiert ablegen, Einwilligungen getrennt",
              "Aufzeichnungen des Tages am vereinbarten Ort auf Vollständigkeit prüfen"]:
        kaestchen(d, t, 10.5)

    zwischentitel(d, "6 Nach Abgabe und Bewertung der Arbeit")
    for t in ["Alle Aufzeichnungen löschen",
              "Zuordnungsliste Pseudonym zu Person löschen",
              "Das Löschen einmal schriftlich vermerken"]:
        kaestchen(d, t, 10.5)
    return d, "19_Nach_der_Sitzung.docx"


# -------------------------------------------------------- 20 Ruecksetzprotokoll
def ruecksetzprotokoll():
    d = neues_dokument(querformat=True)
    titel(d, "Rücksetzprotokoll",
          "Einmal für den ganzen Testzeitraum ausdrucken. Eine Zeile je Sitzung, "
          "ausgefüllt vor dem Eintreffen der nächsten Person.")
    reihen = [("TN01", "B"), ("TN02", "B"), ("TN03", "B"), ("TN04", "B"), ("TN05", "B"),
              ("TN06", "C"), ("TN07", "C"), ("TN08", "A"), ("TN09", "D"), ("TN10", "D"),
              ("TN11", "A"), ("Reserve", "")]
    zeilen = []
    for ps, f in reihen:
        konto = "kein Konto" if ps in ("TN08", "TN11") else ""
        admin = "" if ps in ("TN09", "TN10") else "entfällt"
        zeilen.append(["", ps, "", "", "", konto, ("Fassung " + f) if f else "", admin, ""])
    t = tabelle(d, ["Datum", "Vor Sitzung", "Daten zurück-\ngesetzt", "Seed gezählt",
                    "Browser-\nprofil frisch", "Testkonto angelegt",
                    "SUS und TAM bereit, Fassung",
                    "Admin-Tage: D3, Kategorien, Top 10, Nominierungen", "Wer"],
                zeilen, breiten=[2.2, 2.4, 2.6, 2.2, 2.4, 3.0, 3.4, 5.2, 2.4], groesse=9)
    for r in t.rows[1:]:
        for c in r.cells:
            c.paragraphs[0].paragraph_format.space_before = Pt(8)
            c.paragraphs[0].paragraph_format.space_after = Pt(8)
    absatz(d, "Die vorgedruckte TAM-Fassung ist ein Kontrollabdruck aus der Sitzungsübersicht in "
              "Confluence. Weicht sie ab, gilt die Übersicht. Ohne diese Zeile weiß hinterher "
              "niemand mehr, ob die dritte Sitzung auf demselben Datenbestand lief wie die erste.",
           10, vor=10)
    return d, "20_Ruecksetzprotokoll.docx"


def alle():
    return [moderation(),
            protokoll("B", 13), protokoll("C", 14), protokoll("D", 15), protokoll(None, 16),
            vor_der_sitzung(), zugangsdaten(), nach_der_sitzung()]
