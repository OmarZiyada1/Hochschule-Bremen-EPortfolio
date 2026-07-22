-- Sechste Migration: Inhaltsbloecke des Editors.
-- Ein Block = genau ein Top-Level-Knoten des ProseMirror-Dokuments.
-- inhalt enthaelt diesen Knoten unveraendert als JSON; typ ist die
-- abfragbare Projektion von inhalt.type. Die typabhaengige Struktur der
-- Payload wird im Service validiert, nicht im Schema.

create table block (
    id          uuid        primary key,
    projekt_id  uuid        not null references projekt (id) on delete cascade,
    typ         varchar(32) not null
        check (typ in ('UEBERSCHRIFT', 'TEXT', 'LISTE', 'ZITAT', 'CODE', 'FORMEL', 'TABELLE',
                       'TRENNLINIE', 'BILD', 'GALERIE', 'VIDEO', 'AUDIO', 'DOKUMENT', 'EINBETTUNG')),
    reihenfolge integer     not null,
    inhalt      jsonb       not null,
    -- DEFERRABLE, damit beim Umsortieren innerhalb einer Transaktion
    -- Zwischenzustaende erlaubt sind; geprueft wird erst beim Commit.
    constraint uq_block_projekt_reihenfolge
        unique (projekt_id, reihenfolge) deferrable initially deferred
);

-- Kein separater Index auf projekt_id: der Unique-Index auf
-- (projekt_id, reihenfolge) traegt projekt_id als fuehrende Spalte und
-- deckt die Suche nach Projekt bereits ab.
