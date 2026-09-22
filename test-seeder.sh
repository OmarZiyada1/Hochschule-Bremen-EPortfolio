#!/usr/bin/env bash
# ===================================================================
# Gemeinsamer Datenbestand fuer die Usability-Testwoche.
#
#     bash test-seeder.sh
#
# Bequemer ueber das Menue: .\eportfolio.ps1, Punkt s3. Danach je
# Sitzung Punkt s5 (test-sitzung.sh TN..), der Konto und Rollenblock
# einstellt.
#
# WAS ENTSTEHT
#    13 Konten       8 Studierende, 2 Redaktionen, 2 Administrationen
#                    und das Zusatzkonto aus Aufgabe D3
#    57 Projekte     davon 48 veroeffentlicht, 4 eingereicht (Block C),
#                    5 genehmigt (Aufgabe D5)
#   747 Bloecke      Inhaltsverzeichnis, Ueberschriften, Text, Bild,
#                    Listen und Zitate
#    65 Dateien      Titelbilder und Profilbilder, echte Bytes im
#                    Objektspeicher
#        2 Kategorien  die zwei erkennbar gleichbedeutenden aus D4
#       14 Nominierungen, alle offen, ohne gesetzte Top 10 (D6)
#        6 Zeilen im Top-10-Aenderungsprotokoll, von zwei Personen (D7)
#
# WOHER DIE VORGABEN STAMMEN. Aus der Seed-Pruefliste auf dem Blatt
# "Vor der Sitzung" (Testmaterial/17_Vor_der_Sitzung.docx, Abschnitt 5).
# Sie nennt jede Zahl, die hier steht. Nachzaehlen laesst sich das mit
# test-seeder-pruefen.sh (Menuepunkt s7).
#
# WAS AUF DIE AUFGABENKARTEN KOMMT
#   A2  Thema des Zielprojekts: Baustoffbörse
#       (Projekt "Baustoffbörse am Neustadtswall")
#   A5  inhaltsreiches Projekt: "Mehrwegpfand in der Bremer Gastronomie"
#   C3  Titel: "Zahlungsbereitschaft für regionale Milch in Bremen"
#   C4  Titel: "Wiederverwendung von Ziegeln aus einem Abbruch in Walle"
#   C6  Titel: "Audiowalk zur Werftgeschichte in Gröpelingen"
#   D3  Name des Zusatzkontos: Nele Ostermann
#   D4  Die zwei gleichbedeutenden Kategorien: Studienprojekt,
#       Studentisches Projekt
#   A3  Fakultaet Elektrotechnik und Informatik, Semester WiSe 2025/26,
#       Abschluss Bachelor: fuenf Treffer
#   B1  Zugangsdaten je Sitzung, siehe test-sitzung.sh
#   C1  Zugangsdaten je Sitzung, siehe test-sitzung.sh
#   D1  Zugangsdaten je Sitzung, siehe test-sitzung.sh
#   B2  Projekttitel frei waehlbar
#
# ES LOESCHT DIE TOP 10. Aufgabe D6 verlangt "keine Top 10 gesetzt".
# Steht in der Datenbank eine, etwa aus den Demodaten, wird sie geleert.
# Die Nominierungen der Demodaten bleiben stehen; sie zaehlen fuer D6
# mit, solange sie offen sind.
#
# VORAUSSETZUNGEN
#   - Docker laeuft, Datenbank und Backend der Betriebsart sind oben
#   - Stammdaten sind da: bash stammdaten-seeder.sh (Menuepunkt s1)
#   - Kategorien und Semester sind da; sie entstehen beim Start des
#     Backends im Profil dev (DevMasterDataSeeder)
#   - Das Konto dev-studi@dev.invalid existiert. Aus ihm stammt der
#     Passwort-Hash der Testkonten; bcrypt laesst sich in SQL nicht
#     rechnen.
#   - Internetzugang: die Bilder kommen aus dem Netz
#   - bash, curl und tar (unter Windows: Git Bash)
#
# WIEDERHOLBAR ueber feste ID-Praefixe. Ein zweiter Lauf raeumt seinen
# eigenen vorigen ab und ersetzt ihn:
#     7e570010-...  Konten            7e570014-...  Kommentare
#     7e570011-...  Projekte          7e570015-...  Kategorien (D4)
#     7e570012-...  Dateizeilen       7e570017-...  Nominierungen
#     7e570013-...  Portfolios        7e57001a-...  Pruefspur
#     7e5700f0-...  Sitzungskonten (test-sitzung.sh)
# Demodaten (Praefix d0d000) und dev-Testnutzer bleiben unberuehrt.
#
# ERZEUGT, NICHT VON HAND GESCHRIEBEN. Wer hier etwas aendert, verliert
# es beim naechsten Lauf des Generators.
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   DB_CONTAINER=... BACKEND_CONTAINER=... bash test-seeder.sh
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
command -v curl   >/dev/null 2>&1 || abbruch "curl nicht gefunden."
command -v tar    >/dev/null 2>&1 || abbruch "tar nicht gefunden."

for c in "$DB" "$BACKEND"; do
	if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" != "true" ]; then
		abbruch "Container $c laeuft nicht."
	fi
done
docker exec "$DB" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
	|| abbruch "Die Datenbank $DB_NAME antwortet nicht."

hash_da=$(sql -tAc "select count(*) from app_user where email = 'dev-studi@dev.invalid';" | tr -d '[:space:]')
[ "$hash_da" = "1" ] || abbruch "Das Konto dev-studi@dev.invalid fehlt.
         Aus ihm stammt der Passwort-Hash der Testkonten. Es entsteht
         beim Start des Backends im Profil dev (DevTestnutzerSeeder)."

fehlt=$(sql -tAc "
select string_agg(v.was, ', ')
from (values ('Fakultaeten', (select count(*) from faculty)),
             ('Studiengaenge', (select count(*) from study_program)),
             ('Kategorien', (select count(*) from category)),
             ('Semester', (select count(*) from semester))) as v(was, anzahl)
where v.anzahl = 0;" | tr -d '[:space:]')
[ -z "$fehlt" ] || abbruch "Stammdaten fehlen: $fehlt.
         Erst anlegen: bash stammdaten-seeder.sh (Menuepunkt s1). Kategorien
         und Semester entstehen beim Start des Backends im Profil dev."

# Genauer als "es gibt ueberhaupt Fakultaeten": die Projekte unten
# suchen ihre Fakultaet ueber das Kuerzel und haengen an einem inner
# join. Fehlte eines, entstuenden stillschweigend weniger Projekte, und
# der Bestand faende erst beim Zaehlen auf, nicht hier.
fehlende_fk=$(sql -tAc "
select string_agg(v.kuerzel, ', ')
from (values ('FK1'), ('FK2'), ('FK3'), ('FK4'), ('FK5')) as v(kuerzel)
where not exists (select 1 from faculty f where f.abbreviation = v.kuerzel);" | tr -d '[:space:]')
[ -z "$fehlende_fk" ] || abbruch "Diese Fakultaeten fehlen: $fehlende_fk.
         Die Testprojekte suchen ihre Fakultaet ueber das Kuerzel.
         Erst anlegen: bash stammdaten-seeder.sh (Menuepunkt s1)."

# Ebenso fuer Kategorien und Semester: sie werden ueber den Namen
# gesucht. Ein fehlender Name liesse die Projekte lautlos ausfallen.
fehlende_stamm=$(sql -tAc "
select string_agg(v.was, ', ')
from (values ('Kategorie Abschlussarbeit', (select count(*) from category where name = 'Abschlussarbeit')),
             ('Semester WiSe 2025/26', (select count(*) from semester where name = 'WiSe 2025/26'))) as v(was, anzahl)
where v.anzahl = 0;" | tr -d '[:space:]')
[ -z "$fehlende_stamm" ] || abbruch "Es fehlt: $fehlende_stamm.
         Kategorien und Semester entstehen beim Start des Backends im
         Profil dev (DevMasterDataSeeder)."

echo "  Container laufen, Stammdaten und Passwortquelle vorhanden"
echo

echo "== Vorigen Lauf abraeumen =="
sql <<'ENDE_SQL_TEST_RAEUMEN'
begin;

delete from top10_audit_entry
where id::text like '7e57001a-%'
   or admin_id in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');
delete from top10_nomination
where id::text like '7e570017-%'
   or nominated_by in (select id from app_user where id::text like '7e5700%')
   or decided_by in (select id from app_user where id::text like '7e5700%')
   or project_id in (select id from project where id::text like '7e570011-%');
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
delete from verification_code where user_id in (select id from app_user where id::text like '7e5700%');
delete from portfolio where user_id in (select id from app_user where id::text like '7e5700%');
delete from app_user where id::text like '7e5700%';

update project set category_id = null
where category_id in (select id from category where id::text like '7e570015-%');
delete from category where id::text like '7e570015-%';

commit;
ENDE_SQL_TEST_RAEUMEN
echo "  abgeraeumt"
echo

echo "== Schreiben =="
sql <<'ENDE_SQL_TEST_SCHREIBEN'
begin;

-- -------------------------------------------------------------------
-- 1) Konten. Der Passwort-Hash kommt von dev-studi: bcrypt laesst sich
--    in SQL nicht rechnen, und ein erfundener Hash ergaebe Konten, an
--    denen sich niemand anmeldet.
-- -------------------------------------------------------------------
insert into app_user (id, email, hsb_email, email_verified, hsb_email_verified,
                      password_hash, first_name, last_name, role, status,
                      password_change_required, created_at, updated_at)
select v.id::uuid, v.email, v.hsb_email, true, true, q.password_hash,
       v.first_name, v.last_name, v.role, 'ACTIVE', false,
       now() - interval '300 days', now() - interval '300 days'
from (values
	('7e570010-0000-4000-8000-000000000001', 'merle.ahlers@test.invalid', 'merle.ahlers@stud.hs-bremen.de', 'Merle', 'Ahlers', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000002', 'jannis.bohnhoff@test.invalid', 'jannis.bohnhoff@stud.hs-bremen.de', 'Jannis', 'Bohnhoff', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000003', 'ayse.coskun@test.invalid', 'ayse.coskun@stud.hs-bremen.de', 'Ayse', 'Coskun', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000004', 'fenja.dallmann@test.invalid', 'fenja.dallmann@stud.hs-bremen.de', 'Fenja', 'Dallmann', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000005', 'kilian.ehlert@test.invalid', 'kilian.ehlert@stud.hs-bremen.de', 'Kilian', 'Ehlert', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000006', 'noura.fahim@test.invalid', 'noura.fahim@stud.hs-bremen.de', 'Noura', 'Fahim', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000007', 'bastian.grothe@test.invalid', 'bastian.grothe@stud.hs-bremen.de', 'Bastian', 'Grothe', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000008', 'levke.hinrichs@test.invalid', 'levke.hinrichs@stud.hs-bremen.de', 'Levke', 'Hinrichs', 'STUDENT'),
	('7e570010-0000-4000-8000-000000000020', 'ilka.reimers@test.invalid', 'ilka.reimers@hs-bremen.de', 'Ilka', 'Reimers', 'EDITOR'),
	('7e570010-0000-4000-8000-000000000021', 'torben.schuett@test.invalid', 'torben.schuett@hs-bremen.de', 'Torben', 'Schuett', 'EDITOR'),
	('7e570010-0000-4000-8000-000000000030', 'miriam.vosskamp@test.invalid', 'miriam.vosskamp@hs-bremen.de', 'Miriam', 'Vosskamp', 'ADMIN'),
	('7e570010-0000-4000-8000-000000000031', 'ansgar.wendland@test.invalid', 'ansgar.wendland@hs-bremen.de', 'Ansgar', 'Wendland', 'ADMIN'),
	('7e570010-0000-4000-8000-000000000040', 'nele.ostermann@test.invalid', 'nele.ostermann@stud.hs-bremen.de', 'Nele', 'Ostermann', 'STUDENT')
) as v(id, email, hsb_email, first_name, last_name, role)
cross join (select password_hash from app_user where email = 'dev-studi@dev.invalid') as q;

-- Jedes Konto bekommt sein Portfolio (Contract §3.2.1).
insert into portfolio (id, user_id, biography, avatar_url, created_at, updated_at)
select v.id::uuid, v.user_id::uuid, v.biography, null,
       now() - interval '300 days', now() - interval '300 days'
from (values
	('7e570013-0000-4000-8000-000000000001', '7e570010-0000-4000-8000-000000000001', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000002', '7e570010-0000-4000-8000-000000000002', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000003', '7e570010-0000-4000-8000-000000000003', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000004', '7e570010-0000-4000-8000-000000000004', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000005', '7e570010-0000-4000-8000-000000000005', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000006', '7e570010-0000-4000-8000-000000000006', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000007', '7e570010-0000-4000-8000-000000000007', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000008', '7e570010-0000-4000-8000-000000000008', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.'),
	('7e570013-0000-4000-8000-000000000020', '7e570010-0000-4000-8000-000000000020', null),
	('7e570013-0000-4000-8000-000000000021', '7e570010-0000-4000-8000-000000000021', null),
	('7e570013-0000-4000-8000-000000000030', '7e570010-0000-4000-8000-000000000030', null),
	('7e570013-0000-4000-8000-000000000031', '7e570010-0000-4000-8000-000000000031', null),
	('7e570013-0000-4000-8000-000000000040', '7e570010-0000-4000-8000-000000000040', 'Studiert an der Hochschule Bremen. Dieses Profil gehoert zum Testbestand der Usability-Testwoche.')
) as v(id, user_id, biography);

-- -------------------------------------------------------------------
-- 2) Die zwei erkennbar gleichbedeutenden Kategorien aus Aufgabe D4.
--    Sie stehen absichtlich nebeneinander: die Aufgabe verlangt, sie
--    zusammenzufuehren, ohne dass Projekte verloren gehen.
-- -------------------------------------------------------------------
insert into category (id, name)
values ('7e570015-0000-4000-8000-000000000001', 'Studienprojekt'),
       ('7e570015-0000-4000-8000-000000000002', 'Studentisches Projekt');

-- -------------------------------------------------------------------
-- 3) Projekte.
--
--    Fakultaet, Kategorie und Semester werden ueber ihren fachlichen
--    Namen gesucht, nicht ueber eine feste ID: welche Hierarchie in der
--    Datenbank steht, entscheidet stammdaten-seeder.sh, und Kategorien
--    und Semester kommen aus dem DevMasterDataSeeder.
--
--    Studiengang und Modul werden je Projekt durchgezaehlt, damit die
--    Projekte sich ueber die Studiengaenge der Fakultaet verteilen und
--    die Filterleiste etwas zu filtern hat.
-- -------------------------------------------------------------------
with sp_nummeriert as (
	select sp.id, sp.faculty_id,
	       row_number() over (partition by sp.faculty_id order by sp.name) - 1 as rn,
	       count(*) over (partition by sp.faculty_id) as anzahl
	from study_program sp
),
mod_nummeriert as (
	select m.id, m.study_program_id,
	       row_number() over (partition by m.study_program_id order by m.collective, m.name) - 1 as rn,
	       count(*) over (partition by m.study_program_id) as anzahl
	from module m
)
insert into project (
	id, title, summary, cover_image_url, status, project_type, degree,
	author_id, author_role, faculty_id, study_program_id, module_id,
	category_id, semester_id, created_at, updated_at, published_at, version
)
select v.id::uuid, v.title, v.summary, '/api/files/' || v.cover,
       v.status, v.project_type, v.degree, v.author_id::uuid, v.author_role,
       f.id, sp.id, m.id, c.id, s.id,
       now() - (v.tage || ' days')::interval,
       now() - ((v.tage::int / 2) || ' days')::interval,
       case when v.status = 'PUBLISHED'
            then now() - ((v.tage::int / 2) || ' days')::interval end,
       0
from (values
	('7e570011-0000-4000-8000-000000000001', 'Mehrwegpfand in der Bremer Gastronomie', 'Bachelorarbeit zur Wirtschaftlichkeit von Mehrwegverpackungen im Bremer Außer-Haus-Geschäft. Vierzehn Betriebe in Neustadt und Viertel haben Pfandbecher und Pfandschalen abgerechnet, elf davon bis zum Semesterende; die Arbeit vergleicht ihre Kosten mit Einwegverpackungen.', '7e570012-0000-4000-8000-000000000001', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000001', 'Kostenerhebung und Auswertung', 'FK1', 'Abschlussarbeit', 'WiSe 2024/25', 61),
	('7e570011-0000-4000-8000-000000000002', 'Sturzerkennung mit 60-GHz-Radar im Pflegezimmer', 'Bachelorarbeit zur Sturzerkennung mit einem 60-GHz-Radarsensor an der Zimmerdecke, ohne Kamera und ohne Bild. Geprüft wurde der Sensor in einem nachgebauten Pflegezimmer am Neustadtswall mit 240 gestellten Stürzen und 60 Stunden Alltagsaufnahmen.', '7e570012-0000-4000-8000-000000000002', 'PUBLISHED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000002', 'Sensoraufbau und Auswertung der Messreihen', 'FK4', 'Abschlussarbeit', 'WiSe 2025/26', 62),
	('7e570011-0000-4000-8000-000000000003', 'Sturzerkennung im Wohnraum mit 60-GHz-Radar', 'Bachelorarbeit über einen Radarsensor, der Stürze in einer Wohnung erkennt, ohne ein Bild aufzuzeichnen. Für die Auswertung wurden 240 Abläufe in einem möblierten Raum am Neustadtswall aufgenommen, davon 120 Stürze.', '7e570012-0000-4000-8000-000000000003', 'PUBLISHED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000003', 'Messaufbau und Signalauswertung', 'FK4', 'Abschlussarbeit', 'WiSe 2025/26', 63),
	('7e570011-0000-4000-8000-000000000004', 'Anomalieerkennung in OCPP-Daten von Ladesäulen', 'Bachelorarbeit über die Erkennung von Störungen an öffentlichen Ladesäulen aus OCPP-Protokolldaten. Ausgewertet wurden 14 Monate Betriebsdaten von 46 Bremer Ladepunkten mit zwei Verfahren zur Anomalieerkennung.', '7e570012-0000-4000-8000-000000000004', 'PUBLISHED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000004', 'Datenauswertung und Modellbildung', 'FK4', 'Abschlussarbeit', 'WiSe 2025/26', 64),
	('7e570011-0000-4000-8000-000000000005', 'Ausfallerkennung an Ladesäulen aus OCPP-Protokollen', 'Bachelorarbeit zur Frage, ob sich defekte Ladesäulen an ihren OCPP-Protokollen erkennen lassen, bevor eine Störmeldung eingeht. Grundlage sind 14 Monate Betriebsdaten von 62 öffentlichen Ladepunkten eines Bremer Ladeinfrastrukturbetreibers.', '7e570012-0000-4000-8000-000000000005', 'PUBLISHED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000005', 'Datenaufbereitung und Modellauswahl', 'FK4', 'Abschlussarbeit', 'WiSe 2025/26', 65),
	('7e570011-0000-4000-8000-000000000006', 'Kameragestützte Radverkehrszählung am Osterdeich', 'Bachelorarbeit zur kameragestützten Radverkehrszählung: Ein Kleinrechner am Osterdeich zählte neun Tage lang Fahrräder, ohne ein einziges Bild zu speichern. Der Vergleich mit einer Handzählung zeigt 4 Prozent Abweichung bei Tageslicht und deutlich mehr bei Regen.', '7e570012-0000-4000-8000-000000000006', 'PUBLISHED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000006', 'Aufbau und Auswertung der Messreihe', 'FK4', 'Abschlussarbeit', 'WiSe 2025/26', 66),
	('7e570011-0000-4000-8000-000000000007', 'Baustoffbörse am Neustadtswall', 'Die Baustoffbörse vermittelt Restmaterial aus den Werkstätten und von Baustellen im Bremer Westen an studentische Projekte. Ende Januar 2026 lagerten 41 Posten in einem Kellerraum am Neustadtswall, erfasst in einer Liste mit Fotos.', '7e570012-0000-4000-8000-000000000007', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000001', 'Materialaufnahme und Lagerorganisation', 'FK2', 'Studentische Initiative', 'WiSe 2025/26', 67),
	('7e570011-0000-4000-8000-000000000008', 'Wohnberatung im Quartier Gröpelingen', 'Eine Untersuchung zur aufsuchenden Wohnberatung für ältere Menschen in Bremen-Gröpelingen. 34 Hausbesuche zeigen, warum die Angebote im Quartier oft nicht ankommen und welche Wege zwischen Pflegestützpunkt und Nachbarschaft tatsächlich funktionieren.', '7e570012-0000-4000-8000-000000000008', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000008', 'Erhebung und Auswertung der Interviews', 'FK3', 'Wettbewerbsbeitrag', 'SoSe 2026', 68),
	('7e570011-0000-4000-8000-000000000009', 'Betriebsdatenerfassung in einem Schiffbauzulieferbetrieb', 'Ein mittelständischer Zulieferer für den Schiffbau in Bremen-Nord führt eine Betriebsdatenerfassung ein. Die Arbeit begleitet die Einführung an zwei Montagelinien und fragt, warum die Terminals nach vier Wochen wieder leer blieben.', '7e570012-0000-4000-8000-000000000009', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000002', 'Prozessaufnahme und Einführungsbegleitung', 'FK4', 'Abschlussarbeit', 'WiSe 2024/25', 69),
	('7e570011-0000-4000-8000-000000000010', 'Serrationen am Rotorblatt im Windkanal', 'Gezackte Hinterkanten nach dem Vorbild der Eulenfeder sollen Rotorblätter leiser machen. Wir haben vier Serrationsformen an einem Modellblatt im Windkanal am Neustadtswall vermessen: 42 Messreihen zu Schalldruck und Auftrieb bei 12 bis 28 Metern pro Sekunde.', '7e570012-0000-4000-8000-000000000010', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000003', 'Windkanalversuche und Akustikauswertung', 'FK5', 'Forschungsprojekt', 'SoSe 2025', 70),
	('7e570011-0000-4000-8000-000000000011', 'Konfigurator statt Katalog im Fahrradhandel', 'Ein Bremer Fahrradhändler hat seinen Papierkatalog durch einen Online-Konfigurator ersetzt. Die Arbeit wertet 4.812 Konfigurationsvorgänge aus und fragt, an welcher Stelle Kundinnen und Kunden abbrechen und was das für den Verkauf in der Filiale bedeutet.', '7e570012-0000-4000-8000-000000000011', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000001', 'Datenauswertung und Kundeninterviews', 'FK1', 'Interaktive Medien', 'WiSe 2025/26', 71),
	('7e570011-0000-4000-8000-000000000012', 'Rückbaukataster für ein Bürogebäude in Findorff', 'Für ein Bürogebäude aus dem Jahr 1974 in Bremen-Findorff entstand ein Rückbaukataster: eine Aufnahme aller Bauteile, die sich bei einem Abriss wiederverwenden lassen. Der Bericht nennt die aufgenommenen Mengen und die Posten, bei denen sich die Wiederverwendung nicht rechnet.', '7e570012-0000-4000-8000-000000000012', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000005', 'Bauteilaufnahme und Massenermittlung', 'FK2', 'Lehrveranstaltung', 'SoSe 2026', 72),
	('7e570011-0000-4000-8000-000000000013', 'Mietschuldenberatung im Nachbarschaftstreff Gröpelingen', 'Praxisprojekt der Sozialen Arbeit: eine offene Sprechstunde zu Mietschulden und Kündigungen im Bremer Westen. In einem Semester kamen 63 Ratsuchende in den Nachbarschaftstreff. Der Bericht beschreibt Aufbau, Fallzahlen und die Grenzen ehrenamtlicher Beratung.', '7e570012-0000-4000-8000-000000000013', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000006', 'Sprechstunde und Fallbegleitung', 'FK3', 'Praxisprojekt', 'WiSe 2024/25', 73),
	('7e570011-0000-4000-8000-000000000014', 'Stromverbrauch von WebAssembly und JavaScript im Browser', 'Vier Rechenaufgaben liefen im Browser einmal als JavaScript und einmal als WebAssembly. Das Semesterprojekt im Master maß den Energiebedarf über die RAPL-Zähler des Prozessors und kontrollierte gegen einen Zwischenstecker am Netzteil.', '7e570012-0000-4000-8000-000000000014', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000007', 'Messaufbau und statistische Auswertung', 'FK4', 'Semesterprojekt', 'SoSe 2025', 74),
	('7e570011-0000-4000-8000-000000000015', 'Experimentalrakete Weser II', 'Eine studentische Initiative der Hochschule Bremen baut Experimentalraketen mit selbst gegossenem Feststoffmotor. Weser II erreichte beim Start in Nordschweden 2.870 Meter und blieb damit unter dem Ziel von 3.000 Metern.', '7e570012-0000-4000-8000-000000000015', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000008', 'Bergungssystem und Flugelektronik', 'FK5', 'Studentische Initiative', 'WiSe 2025/26', 75),
	('7e570011-0000-4000-8000-000000000016', 'Pfandsystem für Bremer Kantinen', 'Wettbewerbsbeitrag für einen Bremer Gründungswettbewerb: ein Mehrwegsystem mit Pfand für Kantinen und Imbisse. Enthalten sind die Kalkulation eines gemeinsamen Spülzentrums, eine Befragung von 21 Betrieben und die Rechnung zur Rückgabequote.', '7e570012-0000-4000-8000-000000000016', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000002', 'Kalkulation und Befragung der Betriebe', 'FK1', 'Wettbewerbsbeitrag', 'SoSe 2026', 76),
	('7e570011-0000-4000-8000-000000000017', 'Regenwasserrückhalt auf Gründächern in der Überseestadt', 'Bachelorarbeit über die Frage, wie viel Niederschlag drei extensiv begrünte Bestandsdächer in der Bremer Überseestadt tatsächlich zurückhalten. Gemessen wurde über zwei Winter und verglichen mit den Annahmen der Entwässerungsplanung.', '7e570012-0000-4000-8000-000000000017', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000003', 'Messreihen und Auswertung', 'FK2', 'Abschlussarbeit', 'WiSe 2024/25', 77),
	('7e570011-0000-4000-8000-000000000018', 'Beratungswege pflegender Angehöriger in Bremen-Nord', 'Forschungsprojekt zu pflegenden Angehörigen in Bremen-Nord. 18 Interviews zeigen, über welche Wege Menschen den Pflegestützpunkt und andere Beratungsstellen finden, und woran der Weg dorthin scheitert.', '7e570012-0000-4000-8000-000000000018', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000004', 'Interviewführung und Auswertung', 'FK3', 'Forschungsprojekt', 'SoSe 2025', 78),
	('7e570011-0000-4000-8000-000000000019', 'Wandprojektion für die Erstsemesterwoche', 'Eine interaktive Projektion im Foyer an der Flughafenallee zeigt, woher die Erstsemester kommen und was sie belegen. Zwei Distanzsensoren im Bodenkanal steuern die Ansicht, die Daten stammen aus einer anonymen Umfrage beim Check-in.', '7e570012-0000-4000-8000-000000000019', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000005', 'Sensorik und Datenaufbereitung', 'FK4', 'Interaktive Medien', 'WiSe 2025/26', 79),
	('7e570011-0000-4000-8000-000000000020', 'Vibrationsmessung an einem CubeSat-Strukturmodell', 'Im Labor an der Flughafenallee wurde ein 3U-CubeSat-Strukturmodell auf dem Shaker vermessen: Eigenfrequenzen und Dämpfung, dazu die Frage, wie stark die geschraubte Einspannung das Ergebnis verschiebt. Entstanden im Masterkurs Strukturdynamik im Sommersemester 2026.', '7e570012-0000-4000-8000-000000000020', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000006', 'Messaufbau und Auswertung der Messdaten', 'FK5', 'Lehrveranstaltung', 'SoSe 2026', 80),
	('7e570011-0000-4000-8000-000000000021', 'Betriebsnachfolge in Bremer Handwerksbetrieben', 'Rund 1.900 Handwerksbetriebe in Bremen suchen bis 2030 eine Nachfolge. Das Praxisprojekt begleitete vier Übergaben über je fünf Monate und fragt, woran die Gespräche zwischen Übergebenden und Nachfolgenden hängenbleiben.', '7e570012-0000-4000-8000-000000000021', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000001', 'Gesprächsbegleitung und Fallauswertung', 'FK1', 'Praxisprojekt', 'WiSe 2024/25', 81),
	('7e570011-0000-4000-8000-000000000022', 'Entsiegelung am Buntentorsteinweg', 'Wie viel Regenwasser lässt sich in einem dicht bebauten Quartier der Bremer Neustadt vor Ort versickern? Wir haben 3,1 Hektar am Buntentorsteinweg kartiert, den Untergrund sondiert und drei Entsiegelungsvarianten durchgerechnet.', '7e570012-0000-4000-8000-000000000022', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000008', 'Flächenkartierung und Versickerungsberechnung', 'FK2', 'Semesterprojekt', 'SoSe 2025', 82),
	('7e570011-0000-4000-8000-000000000023', 'Sprachcafé Gröpelingen: Bilanz nach zwei Jahren', 'Seit November 2023 betreibt eine studentische Initiative ein wöchentliches Sprachcafé im Bremer Stadtteil Gröpelingen. Die Arbeit dokumentiert Teilnahmezahlen, den Wechsel der Ehrenamtlichen und die Frage, warum das Angebot im zweiten Jahr fast eingeschlafen wäre.', '7e570012-0000-4000-8000-000000000023', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000002', 'Koordination und Teilnahmeerhebung', 'FK3', 'Studentische Initiative', 'WiSe 2025/26', 83),
	('7e570011-0000-4000-8000-000000000024', 'Modellfahrzeug für den Carolo-Cup 2026', 'Ein autonomes Modellfahrzeug im Maßstab 1:10 für den Carolo-Cup: Spurerkennung über eine einzelne Kamera, Einparken in eine Lücke zwischen zwei Kartons, gebaut von fünf Studierenden im Labor an der Flughafenallee. Der Bericht beschreibt den Aufbau und den Zeitlauf, in dem das Fahrzeug von der Bahn kam.', '7e570012-0000-4000-8000-000000000024', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000003', 'Bildverarbeitung und Spurerkennung', 'FK4', 'Wettbewerbsbeitrag', 'SoSe 2026', 84),
	('7e570011-0000-4000-8000-000000000025', 'Thermografische Rissprüfung an CFK-Proben', 'Bachelorarbeit zur zerstörungsfreien Prüfung: Lassen sich Delaminationen in kohlenstofffaserverstärkten Laminaten mit Impuls-Thermografie zuverlässig finden? Vermessen wurden 40 Laborproben, im direkten Vergleich mit der Ultraschallprüfung.', '7e570012-0000-4000-8000-000000000025', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000004', 'Probenherstellung und Messreihen', 'FK5', 'Abschlussarbeit', 'WiSe 2024/25', 85),
	('7e570011-0000-4000-8000-000000000026', 'Zahlungsbereitschaft für Mehrwegbecher in Bremer Cafés', 'Forschungsprojekt zur Zahlungsbereitschaft für Mehrwegbecher: 412 Passantinnen und Passanten in der Bremer Innenstadt beantworteten ein Choice-Experiment zu Pfandhöhe und Rückgabeweg, dazu kamen Leitfadeninterviews mit 14 Cafébetrieben.', '7e570012-0000-4000-8000-000000000026', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000005', 'Erhebung und Auswertung der Befragung', 'FK1', 'Forschungsprojekt', 'SoSe 2025', 86),
	('7e570011-0000-4000-8000-000000000027', 'Web-Rundgang durch Speicher XI aus Laserscans', 'Aus 38 Laserscans des Speichers XI in der Überseestadt entstand ein Rundgang, der sich im Browser begehen lässt. Das Projekt zeigt, wo eine Punktwolke Baugeschichte vermitteln kann und an welchen Stellen sie versagt.', '7e570012-0000-4000-8000-000000000027', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000006', 'Scanaufnahme und Registrierung', 'FK2', 'Interaktive Medien', 'WiSe 2025/26', 87),
	('7e570011-0000-4000-8000-000000000028', 'Aufsuchende Beratung in Gröpelingen', 'Seminarprojekt zur aufsuchenden Sozialberatung in Bremen-Gröpelingen. Untersucht wurde, ob Beratung an Alltagsorten Menschen erreicht, die den Weg in die Beratungsstelle nicht gehen. Grundlage sind 14 Kurzinterviews und fünf Gespräche mit Fachkräften.', '7e570012-0000-4000-8000-000000000028', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000007', 'Interviewführung und Auswertung', 'FK3', 'Lehrveranstaltung', 'SoSe 2026', 88),
	('7e570011-0000-4000-8000-000000000029', 'Vibrationsüberwachung an einer Verpackungsmaschine', 'Praxisprojekt bei einem Bremer Anlagenbauer: An der Vorführmaschine wurden Beschleunigungssensoren nachgerüstet, um Lagerschäden früher zu erkennen. Der Bericht beschreibt Messaufbau, Auswertung und die Grenzen der Schwingungsmessung im Schichtbetrieb.', '7e570012-0000-4000-8000-000000000029', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000008', 'Sensorik und Messaufbau', 'FK4', 'Praxisprojekt', 'WiSe 2024/25', 89),
	('7e570011-0000-4000-8000-000000000030', 'Feinstaubbindung durch Moosmodule an der Werderstraße', 'Semesterprojekt zur Feinstaubbindung durch Moos. Sechs bepflanzte Module hingen zwölf Wochen an einer Fassade an der Werderstraße, daneben lief eine Referenzmessung. Der Bericht nennt auch die Woche, in der die Bewässerung ausfiel.', '7e570012-0000-4000-8000-000000000030', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000002', 'Messaufbau und Probenahme', 'FK5', 'Semesterprojekt', 'SoSe 2025', 90),
	('7e570011-0000-4000-8000-000000000031', 'Workshopreihe zur Steuererklärung an der Werderstraße', 'Eine studentische Initiative an der Werderstraße hat im Wintersemester 2025/26 sechs Abende zur Steuererklärung veranstaltet, vor allem zum Verlustvortrag für Studierende ohne eigenes Einkommen. Der Bericht nennt die Teilnehmerzahlen und die rechtliche Grenze, an der die Reihe umgebaut werden musste.', '7e570012-0000-4000-8000-000000000031', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000001', 'Organisation und Auswertung der Abende', 'FK1', 'Studentische Initiative', 'WiSe 2025/26', 91),
	('7e570011-0000-4000-8000-000000000032', 'Kühle Wege durch die Neustadt', 'Ein Wettbewerbsbeitrag zur Hitzevorsorge in der Bremer Neustadt. An 18 Messpunkten zwischen Werdersee und Buntentorsteinweg wurde im Juli die Oberflächentemperatur erfasst, daraus entstand ein Netz beschatteter Fußwege zu Apotheken und Haltestellen.', '7e570012-0000-4000-8000-000000000032', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000004', 'Messkampagne und Kartierung der Wege', 'FK2', 'Wettbewerbsbeitrag', 'SoSe 2026', 92),
	('7e570011-0000-4000-8000-000000000033', 'Ehrenamtliche Mitarbeit in der Bremer Kältehilfe', 'Die Bremer Kältehilfe verliert jeden Winter etwa die Hälfte ihrer neu gewonnenen Ehrenamtlichen. Die Arbeit untersucht anhand von 23 Interviews und zwei mitlaufenden Nachtschichten, an welcher Stelle Menschen aussteigen und welche Rolle die Einsatzplanung dabei spielt.', '7e570012-0000-4000-8000-000000000033', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000005', 'Interviews und Schichtprotokolle', 'FK3', 'Abschlussarbeit', 'WiSe 2024/25', 93),
	('7e570011-0000-4000-8000-000000000034', 'Abgebrochene Ladevorgänge an sechs Bremer Ladesäulen', 'An sechs öffentlichen Ladesäulen in Bremen haben wir zwei Monate lang den OCPP-Verkehr zwischen Säule und Backend mitgeschnitten. Von 1.184 Ladevorgängen endeten 137 vorzeitig, und die Ursachen lagen selten beim Fahrzeug.', '7e570012-0000-4000-8000-000000000034', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000006', 'Messaufbau und Protokollanalyse', 'FK4', 'Forschungsprojekt', 'SoSe 2025', 94),
	('7e570011-0000-4000-8000-000000000035', 'Touchtisch zur Wasserqualität der Weser', 'Für das Schülerlabor am Neustadtswall entstand ein Touchtisch, an dem Jugendliche Messwerte zur Wasserqualität der Weser selbst vergleichen. Die Arbeit beschreibt den Aufbau, die beiden Datenquellen und den Test mit drei Schulklassen im November 2025.', '7e570012-0000-4000-8000-000000000035', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000007', 'Interaktionsdesign und Messdatenaufbereitung', 'FK5', 'Interaktive Medien', 'WiSe 2025/26', 95),
	('7e570011-0000-4000-8000-000000000036', 'Betriebsnachfolge im Bremer Handwerk', 'Wie finden Handwerksbetriebe in Bremen und im Umland eine Nachfolge? Für eine Lehrveranstaltung im Sommersemester 2026 haben wir 14 Inhaberinnen und Inhaber befragt, die in den nächsten fünf Jahren übergeben wollen, und ihre Preisvorstellungen mit dem verglichen, was Übernehmende tatsächlich rechnen.', '7e570012-0000-4000-8000-000000000036', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000008', 'Interviews und Auswertung', 'FK1', 'Lehrveranstaltung', 'SoSe 2026', 96),
	('7e570011-0000-4000-8000-000000000037', 'Schulhofentsiegelung in Bremen-Walle', 'Praxisprojekt zur Regenwasserbewirtschaftung: Für einen 1.900 Quadratmeter großen Schulhof in Walle entstanden eine Bestandsaufnahme, Versickerungsversuche und ein Entwurf mit Baumrigolen. Auftraggeber war der Schulverein, der damit Fördermittel beantragen will.', '7e570012-0000-4000-8000-000000000037', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000002', 'Bestandsaufnahme und Entwurfsplanung', 'FK2', 'Praxisprojekt', 'WiSe 2024/25', 97),
	('7e570011-0000-4000-8000-000000000038', 'Schulabsentismus in Gröpelingen aus Sicht der Schulsozialarbeit', 'Elf Fachkräfte der Schulsozialarbeit an zwei Oberschulen in Bremen-Gröpelingen berichten in Leitfadeninterviews über Schulabsentismus: wann sie von einem Fehlen überhaupt erfahren und wo ihre Möglichkeiten enden. Ein Semesterprojekt der Sozialen Arbeit.', '7e570012-0000-4000-8000-000000000038', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000003', 'Interviewführung und qualitative Auswertung', 'FK3', 'Semesterprojekt', 'SoSe 2025', 98),
	('7e570011-0000-4000-8000-000000000039', 'E-Paper-Anzeige für den Mensaplan', 'Eine studentische Initiative aus der Informatik hat eine E-Paper-Anzeige für den Speiseplan der Mensa Neustadtswall gebaut. Das Schild hängt seit November 2025 im Foyer und kommt rechnerisch 210 Tage mit einer Akkuladung aus.', '7e570012-0000-4000-8000-000000000039', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000004', 'Firmware und Energiebudget', 'FK4', 'Studentische Initiative', 'WiSe 2025/26', 99),
	('7e570011-0000-4000-8000-000000000040', 'Bionischer Rumpf für einen Unterwasserroboter', 'Wettbewerbsbeitrag zu einem autonomen Unterwasserfahrzeug mit bionisch geformtem Rumpf nach dem Vorbild des Kofferfischs. Gemessen wurden Strömungswiderstand und Kursstabilität im Schleppversuch, bevor das Fahrzeug in La Spezia startete.', '7e570012-0000-4000-8000-000000000040', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000005', 'Rumpfkonstruktion und Schleppversuche', 'FK5', 'Wettbewerbsbeitrag', 'SoSe 2026', 100),
	('7e570011-0000-4000-8000-000000000041', 'Zahlungsbereitschaft für regionale Ware am Wochenmarkt', 'Studienprojekt einer Vierergruppe im Bachelor Betriebswirtschaft: An drei Bremer Wochenmärkten wurden 212 Kundinnen und Kunden befragt, welchen Aufschlag sie für regionale Herkunft zahlen würden. Der Bericht vergleicht die Angaben mit dem Kassenbon desselben Einkaufs.', '7e570012-0000-4000-8000-000000000041', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000001', 'Fragebogen und statistische Auswertung', 'FK1', 'Studienprojekt', 'WiSe 2024/25', 101),
	('7e570011-0000-4000-8000-000000000042', 'Barrierefreiheit im Hörsaalgebäude am Neustadtswall', 'Studienprojekt einer Vierergruppe: Aufnahme eines Hörsaalgebäudes am Neustadtswall nach DIN 18040-1, mit Bestandsplan, einer Mängelliste von 46 Einträgen und Vorschlägen für den Umbau der Zugänge.', '7e570012-0000-4000-8000-000000000042', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000007', 'Bestandsaufnahme und Planzeichnung', 'FK2', 'Studienprojekt', 'SoSe 2025', 102),
	('7e570011-0000-4000-8000-000000000043', 'Digitale Terminvergabe in der Sozialberatung', 'Studienprojekt zu der Frage, wie Ratsuchende in Bremen-Huchting mit der Online-Terminvergabe einer Sozialberatung zurechtkommen. Grundlage sind 12 Interviews und zwei Beobachtungstage im Wintersemester 2025/26.', '7e570012-0000-4000-8000-000000000043', 'PUBLISHED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000008', 'Interviewführung und Codierung', 'FK3', 'Studienprojekt', 'WiSe 2025/26', 103),
	('7e570011-0000-4000-8000-000000000044', 'Prüfungsplanung mit einem Constraint-Solver', 'Studienprojekt einer Vierergruppe an der Fakultät 4: Der Prüfungsplan eines Semesters mit 147 Klausuren und 22 Räumen wurde als Constraint-Modell formuliert und automatisch gelöst. Der Bericht vergleicht das Ergebnis mit dem von Hand erstellten Plan.', '7e570012-0000-4000-8000-000000000044', 'PUBLISHED', 'PAPER', 'MASTER', '7e570010-0000-4000-8000-000000000002', 'Modellierung der Nebenbedingungen im Solver', 'FK4', 'Studentisches Projekt', 'SoSe 2026', 104),
	('7e570011-0000-4000-8000-000000000045', 'Photobioreaktor im Dauerbetrieb über zwölf Wochen', 'Fünf Studierende betrieben im Labor am Neustadtswall einen 30-Liter-Photobioreaktor über zwölf Wochen und protokollierten Wachstum und Ausfälle der Mikroalgenkultur. Das Projekt entstand als Gruppenarbeit im Projektmodul Bioverfahrenstechnik.', '7e570012-0000-4000-8000-000000000045', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000003', 'Probenahme und Laborauswertung', 'FK5', 'Studentisches Projekt', 'WiSe 2024/25', 105),
	('7e570011-0000-4000-8000-000000000046', 'Retouren bei Arbeitshosen im Versandhandel', 'Ein Versandhändler für Arbeitskleidung aus Hemelingen bekommt bei Hosen 41 Prozent der Ware zurück. Im Studienprojekt haben wir 9.400 Rücksendungen aus dem Jahr 2024 ausgewertet, 14 Kundinnen und Kunden befragt und zwei Maßnahmen vorgeschlagen.', '7e570012-0000-4000-8000-000000000046', 'PUBLISHED', 'REGULAR', 'MASTER', '7e570010-0000-4000-8000-000000000004', 'Datenauswertung und Kundeninterviews', 'FK1', 'Studentisches Projekt', 'SoSe 2025', 106),
	('7e570011-0000-4000-8000-000000000047', 'Kühle Ecken: Hitzemessungen in der Alten Neustadt', 'Eine studentische Initiative hat im Sommer 2025 an 22 Punkten der Bremer Alten Neustadt Lufttemperatur und Strahlungswärme gemessen. Die Arbeit stellt die Messkampagne dar, ordnet die Ergebnisse ein und beschreibt die Übergabe an Beirat und Ortsamt.', '7e570012-0000-4000-8000-000000000047', 'PUBLISHED', 'PAPER', 'BACHELOR', '7e570010-0000-4000-8000-000000000005', 'Messkampagne und Kartierung', 'FK2', 'Studentische Initiative', 'WiSe 2025/26', 107),
	('7e570011-0000-4000-8000-000000000048', 'Streitschlichtung an einer Oberschule in Gröpelingen', 'An einer Oberschule in Bremen-Gröpelingen haben wir neun Schülerinnen und Schüler zu Streitschlichtern ausgebildet und ein Schuljahr lang begleitet. Der Bericht zur Peer-Mediation wurde als Wettbewerbsbeitrag eingereicht und benennt auch die Fälle, für die das Verfahren nicht taugt.', '7e570012-0000-4000-8000-000000000048', 'PUBLISHED', 'THESIS', 'MBA', '7e570010-0000-4000-8000-000000000006', 'Ausbildung und Begleitung der Schlichter', 'FK3', 'Wettbewerbsbeitrag', 'SoSe 2026', 108),
	('7e570011-0000-4000-8000-000000000051', 'Zahlungsbereitschaft für regionale Milch in Bremen', 'Bachelorarbeit zu der Frage, wie viel Aufpreis Bremer Kundschaft für Milch aus dem Umland tatsächlich zahlt. In vier Supermärkten wurden 214 Personen befragt und die Angaben anschließend mit den echten Abverkaufszahlen der Regionalmarke verglichen.', '7e570012-0000-4000-8000-000000000051', 'SUBMITTED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000002', 'Befragung und statistische Auswertung', 'FK1', 'Abschlussarbeit', 'WiSe 2024/25', 111),
	('7e570011-0000-4000-8000-000000000052', 'Wiederverwendung von Ziegeln aus einem Abbruch in Walle', 'Aus einem Speichergebäude von 1928 in Bremen-Walle wurden 600 gebrauchte Ziegel von Hand geborgen, gereinigt und im Labor geprüft. Die Bachelorarbeit klärt, ob sich solche Steine für tragendes Mauerwerk wiederverwenden lassen.', '7e570012-0000-4000-8000-000000000052', 'SUBMITTED', 'THESIS', 'BACHELOR', '7e570010-0000-4000-8000-000000000003', 'Bauaufnahme und Materialprüfung', 'FK2', 'Forschungsprojekt', 'SoSe 2025', 112),
	('7e570011-0000-4000-8000-000000000053', 'Audiowalk zur Werftgeschichte in Gröpelingen', 'Ein Audiowalk mit sieben Stationen über das Ende der AG Weser 1983 und die Jahre danach in Gröpelingen. Grundlage sind acht Gespräche, von ehemaligen Werftarbeitern bis zu Beschäftigten der heutigen Stadtteilarbeit.', '7e570012-0000-4000-8000-000000000053', 'SUBMITTED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000004', 'Interviews und Tonschnitt', 'FK3', 'Interaktive Medien', 'WiSe 2025/26', 113),
	('7e570011-0000-4000-8000-000000000054', 'Sitzplatzanzeige für die Bibliothek Neustadtswall', 'Projekt aus der Lehrveranstaltung zu eingebetteten Systemen: eine Sitzplatzanzeige für die Bibliothek am Neustadtswall. 24 Arbeitsplätze melden ihre Belegung über Abstandssensoren und MQTT an eine Webseite, ohne Kamera und ohne personenbezogene Daten.', '7e570012-0000-4000-8000-000000000054', 'SUBMITTED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000005', 'Sensorik und Serverdienst', 'FK4', 'Lehrveranstaltung', 'SoSe 2026', 114),
	('7e570011-0000-4000-8000-000000000061', 'Kostenrechnung für ein Reparaturcafé in Walle', 'Beleg aus der Lehrveranstaltung Kosten- und Leistungsrechnung: Für ein ehrenamtlich betriebenes Reparaturcafé in Bremen-Walle entstand eine Vollkostenrechnung über vier Öffnungstermine, samt der Frage, welcher Spendenbeitrag je Reparatur die Kosten deckt.', '7e570012-0000-4000-8000-000000000061', 'APPROVED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000003', 'Kostenerfassung und Kalkulation', 'FK1', 'Lehrveranstaltung', 'WiSe 2024/25', 121),
	('7e570011-0000-4000-8000-000000000062', 'Bauzeitenplan für die Kita-Erweiterung in Findorff', 'Praxisprojekt in einem Bremer Ingenieurbüro: Für die Erweiterung einer Kita in Findorff entstanden Massenermittlung und Bauzeitenplan, dazu die Auswertung, warum der Rohbau drei Wochen später begann als geplant.', '7e570012-0000-4000-8000-000000000062', 'APPROVED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000004', 'Terminplanung und Massenermittlung', 'FK2', 'Praxisprojekt', 'SoSe 2025', 122),
	('7e570011-0000-4000-8000-000000000063', 'Podcast über Ehrenamt in Bremen-Nord', 'Fünf Folgen über Menschen, die sich zwischen Vegesack und Farge ehrenamtlich engagieren, aufgenommen im Semesterprojekt des Wintersemesters 2025/26. Der Bericht beschreibt, wie die Gäste ausgewählt wurden und was die Aufnahmen vor Ort erschwert hat.', '7e570012-0000-4000-8000-000000000063', 'APPROVED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000005', 'Aufnahme und Schnitt der Folgen', 'FK3', 'Semesterprojekt', 'WiSe 2025/26', 123),
	('7e570011-0000-4000-8000-000000000064', 'Reparaturtreff für Kleingeräte am Neustadtswall', 'Eine studentische Initiative der Fakultät 4: Seit April 2026 öffnet an jedem zweiten Donnerstag eine Werkstatt im AB-Gebäude, in der Kleingeräte wie Wasserkocher und Kopfhörer gemeinsam repariert werden. Zahlen und Erfahrungen aus dem ersten Semester.', '7e570012-0000-4000-8000-000000000064', 'APPROVED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000006', 'Organisation und Werkstattbetrieb', 'FK4', 'Studentische Initiative', 'SoSe 2026', 124),
	('7e570011-0000-4000-8000-000000000065', 'Solarboot für die Regatta auf der Weser', 'Acht Studierende bauten für die studentische Solarboot-Regatta ein 5,2 Meter langes Boot und traten damit im Juni 2025 auf der Weser an. Der Bericht beschreibt die Antriebsauslegung und was davon auf dem Wasser übrig blieb.', '7e570012-0000-4000-8000-000000000065', 'APPROVED', 'REGULAR', 'BACHELOR', '7e570010-0000-4000-8000-000000000007', 'Antriebsauslegung und Erprobung', 'FK5', 'Wettbewerbsbeitrag', 'WiSe 2024/25', 125)
) as v(id, title, summary, cover, status, project_type, degree,
       author_id, author_role, faculty, category, semester, tage)
join faculty f on f.abbreviation = v.faculty
join category c on c.name = v.category
join semester s on s.name = v.semester
left join sp_nummeriert sp
       on sp.faculty_id = f.id
      and sp.rn = (('x' || substr(md5(v.id), 1, 8))::bit(32)::int & 2147483647) % sp.anzahl
left join mod_nummeriert m
       on m.study_program_id = sp.id
      and m.rn = (('x' || substr(md5(v.id || 'm'), 1, 8))::bit(32)::int & 2147483647) % m.anzahl;

-- -------------------------------------------------------------------
-- 4) Bloecke. schema_version 3 wie im uebrigen Bestand.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version,
                   created_at, updated_at)
select gen_random_uuid(), v.project_id::uuid, v.type, v.order_index,
       v.content::jsonb, 3,
       now() - interval '200 days', now() - interval '100 days'
from (values
	('7e570011-0000-4000-8000-000000000001', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Mehrwegpfand in der Bremer Gastronomie","index":0},{"level":2,"text":"Ausgangslage im Außer-Haus-Geschäft","index":1},{"level":2,"text":"Vierzehn Betriebe, ein Semester","index":2},{"level":2,"text":"Welche Kosten in die Rechnung eingehen","index":3},{"level":2,"text":"Ergebnisse der Kostenrechnung","index":4},{"level":2,"text":"Was nicht funktioniert hat","index":5},{"level":2,"text":"Übertragbarkeit und Empfehlung","index":6}]}}'),
	('7e570011-0000-4000-8000-000000000001', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Mehrwegpfand in der Bremer Gastronomie"}]}'),
	('7e570011-0000-4000-8000-000000000001', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000001","alt":"Titelbild des Projekts Mehrwegpfand in der Bremer Gastronomie","caption":"Bachelorarbeit zur Wirtschaftlichkeit von Mehrwegverpackungen im Bremer Außer-Haus-Geschäft. Vierzehn Betriebe in Neustadt und Viertel haben Pfandbecher und Pfandschalen abgerechnet, elf davon bis zu…","width":100}}'),
	('7e570011-0000-4000-8000-000000000001', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage im Außer-Haus-Geschäft"}]}'),
	('7e570011-0000-4000-8000-000000000001', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Seit Januar 2023 müssen Betriebe ab einer bestimmten Größe im Außer-Haus-Geschäft eine Mehrwegalternative anbieten. In Gesprächen mit Wirtinnen und Wirten in der Bremer Neustadt zeigte sich schnell, dass die Pflicht bekannt war, die Kostenfolgen aber nicht. Gefragt wurde nach dem Preis der Becher, kaum nach dem Spülgang und dem Schwund. Die Personalzeit an der Theke tauchte in keiner der Vorüberlegungen auf. Die Arbeit setzt an dieser Lücke an und rechnet die Kosten eines Semesters durch."}]}'),
	('7e570011-0000-4000-8000-000000000001', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Fragestellung lautete: Ab welcher Ausgabemenge pro Tag trägt sich ein Mehrwegsystem im Vergleich zur Einwegverpackung? Bewusst ausgeklammert blieben ökologische Wirkungen, weil dafür belastbare Daten aus den Betrieben gefehlt hätten. Die Arbeit ist eine betriebswirtschaftliche Rechnung und keine Ökobilanz. Betreut wurde sie am Standort Werderstraße im Studiengang Betriebswirtschaft."}]}'),
	('7e570011-0000-4000-8000-000000000001', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vierzehn Betriebe, ein Semester"}]}'),
	('7e570011-0000-4000-8000-000000000001', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Beteiligt haben sich vierzehn Betriebe zwischen Neustadtswall und Ostertorsteinweg: sieben Cafés, vier Imbisse, zwei Bäckereifilialen und eine Kaffeebar in Hochschulnähe. Die Auswahl war keine Zufallsstichprobe, sondern folgte der Bereitschaft, ein Semester lang Zahlen herauszugeben. Das schränkt die Aussagekraft ein und wird in der Arbeit offen benannt. Zwei größere Ketten haben eine Teilnahme abgelehnt, beide mit Verweis auf Vorgaben der Zentrale."}]}'),
	('7e570011-0000-4000-8000-000000000001', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Erhebung lief von Oktober 2024 bis Februar 2025. Jeder Betrieb führte ein einfaches Blatt mit Ausgaben, Rückgaben und Bruch. Zusätzlich gab es je Betrieb zwei Beobachtungsstunden an der Theke, um die Zeit für Rücknahme und Pfandbuchung zu stoppen. Der Mittelwert lag bei 24 Sekunden je Rücknahme und damit deutlich über der Schätzung von zehn Sekunden, mit der die Betriebe selbst gerechnet hatten."}]}'),
	('7e570011-0000-4000-8000-000000000001', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Welche Kosten in die Rechnung eingehen"}]}'),
	('7e570011-0000-4000-8000-000000000001', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Kalkulation trennt einmalige von laufenden Kosten und rechnet alles auf eine ausgegebene Portion herunter. Damit die Betriebe die Rechnung nachvollziehen konnten, blieb das Modell bewusst einfach: keine kalkulatorischen Zinsen, keine Gemeinkostenumlage über Schlüssel, die niemand prüfen kann. Fünf Positionen gingen ein, und über die letzte gab es die längste Diskussion, weil sie nicht in jedem Betrieb anfällt."}]}'),
	('7e570011-0000-4000-8000-000000000001', 11, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Anschaffung der Becher und Schalen, verteilt auf eine angenommene Nutzungsdauer von 120 Umläufen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Spülkosten je Umlauf, gemessen an Wasser, Strom, Reiniger und Maschinenlaufzeit"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Personalzeit für Rücknahme, Sichtprüfung und Pfandbuchung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Schwund durch nicht zurückgebrachte oder beschädigte Behälter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Systemgebühren, sofern der Betrieb an einem überregionalen Pfandpool teilnahm"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000001', 12, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse der Kostenrechnung"}]}'),
	('7e570011-0000-4000-8000-000000000001', 13, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Über die elf Betriebe, die bis zum Semesterende Zahlen lieferten, lag der Break-even bei rund 42 ausgegebenen Portionen pro Tag. Darunter blieb Einweg günstiger, darüber kippte die Rechnung zugunsten von Mehrweg. Die Spanne war allerdings groß: Ein Imbiss am Buntentorsteinweg erreichte den Punkt schon bei 28 Portionen, weil eine ohnehin laufende Gastronomiespülmaschine mitgenutzt wurde. Ein Café ohne eigene Spültechnik kam auch bei 90 Portionen nicht in die Nähe."}]}'),
	('7e570011-0000-4000-8000-000000000001', 14, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der größte Einzelposten war nicht die Anschaffung, sondern der Schwund. Im Mittel kehrten 8,4 Prozent der ausgegebenen Behälter nicht zurück, in einem Betrieb mit hohem Anteil an Laufkundschaft waren es 19 Prozent. Das Pfand von einem Euro deckte den Wiederbeschaffungswert der Schale nicht, sodass jeder verlorene Behälter eine Unterdeckung erzeugte. Diese Position hatte vor der Erhebung kein Betrieb auf dem Zettel."}]}'),
	('7e570011-0000-4000-8000-000000000001', 15, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was nicht funktioniert hat"}]}'),
	('7e570011-0000-4000-8000-000000000001', 16, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Drei Betriebe stiegen im Dezember aus der Erhebung aus. Der Grund war nicht das Thema, sondern das Erfassungsblatt: In Stoßzeiten wurde es schlicht nicht geführt, und nachträgliche Schätzungen wären in die Auswertung eingegangen, ohne dass jemand ihre Herkunft erkannt hätte. Diese drei Betriebe stehen deshalb nicht in der Kalkulation, sondern nur in der Beschreibung des Feldzugangs."}]}'),
	('7e570011-0000-4000-8000-000000000001', 17, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Auch der Versuch, Kassendaten direkt zu exportieren, scheiterte. Vier verschiedene Kassensysteme, davon zwei ohne brauchbare Exportfunktion, hätten eine Vereinheitlichung nötig gemacht, für die im Semester keine Zeit war. Die Zahlen stammen deshalb aus Handzählungen, mit allen Ungenauigkeiten, die das mit sich bringt. Wer die Erhebung wiederholt, sollte die Kassenfrage vor dem ersten Termin klären."}]}'),
	('7e570011-0000-4000-8000-000000000001', 18, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wir haben die Becher gekauft, weil wir mussten. Dass uns die Spülerei mehr kostet als das Material, hat hier vorher niemand ausgerechnet."}]}]}'),
	('7e570011-0000-4000-8000-000000000001', 19, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Übertragbarkeit und Empfehlung"}]}'),
	('7e570011-0000-4000-8000-000000000001', 20, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Zahlen gelten für Bremen im Winterhalbjahr und für Betriebe mit überwiegend lokaler Stammkundschaft. Im Sommer, wenn der Anteil an Laufkundschaft an der Schlachte steigt, dürfte der Schwund höher liegen. Eine Wiederholung im Sommersemester wäre der nächste sinnvolle Schritt, ebenso ein Vergleich mit Betrieben, die einen Pfandpool statt eigener Behälter nutzen."}]}'),
	('7e570011-0000-4000-8000-000000000001', 21, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Praxis folgt daraus vor allem eine Empfehlung zur Pfandhöhe. Wo der Pfandbetrag unter dem Wiederbeschaffungswert liegt, subventioniert der Betrieb jeden nicht zurückgebrachten Behälter. Zwei der beteiligten Cafés haben ihr Pfand nach der Zwischenauswertung im Januar von einem auf zwei Euro angehoben und melden seither eine Rückgabequote von über 95 Prozent."}]}'),
	('7e570011-0000-4000-8000-000000000002', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Sturzerkennung mit 60-GHz-Radar im Pflegezimmer","index":0},{"level":2,"text":"Warum kein Kamerabild","index":1},{"level":2,"text":"Aufbau im nachgebauten Zimmer","index":2},{"level":2,"text":"Was die Zahlen hergeben","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000002', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Sturzerkennung mit 60-GHz-Radar im Pflegezimmer"}]}'),
	('7e570011-0000-4000-8000-000000000002', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000002","alt":"Titelbild des Projekts Sturzerkennung mit 60-GHz-Radar im Pflegezimmer","caption":"Bachelorarbeit zur Sturzerkennung mit einem 60-GHz-Radarsensor an der Zimmerdecke, ohne Kamera und ohne Bild. Geprüft wurde der Sensor in einem nachgebauten Pflegezimmer am Neustadtswall mit 240 gest…","width":100}}'),
	('7e570011-0000-4000-8000-000000000002', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum kein Kamerabild"}]}'),
	('7e570011-0000-4000-8000-000000000002', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Den Anstoß gab ein Gespräch mit der Pflegedienstleitung eines Heims in Bremen-Horn. Interesse an einer automatischen Sturzmeldung war da, an Kameras im Zimmer dagegen nicht: Weder der Heimbeirat noch die Angehörigen hätten zugestimmt. Ein Radarsensor liefert kein Bild, sondern Entfernung, Winkel und Geschwindigkeit der Reflexionen im Raum. Wer sich davor umzieht, bleibt für die Auswertung eine Punktwolke. Erst das machte die Technik in diesem Haus überhaupt besprechbar."}]}'),
	('7e570011-0000-4000-8000-000000000002', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit prüft eine einzige Frage: Reicht ein Sensor an der Decke, um Stürze zuverlässig genug zu melden, ohne die Nachtschicht mit Fehlalarmen zu belasten? Als Schwelle wurde gemeinsam mit der Station höchstens ein Fehlalarm pro Zimmer und Nacht angesetzt. Diese Zahl stammt nicht aus der Literatur, sondern aus dem Betrieb."}]}'),
	('7e570011-0000-4000-8000-000000000002', 6, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ein Alarm, der dreimal pro Nacht ohne Grund losgeht, wird nach einer Woche abgeklemmt. Dann ist er schlechter als gar keiner."}]}]}'),
	('7e570011-0000-4000-8000-000000000002', 7, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau im nachgebauten Zimmer"}]}'),
	('7e570011-0000-4000-8000-000000000002', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Messreihen wurde ein Seminarraum am Neustadtswall über acht Wochen zum Pflegezimmer umgebaut: Pflegebett, Nachttisch, Linoleum mit einem kleinen Teppich davor, dazu ein Rollator. Der Sensor hing mittig über dem Bett, die Auswertung lief auf einem Einplatinenrechner im selben Raum. Aufgezeichnet wurden ausschließlich die Doppler-Spektrogramme und die daraus abgeleiteten Merkmale, die Rohdaten der Antennen verließen das Gerät nicht."}]}'),
	('7e570011-0000-4000-8000-000000000002', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Verglichen wurden zwei Verfahren auf denselben Aufnahmen: ein Random Forest auf handgebauten Merkmalen aus dem Doppler-Spektrum und ein kleines neuronales Netz auf den Spektrogrammen. Der Random Forest brauchte 40 Millisekunden je Zeitfenster, das Netz 310. Auf dem Einplatinenrechner war das der Unterschied zwischen einer mitlaufenden Auswertung und einem Rückstand, der sich über eine Nacht aufbaut."}]}'),
	('7e570011-0000-4000-8000-000000000002', 10, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Radarmodul BGT60TR13C, 60 Gigahertz, eine Sende- und drei Empfangsantennen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Montage an der Decke in 2,60 Metern Höhe, Blickrichtung senkrecht nach unten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"240 gestellte Stürze von acht Freiwilligen, drei davon über 65 Jahre alt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"60 Stunden Alltagsaufnahmen: Aufstehen, Bett beziehen, Staubsaugen, Wäsche ablegen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Klassifikation auf einem Raspberry Pi 5 im Raum, ohne Netzverbindung"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000002', 11, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Zahlen hergeben"}]}'),
	('7e570011-0000-4000-8000-000000000002', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Von 240 gestellten Stürzen meldete der Random Forest 218, also gut 90 Prozent. In den 60 Stunden Alltag blieben sieben Fehlalarme, umgerechnet knapp einer pro acht Stunden. Das neuronale Netz erkannte 226 Stürze, kam dafür auf 19 Fehlalarme und damit auf gut zweieinhalb pro Nachtschicht. Für die Station wäre die zweite Variante trotz der besseren Trefferquote die schlechtere gewesen, weil sie die vereinbarte Schwelle reißt."}]}'),
	('7e570011-0000-4000-8000-000000000002', 13, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein Teil der Arbeit ist ein Misserfolg, und der steckt im Aufbau. Stürze auf der Bettseite zur Wand lagen im Schatten des Bettrahmens: Von 30 Versuchen dort meldete der Random Forest zwölf, das neuronale Netz achtzehn. Außerhalb dieser Ecke blieben beim Random Forest nur vier Stürze unerkannt, fast der gesamte Fehler sitzt also an einer Stelle des Zimmers. Ein zweiter Sensor an der gegenüberliegenden Wand hätte das vermutlich aufgelöst, die verbliebenen Wochen reichten dafür nicht. Wer den Aufbau übernimmt, sollte von vornherein mit zwei Sensoren planen."}]}'),
	('7e570011-0000-4000-8000-000000000003', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Sturzerkennung im Wohnraum mit 60-GHz-Radar","index":0},{"level":2,"text":"Warum kein Kamerabild","index":1},{"level":2,"text":"Messreihe im möblierten Seminarraum","index":2},{"level":2,"text":"Ergebnisse und ein abgebrochener Teil","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000003', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Sturzerkennung im Wohnraum mit 60-GHz-Radar"}]}'),
	('7e570011-0000-4000-8000-000000000003', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000003","alt":"Titelbild des Projekts Sturzerkennung im Wohnraum mit 60-GHz-Radar","caption":"Bachelorarbeit über einen Radarsensor, der Stürze in einer Wohnung erkennt, ohne ein Bild aufzuzeichnen. Für die Auswertung wurden 240 Abläufe in einem möblierten Raum am Neustadtswall aufgenommen, d…","width":100}}'),
	('7e570011-0000-4000-8000-000000000003', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum kein Kamerabild"}]}'),
	('7e570011-0000-4000-8000-000000000003', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Wer über 80 ist und allein wohnt, liegt nach einem Sturz in der eigenen Wohnung oft stundenlang, bevor jemand nachsieht. Kamerabasierte Systeme lösen das technisch, scheitern aber an der Akzeptanz. In einer Vorbefragung in einem Begegnungszentrum in Walle lehnten 17 von 22 Befragten eine Kamera im Wohnzimmer ab; einen Sensor ohne Bildaufzeichnung hielten dagegen 14 für vorstellbar."}]}'),
	('7e570011-0000-4000-8000-000000000003', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit prüft, ob ein handelsübliches Radarmodul für diesen Zweck ausreicht. Es arbeitet zwischen 60 und 64 Gigahertz und liefert kein Bild, sondern je Messzyklus eine Liste von Reflexionspunkten mit Entfernung, Winkel, Radialgeschwindigkeit und Signalstärke. Daraus lässt sich ablesen, dass ein Körper zu Boden gegangen ist, nicht aber, wer dort liegt oder wie diese Person aussieht."}]}'),
	('7e570011-0000-4000-8000-000000000003', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Messreihe im möblierten Seminarraum"}]}'),
	('7e570011-0000-4000-8000-000000000003', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein Seminarraum am Neustadtswall wurde für vier Termine als Wohnzimmer eingerichtet, mit Sofa, Couchtisch, Teppich und einem Sideboard aus dem Fundus der Werkstatt. Sechs Freiwillige spielten insgesamt 240 Abläufe nach. Parallel lief eine Kamera, allein um die Radardaten hinterher richtig kennzeichnen zu können. Die Videodateien lagen auf einem verschlüsselten Laufwerk und wurden nach der Auswertung gelöscht, was den Freiwilligen vorher schriftlich zugesichert worden war."}]}'),
	('7e570011-0000-4000-8000-000000000003', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"120 Stürze in vier Varianten: nach vorn, zur Seite, aus dem Sitzen und rückwärts gegen die Wand"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"120 Gegenbeispiele wie Hinsetzen, Bücken nach einem heruntergefallenen Stift oder Hinlegen auf den Teppich"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sensormontage auf 1,10 Meter, auf 1,80 Meter und an der Decke"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwei Störquellen im Raum: ein laufender Ventilator und eine zweite Person"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000003', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse und ein abgebrochener Teil"}]}'),
	('7e570011-0000-4000-8000-000000000003', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein bewusst einfacher Klassifikator, der nur die maximale Abwärtsgeschwindigkeit und die Höhe des Reflexionsschwerpunkts auswertet, erkannte 112 der 120 Stürze. Sechs Fehlalarme entstanden, fünf davon beim schnellen Hinlegen auf den Teppich. Sobald der Ventilator lief, fiel die Trefferquote auf 84 Prozent: die rotierenden Blätter erzeugen dieselben Geschwindigkeitsanteile wie ein fallender Körper. Eine Filterung über die zeitliche Konstanz der Störquelle half, reichte aber nicht aus."}]}'),
	('7e570011-0000-4000-8000-000000000003', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der zweite geplante Teil, die Unterscheidung zwischen einem Sturz mit und ohne anschließende Eigenbewegung, kam nicht zustande. Die Aufnahmedauer von 15 Sekunden je Ablauf war zu knapp angesetzt, und eine Wiederholung der Messreihe passte nicht mehr in den Bearbeitungszeitraum. Der Punkt steht als Vorschlag für eine Folgearbeit im Ausblick."}]}'),
	('7e570011-0000-4000-8000-000000000003', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Solange das Gerät nur Punkte sieht und kein Bild aufnimmt, würde ich es meiner Mutter ins Wohnzimmer stellen. Eine Kamera käme dort nicht hinein."}]}]}'),
	('7e570011-0000-4000-8000-000000000004', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Anomalieerkennung in OCPP-Daten von Ladesäulen","index":0},{"level":2,"text":"Störungen fallen erst am leeren Akku auf","index":1},{"level":2,"text":"Datensatz und Vorgehen","index":2},{"level":2,"text":"Ergebnisse und was offen bleibt","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000004', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Anomalieerkennung in OCPP-Daten von Ladesäulen"}]}'),
	('7e570011-0000-4000-8000-000000000004', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000004","alt":"Titelbild des Projekts Anomalieerkennung in OCPP-Daten von Ladesäulen","caption":"Bachelorarbeit über die Erkennung von Störungen an öffentlichen Ladesäulen aus OCPP-Protokolldaten. Ausgewertet wurden 14 Monate Betriebsdaten von 46 Bremer Ladepunkten mit zwei Verfahren zur Anomali…","width":100}}'),
	('7e570011-0000-4000-8000-000000000004', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Störungen fallen erst am leeren Akku auf"}]}'),
	('7e570011-0000-4000-8000-000000000004', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein Ladepunkt meldet selten von sich aus, dass er nicht mehr lädt. Der Betreiber erfährt davon meist über die Störungshotline, also erst dann, wenn jemand mit leerem Akku davorsteht und anruft. Für diese Arbeit stellte ein Bremer Betreiber die Backend-Daten von 46 öffentlichen Ladepunkten im Stadtgebiet zur Verfügung, aufgezeichnet zwischen Januar 2024 und Februar 2025. Darin stehen die Nachrichten des Protokolls OCPP 1.6J: Statuswechsel, Messwerte, Fehlercodes und abgebrochene Ladevorgänge. Die Frage lautete, ob sich ein Ausfall aus diesem Verkehr erkennen lässt, bevor die erste Beschwerde eingeht."}]}'),
	('7e570011-0000-4000-8000-000000000004', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Reiz der Fragestellung liegt darin, dass keine zusätzliche Hardware nötig wäre. Die Daten fallen ohnehin an, weil jede Säule ihren Zustand ins Backend meldet; genutzt wurden sie bisher vor allem für die Abrechnung. Die Arbeit entstand im Wintersemester 2025/26 am Neustadtswall, betreut vom Labor für Automatisierungstechnik. Der Betreiber blieb über die gesamte Zeit ansprechbar und lieferte auf Nachfrage die Ticketliste des Bereitschaftsdienstes nach."}]}'),
	('7e570011-0000-4000-8000-000000000004', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Datensatz und Vorgehen"}]}'),
	('7e570011-0000-4000-8000-000000000004', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aus dem Rohbestand entstand zunächst je Ladepunkt eine bereinigte Zeitreihe im Fünf-Minuten-Raster. Als Störung galt ein Zeitraum, in dem der Ladepunkt laut Ticket des Bereitschaftsdienstes außer Betrieb war; diese Tickets dienten als Vergleichsmaßstab. Gegeneinander geprüft wurden ein Regelwerk aus fünf Schwellwerten und ein Isolation Forest auf 18 abgeleiteten Merkmalen, darunter Ladeleistung, Dauer bis zum Abbruch und Häufigkeit der Statuswechsel. Beide Verfahren liefen offline auf einem Laborrechner. Der Anschluss an das Livesystem des Betreibers war ausdrücklich nicht Teil der Arbeit."}]}'),
	('7e570011-0000-4000-8000-000000000004', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"3,1 Millionen OCPP-Nachrichten aus 14 Monaten Betrieb"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"46 Ladepunkte, davon 12 mit Gleichstromladung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"213 Störungstickets als Vergleichsmaßstab"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"zwei Verfahren: Schwellwertregeln und Isolation Forest"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000004', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse und was offen bleibt"}]}'),
	('7e570011-0000-4000-8000-000000000004', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das einfache Regelwerk erkannte 71 Prozent der Störungstickets und lag im Mittel 40 Minuten vor der telefonischen Meldung, bei etwa neun Fehlalarmen pro Woche über alle 46 Ladepunkte. Der Isolation Forest kam nur auf 64 Prozent und erzeugte dabei 31 Fehlalarme pro Woche, weil er den Wochenrhythmus der Standorte an der Werderstraße nie sauber gelernt hat: Montags früh sieht dort jede normale Lastspitze wie eine Anomalie aus. Für den Praxiseinsatz ist damit ausgerechnet das schlichtere Verfahren das brauchbare."}]}'),
	('7e570011-0000-4000-8000-000000000004', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Punkte bleiben ungeklärt. Die Zeitstempel der Tickets setzt der Bereitschaftsdienst von Hand, teils Stunden nach dem Anruf, sodass der gemessene Vorlauf eher zu günstig ausfällt. Und ob sich die Schwellwerte auf einen anderen Betreiber mit anderer Hardware übertragen lassen, war mit nur einem Datensatz nicht zu prüfen. Beides steht im Ausblick der Arbeit als nächster Schritt."}]}'),
	('7e570011-0000-4000-8000-000000000004', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Neun Fehlalarme pro Woche kann unser Bereitschaftsdienst tragen, einunddreißig nicht."}]}]}'),
	('7e570011-0000-4000-8000-000000000005', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Ausfallerkennung an Ladesäulen aus OCPP-Protokollen","index":0},{"level":2,"text":"Ausgangslage beim Betreiber","index":1},{"level":2,"text":"Merkmale aus den Protokollzeilen","index":2},{"level":2,"text":"Ergebnisse und was nicht funktioniert hat","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000005', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Ausfallerkennung an Ladesäulen aus OCPP-Protokollen"}]}'),
	('7e570011-0000-4000-8000-000000000005', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000005","alt":"Titelbild des Projekts Ausfallerkennung an Ladesäulen aus OCPP-Protokollen","caption":"Bachelorarbeit zur Frage, ob sich defekte Ladesäulen an ihren OCPP-Protokollen erkennen lassen, bevor eine Störmeldung eingeht. Grundlage sind 14 Monate Betriebsdaten von 62 öffentlichen Ladepunkten…","width":100}}'),
	('7e570011-0000-4000-8000-000000000005', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage beim Betreiber"}]}'),
	('7e570011-0000-4000-8000-000000000005', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Betreiber, mit dem die Arbeit entstand, unterhält 62 öffentliche Ladepunkte im Bremer Stadtgebiet, verteilt über die Neustadt, Findorff und die Airport-Stadt. Störungen fallen dort meist erst auf, wenn jemand anruft und meldet, dass die Säule den Ladevorgang abbricht. Bis eine Technikerin vor Ort ist, vergehen im Mittel drei Tage. In dieser Zeit steht der Ladepunkt in der App weiterhin als verfügbar."}]}'),
	('7e570011-0000-4000-8000-000000000005', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gleichzeitig schickt jede Säule minütlich Statusmeldungen an das Backend, im Protokoll OCPP 1.6J. Diese Meldungen werden bislang gespeichert, aber nicht ausgewertet. Die Arbeit prüft, ob sich aus ihnen ein Hinweis auf einen bevorstehenden Ausfall ziehen lässt, und zwar früh genug, dass die Disposition den Einsatz mit einer ohnehin geplanten Wartungsfahrt bündeln kann. Der Datensatz umfasst 14 Monate und rund 41 Millionen Protokollzeilen."}]}'),
	('7e570011-0000-4000-8000-000000000005', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Merkmale aus den Protokollzeilen"}]}'),
	('7e570011-0000-4000-8000-000000000005', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aus den Rohzeilen entstanden je Ladepunkt und Stunde 18 Merkmale, darunter die Zahl abgebrochener Transaktionen, die Dauer bis zur Freigabe nach dem Kartenkontakt und die Häufigkeit des Statuswechsels nach Faulted. Als Zielgröße diente das Ticketsystem der Werkstatt: Ein Ladepunkt gilt als auffällig, wenn innerhalb der folgenden 72 Stunden ein Störungsticket eröffnet wurde. Verglichen wurden ein Entscheidungsbaum, ein Gradient-Boosting-Modell und eine einfache Schwellwertregel."}]}'),
	('7e570011-0000-4000-8000-000000000005', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"OCPP-Statusmeldungen aus 14 Monaten, rund 41 Millionen Zeilen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"18 Merkmale je Ladepunkt und Betriebsstunde"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zielgröße aus 214 Störungstickets der Werkstatt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Trainings- und Testzeitraum zeitlich getrennt, nicht zufällig gezogen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bewertung über Precision und Recall statt über die Trefferquote"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000005', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse und was nicht funktioniert hat"}]}'),
	('7e570011-0000-4000-8000-000000000005', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Gradient-Boosting-Modell erkennt 71 Prozent der Störungen im Testzeitraum, bei einer Präzision von 44 Prozent. Auf 62 Ladepunkte hochgerechnet sind das etwa vier Fehlalarme pro Woche. Für die Disposition ist das nach Auskunft des Betreibers vertretbar, solange die Meldung in der bestehenden Wochenplanung auftaucht und keinen Sondereinsatz auslöst. Die einfache Schwellwertregel kam auf 52 Prozent Recall und ist dafür deutlich leichter zu erklären."}]}'),
	('7e570011-0000-4000-8000-000000000005', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Nicht funktioniert hat die Vorhersage für die sechs Schnellladepunkte an der Flughafenallee. Sie laufen mit einer anderen Firmware, protokollieren Fehlercodes abweichend und waren mit 19 Tickets im Datensatz unterrepräsentiert. Ein eigenes Modell für diese Gruppe scheiterte an der Datenmenge. Für die übrigen Ladepunkte bleibt offen, ob das Modell nach einem Firmware-Update noch trägt. Der Betreiber hat zugesagt, den Testlauf ein weiteres Jahr mitzuschreiben."}]}'),
	('7e570011-0000-4000-8000-000000000005', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Dass die Säule an der Hemmstraße Ärger macht, wussten wir. Dass die Protokolle das zwei Tage vorher hergeben, war neu für uns."}]}]}'),
	('7e570011-0000-4000-8000-000000000006', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Kameragestützte Radverkehrszählung am Osterdeich","index":0},{"level":2,"text":"Zählen, ohne Bilder zu speichern","index":1},{"level":2,"text":"Aufbau und Messwoche","index":2},{"level":2,"text":"Was die Zählung hergibt und wo sie aufhört","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000006', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Kameragestützte Radverkehrszählung am Osterdeich"}]}'),
	('7e570011-0000-4000-8000-000000000006', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000006","alt":"Titelbild des Projekts Kameragestützte Radverkehrszählung am Osterdeich","caption":"Bachelorarbeit zur kameragestützten Radverkehrszählung: Ein Kleinrechner am Osterdeich zählte neun Tage lang Fahrräder, ohne ein einziges Bild zu speichern. Der Vergleich mit einer Handzählung zeigt…","width":100}}'),
	('7e570011-0000-4000-8000-000000000006', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Zählen, ohne Bilder zu speichern"}]}'),
	('7e570011-0000-4000-8000-000000000006', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Wie viele Menschen mit dem Rad über den Osterdeich fahren, weiß die Verkehrsbehörde nur aus Stichproben. Im Stadtgebiet stehen wenige Dauerzählstellen, der Rest wird von Hand gezählt, meist an einem trockenen Werktag im Frühjahr. Eine Kamera würde diese Lücke schließen, wirft aber sofort die Frage auf, was mit den Bildern geschieht. Genau dort setzt die Bachelorarbeit an."}]}'),
	('7e570011-0000-4000-8000-000000000006', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Geprüft wurde ein Aufbau, bei dem die Auswertung vollständig auf dem Gerät am Mast läuft. Das Bild wird nach der Erkennung verworfen, gespeichert werden nur die Fahrtrichtung und ein Zeitstempel. Die Datenschutzbeauftragte der Hochschule hat den Aufbau vor dem Aufstellen gesehen, und ohne diese Zusage wäre der Standort auf öffentlichem Grund nicht genehmigt worden."}]}'),
	('7e570011-0000-4000-8000-000000000006', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau und Messwoche"}]}'),
	('7e570011-0000-4000-8000-000000000006', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Rechner hing in 3,2 Metern Höhe an einem Laternenmast, die Kamera zeigte schräg auf den Radweg in beiden Richtungen. Auf dem Gerät lief ein vortrainiertes Erkennungsmodell mit einer einfachen Objektverfolgung, die jedes Rad beim Überqueren einer gedachten Linie einmal zählt. Die Verarbeitung schaffte 21 Bilder je Sekunde, was bei den gefahrenen Geschwindigkeiten ausreichte und ohne zusätzliche Rechenbeschleunigung auskam."}]}'),
	('7e570011-0000-4000-8000-000000000006', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aufgestellt wurde der Mastkasten Anfang November 2025, nach zwei Vorversuchen auf dem Gelände am Neustadtswall. Die Vorversuche waren nötig, weil der erste Blickwinkel den Gehweg mit erfasste und Fußgängerinnen mitgezählt wurden. Erst die dritte Ausrichtung lieferte einen Ausschnitt, in dem nur der Radweg lag."}]}'),
	('7e570011-0000-4000-8000-000000000006', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Neun Messtage im November 2025, jeweils von 6 bis 22 Uhr"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"38.400 gezählte Fahrräder, getrennt nach Fahrtrichtung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs Stunden Handzählung vor Ort als Referenz, verteilt auf drei Tage"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Erkennung und Zählung auf dem Gerät, ohne Speicherung von Bildmaterial"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Protokoll zu Regen und Dämmerung für jede Messstunde"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000006', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Zählung hergibt und wo sie aufhört"}]}'),
	('7e570011-0000-4000-8000-000000000006', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Bei Tageslicht und trockener Fahrbahn lag die maschinelle Zählung 4 Prozent unter der Handzählung, was für die Verkehrsplanung ausreicht. In der Dämmerung und bei Regen wuchs die Abweichung auf 19 Prozent, und zwar immer in dieselbe Richtung: Es wurden zu wenige Räder erfasst. Zwei nebeneinander fahrende Räder erkannte das Modell häufig als eines, ein Anhänger dagegen wurde gelegentlich als zweites Rad gezählt."}]}'),
	('7e570011-0000-4000-8000-000000000006', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Punkte sind offen geblieben. Die geplante Unterscheidung zwischen Fahrrad und Pedelec ließ sich aus dem Bild nicht zuverlässig ableiten und wurde nach zwei Wochen aufgegeben. Die Stromversorgung über ein kleines Solarmodul reichte im November ebenfalls nicht: Ab dem vierten Tag lief der Rechner an einer Powerbank, die jeden Morgen getauscht werden musste. Für einen Dauerbetrieb wäre das die erste Baustelle."}]}'),
	('7e570011-0000-4000-8000-000000000006', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Für die Planung reicht uns eine Zahl je Stunde. Was wir nicht gebrauchen können, ist ein Kamerabild, das irgendwo liegen bleibt."}]}]}'),
	('7e570011-0000-4000-8000-000000000007', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Baustoffbörse am Neustadtswall","index":0},{"level":2,"text":"Wie die Börse entstand","index":1},{"level":2,"text":"Was im Regal liegt","index":2},{"level":2,"text":"Was nicht funktioniert hat","index":3},{"level":2,"text":"Wie es weitergeht","index":4}]}}'),
	('7e570011-0000-4000-8000-000000000007', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Baustoffbörse am Neustadtswall"}]}'),
	('7e570011-0000-4000-8000-000000000007', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000007","alt":"Titelbild des Projekts Baustoffbörse am Neustadtswall","caption":"Die Baustoffbörse vermittelt Restmaterial aus den Werkstätten und von Baustellen im Bremer Westen an studentische Projekte. Ende Januar 2026 lagerten 41 Posten in einem Kellerraum am Neustadtswall, e…","width":100}}'),
	('7e570011-0000-4000-8000-000000000007', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wie die Börse entstand"}]}'),
	('7e570011-0000-4000-8000-000000000007', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Sommersemester 2025 blieb beim Modellbau für den Entwurfskurs so viel Verschnitt liegen, dass zwei Container Restholz abgefahren wurden. Drei Studierende aus dem sechsten Semester fragten den Werkstattleiter, ob sich brauchbare Stücke zwischenlagern lassen. Daraus wurde die Baustoffbörse: ein Kellerraum im Gebäude am Neustadtswall, Regale aus alten Palettenrahmen und eine Liste, in die jeder Posten mit Maßen und einem Foto eingetragen wird."}]}'),
	('7e570011-0000-4000-8000-000000000007', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Seit November 2025 liefern zwei Handwerksbetriebe aus dem Bremer Westen ihre Reste an, meist Gipskartonplatten, Dämmstreifen und kurze Kanthölzer. Die Annahme ist auf den Dienstagnachmittag beschränkt, weil sonst niemand im Keller steht, der das Material aufnimmt. Wer etwas mitnimmt, trägt sich in dieselbe Liste ein und schreibt dazu, wofür er es braucht."}]}'),
	('7e570011-0000-4000-8000-000000000007', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was im Regal liegt"}]}'),
	('7e570011-0000-4000-8000-000000000007', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ende Januar 2026 waren 41 Posten erfasst, zusammen etwa 1,9 Tonnen. Der größte Teil davon ist Holz aus dem Modellbau, das für kleine Möbel und Ausstellungsaufbauten taugt. Dämmstoffe nehmen wir nur ungeöffnet an, weil angebrochene Rollen sich schlecht lagern und nach ein paar Wochen doch im Müll landen. Vier Posten stehen seit dem ersten Tag unverändert im Regal."}]}'),
	('7e570011-0000-4000-8000-000000000007', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sperrholzreste in fünf Stärken, überwiegend Pappel und Birke"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kanthölzer bis 80 Zentimeter Länge, sortiert nach Querschnitt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gipskartonplatten aus einem Büroumbau in der Airport-Stadt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Beschläge und Schrauben in beschrifteten Kisten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Linoleumreste, die bisher niemand abgeholt hat"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000007', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was nicht funktioniert hat"}]}'),
	('7e570011-0000-4000-8000-000000000007', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Liste lief zuerst als Tabelle in einer Cloud, in die alle schreiben durften. Nach sechs Wochen stimmten die Bestände nicht mehr: Material war abgeholt worden, ohne dass jemand eine Zeile geändert hatte. Seit Dezember hängt stattdessen ein Klemmbrett an der Tür, und die Tabelle wird einmal pro Woche daraus nachgetragen. Das ist umständlicher, dafür stimmt der Bestand wieder."}]}'),
	('7e570011-0000-4000-8000-000000000007', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Solange man für einen Eintrag das Handy entsperren und sich anmelden muss, nimmt man das Brett einfach mit und schreibt nichts auf."}]}]}'),
	('7e570011-0000-4000-8000-000000000007', 12, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wie es weitergeht"}]}'),
	('7e570011-0000-4000-8000-000000000007', 13, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für das Sommersemester 2026 ist die Börse an den Werkstattbetrieb angebunden: Verschnitt aus dem Modellbau geht nicht mehr in den Container, sondern zuerst ins Regal. Offen ist die Frage der Haftung, wenn gespendetes Material in einem Prüfungsentwurf verbaut wird und später Mängel zeigt. Dazu läuft eine Anfrage beim Justiziariat, eine Antwort steht seit Anfang Februar aus."}]}'),
	('7e570011-0000-4000-8000-000000000008', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Wohnberatung im Quartier Gröpelingen","index":0},{"level":2,"text":"Ausgangslage im Stadtteil","index":1},{"level":2,"text":"Vorgehen bei den Hausbesuchen","index":2},{"level":2,"text":"Was nicht funktioniert hat","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000008', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Wohnberatung im Quartier Gröpelingen"}]}'),
	('7e570011-0000-4000-8000-000000000008', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000008","alt":"Titelbild des Projekts Wohnberatung im Quartier Gröpelingen","caption":"Eine Untersuchung zur aufsuchenden Wohnberatung für ältere Menschen in Bremen-Gröpelingen. 34 Hausbesuche zeigen, warum die Angebote im Quartier oft nicht ankommen und welche Wege zwischen Pflegestüt…","width":100}}'),
	('7e570011-0000-4000-8000-000000000008', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage im Stadtteil"}]}'),
	('7e570011-0000-4000-8000-000000000008', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In Gröpelingen leben rund 5.800 Menschen über 65 Jahre, ein knappes Viertel davon in Wohnungen ohne Aufzug. Die Wohnberatung des Landes richtet sich an genau diese Gruppe, erreicht sie aber kaum. Im Jahr 2024 kamen aus dem Stadtteil 41 Anfragen, aus dem etwa gleich großen Schwachhausen dagegen 96. Diese Lücke war der Anlass für die Arbeit, die im Sommersemester 2026 als Wettbewerbsbeitrag entstanden ist."}]}'),
	('7e570011-0000-4000-8000-000000000008', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die naheliegende Erklärung, es fehle an Information, trägt nur zum Teil. Der Pflegestützpunkt verteilt seit Jahren Flyer über Hausärzte und Apotheken. In den Vorgesprächen mit vier Mitarbeiterinnen des Dienstleistungszentrums zeigte sich ein anderes Muster: Wer eine Beratung anfragt, rechnet mit Kosten, mit Behördenpost oder mit dem Verlust der Wohnung. Die Hürde liegt also nicht vor der Information, sondern dahinter."}]}'),
	('7e570011-0000-4000-8000-000000000008', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorgehen bei den Hausbesuchen"}]}'),
	('7e570011-0000-4000-8000-000000000008', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen März und Juni 2026 fanden 34 Hausbesuche statt, vermittelt über zwei Seniorentreffs und den Sozialdienst einer Wohnungsgesellschaft. Jeder Besuch dauerte zwischen 40 und 90 Minuten und folgte einem Leitfaden mit acht Fragen, ergänzt um eine kurze Begehung der Wohnung. Aufgezeichnet wurde nur mit schriftlicher Einwilligung, was in 27 Fällen vorlag. Die übrigen sieben Gespräche wurden unmittelbar im Anschluss protokolliert."}]}'),
	('7e570011-0000-4000-8000-000000000008', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"34 Hausbesuche in drei Ortsteilen, davon 22 im Ortsteil Ohlenhof"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Leitfadeninterviews von 40 bis 90 Minuten, 27 davon aufgezeichnet"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Begehungsprotokoll mit 14 Merkmalen, etwa Schwellenhöhe und Lage der Lichtschalter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwölf Wochen Feldphase, Auswertung nach qualitativer Inhaltsanalyse"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000008', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was nicht funktioniert hat"}]}'),
	('7e570011-0000-4000-8000-000000000008', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der ursprüngliche Plan sah vor, die Kontakte über Hausärzte herzustellen. Von elf angeschriebenen Praxen antworteten zwei, eine davon abschlägig. Nach fünf Wochen ohne Zugang wurde dieser Weg aufgegeben und über die Seniorentreffs neu aufgesetzt, was den Zeitplan um gut einen Monat verschoben hat. Auch der Fragebogen zur Wohnzufriedenheit erwies sich als unbrauchbar: Zu viele Felder blieben leer, weil die Skala von eins bis sechs an Schulnoten erinnerte."}]}'),
	('7e570011-0000-4000-8000-000000000008', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Deutlicher als die Zahlen war der Ton der Gespräche. Mehrfach kam die Sorge zur Sprache, eine Beratung könne aktenkundig werden und am Ende zu der Aufforderung führen, die Wohnung zu wechseln. Wer diese Sorge hat, ruft nicht an, unabhängig davon, wie gut der Flyer gestaltet ist."}]}'),
	('7e570011-0000-4000-8000-000000000008', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wenn ich da anrufe, wissen die alles über mich. Und dann heißt es, die Wohnung ist zu groß für eine allein."}]}]}'),
	('7e570011-0000-4000-8000-000000000009', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Betriebsdatenerfassung in einem Schiffbauzulieferbetrieb","index":0},{"level":2,"text":"Ausgangslage im Betrieb","index":1},{"level":2,"text":"Vorgehen und Erhebung","index":2},{"level":2,"text":"Was nach vier Wochen passierte","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000009', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Betriebsdatenerfassung in einem Schiffbauzulieferbetrieb"}]}'),
	('7e570011-0000-4000-8000-000000000009', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000009","alt":"Titelbild des Projekts Betriebsdatenerfassung in einem Schiffbauzulieferbetrieb","caption":"Ein mittelständischer Zulieferer für den Schiffbau in Bremen-Nord führt eine Betriebsdatenerfassung ein. Die Arbeit begleitet die Einführung an zwei Montagelinien und fragt, warum die Terminals nach…","width":100}}'),
	('7e570011-0000-4000-8000-000000000009', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage im Betrieb"}]}'),
	('7e570011-0000-4000-8000-000000000009', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Betrieb fertigt Rohrleitungsbaugruppen für Werften an der Unterweser und beschäftigt 84 Personen. Rückmeldungen aus der Fertigung liefen bis Herbst 2024 über Laufzettel, die abends im Meisterbüro abgeheftet wurden. Wie lange eine Baugruppe tatsächlich in der Schweißkabine stand, ließ sich erst Wochen später rekonstruieren, und auch dann nur ungefähr. Die Geschäftsführung wollte belastbare Zahlen für die Angebotskalkulation, die Fertigung wollte vor allem weniger Papier."}]}'),
	('7e570011-0000-4000-8000-000000000009', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit entstand berufsbegleitend und hatte einen doppelten Auftrag: den Einführungsprozess fachlich zu begleiten und ihn zugleich zu untersuchen. Beides in einer Person zu vereinen war unbequem. Wer die Terminals mit aufgestellt hat, bekommt von den Beschäftigten selten offene Kritik zu hören. Für die Interviews wurde deshalb ein Kollege aus dem Qualitätswesen hinzugezogen, der die Gespräche allein führte und die Protokolle anonymisiert weitergab."}]}'),
	('7e570011-0000-4000-8000-000000000009', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorgehen und Erhebung"}]}'),
	('7e570011-0000-4000-8000-000000000009', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen Oktober 2024 und Februar 2025 wurden zwei Montagelinien mit je einem Terminal ausgestattet. Die Software kam von einem regionalen Anbieter und war bewusst schmal gehalten: Auftrag scannen, Tätigkeit wählen, fertig. Vor der Installation wurden 14 Arbeitsplätze über eine Woche beobachtet, danach folgten zwölf Interviews mit Beschäftigten und Meistern. Die Rückmeldequote der Terminals wurde täglich ausgelesen und gegen die Auftragsliste gehalten."}]}'),
	('7e570011-0000-4000-8000-000000000009', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Beobachtung an 14 Arbeitsplätzen über fünf Schichten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwölf leitfadengestützte Interviews, geführt von einer unbeteiligten Person"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Tägliche Auswertung der Rückmeldequote je Terminal"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Abgleich der erfassten Zeiten mit den Laufzetteln derselben Aufträge"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000009', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was nach vier Wochen passierte"}]}'),
	('7e570011-0000-4000-8000-000000000009', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Rückmeldequote lag in Woche eins bei 91 Prozent und fiel bis Woche vier auf 38 Prozent. An der Software lag es nicht. An Linie zwei stand das Terminal elf Meter vom Arbeitsplatz entfernt hinter einem Regal, weil dort die einzige freie Netzwerkdose sitzt. Wer zwischen zwei Schweißnähten kurz zurückmeldet, läuft diesen Weg nicht. An Linie eins, wo das Terminal in Griffweite hängt, blieb die Quote über 80 Prozent."}]}'),
	('7e570011-0000-4000-8000-000000000009', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit empfiehlt deshalb, die Platzierung der Erfassungspunkte vor der Softwareauswahl zu klären und die Netzwerkverkabelung als Teil des Projektbudgets zu führen. Was als IT-Vorhaben begann, scheiterte an elf Metern Laufweg. Nachgerüstet wurde im März 2025 ein zweiter Zugangspunkt für 1.400 Euro, danach lag die Quote an Linie zwei im April wieder bei 76 Prozent."}]}'),
	('7e570011-0000-4000-8000-000000000009', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich schweiße nicht schlechter, weil ich nicht zurückmelde. Aber ich laufe auch nicht dreimal pro Stunde um das Regal herum."}]}]}'),
	('7e570011-0000-4000-8000-000000000010', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Serrationen am Rotorblatt im Windkanal","index":0},{"level":2,"text":"Vorbild Eulenfeder","index":1},{"level":2,"text":"Aufbau im Windkanal","index":2},{"level":2,"text":"Ergebnisse und Grenzen","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000010', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Serrationen am Rotorblatt im Windkanal"}]}'),
	('7e570011-0000-4000-8000-000000000010', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000010","alt":"Titelbild des Projekts Serrationen am Rotorblatt im Windkanal","caption":"Gezackte Hinterkanten nach dem Vorbild der Eulenfeder sollen Rotorblätter leiser machen. Wir haben vier Serrationsformen an einem Modellblatt im Windkanal am Neustadtswall vermessen: 42 Messreihen zu…","width":100}}'),
	('7e570011-0000-4000-8000-000000000010', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorbild Eulenfeder"}]}'),
	('7e570011-0000-4000-8000-000000000010', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Eulen fliegen leise, und einer der Gründe dafür sind die kammartigen Fortsätze an der Vorderkante ihrer Handschwingen. In der Windenergie wird ein verwandtes Prinzip seit Jahren an der Hinterkante von Rotorblättern eingesetzt, meist als aufgeklebte Zackenleiste. Belastbare Vergleichszahlen sind kaum öffentlich zugänglich, weil die Hersteller ihre Geometrien nicht veröffentlichen. Unser Forschungsprojekt sollte deshalb keine neue Form erfinden, sondern vier bereits beschriebene Zackengeometrien unter identischen Bedingungen messen und vergleichbar machen."}]}'),
	('7e570011-0000-4000-8000-000000000010', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Aufwand lag weniger im Versuchsplan als in der Wiederholbarkeit. Ein Unterschied von zwei Dezibel verschwindet in der Streuung, sobald die Halterung mitschwingt oder die Hallentemperatur über den Nachmittag um vier Grad steigt. Wir haben deshalb die ersten drei Wochen ausschließlich mit der leeren Messstrecke gearbeitet und den Grundgeräuschpegel bei jeder Geschwindigkeit dokumentiert, bevor überhaupt ein Blatt eingebaut wurde."}]}'),
	('7e570011-0000-4000-8000-000000000010', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau im Windkanal"}]}'),
	('7e570011-0000-4000-8000-000000000010', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gemessen wurde im offenen Windkanal am Neustadtswall. Das Modellblatt hat ein NACA-0012-Profil mit 200 Millimetern Sehnenlänge und 500 Millimetern Spannweite, gedruckt aus PLA, danach gespachtelt und geschliffen, weil die Schichtstruktur des Drucks im Vorversuch selbst hörbar war. Die Zacken wurden gesteckt und nicht geklebt: Eine Kleberaupe an der Hinterkante erzeugte mehr Zusatzgeräusch, als die Zacken einsparen sollten."}]}'),
	('7e570011-0000-4000-8000-000000000010', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Kalibriert wurde vor jedem Messtag mit einem Pistonphon, die Anströmgeschwindigkeit über ein Prandtl-Rohr. Alle Rohdaten liegen als WAV-Dateien mit 48 Kilohertz vor, dazu ein Protokoll mit Temperatur, Luftdruck und Uhrzeit jeder einzelnen Reihe. Erst dieses Protokoll macht nachvollziehbar, welche Messung zu welcher gehört."}]}'),
	('7e570011-0000-4000-8000-000000000010', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Modellblatt NACA 0012, Sehnenlänge 200 mm, Spannweite 500 mm"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vier Zackengeometrien mit 10, 20, 30 und 40 mm Zackenhöhe plus eine glatte Referenzhinterkante"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Acht Messmikrofone im Halbkreis, 1,2 m von der Hinterkante entfernt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"30 Reihen bei 4 Grad Anstellwinkel: fünf Hinterkanten an sechs Geschwindigkeiten zwischen 12 und 28 m/s, jede dreimal gefahren"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"12 weitere Reihen bei 0 und 8 Grad, nur an der 20- und der 30-Millimeter-Variante"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000010', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse und Grenzen"}]}'),
	('7e570011-0000-4000-8000-000000000010', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die deutlichste Minderung brachten Zacken von 30 Millimetern Höhe: bei 20 Metern pro Sekunde und vier Grad Anstellwinkel 3,4 dB(A) im Band zwischen einem und vier Kilohertz. Die 40-Millimeter-Variante war nicht leiser, kostete aber rund zwei Prozent Auftrieb. Bei 12 Metern pro Sekunde lagen alle vier Geometrien innerhalb der Streuung der Wiederholungen, dort lässt sich aus unseren Daten nichts behaupten."}]}'),
	('7e570011-0000-4000-8000-000000000010', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Acht der 42 Reihen sind unbrauchbar. Bei 26 Metern pro Sekunde geriet die Halterung in Resonanz und legte einen schmalen Peak bei 780 Hertz über die Messung, was erst bei der Auswertung auffiel. Die zweite gedruckte Zackenserie war um bis zu 0,6 Millimeter verzogen und musste neu gefertigt werden. Das hat zwei Termine im Kanal gekostet, die am Ende für die Messungen zum Anstellwinkel fehlten."}]}'),
	('7e570011-0000-4000-8000-000000000010', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Zacken bringen genau so lange etwas, wie der übrige Aufbau leiser ist als sie."}]}]}'),
	('7e570011-0000-4000-8000-000000000011', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Konfigurator statt Katalog im Fahrradhandel","index":0},{"level":2,"text":"Ausgangslage im Laden","index":1},{"level":2,"text":"Was die Protokolldaten zeigen","index":2},{"level":2,"text":"Grenzen und offene Punkte","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000011', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Konfigurator statt Katalog im Fahrradhandel"}]}'),
	('7e570011-0000-4000-8000-000000000011', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000011","alt":"Titelbild des Projekts Konfigurator statt Katalog im Fahrradhandel","caption":"Ein Bremer Fahrradhändler hat seinen Papierkatalog durch einen Online-Konfigurator ersetzt. Die Arbeit wertet 4.812 Konfigurationsvorgänge aus und fragt, an welcher Stelle Kundinnen und Kunden abbrec…","width":100}}'),
	('7e570011-0000-4000-8000-000000000011', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage im Laden"}]}'),
	('7e570011-0000-4000-8000-000000000011', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Händler betreibt zwei Filialen in Bremen, eine in der Neustadt und eine in Findorff. Bis zum Frühjahr 2025 lief die Beratung über einen gedruckten Katalog mit 140 Seiten, ergänzt um handschriftliche Notizzettel an der Theke. Im April 2025 ging ein Online-Konfigurator live, mit dem sich Rahmengröße, Schaltung, Bremsen und Zubehör selbst zusammenstellen lassen. Die Geschäftsführung erwartete davon vor allem eine Entlastung der Verkaufsfläche an Samstagen."}]}'),
	('7e570011-0000-4000-8000-000000000011', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Arbeit standen die Serverprotokolle von April bis November 2025 zur Verfügung, dazu vierzehn Interviews mit Personen, die den Konfigurator genutzt, aber nicht bestellt hatten. Die Gespräche fanden in der Filiale statt und dauerten zwischen elf und dreiundzwanzig Minuten. Personenbezogene Felder wurden vor der Auswertung entfernt. Die Zuordnung zwischen Protokoll und Interview bleibt deshalb grob und stützt sich nur auf Datum und Standort."}]}'),
	('7e570011-0000-4000-8000-000000000011', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Protokolldaten zeigen"}]}'),
	('7e570011-0000-4000-8000-000000000011', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Von 4.812 begonnenen Konfigurationen führten 393 zu einer Bestellung, weitere 511 endeten mit einem Termin in der Filiale. Der größte Abbruchanteil liegt nicht am Ende des Vorgangs, sondern im zweiten Schritt bei der Wahl der Rahmengröße. Wer diesen Schritt übersprang, kehrte in 71 Prozent der Fälle nicht zurück. Die Vermutung der Geschäftsführung, der Preis sei der Hauptgrund, ließ sich nicht bestätigen: Die Preisanzeige erreichten überhaupt nur 38 Prozent der Sitzungen."}]}'),
	('7e570011-0000-4000-8000-000000000011', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rahmengröße: 2.196 Abbrüche, meist innerhalb der ersten neunzig Sekunden"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zubehörauswahl: 604 Abbrüche, häufig nach dem Öffnen der Vergleichsansicht"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Lieferzeit: 288 Abbrüche direkt nach Einblendung der Angabe von acht Wochen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zahlungsart: 141 Abbrüche, überwiegend bei fehlendem Rechnungskauf"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000011', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Grenzen und offene Punkte"}]}'),
	('7e570011-0000-4000-8000-000000000011', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Konfigurator ersetzt die Beratung nicht, er verschiebt sie. Die Interviews zeigen, dass kaum jemand die Rahmengröße ohne Probesitzen festlegen möchte, auch nicht mit Körpergrößentabelle. Ein Rechenweg über die Schrittlänge, den das Team im Juli ergänzte, half wenig: Die Abbruchquote an dieser Stelle sank von 47 auf 44 Prozent und lag im Oktober wieder bei 46 Prozent."}]}'),
	('7e570011-0000-4000-8000-000000000011', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Offen bleibt, wie sich die Terminbuchungen wirtschaftlich auswirken. Der Händler erfasst Abschlüsse in der Filiale bis heute im Kassensystem ohne Verweis auf den Konfigurator, und eine nachträgliche Verknüpfung war im Projektzeitraum nicht herzustellen. Die 511 Termine lassen sich deshalb nicht in Umsatz umrechnen. Damit steht die Frage, die der Auftraggeber ursprünglich gestellt hatte, am Ende der Arbeit unbeantwortet da."}]}'),
	('7e570011-0000-4000-8000-000000000011', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich weiß meine Schrittlänge nicht, und ich messe sie auch nicht im Wohnzimmer nach. Dafür komme ich doch in den Laden."}]}]}'),
	('7e570011-0000-4000-8000-000000000012', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Rückbaukataster für ein Bürogebäude in Findorff","index":0},{"level":2,"text":"Das Gebäude und die Aufgabe","index":1},{"level":2,"text":"Aufnahme vor Ort","index":2},{"level":2,"text":"Was sich rechnet und was nicht","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000012', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Rückbaukataster für ein Bürogebäude in Findorff"}]}'),
	('7e570011-0000-4000-8000-000000000012', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000012","alt":"Titelbild des Projekts Rückbaukataster für ein Bürogebäude in Findorff","caption":"Für ein Bürogebäude aus dem Jahr 1974 in Bremen-Findorff entstand ein Rückbaukataster: eine Aufnahme aller Bauteile, die sich bei einem Abriss wiederverwenden lassen. Der Bericht nennt die aufgenomme…","width":100}}'),
	('7e570011-0000-4000-8000-000000000012', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Das Gebäude und die Aufgabe"}]}'),
	('7e570011-0000-4000-8000-000000000012', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Haus steht in Findorff, stammt aus dem Jahr 1974, hat vier Geschosse und rund 2.100 Quadratmeter Nutzfläche. Die Eigentümerin, eine Bremer Wohnungsgesellschaft, prüft seit zwei Jahren, ob sich ein Umbau lohnt oder ob abgerissen wird. Für die Lehrveranstaltung im Sommersemester 2026 durften wir das Gebäude an vier Tagen begehen und aufnehmen, was bei einem Abriss anfallen würde. Bewohnt sind zu diesem Zeitpunkt noch zwei Büroeinheiten im Erdgeschoss."}]}'),
	('7e570011-0000-4000-8000-000000000012', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein Rückbaukataster hält mehr fest als Massen. Zu jedem Bauteil gehören der Zustand, die Einbausituation und die Frage, ob es sich zerstörungsfrei lösen lässt. Daran entscheidet sich der Wert: Eine Innentür, die beim Ausbau bricht, ist Abfall und kein Bauteil. Für Beton und Estrich konnten wir keine belastbare Aussage treffen, weil uns die Messtechnik für Schadstoffe fehlte und die Bestandsakte dazu schweigt."}]}'),
	('7e570011-0000-4000-8000-000000000012', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufnahme vor Ort"}]}'),
	('7e570011-0000-4000-8000-000000000012', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aufgenommen wurde mit Zollstock, Tablet und einer Tabelle, die wir vorher in der Übung entworfen hatten. Nach dem ersten Tag mussten wir sie umbauen. Die Spalte für den Zustand war als Schulnote gedacht, und drei Personen vergaben für dieselbe Tür drei verschiedene Noten. Ersetzt haben wir sie durch Ja-Nein-Fragen: Schließt das Schloss? Zeigt das Blatt einen Wasserschaden? Danach lagen unsere Aufnahmen deutlich näher beieinander."}]}'),
	('7e570011-0000-4000-8000-000000000012', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"128 Innentüren, davon 96 mit unbeschädigtem Türblatt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"410 Quadratmeter abgehängte Deckenplatten, laut Bestandsakte asbestfrei"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"74 Gussheizkörper aus dem Baujahr, alle mit sichtbarem Rost an den Anschlüssen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"22 Fensterelemente der Südfassade, Isolierverglasung von 1998"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"31 Arbeitsstunden zu dritt für die gesamte Aufnahme"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000012', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was sich rechnet und was nicht"}]}'),
	('7e570011-0000-4000-8000-000000000012', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Türen sind der einzige Posten, der sich nach unserer Rechnung trägt. Der Ausbau kostet knapp 18 Euro je Tür, ein Bauteilhändler in Oldenburg zahlt für vergleichbare Türen zwischen 40 und 60 Euro. Bei den Heizkörpern kippt die Rechnung: Ausbau und Transport kosten mehr, als der Schrottpreis einbringt, und für gebrauchte Gussheizkörper hat uns im Umkreis von 60 Kilometern niemand ein Angebot gemacht."}]}'),
	('7e570011-0000-4000-8000-000000000012', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Offen bleibt, was mit den Fensterelementen geschieht. Sie sind technisch in Ordnung, passen aber nur in eine Fassade mit demselben Raster. Unser Vorschlag an die Eigentümerin lautet deshalb, die Elemente erst auszubauen, wenn ein konkretes Zweitprojekt feststeht, und bis dahin die Halle im Hinterhof als Lager einzuplanen. Ohne diese Zwischenlagerung landen 22 brauchbare Elemente im Container."}]}'),
	('7e570011-0000-4000-8000-000000000012', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Türen kann ich Ihnen erst geben, wenn die letzte Mieterin ausgezogen ist. Alles andere können Sie ab morgen ausbauen."}]}]}'),
	('7e570011-0000-4000-8000-000000000013', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Mietschuldenberatung im Nachbarschaftstreff Gröpelingen","index":0},{"level":2,"text":"Warum eine eigene Sprechstunde","index":1},{"level":2,"text":"Ablauf und Fallzahlen","index":2},{"level":2,"text":"Grenzen des Angebots","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000013', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Mietschuldenberatung im Nachbarschaftstreff Gröpelingen"}]}'),
	('7e570011-0000-4000-8000-000000000013', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000013","alt":"Titelbild des Projekts Mietschuldenberatung im Nachbarschaftstreff Gröpelingen","caption":"Praxisprojekt der Sozialen Arbeit: eine offene Sprechstunde zu Mietschulden und Kündigungen im Bremer Westen. In einem Semester kamen 63 Ratsuchende in den Nachbarschaftstreff. Der Bericht beschreibt…","width":100}}'),
	('7e570011-0000-4000-8000-000000000013', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum eine eigene Sprechstunde"}]}'),
	('7e570011-0000-4000-8000-000000000013', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Nachbarschaftstreff an der Lindenhofstraße ist für viele Menschen im Bremer Westen die erste Adresse, wenn Post vom Vermieter kommt. Die anerkannte Schuldnerberatung hatte im Herbst 2024 Wartezeiten von neun bis elf Wochen. Wer eine fristlose Kündigung im Briefkasten hat, kann nicht neun Wochen warten: Die Zweimonatsfrist für die Schonfristzahlung läuft dann längst."}]}'),
	('7e570011-0000-4000-8000-000000000013', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Praxisprojekt sollte keine zweite Beratungsstelle aufbauen, sondern die Lücke davor schließen. Ziel war, Post zu sortieren und Fristen zu erkennen, damit die Fachberatung die dringenden Fälle schneller übernehmen kann. Die fachliche Rückbindung lief über eine Sozialarbeiterin des Trägers, die einmal wöchentlich für Rücksprachen zur Verfügung stand."}]}'),
	('7e570011-0000-4000-8000-000000000013', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ablauf und Fallzahlen"}]}'),
	('7e570011-0000-4000-8000-000000000013', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Sprechstunde lief von Oktober 2024 bis März 2025, dienstags von 15 bis 18 Uhr, ohne Anmeldung. In 21 Terminen kamen 63 Ratsuchende, 18 davon mehrfach. Der häufigste Anlass war eine Mahnung wegen einer Nebenkostennachzahlung, danach folgten Kündigungen wegen Zahlungsverzug. Sieben Fälle betrafen Räumungsklagen, bei denen die Frist bereits lief."}]}'),
	('7e570011-0000-4000-8000-000000000013', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Nach dem dritten Termin wurde der Ablauf schriftlich festgehalten, damit auch Vertretungen ihn anwenden konnten. Er hat sich über das Semester kaum verändert und steht am Ende des Berichts als Anlage. Wichtig war vor allem, dass niemand ohne einen konkreten nächsten Termin wieder ging."}]}'),
	('7e570011-0000-4000-8000-000000000013', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Post sichten und nach Fristen ordnen, die dringendste zuerst"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Prüfen, ob eine Übernahme der Mietschulden durch das Amt für Soziale Dienste in Betracht kommt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Den Vordruck für die Schonfristzahlung gemeinsam ausfüllen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bei laufender Räumungsklage sofort an die Fachberatung übergeben, mit Termin noch im Gespräch"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000013', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Grenzen des Angebots"}]}'),
	('7e570011-0000-4000-8000-000000000013', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Dinge waren im Projekt nicht leistbar. Rechtsberatung im engeren Sinn ist Ehrenamtlichen untersagt, und die Abgrenzung war im Gespräch oft schwer zu halten: Wer wissen will, ob eine Kündigung wirksam ist, bekommt keine Antwort, sondern eine Adresse. Zweitens fehlte Sprachmittlung. Bei mindestens elf Terminen wurde auf mitgebrachte Angehörige zurückgegriffen, was bei Geldfragen innerhalb einer Familie heikel ist."}]}'),
	('7e570011-0000-4000-8000-000000000013', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für eine Fortsetzung im Sommersemester ist deshalb ein fester Slot mit einem Sprachmittlungsdienst beantragt. Ob er bewilligt wird, war bei Abgabe des Berichts offen. Die Sprechstunde selbst läuft weiter, getragen von zwei Studierenden des nachfolgenden Jahrgangs, die im Februar bereits zwei Termine begleitet haben."}]}'),
	('7e570011-0000-4000-8000-000000000013', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich habe den Brief drei Wochen lang nicht aufgemacht. Hier hat ihn jemand mit mir zusammen aufgemacht, das war der ganze Unterschied."}]}]}'),
	('7e570011-0000-4000-8000-000000000014', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Stromverbrauch von WebAssembly und JavaScript im Browser","index":0},{"level":2,"text":"Die Annahme, die geprüft werden sollte","index":1},{"level":2,"text":"Messaufbau","index":2},{"level":2,"text":"Ergebnisse und offene Schwächen","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000014', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Stromverbrauch von WebAssembly und JavaScript im Browser"}]}'),
	('7e570011-0000-4000-8000-000000000014', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000014","alt":"Titelbild des Projekts Stromverbrauch von WebAssembly und JavaScript im Browser","caption":"Vier Rechenaufgaben liefen im Browser einmal als JavaScript und einmal als WebAssembly. Das Semesterprojekt im Master maß den Energiebedarf über die RAPL-Zähler des Prozessors und kontrollierte gegen…","width":100}}'),
	('7e570011-0000-4000-8000-000000000014', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Die Annahme, die geprüft werden sollte"}]}'),
	('7e570011-0000-4000-8000-000000000014', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In Vorträgen und Blogtexten steht WebAssembly für schnelleren Code und daraus abgeleitet für sparsameren Code. Zwingend ist der Schluss nicht: Eine kürzere Laufzeit kann mit höherer Leistungsaufnahme erkauft sein, etwa wenn breitere Recheneinheiten anlaufen oder der Takt oben bleibt. Für vier alltägliche Aufgaben wollten wir wissen, ob sich der Energiebedarf überhaupt messbar unterscheidet und in welche Richtung."}]}'),
	('7e570011-0000-4000-8000-000000000014', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Aufgaben stammen aus Projekten des eigenen Studiengangs und nicht aus einer Benchmark-Sammlung, damit die Laufzeiten in der Größenordnung liegen, die im Browser tatsächlich vorkommt. Jede Aufgabe wurde in C geschrieben, mit Emscripten nach WebAssembly übersetzt und für den Vergleich von Hand nach JavaScript portiert."}]}'),
	('7e570011-0000-4000-8000-000000000014', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Messaufbau"}]}'),
	('7e570011-0000-4000-8000-000000000014', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gemessen wurde auf drei Laptops mit Intel-Prozessoren der zwölften und dreizehnten Generation, jeweils unter Firefox und Chromium. Vor jedem Durchlauf lief das Gerät fünf Minuten im Leerlauf, damit die Kühlung auf vergleichbarem Stand war. Jede Kombination aus Aufgabe, Sprache und Browser wurde dreißigmal wiederholt. Ausgewertet wurde der Median, weil einzelne Durchläufe durch Hintergrunddienste deutlich nach oben ausreißen."}]}'),
	('7e570011-0000-4000-8000-000000000014', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bildfilter: Gaußsche Unschärfe über ein Foto mit zwölf Megapixeln"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Textverarbeitung: Parsen einer 80 Megabyte großen JSON-Datei"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Matrixmultiplikation: 1024 mal 1024 Gleitkommazahlen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kompression: Deflate über ein Archiv aus 3.400 kleinen Dateien"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000014', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse und offene Schwächen"}]}'),
	('7e570011-0000-4000-8000-000000000014', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Beim Bildfilter und bei der Matrixmultiplikation brauchte die WebAssembly-Fassung 35 beziehungsweise 41 Prozent weniger Energie. Beim Parsen der JSON-Datei kehrte sich das Bild um: Die eingebaute Optimierung der JavaScript-Engine schlug die eigene Implementierung deutlich, WebAssembly lag 18 Prozent darüber. Bei der Kompression war der Unterschied kleiner als die Streuung zwischen den Durchläufen, dort lässt sich nichts behaupten."}]}'),
	('7e570011-0000-4000-8000-000000000014', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Zwischenstecker am Netzteil war als unabhängige Kontrolle gedacht und taugte dafür kaum. Seine Auflösung von 0,1 Watt lag in der Größenordnung der gesuchten Unterschiede, dazu kamen die Ladeströme des Akkus. Verwertbar blieben allein die RAPL-Zähler, und die erfassen nur Prozessor und Speicher, nicht Bildschirm oder Verluste im Netzteil. Absolute Zahlen für ein ganzes Gerät liefert das Projekt deshalb nicht."}]}'),
	('7e570011-0000-4000-8000-000000000015', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Experimentalrakete Weser II","index":0},{"level":2,"text":"Eine Werkstatt in der Airport-Stadt","index":1},{"level":2,"text":"Aufbau der Rakete","index":2},{"level":2,"text":"Der Start in Nordschweden","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000015', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Experimentalrakete Weser II"}]}'),
	('7e570011-0000-4000-8000-000000000015', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000015","alt":"Titelbild des Projekts Experimentalrakete Weser II","caption":"Eine studentische Initiative der Hochschule Bremen baut Experimentalraketen mit selbst gegossenem Feststoffmotor. Weser II erreichte beim Start in Nordschweden 2.870 Meter und blieb damit unter dem Z…","width":100}}'),
	('7e570011-0000-4000-8000-000000000015', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Eine Werkstatt in der Airport-Stadt"}]}'),
	('7e570011-0000-4000-8000-000000000015', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Initiative besteht seit 2023 und trifft sich dienstagabends in einer Werkstatt in der Airport-Stadt, die die Fakultät für zwei Semester freigegeben hat. Zwölf Studierende aus dem Maschinenbau, der Luft- und Raumfahrttechnik und der Informatik arbeiten mit, ohne dass daraus Credits entstehen. Weser I flog im Sommer 2024 auf 1.100 Meter und war eher ein Lernstück; für Weser II lautete das Ziel 3.000 Meter."}]}'),
	('7e570011-0000-4000-8000-000000000015', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Budget von 6.400 Euro kam aus Mitteln der Studierendenschaft und von zwei Betrieben aus dem Bremer Umland. Der größte Posten war nicht die Elektronik, sondern der Kohlefaserschlauch für das Rohr, der in kleinen Mengen unverhältnismäßig teuer ist. Vieles andere entstand aus Restmaterial der hochschuleigenen Werkstatt."}]}'),
	('7e570011-0000-4000-8000-000000000015', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau der Rakete"}]}'),
	('7e570011-0000-4000-8000-000000000015', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Weser II ist 2,40 Meter lang und wiegt startbereit 14,8 Kilogramm. Das Rohr entstand aus Kohlefaser über einem Aluminiumkern, die Finnen sind aus Sperrholz mit Glasfaserbeschichtung, weil ein erster Satz aus reinem Kohlefaserlaminat im Belastungstest an der Wurzel gebrochen war. Die Nutzlast bestand aus zwei Beschleunigungssensoren, einem barometrischen Höhenmesser und einem Datenlogger auf SD-Karte."}]}'),
	('7e570011-0000-4000-8000-000000000015', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Länge 2,40 Meter, Startmasse 14,8 Kilogramm"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Feststoffmotor der Klasse M, im eigenen Gussverfahren hergestellt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rohr aus Kohlefaser, Finnen aus Sperrholz mit Glasfaserbeschichtung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zweistufige Bergung: Bremsschirm am Scheitelpunkt, Hauptschirm auf 300 Meter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Telemetrie auf 433 Megahertz, Reichweite im Feldtest rund acht Kilometer"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000015', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Start in Nordschweden"}]}'),
	('7e570011-0000-4000-8000-000000000015', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Flug fand im Oktober 2025 auf einem Startgelände nördlich von Kiruna statt. Weser II erreichte 2.870 Meter, also 130 Meter unter dem Ziel. Der Bremsschirm öffnete zwei Sekunden zu spät, weil der Höhenmesser den Scheitelpunkt bei minus sechs Grad Außentemperatur später meldete als in den Laborläufen. Die Rakete landete hart, das Rohr bekam einen Riss über 40 Zentimeter, die Elektronik blieb heil und die Daten waren vollständig lesbar."}]}'),
	('7e570011-0000-4000-8000-000000000015', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Auswertung zeigte, dass der Motor rund elf Prozent weniger Gesamtimpuls lieferte als beim Prüfstandslauf im September. Als wahrscheinlichste Ursache gilt Feuchtigkeit im Treibsatz, der drei Wochen ohne Trockenmittel gelagert wurde. Für Weser III steht die Lagerung deshalb als erster Punkt auf der Liste, noch vor jeder Verbesserung an der Aerodynamik."}]}'),
	('7e570011-0000-4000-8000-000000000015', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wir haben monatelang über die Aerodynamik geredet und dabei übersehen, dass der Motor drei Wochen in einer feuchten Kiste lag."}]}]}'),
	('7e570011-0000-4000-8000-000000000016', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Pfandsystem für Bremer Kantinen","index":0},{"level":2,"text":"Ausgangslage und Idee","index":1},{"level":2,"text":"Rechnen mit echten Zahlen","index":2},{"level":2,"text":"Rückmeldung der Jury","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000016', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Pfandsystem für Bremer Kantinen"}]}'),
	('7e570011-0000-4000-8000-000000000016', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000016","alt":"Titelbild des Projekts Pfandsystem für Bremer Kantinen","caption":"Wettbewerbsbeitrag für einen Bremer Gründungswettbewerb: ein Mehrwegsystem mit Pfand für Kantinen und Imbisse. Enthalten sind die Kalkulation eines gemeinsamen Spülzentrums, eine Befragung von 21 Bet…","width":100}}'),
	('7e570011-0000-4000-8000-000000000016', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage und Idee"}]}'),
	('7e570011-0000-4000-8000-000000000016', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Seit 2023 müssen größere Betriebe eine Mehrwegvariante anbieten. In der Praxis kaufen viele Imbisse dafür eigene Behälter, spülen sie selbst und nehmen sie nur im eigenen Laden zurück. Wer mittags in der Airport-Stadt kauft und abends in der Neustadt wohnt, trägt den Behälter also quer durch die Stadt zurück oder eben gar nicht. Unser Beitrag für den Gründungswettbewerb im Sommersemester 2026 setzt hier an: ein gemeinsamer Behälterpool für mehrere Betriebe, ein zentrales Spülzentrum und Rückgabe in jedem angeschlossenen Laden."}]}'),
	('7e570011-0000-4000-8000-000000000016', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Team bestand aus drei Studierenden des Masterstudiengangs; die Idee stammt aus einem Praxissemester in einer Betriebskantine, in der pro Mittag rund 180 Einwegschalen anfielen. Vorbild war weniger ein bestehender Anbieter als die Logistik des Getränkekastens, bei der Behälter und Betrieb ohnehin längst getrennt sind. Wir wollten wissen, ob dieselbe Trennung auch bei Essensbehältern eine Rechnung ergibt, die ohne dauerhafte Förderung auskommt."}]}'),
	('7e570011-0000-4000-8000-000000000016', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Rechnen mit echten Zahlen"}]}'),
	('7e570011-0000-4000-8000-000000000016', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Kalkulation haben wir 21 Betriebe zwischen Neustadtswall und Überseestadt angeschrieben, 12 haben geantwortet und 7 ihre Mengen offengelegt. Daraus ergab sich ein realistischer Ausgangsbestand von 6.400 Behältern. Die Kosten je Umlauf setzen sich aus Abholung, Spülgang, Bruch und Verlust zusammen und landen bei 0,31 Euro. Damit trägt sich der Pool ab etwa 34.000 Umläufen im Monat, was rund 20 mittelgroßen Betrieben entspricht. Unterhalb dieser Schwelle bleibt das Modell dauerhaft auf Zuschüsse angewiesen."}]}'),
	('7e570011-0000-4000-8000-000000000016', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"21 angeschriebene Betriebe, 12 Antworten, 7 mit Mengenangaben"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"6.400 Behälter im Startbestand"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"0,31 Euro Kosten je Umlauf"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Break-even bei 34.000 Umläufen im Monat"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"5 Euro Pfand je Behälter"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000016', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Rückmeldung der Jury"}]}'),
	('7e570011-0000-4000-8000-000000000016', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Jury hat den Beitrag in die zweite Runde genommen und an einer Stelle deutlich widersprochen. Wir waren von 94 Prozent Rückgabequote ausgegangen, gestützt auf Zahlen aus dem Getränkepfand. Für einen Behälter, der nach dem Essen ungespült in der Tasche liegt, ist das zu optimistisch; realistisch sind nach Auskunft eines Praktikers aus der Systemgastronomie eher 80 bis 85 Prozent. Bei 85 Prozent verschiebt sich der Break-even auf gut 41.000 Umläufe, das Modell trägt sich dann erst mit 24 Betrieben."}]}'),
	('7e570011-0000-4000-8000-000000000016', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Überarbeitung haben wir das Pfand von 3 auf 5 Euro angehoben und die Rückgabestellen um zwei Automaten in Bibliotheken ergänzt. Ob das reicht, ist offen. Nachmessen lässt es sich erst in einem echten Pilotbetrieb, für den wir gerade zwei Kantinen anfragen."}]}'),
	('7e570011-0000-4000-8000-000000000016', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ihre Rückgabequote ist aus dem Getränkepfand geliehen, und ein Schnitzelbehälter ist kein Bierkasten."}]}]}'),
	('7e570011-0000-4000-8000-000000000017', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Regenwasserrückhalt auf Gründächern in der Überseestadt","index":0},{"level":2,"text":"Warum die Annahmen der Planung geprüft wurden","index":1},{"level":2,"text":"Messaufbau auf drei Dächern","index":2},{"level":2,"text":"Ergebnisse über zwei Winter","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000017', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Regenwasserrückhalt auf Gründächern in der Überseestadt"}]}'),
	('7e570011-0000-4000-8000-000000000017', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000017","alt":"Titelbild des Projekts Regenwasserrückhalt auf Gründächern in der Überseestadt","caption":"Bachelorarbeit über die Frage, wie viel Niederschlag drei extensiv begrünte Bestandsdächer in der Bremer Überseestadt tatsächlich zurückhalten. Gemessen wurde über zwei Winter und verglichen mit den…","width":100}}'),
	('7e570011-0000-4000-8000-000000000017', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum die Annahmen der Planung geprüft wurden"}]}'),
	('7e570011-0000-4000-8000-000000000017', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Entwässerungsplanung in der Überseestadt rechnet extensiven Gründächern einen Abflussbeiwert von 0,5 an. Dieser Wert stammt aus Regelwerken und Herstellerangaben, nicht aus Messungen am fertigen Bau. Wer ein Quartier plant, dimensioniert danach Rückhalteräume und Kanalquerschnitte. Liegt der Beiwert im Bremer Winter höher, ist die Anlage zu klein ausgelegt; liegt er niedriger, wird teurer gebaut als nötig."}]}'),
	('7e570011-0000-4000-8000-000000000017', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit setzt an dieser Lücke an und misst den Abfluss von drei Bestandsdächern zwischen Oktober 2023 und März 2025. Zwei liegen auf Hallen im Hafengebiet, das dritte auf einem Wohngebäude am Europahafen. Alle drei haben eine Substratstärke zwischen sechs und zwölf Zentimetern und wurden zwischen 2016 und 2020 angelegt. Die Eigentümer stellten Zugang und Stromanschluss, die Messtechnik kam aus dem Labor an der Werderstraße."}]}'),
	('7e570011-0000-4000-8000-000000000017', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Messaufbau auf drei Dächern"}]}'),
	('7e570011-0000-4000-8000-000000000017', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"An jedem Dachablauf saß ein Kippwaagenzähler mit einer Auflösung von 0,1 Millimetern, dazu ein Niederschlagsschreiber auf derselben Dachfläche. Die Substratfeuchte wurde in zwei Tiefen erfasst. Alle Werte liefen im Fünf-Minuten-Takt auf einen Datenlogger, der monatlich ausgelesen wurde. Der Aufbau kostete rund 2.400 Euro je Dach und musste im ersten Winter zweimal nachjustiert werden, weil Laub die Kippwaage blockierte."}]}'),
	('7e570011-0000-4000-8000-000000000017', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Drei Bestandsdächer, Substratstärke sechs bis zwölf Zentimeter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kippwaagenzähler am Ablauf, Auflösung 0,1 Millimeter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Niederschlag und Substratfeuchte als Fünf-Minuten-Werte"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Messzeitraum Oktober 2023 bis März 2025"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000017', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse über zwei Winter"}]}'),
	('7e570011-0000-4000-8000-000000000017', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Über beide Winter hielten die Dächer im Mittel 41 Prozent des Niederschlags zurück, der rechnerische Abflussbeiwert liegt damit bei 0,59 statt bei 0,5. Bei Starkregen ab 15 Millimetern in der Stunde sank der Rückhalt auf 12 Prozent, weil das Substrat bereits gesättigt war. Genau diese Ereignisse bestimmen aber die Dimensionierung des Kanals. Im Sommerhalbjahr, das nur am Rand mitgemessen wurde, lag der Rückhalt erwartungsgemäß höher."}]}'),
	('7e570011-0000-4000-8000-000000000017', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Dach am Europahafen fällt aus der Reihe und hält über den gesamten Zeitraum nur 28 Prozent zurück. Die Ursache ließ sich nicht abschließend klären. Naheliegend ist eine verdichtete Substratschicht durch Wartungsverkehr, nachgewiesen wurde sie nicht, weil der Eigentümer keine Probeentnahme zuließ. Die Arbeit empfiehlt deshalb, den Beiwert für Bremer Bestandsdächer vorsichtiger anzusetzen und die Messreihe über einen dritten Winter fortzuführen."}]}'),
	('7e570011-0000-4000-8000-000000000018', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Beratungswege pflegender Angehöriger in Bremen-Nord","index":0},{"level":2,"text":"Warum die Frage gestellt wurde","index":1},{"level":2,"text":"Feldzugang und Auswertung","index":2},{"level":2,"text":"Was die Interviews zeigen","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000018', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Beratungswege pflegender Angehöriger in Bremen-Nord"}]}'),
	('7e570011-0000-4000-8000-000000000018', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000018","alt":"Titelbild des Projekts Beratungswege pflegender Angehöriger in Bremen-Nord","caption":"Forschungsprojekt zu pflegenden Angehörigen in Bremen-Nord. 18 Interviews zeigen, über welche Wege Menschen den Pflegestützpunkt und andere Beratungsstellen finden, und woran der Weg dorthin scheiter…","width":100}}'),
	('7e570011-0000-4000-8000-000000000018', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum die Frage gestellt wurde"}]}'),
	('7e570011-0000-4000-8000-000000000018', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In Bremen-Nord leben rund 96.000 Menschen. Der Anteil der Pflegebedürftigen, die zu Hause von Angehörigen versorgt werden, liegt hier über dem Durchschnitt der Stadt, die Zahl der ambulanten Dienste dagegen darunter. Beratung ist vorhanden: ein Pflegestützpunkt in Vegesack, dazu Angebote der Pflegekassen und der Wohlfahrtsverbände. In den Beratungsstellen selbst hieß es im Vorgespräch, viele Angehörige kämen erst, wenn die Lage zu Hause bereits gekippt sei."}]}'),
	('7e570011-0000-4000-8000-000000000018', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Forschungsprojekt ging deshalb nicht der Frage nach, ob das Angebot ausreicht, sondern wie Angehörige davon erfahren. Zu Beginn stand die Annahme, fehlende Information sei der Hauptgrund für den späten Kontakt. Diese Annahme hat sich im Verlauf nur zum Teil gehalten, und die Abweichung wurde zum eigentlichen Ertrag des Semesters."}]}'),
	('7e570011-0000-4000-8000-000000000018', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Feldzugang und Auswertung"}]}'),
	('7e570011-0000-4000-8000-000000000018', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Zugang zum Feld war der schwierigste Teil. Über Aushänge an der Hochschule meldete sich niemand. Erst über den Pflegestützpunkt Vegesack, zwei Apotheken in Blumenthal und eine Selbsthilfegruppe kamen genug Zusagen zusammen, und selbst dann sagten vier Personen kurzfristig ab, weil die Pflegesituation zu Hause es nicht zuließ. Zwei Interviews wurden nach 20 Minuten abgebrochen und später fortgesetzt."}]}'),
	('7e570011-0000-4000-8000-000000000018', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Zusammensetzung der Befragten ist schief. 15 der 18 Personen waren Frauen, alle sprachen Deutsch als Erstsprache oder sehr sicher. Gerade die Gruppe, über die in den Beratungsstellen am meisten gesprochen wird, nämlich Familien mit Zuwanderungsgeschichte, ist im Material kaum vertreten. Das schränkt die Reichweite der Aussagen deutlich ein und steht so auch im Bericht."}]}'),
	('7e570011-0000-4000-8000-000000000018', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"18 leitfadengestützte Interviews zwischen März und Juni 2025, im Schnitt 54 Minuten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs Gespräche in der Wohnung der Befragten, zwölf in Räumen der Beratungsstellen oder am Telefon"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Auswertung als qualitative Inhaltsanalyse mit einem Kategoriensystem aus 27 Codes"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwei Gruppendiskussionen mit Beraterinnen, um die Befunde zurückzuspiegeln"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000018', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Interviews zeigen"}]}'),
	('7e570011-0000-4000-8000-000000000018', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Weg zur Beratung lief in 13 von 18 Fällen über eine Person aus dem Gesundheitswesen, meist die Hausarztpraxis, seltener über den Krankenhaussozialdienst nach einem Sturz. Gedruckte Informationen und Internetseiten wurden in keinem einzigen Interview als erster Kontaktpunkt genannt, obwohl fast alle Befragten sie im Nachhinein kannten. Wer den Weg über eine Ärztin fand, kam im Schnitt deutlich früher an, oft im ersten Halbjahr der Pflege."}]}'),
	('7e570011-0000-4000-8000-000000000018', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der zweite Befund war weniger erwartet. Mehrere Befragte hatten von den Angeboten gewusst und sie trotzdem nicht genutzt, weil sie Pflege als familiäre Aufgabe verstanden und Beratung als Eingeständnis, es nicht zu schaffen. Information allein hätte hier nichts geändert. Für die Beratungsstellen folgt daraus eher, den ersten Kontakt über die Hausarztpraxis zu suchen, als weitere Broschüren zu verteilen."}]}'),
	('7e570011-0000-4000-8000-000000000018', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich habe ein halbes Jahr gedacht, das ist Familiensache. Dass es dafür eine Beratungsstelle gibt, hat mir am Ende die Hausärztin gesagt."}]}]}'),
	('7e570011-0000-4000-8000-000000000019', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Wandprojektion für die Erstsemesterwoche","index":0},{"level":2,"text":"Aufbau im Foyer","index":1},{"level":2,"text":"Von der Umfrage zum Bild","index":2},{"level":2,"text":"Was die Woche gezeigt hat","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000019', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Wandprojektion für die Erstsemesterwoche"}]}'),
	('7e570011-0000-4000-8000-000000000019', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000019","alt":"Titelbild des Projekts Wandprojektion für die Erstsemesterwoche","caption":"Eine interaktive Projektion im Foyer an der Flughafenallee zeigt, woher die Erstsemester kommen und was sie belegen. Zwei Distanzsensoren im Bodenkanal steuern die Ansicht, die Daten stammen aus eine…","width":100}}'),
	('7e570011-0000-4000-8000-000000000019', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau im Foyer"}]}'),
	('7e570011-0000-4000-8000-000000000019', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Projektion läuft auf eine 4,2 Meter breite Wandfläche im Foyer an der Flughafenallee, gegenüber der Treppe. Ein Kurzdistanzbeamer hängt an einem Traversenstück, das die Veranstaltungstechnik ohnehin für die Begrüßung aufgebaut hatte. Der Rechner steht im abgeschlossenen Technikschrank daneben, damit während der Woche niemand daran hantiert. Der Aufbau dauerte einen Nachmittag, die Einmessung der Sensoren zwei weitere Termine."}]}'),
	('7e570011-0000-4000-8000-000000000019', 5, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kurzdistanzbeamer mit 6.000 Lumen, geliehen aus der Medientechnik"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"zwei Ultraschallsensoren im Bodenkanal, Abstand 1,2 Meter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"ESP32 als Messknoten, per USB an den Rechner angebunden"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mini-PC mit TouchDesigner, Ausgabe in 1920 mal 1200 Punkten"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000019', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Von der Umfrage zum Bild"}]}'),
	('7e570011-0000-4000-8000-000000000019', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Beim Check-in bekamen die Erstsemester einen Zettel mit vier Fragen und einem QR-Code. 312 von rund 480 Anwesenden haben geantwortet. Für die Anzeige werden Postleitzahlen zu Kreisen zusammengefasst, und ein Kreis erscheint erst, wenn mindestens fünf Antworten darauf entfallen. Diese Schwelle kam auf Hinweis der Datenschutzbeauftragten dazu, nachdem eine erste Fassung einzelne Orte im Umland namentlich anzeigte."}]}'),
	('7e570011-0000-4000-8000-000000000019', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Studiengänge liegen als Ringe über der Karte. Wer näher als 1,5 Meter an die Wand tritt, wechselt in die Ansicht des eigenen Studiengangs, wer zurücktritt, sieht wieder alle. Die Umschaltung braucht knapp zwei Sekunden. Das reicht, damit sie nicht bei jedem Vorbeigehen ausgelöst wird."}]}'),
	('7e570011-0000-4000-8000-000000000019', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Woche gezeigt hat"}]}'),
	('7e570011-0000-4000-8000-000000000019', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In den vier Tagen lief die Anlage bis auf einen Ausfall stabil. Am Mittwochvormittag meldete einer der Sensoren dauerhaft 20 Zentimeter, weil eine Tasche im Bodenkanal stand. Die Projektion hing eine Dreiviertelstunde in der Nahansicht fest, bis jemand nachsah. Seitdem verwirft die Software Messwerte, die länger als 30 Sekunden unverändert bleiben."}]}'),
	('7e570011-0000-4000-8000-000000000019', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Beobachtet haben wir an zwei Vormittagen jeweils eine Stunde lang. Von 63 Personen, die das Foyer durchquerten, blieben 19 stehen, und 7 davon traten dicht genug heran, um die Umschaltung auszulösen. Den meisten war nicht klar, dass sich das Bild auf sie selbst bezieht."}]}'),
	('7e570011-0000-4000-8000-000000000019', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich dachte, das ist ein Bildschirmschoner, bis auf einmal mein Studiengang aufgeleuchtet ist."}]}]}'),
	('7e570011-0000-4000-8000-000000000020', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Vibrationsmessung an einem CubeSat-Strukturmodell","index":0},{"level":2,"text":"Aufgabe und Prüfaufbau","index":1},{"level":2,"text":"Ergebnisse der Modalanalyse","index":2},{"level":2,"text":"Zwei Fehler im ersten Durchlauf","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000020', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Vibrationsmessung an einem CubeSat-Strukturmodell"}]}'),
	('7e570011-0000-4000-8000-000000000020', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000020","alt":"Titelbild des Projekts Vibrationsmessung an einem CubeSat-Strukturmodell","caption":"Im Labor an der Flughafenallee wurde ein 3U-CubeSat-Strukturmodell auf dem Shaker vermessen: Eigenfrequenzen und Dämpfung, dazu die Frage, wie stark die geschraubte Einspannung das Ergebnis verschieb…","width":100}}'),
	('7e570011-0000-4000-8000-000000000020', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgabe und Prüfaufbau"}]}'),
	('7e570011-0000-4000-8000-000000000020', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Kurs Strukturdynamik verlangt im Sommersemester eine eigenständige Messkampagne. Unsere Gruppe von drei Personen bekam ein 3U-Strukturmodell aus dem Bestand des Labors, also einen Aluminiumrahmen von 10 mal 10 mal 34 Zentimetern mit Massedummies anstelle der Elektronik. Gemessen wurde auf dem elektrodynamischen Shaker im Labor an der Flughafenallee, angeregt mit einem Sinus-Sweep von 5 bis 2000 Hertz bei 0,5 g."}]}'),
	('7e570011-0000-4000-8000-000000000020', 5, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"3U-Aluminiumrahmen, 2,9 kg mit Massedummies"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sinus-Sweep 5 bis 2000 Hz, Rate zwei Oktaven pro Minute"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs triaxiale Beschleunigungsaufnehmer, zwei davon an der Deckplatte"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Drei Wiederholungen je Achse, insgesamt neun Läufe"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000020', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse der Modalanalyse"}]}'),
	('7e570011-0000-4000-8000-000000000020', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die erste Biegeeigenform lag bei 187 Hertz und damit rund 9 Prozent unter dem Wert aus der Finite-Elemente-Rechnung, die vorab 205 Hertz ergeben hatte. Die zweite Form, eine Torsion um die Längsachse, traf mit 341 gegenüber 348 Hertz deutlich besser. Die Abweichung der ersten Form lässt sich fast vollständig auf die Steifigkeit der Einspannung zurückführen: Im Modell war der Fuß starr angenommen, in der Vorrichtung sitzt er auf vier M4-Schrauben."}]}'),
	('7e570011-0000-4000-8000-000000000020', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Dämpfung wurde über die Halbwertsbreite bestimmt und liegt bei 1,4 Prozent für die erste und 0,9 Prozent für die zweite Form. Beides passt zu den Literaturwerten für geschraubte Aluminiumstrukturen. Zwischen den drei Wiederholungen je Achse streuten die Frequenzen um weniger als 1 Hertz, die Dämpfungswerte dagegen um bis zu 0,3 Prozentpunkte."}]}'),
	('7e570011-0000-4000-8000-000000000020', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Zwei Fehler im ersten Durchlauf"}]}'),
	('7e570011-0000-4000-8000-000000000020', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der erste Messtag war unbrauchbar. Ein Beschleunigungsaufnehmer war mit Wachs statt mit Klebstoff befestigt und löste sich oberhalb von 800 Hertz, sichtbar an einem Signalabfall, den wir zunächst für eine Antiresonanz hielten. Erst der Vergleich mit dem gegenüberliegenden Aufnehmer machte den Fehler deutlich. Hinzu kam eine Abtastrate von 2048 Hertz, zu niedrig für den geplanten Bereich bis 2000 Hertz. Die Läufe des ersten Tages wurden verworfen und eine Woche später wiederholt."}]}'),
	('7e570011-0000-4000-8000-000000000020', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Auswertung blieb dadurch weniger Zeit als geplant. Der Vergleich mit einem verfeinerten Modell, in dem die Schraubverbindung als Federsteifigkeit abgebildet ist, konnte nur noch für die erste Eigenform durchgeführt werden. Für die Torsionsform steht er aus und ist im Bericht als offener Punkt vermerkt."}]}'),
	('7e570011-0000-4000-8000-000000000021', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Betriebsnachfolge in Bremer Handwerksbetrieben","index":0},{"level":2,"text":"Warum vier Betriebe und nicht vierzig","index":1},{"level":2,"text":"Vier Übergaben, vier Verläufe","index":2},{"level":2,"text":"Was die Betriebe gebraucht hätten","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000021', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Betriebsnachfolge in Bremer Handwerksbetrieben"}]}'),
	('7e570011-0000-4000-8000-000000000021', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000021","alt":"Titelbild des Projekts Betriebsnachfolge in Bremer Handwerksbetrieben","caption":"Rund 1.900 Handwerksbetriebe in Bremen suchen bis 2030 eine Nachfolge. Das Praxisprojekt begleitete vier Übergaben über je fünf Monate und fragt, woran die Gespräche zwischen Übergebenden und Nachfol…","width":100}}'),
	('7e570011-0000-4000-8000-000000000021', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum vier Betriebe und nicht vierzig"}]}'),
	('7e570011-0000-4000-8000-000000000021', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Handwerkskammer zählte im Frühjahr 2024 etwa 1.900 Inhaberinnen und Inhaber über 55 Jahre ohne geklärte Nachfolge. Statistiken dazu gibt es reichlich. Was in den Gesprächen selbst passiert, steht in keiner davon. Das Projekt entschied sich deshalb für vier Betriebe zwischen 6 und 31 Beschäftigten, begleitet über je fünf Monate: zwei Sanitärbetriebe in Walle und Hemelingen, ein Elektrobetrieb in Bremen-Nord, ein Metallbaubetrieb in der Airport-Stadt."}]}'),
	('7e570011-0000-4000-8000-000000000021', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zugang bekam das Projekt über die Betriebsberatung der Kammer, die den Kontakt herstellte und bei zwei Betrieben auch an den ersten Terminen teilnahm. Das hat die Offenheit gebremst. Erst als die Beratung ab dem dritten Termin draußen blieb, kamen die Sätze, um die es eigentlich ging: über Kaufpreise, über Kinder, die nicht wollten, und über einen Werkstattmeister, der seit 19 Jahren im Betrieb ist und übergangen wurde."}]}'),
	('7e570011-0000-4000-8000-000000000021', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vier Übergaben, vier Verläufe"}]}'),
	('7e570011-0000-4000-8000-000000000021', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei der vier Übergaben kamen im Projektzeitraum zum Abschluss, eine wurde abgebrochen, eine läuft weiter. Der Abbruch ist der lehrreichste Fall. Übergeber und Nachfolgerin hatten sich über den Kaufpreis früh geeinigt und stritten dann acht Wochen über die Halle, die dem Übergeber privat gehört und weiter vermietet werden sollte. Die Bewertung des Betriebs war nie das Problem, die Miete war es."}]}'),
	('7e570011-0000-4000-8000-000000000021', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sanitärbetrieb Walle, 14 Beschäftigte: Übergabe an den Werkstattmeister, abgeschlossen im Januar 2025"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Elektrobetrieb Bremen-Nord, 6 Beschäftigte: Übergabe an die Tochter, abgeschlossen im März 2025"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Metallbaubetrieb Airport-Stadt, 31 Beschäftigte: abgebrochen nach acht Wochen Streit über die Betriebsimmobilie"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sanitärbetrieb Hemelingen, 9 Beschäftigte: weiterhin in Verhandlung, Zwischenstand Mai 2025"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000021', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Betriebe gebraucht hätten"}]}'),
	('7e570011-0000-4000-8000-000000000021', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In allen vier Fällen wurde zuerst über Zahlen gesprochen und zuletzt über Rollen. Wer nach der Übergabe noch im Betrieb auftaucht, an welchen Tagen, mit welchen Schlüsseln, das stand in keinem der Entwürfe. Zwei Übergeber kamen nach der Unterschrift weiter täglich in die Werkstatt, in einem Fall ausdrücklich erwünscht, im anderen nicht. Eine Rollenvereinbarung für die ersten zwölf Monate wäre in beiden Fällen billiger gewesen als die Anwaltsstunden danach."}]}'),
	('7e570011-0000-4000-8000-000000000021', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Projekt schlägt der Kammer deshalb vor, den bestehenden Nachfolge-Leitfaden um einen Abschnitt zur Zeit nach der Unterschrift zu ergänzen. Ob das aufgegriffen wird, war bei Abgabe offen. Der Entwurf liegt der Betriebsberatung seit April 2025 vor und umfasst vier Seiten mit Fragen, die vor dem Notartermin beantwortet sein sollten."}]}'),
	('7e570011-0000-4000-8000-000000000021', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Über den Preis waren wir uns nach zwei Terminen einig. Dass ich am Montagmorgen nicht mehr die Werkstatt aufschließe, hat mich ein halbes Jahr gekostet."}]}]}'),
	('7e570011-0000-4000-8000-000000000022', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Entsiegelung am Buntentorsteinweg","index":0},{"level":2,"text":"Ein Quartier ohne Platz","index":1},{"level":2,"text":"Aufnahme vor Ort","index":2},{"level":2,"text":"Drei Varianten und ein ernüchterndes Ergebnis","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000022', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Entsiegelung am Buntentorsteinweg"}]}'),
	('7e570011-0000-4000-8000-000000000022', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000022","alt":"Titelbild des Projekts Entsiegelung am Buntentorsteinweg","caption":"Wie viel Regenwasser lässt sich in einem dicht bebauten Quartier der Bremer Neustadt vor Ort versickern? Wir haben 3,1 Hektar am Buntentorsteinweg kartiert, den Untergrund sondiert und drei Entsiegel…","width":100}}'),
	('7e570011-0000-4000-8000-000000000022', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ein Quartier ohne Platz"}]}'),
	('7e570011-0000-4000-8000-000000000022', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Abschnitt zwischen Buntentorsteinweg und Friedrich-Ebert-Straße ist im Mischsystem entwässert. Bei den Starkregen im Sommer 2023 lief das Netz zweimal über, in mehreren Häusern stand Wasser im Keller. Gleichzeitig ist das Quartier fast vollständig befestigt: Hofflächen aus Verbundpflaster, Parkstreifen aus Beton, kaum Vorgärten. Die Frage des Semesterprojekts war schlicht, wie viel Niederschlag sich hier ohne Abriss und ohne Neubau im Gebiet halten lässt."}]}'),
	('7e570011-0000-4000-8000-000000000022', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Aufgabe kam aus einem Seminar zur Stadtentwässerung. Ansprechpartner waren ein Mitarbeiter des Ortsamts und zwei Eigentümergemeinschaften, die uns ihre Höfe geöffnet haben. Ohne diesen Zugang wäre die Aufnahme an Zäunen und Klingelschildern gescheitert, was einer Nachbargruppe im selben Seminar tatsächlich passiert ist."}]}'),
	('7e570011-0000-4000-8000-000000000022', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufnahme vor Ort"}]}'),
	('7e570011-0000-4000-8000-000000000022', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Über vier Wochen haben wir 3,1 Hektar mit 68 Grundstücken aufgenommen, teils mit Maßband und Zollstock, teils aus dem Liegenschaftskataster. Der versiegelte Anteil liegt bei 71 Prozent. Für die Versickerung zählt aber nicht die Fläche, sondern der Untergrund, und der ist in der Neustadt heikel: Klei über Sand, dazu ein Grundwasserstand, der stellenweise nur 1,4 Meter unter der Geländeoberkante liegt."}]}'),
	('7e570011-0000-4000-8000-000000000022', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Rammkernsondierungen hat uns das Labor der Fakultät gestellt, ausgewertet haben wir sie selbst. Für zwei Punkte an der Westseite mussten wir die Ergebnisse verwerfen, weil das Bohrgut beim Ziehen durchmischt war und die Schichtgrenze nicht mehr sicher ablesbar war. Diese beiden Grundstücke stehen in unserer Bilanz bis heute ohne Kennwert."}]}'),
	('7e570011-0000-4000-8000-000000000022', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"3,1 Hektar Untersuchungsgebiet, 68 Grundstücke, 71 Prozent versiegelt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Neun Rammkernsondierungen bis 3 Meter Tiefe, verteilt über das Gebiet"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Durchlässigkeitsbeiwerte zwischen 2 und 8 mal zehn hoch minus fünf Meter pro Sekunde"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"26 Parkstreifenabschnitte, die für Baumrigolen breit genug wären"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Drei Messpunkte mit weniger als 1,5 Metern Abstand zum Grundwasser"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000022', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Drei Varianten und ein ernüchterndes Ergebnis"}]}'),
	('7e570011-0000-4000-8000-000000000022', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Variante A koppelt 0,42 Hektar Hoffläche ab und ersetzt Verbundpflaster durch Rasenfugenpflaster. Variante B setzt Baumrigolen in die Parkstreifen, geplant an 26 Abschnitten. Variante C kappt die Regenfallrohre von 21 Dachflächen und führt das Wasser in flache Mulden in den Höfen. Gerechnet haben wir mit einem Bemessungsregen der Wiederkehrzeit fünf Jahre und mit der Jahresbilanz aus den Niederschlagsdaten der Station Bremen-Neustadt."}]}'),
	('7e570011-0000-4000-8000-000000000022', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zusammen halten die drei Varianten rechnerisch 34 Prozent des Jahresniederschlags im Gebiet. Das Ziel der Stadtentwässerung liegt bei der Hälfte, und diese Hälfte erreichen wir nicht. Der Grund steht in unserer Sondierungstabelle: An der Westseite ist der Abstand zum Grundwasser zu klein, dort fällt knapp die Hälfte der geplanten Rigolen weg. Gerechnet haben wir Variante B deshalb mit 14 statt 26 Standorten."}]}'),
	('7e570011-0000-4000-8000-000000000023', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Sprachcafé Gröpelingen: Bilanz nach zwei Jahren","index":0},{"level":2,"text":"Wie das Sprachcafé entstand","index":1},{"level":2,"text":"Teilnahme und Abbrüche","index":2},{"level":2,"text":"Der Einbruch im Sommer 2024","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000023', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Sprachcafé Gröpelingen: Bilanz nach zwei Jahren"}]}'),
	('7e570011-0000-4000-8000-000000000023', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000023","alt":"Titelbild des Projekts Sprachcafé Gröpelingen: Bilanz nach zwei Jahren","caption":"Seit November 2023 betreibt eine studentische Initiative ein wöchentliches Sprachcafé im Bremer Stadtteil Gröpelingen. Die Arbeit dokumentiert Teilnahmezahlen, den Wechsel der Ehrenamtlichen und die…","width":100}}'),
	('7e570011-0000-4000-8000-000000000023', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wie das Sprachcafé entstand"}]}'),
	('7e570011-0000-4000-8000-000000000023', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Oktober 2023 fragte die Leiterin einer Fördergruppe im Nachbarschaftshaus Ohlenhof, ob Studierende der Fakultät Gesellschaftswissenschaften ein offenes Gesprächsangebot übernehmen könnten. Vorbild war ein ähnliches Format in Osterholz, das zwei Jahre zuvor an fehlenden Räumen gescheitert war. Sieben Studierende sagten zu, die erste Runde fand am 9. November 2023 mit vier Gästen statt. Seither trifft sich das Sprachcafé donnerstags von 17 bis 19 Uhr."}]}'),
	('7e570011-0000-4000-8000-000000000023', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Getragen wird es von der Initiative selbst, ohne feste Stelle und ohne eigenen Etat. Die Hochschule übernimmt Materialkosten bis 300 Euro im Semester, den Raum stellt das Nachbarschaftshaus. Alles andere, von der Ansprache neuer Gäste bis zur Kaffeekasse, organisieren die Studierenden in einer Chatgruppe. Diese Konstruktion trägt das Angebot, macht es aber auch verletzlich: Fällt die Koordination aus, fällt der Termin."}]}'),
	('7e570011-0000-4000-8000-000000000023', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Teilnahme und Abbrüche"}]}'),
	('7e570011-0000-4000-8000-000000000023', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen November 2023 und Januar 2026 fanden 84 Termine statt, sieben fielen aus. Insgesamt kamen 213 verschiedene Personen, im Mittel 11,4 pro Abend. Die Bindung entsteht früh oder gar nicht: 118 Gäste kamen genau einmal, wer dagegen dreimal da war, blieb im Schnitt für 14 weitere Termine. Nach den Rückmeldungen hat dieser Bruch weniger mit der Sprache zu tun als mit der Uhrzeit und dem Weg zum Nachbarschaftshaus."}]}'),
	('7e570011-0000-4000-8000-000000000023', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"84 Termine, davon 7 abgesagt, meist wegen Erkrankung der Koordination"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"213 Gäste insgesamt, 118 davon nur an einem einzigen Abend"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"31 verschiedene Herkunftssprachen, am häufigsten Arabisch, Türkisch, Ukrainisch und Dari"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"24 Ehrenamtliche insgesamt, im Durchschnitt 2,3 Semester aktiv"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000023', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Einbruch im Sommer 2024"}]}'),
	('7e570011-0000-4000-8000-000000000023', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Juli 2024 sank die Zahl der Ehrenamtlichen von elf auf drei. Vier Studierende hatten ihr Praxissemester begonnen, zwei waren mit dem Studium fertig, die übrigen steckten in Prüfungen. In den Sommerwochen fiel das Sprachcafé dreimal hintereinander aus, und danach kamen die Stammgäste nicht zurück: Im September lag der Schnitt bei 4,8 Personen, gegenüber 13,2 im Juni."}]}'),
	('7e570011-0000-4000-8000-000000000023', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Konsequenz war eine geregelte Übergabe. Seit dem Wintersemester 2024/25 gibt es zwei Koordinationsrollen statt einer, eine Schlüsselvereinbarung mit dem Nachbarschaftshaus und einen Aushang, der Ausfälle eine Woche vorher ankündigt. Bis zum Sommer 2025 haben sich die Zahlen erholt. Ob die Regelung auch den nächsten Wechsel übersteht, ist damit nicht erwiesen: Die jetzige Koordination beendet ihr Studium im März 2026."}]}'),
	('7e570011-0000-4000-8000-000000000023', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Im September saßen wir zu dritt da und haben ernsthaft überlegt, ob wir den Donnerstag streichen."}]}]}'),
	('7e570011-0000-4000-8000-000000000024', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Modellfahrzeug für den Carolo-Cup 2026","index":0},{"level":2,"text":"Aufbau des Fahrzeugs","index":1},{"level":2,"text":"Warum wir das neuronale Netz verworfen haben","index":2},{"level":2,"text":"Der Lauf in Braunschweig","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000024', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Modellfahrzeug für den Carolo-Cup 2026"}]}'),
	('7e570011-0000-4000-8000-000000000024', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000024","alt":"Titelbild des Projekts Modellfahrzeug für den Carolo-Cup 2026","caption":"Ein autonomes Modellfahrzeug im Maßstab 1:10 für den Carolo-Cup: Spurerkennung über eine einzelne Kamera, Einparken in eine Lücke zwischen zwei Kartons, gebaut von fünf Studierenden im Labor an der F…","width":100}}'),
	('7e570011-0000-4000-8000-000000000024', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau des Fahrzeugs"}]}'),
	('7e570011-0000-4000-8000-000000000024', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Basis ist ein käufliches RC-Chassis im Maßstab 1:10, auf dem eine gefräste Aluminiumplatte sitzt. Darauf ist alles verschraubt, was das Fahrzeug an Bord haben muss. Gebaut haben wir zwischen Januar und Mai 2026 im Labor an der Flughafenallee, meist donnerstags und an einigen Wochenenden. Die Leistungselektronik hat ein Kommilitone aus dem sechsten Semester gelötet, der vorher zwei Jahre bei einem Bremer Zulieferer gearbeitet hat."}]}'),
	('7e570011-0000-4000-8000-000000000024', 5, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chassis 1:10 mit bürstenlosem Antrieb, softwareseitig auf 4 Meter je Sekunde gedrosselt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kamera mit 120 Grad Blickwinkel, 60 Bilder je Sekunde, starr über der Vorderachse"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rechenmodul mit GPU, etwa so groß wie eine Zigarettenschachtel, 15 Watt Leistungsaufnahme"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mikrocontroller für Lenkservo und Motorregler, angebunden über USB"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Lithium-Polymer-Akku mit 5.000 Milliamperestunden, gut für 25 Minuten Fahrt"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000024', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum wir das neuronale Netz verworfen haben"}]}'),
	('7e570011-0000-4000-8000-000000000024', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Fahrbahn im Wettbewerb ist schwarz mit weißen Begrenzungslinien, die Mittellinie ist gestrichelt. Unser erster Ansatz war ein neuronales Netz, das die Fahrspur direkt aus dem Kamerabild schätzt. Nach sechs Wochen haben wir ihn aufgegeben. Uns fehlten Trainingsbilder: Die rund 400 Aufnahmen aus dem Labor deckten weder fremde Bodenbeläge noch andere Lichtverhältnisse ab, und das Netz versagte auf jeder Strecke, die wir nicht selbst geklebt hatten."}]}'),
	('7e570011-0000-4000-8000-000000000024', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gefahren sind wir am Ende mit klassischer Bildverarbeitung. Das Bild wird auf die Fahrbahnebene entzerrt, danach sucht der Algorithmus zeilenweise nach Helligkeitssprüngen und legt eine Kurve durch die gefundenen Punkte. Das ist weniger elegant, lief auf dem kleinen Rechenmodul aber in 9 Millisekunden und war im Fehlerfall nachvollziehbar. Bei einem Netz hätten wir nach jedem Aussetzer nur raten können."}]}'),
	('7e570011-0000-4000-8000-000000000024', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Lauf in Braunschweig"}]}'),
	('7e570011-0000-4000-8000-000000000024', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Einparkwettbewerb hat das Fahrzeug alle drei Versuche bestanden, zweimal beim ersten Anlauf. Im Zeitlauf kam es in der vierten Runde von der Bahn, an genau der Stelle, an der ein Hallenfenster Sonnenlicht auf die Fahrbahn warf. Die Belichtungsautomatik der Kamera regelte nach, der Kontrast zwischen Fahrbahn und Linie brach ein, und die berechnete Kurve zeigte in die Wiese neben der Strecke."}]}'),
	('7e570011-0000-4000-8000-000000000024', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Labor war das nie aufgefallen, weil dort kein Tageslicht hinkommt. Wir haben danach die Belichtungszeit fest eingestellt und einen Test mit einer Baustellenlampe ergänzt. Für den Wettbewerb kam beides zu spät. Platz 9 von 14 geht auf den Zeitlauf zurück, nicht auf das Einparken."}]}'),
	('7e570011-0000-4000-8000-000000000024', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Eure Regelung ist in Ordnung. Ihr habt nur nie bei Sonne getestet, und daran scheitern hier jedes Jahr drei oder vier Teams."}]}]}'),
	('7e570011-0000-4000-8000-000000000025', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Thermografische Rissprüfung an CFK-Proben","index":0},{"level":2,"text":"Fragestellung und Versuchsaufbau","index":1},{"level":2,"text":"Messreihen und Nachweisgrenze","index":2},{"level":2,"text":"Was die Methode nicht leistet","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000025', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Thermografische Rissprüfung an CFK-Proben"}]}'),
	('7e570011-0000-4000-8000-000000000025', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000025","alt":"Titelbild des Projekts Thermografische Rissprüfung an CFK-Proben","caption":"Bachelorarbeit zur zerstörungsfreien Prüfung: Lassen sich Delaminationen in kohlenstofffaserverstärkten Laminaten mit Impuls-Thermografie zuverlässig finden? Vermessen wurden 40 Laborproben, im direk…","width":100}}'),
	('7e570011-0000-4000-8000-000000000025', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Fragestellung und Versuchsaufbau"}]}'),
	('7e570011-0000-4000-8000-000000000025', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Delaminationen in Faserverbundbauteilen sind von außen nicht zu sehen. In der Luftfahrtinstandhaltung ist die Ultraschallprüfung dafür Standard, sie braucht aber ein Koppelmittel und Zugang von einer definierten Seite. Die Impuls-Thermografie kommt ohne Kontakt aus: Die Oberfläche wird mit Blitzlampen erwärmt, eine Infrarotkamera nimmt den Temperaturverlauf auf, und über einer Fehlstelle kühlt die Oberfläche langsamer ab. Die Arbeit prüft, wie klein und wie tief eine Fehlstelle sein darf, damit dieser Unterschied noch messbar ist."}]}'),
	('7e570011-0000-4000-8000-000000000025', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Dafür entstanden 40 Laminatproben aus acht Lagen Kohlenstoffgewebe, jeweils 150 mal 100 Millimeter. Künstliche Fehlstellen wurden als eingelegte Teflonfolien mit 3, 5, 10 und 20 Millimetern Durchmesser in vier verschiedenen Tiefen erzeugt. Zehn Proben blieben fehlerfrei und dienten als Referenz. Gemessen wurde mit einer Infrarotkamera mit 640 mal 512 Pixeln bei 50 Hertz im Labor am Neustadtswall."}]}'),
	('7e570011-0000-4000-8000-000000000025', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Messreihen und Nachweisgrenze"}]}'),
	('7e570011-0000-4000-8000-000000000025', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Jede Probe wurde fünfmal vermessen, um die Streuung zwischen den Durchläufen zu erfassen. Ausgewertet wurde sowohl das Rohbild als auch die Phase nach einer Fourier-Transformation über die Abkühlkurve. Der Phasenkontrast war in allen Tiefen deutlicher als der reine Temperaturkontrast, besonders bei den tiefer liegenden Fehlstellen. Die Ultraschallprüfung an derselben Probenserie diente als Vergleichsmaßstab."}]}'),
	('7e570011-0000-4000-8000-000000000025', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Nachweisgrenze folgt klar dem Verhältnis von Durchmesser zu Tiefe. Fehlstellen mit 10 und 20 Millimetern wurden in allen vier Tiefen gefunden. Bei 5 Millimetern gelang das nur bis 1,2 Millimeter Tiefe, bei 3 Millimetern in keiner Tiefe zuverlässig. Der Ultraschall fand auch die kleinsten Einlagen, brauchte pro Probe aber etwa das Zwölffache an Zeit."}]}'),
	('7e570011-0000-4000-8000-000000000025', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Abstand der Blitzlampen: schon 5 Zentimeter Unterschied verschoben den Kontrast merklich"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Oberfläche: matt schwarz lackierte Proben lieferten stabilere Werte als unbehandelte"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bildrate: unter 25 Hertz war die frühe Abkühlphase nicht mehr aufgelöst"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Labortemperatur, die zwischen den Messterminen um bis zu 6 Kelvin schwankte"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000025', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Methode nicht leistet"}]}'),
	('7e570011-0000-4000-8000-000000000025', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Eingelegte Teflonfolien sind kein echter Schaden. Sie haben scharfe Ränder, eine definierte Dicke und liegen parallel zur Oberfläche, während ein Schlagschaden im Bauteil verzweigt und sich über mehrere Lagen verteilt. Die ermittelten Grenzwerte sind deshalb eher optimistisch. Ein Versuch mit vier fallgewichtsgeschädigten Proben am Ende der Arbeit bestätigte das: Zwei Schäden waren im Phasenbild sichtbar, zwei nicht, obwohl der Ultraschall bei allen vier anschlug."}]}'),
	('7e570011-0000-4000-8000-000000000025', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Praxis heißt das, dass die Thermografie hier als schnelle Vorprüfung taugt und nicht als Ersatz. Eine Fläche von einem halben Quadratmeter war in unter drei Minuten aufgenommen. Auffällige Stellen lassen sich anschließend gezielt mit Ultraschall nachprüfen, statt das ganze Bauteil abzufahren. Genau so ist die Methode in der Arbeit auch empfohlen."}]}'),
	('7e570011-0000-4000-8000-000000000025', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wenn die Kamera nichts sieht, heißt das nicht, dass da nichts ist. Der Satz steht jetzt so in der Arbeit, und er soll auch so drinstehen."}]}]}'),
	('7e570011-0000-4000-8000-000000000026', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Zahlungsbereitschaft für Mehrwegbecher in Bremer Cafés","index":0},{"level":2,"text":"Ausgangspunkt","index":1},{"level":2,"text":"Erhebung","index":2},{"level":2,"text":"Was herauskam","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000026', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Zahlungsbereitschaft für Mehrwegbecher in Bremer Cafés"}]}'),
	('7e570011-0000-4000-8000-000000000026', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000026","alt":"Titelbild des Projekts Zahlungsbereitschaft für Mehrwegbecher in Bremer Cafés","caption":"Forschungsprojekt zur Zahlungsbereitschaft für Mehrwegbecher: 412 Passantinnen und Passanten in der Bremer Innenstadt beantworteten ein Choice-Experiment zu Pfandhöhe und Rückgabeweg, dazu kamen Leit…","width":100}}'),
	('7e570011-0000-4000-8000-000000000026', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangspunkt"}]}'),
	('7e570011-0000-4000-8000-000000000026', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Seit 2023 müssen Betriebe ab einer bestimmten Größe eine Mehrwegvariante anbieten. In Bremen tun das viele, genutzt wird sie selten. Eine eigene Zählung im Vorfeld ergab an drei Vormittagen in der Sögestraße 41 Mehrwegbecher gegenüber 706 Einwegbechern. Die Frage des Projekts lautete deshalb nicht, ob ein Angebot besteht, sondern unter welchen Bedingungen die Kundschaft es annimmt."}]}'),
	('7e570011-0000-4000-8000-000000000026', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Stellschrauben lagen nahe: die Höhe des Pfands und der Aufwand der Rückgabe. Beide lassen sich in einem Choice-Experiment gegeneinanderstellen, sodass sich aus den Entscheidungen ein Geldwert für die zusätzliche Wegstrecke schätzen lässt. Der Zuschnitt entstand nach einem Vorgespräch mit der Umweltbehörde, die für eine mögliche Ausweitung des städtischen Pfandsystems Zahlen brauchte und ausdrücklich keine weitere Umfrage zum Umweltbewusstsein."}]}'),
	('7e570011-0000-4000-8000-000000000026', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Erhebung"}]}'),
	('7e570011-0000-4000-8000-000000000026', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Befragt wurde an sechs Tagen im Mai und Juni 2025, verteilt über Vormittag und Nachmittag. Jede Person bekam acht Auswahlsituationen mit je zwei Bechervarianten und einer Ablehnungsoption vorgelegt. Ausgewertet wurde mit einem gemischten Logit-Modell in R. Die Betriebsinterviews liefen parallel und dienten dazu, die Ergebnisse an der Praxis hinter dem Tresen zu spiegeln."}]}'),
	('7e570011-0000-4000-8000-000000000026', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"412 vollständige Interviews, mittlere Dauer sechs Minuten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Standorte: Sögestraße, Domshof und Vorplatz des Hochschulstandorts Werderstraße"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Pfandhöhe variiert über 1, 2, 3 und 5 Euro"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rückgabeweg variiert über „gleiches Café“, „jedes Café im Viertel“ und „Automat am Hauptbahnhof“"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"14 Leitfadeninterviews mit Betrieben, davon vier Filialen von Ketten"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000026', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was herauskam"}]}'),
	('7e570011-0000-4000-8000-000000000026', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Zahlungsbereitschaft liegt im Modell bei durchschnittlich 1,80 Euro Pfand, bricht aber ein, sobald die Rückgabe an das ausgebende Café gebunden ist. Ein offenes Rücknahmenetz war den Befragten im Mittel 1,10 Euro wert und damit mehr als ein um zwei Euro niedrigeres Pfand. Wer selten Kaffee unterwegs kauft, entschied fast ausschließlich über den Rückgabeweg."}]}'),
	('7e570011-0000-4000-8000-000000000026', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Gespräche in den Betrieben brachten ein Hindernis zutage, das in der Befragung überhaupt nicht vorkam. Der Engpass ist nicht das Geld und auch nicht der Platz im Regal, sondern die Spülkapazität in der Mittagszeit. Vier der 14 Betriebe gaben an, Mehrweg zwar auszuweisen, es an vollen Tagen aber aktiv abzuwenden."}]}'),
	('7e570011-0000-4000-8000-000000000026', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Das Pfand nehme ich gern zurück. Aber ich habe eine Spülmaschine, und die läuft mittags schon für das Geschirr."}]}]}'),
	('7e570011-0000-4000-8000-000000000027', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Web-Rundgang durch Speicher XI aus Laserscans","index":0},{"level":2,"text":"Ein Speicher, der sich schlecht fotografieren lässt","index":1},{"level":2,"text":"Aufnahme und Registrierung","index":2},{"level":2,"text":"Was die Punktwolke nicht kann","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000027', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Web-Rundgang durch Speicher XI aus Laserscans"}]}'),
	('7e570011-0000-4000-8000-000000000027', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000027","alt":"Titelbild des Projekts Web-Rundgang durch Speicher XI aus Laserscans","caption":"Aus 38 Laserscans des Speichers XI in der Überseestadt entstand ein Rundgang, der sich im Browser begehen lässt. Das Projekt zeigt, wo eine Punktwolke Baugeschichte vermitteln kann und an welchen Ste…","width":100}}'),
	('7e570011-0000-4000-8000-000000000027', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ein Speicher, der sich schlecht fotografieren lässt"}]}'),
	('7e570011-0000-4000-8000-000000000027', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Speicher XI in der Überseestadt ist mehrere hundert Meter lang und innen so schmal und dunkel, dass Fotos die Raumwirkung kaum wiedergeben. Für die Lehrveranstaltung zur Bauaufnahme war das der Anlass, das Gebäude terrestrisch zu scannen und daraus einen begehbaren Rundgang für den Browser zu bauen. Der Zugang lief über die Hausverwaltung, die den Ostflügel an drei Samstagen im November freigab."}]}'),
	('7e570011-0000-4000-8000-000000000027', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Rundgang richtet sich nicht an Fachleute, sondern an Besucherinnen und Besucher des Hafenmuseums. Deshalb steht nicht die Messgenauigkeit im Vordergrund, sondern die Frage, ob eine Punktwolke ohne Farbe eine Vorstellung vom Raum vermittelt. Zwölf Personen haben den Prototyp am Laptop durchlaufen und danach beschrieben, was sie gesehen zu haben glaubten."}]}'),
	('7e570011-0000-4000-8000-000000000027', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufnahme und Registrierung"}]}'),
	('7e570011-0000-4000-8000-000000000027', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Verwendet wurde der Laserscanner der Fakultät, der sonst in den Vermessungsübungen belegt ist. 38 Standpunkte ergaben nach der Registrierung rund 1,4 Milliarden Punkte, die auf 90 Millionen ausgedünnt wurden, damit die Datei im Browser überhaupt lädt. Die Registrierung über gemeinsame Merkmale scheiterte im Treppenhaus, weil dort zu wenig Struktur vorhanden ist; erst zusätzliche Zielmarken brachten ein brauchbares Ergebnis."}]}'),
	('7e570011-0000-4000-8000-000000000027', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"38 Scanstandpunkte an drei Aufnahmetagen, je Standpunkt rund sieben Minuten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"1,4 Milliarden Rohpunkte, im Web-Modell auf 90 Millionen reduziert"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Registrierungsfehler im Mittel 4 Millimeter, im Treppenhaus 19 Millimeter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Darstellung über WebGL, Ladezeit auf einem sechs Jahre alten Laptop 22 Sekunden"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000027', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Punktwolke nicht kann"}]}'),
	('7e570011-0000-4000-8000-000000000027', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Stellen bleiben unbrauchbar. Die verglaste Verbindung zum Nachbartrakt erzeugt Geisterpunkte hinter der Scheibe, weil der Strahl teils durchgeht und teils zurückgeworfen wird. Die schwarz gestrichenen Stahlträger im Erdgeschoss liefern so wenig Signal, dass sie im Modell als Lücken erscheinen. Beides ließe sich mit Fotogrammetrie ergänzen, dafür reichte die Zeit im Semester nicht."}]}'),
	('7e570011-0000-4000-8000-000000000027', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In den Durchläufen fiel auf, dass die fehlende Farbe weniger störte als erwartet. Sechs von zwölf Personen fanden die graue Punktwolke sogar ruhiger als ein Foto, weil das Auge nicht von Beschriftungen und herumstehendem Baumaterial abgelenkt wird. Vier Personen verloren dagegen die Orientierung, sobald sie sich um die eigene Achse drehten, und wünschten sich einen festen Grundriss am Bildrand."}]}'),
	('7e570011-0000-4000-8000-000000000027', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ohne die Farbe sieht man endlich die Konstruktion. Auf den Fotos aus dem Archiv guckt man immer nur auf die Kisten, die gerade herumstehen."}]}]}'),
	('7e570011-0000-4000-8000-000000000028', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Aufsuchende Beratung in Gröpelingen","index":0},{"level":2,"text":"Anlass des Seminarprojekts","index":1},{"level":2,"text":"Erhebung im Quartier","index":2},{"level":2,"text":"Befunde und Grenzen","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000028', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Aufsuchende Beratung in Gröpelingen"}]}'),
	('7e570011-0000-4000-8000-000000000028', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000028","alt":"Titelbild des Projekts Aufsuchende Beratung in Gröpelingen","caption":"Seminarprojekt zur aufsuchenden Sozialberatung in Bremen-Gröpelingen. Untersucht wurde, ob Beratung an Alltagsorten Menschen erreicht, die den Weg in die Beratungsstelle nicht gehen. Grundlage sind 1…","width":100}}'),
	('7e570011-0000-4000-8000-000000000028', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Anlass des Seminarprojekts"}]}'),
	('7e570011-0000-4000-8000-000000000028', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Eine Beratungsstelle in Gröpelingen berichtete im Seminar von einem bekannten Muster: Die Sprechstunden sind gut besucht, aber immer von denselben Leuten. Wer Schichtdienst hat, wer sich vor Behördenpost fürchtet oder wer das Angebot schlicht nicht kennt, taucht dort nicht auf. Im Sommersemester 2026 hat unsere Gruppe deshalb geprüft, ob eine Beratung, die an Alltagsorte im Quartier geht, andere Menschen erreicht als die Komm-Struktur in der Beratungsstelle. Die Lehrveranstaltung gab dafür acht Wochen Feldzeit vor."}]}'),
	('7e570011-0000-4000-8000-000000000028', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Fragestellung ist bewusst eng gehalten. Es ging nicht um die Wirkung der Beratung selbst, sondern nur um die vorgelagerte Frage, wer überhaupt in Kontakt kommt und unter welchen Umständen ein Gespräch zustande kommt. Die Beratungsstelle stellte für die Termine eine Fachkraft ab, damit auf eine konkrete Frage sofort eine belastbare Auskunft folgen konnte und niemand mit einer Vertröstung nach Hause ging."}]}'),
	('7e570011-0000-4000-8000-000000000028', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Erhebung im Quartier"}]}'),
	('7e570011-0000-4000-8000-000000000028', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Wir haben mit der Beratungsstelle drei Standorte verabredet und dort je sechs Termine mit einem Tisch und einem Schild besetzt, immer zu zweit, immer zwei Stunden. Aufgezeichnet wurde nichts; die Kurzinterviews entstanden als Gedächtnisprotokoll direkt nach dem Gespräch. Der vierte geplante Standort auf dem Wochenmarkt wurde nach zwei Terminen aufgegeben. Dort war es zu laut, und wer über Mietschulden reden wollte, tat das nicht zwischen zwei Marktständen. Diese Absage gehört zu den klarsten Befunden des Projekts."}]}'),
	('7e570011-0000-4000-8000-000000000028', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"drei feste Standorte: Stadtteilbibliothek, Waschsalon, Supermarkteingang"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"18 Termine zu je zwei Stunden zwischen April und Juni 2026"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"14 Kurzinterviews als Gedächtnisprotokoll"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"fünf Leitfadeninterviews mit Fachkräften der Beratungsstelle"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"ein abgebrochener Standort auf dem Wochenmarkt"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000028', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Befunde und Grenzen"}]}'),
	('7e570011-0000-4000-8000-000000000028', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Am Waschsalon kam mit Abstand am meisten zustande: neun der 14 Gespräche, meist während der Wartezeit an der Trommel. Der Ort liefert eine plausible Begründung fürs Dableiben, und niemand muss erklären, warum er dort steht. In der Bibliothek richteten sich Fragen dagegen fast nur auf Formulare, nicht auf die eigene Lage. Am Supermarkt blieb es bei kurzen Auskünften im Vorbeigehen. Die Fachkräfte bestätigten den Eindruck, dass Wartezeit und ein Rest Privatheit mehr zählen als bloße Laufkundschaft."}]}'),
	('7e570011-0000-4000-8000-000000000028', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Reichweite der Aussagen ist begrenzt. 14 Gespräche in acht Wochen tragen keine Verallgemeinerung, die Auswahl ist durch Uhrzeit und Wetter verzerrt, und die Protokolle geben nur wieder, was wir im Nachhinein erinnert haben. Der Bericht schlägt deshalb keine Umstellung der Beratungsstelle vor, sondern eine Erprobung über zwei Semester zur festen Uhrzeit am selben Ort."}]}'),
	('7e570011-0000-4000-8000-000000000028', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Hier warte ich sowieso vierzig Minuten, da kann ich auch fragen. In die Beratungsstelle wäre ich nicht gegangen."}]}]}'),
	('7e570011-0000-4000-8000-000000000029', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Vibrationsüberwachung an einer Verpackungsmaschine","index":0},{"level":2,"text":"Aufgabe im Betrieb","index":1},{"level":2,"text":"Aufbau und Messkampagne","index":2},{"level":2,"text":"Was die Daten hergaben","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000029', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Vibrationsüberwachung an einer Verpackungsmaschine"}]}'),
	('7e570011-0000-4000-8000-000000000029', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000029","alt":"Titelbild des Projekts Vibrationsüberwachung an einer Verpackungsmaschine","caption":"Praxisprojekt bei einem Bremer Anlagenbauer: An der Vorführmaschine wurden Beschleunigungssensoren nachgerüstet, um Lagerschäden früher zu erkennen. Der Bericht beschreibt Messaufbau, Auswertung und…","width":100}}'),
	('7e570011-0000-4000-8000-000000000029', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgabe im Betrieb"}]}'),
	('7e570011-0000-4000-8000-000000000029', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Betrieb fertigt Verpackungsanlagen für die Lebensmittelindustrie und hält in der eigenen Halle eine Vorführmaschine bereit. Zweimal im vergangenen Jahr fiel dort ein Wälzlager im Siegelbalken aus, jeweils ohne Vorwarnung und jeweils während einer Kundenvorführung. Die Instandhaltung wollte wissen, ob sich ein solcher Schaden über Schwingungsmessung ankündigt und ob der Aufwand dafür im Verhältnis zum Nutzen steht. Das Projekt lief über ein Semester mit zwei Tagen pro Woche im Betrieb."}]}'),
	('7e570011-0000-4000-8000-000000000029', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau und Messkampagne"}]}'),
	('7e570011-0000-4000-8000-000000000029', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Drei einachsige Beschleunigungssensoren wurden am Lagerbock, am Antriebsmotor und am Rahmen verklebt und über einen Mikrocontroller mit 20 Kilohertz Abtastrate ausgelesen. Die Rohdaten liefen auf einen Industrie-PC, dort entstanden je Minute ein Effektivwert und ein Hüllkurvenspektrum. Die Maschine lief in dieser Zeit nicht durchgehend, sondern in Schichten von zwei bis sechs Stunden. Über elf Wochen kamen 380 Betriebsstunden zusammen."}]}'),
	('7e570011-0000-4000-8000-000000000029', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Drei Beschleunigungssensoren, Abtastrate 20 Kilohertz"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Auswertung über Effektivwert und Hüllkurvenspektrum"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"380 Betriebsstunden über elf Wochen aufgezeichnet"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Referenzmessung mit dem Handmessgerät der Instandhaltung"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000029', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Daten hergaben"}]}'),
	('7e570011-0000-4000-8000-000000000029', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Lagerfrequenzen ließen sich im Hüllkurvenspektrum sauber trennen, solange die Maschine im Dauerbetrieb lief. Beim Anfahren und beim Formatwechsel überlagerten Stöße aus der Schneideinheit das Signal so stark, dass die Auswertung unbrauchbar wurde. Ein Filter über die Drehzahl der Hauptwelle half nur teilweise, weil das Drehzahlsignal aus der Steuerung nur alle zwei Sekunden bereitsteht. Rund ein Drittel der aufgezeichneten Zeit fiel dadurch aus der Bewertung heraus."}]}'),
	('7e570011-0000-4000-8000-000000000029', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein Lagerschaden trat im Projektzeitraum nicht auf, der Nachweis der Früherkennung steht also aus. Belastbar ist bisher nur, dass die Messkette elf Wochen ohne Ausfall lief und dass die Materialkosten bei 610 Euro lagen. Die Instandhaltung übernimmt den Aufbau für die zweite Vorführmaschine und misst weiter, bis ein Lager tatsächlich ausfällt. Erst dann lässt sich sagen, ob die Kennwerte vorher ansteigen."}]}'),
	('7e570011-0000-4000-8000-000000000029', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechshundert Euro Material sind billiger als eine abgebrochene Vorführung. Ob es wirklich trägt, wissen wir aber erst nach dem nächsten Lagerschaden."}]}]}'),
	('7e570011-0000-4000-8000-000000000030', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Feinstaubbindung durch Moosmodule an der Werderstraße","index":0},{"level":2,"text":"Aufbau an der Fassade","index":1},{"level":2,"text":"Zwölf Wochen Messreihe","index":2},{"level":2,"text":"Was daraus abzulesen ist","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000030', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Feinstaubbindung durch Moosmodule an der Werderstraße"}]}'),
	('7e570011-0000-4000-8000-000000000030', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000030","alt":"Titelbild des Projekts Feinstaubbindung durch Moosmodule an der Werderstraße","caption":"Semesterprojekt zur Feinstaubbindung durch Moos. Sechs bepflanzte Module hingen zwölf Wochen an einer Fassade an der Werderstraße, daneben lief eine Referenzmessung. Der Bericht nennt auch die Woche,…","width":100}}'),
	('7e570011-0000-4000-8000-000000000030', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau an der Fassade"}]}'),
	('7e570011-0000-4000-8000-000000000030', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Werderstraße führt dicht an den Laborgebäuden vorbei; an Werktagen zählt die Verkehrsbehörde dort gut 18.000 Fahrzeuge. Für das Semesterprojekt hingen sechs Module mit Drehmoos an der straßenzugewandten Fassade in 2,5 Metern Höhe, dazu drei unbepflanzte Module gleicher Bauart als Referenz. Die Halterung entstand in der Werkstatt der Fakultät, die Substratmischung stammt aus einem Vorgängerprojekt und wurde unverändert übernommen."}]}'),
	('7e570011-0000-4000-8000-000000000030', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gemessen wurde mit zwei optischen Partikelzählern, einem je Modulreihe, ergänzt um Temperatur und Luftfeuchte im Modul. Die Geräte liefen im Zehn-Minuten-Takt auf einen Kleinrechner im Technikraum. Ein Zähler musste nach vier Wochen getauscht werden, weil der Lüfter ausfiel. Die Lücke von 39 Stunden steht so im Datensatz und wurde nicht interpoliert."}]}'),
	('7e570011-0000-4000-8000-000000000030', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Zwölf Wochen Messreihe"}]}'),
	('7e570011-0000-4000-8000-000000000030', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Messreihe lief vom 28. April bis zum 21. Juli 2025. Ausgewertet wurden Tagesmittelwerte für PM10 und PM2,5, jeweils im Vergleich zwischen bepflanzter und unbepflanzter Reihe. Zusätzlich wurden alle zwei Wochen Moosproben genommen, getrocknet und gewogen, um die Staubauflage auf der Pflanze selbst zu bestimmen. Die Probenahme übernahm immer dieselbe Person, damit die Entnahmestellen vergleichbar blieben."}]}'),
	('7e570011-0000-4000-8000-000000000030', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs Module mit Drehmoos, drei Referenzmodule ohne Bepflanzung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Partikelmessung im Zehn-Minuten-Takt über zwölf Wochen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Moosproben alle zwei Wochen, Trocknung bei 40 Grad, Wägung im Labor"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Wetterdaten der Station Bremen-Neustadt für Wind und Niederschlag"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Wöchentliche Sichtkontrolle mit Fotoprotokoll je Modul"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000030', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was daraus abzulesen ist"}]}'),
	('7e570011-0000-4000-8000-000000000030', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Staubauflage auf den Moosproben nahm über die zwölf Wochen zu, im Mittel um 0,34 Gramm je Modul. In der Luftmessung dagegen lag die Differenz zwischen bepflanzter und unbepflanzter Reihe bei 1,8 Prozent für PM10 und damit innerhalb der Streuung der beiden Geräte. Aus diesen Daten lässt sich also nicht belegen, dass die Module die Belastung an der Straße senken. Nachweisbar ist nur, dass das Moos Staub aufnimmt."}]}'),
	('7e570011-0000-4000-8000-000000000030', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Dazu kommt ein handwerklicher Fehler. In der Hitzewoche Ende Juni fiel die Zeitschaltuhr der Bewässerung aus, zwei Module trockneten aus und erholten sich nicht mehr. Aufgefallen ist das erst bei der Sichtkontrolle vier Tage später, ihre Werte gehen ab dem 24. Juni nicht mehr in die Auswertung ein. Für eine Fortsetzung wäre eine Feuchtemessung mit Alarm die erste Änderung, noch vor jeder Verfeinerung der Auswertung."}]}'),
	('7e570011-0000-4000-8000-000000000031', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Workshopreihe zur Steuererklärung an der Werderstraße","index":0},{"level":2,"text":"Woher die Idee kam","index":1},{"level":2,"text":"Ablauf der Abende","index":2},{"level":2,"text":"Wo die Reihe an eine Grenze kam","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000031', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Workshopreihe zur Steuererklärung an der Werderstraße"}]}'),
	('7e570011-0000-4000-8000-000000000031', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000031","alt":"Titelbild des Projekts Workshopreihe zur Steuererklärung an der Werderstraße","caption":"Eine studentische Initiative an der Werderstraße hat im Wintersemester 2025/26 sechs Abende zur Steuererklärung veranstaltet, vor allem zum Verlustvortrag für Studierende ohne eigenes Einkommen. Der…","width":100}}'),
	('7e570011-0000-4000-8000-000000000031', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Woher die Idee kam"}]}'),
	('7e570011-0000-4000-8000-000000000031', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Sommersemester 2025 haben wir in zwei Vorlesungen gefragt, wer schon einmal eine Steuererklärung abgegeben hat. Von 148 Antwortenden waren es 21. Den meisten war nicht bekannt, dass sich Ausgaben wie der Semesterbeitrag oder Fachliteratur als Verlust vortragen lassen und beim ersten Gehalt nach dem Abschluss gegengerechnet werden. Daraus wurde eine Reihe von sechs Abenden im Wintersemester, angekündigt über die Fachschaft und einen Aushang im Foyer an der Werderstraße."}]}'),
	('7e570011-0000-4000-8000-000000000031', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ablauf der Abende"}]}'),
	('7e570011-0000-4000-8000-000000000031', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Jeder Abend war zweigeteilt: 40 Minuten Erklärung am Beamer, danach zwei Stunden, in denen die Teilnehmenden am eigenen Laptop weiterkamen und wir von Platz zu Platz gingen. Angemeldet waren im Schnitt 34 Personen, gekommen sind 23. Zum vierten Termin brachten mehrere ihre Unterlagen ungeordnet in einer Tüte mit, weshalb wir ab Januar vorab eine Liste der nötigen Belege verschickt haben."}]}'),
	('7e570011-0000-4000-8000-000000000031', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"sechs Termine zwischen Oktober und Januar, jeweils mittwochs ab 18 Uhr"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Elster als Programm, weil es nichts kostet und kein Konto bei einem Anbieter verlangt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Belegliste vorab per Mail, ab dem fünften Termin auch als Aushang an der Tafel"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"zwei Studierende aus dem fünften Semester je Abend, dazu eine Person am Einlass"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000031', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wo die Reihe an eine Grenze kam"}]}'),
	('7e570011-0000-4000-8000-000000000031', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Dezember wies uns eine Steuerberaterin darauf hin, dass das Ausfüllen fremder Erklärungen unter das Steuerberatungsgesetz fällt und uns nicht erlaubt ist. Die letzten beiden Abende haben wir deshalb umgebaut: Gezeigt wird seitdem nur noch ein Beispielfall an der Leinwand, Fragen zu den eigenen Unterlagen beantworten wir nicht mehr. Zwei Angemeldete sind daraufhin gegangen, die übrigen blieben bis zum Schluss."}]}'),
	('7e570011-0000-4000-8000-000000000031', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Von den 63 Personen, die mindestens einmal da waren, haben im Februar 38 auf eine Nachfrage per Mail geantwortet; 29 von ihnen hatten die Erklärung abgeschickt. Was dabei herauskommt, wissen wir nicht, weil die Bescheide erst im Frühjahr eintreffen. Für das Sommersemester suchen wir eine Steuerberaterin, die einen Abend begleitet und die Fragen übernimmt, die wir nicht beantworten dürfen."}]}'),
	('7e570011-0000-4000-8000-000000000031', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich hätte nicht gedacht, dass sich das lohnt, solange ich gar nichts verdiene."}]}]}'),
	('7e570011-0000-4000-8000-000000000032', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Kühle Wege durch die Neustadt","index":0},{"level":2,"text":"Warum die Neustadt","index":1},{"level":2,"text":"Messkampagne im Juli","index":2},{"level":2,"text":"Vom Messwert zum Wegenetz","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000032', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Kühle Wege durch die Neustadt"}]}'),
	('7e570011-0000-4000-8000-000000000032', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000032","alt":"Titelbild des Projekts Kühle Wege durch die Neustadt","caption":"Ein Wettbewerbsbeitrag zur Hitzevorsorge in der Bremer Neustadt. An 18 Messpunkten zwischen Werdersee und Buntentorsteinweg wurde im Juli die Oberflächentemperatur erfasst, daraus entstand ein Netz b…","width":100}}'),
	('7e570011-0000-4000-8000-000000000032', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum die Neustadt"}]}'),
	('7e570011-0000-4000-8000-000000000032', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Bremer Neustadt ist dicht bebaut und überwiegend versiegelt. Auf einen Kilometer Straße kommen nach dem Baumkataster gut 60 Straßenbäume, in Schwachhausen sind es fast doppelt so viele. Der Deutsche Wetterdienst zählt für Bremen im langjährigen Mittel gut fünf heiße Tage im Jahr, im Sommer 2022 waren es dreizehn. Wo Menschen sich tagsüber bewegen müssen, etwa auf dem Weg zur Apotheke oder zur Haltestelle, entscheidet die Beschattung darüber, ob dieser Weg zumutbar bleibt."}]}'),
	('7e570011-0000-4000-8000-000000000032', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Wettbewerb, für den die Arbeit entstanden ist, fragte nach Vorschlägen für den Bestand und ausdrücklich nicht nach Neubauquartieren. Das passte zur Ausgangslage: In der Neustadt lässt sich kaum etwas hinzufügen, sondern nur umverteilen. Jeder zusätzliche Baum steht auf einem Stellplatz, jede entsiegelte Fläche war vorher Parkstand oder Gehwegplatte."}]}'),
	('7e570011-0000-4000-8000-000000000032', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Messkampagne im Juli"}]}'),
	('7e570011-0000-4000-8000-000000000032', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Vom 6. bis zum 24. Juli 2026 wurden an 18 Punkten Oberflächentemperaturen mit einer Wärmebildkamera aufgenommen, jeweils um 8, um 14 und um 19 Uhr. Ergänzend liefen an vier Punkten Datenlogger für Lufttemperatur und Luftfeuchte durch. Die Punkte lagen bewusst nicht auf den bekannten Hitzeinseln, sondern entlang von vier Wegen, die Anwohnerinnen und Anwohner in einer Vorbefragung als ihre alltäglichen Strecken genannt hatten."}]}'),
	('7e570011-0000-4000-8000-000000000032', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"18 Messpunkte auf vier Alltagswegen, Länge zwischen 380 und 950 Metern"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Drei Messzeitpunkte je Tag an 19 Messtagen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Höchstwert 58,4 Grad auf Asphalt am Buntentorsteinweg um 14 Uhr"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Tiefstwert 31,2 Grad unter Lindenbestand am Werdersee zur gleichen Uhrzeit"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vier Datenlogger im Dauerbetrieb, Aufzeichnung alle zehn Minuten"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000032', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vom Messwert zum Wegenetz"}]}'),
	('7e570011-0000-4000-8000-000000000032', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aus den Messwerten entstand keine Hitzekarte, sondern eine Auswahl. Vorgeschlagen werden 26 Baumstandorte und 340 Quadratmeter entsiegelter Gehweg, verteilt so, dass auf jedem der vier Wege höchstens 120 Meter ohne Schatten bleiben. Die Standorte kosten 31 Stellplätze, was im Beitrag ausgewiesen und nicht kleingeredet wird. Drei Trinkbrunnen sind ergänzend vorgeschlagen, aber nicht Teil der Kostenrechnung."}]}'),
	('7e570011-0000-4000-8000-000000000032', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In der Rückkopplung mit dem Beirat Neustadt war genau dieser Punkt strittig. Der Vorschlag, die Bäume in die Fahrbahn statt in den Gehweg zu setzen, kam aus dieser Runde und ist übernommen worden, weil er die Gehwegbreite von 1,80 Metern erhält, die für Rollator und Kinderwagen nötig ist."}]}'),
	('7e570011-0000-4000-8000-000000000032', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Schatten ist nett, aber wenn dafür der Gehweg schmaler wird, komme ich mit dem Rollator nicht mehr durch."}]}]}'),
	('7e570011-0000-4000-8000-000000000033', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Ehrenamtliche Mitarbeit in der Bremer Kältehilfe","index":0},{"level":2,"text":"Feld und Fragestellung","index":1},{"level":2,"text":"Was die Interviews zeigen","index":2},{"level":2,"text":"Was sich mit dem Dienstplan ändern lässt","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000033', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Ehrenamtliche Mitarbeit in der Bremer Kältehilfe"}]}'),
	('7e570011-0000-4000-8000-000000000033', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000033","alt":"Titelbild des Projekts Ehrenamtliche Mitarbeit in der Bremer Kältehilfe","caption":"Die Bremer Kältehilfe verliert jeden Winter etwa die Hälfte ihrer neu gewonnenen Ehrenamtlichen. Die Arbeit untersucht anhand von 23 Interviews und zwei mitlaufenden Nachtschichten, an welcher Stelle…","width":100}}'),
	('7e570011-0000-4000-8000-000000000033', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Feld und Fragestellung"}]}'),
	('7e570011-0000-4000-8000-000000000033', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen November 2024 und März 2025 betrieben vier Träger in Bremen gemeinsam 62 Notschlafplätze, im Nachtdienst überwiegend getragen von Ehrenamtlichen. Die Trägerstatistik zeigt seit Jahren dasselbe Muster: Von den Personen, die sich im Oktober melden und die Einweisung besuchen, steht im Februar noch etwa die Hälfte im Dienstplan. Bislang wurde das mit Zeitmangel erklärt. Die Arbeit prüft, ob diese Erklärung trägt."}]}'),
	('7e570011-0000-4000-8000-000000000033', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Erhoben wurde in zwei Schritten. Zuerst 23 leitfadengestützte Interviews, davon 9 mit Personen, die aufgehört hatten, und 14 mit solchen, die geblieben sind. Dazu kamen zwei mitlaufende Nachtschichten in einer Einrichtung in der Neustadt, protokolliert von 21 bis 7 Uhr. Die Ausgestiegenen waren am schwersten zu erreichen: Von 31 angefragten Personen antworteten 9, was die Aussagekraft dieser Gruppe begrenzt."}]}'),
	('7e570011-0000-4000-8000-000000000033', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Interviews zeigen"}]}'),
	('7e570011-0000-4000-8000-000000000033', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zeitmangel wurde genannt, aber selten zuerst. Häufiger kam ein anderes Muster: Wer aufhörte, hatte in den ersten vier Wochen mindestens eine Schicht erlebt, in der niemand Erfahrenes dabei war. Eine Frau beschrieb eine Nacht mit einer alkoholisierten Person im Flur und einer Rufnummer, an der niemand abnahm. Sie kam noch zweimal und dann nicht mehr. Wer die ersten Schichten neben einer eingearbeiteten Person verbrachte, blieb dagegen überdurchschnittlich oft bis zum Saisonende."}]}'),
	('7e570011-0000-4000-8000-000000000033', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"9 von 9 Ausgestiegenen hatten früh eine Schicht ohne erfahrene Begleitung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"12 von 14 Bleibenden nennen eine feste Bezugsperson im Team"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zeitmangel fällt in 7 von 9 Fällen erst nach anderen Gründen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Einweisung dauert 90 Minuten und behandelt Deeskalation auf zwei Folien"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000033', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was sich mit dem Dienstplan ändern lässt"}]}'),
	('7e570011-0000-4000-8000-000000000033', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit schlägt vor, die Einsatzplanung als Bindungsinstrument zu behandeln und nicht als Lückenfüllung. Konkret heißt das: Neue werden in den ersten vier Schichten fest an eine erfahrene Person gekoppelt, auch wenn dadurch eine Schicht an anderer Stelle knapp besetzt bleibt. Das ist unbequem, weil es kurzfristig Personen kostet. Über eine Saison gerechnet trägt es sich, sofern die Bindungsquote um mehr als zehn Prozentpunkte steigt."}]}'),
	('7e570011-0000-4000-8000-000000000033', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ob sie das tut, konnte die Arbeit nicht zeigen. Der Vorschlag wurde einem Träger im April 2025 vorgelegt und soll in der Saison 2025/26 an einem Standort erprobt werden. Bis dahin bleibt es eine begründete Vermutung, gestützt auf 23 Gespräche und zwei Nächte im Dienst."}]}'),
	('7e570011-0000-4000-8000-000000000033', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich hatte keine Angst vor der Arbeit. Ich hatte Angst davor, allein zu sein, wenn etwas passiert."}]}]}'),
	('7e570011-0000-4000-8000-000000000034', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Abgebrochene Ladevorgänge an sechs Bremer Ladesäulen","index":0},{"level":2,"text":"Beschwerden ohne Befund","index":1},{"level":2,"text":"Der Mitschnitt","index":2},{"level":2,"text":"137 Abbrüche und ihre Ursachen","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000034', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Abgebrochene Ladevorgänge an sechs Bremer Ladesäulen"}]}'),
	('7e570011-0000-4000-8000-000000000034', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000034","alt":"Titelbild des Projekts Abgebrochene Ladevorgänge an sechs Bremer Ladesäulen","caption":"An sechs öffentlichen Ladesäulen in Bremen haben wir zwei Monate lang den OCPP-Verkehr zwischen Säule und Backend mitgeschnitten. Von 1.184 Ladevorgängen endeten 137 vorzeitig, und die Ursachen lagen…","width":100}}'),
	('7e570011-0000-4000-8000-000000000034', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Beschwerden ohne Befund"}]}'),
	('7e570011-0000-4000-8000-000000000034', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ein Bremer Betreiber öffentlicher Ladesäulen bekommt regelmäßig Beschwerden über abgebrochene Ladevorgänge. Im Backend steht dann eine Meldung, die nichts erklärt, etwa der Grund Other oder ein leeres Feld. Weder der Betreiber noch die Fahrzeugseite sieht, was auf der jeweils anderen Seite passiert ist, deshalb bleibt es meist bei Vermutungen. Wir haben die Verbindung an genau der Stelle mitgelesen, an der beide Seiten aufeinandertreffen."}]}'),
	('7e570011-0000-4000-8000-000000000034', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Forschungsprojekt lief über ein Semester mit zwei Studierenden. Rechtlich war die Vereinbarung der aufwendigste Teil: Der Betreiber musste zustimmen, dass wir uns in die Verbindung zu seinem Backend setzen, und die Kennungen der Ladekarten durften das Messgerät nicht im Klartext verlassen."}]}'),
	('7e570011-0000-4000-8000-000000000034', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Mitschnitt"}]}'),
	('7e570011-0000-4000-8000-000000000034', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen Ladesäule und Backend hing an jeder der sechs Säulen ein Raspberry Pi als Proxy für OCPP 1.6J über WebSocket. Mitgeschnitten wurden StatusNotification, MeterValues, StartTransaction und StopTransaction, jeweils mit einem über NTP gesetzten Zeitstempel. RFID-Kennungen wurden auf dem Gerät gehasht, bevor etwas gespeichert wurde. Die Standorte lagen in der Airport-Stadt, an der Werderstraße, am Neustadtswall und in Vegesack."}]}'),
	('7e570011-0000-4000-8000-000000000034', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In zwei Monaten kamen 1.184 vollständig mitgeschnittene Ladevorgänge zusammen. Zwei Wochen fehlen: Nach einem Stromausfall Anfang Juni ist der Proxy an der Werderstraße nicht von selbst wieder hochgekommen, und aufgefallen ist das erst beim wöchentlichen Blick auf die Dateigrößen. Seitdem lief ein Watchdog, den es von Anfang an hätte geben müssen."}]}'),
	('7e570011-0000-4000-8000-000000000034', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"137 Abbrüche und ihre Ursachen"}]}'),
	('7e570011-0000-4000-8000-000000000034', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"137 der 1.184 Ladevorgänge endeten vorzeitig, also gut elf Prozent. Die Verteilung ist deutlich ungleich: Zwei Säulen am selben Anschlusskasten stellen allein 58 Fälle. Das Fahrzeug, das in den Beschwerden meist als Ursache genannt wird, spielt in unserer Auswertung eine kleine Rolle."}]}'),
	('7e570011-0000-4000-8000-000000000034', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Zuordnung stützt sich auf den Grund im StopTransaction und auf den zeitlichen Verlauf davor. Bei zwölf Fällen ließ sich beides nicht zusammenbringen, sie stehen ohne Ursache in der Tabelle. Für die Timeout-Fälle hat der Betreiber inzwischen den Mobilfunkanbieter der betroffenen Säulen gewechselt, eine zweite Messreihe steht noch aus."}]}'),
	('7e570011-0000-4000-8000-000000000034', 12, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"58 Abbrüche mit dem Grund PowerLoss, alle an zwei Säulen desselben Anschlusskastens"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"31 Abbrüche nach Timeout der Backend-Verbindung, obwohl das Fahrzeug weiter lud"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"22 Abbrüche über die Kabelverriegelung, gehäuft bei Temperaturen unter zwei Grad"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"14 Abbrüche durch Nutzende, die die Ladekarte ein zweites Mal auflegten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"12 Abbrüche ohne erkennbare Ursache"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000034', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wir haben monatelang das Fahrzeug verdächtigt, dabei lag es an unserem Mobilfunkvertrag."}]}]}'),
	('7e570011-0000-4000-8000-000000000035', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Touchtisch zur Wasserqualität der Weser","index":0},{"level":2,"text":"Warum ein Tisch und keine Stellwand","index":1},{"level":2,"text":"Datenquellen und Aufbereitung","index":2},{"level":2,"text":"Test mit drei Schulklassen","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000035', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Touchtisch zur Wasserqualität der Weser"}]}'),
	('7e570011-0000-4000-8000-000000000035', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000035","alt":"Titelbild des Projekts Touchtisch zur Wasserqualität der Weser","caption":"Für das Schülerlabor am Neustadtswall entstand ein Touchtisch, an dem Jugendliche Messwerte zur Wasserqualität der Weser selbst vergleichen. Die Arbeit beschreibt den Aufbau, die beiden Datenquellen…","width":100}}'),
	('7e570011-0000-4000-8000-000000000035', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum ein Tisch und keine Stellwand"}]}'),
	('7e570011-0000-4000-8000-000000000035', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Schülerlabor der Fakultät Natur und Technik empfängt im Jahr rund 1.200 Schülerinnen und Schüler der Jahrgänge 9 bis 13. Die Station zur Gewässergüte bestand bis 2025 aus einer Stellwand mit Diagrammen und einem Ordner mit Aufgabenblättern. Bei zwei Laborterminen im Mai 2025 wurde mitgeschrieben, wie lange die Wand überhaupt betrachtet wird: im Schnitt 40 Sekunden, meist beim Warten auf ein freies Mikroskop."}]}'),
	('7e570011-0000-4000-8000-000000000035', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Auftrag lautete deshalb, dieselben Daten anfassbar zu machen. Entstanden ist ein Tisch mit einem 43-Zoll-Panel, auf dem sich Messreihen von neun Stationen zwischen Hemelingen und Bremerhaven vergleichen lassen. Die Bedienung kommt ohne Menü aus. Ein Zeitregler an der Tischkante und Marker auf der Karte genügen, um zwei Zeitpunkte nebeneinander zu stellen."}]}'),
	('7e570011-0000-4000-8000-000000000035', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Datenquellen und Aufbereitung"}]}'),
	('7e570011-0000-4000-8000-000000000035', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Werte stammen aus dem offenen Messnetz des Landes und aus eigenen Probenahmen des Labors. Dass sich beide Quellen in Takt und Genauigkeit unterscheiden, wurde anfangs unterschätzt. Die Landesdaten kommen stündlich, die Laborproben zweimal im Semester, und die Sauerstoffwerte weichen systematisch um bis zu 0,6 Milligramm pro Liter voneinander ab. Im Tisch sind beide Quellen deshalb getrennt eingefärbt und werden nie zu einer Kurve verrechnet."}]}'),
	('7e570011-0000-4000-8000-000000000035', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Neun Messstationen von Hemelingen bis zur Schleuse in Bremerhaven"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vier Größen: Wassertemperatur, Sauerstoff, Nitrat, elektrische Leitfähigkeit"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zeitraum 2015 bis 2025, stündliche Landesdaten auf Tageswerte verdichtet"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Eigene Laborproben ab 2019, farblich abgesetzt und einzeln antippbar"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000035', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Test mit drei Schulklassen"}]}'),
	('7e570011-0000-4000-8000-000000000035', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im November 2025 arbeiteten drei Klassen am Tisch, insgesamt 71 Jugendliche. Erhoben wurden die Verweildauer und die Zahl richtig beantworteter Aufgaben aus dem alten Aufgabenblatt. Die Verweildauer stieg auf durchschnittlich vier Minuten und zwanzig Sekunden. Bei den Aufgaben zeigte sich dagegen kein belastbarer Unterschied zur Stellwand: 62 Prozent richtig gegenüber 60 Prozent im Vorjahr, bei einer Streuung, die diesen Abstand nicht trägt."}]}'),
	('7e570011-0000-4000-8000-000000000035', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Schwächen wurden im Test deutlich. Der Tisch verträgt keine Gruppen über vier Personen, weil die Beschriftungen nur in einer Richtung lesbar sind und die hinteren dann vor gedrehter Schrift stehen. Außerdem lädt die Karte zum Wischen ein, obwohl sie fest steht, was elf Jugendliche mehrfach versuchten. Verschieben lässt sich die Karte seit Januar 2026; für die Beschriftung fehlt bisher eine Lösung, die ohne einen zweiten Bildschirm auskommt."}]}'),
	('7e570011-0000-4000-8000-000000000035', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Mit dem Regler sieht man sofort, wann der Sauerstoff einbricht. Auf der Wand hätte ich das nie nachgerechnet."}]}]}'),
	('7e570011-0000-4000-8000-000000000036', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Betriebsnachfolge im Bremer Handwerk","index":0},{"level":2,"text":"Warum das Thema drängt","index":1},{"level":2,"text":"Erhebung und die verunglückte Umfrage","index":2},{"level":2,"text":"Was die Gespräche gezeigt haben","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000036', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Betriebsnachfolge im Bremer Handwerk"}]}'),
	('7e570011-0000-4000-8000-000000000036', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000036","alt":"Titelbild des Projekts Betriebsnachfolge im Bremer Handwerk","caption":"Wie finden Handwerksbetriebe in Bremen und im Umland eine Nachfolge? Für eine Lehrveranstaltung im Sommersemester 2026 haben wir 14 Inhaberinnen und Inhaber befragt, die in den nächsten fünf Jahren ü…","width":100}}'),
	('7e570011-0000-4000-8000-000000000036', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum das Thema drängt"}]}'),
	('7e570011-0000-4000-8000-000000000036', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Handwerkskammer Bremen zählt für die kommenden fünf Jahre rund 900 Betriebe, deren Inhaberin oder Inhaber älter als 58 Jahre ist. Ein Teil davon wird keine Nachfolge finden und schließen. Neu ist diese Beobachtung nicht. In den Gesprächen fiel uns aber auf, dass die Betriebe den Zeitpunkt für die Übergabe selbst meist zu spät ansetzen: gesucht wird oft erst, wenn der Rücken nicht mehr mitmacht."}]}'),
	('7e570011-0000-4000-8000-000000000036', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Unsere Ausgangsfrage war betriebswirtschaftlich gemeint: Woran scheitert eine Übergabe, wenn der Betrieb volle Auftragsbücher hat und Geld verdient? Am Ertrag liegt es selten. Häufiger liegt es an der Bewertung. Wer vierzig Jahre lang jeden Kunden persönlich betreut hat, verkauft einen Betrieb, der ohne diese Person spürbar weniger wert ist, und genau das lässt sich schwer beziffern."}]}'),
	('7e570011-0000-4000-8000-000000000036', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Erhebung und die verunglückte Umfrage"}]}'),
	('7e570011-0000-4000-8000-000000000036', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Geplant war eine schriftliche Befragung aller Innungsbetriebe. Von 400 versendeten Fragebogen kamen 23 zurück, vier davon unvollständig. Damit war die Auswertung hinfällig, die wir im Exposé beschrieben hatten. Wir sind auf leitfadengestützte Interviews umgestiegen und haben über zwei Monate 14 Gespräche geführt, meist in der Werkstatt und meist nach Feierabend."}]}'),
	('7e570011-0000-4000-8000-000000000036', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"14 Interviews zwischen März und Mai 2026, je 40 bis 90 Minuten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Betriebsgrößen von 3 bis 41 Beschäftigten, Median 9"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gewerke: Sanitär und Heizung, Elektro, Tischlerei, Dachdeckerei, Kraftfahrzeugtechnik"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"9 Betriebe im Stadtgebiet, 5 zwischen Delmenhorst und Osterholz-Scharmbeck"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"5 Gespräche mit bereits benannter Nachfolge, 9 ohne"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000036', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Gespräche gezeigt haben"}]}'),
	('7e570011-0000-4000-8000-000000000036', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der größte Abstand zwischen Vorstellung und Markt betrifft den Preis. Die Befragten nannten im Mittel das Zweieinhalbfache des Jahresgewinns, teils zuzüglich des Grundstücks. Übernehmende, mit denen wir gesprochen haben, rechnen dagegen mit dem Ergebnis der letzten drei Jahre abzüglich eines kalkulatorischen Unternehmerlohns. Dieser Lohn fehlte in fast jeder Rechnung, die uns auf den Tisch gelegt wurde, weil die Inhaber ihn sich nie ausgezahlt haben."}]}'),
	('7e570011-0000-4000-8000-000000000036', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Auffällig war außerdem, wie oft die Werkstattimmobilie das Geschäft blockiert. Sie gehört privat und ist zugleich die Altersvorsorge. Ein Mietvertrag über zehn Jahre passt aber schlecht zu einer Bank, die dem Nachfolger ein Darlehen geben soll. Zwei der befragten Betriebe haben genau an dieser Stelle die Verhandlung abgebrochen, in einem Fall nach elf Monaten."}]}'),
	('7e570011-0000-4000-8000-000000000036', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Verkaufen kann ich den Betrieb jederzeit. Nur will keiner mehr mit aufs Dach."}]}]}'),
	('7e570011-0000-4000-8000-000000000037', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Schulhofentsiegelung in Bremen-Walle","index":0},{"level":2,"text":"Ausgangslage auf dem Hof","index":1},{"level":2,"text":"Aufnahme und Versickerungsversuche","index":2},{"level":2,"text":"Entwurf und was daran hakt","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000037', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Schulhofentsiegelung in Bremen-Walle"}]}'),
	('7e570011-0000-4000-8000-000000000037', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000037","alt":"Titelbild des Projekts Schulhofentsiegelung in Bremen-Walle","caption":"Praxisprojekt zur Regenwasserbewirtschaftung: Für einen 1.900 Quadratmeter großen Schulhof in Walle entstanden eine Bestandsaufnahme, Versickerungsversuche und ein Entwurf mit Baumrigolen. Auftraggeb…","width":100}}'),
	('7e570011-0000-4000-8000-000000000037', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangslage auf dem Hof"}]}'),
	('7e570011-0000-4000-8000-000000000037', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Hof ist zu 84 Prozent versiegelt, überwiegend mit Asphalt aus den frühen 1970er Jahren. Bei Starkregen steht das Wasser vor dem östlichen Eingang bis zu zehn Zentimeter hoch, weil das Gefälle dorthin läuft und der Straßenablauf am Rand die Menge nicht aufnimmt. Der Schulverein hatte das Problem seit Jahren gemeldet, ohne dass daraus eine Planung entstanden wäre."}]}'),
	('7e570011-0000-4000-8000-000000000037', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Praxisprojekt sollte eine Grundlage liefern, mit der sich Fördermittel beantragen lassen. Vier Studierende aus dem sechsten Semester haben dafür im Wintersemester 2024/25 den Bestand aufgenommen, den Untergrund untersucht und einen Entwurf bis zur Vorplanung ausgearbeitet. Die Schule stellte zwei Nachmittage pro Woche zur Verfügung, an denen der Hof nicht genutzt wurde."}]}'),
	('7e570011-0000-4000-8000-000000000037', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufnahme und Versickerungsversuche"}]}'),
	('7e570011-0000-4000-8000-000000000037', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Aufnahme erfolgte mit Tachymeter und ergänzenden Handaufmaßen, das Höhenmodell aus 320 Punkten. Zusätzlich wurden an sechs Stellen Schürfe bis 80 Zentimeter Tiefe angelegt. Der Untergrund ist heterogener als erwartet: Im Westteil steht ab 40 Zentimetern ein sandiger Boden an, im Ostteil eine bindige Auffüllung mit Bauschutt, die kaum Wasser durchlässt."}]}'),
	('7e570011-0000-4000-8000-000000000037', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Genau dort, wo das Wasser heute steht, versickert also am wenigsten. Die Doppelringversuche bestätigten das mit Durchlässigkeitsbeiwerten zwischen 2 mal 10 hoch minus 6 und 8 mal 10 hoch minus 4 Metern pro Sekunde. Ein flächiges Versickerungskonzept schied damit aus, bevor der Entwurf überhaupt begonnen hatte."}]}'),
	('7e570011-0000-4000-8000-000000000037', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Höhenmodell aus 320 eingemessenen Punkten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs Schürfe mit Bodenansprache nach DIN 4022"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vier Doppelringinfiltrometer-Versuche, je zwei pro Hofhälfte"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Baumkataster mit 14 Bestandsbäumen samt Stammumfang und Kronendurchmesser"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nutzungskartierung über zwei Pausen, damit Wege und Spielbereiche nicht verplant werden"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000037', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Entwurf und was daran hakt"}]}'),
	('7e570011-0000-4000-8000-000000000037', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Entwurf entsiegelt 640 Quadratmeter im Westteil, wo der Boden es hergibt, und führt das Wasser aus dem Ostteil über ein flaches Rinnensystem dorthin. Vier neue Baumrigolen nehmen den Abfluss der Dachflächen auf. Die versiegelte Fläche sinkt damit von 84 auf 50 Prozent, der rechnerische Abfluss bei einem fünfjährlichen Regenereignis um gut die Hälfte."}]}'),
	('7e570011-0000-4000-8000-000000000037', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwei Punkte bleiben offen. Die Rinnenführung quert die Feuerwehrzufahrt, und ob die überfahrbare Ausführung genehmigungsfähig ist, konnte im Projektzeitraum nicht geklärt werden. Außerdem liegt die Kostenschätzung bei 214.000 Euro brutto und damit über dem, was der Schulverein für realistisch hält. Der Entwurf ist deshalb in zwei Bauabschnitte geteilt, von denen der erste ohne die Rinnenquerung auskommt."}]}'),
	('7e570011-0000-4000-8000-000000000037', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Uns war klar, dass es teuer wird. Dass schon der erste Abschnitt ein Drittel des Wassers wegbekommt, wussten wir vorher nicht."}]}]}'),
	('7e570011-0000-4000-8000-000000000038', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Schulabsentismus in Gröpelingen aus Sicht der Schulsozialarbeit","index":0},{"level":2,"text":"Zugang zum Feld","index":1},{"level":2,"text":"Wiederkehrende Muster","index":2},{"level":2,"text":"Grenzen der Erhebung","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000038', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Schulabsentismus in Gröpelingen aus Sicht der Schulsozialarbeit"}]}'),
	('7e570011-0000-4000-8000-000000000038', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000038","alt":"Titelbild des Projekts Schulabsentismus in Gröpelingen aus Sicht der Schulsozialarbeit","caption":"Elf Fachkräfte der Schulsozialarbeit an zwei Oberschulen in Bremen-Gröpelingen berichten in Leitfadeninterviews über Schulabsentismus: wann sie von einem Fehlen überhaupt erfahren und wo ihre Möglich…","width":100}}'),
	('7e570011-0000-4000-8000-000000000038', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Zugang zum Feld"}]}'),
	('7e570011-0000-4000-8000-000000000038', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Statistik der Bildungsbehörde weist für Gröpelingen die höchsten Quoten unentschuldigter Fehlzeiten im Bremer Stadtgebiet aus. Was hinter den Quoten steht, sagt sie nicht. Das Projekt setzte deshalb bei denen an, die die Familien kennen. Nach zwei abgelehnten Anfragen kam der Kontakt über eine Praktikumsstelle im Studiengang zustande; zwei Oberschulen sagten zu, unter der Bedingung, dass keine Schule namentlich genannt wird."}]}'),
	('7e570011-0000-4000-8000-000000000038', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Geführt wurden elf Interviews zwischen April und Juni 2025, im Schnitt 52 Minuten lang, aufgezeichnet und wörtlich transkribiert. Ausgewertet wurde inhaltlich strukturierend. Das Kategoriensystem entstand in zwei Durchgängen und wurde von zwei Personen unabhängig voneinander angelegt und danach zusammengeführt. Bei zwei Kategorien blieb die Zuordnung strittig; sie stehen im Anhang mit beiden Lesarten."}]}'),
	('7e570011-0000-4000-8000-000000000038', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wiederkehrende Muster"}]}'),
	('7e570011-0000-4000-8000-000000000038', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Fünf Punkte kamen in fast jedem Gespräch vor, unabhängig von Schule und Berufserfahrung der Befragten. Sie beschreiben weniger die Jugendlichen als die Wege, auf denen eine Information im Schulbetrieb ankommt oder eben liegen bleibt. Keiner der fünf Punkte tauchte in den schriftlichen Verfahrensbeschreibungen auf, die beide Schulen vorab herausgegeben hatten."}]}'),
	('7e570011-0000-4000-8000-000000000038', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Auffällig war, wie unterschiedlich dieselbe Regel gehandhabt wird. An der einen Schule löst das dritte unentschuldigte Fehlen einen festgelegten Ablauf aus, an der anderen entscheidet die Klassenleitung nach eigenem Ermessen. Die Fachkräfte beschrieben beide Varianten als unbefriedigend: einmal zu starr für den Einzelfall, einmal zu abhängig von einzelnen Personen und deren Belastung."}]}'),
	('7e570011-0000-4000-8000-000000000038', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Das Fehlen fällt oft erst nach zwei bis drei Wochen als Muster auf"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Meldung läuft über das Sekretariat und hängt an einzelnen Personen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Krankmeldungen der Eltern sind kaum überprüfbar und werden trotzdem gezählt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Der erste Kontakt gelingt meist über Geschwister oder Nachbarn, selten über Briefe"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ab der zehnten Klasse gilt ein Fall in der Schule oft als aussichtslos"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000038', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Grenzen der Erhebung"}]}'),
	('7e570011-0000-4000-8000-000000000038', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Sicht der Jugendlichen fehlt vollständig, und damit fehlt der wichtigste Teil. Gespräche mit Schülerinnen und Schülern hätten die Zustimmung der Erziehungsberechtigten und eine längere Vorlaufzeit gebraucht, als ein Semesterprojekt hergibt. Die Ergebnisse beschreiben also, wie eine Berufsgruppe auf das Fehlen blickt, nicht, warum jemand fehlt."}]}'),
	('7e570011-0000-4000-8000-000000000038', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für eine Anschlussarbeit liegt der Ansatzpunkt bei den Meldewegen. Mehrere Fachkräfte berichteten von Fehlzeiten, die im digitalen Klassenbuch stehen und nie bei ihnen ankommen. Wie eine Meldung tatsächlich von der Fachlehrkraft zur Sozialarbeit gelangt, ließe sich an einer einzelnen Schule in wenigen Wochen nachzeichnen."}]}'),
	('7e570011-0000-4000-8000-000000000038', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wir sehen die Familie meistens zum ersten Mal, wenn schon vierzig Fehltage zusammengekommen sind. Bis dahin hat niemand angerufen."}]}]}'),
	('7e570011-0000-4000-8000-000000000039', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"E-Paper-Anzeige für den Mensaplan","index":0},{"level":2,"text":"Ein Schild statt einer weiteren App","index":1},{"level":2,"text":"Technischer Aufbau","index":2},{"level":2,"text":"Der Ausfall über Weihnachten","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000039', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"E-Paper-Anzeige für den Mensaplan"}]}'),
	('7e570011-0000-4000-8000-000000000039', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000039","alt":"Titelbild des Projekts E-Paper-Anzeige für den Mensaplan","caption":"Eine studentische Initiative aus der Informatik hat eine E-Paper-Anzeige für den Speiseplan der Mensa Neustadtswall gebaut. Das Schild hängt seit November 2025 im Foyer und kommt rechnerisch 210 Tage…","width":100}}'),
	('7e570011-0000-4000-8000-000000000039', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ein Schild statt einer weiteren App"}]}'),
	('7e570011-0000-4000-8000-000000000039', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Speiseplan der Mensa am Neustadtswall steht auf der Webseite des Studierendenwerks und in einer App. Wer im Foyer steht und in zehn Minuten in der Vorlesung sein muss, holt dafür trotzdem selten das Telefon heraus. Die Initiative wollte deshalb kein weiteres Stück Software bauen, sondern ein Schild, das ohne Bedienung auskommt und trotzdem stimmt."}]}'),
	('7e570011-0000-4000-8000-000000000039', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Entstanden ist eine Anzeige mit einem 7,5 Zoll großen E-Paper-Display, die seit November 2025 neben dem Eingang hängt. Sie zeigt vier Gerichte, die beiden Preise für Studierende und Bedienstete sowie die Kennzeichnung vegetarisch oder vegan. Aktualisiert wird einmal am Morgen um 6:40 Uhr, danach schaltet sich das Gerät wieder ab."}]}'),
	('7e570011-0000-4000-8000-000000000039', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Technischer Aufbau"}]}'),
	('7e570011-0000-4000-8000-000000000039', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Aufbau ist absichtlich langweilig gehalten, weil niemand ein Gerät warten will, das im Foyer hängt und dessen Zugang über den Hausmeister läuft. Ein Mikrocontroller mit WLAN wacht einmal täglich auf, holt eine fertige Bilddatei von einem kleinen Server im Hochschulnetz, schreibt sie auf das Display und legt sich wieder schlafen. Die Aufbereitung des Speiseplans passiert auf dem Server und nicht im Gerät, damit eine Änderung am Layout keinen Ausbau des Schildes erfordert."}]}'),
	('7e570011-0000-4000-8000-000000000039', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"ESP32 mit WLAN, Tiefschlaf zwischen zwei Aktualisierungen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"7,5-Zoll-E-Paper, hält das Bild ohne Stromzufuhr"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwei Lithium-Zellen mit zusammen 5.000 Milliamperestunden"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gemessen: 38 Sekunden Wachzeit pro Tag, rechnerisch 210 Tage je Ladung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gehäuse aus dem 3D-Drucker der Werkstatt, Wandhalterung geschraubt"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000039', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Ausfall über Weihnachten"}]}'),
	('7e570011-0000-4000-8000-000000000039', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen dem 22. Dezember und dem 8. Januar zeigte das Schild den Plan der Vorwoche. Das Studierendenwerk hatte die Webseite umgestellt, und die Auswertung des Quelltexts lief ins Leere. Weil das Gerät bei einem Fehler das alte Bild stehen lässt, statt eine Meldung anzuzeigen, fiel das niemandem auf. Seitdem prüft der Server das Datum im erzeugten Bild und schickt bei einer Abweichung eine Mail an zwei Adressen."}]}'),
	('7e570011-0000-4000-8000-000000000039', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die zweite Ausbaustufe ist eine Schnittstelle beim Studierendenwerk angefragt, damit der Umweg über den Quelltext entfällt. Eine Antwort steht seit Februar aus, und bis dahin bleibt die Auswertung fragil. Zwei weitere Anzeigen für die Standorte Werderstraße und Airport-Stadt sind fertig gebaut, hängen aber noch nicht."}]}'),
	('7e570011-0000-4000-8000-000000000039', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Das Ding hängt jetzt seit dem Herbst und ich musste noch kein einziges Mal ran. Genau so soll das sein."}]}]}'),
	('7e570011-0000-4000-8000-000000000040', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Bionischer Rumpf für einen Unterwasserroboter","index":0},{"level":2,"text":"Aufgabe und Randbedingungen","index":1},{"level":2,"text":"Bau und Messungen","index":2},{"level":2,"text":"Die Woche in La Spezia","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000040', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Bionischer Rumpf für einen Unterwasserroboter"}]}'),
	('7e570011-0000-4000-8000-000000000040', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000040","alt":"Titelbild des Projekts Bionischer Rumpf für einen Unterwasserroboter","caption":"Wettbewerbsbeitrag zu einem autonomen Unterwasserfahrzeug mit bionisch geformtem Rumpf nach dem Vorbild des Kofferfischs. Gemessen wurden Strömungswiderstand und Kursstabilität im Schleppversuch, bev…","width":100}}'),
	('7e570011-0000-4000-8000-000000000040', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgabe und Randbedingungen"}]}'),
	('7e570011-0000-4000-8000-000000000040', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Wettbewerb verlangt ein autonomes Unterwasserfahrzeug, das ohne Funkkontakt eine Bahn abfährt, ein farbiges Tor durchquert und ein Objekt am Grund findet. Unsere Hochschulgruppe hat sich im Sommersemester 2026 gemeldet, mit 4.200 Euro aus Fördermitteln und einigen Restbeständen aus dem Labor. Der Antrieb stand von vornherein fest, weil die Motoren aus einem Vorgängerprojekt stammten. Frei war dagegen die Form des Rumpfes, und dort lag mein Teil der Arbeit."}]}'),
	('7e570011-0000-4000-8000-000000000040', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Als Vorbild diente der Kofferfisch, dessen kantiger Körper trotz sperriger Form wenig Widerstand erzeugt und Störungen durch Wirbel an den Kanten teilweise selbst ausgleicht. Die Übertragung war nie eins zu eins gemeint: Unser Fahrzeug ist doppelt so lang und trägt vorn eine Kamerakuppel, für die es im biologischen Vorbild keine Entsprechung gibt."}]}'),
	('7e570011-0000-4000-8000-000000000040', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Bau und Messungen"}]}'),
	('7e570011-0000-4000-8000-000000000040', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aus der CFD-Rechnung gingen drei Rumpfvarianten hervor, die wir im Maßstab 1:2 gedruckt und im Becken geschleppt haben. Der Schleppwagen war ein Eigenbau aus Aluminiumprofil mit einer Kraftmessdose an der Zugstange. Die Messung streute stärker als erhofft, weil sich die Stange bei höherer Fahrt merklich bog, doch die Rangfolge der Varianten blieb über alle Wiederholungen stabil. Variante zwei erzeugte bei 1,2 Metern pro Sekunde rund 12 Prozent weniger Widerstand als der Referenzrumpf des Vorjahres."}]}'),
	('7e570011-0000-4000-8000-000000000040', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"drei Rumpfvarianten aus der CFD-Rechnung, gedruckt im Maßstab 1:2"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Schleppversuche bei 0,6 bis 1,8 Metern pro Sekunde"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"12 Prozent weniger Widerstand als der Vorjahresrumpf"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kursstabilität zunächst schlechter, nachgebessert mit zwei Heckflossen"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000040', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Die Woche in La Spezia"}]}'),
	('7e570011-0000-4000-8000-000000000040', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Wettbewerb belegte das Fahrzeug Platz 5 von 9. Der Rumpf hielt, was die Messungen versprachen: Bei gleicher Akkuladung waren wir gut sieben Minuten länger unterwegs als im Vorjahr. Gescheitert sind wir an anderer Stelle. Im trüben Hafenwasser erkannte die Kamera das gelbe Tor erst aus zwei Metern statt aus fünf, und die Suchfahrt kostete so viel Zeit, dass zwei Aufgaben unversucht blieben. Das schwächste Glied war die Optik, nicht die Hydrodynamik."}]}'),
	('7e570011-0000-4000-8000-000000000040', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für den nächsten Anlauf steht deshalb ein Sonar auf der Liste, und die Heckflossen sollen anstellbar werden. Der Rumpf bleibt, wie er ist. Konstruktionsdaten und Messreihen liegen dem Bericht als Anhang bei, damit die nächste Gruppe nicht wieder bei null anfängt."}]}'),
	('7e570011-0000-4000-8000-000000000040', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Der Rumpf war nie unser Problem. Wir haben eine Woche lang gegen trübes Wasser verloren."}]}]}'),
	('7e570011-0000-4000-8000-000000000041', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Zahlungsbereitschaft für regionale Ware am Wochenmarkt","index":0},{"level":2,"text":"Fragestellung und Aufbau des Projekts","index":1},{"level":2,"text":"Erhebung an drei Markttagen","index":2},{"level":2,"text":"Aussage und Kassenbon fallen auseinander","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000041', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Zahlungsbereitschaft für regionale Ware am Wochenmarkt"}]}'),
	('7e570011-0000-4000-8000-000000000041', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000041","alt":"Titelbild des Projekts Zahlungsbereitschaft für regionale Ware am Wochenmarkt","caption":"Studienprojekt einer Vierergruppe im Bachelor Betriebswirtschaft: An drei Bremer Wochenmärkten wurden 212 Kundinnen und Kunden befragt, welchen Aufschlag sie für regionale Herkunft zahlen würden. Der…","width":100}}'),
	('7e570011-0000-4000-8000-000000000041', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Fragestellung und Aufbau des Projekts"}]}'),
	('7e570011-0000-4000-8000-000000000041', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Projekt entstand im vierten Semester Betriebswirtschaft als Gruppenarbeit über ein Semester. Vorgegeben war das Oberthema Regionalität im Lebensmitteleinzelhandel, die konkrete Fragestellung suchte die Gruppe selbst. Sie lautete am Ende: Wie hoch ist der Aufschlag, den Kundinnen und Kunden am Wochenmarkt für regionale Herkunft zu zahlen angeben, und deckt sich diese Angabe mit dem, was am selben Tag tatsächlich im Korb liegt?"}]}'),
	('7e570011-0000-4000-8000-000000000041', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Erhebung an drei Markttagen"}]}'),
	('7e570011-0000-4000-8000-000000000041', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Befragt wurde an drei Markttagen im November 2024, auf dem Ziegenmarkt in der Neustadt, auf dem Domshof und an der Berckstraße in Schwachhausen. Angesprochen wurde nach dem Einkauf, die Befragten zeigten Korb und Beleg freiwillig. So kamen 212 vollständige Interviews zusammen, davon 87 mit Einsicht in die Bons. Der Fragebogen war vorab an zwölf Personen im Seminar getestet und danach von 19 auf 14 Fragen gekürzt worden."}]}'),
	('7e570011-0000-4000-8000-000000000041', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Drei Markttage im November 2024, jeweils 7 bis 13 Uhr"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"212 vollständige Interviews, davon 87 mit Beleg"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Fragebogen mit 14 Fragen nach Pretest im Seminar"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Auswertung in R, Mittelwertvergleich je Standort"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000041', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aussage und Kassenbon fallen auseinander"}]}'),
	('7e570011-0000-4000-8000-000000000041', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Mittel gaben die Befragten an, 23 Prozent mehr für regionale Ware zu zahlen. Bei den 87 Einkäufen mit Beleg lag der Anteil regionaler Ware am Bon bei 34 Prozent, der rechnerische Mehrpreis gegenüber einem Vergleichskorb aus dem Supermarkt bei 9 Prozent. Der Abstand zwischen Aussage und Beleg fiel am Domshof am größten aus, dort war auch der Anteil der Laufkundschaft am höchsten."}]}'),
	('7e570011-0000-4000-8000-000000000041', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Gruppe führt den Unterschied nicht allein auf soziale Erwünschtheit zurück. Ein Teil der Befragten konnte bei einzelnen Produkten schlicht nicht sagen, woher sie stammen, und ordnete sie im Zweifel als regional ein. Die Stichprobe ist zudem nicht repräsentativ: Wer am Vormittag auf dem Wochenmarkt einkauft, ist im Schnitt älter und hat mehr Zeit als der Durchschnitt der Bremer Bevölkerung. Eine Wiederholung am Samstagnachmittag steht aus."}]}'),
	('7e570011-0000-4000-8000-000000000042', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Barrierefreiheit im Hörsaalgebäude am Neustadtswall","index":0},{"level":2,"text":"Aufgabe und Ablauf","index":1},{"level":2,"text":"Aufnahme vor Ort","index":2},{"level":2,"text":"Vorschläge und was sie kosten","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000042', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Barrierefreiheit im Hörsaalgebäude am Neustadtswall"}]}'),
	('7e570011-0000-4000-8000-000000000042', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000042","alt":"Titelbild des Projekts Barrierefreiheit im Hörsaalgebäude am Neustadtswall","caption":"Studienprojekt einer Vierergruppe: Aufnahme eines Hörsaalgebäudes am Neustadtswall nach DIN 18040-1, mit Bestandsplan, einer Mängelliste von 46 Einträgen und Vorschlägen für den Umbau der Zugänge.","width":100}}'),
	('7e570011-0000-4000-8000-000000000042', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgabe und Ablauf"}]}'),
	('7e570011-0000-4000-8000-000000000042', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Studienprojekt lief über zwölf Wochen im Sommersemester 2025 und wurde von vier Studierenden aus dem dritten und vierten Semester bearbeitet. Aufgabe war die Bestandsaufnahme eines Hörsaalgebäudes am Neustadtswall nach DIN 18040-1 und ein Vorschlag, wie sich die auffälligsten Mängel mit vertretbarem Aufwand beheben lassen. Bauunterlagen gab es, allerdings aus dem Jahr 1974 und ohne die Umbauten der neunziger Jahre."}]}'),
	('7e570011-0000-4000-8000-000000000042', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Gruppe teilte sich nach Geschossen auf und traf sich wöchentlich zur Abstimmung. Weil die Aufnahme in der Vorlesungszeit stattfand, waren einige Räume nur früh morgens zugänglich, drei Termine mussten verschoben werden. Am Ende standen ein Bestandsplan im Maßstab 1:100 und eine Mängelliste mit 46 Einträgen, vorgestellt vor dem Betreuer und zwei Mitarbeitenden der Gebäudeverwaltung."}]}'),
	('7e570011-0000-4000-8000-000000000042', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufnahme vor Ort"}]}'),
	('7e570011-0000-4000-8000-000000000042', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aufgenommen wurde mit Laserdistanzmesser und Fotoprotokoll, dazu kam ein aus dem Labor geliehenes Kraftmessgerät für die Türöffnungskräfte. Für jeden Raum entstand ein Aufnahmeblatt, auf dem Türbreiten, Schwellenhöhen und die Höhe der Bedienelemente eingetragen wurden. Bewegungsflächen wurden im Plan geprüft und an den engsten Stellen zusätzlich vor Ort nachgemessen, weil die Möblierung von den Unterlagen abwich."}]}'),
	('7e570011-0000-4000-8000-000000000042', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"46 Mängel in vier Kategorien, von der fehlenden Kontrastmarkierung bis zur zu hohen Schwelle"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Türöffnungskräfte an 21 Türen gemessen, 9 davon über dem zulässigen Wert"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kein taktiles Leitsystem im gesamten Gebäude"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwei von drei WC-Anlagen ohne barrierefreie Kabine"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Der Aufzug erreicht das Hörsaalgeschoss, die Empore dagegen nicht"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000042', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorschläge und was sie kosten"}]}'),
	('7e570011-0000-4000-8000-000000000042', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Vorschläge sind nach Aufwand sortiert. Kontrastmarkierungen an Glastüren und Treppenstufen sowie eine Neueinstellung der Türschließer lassen sich im laufenden Betrieb umsetzen und kosten wenig. Der Umbau des Haupteingangs mit einer Rampe im Innenhof wurde als Variante gezeichnet, aber nicht durchgerechnet: Dafür fehlten der Gruppe die Angaben zur Gründung, und die Zeit reichte am Ende nicht mehr."}]}'),
	('7e570011-0000-4000-8000-000000000042', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Rückblickend war die Aufnahme zu detailliert angelegt. Drei Wochen gingen für Aufnahmeblätter drauf, die in der Auswertung kaum eine Rolle spielten, dafür musste die Kostenschätzung gestrichen werden. Der Betreuer hatte in der zweiten Woche davor gewarnt. Verstanden wurde die Warnung erst, als die Hälfte des Semesters vorbei war."}]}'),
	('7e570011-0000-4000-8000-000000000042', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Rampe steht bei uns seit zwanzig Jahren auf der Liste. Was fehlt, ist nicht die Idee, sondern eine Zeichnung, mit der wir in den Haushalt gehen können."}]}]}'),
	('7e570011-0000-4000-8000-000000000043', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Digitale Terminvergabe in der Sozialberatung","index":0},{"level":2,"text":"Fragestellung und Zugang","index":1},{"level":2,"text":"Vorgehen","index":2},{"level":2,"text":"Befunde","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000043', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Digitale Terminvergabe in der Sozialberatung"}]}'),
	('7e570011-0000-4000-8000-000000000043', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000043","alt":"Titelbild des Projekts Digitale Terminvergabe in der Sozialberatung","caption":"Studienprojekt zu der Frage, wie Ratsuchende in Bremen-Huchting mit der Online-Terminvergabe einer Sozialberatung zurechtkommen. Grundlage sind 12 Interviews und zwei Beobachtungstage im Wintersemest…","width":100}}'),
	('7e570011-0000-4000-8000-000000000043', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Fragestellung und Zugang"}]}'),
	('7e570011-0000-4000-8000-000000000043', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Beratungsstelle im Bremer Süden hat im Frühjahr 2025 die offene Sprechstunde durch eine Terminbuchung im Netz ersetzt. Seitdem berichten die Mitarbeitenden von Menschen, die trotzdem ohne Termin vor der Tür stehen. Das Projekt geht der Frage nach, an welcher Stelle die Buchung scheitert. Der Zugang kam über eine Kommilitonin zustande, die dort ein Praktikum absolviert hatte; die Leitung stimmte im September zu."}]}'),
	('7e570011-0000-4000-8000-000000000043', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorgehen"}]}'),
	('7e570011-0000-4000-8000-000000000043', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen Oktober und Dezember 2025 haben wir mit 12 Personen gesprochen, neun davon im Wartebereich, drei am Telefon. Acht Gespräche liefen auf Deutsch, drei mit einer Sprachmittlerin auf Türkisch, eines auf Englisch. Die Aufnahmen sind transkribiert und inhaltlich strukturierend codiert; das Codebuch entstand in zwei Durchgängen im Team, weil die erste Fassung zu grob war."}]}'),
	('7e570011-0000-4000-8000-000000000043', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"12 leitfadengestützte Interviews, im Schnitt 22 Minuten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"zwei Beobachtungstage im Wartebereich, jeweils vier Stunden"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Dokumentenanalyse der Buchungsseite und der Aushänge an der Tür"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rückspiegelung der Zwischenergebnisse an vier Mitarbeitende im Januar"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000043', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Befunde"}]}'),
	('7e570011-0000-4000-8000-000000000043', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Abbruch passiert selten bei der Bedienung selbst, sondern früher. Sieben der Befragten wussten nicht, dass es überhaupt eine Buchungsseite gibt, sie kamen wie früher am Dienstagmorgen. Wer die Seite erreichte, scheiterte meist am Pflichtfeld für die E-Mail-Adresse oder daran, dass der nächste freie Termin drei Wochen entfernt lag, während die Frist eines Bescheids schon in acht Tagen endete."}]}'),
	('7e570011-0000-4000-8000-000000000043', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Beratungsstelle folgt daraus zweierlei. Der Aushang an der Tür nennt die Seite bisher nur im Kleingedruckten unter den Öffnungszeiten. Und die Rückrufnummer sollte als gleichwertiger Weg auftauchen statt als Ausnahme für Härtefälle. Beide Punkte hat die Leitung im Januar aufgenommen, geändert ist bisher der Aushang."}]}'),
	('7e570011-0000-4000-8000-000000000043', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich habe kein E-Mail. Meine Tochter hat eins, aber die arbeitet, und wenn sie abends nachsieht, ist wieder nichts frei."}]}]}'),
	('7e570011-0000-4000-8000-000000000044', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Prüfungsplanung mit einem Constraint-Solver","index":0},{"level":2,"text":"Warum der Plan jedes Semester klemmt","index":1},{"level":2,"text":"Das Modell und seine Nebenbedingungen","index":2},{"level":2,"text":"Was der Solver nicht wusste","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000044', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Prüfungsplanung mit einem Constraint-Solver"}]}'),
	('7e570011-0000-4000-8000-000000000044', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000044","alt":"Titelbild des Projekts Prüfungsplanung mit einem Constraint-Solver","caption":"Studienprojekt einer Vierergruppe an der Fakultät 4: Der Prüfungsplan eines Semesters mit 147 Klausuren und 22 Räumen wurde als Constraint-Modell formuliert und automatisch gelöst. Der Bericht vergle…","width":100}}'),
	('7e570011-0000-4000-8000-000000000044', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Warum der Plan jedes Semester klemmt"}]}'),
	('7e570011-0000-4000-8000-000000000044', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Prüfungsplan der Fakultät 4 entsteht bisher in einer Tabellenkalkulation. Für das Wintersemester 2025/26 waren 147 Klausuren auf 22 Räume und zwölf Werktage zu verteilen, dazu die Aufsichten und die Wunschtermine einzelner Lehrender. Bis der Plan stand, vergingen nach Auskunft des Prüfungsamts etwa drei Wochen, verteilt auf mehrere Anläufe, weil jede Verschiebung an anderer Stelle einen neuen Konflikt erzeugt hat."}]}'),
	('7e570011-0000-4000-8000-000000000044', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Unsere Gruppe hat im Sommersemester 2026 versucht, diesen Ablauf als Constraint-Modell zu beschreiben. Die Aufgabe kam nicht aus der Lehrveranstaltung, sondern aus dem Prüfungsamt selbst, das den Plan des vergangenen Semesters mit allen Zwischenständen zur Verfügung gestellt hat. Damit ließ sich das Ergebnis gegen einen echten Plan halten und nicht nur gegen erfundene Daten."}]}'),
	('7e570011-0000-4000-8000-000000000044', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Das Modell und seine Nebenbedingungen"}]}'),
	('7e570011-0000-4000-8000-000000000044', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Modelliert wurde mit MiniZinc, gerechnet mit dem Backend Gecode auf einem gewöhnlichen Notebook. Jede Klausur bekommt einen Termin, einen Raum und einen Aufsichtsblock. Harte Bedingungen sind die Raumkapazität, ein Abstand von mindestens einem Tag zwischen zwei Prüfungen desselben Semesters und die Sperrzeiten der Labore. Die Wunschtermine der Lehrenden gehen als Strafterme in die Zielfunktion ein und werden im Bericht einzeln ausgewiesen."}]}'),
	('7e570011-0000-4000-8000-000000000044', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"147 Klausuren, 22 Räume und zwölf Prüfungstage im Wintersemester 2025/26"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Harte Bedingungen: Kapazität, ein Tag Abstand je Semester, Sperrzeiten der Labore"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"38 Wunschtermine der Lehrenden als gewichtete Strafterme"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rechenzeit bis zum ersten zulässigen Plan 3 Minuten, bis zum besten gefundenen 40 Minuten"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000044', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was der Solver nicht wusste"}]}'),
	('7e570011-0000-4000-8000-000000000044', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der erzeugte Plan verletzt keine harte Bedingung und trifft 31 der 38 Wunschtermine. Brauchbar war er trotzdem nicht: Zwei Klausuren mit vielen Nachschreibenden lagen am selben Vormittag, was formal erlaubt ist, aber dieselben drei Aufsichten gebunden hätte. Diese Regel stand in keinem Dokument und fehlte deshalb im Modell. Nachgetragen haben wir sie erst im dritten Durchlauf."}]}'),
	('7e570011-0000-4000-8000-000000000044', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der zweite Punkt betrifft die Eingabe. Die Daten kamen aus drei Tabellen, die unterschiedliche Kürzel für dieselben Module verwenden. Das Zusammenführen von Hand hat länger gedauert als das Modellieren, und ohne diesen Schritt läuft nichts. Solange die Kürzel nicht aus einer Quelle stammen, bleibt der Solver eine Übung und ersetzt die Tabellenkalkulation nicht."}]}'),
	('7e570011-0000-4000-8000-000000000044', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Der Plan ist rechnerisch richtig. Nur weiß das Programm nicht, dass ich diese beiden Aufsichten nicht gleichzeitig stellen kann."}]}]}'),
	('7e570011-0000-4000-8000-000000000045', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Photobioreaktor im Dauerbetrieb über zwölf Wochen","index":0},{"level":2,"text":"Aufgabe und Aufbau","index":1},{"level":2,"text":"Messreihe und Zwischenfälle","index":2},{"level":2,"text":"Was die Gruppe mitnimmt","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000045', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Photobioreaktor im Dauerbetrieb über zwölf Wochen"}]}'),
	('7e570011-0000-4000-8000-000000000045', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000045","alt":"Titelbild des Projekts Photobioreaktor im Dauerbetrieb über zwölf Wochen","caption":"Fünf Studierende betrieben im Labor am Neustadtswall einen 30-Liter-Photobioreaktor über zwölf Wochen und protokollierten Wachstum und Ausfälle der Mikroalgenkultur. Das Projekt entstand als Gruppena…","width":100}}'),
	('7e570011-0000-4000-8000-000000000045', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgabe und Aufbau"}]}'),
	('7e570011-0000-4000-8000-000000000045', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Projekt lief von Oktober 2024 bis Februar 2025 als Gruppenarbeit von fünf Studierenden im Labor am Neustadtswall. Die Aufgabenstellung kam aus dem Projektmodul und war knapp gehalten: eine Kultur von Chlorella vulgaris über mindestens zehn Wochen stabil halten und die Biomassekonzentration zweimal wöchentlich bestimmen. Der Flachplattenreaktor fasst 30 Liter, beleuchtet wird über LED-Panels mit einstellbarem Tagesrhythmus."}]}'),
	('7e570011-0000-4000-8000-000000000045', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Gruppe teilte die Arbeit früh auf: Zwei Personen übernahmen Probenahme und Messung, drei die Dokumentation und die Wochenendplanung. Diese Absprache war der aufwendigste Teil der Organisation und im Rückblick der wichtigste. In Woche sechs fiel eine Probenahme aus, weil zwei Termine auf denselben Samstag gelegt worden waren, und die entstandene Lücke ist in der Wachstumskurve bis heute zu sehen."}]}'),
	('7e570011-0000-4000-8000-000000000045', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Messreihe und Zwischenfälle"}]}'),
	('7e570011-0000-4000-8000-000000000045', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Bestimmt wurden die optische Dichte bei 680 Nanometer, die Trockenmasse und der pH-Wert, dazu die Temperatur im Stundenraster über einen Datenlogger. Die Kultur erreichte in Woche vier eine Trockenmasse von 1,8 Gramm je Liter und blieb bis Woche neun in diesem Bereich. Danach fiel sie auf 0,9 Gramm je Liter, nachdem die Umwälzpumpe über ein Wochenende ausgefallen war und sich die Kultur am Reaktorboden abgesetzt hatte."}]}'),
	('7e570011-0000-4000-8000-000000000045', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"30-Liter-Flachplattenreaktor mit LED-Beleuchtung, 14 Stunden Licht je Tag"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zweimal wöchentlich optische Dichte und Trockenmasse, insgesamt 24 Messtermine"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Temperatur im Stundenraster über zwölf Wochen, 2.016 Messwerte"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwei ungeplante Unterbrechungen: Pumpenausfall in Woche neun, fehlende Probenahme in Woche sechs"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000045', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Gruppe mitnimmt"}]}'),
	('7e570011-0000-4000-8000-000000000045', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Fachlich bestätigt die Messreihe, was zu erwarten war, mit einer Ausnahme: Die Erholung nach dem Pumpenausfall dauerte elf Tage und damit deutlich länger als die im Modul angesetzten fünf. Organisatorisch war die Lehre eine andere. Ein Projekt über zwölf Wochen scheitert nicht an der Messtechnik, sondern an der Frage, wer am Wochenende zuständig ist, wenn eine Pumpe um drei Uhr nachts stehenbleibt."}]}'),
	('7e570011-0000-4000-8000-000000000045', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Fortführung im Sommersemester empfiehlt die Gruppe eine einfache Alarmierung über den vorhandenen Datenlogger und einen festen Wochenplan, der vor Semesterbeginn steht statt in Woche zwei zu entstehen. Die Rohdaten liegen als CSV-Datei beim Modulverantwortlichen und können im nächsten Durchgang weiterverwendet werden."}]}'),
	('7e570011-0000-4000-8000-000000000046', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Retouren bei Arbeitshosen im Versandhandel","index":0},{"level":2,"text":"Auftrag und Rahmen","index":1},{"level":2,"text":"Was in den Daten steht","index":2},{"level":2,"text":"Vorschläge und offene Punkte","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000046', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Retouren bei Arbeitshosen im Versandhandel"}]}'),
	('7e570011-0000-4000-8000-000000000046', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000046","alt":"Titelbild des Projekts Retouren bei Arbeitshosen im Versandhandel","caption":"Ein Versandhändler für Arbeitskleidung aus Hemelingen bekommt bei Hosen 41 Prozent der Ware zurück. Im Studienprojekt haben wir 9.400 Rücksendungen aus dem Jahr 2024 ausgewertet, 14 Kundinnen und Kun…","width":100}}'),
	('7e570011-0000-4000-8000-000000000046', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Auftrag und Rahmen"}]}'),
	('7e570011-0000-4000-8000-000000000046', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Projekt lief über 14 Wochen mit fünf Studierenden und einem Partnerunternehmen aus Hemelingen, einem Versandhändler für Arbeitskleidung mit rund 30 Beschäftigten. Der Auftrag stand in zwei Sätzen im Kick-off: Die Retourenquote bei Hosen liegt bei 41 Prozent, bei Jacken bei zwölf, und niemand im Haus kann den Unterschied erklären. Wir hatten wöchentlich einen Termin im Betrieb und am Ende eine Präsentation vor der Geschäftsführung."}]}'),
	('7e570011-0000-4000-8000-000000000046', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zugang bekamen wir zu den Bestell- und Retourendaten des Jahres 2024, nicht aber zum Shopsystem selbst. Diese Grenze war von Anfang an klar und hat später eine unserer Ideen erledigt. Der Rohdatenexport kam als CSV mit 1,2 Millionen Zeilen, weil jede Statusänderung einer Bestellposition eine eigene Zeile bekommt. Das hat die geplante Auswertung in der Tabellenkalkulation nach zwei Sitzungen beendet."}]}'),
	('7e570011-0000-4000-8000-000000000046', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was in den Daten steht"}]}'),
	('7e570011-0000-4000-8000-000000000046', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ausgewertet haben wir 9.400 Rücksendungen mit Python und pandas. Der angegebene Rücksendegrund ist grob, aber eindeutig genug: Bei 62 Prozent stand zu klein. Interessant wurde es erst, als wir die Retouren nicht nach Artikel, sondern nach Lieferant gruppiert haben. Zwei von neun Lieferanten erklären den größten Teil der Hosenretouren, und beide führen eine eigene Größentabelle, die im Shop auf die Hausnorm umgerechnet wird."}]}'),
	('7e570011-0000-4000-8000-000000000046', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Hosen 41 Prozent Retourenquote, Schuhe 24 Prozent, Jacken 12 Prozent"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"62 Prozent aller Rücksendungen mit dem Grund zu klein"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwei von neun Lieferanten verursachen 71 Prozent der Hosenretouren"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bestellungen mit zwei Größen desselben Artikels: 8 Prozent der Bestellungen, 19 Prozent der Retouren"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000046', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorschläge und offene Punkte"}]}'),
	('7e570011-0000-4000-8000-000000000046', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Vorgeschlagen haben wir zwei Änderungen: die Maßtabelle des jeweiligen Lieferanten direkt am Artikel anzeigen statt der umgerechneten Hausnorm, und im Warenkorb einen Hinweis, wenn zwei Größen desselben Artikels enthalten sind. Eine dritte Idee, eine geführte Größenberatung vor dem Kauf, haben wir verworfen. Das Shopsystem lässt eigene Schritte im Bestellprozess nur über einen kostenpflichtigen Umbau zu."}]}'),
	('7e570011-0000-4000-8000-000000000046', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Kundenbefragung ist die schwächste Stelle der Arbeit. Von 60 angeschriebenen Personen haben 14 geantwortet, und darunter war niemand, der 2024 mehr als drei Bestellungen zurückgeschickt hat. Die Interviews stützen die Zahlen, tragen sie aber nicht. Der Händler hat die Maßtabellen im September umgestellt, ob die Quote dadurch sinkt, weiß im Moment niemand."}]}'),
	('7e570011-0000-4000-8000-000000000046', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Dass zwei Lieferanten den größten Teil der Rücksendungen erklären, hätten wir aus dem Bauch heraus nicht gesagt."}]}]}'),
	('7e570011-0000-4000-8000-000000000047', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Kühle Ecken: Hitzemessungen in der Alten Neustadt","index":0},{"level":2,"text":"Anlass und Aufbau der Kampagne","index":1},{"level":2,"text":"Ergebnisse der Sommermessung","index":2},{"level":2,"text":"Übergabe an Beirat und Ortsamt","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000047', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Kühle Ecken: Hitzemessungen in der Alten Neustadt"}]}'),
	('7e570011-0000-4000-8000-000000000047', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000047","alt":"Titelbild des Projekts Kühle Ecken: Hitzemessungen in der Alten Neustadt","caption":"Eine studentische Initiative hat im Sommer 2025 an 22 Punkten der Bremer Alten Neustadt Lufttemperatur und Strahlungswärme gemessen. Die Arbeit stellt die Messkampagne dar, ordnet die Ergebnisse ein…","width":100}}'),
	('7e570011-0000-4000-8000-000000000047', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Anlass und Aufbau der Kampagne"}]}'),
	('7e570011-0000-4000-8000-000000000047', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Sommer 2024 hatte der Beirat Neustadt Beschwerden über aufgeheizte Straßenzüge gesammelt, ohne dass Messwerte dazu vorlagen. Acht Studierende der Fakultät Architektur, Bau und Umwelt nahmen das zum Anlass für eine eigene Kampagne. Zwischen dem 14. Juni und dem 31. August 2025 wurde an 22 Punkten gemessen, verteilt auf geschlossene Blockrandstraßen, begrünte Wohnstraßen und die offene Uferkante an der Kleinen Weser."}]}'),
	('7e570011-0000-4000-8000-000000000047', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Ausstattung war einfach. Zwölf Datenlogger mit Strahlungsschutz hingen fest an Laternen, dazu kam ein mobiles Set mit Globethermometer für Stichproben zwischen 14 und 16 Uhr. Kalibriert wurde gegen die Station des Deutschen Wetterdienstes am Flughafen. Die Abweichung der Logger untereinander lag bei 0,3 Kelvin. Für die Fragestellung reicht das, für eine bauphysikalische Bewertung einzelner Fassaden nicht."}]}'),
	('7e570011-0000-4000-8000-000000000047', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse der Sommermessung"}]}'),
	('7e570011-0000-4000-8000-000000000047', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"An 19 Tagen lag das Maximum über 30 Grad. Die Unterschiede innerhalb des Stadtteils fielen größer aus, als der Beirat erwartet hatte: Zwischen dem heißesten Punkt an der Westerstraße und der Uferkante lagen an solchen Tagen im Mittel 4,1 Kelvin Lufttemperatur. Bei der gefühlten Temperatur, gerechnet aus Strahlung und Wind, ist der Abstand fast doppelt so groß."}]}'),
	('7e570011-0000-4000-8000-000000000047', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"22 Messpunkte, davon 12 dauerhaft und 10 als Stichprobe"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Höchstwert 38,4 Grad am 12. Juli an der Ecke Westerstraße"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kühlster Tagespunkt an 71 von 79 Messtagen an der Uferkante"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Straßen mit alten Linden lagen 1,8 Kelvin unter vergleichbaren Straßen ohne Bäume"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nachts glich sich der Abstand nicht aus: um 4 Uhr blieben 2,6 Kelvin"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000047', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Übergabe an Beirat und Ortsamt"}]}'),
	('7e570011-0000-4000-8000-000000000047', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Oktober 2025 wurde die Karte im Beirat vorgestellt. Die Initiative verzichtete auf eine reine PDF-Übergabe und stellte stattdessen die Rohdaten samt Beschreibung jedes Messpunktes bereit, damit spätere Kampagnen daran anschließen können. Das Ortsamt hat vier Standorte in die Planung für die Neupflanzungen 2026 aufgenommen, und zwar genau die vier, an denen ohnehin Leitungsarbeiten anstehen."}]}'),
	('7e570011-0000-4000-8000-000000000047', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für die Initiative bleibt ein ungelöstes Problem: die Fortführung. Die Logger gehören dem Labor für Bauphysik und werden im Sommersemester in Lehrveranstaltungen gebraucht. Eine zweite Sommerkampagne 2026 ist nur zugesagt, wenn sich vier Nachfolgerinnen oder Nachfolger finden, die die Wartung übernehmen. Bis Februar 2026 haben sich zwei gemeldet."}]}'),
	('7e570011-0000-4000-8000-000000000047', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Karte hilft uns bei der Begründung. Sie ändert aber nichts daran, dass ohne freien Leitungsgraben kein Baum gepflanzt wird."}]}]}'),
	('7e570011-0000-4000-8000-000000000048', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Streitschlichtung an einer Oberschule in Gröpelingen","index":0},{"level":2,"text":"Ausgangspunkt an der Schule","index":1},{"level":2,"text":"Die Ausbildung","index":2},{"level":2,"text":"Ein Schuljahr später","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000048', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Streitschlichtung an einer Oberschule in Gröpelingen"}]}'),
	('7e570011-0000-4000-8000-000000000048', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000048","alt":"Titelbild des Projekts Streitschlichtung an einer Oberschule in Gröpelingen","caption":"An einer Oberschule in Bremen-Gröpelingen haben wir neun Schülerinnen und Schüler zu Streitschlichtern ausgebildet und ein Schuljahr lang begleitet. Der Bericht zur Peer-Mediation wurde als Wettbewer…","width":100}}'),
	('7e570011-0000-4000-8000-000000000048', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangspunkt an der Schule"}]}'),
	('7e570011-0000-4000-8000-000000000048', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Oberschule liegt an einer Hauptstraße in Gröpelingen, hat 640 Schülerinnen und Schüler und zwei Sozialarbeiterinnen für den gesamten Standort. Anlass für das Projekt war eine Zählung aus dem Schuljahr davor: 212 dokumentierte Vorfälle, von denen der größere Teil auf Streit in der Pause zurückging und am Ende bei der Klassenleitung landete. Für ein klärendes Gespräch blieben dort selten mehr als zehn Minuten."}]}'),
	('7e570011-0000-4000-8000-000000000048', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Peer-Mediation ist kein neues Verfahren, an dieser Schule aber zweimal eingeschlafen, zuletzt im Jahr 2021. Bevor wir angefangen haben, haben wir mit vier Lehrkräften darüber gesprochen, woran es lag. Genannt wurden fehlende Zeit im Stundenplan und ein Raum, den es zwar gab, der aber zwischendurch von der Verwaltung mitbenutzt wurde. Beides haben wir vorab mit der Schulleitung geklärt."}]}'),
	('7e570011-0000-4000-8000-000000000048', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Die Ausbildung"}]}'),
	('7e570011-0000-4000-8000-000000000048', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ausgebildet wurden neun Freiwillige aus den Jahrgängen 8 und 9, an sechs Nachmittagen zwischen September und Dezember. Der Ablauf folgt dem verbreiteten Fünf-Phasen-Modell. Geübt wurde an Fällen, die die Gruppe selbst eingebracht hat: auf Rollenspiele mit erfundenen Konflikten haben wir nach dem zweiten Termin verzichtet, weil die Teilnehmenden sie albern fanden und in den Übungen nur noch gealbert wurde."}]}'),
	('7e570011-0000-4000-8000-000000000048', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs Nachmittage zu je 90 Minuten, freitags nach der sechsten Stunde"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Neun ausgebildete Schlichterinnen und Schlichter, sieben davon bis zum Schuljahresende aktiv"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ein fester Raum im Erdgeschoss, ab Januar ausschließlich für Schlichtungen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Dienst in den beiden großen Pausen, immer zu zweit im Wechsel"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000048', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ein Schuljahr später"}]}'),
	('7e570011-0000-4000-8000-000000000048', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Zwischen Januar und Juni wurden 38 Schlichtungen begonnen und 29 mit einer schriftlichen Vereinbarung beendet. Neun brachen ab, meist weil eine Seite zum zweiten Termin nicht wiederkam. Die Zahl der dokumentierten Vorfälle ist über das ganze Schuljahr von 212 auf 147 gefallen. Ob das an der Schlichtung liegt, können wir nicht belegen: im selben Schuljahr wurde auch die Pausenaufsicht verstärkt."}]}'),
	('7e570011-0000-4000-8000-000000000048', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der schwierigste Punkt war die Grenze des Verfahrens. Zwei Fälle betrafen Drohungen in einer Messenger-Gruppe und gehörten nicht in die Hand von Vierzehnjährigen. Wir haben daraufhin mit der Schulleitung festgehalten, bei welchen Themen eine Schlichtung sofort abgegeben wird. Diese Liste hing ab Februar im Schlichtungsraum an der Wand."}]}'),
	('7e570011-0000-4000-8000-000000000048', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Früher bin ich zur Klassenlehrerin gegangen, und danach gab es Ärger. Jetzt rede ich mit jemandem aus der Neunten, und das bleibt unter uns."}]}]}'),
	('7e570011-0000-4000-8000-000000000051', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Zahlungsbereitschaft für regionale Milch in Bremen","index":0},{"level":2,"text":"Theoretischer Rahmen","index":1},{"level":2,"text":"Erhebung und Datenbasis","index":2},{"level":2,"text":"Ergebnisse und Einordnung","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000051', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Zahlungsbereitschaft für regionale Milch in Bremen"}]}'),
	('7e570011-0000-4000-8000-000000000051', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000051","alt":"Titelbild des Projekts Zahlungsbereitschaft für regionale Milch in Bremen","caption":"Bachelorarbeit zu der Frage, wie viel Aufpreis Bremer Kundschaft für Milch aus dem Umland tatsächlich zahlt. In vier Supermärkten wurden 214 Personen befragt und die Angaben anschließend mit den echt…","width":100}}'),
	('7e570011-0000-4000-8000-000000000051', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Theoretischer Rahmen"}]}'),
	('7e570011-0000-4000-8000-000000000051', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Forschung zur Zahlungsbereitschaft unterscheidet seit langem zwischen der geäußerten und der tatsächlich gezahlten Preisdifferenz. In Befragungen fällt die genannte Bereitschaft regelmäßig höher aus als das spätere Kaufverhalten, ein Effekt, der in der Literatur unter dem Stichwort der hypothetischen Verzerrung geführt wird. Für regionale Lebensmittel gilt diese Lücke als besonders gut belegt, weil Regionalität sozial erwünscht ist und in einer Befragungssituation entsprechend häufig bejaht wird."}]}'),
	('7e570011-0000-4000-8000-000000000051', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Als Erklärung wird üblicherweise auf zwei Mechanismen verwiesen. Zum einen fehlt in der Befragung die Budgetrestriktion: Wer keinen Betrag abgeben muss, kann großzügig antworten. Zum anderen wirkt das Bedürfnis, sich vor der befragenden Person in einem bestimmten Licht zu zeigen. Beide Mechanismen sind in der einschlägigen Diskussion unstrittig, ihre relative Bedeutung dagegen nicht. Die vorliegende Arbeit greift diese Unterscheidung auf und prüft sie an einem einzelnen Produkt."}]}'),
	('7e570011-0000-4000-8000-000000000051', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Erhebung und Datenbasis"}]}'),
	('7e570011-0000-4000-8000-000000000051', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Befragt wurden 214 Personen in vier Supermärkten: zwei in Findorff, einer in Horn-Lehe und einer in Huchting. Die Befragung fand an sechs Terminen im November und Dezember 2024 statt, jeweils zwischen 14 und 19 Uhr. Erhoben wurde die genannte Zahlungsbereitschaft für einen Liter Frischmilch aus dem Bremer Umland gegenüber der günstigsten Handelsmarke im selben Regal, dazu Alter, Haushaltsgröße, Einkaufshäufigkeit und die Entfernung zum Markt."}]}'),
	('7e570011-0000-4000-8000-000000000051', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der zweite Teil der Arbeit stellt diesen Angaben die tatsächlichen Abverkäufe gegenüber. Zwei der vier Märkte stellten wöchentliche Absatzzahlen für die Regionalmarke und die Handelsmarke über zwölf Wochen zur Verfügung, darunter zwei Wochen mit einer Preisaktion, in der die Differenz von 34 auf 15 Cent sank. Diese Aktion war nicht geplant, erwies sich aber als der aussagekräftigste Teil der Datenbasis."}]}'),
	('7e570011-0000-4000-8000-000000000051', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"214 Kurzinterviews an vier Standorten, Ausschöpfungsquote 31 Prozent"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zwölf Wochen Abverkaufsdaten aus zwei Märkten, wöchentlich aggregiert"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Preisdifferenz im Erhebungszeitraum: 34 Cent je Liter, in der Aktionswoche 15 Cent"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontrollvariablen: Alter, Haushaltsgröße, Einkaufshäufigkeit, Entfernung zum Markt"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000051', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse und Einordnung"}]}'),
	('7e570011-0000-4000-8000-000000000051', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Mittel nannten die Befragten eine Zahlungsbereitschaft von 47 Cent je Liter über dem Preis der Handelsmarke, der Median lag bei 40 Cent. Nur elf Prozent gaben an, gar keinen Aufpreis zahlen zu wollen. Der Anteil der Regionalmarke am Milchabsatz der beiden auswertbaren Märkte lag im selben Zeitraum jedoch bei 12,6 Prozent, obwohl die Preisdifferenz mit 34 Cent unter der genannten Bereitschaft blieb."}]}'),
	('7e570011-0000-4000-8000-000000000051', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Aktionswochen zeigen den Zusammenhang deutlicher als jede Befragungsfrage. Bei 15 Cent Differenz stieg der Anteil auf 29,1 Prozent und fiel danach binnen zwei Wochen wieder auf 13,4 Prozent. Die daraus geschätzte Elastizität passt nicht zu den genannten Beträgen, sondern zu einer erheblich niedrigeren realen Bereitschaft von etwa 18 Cent. Damit bestätigt der Fall das Muster, das in der Diskussion um die hypothetische Verzerrung beschrieben wird."}]}'),
	('7e570011-0000-4000-8000-000000000051', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Klar zahle ich mehr für Milch von hier. Aber wenn ich ehrlich bin, greife ich meistens nach der Flasche, die vorne im Regal steht."}]}]}'),
	('7e570011-0000-4000-8000-000000000052', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Wiederverwendung von Ziegeln aus einem Abbruch in Walle","index":0},{"level":2,"text":"Der Bestand","index":1},{"level":2,"text":"Bergung und Prüfung","index":2},{"level":2,"text":"Was das für ein Bauvorhaben heißt","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000052', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Wiederverwendung von Ziegeln aus einem Abbruch in Walle"}]}'),
	('7e570011-0000-4000-8000-000000000052', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000052","alt":"Titelbild des Projekts Wiederverwendung von Ziegeln aus einem Abbruch in Walle","caption":"Aus einem Speichergebäude von 1928 in Bremen-Walle wurden 600 gebrauchte Ziegel von Hand geborgen, gereinigt und im Labor geprüft. Die Bachelorarbeit klärt, ob sich solche Steine für tragendes Mauerw…","width":100}}'),
	('7e570011-0000-4000-8000-000000000052', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Bestand"}]}'),
	('7e570011-0000-4000-8000-000000000052', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Speicher an der Nordstraße stammt aus dem Jahr 1928: Vollziegel im Kreuzverband, gemauert in Kalkmörtel. Für einen Wohnungsneubau war der Abbruch bereits beschlossen, anfallen sollten rund 180 Tonnen Ziegelbruch für die Deponie. Der Kalkmörtel ist der Grund, warum dieses Gebäude für die Arbeit überhaupt in Frage kam. Steine aus Zementmörtel lassen sich kaum zerstörungsfrei lösen, bei Kalk geht es mit Hammer und Geduld."}]}'),
	('7e570011-0000-4000-8000-000000000052', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Bauaufnahme über drei Tage im März 2025 erfasste Wandaufbau, Fugenbild, Zustand der Sichtflächen und Lage der Ausblühungen. Auffällig war die Streuung innerhalb desselben Bauteils: Zur Straße hin zeigten die Steine deutliche Frostschäden, im Kern der Wand waren sie unversehrt."}]}'),
	('7e570011-0000-4000-8000-000000000052', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Bergung und Prüfung"}]}'),
	('7e570011-0000-4000-8000-000000000052', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"600 Steine wurden von Hand gelöst, von Mörtelresten befreit und einzeln nummeriert. Geprüft wurde anschließend im Labor am Neustadtswall nach denselben Verfahren, die für neue Steine gelten, ergänzt um eine Sichtprüfung auf Haarrisse. Die Nummerierung hielt fest, aus welcher Wand und aus welcher Höhe ein Stein stammte, damit sich die Prüfwerte später den Lagen im Gebäude zuordnen ließen."}]}'),
	('7e570011-0000-4000-8000-000000000052', 8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Druckfestigkeit lag über dem, was ein zweigeschossiges Wohnhaus verlangt, und über der Erwartung aus der Literatur zu Ziegeln dieser Bauzeit. Die Streuung ist allerdings groß, der niedrigste Einzelwert betrug 11,2 Newton pro Quadratmillimeter. Für tragendes Mauerwerk müsste die Charge klassiert werden; über die Verwendung darf nicht der Mittelwert entscheiden."}]}'),
	('7e570011-0000-4000-8000-000000000052', 9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Druckfestigkeit an 30 Steinen: Mittelwert 22,4 Newton pro Quadratmillimeter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Frost-Tau-Wechsel über 50 Zyklen: 3 von 20 Steinen platzten ab"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Wasseraufnahme im Mittel 14,8 Prozent der Trockenmasse"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bruch beim Reinigen: 118 von 600 Steinen, also knapp 20 Prozent Ausschuss"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Zeitaufwand im Mittel 4,5 Minuten je brauchbarem Stein"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000052', 10, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was das für ein Bauvorhaben heißt"}]}'),
	('7e570011-0000-4000-8000-000000000052', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Rechnerisch kostet ein geborgener Stein bei Bremer Lohnkosten etwa 2,90 Euro, ein neuer Vollziegel vergleichbarer Festigkeit 0,85 Euro. Wirtschaftlich wird die Wiederverwendung erst, wenn die eingesparte Entsorgung gegengerechnet wird und der Rückbau ohnehin von Hand erfolgen muss, etwa in engen Baulücken. Ökologisch fällt der Vergleich anders aus, weil der Brennvorgang vollständig entfällt."}]}'),
	('7e570011-0000-4000-8000-000000000052', 12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Übertragbar sind die Ergebnisse auf Bremer Bauten der Zwanzigerjahre mit Kalkmörtel, und nur auf diese. Für die Nachkriegsbestände mit Zementmörtel ist ein deutlich höherer Bruchanteil zu erwarten. Ein Vorversuch an einem Wandstück von 1962 lag bei einer Ausschussquote über 60 Prozent und wurde nach zwei Tagen abgebrochen."}]}'),
	('7e570011-0000-4000-8000-000000000052', 13, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Besorgt mir das Gerüst und zwei Wochen mehr im Zeitplan, dann hole ich euch die Steine einzeln raus. Mit der Maschine bin ich in drei Tagen durch."}]}]}'),
	('7e570011-0000-4000-8000-000000000053', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Audiowalk zur Werftgeschichte in Gröpelingen","index":0},{"level":2,"text":"Ausgangspunkt Werftgelände","index":1},{"level":2,"text":"Sieben Stationen, knapp drei Kilometer","index":2},{"level":2,"text":"Was am Gerät scheiterte","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000053', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Audiowalk zur Werftgeschichte in Gröpelingen"}]}'),
	('7e570011-0000-4000-8000-000000000053', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000053","alt":"Titelbild des Projekts Audiowalk zur Werftgeschichte in Gröpelingen","caption":"Ein Audiowalk mit sieben Stationen über das Ende der AG Weser 1983 und die Jahre danach in Gröpelingen. Grundlage sind acht Gespräche, von ehemaligen Werftarbeitern bis zu Beschäftigten der heutigen…","width":100}}'),
	('7e570011-0000-4000-8000-000000000053', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ausgangspunkt Werftgelände"}]}'),
	('7e570011-0000-4000-8000-000000000053', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"1983 schloss die AG Weser, und mit der Werft verschwanden in Gröpelingen mehrere tausend Arbeitsplätze innerhalb weniger Monate. Auf dem Gelände stehen heute ein Einkaufszentrum und ein Kulturzentrum. Im Stadtteil ist die Schließung bis heute präsent, in der Wahrnehmung vieler Studierender, die dort ihr Praxissemester machen, dagegen kaum. Der Audiowalk versucht, diese Lücke an den Orten selbst zu schließen und nicht im Seminarraum."}]}'),
	('7e570011-0000-4000-8000-000000000053', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Grundlage sind acht Gespräche zwischen 40 und 110 Minuten Länge. Vier Befragte haben auf der Werft gearbeitet, zwei sind in unmittelbarer Nachbarschaft aufgewachsen, zwei arbeiten heute in der Stadtteilarbeit. Die Kontakte kamen über das Kulturzentrum und über einen Aushang in der Gröpelinger Heerstraße zustande, nicht über ein Archiv."}]}'),
	('7e570011-0000-4000-8000-000000000053', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Sieben Stationen, knapp drei Kilometer"}]}'),
	('7e570011-0000-4000-8000-000000000053', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Weg ist knapp drei Kilometer lang und dauert mit allen Hörstücken etwa 70 Minuten. Er beginnt auf dem alten Werftgelände und endet an einer Straßenbahnhaltestelle, damit niemand denselben Weg zurücklaufen muss. Jede Station trägt ein Stück zwischen zwei und sechs Minuten; die Reihenfolge ist vorgegeben, weil die Erzählung chronologisch von 1983 bis in die Gegenwart läuft."}]}'),
	('7e570011-0000-4000-8000-000000000053', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Station 1: das Kulturzentrum auf dem Werftgelände, die letzte Schicht 1983"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Station 3: das ehemalige Werkstor, heute Einfahrt zu einem Parkplatz"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Station 5: die Gröpelinger Heerstraße und die leeren Läden der späten Achtziger"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Station 7: der Deich mit Blick auf die verbliebenen Kräne"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000053', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was am Gerät scheiterte"}]}'),
	('7e570011-0000-4000-8000-000000000053', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Geplant war eine Auslösung der Hörstücke über GPS, sobald jemand eine Station erreicht. Zwischen den hohen Hallen und in der engen Bebauung funktionierte das nicht zuverlässig: Die Abweichung lag stellenweise bei 40 Metern, und ein Stück startete mitten auf einer Kreuzung. Die jetzige Lösung ist unelegant und läuft stabil: laminierte Schilder mit Nummern, die selbst eingegeben werden, dazu ein Faltblatt mit dem Weg."}]}'),
	('7e570011-0000-4000-8000-000000000053', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Offen ist die Frage der Rechte an den Aufnahmen. Alle acht Befragten haben schriftlich zugestimmt, zwei davon aber nur für die Nutzung innerhalb der Lehrveranstaltung. Ihre Passagen fehlen deshalb in der veröffentlichten Fassung, was die Erzählung an zwei Stellen spürbar dünner macht. Eine erneute Anfrage läuft über das Kulturzentrum."}]}'),
	('7e570011-0000-4000-8000-000000000053', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Am letzten Tag haben wir das Werkzeug eingeräumt, als kämen wir am Montag wieder. Dabei wussten wir alle, dass es nicht so ist."}]}]}'),
	('7e570011-0000-4000-8000-000000000054', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Sitzplatzanzeige für die Bibliothek Neustadtswall","index":0},{"level":2,"text":"Anlass in der Prüfungsphase","index":1},{"level":2,"text":"Aufbau der Messkette","index":2},{"level":2,"text":"Test und Genauigkeit","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000054', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Sitzplatzanzeige für die Bibliothek Neustadtswall"}]}'),
	('7e570011-0000-4000-8000-000000000054', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000054","alt":"Titelbild des Projekts Sitzplatzanzeige für die Bibliothek Neustadtswall","caption":"Projekt aus der Lehrveranstaltung zu eingebetteten Systemen: eine Sitzplatzanzeige für die Bibliothek am Neustadtswall. 24 Arbeitsplätze melden ihre Belegung über Abstandssensoren und MQTT an eine We…","width":100}}'),
	('7e570011-0000-4000-8000-000000000054', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Anlass in der Prüfungsphase"}]}'),
	('7e570011-0000-4000-8000-000000000054', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In der Prüfungsphase laufen Studierende regelmäßig durch drei Etagen, um einen freien Arbeitsplatz zu suchen, und gehen danach wieder. Die Bibliothek hatte im Sommersemester 2026 selbst gefragt, ob sich die Belegung messen lässt, und die Aufgabe wurde in der Lehrveranstaltung zu eingebetteten Systemen vergeben. Vorgabe der Bibliotheksleitung war von Anfang an, dass keine Kamera zum Einsatz kommt und keine Daten entstehen, die sich einer Person zuordnen lassen."}]}'),
	('7e570011-0000-4000-8000-000000000054', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufbau der Messkette"}]}'),
	('7e570011-0000-4000-8000-000000000054', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Unter jeder Tischplatte sitzt ein Abstandssensor, der nach unten misst und nur unterscheidet, ob im Stuhlbereich etwas steht oder nicht. Vier bis sechs Sensoren teilen sich einen ESP32, der alle 30 Sekunden per MQTT einen Zustand meldet. Ein Raspberry Pi im Technikraum sammelt die Meldungen und liefert eine Webseite mit einem Grundriss je Etage aus. Gespeichert werden nur der aktuelle Zustand und ein Stundenmittel, die Rohwerte verwirft der Dienst nach fünf Minuten."}]}'),
	('7e570011-0000-4000-8000-000000000054', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"24 ausgerüstete Arbeitsplätze auf zwei Etagen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"5 ESP32-Knoten, versorgt über vorhandene USB-Netzteile"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"MQTT-Broker und Webseite auf einem Raspberry Pi 4"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rohwerte nach fünf Minuten verworfen, nur Stundenmittel bleibt"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000054', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Test und Genauigkeit"}]}'),
	('7e570011-0000-4000-8000-000000000054', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Über drei Tage haben wir stündlich von Hand gezählt und mit der Anzeige verglichen. Von 312 Vergleichen stimmten 243 überein, also 78 Prozent. Fast alle Abweichungen gehen in dieselbe Richtung: Eine Jacke über der Stuhllehne oder ein abgestellter Rucksack zählt als belegt, obwohl niemand am Tisch sitzt. Genau so wird der Platz in der Bibliothek allerdings auch verstanden, wenn jemand kurz in der Mensa ist, sodass die Anzeige für den praktischen Zweck nicht durchgehend falsch liegt."}]}'),
	('7e570011-0000-4000-8000-000000000054', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ungelöst blieb der Zeitraum ab 19 Uhr, wenn die Reinigung Stühle hochstellt und dabei ganze Reihen als belegt erscheinen. Dafür steht jetzt eine feste Abendregel im Code, was keine saubere Lösung ist. Der Bericht schlägt stattdessen eine Auswertung der Sitzdauer vor: Ein Platz, der zwölf Stunden ohne Unterbrechung belegt meldet, ist mit hoher Wahrscheinlichkeit leer."}]}'),
	('7e570011-0000-4000-8000-000000000061', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Kostenrechnung für ein Reparaturcafé in Walle","index":0},{"level":2,"text":"Anlass und Aufgabenstellung","index":1},{"level":2,"text":"Wie die Kosten erfasst wurden","index":2},{"level":2,"text":"Ergebnis und Grenzen der Rechnung","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000061', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Kostenrechnung für ein Reparaturcafé in Walle"}]}'),
	('7e570011-0000-4000-8000-000000000061', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000061","alt":"Titelbild des Projekts Kostenrechnung für ein Reparaturcafé in Walle","caption":"Beleg aus der Lehrveranstaltung Kosten- und Leistungsrechnung: Für ein ehrenamtlich betriebenes Reparaturcafé in Bremen-Walle entstand eine Vollkostenrechnung über vier Öffnungstermine, samt der Frag…","width":100}}'),
	('7e570011-0000-4000-8000-000000000061', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Anlass und Aufgabenstellung"}]}'),
	('7e570011-0000-4000-8000-000000000061', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Lehrveranstaltung Kosten- und Leistungsrechnung verlangt im dritten Semester einen Beleg an einem echten Fall. Unsere Gruppe fand ihn im Reparaturcafé in Walle, das seit 2019 einmal im Monat in einem Gemeindesaal öffnet. Der Verein wusste, dass er mit den Spenden nicht auskommt, konnte aber nicht benennen, an welcher Stelle das Geld fehlt. Die Buchführung bestand aus einer Kassenkladde und einem Ordner mit Belegen."}]}'),
	('7e570011-0000-4000-8000-000000000061', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wie die Kosten erfasst wurden"}]}'),
	('7e570011-0000-4000-8000-000000000061', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Über vier Öffnungstermine haben wir jeden Vorgang mitgeschrieben: Zahl der Reparaturen, Dauer, verbrauchtes Material und die geleisteten Stunden der Ehrenamtlichen. Raummiete, Versicherung und Werkzeugbeschaffung kamen aus den Belegen des Vereins. Die ehrenamtliche Arbeit haben wir mit einem kalkulatorischen Stundensatz von 15 Euro angesetzt und getrennt ausgewiesen, damit beide Sichten nebeneinander stehen. Insgesamt gingen 143 Reparaturen in die Rechnung ein."}]}'),
	('7e570011-0000-4000-8000-000000000061', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vier Öffnungstermine im Wintersemester 2024/25 begleitet"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"143 Reparaturen einzeln erfasst, mit Dauer und Materialeinsatz"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gemeinkosten aus Miete, Versicherung und Werkzeug"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ehrenamt kalkulatorisch mit 15 Euro je Stunde ausgewiesen"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000061', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnis und Grenzen der Rechnung"}]}'),
	('7e570011-0000-4000-8000-000000000061', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Ohne die ehrenamtliche Arbeit kostet eine Reparatur im Schnitt 4,80 Euro, mit ihr 27,40 Euro. Die tatsächliche Spende lag bei 3,10 Euro je Reparatur. Auffällig ist die Verteilung der Arbeitszeit: Sieben Fahrradreparaturen banden ein Fünftel der gesamten Stunden, weil passendes Werkzeug fehlte und improvisiert wurde. Eine Anschaffung für rund 200 Euro würde diesen Posten spürbar senken; der Verein hat sie inzwischen beschlossen."}]}'),
	('7e570011-0000-4000-8000-000000000061', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Rechnung hat zwei Schwächen, die im Beleg auch so benannt sind. Vier Termine sind eine schmale Grundlage, und der Dezembertermin fiel wegen einer defekten Heizung aus, sodass die Verteilung der Reparaturarten verzerrt sein kann. Außerdem ist der kalkulatorische Stundensatz gesetzt und nicht hergeleitet; mit einem anderen Satz kippt der Vergleich zwischen den Gewerken. Für die Frage nach dem fehlenden Geld reicht die Genauigkeit dennoch."}]}'),
	('7e570011-0000-4000-8000-000000000061', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Dass die Fahrräder so viel Zeit fressen, haben wir geahnt. Schwarz auf weiß gesehen haben wir es erst durch eure Strichliste."}]}]}'),
	('7e570011-0000-4000-8000-000000000062', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Bauzeitenplan für die Kita-Erweiterung in Findorff","index":0},{"level":2,"text":"Das Büro und der Auftrag","index":1},{"level":2,"text":"Aufgaben im Projekt","index":2},{"level":2,"text":"Ergebnis und was schiefging","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000062', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Bauzeitenplan für die Kita-Erweiterung in Findorff"}]}'),
	('7e570011-0000-4000-8000-000000000062', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000062","alt":"Titelbild des Projekts Bauzeitenplan für die Kita-Erweiterung in Findorff","caption":"Praxisprojekt in einem Bremer Ingenieurbüro: Für die Erweiterung einer Kita in Findorff entstanden Massenermittlung und Bauzeitenplan, dazu die Auswertung, warum der Rohbau drei Wochen später begann…","width":100}}'),
	('7e570011-0000-4000-8000-000000000062', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Das Büro und der Auftrag"}]}'),
	('7e570011-0000-4000-8000-000000000062', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Praxisprojekt lief von April bis Juli 2025 in einem Ingenieurbüro in der Bremer Neustadt mit elf Beschäftigten. Der Auftrag war die Erweiterung einer städtischen Kita in Findorff um zwei Gruppenräume und einen Mehrzweckraum, rund 240 Quadratmeter Nutzfläche, geplant im Bestand und bei laufendem Betrieb. Genau diese Randbedingung hat den Terminplan bestimmt: Neben der Baustelle wird weiter betreut."}]}'),
	('7e570011-0000-4000-8000-000000000062', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Unterschied zur Übungsaufgabe im Studium lag weniger in der Rechnung als in der Abstimmung. Jeder Bauabschnitt musste mit der Kita-Leitung besprochen werden, der Lieferverkehr durfte die Bring- und Abholzeiten nicht kreuzen, und für die lauten Arbeiten kamen nur die Schließzeiten in Frage. Ein Balkenplan, der das nicht abbildet, ist im Büro schnell wieder auf dem Tisch."}]}'),
	('7e570011-0000-4000-8000-000000000062', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgaben im Projekt"}]}'),
	('7e570011-0000-4000-8000-000000000062', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Arbeit begann mit den Ausführungsplänen und endete bei den Protokollen der Baubesprechungen. Der Bauzeitenplan entstand in mehreren Durchläufen, weil die Ferienzeiten der Kita erst nachträglich vom Träger bestätigt wurden und sich die Reihenfolge damit zweimal verschob. Geführt wurde er in der Software des Büros, eingearbeitet hat mich der Bauleiter an zwei Nachmittagen. Die Massenermittlung lief daneben in einer Tabelle, die im Büro seit Jahren in Gebrauch ist."}]}'),
	('7e570011-0000-4000-8000-000000000062', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Massenermittlung für Rohbau und Ausbau aus den Ausführungsplänen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bauzeitenplan als Balkenplan mit 68 Vorgängen, abgestimmt auf die Ferienzeiten der Kita"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vergleich zweier Bauabläufe: Erweiterung zuerst oder Sanierung des Bestands zuerst"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Aufmaß von zwei Kellerräumen, die in den Bestandsplänen fehlten"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Protokolle für vier Baubesprechungen mit Träger und ausführenden Firmen"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000062', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnis und was schiefging"}]}'),
	('7e570011-0000-4000-8000-000000000062', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gewählt wurde der Ablauf mit der Erweiterung zuerst, weil der Bestand damit bis zu den Sommerferien in Betrieb bleiben konnte. Rechnerisch lag diese Variante elf Werktage über der anderen, dafür entfiel die Interimsunterbringung für zwei Gruppen. Diese Abwägung stand am Ende auch so in der Vorlage für den Träger und wurde übernommen."}]}'),
	('7e570011-0000-4000-8000-000000000062', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Begonnen hat der Rohbau trotzdem drei Wochen später als geplant. Die Leitungsauskunft für den Anschluss an die Bestandsheizung kam verspätet, und im Plan gab es zwischen Baugrubenaushub und Sohle keinen Puffer, der das hätte auffangen können. Der Fehler lag nicht in der Dauer der einzelnen Vorgänge, sondern in einer Verknüpfung, die für ein Bestandsgrundstück zu optimistisch war."}]}'),
	('7e570011-0000-4000-8000-000000000062', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Der Plan war gut gerechnet. Gefehlt hat die Woche Puffer vor dem ersten Betonieren, und die kostet nichts, solange sie im Plan steht."}]}]}'),
	('7e570011-0000-4000-8000-000000000063', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Podcast über Ehrenamt in Bremen-Nord","index":0},{"level":2,"text":"Auswahl der Gäste","index":1},{"level":2,"text":"Aufnahme und Schnitt","index":2},{"level":2,"text":"Was ankam","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000063', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Podcast über Ehrenamt in Bremen-Nord"}]}'),
	('7e570011-0000-4000-8000-000000000063', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000063","alt":"Titelbild des Projekts Podcast über Ehrenamt in Bremen-Nord","caption":"Fünf Folgen über Menschen, die sich zwischen Vegesack und Farge ehrenamtlich engagieren, aufgenommen im Semesterprojekt des Wintersemesters 2025/26. Der Bericht beschreibt, wie die Gäste ausgewählt w…","width":100}}'),
	('7e570011-0000-4000-8000-000000000063', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Auswahl der Gäste"}]}'),
	('7e570011-0000-4000-8000-000000000063', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Idee kam aus einem Seminar zur Sozialberichterstattung. Statt über Zahlen zum Ehrenamt zu schreiben, wollten wir hören, wie der Alltag darin aussieht. Angefragt haben wir 19 Vereine und Initiativen zwischen Vegesack und Farge, zugesagt haben sieben, aufgenommen wurden am Ende fünf. Zwei Absagen kamen kurzfristig, in einem Fall, weil der Verein befürchtete, ein Streit mit dem Ortsamt könnte zur Sprache kommen."}]}'),
	('7e570011-0000-4000-8000-000000000063', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufnahme und Schnitt"}]}'),
	('7e570011-0000-4000-8000-000000000063', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Aufgenommen haben wir bei den Leuten vor Ort und nicht im Studio. Das klingt lebendiger und ist technisch heikler: In der Turnhalle des Sportvereins hallte es so stark, dass die erste Aufnahme unbrauchbar war und wir eine Woche später im Geräteraum von vorn angefangen haben. Danach lief für alle weiteren Termine derselbe Ablauf."}]}'),
	('7e570011-0000-4000-8000-000000000063', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"zwei Ansteckmikrofone und ein Handrekorder aus dem Medienlabor"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Probeaufnahme von 30 Sekunden, bevor das Gespräch beginnt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Schnitt in Reaper, je Folge 40 bis 55 Minuten Rohmaterial"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gegenlesen des fertigen Schnitts durch die Gäste vor der Veröffentlichung"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000063', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was ankam"}]}'),
	('7e570011-0000-4000-8000-000000000063', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Folgen liegen seit Januar 2026 auf dem Hochschulserver und in zwei gängigen Verzeichnissen. Bis Ende Februar wurden sie 640 Mal abgerufen, am häufigsten die erste Folge über eine Station der Seenotretter. Ein Ortsamt hat die Reihe in seinem Newsletter verlinkt, danach stiegen die Abrufe an zwei Tagen deutlich an."}]}'),
	('7e570011-0000-4000-8000-000000000063', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Unterschätzt haben wir den Aufwand für das Gegenlesen. Zwei Gäste wollten Passagen gestrichen haben, die im Gespräch beiläufig gefallen waren, und einmal ging dabei der Zusammenhang verloren, sodass die halbe Folge neu geschnitten werden musste. Für eine Fortsetzung im Sommersemester klären wir die Freigabe vorher schriftlich."}]}'),
	('7e570011-0000-4000-8000-000000000063', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Gesagt habe ich das schon, aber ich möchte es nicht für immer im Netz stehen haben."}]}]}'),
	('7e570011-0000-4000-8000-000000000064', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Reparaturtreff für Kleingeräte am Neustadtswall","index":0},{"level":2,"text":"Wie der Treff entstanden ist","index":1},{"level":2,"text":"Zahlen aus dem ersten Semester","index":2},{"level":2,"text":"Was wir unterschätzt haben","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000064', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Reparaturtreff für Kleingeräte am Neustadtswall"}]}'),
	('7e570011-0000-4000-8000-000000000064', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000064","alt":"Titelbild des Projekts Reparaturtreff für Kleingeräte am Neustadtswall","caption":"Eine studentische Initiative der Fakultät 4: Seit April 2026 öffnet an jedem zweiten Donnerstag eine Werkstatt im AB-Gebäude, in der Kleingeräte wie Wasserkocher und Kopfhörer gemeinsam repariert wer…","width":100}}'),
	('7e570011-0000-4000-8000-000000000064', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Wie der Treff entstanden ist"}]}'),
	('7e570011-0000-4000-8000-000000000064', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Wintersemester 2025/26 hatten drei Studierende der Elektrotechnik im Labor immer wieder Geräte von Kommilitoninnen repariert, meist Kopfhörer und Netzteile. Daraus ist im April 2026 ein fester Termin geworden: an jedem zweiten Donnerstag von 16 bis 19 Uhr im Raum AB 217, mit zwei Lötstationen und einem Schrank voll Werkzeug. Der AStA hat 480 Euro für Verbrauchsmaterial bewilligt, die Fakultät stellt den Raum."}]}'),
	('7e570011-0000-4000-8000-000000000064', 5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Zahlen aus dem ersten Semester"}]}'),
	('7e570011-0000-4000-8000-000000000064', 6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Bis Ende Juli fanden acht Termine statt. Gebracht wurden 94 Geräte, von denen 51 den Raum funktionsfähig verlassen haben. 23 waren nicht zu retten, meist wegen verklebter Gehäuse oder fehlender Ersatzteile, und 20 warten noch auf ein bestelltes Bauteil. Die häufigste Reparatur war das Nachlöten einer Klinkenbuchse, die zweithäufigste der Tausch eines aufgeblähten Akkus."}]}'),
	('7e570011-0000-4000-8000-000000000064', 7, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Acht Termine zwischen April und Juli 2026"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"94 gebrachte Geräte, 51 davon repariert"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Häufigster Fall: Klinkenbuchse nachlöten, 17 Mal"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Im Schnitt elf Besucherinnen und Besucher je Termin"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"480 Euro AStA-Mittel, davon 310 Euro ausgegeben"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000064', 8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was wir unterschätzt haben"}]}'),
	('7e570011-0000-4000-8000-000000000064', 9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Aufwand liegt nicht am Lötkolben, er liegt bei den Akkus. Eine aufgeblähte Lithiumzelle darf nicht in den Restmüll, und die Hochschule hatte für diesen Fall keinen benannten Weg. Nach dem dritten Termin standen elf Zellen in einer Blechkiste im Flur, bis die Betriebstechnik einen Sammelbehälter aufgestellt hat. Wer eine solche Werkstatt aufmacht, sollte diesen Punkt vor dem ersten Termin geklärt haben und nicht danach."}]}'),
	('7e570011-0000-4000-8000-000000000064', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der zweite Punkt ist die Haftung. Wir reparieren nicht für andere, sondern mit ihnen, und eingeschaltet wird das Gerät am Ende nur von der Besitzerin selbst. Diese Regel steht inzwischen ausgedruckt an der Tür, weil sie im Gespräch regelmäßig untergeht. Zweimal mussten wir eine Reparatur deshalb abbrechen."}]}'),
	('7e570011-0000-4000-8000-000000000064', 11, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich hätte das Ding weggeworfen. Dass es nur ein Kabelbruch war, hätte ich nie vermutet."}]}]}'),
	('7e570011-0000-4000-8000-000000000065', 0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Solarboot für die Regatta auf der Weser","index":0},{"level":2,"text":"Aufgabe und Randbedingungen","index":1},{"level":2,"text":"Antrieb und Auslegung","index":2},{"level":2,"text":"Das Rennwochenende","index":3}]}}'),
	('7e570011-0000-4000-8000-000000000065', 1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Solarboot für die Regatta auf der Weser"}]}'),
	('7e570011-0000-4000-8000-000000000065', 2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"7e570012-0000-4000-8000-000000000065","alt":"Titelbild des Projekts Solarboot für die Regatta auf der Weser","caption":"Acht Studierende bauten für die studentische Solarboot-Regatta ein 5,2 Meter langes Boot und traten damit im Juni 2025 auf der Weser an. Der Bericht beschreibt die Antriebsauslegung und was davon auf…","width":100}}'),
	('7e570011-0000-4000-8000-000000000065', 3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Aufgabe und Randbedingungen"}]}'),
	('7e570011-0000-4000-8000-000000000065', 4, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Wettbewerbsregeln geben eine maximale Solarfläche von 6 Quadratmetern und eine Batteriekapazität von 1,5 Kilowattstunden vor. Alles andere ist frei. Das Team entschied sich im November 2024 für einen schmalen Verdränger von 5,2 Metern Länge und 0,9 Metern Breite, gebaut aus Sperrholz mit Epoxidbeschichtung. Ausschlaggebend war nicht die Höchstgeschwindigkeit, sondern das Langstreckenrennen über 90 Minuten, in dem der Energieverbrauch zählt."}]}'),
	('7e570011-0000-4000-8000-000000000065', 5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Gebaut wurde in der Werkstatt am Neustadtswall zwischen Januar und Mai 2025, überwiegend an Freitagnachmittagen und in den Semesterferien. Das Budget lag bei 4.800 Euro, davon 3.100 Euro aus Sponsorenmitteln zweier Bremer Betriebe. Die Solarmodule waren gebraucht und stammten aus einer abgebauten Dachanlage in Osterholz, was den Wirkungsgrad um etwa ein Fünftel unter den Neuzustand drückte."}]}'),
	('7e570011-0000-4000-8000-000000000065', 6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Antrieb und Auslegung"}]}'),
	('7e570011-0000-4000-8000-000000000065', 7, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Antrieb besteht aus einem bürstenlosen Gleichstrommotor mit 1,2 Kilowatt Dauerleistung und einer selbst gefertigten Welle mit Propeller von 240 Millimetern Durchmesser. Die Auslegung erfolgte über eine Widerstandsabschätzung nach Holtrop, gegengerechnet mit Schleppversuchen im Modellmaßstab. Beide Rechnungen lagen bei 8 Kilometern je Stunde etwa 15 Prozent auseinander. Für die Propellerwahl reichte das, für die Steigung war es zu grob."}]}'),
	('7e570011-0000-4000-8000-000000000065', 8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rumpf 5,2 Meter, Verdrängung 210 Kilogramm mit Fahrerin"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Motor 1,2 Kilowatt Dauerleistung, Propeller 240 Millimeter"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Solarfläche 5,8 Quadratmeter aus gebrauchten Modulen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Batterie 1,48 Kilowattstunden, Lithium-Eisenphosphat"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Gesamtbudget 4.800 Euro, Bauzeit fünf Monate"}]}]}]}'),
	('7e570011-0000-4000-8000-000000000065', 9, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Das Rennwochenende"}]}'),
	('7e570011-0000-4000-8000-000000000065', 10, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Im Langstreckenrennen belegte das Boot Platz 7 von 14 gestarteten Teams. Die geplante Dauerleistung ließ sich nicht abrufen, weil der Motorregler ab Minute 40 in die Temperaturbegrenzung ging. Die Ursache war banal: Der Regler saß in einem geschlossenen Kasten unter der Sitzbank, gedacht als Spritzwasserschutz, und bekam dort keine Luft. Im Sprintrennen über 200 Meter fiel das nicht auf, dort reichte es für Platz 4."}]}'),
	('7e570011-0000-4000-8000-000000000065', 11, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Für 2026 ist derselbe Rumpf mit überarbeiteter Anordnung der Elektronik vorgesehen. Die Kühlung des Reglers steht dabei vor jeder Leistungssteigerung auf der Liste, denn fünfzig Minuten reduzierte Fahrt kosten im Langstreckenrennen mehr als die 200 Watt, die neue Module statt der gebrauchten gebracht hätten."}]}'),
	('7e570011-0000-4000-8000-000000000065', 12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wir haben ein halbes Jahr über den Propeller geredet und keine zehn Minuten über die Belüftung des Kastens."}]}]}')
) as v(project_id, order_index, type, content);

-- -------------------------------------------------------------------
-- 5) Dateizeilen. Die Bytes kommen weiter unten ueber HTTP; ohne sie
--    antwortet GET /api/files/{id} mit 500 und die Kacheln bleiben leer.
--    stored_file.size wird nach dem Laden nachgetragen.
-- -------------------------------------------------------------------
insert into stored_file (id, project_id, uploaded_by, file_name, mime_type, size, path, created_at)
select v.id::uuid, v.project_id::uuid, v.uploaded_by::uuid, v.file_name,
       'image/jpeg', 0, 'projects/' || v.project_id || '/' || v.id,
       now() - interval '200 days'
from (values
	('7e570012-0000-4000-8000-000000000001', '7e570011-0000-4000-8000-000000000001', '7e570010-0000-4000-8000-000000000001', 'titelbild-01.jpg'),
	('7e570012-0000-4000-8000-000000000002', '7e570011-0000-4000-8000-000000000002', '7e570010-0000-4000-8000-000000000002', 'titelbild-02.jpg'),
	('7e570012-0000-4000-8000-000000000003', '7e570011-0000-4000-8000-000000000003', '7e570010-0000-4000-8000-000000000003', 'titelbild-03.jpg'),
	('7e570012-0000-4000-8000-000000000004', '7e570011-0000-4000-8000-000000000004', '7e570010-0000-4000-8000-000000000004', 'titelbild-04.jpg'),
	('7e570012-0000-4000-8000-000000000005', '7e570011-0000-4000-8000-000000000005', '7e570010-0000-4000-8000-000000000005', 'titelbild-05.jpg'),
	('7e570012-0000-4000-8000-000000000006', '7e570011-0000-4000-8000-000000000006', '7e570010-0000-4000-8000-000000000006', 'titelbild-06.jpg'),
	('7e570012-0000-4000-8000-000000000007', '7e570011-0000-4000-8000-000000000007', '7e570010-0000-4000-8000-000000000001', 'titelbild-07.jpg'),
	('7e570012-0000-4000-8000-000000000008', '7e570011-0000-4000-8000-000000000008', '7e570010-0000-4000-8000-000000000008', 'titelbild-08.jpg'),
	('7e570012-0000-4000-8000-000000000009', '7e570011-0000-4000-8000-000000000009', '7e570010-0000-4000-8000-000000000002', 'titelbild-09.jpg'),
	('7e570012-0000-4000-8000-000000000010', '7e570011-0000-4000-8000-000000000010', '7e570010-0000-4000-8000-000000000003', 'titelbild-10.jpg'),
	('7e570012-0000-4000-8000-000000000011', '7e570011-0000-4000-8000-000000000011', '7e570010-0000-4000-8000-000000000001', 'titelbild-11.jpg'),
	('7e570012-0000-4000-8000-000000000012', '7e570011-0000-4000-8000-000000000012', '7e570010-0000-4000-8000-000000000005', 'titelbild-12.jpg'),
	('7e570012-0000-4000-8000-000000000013', '7e570011-0000-4000-8000-000000000013', '7e570010-0000-4000-8000-000000000006', 'titelbild-13.jpg'),
	('7e570012-0000-4000-8000-000000000014', '7e570011-0000-4000-8000-000000000014', '7e570010-0000-4000-8000-000000000007', 'titelbild-14.jpg'),
	('7e570012-0000-4000-8000-000000000015', '7e570011-0000-4000-8000-000000000015', '7e570010-0000-4000-8000-000000000008', 'titelbild-15.jpg'),
	('7e570012-0000-4000-8000-000000000016', '7e570011-0000-4000-8000-000000000016', '7e570010-0000-4000-8000-000000000002', 'titelbild-16.jpg'),
	('7e570012-0000-4000-8000-000000000017', '7e570011-0000-4000-8000-000000000017', '7e570010-0000-4000-8000-000000000003', 'titelbild-17.jpg'),
	('7e570012-0000-4000-8000-000000000018', '7e570011-0000-4000-8000-000000000018', '7e570010-0000-4000-8000-000000000004', 'titelbild-18.jpg'),
	('7e570012-0000-4000-8000-000000000019', '7e570011-0000-4000-8000-000000000019', '7e570010-0000-4000-8000-000000000005', 'titelbild-19.jpg'),
	('7e570012-0000-4000-8000-000000000020', '7e570011-0000-4000-8000-000000000020', '7e570010-0000-4000-8000-000000000006', 'titelbild-20.jpg'),
	('7e570012-0000-4000-8000-000000000021', '7e570011-0000-4000-8000-000000000021', '7e570010-0000-4000-8000-000000000001', 'titelbild-21.jpg'),
	('7e570012-0000-4000-8000-000000000022', '7e570011-0000-4000-8000-000000000022', '7e570010-0000-4000-8000-000000000008', 'titelbild-22.jpg'),
	('7e570012-0000-4000-8000-000000000023', '7e570011-0000-4000-8000-000000000023', '7e570010-0000-4000-8000-000000000002', 'titelbild-23.jpg'),
	('7e570012-0000-4000-8000-000000000024', '7e570011-0000-4000-8000-000000000024', '7e570010-0000-4000-8000-000000000003', 'titelbild-24.jpg'),
	('7e570012-0000-4000-8000-000000000025', '7e570011-0000-4000-8000-000000000025', '7e570010-0000-4000-8000-000000000004', 'titelbild-25.jpg'),
	('7e570012-0000-4000-8000-000000000026', '7e570011-0000-4000-8000-000000000026', '7e570010-0000-4000-8000-000000000005', 'titelbild-26.jpg'),
	('7e570012-0000-4000-8000-000000000027', '7e570011-0000-4000-8000-000000000027', '7e570010-0000-4000-8000-000000000006', 'titelbild-27.jpg'),
	('7e570012-0000-4000-8000-000000000028', '7e570011-0000-4000-8000-000000000028', '7e570010-0000-4000-8000-000000000007', 'titelbild-28.jpg'),
	('7e570012-0000-4000-8000-000000000029', '7e570011-0000-4000-8000-000000000029', '7e570010-0000-4000-8000-000000000008', 'titelbild-29.jpg'),
	('7e570012-0000-4000-8000-000000000030', '7e570011-0000-4000-8000-000000000030', '7e570010-0000-4000-8000-000000000002', 'titelbild-30.jpg'),
	('7e570012-0000-4000-8000-000000000031', '7e570011-0000-4000-8000-000000000031', '7e570010-0000-4000-8000-000000000001', 'titelbild-31.jpg'),
	('7e570012-0000-4000-8000-000000000032', '7e570011-0000-4000-8000-000000000032', '7e570010-0000-4000-8000-000000000004', 'titelbild-32.jpg'),
	('7e570012-0000-4000-8000-000000000033', '7e570011-0000-4000-8000-000000000033', '7e570010-0000-4000-8000-000000000005', 'titelbild-33.jpg'),
	('7e570012-0000-4000-8000-000000000034', '7e570011-0000-4000-8000-000000000034', '7e570010-0000-4000-8000-000000000006', 'titelbild-34.jpg'),
	('7e570012-0000-4000-8000-000000000035', '7e570011-0000-4000-8000-000000000035', '7e570010-0000-4000-8000-000000000007', 'titelbild-35.jpg'),
	('7e570012-0000-4000-8000-000000000036', '7e570011-0000-4000-8000-000000000036', '7e570010-0000-4000-8000-000000000008', 'titelbild-36.jpg'),
	('7e570012-0000-4000-8000-000000000037', '7e570011-0000-4000-8000-000000000037', '7e570010-0000-4000-8000-000000000002', 'titelbild-37.jpg'),
	('7e570012-0000-4000-8000-000000000038', '7e570011-0000-4000-8000-000000000038', '7e570010-0000-4000-8000-000000000003', 'titelbild-38.jpg'),
	('7e570012-0000-4000-8000-000000000039', '7e570011-0000-4000-8000-000000000039', '7e570010-0000-4000-8000-000000000004', 'titelbild-39.jpg'),
	('7e570012-0000-4000-8000-000000000040', '7e570011-0000-4000-8000-000000000040', '7e570010-0000-4000-8000-000000000005', 'titelbild-40.jpg'),
	('7e570012-0000-4000-8000-000000000041', '7e570011-0000-4000-8000-000000000041', '7e570010-0000-4000-8000-000000000001', 'titelbild-41.jpg'),
	('7e570012-0000-4000-8000-000000000042', '7e570011-0000-4000-8000-000000000042', '7e570010-0000-4000-8000-000000000007', 'titelbild-42.jpg'),
	('7e570012-0000-4000-8000-000000000043', '7e570011-0000-4000-8000-000000000043', '7e570010-0000-4000-8000-000000000008', 'titelbild-43.jpg'),
	('7e570012-0000-4000-8000-000000000044', '7e570011-0000-4000-8000-000000000044', '7e570010-0000-4000-8000-000000000002', 'titelbild-44.jpg'),
	('7e570012-0000-4000-8000-000000000045', '7e570011-0000-4000-8000-000000000045', '7e570010-0000-4000-8000-000000000003', 'titelbild-45.jpg'),
	('7e570012-0000-4000-8000-000000000046', '7e570011-0000-4000-8000-000000000046', '7e570010-0000-4000-8000-000000000004', 'titelbild-46.jpg'),
	('7e570012-0000-4000-8000-000000000047', '7e570011-0000-4000-8000-000000000047', '7e570010-0000-4000-8000-000000000005', 'titelbild-47.jpg'),
	('7e570012-0000-4000-8000-000000000048', '7e570011-0000-4000-8000-000000000048', '7e570010-0000-4000-8000-000000000006', 'titelbild-48.jpg'),
	('7e570012-0000-4000-8000-000000000051', '7e570011-0000-4000-8000-000000000051', '7e570010-0000-4000-8000-000000000002', 'titelbild-51.jpg'),
	('7e570012-0000-4000-8000-000000000052', '7e570011-0000-4000-8000-000000000052', '7e570010-0000-4000-8000-000000000003', 'titelbild-52.jpg'),
	('7e570012-0000-4000-8000-000000000053', '7e570011-0000-4000-8000-000000000053', '7e570010-0000-4000-8000-000000000004', 'titelbild-53.jpg'),
	('7e570012-0000-4000-8000-000000000054', '7e570011-0000-4000-8000-000000000054', '7e570010-0000-4000-8000-000000000005', 'titelbild-54.jpg'),
	('7e570012-0000-4000-8000-000000000061', '7e570011-0000-4000-8000-000000000061', '7e570010-0000-4000-8000-000000000003', 'titelbild-61.jpg'),
	('7e570012-0000-4000-8000-000000000062', '7e570011-0000-4000-8000-000000000062', '7e570010-0000-4000-8000-000000000004', 'titelbild-62.jpg'),
	('7e570012-0000-4000-8000-000000000063', '7e570011-0000-4000-8000-000000000063', '7e570010-0000-4000-8000-000000000005', 'titelbild-63.jpg'),
	('7e570012-0000-4000-8000-000000000064', '7e570011-0000-4000-8000-000000000064', '7e570010-0000-4000-8000-000000000006', 'titelbild-64.jpg'),
	('7e570012-0000-4000-8000-000000000065', '7e570011-0000-4000-8000-000000000065', '7e570010-0000-4000-8000-000000000007', 'titelbild-65.jpg')
) as v(id, project_id, uploaded_by, file_name);

-- Profilbilder: project_id null heisst Avatar (§3.15).
insert into stored_file (id, project_id, uploaded_by, file_name, mime_type, size, path, created_at)
select v.id::uuid, null, v.uploaded_by::uuid, v.file_name,
       'image/jpeg', 0, 'avatars/' || v.id, now() - interval '300 days'
from (values
	('7e570012-0000-4000-8000-000000000901', '7e570010-0000-4000-8000-000000000001', 'merle-ahlers.jpg'),
	('7e570012-0000-4000-8000-000000000902', '7e570010-0000-4000-8000-000000000002', 'jannis-bohnhoff.jpg'),
	('7e570012-0000-4000-8000-000000000903', '7e570010-0000-4000-8000-000000000003', 'ayse-coskun.jpg'),
	('7e570012-0000-4000-8000-000000000904', '7e570010-0000-4000-8000-000000000004', 'fenja-dallmann.jpg'),
	('7e570012-0000-4000-8000-000000000905', '7e570010-0000-4000-8000-000000000005', 'kilian-ehlert.jpg'),
	('7e570012-0000-4000-8000-000000000906', '7e570010-0000-4000-8000-000000000006', 'noura-fahim.jpg'),
	('7e570012-0000-4000-8000-000000000907', '7e570010-0000-4000-8000-000000000007', 'bastian-grothe.jpg'),
	('7e570012-0000-4000-8000-000000000908', '7e570010-0000-4000-8000-000000000008', 'levke-hinrichs.jpg')
) as v(id, uploaded_by, file_name);

update portfolio p
set avatar_url = '/api/files/' || f.id
from stored_file f
where f.project_id is null
  and f.id::text like '7e570012-%'
  and f.uploaded_by = p.user_id;

-- -------------------------------------------------------------------
-- 6) Statusverlauf. Ohne ihn zeigt die Detailseite eine leere Historie.
-- -------------------------------------------------------------------
insert into project_status_history (id, project_id, from_status, to_status, changed_by, timestamp)
select v.id::uuid, v.project_id::uuid, v.from_status, v.to_status, v.changed_by::uuid,
       now() - (v.tage || ' days')::interval
from (values
	('7e570018-0000-4000-8000-000000000010', '7e570011-0000-4000-8000-000000000001', 'DRAFT', 'SUBMITTED', 61, '7e570010-0000-4000-8000-000000000001'),
	('7e570018-0000-4000-8000-000000000011', '7e570011-0000-4000-8000-000000000001', 'SUBMITTED', 'APPROVED', 58, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000012', '7e570011-0000-4000-8000-000000000001', 'APPROVED', 'PUBLISHED', 55, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000020', '7e570011-0000-4000-8000-000000000002', 'DRAFT', 'SUBMITTED', 62, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000021', '7e570011-0000-4000-8000-000000000002', 'SUBMITTED', 'APPROVED', 59, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000022', '7e570011-0000-4000-8000-000000000002', 'APPROVED', 'PUBLISHED', 56, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000030', '7e570011-0000-4000-8000-000000000003', 'DRAFT', 'SUBMITTED', 63, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000031', '7e570011-0000-4000-8000-000000000003', 'SUBMITTED', 'APPROVED', 60, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000032', '7e570011-0000-4000-8000-000000000003', 'APPROVED', 'PUBLISHED', 57, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000040', '7e570011-0000-4000-8000-000000000004', 'DRAFT', 'SUBMITTED', 64, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000041', '7e570011-0000-4000-8000-000000000004', 'SUBMITTED', 'APPROVED', 61, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000042', '7e570011-0000-4000-8000-000000000004', 'APPROVED', 'PUBLISHED', 58, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000050', '7e570011-0000-4000-8000-000000000005', 'DRAFT', 'SUBMITTED', 65, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000051', '7e570011-0000-4000-8000-000000000005', 'SUBMITTED', 'APPROVED', 62, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000052', '7e570011-0000-4000-8000-000000000005', 'APPROVED', 'PUBLISHED', 59, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000060', '7e570011-0000-4000-8000-000000000006', 'DRAFT', 'SUBMITTED', 66, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000061', '7e570011-0000-4000-8000-000000000006', 'SUBMITTED', 'APPROVED', 63, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000062', '7e570011-0000-4000-8000-000000000006', 'APPROVED', 'PUBLISHED', 60, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000070', '7e570011-0000-4000-8000-000000000007', 'DRAFT', 'SUBMITTED', 67, '7e570010-0000-4000-8000-000000000001'),
	('7e570018-0000-4000-8000-000000000071', '7e570011-0000-4000-8000-000000000007', 'SUBMITTED', 'APPROVED', 64, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000072', '7e570011-0000-4000-8000-000000000007', 'APPROVED', 'PUBLISHED', 61, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000080', '7e570011-0000-4000-8000-000000000008', 'DRAFT', 'SUBMITTED', 68, '7e570010-0000-4000-8000-000000000008'),
	('7e570018-0000-4000-8000-000000000081', '7e570011-0000-4000-8000-000000000008', 'SUBMITTED', 'APPROVED', 65, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000082', '7e570011-0000-4000-8000-000000000008', 'APPROVED', 'PUBLISHED', 62, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000090', '7e570011-0000-4000-8000-000000000009', 'DRAFT', 'SUBMITTED', 69, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000091', '7e570011-0000-4000-8000-000000000009', 'SUBMITTED', 'APPROVED', 66, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000092', '7e570011-0000-4000-8000-000000000009', 'APPROVED', 'PUBLISHED', 63, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000100', '7e570011-0000-4000-8000-000000000010', 'DRAFT', 'SUBMITTED', 70, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000101', '7e570011-0000-4000-8000-000000000010', 'SUBMITTED', 'APPROVED', 67, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000102', '7e570011-0000-4000-8000-000000000010', 'APPROVED', 'PUBLISHED', 64, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000110', '7e570011-0000-4000-8000-000000000011', 'DRAFT', 'SUBMITTED', 71, '7e570010-0000-4000-8000-000000000001'),
	('7e570018-0000-4000-8000-000000000111', '7e570011-0000-4000-8000-000000000011', 'SUBMITTED', 'APPROVED', 68, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000112', '7e570011-0000-4000-8000-000000000011', 'APPROVED', 'PUBLISHED', 65, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000120', '7e570011-0000-4000-8000-000000000012', 'DRAFT', 'SUBMITTED', 72, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000121', '7e570011-0000-4000-8000-000000000012', 'SUBMITTED', 'APPROVED', 69, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000122', '7e570011-0000-4000-8000-000000000012', 'APPROVED', 'PUBLISHED', 66, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000130', '7e570011-0000-4000-8000-000000000013', 'DRAFT', 'SUBMITTED', 73, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000131', '7e570011-0000-4000-8000-000000000013', 'SUBMITTED', 'APPROVED', 70, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000132', '7e570011-0000-4000-8000-000000000013', 'APPROVED', 'PUBLISHED', 67, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000140', '7e570011-0000-4000-8000-000000000014', 'DRAFT', 'SUBMITTED', 74, '7e570010-0000-4000-8000-000000000007'),
	('7e570018-0000-4000-8000-000000000141', '7e570011-0000-4000-8000-000000000014', 'SUBMITTED', 'APPROVED', 71, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000142', '7e570011-0000-4000-8000-000000000014', 'APPROVED', 'PUBLISHED', 68, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000150', '7e570011-0000-4000-8000-000000000015', 'DRAFT', 'SUBMITTED', 75, '7e570010-0000-4000-8000-000000000008'),
	('7e570018-0000-4000-8000-000000000151', '7e570011-0000-4000-8000-000000000015', 'SUBMITTED', 'APPROVED', 72, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000152', '7e570011-0000-4000-8000-000000000015', 'APPROVED', 'PUBLISHED', 69, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000160', '7e570011-0000-4000-8000-000000000016', 'DRAFT', 'SUBMITTED', 76, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000161', '7e570011-0000-4000-8000-000000000016', 'SUBMITTED', 'APPROVED', 73, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000162', '7e570011-0000-4000-8000-000000000016', 'APPROVED', 'PUBLISHED', 70, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000170', '7e570011-0000-4000-8000-000000000017', 'DRAFT', 'SUBMITTED', 77, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000171', '7e570011-0000-4000-8000-000000000017', 'SUBMITTED', 'APPROVED', 74, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000172', '7e570011-0000-4000-8000-000000000017', 'APPROVED', 'PUBLISHED', 71, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000180', '7e570011-0000-4000-8000-000000000018', 'DRAFT', 'SUBMITTED', 78, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000181', '7e570011-0000-4000-8000-000000000018', 'SUBMITTED', 'APPROVED', 75, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000182', '7e570011-0000-4000-8000-000000000018', 'APPROVED', 'PUBLISHED', 72, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000190', '7e570011-0000-4000-8000-000000000019', 'DRAFT', 'SUBMITTED', 79, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000191', '7e570011-0000-4000-8000-000000000019', 'SUBMITTED', 'APPROVED', 76, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000192', '7e570011-0000-4000-8000-000000000019', 'APPROVED', 'PUBLISHED', 73, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000200', '7e570011-0000-4000-8000-000000000020', 'DRAFT', 'SUBMITTED', 80, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000201', '7e570011-0000-4000-8000-000000000020', 'SUBMITTED', 'APPROVED', 77, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000202', '7e570011-0000-4000-8000-000000000020', 'APPROVED', 'PUBLISHED', 74, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000210', '7e570011-0000-4000-8000-000000000021', 'DRAFT', 'SUBMITTED', 81, '7e570010-0000-4000-8000-000000000001'),
	('7e570018-0000-4000-8000-000000000211', '7e570011-0000-4000-8000-000000000021', 'SUBMITTED', 'APPROVED', 78, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000212', '7e570011-0000-4000-8000-000000000021', 'APPROVED', 'PUBLISHED', 75, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000220', '7e570011-0000-4000-8000-000000000022', 'DRAFT', 'SUBMITTED', 82, '7e570010-0000-4000-8000-000000000008'),
	('7e570018-0000-4000-8000-000000000221', '7e570011-0000-4000-8000-000000000022', 'SUBMITTED', 'APPROVED', 79, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000222', '7e570011-0000-4000-8000-000000000022', 'APPROVED', 'PUBLISHED', 76, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000230', '7e570011-0000-4000-8000-000000000023', 'DRAFT', 'SUBMITTED', 83, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000231', '7e570011-0000-4000-8000-000000000023', 'SUBMITTED', 'APPROVED', 80, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000232', '7e570011-0000-4000-8000-000000000023', 'APPROVED', 'PUBLISHED', 77, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000240', '7e570011-0000-4000-8000-000000000024', 'DRAFT', 'SUBMITTED', 84, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000241', '7e570011-0000-4000-8000-000000000024', 'SUBMITTED', 'APPROVED', 81, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000242', '7e570011-0000-4000-8000-000000000024', 'APPROVED', 'PUBLISHED', 78, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000250', '7e570011-0000-4000-8000-000000000025', 'DRAFT', 'SUBMITTED', 85, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000251', '7e570011-0000-4000-8000-000000000025', 'SUBMITTED', 'APPROVED', 82, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000252', '7e570011-0000-4000-8000-000000000025', 'APPROVED', 'PUBLISHED', 79, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000260', '7e570011-0000-4000-8000-000000000026', 'DRAFT', 'SUBMITTED', 86, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000261', '7e570011-0000-4000-8000-000000000026', 'SUBMITTED', 'APPROVED', 83, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000262', '7e570011-0000-4000-8000-000000000026', 'APPROVED', 'PUBLISHED', 80, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000270', '7e570011-0000-4000-8000-000000000027', 'DRAFT', 'SUBMITTED', 87, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000271', '7e570011-0000-4000-8000-000000000027', 'SUBMITTED', 'APPROVED', 84, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000272', '7e570011-0000-4000-8000-000000000027', 'APPROVED', 'PUBLISHED', 81, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000280', '7e570011-0000-4000-8000-000000000028', 'DRAFT', 'SUBMITTED', 88, '7e570010-0000-4000-8000-000000000007'),
	('7e570018-0000-4000-8000-000000000281', '7e570011-0000-4000-8000-000000000028', 'SUBMITTED', 'APPROVED', 85, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000282', '7e570011-0000-4000-8000-000000000028', 'APPROVED', 'PUBLISHED', 82, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000290', '7e570011-0000-4000-8000-000000000029', 'DRAFT', 'SUBMITTED', 89, '7e570010-0000-4000-8000-000000000008'),
	('7e570018-0000-4000-8000-000000000291', '7e570011-0000-4000-8000-000000000029', 'SUBMITTED', 'APPROVED', 86, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000292', '7e570011-0000-4000-8000-000000000029', 'APPROVED', 'PUBLISHED', 83, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000300', '7e570011-0000-4000-8000-000000000030', 'DRAFT', 'SUBMITTED', 90, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000301', '7e570011-0000-4000-8000-000000000030', 'SUBMITTED', 'APPROVED', 87, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000302', '7e570011-0000-4000-8000-000000000030', 'APPROVED', 'PUBLISHED', 84, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000310', '7e570011-0000-4000-8000-000000000031', 'DRAFT', 'SUBMITTED', 91, '7e570010-0000-4000-8000-000000000001'),
	('7e570018-0000-4000-8000-000000000311', '7e570011-0000-4000-8000-000000000031', 'SUBMITTED', 'APPROVED', 88, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000312', '7e570011-0000-4000-8000-000000000031', 'APPROVED', 'PUBLISHED', 85, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000320', '7e570011-0000-4000-8000-000000000032', 'DRAFT', 'SUBMITTED', 92, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000321', '7e570011-0000-4000-8000-000000000032', 'SUBMITTED', 'APPROVED', 89, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000322', '7e570011-0000-4000-8000-000000000032', 'APPROVED', 'PUBLISHED', 86, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000330', '7e570011-0000-4000-8000-000000000033', 'DRAFT', 'SUBMITTED', 93, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000331', '7e570011-0000-4000-8000-000000000033', 'SUBMITTED', 'APPROVED', 90, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000332', '7e570011-0000-4000-8000-000000000033', 'APPROVED', 'PUBLISHED', 87, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000340', '7e570011-0000-4000-8000-000000000034', 'DRAFT', 'SUBMITTED', 94, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000341', '7e570011-0000-4000-8000-000000000034', 'SUBMITTED', 'APPROVED', 91, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000342', '7e570011-0000-4000-8000-000000000034', 'APPROVED', 'PUBLISHED', 88, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000350', '7e570011-0000-4000-8000-000000000035', 'DRAFT', 'SUBMITTED', 95, '7e570010-0000-4000-8000-000000000007'),
	('7e570018-0000-4000-8000-000000000351', '7e570011-0000-4000-8000-000000000035', 'SUBMITTED', 'APPROVED', 92, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000352', '7e570011-0000-4000-8000-000000000035', 'APPROVED', 'PUBLISHED', 89, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000360', '7e570011-0000-4000-8000-000000000036', 'DRAFT', 'SUBMITTED', 96, '7e570010-0000-4000-8000-000000000008'),
	('7e570018-0000-4000-8000-000000000361', '7e570011-0000-4000-8000-000000000036', 'SUBMITTED', 'APPROVED', 93, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000362', '7e570011-0000-4000-8000-000000000036', 'APPROVED', 'PUBLISHED', 90, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000370', '7e570011-0000-4000-8000-000000000037', 'DRAFT', 'SUBMITTED', 97, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000371', '7e570011-0000-4000-8000-000000000037', 'SUBMITTED', 'APPROVED', 94, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000372', '7e570011-0000-4000-8000-000000000037', 'APPROVED', 'PUBLISHED', 91, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000380', '7e570011-0000-4000-8000-000000000038', 'DRAFT', 'SUBMITTED', 98, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000381', '7e570011-0000-4000-8000-000000000038', 'SUBMITTED', 'APPROVED', 95, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000382', '7e570011-0000-4000-8000-000000000038', 'APPROVED', 'PUBLISHED', 92, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000390', '7e570011-0000-4000-8000-000000000039', 'DRAFT', 'SUBMITTED', 99, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000391', '7e570011-0000-4000-8000-000000000039', 'SUBMITTED', 'APPROVED', 96, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000392', '7e570011-0000-4000-8000-000000000039', 'APPROVED', 'PUBLISHED', 93, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000400', '7e570011-0000-4000-8000-000000000040', 'DRAFT', 'SUBMITTED', 100, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000401', '7e570011-0000-4000-8000-000000000040', 'SUBMITTED', 'APPROVED', 97, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000402', '7e570011-0000-4000-8000-000000000040', 'APPROVED', 'PUBLISHED', 94, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000410', '7e570011-0000-4000-8000-000000000041', 'DRAFT', 'SUBMITTED', 101, '7e570010-0000-4000-8000-000000000001'),
	('7e570018-0000-4000-8000-000000000411', '7e570011-0000-4000-8000-000000000041', 'SUBMITTED', 'APPROVED', 98, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000412', '7e570011-0000-4000-8000-000000000041', 'APPROVED', 'PUBLISHED', 95, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000420', '7e570011-0000-4000-8000-000000000042', 'DRAFT', 'SUBMITTED', 102, '7e570010-0000-4000-8000-000000000007'),
	('7e570018-0000-4000-8000-000000000421', '7e570011-0000-4000-8000-000000000042', 'SUBMITTED', 'APPROVED', 99, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000422', '7e570011-0000-4000-8000-000000000042', 'APPROVED', 'PUBLISHED', 96, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000430', '7e570011-0000-4000-8000-000000000043', 'DRAFT', 'SUBMITTED', 103, '7e570010-0000-4000-8000-000000000008'),
	('7e570018-0000-4000-8000-000000000431', '7e570011-0000-4000-8000-000000000043', 'SUBMITTED', 'APPROVED', 100, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000432', '7e570011-0000-4000-8000-000000000043', 'APPROVED', 'PUBLISHED', 97, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000440', '7e570011-0000-4000-8000-000000000044', 'DRAFT', 'SUBMITTED', 104, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000441', '7e570011-0000-4000-8000-000000000044', 'SUBMITTED', 'APPROVED', 101, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000442', '7e570011-0000-4000-8000-000000000044', 'APPROVED', 'PUBLISHED', 98, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000450', '7e570011-0000-4000-8000-000000000045', 'DRAFT', 'SUBMITTED', 105, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000451', '7e570011-0000-4000-8000-000000000045', 'SUBMITTED', 'APPROVED', 102, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000452', '7e570011-0000-4000-8000-000000000045', 'APPROVED', 'PUBLISHED', 99, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000460', '7e570011-0000-4000-8000-000000000046', 'DRAFT', 'SUBMITTED', 106, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000461', '7e570011-0000-4000-8000-000000000046', 'SUBMITTED', 'APPROVED', 103, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000462', '7e570011-0000-4000-8000-000000000046', 'APPROVED', 'PUBLISHED', 100, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000470', '7e570011-0000-4000-8000-000000000047', 'DRAFT', 'SUBMITTED', 107, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000471', '7e570011-0000-4000-8000-000000000047', 'SUBMITTED', 'APPROVED', 104, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000472', '7e570011-0000-4000-8000-000000000047', 'APPROVED', 'PUBLISHED', 101, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000480', '7e570011-0000-4000-8000-000000000048', 'DRAFT', 'SUBMITTED', 108, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000481', '7e570011-0000-4000-8000-000000000048', 'SUBMITTED', 'APPROVED', 105, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000482', '7e570011-0000-4000-8000-000000000048', 'APPROVED', 'PUBLISHED', 102, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000510', '7e570011-0000-4000-8000-000000000051', 'DRAFT', 'SUBMITTED', 111, '7e570010-0000-4000-8000-000000000002'),
	('7e570018-0000-4000-8000-000000000520', '7e570011-0000-4000-8000-000000000052', 'DRAFT', 'SUBMITTED', 112, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000530', '7e570011-0000-4000-8000-000000000053', 'DRAFT', 'SUBMITTED', 113, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000540', '7e570011-0000-4000-8000-000000000054', 'DRAFT', 'SUBMITTED', 114, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000610', '7e570011-0000-4000-8000-000000000061', 'DRAFT', 'SUBMITTED', 121, '7e570010-0000-4000-8000-000000000003'),
	('7e570018-0000-4000-8000-000000000611', '7e570011-0000-4000-8000-000000000061', 'SUBMITTED', 'APPROVED', 118, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000620', '7e570011-0000-4000-8000-000000000062', 'DRAFT', 'SUBMITTED', 122, '7e570010-0000-4000-8000-000000000004'),
	('7e570018-0000-4000-8000-000000000621', '7e570011-0000-4000-8000-000000000062', 'SUBMITTED', 'APPROVED', 119, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000630', '7e570011-0000-4000-8000-000000000063', 'DRAFT', 'SUBMITTED', 123, '7e570010-0000-4000-8000-000000000005'),
	('7e570018-0000-4000-8000-000000000631', '7e570011-0000-4000-8000-000000000063', 'SUBMITTED', 'APPROVED', 120, '7e570010-0000-4000-8000-000000000021'),
	('7e570018-0000-4000-8000-000000000640', '7e570011-0000-4000-8000-000000000064', 'DRAFT', 'SUBMITTED', 124, '7e570010-0000-4000-8000-000000000006'),
	('7e570018-0000-4000-8000-000000000641', '7e570011-0000-4000-8000-000000000064', 'SUBMITTED', 'APPROVED', 121, '7e570010-0000-4000-8000-000000000020'),
	('7e570018-0000-4000-8000-000000000650', '7e570011-0000-4000-8000-000000000065', 'DRAFT', 'SUBMITTED', 125, '7e570010-0000-4000-8000-000000000007'),
	('7e570018-0000-4000-8000-000000000651', '7e570011-0000-4000-8000-000000000065', 'SUBMITTED', 'APPROVED', 122, '7e570010-0000-4000-8000-000000000021')
) as v(id, project_id, from_status, to_status, tage, changed_by);

-- -------------------------------------------------------------------
-- 7) Schlagworte (§3.19). Die Tabelle ist ueber lower(name) eindeutig;
--    vorhandene Zeilen werden mitbenutzt statt verdoppelt.
-- -------------------------------------------------------------------
insert into tag (id, name)
select gen_random_uuid(), v.name
from (values
	('aeroakustik'),
	('ag-weser'),
	('alte-neustadt'),
	('altersgerechtes-wohnen'),
	('ambient-assisted-living'),
	('anomalieerkennung'),
	('arbeitskleidung'),
	('audioproduktion'),
	('audiowalk'),
	('aufsuchende-arbeit'),
	('autonomes-fahren'),
	('bachelorarbeit'),
	('barrierefreiheit'),
	('baudokumentation'),
	('bauphysik'),
	('baustoffe'),
	('bauteilpruefung'),
	('bauteilwiederverwendung'),
	('bauzeitenplan'),
	('befragung'),
	('belegungserkennung'),
	('benchmark'),
	('beratung'),
	('bestandsaufnahme'),
	('betriebsdatenerfassung'),
	('betriebsnachfolge'),
	('bibliothek'),
	('bildverarbeitung'),
	('bionik'),
	('bioverfahrenstechnik'),
	('bootsbau'),
	('bremen'),
	('bremen-neustadt'),
	('bremen-nord'),
	('bremer-neustadt'),
	('browser'),
	('campus'),
	('carolo-cup'),
	('cfd'),
	('choice-experiment'),
	('constraint-programmierung'),
	('cubesat'),
	('datenanalyse'),
	('datenschutz'),
	('delamination'),
	('digitalisierung'),
	('din-18040'),
	('e-commerce'),
	('e-paper'),
	('edge-computing'),
	('ehrenamt'),
	('elektroantrieb'),
	('elektromobilitaet'),
	('elektromobilität'),
	('elektronik'),
	('embedded'),
	('energiebudget'),
	('energiemessung'),
	('entsiegelung'),
	('erstsemester'),
	('esp32'),
	('fahrradhandel'),
	('familienunternehmen'),
	('faserverbund'),
	('fehleranalyse'),
	('feinstaub'),
	('fertigungssteuerung'),
	('feststoffmotor'),
	('flugelektronik'),
	('freiraumplanung'),
	('freiwilligenmanagement'),
	('gastronomie'),
	('groepelingen'),
	('gruppenprojekt'),
	('gröpelingen'),
	('gründach'),
	('gründungswettbewerb'),
	('handwerk'),
	('hitzeinseln'),
	('hitzevorsorge'),
	('hochschulgebäude'),
	('huchting'),
	('instandhaltung'),
	('interaktive-medien'),
	('jugendhilfe'),
	('kaeltehilfe'),
	('kalkulation'),
	('kaufabbruch'),
	('kita-erweiterung'),
	('klimaanpassung'),
	('konsumentenverhalten'),
	('kostenrechnung'),
	('kreislaufwirtschaft'),
	('ladeinfrastruktur'),
	('laserscanning'),
	('lehrveranstaltung'),
	('leichtbau'),
	('leitfadeninterviews'),
	('luftqualität'),
	('löten'),
	('marktforschung'),
	('massenermittlung'),
	('mauerwerk'),
	('mehrweg'),
	('messkampagne'),
	('messreihe'),
	('messtechnik'),
	('mietschulden'),
	('mikroalgen'),
	('milchmarkt'),
	('minizinc'),
	('mittelstand'),
	('modalanalyse'),
	('modellfahrzeug'),
	('moos'),
	('mqtt'),
	('nutzungsdaten'),
	('ocpp'),
	('optimierung'),
	('oral-history'),
	('peer-mediation'),
	('pfandsystem'),
	('pflegende-angehörige'),
	('pflegetechnik'),
	('photobioreaktor'),
	('podcast'),
	('praevention'),
	('praxisprojekt'),
	('produktkonfigurator'),
	('projektarbeit'),
	('projektion'),
	('protokollanalyse'),
	('prozessdigitalisierung'),
	('prüfungsplanung'),
	('punktwolke'),
	('qualitative-interviews'),
	('quartiersarbeit'),
	('radar'),
	('radverkehr'),
	('raketentechnik'),
	('rapl'),
	('raumfahrttechnik'),
	('regenwasser'),
	('regionalität'),
	('regionalvermarktung'),
	('reparaturtreff'),
	('retouren'),
	('rotorblatt'),
	('rueckbaukataster'),
	('schiffbau'),
	('schuelerlabor'),
	('schulabsentismus'),
	('schulhof'),
	('schulsozialarbeit'),
	('schwingungsmessung'),
	('schwingungsprüfung'),
	('sensorik'),
	('signalverarbeitung'),
	('solarboot'),
	('sozialberatung'),
	('soziale-arbeit'),
	('sozialraum'),
	('sozialraumanalyse'),
	('sprachcafe'),
	('spracherwerb'),
	('stadtentwässerung'),
	('stadtklima'),
	('stadtteilarbeit'),
	('starkregen'),
	('steuererklärung'),
	('streitschlichtung'),
	('strukturdynamik'),
	('strömungswiderstand'),
	('studentische-initiative'),
	('studienfinanzierung'),
	('studienprojekt'),
	('sturzerkennung'),
	('terminplanung'),
	('terminvergabe'),
	('thermografie'),
	('touchdesigner'),
	('touchtisch'),
	('ueberseestadt'),
	('unternehmensbewertung'),
	('unternehmensnachfolge'),
	('unternehmensuebergabe'),
	('unterwasserrobotik'),
	('urban-mining'),
	('verkehrszählung'),
	('verlustvortrag'),
	('versandhandel'),
	('versorgungsforschung'),
	('walle'),
	('wasserqualitaet'),
	('webassembly'),
	('webgl'),
	('werkstofftechnik'),
	('weser'),
	('wettbewerb'),
	('wiederverwendung'),
	('windkanal'),
	('wissenschaftskommunikation'),
	('wohnberatung'),
	('wohnungslosenhilfe'),
	('workshop'),
	('zahlungsbereitschaft'),
	('zeitreihen'),
	('zerstoerungsfreie-pruefung'),
	('ziegel'),
	('überseestadt')
) as v(name)
where not exists (select 1 from tag t where lower(t.name) = lower(v.name));

insert into project_tag (project_id, tag_id)
select v.project_id::uuid, t.id
from (values
	('7e570011-0000-4000-8000-000000000001', 'mehrweg'),
	('7e570011-0000-4000-8000-000000000001', 'gastronomie'),
	('7e570011-0000-4000-8000-000000000001', 'kostenrechnung'),
	('7e570011-0000-4000-8000-000000000001', 'pfandsystem'),
	('7e570011-0000-4000-8000-000000000001', 'bremen'),
	('7e570011-0000-4000-8000-000000000002', 'radar'),
	('7e570011-0000-4000-8000-000000000002', 'sturzerkennung'),
	('7e570011-0000-4000-8000-000000000002', 'signalverarbeitung'),
	('7e570011-0000-4000-8000-000000000002', 'pflegetechnik'),
	('7e570011-0000-4000-8000-000000000002', 'embedded'),
	('7e570011-0000-4000-8000-000000000003', 'radar'),
	('7e570011-0000-4000-8000-000000000003', 'sturzerkennung'),
	('7e570011-0000-4000-8000-000000000003', 'signalverarbeitung'),
	('7e570011-0000-4000-8000-000000000003', 'ambient-assisted-living'),
	('7e570011-0000-4000-8000-000000000003', 'bachelorarbeit'),
	('7e570011-0000-4000-8000-000000000004', 'ocpp'),
	('7e570011-0000-4000-8000-000000000004', 'ladeinfrastruktur'),
	('7e570011-0000-4000-8000-000000000004', 'anomalieerkennung'),
	('7e570011-0000-4000-8000-000000000004', 'zeitreihen'),
	('7e570011-0000-4000-8000-000000000004', 'elektromobilität'),
	('7e570011-0000-4000-8000-000000000005', 'ladeinfrastruktur'),
	('7e570011-0000-4000-8000-000000000005', 'ocpp'),
	('7e570011-0000-4000-8000-000000000005', 'anomalieerkennung'),
	('7e570011-0000-4000-8000-000000000005', 'zeitreihen'),
	('7e570011-0000-4000-8000-000000000005', 'bachelorarbeit'),
	('7e570011-0000-4000-8000-000000000006', 'radverkehr'),
	('7e570011-0000-4000-8000-000000000006', 'bildverarbeitung'),
	('7e570011-0000-4000-8000-000000000006', 'edge-computing'),
	('7e570011-0000-4000-8000-000000000006', 'verkehrszählung'),
	('7e570011-0000-4000-8000-000000000006', 'datenschutz'),
	('7e570011-0000-4000-8000-000000000007', 'baustoffe'),
	('7e570011-0000-4000-8000-000000000007', 'wiederverwendung'),
	('7e570011-0000-4000-8000-000000000007', 'kreislaufwirtschaft'),
	('7e570011-0000-4000-8000-000000000007', 'studentische-initiative'),
	('7e570011-0000-4000-8000-000000000008', 'wohnberatung'),
	('7e570011-0000-4000-8000-000000000008', 'quartiersarbeit'),
	('7e570011-0000-4000-8000-000000000008', 'altersgerechtes-wohnen'),
	('7e570011-0000-4000-8000-000000000008', 'soziale-arbeit'),
	('7e570011-0000-4000-8000-000000000009', 'betriebsdatenerfassung'),
	('7e570011-0000-4000-8000-000000000009', 'schiffbau'),
	('7e570011-0000-4000-8000-000000000009', 'prozessdigitalisierung'),
	('7e570011-0000-4000-8000-000000000009', 'fertigungssteuerung'),
	('7e570011-0000-4000-8000-000000000010', 'bionik'),
	('7e570011-0000-4000-8000-000000000010', 'aeroakustik'),
	('7e570011-0000-4000-8000-000000000010', 'windkanal'),
	('7e570011-0000-4000-8000-000000000010', 'rotorblatt'),
	('7e570011-0000-4000-8000-000000000010', 'messreihe'),
	('7e570011-0000-4000-8000-000000000011', 'e-commerce'),
	('7e570011-0000-4000-8000-000000000011', 'produktkonfigurator'),
	('7e570011-0000-4000-8000-000000000011', 'kaufabbruch'),
	('7e570011-0000-4000-8000-000000000011', 'fahrradhandel'),
	('7e570011-0000-4000-8000-000000000011', 'nutzungsdaten'),
	('7e570011-0000-4000-8000-000000000012', 'kreislaufwirtschaft'),
	('7e570011-0000-4000-8000-000000000012', 'rueckbaukataster'),
	('7e570011-0000-4000-8000-000000000012', 'bauteilwiederverwendung'),
	('7e570011-0000-4000-8000-000000000012', 'bestandsaufnahme'),
	('7e570011-0000-4000-8000-000000000012', 'bremen'),
	('7e570011-0000-4000-8000-000000000013', 'soziale-arbeit'),
	('7e570011-0000-4000-8000-000000000013', 'mietschulden'),
	('7e570011-0000-4000-8000-000000000013', 'beratung'),
	('7e570011-0000-4000-8000-000000000013', 'quartiersarbeit'),
	('7e570011-0000-4000-8000-000000000013', 'groepelingen'),
	('7e570011-0000-4000-8000-000000000014', 'webassembly'),
	('7e570011-0000-4000-8000-000000000014', 'energiemessung'),
	('7e570011-0000-4000-8000-000000000014', 'browser'),
	('7e570011-0000-4000-8000-000000000014', 'benchmark'),
	('7e570011-0000-4000-8000-000000000014', 'rapl'),
	('7e570011-0000-4000-8000-000000000015', 'raketentechnik'),
	('7e570011-0000-4000-8000-000000000015', 'feststoffmotor'),
	('7e570011-0000-4000-8000-000000000015', 'flugelektronik'),
	('7e570011-0000-4000-8000-000000000015', 'leichtbau'),
	('7e570011-0000-4000-8000-000000000015', 'studentische-initiative'),
	('7e570011-0000-4000-8000-000000000016', 'mehrweg'),
	('7e570011-0000-4000-8000-000000000016', 'kreislaufwirtschaft'),
	('7e570011-0000-4000-8000-000000000016', 'gründungswettbewerb'),
	('7e570011-0000-4000-8000-000000000016', 'kalkulation'),
	('7e570011-0000-4000-8000-000000000016', 'gastronomie'),
	('7e570011-0000-4000-8000-000000000017', 'gründach'),
	('7e570011-0000-4000-8000-000000000017', 'regenwasser'),
	('7e570011-0000-4000-8000-000000000017', 'stadtentwässerung'),
	('7e570011-0000-4000-8000-000000000017', 'überseestadt'),
	('7e570011-0000-4000-8000-000000000017', 'bauphysik'),
	('7e570011-0000-4000-8000-000000000018', 'pflegende-angehörige'),
	('7e570011-0000-4000-8000-000000000018', 'sozialraum'),
	('7e570011-0000-4000-8000-000000000018', 'bremen-nord'),
	('7e570011-0000-4000-8000-000000000018', 'qualitative-interviews'),
	('7e570011-0000-4000-8000-000000000018', 'versorgungsforschung'),
	('7e570011-0000-4000-8000-000000000019', 'interaktive-medien'),
	('7e570011-0000-4000-8000-000000000019', 'projektion'),
	('7e570011-0000-4000-8000-000000000019', 'touchdesigner'),
	('7e570011-0000-4000-8000-000000000019', 'sensorik'),
	('7e570011-0000-4000-8000-000000000019', 'erstsemester'),
	('7e570011-0000-4000-8000-000000000020', 'cubesat'),
	('7e570011-0000-4000-8000-000000000020', 'strukturdynamik'),
	('7e570011-0000-4000-8000-000000000020', 'modalanalyse'),
	('7e570011-0000-4000-8000-000000000020', 'schwingungsprüfung'),
	('7e570011-0000-4000-8000-000000000020', 'raumfahrttechnik'),
	('7e570011-0000-4000-8000-000000000021', 'betriebsnachfolge'),
	('7e570011-0000-4000-8000-000000000021', 'handwerk'),
	('7e570011-0000-4000-8000-000000000021', 'unternehmensuebergabe'),
	('7e570011-0000-4000-8000-000000000021', 'familienunternehmen'),
	('7e570011-0000-4000-8000-000000000022', 'regenwasser'),
	('7e570011-0000-4000-8000-000000000022', 'entsiegelung'),
	('7e570011-0000-4000-8000-000000000022', 'stadtklima'),
	('7e570011-0000-4000-8000-000000000022', 'bremen-neustadt'),
	('7e570011-0000-4000-8000-000000000022', 'starkregen'),
	('7e570011-0000-4000-8000-000000000023', 'sprachcafe'),
	('7e570011-0000-4000-8000-000000000023', 'ehrenamt'),
	('7e570011-0000-4000-8000-000000000023', 'stadtteilarbeit'),
	('7e570011-0000-4000-8000-000000000023', 'groepelingen'),
	('7e570011-0000-4000-8000-000000000023', 'spracherwerb'),
	('7e570011-0000-4000-8000-000000000024', 'autonomes-fahren'),
	('7e570011-0000-4000-8000-000000000024', 'bildverarbeitung'),
	('7e570011-0000-4000-8000-000000000024', 'carolo-cup'),
	('7e570011-0000-4000-8000-000000000024', 'modellfahrzeug'),
	('7e570011-0000-4000-8000-000000000024', 'embedded'),
	('7e570011-0000-4000-8000-000000000025', 'zerstoerungsfreie-pruefung'),
	('7e570011-0000-4000-8000-000000000025', 'thermografie'),
	('7e570011-0000-4000-8000-000000000025', 'faserverbund'),
	('7e570011-0000-4000-8000-000000000025', 'delamination'),
	('7e570011-0000-4000-8000-000000000025', 'werkstofftechnik'),
	('7e570011-0000-4000-8000-000000000026', 'mehrweg'),
	('7e570011-0000-4000-8000-000000000026', 'zahlungsbereitschaft'),
	('7e570011-0000-4000-8000-000000000026', 'gastronomie'),
	('7e570011-0000-4000-8000-000000000026', 'choice-experiment'),
	('7e570011-0000-4000-8000-000000000026', 'kreislaufwirtschaft'),
	('7e570011-0000-4000-8000-000000000027', 'laserscanning'),
	('7e570011-0000-4000-8000-000000000027', 'punktwolke'),
	('7e570011-0000-4000-8000-000000000027', 'ueberseestadt'),
	('7e570011-0000-4000-8000-000000000027', 'baudokumentation'),
	('7e570011-0000-4000-8000-000000000027', 'webgl'),
	('7e570011-0000-4000-8000-000000000028', 'sozialraumanalyse'),
	('7e570011-0000-4000-8000-000000000028', 'aufsuchende-arbeit'),
	('7e570011-0000-4000-8000-000000000028', 'gröpelingen'),
	('7e570011-0000-4000-8000-000000000028', 'qualitative-interviews'),
	('7e570011-0000-4000-8000-000000000028', 'soziale-arbeit'),
	('7e570011-0000-4000-8000-000000000029', 'schwingungsmessung'),
	('7e570011-0000-4000-8000-000000000029', 'instandhaltung'),
	('7e570011-0000-4000-8000-000000000029', 'messtechnik'),
	('7e570011-0000-4000-8000-000000000029', 'praxisprojekt'),
	('7e570011-0000-4000-8000-000000000030', 'feinstaub'),
	('7e570011-0000-4000-8000-000000000030', 'moos'),
	('7e570011-0000-4000-8000-000000000030', 'luftqualität'),
	('7e570011-0000-4000-8000-000000000030', 'messtechnik'),
	('7e570011-0000-4000-8000-000000000030', 'stadtklima'),
	('7e570011-0000-4000-8000-000000000031', 'steuererklärung'),
	('7e570011-0000-4000-8000-000000000031', 'verlustvortrag'),
	('7e570011-0000-4000-8000-000000000031', 'studienfinanzierung'),
	('7e570011-0000-4000-8000-000000000031', 'workshop'),
	('7e570011-0000-4000-8000-000000000032', 'hitzevorsorge'),
	('7e570011-0000-4000-8000-000000000032', 'stadtklima'),
	('7e570011-0000-4000-8000-000000000032', 'bremer-neustadt'),
	('7e570011-0000-4000-8000-000000000032', 'freiraumplanung'),
	('7e570011-0000-4000-8000-000000000032', 'klimaanpassung'),
	('7e570011-0000-4000-8000-000000000033', 'ehrenamt'),
	('7e570011-0000-4000-8000-000000000033', 'wohnungslosenhilfe'),
	('7e570011-0000-4000-8000-000000000033', 'freiwilligenmanagement'),
	('7e570011-0000-4000-8000-000000000033', 'kaeltehilfe'),
	('7e570011-0000-4000-8000-000000000034', 'ocpp'),
	('7e570011-0000-4000-8000-000000000034', 'ladeinfrastruktur'),
	('7e570011-0000-4000-8000-000000000034', 'elektromobilitaet'),
	('7e570011-0000-4000-8000-000000000034', 'protokollanalyse'),
	('7e570011-0000-4000-8000-000000000034', 'fehleranalyse'),
	('7e570011-0000-4000-8000-000000000035', 'wasserqualitaet'),
	('7e570011-0000-4000-8000-000000000035', 'weser'),
	('7e570011-0000-4000-8000-000000000035', 'schuelerlabor'),
	('7e570011-0000-4000-8000-000000000035', 'touchtisch'),
	('7e570011-0000-4000-8000-000000000035', 'wissenschaftskommunikation'),
	('7e570011-0000-4000-8000-000000000036', 'unternehmensnachfolge'),
	('7e570011-0000-4000-8000-000000000036', 'handwerk'),
	('7e570011-0000-4000-8000-000000000036', 'unternehmensbewertung'),
	('7e570011-0000-4000-8000-000000000036', 'mittelstand'),
	('7e570011-0000-4000-8000-000000000036', 'bremen'),
	('7e570011-0000-4000-8000-000000000037', 'regenwasser'),
	('7e570011-0000-4000-8000-000000000037', 'entsiegelung'),
	('7e570011-0000-4000-8000-000000000037', 'schulhof'),
	('7e570011-0000-4000-8000-000000000037', 'freiraumplanung'),
	('7e570011-0000-4000-8000-000000000037', 'walle'),
	('7e570011-0000-4000-8000-000000000038', 'schulabsentismus'),
	('7e570011-0000-4000-8000-000000000038', 'schulsozialarbeit'),
	('7e570011-0000-4000-8000-000000000038', 'jugendhilfe'),
	('7e570011-0000-4000-8000-000000000038', 'leitfadeninterviews'),
	('7e570011-0000-4000-8000-000000000038', 'bremen'),
	('7e570011-0000-4000-8000-000000000039', 'e-paper'),
	('7e570011-0000-4000-8000-000000000039', 'esp32'),
	('7e570011-0000-4000-8000-000000000039', 'energiebudget'),
	('7e570011-0000-4000-8000-000000000039', 'campus'),
	('7e570011-0000-4000-8000-000000000039', 'studentische-initiative'),
	('7e570011-0000-4000-8000-000000000040', 'bionik'),
	('7e570011-0000-4000-8000-000000000040', 'unterwasserrobotik'),
	('7e570011-0000-4000-8000-000000000040', 'strömungswiderstand'),
	('7e570011-0000-4000-8000-000000000040', 'cfd'),
	('7e570011-0000-4000-8000-000000000040', 'wettbewerb'),
	('7e570011-0000-4000-8000-000000000041', 'marktforschung'),
	('7e570011-0000-4000-8000-000000000041', 'zahlungsbereitschaft'),
	('7e570011-0000-4000-8000-000000000041', 'regionalität'),
	('7e570011-0000-4000-8000-000000000041', 'befragung'),
	('7e570011-0000-4000-8000-000000000041', 'studienprojekt'),
	('7e570011-0000-4000-8000-000000000042', 'barrierefreiheit'),
	('7e570011-0000-4000-8000-000000000042', 'bestandsaufnahme'),
	('7e570011-0000-4000-8000-000000000042', 'din-18040'),
	('7e570011-0000-4000-8000-000000000042', 'hochschulgebäude'),
	('7e570011-0000-4000-8000-000000000042', 'studienprojekt'),
	('7e570011-0000-4000-8000-000000000043', 'sozialberatung'),
	('7e570011-0000-4000-8000-000000000043', 'terminvergabe'),
	('7e570011-0000-4000-8000-000000000043', 'qualitative-interviews'),
	('7e570011-0000-4000-8000-000000000043', 'huchting'),
	('7e570011-0000-4000-8000-000000000043', 'digitalisierung'),
	('7e570011-0000-4000-8000-000000000044', 'prüfungsplanung'),
	('7e570011-0000-4000-8000-000000000044', 'constraint-programmierung'),
	('7e570011-0000-4000-8000-000000000044', 'optimierung'),
	('7e570011-0000-4000-8000-000000000044', 'minizinc'),
	('7e570011-0000-4000-8000-000000000044', 'studienprojekt'),
	('7e570011-0000-4000-8000-000000000045', 'bioverfahrenstechnik'),
	('7e570011-0000-4000-8000-000000000045', 'mikroalgen'),
	('7e570011-0000-4000-8000-000000000045', 'photobioreaktor'),
	('7e570011-0000-4000-8000-000000000045', 'messreihe'),
	('7e570011-0000-4000-8000-000000000045', 'gruppenprojekt'),
	('7e570011-0000-4000-8000-000000000046', 'retouren'),
	('7e570011-0000-4000-8000-000000000046', 'versandhandel'),
	('7e570011-0000-4000-8000-000000000046', 'datenanalyse'),
	('7e570011-0000-4000-8000-000000000046', 'projektarbeit'),
	('7e570011-0000-4000-8000-000000000046', 'arbeitskleidung'),
	('7e570011-0000-4000-8000-000000000047', 'stadtklima'),
	('7e570011-0000-4000-8000-000000000047', 'hitzeinseln'),
	('7e570011-0000-4000-8000-000000000047', 'messkampagne'),
	('7e570011-0000-4000-8000-000000000047', 'alte-neustadt'),
	('7e570011-0000-4000-8000-000000000047', 'klimaanpassung'),
	('7e570011-0000-4000-8000-000000000048', 'streitschlichtung'),
	('7e570011-0000-4000-8000-000000000048', 'peer-mediation'),
	('7e570011-0000-4000-8000-000000000048', 'schulsozialarbeit'),
	('7e570011-0000-4000-8000-000000000048', 'praevention'),
	('7e570011-0000-4000-8000-000000000048', 'groepelingen'),
	('7e570011-0000-4000-8000-000000000051', 'zahlungsbereitschaft'),
	('7e570011-0000-4000-8000-000000000051', 'regionalvermarktung'),
	('7e570011-0000-4000-8000-000000000051', 'konsumentenverhalten'),
	('7e570011-0000-4000-8000-000000000051', 'milchmarkt'),
	('7e570011-0000-4000-8000-000000000051', 'bremen'),
	('7e570011-0000-4000-8000-000000000052', 'ziegel'),
	('7e570011-0000-4000-8000-000000000052', 'wiederverwendung'),
	('7e570011-0000-4000-8000-000000000052', 'mauerwerk'),
	('7e570011-0000-4000-8000-000000000052', 'urban-mining'),
	('7e570011-0000-4000-8000-000000000052', 'bauteilpruefung'),
	('7e570011-0000-4000-8000-000000000053', 'audiowalk'),
	('7e570011-0000-4000-8000-000000000053', 'oral-history'),
	('7e570011-0000-4000-8000-000000000053', 'groepelingen'),
	('7e570011-0000-4000-8000-000000000053', 'ag-weser'),
	('7e570011-0000-4000-8000-000000000053', 'stadtteilarbeit'),
	('7e570011-0000-4000-8000-000000000054', 'belegungserkennung'),
	('7e570011-0000-4000-8000-000000000054', 'esp32'),
	('7e570011-0000-4000-8000-000000000054', 'mqtt'),
	('7e570011-0000-4000-8000-000000000054', 'bibliothek'),
	('7e570011-0000-4000-8000-000000000054', 'datenschutz'),
	('7e570011-0000-4000-8000-000000000061', 'kostenrechnung'),
	('7e570011-0000-4000-8000-000000000061', 'kalkulation'),
	('7e570011-0000-4000-8000-000000000061', 'ehrenamt'),
	('7e570011-0000-4000-8000-000000000061', 'lehrveranstaltung'),
	('7e570011-0000-4000-8000-000000000062', 'bauzeitenplan'),
	('7e570011-0000-4000-8000-000000000062', 'praxisprojekt'),
	('7e570011-0000-4000-8000-000000000062', 'kita-erweiterung'),
	('7e570011-0000-4000-8000-000000000062', 'terminplanung'),
	('7e570011-0000-4000-8000-000000000062', 'massenermittlung'),
	('7e570011-0000-4000-8000-000000000063', 'podcast'),
	('7e570011-0000-4000-8000-000000000063', 'ehrenamt'),
	('7e570011-0000-4000-8000-000000000063', 'bremen-nord'),
	('7e570011-0000-4000-8000-000000000063', 'audioproduktion'),
	('7e570011-0000-4000-8000-000000000064', 'reparaturtreff'),
	('7e570011-0000-4000-8000-000000000064', 'elektronik'),
	('7e570011-0000-4000-8000-000000000064', 'löten'),
	('7e570011-0000-4000-8000-000000000064', 'kreislaufwirtschaft'),
	('7e570011-0000-4000-8000-000000000065', 'solarboot'),
	('7e570011-0000-4000-8000-000000000065', 'wettbewerb'),
	('7e570011-0000-4000-8000-000000000065', 'bootsbau'),
	('7e570011-0000-4000-8000-000000000065', 'elektroantrieb')
) as v(project_id, name)
join tag t on lower(t.name) = lower(v.name)
on conflict do nothing;

-- -------------------------------------------------------------------
-- 8) Aufgabe D4: je drei Projekte an die zwei gleichbedeutenden
--    Kategorien. Sie stehen hier und nicht oben, weil die Kategorie
--    dort ueber den Namen gesucht wird und diese beiden erst in
--    Schritt 2 entstanden sind.
-- -------------------------------------------------------------------
update project set category_id = '7e570015-0000-4000-8000-000000000001'::uuid
where id in ('7e570011-0000-4000-8000-000000000041'::uuid,
             '7e570011-0000-4000-8000-000000000042'::uuid,
             '7e570011-0000-4000-8000-000000000043'::uuid);
update project set category_id = '7e570015-0000-4000-8000-000000000002'::uuid
where id in ('7e570011-0000-4000-8000-000000000044'::uuid,
             '7e570011-0000-4000-8000-000000000045'::uuid,
             '7e570011-0000-4000-8000-000000000046'::uuid);

-- -------------------------------------------------------------------
-- 9) Aufgabe D6: vierzehn offene Nominierungen und KEINE gesetzte
--    Top 10. Geleert wird die ganze Tabelle: die Aufgabe verlangt einen
--    leeren Stand, und ein Rest aus den Demodaten waere einer.
-- -------------------------------------------------------------------
delete from top10_entry;

insert into top10_nomination (id, project_id, nominated_by, proposed_position,
                              proposed_tier, status, decided_by, decided_at, created_at)
select v.id::uuid, v.project_id::uuid, v.nominated_by::uuid, null,
       v.tier, 'PENDING', null, null,
       now() - (v.tage || ' days')::interval
from (values
	('7e570017-0000-4000-8000-000000000001', '7e570011-0000-4000-8000-000000000001', '7e570010-0000-4000-8000-000000000020', 'TOP_1', 30),
	('7e570017-0000-4000-8000-000000000002', '7e570011-0000-4000-8000-000000000002', '7e570010-0000-4000-8000-000000000021', 'TOP_5', 29),
	('7e570017-0000-4000-8000-000000000003', '7e570011-0000-4000-8000-000000000003', '7e570010-0000-4000-8000-000000000020', 'TOP_10', 28),
	('7e570017-0000-4000-8000-000000000004', '7e570011-0000-4000-8000-000000000004', '7e570010-0000-4000-8000-000000000021', 'TOP_1', 27),
	('7e570017-0000-4000-8000-000000000005', '7e570011-0000-4000-8000-000000000005', '7e570010-0000-4000-8000-000000000020', 'TOP_5', 26),
	('7e570017-0000-4000-8000-000000000006', '7e570011-0000-4000-8000-000000000006', '7e570010-0000-4000-8000-000000000021', 'TOP_10', 25),
	('7e570017-0000-4000-8000-000000000007', '7e570011-0000-4000-8000-000000000007', '7e570010-0000-4000-8000-000000000020', 'TOP_1', 24),
	('7e570017-0000-4000-8000-000000000008', '7e570011-0000-4000-8000-000000000008', '7e570010-0000-4000-8000-000000000021', 'TOP_5', 23),
	('7e570017-0000-4000-8000-000000000009', '7e570011-0000-4000-8000-000000000009', '7e570010-0000-4000-8000-000000000020', 'TOP_10', 22),
	('7e570017-0000-4000-8000-000000000010', '7e570011-0000-4000-8000-000000000010', '7e570010-0000-4000-8000-000000000021', 'TOP_1', 21),
	('7e570017-0000-4000-8000-000000000011', '7e570011-0000-4000-8000-000000000011', '7e570010-0000-4000-8000-000000000020', 'TOP_5', 20),
	('7e570017-0000-4000-8000-000000000012', '7e570011-0000-4000-8000-000000000012', '7e570010-0000-4000-8000-000000000021', 'TOP_10', 19),
	('7e570017-0000-4000-8000-000000000013', '7e570011-0000-4000-8000-000000000013', '7e570010-0000-4000-8000-000000000020', 'TOP_1', 18),
	('7e570017-0000-4000-8000-000000000014', '7e570011-0000-4000-8000-000000000014', '7e570010-0000-4000-8000-000000000021', 'TOP_5', 17)
) as v(id, project_id, nominated_by, tier, tage);

-- -------------------------------------------------------------------
-- 10) Aufgabe D7: ein Aenderungsprotokoll mit Eintraegen von zwei
--     verschiedenen Administrationen. Es bezieht sich auf Plaetze, die
--     es heute nicht mehr gibt; genau so sieht ein Protokoll aus.
-- -------------------------------------------------------------------
insert into top10_audit_entry (id, timestamp, admin_id, project_id, action,
                               previous_position, new_position)
select v.id::uuid, now() - (v.tage || ' days')::interval,
       v.admin_id::uuid, v.project_id::uuid, v.action,
       v.previous_position, v.new_position
from (values
	('7e57001a-0000-4000-8000-000000000001', '7e570010-0000-4000-8000-000000000030', '7e570011-0000-4000-8000-000000000001', 'ADDED', null, 1, 14),
	('7e57001a-0000-4000-8000-000000000002', '7e570010-0000-4000-8000-000000000031', '7e570011-0000-4000-8000-000000000002', 'REORDERED', 2, 2, 13),
	('7e57001a-0000-4000-8000-000000000003', '7e570010-0000-4000-8000-000000000030', '7e570011-0000-4000-8000-000000000003', 'REMOVED', 3, null, 12),
	('7e57001a-0000-4000-8000-000000000004', '7e570010-0000-4000-8000-000000000031', '7e570011-0000-4000-8000-000000000004', 'ADDED', null, 4, 11),
	('7e57001a-0000-4000-8000-000000000005', '7e570010-0000-4000-8000-000000000030', '7e570011-0000-4000-8000-000000000005', 'REORDERED', 5, 5, 10),
	('7e57001a-0000-4000-8000-000000000006', '7e570010-0000-4000-8000-000000000031', '7e570011-0000-4000-8000-000000000006', 'REMOVED', 1, null, 9)
) as v(id, admin_id, project_id, action, previous_position, new_position, tage);

commit;
ENDE_SQL_TEST_SCHREIBEN
echo "  Datenbank geschrieben"
echo
# -------------------------------------------------------------------
# Bytes in den Objektspeicher.
#
# Im Profil dev ist der Objektspeicher der Ordner /app/var/storage im
# Backend-Container. Der Schluessel folgt FileService:
# projects/{projectId}/{uuid} fuer Projektdateien, avatars/{uuid} fuer
# Profilbilder. Der Objektname ist hier gleich der Zeilen-ID aus
# stored_file; die Anwendung vergibt sonst eine eigene UUID, fuer
# Testdaten ist die Gleichsetzung der einzige Weg, Skript und SQL ohne
# Nachschlagen in Deckung zu halten.
#
# Bildquelle ist picsum.photos in der seed-Form: derselbe Seed liefert
# dauerhaft dasselbe Foto, der Lauf ist also reproduzierbar. Faellt
# picsum aus, springt loremflickr ein. Die Fotos liegen nie im
# Repository, sondern nur im Docker-Volume.
# -------------------------------------------------------------------
echo "== Bilder laden =="

BILDQUELLE=loremflickr
if curl -sS -L -o /dev/null --fail --max-time 15 \
	"https://picsum.photos/seed/probe/64/64.jpg" 2>/dev/null; then
	BILDQUELLE=picsum
fi
echo "  Bildquelle: $BILDQUELLE"

# $1 Seed, $2 Stichwort, $3 Breite, $4 Hoehe
bild() {
	if [ "$BILDQUELLE" = "picsum" ]; then
		echo "https://picsum.photos/seed/$1/$3/$4.jpg"
	else
		echo "https://loremflickr.com/$3/$4/$2?lock=$1"
	fi
}

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

# Dateizeile | Ablageort (avatars oder Projekt-ID) | Stichwort | Seed
MANIFEST="
7e570012-0000-4000-8000-000000000001|7e570011-0000-4000-8000-000000000001|reusable,cup|1
7e570012-0000-4000-8000-000000000002|7e570011-0000-4000-8000-000000000002|radar,sensor|2
7e570012-0000-4000-8000-000000000003|7e570011-0000-4000-8000-000000000003|radar,sensor|3
7e570012-0000-4000-8000-000000000004|7e570011-0000-4000-8000-000000000004|charging,station|4
7e570012-0000-4000-8000-000000000005|7e570011-0000-4000-8000-000000000005|evcharger,cable|5
7e570012-0000-4000-8000-000000000006|7e570011-0000-4000-8000-000000000006|bicycle,camera|6
7e570012-0000-4000-8000-000000000007|7e570011-0000-4000-8000-000000000007|reclaimed,timber|7
7e570012-0000-4000-8000-000000000008|7e570011-0000-4000-8000-000000000008|stairwell,apartment|8
7e570012-0000-4000-8000-000000000009|7e570011-0000-4000-8000-000000000009|shipyard,welding|9
7e570012-0000-4000-8000-000000000010|7e570011-0000-4000-8000-000000000010|windtunnel,rotorblade|10
7e570012-0000-4000-8000-000000000011|7e570011-0000-4000-8000-000000000011|bicycle,shop|11
7e570012-0000-4000-8000-000000000012|7e570011-0000-4000-8000-000000000012|demolition,building|12
7e570012-0000-4000-8000-000000000013|7e570011-0000-4000-8000-000000000013|community,center|13
7e570012-0000-4000-8000-000000000014|7e570011-0000-4000-8000-000000000014|laptop,multimeter|14
7e570012-0000-4000-8000-000000000015|7e570011-0000-4000-8000-000000000015|rocket,launch|15
7e570012-0000-4000-8000-000000000016|7e570011-0000-4000-8000-000000000016|reusable,container|16
7e570012-0000-4000-8000-000000000017|7e570011-0000-4000-8000-000000000017|greenroof,rain|17
7e570012-0000-4000-8000-000000000018|7e570011-0000-4000-8000-000000000018|homecare,elderly|18
7e570012-0000-4000-8000-000000000019|7e570011-0000-4000-8000-000000000019|projection,foyer|19
7e570012-0000-4000-8000-000000000020|7e570011-0000-4000-8000-000000000020|cubesat,laboratory|20
7e570012-0000-4000-8000-000000000021|7e570011-0000-4000-8000-000000000021|craftsman,workshop|21
7e570012-0000-4000-8000-000000000022|7e570011-0000-4000-8000-000000000022|pavement,rainwater|22
7e570012-0000-4000-8000-000000000023|7e570011-0000-4000-8000-000000000023|community,cafe|23
7e570012-0000-4000-8000-000000000024|7e570011-0000-4000-8000-000000000024|robotics,camera|24
7e570012-0000-4000-8000-000000000025|7e570011-0000-4000-8000-000000000025|thermography,composite|25
7e570012-0000-4000-8000-000000000026|7e570011-0000-4000-8000-000000000026|coffeecup,cafe|26
7e570012-0000-4000-8000-000000000027|7e570011-0000-4000-8000-000000000027|pointcloud,warehouse|27
7e570012-0000-4000-8000-000000000028|7e570011-0000-4000-8000-000000000028|neighborhood,street|28
7e570012-0000-4000-8000-000000000029|7e570011-0000-4000-8000-000000000029|machinery,sensor|29
7e570012-0000-4000-8000-000000000030|7e570011-0000-4000-8000-000000000030|moss,wall|30
7e570012-0000-4000-8000-000000000031|7e570011-0000-4000-8000-000000000031|tax,paperwork|31
7e570012-0000-4000-8000-000000000032|7e570011-0000-4000-8000-000000000032|trees,pavement|32
7e570012-0000-4000-8000-000000000033|7e570011-0000-4000-8000-000000000033|shelter,volunteer|33
7e570012-0000-4000-8000-000000000034|7e570011-0000-4000-8000-000000000034|evcharger,cable|34
7e570012-0000-4000-8000-000000000035|7e570011-0000-4000-8000-000000000035|touchscreen,museum|35
7e570012-0000-4000-8000-000000000036|7e570011-0000-4000-8000-000000000036|workshop,tools|36
7e570012-0000-4000-8000-000000000037|7e570011-0000-4000-8000-000000000037|schoolyard,pavement|37
7e570012-0000-4000-8000-000000000038|7e570011-0000-4000-8000-000000000038|classroom,desk|38
7e570012-0000-4000-8000-000000000039|7e570011-0000-4000-8000-000000000039|epaper,display|39
7e570012-0000-4000-8000-000000000040|7e570011-0000-4000-8000-000000000040|underwater,robot|40
7e570012-0000-4000-8000-000000000041|7e570011-0000-4000-8000-000000000041|farmersmarket,vegetables|41
7e570012-0000-4000-8000-000000000042|7e570011-0000-4000-8000-000000000042|ramp,entrance|42
7e570012-0000-4000-8000-000000000043|7e570011-0000-4000-8000-000000000043|waiting,room|43
7e570012-0000-4000-8000-000000000044|7e570011-0000-4000-8000-000000000044|timetable,classroom|44
7e570012-0000-4000-8000-000000000045|7e570011-0000-4000-8000-000000000045|algae,bioreactor|45
7e570012-0000-4000-8000-000000000046|7e570011-0000-4000-8000-000000000046|parcel,warehouse|46
7e570012-0000-4000-8000-000000000047|7e570011-0000-4000-8000-000000000047|thermometer,city|47
7e570012-0000-4000-8000-000000000048|7e570011-0000-4000-8000-000000000048|school,students|48
7e570012-0000-4000-8000-000000000051|7e570011-0000-4000-8000-000000000051|milk,supermarket|51
7e570012-0000-4000-8000-000000000052|7e570011-0000-4000-8000-000000000052|bricks,demolition|52
7e570012-0000-4000-8000-000000000053|7e570011-0000-4000-8000-000000000053|shipyard,headphones|53
7e570012-0000-4000-8000-000000000054|7e570011-0000-4000-8000-000000000054|library,desk|54
7e570012-0000-4000-8000-000000000061|7e570011-0000-4000-8000-000000000061|repaircafe,tools|61
7e570012-0000-4000-8000-000000000062|7e570011-0000-4000-8000-000000000062|construction,site|62
7e570012-0000-4000-8000-000000000063|7e570011-0000-4000-8000-000000000063|microphone,podcast|63
7e570012-0000-4000-8000-000000000064|7e570011-0000-4000-8000-000000000064|soldering,workbench|64
7e570012-0000-4000-8000-000000000065|7e570011-0000-4000-8000-000000000065|solarboat,river|65
7e570012-0000-4000-8000-000000000901|avatars|portrait|901
7e570012-0000-4000-8000-000000000902|avatars|portrait|902
7e570012-0000-4000-8000-000000000903|avatars|portrait|903
7e570012-0000-4000-8000-000000000904|avatars|portrait|904
7e570012-0000-4000-8000-000000000905|avatars|portrait|905
7e570012-0000-4000-8000-000000000906|avatars|portrait|906
7e570012-0000-4000-8000-000000000907|avatars|portrait|907
7e570012-0000-4000-8000-000000000908|avatars|portrait|908
"

pfad_im_ablage() {
	if [ "$2" = "avatars" ]; then echo "$STAGE/avatars/$1"
	else echo "$STAGE/projects/$2/$1"; fi
}

count=0
while IFS='|' read -r file_id place wort seed; do
	[ -z "${file_id:-}" ] && continue
	if [ "$place" = "avatars" ]; then
		url=$(bild "$seed" "$wort" 400 400)
	else
		url=$(bild "$seed" "$wort" 1200 675)
	fi
	ziel=$(pfad_im_ablage "$file_id" "$place")
	mkdir -p "$(dirname "$ziel")"
	# --fail laesst curl bei 4xx/5xx abbrechen, statt die Fehlerseite als
	# Datei abzulegen. Ohne das landete ein HTML-Text im Objektspeicher
	# und das Portal lieferte ihn als "image/jpeg" aus.
	if ! curl -sS -L --fail --max-time 60 \
		-A "eportfolio-testdaten/1.0 (lokale Entwicklungsdatenbank)" \
		-o "$ziel" "$url"; then
		abbruch "$url liess sich nicht laden ($file_id)."
	fi
	count=$((count + 1))
	printf '\r  %3d von 65 geladen' "$count"
done <<< "$MANIFEST"
echo

# Pruefen, bevor kopiert wird. Der Grund steht in AllowedFileType: das
# Portal prueft beim Upload die Signatur am Dateianfang, beim Ausliefern
# aber nicht mehr. Was hier an der Anwendung vorbei in den Speicher
# gelegt wird, laeuft ungeprueft durch.
while IFS='|' read -r file_id place wort seed; do
	[ -z "${file_id:-}" ] && continue
	kopf=$(head -c 3 "$(pfad_im_ablage "$file_id" "$place")" | od -An -tx1 | tr -d ' \n')
	[ "$kopf" = "ffd8ff" ] || abbruch "$file_id ist kein JPEG."
done <<< "$MANIFEST"
echo "  Signaturen geprueft"

# Uebertragen als tar-Strom und nicht mit "docker cp": unter Git Bash
# schreibt MSYS aus "$STAGE/." das Verzeichnis selbst, der Inhalt landete
# dann eine Ebene zu tief und jeder Abruf antwortete mit 500.
im_container "mkdir -p '$ROOT'"
tar -C "$STAGE" -cf - . | docker exec -i "$BACKEND" sh -lc "tar -C '$ROOT' -xf -"
echo "  in den Objektspeicher kopiert"

# Die tatsaechlichen Groessen nachtragen. stored_file.size ist keine
# Zierde: FileController setzt daraus den Content-Length der Antwort.
# Steht dort eine andere Zahl, bricht der Abruf ab, ohne dass irgendwo
# ein Fehler sichtbar wird.
werte=""
while IFS='|' read -r file_id place wort seed; do
	[ -z "${file_id:-}" ] && continue
	bytes=$(wc -c < "$(pfad_im_ablage "$file_id" "$place")" | tr -d ' ')
	werte="$werte,('$file_id'::uuid, $bytes::bigint)"
done <<< "$MANIFEST"
werte="${werte#,}"

sql <<SQL
update stored_file f set size = v.bytes
from (values $werte) as v(id, bytes)
where f.id = v.id;
SQL
echo "  Dateigroessen nachgetragen"
echo

echo "== Stand =="
sql -c "
select 'Testkonten' as bestand, count(*) from app_user where id::text like '7e570010-%'
union all select 'Projekte veroeffentlicht', count(*) from project
       where id::text like '7e570011-%' and status = 'PUBLISHED'
union all select 'Projekte eingereicht', count(*) from project
       where id::text like '7e570011-%' and status = 'SUBMITTED'
union all select 'Projekte genehmigt', count(*) from project
       where id::text like '7e570011-%' and status = 'APPROVED'
union all select 'Bloecke', count(*) from block b
       where b.project_id in (select id from project where id::text like '7e570011-%')
union all select 'Dateien', count(*) from stored_file where id::text like '7e570012-%'
union all select 'Nominierungen offen', count(*) from top10_nomination where status = 'PENDING'
union all select 'Top-10-Plaetze', count(*) from top10_entry
union all select 'Pruefspurzeilen', count(*) from top10_audit_entry;"
echo

# Die Seed-Pruefliste nennt einen Korridor von 40 bis 60
# veroeffentlichten Projekten, und gemeint ist der ganze sichtbare
# Bestand: die Testperson sieht auch die Demodaten. Steht beides
# nebeneinander, liegt die Summe darueber, und A3 und A4 messen etwas
# anderes als gedacht.
fremd=$(sql -tAc "select count(*) from project
                  where status = 'PUBLISHED' and id::text not like '7e570011-%';" | tr -d '[:space:]')
if [ "$fremd" != "0" ]; then
	echo "Hinweis: $fremd weitere veroeffentlichte Projekte stammen nicht aus"
	echo "diesem Bestand, vermutlich aus den Demodaten. Zusammen liegt der"
	echo "sichtbare Bestand ueber dem Korridor der Pruefliste. Die"
	echo "Testumgebung soll nur den Testbestand fuehren; entfernt werden die"
	echo "anderen mit: bash demo-daten-raeumen.sh"
	echo
fi

echo "== Fuer die Aufgabenkarten =="
echo "  A2  Thema: Baustoffbörse"
echo "      Zielprojekt: Baustoffbörse am Neustadtswall"
echo "  A3  Fakultaet Elektrotechnik und Informatik, Semester WiSe 2025/26,"
echo "      Abschluss Bachelor. Fuenf Treffer."
echo "  A5  inhaltsreiches Projekt: Mehrwegpfand in der Bremer Gastronomie"
echo "  C3  Titel: Zahlungsbereitschaft für regionale Milch in Bremen"
echo "  C4  Titel: Wiederverwendung von Ziegeln aus einem Abbruch in Walle"
echo "  C6  Titel: Audiowalk zur Werftgeschichte in Gröpelingen"
echo "  D3  Name des Zusatzkontos: Nele Ostermann"
echo "  D4  Kategorien: Studienprojekt, Studentisches Projekt"
echo "  B1  Zugangsdaten entstehen je Sitzung: bash test-sitzung.sh TN.."
echo "  C1  ebenso, fuer TN06 und TN07"
echo "  D1  ebenso, fuer TN09 und TN10"
echo
echo "Fertig. Naechster Schritt: bash test-seeder-pruefen.sh, danach je"
echo "Sitzung bash test-sitzung.sh TN.."
