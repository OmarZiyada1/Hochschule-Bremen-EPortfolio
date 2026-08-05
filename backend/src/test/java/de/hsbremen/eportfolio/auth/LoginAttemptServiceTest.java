package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests der Anmeldeversuchs-Sperre.
 */
class LoginAttemptServiceTest {

	private static final String EMAIL = "privat@example.org";

	private static final String IP = "192.0.2.10";

	/** Verstellbare Uhr, damit der Ablauf der Sperre ohne Warten pruefbar ist. */
	private static class TestClock extends Clock {

		private Instant now = Instant.parse("2026-07-23T10:00:00Z");

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

		void advance(Duration duration) {
			now = now.plus(duration);
		}
	}

	private TestClock clock;

	private LoginAttemptService service;

	@BeforeEach
	void setUp() {
		clock = new TestClock();
		service = new LoginAttemptService(
				new LoginAttemptProperties(5, Duration.ofMinutes(15)), clock);
	}

	@Test
	@DisplayName("Vier Fehlversuche sperren noch nicht, der fuenfte sperrt")
	void blocksFromFifthFailedAttempt() {
		for (int i = 0; i < 4; i++) {
			service.recordFailedAttempt(EMAIL, IP);
			assertThat(service.isBlocked(EMAIL, IP)).isFalse();
		}

		service.recordFailedAttempt(EMAIL, IP);

		assertThat(service.isBlocked(EMAIL, IP)).isTrue();
	}

	@Test
	@DisplayName("Erfolgreicher Login vor der Grenze setzt den Zaehler zurueck")
	void successResets() {
		for (int i = 0; i < 4; i++) {
			service.recordFailedAttempt(EMAIL, IP);
		}

		service.reset(EMAIL, IP);

		// Nach dem Zuruecksetzen stehen wieder volle fuenf Versuche zur Verfuegung.
		for (int i = 0; i < 4; i++) {
			service.recordFailedAttempt(EMAIL, IP);
			assertThat(service.isBlocked(EMAIL, IP)).isFalse();
		}
	}

	@Test
	@DisplayName("Nach Ablauf der Sperrdauer geht es wieder")
	void blockExpires() {
		for (int i = 0; i < 5; i++) {
			service.recordFailedAttempt(EMAIL, IP);
		}
		assertThat(service.isBlocked(EMAIL, IP)).isTrue();

		clock.advance(Duration.ofMinutes(15).plusSeconds(1));

		assertThat(service.isBlocked(EMAIL, IP)).isFalse();
	}

	@Test
	@DisplayName("Die E-Mail-Sperre wirkt auch von einer anderen IP aus")
	void emailBlockSurvivesIpChange() {
		for (int i = 0; i < 5; i++) {
			service.recordFailedAttempt(EMAIL, "198.51.100." + i);
		}

		// Sonst koennte ein Angreifer ein einzelnes Konto durch IP-Wechsel
		// beliebig weiter angreifen.
		assertThat(service.isBlocked(EMAIL, "203.0.113.99")).isTrue();
	}

	@Test
	@DisplayName("Die IP-Sperre wirkt auch fuer eine andere E-Mail-Adresse")
	void ipBlockSurvivesAccountChange() {
		for (int i = 0; i < 5; i++) {
			service.recordFailedAttempt("konto" + i + "@example.org", IP);
		}

		// Sonst koennte eine IP der Reihe nach beliebig viele Konten durchprobieren.
		assertThat(service.isBlocked("ganz-anderes@example.org", IP)).isTrue();
	}

	@Test
	@DisplayName("E-Mail und IP zaehlen getrennt: eine gesperrte IP sperrt nicht die Adresse")
	void keysAreIndependent() {
		for (int i = 0; i < 5; i++) {
			service.recordFailedAttempt("konto" + i + "@example.org", IP);
		}

		assertThat(service.isBlocked(EMAIL, IP)).isTrue();
		// Dieselbe Adresse von einer unbelasteten IP aus ist frei.
		assertThat(service.isBlocked(EMAIL, "203.0.113.7")).isFalse();
	}

	@Test
	@DisplayName("Gross- und Kleinschreibung treffen denselben Zaehler")
	void emailIsNormalized() {
		for (int i = 0; i < 5; i++) {
			service.recordFailedAttempt("Privat@Example.ORG", IP);
		}

		// Sonst waere die Sperre durch eine andere Schreibweise zu umgehen.
		assertThat(service.isBlocked(EMAIL, "203.0.113.7")).isTrue();
	}
}
