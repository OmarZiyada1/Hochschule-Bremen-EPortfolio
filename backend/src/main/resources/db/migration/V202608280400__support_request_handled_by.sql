-- KAN-85: Die Support-Anfrage haelt fest, wer ihren Stand zuletzt gesetzt hat
-- (API-Contract v88, §3.20). Die Liste zeigte bis dahin einen
-- Bearbeitungsstand, aber niemanden dazu; in einem Eingangsbuch, an dem
-- mehrere Personen arbeiten, ist "in Bearbeitung" ohne Namen keine brauchbare
-- Auskunft, und nach dem Abschluss laesst sich nicht mehr sagen, wer erledigt
-- hat.
--
-- Zwei Spalten und nicht vier: was der Name bedeutet, sagt der status daneben.
-- Bei IN_PROGRESS ist es die zustaendige Person, bei RESOLVED die erledigende,
-- bei einem wieder geoeffneten OPEN die zurueckholende. Getrennte Spalten
-- in_progress_by und resolved_by waeren die genauere Auskunft, braeuchten aber
-- eine Aufraeumregel je Uebergang; der volle Verlauf gehoerte in eine
-- Historientabelle wie project_status_history und ist fuer ein Eingangsbuch
-- dieser Groesse bewusst nicht Teil dieser Version.

alter table support_request
    -- Nullable und ohne Backfill: die Tabelle ist mit V202608280300 neu
    -- entstanden, und eine Anfrage, die noch niemand angefasst hat, hat
    -- richtigerweise keinen Namen. Ein Standardwert waere hier eine
    -- Behauptung.
    add column handled_by_user_id uuid references app_user (id) on delete set null,
    add column handled_at         timestamptz;

-- Beide Spalten gelten nur gemeinsam. Ohne diese Bedingung koennte ein
-- fehlerhafter Schreibweg einen Zeitpunkt ohne Person oder eine Person ohne
-- Zeitpunkt hinterlassen, und die Anzeige muesste raten, was sie damit meint.
alter table support_request
    add constraint ck_support_request_handled
        check ((handled_by_user_id is null) = (handled_at is null));

-- Die Gegenrichtung des Fremdschluessels (Regel 6 im Skill flyway-migration).
-- Ohne ihn muesste das Loeschen eines Kontos die ganze Tabelle lesen, um die
-- Zeilen zu finden, deren Verweis auf null zu setzen ist.
create index ix_support_request_handled_by on support_request (handled_by_user_id);
