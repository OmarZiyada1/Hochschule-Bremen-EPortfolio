package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import java.util.UUID;

/**
 * Benutzerdaten in Auth-Responses.
 *
 * <p>Bewusst ein eigenes Record und nicht die Entity: {@code passwordHash} darf
 * nie in einer Response stehen (§3.1). Ein DTO stellt das strukturell sicher;
 * bei einer serialisierten Entity haengt es an Annotationen, die man beim
 * naechsten Feld vergisst.
 *
 * <p>{@code hsbEmail} steht seit v50 mit drin, und das ist mit §3.1 vereinbar:
 * jede Antwort mit diesem Record geht an die Person selbst (Login,
 * Registrierung, {@code GET/PUT /auth/me}), und die eigene Hochschuladresse
 * ist kein Geheimnis vor sich selbst. Die Grenze aus §3.1 gilt weiter fuer
 * alles, was Dritte sehen: {@code PortfolioUserResponse} und die
 * Projektantworten fuehren die Adresse nicht.
 *
 * <p>{@code pendingEmail} (KAN-60) ist aus demselben Grund unbedenklich und
 * noetig: ohne das Feld koennte die Oberflaeche einen laufenden E-Mail-Wechsel
 * nicht als „Bestaetigung ausstehend" anzeigen. {@code null}, wenn kein
 * Wechsel laeuft.
 */
public record UserResponse(
		UUID id,
		String email,
		String pendingEmail,
		String hsbEmail,
		String firstName,
		String lastName,
		Role role,
		UserStatus status) {

	public static UserResponse from(User user) {
		return new UserResponse(
				user.getId(),
				user.getEmail(),
				user.getPendingEmail(),
				user.getHsbEmail(),
				user.getFirstName(),
				user.getLastName(),
				user.getRole(),
				user.getStatus());
	}
}
