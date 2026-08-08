package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Die Bremse der Verifizierungs-Endpoints (§6.1, §6.5).
 *
 * <p>Die Zaehlmechanik selbst deckt {@link LoginAttemptServiceTest} ab; beide
 * Dienste teilen sie sich seit KAN-26 ueber {@link AttemptCounter}. Hier steht
 * nur, was diesen Dienst vom Login unterscheidet, und das ist genau eine
 * Aussage: <strong>die Zaehler sind getrennt.</strong>
 */
class VerificationAttemptServiceTest {

	private static final String EMAIL = "erika@example.org";

	private static final String IP = "192.0.2.10";

	/** Verstellbare Uhr, damit der Ablauf der Sperre ohne Warten pruefbar ist. */
	private static class TestClock extends Clock {

		private Instant now = Instant.parse("2026-08-08T10:00:00Z");

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

	private LoginAttemptProperties properties;

	private VerificationAttemptService verification;

	private LoginAttemptService login;

	@BeforeEach
	void setUp() {
		clock = new TestClock();
		properties = new LoginAttemptProperties(5, Duration.ofMinutes(15));
		verification = new VerificationAttemptService(properties, clock);
		login = new LoginAttemptService(properties, clock);
	}

	@Test
	@DisplayName("Der fuenfte Versuch sperrt, dieselben Grenzwerte wie am Login")
	void blocksFromFifthAttempt() {
		for (int i = 0; i < 4; i++) {
			verification.recordAttempt(EMAIL, IP);
			assertThat(verification.isBlocked(EMAIL, IP)).isFalse();
		}

		verification.recordAttempt(EMAIL, IP);

		assertThat(verification.isBlocked(EMAIL, IP)).isTrue();
	}

	@Test
	@DisplayName("Fuenf Code-Anforderungen sperren nicht die Anmeldung derselben Adresse")
	void doesNotBlockLogin() {
		for (int i = 0; i < 5; i++) {
			verification.recordAttempt(EMAIL, IP);
		}

		assertThat(verification.isBlocked(EMAIL, IP)).isTrue();
		// Der eigentliche Punkt dieses Dienstes: waeren es dieselben Zaehler,
		// koennte niemand mehr sagen, warum die Anmeldung ploetzlich 429 gibt.
		assertThat(login.isBlocked(EMAIL, IP)).isFalse();
	}

	@Test
	@DisplayName("Fehlgeschlagene Anmeldungen sperren nicht die Verifizierung")
	void loginFailuresDoNotBlockVerification() {
		for (int i = 0; i < 5; i++) {
			login.recordFailedAttempt(EMAIL, IP);
		}

		assertThat(login.isBlocked(EMAIL, IP)).isTrue();
		assertThat(verification.isBlocked(EMAIL, IP)).isFalse();
	}

	@Test
	@DisplayName("Eine gelungene Verifizierung gibt wieder volle fuenf Versuche frei")
	void successResets() {
		for (int i = 0; i < 4; i++) {
			verification.recordAttempt(EMAIL, IP);
		}

		verification.reset(EMAIL, IP);

		// Sonst summierten sich die beiden Schritte des Flusses: wer die private
		// Adresse nach drei Anlaeufen bestaetigt hat, haette fuer die HSB-Adresse
		// nur noch zwei uebrig.
		for (int i = 0; i < 4; i++) {
			verification.recordAttempt(EMAIL, IP);
			assertThat(verification.isBlocked(EMAIL, IP)).isFalse();
		}
	}

	@Test
	@DisplayName("Nach Ablauf der Sperrdauer geht es wieder")
	void blockExpires() {
		for (int i = 0; i < 5; i++) {
			verification.recordAttempt(EMAIL, IP);
		}
		assertThat(verification.isBlocked(EMAIL, IP)).isTrue();

		clock.advance(Duration.ofMinutes(15).plusSeconds(1));

		assertThat(verification.isBlocked(EMAIL, IP)).isFalse();
	}
}
