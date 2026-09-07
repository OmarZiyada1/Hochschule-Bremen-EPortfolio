#!/usr/bin/env bash
# ===================================================================
# Richtet EINE Sitzung der Usability-Testwoche her.
#
#     bash test-sitzung.sh TN03
#
# Bequemer ueber das Menue: .\eportfolio.ps1, Punkt s5. Setzt
# test-seeder.sh voraus; ohne dessen gemeinsamen Bestand hat dieses
# Skript nichts, woran es die Vorbedingungen einstellen koennte.
#
# EINMAL JE SITZUNG, nicht einmal je Testtag. Das Blatt "Nach der
# Sitzung" verlangt zwischen zwei Personen ein Zuruecksetzen des
# Datenbestands (Abschnitt 2) und traegt es im Ruecksetzprotokoll ein;
# genau diesen Schritt macht dieses Skript. Es ist deshalb kein reines
# Anlegen: es raeumt zuerst weg, was die vorige Sitzung hinterlassen
# hat, und stellt danach den Zustand her, den die Aufgaben des
# Rollenblocks brauchen.
#
# WER WELCHE ROLLE UND WELCHE BLOECKE HAT
#   TN00              Pilot, zaehlt nicht     STUDENT   A, dann B
#   TN01 bis TN05     Studierende             STUDENT   A, dann B
#   TN06, TN07        Redaktion               EDITOR    A, dann C
#   TN08, TN11        extern                  kein Konto, nur Block A
#   TN09, TN10        Administration          ADMIN     A, dann D
# Quelle: Testmaterial/17_Vor_der_Sitzung.docx, Abschnitt 2.
#
# WAS JE ROLLENBLOCK EINGESTELLT WIRD
#   Block B  Das Konto hat keine Projekte und keine Kurzbiografie. B2
#            legt das erste Projekt an, B7 schreibt die erste Biografie;
#            beides waere sonst schon da.
#   Block C  Vier Projekte im Status Eingereicht sind diesem Konto als
#            Redaktion zugewiesen, zwei davon aus fremder Feder. Dazu
#            ein veroeffentlichtes Projekt fuer die Nominierung in C5.
#   Block D  Das Zusatzkonto aus D2 steht wieder auf STUDENT, die zwei
#            gleichbedeutenden Kategorien tragen wieder je mindestens
#            drei Projekte, die fuenf Projekte aus D4 stehen wieder auf
#            Genehmigt, die Top 10 ist leer und die Nominierungen stehen
#            wieder offen. Das Aenderungsprotokoll bleibt stehen: D6
#            braucht Eintraege verschiedener Personen.
#   TN08, TN11  Kein Konto und keine Rollenvorbereitung. Sie bearbeiten
#            nur Block A und melden sich nie an; das Zugangsdatenblatt
#            entfaellt fuer sie.
#
# DAS PASSWORT kommt aus dem Konto dev-studi@dev.invalid: bcrypt laesst
# sich in SQL nicht rechnen, und ein erfundener Hash ergaebe ein Konto,
# an dem sich niemand anmeldet. Es ist damit dasselbe wie DEV_TEST_PASSWORD
# aus der .env. Auf das Zugangsdatenblatt kommt genau dieser Wert.
#
# WIEDERHOLBAR ueber feste ID-Praefixe:
#   7e5700f0-...  Sitzungskonten (die letzten beiden Stellen sind die
#                 Teilnehmernummer)
#   7e5700f1-...  deren Portfolios
# Alles Uebrige gehoert dem gemeinsamen Bestand aus test-seeder.sh.
#
# Andere Containernamen? Ueber Umgebungsvariablen:
#   DB_CONTAINER=... bash test-sitzung.sh TN03
# ===================================================================
set -euo pipefail

DB="${DB_CONTAINER:-eportfolio-dev-db-1}"
DB_USER="${POSTGRES_USER:-eportfolio}"
DB_NAME="${POSTGRES_DB:-eportfolio}"

sql() { docker exec -i -e PGCLIENTENCODING=UTF8 "$DB" \
	psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" "$@"; }

abbruch() { echo; echo "ABBRUCH: $1" >&2; exit 1; }

# -------------------------------------------------------------------
# 0) Teilnehmer und Rolle bestimmen.
# -------------------------------------------------------------------
TN="${1:-}"
[ -n "$TN" ] || abbruch "Kein Pseudonym angegeben. Aufruf: bash test-sitzung.sh TN03"
TN=$(echo "$TN" | tr '[:lower:]' '[:upper:]')

case "$TN" in
	TN00|TN01|TN02|TN03|TN04|TN05) ROLLE=STUDENT; BLOCK=B ;;
	TN06|TN07)                     ROLLE=EDITOR;  BLOCK=C ;;
	TN09|TN10)                     ROLLE=ADMIN;   BLOCK=D ;;
	TN08|TN11)                     ROLLE="";      BLOCK=A ;;
	*) abbruch "Unbekanntes Pseudonym: $TN. Erwartet wird TN00 bis TN11." ;;
esac

NUMMER="${TN#TN}"
KONTO_ID="7e5700f0-0000-4000-8000-0000000000${NUMMER}"
PORTFOLIO_ID="7e5700f1-0000-4000-8000-0000000000${NUMMER}"
EMAIL="tn${NUMMER}@test.invalid"
HSB_EMAIL="tn${NUMMER}@stud.hs-bremen.de"
[ "$ROLLE" = "STUDENT" ] || HSB_EMAIL="tn${NUMMER}@hs-bremen.de"

echo "== Sitzung $TN =="
echo "  Rollenblock: $BLOCK"
if [ -z "$ROLLE" ]; then
	echo "  Rolle:       keine, externe Kurzsitzung"
else
	echo "  Rolle:       $ROLLE"
fi
echo

# -------------------------------------------------------------------
# 1) Vorbedingungen.
# -------------------------------------------------------------------
echo "== Vorbedingungen =="
command -v docker >/dev/null 2>&1 || abbruch "docker nicht gefunden."
if [ "$(docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null)" != "true" ]; then
	abbruch "Container $DB laeuft nicht."
fi
docker exec "$DB" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
	|| abbruch "Die Datenbank $DB_NAME antwortet nicht."

bestand=$(sql -tAc "select count(*) from project where id::text like '7e570011-%';" | tr -d '[:space:]')
[ "$bestand" != "0" ] || abbruch "Der gemeinsame Testbestand fehlt.
         Erst anlegen: bash test-seeder.sh (Menuepunkt s3)."
echo "  Container laeuft, gemeinsamer Testbestand vorhanden ($bestand Projekte)"

if [ -n "$ROLLE" ]; then
	hash_da=$(sql -tAc "select count(*) from app_user where email = 'dev-studi@dev.invalid';" | tr -d '[:space:]')
	[ "$hash_da" = "1" ] || abbruch "Das Konto dev-studi@dev.invalid fehlt.
         Aus ihm stammt der Passwort-Hash des Testkontos. Es entsteht
         beim Start des Backends im Profil dev (DevTestnutzerSeeder)."
	echo "  Passwortquelle dev-studi@dev.invalid vorhanden"
fi
echo

# -------------------------------------------------------------------
# 2) Reste der vorigen Sitzung dieses Pseudonyms wegraeumen.
#
#    Zuerst und immer, auch bei TN08 und TN11: ein Pseudonym kann als
#    Ersatztermin ein zweites Mal drankommen, und dann darf das Projekt
#    aus dem vorigen Durchgang nicht mehr dastehen.
# -------------------------------------------------------------------
echo "== Reste der vorigen Sitzung wegraeumen =="
sql <<ENDE_SQL_SITZUNG_WEG
begin;

-- Was das Konto selbst angelegt hat. Bloecke, Dateizeilen, Mitglieder,
-- Zuweisungen, Schlagwortbezuege, Statusverlauf, Kommentare und
-- Reaktionen haengen per Kaskade am Projekt; nicht kaskadierend sind
-- comment.author_id, stored_file.uploaded_by und
-- project_status_history.changed_by, deshalb die eigenen Zeilen zuerst.
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
ENDE_SQL_SITZUNG_WEG
echo "  weggeraeumt"
echo

# -------------------------------------------------------------------
# 3) Konto anlegen. Nicht bei den externen Sitzungen.
# -------------------------------------------------------------------
if [ -z "$ROLLE" ]; then
	echo "== Konto =="
	echo "  Entfaellt: $TN bearbeitet nur Block A und meldet sich nie an."
	echo "  Auch das Zugangsdatenblatt wird fuer diese Sitzung nicht gebraucht."
	echo
else
	echo "== Konto anlegen =="
	sql <<ENDE_SQL_SITZUNG_KONTO
begin;

insert into app_user (id, email, hsb_email, email_verified, hsb_email_verified,
                      password_hash, first_name, last_name, role, status,
                      password_change_required, created_at, updated_at)
select '${KONTO_ID}'::uuid, '${EMAIL}', '${HSB_EMAIL}', true, true,
       q.password_hash, 'Testperson', '${TN}', '${ROLLE}', 'ACTIVE',
       false, now(), now()
from app_user q
where q.email = 'dev-studi@dev.invalid';

-- Jedes Konto bekommt sein Portfolio (Contract §3.2.1). Die
-- Kurzbiografie bleibt leer: Aufgabe B7 schreibt die erste.
insert into portfolio (id, user_id, biography, avatar_url, created_at, updated_at)
values ('${PORTFOLIO_ID}'::uuid, '${KONTO_ID}'::uuid, null, null, now(), now());

commit;
ENDE_SQL_SITZUNG_KONTO
	echo "  angelegt"
	echo
fi

# -------------------------------------------------------------------
# 4) Vorbedingungen des Rollenblocks einstellen.
# -------------------------------------------------------------------
case "$BLOCK" in
B)
	echo "== Block B vorbereiten =="
	echo "  Das Konto hat keine Projekte und keine Kurzbiografie."
	echo "  Mehr braucht Block B nicht: B2 legt das erste Projekt an."
	;;
C)
	echo "== Block C vorbereiten =="
	sql <<ENDE_SQL_SITZUNG_C
begin;

-- Die vier Projekte des Arbeitsvorrats zurueck auf Eingereicht. Eine
-- vorige Sitzung kann C2 (Ueberarbeitung) und C3 (Veroeffentlicht)
-- schon durchlaufen haben.
update project
set status = 'SUBMITTED', published_at = null, version = version + 1, updated_at = now()
where id::text like '7e570011-%'
  and id in ('7e570011-0000-4000-8000-000000000051'::uuid,
             '7e570011-0000-4000-8000-000000000052'::uuid,
             '7e570011-0000-4000-8000-000000000053'::uuid,
             '7e570011-0000-4000-8000-000000000054'::uuid);

-- Aenderungsaufforderungen und Notizen der vorigen Sitzung entfernen,
-- sonst steht die Begruendung aus C2 schon da.
delete from comment
where project_id in ('7e570011-0000-4000-8000-000000000051'::uuid,
                     '7e570011-0000-4000-8000-000000000052'::uuid,
                     '7e570011-0000-4000-8000-000000000053'::uuid,
                     '7e570011-0000-4000-8000-000000000054'::uuid);

-- Diese Testperson ist die zustaendige Redaktion der vier Projekte.
insert into project_editor (project_id, user_id)
select v.id::uuid, '${KONTO_ID}'::uuid
from (values ('7e570011-0000-4000-8000-000000000051'),
             ('7e570011-0000-4000-8000-000000000052'),
             ('7e570011-0000-4000-8000-000000000053'),
             ('7e570011-0000-4000-8000-000000000054')) as v(id)
on conflict do nothing;

commit;
ENDE_SQL_SITZUNG_C
	echo "  Vier Projekte im Status Eingereicht, dieser Testperson zugewiesen."
	sql -c "select title as \"Titel im Arbeitsvorrat\"
	        from project
	        where id::text like '7e570011-0000-4000-8000-00000000005%'
	        order by id;"
	echo "  Fuer die Aufgabenkarten: C2 nimmt den ersten, C3 den zweiten Titel."
	;;
D)
	echo "== Block D vorbereiten =="
	sql <<'ENDE_SQL_SITZUNG_D'
begin;

-- D2: das Zusatzkonto zurueck auf STUDENT.
update app_user set role = 'STUDENT', updated_at = now()
where id = '7e570010-0000-4000-8000-000000000040'::uuid;

-- D3: die zwei gleichbedeutenden Kategorien wiederherstellen. Eine
-- vorige Sitzung hat eine davon in die andere zusammengefuehrt; dabei
-- verschwindet die Zeile und die Projekte haengen an der anderen.
insert into category (id, name)
values ('7e570015-0000-4000-8000-000000000001', 'Studienprojekt'),
       ('7e570015-0000-4000-8000-000000000002', 'Studentisches Projekt')
on conflict (id) do update set name = excluded.name;

-- Je drei Projekte zurueck an ihre Kategorie. Welche das sind, legt
-- test-seeder.sh fest; die Nummern stehen dort im selben Block.
update project set category_id = '7e570015-0000-4000-8000-000000000001'::uuid
where id in ('7e570011-0000-4000-8000-000000000041'::uuid,
             '7e570011-0000-4000-8000-000000000042'::uuid,
             '7e570011-0000-4000-8000-000000000043'::uuid);

update project set category_id = '7e570015-0000-4000-8000-000000000002'::uuid
where id in ('7e570011-0000-4000-8000-000000000044'::uuid,
             '7e570011-0000-4000-8000-000000000045'::uuid,
             '7e570011-0000-4000-8000-000000000046'::uuid);

-- D4: die fuenf Projekte zurueck auf Genehmigt.
update project
set status = 'APPROVED', published_at = null, version = version + 1, updated_at = now()
where id::text like '7e570011-0000-4000-8000-00000000006%';

-- D5: Top 10 leeren und die Nominierungen wieder auf offen setzen.
-- Das Aenderungsprotokoll bleibt ausdruecklich stehen: D6 sucht darin
-- Eintraege verschiedener Personen, und die entstehen nur ueber die
-- Zeit.
delete from top10_entry;

update top10_nomination
set status = 'PENDING', decided_by = null, decided_at = null
where id::text like '7e570017-%';

commit;
ENDE_SQL_SITZUNG_D
	echo "  Zusatzkonto auf STUDENT, Kategorien wiederhergestellt,"
	echo "  fuenf Projekte auf Genehmigt, Top 10 leer, Nominierungen offen."
	sql -c "select first_name || ' ' || last_name as \"Name fuer Aufgabe D2\",
	               hsb_email as \"Hochschuladresse\"
	        from app_user where id = '7e570010-0000-4000-8000-000000000040'::uuid;"
	;;
A)
	echo "== Kein Rollenblock =="
	echo "  $TN bearbeitet nur Block A. Der gemeinsame Bestand genuegt."
	;;
esac
echo

# -------------------------------------------------------------------
# 5) Was auf die Blaetter kommt.
# -------------------------------------------------------------------
echo "== Fuer die Testleitung =="
if [ -n "$ROLLE" ]; then
	echo "  Zugangsdatenblatt, Zeile $TN:"
	echo "    Testkonto (Kennung)   $EMAIL"
	echo "    Hochschuladresse      $HSB_EMAIL"
	echo "    Passwort              der Wert von DEV_TEST_PASSWORD aus der .env"
	echo
	if [ "$BLOCK" = "B" ]; then
		# Nur in Block B meldet sich die Testperson selbst an: das ist
		# Aufgabe B1. In C und D meldet die Moderation vorher an
		# (Testmaterial/12_Moderation.docx, Ablaufschritt 4).
		echo "  Aufgabenkarte B1 nennt BEIDE Adressen und das Passwort, ohne zu"
		echo "  verraten, welche die Kennung ist. Die Kennung ist $EMAIL."
		echo "  Die Karte wird nach der Sitzung vernichtet."
	else
		echo "  In Block $BLOCK meldet die Moderation vor dem Rollenblock an."
		echo "  Es gibt hier keine Karte B1; die Anmeldung ist keine Aufgabe."
	fi
else
	echo "  Kein Zugangsdatenblatt und keine Karte B1: $TN meldet sich nicht an."
fi
echo
echo "  Nicht vergessen (Blatt \"Vor der Sitzung\", Abschnitt 4):"
echo "    - frisches Browserprofil, keine offene Anmeldung, kein Verlauf"
echo "    - Bilddatei fuer B3 sichtbar auf dem Schreibtisch des Testrechners"
echo "    - Seed einmal gegen die Pruefliste zaehlen: bash test-seeder-pruefen.sh"
echo
echo "Fertig."
