-- KAN-26: Tabelle fuer die Einmalcodes des Registrierungsflusses
-- (API-Contract §3.16, §3.1.1).
--
-- Eine eigene Tabelle statt zweier Spaltenpaare am app_user: eine Person hat
-- zwei gleichzeitig offene Codes (privat und HSB) und ueber die Zeit beliebig
-- viele, weil ein erneutes Senden moeglich ist. Spalten am Konto bildeten nur
-- den Sonderfall "genau ein Versuch je Adresse" ab und wuerden beim erneuten
-- Senden ueberschrieben.
--
-- code_hash und nicht der Klartext: der Code ist ein kurzlebiges Geheimnis mit
-- derselben Funktion wie ein Passwort-Ruecksetztoken. Laege er im Klartext,
-- koennte jede Person mit Lesezugriff fremde Konten aktivieren. Der Wert ist
-- ein BCrypt-Hash, deshalb 255 Zeichen wie bei app_user.password_hash.
--
-- purpose fuehrt alle drei Werte aus §2.11, auch PASSWORD_RESET. Den stellt
-- erst KAN-43 aus; ihn hier wegzulassen hiesse, fuer einen heute schon
-- feststehenden Wert spaeter eine zweite Migration zu schreiben, die den
-- Check-Constraint nur erweitert.
--
-- on delete cascade laut §3.16: ein geloeschtes Konto laesst keine Codes
-- zurueck, die auf eine nicht mehr vorhandene Person zeigen.
create table verification_code (
    id         uuid         primary key,
    user_id    uuid         not null references app_user (id) on delete cascade,
    purpose    varchar(32)  not null,
    code_hash  varchar(255) not null,
    expires_at timestamptz  not null,
    consumed   boolean      not null default false,
    created_at timestamptz  not null,
    constraint ck_verification_code_purpose
        check (purpose in ('PRIVATE_EMAIL', 'HSB_EMAIL', 'PASSWORD_RESET'))
);

-- Fremdschluesselspalten werden von Postgres nicht automatisch indiziert.
-- Gesucht wird immer nach Konto und Zweck zusammen, deshalb ein gemeinsamer
-- Index statt eines nur auf user_id.
create index idx_verification_code_user_id_purpose
    on verification_code (user_id, purpose);
