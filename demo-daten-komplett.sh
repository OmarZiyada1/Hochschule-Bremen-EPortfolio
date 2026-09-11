#!/usr/bin/env bash
# ===================================================================
# Demodaten fuer das E-Portfolio Hochschule Bremen, alles in einem Lauf.
#
# EIN Aufruf, aus dem Wurzelverzeichnis des Repos, bei laufendem
# Dev-Stack (docker compose -f compose.base.yml -f compose.dev.yml up -d):
#
#     bash demo-daten-komplett.sh
#
# Danach steht in der Entwicklungsdatenbank:
#
#  10 zusaetzliche Konten  7 Beteiligte (6 Studierende, 1 Redakteurin)
#                          und 3 anmeldbare Rollenkonten (STUDENT,
#                          EDITOR, ADMIN) zum Vorfuehren
#  10 Projekte             ueber alle fuenf Status, fuenf Fakultaeten,
#                          alle drei Projektarten und Abschluesse
# 120 Inhaltsbloecke       ueber alle 15 Blocktypen
#  50 Dateien              Titelbilder, Galerien, Avatare, PDF, Audio,
#                          Video, echte Bytes im Objektspeicher
#      dazu Mitglieder, Redaktionszuweisung, Schlagworte, Statusverlauf,
#      Kommentare, Reaktionen und ein gefuellter Top-10-Bestand.
#
# Das Skript ist WIEDERHOLBAR. Es raeumt seinen eigenen vorigen Lauf
# ueber feste ID-Praefixe ab und ersetzt ihn, statt ihn zu verdoppeln.
# Vorhandene Daten ausserhalb dieser Praefixe fasst es nicht an. Wer den
# gesamten Altbestand loswerden will, nimmt vorher
# demo-daten-raeumen.sh; das ist ein anderer Vorgang und deshalb ein
# anderes Skript.
#
# Es ist bewusst KEINE Flyway-Migration und KEIN Seeder: Testdaten sind
# kein Bestandteil des Schemas und kein Bestandteil des ausgelieferten
# Programms.
#
# Voraussetzungen:
#   - Docker laeuft, die Container des Dev-Stacks sind oben
#   - Die Datenbank ist migriert (Stammdaten und dev-Testnutzer stehen)
#   - Internetzugang: die Bilder kommen aus dem Netz
#   - bash, curl und tar (unter Windows: Git Bash)
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   BACKEND_CONTAINER=... DB_CONTAINER=... bash demo-daten-komplett.sh
# ===================================================================
set -euo pipefail

BACKEND="${BACKEND_CONTAINER:-eportfolio-dev-backend-1}"
DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
DB_USER="${POSTGRES_USER:-eportfolio}"
DB_NAME="${POSTGRES_DB:-eportfolio}"
ROOT=/app/var/storage

# Unter Git Bash auf Windows schreibt MSYS jedes Argument um, das wie ein
# Unix-Pfad aussieht, sobald es an ein Windows-Programm geht. Aus
#   docker exec backend echo /app/var/storage
# wird dabei "C:/Program Files/Git/app/var/storage", und der Container
# sieht einen Pfad, den es dort nicht gibt. Besonders tueckisch, weil rm
# und mkdir damit klaglos durchlaufen: sie legen den falschen Pfad an,
# statt sich zu beschweren.
#
# Der Riegel dagegen: jeder Befehl im Container laeuft durch
# "sh -lc '...'". In einer Zeichenkette fasst MSYS den Pfad nicht an.
#
# Was hier bewusst NICHT steht, ist ein globales MSYS_NO_PATHCONV=1. Es
# wuerde die Umschreibung fuer alle folgenden Aufrufe abschalten, also
# auch fuer curl, und curl ist unter Git Bash ein Windows-Programm: es
# braucht die Umschreibung, um in den Ablageordner unter /tmp schreiben
# zu koennen. Die Abkuerzung repariert den Kopierschritt und zerlegt
# dafuer den Ladeschritt.

im_container() { docker exec "$BACKEND" sh -lc "$1"; }

sql() { docker exec -i -e PGCLIENTENCODING=UTF8 "$DB" \
	psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" "$@"; }

abbruch() { echo; echo "ABBRUCH: $1" >&2; exit 1; }

# -------------------------------------------------------------------
# 0) Vorbedingungen pruefen, bevor irgendetwas geschrieben wird.
#
#    Jede dieser Pruefungen steht fuer einen Fehlschlag, der sonst erst
#    mitten im Lauf auffaellt und einen halb gefuellten Bestand
#    hinterlaesst.
# -------------------------------------------------------------------
echo "== Vorbedingungen =="

command -v docker >/dev/null 2>&1 || abbruch "docker nicht gefunden."
command -v curl   >/dev/null 2>&1 || abbruch "curl nicht gefunden."
command -v tar    >/dev/null 2>&1 || abbruch "tar nicht gefunden."
# Seit KAN-99 erzeugt das Skript das Demopasswort selbst, wenn keines
# vorgegeben ist. Ohne openssl braeche der Lauf mit einer nackten
# Shell-Meldung ab statt mit einer Erklaerung.
command -v openssl >/dev/null 2>&1 || abbruch "openssl nicht gefunden."

for c in "$DB" "$BACKEND"; do
	if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" != "true" ]; then
		abbruch "Container $c laeuft nicht. Dev-Stack starten:
         docker compose -f compose.base.yml -f compose.dev.yml up -d"
	fi
done
echo "  Container laufen: $DB, $BACKEND"

docker exec "$DB" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
	|| abbruch "Die Datenbank $DB_NAME antwortet nicht."

# -------------------------------------------------------------------
# Passwort und Hash der drei Rollenkonten (KAN-99)
# -------------------------------------------------------------------
# HIER STAND FRUEHER EINE ABHAENGIGKEIT VOM PROFIL DEV. Der Hash aller
# Demokonten kam per Unterabfrage von dev-studi@dev.invalid, und drei
# weitere Konten (dev-studi, dev-redakteur, dev-admin) wurden nicht
# angelegt, sondern vorausgesetzt. Alle drei legt ausschliesslich der
# DevTestUserSeeder an, und der traegt @Profile("dev").
#
# Auf einer Produktivumgebung gibt es sie also nicht. Das Skript brach
# genau hier ab, und wer nur die Pruefung entfernte, bekam einen
# NOT-NULL-Verstoss auf password_hash. Wer daraufhin nur den Hash
# austauschte, bekam etwas Schlimmeres: 42 Verweise auf die drei Konten
# stehen in INNER JOINs und CROSS JOINs verteilt ueber neun Tabellen und
# faenden nichts. Das Skript liefe durch und liesse stillschweigend
# Redaktionszuweisungen, Kommentare, Statusverlaeufe, Nominierungen und
# die Top-10-Pruefspur weg.
#
# Seit KAN-99 legt das Skript die drei Rollenkonten selbst an und haengt
# an keinem Profil mehr.
#
# BCRYPT LAESST SICH IN SQL NICHT RECHNEN. Der Hash entsteht deshalb in
# einem Wegwerf-Container mit htpasswd. Bewusst nicht ueber pgcrypto:
# das verlangte "create extension" in der Datenbank, also eine
# Schemaaenderung an Flyway vorbei, nur um Demodaten zu setzen.
#
# NUR DIE DREI ROLLENKONTEN SIND ANMELDBAR. Die sieben uebrigen treten
# als Autor:innen, Mitglieder und Kommentierende auf und bekommen einen
# unbrauchbaren Hash. Der Bestand landet auf einem oeffentlich
# erreichbaren Server; jedes anmeldbare Konto mehr ist ein Ziel mehr.
if [ -z "${DEMO_PASSWORT:-}" ]; then
	# Kein Pipe und kein tr: mit "set -o pipefail" ist eine Kette, deren
	# vorderes Glied durch SIGPIPE endet, ein Abbruch des ganzen Skripts.
	DEMO_PASSWORT=$(openssl rand -hex 10)
	PASSWORT_ERZEUGT=ja
else
	PASSWORT_ERZEUGT=nein
fi

# Dieselbe Grenze wie fuer jedes selbst gewaehlte Passwort
# (PasswordPolicy.MIN_LENGTH, §3.1.1).
[ "${#DEMO_PASSWORT}" -ge 12 ] || abbruch "DEMO_PASSWORT ist kuerzer als 12 Zeichen."

echo "  Passwort-Hash wird erzeugt (einmaliger Wegwerf-Container)"
# Das Passwort geht als exportierte Variable hinein und NICHT als Argument.
# Ein Wert im Aufrufwort stuende in der Prozessliste des Wirts und, solange
# der Container laeuft, in "docker inspect": jede Person, die "ps" oder
# "docker" aufrufen darf, koennte ihn mitlesen. Docker reicht bei "-e NAME"
# ohne "=wert" nur den Namen weiter und holt den Wert aus der eigenen
# Umgebung. Dieselbe Ueberlegung wie beim Azure-Zweig weiter unten, wo die
# Verbindungszeichenfolge aus genau diesem Grund so uebergeben wird.
export DEMO_PASSWORT
DEMO_HASH=$(docker run --rm -e DEMO_PASSWORT httpd:2.4-alpine \
	sh -c 'htpasswd -nbBC 10 "" "$DEMO_PASSWORT"' | tr -d ':\n')
# Gegenprobe statt Vertrauen: htpasswd meldet manche Fehler auf stdout,
# und ein unbrauchbarer Hash faellt sonst erst beim ersten Anmeldeversuch
# auf. BCryptPasswordEncoder akzeptiert $2a$, $2b$ und $2y$.
case "$DEMO_HASH" in
	'$2y$'*|'$2a$'*|'$2b$'*) echo "  Hash erzeugt (${#DEMO_HASH} Zeichen)" ;;
	*) abbruch "Der erzeugte Hash sieht nicht wie bcrypt aus." ;;
esac

# Die Projekte greifen Fakultaet, Studiengang, Modul, Kategorie und
# Semester ueber ihre Kuerzel und Namen ab, nicht ueber einkopierte
# UUIDs: die sind auf jedem Rechner andere. Fehlen die Stammdaten, faende
# der join nichts und es entstuende schweigend gar kein Projekt.
#
# Die Meldung nennt das Skript, das die fehlende Art anlegt, und nicht
# mehr die Migrationen (KAN-99). Sie tat es frueher, und das schickte
# auf die falsche Faehrte: KEINE der fuenf Arten entsteht auf einer
# frischen Datenbank aus einer Migration. V202608161915__semester.sql
# uebernimmt nur die Semestertexte bereits vorhandener Projekte, und auf
# einer leeren Datenbank gibt es keine; Fakultaeten, Studiengaenge und
# Module haben ueberhaupt keine Migration, die Zeilen schreibt. Wer die
# alte Meldung las, suchte den Fehler bei Flyway und fand dort nichts.
fehlend=$(sql -tAc "
select string_agg(x.was, ', ')
from (
  select 'Fakultaeten'   as was where (select count(*) from faculty)       = 0
  union all select 'Studiengaenge' where (select count(*) from study_program) = 0
  union all select 'Module'        where (select count(*) from module)        = 0
  union all select 'Kategorien'    where (select count(*) from category)      = 0
  union all select 'Semester'      where (select count(*) from semester)      = 0
) x;" | tr -d '[:space:]')
[ -z "$fehlend" ] || abbruch "Stammdaten fehlen: $fehlend.
         Sie entstehen nicht beim Migrieren, sondern durch zwei Skripte.
         Fakultaeten, Studiengaenge und Module:
           DB_CONTAINER=$DB bash stammdaten-seeder.sh
         Kategorien und Semester:
           DB_CONTAINER=$DB bash kategorien-semester-seeder.sh
         Ohne DB_CONTAINER treffen beide die DEV-Datenbank."

echo "  Datenbank erreichbar, Stammdaten vollstaendig"
echo
# -------------------------------------------------------------------
# 1) Nutzer, Projekte und alles, was am Projekt haengt.
# -------------------------------------------------------------------
echo "== 1/4  Nutzer, Projekte, Kommentare, Reaktionen, Top-10 =="
# Der bcrypt-Hash geht als psql-Variable hinein und nicht als
# Shell-Ersetzung: der Heredoc ist mit 'ENDE_SQL_STAMMDATEN' in
# Anfuehrungszeichen geschrieben, damit die Shell die vielen $ und `
# in den Blockinhalten nicht anfasst. psql setzt :'hash' selbst ein und
# maskiert dabei richtig.
sql -v hash="$DEMO_HASH" -f - <<'ENDE_SQL_STAMMDATEN'
-- ===================================================================
-- Demodaten, Teil 1: Nutzer, Projekte und alles, was am Projekt hängt
-- außer den Inhaltsblöcken (die stehen in Schritt 2 dieses Skripts).
--
-- Bewusst KEINE Flyway-Migration und KEIN Seeder: das sind Testdaten
-- für die Entwicklungsdatenbank, kein Bestandteil des Schemas und kein
-- Bestandteil des ausgelieferten Programms.
--
-- Feste Präfixe, damit sich der Bestand wiederfinden und in einem Zug
-- entfernen lässt:
--   d0d00010-...  Nutzerkonten
--   d0d00011-...  Projekte
--   d0d00012-...  Dateizeilen
--   d0d00013-...  Portfolios
--   d0d00014-...  Kommentare
--   d0d00015-...  Reaktionen
--   d0d00016-...  Top-10-Einträge
--   d0d00017-...  Top-10-Nominierungen
--   d0d00018-...  Statusverlauf
--   d0d00019-...  Projektmitglieder
--   d0d0001a-...  Top-10-Prüfspur
-- Blöcke tragen kein Präfix: sie hängen per on delete cascade am
-- Projekt und verschwinden mit ihm.
--
-- Stammdaten werden NICHT über UUIDs angesprochen, sondern über ihre
-- Kürzel und Namen. Fakultäten, Studiengänge, Module, Kategorien und
-- Semester bekommen ihre IDs beim Anlegen der Datenbank, sind also auf
-- jedem Rechner andere; ein einkopiertes UUID-Literal liefe hier auf
-- genau einem Laptop.
--
-- Drei Regeln, die sich hier leicht verletzen lassen:
--
--   1. Die Autor:in ist KEIN Projektmitglied (Contract §3.13.1). Steht
--      sie in project_member, antwortet PUT /api/projects/{id} mit 400
--      und das Projekt lässt sich nicht mehr speichern. Ihre
--      Funktionsbezeichnung steht in project.author_role.
--   2. comment.status gibt es nur für CHANGE_REQUEST (Comment.java).
--      Ein NOTE oder REPLY mit Status wäre ein Häkchen an einer
--      Bemerkung, ein CHANGE_REQUEST ohne Status ein Arbeitsauftrag,
--      den niemand abhaken kann.
--   3. reaction ist eindeutig über (project_id, user_id). Ein Konto
--      reagiert je Beitrag genau einmal; ein zweiter Eintrag desselben
--      Kontos am selben Beitrag bricht den ganzen Lauf ab.
-- ===================================================================

begin;

-- -------------------------------------------------------------------
-- 0) Vorigen Lauf entfernen, damit ein zweiter Durchgang ersetzt statt
--    zu verdoppeln.
--
--    Die Reihenfolge folgt den Fremdschlüsseln: die Prüfspur hängt nur
--    lose am Projekt (on delete set null) und muss selbst weg; die
--    Avatare tragen kein Projekt und fallen deshalb nicht unter die
--    Kaskade; das Projekt nimmt Blöcke, Mitglieder, Redaktion,
--    Schlagwortbezüge, Kommentare, Reaktionen, Statusverlauf, Top-10
--    und seine eigenen Dateizeilen mit; die Nutzer gehen zuletzt, weil
--    project.author_id nicht kaskadiert.
-- -------------------------------------------------------------------
delete from top10_audit_entry where id::text like 'd0d0001a-%';
delete from stored_file        where id::text like 'd0d00012-%';
delete from project            where id::text like 'd0d00011-%';
delete from portfolio          where id::text like 'd0d00013-%';
delete from app_user           where id::text like 'd0d00010-%';
-- Der Hinweis auf der Startseite (KAN-99). Eigener ID-Praefix, damit ihn
-- der naechste Lauf und demo-daten-raeumen.sh wiederfinden; die
-- Startseitenpflege selbst vergibt zufaellige UUIDs.
delete from site_content       where id::text like 'd0d0001b-%';

-- -------------------------------------------------------------------
-- 1) Zehn Konten: sieben Beteiligte und drei Rollenkonten zum Vorführen.
--
--    NUR DIE DREI ROLLENKONTEN SIND ANMELDBAR (KAN-99). Sie tragen den
--    bcrypt-Hash aus :'hash', erzeugt im Skriptkopf. Die sieben übrigen
--    bekommen einen Wert, der kein bcrypt-Hash ist und deshalb zu keinem
--    Passwort passt; sie treten nur als Autor:innen, Mitglieder und
--    Kommentierende auf. Der Bestand landet auf einem öffentlich
--    erreichbaren Server, und jedes anmeldbare Konto mehr ist ein Ziel
--    mehr. Das Ausrufezeichen am Anfang ist die übliche Schreibweise für
--    ein gesperrtes Konto und macht die Absicht in der Datenbank lesbar.
--
--    DIE HOCHSCHULDOMAINS SIND BEWUSST NICHT DIE ECHTEN. Vorher standen
--    hier erfundene Personen an stud.hs-bremen.de, mit
--    hsb_email_verified = true. app_user.hsb_email ist unique: jede
--    dieser Adressen hätte die reale Trägerin dauerhaft von der
--    Registrierung ausgesperrt (409 RESOURCE_IN_USE), ohne dass jemand
--    den Zusammenhang je gefunden hätte. .invalid ist nach RFC 2606
--    garantiert nicht auflösbar.
--
--    status ACTIVE und beide Bestätigungsmerkmale auf true: ein Konto
--    in REGISTRATION_PENDING käme nicht am Login vorbei und wäre als
--    Demodatensatz wertlos.
-- -------------------------------------------------------------------
insert into app_user (
	id, email, hsb_email, email_verified, hsb_email_verified,
	password_hash, first_name, last_name, role, status,
	password_change_required, created_at, updated_at
)
select
	v.id::uuid, v.email, v.hsb_email, true, true,
	case when v.login = 'ja' then :'hash' else '!kein-login-demodaten' end,
	v.first_name, v.last_name, v.role, 'ACTIVE',
	false, now() - (v.age || ' days')::interval, now() - interval '20 days'
from (values
	('d0d00010-0000-4000-8000-000000000001', 'lena.brinkmann@demo.invalid',
	 'lena.brinkmann@stud.demo.invalid',  'Lena',    'Brinkmann', 'STUDENT', '420', 'nein'),
	('d0d00010-0000-4000-8000-000000000002', 'jonas.petersen@demo.invalid',
	 'jonas.petersen@stud.demo.invalid',  'Jonas',   'Petersen',  'STUDENT', '395', 'nein'),
	('d0d00010-0000-4000-8000-000000000003', 'aylin.demir@demo.invalid',
	 'aylin.demir@stud.demo.invalid',     'Aylin',   'Demir',     'STUDENT', '360', 'nein'),
	('d0d00010-0000-4000-8000-000000000004', 'malte.focke@demo.invalid',
	 'malte.focke@stud.demo.invalid',     'Malte',   'Focke',     'STUDENT', '340', 'nein'),
	('d0d00010-0000-4000-8000-000000000005', 'sofia.kowalski@demo.invalid',
	 'sofia.kowalski@stud.demo.invalid',  'Sofia',   'Kowalski',  'STUDENT', '310', 'nein'),
	('d0d00010-0000-4000-8000-000000000006', 'timo.ahrens@demo.invalid',
	 'timo.ahrens@stud.demo.invalid',     'Timo',    'Ahrens',    'STUDENT', '288', 'nein'),
	('d0d00010-0000-4000-8000-000000000007', 'claudia.vogt@demo.invalid',
	 'claudia.vogt@hsb.demo.invalid',     'Claudia', 'Vogt',      'EDITOR',  '500', 'nein'),

	-- Die drei Rollenkonten zum Vorführen. Ihre Adressen nennen die
	-- Rolle, damit beim Vorführen niemand raten muss, mit welchem Konto
	-- er sich gerade anmeldet.
	--
	-- Sie ersetzen zugleich die drei dev-Konten, an denen der Bestand
	-- vorher hing: student übernimmt die Autorschaft der Projekte 7 und
	-- 8, redaktion die vier Redaktionszuweisungen und die
	-- Änderungswünsche, admin die Entscheidungen über die Nominierungen
	-- und die Top-10-Prüfspur. Damit lässt sich der Ablauf aus §4.1 an
	-- einem Stück vorführen, ohne die Rolle eines Kontos zu wechseln.
	('d0d00010-0000-4000-8000-000000000008', 'student@demo.invalid',
	 'nele.reimers@stud.demo.invalid',    'Nele',    'Reimers',   'STUDENT', '520', 'ja'),
	('d0d00010-0000-4000-8000-000000000009', 'redaktion@demo.invalid',
	 'henrik.osterloh@hsb.demo.invalid',  'Henrik',  'Osterloh',  'EDITOR',  '540', 'ja'),
	('d0d00010-0000-4000-8000-00000000000a', 'admin@demo.invalid',
	 'britta.sandvoss@hsb.demo.invalid',  'Britta',  'Sandvoss',  'ADMIN',   '560', 'ja')
) as v(id, email, hsb_email, first_name, last_name, role, age, login);

-- -------------------------------------------------------------------
-- 2) Portfolios: Kurzbiografie und Profilbild.
--
--    avatar_url ist die Referenz /api/files/{id} und nie eine
--    Speicheradresse (Contract §3.15.1). Die zugehörigen Dateizeilen
--    entstehen weiter unten, die Bytes legt Schritt 3 dieses Skripts
--    ab. biography ist auf 500 Zeichen begrenzt (V202608242020).
-- -------------------------------------------------------------------
insert into portfolio (id, user_id, biography, avatar_url, created_at, updated_at)
select v.id::uuid, v.user_id::uuid, v.biography,
       '/api/files/' || v.avatar, now() - interval '300 days', now() - interval '30 days'
from (values
	('d0d00013-0000-4000-8000-000000000001', 'd0d00010-0000-4000-8000-000000000001',
	 'Medieninformatik im sechsten Semester. Interessiert an allem, was zwischen Interface und Straße liegt: Leitsysteme, Mobilität, alles mit Rädern. Arbeitet nebenher in der Fahrradwerkstatt der Hochschule.',
	 'd0d00012-0000-4000-8000-000000000001'),
	('d0d00013-0000-4000-8000-000000000002', 'd0d00010-0000-4000-8000-000000000002',
	 'Bauingenieurwesen, Schwerpunkt Tragwerksplanung. Kam über eine Zimmererlehre zum Studium und rechnet lieber mit Holz als mit Beton.',
	 'd0d00012-0000-4000-8000-000000000002'),
	('d0d00013-0000-4000-8000-000000000003', 'd0d00010-0000-4000-8000-000000000003',
	 'Masterstudium Elektrotechnik, Regelungstechnik und Sensorik. Baut Messketten, die auch dann noch messen, wenn es draußen regnet.',
	 'd0d00012-0000-4000-8000-000000000003'),
	('d0d00013-0000-4000-8000-000000000004', 'd0d00010-0000-4000-8000-000000000004',
	 'Biologie mit Schwerpunkt Ökologie. Beschäftigt sich mit dem Watt, mit Gezeiten und in letzter Zeit vor allem mit dem, was man davon hören kann.',
	 'd0d00012-0000-4000-8000-000000000004'),
	('d0d00013-0000-4000-8000-000000000005', 'd0d00010-0000-4000-8000-000000000005',
	 'Soziale Arbeit, viertes Semester. Ehrenamtlich in der Quartiersarbeit in Bremen-Gröpelingen, dort auch Mitgründerin des Repair-Cafés.',
	 'd0d00012-0000-4000-8000-000000000005'),
	('d0d00013-0000-4000-8000-000000000006', 'd0d00010-0000-4000-8000-000000000006',
	 'Wirtschaftsinformatik, davor eine kaufmännische Ausbildung. Findet Tabellen schön, wenn sie stimmen, und schreibt am liebsten über Kennzahlen, die niemand nachrechnet.',
	 'd0d00012-0000-4000-8000-000000000006'),
	('d0d00013-0000-4000-8000-000000000008', 'd0d00010-0000-4000-8000-000000000008',
	 'Informatik: Software- und Systemtechnik, fuenftes Semester. Interessiert sich fuer alles, was zwischen Datenmodell und Oberflaeche passiert, und schreibt Dokumentation lieber vorher als nachher.',
	 'd0d00012-0000-4000-8000-000000000008'),
	('d0d00013-0000-4000-8000-000000000009', 'd0d00010-0000-4000-8000-000000000009',
	 'Redaktion des E-Portfolio-Portals. Liest Beitraege vor der Veroeffentlichung gegen, achtet auf Nachvollziehbarkeit der Angaben und begruendet jeden Aenderungswunsch so, dass er ohne Rueckfrage umsetzbar ist.',
	 'd0d00012-0000-4000-8000-000000000009'),
	('d0d00013-0000-4000-8000-00000000000a', 'd0d00010-0000-4000-8000-00000000000a',
	 'Administration des E-Portfolio-Portals. Pflegt Stammdaten und Konten, entscheidet ueber die Top-10-Nominierungen und haelt die Startseite aktuell.',
	 'd0d00012-0000-4000-8000-00000000000a'),
	('d0d00013-0000-4000-8000-000000000007', 'd0d00010-0000-4000-8000-000000000007',
	 'Redaktion des E-Portfolio-Portals, Fakultät 4. Liest Beiträge vor der Veröffentlichung gegen und achtet besonders auf Alternativtexte und Quellenangaben.',
	 'd0d00012-0000-4000-8000-000000000007')
) as v(id, user_id, biography, avatar);

-- -------------------------------------------------------------------
-- 3) Schlagworte anlegen, soweit sie fehlen.
--
--    uq_tag_name_lower ist ein Ausdrucksindex, deshalb "not exists"
--    statt "on conflict": ein "on conflict (name)" träfe den Index
--    nicht und liefe in einen Fehler.
-- -------------------------------------------------------------------
insert into tag (id, name)
select gen_random_uuid(), v.name
from (values
	('Lastenrad'), ('Sharing'), ('Mobilität'), ('Nutzungsdaten'),
	('Feldaufnahme'), ('Tide'), ('Weser'), ('Klang'),
	('Regelungstechnik'), ('Gewächshaus'), ('Sensorik'),
	('Nachhaltigkeit'), ('Berichtswesen'), ('Kennzahlen'),
	('Holzbau'), ('Tragwerk'), ('Wettbewerb'),
	('Reparatur'), ('Quartiersarbeit'), ('Ehrenamt'),
	('Editor'), ('Barrierefreiheit'),
	('Exoskelett'), ('Signalverarbeitung'), ('Rehabilitation'),
	('Bausubstanz'), ('Begehung'),
	('Leitsystem'), ('Wegeführung'), ('Nutzertest')
) as v(name)
where not exists (select 1 from tag t where lower(t.name) = lower(v.name));

-- -------------------------------------------------------------------
-- 4) Zehn Projekte über alle fünf Status, fünf Fakultäten, alle drei
--    Projektarten und alle drei Abschlüsse.
--
--    version bleibt 0: das ist der Stand, den ein Client beim ersten
--    Lesen bekommt, passend zu einem frisch angelegten Datensatz. Wer
--    hier eine höhere Zahl einträgt, erzeugt beim ersten Speichern aus
--    dem Editor einen 409 PROJECT_VERSION_CONFLICT.
--
--    published_at ist genau dann gesetzt, wenn der Status PUBLISHED
--    ist. Ein Datum an einem Entwurf wäre die Behauptung, der Beitrag
--    sei schon einmal öffentlich gewesen.
--
--    Projekt 10 hängt bewusst am Sammelmodul des Studiengangs
--    (module.collective = true, KAN-83): der Fall, dass ein Beitrag
--    keinem einzelnen Modul zugeordnet ist. Das Kürzel lautet deshalb
--    ISMI-ALLG und nicht MCI: stammdaten-seeder.sh legt je Studiengang
--    genau eine Sammelzeile <Kürzel>-ALLG an, alle übrigen Module
--    tragen collective = false. Wäre hier ein Fachmodul eingetragen,
--    käme der Fall aus §3.9 im ganzen Demobestand nicht mehr vor.
--
--    Projekt 7 und 8 gehören student@demo.invalid, einem der drei
--    Rollenkonten. Wer sich damit anmeldet, sieht sofort einen Entwurf
--    und einen zurückgewiesenen Beitrag, also genau die zwei Zustände,
--    die man einer Studierenden vorführen will.
--
--    Vorher stand hier dev-studi@dev.invalid, und davor omar@gmail.com.
--    Beide gab es in der Zieldatenbank nicht: ein leerer join hätte die
--    Projekte schweigend ausfallen lassen und den Blockschritt danach in
--    eine Fremdschlüsselverletzung laufen lassen (KAN-99).
-- -------------------------------------------------------------------
insert into project (
	id, title, summary, cover_image_url, status, project_type, degree,
	author_id, author_role, faculty_id, study_program_id, module_id,
	category_id, semester_id, created_at, updated_at, published_at, version
)
select
	v.id::uuid, v.title, v.summary,
	'/api/files/' || v.cover,
	v.status, v.project_type, v.degree,
	a.id, v.author_role,
	f.id, sp.id, m.id, c.id, s.id,
	now() - (v.created || ' days')::interval,
	now() - (v.updated || ' days')::interval,
	case when v.status = 'PUBLISHED'
	     then now() - (v.updated || ' days')::interval end,
	0
from (values
	('d0d00011-0000-4000-8000-000000000001',
	 'Lastenrad-Sharing am Campus Neustadtswall',
	 'Vier Lastenräder, ein Semester, 312 Ausleihen: wie ein studentisch betriebenes Sharing-Angebot am Neustadtswall entstanden ist, woran die erste Fassung der Buchung gescheitert ist und was die Nutzungsdaten über die tatsächlich gefahrenen Wege sagen.',
	 'd0d00012-0000-4000-8000-000000000010',
	 'PUBLISHED', 'REGULAR', 'BACHELOR',
	 'lena.brinkmann@demo.invalid', 'Projektleitung und Auswertung',
	 'FK4', 'ISS', 'PROJISS', 'Semesterprojekt', 'WiSe 2025/26', 160, 96),

	('d0d00011-0000-4000-8000-000000000002',
	 'Tideklänge: ein Hörarchiv der Unterweser',
	 'Ein Jahr lang an denselben vier Messpunkten aufgenommen, immer zur gleichen Tidephase. Der Beitrag zeigt den Aufbau der Hydrofonkette, die Auswertung der Pegel und was sich am Klang eines Priels über die Jahreszeiten ändert.',
	 'd0d00012-0000-4000-8000-000000000020',
	 'PUBLISHED', 'REGULAR', 'BACHELOR',
	 'malte.focke@demo.invalid', 'Feldaufnahmen und Schnitt',
	 'FK5', 'ISTAB-M', 'AQUAOEKO', 'Forschungsprojekt', 'SoSe 2025', 300, 210),

	('d0d00011-0000-4000-8000-000000000003',
	 'Gewächshaus im Regelkreis',
	 'Temperatur, Bodenfeuchte und CO2 in einem Versuchsgewächshaus, geregelt statt gesteuert. Aufbau der Messkette, Entwurf des Reglers, Vergleich mit der bisherigen Zeitschaltuhr über acht Wochen Dauerbetrieb.',
	 'd0d00012-0000-4000-8000-000000000030',
	 'PUBLISHED', 'REGULAR', 'MASTER',
	 'aylin.demir@demo.invalid', 'Regelungsentwurf und Messtechnik',
	 'FK4', 'ATMECH', 'REGTECH', 'Praxisprojekt', 'WiSe 2025/26', 150, 80),

	('d0d00011-0000-4000-8000-000000000004',
	 'Nachhaltigkeitsberichte ohne Nebelkerzen',
	 'Vierzig Berichte mittelständischer Unternehmen, gelesen mit einem Prüfraster aus zwölf Fragen. Das Ergebnis: die Hälfte der genannten Kennzahlen lässt sich aus dem Bericht selbst nicht nachrechnen.',
	 'd0d00012-0000-4000-8000-000000000040',
	 'PUBLISHED', 'THESIS', 'MBA',
	 'timo.ahrens@demo.invalid', null,
	 'FK1', 'SBE', 'ESGAT', 'Abschlussarbeit', 'SoSe 2025', 280, 190),

	('d0d00011-0000-4000-8000-000000000005',
	 'Ein Tragwerk aus Buchenholz',
	 'Entwurf, Nachweis und Bau eines Fußgängerstegs von neun Metern Spannweite aus Buchenfurnierschichtholz. Der Beitrag begleitet den Wettbewerbsentwurf vom ersten Knotenpunkt bis zum Belastungsversuch.',
	 'd0d00012-0000-4000-8000-000000000050',
	 'APPROVED', 'REGULAR', 'BACHELOR',
	 'jonas.petersen@demo.invalid', 'Tragwerksberechnung',
	 'FK2', 'BAU', 'BST1-STB1', 'Wettbewerbsbeitrag', 'WiSe 2025/26', 120, 26),

	('d0d00011-0000-4000-8000-000000000006',
	 'Repair-Café Gröpelingen: 14 Termine, 212 Geräte',
	 'Was eine ehrenamtliche Reparaturwerkstatt im Quartier leistet und wo sie an Grenzen stößt. Mit einer Auswertung, welche Geräte kommen, welche sich lohnen und woran eine Reparatur meistens scheitert.',
	 'd0d00012-0000-4000-8000-000000000060',
	 'SUBMITTED', 'REGULAR', 'BACHELOR',
	 'sofia.kowalski@demo.invalid', 'Organisation und Auswertung',
	 'FK3', 'SOZ', 'MAGW', 'Studentische Initiative', 'WiSe 2025/26', 100, 12),

	('d0d00011-0000-4000-8000-000000000007',
	 'Werkstattbericht: der blockbasierte Editor',
	 'Ein Zwischenstand aus der Lehrveranstaltung: welche Blocktypen der Editor kennt, warum das Inhaltsverzeichnis eine Momentaufnahme und keine Ableitung ist, und was beim Umsortieren schiefgehen kann.',
	 'd0d00012-0000-4000-8000-000000000070',
	 'DRAFT', 'REGULAR', 'BACHELOR',
	 'student@demo.invalid', null,
	 'FK4', 'ISS', 'SWTSP', 'Lehrveranstaltung', 'SoSe 2026', 30, 2),

	('d0d00011-0000-4000-8000-000000000008',
	 'Bewegungsabsicht statt Knopfdruck',
	 'Ein Handgelenk-Exoskelett, das nicht auf einen Taster wartet, sondern auf das Muskelsignal. Aufbau der Messkette, Merkmalsauswahl, Klassifikation in Echtzeit und was die Probandenstudie mit zwölf Personen ergeben hat.',
	 'd0d00012-0000-4000-8000-000000000080',
	 'REVISION', 'PAPER', 'MASTER',
	 'student@demo.invalid', 'Messkette und Klassifikation',
	 'FK4', 'ATMECH', 'PA-SENSAK', 'Forschungsprojekt', 'SoSe 2025', 260, 40),

	('d0d00011-0000-4000-8000-000000000009',
	 '74 Befunde: Bauzustand des Gebäudes AB',
	 'Eine vollständige Begehung des Gebäudes AB, aufgenommen in vier Wochen. Jeder Befund mit Ort, Foto und Einordnung, dazu eine Auswertung, welche Schäden sich auf dieselbe Ursache zurückführen lassen.',
	 'd0d00012-0000-4000-8000-000000000090',
	 'PUBLISHED', 'REGULAR', 'BACHELOR',
	 'jonas.petersen@demo.invalid', 'Begehung und Dokumentation',
	 'FK2', 'BAU-M', 'BESTAND', 'Praxisprojekt', 'WiSe 2024/25', 480, 400),

	('d0d00011-0000-4000-8000-000000000010',
	 'Wegeführung im Foyer: ein Leitsystem zum Anfassen',
	 'Das Foyer des Gebäudes AB als Aufgabe: Wer zum ersten Mal kommt, findet die Prüfungsämter nicht. Der Beitrag zeigt Piktogramme, ein tastbares Übersichtsmodell und was elf Nutzertests davon übrig gelassen haben.',
	 'd0d00012-0000-4000-8000-0000000000a0',
	 'PUBLISHED', 'REGULAR', 'MASTER',
	 'lena.brinkmann@demo.invalid', 'Gestaltung und Nutzertests',
	 'FK4', 'ISMI', 'ISMI-ALLG', 'Interaktive Medien', 'SoSe 2026', 60, 8)
) as v(id, title, summary, cover, status, project_type, degree,
       author_email, author_role, faculty, program, module, category,
       semester, created, updated)
join app_user      a  on a.email        = v.author_email
join faculty       f  on f.abbreviation = v.faculty
join study_program sp on sp.abbreviation = v.program
join module        m  on m.abbreviation = v.module
join category      c  on c.name         = v.category
join semester      s  on s.name         = v.semester;

-- -------------------------------------------------------------------
-- 5) Projektmitglieder.
--
--    Die Autor:in steht hier NICHT (Contract §3.13.1). Ihre
--    Funktionsbezeichnung ist project.author_role, eingetragen oben.
--    Projekt 4 (Abschlussarbeit) und Projekt 7 (Entwurf) haben
--    absichtlich keine Mitglieder.
-- -------------------------------------------------------------------
insert into project_member (id, project_id, user_id, project_role)
select v.id::uuid, v.project_id::uuid, u.id, v.project_role
from (values
	('d0d00019-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000001', 'timo.ahrens@demo.invalid',    'Buchungsoberfläche'),
	('d0d00019-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000001', 'aylin.demir@demo.invalid',    'Schließtechnik'),
	('d0d00019-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000001', 'student@demo.invalid',        'Datenauswertung'),
	('d0d00019-0000-4000-8000-000000000004', 'd0d00011-0000-4000-8000-000000000002', 'sofia.kowalski@demo.invalid', 'Interviews mit Anwohnenden'),
	('d0d00019-0000-4000-8000-000000000005', 'd0d00011-0000-4000-8000-000000000003', 'malte.focke@demo.invalid',    'Pflanzenauswahl'),
	('d0d00019-0000-4000-8000-000000000006', 'd0d00011-0000-4000-8000-000000000003', 'student@demo.invalid',        'Sensorik'),
	('d0d00019-0000-4000-8000-000000000007', 'd0d00011-0000-4000-8000-000000000005', 'lena.brinkmann@demo.invalid', 'Visualisierung'),
	('d0d00019-0000-4000-8000-000000000008', 'd0d00011-0000-4000-8000-000000000005', 'aylin.demir@demo.invalid',    'Messtechnik am Prüfstand'),
	('d0d00019-0000-4000-8000-000000000009', 'd0d00011-0000-4000-8000-000000000006', 'timo.ahrens@demo.invalid',    'Warenwirtschaft'),
	('d0d00019-0000-4000-8000-00000000000a', 'd0d00011-0000-4000-8000-000000000006', 'malte.focke@demo.invalid',    'Werkstattbetrieb'),
	('d0d00019-0000-4000-8000-00000000000b', 'd0d00011-0000-4000-8000-000000000008', 'aylin.demir@demo.invalid',    'Signalverarbeitung'),
	('d0d00019-0000-4000-8000-00000000000c', 'd0d00011-0000-4000-8000-000000000008', 'lena.brinkmann@demo.invalid', 'Auswertungsoberfläche'),
	('d0d00019-0000-4000-8000-00000000000d', 'd0d00011-0000-4000-8000-000000000009', 'sofia.kowalski@demo.invalid', 'Fotodokumentation'),
	('d0d00019-0000-4000-8000-00000000000e', 'd0d00011-0000-4000-8000-000000000010', 'jonas.petersen@demo.invalid', 'Modellbau'),
	('d0d00019-0000-4000-8000-00000000000f', 'd0d00011-0000-4000-8000-000000000010', 'sofia.kowalski@demo.invalid', 'Nutzertests'),
	('d0d00019-0000-4000-8000-000000000010', 'd0d00011-0000-4000-8000-000000000010', 'timo.ahrens@demo.invalid',    'Auswertung')
) as v(id, project_id, user_email, project_role)
join app_user u on u.email = v.user_email;

-- -------------------------------------------------------------------
-- 6) Redaktionszuweisung.
--
--    Ohne zugewiesene Redaktion liegt ein eingereichter Beitrag in
--    keinem Postkorb. Zugewiesen sind die beiden Konten mit der Rolle
--    EDITOR; ein STUDENT-Konto gehört hier nicht hinein.
-- -------------------------------------------------------------------
insert into project_editor (project_id, user_id)
select v.project_id::uuid, u.id
from (values
	('d0d00011-0000-4000-8000-000000000001', 'claudia.vogt@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000002', 'redaktion@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000003', 'claudia.vogt@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000004', 'redaktion@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000005', 'claudia.vogt@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000006', 'redaktion@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000008', 'claudia.vogt@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000009', 'claudia.vogt@demo.invalid'),
	('d0d00011-0000-4000-8000-000000000010', 'redaktion@demo.invalid')
) as v(project_id, user_email)
join app_user u on u.email = v.user_email;

-- -------------------------------------------------------------------
-- 7) Schlagworte an die Projekte hängen.
-- -------------------------------------------------------------------
insert into project_tag (project_id, tag_id)
select v.project_id::uuid, t.id
from (values
	('d0d00011-0000-4000-8000-000000000001', 'Lastenrad'),
	('d0d00011-0000-4000-8000-000000000001', 'Sharing'),
	('d0d00011-0000-4000-8000-000000000001', 'Mobilität'),
	('d0d00011-0000-4000-8000-000000000001', 'Nutzungsdaten'),
	('d0d00011-0000-4000-8000-000000000002', 'Feldaufnahme'),
	('d0d00011-0000-4000-8000-000000000002', 'Tide'),
	('d0d00011-0000-4000-8000-000000000002', 'Weser'),
	('d0d00011-0000-4000-8000-000000000002', 'Klang'),
	('d0d00011-0000-4000-8000-000000000003', 'Regelungstechnik'),
	('d0d00011-0000-4000-8000-000000000003', 'Gewächshaus'),
	('d0d00011-0000-4000-8000-000000000003', 'Sensorik'),
	('d0d00011-0000-4000-8000-000000000004', 'Nachhaltigkeit'),
	('d0d00011-0000-4000-8000-000000000004', 'Berichtswesen'),
	('d0d00011-0000-4000-8000-000000000004', 'Kennzahlen'),
	('d0d00011-0000-4000-8000-000000000005', 'Holzbau'),
	('d0d00011-0000-4000-8000-000000000005', 'Tragwerk'),
	('d0d00011-0000-4000-8000-000000000005', 'Wettbewerb'),
	('d0d00011-0000-4000-8000-000000000006', 'Reparatur'),
	('d0d00011-0000-4000-8000-000000000006', 'Quartiersarbeit'),
	('d0d00011-0000-4000-8000-000000000006', 'Ehrenamt'),
	('d0d00011-0000-4000-8000-000000000007', 'Editor'),
	('d0d00011-0000-4000-8000-000000000007', 'Barrierefreiheit'),
	('d0d00011-0000-4000-8000-000000000008', 'Exoskelett'),
	('d0d00011-0000-4000-8000-000000000008', 'Signalverarbeitung'),
	('d0d00011-0000-4000-8000-000000000008', 'Rehabilitation'),
	('d0d00011-0000-4000-8000-000000000009', 'Bausubstanz'),
	('d0d00011-0000-4000-8000-000000000009', 'Begehung'),
	('d0d00011-0000-4000-8000-000000000010', 'Leitsystem'),
	('d0d00011-0000-4000-8000-000000000010', 'Wegeführung'),
	('d0d00011-0000-4000-8000-000000000010', 'Nutzertest')
) as v(project_id, tag_name)
join tag t on lower(t.name) = lower(v.tag_name);

-- -------------------------------------------------------------------
-- 8) Statusverlauf.
--
--    Ein Eintrag je Übergang, und die Kette endet auf dem Status, den
--    das Projekt oben trägt (Contract §3.12, §4.1). Projekt 7 hat
--    keinen Eintrag: es hat DRAFT nie verlassen.
--
--    Wer den Übergang ausgelöst hat, folgt der Rechtematrix: abgeben
--    und zurückziehen tut die Autor:in, freigeben, zurückweisen und
--    veröffentlichen die Redaktion.
-- -------------------------------------------------------------------
insert into project_status_history (id, project_id, from_status, to_status, changed_by, timestamp)
select v.id::uuid, v.project_id::uuid, v.from_status, v.to_status, u.id,
       now() - (v.days || ' days')::interval
from (values
	('d0d00018-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000001', 'DRAFT',     'SUBMITTED', 'lena.brinkmann@demo.invalid', 112),
	('d0d00018-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000001', 'SUBMITTED', 'APPROVED',  'claudia.vogt@demo.invalid',   103),
	('d0d00018-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000001', 'APPROVED',  'PUBLISHED', 'claudia.vogt@demo.invalid',    96),
	('d0d00018-0000-4000-8000-000000000004', 'd0d00011-0000-4000-8000-000000000002', 'DRAFT',     'SUBMITTED', 'malte.focke@demo.invalid',    232),
	('d0d00018-0000-4000-8000-000000000005', 'd0d00011-0000-4000-8000-000000000002', 'SUBMITTED', 'APPROVED',  'redaktion@demo.invalid',      219),
	('d0d00018-0000-4000-8000-000000000006', 'd0d00011-0000-4000-8000-000000000002', 'APPROVED',  'PUBLISHED', 'redaktion@demo.invalid',      210),
	('d0d00018-0000-4000-8000-000000000007', 'd0d00011-0000-4000-8000-000000000003', 'DRAFT',     'SUBMITTED', 'aylin.demir@demo.invalid',     97),
	('d0d00018-0000-4000-8000-000000000008', 'd0d00011-0000-4000-8000-000000000003', 'SUBMITTED', 'APPROVED',  'claudia.vogt@demo.invalid',    88),
	('d0d00018-0000-4000-8000-000000000009', 'd0d00011-0000-4000-8000-000000000003', 'APPROVED',  'PUBLISHED', 'claudia.vogt@demo.invalid',     80),
	('d0d00018-0000-4000-8000-00000000000a', 'd0d00011-0000-4000-8000-000000000004', 'DRAFT',     'SUBMITTED', 'timo.ahrens@demo.invalid',    214),
	('d0d00018-0000-4000-8000-00000000000b', 'd0d00011-0000-4000-8000-000000000004', 'SUBMITTED', 'APPROVED',  'redaktion@demo.invalid',      201),
	('d0d00018-0000-4000-8000-00000000000c', 'd0d00011-0000-4000-8000-000000000004', 'APPROVED',  'PUBLISHED', 'redaktion@demo.invalid',      190),
	('d0d00018-0000-4000-8000-00000000000d', 'd0d00011-0000-4000-8000-000000000005', 'DRAFT',     'SUBMITTED', 'jonas.petersen@demo.invalid',  38),
	('d0d00018-0000-4000-8000-00000000000e', 'd0d00011-0000-4000-8000-000000000005', 'SUBMITTED', 'APPROVED',  'claudia.vogt@demo.invalid',    26),
	('d0d00018-0000-4000-8000-00000000000f', 'd0d00011-0000-4000-8000-000000000006', 'DRAFT',     'SUBMITTED', 'sofia.kowalski@demo.invalid',  12),
	('d0d00018-0000-4000-8000-000000000010', 'd0d00011-0000-4000-8000-000000000008', 'DRAFT',     'SUBMITTED', 'student@demo.invalid',         58),
	('d0d00018-0000-4000-8000-000000000011', 'd0d00011-0000-4000-8000-000000000008', 'SUBMITTED', 'REVISION',  'claudia.vogt@demo.invalid',    40),
	('d0d00018-0000-4000-8000-000000000012', 'd0d00011-0000-4000-8000-000000000009', 'DRAFT',     'SUBMITTED', 'jonas.petersen@demo.invalid', 425),
	('d0d00018-0000-4000-8000-000000000013', 'd0d00011-0000-4000-8000-000000000009', 'SUBMITTED', 'APPROVED',  'claudia.vogt@demo.invalid',   411),
	('d0d00018-0000-4000-8000-000000000014', 'd0d00011-0000-4000-8000-000000000009', 'APPROVED',  'PUBLISHED', 'claudia.vogt@demo.invalid',   400),
	('d0d00018-0000-4000-8000-000000000015', 'd0d00011-0000-4000-8000-000000000010', 'DRAFT',     'SUBMITTED', 'lena.brinkmann@demo.invalid',  22),
	('d0d00018-0000-4000-8000-000000000016', 'd0d00011-0000-4000-8000-000000000010', 'SUBMITTED', 'APPROVED',  'redaktion@demo.invalid',       14),
	('d0d00018-0000-4000-8000-000000000017', 'd0d00011-0000-4000-8000-000000000010', 'APPROVED',  'PUBLISHED', 'redaktion@demo.invalid',        8),

	-- Die Erstanlage, je Projekt eine Zeile (§3.12, §4.1: "Anlegen: - nach
	-- DRAFT"). Sie fehlte, und das war an Projekt 7 sofort zu sehen: als
	-- einziger reiner Entwurf hatte es dadurch gar keinen Verlauf, und bei
	-- den uebrigen neun begann er mitten im Ablauf. Kein Projekt sah damit
	-- so aus, wie die Anwendung es angelegt haette; ProjectWriteService
	-- .recordCreation schreibt genau diese Zeile mit from_status null.
	-- days ist jeweils das created_at des Projekts aus Abschnitt 2.
	('d0d00018-0000-4000-8000-000000000018', 'd0d00011-0000-4000-8000-000000000001', null, 'DRAFT', 'lena.brinkmann@demo.invalid', 160),
	('d0d00018-0000-4000-8000-000000000019', 'd0d00011-0000-4000-8000-000000000002', null, 'DRAFT', 'malte.focke@demo.invalid',    300),
	('d0d00018-0000-4000-8000-00000000001a', 'd0d00011-0000-4000-8000-000000000003', null, 'DRAFT', 'aylin.demir@demo.invalid',    150),
	('d0d00018-0000-4000-8000-00000000001b', 'd0d00011-0000-4000-8000-000000000004', null, 'DRAFT', 'timo.ahrens@demo.invalid',    280),
	('d0d00018-0000-4000-8000-00000000001c', 'd0d00011-0000-4000-8000-000000000005', null, 'DRAFT', 'jonas.petersen@demo.invalid', 120),
	('d0d00018-0000-4000-8000-00000000001d', 'd0d00011-0000-4000-8000-000000000006', null, 'DRAFT', 'sofia.kowalski@demo.invalid', 100),
	('d0d00018-0000-4000-8000-00000000001e', 'd0d00011-0000-4000-8000-000000000007', null, 'DRAFT', 'student@demo.invalid',         30),
	('d0d00018-0000-4000-8000-00000000001f', 'd0d00011-0000-4000-8000-000000000008', null, 'DRAFT', 'student@demo.invalid',        260),
	('d0d00018-0000-4000-8000-000000000020', 'd0d00011-0000-4000-8000-000000000009', null, 'DRAFT', 'jonas.petersen@demo.invalid', 480),
	('d0d00018-0000-4000-8000-000000000021', 'd0d00011-0000-4000-8000-000000000010', null, 'DRAFT', 'lena.brinkmann@demo.invalid',  60)
) as v(id, project_id, from_status, to_status, user_email, days)
join app_user u on u.email = v.user_email;

-- -------------------------------------------------------------------
-- 9) Dateizeilen.
--
--    path ist der anbieterneutrale Speicherschlüssel aus FileService:
--    projects/{projectId}/{uuid} für Projektdateien, avatars/{uuid}
--    für Profilbilder. Der Objektname ist hier gleich der Zeilen-ID;
--    die Anwendung vergibt dafür sonst eine eigene UUID, für Demodaten
--    ist die Gleichsetzung der einzige Weg, SQL und Begleitskript ohne
--    Nachschlagen in Deckung zu halten.
--
--    size ist gemessen und nicht geschätzt: FileController setzt
--    daraus den Content-Length der Antwort, eine falsche Zahl lässt
--    den Abruf abbrechen, ohne dass irgendwo ein Fehler sichtbar wird.
--    Schritt 3 dieses Skripts trägt die Werte nach dem Herunterladen
--    noch einmal nach, falls die Quelle ihr Bild neu kodiert hat.
--
--    project_id null heißt Avatar (§3.15): ein Profilbild gehört zu
--    einer Person und nicht zu einem Projekt.
-- -------------------------------------------------------------------
insert into stored_file (id, project_id, uploaded_by, file_name, mime_type, size, path, created_at)
select v.id::uuid, v.project_id::uuid, u.id, v.file_name, v.mime_type, v.size::bigint,
       case when v.project_id is null
            then 'avatars/' || v.id
            else 'projects/' || v.project_id || '/' || v.id end,
       now() - (v.days || ' days')::interval
from (values
	('d0d00012-0000-4000-8000-000000000001', null::text, 'lena-brinkmann.jpg', 'image/jpeg', 23017, 'lena.brinkmann@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000002', null::text, 'jonas-petersen.jpg', 'image/jpeg', 11406, 'jonas.petersen@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000003', null::text, 'aylin-demir.jpg', 'image/jpeg', 26584, 'aylin.demir@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000004', null::text, 'malte-focke.jpg', 'image/jpeg', 19417, 'malte.focke@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000005', null::text, 'sofia-kowalski.jpg', 'image/jpeg', 30259, 'sofia.kowalski@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000006', null::text, 'timo-ahrens.jpg', 'image/jpeg', 29920, 'timo.ahrens@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000007', null::text, 'claudia-vogt.jpg', 'image/jpeg', 17758, 'claudia.vogt@demo.invalid', 300),
	-- Profilbilder der drei Rollenkonten (KAN-99). Sie bekommen eines wie
	-- alle anderen: wer die Administrationsseite vorfuehrt, soll dort kein
	-- leeres Kreissymbol sehen. size ist ein Schaetzwert und wird von
	-- Schritt 3 nach dem Herunterladen durch den gemessenen ersetzt.
	('d0d00012-0000-4000-8000-000000000008', null::text, 'nele-reimers.jpg', 'image/jpeg', 20000, 'student@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000009', null::text, 'henrik-osterloh.jpg', 'image/jpeg', 20000, 'redaktion@demo.invalid', 300),
	('d0d00012-0000-4000-8000-00000000000a', null::text, 'britta-sandvoss.jpg', 'image/jpeg', 20000, 'admin@demo.invalid', 300),
	('d0d00012-0000-4000-8000-000000000010', 'd0d00011-0000-4000-8000-000000000001', 'lastenrad-station.jpg', 'image/jpeg', 292453, 'lena.brinkmann@demo.invalid', 155),
	('d0d00012-0000-4000-8000-000000000011', 'd0d00011-0000-4000-8000-000000000001', 'lastenrad-werkstatt.jpg', 'image/jpeg', 243737, 'lena.brinkmann@demo.invalid', 155),
	('d0d00012-0000-4000-8000-000000000012', 'd0d00011-0000-4000-8000-000000000001', 'lastenrad-transport.jpg', 'image/jpeg', 140241, 'lena.brinkmann@demo.invalid', 155),
	('d0d00012-0000-4000-8000-000000000013', 'd0d00011-0000-4000-8000-000000000001', 'lastenrad-schloss.jpg', 'image/jpeg', 143096, 'lena.brinkmann@demo.invalid', 155),
	('d0d00012-0000-4000-8000-000000000014', 'd0d00011-0000-4000-8000-000000000001', 'lastenrad-uebergabe.jpg', 'image/jpeg', 215035, 'lena.brinkmann@demo.invalid', 155),
	('d0d00012-0000-4000-8000-000000000020', 'd0d00011-0000-4000-8000-000000000002', 'weser-watt.jpg', 'image/jpeg', 279278, 'malte.focke@demo.invalid', 295),
	('d0d00012-0000-4000-8000-000000000021', 'd0d00011-0000-4000-8000-000000000002', 'weser-hydrofon.jpg', 'image/jpeg', 236907, 'malte.focke@demo.invalid', 295),
	('d0d00012-0000-4000-8000-000000000022', 'd0d00011-0000-4000-8000-000000000002', 'weser-messpunkt.jpg', 'image/jpeg', 209576, 'malte.focke@demo.invalid', 295),
	('d0d00012-0000-4000-8000-000000000023', 'd0d00011-0000-4000-8000-000000000002', 'weser-priel.jpg', 'image/jpeg', 116523, 'malte.focke@demo.invalid', 295),
	('d0d00012-0000-4000-8000-000000000024', 'd0d00011-0000-4000-8000-000000000002', 'tidenaufnahme-messpunkt-04.ogg', 'audio/ogg', 104793, 'malte.focke@demo.invalid', 295),
	('d0d00012-0000-4000-8000-000000000030', 'd0d00011-0000-4000-8000-000000000003', 'gewaechshaus-innen.jpg', 'image/jpeg', 246945, 'aylin.demir@demo.invalid', 145),
	('d0d00012-0000-4000-8000-000000000031', 'd0d00011-0000-4000-8000-000000000003', 'gewaechshaus-sensorik.jpg', 'image/jpeg', 288560, 'aylin.demir@demo.invalid', 145),
	('d0d00012-0000-4000-8000-000000000032', 'd0d00011-0000-4000-8000-000000000003', 'regelgueteprotokoll.pdf', 'application/pdf', 13264, 'aylin.demir@demo.invalid', 145),
	('d0d00012-0000-4000-8000-000000000040', 'd0d00011-0000-4000-8000-000000000004', 'bericht-kennzahlen.jpg', 'image/jpeg', 139304, 'timo.ahrens@demo.invalid', 275),
	('d0d00012-0000-4000-8000-000000000041', 'd0d00011-0000-4000-8000-000000000004', 'pruefraster-nachhaltigkeitsbericht.pdf', 'application/pdf', 18810, 'timo.ahrens@demo.invalid', 275),
	('d0d00012-0000-4000-8000-000000000050', 'd0d00011-0000-4000-8000-000000000005', 'tragwerk-modell.jpg', 'image/jpeg', 290653, 'jonas.petersen@demo.invalid', 115),
	('d0d00012-0000-4000-8000-000000000051', 'd0d00011-0000-4000-8000-000000000005', 'tragwerk-pruefstand.jpg', 'image/jpeg', 176871, 'jonas.petersen@demo.invalid', 115),
	('d0d00012-0000-4000-8000-000000000052', 'd0d00011-0000-4000-8000-000000000005', 'tragwerk-knoten.jpg', 'image/jpeg', 79762, 'jonas.petersen@demo.invalid', 115),
	('d0d00012-0000-4000-8000-000000000053', 'd0d00011-0000-4000-8000-000000000005', 'tragwerk-buche.jpg', 'image/jpeg', 205370, 'jonas.petersen@demo.invalid', 115),
	('d0d00012-0000-4000-8000-000000000054', 'd0d00011-0000-4000-8000-000000000005', 'tragwerk-montage.jpg', 'image/jpeg', 128886, 'jonas.petersen@demo.invalid', 115),
	('d0d00012-0000-4000-8000-000000000055', 'd0d00011-0000-4000-8000-000000000005', 'statischer-nachweis-buchenholz.pdf', 'application/pdf', 20597, 'jonas.petersen@demo.invalid', 115),
	('d0d00012-0000-4000-8000-000000000060', 'd0d00011-0000-4000-8000-000000000006', 'repaircafe-tisch.jpg', 'image/jpeg', 196684, 'sofia.kowalski@demo.invalid', 95),
	('d0d00012-0000-4000-8000-000000000061', 'd0d00011-0000-4000-8000-000000000006', 'repaircafe-loetkolben.jpg', 'image/jpeg', 240191, 'sofia.kowalski@demo.invalid', 95),
	('d0d00012-0000-4000-8000-000000000070', 'd0d00011-0000-4000-8000-000000000007', 'editor-werkstatt.jpg', 'image/jpeg', 273165, 'student@demo.invalid', 25),
	('d0d00012-0000-4000-8000-000000000080', 'd0d00011-0000-4000-8000-000000000008', 'exoskelett-hand.jpg', 'image/jpeg', 127209, 'student@demo.invalid', 255),
	('d0d00012-0000-4000-8000-000000000081', 'd0d00011-0000-4000-8000-000000000008', 'exoskelett-messkette.jpg', 'image/jpeg', 88131, 'student@demo.invalid', 255),
	('d0d00012-0000-4000-8000-000000000082', 'd0d00011-0000-4000-8000-000000000008', 'exoskelett-elektroden.jpg', 'image/jpeg', 67864, 'student@demo.invalid', 255),
	('d0d00012-0000-4000-8000-000000000083', 'd0d00011-0000-4000-8000-000000000008', 'probandenstudie-ablauf.mp4', 'video/mp4', 2848208, 'student@demo.invalid', 255),
	('d0d00012-0000-4000-8000-000000000084', 'd0d00011-0000-4000-8000-000000000008', 'studienprotokoll-zwoelf-probanden.pdf', 'application/pdf', 13264, 'student@demo.invalid', 255),
	('d0d00012-0000-4000-8000-000000000090', 'd0d00011-0000-4000-8000-000000000009', 'gebaeude-ab-fassade.jpg', 'image/jpeg', 66739, 'jonas.petersen@demo.invalid', 475),
	('d0d00012-0000-4000-8000-000000000091', 'd0d00011-0000-4000-8000-000000000009', 'gebaeude-ab-treppenhaus.jpg', 'image/jpeg', 177435, 'jonas.petersen@demo.invalid', 475),
	('d0d00012-0000-4000-8000-000000000092', 'd0d00011-0000-4000-8000-000000000009', 'gebaeude-ab-riss.jpg', 'image/jpeg', 65415, 'jonas.petersen@demo.invalid', 475),
	('d0d00012-0000-4000-8000-000000000093', 'd0d00011-0000-4000-8000-000000000009', 'gebaeude-ab-dach.jpg', 'image/jpeg', 176633, 'jonas.petersen@demo.invalid', 475),
	('d0d00012-0000-4000-8000-000000000094', 'd0d00011-0000-4000-8000-000000000009', 'gebaeude-ab-keller.jpg', 'image/jpeg', 54220, 'jonas.petersen@demo.invalid', 475),
	('d0d00012-0000-4000-8000-000000000095', 'd0d00011-0000-4000-8000-000000000009', 'begehungsprotokoll-gebaeude-ab.pdf', 'application/pdf', 18810, 'jonas.petersen@demo.invalid', 475),
	('d0d00012-0000-4000-8000-0000000000a0', 'd0d00011-0000-4000-8000-000000000010', 'foyer-wegefuehrung.jpg', 'image/jpeg', 96398, 'lena.brinkmann@demo.invalid', 55),
	('d0d00012-0000-4000-8000-0000000000a1', 'd0d00011-0000-4000-8000-000000000010', 'foyer-leitsystem.jpg', 'image/jpeg', 36385, 'lena.brinkmann@demo.invalid', 55),
	('d0d00012-0000-4000-8000-0000000000a2', 'd0d00011-0000-4000-8000-000000000010', 'foyer-piktogramm.jpg', 'image/jpeg', 127765, 'lena.brinkmann@demo.invalid', 55),
	('d0d00012-0000-4000-8000-0000000000a3', 'd0d00011-0000-4000-8000-000000000010', 'foyer-tastmodell.jpg', 'image/jpeg', 79312, 'lena.brinkmann@demo.invalid', 55),
	('d0d00012-0000-4000-8000-0000000000a4', 'd0d00011-0000-4000-8000-000000000010', 'foyer-hoerprobe-ansage.ogg', 'audio/ogg', 104793, 'lena.brinkmann@demo.invalid', 55)
) as v(id, project_id, file_name, mime_type, size, uploader_email, days)
join app_user u on u.email = v.uploader_email;

-- -------------------------------------------------------------------
-- 10) Kommentare.
--
--     status ist ausschließlich am CHANGE_REQUEST gesetzt (OPEN oder
--     RESOLVED), an NOTE und REPLY steht er auf null. Das ist keine
--     Nachlässigkeit, sondern Comment.java: ein CHANGE_REQUEST ohne
--     Erledigungsstatus wäre ein Arbeitsauftrag, den niemand abhaken
--     kann, ein REPLY mit Status ein Häkchen an einer Bemerkung.
--
--     Die offenen Änderungswünsche liegen am Projekt 8, und das steht
--     genau deshalb in REVISION. Die erledigten liegen an Projekten,
--     die inzwischen veröffentlicht sind: so war der Weg dorthin.
-- -------------------------------------------------------------------
insert into comment (id, project_id, author_id, type, text, status, created_at, updated_at)
select v.id::uuid, v.project_id::uuid, u.id, v.type, v.text, v.status,
       now() - (v.days || ' days')::interval,
       now() - (v.days || ' days')::interval
from (values
	('d0d00014-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000008',
	 'claudia.vogt@demo.invalid', 'CHANGE_REQUEST',
	 'Der Abschnitt zur Klassifikation nennt eine Genauigkeit von 94 Prozent, aber nicht, gegen welche Grundwahrheit gemessen wurde. Bitte ergänzen, wie die Bewegungsabsicht in der Studie festgehalten wurde.',
	 'OPEN', 40),
	('d0d00014-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000008',
	 'claudia.vogt@demo.invalid', 'CHANGE_REQUEST',
	 'Den beiden Bildern in der Galerie fehlt ein Alternativtext, der den Aufbau beschreibt. „Foto 1" und „Foto 2" reichen nicht, wer sich den Beitrag vorlesen lässt, erfährt damit nichts.',
	 'OPEN', 40),
	('d0d00014-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000008',
	 'student@demo.invalid', 'REPLY',
	 'Die Grundwahrheit kam aus dem Handschuh mit Biegesensoren, den wir parallel mitlaufen ließen. Ich ergänze den Absatz und schiebe die Abbildung dazu nach.',
	 null, 38),
	('d0d00014-0000-4000-8000-000000000004', 'd0d00011-0000-4000-8000-000000000006',
	 'redaktion@demo.invalid', 'NOTE',
	 'Schöner Beitrag, ich lese ihn diese Woche vollständig gegen. Erster Eindruck: die Tabelle mit den Gerätearten trägt den Text.',
	 null, 8),
	('d0d00014-0000-4000-8000-000000000005', 'd0d00011-0000-4000-8000-000000000001',
	 'claudia.vogt@demo.invalid', 'CHANGE_REQUEST',
	 'Die Zahl der Ausleihen steht einmal im Vorspann und einmal in der Tabelle, und beide Stellen nennen etwas Anderes. Bitte angleichen.',
	 'RESOLVED', 106),
	('d0d00014-0000-4000-8000-000000000006', 'd0d00011-0000-4000-8000-000000000001',
	 'lena.brinkmann@demo.invalid', 'REPLY',
	 'Stimmt, im Vorspann stand noch der Stand von Dezember. Beide Stellen zeigen jetzt 312.',
	 null, 105),
	('d0d00014-0000-4000-8000-000000000007', 'd0d00011-0000-4000-8000-000000000002',
	 'redaktion@demo.invalid', 'CHANGE_REQUEST',
	 'Bitte die Herkunft der Hörprobe angeben: Messpunkt, Datum und Tidephase. Ohne das ist die Aufnahme nicht einzuordnen.',
	 'RESOLVED', 224),
	('d0d00014-0000-4000-8000-000000000008', 'd0d00011-0000-4000-8000-000000000005',
	 'claudia.vogt@demo.invalid', 'NOTE',
	 'Freigegeben. Für die Veröffentlichung warte ich noch auf die Freigabe der Fotos aus dem Prüflabor.',
	 null, 26),
	('d0d00014-0000-4000-8000-000000000009', 'd0d00011-0000-4000-8000-000000000009',
	 'sofia.kowalski@demo.invalid', 'NOTE',
	 'Die Bildunterschriften habe ich für alle Befunde im Keller nachgetragen.',
	 null, 405),
	('d0d00014-0000-4000-8000-00000000000a', 'd0d00011-0000-4000-8000-000000000010',
	 'redaktion@demo.invalid', 'NOTE',
	 'Das tastbare Modell ist der stärkste Teil des Beitrags. Ich habe den Abschnitt in der Reihenfolge nach vorne vorgeschlagen, die Entscheidung liegt bei euch.',
	 null, 16)
) as v(id, project_id, author_email, type, text, status, days)
join app_user u on u.email = v.author_email;

-- -------------------------------------------------------------------
-- 11) Reaktionen.
--
--     Nur an veröffentlichten Beiträgen: davor sieht sie niemand
--     außerhalb des Projekts, und ein Beifall an einem Entwurf wäre
--     ein Datensatz ohne Vorgang.
--
--     Die beiden Zeilen 05 und 11 trugen ursprünglich das Konto
--     omar@gmail.com. Nach dem Umbiegen auf student@demo.invalid wären
--     sie Dubletten geworden: dieses Konto reagiert an denselben beiden
--     Beiträgen schon in Zeile 04 und 10, und reaction ist eindeutig
--     über (project_id, user_id). Sie tragen deshalb claudia.vogt, das
--     einzige der sieben neuen Konten, das an keinem der beiden
--     Beiträge schon reagiert.
-- -------------------------------------------------------------------
insert into reaction (id, project_id, user_id, created_at)
select v.id::uuid, v.project_id::uuid, u.id, now() - (v.days || ' days')::interval
from (values
	('d0d00015-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000001', 'jonas.petersen@demo.invalid', 90),
	('d0d00015-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000001', 'sofia.kowalski@demo.invalid', 88),
	('d0d00015-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000001', 'malte.focke@demo.invalid',    77),
	('d0d00015-0000-4000-8000-000000000004', 'd0d00011-0000-4000-8000-000000000001', 'student@demo.invalid',        61),
	('d0d00015-0000-4000-8000-000000000005', 'd0d00011-0000-4000-8000-000000000001', 'claudia.vogt@demo.invalid',   44),
	('d0d00015-0000-4000-8000-000000000006', 'd0d00011-0000-4000-8000-000000000002', 'lena.brinkmann@demo.invalid', 200),
	('d0d00015-0000-4000-8000-000000000007', 'd0d00011-0000-4000-8000-000000000002', 'aylin.demir@demo.invalid',    185),
	('d0d00015-0000-4000-8000-000000000008', 'd0d00011-0000-4000-8000-000000000002', 'timo.ahrens@demo.invalid',    140),
	('d0d00015-0000-4000-8000-000000000009', 'd0d00011-0000-4000-8000-000000000003', 'jonas.petersen@demo.invalid',  70),
	('d0d00015-0000-4000-8000-00000000000a', 'd0d00011-0000-4000-8000-000000000003', 'lena.brinkmann@demo.invalid',  66),
	('d0d00015-0000-4000-8000-00000000000b', 'd0d00011-0000-4000-8000-000000000004', 'sofia.kowalski@demo.invalid', 170),
	('d0d00015-0000-4000-8000-00000000000c', 'd0d00011-0000-4000-8000-000000000009', 'aylin.demir@demo.invalid',    380),
	('d0d00015-0000-4000-8000-00000000000d', 'd0d00011-0000-4000-8000-000000000009', 'timo.ahrens@demo.invalid',    350),
	('d0d00015-0000-4000-8000-00000000000e', 'd0d00011-0000-4000-8000-000000000010', 'malte.focke@demo.invalid',      6),
	('d0d00015-0000-4000-8000-00000000000f', 'd0d00011-0000-4000-8000-000000000010', 'aylin.demir@demo.invalid',      5),
	('d0d00015-0000-4000-8000-000000000010', 'd0d00011-0000-4000-8000-000000000010', 'student@demo.invalid',          3),
	('d0d00015-0000-4000-8000-000000000011', 'd0d00011-0000-4000-8000-000000000010', 'claudia.vogt@demo.invalid',     2)
) as v(id, project_id, user_email, days)
join app_user u on u.email = v.user_email;

-- -------------------------------------------------------------------
-- 12) Top-10: Nominierungen und die Liste selbst.
--
--     Nominiert wird eine Stufe und kein Platz (NominationTier seit
--     Contract v68): TOP_1, TOP_5 oder TOP_10. Den Platz vergibt erst
--     die Administration beim Aufnehmen.
--
--     Nur veröffentlichte Projekte, in beiden Tabellen: ein Eintrag,
--     dessen Projekt nicht PUBLISHED ist, belegt einen Platz, den
--     niemand sieht, und die Anwendung entzieht ihn beim nächsten
--     Statuswechsel ohnehin.
--
--     Der Bestand deckt alle vier Nominierungsstatus ab, damit die
--     Redaktionsansicht nicht nur den angenommenen Fall zeigt.
-- -------------------------------------------------------------------
insert into top10_nomination (
	id, project_id, nominated_by, proposed_tier, proposed_position,
	status, decided_by, decided_at, created_at
)
select v.id::uuid, v.project_id::uuid, n.id, v.tier, v.position::integer,
       v.status, d.id,
       case when v.decided_days is not null
            then now() - (v.decided_days || ' days')::interval end,
       now() - (v.days || ' days')::interval
from (values
	('d0d00017-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000001',
	 'claudia.vogt@demo.invalid', 'TOP_1',  null, 'ACCEPTED',
	 'admin@demo.invalid', '84', 90),
	('d0d00017-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000009',
	 'claudia.vogt@demo.invalid', 'TOP_5',  null, 'ACCEPTED',
	 'admin@demo.invalid', '360', 372),
	('d0d00017-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000002',
	 'redaktion@demo.invalid', 'TOP_5', null, 'ACCEPTED',
	 'admin@demo.invalid', '196', 205),
	('d0d00017-0000-4000-8000-000000000004', 'd0d00011-0000-4000-8000-000000000010',
	 'redaktion@demo.invalid', 'TOP_10', null, 'PENDING',
	 null, null, 6),
	('d0d00017-0000-4000-8000-000000000005', 'd0d00011-0000-4000-8000-000000000003',
	 'claudia.vogt@demo.invalid', 'TOP_1',  null, 'REJECTED',
	 'admin@demo.invalid', '72', 78),
	-- Zurueckziehen ist eine Entscheidung und kein Loeschen (§3.11.1 seit
	-- v70): der Vorgang schreibt decided_by und decided_at wie jeder andere
	-- Abschluss auch. Beide standen hier auf null, und diesen Zustand kann
	-- keiner der Wege im Programm erzeugen. Zurueck zieht die nominierende
	-- Person ihren eigenen offenen Vorschlag, also redaktion@demo.invalid.
	('d0d00017-0000-4000-8000-000000000006', 'd0d00011-0000-4000-8000-000000000004',
	 'redaktion@demo.invalid', 'TOP_10', null, 'WITHDRAWN',
	 'redaktion@demo.invalid', '175', 180)
) as v(id, project_id, nominator_email, tier, position, status,
       decider_email, decided_days, days)
join app_user n on n.email = v.nominator_email
left join app_user d on d.email = v.decider_email;

insert into top10_entry (id, project_id, position, added_at)
select v.id::uuid, v.project_id::uuid, v.position::integer,
       now() - (v.days || ' days')::interval
from (values
	('d0d00016-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000001', 1, 84),
	('d0d00016-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000002', 2, 196),
	('d0d00016-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000009', 3, 360)
) as v(id, project_id, position, days);

-- -------------------------------------------------------------------
-- 13) Prüfspur der Top-10.
--
--     Sie hängt nur lose am Projekt (on delete set null) und überlebt
--     dessen Löschung bewusst: die Spur soll erhalten bleiben, auch
--     wenn der Gegenstand verschwindet. Deshalb räumt Abschnitt 0 sie
--     ausdrücklich über ihr eigenes Präfix weg.
-- -------------------------------------------------------------------
insert into top10_audit_entry (
	id, timestamp, admin_id, project_id, action, previous_position, new_position
)
select v.id::uuid, now() - (v.days || ' days')::interval, a.id, v.project_id::uuid,
       v.action, v.previous_position::integer, v.new_position::integer
from (values
	('d0d0001a-0000-4000-8000-000000000001', 'd0d00011-0000-4000-8000-000000000009',
	 'ADDED',     null, '1', 360),
	('d0d0001a-0000-4000-8000-000000000002', 'd0d00011-0000-4000-8000-000000000002',
	 'ADDED',     null, '2', 196),
	('d0d0001a-0000-4000-8000-000000000003', 'd0d00011-0000-4000-8000-000000000001',
	 'ADDED',     null, '3', 84),
	('d0d0001a-0000-4000-8000-000000000004', 'd0d00011-0000-4000-8000-000000000001',
	 'REORDERED', '3',  '1', 82),
	('d0d0001a-0000-4000-8000-000000000005', 'd0d00011-0000-4000-8000-000000000009',
	 'REORDERED', '1',  '3', 82)
) as v(id, project_id, action, previous_position, new_position, days)
cross join (select id from app_user where email = 'admin@demo.invalid') as a;

-- -------------------------------------------------------------------
-- 14) Der Hinweis, dass dies Demodaten sind (KAN-99)
--
--     WARUM DAS SEIN MUSS. Die Beiträge tragen erfundene Personen mit
--     Hochschulbezug: Lena Brinkmann, Jonas Petersen, Aylin Demir und so
--     weiter. Auf einer öffentlich erreichbaren Seite, die Namen und
--     Bildmarke der Hochschule Bremen trägt, ist ohne Hinweis nicht
--     erkennbar, dass keine dieser Personen und keines dieser Projekte
--     existiert. Der Prototyp-Hinweis im Impressum (KAN-100) genügt
--     dafür nicht: ihn sieht nicht, wer auf der Startseite landet.
--
--     WARUM ÜBER site_content UND NICHT ÜBER EINEN NEUEN BAUSTEIN. Die
--     Startseitenpflege aus KAN-90 kann genau das, ohne Codeänderung.
--     Ein eigener Hinweisbaustein bräuchte einen neuen content_key, also
--     eine Migration am ck_site_content_key und einen Nachtrag in §3.21;
--     das wäre eine Änderung am Programm, um Demodaten zu kennzeichnen.
--
--     BEIDE SPRACHEN. Ein fehlender Eintrag heißt "hier gilt die
--     mitgelieferte Fassung": stünde nur der deutsche Text, sähe die
--     englische Ansicht den unveränderten Vorgabetext und damit keinen
--     Hinweis (§2.5, WCAG 2.2 SC 3.1.2).
--
--     DER GELIEFERTE SATZ BLEIBT STEHEN, der Hinweis kommt dahinter.
--     Der Untertitel der Lieferung sagt, was das Portal ist
--     ("Abschlussarbeiten, Projekte und Forschung aus allen
--     Fakultäten …"); wer ihn durch den Hinweis ersetzt, nimmt der
--     Startseite ihre Beschreibung, um eine Warnung unterzubringen.
--     Beides passt nebeneinander und bleibt weit unter den 1000
--     Zeichen, die SiteContentEntryRequest zulässt. Diese Grenze ist
--     einzuhalten, obwohl die Spalte "text" ist: ein längerer Wert
--     liesse sich über die Pflegemaske laden, aber nicht mehr
--     speichern (400 VALIDATION_FAILED).
--
--     Die englische Auszeichnung schreibt "e-portfolio" klein, weil die
--     Sprachdatei der Lieferung es so schreibt. Der Hinweis soll wie
--     ein gepflegter Text aussehen und nicht wie ein fremder Eingriff.
--
--     on conflict, weil beides sein kann: die Zeilen sind oben über den
--     Präfix gelöscht worden, eine von Hand gepflegte Fassung mit
--     zufälliger UUID aber nicht. uq_site_content_key_locale lässt nur
--     eine Fassung je Stelle und Sprache zu, und dieser Lauf soll sie
--     setzen und nicht an ihr scheitern.
--
--     WARUM AUCH DIE ID ÜBERSCHRIEBEN WIRD. Ohne "set id = excluded.id"
--     behielte eine von Hand gepflegte Zeile ihre zufällige UUID. Sie
--     trüge dann zwar den Demohinweis, läge aber außerhalb des Präfixes,
--     und demo-daten-raeumen.sh fände sie nicht mehr: nach dem Räumen
--     stünde auf der Startseite weiter "alle gezeigten Projekte sind
--     erfunden", obwohl gar keine Projekte mehr da sind. Der Preis ist,
--     dass eine gepflegte Fassung beim Räumen mitgeht; die Stelle fällt
--     dann auf den ausgelieferten Text zurück. Das ist der bessere
--     Ausgang von beiden.
-- -------------------------------------------------------------------
insert into site_content (id, content_key, locale, value)
values
	('d0d0001b-0000-4000-8000-000000000001', 'HOME_HERO_LABEL', 'de',
	 'HSB · E-Portfolio · Demodaten'),
	('d0d0001b-0000-4000-8000-000000000002', 'HOME_HERO_LABEL', 'en',
	 'HSB · e-portfolio · demo data'),
	('d0d0001b-0000-4000-8000-000000000003', 'HOME_HERO_SUBTITLE', 'de',
	 'Abschlussarbeiten, Projekte und Forschung aus allen Fakultäten der Hochschule Bremen, an einem Ort. Hinweis: Dies ist eine öffentliche Vorführung. Alle gezeigten Projekte, Namen und Profile sind erfunden und stehen für keine realen Personen und keine realen Arbeiten der Hochschule Bremen.'),
	('d0d0001b-0000-4000-8000-000000000004', 'HOME_HERO_SUBTITLE', 'en',
	 'Theses, projects and research from all faculties of Hochschule Bremen, in one place. Please note: this is a public demonstration. All projects, names and profiles shown are fictitious and do not represent real people or real work at Hochschule Bremen.')
on conflict (content_key, locale) do update
	set id = excluded.id, value = excluded.value;

commit;

-- -------------------------------------------------------------------
-- Kurze Gegenprobe.
-- -------------------------------------------------------------------
select 'Nutzer'      as bestand, count(*) from app_user   where id::text like 'd0d00010-%'
union all select 'Projekte',     count(*) from project    where id::text like 'd0d00011-%'
union all select 'Dateizeilen',  count(*) from stored_file where id::text like 'd0d00012-%'
union all select 'Mitglieder',   count(*) from project_member where id::text like 'd0d00019-%'
union all select 'Kommentare',   count(*) from comment    where id::text like 'd0d00014-%'
union all select 'Reaktionen',   count(*) from reaction   where id::text like 'd0d00015-%';
ENDE_SQL_STAMMDATEN
echo

# -------------------------------------------------------------------
# 2) Die Inhaltsbloecke.
# -------------------------------------------------------------------
echo "== 2/4  Inhaltsbloecke (alle 15 Blocktypen) =="
sql -f - <<'ENDE_SQL_BLOECKE'
-- ===================================================================
-- Demodaten, Teil 2: die Inhaltsblöcke der zehn Projekte.
--
-- Setzt Schritt 1 dieses Skripts voraus (die Projekte müssen stehen).
--
-- Alle fünfzehn Blocktypen aus BlockType kommen vor, die meisten
-- mehrfach:
--
--   HEADING TEXT LIST QUOTE CODE FORMULA TABLE DIVIDER
--   IMAGE GALLERY VIDEO AUDIO DOCUMENT EMBED TABLE_OF_CONTENTS
--
-- Dazu die Fälle, die sich sonst nur schwer von Hand herstellen
-- lassen: beide Listenarten (bulletList und orderedList), VIDEO in
-- beiden Quellvarianten (hochgeladene Datei und Einbettung), alle vier
-- Embed-Anbieter (codepen, youtube, figma, vimeo) und die zehn Marks
-- aus Contract §2.5.
--
-- Der Inhalt ist genau ein Top-Level-Knoten des ProseMirror-Dokuments
-- und wird unverändert gespeichert; type ist die abfragbare Projektion
-- von content.type. Was hier steht, muss durch BlockValidationService
-- passen, denn der Editor schickt es beim nächsten Speichern durch
-- genau diese Prüfung zurück. Die Fallstricke, an denen das sonst
-- scheitert:
--
--   * HEADING trägt attrs.level 1 bis 6 und meint die Gliederung des
--     Beitrags, nicht das HTML-Element: Ebene 1 der Seite ist der
--     Projekttitel, die Anzeige schiebt jede Ebene um eine Stufe.
--   * IMAGE und VIDEO kennen attrs.width nur als 100, 75 oder 50.
--   * GALLERY führt attrs.items als Array aus { fileId, alt } und
--     kein attrs.fileIds; ein leeres alt heißt schmückend, ein
--     fehlendes ist ein Fehler.
--   * VIDEO trägt entweder attrs.fileId oder attrs.provider mit
--     attrs.videoId, nie beides, und niemals eine URL.
--   * AUDIO kennt nur die hochgeladene Datei, kein attrs.src.
--   * EMBED braucht Anbieter und passende embedUrl: bei youtube den
--     Pfad /embed/{id} und nicht die Zuschauerseite /watch.
--   * Marks gibt es nur in HEADING, TEXT, LIST, QUOTE und TABLE, und
--     textStyle wie highlight führen einen Rollennamen als Farbe, nie
--     einen Hex-Wert.
--   * TABLE_OF_CONTENTS gibt es höchstens einmal je Projekt; sein
--     index ist die laufende Nummer der Überschrift in
--     Dokumentreihenfolge, ab 0 gezählt.
--
-- schema_version ist 3, der Wert aus BlockSchemaMigration.CURRENT_VERSION.
-- Eine kleinere Zahl liefe beim ersten Lesen durch die Aufwärtsmigration
-- und schriebe den Block beim nächsten Speichern um.
-- ===================================================================

begin;

-- Vorigen Lauf entfernen. Die Blöcke hängen zwar per on delete cascade
-- am Projekt, aber dieses Skript lässt sich auch für sich allein noch
-- einmal laufen, ohne die Projekte anzufassen.
delete from block where project_id::text like 'd0d00011-%';

-- -------------------------------------------------------------------
-- Projekt 1: Lastenrad-Sharing am Campus Neustadtswall (PUBLISHED)
--
-- Zeigt: TABLE_OF_CONTENTS, HEADING, TEXT mit bold und link, IMAGE,
-- LIST (bulletList), TABLE, QUOTE, DIVIDER, GALLERY, VIDEO als
-- youtube-Einbettung, EMBED über codepen.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000001'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '155 days', now() - interval '96 days'
from (values
(0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Warum vier Räder und nicht vierzig","index":0},{"level":2,"text":"Was gebaut wurde","index":1},{"level":2,"text":"Was die Zahlen sagen","index":2},{"level":2,"text":"Bilder aus dem Betrieb","index":3}]}}'),
(1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Warum vier Räder und nicht vierzig"}]}'),
(2, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Neustadtswall liegt zwischen zwei Bahnhöfen und einer Bundesstraße, und wer hier etwas Sperriges transportieren will, nimmt das Auto. Das Semesterprojekt begann mit der Vermutung, dass ein Teil dieser Fahrten auf ein Lastenrad passt. Statt einer Umfrage haben wir "},{"type":"text","marks":[{"type":"bold"}],"text":"vier Räder gekauft und sie ein Semester lang verliehen"},{"type":"text","text":". Die Zahlen weiter unten stammen aus den Buchungen selbst und nicht aus Absichtserklärungen. Die Beschaffung lief über die "},{"type":"text","marks":[{"type":"link","attrs":{"href":"https://www.hs-bremen.de/","target":"_blank","rel":"noopener noreferrer"}}],"text":"Hochschule Bremen"},{"type":"text","text":"."}]}'),
(3, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000011","alt":"Werkstattraum mit einem aufgebockten Lastenrad, Werkzeug an der Wand","caption":"Die Wartung lief in der Fahrradwerkstatt der Hochschule, alle vierzehn Tage","width":100}}'),
(4, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was gebaut wurde"}]}'),
(5, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Eine überdachte Station mit vier Stellplätzen und einem Ladepunkt für die beiden Pedelecs"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Eine Buchung über den Browser, ohne Konto, mit Freischaltung per Hochschulkennung"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ein Zahlenschloss je Rad, dessen Code sich mit jeder Buchung ändert"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ein Wartungsplan, der alle vierzehn Tage zwei Stunden kostet und von zwei Personen getragen wird"}]}]}]}'),
(6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die erste Fassung der Buchung verlangte ein Konto. Sie ist an der Anmeldung gescheitert, nicht an der Technik: von 41 Personen, die den Buchungsvorgang begonnen haben, sind 12 angekommen. Die zweite Fassung kommt ohne Konto aus und prüft erst beim Abholen."}]}'),
(7, 'TABLE', '{"type":"table","attrs":{"caption":"Ausleihen und durchschnittliche Dauer je Monat"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Monat"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Ausleihen"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Dauer im Mittel"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Abbrüche"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Oktober"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"38"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"3 h 10 min"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"9"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"November"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"52"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"2 h 55 min"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"4"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Dezember"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"61"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"4 h 20 min"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"2"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Januar"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"74"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"3 h 05 min"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"3"}]}]}]}]}'),
(8, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was die Zahlen sagen"}]}'),
(9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"312 Ausleihen in einem Semester, verteilt auf 138 Personen. Die häufigste Strecke war nicht die erwartete Fahrt zum Baumarkt, sondern "},{"type":"text","marks":[{"type":"highlight","attrs":{"color":"amber"}}],"text":"der Umzug innerhalb desselben Stadtteils"},{"type":"text","text":". Auffällig ist die Dauer: die Räder sind im Mittel gut drei Stunden unterwegs, aber "},{"type":"text","marks":[{"type":"textStyle","attrs":{"color":"blue"}},{"type":"italic"}],"text":"nur 40 Minuten davon in Bewegung"},{"type":"text","text":". Wer ein Lastenrad leiht, plant den ganzen Nachmittag darum herum."}]}'),
(10, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Ich hätte nie gedacht, dass ich einen Kühlschrank mit dem Fahrrad hole. Es war schneller als der Transporter, weil ich nirgends parken musste."}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"Rückmeldung aus der Abschlussbefragung, Januar"}]}]}'),
(11, 'DIVIDER', '{"type":"horizontalRule"}'),
(12, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Bilder aus dem Betrieb"}]}'),
(13, 'GALLERY', '{"type":"galleryBlock","attrs":{"items":[{"fileId":"d0d00012-0000-4000-8000-000000000012","alt":"Beladenes Lastenrad mit Umzugskartons auf einer Straße"},{"fileId":"d0d00012-0000-4000-8000-000000000013","alt":"Zahlenschloss am Rahmen eines Lastenrads, Nahaufnahme"},{"fileId":"d0d00012-0000-4000-8000-000000000014","alt":"Zwei Personen bei der Übergabe eines Rads an der Station"}],"columns":3,"caption":"Transport, Schloss und Übergabe: die drei Stellen, an denen es klemmt"}}'),
(14, 'VIDEO', '{"type":"videoBlock","attrs":{"provider":"youtube","videoId":"aqz-KE-bpKQ","caption":"Zusammenschnitt der Aufbauwoche","width":75}}'),
(15, 'EMBED', '{"type":"embedBlock","attrs":{"provider":"codepen","embedUrl":"https://codepen.io/codepen/embed/PNaGbb","height":460}}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 2: Tideklänge, ein Hörarchiv der Unterweser (PUBLISHED)
--
-- Zeigt: TABLE_OF_CONTENTS, LIST als orderedList, AUDIO aus einer
-- hochgeladenen Datei, FORMULA, CODE, GALLERY mit zwei Spalten.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000002'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '295 days', now() - interval '210 days'
from (values
(0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Ein Jahr an vier Messpunkten","index":0},{"level":2,"text":"Der Aufbau","index":1},{"level":2,"text":"Was sich über das Jahr ändert","index":2}]}}'),
(1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Ein Jahr an vier Messpunkten"}]}'),
(2, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Watt ist nicht still. Es knistert, und zwar messbar: Wattschnecken, Krebse und ausströmende Luft aus dem Sediment ergeben ein Geräusch, dessen Pegel sich mit der Tide ändert. Für dieses Archiv haben wir ein Jahr lang an vier Punkten der Unterweser aufgenommen, jeweils "},{"type":"text","marks":[{"type":"bold"}],"text":"40 Minuten nach Niedrigwasser"},{"type":"text","text":", damit die Aufnahmen vergleichbar bleiben."}]}'),
(3, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000021","alt":"Hydrofon an einer Leine, im Hintergrund eine Wasserfläche","caption":"Das Hydrofon hängt an einem Gestell 20 Zentimeter über dem Sediment","width":75}}'),
(4, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Der Aufbau"}]}'),
(5, 'LIST', '{"type":"orderedList","attrs":{"start":1},"content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Hydrofon an einem Gestell, 20 Zentimeter über dem Sediment, damit es nicht einsinkt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vorverstärker mit fester Verstärkung, weil eine automatische Aussteuerung die Pegel unvergleichbar macht"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Aufnahme in 48 kHz und 24 Bit auf einen Rekorder mit externer Batterie"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kalibrierung vor und nach jedem Termin mit einem Pistonfon"}]}]}]}'),
(6, 'AUDIO', '{"type":"audioBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000024","caption":"Messpunkt 04, 40 Minuten nach Niedrigwasser, Aufnahme vom 12. Juni. Das Knistern stammt von Wattschnecken."}}'),
(7, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was sich über das Jahr ändert"}]}'),
(8, 'FORMULA', '{"type":"mathBlock","attrs":{"latex":"L_{p} = 20 \\cdot \\log_{10}\\left(\\frac{p_{\\mathrm{rms}}}{p_{0}}\\right), \\quad p_{0} = 1\\,\\mu\\mathrm{Pa}"}}'),
(9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Bezugsdruck ist der für Wasserschall übliche, also 1 μPa und nicht der Luftschallwert. Wer die Zahlen mit Angaben aus der Luftakustik vergleicht, liegt um 26 dB daneben. Die Auswertung läuft über ein kurzes Skript, das die Terzbänder bildet und den Median je Termin nimmt."}]}'),
(10, 'CODE', '{"type":"codeBlock","attrs":{"language":"python"},"content":[{"type":"text","text":"def terzpegel(signal, fs=48000, p0=1e-6):\n    bands = terzband_filter(signal, fs)\n    rms = np.sqrt(np.mean(bands ** 2, axis=0))\n    return 20 * np.log10(rms / p0)\n\n\ndef median_je_termin(termine):\n    return {t.name: np.median(terzpegel(t.signal)) for t in termine}"}]}'),
(11, 'GALLERY', '{"type":"galleryBlock","attrs":{"items":[{"fileId":"d0d00012-0000-4000-8000-000000000022","alt":"Markierter Messpunkt im Watt mit Stange und Nummernschild"},{"fileId":"d0d00012-0000-4000-8000-000000000023","alt":"Wasserführender Priel bei ablaufendem Wasser"}],"columns":2,"caption":"Messpunkt 02 links, der Priel bei Messpunkt 04 rechts"}}'),
(12, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Man hört den Unterschied zwischen Juni und Januar sofort, auch ohne die Pegel zu sehen. Im Winter ist es fast leer."}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"Anmerkung aus der Begutachtung im Modul Ökologie"}]}]}'),
(13, 'DIVIDER', '{"type":"horizontalRule"}'),
(14, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die vollständigen Aufnahmen liegen im Archiv des Studiengangs. Wer damit weiterarbeiten will, braucht die Kalibrierprotokolle dazu: ohne sie sind die Pegel Zahlen ohne Einheit."}]}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 3: Gewächshaus im Regelkreis (PUBLISHED)
--
-- Zeigt: VIDEO als vimeo-Einbettung, DOCUMENT, FORMULA, CODE in C,
-- TABLE ohne Bildunterschrift.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000003'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '145 days', now() - interval '80 days'
from (values
(0, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Von der Zeitschaltuhr zum Regler"}]}'),
(1, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Versuchsgewächshaus wurde bis zu diesem Projekt gesteuert und nicht geregelt: die Lüftung lief nach Uhrzeit, die Bewässerung nach Zeitplan. An sonnigen Apriltagen stand die Temperatur deshalb regelmäßig 8 K über dem Sollwert, an bedeckten Julitagen 4 K darunter. Ein Regelkreis braucht dafür keine neue Hardware, sondern nur Messwerte, denen man trauen kann."}]}'),
(2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000031","alt":"Sensorplatine mit Anschlussklemmen in einem wettergeschützten Gehäuse","caption":"Ein Messknoten je Beet: Temperatur, relative Feuchte, Bodenfeuchte und CO2","width":75}}'),
(3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Die Regelstrecke"}]}'),
(4, 'FORMULA', '{"type":"mathBlock","attrs":{"latex":"G(s) = \\frac{K}{(1 + T_{1}s)(1 + T_{2}s)}\\,e^{-T_{t}s}"}}'),
(5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Strecke ist träge und hat eine spürbare Totzeit: zwischen dem Öffnen der Firstlüftung und der ersten messbaren Reaktion vergehen gut vier Minuten. Ein reiner P-Regler bliebe damit dauerhaft neben dem Sollwert, ein zu schneller I-Anteil bringt die Lüftung ins Pendeln. Die Parameter stammen aus einer Sprungantwort und wurden danach am Bestand nachgezogen."}]}'),
(6, 'CODE', '{"type":"codeBlock","attrs":{"language":"c"},"content":[{"type":"text","text":"float pi_regler(float soll, float ist, float dt) {\n    static float integral = 0.0f;\n    const float Kp = 1.8f, Ki = 0.045f;\n\n    float e = soll - ist;\n    integral += e * dt;\n\n    /* Anti-Windup: ohne die Begrenzung laeuft der I-Anteil waehrend\n       einer geschlossenen Lueftung ueber und braucht danach Minuten,\n       um sich wieder abzubauen. */\n    if (integral > 60.0f)  integral = 60.0f;\n    if (integral < -60.0f) integral = -60.0f;\n\n    return Kp * e + Ki * integral;\n}"}]}'),
(7, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Ergebnisse aus acht Wochen"}]}'),
(8, 'TABLE', '{"type":"table","attrs":{"caption":"Abweichung vom Sollwert, Zeitschaltuhr gegen Regler"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Größe"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Vorher"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Nachher"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Temperatur, mittlere Abweichung"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"3,4 K"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"0,8 K"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Bodenfeuchte unter Grenzwert"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"31 Stunden"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"4 Stunden"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Wasserverbrauch je Woche"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"420 l"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"318 l"}]}]}]}]}'),
(9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Totzeit ist der begrenzende Faktor, nicht die Rechenleistung des Knotens"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ein Sensor je Beet reicht nicht: die Bodenfeuchte streut über die Beetlänge um mehr als der Regler ausgleichen kann"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Anti-Windup-Begrenzung war die wirksamste einzelne Änderung im ganzen Projekt"}]}]}]}'),
-- Anbieter youtube und nicht vimeo (KAN-99): der erzeugte Demobestand
-- kommt ohne Figma und Vimeo aus. Das betrifft NUR diese Daten; die
-- Allowlist in BlockValidationService fuehrt beide Anbieter unveraendert
-- weiter (Contract §2.5), Studierende koennen sie also nach wie vor
-- einbetten. youtube ist fuer einen VIDEO-Block der einzige zulaessige
-- Ersatz: VIDEO_PROVIDERS kennt nur youtube und vimeo.
--
-- Ersetzt und nicht gestrichen, damit der order_index lueckenlos bleibt.
-- Eine Luecke waere kein Schoenheitsfehler: der Server lehnt danach jedes
-- Speichern dieses Beitrags ab, und das faellt erst auf, wenn jemand ihn
-- im Editor oeffnet und etwas aendert.
(10, 'VIDEO', '{"type":"videoBlock","attrs":{"provider":"youtube","videoId":"aqz-KE-bpKQ","caption":"Die Firstlüftung im Regelbetrieb, Zeitraffer über einen Tag","width":100}}'),
(11, 'DOCUMENT', '{"type":"documentBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000032","fileName":"regelgueteprotokoll.pdf","size":13264,"caption":"Regelgüteprotokoll über acht Wochen, mit allen Sprungantworten"}}'),
(12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Aufbau läuft seit dem Ende des Projekts unverändert weiter. Die einzige Nacharbeit betraf die Kalibrierung der CO2-Sensoren, die nach etwa einem halben Jahr sichtbar driften."}]}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 4: Nachhaltigkeitsberichte ohne Nebelkerzen (PUBLISHED)
--
-- Zeigt: TABLE_OF_CONTENTS, superscript und subscript, EMBED über
-- youtube (Pfad /embed/, nicht die Zuschauerseite), DOCUMENT.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000004'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '275 days', now() - interval '190 days'
from (values
(0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Vierzig Berichte, zwölf Fragen","index":0},{"level":2,"text":"Das Prüfraster","index":1},{"level":2,"text":"Befunde","index":2}]}}'),
(1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Vierzig Berichte, zwölf Fragen"}]}'),
(2, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Seit der Berichtspflicht schreiben auch mittelständische Unternehmen Nachhaltigkeitsberichte. Ob darin etwas steht, das sich nachrechnen lässt, ist eine andere Frage. Diese Arbeit liest vierzig Berichte aus dem Bremer Umland mit einem Raster aus zwölf Fragen und prüft nur eines: "},{"type":"text","marks":[{"type":"bold"}],"text":"Lässt sich jede genannte Kennzahl aus dem Bericht selbst herleiten?"}]}'),
(3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Das Prüfraster"}]}'),
(4, 'LIST', '{"type":"orderedList","attrs":{"start":1},"content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ist die Bezugsgröße genannt, also je Umsatz, je Beschäftigten oder absolut?"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ist der Berichtszeitraum derselbe wie im Jahresabschluss?"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sind Vorjahreswerte angegeben und bei Änderung der Methode neu gerechnet?"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ist die Systemgrenze beschrieben, insbesondere die Behandlung von Zulieferern?"}]}]}]}'),
(5, 'DOCUMENT', '{"type":"documentBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000041","fileName":"pruefraster-nachhaltigkeitsbericht.pdf","size":18810,"caption":"Das vollständige Raster mit allen zwölf Fragen und der Auswertungsanleitung"}}'),
(6, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Befunde"}]}'),
(7, 'TABLE', '{"type":"table","attrs":{"caption":"Erfüllte Rasterfragen, 40 Berichte"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Frage"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Erfüllt"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Teilweise"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Nicht erfüllt"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Bezugsgröße genannt"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"22"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"11"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"7"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Berichtszeitraum deckungsgleich"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"31"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"5"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"4"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Systemgrenze beschrieben"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"9"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"14"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"17"}]}]}]}]}'),
(8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Am schwächsten fällt die Systemgrenze aus. Wo sie fehlt, ist unklar, ob die genannten CO"},{"type":"text","marks":[{"type":"subscript"}],"text":"2"},{"type":"text","text":"-Werte die Zulieferer einschließen, und die Angabe verliert ihren Sinn. Sieben Berichte nennen Werte mit einer Genauigkeit von 10"},{"type":"text","marks":[{"type":"superscript"}],"text":"-3"},{"type":"text","text":" Tonnen, ohne die Bezugsgröße zu benennen: eine Präzision, die das Verfahren nicht hergibt."}]}'),
(9, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Wir berichten, was der Verband vorgibt. Ob jemand das nachrechnen kann, war bisher keine Frage, die uns gestellt wurde."}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"Aus einem der acht begleitenden Gespräche, Unternehmen mit 140 Beschäftigten"}]}]}'),
(10, 'DIVIDER', '{"type":"horizontalRule"}'),
(11, 'EMBED', '{"type":"embedBlock","attrs":{"provider":"youtube","embedUrl":"https://www.youtube.com/embed/aqz-KE-bpKQ","height":420}}'),
(12, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","marks":[{"type":"italic"}],"text":"Die vollständige Arbeit einschließlich der Einzelauswertungen liegt bei der Betreuung des Studiengangs Betriebswirtschaft."}]}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 5: Ein Tragwerk aus Buchenholz (APPROVED)
--
-- Ein freigegebener, aber noch nicht veröffentlichter Beitrag: über
-- die öffentliche Detailseite nicht erreichbar, in der Redaktions-
-- ansicht dagegen vollständig. Zeigt GALLERY mit drei Spalten und
-- einen bewusst leeren Alternativtext (schmückendes Bild).
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000005'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '115 days', now() - interval '26 days'
from (values
(0, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Neun Meter aus Buche"}]}'),
(1, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Der Wettbewerb verlangte einen Fußgängersteg von neun Metern Spannweite, gebaut aus einem einzigen Holzwerkstoff. Wir haben uns für Buchenfurnierschichtholz entschieden, und zwar nicht wegen der Optik: die Biegefestigkeit liegt rund doppelt so hoch wie bei Fichte, und der Querschnitt fällt entsprechend schlanker aus. Der Preis dafür ist eine Verbindung, die genauer sitzen muss."}]}'),
(2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000051","alt":"Prüfstand mit eingespanntem Holzträger und Messuhren","caption":"Der Belastungsversuch im Labor, kurz vor dem Aufbringen der Prüflast","width":100}}'),
(3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Nachweis"}]}'),
(4, 'FORMULA', '{"type":"mathBlock","attrs":{"latex":"\\sigma_{m,d} = \\frac{M_{d}}{W} \\leq k_{mod} \\cdot \\frac{f_{m,k}}{\\gamma_{M}}"}}'),
(5, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Maßgebend war nicht die Biegespannung, sondern die Durchbiegung im Gebrauchszustand: bei neun Metern und der geforderten Nutzlast liegt sie knapp unter der Grenze. Der Nachweis der Querzugspannung am Knotenpunkt war der zweite kritische Punkt und hat den Entwurf zweimal geändert."}]}'),
(6, 'TABLE', '{"type":"table","attrs":{"caption":"Nachweise im Überblick, Ausnutzungsgrade"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Nachweis"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Ausnutzung"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Bemerkung"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Biegung"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"0,62"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"unkritisch"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Durchbiegung"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"0,94"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"maßgebend"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Querzug am Knoten"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"0,88"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"nach zweiter Überarbeitung"}]}]}]}]}'),
(7, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Bau und Belastungsversuch"}]}'),
(8, 'GALLERY', '{"type":"galleryBlock","attrs":{"items":[{"fileId":"d0d00012-0000-4000-8000-000000000052","alt":"Knotenpunkt aus Buchenholz mit eingelassenen Stahlblechen"},{"fileId":"d0d00012-0000-4000-8000-000000000053","alt":"Stapel Buchenfurnierschichtholz mit sichtbarer Lagenstruktur"},{"fileId":"d0d00012-0000-4000-8000-000000000054","alt":""}],"columns":3,"caption":"Knoten, Werkstoff und Montage. Das dritte Bild ist schmückend und trägt deshalb einen leeren Alternativtext."}}'),
(9, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Prüflast wurde bis zum 1,8-fachen der Bemessungslast gesteigert, ohne sichtbare Schäden"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die gemessene Durchbiegung lag 11 Prozent unter der gerechneten, wie bei Furnierschichtholz erwartbar"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Das Versagen trat im Vorversuch am Knoten auf und nicht im Trägerquerschnitt, also genau dort, wo der Nachweis es vorhersagt"}]}]}]}'),
(10, 'DOCUMENT', '{"type":"documentBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000055","fileName":"statischer-nachweis-buchenholz.pdf","size":20597,"caption":"Statischer Nachweis mit allen Lastfällen und dem Protokoll des Belastungsversuchs"}}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 6: Repair-Café Gröpelingen (SUBMITTED)
--
-- Ein eingereichter Beitrag: liegt im Postkorb der Redaktion und ist
-- für die Autor:in gesperrt (Inhaltsbearbeitung nur in DRAFT und
-- REVISION, sonst 409 PROJECT_STATUS_NOT_EDITABLE).
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000006'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '95 days', now() - interval '12 days'
from (values
(0, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"212 Geräte, 14 Termine"}]}'),
(1, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Repair-Café in Gröpelingen öffnet alle zwei Wochen für drei Stunden in einem Raum der Quartiersbildungsstätte. Fünf bis acht Ehrenamtliche reparieren, was mitgebracht wird. Diese Auswertung deckt vierzehn Termine ab und beantwortet zwei Fragen: Was kommt, und was lässt sich davon tatsächlich instand setzen?"}]}'),
(2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000061","alt":"Lötkolben und geöffnetes Gerät auf einem Werktisch","caption":"Der Elektroniktisch ist der am stärksten nachgefragte Platz","width":75}}'),
(3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Was kommt und was bleibt"}]}'),
(4, 'TABLE', '{"type":"table","attrs":{"caption":"Gerätearten und Erfolgsquote über vierzehn Termine"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Geräteart"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Gebracht"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Repariert"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Quote"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Kleingeräte Küche"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"64"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"41"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"64 %"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Textil und Nähmaschinen"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"48"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"39"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"81 %"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Unterhaltungselektronik"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"57"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"18"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"32 %"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Fahrrad"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"43"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"38"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"88 %"}]}]}]}]}'),
(5, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Der häufigste Grund für einen Abbruch ist ein "},{"type":"text","marks":[{"type":"highlight","attrs":{"color":"red"}}],"text":"verklebtes Gehäuse"},{"type":"text","text":", nicht ein fehlendes Ersatzteil"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bei Unterhaltungselektronik scheitert es meistens am Netzteil, und dessen Bauteile sind einzeln nicht zu bekommen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Wer ein Gerät wiederbekommt, kommt im Mittel 2,4-mal wieder"}]}]}]}'),
(6, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Leute kommen wegen der Toaster und bleiben wegen des Kaffees. Beides ist Quartiersarbeit, und das eine geht ohne das andere nicht."}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"Ehrenamtliche seit der Gründung, im Gespräch am achten Termin"}]}]}'),
(7, 'DIVIDER', '{"type":"horizontalRule"}'),
(8, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Die Zahlen stammen aus dem Aufnahmezettel, der seit dem ersten Termin an jedem Gerät hängt. Er erfasst Geräteart, Fehlerbild, Ergebnis und die aufgewendete Zeit, aber bewusst keine Namen."}]}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 7: Werkstattbericht zum Editor (DRAFT)
--
-- Ein Entwurf, kurz und unfertig, wie ein Entwurf aussieht. Zeigt
-- EMBED über figma auf die Arbeitsdatei des Projekts: figma bettet
-- über den eigenen Host embed.figma.com ein, weil die Designseite
-- selbst das Einbetten per X-Frame-Options verbietet.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000007'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '25 days', now() - interval '2 days'
from (values
(0, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Stand der Blocktypen"}]}'),
(1, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Notizen aus der Lehrveranstaltung, noch nicht sortiert. Ein Block entspricht genau einem Top-Level-Knoten des Dokuments, und der gespeicherte Typ ist nur die abfragbare Projektion davon. Das klingt nach einer Kleinigkeit, entscheidet aber darüber, ob sich nach Blocktyp filtern lässt, ohne das JSON zu durchsuchen."}]}'),
(2, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Das Inhaltsverzeichnis ist eine gespeicherte Momentaufnahme und keine Ableitung beim Lesen. Grund ist der Lesepfad: Detailansicht, Redaktionsansicht und PDF-Export rendern ohne laufenden Editor"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Es darf höchstens eines je Projekt geben, ein zweites ergibt 400"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Der Preis ist, dass es veralten kann. Der Editor weist darauf hin, aktualisiert wird von Hand"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Noch offen: wie sich das Verzeichnis beim Umsortieren zweier Überschriften verhält"}]}]}]}'),
(3, 'CODE', '{"type":"codeBlock","attrs":{"language":"typescript"},"content":[{"type":"text","text":"export function collectHeadings(editor: Editor): TocEntry[] {\n  const entries: TocEntry[] = []\n  let index = 0\n\n  editor.state.doc.forEach((node) => {\n    if (node.type.name !== \"heading\") return\n    const text = node.textContent.trim().slice(0, MAX_TEXT)\n    if (text !== \"\" && entries.length < MAX_ENTRIES) {\n      entries.push({ level: node.attrs.level, text, index })\n    }\n    index += 1\n  })\n\n  return entries\n}"}]}'),
-- Anbieter codepen und nicht figma (KAN-99). Zwei Gruende, und der zweite
-- wiegt schwerer: der Demobestand kommt ohne Figma aus, und die bisherige
-- Adresse zeigte auf die INTERNE Figma-Arbeitsdatei dieses Projekts
-- (o6SECXRMKGOzCfG5xZebPV). Die haette auf einer oeffentlich erreichbaren
-- Vorfuehrung nichts zu suchen.
--
-- Die Allowlist bleibt unberuehrt: figma ist in BlockValidationService
-- weiterhin zulaessig (Contract §2.5), nur dieser Demoinhalt nicht mehr.
-- codepen passt fachlich: der Beitrag ist ein Werkstattbericht ueber den
-- Editor, und direkt darueber steht der TypeScript-Block zu
-- collectHeadings. Dieselbe Adresse benutzt Projekt 01 bereits.
--
-- Ersetzt und nicht gestrichen: der order_index bleibt lueckenlos.
(4, 'EMBED', '{"type":"embedBlock","attrs":{"provider":"codepen","embedUrl":"https://codepen.io/codepen/embed/PNaGbb","height":460}}'),
(5, 'DIVIDER', '{"type":"horizontalRule"}'),
(6, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","marks":[{"type":"italic"}],"text":"Noch zu ergänzen: ein Absatz zur Schemaversion und dazu, warum ein Block beim Lesen aufwärts migriert wird, aber erst beim nächsten Speichern in der neuen Fassung landet."}]}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 8: Bewegungsabsicht statt Knopfdruck (REVISION)
--
-- Der zurückgewiesene Fall: zwei offene CHANGE_REQUEST-Kommentare
-- hängen daran, und der Beitrag ist wieder bearbeitbar. Zeigt VIDEO
-- in der zweiten Quellvariante, nämlich als hochgeladene Datei über
-- attrs.fileId statt über einen Anbieter.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000008'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '255 days', now() - interval '40 days'
from (values
(0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Bewegungsabsicht statt Knopfdruck","index":0},{"level":2,"text":"Merkmale aus dem Muskelsignal","index":1},{"level":2,"text":"Probandenstudie","index":2}]}}'),
(1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Bewegungsabsicht statt Knopfdruck"}]}'),
(2, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Handgelenk-Exoskelette in der Rehabilitation werden fast immer über einen Taster ausgelöst. Das ist zuverlässig, aber es trainiert die falsche Bewegung: Wer den Knopf drückt, denkt an den Knopf und nicht an das Handgelenk. Dieser Beitrag beschreibt eine Steuerung, die stattdessen das "},{"type":"text","marks":[{"type":"bold"}],"text":"Oberflächen-EMG des Unterarms"},{"type":"text","text":" auswertet und die Bewegungsabsicht in unter 120 ms erkennt."}]}'),
(3, 'GALLERY', '{"type":"galleryBlock","attrs":{"items":[{"fileId":"d0d00012-0000-4000-8000-000000000081","alt":"Messkette aus Elektroden, Verstärker und Mikrocontroller auf einer Werkbank"},{"fileId":"d0d00012-0000-4000-8000-000000000082","alt":"Unterarm mit vier aufgeklebten Elektrodenpaaren"}],"columns":2,"caption":"Aufbau links, Elektrodenlage rechts"}}'),
(4, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Merkmale aus dem Muskelsignal"}]}'),
(5, 'FORMULA', '{"type":"mathBlock","attrs":{"latex":"\\mathrm{RMS}_{k} = \\sqrt{\\frac{1}{N}\\sum_{n=1}^{N} x_{k}[n]^{2}}"}}'),
(6, 'CODE', '{"type":"codeBlock","attrs":{"language":"python"},"content":[{"type":"text","text":"def features(window, fs=2000):\n    rms = np.sqrt(np.mean(window ** 2, axis=0))\n    zc = np.sum(np.diff(np.sign(window), axis=0) != 0, axis=0)\n    wl = np.sum(np.abs(np.diff(window, axis=0)), axis=0)\n    freqs, psd = welch(window, fs=fs, axis=0)\n    mnf = np.sum(freqs[:, None] * psd, axis=0) / np.sum(psd, axis=0)\n    return np.concatenate([rms, zc, wl, mnf])"}]}'),
(7, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Probandenstudie"}]}'),
(8, 'TABLE', '{"type":"table","attrs":{"caption":"Erkennungsrate je Bewegung, zwölf Personen"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Bewegung"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Erkennungsrate"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Latenz im Mittel"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Dorsalextension"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"96 %"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"104 ms"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Palmarflexion"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"93 %"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"118 ms"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Ruhe"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"99 %"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"nicht anwendbar"}]}]}]}]}'),
(9, 'VIDEO', '{"type":"videoBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000083","caption":"Ablauf einer Messreihe: Anlegen der Elektroden, Kalibrierung, zehn Wiederholungen je Bewegung","width":75}}'),
(10, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Nach der dritten Sitzung habe ich aufgehört, an die Hand zu denken. Das Ding macht einfach mit."}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"Proband 07, Abschlussgespräch"}]}]}'),
(11, 'DOCUMENT', '{"type":"documentBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000084","fileName":"studienprotokoll-zwoelf-probanden.pdf","size":13264,"caption":"Studienprotokoll mit Einwilligungserklärung, Ablauf und den Einzelergebnissen"}}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 9: 74 Befunde, Bauzustand des Gebäudes AB (PUBLISHED)
--
-- Der älteste Beitrag im Bestand, aus WiSe 2024/25. Steht auf Platz 3
-- der Top-10.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000009'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '475 days', now() - interval '400 days'
from (values
(0, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Vier Wochen, 74 Befunde"}]}'),
(1, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Gebäude AB stammt aus den frühen Siebzigern und ist seither zweimal teilsaniert worden, beide Male ohne durchgehende Dokumentation. Diese Begehung schließt die Lücke: vier Wochen, jedes Geschoss, jeder Raum, jeder Befund mit Ort, Foto und Einordnung nach Dringlichkeit."}]}'),
(2, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000091","alt":"Treppenhaus mit Sichtbetonwänden und Handlauf aus Metall","caption":"Das nördliche Treppenhaus, unverändert seit dem Bau","width":100}}'),
(3, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Vorgehen bei der Begehung"}]}'),
(4, 'LIST', '{"type":"orderedList","attrs":{"start":1},"content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Grundriss je Geschoss aus dem Bestandsplan, Räume durchnummeriert"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sichtprüfung Wand, Decke, Boden, Fenster, Installation, in immer derselben Reihenfolge"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Je Befund ein Foto mit Maßstab und die Aufnahme in das Formblatt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Einordnung nach Dringlichkeit erst am Abend, nicht vor Ort"}]}]}]}'),
(5, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Befunde nach Bauteil"}]}'),
(6, 'TABLE', '{"type":"table","attrs":{"caption":"74 Befunde, verteilt auf Bauteile und Dringlichkeitsstufen"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Bauteil"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Sofort"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Mittelfristig"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Beobachten"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Fassade"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"2"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"11"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"9"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Dach und Entwässerung"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"},{"type":"textStyle","attrs":{"color":"red"}}],"text":"6"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"7"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"3"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Innenausbau"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"0"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"14"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"22"}]}]}]}]}'),
(7, 'GALLERY', '{"type":"galleryBlock","attrs":{"items":[{"fileId":"d0d00012-0000-4000-8000-000000000092","alt":"Riss in einer Betonwand, daneben ein Zollstock als Maßstab"},{"fileId":"d0d00012-0000-4000-8000-000000000093","alt":"Flachdach mit stehendem Wasser an einem Einlauf"},{"fileId":"d0d00012-0000-4000-8000-000000000094","alt":"Kellerwand mit Feuchtigkeitsrand und abblätterndem Anstrich"}],"columns":3,"caption":"Drei der sechs Sofortbefunde: Riss, Entwässerung, aufsteigende Feuchte"}}'),
(8, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vier der sechs Sofortbefunde am Dach gehen auf dieselbe Ursache zurück: zu klein dimensionierte Einläufe"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Risse an der Nordfassade folgen den Geschossdecken und sind mit hoher Wahrscheinlichkeit Setzungsrisse aus der Bauzeit"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Im Innenausbau gibt es keinen einzigen Sofortbefund, dafür die meisten Beobachtungsfälle"}]}]}]}'),
(9, 'DIVIDER', '{"type":"horizontalRule"}'),
(10, 'QUOTE', '{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Die Einläufe sind seit dem Bau zu klein. Das steht in keinem Protokoll, weil es nie jemand nachgerechnet hat."}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"Aus dem Gespräch mit der Gebäudetechnik, dritte Begehungswoche"}]}]}'),
(11, 'DOCUMENT', '{"type":"documentBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-000000000095","fileName":"begehungsprotokoll-gebaeude-ab.pdf","size":18810,"caption":"Vollständiges Protokoll mit allen 74 Befunden, Fotos und Ortsangaben"}}')
) as v(order_index, type, content);

-- -------------------------------------------------------------------
-- Projekt 10: Wegeführung im Foyer (PUBLISHED)
--
-- Hängt am Sammelmodul des Studiengangs (ISMI-ALLG, module.collective)
-- und ist damit der Fall, in dem ein Beitrag keinem einzelnen Modul
-- zugeordnet ist. Zeigt AUDIO mit eigener Datei und VIDEO über youtube.
-- Der EMBED, den dieser Beitrag früher über vimeo trug, ist mit KAN-99
-- entfallen; EMBED kommt im Bestand weiterhin vor, nur nicht mehr hier.
-- -------------------------------------------------------------------
insert into block (id, project_id, type, order_index, content, schema_version, created_at, updated_at)
select gen_random_uuid(), 'd0d00011-0000-4000-8000-000000000010'::uuid,
       v.type, v.order_index, v.content::jsonb, 3,
       now() - interval '55 days', now() - interval '8 days'
from (values
(0, 'TABLE_OF_CONTENTS', '{"type":"tableOfContents","attrs":{"entries":[{"level":1,"text":"Wer zum ersten Mal kommt, findet nichts","index":0},{"level":2,"text":"Piktogramme","index":1},{"level":2,"text":"Elf Nutzertests","index":2}]}}'),
(1, 'HEADING', '{"type":"heading","attrs":{"level":1,"textAlign":null},"content":[{"type":"text","text":"Wer zum ersten Mal kommt, findet nichts"}]}'),
(2, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Das Foyer des Gebäudes AB hat vier Ausgänge, zwei Treppenhäuser und keinen einzigen Übersichtsplan. Wer das Prüfungsamt sucht, fragt. Das ist keine Katastrophe, aber es ist eine vermeidbare Hürde, und sie trifft genau die Personen am härtesten, die ohnehin zum ersten Mal da sind: Studienanfängerinnen und -anfänger, Gäste, und alle, die sich schlecht orientieren."}]}'),
(3, 'IMAGE', '{"type":"imageBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-0000000000a1","alt":"Leeres Foyer mit Glasfront, Treppenaufgang und einer Wand ohne Beschilderung","caption":"Der Ausgangszustand: eine Wand, auf der alles Platz hätte, und nichts steht darauf","width":100}}'),
(4, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Piktogramme"}]}'),
(5, 'GALLERY', '{"type":"galleryBlock","attrs":{"items":[{"fileId":"d0d00012-0000-4000-8000-0000000000a2","alt":"Entwurfsbogen mit sechs Piktogrammen in schwarzer Kontur"},{"fileId":"d0d00012-0000-4000-8000-0000000000a3","alt":"Tastbares Übersichtsmodell des Foyers aus gefrästem Holz"}],"columns":2,"caption":"Die Piktogrammreihe und das tastbare Modell im Maßstab 1 zu 50"}}'),
(6, 'LIST', '{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sechs Piktogramme, mehr nicht: jedes weitere hat in den Tests die Trefferquote der übrigen gesenkt"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontrast durchgehend über 4,5 zu 1, geprüft in hell und dunkel"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Das Modell steht auf 90 cm Höhe und ist von drei Seiten erreichbar, auch im Sitzen"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Jede Station trägt eine Hörprobe über einen NFC-Punkt"}]}]}]}'),
(7, 'HEADING', '{"type":"heading","attrs":{"level":2,"textAlign":null},"content":[{"type":"text","text":"Elf Nutzertests"}]}'),
(8, 'AUDIO', '{"type":"audioBlock","attrs":{"fileId":"d0d00012-0000-4000-8000-0000000000a4","caption":"Die Ansage am Modell, gesprochen und auf 20 Sekunden gekürzt"}}'),
(9, 'TEXT', '{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Elf Personen, keine davon aus dem Studiengang, sollten nacheinander drei Ziele finden. Vorher fanden vier von elf das Prüfungsamt ohne zu fragen, nachher neun. Der größte einzelne Gewinn kam nicht von den Piktogrammen, sondern "},{"type":"text","marks":[{"type":"highlight","attrs":{"color":"green"}}],"text":"von der Entscheidung, den Plan an die Wand gegenüber dem Eingang zu hängen"},{"type":"text","text":" statt neben die Tür."}]}'),
(10, 'CODE', '{"type":"codeBlock","attrs":{"language":"css"},"content":[{"type":"text","text":"/* Die Piktogramme liegen als Maske vor, damit die Farbe aus der\n   Tokenschicht kommt und nicht aus der Zeichnung. */\n.pictogram {\n  background-color: var(--color-foreground);\n  mask-image: var(--pictogram-src);\n  mask-size: contain;\n  mask-repeat: no-repeat;\n  inline-size: 3rem;\n  block-size: 3rem;\n}"}]}'),
-- Hier endete der Beitrag frueher mit einem EMBED auf vimeo. Er ist
-- ersatzlos gestrichen (KAN-99): der Demobestand kommt ohne Vimeo aus.
--
-- Ersatzlos und nicht ersetzt, weil es der LETZTE Block war. Der
-- order_index laeuft damit weiterhin lueckenlos von 0 bis 11, und es
-- entsteht nichts, was der Server beim naechsten Speichern beanstanden
-- wuerde. Bei den beiden anderen Fundstellen (Projekt 03 und 07) stand der
-- Block mittendrin, dort wurde deshalb der Anbieter getauscht statt der
-- Block entfernt.
--
-- Der Beitrag verliert dadurch seinen einzigen EMBED, behaelt aber das
-- VIDEO darueber. Die Blockart EMBED bleibt im Gesamtbestand vertreten
-- (Projekt 01 und 07), die Zusage der Definition of Done zu §2.5 gilt also
-- weiter.
(11, 'VIDEO', '{"type":"videoBlock","attrs":{"provider":"youtube","videoId":"aqz-KE-bpKQ","caption":"Ein Durchlauf aus dem siebten Nutzertest, gekürzt","width":50}}')
) as v(order_index, type, content);

commit;

-- -------------------------------------------------------------------
-- Gegenprobe: sind alle fünfzehn Blocktypen vertreten?
-- -------------------------------------------------------------------
select b.type, count(*) as anzahl, count(distinct b.project_id) as projekte
from block b
where b.project_id::text like 'd0d00011-%'
group by b.type
order by b.type;
ENDE_SQL_BLOECKE
echo

# -------------------------------------------------------------------
# 3) Die Bytes zu den Dateizeilen.
#
#    Warum dieser Schritt ueberhaupt getrennt ist: PostgreSQL kann kein
#    HTTP. Die Zeilen in stored_file entstehen oben im SQL, die
#    zugehoerigen Bytes koennen nur von aussen kommen. Ohne sie stehen
#    die Dateizeilen zwar in der Datenbank, GET /api/files/{id} antwortet
#    aber mit 500, und Titelbild, Galerie, Audio und Dokument bleiben
#    leer.
#
#    Im Profil dev ist der Objektspeicher der Ordner /app/var/storage im
#    Backend-Container (Docker-Volume "storage", app.storage.provider=
#    local). Der Schluessel folgt FileService: projects/{projectId}/{uuid}
#    fuer Projektdateien, avatars/{uuid} fuer Profilbilder. Der Objektname
#    ist hier gleich der Zeilen-ID aus stored_file; die Anwendung vergibt
#    dafuer sonst eine eigene UUID, fuer Demodaten ist die Gleichsetzung
#    der einzige Weg, Skript und SQL ohne Nachschlagen in Deckung zu
#    halten.
#
#    Bildquelle ist picsum.photos in der seed-Form: derselbe Seed liefert
#    dauerhaft dasselbe Foto, der Lauf ist also reproduzierbar. Die Fotos
#    stammen von Unsplash und stehen unter der Unsplash-Lizenz, die keine
#    Namensnennung verlangt; ein Nachtrag in NOTICE.md ist deshalb nicht
#    noetig. Sie liegen ausserdem nie im Repository, sondern nur im
#    Docker-Volume der lokalen Datenbank.
# -------------------------------------------------------------------
echo "== 3/4  Dateien aus dem Netz in den Objektspeicher =="

P=d0d00011-0000-4000-8000-0000000000   # Projekte
F=d0d00012-0000-4000-8000-0000000000   # Dateien

# Bildgroessen nach Verwendung. Ein Titelbild laeuft ueber die volle
# Kachelbreite, ein Profilbild steht quadratisch in einem Kreis. Breite
# und Hoehe stehen als zwei durch Leerzeichen getrennte Woerter in einer
# Variablen, damit sie unten unquotiert als zwei Argumente an bild()
# gehen.
COVER="1600 900"
INLINE="1400 900"
GAL="1200 900"
AVATAR="400 400"

# Woher die Bilder kommen.
#
# Erste Wahl ist picsum.photos in der seed-Form: derselbe Seed liefert
# dauerhaft dasselbe Foto, der Lauf ist also reproduzierbar. Die Fotos
# stammen von Unsplash und stehen unter der Unsplash-Lizenz, die keine
# Namensnennung verlangt.
#
# Der Dienst faellt allerdings aus (beobachtet am 31.08.2026: 503 und
# 522 vom Cloudflare-Rand, auch ueber fastly.picsum.photos). Deshalb
# wird er einmal zu Beginn angetippt; antwortet er nicht, laedt das
# Skript von loremflickr.com. Das ist kein Rueckschritt: loremflickr
# liefert echte Fotos zu einem Stichwort, also thematisch passende
# statt beliebiger, und mit "lock" ebenso reproduzierbar wie picsum mit
# seed.
#
# Beide Quellen liegen nur im Docker-Volume der lokalen
# Entwicklungsdatenbank, nie im Repository und in keiner
# Veroeffentlichung. Ein Nachtrag in NOTICE.md ist deshalb auch fuer
# die Flickr-Bilder nicht noetig, deren Lizenzen anders als die
# Unsplash-Lizenz teils eine Namensnennung verlangen.
if curl -sS -L -o /dev/null --fail --max-time 15 \
	"https://picsum.photos/seed/probe/64/64.jpg" 2>/dev/null; then
	BILDQUELLE=picsum
else
	BILDQUELLE=loremflickr
fi
echo "  Bildquelle: $BILDQUELLE"

# $1 Seed fuer picsum, $2 Stichwort fuer loremflickr, $3 lock-Nummer,
# danach Breite und Hoehe als zwei Argumente (also $COVER unquotiert).
bild() {
	if [ "$BILDQUELLE" = "picsum" ]; then
		echo "https://picsum.photos/seed/$1/$4/$5.jpg"
	else
		echo "https://loremflickr.com/$4/$5/$2?lock=$3"
	fi
}

PDF_A=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
PDF_B=https://pdfobject.com/pdf/sample.pdf
PDF_C=https://www.orimi.com/pdf-test.pdf
OGG=https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg
MP4=https://download.samplelib.com/mp4/sample-5s.mp4

# Dateizeile | Ablageort (avatars oder Projekt-ID) | Quelle
#
# Die Reihenfolge ist die der Dateizeilen im SQL oben.
MANIFEST="
${F}01|avatars|$(bild avatar-lena     portrait 1 $AVATAR)
${F}02|avatars|$(bild avatar-jonas    portrait 2 $AVATAR)
${F}03|avatars|$(bild avatar-aylin    portrait 3 $AVATAR)
${F}04|avatars|$(bild avatar-malte    portrait 4 $AVATAR)
${F}05|avatars|$(bild avatar-sofia    portrait 5 $AVATAR)
${F}06|avatars|$(bild avatar-timo     portrait 6 $AVATAR)
${F}07|avatars|$(bild avatar-claudia  portrait 7 $AVATAR)
${F}08|avatars|$(bild avatar-nele     portrait 8 $AVATAR)
${F}09|avatars|$(bild avatar-henrik   portrait 9 $AVATAR)
${F}0a|avatars|$(bild avatar-britta   portrait 10 $AVATAR)
${F}10|${P}01|$(bild lastenrad-station        cargobike        10 $COVER)
${F}11|${P}01|$(bild lastenrad-werkstatt      bicycle,workshop 11 $INLINE)
${F}12|${P}01|$(bild lastenrad-transport      cargobike        12 $GAL)
${F}13|${P}01|$(bild lastenrad-schloss        bicycle,lock     13 $GAL)
${F}14|${P}01|$(bild lastenrad-uebergabe      bicycle          14 $GAL)
${F}20|${P}02|$(bild weser-watt               mudflat          20 $COVER)
${F}21|${P}02|$(bild weser-hydrofon           microphone,water 21 $INLINE)
${F}22|${P}02|$(bild weser-messpunkt          tideland         22 $GAL)
${F}23|${P}02|$(bild weser-priel              creek            23 $GAL)
${F}24|${P}02|$OGG
${F}30|${P}03|$(bild gewaechshaus-innen       greenhouse       30 $COVER)
${F}31|${P}03|$(bild gewaechshaus-sensorik    circuit          31 $INLINE)
${F}32|${P}03|$PDF_A
${F}40|${P}04|$(bild bericht-kennzahlen       report           40 $COVER)
${F}41|${P}04|$PDF_B
${F}50|${P}05|$(bild tragwerk-modell          footbridge       50 $COVER)
${F}51|${P}05|$(bild tragwerk-pruefstand      laboratory       51 $INLINE)
${F}52|${P}05|$(bild tragwerk-knoten          timber           52 $GAL)
${F}53|${P}05|$(bild tragwerk-buche           plywood          53 $GAL)
${F}54|${P}05|$(bild tragwerk-montage         construction     54 $GAL)
${F}55|${P}05|$PDF_C
${F}60|${P}06|$(bild repaircafe-tisch         workshop         60 $COVER)
${F}61|${P}06|$(bild repaircafe-loetkolben    soldering        61 $INLINE)
${F}70|${P}07|$(bild editor-werkstatt         desk,computer    70 $COVER)
${F}80|${P}08|$(bild exoskelett-hand          robotics         80 $COVER)
${F}81|${P}08|$(bild exoskelett-messkette     electronics      81 $GAL)
${F}82|${P}08|$(bild exoskelett-elektroden    laboratory       82 $GAL)
${F}83|${P}08|$MP4
${F}84|${P}08|$PDF_A
${F}90|${P}09|$(bild gebaeude-ab-fassade      architecture     90 $COVER)
${F}91|${P}09|$(bild gebaeude-ab-treppenhaus  stairs           91 $INLINE)
${F}92|${P}09|$(bild gebaeude-ab-riss         concrete         92 $GAL)
${F}93|${P}09|$(bild gebaeude-ab-dach         rooftop          93 $GAL)
${F}94|${P}09|$(bild gebaeude-ab-keller       wall             94 $GAL)
${F}95|${P}09|$PDF_B
${F}a0|${P}10|$(bild foyer-wegefuehrung       foyer           100 $COVER)
${F}a1|${P}10|$(bild foyer-leitsystem         signage         101 $INLINE)
${F}a2|${P}10|$(bild foyer-piktogramm         pictogram       102 $GAL)
${F}a3|${P}10|$(bild foyer-tastmodell         model,wood      103 $GAL)
${F}a4|${P}10|$OGG
"

# Ein Ablageordner, der die Schluesselstruktur des Objektspeichers
# bereits abbildet. Ein einziger Uebertragungsvorgang am Ende statt
# eines Aufrufs je Datei: das sind 47 Prozessstarts weniger, und der
# Ordner ist vorher als Ganzes pruefbar.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Die Schluessel, unter denen die Dateien im Objektspeicher liegen
# muessen. Genau diese Werte traegt stored_file.path; das SQL weiter oben
# bildet sie nach derselben Regel. Beide Zweige der Ablage benutzen diese
# Funktion, damit die Regel nur an einer Stelle steht.
erwartete_schluessel() {
	while IFS='|' read -r file_id place url; do
		[ -z "${file_id:-}" ] && continue
		if [ "$place" = "avatars" ]; then
			echo "avatars/$file_id"
		else
			echo "projects/$place/$file_id"
		fi
	done <<< "$MANIFEST"
}

pfad_im_ablage() {
	if [ "$2" = "avatars" ]; then echo "$STAGE/avatars/$1"
	else echo "$STAGE/projects/$2/$1"; fi
}

# Die Gesamtzahl wird aus dem MANIFEST gezaehlt und nicht in den Text
# geschrieben. Vorher stand dort eine feste 47, und nach dem Ergaenzen der
# drei Avatare fuer die Rollenkonten meldete der Fortschritt "50 von 47"
# (KAN-99). Eine Zahl, die an zwei Stellen gepflegt werden muss, laeuft
# frueher oder spaeter auseinander.
#
# Bewusst nicht "erwartet": diesen Namen benutzt die Signaturpruefung
# weiter unten je Datei, und eine gemeinsame Variable haette sich beim
# ersten Schleifendurchlauf selbst ueberschrieben.
dateien_gesamt=$(printf '%s
' "$MANIFEST" | grep -c '|')

count=0
while IFS='|' read -r file_id place url; do
	[ -z "${file_id:-}" ] && continue
	ziel=$(pfad_im_ablage "$file_id" "$place")
	mkdir -p "$(dirname "$ziel")"

	# --fail laesst curl bei 4xx/5xx mit Exitcode abbrechen, statt die
	# Fehlerseite als Datei abzulegen. Ohne das landete ein HTML-Text im
	# Objektspeicher und das Portal lieferte ihn als "image/jpeg" aus.
	# Der User-Agent ist fuer Wikimedia noetig, das anonyme Abrufe ohne
	# Kennung abweist.
	if ! curl -sS -L --fail --max-time 60 \
		-A "eportfolio-demodaten/1.0 (lokale Entwicklungsdatenbank)" \
		-o "$ziel" "$url"; then
		abbruch "$url liess sich nicht laden ($file_id)."
	fi
	count=$((count + 1))
	printf '\r  %2d von %d geladen' "$count" "$dateien_gesamt"
done <<< "$MANIFEST"
echo

# Pruefen, bevor kopiert wird. Der Grund steht in AllowedFileType: das
# Portal prueft beim Upload die Signatur am Dateianfang, beim Ausliefern
# aber nicht mehr. Was hier an der Anwendung vorbei in den Speicher
# gelegt wird, laeuft ungeprueft durch. Eine Fehlerseite mit Status 200,
# die curl nicht abfaengt, faellt hier auf und nicht erst im Browser.
while IFS='|' read -r file_id place url; do
	[ -z "${file_id:-}" ] && continue
	kopf=$(head -c 12 "$(pfad_im_ablage "$file_id" "$place")" | od -An -tx1 | tr -d ' \n')
	# Nicht auf ".jpg" pruefen: eine loremflickr-URL endet auf
	# "?lock=42" und traegt die Endung nirgends. Deshalb sind die drei
	# Sonderfaelle benannt und alles Uebrige ist ein Foto.
	case "$url" in
		*.pdf) erwartet=255044462d ;;    # %PDF-
		*.ogg) erwartet=4f676753 ;;      # OggS
		*.mp4) erwartet="" ;;            # MP4: ftyp steht in Byte 4 bis 7
		*)     erwartet=ffd8ff ;;        # JPEG
	esac
	if [ -n "$erwartet" ] && [ "${kopf#"$erwartet"}" = "$kopf" ]; then
		abbruch "$file_id traegt nicht die erwartete Signatur ($url)."
	fi
	if [ -z "$erwartet" ] && [ "${kopf:8:8}" != "66747970" ]; then
		abbruch "$file_id ist kein MP4 ($url)."
	fi
done <<< "$MANIFEST"
echo "  Signaturen geprueft"

# -------------------------------------------------------------------
# Ablegen im Objektspeicher: zwei Wege, je nach Betriebsart (KAN-99)
# -------------------------------------------------------------------
# Der Zwischenschritt oben ist fuer beide gleich: die Dateien liegen in
# $STAGE bereits unter genau den Schluesseln, die stored_file.path
# traegt (avatars/<id> und projects/<projektId>/<id>). Nur die letzte
# Meile unterscheidet sich.
#
# Im Profil dev ist der Objektspeicher ein Ordner im Backend-Container.
# Im Profil prod ist er Azure Blob Storage, und compose.prod.yml gibt
# dem Container dafuer bewusst KEIN storage-Volume. Der bisherige
# tar-Weg haette dort 50 Dateizeilen in der Datenbank hinterlassen,
# deren Bytes nirgends abrufbar sind: kaputte Titelbilder, leere
# Galerien, tote Downloads, und GET /api/files/{id} antwortet mit 500.
# Die alte Gegenprobe haette das nicht bemerkt, denn sie zaehlte im
# Container und faende dort genau die Dateien, die sie selbst
# hineingelegt hat.
#
# Die Betriebsart wird nicht geraten, sondern beim laufenden Backend
# erfragt. Damit kann das Skript nicht in den falschen Speicher
# schreiben, auch wenn jemand DB_CONTAINER und BACKEND_CONTAINER
# uebersehen hat.
# Das "|| true" ist noetig und kein Schmuck: printenv endet mit 1, wenn
# die Variable nicht gesetzt ist, und mit "set -o pipefail" reisst das die
# ganze Zuweisung und damit das Skript mit. Der leere Fall wird jeweils
# eine Zeile weiter abgefangen.
PROFIL=$(im_container 'printenv SPRING_PROFILES_ACTIVE' 2>/dev/null | tr -d '\r\n') || true
# Keine Vorgabe bei leerer Antwort, sondern Abbruch. Frueher stand hier
# ein Rueckfall auf "dev", und der zeigte in die gefaehrlichere Richtung:
# auf einem PROD-Stapel haette das Skript die Bytes in einen Container
# ohne storage-Volume kopiert und 50 Dateizeilen hinterlassen, deren
# Inhalt nirgends abrufbar ist. Wer raet, raet hier zum Schaden.
[ -n "$PROFIL" ] || abbruch "Der Container $BACKEND nennt kein
         SPRING_PROFILES_ACTIVE. Ohne die Betriebsart weiss das Skript
         nicht, wohin die Dateien gehoeren: in das Dateisystem des
         Containers (dev) oder nach Azure (prod). Laeuft das Backend, und
         ist BACKEND_CONTAINER richtig gesetzt?"
echo "  Betriebsart des Backends: $PROFIL"

if [ "$PROFIL" != "prod" ]; then
	# Uebertragen als tar-Strom und nicht mit "docker cp": unter Git Bash
	# schreibt MSYS aus "$STAGE/." das Verzeichnis selbst, der Inhalt landete
	# dann eine Ebene zu tief und jeder Abruf antwortete mit 500, ohne dass
	# an den Zeilen etwas falsch waere. Der tar-Strom kennt nur relative
	# Namen und ist von der Umschreibung nicht betroffen.
	im_container "mkdir -p '$ROOT'"
	tar -C "$STAGE" -cf - . | docker exec -i "$BACKEND" sh -lc "tar -C '$ROOT' -xf -"

	# Gegenprobe: liegt JEDER erwartete Schluessel dort, wo FileService ihn
	# sucht?
	#
	# Geprueft und nicht gezaehlt (KAN-99). Vorher zaehlte diese Stelle
	# alle Dateien unterhalb von $ROOT und verglich die Zahl mit der des
	# Laufs. Das geht nur auf einem frischen Volume auf: liegen dort noch
	# Dateien aus frueheren Laeufen, bricht der Lauf ab, obwohl alles
	# richtig ist (beobachtet mit 116 gefundenen gegen 50 erwartete).
	# Umgekehrt faende eine Zaehlung nicht, wenn eine Datei fehlt und
	# dafuer eine fremde zu viel liegt.
	# "docker exec -i" und nicht die Hilfsfunktion im_container: die laeuft
	# ohne -i und bekaeme die Standardeingabe gar nicht.
	#
	# Der Ablageort geht als Umgebungsvariable hinein und nicht in den
	# Befehlstext. Der Rumpf steht dadurch in einfachen Anfuehrungszeichen,
	# und weder $ABLAGE noch $k werden vom Wirt angefasst; beides loest
	# erst die Shell im Container auf.
	fehlende=$(erwartete_schluessel | docker exec -i -e ABLAGE="$ROOT" "$BACKEND" \
		sh -c 'cd "$ABLAGE" 2>/dev/null || exit 0; while IFS= read -r k; do [ -f "$k" ] || echo "$k"; done')
	[ -z "$fehlende" ] || abbruch "Diese Schluessel fehlen unter $ROOT:
$(echo "$fehlende" | sed 's/^/         /')"
	echo "  alle $count Schluessel im Dateisystem des Backend-Containers"
else
	# Zugangsdaten vom laufenden Backend und nicht aus der .env: so wird
	# garantiert in genau den Container geschrieben, aus dem die Anwendung
	# auch liest. Eine zweite Quelle waere eine zweite Gelegenheit, sie
	# auseinanderlaufen zu lassen.
	AZ_CONTAINER=$(im_container 'printenv AZURE_STORAGE_CONTAINER' 2>/dev/null | tr -d '\r\n') || true
	AZURE_STORAGE_CONNECTION_STRING=$(im_container 'printenv AZURE_STORAGE_CONNECTION_STRING' 2>/dev/null | tr -d '\r\n') || true
	[ -n "$AZ_CONTAINER" ] || abbruch "AZURE_STORAGE_CONTAINER ist im Backend-Container nicht gesetzt."
	[ -n "$AZURE_STORAGE_CONNECTION_STRING" ] || abbruch "AZURE_STORAGE_CONNECTION_STRING ist im Backend-Container nicht gesetzt."
	# Als exportierte Variable und NICHT als "-e NAME=wert": ein Wert im
	# Aufrufwort stuende in der Prozessliste des Wirts und waere dort fuer
	# jeden lesbar, der ps aufrufen darf. So reicht Docker nur den Namen
	# durch und holt den Wert aus der Umgebung.
	export AZURE_STORAGE_CONNECTION_STRING

	echo "  Hochladen nach Azure, Container $AZ_CONTAINER"
	# Wegwerf-Container mit der Azure-CLI. Das Abbild ist gross und wird
	# beim ersten Lauf geladen; dafuer bleibt auf dem Server nichts
	# zurueck, und es entsteht keine selbst geschriebene Signaturlogik,
	# die niemand pflegt.
	#
	# --overwrite, weil das Skript wiederholbar sein soll: ein zweiter
	# Lauf ersetzt dieselben Schluessel, statt an vorhandenen Blobs zu
	# scheitern.
	#
	# KEIN --content-type: der Content-Type am Blob ist fuer die
	# Auslieferung ohne Bedeutung. FileController setzt ihn aus
	# stored_file.mime_type, und AzureBlobFileStorage.load oeffnet nur
	# den Datenstrom. Nachgeprueft, nicht angenommen.
	docker run --rm \
		-e AZURE_STORAGE_CONNECTION_STRING \
		-v "$STAGE:/daten:ro" \
		mcr.microsoft.com/azure-cli \
		az storage blob upload-batch \
			--destination "$AZ_CONTAINER" \
			--source /daten \
			--overwrite \
			--output none \
		|| abbruch "Das Hochladen nach Azure ist fehlgeschlagen."

	# Gegenprobe am Ziel und nicht an der Quelle: gezaehlt wird, was
	# tatsaechlich im Blob-Container liegt. Genau diese Richtung fehlte
	# dem alten Weg.
	# Gegenprobe am Ziel und nicht an der Quelle, und wie im lokalen Zweig
	# geprueft statt gezaehlt: eine Zahl stimmt auch dann noch, wenn eine
	# Datei fehlt und dafuer eine fremde zu viel im Container liegt.
	vorhanden=$(docker run --rm \
		-e AZURE_STORAGE_CONNECTION_STRING \
		mcr.microsoft.com/azure-cli \
		az storage blob list --container-name "$AZ_CONTAINER" \
			--query "[].name" --output tsv | tr -d '\r')
	# grep -F: die Schluessel sind Zeichenketten und keine Muster.
	# -x: nur ganze Zeilen, sonst passte "avatars/abc" auch auf
	# "projects/xy/avatars/abc". -v: gesucht sind die FEHLENDEN.
	# "|| true": grep endet mit 1, wenn nichts fehlt, und genau das ist
	# der Erfolgsfall.
	fehlende=$(erwartete_schluessel | grep -Fxv "$vorhanden" || true)
	[ -z "$fehlende" ] || abbruch "Diese Schluessel fehlen im Azure-Container $AZ_CONTAINER:
$(echo "$fehlende" | sed 's/^/         /')"
	echo "  alle $count Schluessel im Azure-Container $AZ_CONTAINER"
fi

# Die tatsaechlichen Groessen nachtragen. stored_file.size ist keine
# Zierde: FileController setzt daraus den Content-Length der Antwort.
# Steht dort eine andere Zahl als die Datei hat, bricht der Abruf ab,
# ohne dass irgendwo ein Fehler sichtbar wird. Derselbe Wert steht ein
# zweites Mal im Inhalt der DOCUMENT-Bloecke (attrs.size, Contract 2.5)
# und wird mitgezogen: die Anzeige nennt dort "18 KB" und soll nicht
# luegen.
werte=""
while IFS='|' read -r file_id place url; do
	[ -z "${file_id:-}" ] && continue
	bytes=$(wc -c < "$(pfad_im_ablage "$file_id" "$place")" | tr -d ' ')
	werte="$werte,('$file_id'::uuid, $bytes::bigint)"
done <<< "$MANIFEST"
werte="${werte#,}"

sql <<SQL
begin;

update stored_file f
set size = v.bytes
from (values $werte) as v(id, bytes)
where f.id = v.id;

update block b
set content = jsonb_set(b.content, '{attrs,size}', to_jsonb(f.size))
from stored_file f
where b.type = 'DOCUMENT'
  and b.content -> 'attrs' ->> 'fileId' = f.id::text
  and f.id::text like 'd0d00012-%';

commit;
SQL
echo "  Dateigroessen in stored_file und in den DOCUMENT-Bloecken nachgetragen"
echo

# -------------------------------------------------------------------
# 4) Gegenprobe.
#
#    Nicht behaupten, sondern nachsehen: stimmen die Zahlen, sind alle
#    fuenfzehn Blocktypen da, zeigt kein Block auf eine Datei, die es
#    nicht gibt, und liefert das Portal ein Bild tatsaechlich aus?
# -------------------------------------------------------------------
echo "== 4/4  Gegenprobe =="

sql -c "
select 'Nutzer'        as bestand, count(*) from app_user     where id::text like 'd0d00010-%'
union all select 'Projekte',       count(*) from project      where id::text like 'd0d00011-%'
union all select 'Bloecke',        count(*) from block        where project_id::text like 'd0d00011-%'
union all select 'Dateizeilen',    count(*) from stored_file  where id::text like 'd0d00012-%'
union all select 'Kommentare',     count(*) from comment      where id::text like 'd0d00014-%'
union all select 'Reaktionen',     count(*) from reaction     where id::text like 'd0d00015-%'
union all select 'Top-10-Plaetze', count(*) from top10_entry  where id::text like 'd0d00016-%';"

typen=$(sql -tAc "select count(distinct type) from block where project_id::text like 'd0d00011-%';" | tr -d '[:space:]')
[ "$typen" = "15" ] || abbruch "Nur $typen von 15 Blocktypen vertreten."
echo "  Alle 15 Blocktypen vertreten"

tote=$(sql -tAc "
select count(*) from (
  select jsonb_array_elements(b.content->'attrs'->'items')->>'fileId' as fid
  from block b where b.type = 'GALLERY' and b.project_id::text like 'd0d00011-%'
  union all
  select b.content->'attrs'->>'fileId'
  from block b where b.type in ('IMAGE','AUDIO','DOCUMENT','VIDEO')
    and b.content->'attrs' ? 'fileId' and b.project_id::text like 'd0d00011-%'
) x where not exists (select 1 from stored_file f where f.id::text = x.fid);" | tr -d '[:space:]')
[ "$tote" = "0" ] || abbruch "$tote Bloecke zeigen auf eine Datei, die es nicht gibt."
echo "  Keine toten Dateiverweise"

# Der Abruf ueber die Anwendung ist die einzige Pruefung, die Zeile und
# Bytes gemeinsam trifft: eine falsche Groesse oder ein falscher Pfad
# faellt hier auf und nicht erst im Browser.
antwort=$(im_container "curl -sS -o /dev/null -w '%{http_code}:%{size_download}' \
	http://localhost:8080/api/files/d0d00012-0000-4000-8000-000000000010" || true)
case "$antwort" in
	200:*) echo "  Titelbildabruf ueber die API: ${antwort%%:*} (${antwort##*:} Bytes)" ;;
	*)     echo "  HINWEIS: Der Titelbildabruf antwortete mit '$antwort'."
	       echo "           Laeuft das Backend schon? Die Daten stehen unabhaengig davon." ;;
esac

cat <<'ABSCHLUSS'

Fertig.

ANMELDEN KOENNEN SICH GENAU DREI KONTEN, die Rollenkonten zum Vorfuehren:

  student@demo.invalid      STUDENT   Nele Reimers
  redaktion@demo.invalid    EDITOR    Henrik Osterloh
  admin@demo.invalid        ADMIN     Britta Sandvoss

Die sieben uebrigen Konten (Lena Brinkmann, Jonas Petersen, Aylin Demir,
Malte Focke, Sofia Kowalski, Timo Ahrens, Claudia Vogt) treten nur als
Autor:innen, Mitglieder und Kommentierende auf. Sie tragen keinen
brauchbaren Passwort-Hash und sind nicht anmeldbar: der Bestand steht auf
einem oeffentlich erreichbaren Server, und jedes anmeldbare Konto mehr
waere ein Ziel mehr.

Projekt 7 (DRAFT) und Projekt 8 (REVISION) gehoeren student@demo.invalid:
wer sich damit anmeldet, sieht sofort einen Entwurf und einen
zurueckgewiesenen Beitrag mit zwei offenen Aenderungswuenschen.

Sechs der zehn Projekte sind PUBLISHED und damit ohne Anmeldung zu sehen.
Die uebrigen zeigen die anderen Zustaende: APPROVED, SUBMITTED, DRAFT und
REVISION.
ABSCHLUSS

# Das Passwort wird GENAU EINMAL ausgegeben, und nur wenn dieser Lauf es
# selbst erzeugt hat. Wer es vorgibt, kennt es schon; es ein zweites Mal
# in die Sitzungshistorie zu schreiben waere ein Risiko ohne Nutzen.
if [ "$PASSWORT_ERZEUGT" = "ja" ]; then
	cat <<PASSWORT_HINWEIS

Passwort der drei Rollenkonten (einmalige Ausgabe, wird nicht gespeichert):

  $DEMO_PASSWORT

Notiere es jetzt. Es steht in keiner Datei und laesst sich aus dem
bcrypt-Hash nicht zurueckrechnen; ein neuer Lauf vergibt ein neues.
Wer ein eigenes setzen will, ruft das Skript mit DEMO_PASSWORT=... auf.
PASSWORT_HINWEIS
else
	echo
	echo "Passwort der drei Rollenkonten: das aus DEMO_PASSWORT."
fi
