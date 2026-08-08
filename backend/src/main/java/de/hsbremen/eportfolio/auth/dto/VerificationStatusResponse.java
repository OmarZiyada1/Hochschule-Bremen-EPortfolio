package de.hsbremen.eportfolio.auth.dto;

import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;

/**
 * Antwort auf {@code POST /api/auth/verify} (§6.1).
 *
 * <p>Sie sagt dem Client genau das, was er nach dem Einloesen eines Codes wissen
 * muss: welche der beiden Adressen noch aussteht und ob Schritt 5 aus §3.1.1
 * damit erreicht ist. Ohne diese drei Felder muesste das Frontend den Abschluss
 * der Registrierung raten oder ihn erst beim naechsten Anmeldeversuch erfahren.
 *
 * <p><strong>Sie entsteht nur nach einem gueltigen Code.</strong> Damit gibt sie
 * nichts preis: wer sie sieht, hat gerade Zugriff auf eines der beiden
 * Postfaecher nachgewiesen. Fuer jede andere Eingabe, auch fuer eine unbekannte
 * Adresse, ist die Antwort 400 {@code VERIFICATION_CODE_INVALID} und damit
 * ununterscheidbar.
 *
 * <p>Bewusst ohne {@code hsbEmail} und ohne {@code passwordHash} (§3.1), und
 * bewusst kein zweites {@code UserResponse}: hier interessiert der Fortschritt
 * des Flusses, nicht das Konto.
 *
 * @param emailVerified    Private Adresse bestaetigt.
 * @param hsbEmailVerified Hochschuladresse bestaetigt.
 * @param status           Kontostatus (§2.9). Steht er auf {@code ACTIVE}, ist
 *                         die Registrierung abgeschlossen und die Anmeldung
 *                         moeglich.
 */
public record VerificationStatusResponse(
		boolean emailVerified,
		boolean hsbEmailVerified,
		UserStatus status) {

	public static VerificationStatusResponse from(User user) {
		return new VerificationStatusResponse(
				user.isEmailVerified(),
				user.isHsbEmailVerified(),
				user.getStatus());
	}
}
