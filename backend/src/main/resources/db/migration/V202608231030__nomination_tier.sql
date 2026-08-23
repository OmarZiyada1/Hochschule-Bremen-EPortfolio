-- KAN-37: Die Redaktion nominiert eine Stufe statt eines Platzes (Contract v68,
-- Enum NominationTier in §2.13). Die Spalte kommt in drei Schritten, weil sie
-- am Ende not null steht und die Tabelle bereits Zeilen tragen kann.

alter table top10_nomination
    add column proposed_tier varchar(32);

-- Backfill aus dem bisherigen Platzvorschlag: Platz 1 war der Spitzenplatz,
-- 2 bis 5 die vordere Gruppe, alles Weitere die Aufnahme in die Liste. Zeilen
-- ohne Vorschlag bekommen TOP_10, die schwaechste Aussage: mehr hat die
-- nominierende Person damals nicht behauptet, und eine hoehere Stufe waere ihr
-- nachtraeglich untergeschoben.
update top10_nomination
set proposed_tier = case
        when proposed_position = 1 then 'TOP_1'
        when proposed_position between 2 and 5 then 'TOP_5'
        else 'TOP_10'
    end;

alter table top10_nomination
    alter column proposed_tier set not null;

alter table top10_nomination
    add constraint ck_top10_nomination_proposed_tier
        check (proposed_tier in ('TOP_1', 'TOP_5', 'TOP_10'));
