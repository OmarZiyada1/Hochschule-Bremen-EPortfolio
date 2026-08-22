-- Die Autor:in ist ein gewoehnliches Projektmitglied, und die
-- Funktionsbezeichnung ist freiwillig (Contract v65, §3.13, §3.13.1).
--
-- Bis v64 fuehrte §3.13.1 die Autor:in ausdruecklich NICHT als Mitgliedszeile:
-- sie stand allein in project.author_id. In der Oberflaeche erschien sie
-- dadurch in derselben Personenliste wie die uebrigen, aber ohne
-- Funktionsbezeichnung, waehrend jede andere Zeile eine trug. Sie steht jetzt
-- als Zeile wie alle anderen darin; entfernen laesst sie sich nicht, dafuer
-- sorgt der Schreibdienst.
--
-- Zwei Schritte, und die Reihenfolge ist zwingend: erst die Spalte
-- freistellen, dann die Zeilen anlegen. Umgekehrt scheiterten die Inserts an
-- genau der Bedingung, die der erste Schritt aufhebt.

-- 1) Die Funktionsbezeichnung ist freiwillig, fuer die Autor:in wie fuer
--    jedes Mitglied. Sie kann spaeter eingetragen werden und ist keine Huerde
--    beim Anlegen. Die Laengenbegrenzung bleibt.
alter table project_member
    alter column project_role drop not null;

-- 2) Fuer jedes vorhandene Projekt eine Zeile fuer die Autor:in, sofern es
--    noch keine gibt. Ohne Bezeichnung: eine erfundene waere eine Angabe, die
--    niemand gemacht hat.
--
--    Die id wird hier erzeugt, weil BaseEntity sie in Java vergibt und dieser
--    Bestand nie durch Java gelaufen ist. gen_random_uuid() ist seit
--    PostgreSQL 13 im Kern und braucht keine Erweiterung.
insert into project_member (id, project_id, user_id, project_role)
select gen_random_uuid(), p.id, p.author_id, null
from project p
where p.author_id is not null
  and not exists (
      select 1
      from project_member m
      where m.project_id = p.id
        and m.user_id = p.author_id
  );
