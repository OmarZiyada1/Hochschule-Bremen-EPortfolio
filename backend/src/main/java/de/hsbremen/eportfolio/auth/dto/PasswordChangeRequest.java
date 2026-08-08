package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.auth.PasswordPolicy;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body fuer {@code PUT /api/auth/password} (§6.1, §6.7).
 *
 * <p>Wessen Passwort geaendert wird, steht bewusst nicht im Body: das ergibt
 * sich aus dem Token. Ein {@code userId}-Feld waere eine Einladung, fremde
 * Passwoerter zu aendern.
 *
 * @param currentPassword das bisherige Passwort. Wird auch mit gueltigem Token
 *                        verlangt: ein unbeaufsichtigt liegengelassener
 *                        Rechner soll nicht reichen, um die Person dauerhaft
 *                        auszusperren.
 * @param newPassword     das neue Passwort, Regeln identisch zur Registrierung
 *                        ({@link PasswordPolicy})
 */
public record PasswordChangeRequest(
		@Schema(description = "Das bisherige Passwort; bei erzwungener Aenderung das Initialpasswort.")
		@NotBlank(message = "Aktuelles Passwort fehlt.")
		String currentPassword,

		@Schema(description = "Das neue, selbst gewaehlte Passwort.")
		@NotBlank(message = "Neues Passwort fehlt.")
		@Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
				message = PasswordPolicy.MESSAGE)
		String newPassword) {
}
