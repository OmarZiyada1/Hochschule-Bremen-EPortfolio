#!/usr/bin/env bash
# ===================================================================
# Zaehlt den Testbestand gegen die Seed-Pruefliste.
#
#     bash test-seeder-pruefen.sh
#     bash test-seeder-pruefen.sh TN01
#
# DAS PSEUDONYM IST FREIWILLIG und aendert genau einen Punkt: die Zahl
# der belegten Top-10-Plaetze. Sie haengt am Rollenblock der anstehenden
# Sitzung und wird von test-sitzung.sh gesetzt, zehn in den Bloecken A
# und B, sechs in Block C, keiner in Block D. Mit Pseudonym prueft das
# Skript den genauen Wert, ohne Pseudonym nur, dass einer dieser drei
# Staende steht. Der Menuepunkt s7 ruft ohne Pseudonym auf.
#
# Das Blatt "Vor der Sitzung" verlangt in Abschnitt 5, den Seed VOR
# JEDEM TERMIN zu zaehlen und nicht nur einmal am Anfang der Woche.
# Begruendung dort: "Ist der Bestand zu homogen, messen A3 und A4
# nichts." Dieses Skript nimmt das Zaehlen ab; abgehakt wird trotzdem
# von Hand, im Ruecksetzprotokoll.
#
# Das Skript AENDERT NICHTS. Es liest und meldet. Der Rueckgabewert ist
# 0, wenn jeder Punkt erfuellt ist, sonst 1.
#
# Drei Punkte der Liste kann es nicht pruefen, weil sie nicht in der
# Datenbank stehen. Sie werden am Ende als Erinnerung ausgegeben:
# der angehobene Grenzwert fuer Login-Fehlversuche, die Bilddatei fuer
# Aufgabe B3 auf dem Schreibtisch des Testrechners und der eingefrorene
# Commit der Testinstanz.
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   DB_CONTAINER=... bash test-seeder-pruefen.sh
# ===================================================================
set -uo pipefail

DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
DB_USER="${POSTGRES_USER:-eportfolio}"
DB_NAME="${POSTGRES_DB:-eportfolio}"

sql() { docker exec -i -e PGCLIENTENCODING=UTF8 "$DB" \
	psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" "$@"; }

zahl() { sql -tAc "$1" | tr -d '[:space:]'; }

FEHLER=0

# Optionales Pseudonym. Leer heisst: es steht keine bestimmte Sitzung an,
# und die Top 10 wird nur grob geprueft. Die Zuordnung ist dieselbe wie
# in test-sitzung.sh; wer sie dort aendert, aendert sie auch hier.
TN="${1:-}"
TOP10_SOLL=""
if [ -n "$TN" ]; then
	TN=$(echo "$TN" | tr '[:lower:]' '[:upper:]')
	case "$TN" in
		TN00|TN01|TN02|TN03|TN04|TN05) TOP10_SOLL=10 ;;
		TN06|TN07)                     TOP10_SOLL=6  ;;
		TN08|TN11)                     TOP10_SOLL=10 ;;
		TN09|TN10)                     TOP10_SOLL=0  ;;
		*)
			echo "ABBRUCH: Unbekanntes Pseudonym: $TN. Erwartet wird TN00 bis TN11." >&2
			exit 1
			;;
	esac
fi

# $1 Beschriftung, $2 Istwert, $3 Vergleich als Testausdruck, $4 Sollwert-Text
pruefe() {
	if [ "$3" = "ok" ]; then
		printf '  [x] %-58s %s\n' "$1" "$2"
	else
		printf '  [ ] %-58s %s  (erwartet: %s)\n' "$1" "$2" "$4"
		FEHLER=$((FEHLER + 1))
	fi
}

im_bereich() { [ "$1" -ge "$2" ] && [ "$1" -le "$3" ] && echo ok || echo nein; }
mindestens() { [ "$1" -ge "$2" ] && echo ok || echo nein; }
genau()      { [ "$1" -eq "$2" ] && echo ok || echo nein; }

if [ "$(docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null)" != "true" ]; then
	echo "ABBRUCH: Container $DB laeuft nicht." >&2
	exit 1
fi

echo "== Seed-Pruefliste =="
echo

# --- Block A: der gemeinsame Bestand -------------------------------
# Gezaehlt wird der ganze sichtbare Bestand und nicht nur der aus
# test-seeder.sh: die Testperson sieht alles, was veroeffentlicht ist.
# Steht daneben noch der Demobestand, liegt die Summe ueber dem Korridor,
# und A3 und A4 messen etwas anderes als gedacht.
veroeffentlicht=$(zahl "select count(*) from project where status = 'PUBLISHED';")
eigene=$(zahl "select count(*) from project
               where status = 'PUBLISHED' and id::text like '7e570011-%';")
fremd=$((veroeffentlicht - eigene))
pruefe "veroeffentlichte Projekte insgesamt" "$veroeffentlicht" \
	"$(im_bereich "$veroeffentlicht" 40 60)" "40 bis 60"
if [ "$fremd" -gt 0 ]; then
	printf '      davon %d aus dem Testbestand, %d aus anderer Quelle.\n' "$eigene" "$fremd"
	printf '      Die Testumgebung soll nur den Testbestand fuehren.\n'
	printf '      Fremde Projekte entfernt: bash demo-daten-raeumen.sh\n'
fi

fakultaeten=$(zahl "select count(distinct faculty_id) from project
                    where status = 'PUBLISHED' and faculty_id is not null;")
pruefe "vertretene Fakultaeten" "$fakultaeten" "$(mindestens "$fakultaeten" 3)" "mindestens 3"

kategorien=$(zahl "select count(distinct category_id) from project
                   where status = 'PUBLISHED' and category_id is not null;")
pruefe "belegte Kategorien" "$kategorien" "$(mindestens "$kategorien" 6)" "mindestens 6"

autoren=$(zahl "select count(distinct author_id) from project where status = 'PUBLISHED';")
pruefe "Autorinnen und Autoren" "$autoren" "$(mindestens "$autoren" 8)" "mindestens 8"

mehrfach=$(zahl "select count(*) from (
                   select author_id from project where status = 'PUBLISHED'
                   group by author_id having count(*) > 1) as t;")
pruefe "davon mit mehreren Projekten (Aufgabe A4)" "$mehrfach" \
	"$(mindestens "$mehrfach" 1)" "mindestens 1"

# A3 verlangt eine Kombination aus Abschluss, Fakultaet und Semester,
# die zusammen Treffer liefert. Eine Kombination mit mindestens drei
# Treffern genuegt; mit weniger waere die Trefferliste kein Beleg dafuer,
# dass die Einschraenkung wirkt.
a3=$(zahl "select count(*) from (
             select faculty_id, semester_id from project
             where status = 'PUBLISHED' and project_type = 'THESIS'
               and degree = 'BACHELOR' and faculty_id is not null
               and semester_id is not null
             group by faculty_id, semester_id having count(*) >= 3) as t;")
pruefe "Kombinationen Bachelorarbeit + Fakultaet + Semester (A3)" "$a3" \
	"$(mindestens "$a3" 1)" "mindestens 1 mit 3 Treffern"

a2=$(zahl "select count(*) from project
           where id = '7e570011-0000-4000-8000-000000000007'::uuid
             and status = 'PUBLISHED';")
pruefe "Zielprojekt fuer A2 vorhanden und veroeffentlicht" "$a2" "$(genau "$a2" 1)" "1"

a5=$(zahl "select count(*) from block
           where project_id = '7e570011-0000-4000-8000-000000000001'::uuid;")
pruefe "Bloecke im inhaltsreichen Projekt fuer A5" "$a5" \
	"$(mindestens "$a5" 12)" "mindestens 12"

echo

# --- Block C -------------------------------------------------------
c_offen=$(zahl "select count(*) from project
                where id::text like '7e570011-0000-4000-8000-00000000005%'
                  and status = 'SUBMITTED';")
pruefe "Projekte im Arbeitsvorrat, Status Eingereicht (C1)" "$c_offen" \
	"$(genau "$c_offen" 4)" "4"

c_veroeffentlicht=$(zahl "select count(*) from project
                          where status = 'PUBLISHED' and id::text like '7e570011-%';")
pruefe "veroeffentlichtes Projekt fuer die Nominierung (C5)" "$c_veroeffentlicht" \
	"$(mindestens "$c_veroeffentlicht" 1)" "mindestens 1"

echo

# --- Block D -------------------------------------------------------
d3_a=$(zahl "select count(*) from project
             where category_id = '7e570015-0000-4000-8000-000000000001'::uuid;")
d3_b=$(zahl "select count(*) from project
             where category_id = '7e570015-0000-4000-8000-000000000002'::uuid;")
pruefe "Projekte an der ersten gleichbedeutenden Kategorie (D3)" "$d3_a" \
	"$(mindestens "$d3_a" 3)" "mindestens 3"
pruefe "Projekte an der zweiten gleichbedeutenden Kategorie (D3)" "$d3_b" \
	"$(mindestens "$d3_b" 3)" "mindestens 3"

d4=$(zahl "select count(*) from project
           where id::text like '7e570011-0000-4000-8000-00000000006%'
             and status = 'APPROVED';")
pruefe "Projekte im Status Genehmigt (D4)" "$d4" "$(genau "$d4" 5)" "5"

d5_nom=$(zahl "select count(*) from top10_nomination where status = 'PENDING';")
pruefe "offene Nominierungen (D5)" "$d5_nom" "$(mindestens "$d5_nom" 12)" "mindestens 12"

# Die belegten Plaetze gehoeren nicht zu Block D allein: test-sitzung.sh
# setzt sie je Rollenblock, weil der Beobachtungsfokus zu A1 nach der
# Top-10-Flaeche fragt und C5 an einer teilweise gefuellten Liste zeigt,
# dass eine Nominierung noch keine Aufnahme ist. Nur Block D braucht die
# leere Liste, die D5 als Startzustand verlangt.
d5_top=$(zahl "select count(*) from top10_entry;")
if [ -n "$TOP10_SOLL" ]; then
	pruefe "belegte Top-10-Plaetze (Sitzung $TN)" "$d5_top" \
		"$(genau "$d5_top" "$TOP10_SOLL")" "$TOP10_SOLL"
	if [ "$d5_top" != "$TOP10_SOLL" ]; then
		printf '      Herstellen mit: bash test-sitzung.sh %s (Menuepunkt s5)\n' "$TN"
	fi
else
	if [ "$d5_top" = "0" ] || [ "$d5_top" = "6" ] || [ "$d5_top" = "10" ]; then
		top10_zulaessig=ok
	else
		top10_zulaessig=nein
	fi
	pruefe "belegte Top-10-Plaetze (ohne Pseudonym nur grob)" "$d5_top" \
		"$top10_zulaessig" "0, 6 oder 10"
	if [ "$d5_top" != "0" ]; then
		printf '      Genau geprueft wird mit dem Pseudonym der anstehenden\n'
		printf '      Sitzung: bash test-seeder-pruefen.sh TN01\n'
	fi
fi

d6_zeilen=$(zahl "select count(*) from top10_audit_entry;")
d6_personen=$(zahl "select count(distinct admin_id) from top10_audit_entry;")
pruefe "Zeilen im Aenderungsprotokoll (D6)" "$d6_zeilen" \
	"$(mindestens "$d6_zeilen" 3)" "mindestens 3"
pruefe "davon verschiedene Personen (D6)" "$d6_personen" \
	"$(mindestens "$d6_personen" 2)" "mindestens 2"

d2=$(zahl "select count(*) from app_user
           where id = '7e570010-0000-4000-8000-000000000040'::uuid
             and role = 'STUDENT' and status = 'ACTIVE';")
pruefe "Zusatzkonto fuer D2 vorhanden, Rolle STUDENT" "$d2" "$(genau "$d2" 1)" "1"

echo
echo "== Nicht aus der Datenbank pruefbar =="
echo "  [ ] Grenzwert fuer Login-Fehlversuche angehoben."
echo "      Sonst sperren fuenf Fehlversuche 15 Minuten, gezaehlt je E-Mail"
echo "      UND je Client-IP. In Aufgabe B1 sind zwei Fehlversuche erlaubt;"
echo "      ueber einen Testtag summieren sich die der IP. Anheben ueber die"
echo "      Umgebung des Backends, ohne die application.yml zu aendern:"
echo "        APP_SECURITY_LOGINATTEMPTS_MAXFAILEDATTEMPTS=50"
echo "      Danach das Backend neu starten; der Zaehler liegt im"
echo "      Arbeitsspeicher (LoginAttemptService)."
echo "  [ ] Bilddatei fuer Aufgabe B3 sichtbar auf dem Schreibtisch."
echo "  [ ] Testinstanz laeuft auf dem eingefrorenen Commit, kein Deploy"
echo "      seit der Einfrierung. Commit-Kurzhash notieren."

echo
if [ "$FEHLER" -eq 0 ]; then
	echo "Alles erfuellt, was sich zaehlen laesst."
	exit 0
fi
echo "$FEHLER Punkte sind nicht erfuellt."
echo "Bestand neu herstellen: bash test-seeder.sh, danach bash test-sitzung.sh TN.."
exit 1
