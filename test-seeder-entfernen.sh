#!/usr/bin/env bash
# ===================================================================
# Entfernt den gemeinsamen Testbestand der Usability-Testwoche.
# Gegenstueck zu test-seeder.sh.
#
#     bash test-seeder-entfernen.sh
#
# Bequemer ueber das Menue: .\eportfolio.ps1, Punkt s4.
#
# WAS VERSCHWINDET
#   - die Konten auf @test.invalid samt Portfolios (Praefix 7e570010)
#   - alle Sitzungskonten TN00 bis TN11 (Praefix 7e5700f0), samt allem,
#     was unter ihnen entstanden ist
#   - die Testprojekte (Praefix 7e570011) samt Bloecken, Dateizeilen,
#     Mitgliedern, Redaktionszuweisung, Schlagwortbezuegen,
#     Statusverlauf, Kommentaren und Reaktionen
#   - die Dateizeilen (Praefix 7e570012) und ihre Bytes im Objektspeicher
#   - die zwei gleichbedeutenden Kategorien aus Aufgabe D3
#     (Praefix 7e570015)
#   - die Nominierungen (Praefix 7e570017) und die Zeilen des
#     Top-10-Aenderungsprotokolls (Praefix 7e57001a)
#
# WAS BLEIBT
#   - die Stammdaten aus stammdaten-seeder.sh
#   - die Kategorien und Semester aus dem DevMasterDataSeeder
#   - die Demodaten (Praefix d0d000) und die dev-Testnutzer
#   - die Top-10-Plaetze, sofern welche gesetzt sind. Sie tragen keine
#     eigene ID aus diesem Bestand; entfernt werden nur die Plaetze, die
#     auf ein Testprojekt zeigen, sonst risse der Fremdschluessel.
#
# WAS NICHT ZURUECKKOMMT. test-seeder.sh leert beim Anlegen die ganze
# Tabelle top10_entry, weil Aufgabe D5 einen leeren Stand verlangt. Waren
# dort vorher Plaetze aus den Demodaten gesetzt, sind sie seitdem weg,
# und dieses Skript bringt sie nicht zurueck. Wer sie braucht, laesst
# demo-daten-komplett.sh noch einmal laufen; es setzt sie neu.
#
# DIESER LAUF IST NICHT UMKEHRBAR. Ein erneuter Lauf von test-seeder.sh
# stellt den Bestand wieder her, aber nicht, was Testpersonen darin
# angelegt oder geaendert haben.
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   DB_CONTAINER=... BACKEND_CONTAINER=... bash test-seeder-entfernen.sh
# ===================================================================
set -euo pipefail

DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
BACKEND="${BACKEND_CONTAINER:-eportfolio-dev-backend-1}"
DB_USER="${POSTGRES_USER:-eportfolio}"
DB_NAME="${POSTGRES_DB:-eportfolio}"
ROOT=/app/var/storage

# Zur Begruendung von "sh -lc" siehe den gleichnamigen Absatz in
# demo-daten-komplett.sh: MSYS schreibt unter Git Bash jedes Argument
# um, das wie ein Unix-Pfad aussieht, sobald es an ein Windows-Programm
# geht. In einer Zeichenkette fasst es den Pfad nicht an.
im_container() { docker exec "$BACKEND" sh -lc "$1"; }

sql() { docker exec -i -e PGCLIENTENCODING=UTF8 "$DB" \
	psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" "$@"; }

abbruch() { echo; echo "ABBRUCH: $1" >&2; exit 1; }

echo "== Vorbedingungen =="
command -v docker >/dev/null 2>&1 || abbruch "docker nicht gefunden."
if [ "$(docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null)" != "true" ]; then
	abbruch "Container $DB laeuft nicht."
fi
docker exec "$DB" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
	|| abbruch "Die Datenbank $DB_NAME antwortet nicht."
echo "  Container $DB laeuft, Datenbank antwortet"
echo

echo "== Stand vorher =="
sql -c "
select 'Testkonten' as bestand, count(*) from app_user
       where id::text like '7e570010-%'
union all select 'Sitzungskonten', count(*) from app_user
       where id::text like '7e5700f0-%'
union all select 'Testprojekte',   count(*) from project    where id::text like '7e570011-%'
union all select 'Bloecke',        count(*) from block b
       where b.project_id in (select id from project where id::text like '7e570011-%')
union all select 'Dateizeilen',    count(*) from stored_file where id::text like '7e570012-%'
union all select 'Nominierungen',  count(*) from top10_nomination where id::text like '7e570017-%'
union all select 'Pruefspurzeilen', count(*) from top10_audit_entry where id::text like '7e57001a-%';"
echo

echo "== Entfernen =="
# Die Reihenfolge folgt den Fremdschluesseln, wie in
# demo-daten-raeumen.sh. Vieles haengt per Kaskade am Projekt, aber
# nicht alles: comment.author_id, project.author_id,
# project_status_history.changed_by, stored_file.uploaded_by,
# top10_audit_entry.admin_id und beide Nutzerspalten von
# top10_nomination kaskadieren nicht. Wer die Konten zuerst loeschte,
# liefe genau dort in eine Fremdschluesselverletzung.
sql <<'ENDE_SQL_TESTBESTAND_WEG'
begin;

-- Alles, was an Testkonten oder Testprojekten haengt.
delete from top10_audit_entry
where id::text like '7e57001a-%'
   or admin_id in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from top10_nomination
where id::text like '7e570017-%'
   or nominated_by in (select id from app_user where id::text like '7e5700%')
   or decided_by in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

-- Top-10-Plaetze nur, soweit sie auf ein Testprojekt zeigen. Plaetze
-- auf Demoprojekten gehoeren nicht zu diesem Bestand.
delete from top10_entry
where project_id in (select id from project where id::text like '7e570011-%');

delete from reaction
where user_id in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from comment
where author_id in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from project_status_history
where changed_by in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from project_editor
where user_id in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from project_member
where user_id in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from project_tag
where project_id in (select id from project where id::text like '7e570011-%');

delete from block
where project_id in (select id from project where id::text like '7e570011-%');

delete from stored_file
where id::text like '7e570012-%'
   or uploaded_by in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');

delete from project
where id::text like '7e570011-%'
   or author_id in (select id from app_user where id::text like '7e5700%');

delete from verification_code
where user_id in (select id from app_user where id::text like '7e5700%');

delete from portfolio
where user_id in (select id from app_user where id::text like '7e5700%');

delete from app_user where id::text like '7e5700%';

-- Die zwei gleichbedeutenden Kategorien aus Aufgabe D3. Projekte, die
-- noch daran haengen, verlieren die Kategorie; das sind nach den
-- Loeschungen oben nur noch Projekte fremder Herkunft, etwa weil eine
-- Testperson sie umgehaengt hat.
update project set category_id = null
where category_id in (select id from category where id::text like '7e570015-%');
delete from category where id::text like '7e570015-%';

commit;
ENDE_SQL_TESTBESTAND_WEG
echo "  Datenbank geraeumt"

# Die Bytes im Objektspeicher haengen an keiner Fremdschluesselkette und
# blieben sonst als verwaiste Dateien liegen. Geloescht werden nur die
# Ordner, zu denen es kein Projekt mehr gibt; die Ordner der Demodaten
# bleiben.
if [ "$(docker inspect -f '{{.State.Running}}' "$BACKEND" 2>/dev/null)" = "true" ]; then
	bekannt=$(sql -tAc "select id::text from project;" | tr -d '\r')
	entfernt=0
	for ordner in $(im_container "find '$ROOT/projects' -mindepth 1 -maxdepth 1 -type d 2>/dev/null" || true); do
		pid=$(basename "$ordner" | tr -d '\r')
		if ! echo "$bekannt" | grep -qx "$pid"; then
			im_container "rm -rf '$ROOT/projects/$pid'"
			entfernt=$((entfernt + 1))
		fi
	done

	# Profilbilder liegen nicht unter projects/, sondern flach unter
	# avatars/ (§3.15). Ohne diesen zweiten Durchgang blieben die Bytes
	# der geloeschten Testkonten liegen, auf die keine Zeile mehr zeigt.
	dateien=$(sql -tAc "select id::text from stored_file where project_id is null;" | tr -d '\r')
	for datei in $(im_container "find '$ROOT/avatars' -mindepth 1 -maxdepth 1 -type f 2>/dev/null" || true); do
		fid=$(basename "$datei" | tr -d '\r')
		if ! echo "$dateien" | grep -qx "$fid"; then
			im_container "rm -f '$ROOT/avatars/$fid'"
			entfernt=$((entfernt + 1))
		fi
	done
	echo "  Objektspeicher: $entfernt verwaiste Ordner und Dateien entfernt"
else
	echo "  Backend-Container laeuft nicht, Objektspeicher nicht geraeumt."
	echo "  Das holt ein spaeterer Lauf nach."
fi
echo

echo "== Stand nachher =="
sql -c "
select 'Testkonten' as bestand, count(*) from app_user   where id::text like '7e5700%'
union all select 'Testprojekte', count(*) from project   where id::text like '7e570011-%'
union all select 'Projekte gesamt', count(*) from project
union all select 'Konten gesamt',   count(*) from app_user
union all select 'Fakultaeten',     count(*) from faculty;"

echo
echo "Fertig."
