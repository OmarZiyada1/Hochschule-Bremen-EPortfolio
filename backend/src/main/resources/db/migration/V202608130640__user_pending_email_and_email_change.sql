-- KAN-60: Selbstaendiger Wechsel der privaten E-Mail-Adresse (§3.1, §2.11).
--
-- pending_email haelt die gewuenschte neue Adresse fest, bis der Code aus der
-- Mail eingeloest ist; bis dahin bleibt email die gueltige Login-Kennung.
-- Bewusst ohne Unique-Constraint: zwei Konten duerfen gleichzeitig dieselbe
-- Wunschadresse anstreben, den Wettlauf entscheidet die Bestaetigung
-- (POST /auth/verify prueft die Eindeutigkeit erneut, bevor es umschreibt).
alter table app_user
    add column pending_email varchar(255);

-- Der Check-Constraint stammt aus V202608081410 und kannte drei Zwecke.
-- Eingespielte Migrationen bleiben unveraendert, deshalb wird er hier
-- gezielt neu gesetzt; dafuer war er benannt.
alter table verification_code
    drop constraint ck_verification_code_purpose;

alter table verification_code
    add constraint ck_verification_code_purpose
        check (purpose in ('PRIVATE_EMAIL', 'HSB_EMAIL', 'PASSWORD_RESET', 'EMAIL_CHANGE'));
