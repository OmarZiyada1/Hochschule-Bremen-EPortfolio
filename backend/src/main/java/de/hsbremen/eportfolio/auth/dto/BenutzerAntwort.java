package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.util.UUID;

/**
 * Benutzerdaten in Auth-Responses.
 *
 * <p>Bewusst ein eigenes Record und nicht die Entity: {@code passwortHash} darf
 * nie in einer Response stehen (§3.1), und {@code hsbEmail} ist ein internes
 * Nachweismerkmal, das ebenfalls nicht ausgeliefert wird. Ein DTO stellt das
 * strukturell sicher — bei einer serialisierten Entity haengt es an
 * Annotationen, die man beim naechsten Feld vergisst.
 */
public record BenutzerAntwort(
		UUID id,
		String email,
		String vorname,
		String nachname,
		Rolle rolle,
		UserStatus status) {

	public static BenutzerAntwort aus(User user) {
		return new BenutzerAntwort(
				user.getId(),
				user.getEmail(),
				user.getVorname(),
				user.getNachname(),
				user.getRolle(),
				user.getStatus());
	}
}
