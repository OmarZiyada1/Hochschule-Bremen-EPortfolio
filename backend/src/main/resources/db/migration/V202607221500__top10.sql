-- Fuenfte Migration: Top-10.

-- Bewusst KEIN Unique auf position: beim Umsortieren der Liste waeren
-- Zwischenzustaende sonst nicht darstellbar. Die Eindeutigkeit der
-- Positionen sichert der Service.
create table top10_eintrag (
    id             uuid        primary key,
    projekt_id     uuid        not null unique references projekt (id) on delete cascade,
    position       integer     not null check (position between 1 and 10),
    aufgenommen_am timestamptz not null
);

create table top10_nominierung (
    id                      uuid        primary key,
    projekt_id              uuid        not null references projekt (id) on delete cascade,
    nominiert_von           uuid        not null references app_user (id),
    vorgeschlagene_position integer     check (vorgeschlagene_position between 1 and 10),
    status                  varchar(32) not null default 'OFFEN'
        check (status in ('OFFEN', 'ANGENOMMEN', 'ABGELEHNT')),
    entschieden_von         uuid        references app_user (id),
    entschieden_am          timestamptz,
    erstellt_am             timestamptz not null
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
create index idx_top10_nominierung_projekt_id on top10_nominierung (projekt_id);
create index idx_top10_nominierung_status on top10_nominierung (status);
create index idx_top10_nominierung_nominiert_von on top10_nominierung (nominiert_von);
