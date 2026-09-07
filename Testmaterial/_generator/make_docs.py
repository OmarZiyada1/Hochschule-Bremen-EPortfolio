# -*- coding: utf-8 -*-
"""Erzeugt alle Word-Druckvorlagen der Testphase."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx_bau import (neues_dokument, titel, absatz, zwischentitel, linie, kaestchen,
                      tabelle, kastenblock, seitenumbruch, txt)
from aufgaben import AUFGABEN
import docs_leitung
from p4_druck import SUS, PU, PEOU

ZIEL = "d:/malas/Documents/Projects/Hochschule-Bremen-EPortfolio/Testmaterial"
ROT = RGBColor(0xC0, 0x30, 0x20)
GRAU = RGBColor(0x66, 0x66, 0x66)

MARKEN = {
    "A2": [("[Seed-Thema einsetzen]", "[ Seed-Thema ]")],
    "A3": [("[X]", "[ Fakultät ]"), ("[Y]", "[ Semester ]")],
    "B2": [("[Titel]", "[ Projekttitel ]")],
    "C2": [("[Titel]", "[ Projekttitel 1 ]")],
    "C3": [("[Titel]", "[ Projekttitel 2 ]")],
    "D2": [("[Name aus dem Seed]", "[ Name aus dem Seed ]")],
}

BEZUG = {
    "A": ("Studentische Projekte suchen und ansehen",
          "Denk beim Beantworten an das Suchen und Ansehen studentischer Projekte, "
          "so wie du es eben getan hast."),
    "B": ("Eigene Projektarbeiten erstellen und einreichen",
          "Denk beim Beantworten an das Erstellen und Einreichen eigener Projektarbeiten, "
          "so wie du es eben getan hast."),
    "C": ("Eingereichte Projekte prüfen und veröffentlichen",
          "Denk beim Beantworten an das Prüfen und Veröffentlichen eingereichter Projekte, "
          "so wie du es eben getan hast."),
    "D": ("Das Portal verwalten",
          "Denk beim Beantworten an die Verwaltung des Portals, so wie du es eben getan hast."),
}

SKALA7 = ["äußerst\nwahrscheinlich", "ziemlich\nwahrscheinlich", "etwas\nwahrscheinlich",
          "weder\nnoch", "etwas\nunwahr-\nscheinlich", "ziemlich\nunwahr-\nscheinlich",
          "äußerst\nunwahr-\nscheinlich"]


# ---------------------------------------------------------------- 00 Anleitung
def anleitung():
    d = neues_dokument()
    titel(d, "Druckanleitung Testmaterial",
          "Was vor der Testwoche gedruckt wird, wie oft, und wer es in der Sitzung hält.")
    absatz(d, "Die Dateien in diesem Ordner sind die vollständigen Druckvorlagen einer "
              "Testsitzung: Abschnitt 1 listet, was die Testperson in die Hand bekommt, "
              "Abschnitt 2 die Blätter der Testleitung. Die Begründungen dahinter stehen in "
              "Confluence im Bereich „Sitzung durchführen“.", 10.5)

    zwischentitel(d, "1 Was gedruckt wird")
    tabelle(d, ["Datei", "Wie oft", "Menge", "Wer hält es"], [
        ["01 Einwilligung", "je Sitzung", "2 Exemplare", "Moderation"],
        ["02 Kurzbogen", "je Sitzung", "1", "Moderation"],
        ["03 Aufgabenkarten Block A", "einmal für die Woche", "1 Satz (5 Blätter)", "Moderation"],
        ["04 Aufgabenkarten Block B", "einmal, Karte B1 je Sitzung neu",
         "1 Satz (7 Blätter)", "Moderation"],
        ["05 Aufgabenkarten Block C", "einmal für die Woche", "1 Satz (5 Blätter)", "Moderation"],
        ["06 Aufgabenkarten Block D", "einmal für die Woche", "1 Satz (6 Blätter)", "Moderation"],
        ["07 SUS-Bogen", "je Sitzung", "1", "Moderation"],
        ["08 bis 11 TAM-Bogen", "je Sitzung einer, in der passenden Fassung", "1",
         "Moderation"],
    ], breiten=[5.2, 5.0, 3.6, 3.0])

    zwischentitel(d, "2 Was die Testleitung braucht")
    absatz(d, "Diese Blätter bekommt die Testperson nie zu sehen.", 10.5, nach=4)
    tabelle(d, ["Datei", "Wie oft", "Menge", "Wer hält es"], [
        ["12 Moderation", "je Sitzung", "1", "Moderation"],
        ["13 bis 16 Beobachtungsprotokoll", "je Sitzung, in der passenden Fassung", "1",
         "Protokoll"],
        ["17 Vor der Sitzung", "je Testtag", "1", "Testumgebung"],
        ["18 Zugangsdatenblatt", "je Testtag, danach vernichten. Nicht bei TN08 und TN11", "1",
         "Moderation"],
        ["19 Nach der Sitzung", "je Testtag, enthält das Rücksetzprotokoll", "1", "beide Rollen"],
    ], breiten=[5.2, 5.0, 3.6, 3.0])
    absatz(d, "Welches Beobachtungsprotokoll: Fassung „A und B“ für TN00 bis TN05, „A und C“ für "
              "TN06 und TN07, „A und D“ für TN09 und TN10, „nur Block A“ für TN08 und TN11.",
           10.5, vor=4)

    zwischentitel(d, "3 Welche TAM-Fassung wer bekommt")
    absatz(d, "Maßgeblich ist der Rollenblock, nicht der zuerst bearbeitete Block A. Eine falsch "
              "ausgegebene Fassung lässt sich hinterher nicht heilen.", 10.5)
    tabelle(d, ["Sitzung", "Gruppe", "Blöcke", "TAM-Fassung"], [
        ["TN00 (Pilot)", "Pilot, zählt nicht", "A, dann B", "Fassung B"],
        ["TN01 bis TN05", "Studierende", "A, dann B", "Fassung B"],
        ["TN06, TN07", "Redaktion", "A, dann C", "Fassung C"],
        ["TN08, TN11", "Extern", "nur A", "Fassung A"],
        ["TN09, TN10", "Administration", "A, dann D", "Fassung D"],
    ], breiten=[3.6, 4.4, 3.4, 3.6])

    zwischentitel(d, "4 Vor dem Druck ausfüllen")
    absatz(d, "Sieben Stellen in den Aufgabenkarten sind offen. Sie stehen dort in eckigen Klammern "
              "und rot. Eine Karte mit einer roten Klammer darf nicht auf den Tisch.", 10.5)
    tabelle(d, ["Karte", "Was eingesetzt wird", "Wert"], [
        ["A2", "Thema des Zielprojekts", "Baustoffbörse"],
        ["A3", "Fakultät und Semester", "Elektrotechnik und Informatik, WiSe 2025/26"],
        ["B1", "Beide Adressen und das Passwort", "Zugangsdatenblatt der Sitzung, je Sitzung neu"],
        ["B2", "Ein Projekttitel", "frei gewählt, je Sitzung derselbe"],
        ["C2", "Projekttitel, der zurückgegeben wird",
         "Zahlungsbereitschaft für regionale Milch in Bremen"],
        ["C3", "Projekttitel, der veröffentlicht wird",
         "Wiederverwendung von Ziegeln aus einem Abbruch in Walle"],
        ["D2", "Name des Zusatzkontos", "Nele Ostermann"],
    ], breiten=[1.8, 6.2, 8.8])
    absatz(d, "Diese Werte legt der Seed-Bestand fest. Sie werden am Ende jedes Laufs von "
              "Menüpunkt s3 ausgegeben, die Titel für C2 und C3 auch von s5. Wird der Bestand "
              "inhaltlich neu aufgesetzt, gilt die Ausgabe des Skripts und nicht diese Tabelle. "
              "Auf der Karte A3 steht der Name der Fakultät und nicht das Kürzel FK4: in der "
              "Filterleiste steht der Name.", 10, vor=4)

    zwischentitel(d, "5 Reihenfolge in der Sitzung")
    for i, t in enumerate([
        "Begrüßung, Einwilligung unterschreiben lassen (2 Exemplare, eines bleibt bei der Person)",
        "Kurzbogen ausfüllen lassen",
        "Einweisung ins laute Denken und Übungsaufgabe",
        "Block A: Karten A1 bis A5, einzeln übergeben",
        "Rollenblock: Karten des Blocks B, C oder D, einzeln übergeben",
        "SUS-Bogen, allein ausgefüllt",
        "Eine Minute Pause",
        "TAM-Bogen in der passenden Fassung, allein ausgefüllt",
        "Abschlussgespräch, fünf Fragen",
    ], 1):
        absatz(d, "%d.  %s" % (i, t), 10.5, nach=3)

    zwischentitel(d, "6 Nach der Sitzung")
    for t in ["Alle Blätter einsammeln und prüfen: nur Pseudonym, kein Klarname",
              "Karte B1 vernichten, weil das Passwort darauf steht",
              "Zweites Exemplar der Einwilligung bleibt bei der Testperson"]:
        kaestchen(d, t, 10.5)
    absatz(d, "Bei den externen Sitzungen TN08 und TN11 entfällt der Rollenblock. Sie bekommen nur "
              "die Karten A1 bis A5, beide Bögen und den TAM-Bogen in der Fassung A.", 10.5, vor=8)
    return d, "00_Druckanleitung.docx"


# ------------------------------------------------------------- 01 Einwilligung
def einwilligung():
    d = neues_dokument()
    absatz(d, "Zwei Exemplare je Person ausdrucken: eines bleibt bei der Testperson, "
              "eines kommt zu den Unterlagen.", 9, kursiv=True, farbe=GRAU, nach=10)
    titel(d, "Einwilligung zur Teilnahme an einem Usability-Test")
    absatz(d, "Vorhaben: Bachelorarbeit „E-Portfolio Hochschule Bremen“, Hochschule Bremen, "
              "Fakultät 4. Durchführung: Omar Ziyada und Mohamad Alaskari.", 10.5, nach=10)

    for k, v in [
        ("Zweck.", "Es wird untersucht, ob sich ein Portal für studentische Projektarbeiten gut "
         "bedienen lässt. Getestet wird das System, nicht die teilnehmende Person."),
        ("Was passiert.", "Du bearbeitest etwa 48 Minuten lang Aufgaben am Rechner (bei reiner "
         "Besucherperspektive etwa 18 Minuten) und denkst dabei laut mit. Anschließend füllst du "
         "zwei kurze Fragebögen aus und beantwortest fünf offene Fragen. Der Termin dauert "
         "insgesamt etwa 90 Minuten (bei reiner Besucherperspektive etwa 60 Minuten)."),
        ("Was erhoben wird.", "Ein schriftliches Beobachtungsprotokoll (bearbeitete Aufgaben, "
         "benötigte Zeit, Auffälligkeiten, wörtliche Äußerungen), die beiden ausgefüllten "
         "Fragebögen und ein Kurzbogen zur Person (Studiengang, Semester, Selbsteinschätzung zur "
         "Webnutzung, frühere Nutzung von Portfolio-Portalen). Dein Name wird an keiner dieser "
         "Stellen erfasst."),
        ("Aufzeichnung.", "Zusätzlich werden Bildschirminhalt und Ton aufgezeichnet. Die "
         "Aufzeichnung dient allein dazu, das schriftliche Protokoll zu ergänzen, wird lokal "
         "gespeichert, nicht weitergegeben und nach Abgabe und Bewertung der Bachelorarbeit "
         "gelöscht."),
        ("Pseudonymisierung.", "Du erhältst ein Kürzel der Form TN01 bis TN11. Alle Unterlagen "
         "tragen nur dieses Kürzel. Die Liste, die Kürzel und Person verbindet, wird getrennt von "
         "den Testdaten aufbewahrt und nach Abgabe der Arbeit gelöscht."),
        ("Verwendung.", "Die Ergebnisse gehen in anonymisierter Form in die Bachelorarbeit ein. "
         "Zitate werden ausschließlich unter dem Kürzel wiedergegeben."),
        ("Freiwilligkeit und Widerruf.", "Die Teilnahme ist freiwillig. Du kannst den Test "
         "jederzeit und ohne Angabe von Gründen abbrechen. Du kannst deine Einwilligung bis zur "
         "Abgabe der Bachelorarbeit formlos widerrufen; deine Daten werden dann vollständig "
         "gelöscht. Aus einem Abbruch oder Widerruf entsteht dir kein Nachteil."),
    ]:
        p = d.add_paragraph()
        r = p.add_run(k + " ")
        r.bold = True
        r.font.size = Pt(10.5)
        r2 = p.add_run(v)
        r2.font.size = Pt(10.5)
        p.paragraph_format.space_after = Pt(7)

    linie(d, "Kontakt für Rückfragen und Widerruf:", 52, 10.5, nach=14)
    kaestchen(d, "Ich habe die Hinweise gelesen und willige in die Teilnahme ein.", 10.5)
    kaestchen(d, "Ich willige zusätzlich in die Aufzeichnung von Bildschirm und Ton ein.", 10.5)
    d.add_paragraph()
    p = d.add_paragraph()
    r = p.add_run("Ort, Datum: ______________________________"
                  "          Unterschrift: ______________________________")
    r.font.size = Pt(10.5)
    return d, "01_Einwilligung.docx"


# ---------------------------------------------------------------- 02 Kurzbogen
def kurzbogen():
    d = neues_dokument()
    titel(d, "Kurzbogen zur Person")
    linie(d, "Pseudonym:", 20, 12, nach=4)
    absatz(d, "Vier Fragen, kein Name. Vor der ersten Aufgabe auszufüllen.", 9.5,
           kursiv=True, farbe=GRAU, nach=14)
    fragen = [
        "Studiengang und Fakultät (bei externen Personen: Tätigkeit)",
        "Fachsemester (bei externen Personen: entfällt)",
        "Wie sicher fühlst du dich im Umgang mit Webanwendungen?",
        "Hast du schon einmal ein Portfolio-Portal oder eine ähnliche Projektplattform benutzt? "
        "Wenn ja, welche?",
    ]
    for i, f in enumerate(fragen, 1):
        p = d.add_paragraph()
        r = p.add_run("%d.  %s" % (i, f))
        r.bold = True
        r.font.size = Pt(11)
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(6)
        if i == 3:
            t = tabelle(d, ["1\nunsicher", "2", "3", "4", "5\nsehr sicher"],
                        [["", "", "", "", ""]], breiten=[3.4] * 5, groesse=10)
            for r2 in t.rows[1:]:
                for c in r2.cells:
                    c.paragraphs[0].paragraph_format.space_before = Pt(9)
                    c.paragraphs[0].paragraph_format.space_after = Pt(9)
            absatz(d, "Bitte ein Feld ankreuzen.", 9, kursiv=True, farbe=GRAU, nach=2)
        else:
            for _ in range(2 if i != 4 else 3):
                linie(d, "", 78, 11, nach=8)
    return d, "02_Kurzbogen.docx"


# ------------------------------------------------------------ 03-06 Karten
def karten(block, nummer):
    d = neues_dokument()
    liste = [a for a in AUFGABEN if a["block"] == block]
    namen = {"A": "Block A: ohne Anmeldung", "B": "Block B: Studierende",
             "C": "Block C: Redaktion", "D": "Block D: Administration"}
    for n, a in enumerate(liste):
        if n:
            seitenumbruch(d)
        absatz(d, namen[block] + "   ·   Karte %d von %d" % (n + 1, len(liste)),
               9, farbe=GRAU, nach=16)
        p = d.add_paragraph()
        r = p.add_run("Aufgabe " + a["kennung"])
        r.bold = True
        r.font.size = Pt(13)
        r.font.color.rgb = GRAU
        p.paragraph_format.space_after = Pt(10)

        s = txt(a["szenario"])
        marken = MARKEN.get(a["kennung"], [])
        t = d.add_table(rows=1, cols=1)
        t.style = "Table Grid"
        zelle = t.rows[0].cells[0]
        zelle.text = ""
        par = zelle.paragraphs[0]
        par.paragraph_format.space_before = Pt(14)
        par.paragraph_format.space_after = Pt(14)
        rest = s
        if marken:
            for alt, neu in marken:
                vor, _, rest = rest.partition(alt)
                run = par.add_run(vor)
                run.font.size = Pt(18)
                run2 = par.add_run(neu)
                run2.font.size = Pt(18)
                run2.bold = True
                run2.font.color.rgb = ROT
        run = par.add_run(rest)
        run.font.size = Pt(18)

        if a["kennung"] == "B1":
            zusatz = zelle.add_paragraph()
            zusatz.paragraph_format.space_before = Pt(18)
            for label in ["Adresse 1:", "Adresse 2:", "Passwort:"]:
                q = zelle.add_paragraph()
                rr = q.add_run(label + "  " + "_" * 34)
                rr.font.size = Pt(15)
                q.paragraph_format.space_after = Pt(12)
        if marken:
            absatz(d, "Vor dem Druck: die rot markierte Stelle durch den echten Wert ersetzen.",
                   9, kursiv=True, farbe=ROT, vor=10)
    return d, "%02d_Aufgabenkarten_Block_%s.docx" % (nummer, block)


# --------------------------------------------------------------- 07 SUS-Bogen
def sus_bogen():
    d = neues_dokument()
    titel(d, "Fragebogen zur Gebrauchstauglichkeit")
    linie(d, "Pseudonym:", 20, 12, nach=6)
    absatz(d, "Mit „dem System“ ist in allen zehn Aussagen das Portal gemeint, das du gerade "
              "benutzt hast. Bitte kreuze in jeder Zeile genau ein Feld an. Es gibt kein richtig "
              "und kein falsch.", 10.5, nach=4)
    absatz(d, "Bitte kein Item auslassen. Wer unschlüssig ist, kreuzt die Mitte an.",
           10, fett=True, nach=10)
    absatz(d, "1 = stimme überhaupt nicht zu          5 = stimme voll zu",
           10, fett=True, nach=8, ausrichtung=WD_ALIGN_PARAGRAPH.CENTER)

    t = d.add_table(rows=1, cols=7)
    t.style = "Table Grid"
    kopf = ["Nr.", "Aussage", "1", "2", "3", "4", "5"]
    for i, c in enumerate(kopf):
        z = t.rows[0].cells[i]
        z.text = ""
        r = z.paragraphs[0].add_run(c)
        r.bold = True
        r.font.size = Pt(10)
    for nr, pol, de, en in SUS:
        row = t.add_row()
        z = row.cells[0]
        z.text = ""
        r = z.paragraphs[0].add_run(str(nr))
        r.font.size = Pt(10)
        z2 = row.cells[1]
        z2.text = ""
        p1 = z2.paragraphs[0]
        r1 = p1.add_run(txt(de))
        r1.font.size = Pt(10.5)
        p2 = z2.add_paragraph()
        r2 = p2.add_run(txt(en))
        r2.font.size = Pt(8)
        r2.italic = True
        r2.font.color.rgb = GRAU
        p2.paragraph_format.space_after = Pt(2)
        for k in range(2, 7):
            row.cells[k].text = ""
    for row in t.rows:
        row.cells[0].width = Cm(1.0)
        row.cells[1].width = Cm(9.4)
        for k in range(2, 7):
            row.cells[k].width = Cm(1.3)
    return d, "07_SUS-Bogen.docx"


# ------------------------------------------------------------- 08-11 TAM-Bogen
def tam_bogen(fassung, nummer):
    aufgaben_text, bezug = BEZUG[fassung]
    d = neues_dokument()
    titel(d, "Fragebogen zur Einschätzung des Portals",
          "Fassung %s   ·   %s" % (fassung, aufgaben_text))
    p = d.add_paragraph()
    for lab, br in [("Pseudonym: ", 16), ("      Aufgabenblock: %s" % fassung, 0),
                    ("      Datum: ", 16)]:
        r = p.add_run(lab + ("_" * br))
        r.font.size = Pt(12)
    p.paragraph_format.space_after = Pt(10)

    kastenblock(d, [(bezug, 12, True)])
    absatz(d, "Vierzehn Aussagen. Kreuze in jeder Zeile genau ein Feld an, je nachdem, wie "
              "wahrscheinlich die Aussage für dich ist. Es gibt keine richtigen und keine falschen "
              "Antworten.", 10.5, vor=10, nach=12)

    def block(überschrift, items, gemeinsam=None):
        zwischentitel(d, überschrift)
        if gemeinsam:
            kastenblock(d, [(gemeinsam, 11, True)])
            d.add_paragraph().paragraph_format.space_after = Pt(2)
        for kennung, de, en in items:
            pp = d.add_paragraph()
            r = pp.add_run(txt(de))
            r.font.size = Pt(11)
            r.bold = True
            pp.paragraph_format.space_before = Pt(10)
            pp.paragraph_format.space_after = Pt(1)
            if en:
                qq = d.add_paragraph()
                r2 = qq.add_run(txt(en))
                r2.font.size = Pt(8)
                r2.italic = True
                r2.font.color.rgb = GRAU
                qq.paragraph_format.space_after = Pt(3)
            t = d.add_table(rows=2, cols=7)
            t.style = "Table Grid"
            etiketten = SKALA7 if kennung != "BI2" else [
                "nicht\nzu erwarten", "", "", "weder\nnoch", "", "", "zu erwarten"]
            for i in range(7):
                z = t.rows[0].cells[i]
                z.text = ""
                pz = z.paragraphs[0]
                pz.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for j, teil in enumerate(etiketten[i].split("\n")):
                    if j:
                        pz = z.add_paragraph()
                        pz.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    rr = pz.add_run(teil)
                    rr.font.size = Pt(7.5)
                    rr.font.color.rgb = GRAU
                    pz.paragraph_format.space_after = Pt(0)
                z2 = t.rows[1].cells[i]
                z2.text = ""
                z2.paragraphs[0].paragraph_format.space_before = Pt(7)
                z2.paragraphs[0].paragraph_format.space_after = Pt(7)
            for row in t.rows:
                for c in row.cells:
                    c.width = Cm(2.4)

    block("Teil 1: Nutzen für deine Aufgaben", [(k, de, en) for k, de, en in PU])
    seitenumbruch(d)
    block("Teil 2: Umgang mit dem Portal", [(k, de, en) for k, de, en in PEOU])
    seitenumbruch(d)
    block("Teil 3: Künftige Nutzung",
          [("BI1", "Angenommen, das Portal stünde mir zur Verfügung: Ich sage voraus, dass ich es "
            "künftig regelmäßig nutzen werde.", None),
           ("BI2", "Angenommen, das Portal stünde mir zur Verfügung: Ich sage voraus, dass ich es "
            "künftig regelmäßig nutzen werde.", None)],
          gemeinsam="Beide folgenden Aussagen beziehen sich auf denselben Satz. Bitte beachte, "
                    "dass die Beschriftung der zweiten Zeile umgekehrt ist.")
    absatz(d, "Bitte prüfe zum Schluss, dass in allen vierzehn Zeilen ein Feld angekreuzt ist.",
           10, fett=True, vor=14)
    return d, "%02d_TAM-Bogen_Fassung_%s.docx" % (nummer, fassung)


def main():
    os.makedirs(ZIEL, exist_ok=True)
    bauen = [anleitung(), einwilligung(), kurzbogen(),
             karten("A", 3), karten("B", 4), karten("C", 5), karten("D", 6),
             sus_bogen(),
             tam_bogen("A", 8), tam_bogen("B", 9), tam_bogen("C", 10),
             tam_bogen("D", 11)] + docs_leitung.alle()
    for d, name in bauen:
        pfad = os.path.join(ZIEL, name)
        d.save(pfad)
        print("%-42s %6d Bytes" % (name, os.path.getsize(pfad)))


if __name__ == "__main__":
    main()
