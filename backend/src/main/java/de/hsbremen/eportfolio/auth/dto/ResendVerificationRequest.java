package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Erneutes Anfordern eines Codes, {@code POST /api/auth/verify/resend} (§6.1).
 *
 * <p>Kein Passwort und kein Token: der Endpoint ist PUBLIC, weil sich zu diesem
 * Zeitpunkt niemand anmelden kann. Genau deshalb antwortet er fuer bekannte und
 * unbekannte Adressen gleich und unterliegt einem Rate-Limit.
 *
 * @param email   Private Adresse, also die Kennung des Kontos, wie bei
 *                {@link VerifyRequest}; beim Zweck {@code EMAIL_CHANGE}
 *                (KAN-60) dagegen die neue Wunschadresse.
 * @param purpose Welcher Code neu geschickt werden soll (§2.11).
 */
public record ResendVerificationRequest(

		@Schema(description = "Private E-Mail-Adresse, also die Kennung des Kontos.",
				example = "erika@example.org")
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email,

		@Schema(description = "PRIVATE_EMAIL, HSB_EMAIL oder EMAIL_CHANGE.",
				example = "HSB_EMAIL")
		@NotNull(message = "Zweck fehlt.")
		VerificationPurpose purpose) {
}
