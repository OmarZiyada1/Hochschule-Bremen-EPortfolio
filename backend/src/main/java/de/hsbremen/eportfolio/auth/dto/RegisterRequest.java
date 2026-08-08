package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.auth.PasswordPolicy;
import de.hsbremen.eportfolio.common.enums.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Angaben aus Schritt 1 und 2 der Registrierung, {@code POST /api/auth/register}
 * (§3.1.1, §6.1).
 *
 * @param selectedRole Die im Formular gewaehlte Art der HSB-Adresse.
 *                     <strong>Sie bestimmt die Rolle nicht.</strong> Die Rolle
 *                     wird aus der Domain der {@code hsbEmail} abgeleitet
 *                     (§3.1.1); dieses Feld wird nur dagegen geprueft und
 *                     ergibt bei Abweichung 400. Wuerde die uebermittelte
 *                     Auswahl die Rolle bestimmen, koennte jede Person mit
 *                     studentischer Adresse durch Umsetzen eines Feldes im
 *                     Request Redaktionsrechte erhalten.
 * @param firstName    Vorname.
 * @param lastName     Nachname.
 * @param email        Private Adresse, kuenftige Login-Kennung (§3.1).
 * @param hsbEmail     Hochschuladresse, ausschliesslich
 *                     Zugehoerigkeitsnachweis. Ihre Domain entscheidet ueber die
 *                     Rolle.
 * @param password     Klartextpasswort, siehe {@link PasswordPolicy}.
 */
public record RegisterRequest(

		// Bewusst das Enum und kein String: ein unbekannter Wert scheitert damit
		// schon an der JSON-Umwandlung und ergibt VALIDATION_FAILED. Anders als
		// beim Blocktyp (siehe ErrorCodes.BLOCK_TYPE_UNKNOWN) fuehrt §6.2 fuer
		// eine falsche Rollenauswahl keinen eigenen Fehlercode, es gibt also
		// nichts zu unterscheiden.
		@Schema(description = "Art der HSB-Adresse laut Formular, STUDENT oder EDITOR. "
				+ "Steuert nur die Beschriftung und die erwartete Domain; die "
				+ "tatsaechliche Rolle leitet der Server aus der Domain der hsbEmail ab "
				+ "(§3.1.1). ADMIN ist hier nie zulaessig.",
				example = "STUDENT")
		@NotNull(message = "Art der HSB-Adresse fehlt.")
		Role selectedRole,

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
