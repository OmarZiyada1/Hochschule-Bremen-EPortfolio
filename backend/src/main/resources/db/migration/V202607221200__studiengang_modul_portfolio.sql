-- Zweite Migration: Tabellen, die ausschliesslich auf bereits bestehende
-- Tabellen verweisen (fakultaet, app_user).

create table studiengang (
    id           uuid         primary key,
    name         varchar(255) not null,
    kuerzel      varchar(64),
    fakultaet_id uuid         not null references fakultaet (id)
);

create table modul (
    id             uuid         primary key,
    name           varchar(255) not null,
    kuerzel        varchar(64),
    studiengang_id uuid         not null references studiengang (id)
);

-- Ein Portfolio gehoert genau einem Benutzer; faellt der Benutzer weg,
-- faellt auch sein Portfolio weg.
create table portfolio (
    id              uuid        primary key,
    user_id         uuid        not null unique references app_user (id) on delete cascade,
    biografie       text,
    avatar_url      varchar(1024),
    erstellt_am     timestamptz not null,
    aktualisiert_am timestamptz not null
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
create index idx_studiengang_fakultaet_id on studiengang (fakultaet_id);
create index idx_modul_studiengang_id on modul (studiengang_id);
