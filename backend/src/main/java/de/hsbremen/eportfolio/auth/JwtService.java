package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.enums.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/**
 * Stellt Zugriffstokens aus und liest sie wieder ein (API-Contract §1: JWT,
 * {@code Authorization: Bearer <token>}).
 *
 * <p>Claims: {@code sub} traegt die {@code userId}, {@code role} die
 * persistierte Rolle aus §2.1. Mehr steht bewusst nicht darin, insbesondere
 * keine E-Mail-Adresse. Ein JWT ist nur signiert, nicht verschluesselt; sein
 * Inhalt ist fuer jeden lesbar, der das Token in die Finger bekommt.
 *
 * <p>Der Rollen-Claim wird beim Autorisieren <em>nicht</em> verwendet: der
 * {@link JwtAuthenticationFilter} laedt Rolle und Status bei jedem Request
 * frisch aus der Datenbank. Der Claim dient der Nachvollziehbarkeit und dem
 * Client.
 */
@Service
public class JwtService {

	static final String CLAIM_ROLE = "role";

	private final JwtProperties properties;

	private final SecretKey key;

	public JwtService(JwtProperties properties) {
		this.properties = properties;
		this.key = deriveKey(properties.secret());
	}

	/**
	 * Das Secret wird als Base64 gelesen, faellt aber auf die Rohbytes zurueck,
	 * falls es kein gueltiges Base64 ist. So funktioniert sowohl ein mit
	 * {@code openssl rand -base64 64} erzeugter Wert als auch eine lange
	 * Passphrase.
	 */
	private static SecretKey deriveKey(String secret) {
		byte[] bytes;
		try {
			bytes = Base64.getDecoder().decode(secret);
		} catch (IllegalArgumentException ex) {
			bytes = secret.getBytes(StandardCharsets.UTF_8);
		}
		if (bytes.length < 64) {
			throw new IllegalStateException(
					"JWT_SECRET ist zu kurz: HS512 braucht mindestens 64 Byte Schluesselmaterial. "
							+ "Neuen Wert erzeugen mit: openssl rand -base64 64");
		}
		return io.jsonwebtoken.security.Keys.hmacShaKeyFor(bytes);
	}

	public String createToken(AuthenticatedUser user) {
		Instant now = Instant.now();
		Instant expiry = now.plus(properties.lifetime());

		return Jwts.builder()
				.issuer(properties.issuer())
				.subject(user.getId().toString())
				.claim(CLAIM_ROLE, user.getRole().name())
				.issuedAt(Date.from(now))
				.expiration(Date.from(expiry))
				.signWith(key)
				.compact();
	}

	public Instant expiresAt(Instant issuedAt) {
		return issuedAt.plus(properties.lifetime());
	}

	/**
	 * Prueft Signatur und Ablauf und liefert die userId aus dem
	 * {@code sub}-Claim.
	 *
	 * @throws TokenExpiredException wenn das Token abgelaufen ist
	 * @throws TokenInvalidException bei falscher Signatur, kaputtem Aufbau oder
	 *                               unbrauchbarem Subject
	 */
	public UUID readUserId(String token) {
		Claims claims = readClaims(token);
		try {
			return UUID.fromString(claims.getSubject());
		} catch (IllegalArgumentException | NullPointerException ex) {
			throw new TokenInvalidException("Das Token enthaelt keine gueltige Benutzer-ID.");
		}
	}

	public Role readRole(String token) {
		String role = readClaims(token).get(CLAIM_ROLE, String.class);
		try {
			return Role.valueOf(role);
		} catch (IllegalArgumentException | NullPointerException ex) {
			throw new TokenInvalidException("Das Token enthaelt keine gueltige Rolle.");
		}
	}

	private Claims readClaims(String token) {
		try {
			return Jwts.parser()
					.verifyWith(key)
					.requireIssuer(properties.issuer())
					.build()
					.parseSignedClaims(token)
					.getPayload();
		} catch (io.jsonwebtoken.ExpiredJwtException ex) {
			throw new TokenExpiredException("Das Token ist abgelaufen.");
		} catch (JwtException | IllegalArgumentException ex) {
			// Faengt auch SignatureException: manipuliertes oder fremd
			// signiertes Token.
			throw new TokenInvalidException("Das Token ist ungueltig.");
		}
	}

	/** Token vorhanden, aber nicht verwertbar. Fuehrt zu 401. */
	public static class TokenInvalidException extends RuntimeException {
		public TokenInvalidException(String message) {
			super(message);
		}
	}

	/** Token war einmal gueltig, ist aber abgelaufen. Fuehrt zu 401. */
	public static class TokenExpiredException extends RuntimeException {
		public TokenExpiredException(String message) {
			super(message);
		}
	}
}
