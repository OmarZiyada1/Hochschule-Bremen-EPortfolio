package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.auth.PasswordPolicy;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Einloesen eines Ruecksetzcodes, {@code POST /api/auth/reset-password}
 * (§6.1, KAN-43).
 *
 * <p>Anders als bei {@code PUT /auth/password} gibt es kein
 * {@code currentPassword}: an seine Stelle tritt der Code aus der Mail, dessen
 * Besitz den Zugriff auf das Postfach der Kennung belegt.
 *
 * @param email       Private Adresse, also die Kennung des Kontos (§3.1).
 * @param code        Der sechsstellige Code aus der Mail. Bewusst ohne
 *                    Formatpruefung am Record, wie bei {@link VerifyRequest}:
 *                    §6.2 fuehrt „ungueltig, abgelaufen oder bereits
 *                    verbraucht" unter einem einzigen Fehlercode, und ein
 *                    vertippter Code soll nicht je nach Laenge zwei
 *                    verschiedene Meldungen ergeben.
 * @param newPassword Das neue Passwort, Regeln identisch zur Registrierung
 *                    ({@link PasswordPolicy}).
 */
public record ResetPasswordRequest(

		@Schema(description = "Private E-Mail-Adresse, also die Kennung des Kontos.",
				example = "erika@example.org")
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email,

		@Schema(description = "Sechsstelliger Code aus der Mail.", example = "042317")
		@NotBlank(message = "Code fehlt.")
		@Size(max = 64, message = "Code ist zu lang.")
		String code,

		@Schema(description = "Das neue, selbst gewaehlte Passwort.")
		@NotBlank(message = "Neues Passwort fehlt.")
		@Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
				message = PasswordPolicy.MESSAGE)
		String newPassword) {
}
