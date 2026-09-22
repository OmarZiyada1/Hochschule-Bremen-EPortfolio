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
TITEL_C3 = "Zahlungsbereitschaft für regionale Milch in Bremen"       # wird zurueckgegeben
TITEL_C4 = "Wiederverwendung von Ziegeln aus einem Abbruch in Walle"  # wird veroeffentlicht,
                                                                      # in C5 nominiert
TITEL_C6 = "Audiowalk zur Werftgeschichte in Gröpelingen"             # bekommt die Notiz
NAME_D3 = "Nele Ostermann"
KATEGORIE_D4_A = "Studienprojekt"           # die zwei gleichbedeutenden Kategorien
KATEGORIE_D4_B = "Studentisches Projekt"   # aus test-seeder.sh, Abschnitt 2

# --- frei gewaehlt -----------------------------------------------------------
# B2 legt kein Seed-Bestand fest: die Testperson tippt den Titel selbst ein.
# Er muss nur kurz genug fuer das Budget von drei Minuten sein und mit keinem
# der 57 Seed-Projekte kollidieren.
TITEL_B2 = "Lastenrad-Verleih im Bremer Westen"

# --- Zugangsdaten je Sitzung -------------------------------------------------
# Das Adressmuster stammt aus test-sitzung.sh. Auf der Karte steht allein die
# Anmeldeadresse, also die private Adresse des Kontos; die Hochschuladresse
# wird zum Anmelden nicht gebraucht und steht deshalb nicht darauf. Block B
# haben TN00 bis TN05 mit der Rolle STUDENT, Block C haben TN06 und TN07 mit
# der Rolle EDITOR, Block D haben TN09 und TN10 mit der Rolle ADMIN.
PSEUDONYME_BLOCK_B = ["TN00", "TN01", "TN02", "TN03", "TN04", "TN05"]
PSEUDONYME_BLOCK_C = ["TN06", "TN07"]
PSEUDONYME_BLOCK_D = ["TN09", "TN10"]

# Welche Karte in welchem Block die Anmeldung ist, und wer sie bekommt.
ANMELDEKARTEN = [("B1", PSEUDONYME_BLOCK_B), ("C1", PSEUDONYME_BLOCK_C),
                 ("D1", PSEUDONYME_BLOCK_D)]


def anmeldeadresse(pseudonym):
    """Die Adresse, mit der sich das Sitzungskonto anmeldet."""
    return "tn%s@test.invalid" % pseudonym[-2:]


# --- Ersetzungen -------------------------------------------------------------
# Im Szenariotext, also auf der Karte, die die Testperson in die Hand bekommt.
# Titel stehen in einfachen Anfuehrungszeichen, weil das Szenario selbst schon
# in doppelten steht.
KARTE = {
    "A2": [("[Seed-Thema einsetzen]", THEMA_A2)],
    "A3": [("[X]", FAKULTAET_A3), ("[Y]", SEMESTER_A3)],
    "B2": [("[Titel]", "‚%s‘" % TITEL_B2)],
    "C3": [("[Titel]", "‚%s‘" % TITEL_C3)],
    "C4": [("[Titel]", "‚%s‘" % TITEL_C4)],
    "C6": [("[Titel]", "‚%s‘" % TITEL_C6)],
    "D3": [("[Name aus dem Seed]", NAME_D3)],
    "D4": [("[Kategorie 1]", "‚%s‘" % KATEGORIE_D4_A),
           ("[Kategorie 2]", "‚%s‘" % KATEGORIE_D4_B)],
}

# Im Startzustand, also in Abschnitt 9 des Moderationsblatts. A5 nennt dort
# bisher nur "ein inhaltsreiches Projekt"; welches gemeint ist, sagt der Seed.
START = {
    "A5": [("Ein inhaltsreiches Projekt aus A2 oder A4",
            "Das Projekt „%s“ (aus A2 oder A4)" % PROJEKT_A5)],
    "C3": [("[Titel]", "„%s“" % TITEL_C3)],
    "C4": [("[Titel]", "„%s“" % TITEL_C4)],
    "C5": [("[Titel]", "„%s“" % TITEL_C4)],
    "C6": [("[Titel]", "„%s“" % TITEL_C6)],
    "D4": [("[Kategorie 1]", "„%s“" % KATEGORIE_D4_A),
           ("[Kategorie 2]", "„%s“" % KATEGORIE_D4_B)],
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
