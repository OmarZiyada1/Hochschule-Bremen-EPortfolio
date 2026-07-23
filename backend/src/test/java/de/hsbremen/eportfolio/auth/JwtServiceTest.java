package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests der Token-Ausstellung und -Pruefung.
 */
class JwtServiceTest {

	private static final String SECRET = "a".repeat(88);

	private static final String ANDERES_SECRET = "b".repeat(88);

	private final JwtService jwtService = dienstMit(Duration.ofHours(8));

	private static JwtService dienstMit(Duration laufzeit) {
		return new JwtService(new JwtEigenschaften(SECRET, laufzeit, "eportfolio"));
	}

	private static AngemeldeterBenutzer benutzer(UUID id, Rolle rolle) {
		return new AngemeldeterBenutzer(id, "privat@example.org", "hash", rolle, UserStatus.AKTIV);
	}

	@Test
	@DisplayName("Gueltiges Token traegt userId und rolle")
	void gueltigesToken() {
		UUID id = UUID.randomUUID();
		String token = jwtService.erzeugeToken(benutzer(id, Rolle.REDAKTEUR));

		assertThat(jwtService.leseBenutzerId(token)).isEqualTo(id);
		assertThat(jwtService.leseRolle(token)).isEqualTo(Rolle.REDAKTEUR);
	}

	@Test
	@DisplayName("Abgelaufenes Token wird abgewiesen")
	void abgelaufenesToken() {
		// Negative Laufzeit: das Token ist bei der Ausstellung bereits abgelaufen.
		JwtService kurzlebig = dienstMit(Duration.ofSeconds(-60));
		String token = kurzlebig.erzeugeToken(benutzer(UUID.randomUUID(), Rolle.STUDIERENDE));

		assertThatThrownBy(() -> jwtService.leseBenutzerId(token))
				.isInstanceOf(JwtService.TokenAbgelaufenException.class);
	}

	@Test
	@DisplayName("Manipuliertes Token wird abgewiesen (Signatur passt nicht mehr)")
	void manipuliertesToken() {
		String token = jwtService.erzeugeToken(benutzer(UUID.randomUUID(), Rolle.STUDIERENDE));

		// Ein Zeichen im Payload-Teil kippen. Die Signatur deckt Header und
		// Payload ab und passt danach nicht mehr.
		String[] teile = token.split("\\.");
		char ersetzt = teile[1].charAt(5) == 'A' ? 'B' : 'A';
		String manipuliert = teile[0] + "."
				+ teile[1].substring(0, 5) + ersetzt + teile[1].substring(6) + "."
				+ teile[2];

		assertThatThrownBy(() -> jwtService.leseBenutzerId(manipuliert))
				.isInstanceOf(JwtService.TokenUngueltigException.class);
	}

	@Test
	@DisplayName("Token mit fremdem Secret wird abgewiesen")
	void fremdSigniertesToken() {
		JwtService fremd = new JwtService(new JwtEigenschaften(ANDERES_SECRET, Duration.ofHours(8), "eportfolio"));
		String token = fremd.erzeugeToken(benutzer(UUID.randomUUID(), Rolle.ADMIN));

		assertThatThrownBy(() -> jwtService.leseBenutzerId(token))
				.isInstanceOf(JwtService.TokenUngueltigException.class);
	}

	@Test
	@DisplayName("Voelliger Unsinn statt Token wird abgewiesen")
	void keinToken() {
		assertThatThrownBy(() -> jwtService.leseBenutzerId("das-ist-kein-jwt"))
				.isInstanceOf(JwtService.TokenUngueltigException.class);
	}

	@Test
	@DisplayName("Zu kurzes Secret laesst den Dienst gar nicht erst starten")
	void zuKurzesSecret() {
		assertThatThrownBy(() -> new JwtService(new JwtEigenschaften("kurz", Duration.ofHours(8), "eportfolio")))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("JWT_SECRET");
	}
}
