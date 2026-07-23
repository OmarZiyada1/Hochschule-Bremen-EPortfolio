package de.hsbremen.eportfolio.auth.dto;

import java.time.Instant;

/**
 * Antwort auf eine erfolgreiche Anmeldung (§6.1): Token + User.
 *
 * @param token          das JWT, vom Client als {@code Authorization: Bearer
 *                       <token>} mitzuschicken (§1)
 * @param ablaufZeitpunkt wann das Token ungueltig wird. Der Client kann damit
 *                       rechtzeitig zur Anmeldung fuehren, statt auf das erste
 *                       401 zu warten.
 * @param benutzer       Benutzerdaten ohne {@code passwortHash} und ohne
 *                       {@code hsbEmail}
 */
public record LoginAntwort(
		String token,
		Instant ablaufZeitpunkt,
		BenutzerAntwort benutzer) {
}
