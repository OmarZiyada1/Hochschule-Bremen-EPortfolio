package de.hsbremen.eportfolio.admin.dto;

import de.hsbremen.eportfolio.auth.PasswordPolicy;
import de.hsbremen.eportfolio.common.enums.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code POST /api/admin/users} (§6.1).
 *
 * <p><strong>Was der Server selbst setzt und deshalb hier fehlt:</strong>
 * {@code status = ACTIVE}, beide Verifizierungsflags auf {@code true} und
 * {@code passwordChangeRequired = true} (§6.7). Ein administrativ angelegtes
 * Konto ist sofort nutzbar, und die Verifizierung der beiden Adressen aus
 * §3.1.1 entfaellt: sie belegt gegenueber dem System, dass die Person die
 * Postfaecher besitzt, und diese Zusicherung gibt hier der Admin. Waeren die
 * Felder Teil des Bodys, koennte ein Aufruf sie auch weglassen und ein Konto
 * entstuende ohne erzwungenen Passwortwechsel.
 *
 * <p><strong>Initialpasswort statt Einladungslink.</strong> Der Admin setzt das
 * Passwort und teilt es der Person mit; die Luecke schliesst der erzwungene
 * Wechsel aus §6.7. Ein Einladungslink waere seit dem Mail-Modul (§6.8)
 * technisch moeglich, braeuchte aber einen eigenen Einladungs-Token mit
 * Gueltigkeitsdauer und Verbrauch, also einen weiteren Flow.
 *
 * @param firstName Vorname.
 * @param lastName  Nachname.
 * @param email     Private Adresse, kuenftige Login-Kennung (§3.1). Muss frei
 *                  sein, sonst 409 {@code RESOURCE_IN_USE}.
 * @param hsbEmail  Hochschuladresse. Ihre Domain muss in einer der beiden Listen
 *                  aus §3.1.1 stehen, sonst 400. Sie bestimmt hier aber
 *                  <strong>nicht</strong> die Rolle, siehe {@link #role}.
 * @param role      Rolle des neuen Kontos, frei gewaehlt. Zur Begruendung siehe
 *                  unten.
 * @param password  Initialpasswort im Klartext, siehe {@link PasswordPolicy}.
 */
public record AdminUserCreateRequest(

		@Schema(example = "Erika")
		@NotBlank(message = "Vorname fehlt.")
		@Size(max = 255, message = "Vorname ist zu lang.")
		String firstName,

		@Schema(example = "Musterfrau")
		@NotBlank(message = "Nachname fehlt.")
		@Size(max = 255, message = "Nachname ist zu lang.")
		String lastName,

		@Schema(description = "Private E-Mail-Adresse. Sie wird die Login-Kennung (§3.1).",
				example = "erika@example.org")
		@NotBlank(message = "Private E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String email,

		@Schema(description = "Hochschuladresse. Ihre Domain muss in student-domains oder "
				+ "staff-domains stehen (§3.1.1), bestimmt hier aber nicht die Rolle.",
				example = "emusterfrau@stud.hs-bremen.de")
		@NotBlank(message = "HSB-E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255, message = "E-Mail-Adresse ist zu lang.")
		String hsbEmail,

		// Anders als bei der Selbstregistrierung gilt die Angabe aus dem Body,
		// und zwar einschliesslich ADMIN. §3.1.1 leitet die Rolle deshalb aus
		// der Domain ab, weil dort niemand ausser der sich registrierenden
		// Person beteiligt ist: eine Selbstauskunft koennte sich sonst selbst
		// Redaktionsrechte verschaffen. Hier entscheidet ein Admin ueber ein
		// fremdes Konto, und §3.1.1 verlangt fuer ADMIN sogar ausdruecklich
		// diesen Weg ("nie ueber die Registrierung, ausschliesslich manuell
		// durch eine:n bestehende:n Admin"). Keine Domain kann ADMIN ergeben,
		// eine Ableitung waere also gar nicht in der Lage, diese Zusage zu
		// erfuellen. Entschieden in der Klaerungsrunde zu KAN-25.
		@Schema(description = "Rolle des neuen Kontos (§2.1). Wird uebernommen wie angegeben, "
				+ "auch ADMIN; die Domain der hsbEmail wird nur auf Zugehoerigkeit geprueft.",
				example = "STUDENT")
		@NotNull(message = "Rolle fehlt.")
		Role role,

		@Schema(description = "Initialpasswort im Klartext, mindestens 12 Zeichen. Die Person "
				+ "muss es bei der ersten Anmeldung aendern (§6.7).")
		@NotBlank(message = "Initialpasswort fehlt.")
		@Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
				message = PasswordPolicy.MESSAGE)
		String password) {
}
