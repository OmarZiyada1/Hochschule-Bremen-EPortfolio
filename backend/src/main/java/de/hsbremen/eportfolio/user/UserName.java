package de.hsbremen.eportfolio.user;

/**
 * Vor- und Nachname eines Kontos, ohne alles andere.
 *
 * <p>Eine Projektion und keine Entity: der einzige Verwender ist die
 * Bearbeitungssperre (§6.9), die je Herzschlag einen Namen fuer die Anzeige
 * braucht und sonst nichts. Das ganze Konto dafuer zu laden hiesse, alle zehn
 * Sekunden je offenem Editor eine Zeile samt Passwort-Hash und beiden
 * Adressen durch den Persistenzkontext zu ziehen.
 *
 * <p>Dieselbe Bauform wie {@link UserRoleCount} und {@link UserStatusCount}:
 * ein Record, den die Abfrage selbst erzeugt.
 *
 * @param firstName Vorname
 * @param lastName  Nachname
 */
public record UserName(String firstName, String lastName) {
}
