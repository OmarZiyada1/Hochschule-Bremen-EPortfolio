-- KAN-83: der Blocktyp TABLE_OF_CONTENTS kommt dazu (API-Contract v84, §2.5).
--
-- Das Inhaltsverzeichnis ist ein Block mit gespeicherter Momentaufnahme und
-- keine Ableitung beim Lesen. Der Grund liegt im Lesepfad: die oeffentliche
-- Detailansicht, die Redaktionsansicht und der PDF-Export rendern gespeicherte
-- Bloecke ohne laufenden Editor, eine Ableitung waere dort dreimal getrennt zu
-- bauen und liefe auseinander.
--
-- ck_block_type zaehlt die zulaessigen Werte auf und muss deshalb neu gesetzt
-- werden; PostgreSQL kennt kein "alter constraint ... check". Bestehende Zeilen
-- sind davon nicht betroffen: die Liste wird nur laenger, kein Wert entfaellt.

alter table block drop constraint ck_block_type;

alter table block add constraint ck_block_type
    check (type in ('HEADING', 'TEXT', 'LIST', 'QUOTE', 'CODE', 'FORMULA', 'TABLE',
                    'DIVIDER', 'IMAGE', 'GALLERY', 'VIDEO', 'AUDIO', 'DOCUMENT', 'EMBED',
                    'TABLE_OF_CONTENTS'));
