package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Eingabe der Schritte 3 und 4 der Registrierung,
 * {@code POST /api/auth/verify} (§3.1.1, §6.1).
 *
 * @param email   Immer die <strong>private</strong> Adresse, auch wenn der
 *                Zweck {@code HSB_EMAIL} lautet. Sie ist die Kennung des Kontos
 *                (§3.1); der Zweck sagt, welche der beiden Adressen der Code
 *                bestaetigt, nicht wohin er geschickt wurde.
 * @param purpose Welche Adresse bestaetigt wird (§2.11). {@code PASSWORD_RESET}
 *                gehoert nicht hierher, sondern zu
 *                {@code POST /auth/reset-password} (KAN-43), und ergibt an
 *                diesem Endpoint 400.
 * @param code    Der sechsstellige Code aus der Mail. Bewusst ohne Formatpruefung
 *                am Record: §6.2 fuehrt „ungueltig, abgelaufen oder bereits
 *                verbraucht" unter einem einzigen Fehlercode, und ein vertippter
 *                Code soll nicht je nach Laenge zwei verschiedene Meldungen
 *                ergeben. Die Obergrenze ist nur ein Riegel gegen unsinnig lange
 *                Eingaben.
 */
public record VerifyRequest(

		@Schema(description = "Private E-Mail-Adresse, also die Kennung des Kontos.",
				example = "erika@example.org")
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email,

		@Schema(description = "PRIVATE_EMAIL oder HSB_EMAIL.", example = "PRIVATE_EMAIL")
		@NotNull(message = "Zweck fehlt.")
		VerificationPurpose purpose,

		@Schema(description = "Sechsstelliger Code aus der Mail.", example = "042317")
		@NotBlank(message = "Code fehlt.")
		@Size(max = 64, message = "Code ist zu lang.")
		String code) {
}
