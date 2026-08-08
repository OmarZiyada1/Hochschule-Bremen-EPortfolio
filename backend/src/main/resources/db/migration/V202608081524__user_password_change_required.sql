-- KAN-28: Flag fuer die erzwungene Passwortaenderung (§3.1, §6.7).
-- Gesetzt von der Kontoanlage durch die Administration (POST /admin/users,
-- KAN-25); zurueckgesetzt von PUT /auth/password und POST /auth/reset-password.
-- Der Default bleibt wie bei den Verifizierungs-Flags dauerhaft stehen:
-- false ist der Regelzustand jedes selbst registrierten Kontos.
alter table app_user
    add column password_change_required boolean not null default false;
