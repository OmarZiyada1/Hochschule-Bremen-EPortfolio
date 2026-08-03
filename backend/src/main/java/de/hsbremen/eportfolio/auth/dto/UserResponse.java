package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import java.util.UUID;

/**
 * Benutzerdaten in Auth-Responses.
 *
 * <p>Bewusst ein eigenes Record und nicht die Entity: {@code passwordHash} darf
 * nie in einer Response stehen (§3.1), und {@code hsbEmail} ist ein internes
 * Nachweismerkmal, das ebenfalls nicht ausgeliefert wird. Ein DTO stellt das
 * strukturell sicher; bei einer serialisierten Entity haengt es an
 * Annotationen, die man beim naechsten Feld vergisst.
 */
public record UserResponse(
		UUID id,
		String email,
		String firstName,
		String lastName,
		Role role,
		UserStatus status) {

	public static UserResponse from(User user) {
		return new UserResponse(
				user.getId(),
				user.getEmail(),
				user.getFirstName(),
				user.getLastName(),
				user.getRole(),
				user.getStatus());
	}
}
