#!/usr/bin/env bash
# ===================================================================
# Entfernt die Stammdaten-Hierarchie: Fakultaeten, Studiengaenge und
# Module. Gegenstueck zu stammdaten-seeder.sh.
#
#     bash stammdaten-seeder-entfernen.sh
#
# Bequemer ueber das Menue: .\eportfolio.ps1, Punkt s2. Das Menue setzt
# DB_CONTAINER auf die Datenbank der gewaehlten Betriebsart und fragt
# vorher nach; ohne die Variable trifft der Lauf die von DEV.
#
# WAS VERSCHWINDET
#   - alle Zeilen aus module
#   - alle Zeilen aus study_program
#   - alle Zeilen aus faculty
# Und zwar ALLE, nicht nur die aus stammdaten-seeder.sh. Das ist Absicht:
# der Sinn dieses Skripts ist, vor einem frischen Lauf reinen Tisch zu
# machen, und dazu gehoeren gerade die Zeilen aus anderer Quelle, etwa
# die erfundenen Studiengaenge, die der DevMasterDataSeeder bis zur
# Umstellung anlegte, oder was ueber die Administrationsseite von Hand
# entstanden ist.
#
# WAS BLEIBT
#   - Kategorien und Semester. Sie sind eigene Stammdaten, haengen nicht
#     an der Hierarchie und kommen weiterhin aus dem DevMasterDataSeeder.
#   - Projekte, Konten, Bloecke, Dateien, Kommentare, Top 10. Sie werden
#     nicht angefasst.
#
# WAS SICH AN PROJEKTEN AENDERT
# Die drei Fremdschluessel project.faculty_id, project.study_program_id
# und project.module_id stehen auf "no action": ein delete scheiterte
# daran. Dieses Skript loest sie deshalb vorher, setzt sie also auf
# null, und meldet, wie viele Projekte davon betroffen sind. Diese
# Angaben kommen mit einem spaeteren Lauf von stammdaten-seeder.sh NICHT
# zurueck; der Seeder legt die Hierarchie neu an, weiss aber nicht, wo
# welches Projekt vorher hing. Wer die Zuordnung braucht, traegt sie
# danach von Hand nach oder laesst den Testbestand neu erzeugen.
#
# Ein Projekt ohne Fakultaet, Studiengang und Modul bleibt lesbar und
# sichtbar; die drei Angaben sind erst beim Einreichen Pflicht (Contract
# §4.1, PROJECT_INCOMPLETE). Ein bereits veroeffentlichtes Projekt
# behaelt seinen Status.
#
# DIESER LAUF IST NICHT UMKEHRBAR.
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   DB_CONTAINER=... bash stammdaten-seeder-entfernen.sh
# ===================================================================
set -euo pipefail

DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
DB_USER="${POSTGRES_USER:-eportfolio}"
DB_NAME="${POSTGRES_DB:-eportfolio}"

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
select 'Fakultaeten' as bestand, count(*) from faculty
union all select 'Studiengaenge', count(*) from study_program
union all select 'Module',        count(*) from module
union all select 'Projekte mit Fakultaet',   count(*) from project where faculty_id is not null
union all select 'Projekte mit Studiengang', count(*) from project where study_program_id is not null
union all select 'Projekte mit Modul',       count(*) from project where module_id is not null;"
echo

echo "== Entfernen =="
sql <<'ENDE_SQL_STAMMDATEN_WEG'
begin;

-- Erst loesen, dann loeschen. Die Reihenfolge folgt den
-- Fremdschluesseln: Projekt zeigt auf Modul, Modul auf Studiengang,
-- Studiengang auf Fakultaet.
update project set module_id = null        where module_id is not null;
update project set study_program_id = null where study_program_id is not null;
update project set faculty_id = null       where faculty_id is not null;

delete from module;
delete from study_program;
delete from faculty;

commit;
ENDE_SQL_STAMMDATEN_WEG
echo "  Hierarchie entfernt, Projektbezuege geloest"
echo

echo "== Stand nachher =="
sql -c "
select 'Fakultaeten' as bestand, count(*) from faculty
union all select 'Studiengaenge', count(*) from study_program
union all select 'Module',        count(*) from module
union all select 'Kategorien',    count(*) from category
union all select 'Semester',      count(*) from semester
union all select 'Projekte',      count(*) from project;"

echo
echo "Fertig. Jetzt: bash stammdaten-seeder.sh"
