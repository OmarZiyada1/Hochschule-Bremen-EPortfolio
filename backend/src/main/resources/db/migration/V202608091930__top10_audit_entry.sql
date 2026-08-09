-- KAN-45: Tabelle fuer das Aenderungsprotokoll der Top-10 (API-Contract §3.17).
--
-- Das Protokoll ist unveraenderlich: es gibt keinen schreibenden Endpoint und
-- kein Loeschen. Geschrieben wird ausschliesslich aus einer Service-Methode,
-- aufgerufen von vier Stellen (§3.17, Nachtrag v28): PUT /admin/top10, die
-- Annahme einer Nominierung, der Entzug des Platzes beim Verlassen von
-- PUBLISHED und das Loeschen eines Projekts, das einen Platz belegt.
--
-- project_id ist nullable und der Fremdschluessel steht auf
-- "on delete set null". Ein Projekt wird ueber DELETE /projects/{id} wirklich
-- geloescht (§6.1); mit "on delete cascade" verschwaenden dabei die
-- Protokollzeilen, die gerade festhalten, dass es einmal einen Platz belegt
-- hat. Die Zeile bleibt also stehen und verliert nur den Verweis. Zeitpunkt,
-- handelnde Person, Aktion und beide Positionen sind weiterhin lesbar.
--
-- admin_id kaskadiert bewusst nicht: DELETE /admin/users/{id} deaktiviert
-- statt zu loeschen (§6.1), der Fremdschluessel bleibt damit dauerhaft
-- gueltig. Trotz des Namens haelt die Spalte die handelnde Person und kann
-- auch eine Rolle EDITOR tragen, denn den Entzug beim Statuswechsel loest die
-- Redaktion aus (§3.17).
--
-- previous_position und new_position sind nullable, weil ADDED keinen
-- Vorher-Platz und REMOVED keinen Nachher-Platz hat. Ein Check-Constraint auf
-- diese Abhaengigkeit steht bewusst nicht da: §3.17 fordert ihn nicht, und die
-- Kombination ergibt sich aus einem einzigen Schreibweg im Service.
create table top10_audit_entry (
    id                uuid        primary key,
    timestamp         timestamptz not null,
    admin_id          uuid        not null,
    project_id        uuid,
    action            varchar(32) not null,
    previous_position integer     check (previous_position between 1 and 10),
    new_position      integer     check (new_position between 1 and 10),
    constraint ck_top10_audit_action
        check (action in ('ADDED', 'REMOVED', 'REORDERED')),
    constraint fk_top10_audit_entry_admin
        foreign key (admin_id) references app_user (id),
    constraint fk_top10_audit_entry_project
        foreign key (project_id) references project (id) on delete set null
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
-- Beide tragen einen Filter des Endpoints beziehungsweise die Aufloesung des
-- "on delete set null": admin_id ist der Filter "admin" aus §6.1, project_id
-- braucht Postgres beim Loeschen eines Projekts.
create index idx_top10_audit_entry_admin_id on top10_audit_entry (admin_id);
create index idx_top10_audit_entry_project_id on top10_audit_entry (project_id);

-- Die Standardsortierung des Endpoints ist "timestamp desc, id asc" (§6.6).
-- Ohne diesen Index sortiert Postgres bei jedem Seitenaufruf die ganze
-- Tabelle; das Protokoll waechst mit jeder Kuratierung und wird nie
-- aufgeraeumt.
create index idx_top10_audit_entry_timestamp on top10_audit_entry (timestamp desc, id asc);
