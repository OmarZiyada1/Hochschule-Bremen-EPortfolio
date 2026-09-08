# -*- coding: utf-8 -*-
"""Die konkreten Werte, die auf den Aufgabenkarten stehen.

Warum diese Datei getrennt von aufgaben.py steht: Die Aufgabentexte dort sind
der Aufgabenkatalog, wortgleich mit der Confluence-Seite, und bleiben deshalb
allgemein. Was am Ende auf dem Papier steht, legt der Seed-Bestand fest, und
das steht hier. So laesst sich der Bestand neu aufsetzen, ohne den Katalog
anzufassen, und die Karten kommen fertig aus dem Drucker.

Quelle ist die Ausgabe von test-seeder.sh (Menuepunkt s3), Abschnitt
"Fuer die Aufgabenkarten". Wird der Bestand inhaltlich neu aufgesetzt, gilt
die Ausgabe des Skripts, und diese Datei wird danach nachgezogen.
"""

# --- vom Seed-Bestand festgelegt --------------------------------------------
THEMA_A2 = "Baustoffbörse"                 # Projekt "Baustoffbörse am Neustadtswall"
FAKULTAET_A3 = "Elektrotechnik und Informatik"   # der Name, nicht das Kuerzel FK4
SEMESTER_A3 = "WiSe 2025/26"
PROJEKT_A5 = "Mehrwegpfand in der Bremer Gastronomie"
TITEL_C2 = "Zahlungsbereitschaft für regionale Milch in Bremen"
TITEL_C3 = "Wiederverwendung von Ziegeln aus einem Abbruch in Walle"
NAME_D2 = "Nele Ostermann"

# --- frei gewaehlt -----------------------------------------------------------
# B2 legt kein Seed-Bestand fest: die Testperson tippt den Titel selbst ein.
# Er muss nur kurz genug fuer das Budget von drei Minuten sein und mit keinem
# der 57 Seed-Projekte kollidieren.
TITEL_B2 = "Lastenrad-Verleih im Bremer Westen"

# --- Zugangsdaten je Sitzung -------------------------------------------------
# Das Adressmuster stammt aus test-sitzung.sh: die Kennung ist die private
# Adresse, die Hochschuladresse ist die Verwechslungsgefahr, um die es in B1
# geht. Block B haben TN00 bis TN05, alle mit der Rolle STUDENT.
PSEUDONYME_BLOCK_B = ["TN00", "TN01", "TN02", "TN03", "TN04", "TN05"]


def adressen(pseudonym):
    """Beide Adressen eines Sitzungskontos, in der Reihenfolge der Karte."""
    nummer = pseudonym[-2:]
    return ("tn%s@test.invalid" % nummer, "tn%s@stud.hs-bremen.de" % nummer)


# --- Ersetzungen -------------------------------------------------------------
# Im Szenariotext, also auf der Karte, die die Testperson in die Hand bekommt.
# Titel stehen in einfachen Anfuehrungszeichen, weil das Szenario selbst schon
# in doppelten steht.
KARTE = {
    "A2": [("[Seed-Thema einsetzen]", THEMA_A2)],
    "A3": [("[X]", FAKULTAET_A3), ("[Y]", SEMESTER_A3)],
    "B2": [("[Titel]", "‚%s‘" % TITEL_B2)],
    "C2": [("[Titel]", "‚%s‘" % TITEL_C2)],
    "C3": [("[Titel]", "‚%s‘" % TITEL_C3)],
    "D2": [("[Name aus dem Seed]", NAME_D2)],
}

# Im Startzustand, also in Abschnitt 9 des Moderationsblatts. A5 nennt dort
# bisher nur "ein inhaltsreiches Projekt"; welches gemeint ist, sagt der Seed.
START = {
    "A5": [("Ein inhaltsreiches Projekt aus A2 oder A4",
            "Das Projekt „%s“ (aus A2 oder A4)" % PROJEKT_A5)],
    "C2": [("[Titel]", "„%s“" % TITEL_C2)],
    "C3": [("[Titel]", "„%s“" % TITEL_C3)],
}


def einsetzen(text, ersetzungen):
    """Ersetzungen der Reihe nach anwenden. Fehlt eine Marke, faellt sie
    stillschweigend weg: der Aufgabenkatalog darf sich aendern, ohne dass das
    Erzeugen abbricht."""
    for alt, neu in ersetzungen or []:
        text = text.replace(alt, neu)
    return text


def start(kennung, text):
    return einsetzen(text, START.get(kennung))
