package de.hsbremen.eportfolio.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Antwort von {@code POST /api/admin/users/{id}/reset-password} (§6.1, KAN-43).
 *
 * <p>Die eine Stelle, an der das serverseitig erzeugte Initialpasswort im
 * Klartext existiert. Es wird genau einmal ausgegeben und nirgends geloggt;
 * danach steht in der Datenbank nur der BCrypt-Hash, und
 * {@code passwordChangeRequired} erzwingt die Aenderung bei der ersten
 * Anmeldung (§6.7).
 *
 * <p>Bewusst ohne {@code toString}-Ueberschreibung mit Inhalt: das Record
 * traegt ein Geheimnis, und eine einzige spaetere Logzeile
 * {@code log.debug("{}", response)} wuerde es ins Protokoll tragen. Dieselbe
 * Ueberlegung wie bei {@code VerificationCodeService.IssuedCode}.
 *
 * @param initialPassword das neue Initialpasswort, das der Admin der Person
 *                        uebergibt
 */
public record AdminPasswordResetResponse(

		@Schema(description = "Das erzeugte Initialpasswort. Erscheint nur in dieser einen "
				+ "Antwort und muss bei der ersten Anmeldung geaendert werden (§6.7).")
		String initialPassword) {

	@Override
	public String toString() {
		return "AdminPasswordResetResponse[initialPassword=***]";
	}
}
