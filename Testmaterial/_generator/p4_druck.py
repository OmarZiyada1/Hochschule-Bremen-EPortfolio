# -*- coding: utf-8 -*-
"""Seite: 4 Druckvorlagen fuer Teilnehmende"""
from bau import *

SUS = [
 (1, "positiv", "Ich denke, dass ich das System gerne regelm&auml;&szlig;ig nutzen w&uuml;rde.",
  "I think that I would like to use this system frequently"),
 (2, "negativ", "Ich fand das System unn&ouml;tig komplex.",
  "I found the system unnecessarily complex"),
 (3, "positiv", "Ich fand das System einfach zu benutzen.",
  "I thought the system was easy to use"),
 (4, "negativ", "Ich glaube, ich w&uuml;rde die Unterst&uuml;tzung einer technisch versierten Person "
  "ben&ouml;tigen, um das System zu benutzen.",
  "I think that I would need the support of a technical person to use this system"),
 (5, "positiv", "Ich fand, die verschiedenen Funktionen des Systems waren gut integriert.",
  "I found the various functions in this system were well integrated"),
 (6, "negativ", "Ich denke, das System enthielt zu viele Inkonsistenzen.",
  "I thought there was too much inconsistency in this system"),
 (7, "positiv", "Ich kann mir vorstellen, dass die meisten Menschen den Umgang mit diesem System sehr "
  "schnell lernen.", "I would imagine that most people would learn to use this system very quickly"),
 (8, "negativ", "Ich fand das System sehr umst&auml;ndlich zu nutzen.",
  "I found the system very cumbersome to use"),
 (9, "positiv", "Ich f&uuml;hlte mich bei der Nutzung des Systems sehr sicher.",
  "I felt very confident using the system"),
 (10, "negativ", "Ich musste eine Menge lernen, bevor ich mit dem System zurechtkam.",
  "I needed to learn a lot of things before I could get going with this system"),
]

PU = [
 ("PU1", "Die Nutzung des Portals w&uuml;rde es mir erm&ouml;glichen, diese Aufgaben schneller zu "
  "erledigen.", "Using [X] in my job would enable me to accomplish tasks more quickly."),
 ("PU2", "Die Nutzung des Portals w&uuml;rde meine Leistung bei diesen Aufgaben verbessern.",
  "Using [X] would improve my job performance."),
 ("PU3", "Die Nutzung des Portals w&uuml;rde meine Produktivit&auml;t bei diesen Aufgaben "
  "erh&ouml;hen.", "Using [X] in my job would increase my productivity."),
 ("PU4", "Die Nutzung des Portals w&uuml;rde meine Effektivit&auml;t bei diesen Aufgaben steigern.",
  "Using [X] would enhance my effectiveness on the job."),
 ("PU5", "Die Nutzung des Portals w&uuml;rde mir diese Aufgaben erleichtern.",
  "Using [X] would make it easier to do my job."),
 ("PU6", "Ich w&uuml;rde das Portal f&uuml;r diese Aufgaben n&uuml;tzlich finden.",
  "I would find [X] useful in my job."),
]

PEOU = [
 ("PEOU1", "Es w&uuml;rde mir leichtfallen, den Umgang mit dem Portal zu erlernen.",
  "Learning to operate [X] would be easy for me."),
 ("PEOU2", "Ich w&uuml;rde es leicht finden, das Portal dazu zu bringen, das zu tun, was ich "
  "m&ouml;chte.", "I would find it easy to get [X] to do what I want it to do."),
 ("PEOU3", "Meine Interaktion mit dem Portal w&auml;re klar und verst&auml;ndlich.",
  "My interaction with [X] would be clear and understandable."),
 ("PEOU4", "Ich w&uuml;rde den Umgang mit dem Portal als flexibel empfinden.",
  "I would find [X] to be flexible to interact with."),
 ("PEOU5", "Es w&uuml;rde mir leichtfallen, im Umgang mit dem Portal sicher zu werden.",
  "It would be easy for me to become skillful at using [X]."),
 ("PEOU6", "Ich w&uuml;rde das Portal einfach zu bedienen finden.", "I would find [X] easy to use."),
]

def build():
    s = []
    s.append(kopf(
        "die Moderation, zur &Uuml;bergabe an die Testperson.",
        "je Sitzung einmal ausgedruckt. Alles auf dieser Seite ist eine Druckvorlage: die Testperson "
        "sieht nur Papier, nie den Bildschirm dieser Seite."))
    s.append(panel("info", p(
        b("Ein Stapel je Sitzung, in dieser Reihenfolge:") + " zwei Einwilligungen, ein Kurzbogen, die "
        "Aufgabenkarten Block A, die Karten des Rollenblocks, der SUS-Bogen, der TAM-Bogen in der "
        "richtigen Fassung. Die vier TAM-Fassungen werden getrennt gestapelt und beschriftet.")))

    # 1 Einwilligung
    s.append(h1("1 Einverst&auml;ndniserkl&auml;rung"))
    s.append(p(b("Zwei Exemplare je Person:") + " eines f&uuml;r die Testperson, eines f&uuml;r die "
               "Unterlagen. Vor dem Druck das Kontaktfeld ausf&uuml;llen."))
    s.append("<hr />")
    s.append(h3("Einwilligung zur Teilnahme an einem Usability-Test"))
    s.append(p(b("Vorhaben:") + " Bachelorarbeit &bdquo;E-Portfolio Hochschule Bremen&ldquo;, Hochschule "
               "Bremen, Fakult&auml;t 4. Durchf&uuml;hrung: Omar Ziyada und Mohamad Alaskari."))
    s.append(p(b("Zweck.") + " Es wird untersucht, ob sich ein Portal f&uuml;r studentische "
               "Projektarbeiten gut bedienen l&auml;sst. Getestet wird das System, nicht die teilnehmende "
               "Person."))
    s.append(p(b("Was passiert.") + " Du bearbeitest etwa 48 Minuten lang Aufgaben am Rechner (bei "
               "reiner Besucherperspektive etwa 18 Minuten) und denkst dabei laut mit. "
               "Anschlie&szlig;end f&uuml;llst du zwei kurze Frageb&ouml;gen aus und beantwortest "
               "f&uuml;nf offene Fragen. Der Termin dauert insgesamt etwa 90 Minuten (bei reiner "
               "Besucherperspektive etwa 60 Minuten)."))
    s.append(p(b("Was erhoben wird.") + " Ein schriftliches Beobachtungsprotokoll (bearbeitete Aufgaben, "
               "ben&ouml;tigte Zeit, Auff&auml;lligkeiten, w&ouml;rtliche &Auml;u&szlig;erungen), die "
               "beiden ausgef&uuml;llten Frageb&ouml;gen und ein Kurzbogen zur Person (Studiengang, "
               "Semester, Selbsteinsch&auml;tzung zur Webnutzung, fr&uuml;here Nutzung von "
               "Portfolio-Portalen). Dein Name wird an keiner dieser Stellen erfasst."))
    s.append(p(b("Aufzeichnung.") + " Zus&auml;tzlich werden Bildschirminhalt und Ton aufgezeichnet. Die "
               "Aufzeichnung dient allein dazu, das schriftliche Protokoll zu erg&auml;nzen, wird lokal "
               "gespeichert, nicht weitergegeben und nach Abgabe und Bewertung der Bachelorarbeit "
               "gel&ouml;scht."))
    s.append(p(b("Pseudonymisierung.") + " Du erh&auml;ltst ein K&uuml;rzel der Form TN01 bis TN11. Alle "
               "Unterlagen tragen nur dieses K&uuml;rzel. Die Liste, die K&uuml;rzel und Person "
               "verbindet, wird getrennt von den Testdaten aufbewahrt und nach Abgabe der Arbeit "
               "gel&ouml;scht."))
    s.append(p(b("Verwendung.") + " Die Ergebnisse gehen in anonymisierter Form in die Bachelorarbeit "
               "ein. Zitate werden ausschlie&szlig;lich unter dem K&uuml;rzel wiedergegeben."))
    s.append(p(b("Freiwilligkeit und Widerruf.") + " Die Teilnahme ist freiwillig. Du kannst den Test "
               "jederzeit und ohne Angabe von Gr&uuml;nden abbrechen. Du kannst deine Einwilligung bis "
               "zur Abgabe der Bachelorarbeit formlos widerrufen; deine Daten werden dann "
               "vollst&auml;ndig gel&ouml;scht. Aus einem Abbruch oder Widerruf entsteht dir kein "
               "Nachteil."))
    s.append(p(b("Kontakt f&uuml;r R&uuml;ckfragen und Widerruf:") +
               " ..............................................................."))
    s.append(p("&#9744; Ich habe die Hinweise gelesen und willige in die Teilnahme ein."))
    s.append(p("&#9744; Ich willige zus&auml;tzlich in die Aufzeichnung von Bildschirm und Ton ein."))
    s.append(p("Ort, Datum: ..................................................&nbsp;&nbsp;&nbsp;&nbsp;"
               "Unterschrift: .................................................."))
    s.append("<hr />")

    # 2 Kurzbogen
    s.append(h1("2 Kurzbogen zur Person"))
    s.append(p("Vier Fragen, kein Name, vor der ersten Aufgabe ausgef&uuml;llt. Kopf: "
               + b("Pseudonym TN..")))
    s.append(table(["Nr.", "Frage", "Antwort"],
        [["1", "Studiengang und Fakult&auml;t (bei externen Personen: T&auml;tigkeit)", ""],
         ["2", "Fachsemester (bei externen Personen: entf&auml;llt)", ""],
         ["3", "Wie sicher f&uuml;hlst du dich im Umgang mit Webanwendungen? 1 = unsicher bis "
               "5 = sehr sicher", ""],
         ["4", "Hast du schon einmal ein Portfolio-Portal oder eine &auml;hnliche Projektplattform "
               "benutzt? Wenn ja, welche?", ""]]))

    # 3 Aufgabenkarten
    s.append(h1("3 Aufgabenkarten"))
    s.append(p("Je Aufgabe eine Karte. Der Szenariotext steht auf "
               + pagelink("Aufgabenkatalog A bis D") + " und wird von dort gedruckt; er wird hier nicht "
               "wiederholt, damit es keine zweite Fassung gibt."))
    s.append(table(["Auf der Karte steht", "Auf der Karte steht nicht"],
        [["Der Szenariotext w&ouml;rtlich, dazu die Aufgabenkennung klein in einer Ecke. Bei B1 und "
          "C1 zus&auml;tzlich die Anmeldeadresse und das Passwort",
          "Zeitbudget, Startzustand, Erfolgskriterium und Beobachtungsfokus. Wer das Erfolgskriterium "
          "liest, arbeitet darauf hin statt auf das Ziel"]]))
    s.append(tasks([
        "Klammern gef&uuml;llt: Seed-Thema in A2, Fakult&auml;t und Semester in A3, Titel in B2, "
        "Projekttitel in C3, C4 und C6, Name in D2",
        "Karten in Blockreihenfolge gestapelt, Block A oben",
        "Karten des Rollenblocks getrennt danebengelegt; bei TN08 und TN11 entfallen sie",
        "Karte B1 bzw. C1 nach der Sitzung einsammeln und vernichten, weil das Passwort darauf "
        "steht",
    ]))

    # 4 SUS
    s.append(h1("4 SUS-Bogen"))
    s.append(p("Kopf des Bogens: " + b("Pseudonym TN..") + ", sonst nichts. Kein Name, kein Datum der "
               "Person. Alle zehn Items in der Originalreihenfolge, kein Item darf leer bleiben."))
    s.append(p(b("Antwortskala:") + " 1 = stimme &uuml;berhaupt nicht zu, 2, 3, 4, 5 = stimme voll zu. "
               "Die beiden Skalenenden werden auf dem gedruckten Bogen " + b("beschriftet") + ", nicht "
               "nur die Zahlen."))
    s.append(p(b("Die deutsche Fassung ist verbindlich") + " und wird angekreuzt; das englische Original "
               "(Brooke, 1996) steht zur Nachvollziehbarkeit daneben und erscheint auf dem gedruckten "
               "Bogen in kleinerer Schrift."))
    s.append(table(
        ["Nr.", "Polung", "Deutsche Fassung (verbindlich)", "Englisches Original", "1", "2", "3", "4",
         "5"],
        [[str(n), pol, de, "<em>" + en + "</em>", "", "", "", "", ""] for n, pol, de, en in SUS],
        layout="full-width"))
    s.append(p("Der Rechenweg steht auf " + pagelink("Nachlauf 1: SUS und TAM rechnen") + ". Auf diesem "
               "Blatt wird nur angekreuzt."))

    # 5 TAM
    s.append(h1("5 TAM-Bogen"))
    s.append(panel("warning", p(
        b("Offen ist nur die englische Zweitzeile der beiden BI-Items.") + " Der deutsche Wortlaut aller "
        "vierzehn Items ist verbindlich und druckfertig. F&uuml;r die beiden Items zur Nutzungsabsicht "
        "stammt das englische Original aus der Methodenbeschreibung von Studie 2 bei Davis (1989) und "
        "nicht aus dem Anhang auf Seite 340; es ist vor der Drucklegung am Original zu pr&uuml;fen. Bis "
        "dahin tragen diese beiden Zeilen keine englische Zweitzeile. Der Bogen wird deswegen nicht "
        "zur&uuml;ckgehalten.")))
    s.append(h2("5.1 Kopf des Bogens"))
    s.append(p(b("Pseudonym TN..") + ", Aufgabenblock (A, B, C oder D), Datum. Kein Name. Darunter steht "
               "genau " + b("ein") + " vorgedruckter Bezugssatz."))
    s.append(table(["Fassung", "Bearbeitete Aufgaben", "Vorgedruckter Bezugssatz"],
        [["A", "Studentische Projekte suchen und ansehen",
          "&bdquo;Denk beim Beantworten an das Suchen und Ansehen studentischer Projekte, so wie du es "
          "eben getan hast.&ldquo;"],
         ["B", "Eigene Projektarbeiten erstellen und einreichen",
          "&bdquo;Denk beim Beantworten an das Erstellen und Einreichen eigener Projektarbeiten, so wie "
          "du es eben getan hast.&ldquo;"],
         ["C", "Eingereichte Projekte pr&uuml;fen und ver&ouml;ffentlichen",
          "&bdquo;Denk beim Beantworten an das Pr&uuml;fen und Ver&ouml;ffentlichen eingereichter "
          "Projekte, so wie du es eben getan hast.&ldquo;"],
         ["D", "Das Portal verwalten",
          "&bdquo;Denk beim Beantworten an die Verwaltung des Portals, so wie du es eben getan "
          "hast.&ldquo;"]]))
    s.append(p("Alle 14 Items sind in allen vier Fassungen w&ouml;rtlich identisch; allein der "
               "Bezugssatz im Kopf weicht ab. Welche Fassung ausgegeben wird, regelt "
               + pagelink("1 Vor der Sitzung") + "."))
    s.append(h2("5.2 Antwortformat: siebenstufiges semantisches Differenzial"))
    s.append(p("Anders als beim SUS wird keine Zustimmung von 1 bis 5 angekreuzt, sondern eine Position "
               "zwischen zwei Polen. Zahlen stehen " + b("nicht") + " auf dem gedruckten Bogen; die "
               "Testperson sieht nur die Beschriftungen."))
    s.append(table(["Position", "Beschriftung auf dem Bogen"],
        [["1 (links)", "&auml;u&szlig;erst wahrscheinlich"], ["2", "ziemlich wahrscheinlich"],
         ["3", "etwas wahrscheinlich"], ["4", "weder noch"], ["5", "etwas unwahrscheinlich"],
         ["6", "ziemlich unwahrscheinlich"], ["7 (rechts)", "&auml;u&szlig;erst unwahrscheinlich"]]))
    s.append(p("Jedes der 14 Items tr&auml;gt auf dem gedruckten Bogen genau eine solche siebenstufige "
               "Zeile, mit den beiden Endpunkten links und rechts daneben."))
    s.append(h2("5.3 Skala 1: Wahrgenommene N&uuml;tzlichkeit (PU)"))
    s.append(table(["Kennung", "Deutsche Fassung (verbindlich)",
                    "Englisches Original (Davis, 1989, S. 340)", "Linker Endpunkt", "1", "2", "3", "4",
                    "5", "6", "7", "Rechter Endpunkt"],
        [[k, de, "<em>" + en + "</em>", "&auml;u&szlig;erst wahrscheinlich", "", "", "", "", "", "", "",
          "&auml;u&szlig;erst unwahrscheinlich"] for k, de, en in PU], layout="full-width"))
    s.append(h2("5.4 Skala 2: Wahrgenommene Benutzerfreundlichkeit (PEOU)"))
    s.append(table(["Kennung", "Deutsche Fassung (verbindlich)",
                    "Englisches Original (Davis, 1989, S. 340)", "Linker Endpunkt", "1", "2", "3", "4",
                    "5", "6", "7", "Rechter Endpunkt"],
        [[k, de, "<em>" + en + "</em>", "&auml;u&szlig;erst wahrscheinlich", "", "", "", "", "", "", "",
          "&auml;u&szlig;erst unwahrscheinlich"] for k, de, en in PEOU], layout="full-width"))
    s.append(p("Der Platzhalter " + b("[X]") + " steht im Original f&uuml;r das untersuchte System und "
               "ist in der deutschen Fassung durch &bdquo;das Portal&ldquo; ersetzt; &bdquo;in my "
               "job&ldquo; ist durch &bdquo;diese Aufgaben&ldquo; ersetzt, konkretisiert durch den "
               "vorgedruckten Bezugssatz. " + b("Itemzahl, Reihenfolge, Antwortformat und Polung bleiben "
               "unver&auml;ndert.")))
    s.append(h2("5.5 Skala 3: Nutzungsabsicht (BI)"))
    s.append(p("Beide Items beziehen sich auf dieselbe Aussage, die &uuml;ber ihnen auf dem Bogen steht: "
               + i("&bdquo;Angenommen, das Portal st&uuml;nde mir zur Verf&uuml;gung: Ich sage voraus, "
                   "dass ich es k&uuml;nftig regelm&auml;&szlig;ig nutzen werde.&ldquo;")))
    s.append(table(["Kennung", "Endpunktpaar", "Englisches Original", "Linker Endpunkt", "1", "2", "3",
                    "4", "5", "6", "7", "Rechter Endpunkt"],
        [["BI1", "links &bdquo;wahrscheinlich&ldquo;, rechts &bdquo;unwahrscheinlich&ldquo;; "
                 "unver&auml;ndert gepolt",
          "wird erst nach Pr&uuml;fung am Original abgedruckt", "&auml;u&szlig;erst wahrscheinlich",
          "", "", "", "", "", "", "", "&auml;u&szlig;erst unwahrscheinlich"],
         ["BI2", "links &bdquo;nicht zu erwarten&ldquo;, rechts &bdquo;zu erwarten&ldquo;; gespiegelt "
                 "gedruckt, wird bei der Auswertung umgepolt",
          "wird erst nach Pr&uuml;fung am Original abgedruckt", "nicht zu erwarten",
          "", "", "", "", "", "", "", "zu erwarten"]], layout="full-width"))
    s.append(panel("warning", p(
        b("BI2 ist das einzige gedrehte Item auf dem ganzen Bogen.") + " Beim Ausf&uuml;llen &auml;ndert "
        "das nichts, beim Auswerten alles: Die Umpolung zu vergessen ist der h&auml;ufigste "
        "Auswertungsfehler und liefert eine plausibel aussehende, aber falsche Zahl. Widersprechen sich "
        "BI1 und BI2 erkennbar, wird das im Protokoll vermerkt und nicht stillschweigend "
        "gegl&auml;ttet.")))
    return "".join(s)
