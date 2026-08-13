package de.hsbremen.eportfolio.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Eigene Profildaten aendern, {@code PUT /api/auth/me} (§6.1, KAN-44, KAN-60).
 *
 * <p>Die Namensfelder wirken immer. {@code email} stoesst seit KAN-60 den
 * Wechsel der privaten Adresse an: weicht sie von der aktuellen ab, verlangt
 * der Server zusaetzlich {@code currentPassword} und verschickt einen Code mit
 * Zweck {@code EMAIL_CHANGE} an die neue Adresse; gueltig wird sie erst mit
 * dem Einloesen des Codes (§3.1). Rolle und Status vergibt ausschliesslich die
 * Administration (§5), {@code hsbEmail} bleibt unveraenderlich; weil das
 * Record diese Felder gar nicht kennt, ignoriert die JSON-Umwandlung sie in
 * jedem Request, und ein Test belegt das.
 *
 * @param firstName       Vorname.
 * @param lastName        Nachname.
 * @param email           Gewuenschte private Adresse. Fehlt das Feld oder ist
 *                        es die aktuelle Adresse, findet kein Wechsel statt;
 *                        die aktuelle Adresse bricht einen laufenden Wechsel
 *                        ab (§6.1).
 * @param currentPassword Aktuelles Passwort, nur beim Adresswechsel Pflicht.
 *                        Ohne diese Rueckversicherung koennte ein gestohlenes
 *                        Token die Login-Kennung umleiten und ueber den
 *                        Ruecksetzflow das Konto uebernehmen; dieselbe
 *                        Ueberlegung wie bei {@code PUT /auth/password}.
 */
public record ProfileUpdateRequest(

		@Schema(example = "Erika")
		@NotBlank(message = "Vorname fehlt.")
		@Size(max = 255, message = "Vorname ist zu lang.")
		String firstName,

		@Schema(example = "Musterfrau")
		@NotBlank(message = "Nachname fehlt.")
		@Size(max = 255, message = "Nachname ist zu lang.")
		String lastName,

		@Schema(description = "Gewuenschte private E-Mail-Adresse. Weglassen oder die aktuelle "
				+ "Adresse schicken heisst: kein Wechsel.", example = "erika.neu@example.org")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email,

		@Schema(description = "Aktuelles Passwort; nur beim Wechsel der E-Mail-Adresse "
				+ "erforderlich.")
		String currentPassword) {

	/** Fuer reine Namensaenderungen, das haeufigste Muster in Tests und Clients. */
	public ProfileUpdateRequest(String firstName, String lastName) {
		this(firstName, lastName, null, null);
	}
}
