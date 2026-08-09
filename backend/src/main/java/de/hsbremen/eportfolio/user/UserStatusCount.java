package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.UserStatus;

/**
 * Zahl der Konten je Kontostatus (§2.9), Ergebniszeile von
 * {@link UserRepository#countPerStatus()}.
 *
 * <p>Zur Begruendung siehe {@link UserRoleCount}.
 *
 * @param status Status, zu dem gezaehlt wurde
 * @param count  Zahl der Konten in diesem Status. Status ohne Konto kommen in
 *               der Ergebnisliste gar nicht vor; der Dienst ergaenzt sie mit 0
 */
public record UserStatusCount(UserStatus status, long count) {
}
