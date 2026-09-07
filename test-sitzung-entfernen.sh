#!/usr/bin/env bash
# ===================================================================
# Entfernt EINE Sitzung der Usability-Testwoche. Gegenstueck zu
# test-sitzung.sh.
#
#     bash test-sitzung-entfernen.sh TN03
#
# Bequemer ueber das Menue: .\eportfolio.ps1, Punkt s6.
#
# WAS VERSCHWINDET
#   - das Testkonto tn<NN>@test.invalid samt Portfolio
#   - alles, was unter diesem Konto entstanden ist: Projekte samt
#     Bloecken und Dateizeilen, Kommentare, Reaktionen, Nominierungen,
#     Statusverlauf, Redaktionszuweisungen, Mitgliedschaften und
#     Eintraege im Top-10-Aenderungsprotokoll
#
# WAS BLEIBT
#   - der gemeinsame Testbestand aus test-seeder.sh. Er gehoert allen
#     Sitzungen; zum Entfernen dient test-seeder-entfernen.sh.
#   - die Stammdaten, die Demodaten und die dev-Testnutzer.
#
# WOFUER MAN DAS BRAUCHT. Zwischen zwei Sitzungen genuegt
# test-sitzung.sh fuer die naechste Person: es raeumt die vorige
# Sitzung desselben Pseudonyms selbst weg. Dieses Skript ist fuer den
# Fall danach, wenn nach der Testwoche die personenbezogenen Spuren
# verschwinden sollen, ohne den Bestand anzufassen, oder wenn eine
# Sitzung abgesagt wurde und ihr Konto nicht stehen bleiben soll.
#
# DIESER LAUF IST NICHT UMKEHRBAR.
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   DB_CONTAINER=... bash test-sitzung-entfernen.sh TN03
# ===================================================================
set -euo pipefail

DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
DB_USER="${POSTGRES_USER:-eportfolio}"
DB_NAME="${POSTGRES_DB:-eportfolio}"

sql() { docker exec -i -e PGCLIENTENCODING=UTF8 "$DB" \
	psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" "$@"; }

abbruch() { echo; echo "ABBRUCH: $1" >&2; exit 1; }

TN="${1:-}"
[ -n "$TN" ] || abbruch "Kein Pseudonym angegeben. Aufruf: bash test-sitzung-entfernen.sh TN03"
TN=$(echo "$TN" | tr '[:lower:]' '[:upper:]')
case "$TN" in
	TN0[0-9]|TN1[01]) : ;;
	*) abbruch "Unbekanntes Pseudonym: $TN. Erwartet wird TN00 bis TN11." ;;
esac

NUMMER="${TN#TN}"
KONTO_ID="7e5700f0-0000-4000-8000-0000000000${NUMMER}"

echo "== Sitzung $TN entfernen =="
command -v docker >/dev/null 2>&1 || abbruch "docker nicht gefunden."
if [ "$(docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null)" != "true" ]; then
	abbruch "Container $DB laeuft nicht."
fi

vorhanden=$(sql -tAc "select count(*) from app_user where id = '${KONTO_ID}'::uuid;" | tr -d '[:space:]')
if [ "$vorhanden" = "0" ]; then
	echo "  Kein Konto zu $TN vorhanden. Nichts zu tun."
	echo
	echo "Fertig."
	exit 0
fi

echo "== Stand vorher =="
sql -c "
select 'Projekte des Kontos' as bestand, count(*) from project
       where author_id = '${KONTO_ID}'::uuid
union all select 'Kommentare', count(*) from comment
       where author_id = '${KONTO_ID}'::uuid
union all select 'Nominierungen', count(*) from top10_nomination
       where nominated_by = '${KONTO_ID}'::uuid or decided_by = '${KONTO_ID}'::uuid
union all select 'Pruefspurzeilen', count(*) from top10_audit_entry
       where admin_id = '${KONTO_ID}'::uuid;"
echo

echo "== Entfernen =="
# Die Reihenfolge folgt den Fremdschluesseln, wie in
# demo-daten-raeumen.sh: vieles haengt per Kaskade am Projekt, aber
# comment.author_id, project_status_history.changed_by,
# stored_file.uploaded_by, top10_audit_entry.admin_id und beide
# Nutzerspalten von top10_nomination kaskadieren nicht.
sql <<ENDE_SQL_SITZUNG_ENTFERNEN
begin;

delete from top10_audit_entry where admin_id = '${KONTO_ID}'::uuid;
delete from top10_nomination  where nominated_by = '${KONTO_ID}'::uuid
                                 or decided_by = '${KONTO_ID}'::uuid;
delete from reaction where user_id = '${KONTO_ID}'::uuid;
delete from comment  where author_id = '${KONTO_ID}'::uuid;
delete from project_status_history where changed_by = '${KONTO_ID}'::uuid;
delete from project_editor where user_id = '${KONTO_ID}'::uuid;
delete from project_member where user_id = '${KONTO_ID}'::uuid;
delete from stored_file where uploaded_by = '${KONTO_ID}'::uuid;
delete from project where author_id = '${KONTO_ID}'::uuid;
delete from verification_code where user_id = '${KONTO_ID}'::uuid;
delete from portfolio where user_id = '${KONTO_ID}'::uuid;
delete from app_user where id = '${KONTO_ID}'::uuid;

commit;
ENDE_SQL_SITZUNG_ENTFERNEN
echo "  entfernt"
echo

# Die Bytes im Objektspeicher haengen an keiner Fremdschluesselkette.
# Was die Testperson in Aufgabe B3 hochgeladen hat, laege sonst als
# verwaiste Datei weiter im Volume. Geloescht wird nur, was zu den
# geloeschten Projekten gehoerte; die Ordner der uebrigen bleiben.
BACKEND="${BACKEND_CONTAINER:-eportfolio-dev-backend-1}"
ROOT=/app/var/storage
if [ "$(docker inspect -f '{{.State.Running}}' "$BACKEND" 2>/dev/null)" = "true" ]; then
	# Zur Begruendung von "sh -lc" siehe demo-daten-komplett.sh: MSYS
	# schreibt unter Git Bash jeden Unix-Pfad um, der an ein
	# Windows-Programm geht. In einer Zeichenkette fasst es ihn nicht an.
	# Die noch vorhandenen Projekt-IDs einmal holen und in der Shell
	# vergleichen, statt je Ordner eine Abfrage zu stellen. Ein
	# Ordnername, der keine UUID ist, laeuft so auch nicht in einen
	# psql-Fehler, sondern gilt schlicht als unbekannt.
	bekannt=$(sql -tAc "select id::text from project;" | tr -d '\r')
	verwaist=$(docker exec "$BACKEND" sh -lc \
		"find '$ROOT/projects' -mindepth 1 -maxdepth 1 -type d 2>/dev/null" || true)
	entfernt=0
	for ordner in $verwaist; do
		pid=$(basename "$ordner" | tr -d '\r')
		if ! echo "$bekannt" | grep -qx "$pid"; then
			docker exec "$BACKEND" sh -lc "rm -rf '$ROOT/projects/$pid'"
			entfernt=$((entfernt + 1))
		fi
	done
	echo "  Objektspeicher: $entfernt verwaiste Projektordner entfernt"
else
	echo "  Backend-Container laeuft nicht, Objektspeicher nicht geraeumt."
	echo "  Das holt ein spaeterer Lauf nach."
fi

echo
echo "Fertig."
