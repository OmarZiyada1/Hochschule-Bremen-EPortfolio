package de.hsbremen.eportfolio.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Anmeldedaten fuer {@code POST /api/auth/login} (§6.1).
 *
 * @param email    die <strong>private</strong> E-Mail-Adresse. Mit der
 *                 HSB-Adresse ist keine Anmeldung moeglich (§3.1.1): sie ist
 *                 reiner Zugehoerigkeitsnachweis.
 * @param password Klartextpasswort, wird gegen den BCrypt-Hash geprueft.
 */
public record LoginRequest(
		// Der Unterschied private Adresse / HSB-Adresse ist aus dem Feldnamen
		// nicht ablesbar und die haeufigste Fehlbedienung - deshalb hier in der
		// UI sichtbar gemacht.
		@Schema(description = "Private E-Mail-Adresse. Die HSB-Adresse ist reiner "
				+ "Zugehoerigkeitsnachweis und funktioniert zur Anmeldung nicht (§3.1.1).",
				example = "dev-studi@dev.invalid")
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		String email,

		@Schema(description = "Klartextpasswort.", example = "test1234")
		@NotBlank(message = "Passwort fehlt.")
		String password) {
}
