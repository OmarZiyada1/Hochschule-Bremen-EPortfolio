-- KAN-83: jeder Studiengang traegt ein Sammelmodul (API-Contract v84, §3.9).
--
-- Zweck: ein Projekt, zu dem kein Fachmodul passt, bekommt trotzdem eine
-- gespeicherte Zuordnung und faellt nicht aus Filtern und Projektdetails
-- heraus. Bisher blieb moduleId in diesem Fall leer, und die Angabe existierte
-- nur im Moment der Eingabe.
--
-- Erkannt wird die Zeile an einem Merkmal und nicht am Namen: der Name ist
-- ueber PATCH /api/admin/modules/{id} frei aenderbar, und weder Datenbank noch
-- Dienst halten ihn eindeutig. Eine Erkennung am Namen braeche beim ersten
-- Umbenennen.

alter table module
    add column collective boolean;

update module
set collective = false;

alter table module
    alter column collective set not null;

-- Kein bleibender Default: JPA schreibt die Spalte bei jedem Insert mit
-- (Regel 8 im Skill flyway-migration, Vorbild V202608161915__semester.sql).
-- Der Backfill unten setzt den Wert deshalb ausgeschrieben.

-- Hoechstens eine Sammelzeile je Studiengang. Der Index ist partiell, weil die
-- Regel nur fuer die true-Zeilen gilt; ein gewoehnlicher Unique-Constraint ueber
-- (study_program_id, collective) liesse daneben auch nur noch ein einziges
-- Fachmodul je Studiengang zu.
create unique index uq_module_collective
    on module (study_program_id)
    where collective;

-- Bestand: je vorhandenem Studiengang eine Zeile, sofern noch keine da ist.
-- Der Name folgt dem Muster aus §3.9. "Studiengang" steht bewusst mit im Text:
-- "Module aus dem Medieninformatik" waere grammatisch falsch, weil die Namen
-- der Studiengaenge verschiedene Geschlechter haben.
--
-- Das Kuerzel leitet sich aus dem des Studiengangs ab und wird auf die
-- Spaltenlaenge gekuerzt; module.abbreviation traegt keinen
-- Unique-Constraint, eine Kollision ist also keine.
insert into module (id, name, abbreviation, study_program_id, collective)
select gen_random_uuid(),
       left('Module aus dem Studiengang ' || sp.name, 255),
       left(sp.abbreviation || '-ALLG', 64),
       sp.id,
       true
from study_program sp
where not exists (select 1
                  from module m
                  where m.study_program_id = sp.id
                    and m.collective);
