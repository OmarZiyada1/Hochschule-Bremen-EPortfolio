package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.enums.Rolle;
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
 * <p>Claims: {@code sub} traegt die {@code userId}, {@code rolle} die
 * persistierte Rolle aus §2.1. Mehr steht bewusst nicht darin — insbesondere
 * keine E-Mail-Adresse. Ein JWT ist nur signiert, nicht verschluesselt; sein
 * Inhalt ist fuer jeden lesbar, der das Token in die Finger bekommt.
 *
 * <p>Der Rollen-Claim wird beim Autorisieren <em>nicht</em> verwendet: der
 * {@link JwtAuthentifizierungsFilter} laedt Rolle und Status bei jedem Request
 * frisch aus der Datenbank. Der Claim dient der Nachvollziehbarkeit und dem
 * Client.
 */
@Service
public class JwtService {

	static final String CLAIM_ROLLE = "rolle";

	private final JwtEigenschaften eigenschaften;

	private final SecretKey schluessel;

	public JwtService(JwtEigenschaften eigenschaften) {
		this.eigenschaften = eigenschaften;
		this.schluessel = leiteSchluesselAb(eigenschaften.secret());
	}

	/**
	 * Das Secret wird als Base64 gelesen, faellt aber auf die Rohbytes zurueck,
	 * falls es kein gueltiges Base64 ist. So funktioniert sowohl ein mit
	 * {@code openssl rand -base64 64} erzeugter Wert als auch eine lange
	 * Passphrase.
	 */
	private static SecretKey leiteSchluesselAb(String secret) {
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

	public String erzeugeToken(AngemeldeterBenutzer benutzer) {
		Instant jetzt = Instant.now();
		Instant ablauf = jetzt.plus(eigenschaften.laufzeit());

		return Jwts.builder()
				.issuer(eigenschaften.issuer())
				.subject(benutzer.getId().toString())
				.claim(CLAIM_ROLLE, benutzer.getRolle().name())
				.issuedAt(Date.from(jetzt))
				.expiration(Date.from(ablauf))
				.signWith(schluessel)
				.compact();
	}

	public Instant ablaufZeitpunkt(Instant ausgestelltAm) {
		return ausgestelltAm.plus(eigenschaften.laufzeit());
	}

	/**
	 * Prueft Signatur und Ablauf und liefert die userId aus dem
	 * {@code sub}-Claim.
	 *
	 * @throws TokenAbgelaufenException  wenn das Token abgelaufen ist
	 * @throws TokenUngueltigException   bei falscher Signatur, kaputtem Aufbau
	 *                                   oder unbrauchbarem Subject
	 */
	public UUID leseBenutzerId(String token) {
		Claims claims = leseClaims(token);
		try {
			return UUID.fromString(claims.getSubject());
		} catch (IllegalArgumentException | NullPointerException ex) {
			throw new TokenUngueltigException("Das Token enthaelt keine gueltige Benutzer-ID.");
		}
	}

	public Rolle leseRolle(String token) {
		String rolle = leseClaims(token).get(CLAIM_ROLLE, String.class);
		try {
			return Rolle.valueOf(rolle);
		} catch (IllegalArgumentException | NullPointerException ex) {
			throw new TokenUngueltigException("Das Token enthaelt keine gueltige Rolle.");
		}
	}

	private Claims leseClaims(String token) {
		try {
			return Jwts.parser()
					.verifyWith(schluessel)
					.requireIssuer(eigenschaften.issuer())
					.build()
					.parseSignedClaims(token)
					.getPayload();
		} catch (io.jsonwebtoken.ExpiredJwtException ex) {
			throw new TokenAbgelaufenException("Das Token ist abgelaufen.");
		} catch (JwtException | IllegalArgumentException ex) {
			// Faengt auch SignatureException: manipuliertes oder fremd
			// signiertes Token.
			throw new TokenUngueltigException("Das Token ist ungueltig.");
		}
	}

	/** Token vorhanden, aber nicht verwertbar. Fuehrt zu 401. */
	public static class TokenUngueltigException extends RuntimeException {
		public TokenUngueltigException(String meldung) {
			super(meldung);
		}
	}

	/** Token war einmal gueltig, ist aber abgelaufen. Fuehrt zu 401. */
	public static class TokenAbgelaufenException extends RuntimeException {
		public TokenAbgelaufenException(String meldung) {
			super(meldung);
		}
	}
}
