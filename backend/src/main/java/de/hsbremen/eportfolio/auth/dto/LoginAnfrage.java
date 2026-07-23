package de.hsbremen.eportfolio.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Anmeldedaten fuer {@code POST /api/auth/login} (§6.1).
 *
 * @param email    die <strong>private</strong> E-Mail-Adresse. Mit der
 *                 HSB-Adresse ist keine Anmeldung moeglich (§3.1.1) — sie ist
 *                 reiner Zugehoerigkeitsnachweis.
 * @param passwort Klartextpasswort, wird gegen den BCrypt-Hash geprueft.
 */
public record LoginAnfrage(
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		String email,

		@NotBlank(message = "Passwort fehlt.")
		String passwort) {
}
