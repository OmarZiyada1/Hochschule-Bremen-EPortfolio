-- Vierte Migration: Tabellen, die am Projekt haengen.

-- status ist nur bei typ = 'AENDERUNG' gesetzt, sonst null. Diese Regel wird
-- bewusst im Service geprueft und hier NICHT durch die DB erzwungen.
create table kommentar (
    id              uuid        primary key,
    projekt_id      uuid        not null references projekt (id) on delete cascade,
    autor_id        uuid        not null references app_user (id),
    typ             varchar(32) not null
        check (typ in ('ANTWORT', 'NOTIZ', 'AENDERUNG')),
    text            text        not null,
    status          varchar(32)
        check (status in ('OFFEN', 'ERLEDIGT')),
    erstellt_am     timestamptz not null,
    aktualisiert_am timestamptz not null
);

-- Eine Person kann pro Projekt hoechstens einmal reagieren.
create table reaktion (
    id          uuid        primary key,
    projekt_id  uuid        not null references projekt (id) on delete cascade,
    user_id     uuid        not null references app_user (id) on delete cascade,
    erstellt_am timestamptz not null,
    unique (projekt_id, user_id)
);

-- von_status ist beim ersten Uebergang null (es gab noch keinen Vorzustand).
create table projekt_status_historie (
    id            uuid        primary key,
    projekt_id    uuid        not null references projekt (id) on delete cascade,
    von_status    varchar(32)
        check (von_status in ('ENTWURF', 'EINGEREICHT', 'GENEHMIGT', 'VEROEFFENTLICHT', 'UEBERARBEITUNG')),
    nach_status   varchar(32) not null
        check (nach_status in ('ENTWURF', 'EINGEREICHT', 'GENEHMIGT', 'VEROEFFENTLICHT', 'UEBERARBEITUNG')),
    geaendert_von uuid        not null references app_user (id),
    zeitpunkt     timestamptz not null
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
create index idx_kommentar_projekt_id on kommentar (projekt_id);
create index idx_kommentar_autor_id on kommentar (autor_id);
create index idx_reaktion_projekt_id on reaktion (projekt_id);
create index idx_reaktion_user_id on reaktion (user_id);
create index idx_projekt_status_historie_projekt_id on projekt_status_historie (projekt_id);
