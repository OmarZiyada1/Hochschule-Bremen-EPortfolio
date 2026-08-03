-- KAN-49: Schema auf englische Bezeichner umstellen (docs/NAMENSSCHEMA.md).
--
-- Bestehende Migrationen bleiben unberuehrt (CLAUDE.md, Regel 1), die
-- Umstellung laeuft ausschliesslich ueber diese Datei. Postgres zieht bei
-- RENAME TABLE und RENAME COLUMN die Fremdschluessel, Indizes und
-- Constraint-Ausdruecke automatisch mit; ihre *Namen* bleiben dabei aber
-- stehen. Deshalb werden sie unten einzeln nachgezogen, sonst haengt am Ende
-- ein projekt_pkey an der Tabelle project.
--
-- Die Enum-Werte aendern sich mit (ENTWURF wird DRAFT). Ein reines RENAME
-- reicht dafuer nicht: jede betroffene Check-Constraint wird abgeraeumt, der
-- Bestand umgeschrieben und die Constraint mit explizitem Namen neu gesetzt
-- (Skill flyway-migration, Regel 3). Wo sich nur der Spaltenname aendert und
-- nicht die erlaubten Werte, genuegt ein RENAME CONSTRAINT.

-- ---------------------------------------------------------------------------
-- 1. Tabellen
-- ---------------------------------------------------------------------------
-- app_user, portfolio und block heissen bereits englisch und bleiben.

alter table kategorie               rename to category;
alter table fakultaet               rename to faculty;
alter table studiengang             rename to study_program;
alter table modul                   rename to module;
alter table projekt                 rename to project;
alter table projekt_tag             rename to project_tag;
alter table projekt_redakteur       rename to project_editor;
alter table projektmitglied         rename to project_member;
alter table kommentar               rename to comment;
alter table reaktion                rename to reaction;
alter table projekt_status_historie rename to project_status_history;
alter table top10_eintrag           rename to top10_entry;
alter table top10_nominierung       rename to top10_nomination;

-- ---------------------------------------------------------------------------
-- 2. Spalten
-- ---------------------------------------------------------------------------

alter table app_user rename column email_verifiziert     to email_verified;
alter table app_user rename column hsb_email_verifiziert to hsb_email_verified;
alter table app_user rename column passwort_hash         to password_hash;
alter table app_user rename column vorname               to first_name;
alter table app_user rename column nachname              to last_name;
alter table app_user rename column rolle                 to role;
alter table app_user rename column erstellt_am           to created_at;
alter table app_user rename column aktualisiert_am       to updated_at;

alter table faculty rename column kuerzel to abbreviation;

alter table study_program rename column kuerzel      to abbreviation;
alter table study_program rename column fakultaet_id to faculty_id;

alter table module rename column kuerzel        to abbreviation;
alter table module rename column studiengang_id to study_program_id;

alter table portfolio rename column biografie       to biography;
alter table portfolio rename column erstellt_am     to created_at;
alter table portfolio rename column aktualisiert_am to updated_at;

alter table project rename column titel              to title;
alter table project rename column kurzbeschreibung   to summary;
alter table project rename column cover_bild_url     to cover_image_url;
alter table project rename column projekttyp         to project_type;
alter table project rename column abschluss          to degree;
alter table project rename column autor_id           to author_id;
alter table project rename column fakultaet_id       to faculty_id;
alter table project rename column studiengang_id     to study_program_id;
alter table project rename column modul_id           to module_id;
alter table project rename column kategorie_id       to category_id;
alter table project rename column erstellt_am        to created_at;
alter table project rename column aktualisiert_am    to updated_at;
alter table project rename column veroeffentlicht_am to published_at;

alter table project_tag rename column projekt_id to project_id;

alter table project_editor rename column projekt_id to project_id;

alter table project_member rename column projekt_id       to project_id;
alter table project_member rename column rolle_im_projekt to project_role;

alter table comment rename column projekt_id      to project_id;
alter table comment rename column autor_id        to author_id;
alter table comment rename column typ             to type;
alter table comment rename column erstellt_am     to created_at;
alter table comment rename column aktualisiert_am to updated_at;

alter table reaction rename column projekt_id  to project_id;
alter table reaction rename column erstellt_am to created_at;

-- "timestamp" ist in Postgres ein col_name_keyword und als Spaltenname ohne
-- Anfuehrungszeichen zulaessig, anders als "order" (siehe block.order_index).
alter table project_status_history rename column projekt_id    to project_id;
alter table project_status_history rename column von_status    to from_status;
alter table project_status_history rename column nach_status   to to_status;
alter table project_status_history rename column geaendert_von to changed_by;
alter table project_status_history rename column zeitpunkt     to timestamp;

alter table top10_entry rename column projekt_id     to project_id;
alter table top10_entry rename column aufgenommen_am to added_at;

alter table top10_nomination rename column projekt_id              to project_id;
alter table top10_nomination rename column nominiert_von           to nominated_by;
alter table top10_nomination rename column vorgeschlagene_position to proposed_position;
alter table top10_nomination rename column entschieden_von         to decided_by;
alter table top10_nomination rename column entschieden_am          to decided_at;
alter table top10_nomination rename column erstellt_am             to created_at;

alter table block rename column projekt_id      to project_id;
alter table block rename column typ             to type;
alter table block rename column reihenfolge     to order_index;
alter table block rename column inhalt          to content;
alter table block rename column erstellt_am     to created_at;
alter table block rename column aktualisiert_am to updated_at;

-- ---------------------------------------------------------------------------
-- 3. Enum-Werte im Bestand, mit neu gesetzten Check-Constraints
-- ---------------------------------------------------------------------------
-- Reihenfolge je Spalte: Constraint loesen, Default loesen, Werte umschreiben,
-- Default und Constraint in der englischen Fassung wieder setzen. Andersherum
-- scheitert entweder das UPDATE an der alten Constraint oder das SET DEFAULT
-- an der neuen.

-- Rolle: STUDIERENDE wird STUDENT, REDAKTEUR wird EDITOR (ADMIN bleibt).
alter table app_user drop constraint app_user_rolle_check;
update app_user set role = case role
    when 'STUDIERENDE' then 'STUDENT'
    when 'REDAKTEUR'   then 'EDITOR'
    else role
end;
alter table app_user add constraint ck_app_user_role
    check (role in ('STUDENT', 'EDITOR', 'ADMIN'));

alter table app_user drop constraint app_user_status_check;
alter table app_user alter column status drop default;
update app_user set status = case status
    when 'REGISTRIERUNG_OFFEN' then 'REGISTRATION_PENDING'
    when 'AKTIV'               then 'ACTIVE'
    when 'DEAKTIVIERT'         then 'DEACTIVATED'
    else status
end;
alter table app_user alter column status set default 'REGISTRATION_PENDING';
alter table app_user add constraint ck_app_user_status
    check (status in ('REGISTRATION_PENDING', 'ACTIVE', 'DEACTIVATED'));

-- Projektstatus: derselbe Wertevorrat in project und in der Historie.
alter table project drop constraint projekt_status_check;
alter table project alter column status drop default;
update project set status = case status
    when 'ENTWURF'         then 'DRAFT'
    when 'EINGEREICHT'     then 'SUBMITTED'
    when 'GENEHMIGT'       then 'APPROVED'
    when 'VEROEFFENTLICHT' then 'PUBLISHED'
    when 'UEBERARBEITUNG'  then 'REVISION'
    else status
end;
alter table project alter column status set default 'DRAFT';
alter table project add constraint ck_project_status
    check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REVISION'));

alter table project_status_history drop constraint projekt_status_historie_von_status_check;
alter table project_status_history drop constraint projekt_status_historie_nach_status_check;
update project_status_history set from_status = case from_status
    when 'ENTWURF'         then 'DRAFT'
    when 'EINGEREICHT'     then 'SUBMITTED'
    when 'GENEHMIGT'       then 'APPROVED'
    when 'VEROEFFENTLICHT' then 'PUBLISHED'
    when 'UEBERARBEITUNG'  then 'REVISION'
    else from_status
end;
update project_status_history set to_status = case to_status
    when 'ENTWURF'         then 'DRAFT'
    when 'EINGEREICHT'     then 'SUBMITTED'
    when 'GENEHMIGT'       then 'APPROVED'
    when 'VEROEFFENTLICHT' then 'PUBLISHED'
    when 'UEBERARBEITUNG'  then 'REVISION'
    else to_status
end;
alter table project_status_history add constraint ck_project_status_history_from_status
    check (from_status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REVISION'));
alter table project_status_history add constraint ck_project_status_history_to_status
    check (to_status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REVISION'));

-- Kommentartyp und -status. OFFEN heisst hier OPEN, bei der Nominierung
-- dagegen PENDING: ein Aenderungswunsch ist offen, eine Nominierung wartet.
alter table comment drop constraint kommentar_typ_check;
update comment set type = case type
    when 'ANTWORT'   then 'REPLY'
    when 'NOTIZ'     then 'NOTE'
    when 'AENDERUNG' then 'CHANGE_REQUEST'
    else type
end;
alter table comment add constraint ck_comment_type
    check (type in ('REPLY', 'NOTE', 'CHANGE_REQUEST'));

alter table comment drop constraint kommentar_status_check;
update comment set status = case status
    when 'OFFEN'    then 'OPEN'
    when 'ERLEDIGT' then 'RESOLVED'
    else status
end;
alter table comment add constraint ck_comment_status
    check (status in ('OPEN', 'RESOLVED'));

alter table top10_nomination drop constraint top10_nominierung_status_check;
alter table top10_nomination alter column status drop default;
update top10_nomination set status = case status
    when 'OFFEN'      then 'PENDING'
    when 'ANGENOMMEN' then 'ACCEPTED'
    when 'ABGELEHNT'  then 'REJECTED'
    else status
end;
alter table top10_nomination alter column status set default 'PENDING';
alter table top10_nomination add constraint ck_top10_nomination_status
    check (status in ('PENDING', 'ACCEPTED', 'REJECTED'));

-- Blocktypen: vier Werte (TEXT, CODE, VIDEO, AUDIO) waren schon englisch.
alter table block drop constraint block_typ_check;
update block set type = case type
    when 'UEBERSCHRIFT' then 'HEADING'
    when 'LISTE'        then 'LIST'
    when 'ZITAT'        then 'QUOTE'
    when 'FORMEL'       then 'FORMULA'
    when 'TABELLE'      then 'TABLE'
    when 'TRENNLINIE'   then 'DIVIDER'
    when 'BILD'         then 'IMAGE'
    when 'GALERIE'      then 'GALLERY'
    when 'DOKUMENT'     then 'DOCUMENT'
    when 'EINBETTUNG'   then 'EMBED'
    else type
end;
alter table block add constraint ck_block_type
    check (type in ('HEADING', 'TEXT', 'LIST', 'QUOTE', 'CODE', 'FORMULA', 'TABLE',
                    'DIVIDER', 'IMAGE', 'GALLERY', 'VIDEO', 'AUDIO', 'DOCUMENT', 'EMBED'));

-- ---------------------------------------------------------------------------
-- 4. Check-Constraints ohne Wertaenderung: nur der Name wird nachgezogen
-- ---------------------------------------------------------------------------

alter table project rename constraint projekt_projekttyp_check to ck_project_project_type;
alter table project rename constraint projekt_abschluss_check  to ck_project_degree;
alter table top10_entry rename constraint top10_eintrag_position_check
    to ck_top10_entry_position;
alter table top10_nomination rename constraint top10_nominierung_vorgeschlagene_position_check
    to ck_top10_nomination_proposed_position;

-- ---------------------------------------------------------------------------
-- 5. Primaer-, Unique- und Fremdschluessel
-- ---------------------------------------------------------------------------
-- app_user und portfolio tragen bereits englische Constraint-Namen.

alter table category rename constraint kategorie_pkey     to category_pkey;
alter table category rename constraint kategorie_name_key to category_name_key;

alter table faculty rename constraint fakultaet_pkey        to faculty_pkey;
alter table faculty rename constraint fakultaet_kuerzel_key to faculty_abbreviation_key;

alter table study_program rename constraint studiengang_pkey to study_program_pkey;
alter table study_program rename constraint studiengang_fakultaet_id_fkey
    to study_program_faculty_id_fkey;

alter table module rename constraint modul_pkey to module_pkey;
alter table module rename constraint modul_studiengang_id_fkey to module_study_program_id_fkey;

alter table project rename constraint projekt_pkey               to project_pkey;
alter table project rename constraint projekt_autor_id_fkey      to project_author_id_fkey;
alter table project rename constraint projekt_fakultaet_id_fkey  to project_faculty_id_fkey;
alter table project rename constraint projekt_studiengang_id_fkey
    to project_study_program_id_fkey;
alter table project rename constraint projekt_modul_id_fkey     to project_module_id_fkey;
alter table project rename constraint projekt_kategorie_id_fkey to project_category_id_fkey;

alter table project_tag rename constraint projekt_tag_pkey to project_tag_pkey;
alter table project_tag rename constraint projekt_tag_projekt_id_fkey
    to project_tag_project_id_fkey;

alter table project_editor rename constraint projekt_redakteur_pkey to project_editor_pkey;
alter table project_editor rename constraint projekt_redakteur_projekt_id_fkey
    to project_editor_project_id_fkey;
alter table project_editor rename constraint projekt_redakteur_user_id_fkey
    to project_editor_user_id_fkey;

alter table project_member rename constraint projektmitglied_pkey to project_member_pkey;
alter table project_member rename constraint projektmitglied_projekt_id_user_id_key
    to project_member_project_id_user_id_key;
alter table project_member rename constraint projektmitglied_projekt_id_fkey
    to project_member_project_id_fkey;
alter table project_member rename constraint projektmitglied_user_id_fkey
    to project_member_user_id_fkey;

alter table comment rename constraint kommentar_pkey            to comment_pkey;
alter table comment rename constraint kommentar_projekt_id_fkey to comment_project_id_fkey;
alter table comment rename constraint kommentar_autor_id_fkey   to comment_author_id_fkey;

alter table reaction rename constraint reaktion_pkey to reaction_pkey;
alter table reaction rename constraint reaktion_projekt_id_user_id_key
    to reaction_project_id_user_id_key;
alter table reaction rename constraint reaktion_projekt_id_fkey to reaction_project_id_fkey;
alter table reaction rename constraint reaktion_user_id_fkey    to reaction_user_id_fkey;

alter table project_status_history rename constraint projekt_status_historie_pkey
    to project_status_history_pkey;
alter table project_status_history rename constraint projekt_status_historie_projekt_id_fkey
    to project_status_history_project_id_fkey;
alter table project_status_history rename constraint projekt_status_historie_geaendert_von_fkey
    to project_status_history_changed_by_fkey;

alter table top10_entry rename constraint top10_eintrag_pkey to top10_entry_pkey;
alter table top10_entry rename constraint top10_eintrag_projekt_id_key
    to top10_entry_project_id_key;
alter table top10_entry rename constraint top10_eintrag_projekt_id_fkey
    to top10_entry_project_id_fkey;

alter table top10_nomination rename constraint top10_nominierung_pkey to top10_nomination_pkey;
alter table top10_nomination rename constraint top10_nominierung_projekt_id_fkey
    to top10_nomination_project_id_fkey;
alter table top10_nomination rename constraint top10_nominierung_nominiert_von_fkey
    to top10_nomination_nominated_by_fkey;
alter table top10_nomination rename constraint top10_nominierung_entschieden_von_fkey
    to top10_nomination_decided_by_fkey;

alter table block rename constraint block_projekt_id_fkey to block_project_id_fkey;
-- Bleibt deferrable initially deferred: RENAME aendert nur den Namen.
alter table block rename constraint uq_block_projekt_reihenfolge
    to uq_block_project_order_index;

-- ---------------------------------------------------------------------------
-- 6. Indizes
-- ---------------------------------------------------------------------------
-- Nur die eigenstaendig angelegten; die Indizes hinter Primaer- und
-- Unique-Constraints sind mit deren Namen oben schon mitgewandert.

alter index idx_studiengang_fakultaet_id           rename to idx_study_program_faculty_id;
alter index idx_modul_studiengang_id               rename to idx_module_study_program_id;
alter index idx_projekt_autor_id                   rename to idx_project_author_id;
alter index idx_projekt_fakultaet_id               rename to idx_project_faculty_id;
alter index idx_projekt_studiengang_id             rename to idx_project_study_program_id;
alter index idx_projekt_modul_id                   rename to idx_project_module_id;
alter index idx_projekt_kategorie_id               rename to idx_project_category_id;
alter index idx_projekt_status                     rename to idx_project_status;
alter index idx_projekt_redakteur_user_id          rename to idx_project_editor_user_id;
alter index idx_projektmitglied_user_id            rename to idx_project_member_user_id;
alter index idx_kommentar_projekt_id               rename to idx_comment_project_id;
alter index idx_kommentar_autor_id                 rename to idx_comment_author_id;
alter index idx_reaktion_projekt_id                rename to idx_reaction_project_id;
alter index idx_reaktion_user_id                   rename to idx_reaction_user_id;
alter index idx_projekt_status_historie_projekt_id rename to idx_project_status_history_project_id;
alter index idx_top10_nominierung_projekt_id       rename to idx_top10_nomination_project_id;
alter index idx_top10_nominierung_status           rename to idx_top10_nomination_status;
alter index idx_top10_nominierung_nominiert_von    rename to idx_top10_nomination_nominated_by;
