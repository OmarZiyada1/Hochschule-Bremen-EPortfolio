-- Nachraeumen: Mitgliedszeilen der Autor:in, die nach V202608221930 noch
-- entstanden sind (Contract v66, §3.13.1).
--
-- V202608221930 hat die von V202608221430 angelegten Zeilen entfernt und die
-- Funktionsbezeichnung an project.author_role gerettet. Zwischen dieser
-- Migration und dem Neustart mit dem zugehoerigen Programmstand lief die
-- Anwendung aber noch mit der Fassung aus v65: sie legte beim Anlegen eines
-- Projekts weiterhin eine Mitgliedszeile fuer die Autor:in an. Wer in diesem
-- Zeitfenster ein Projekt angelegt hat, findet die Autor:in danach in der
-- Mitgliederliste wieder, und PUT /api/projects/{id} antwortet auf genau
-- diese Liste mit 400 (§3.13.1): das Projekt liesse sich nicht mehr
-- speichern.
--
-- Dieselben zwei Anweisungen wie in V202608221930, denn dieselbe Lage. Die
-- vorige Migration wird nicht geaendert, sondern ergaenzt: sie ist bereits
-- angewandt, und eine nachtraeglich veraenderte Migration ist bei Flyway ein
-- Pruefsummenfehler (CLAUDE.md, Regel 1). Beide Anweisungen sind
-- wirkungslos, wenn es nichts nachzuraeumen gibt.

-- 1) Eine an der Mitgliedszeile eingetragene Bezeichnung nicht verlieren.
--    Nur, wenn am Projekt noch keine steht: die dort eingetragene ist die
--    juengere und die richtige.
update project p
set author_role = m.project_role
from project_member m
where m.project_id = p.id
  and m.user_id = p.author_id
  and m.project_role is not null
  and p.author_role is null;

-- 2) Die Zeilen entfernen.
delete from project_member m
using project p
where m.project_id = p.id
  and m.user_id = p.author_id;
