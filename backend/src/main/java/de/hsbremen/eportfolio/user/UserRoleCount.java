package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;

/**
 * Zahl der Konten je Rolle, Ergebniszeile von
 * {@link UserRepository#countPerRole()}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis, dieselbe Rolle wie
 * {@code ReactionCount} im Reaktionsmodul. Es gibt dieses Record, weil die
 * Alternative, {@code countByRole} je Enum-Wert aufzurufen, aus einer
 * Dashboard-Abfrage drei einzelne machen wuerde; zusammen mit den uebrigen
 * Kennzahlen aus §6.1 waeren es fuenfundzwanzig statt vier.
 *
 * @param role  Rolle, zu der gezaehlt wurde
 * @param count Zahl der Konten mit dieser Rolle. Rollen ohne Konto kommen in
 *              der Ergebnisliste gar nicht vor; der Dienst ergaenzt sie mit 0
 */
public record UserRoleCount(Role role, long count) {
}
