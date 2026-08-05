package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.config.JwtProperties;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests der Token-Ausstellung und -Pruefung.
 */
class JwtServiceTest {

	private static final String SECRET = "a".repeat(88);

	private static final String OTHER_SECRET = "b".repeat(88);

	private final JwtService jwtService = serviceWith(Duration.ofHours(8));

	private static JwtService serviceWith(Duration lifetime) {
		return new JwtService(new JwtProperties(SECRET, lifetime, "eportfolio"));
	}

	private static AuthenticatedUser user(UUID id, Role role) {
		return new AuthenticatedUser(id, "privat@example.org", "hash", role, UserStatus.ACTIVE);
	}

	@Test
	@DisplayName("Gueltiges Token traegt userId und rolle")
	void validToken() {
		UUID id = UUID.randomUUID();
		String token = jwtService.createToken(user(id, Role.EDITOR));

		assertThat(jwtService.readUserId(token)).isEqualTo(id);
		assertThat(jwtService.readRole(token)).isEqualTo(Role.EDITOR);
	}

	@Test
	@DisplayName("Abgelaufenes Token wird abgewiesen")
	void expiredToken() {
		// Negative Laufzeit: das Token ist bei der Ausstellung bereits abgelaufen.
		JwtService shortLived = serviceWith(Duration.ofSeconds(-60));
		String token = shortLived.createToken(user(UUID.randomUUID(), Role.STUDENT));

		assertThatThrownBy(() -> jwtService.readUserId(token))
				.isInstanceOf(JwtService.TokenExpiredException.class);
	}

	@Test
	@DisplayName("Manipuliertes Token wird abgewiesen (Signatur passt nicht mehr)")
	void tamperedToken() {
		String token = jwtService.createToken(user(UUID.randomUUID(), Role.STUDENT));

		// Ein Zeichen im Payload-Teil kippen. Die Signatur deckt Header und
		// Payload ab und passt danach nicht mehr.
		String[] parts = token.split("\\.");
		char replacement = parts[1].charAt(5) == 'A' ? 'B' : 'A';
		String tampered = parts[0] + "."
				+ parts[1].substring(0, 5) + replacement + parts[1].substring(6) + "."
				+ parts[2];

		assertThatThrownBy(() -> jwtService.readUserId(tampered))
				.isInstanceOf(JwtService.TokenInvalidException.class);
	}

	@Test
	@DisplayName("Token mit fremdem Secret wird abgewiesen")
	void foreignSignedToken() {
		JwtService foreign = new JwtService(new JwtProperties(OTHER_SECRET, Duration.ofHours(8), "eportfolio"));
		String token = foreign.createToken(user(UUID.randomUUID(), Role.ADMIN));

		assertThatThrownBy(() -> jwtService.readUserId(token))
				.isInstanceOf(JwtService.TokenInvalidException.class);
	}

	@Test
	@DisplayName("Voelliger Unsinn statt Token wird abgewiesen")
	void noToken() {
		assertThatThrownBy(() -> jwtService.readUserId("das-ist-kein-jwt"))
				.isInstanceOf(JwtService.TokenInvalidException.class);
	}

	@Test
	@DisplayName("Zu kurzes Secret laesst den Dienst gar nicht erst starten")
	void secretTooShort() {
		assertThatThrownBy(() -> new JwtService(new JwtProperties("kurz", Duration.ofHours(8), "eportfolio")))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("JWT_SECRET");
	}
}
