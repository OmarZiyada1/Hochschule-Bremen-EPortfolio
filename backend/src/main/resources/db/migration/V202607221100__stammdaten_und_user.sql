-- Erste Migration: Tabellen ohne Fremdschluessel.
-- Abhaengige Tabellen folgen in spaeteren Migrationen.

-- "user" ist in Postgres ein reserviertes Wort, daher app_user.
-- email     = private Adresse, dient zugleich als Login-Kennung.
-- hsb_email = Hochschuladresse, weist die Zugehoerigkeit zur HSB nach.
-- Beide werden getrennt verifiziert; erst danach wird das Konto aktiv.
create table app_user (
    id                    uuid         primary key,
    email                 varchar(255) not null unique,
    hsb_email             varchar(255) not null unique,
    email_verifiziert     boolean      not null default false,
    hsb_email_verifiziert boolean      not null default false,
    passwort_hash         varchar(255) not null,
    vorname               varchar(255) not null,
    nachname              varchar(255) not null,
    rolle                 varchar(32)  not null
        check (rolle in ('STUDIERENDE', 'REDAKTEUR', 'ADMIN')),
    status                varchar(32)  not null default 'REGISTRIERUNG_OFFEN'
        check (status in ('REGISTRIERUNG_OFFEN', 'AKTIV', 'DEAKTIVIERT')),
    erstellt_am           timestamptz  not null,
    aktualisiert_am       timestamptz  not null
);

create table kategorie (
    id   uuid         primary key,
    name varchar(255) not null unique
);

create table fakultaet (
    id      uuid         primary key,
    name    varchar(255) not null,
    kuerzel varchar(64)  not null unique
);
