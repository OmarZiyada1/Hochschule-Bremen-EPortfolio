-- KAN-75: Schlagwoerter werden eine eigene Stammdatenzeile (API-Contract v57,
-- §3.19). Bisher trug jede Zuordnung in project_tag den Text selbst, also waren
-- "Nachhaltigkeit" und "nachhaltigkeit" zwei verschiedene Tags und eine
-- verlaessliche Vorschlagsliste liess sich daraus nicht bilden. Dieselbe
-- Bewegung wie beim Semester in V202608161915.

create table tag (
    id   uuid        primary key,
    name varchar(64) not null
);

-- Eindeutig ueber lower(name) und nicht ueber name: ein gewoehnliches
-- unique (name) liesse genau die Dubletten zu, wegen derer es diese Tabelle
-- gibt. Postgres kennt Unique-Constraints nur auf Spalten, deshalb ein
-- Ausdrucksindex; er dient zugleich als Konfliktziel des on-conflict-Einfuegens
-- im ProjectWriteService.
create unique index uq_tag_name_lower on tag (lower(name));

-- Uebernahme des Bestands. Die Normalform ist dieselbe, die der Schreibweg
-- benutzt: trimmen, innere Mehrfach-Leerzeichen zusammenziehen, danach ohne
-- Ruecksicht auf Gross- und Kleinschreibung vergleichen. Liefe die Uebernahme
-- nur ueber lower(trim(...)), entstuenden aus "Green IT" und "Green  IT" zwei
-- Zeilen, von denen der Schreibweg eine nie wiederfaende: er sucht nach der
-- zusammengezogenen Schreibweise und legte die zweite still erneut an.
--
-- Anzeigename ist die haeufigste vorkommende Schreibweise, bei Gleichstand die
-- alphabetisch erste. Genau das leistet distinct on: die Sortierung innerhalb
-- einer Gruppe entscheidet, welche Zeile stehen bleibt.
insert into tag (id, name)
select gen_random_uuid(), gewaehlt.anzeige
from (select distinct on (gezaehlt.schluessel) gezaehlt.anzeige
      from (select lower(regexp_replace(trim(tag), '\s+', ' ', 'g')) as schluessel,
                   regexp_replace(trim(tag), '\s+', ' ', 'g')        as anzeige,
                   count(*)                                          as haeufigkeit
            from project_tag
            where trim(tag) <> ''
            group by 1, 2) as gezaehlt
      order by gezaehlt.schluessel, gezaehlt.haeufigkeit desc, gezaehlt.anzeige) as gewaehlt;

alter table project_tag
    add column tag_id uuid;

update project_tag
set tag_id = tag.id
from tag
where lower(regexp_replace(trim(project_tag.tag), '\s+', ' ', 'g')) = lower(tag.name);

-- Werte, die nach dem Trimmen leer waren, haben oben keine Zeile bekommen. Sie
-- verschwinden hier, statt spaeter an not null zu scheitern: ein leeres
-- Schlagwort ist keines.
delete from project_tag
where tag_id is null;

-- Doppelte Paare entfernen, bevor der neue Schluessel steht. Traegt ein Projekt
-- heute "Nachhaltigkeit" und "nachhaltigkeit", zeigen nach dem Fuellen zwei
-- Zeilen auf dieselbe tag_id, und der Primaerschluessel (project_id, tag_id)
-- scheiterte daran. Eine Zeile je Paar bleibt stehen; welche, ist gleichgueltig,
-- weil sich die beiden nach dem Loeschen der Textspalte nicht mehr
-- unterscheiden.
delete from project_tag a
using project_tag b
where a.project_id = b.project_id
  and a.tag_id = b.tag_id
  and a.ctid > b.ctid;

-- Der alte Schluessel steht auf (project_id, tag), muss also vor der Spalte
-- weichen. Der Fremdschluessel auf project bleibt unberuehrt und behaelt sein
-- on delete cascade aus V202607221300: ein geloeschtes Projekt nimmt seine
-- Zuordnungen weiterhin mit.
alter table project_tag
    drop constraint project_tag_pkey;

-- Die alte Spalte faellt wirklich weg und bleibt nicht als zweite, unversorgte
-- Wahrheit stehen; ddl-auto: validate wuerde sie nicht bemaengeln.
alter table project_tag
    drop column tag;

alter table project_tag
    alter column tag_id set not null;

-- Bewusst ohne on delete cascade: eine Kaskade in diese Richtung wuerde
-- Stammdaten loeschen, sobald jemand ein Projekt entfernt. Verwaiste Tags
-- bleiben stehen und rutschen mit usageCount 0 ans Ende der Vorschlagsliste;
-- das Aufraeumen gehoert in die Tag-Verwaltung der Administrationsseite.
alter table project_tag
    add constraint fk_project_tag_tag
        foreign key (tag_id) references tag (id);

alter table project_tag
    add constraint project_tag_pkey primary key (project_id, tag_id);

-- Der Primaerschluessel deckt nur die Richtung project_id zuerst ab. Die
-- Gegenrichtung braucht die Zaehlung in GET /api/tags und der Fremdschluessel
-- oben (Regel 6 im Skill flyway-migration).
create index idx_project_tag_tag_id on project_tag (tag_id);
