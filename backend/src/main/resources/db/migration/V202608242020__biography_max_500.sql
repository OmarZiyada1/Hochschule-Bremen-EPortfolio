-- Contract v75 (KAN-79): portfolio.biography fasst hoechstens 500 Zeichen.
-- Bis v74 nannte der Contract keine Grenze; im Code standen 5000, an zwei
-- Stellen gepflegt und an keiner nachschlagbar. Die Spalte wird deshalb von
-- text auf varchar(500) verengt, damit die Grenze auch dann gilt, wenn ein
-- kuenftiger Schreibweg an der Bean-Validation vorbeigeht.
--
-- Zuerst der Bestand, dann der Typ: ein alter column type auf eine kuerzere
-- Laenge scheitert, solange auch nur eine Zeile laenger ist. Das Kuerzen ist
-- verlustbehaftet und in der Klaerungsrunde zu KAN-79 bewusst so entschieden.
-- Die Seed-Konten aus DevTestUserSeeder sind nicht betroffen, sie legen ihr
-- Portfolio ohne Biografie an.
update portfolio
set biography = left(biography, 500)
where length(biography) > 500;

alter table portfolio
    alter column biography type varchar(500);
