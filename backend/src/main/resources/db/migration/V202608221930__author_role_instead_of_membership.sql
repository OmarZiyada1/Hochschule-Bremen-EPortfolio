-- Die Autor:in bekommt eine eigene Funktionsbezeichnung und bleibt dabei
-- Autor:in (Contract v66, §3.3, §3.13.1).
--
-- V202608221430 hatte sie zur gewoehnlichen ProjectMember-Zeile gemacht. Das
-- ist zurueckgenommen: sie ist im Datenmodell keine Mitgliedszeile, sondern
-- steht in project.author_id, und §5 haengt Rechte an genau dieser
-- Unterscheidung. Was bleiben sollte, war allein die Moeglichkeit, ihr eine
-- Funktionsbezeichnung zu geben; die bekommt sie jetzt am Projekt.
--
-- Die vorige Migration wird nicht geaendert, sondern zurueckgenommen: sie ist
-- bereits angewandt, und eine nachtraeglich veraenderte Migration ist bei
-- Flyway ein Pruefsummenfehler (CLAUDE.md, Regel 1).

-- 1) Die Funktionsbezeichnung der Autor:in am Projekt. Freiwillig, sie kann
--    spaeter eingetragen werden.
alter table project
    add column author_role varchar(255);

-- 2) Die von V202608221430 angelegten Mitgliedszeilen der Autor:innen wieder
--    entfernen. Eine Bezeichnung, die jemand inzwischen an einer solchen
--    Zeile eingetragen hat, wandert vorher an das Projekt: sie ist eine
--    Angabe, die jemand gemacht hat, und geht nicht verloren.
update project p
set author_role = m.project_role
from project_member m
where m.project_id = p.id
  and m.user_id = p.author_id
  and m.project_role is not null;

delete from project_member m
using project p
where m.project_id = p.id
  and m.user_id = p.author_id;

-- project_member.project_role bleibt nullable: dass die Funktionsbezeichnung
-- freiwillig ist, gilt weiterhin fuer jedes Mitglied (§3.13 seit v65).
