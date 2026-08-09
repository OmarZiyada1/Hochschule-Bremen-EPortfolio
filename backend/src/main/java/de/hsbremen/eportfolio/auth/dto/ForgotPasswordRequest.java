package de.hsbremen.eportfolio.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Anfordern eines Ruecksetzcodes, {@code POST /api/auth/forgot-password}
 * (§6.1, KAN-43).
 *
 * <p>Kein Passwort und kein Token: wer hier ankommt, hat sein Passwort ja
 * gerade vergessen. An die Stelle der Anmeldung treten das Einmalgeheimnis im
 * Postfach und das Rate-Limit aus §6.5; die Antwort ist fuer bekannte und
 * unbekannte Adressen dieselbe (204).
 *
 * @param email Private Adresse, also die Kennung des Kontos (§3.1); an sie
 *              geht auch der Code, denn ihr Postfach ist das, dessen Besitz
 *              die Ruecksetzung legitimiert.
 */
public record ForgotPasswordRequest(

		@Schema(description = "Private E-Mail-Adresse, also die Kennung des Kontos.",
				example = "erika@example.org")
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email) {
}
