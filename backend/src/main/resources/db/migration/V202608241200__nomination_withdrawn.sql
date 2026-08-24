-- Contract v70 (KAN-37): NominationStatus (§2.8) bekommt den vierten Wert
-- WITHDRAWN. Die Spalte selbst aendert sich nicht, nur ihr Check-Constraint
-- kennt den Wert bisher nicht; ohne diese Migration endete jedes Zurueckziehen
-- im Constraint-Verstoss und damit in einem 500 statt in einer 200.
--
-- Bestehende Zeilen brauchen keine Umschreibung: WITHDRAWN entsteht erst durch
-- den neuen Endpoint, kein vorhandener Stand wird umgedeutet.
alter table top10_nomination drop constraint ck_top10_nomination_status;

alter table top10_nomination add constraint ck_top10_nomination_status
    check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'));
