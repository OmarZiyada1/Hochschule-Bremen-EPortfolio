package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;

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
class AnmeldeversuchServiceTest {

	private static final String EMAIL = "privat@example.org";

	private static final String IP = "192.0.2.10";

	/** Verstellbare Uhr, damit der Ablauf der Sperre ohne Warten pruefbar ist. */
	private static class Testuhr extends Clock {

		private Instant jetzt = Instant.parse("2026-07-23T10:00:00Z");

		@Override
		public Instant instant() {
			return jetzt;
		}

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

		void weiter(Duration dauer) {
			jetzt = jetzt.plus(dauer);
		}
	}

	private Testuhr uhr;

	private AnmeldeversuchService service;

	@BeforeEach
	void setUp() {
		uhr = new Testuhr();
		service = new AnmeldeversuchService(
				new AnmeldeversuchEigenschaften(5, Duration.ofMinutes(15)), uhr);
	}

	@Test
	@DisplayName("Vier Fehlversuche sperren noch nicht, der fuenfte sperrt")
	void sperrtAbDemFuenftenFehlversuch() {
		for (int i = 0; i < 4; i++) {
			service.registriereFehlversuch(EMAIL, IP);
			assertThat(service.istGesperrt(EMAIL, IP)).isFalse();
		}

		service.registriereFehlversuch(EMAIL, IP);

		assertThat(service.istGesperrt(EMAIL, IP)).isTrue();
	}

	@Test
	@DisplayName("Erfolgreicher Login vor der Grenze setzt den Zaehler zurueck")
	void erfolgSetztZurueck() {
		for (int i = 0; i < 4; i++) {
			service.registriereFehlversuch(EMAIL, IP);
		}

		service.setzeZurueck(EMAIL, IP);

		// Nach dem Zuruecksetzen stehen wieder volle fuenf Versuche zur Verfuegung.
		for (int i = 0; i < 4; i++) {
			service.registriereFehlversuch(EMAIL, IP);
			assertThat(service.istGesperrt(EMAIL, IP)).isFalse();
		}
	}

	@Test
	@DisplayName("Nach Ablauf der Sperrdauer geht es wieder")
	void sperreLaeuftAb() {
		for (int i = 0; i < 5; i++) {
			service.registriereFehlversuch(EMAIL, IP);
		}
		assertThat(service.istGesperrt(EMAIL, IP)).isTrue();

		uhr.weiter(Duration.ofMinutes(15).plusSeconds(1));

		assertThat(service.istGesperrt(EMAIL, IP)).isFalse();
	}

	@Test
	@DisplayName("Die E-Mail-Sperre wirkt auch von einer anderen IP aus")
	void emailSperreUeberIpWechselHinweg() {
		for (int i = 0; i < 5; i++) {
			service.registriereFehlversuch(EMAIL, "198.51.100." + i);
		}

		// Sonst koennte ein Angreifer ein einzelnes Konto durch IP-Wechsel
		// beliebig weiter angreifen.
		assertThat(service.istGesperrt(EMAIL, "203.0.113.99")).isTrue();
	}

	@Test
	@DisplayName("Die IP-Sperre wirkt auch fuer eine andere E-Mail-Adresse")
	void ipSperreUeberKontenHinweg() {
		for (int i = 0; i < 5; i++) {
			service.registriereFehlversuch("konto" + i + "@example.org", IP);
		}

		// Sonst koennte eine IP der Reihe nach beliebig viele Konten durchprobieren.
		assertThat(service.istGesperrt("ganz-anderes@example.org", IP)).isTrue();
	}

	@Test
	@DisplayName("E-Mail und IP zaehlen getrennt: eine gesperrte IP sperrt nicht die Adresse")
	void schluesselSindUnabhaengig() {
		for (int i = 0; i < 5; i++) {
			service.registriereFehlversuch("konto" + i + "@example.org", IP);
		}

		assertThat(service.istGesperrt(EMAIL, IP)).isTrue();
		// Dieselbe Adresse von einer unbelasteten IP aus ist frei.
		assertThat(service.istGesperrt(EMAIL, "203.0.113.7")).isFalse();
	}

	@Test
	@DisplayName("Gross- und Kleinschreibung treffen denselben Zaehler")
	void emailWirdNormalisiert() {
		for (int i = 0; i < 5; i++) {
			service.registriereFehlversuch("Privat@Example.ORG", IP);
		}

		// Sonst waere die Sperre durch eine andere Schreibweise zu umgehen.
		assertThat(service.istGesperrt(EMAIL, "203.0.113.7")).isTrue();
	}
}
