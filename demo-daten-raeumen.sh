#!/usr/bin/env bash
# ===================================================================
# Raeumt den Altbestand aus der Entwicklungsdatenbank, bevor
# demo-daten-komplett.sh einen frischen Bestand schreibt.
#
#     bash demo-daten-raeumen.sh
#
# Was verschwindet:
#   - saemtliche Projekte samt Bloecken, Dateizeilen, Mitgliedern,
#     Redaktionszuweisung, Schlagwortbezuegen, Kommentaren, Reaktionen,
#     Statusverlauf, Nominierungen, Top-10 und Pruefspur
#   - alle Schlagworte (sie stammen ausnahmslos aus dem alten
#     Testbestand: V202608191630__tag.sql uebernimmt nur vorhandene
#     project_tag-Texte, es gibt keine Stammdatenliste)
#   - alle Konten ausser den drei Seeder-Konten, samt ihren Portfolios
#     und Bestaetigungscodes
#   - alle Bytes im Objektspeicher unter /app/var/storage
#
# Was bleibt:
#   - dev-studi@dev.invalid, dev-redakteur@dev.invalid und
#     dev-admin@dev.invalid aus dem DevTestnutzerSeeder. Sie muessen
#     bleiben: demo-daten-komplett.sh uebernimmt den Passwort-Hash von
#     dev-studi und braucht die Rollen EDITOR und ADMIN fuer
#     Redaktionszuweisung, Nominierungen und Pruefspur.
#   - alle Stammdaten aus den Migrationen: Fakultaeten, Studiengaenge,
#     Module, Kategorien, Semester
#   - site_content und support_request. Die eine vorhandene
#     Supportanfrage ist anonym eingereicht und haengt an keinem Konto.
#
# DIESER LAUF IST NICHT UMKEHRBAR. Es gibt kein Backup und keinen
# Erzeuger fuer den alten Bestand.
# ===================================================================
set -euo pipefail

BACKEND="${BACKEND_CONTAINER:-eportfolio-dev-backend-1}"
DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
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
for c in "$DB" "$BACKEND"; do
	if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" != "true" ]; then
		abbruch "Container $c laeuft nicht."
	fi
done
docker exec "$DB" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
	|| abbruch "Die Datenbank $DB_NAME antwortet nicht."

# Ohne die drei Seeder-Konten waere nach dem Raeumen kein Konto mehr da,
# aus dem demo-daten-komplett.sh den Passwort-Hash ziehen koennte. Dann
# lieber gar nicht erst loeschen.
fehlend=$(sql -tAc "
select string_agg(v.email, ', ')
from (values ('dev-studi@dev.invalid'), ('dev-redakteur@dev.invalid'),
             ('dev-admin@dev.invalid')) as v(email)
where not exists (select 1 from app_user u where u.email = v.email);" | tr -d '[:space:]')
[ -z "$fehlend" ] || abbruch "Seeder-Konten fehlen: $fehlend.
         Backend im Profil dev starten, damit der DevTestnutzerSeeder laeuft."
echo "  Container laufen, Seeder-Konten vorhanden"
echo

echo "== Stand vor dem Raeumen =="
sql -c "
select 'Projekte' as bestand, count(*) from project
union all select 'Konten',        count(*) from app_user
union all select 'Bloecke',       count(*) from block
union all select 'Dateizeilen',   count(*) from stored_file
union all select 'Schlagworte',   count(*) from tag
union all select 'Nominierungen', count(*) from top10_nomination
union all select 'Top-10',        count(*) from top10_entry;"
echo

echo "== Raeumen =="
# Die Reihenfolge folgt den Fremdschluesseln. Vieles haengt zwar per
# "on delete cascade" am Projekt, aber nicht alles: comment.author_id,
# project.author_id, project_status_history.changed_by,
# stored_file.uploaded_by, top10_audit_entry.admin_id und beide
# Nutzerspalten von top10_nomination kaskadieren nicht. Wer die Konten
# zuerst loeschte, liefe genau dort in eine Fremdschluesselverletzung.
sql <<'ENDE_SQL_RAEUMEN'
begin;

delete from top10_audit_entry;
delete from top10_nomination;
delete from top10_entry;
delete from reaction;
delete from comment;
delete from project_status_history;
delete from project_member;
delete from project_editor;
delete from project_tag;
delete from block;
delete from stored_file;
delete from project;

-- Schlagworte erst nach project_tag: tag_id kaskadiert nicht.
delete from tag;

-- Portfolios und Bestaetigungscodes haengen per Kaskade am Konto und
-- gingen ohnehin mit, hier nur der Deutlichkeit halber getrennt.
delete from portfolio
where user_id in (select id from app_user
                  where email not in ('dev-studi@dev.invalid',
                                      'dev-redakteur@dev.invalid',
                                      'dev-admin@dev.invalid'));

delete from app_user
where email not in ('dev-studi@dev.invalid',
                    'dev-redakteur@dev.invalid',
                    'dev-admin@dev.invalid');

commit;
ENDE_SQL_RAEUMEN
echo "  Datenbank geraeumt"

# Die Bytes im Objektspeicher haengen an keiner Fremdschluesselkette und
# blieben sonst als verwaiste Dateien liegen: 22 MB, auf die keine Zeile
# mehr zeigt. Geloescht wird der Inhalt, nicht der Ordner selbst.
im_container "rm -rf '$ROOT'/* '$ROOT'/.[!.]* 2>/dev/null || true; mkdir -p '$ROOT'"
uebrig=$(im_container "find '$ROOT' -type f 2>/dev/null | wc -l" | tr -d '[:space:]')
[ "$uebrig" = "0" ] || abbruch "$uebrig Dateien liegen noch unter $ROOT."
echo "  Objektspeicher leer"
echo

echo "== Stand nach dem Raeumen =="
sql -c "
select 'Projekte' as bestand, count(*) from project
union all select 'Konten',       count(*) from app_user
union all select 'Bloecke',      count(*) from block
union all select 'Dateizeilen',  count(*) from stored_file
union all select 'Schlagworte',  count(*) from tag
union all select 'Fakultaeten',  count(*) from faculty
union all select 'Module',       count(*) from module
union all select 'Semester',     count(*) from semester;"

echo
echo "Fertig. Jetzt: bash demo-daten-komplett.sh"
