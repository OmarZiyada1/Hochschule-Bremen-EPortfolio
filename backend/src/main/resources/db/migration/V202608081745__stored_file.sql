-- KAN-23: Tabelle fuer hochgeladene Dateien (API-Contract §3.15).
--
-- Die Bytes liegen nicht in dieser Tabelle und auch nicht auf dem
-- Anwendungsserver, sondern in einem Objektspeicher (§3.15.1). Die Zeile
-- haelt nur die Metadaten und in "path" den anbieterneutralen
-- Speicherschluessel der Form projects/{projectId}/{uuid} beziehungsweise
-- avatars/{uuid}. Weder Containername noch Endpoint stehen darin: sonst
-- waere ein Anbieterwechsel eine Datenmigration ueber alle Dateizeilen,
-- mit neutralem Schluessel ist er das Kopieren der Objekte und eine
-- geaenderte Umgebungsvariable.
--
-- project_id ist nullable: null bedeutet Avatar (§3.15), und Avatare
-- gehoeren zu einer Person, nicht zu einem Projekt.
--
-- on delete cascade nur am Projekt: das Loeschen eines Projekts nimmt seine
-- Dateizeilen mit. uploaded_by kaskadiert bewusst nicht, denn wer
-- hochgeladen hat, ist Teil der Rechtepruefung beim Loeschen (§6.1,
-- "Uploader:in / ADMIN") und darf nicht mit dem Konto verschwinden.
create table stored_file (
    id          uuid         primary key,
    project_id  uuid,
    uploaded_by uuid         not null,
    file_name   varchar(255) not null,
    mime_type   varchar(64)  not null,
    size        bigint       not null,
    path        varchar(255) not null,
    created_at  timestamptz  not null,
    constraint fk_stored_file_project
        foreign key (project_id) references project (id) on delete cascade,
    constraint fk_stored_file_uploaded_by
        foreign key (uploaded_by) references app_user (id)
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
-- Gesucht wird nach den Dateien eines Projekts (Kaskade, spaetere
-- Aufraeumlaeufe); uploaded_by braucht keinen eigenen Index, solange keine
-- Abfrage darueber laeuft.
create index idx_stored_file_project_id on stored_file (project_id);
