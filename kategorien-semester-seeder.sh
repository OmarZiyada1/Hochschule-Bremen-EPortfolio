#!/usr/bin/env bash
# ===================================================================
# Kategorien und Semester: die zwei Stammdatenarten, die auf PROD
# sonst niemand anlegt.
#
# EIN Aufruf, aus dem Wurzelverzeichnis des Repos, bei laufender
# Datenbank der gewuenschten Betriebsart:
#
#     DB_CONTAINER=eportfolio-prod-db-1 bash kategorien-semester-seeder.sh
#
# Ohne DB_CONTAINER trifft der Lauf die Datenbank von DEV.
#
# Danach steht in der Datenbank:
#
#      8 Kategorien   (§3.6 bis §3.9)
#      4 Semester     (§3.18), aelteste zuerst
#
# WOZU DAS NOETIG IST (KAN-99). Beide Arten kommen im laufenden
# Programm ausschliesslich aus dem DevMasterDataSeeder, und der traegt
# @Profile("dev"). Auf PROD entstehen sie deshalb nie. Die Wirkung ist
# unauffaellig und trifft spaet: GET /api/categories und
# GET /api/semesters antworten mit 200 und einer LEEREN Liste, die
# Auswahlfelder im Metadatenformular bleiben leer, und erst beim
# Einreichen schlaegt es zu. ProjectWorkflowService fuehrt categoryId
# und semesterId als Pflichtfelder; ohne sie endet jeder Einreichversuch
# mit 400 PROJECT_INCOMPLETE. Wer das nicht weiss, sucht den Fehler im
# Formular.
#
# WARUM EIN SKRIPT UND KEINE MIGRATION. Es ist eine Datenlieferung und
# keine Schemaaenderung. Eine Migration truege sie ausserdem in jede
# Umgebung, auch in eine, die ihren Bestand redaktionell pflegt; genau
# diese Ueberlegung steht schon im Kopf von stammdaten-seeder.sh.
#
# WARUM KEIN JAVA-SEEDER OHNE PROFIL. Dann entstuenden die Zeilen bei
# jedem Start in jeder Umgebung neu, auch dort, wo jemand sie bewusst
# geloescht oder umbenannt hat. Ein Skript laeuft, wenn es jemand
# aufruft.
#
# DIE WERTE SIND DIESELBEN wie im DevMasterDataSeeder. Das ist Absicht:
# ein zweiter, leicht abweichender Bestand waere schlimmer als keiner,
# weil dann Entwicklungs- und Betriebsumgebung verschiedene Filter
# anbieten und niemand sagen kann, welcher der richtige ist.
#
# WIEDERHOLBAR. Beide Tabellen fuehren name als unique. Vorhandene
# Zeilen bleiben unangetastet, es kommt nur dazu, was fehlt. Das Skript
# loescht nichts und benennt nichts um.
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
	abbruch "Container $DB laeuft nicht.
         Betriebsart starten oder DB_CONTAINER richtig setzen, etwa
         DB_CONTAINER=eportfolio-prod-db-1"
fi
docker exec "$DB" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
	|| abbruch "Die Datenbank $DB_NAME antwortet nicht."
echo "  Container $DB laeuft, Datenbank antwortet"
echo

echo "== Stand vorher =="
sql -c "
select 'Kategorien' as bestand, count(*) from category
union all select 'Semester', count(*) from semester;"
echo

echo "== Schreiben =="
sql <<'ENDE_SQL_BASIS'
begin;

-- -------------------------------------------------------------------
-- 1) Kategorien
--
-- category fuehrt name als unique (V202607221100, dort noch als
-- kategorie). "where not exists" statt "on conflict do nothing": der
-- Unterschied faellt hier nicht auf, aber ein on-conflict verbraucht
-- bei jedem Lauf Sequenzwerte und ist bei einer Tabelle ohne Sequenz
-- schlicht die unnoetigere Formulierung.
--
-- Die Liste ist bewusst kurz und allgemein. Sie soll die Filterleiste
-- fuellen, nicht eine fachliche Taxonomie vorwegnehmen; dieselbe
-- Begruendung steht am DevMasterDataSeeder.
-- -------------------------------------------------------------------
insert into category (id, name)
select gen_random_uuid(), v.name
from (values
	('Abschlussarbeit'),
	('Forschungsprojekt'),
	('Interaktive Medien'),
	('Lehrveranstaltung'),
	('Praxisprojekt'),
	('Semesterprojekt'),
	('Studentische Initiative'),
	('Wettbewerbsbeitrag')
) as v(name)
where not exists (select 1 from category c where c.name = v.name);

-- -------------------------------------------------------------------
-- 2) Semester
--
-- active und sort_order sind not null OHNE Vorgabewert; die Migration
-- V202608161915 begruendet das ausdruecklich damit, dass JPA beide
-- Spalten bei jedem Insert mitschreibt. Sie stehen hier deshalb
-- ausgeschrieben.
--
-- Die Position wird BERECHNET und nicht fest vergeben, genau wie im
-- DevMasterDataSeeder: auf einer gewachsenen Datenbank hat die
-- Uebernahme aus KAN-65 moeglicherweise schon Semester aus den
-- frueheren Freitexten angelegt, und feste Zahlen wuerden deren
-- Reihenfolge ueberschreiben. Der Unterabfragewert steht durch den
-- Anweisungs-Schnappschuss fuer alle vier Zeilen fest, die vier
-- bekommen also aufsteigende und untereinander verschiedene Werte.
--
-- Aeltestes Semester zuerst (§3.18). Die Schreibweise ist die des
-- Templates "Semester"; der Filter aus §6.1 vergleicht exakt, weshalb
-- "WiSe 2025/26" und "WS 25/26" zwei verschiedene Semester waeren.
-- -------------------------------------------------------------------
insert into semester (id, name, active, sort_order)
select gen_random_uuid(), v.name, true,
       coalesce((select max(sort_order) from semester), 0) + v.pos
from (values
	('WiSe 2024/25', 1),
	('SoSe 2025',    2),
	('WiSe 2025/26', 3),
	('SoSe 2026',    4)
) as v(name, pos)
where not exists (select 1 from semester s where s.name = v.name);

commit;
ENDE_SQL_BASIS
echo "  geschrieben"
echo

echo "== Stand nachher =="
sql -c "
select 'Kategorien' as bestand, count(*) from category
union all select 'Semester', count(*) from semester;"
echo

echo "== Semester in ihrer Reihenfolge =="
sql -c "select sort_order, name, active from semester order by sort_order;"
echo

# Gegenprobe. Zaehlt nicht die Gesamtzahl (die darf hoeher sein, wenn
# jemand eigene Eintraege gepflegt hat), sondern ob JEDER erwartete
# Name da ist. Eine hoehere Zahl ist in Ordnung, ein fehlender Name
# nicht.
fehlend=$(sql -tAc "
select string_agg(name, ', ')
from (
  select v.name from (values
    ('Abschlussarbeit'),('Forschungsprojekt'),('Interaktive Medien'),
    ('Lehrveranstaltung'),('Praxisprojekt'),('Semesterprojekt'),
    ('Studentische Initiative'),('Wettbewerbsbeitrag')
  ) as v(name)
  where not exists (select 1 from category c where c.name = v.name)
  union all
  select v.name from (values
    ('WiSe 2024/25'),('SoSe 2025'),('WiSe 2025/26'),('SoSe 2026')
  ) as v(name)
  where not exists (select 1 from semester s where s.name = v.name)
) as offen;")

if [ -n "$fehlend" ]; then
	abbruch "Diese Eintraege fehlen nach dem Lauf: $fehlend"
fi

echo "FERTIG. Kategorien und Semester stehen vollstaendig."
echo
echo "Naechster Schritt auf einer frischen Umgebung:"
echo "  DB_CONTAINER=$DB bash stammdaten-seeder.sh"
echo "  (Fakultaeten, Studiengaenge und Module; nur EINMAL ausfuehren,"
echo "   ein zweiter Lauf loest die Zuordnung vorhandener Projekte)"
