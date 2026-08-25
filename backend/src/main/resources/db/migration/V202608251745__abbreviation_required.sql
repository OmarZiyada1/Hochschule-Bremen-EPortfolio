-- Contract v81 (KAN-80): study_program.abbreviation und module.abbreviation
-- werden Pflicht. Bis v80 waren beide Spalten nullable, weil das Kuerzel als
-- Bequemlichkeit galt. Es traegt inzwischen Anzeige: die Projektkachel zeigt
-- oben rechts das Studiengangskuerzel, die Detailseite nennt es hinter dem
-- Namen. Ein Studiengang ohne Kuerzel hinterliesse dort eine Luecke, die
-- keine Ansicht sinnvoll fuellen kann. Das Modul fuehrt heute keine solche
-- Anzeige, bekommt die Pflicht aber mit: beide sind dieselbe Stammdatenart,
-- und eine halb gepflegte Hierarchie faellt spaeter genau an der Stelle auf,
-- an der ein Kuerzel gebraucht wird.
--
-- Zuerst der Bestand, dann die Bedingung: ein set not null scheitert,
-- solange auch nur eine Zeile null ist. Fuer den Backfill gibt es keine
-- Quelle ausser dem Namen, deshalb entstehen die ersten drei Buchstaben in
-- Grossschreibung; Ziffern, Leerzeichen und Satzzeichen fallen vorher weg,
-- damit "B.Sc. Informatik" nicht als "BSC" endet. Die Zeichenklasse
-- [:alpha:] folgt der Kollation der Datenbank und laesst deshalb auch
-- Umlaute stehen. Bleibt danach nichts uebrig (ein Name rein aus
-- Sonderzeichen), steht "N.N." da: ein sichtbarer Platzhalter ist besser als
-- eine leere Zeichenkette, die die neue Bedingung zwar erfuellt, in der
-- Oberflaeche aber wie ein Fehler aussieht. Die Administration korrigiert
-- solche Zeilen ueber die Studienstruktur.
--
-- Die Dev-Stammdaten aus DevMasterDataSeeder tragen durchgehend Kuerzel und
-- sind vom Backfill nicht betroffen.
update study_program
set abbreviation = coalesce(
        nullif(upper(left(regexp_replace(name, '[^[:alpha:]]', '', 'g'), 3)), ''),
        'N.N.')
where abbreviation is null or btrim(abbreviation) = '';

update module
set abbreviation = coalesce(
        nullif(upper(left(regexp_replace(name, '[^[:alpha:]]', '', 'g'), 3)), ''),
        'N.N.')
where abbreviation is null or btrim(abbreviation) = '';

alter table study_program
    alter column abbreviation set not null;

alter table module
    alter column abbreviation set not null;
