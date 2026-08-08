package de.hsbremen.eportfolio.auth.dto;

import java.time.Instant;

/**
 * Antwort auf eine erfolgreiche Anmeldung (§6.1): Token + User.
 *
 * @param token                  das JWT, vom Client als {@code Authorization:
 *                               Bearer <token>} mitzuschicken (§1)
 * @param expiresAt              wann das Token ungueltig wird. Der Client kann
 *                               damit rechtzeitig zur Anmeldung fuehren, statt
 *                               auf das erste 401 zu warten.
 * @param passwordChangeRequired ob eine erzwungene Passwortaenderung aussteht
 *                               (§6.7). Aus demselben Grund schon hier wie
 *                               {@code expiresAt}: der Client soll direkt zur
 *                               Passwortseite fuehren koennen, statt erst in
 *                               ein 403 zu laufen.
 * @param user                   Benutzerdaten ohne {@code passwordHash} und
 *                               ohne {@code hsbEmail}
 */
public record LoginResponse(
		String token,
		Instant expiresAt,
		boolean passwordChangeRequired,
		UserResponse user) {
}
