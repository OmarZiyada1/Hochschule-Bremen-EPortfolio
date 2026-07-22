-- Dritte Migration: das Projekt-Aggregat.
-- Die Tabelle "block" fehlt hier bewusst (offene fachliche Frage) und folgt spaeter.

create table projekt (
    id                 uuid         primary key,
    titel              varchar(255) not null,
    kurzbeschreibung   varchar(1024),
    cover_bild_url     varchar(1024),
    status             varchar(32)  not null default 'ENTWURF'
        check (status in ('ENTWURF', 'EINGEREICHT', 'GENEHMIGT', 'VEROEFFENTLICHT', 'UEBERARBEITUNG')),
    projekttyp         varchar(32)
        check (projekttyp in ('REGULAR', 'PAPER', 'THESIS')),
    abschluss          varchar(32)
        check (abschluss in ('BACHELOR', 'MASTER', 'MBA')),
    -- Bewusst OHNE on delete cascade: ein Projekt darf nicht verschwinden,
    -- nur weil ein Benutzer geloescht wird.
    autor_id           uuid         not null references app_user (id),
    fakultaet_id       uuid         references fakultaet (id),
    studiengang_id     uuid         references studiengang (id),
    modul_id           uuid         references modul (id),
    kategorie_id       uuid         references kategorie (id),
    semester           varchar(64),
    erstellt_am        timestamptz  not null,
    aktualisiert_am    timestamptz  not null,
    veroeffentlicht_am timestamptz
);

create table projekt_tag (
    projekt_id uuid        not null references projekt (id) on delete cascade,
    tag        varchar(64) not null,
    primary key (projekt_id, tag)
);

create table projekt_redakteur (
    projekt_id uuid not null references projekt (id) on delete cascade,
    user_id    uuid not null references app_user (id) on delete cascade,
    primary key (projekt_id, user_id)
);

create table projektmitglied (
    id               uuid         primary key,
    projekt_id       uuid         not null references projekt (id) on delete cascade,
    user_id          uuid         not null references app_user (id) on delete cascade,
    rolle_im_projekt varchar(255) not null,
    unique (projekt_id, user_id)
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
create index idx_projekt_autor_id on projekt (autor_id);
create index idx_projekt_fakultaet_id on projekt (fakultaet_id);
create index idx_projekt_studiengang_id on projekt (studiengang_id);
create index idx_projekt_modul_id on projekt (modul_id);
create index idx_projekt_kategorie_id on projekt (kategorie_id);
create index idx_projekt_status on projekt (status);

-- projekt_id ist jeweils schon durch den Primaerschluessel bzw. das Unique
-- abgedeckt, die Gegenrichtung ueber user_id nicht.
create index idx_projekt_redakteur_user_id on projekt_redakteur (user_id);
create index idx_projektmitglied_user_id on projektmitglied (user_id);
