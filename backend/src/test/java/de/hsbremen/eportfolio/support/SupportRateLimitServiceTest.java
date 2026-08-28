package de.hsbremen.eportfolio.support;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.config.SupportProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Der Ablauf der Bremse am Kontaktformular (§6.5).
 *
 * <p>Steht hier und nicht im {@code SupportIntegrationTest}, aus demselben
 * Grund wie bei {@code EditLockRegistryTest}: er haengt an der Uhr, und eine
 * vorgestellte Uhr gehoert nicht in einen Spring-Kontext, den sich alle Tests
 * teilen. Aufbau wie {@code LoginAttemptServiceTest}.
 */
class SupportRateLimitServiceTest {

	private static final String EMAIL = "lena.brandt@example.org";

	private static final String IP = "192.0.2.10";

	/** Verstellbare Uhr, damit der Ablauf der Sperre ohne Warten pruefbar ist. */
	private static class TestClock extends Clock {

		private Instant now = Instant.parse("2026-08-28T10:00:00Z");

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		void advance(Duration duration) {
			now = now.plus(duration);
		}
	}

	private TestClock clock;

	private SupportRateLimitService service;

	@BeforeEach
	void setUp() {
		clock = new TestClock();
		service = new SupportRateLimitService(
				new SupportProperties(3, Duration.ofHours(1)), clock);
	}

	@Test
	@DisplayName("Zwei Einsendungen sperren noch nicht, die dritte sperrt")
	void blocksFromThirdRequest() {
		for (int i = 0; i < 2; i++) {
			service.recordAttempt(EMAIL, IP);
			assertThat(service.isBlocked(EMAIL, IP)).isFalse();
		}

		service.recordAttempt(EMAIL, IP);

		assertThat(service.isBlocked(EMAIL, IP)).isTrue();
	}

	@Test
	@DisplayName("Nach Ablauf des Fensters faengt der Zaehler wieder bei null an")
	void unblocksAfterWindow() {
		for (int i = 0; i < 3; i++) {
			service.recordAttempt(EMAIL, IP);
		}
		assertThat(service.isBlocked(EMAIL, IP)).isTrue();

		clock.advance(Duration.ofHours(1).plusSeconds(1));

		assertThat(service.isBlocked(EMAIL, IP)).isFalse();
	}

	@Test
	@DisplayName("Die IP sperrt auch eine bisher unbenutzte Adresse (§6.5)")
	void blocksByIpAcrossAddresses() {
		for (int i = 0; i < 3; i++) {
			service.recordAttempt("wechselnd-" + i + "@example.org", IP);
		}

		assertThat(service.isBlocked("noch-nie-benutzt@example.org", IP)).isTrue();
	}

	@Test
	@DisplayName("Die Adresse sperrt auch von einer anderen IP aus (§6.5)")
	void blocksByEmailAcrossAddresses() {
		for (int i = 0; i < 3; i++) {
			service.recordAttempt(EMAIL, "198.51.100." + i);
		}

		assertThat(service.isBlocked(EMAIL, "203.0.113.7")).isTrue();
	}

	@Test
	@DisplayName("Gross- und Kleinschreibung der Adresse treffen denselben Zaehler")
	void normalisesEmail() {
		for (int i = 0; i < 3; i++) {
			service.recordAttempt("Lena.Brandt@Example.ORG", IP);
		}

		assertThat(service.isBlocked(EMAIL, "203.0.113.7")).isTrue();
	}

	/**
	 * Anders als am Login gibt es hier kein Zuruecksetzen bei Erfolg: die Zeile
	 * im Eingangsbuch ist genau das, was begrenzt werden soll. Der Test haelt
	 * fest, dass die Klasse dafuer auch keine Tuer offen laesst.
	 */
	@Test
	@DisplayName("Es gibt kein Zuruecksetzen: drei gelungene Einsendungen sperren")
	void successfulRequestsCountToo() {
		service.recordAttempt(EMAIL, IP);
		service.recordAttempt(EMAIL, IP);
		service.recordAttempt(EMAIL, IP);

		assertThat(service.isBlocked(EMAIL, IP)).isTrue();
	}

	@Test
	@DisplayName("Unbrauchbare Werte fallen auf Standardwerte zurueck")
	void fallsBackToDefaults() {
		SupportProperties defaults = new SupportProperties(0, null);

		assertThat(defaults.maxAttempts()).isEqualTo(3);
		assertThat(defaults.lockoutDuration()).isEqualTo(Duration.ofHours(1));
	}
}
