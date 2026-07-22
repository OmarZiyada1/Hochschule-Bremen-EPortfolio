-- Nachtrag zu block (KAN-9): Versionierung des Block-Formats und
-- Audit-Zeitstempel wie bei den uebrigen Entities.

-- Version des Block-JSON-Formats (API-Contract §2.10), Default 1.
alter table block
    add column schema_version integer not null default 1;

-- Audit-Spalten fuer die Umstellung von Block auf AuditableEntity.
-- Default now() nur zum Befuellen etwaiger Bestandszeilen; danach entfernt,
-- damit die Spalten wie bei allen anderen Tabellen vom JPA-Auditing
-- geschrieben werden und nicht still von der DB.
alter table block
    add column erstellt_am timestamptz not null default now();
alter table block
    add column aktualisiert_am timestamptz not null default now();

alter table block
    alter column erstellt_am drop default;
alter table block
    alter column aktualisiert_am drop default;
