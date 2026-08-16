-- KAN-65: Semester wird eine Stammdatenzeile (API-Contract v45, §3.18); das
-- Projekt verweist darauf, statt eine frei getippte Zeichenkette zu tragen.
-- Der Filter aus §6.1 vergleicht exakt, weshalb "WiSe 2025/26" und "WS 25/26"
-- bislang zwei verschiedene Semester waren und keine verlaessliche Optionsliste
-- ergaben.

create table semester (
    id         uuid        primary key,
    name       varchar(64) not null,
    active     boolean     not null,
    sort_order integer     not null,
    constraint uq_semester_name unique (name)
);

-- Kein Default auf active und sort_order: JPA schreibt beide Spalten bei jedem
-- Insert mit (siehe Regel 8 im Skill flyway-migration). Fuer die Uebernahme
-- unten stehen die Werte deshalb ausgeschrieben in der Anweisung.

alter table project
    add column semester_id uuid;

-- Uebernahme des Bestands: aus jedem vorhandenen, nicht leeren Semestertext
-- wird eine Zeile. Die Reihenfolge ist die alphabetische des Textes; sie ist
-- fachlich nicht immer richtig ("SoSe 2026" vor "WiSe 2025/26") und wird auf
-- der Administrationsseite mit den Pfeilen zurechtgerueckt. Eine schlauere
-- Sortierung muesste das Namensformat raten, und genau das soll die Tabelle
-- kuenftig ueberfluessig machen.
insert into semester (id, name, active, sort_order)
select gen_random_uuid(), vorhanden.name, true,
       row_number() over (order by vorhanden.name)
from (select distinct trim(semester) as name
      from project
      where semester is not null
        and trim(semester) <> '') as vorhanden;

update project
set semester_id = semester.id
from semester
where trim(project.semester) = semester.name;

-- Erst nach der Uebernahme: ein Fremdschluessel auf eine noch leere Tabelle
-- haette den Backfill oben scheitern lassen.
alter table project
    add constraint fk_project_semester
        foreign key (semester_id) references semester (id);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
create index idx_project_semester_id on project (semester_id);

-- Die alte Spalte faellt weg und nicht bloss aus dem Entity-Modell: bliebe sie
-- stehen, waere sie eine zweite, unversorgte Wahrheit ueber dasselbe Feld, und
-- ddl-auto: validate wuerde sie nicht bemaengeln.
alter table project
    drop column semester;
