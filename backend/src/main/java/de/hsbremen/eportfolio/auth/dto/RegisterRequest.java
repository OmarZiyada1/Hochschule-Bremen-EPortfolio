package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.auth.PasswordPolicy;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Angaben der Registrierung, {@code POST /api/auth/register} (§3.1.1, §6.1).
 *
 * <p>Eine Rollenangabe gibt es hier bewusst nicht. Die Rolle wird
 * ausschliesslich aus der Domain der {@code hsbEmail} abgeleitet (§3.1.1);
 * das fruehere Feld {@code selectedRole} steuerte nur die Beschriftung im
 * Formular und ist mit Contract v41 entfallen (KAN-63), weil es keine
 * Information traegt, die der Server nicht ohnehin aus der Adresse gewinnt.
 *
 * @param firstName Vorname.
 * @param lastName  Nachname.
 * @param email     Private Adresse, kuenftige Login-Kennung (§3.1).
 * @param hsbEmail  Hochschuladresse, ausschliesslich
 *                  Zugehoerigkeitsnachweis. Ihre Domain entscheidet ueber die
 *                  Rolle.
 * @param password  Klartextpasswort, siehe {@link PasswordPolicy}.
 */
public record RegisterRequest(

		@Schema(example = "Erika")
		@NotBlank(message = "Vorname fehlt.")
		@Size(max = 255, message = "Vorname ist zu lang.")
		String firstName,

		@Schema(example = "Musterfrau")
		@NotBlank(message = "Nachname fehlt.")
		@Size(max = 255, message = "Nachname ist zu lang.")
		String lastName,

		@Schema(description = "Private E-Mail-Adresse. Sie wird die Login-Kennung und "
				+ "bleibt auch nach der Exmatrikulation erreichbar (§3.1.1).",
				example = "erika@example.org")
		@NotBlank(message = "Private E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email,

		@Schema(description = "Hochschuladresse. Ihre Domain muss in den konfigurierten "
				+ "Listen stehen und entscheidet ueber die Rolle (§3.1.1). Zur Anmeldung "
				+ "taugt sie nicht.",
				example = "emusterfrau@stud.hs-bremen.de")
		@NotBlank(message = "HSB-E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String hsbEmail,

		@Schema(description = "Klartextpasswort, mindestens 12 Zeichen.")
		@NotBlank(message = "Passwort fehlt.")
		@Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
				message = PasswordPolicy.MESSAGE)
		String password) {
}
