package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.hsbremen.eportfolio.auth.dto.LoginAnfrage;
import de.hsbremen.eportfolio.auth.dto.LoginAntwort;
import de.hsbremen.eportfolio.benutzer.TestUser;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Tests der Anmeldung (§6.1 Auth, §3.1.1, §2.9).
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

	private static final String PASSWORT = "geheim1234";

	private static final String PRIVATE_EMAIL = "studi.privat@example.org";

	private static final String HSB_EMAIL = "studi@stud.hs-bremen.de";

	private static final String TEST_IP = "192.0.2.10";

	@Mock
	private UserRepository userRepository;

	private PasswordEncoder passwordEncoder;

	private AuthService authService;

	private AnmeldeversuchService anmeldeversuchService;

	private String passwortHash;

	@BeforeEach
	void setUp() {
		passwordEncoder = new BCryptPasswordEncoder();
		passwortHash = passwordEncoder.encode(PASSWORT);

		JwtEigenschaften eigenschaften = new JwtEigenschaften(
				"a".repeat(88), Duration.ofHours(8), "eportfolio");
		anmeldeversuchService = new AnmeldeversuchService(
				new AnmeldeversuchEigenschaften(5, Duration.ofMinutes(15)));
		authService = new AuthService(userRepository, passwordEncoder, new JwtService(eigenschaften),
				anmeldeversuchService);
	}

	private User nutzer(UserStatus status) {
		return TestUser.erzeuge(UUID.randomUUID(), PRIVATE_EMAIL, HSB_EMAIL,
				Rolle.STUDIERENDE, status, passwortHash);
	}

	@Test
	@DisplayName("Gueltige Anmeldung mit privater E-Mail liefert Token und Benutzerdaten")
	void anmeldungMitPrivaterEmailErfolgreich() {
		User user = nutzer(UserStatus.AKTIV);
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(user));

		LoginAntwort antwort = authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP);

		assertThat(antwort.token()).isNotBlank();
		assertThat(antwort.ablaufZeitpunkt()).isNotNull();
		assertThat(antwort.benutzer().id()).isEqualTo(user.getId());
		assertThat(antwort.benutzer().email()).isEqualTo(PRIVATE_EMAIL);
		assertThat(antwort.benutzer().rolle()).isEqualTo(Rolle.STUDIERENDE);
	}

	@Test
	@DisplayName("Falsches Passwort wird abgewiesen")
	void falschesPasswort() {
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));

		assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, "falsch"), TEST_IP))
				.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);
	}

	@Test
	@DisplayName("Unbekannte E-Mail wird abgewiesen")
	void unbekannteEmail() {
		when(userRepository.findByEmail(any())).thenReturn(Optional.empty());

		assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage("niemand@example.org", PASSWORT), TEST_IP))
				.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);
	}

	@Test
	@DisplayName("Unbekannte E-Mail und falsches Passwort liefern dieselbe Meldung")
	void gleicheMeldungFuerBeideFehlerfaelle() {
		when(userRepository.findByEmail("niemand@example.org")).thenReturn(Optional.empty());
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));

		String meldungUnbekannt = fehlermeldung("niemand@example.org", PASSWORT);
		String meldungFalschesPasswort = fehlermeldung(PRIVATE_EMAIL, "falsch");

		// Sonst laesst sich ueber die API herausfinden, welche Adressen
		// registriert sind.
		assertThat(meldungUnbekannt).isEqualTo(meldungFalschesPasswort);
	}

	private String fehlermeldung(String email, String passwort) {
		try {
			authService.anmelden(new LoginAnfrage(email, passwort), TEST_IP);
			throw new AssertionError("Anmeldung haette fehlschlagen muessen.");
		} catch (AuthService.AnmeldungFehlgeschlagenException ex) {
			return ex.getMessage();
		}
	}

	@Test
	@DisplayName("Status DEAKTIVIERT verhindert die Anmeldung (§2.9)")
	void deaktiviertesKonto() {
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.DEAKTIVIERT)));

		assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP))
				.isInstanceOf(AuthService.KontoNichtAktivException.class)
				.hasMessageContaining("deaktiviert");
	}

	@Test
	@DisplayName("Status REGISTRIERUNG_OFFEN verhindert die Anmeldung (§2.9)")
	void registrierungNochOffen() {
		when(userRepository.findByEmail(PRIVATE_EMAIL))
				.thenReturn(Optional.of(nutzer(UserStatus.REGISTRIERUNG_OFFEN)));

		assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP))
				.isInstanceOf(AuthService.KontoNichtAktivException.class)
				.hasMessageContaining("Registrierung");
	}

	/**
	 * Belegt die Trennung der beiden Adressen aus §3.1.1: die HSB-Adresse ist
	 * Zugehoerigkeitsnachweis, keine Login-Kennung.
	 */
	@Nested
	@DisplayName("Trennung von privater und HSB-Adresse (§3.1.1)")
	class HsbAdresseTest {

		@Test
		@DisplayName("Anmeldung mit der HSB-Adresse schlaegt fehl, obwohl das Konto existiert")
		void loginMitHsbAdresseSchlaegtFehl() {
			// Das Konto existiert und ist aktiv - gesucht wird aber
			// ausschliesslich ueber die private Adresse, deshalb findet
			// findByEmail(hsbEmail) nichts.
			when(userRepository.findByEmail(HSB_EMAIL)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(HSB_EMAIL, PASSWORT), TEST_IP))
					.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);
		}

		@Test
		@DisplayName("Die Anmeldung fragt niemals ueber findByHsbEmail")
		void findByHsbEmailWirdNieBenutzt() {
			when(userRepository.findByEmail(HSB_EMAIL)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(HSB_EMAIL, PASSWORT), TEST_IP))
					.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);

			// UserRepository.findByHsbEmail existiert fuer die Registrierung.
			// Wuerde der Login darauf ausweichen, waere die Trennung aus
			// §3.1.1 aufgehoben - dieser Test haelt das fest.
			verify(userRepository, never()).findByHsbEmail(any());
		}
	}

	/**
	 * Zusammenspiel von Anmeldung und Anmeldeversuchs-Sperre.
	 */
	@Nested
	@DisplayName("Brute-Force-Sperre am Login")
	class SperreTest {

		private void versucheMitFalschemPasswort(int anzahl) {
			for (int i = 0; i < anzahl; i++) {
				assertThatThrownBy(() -> authService.anmelden(
						new LoginAnfrage(PRIVATE_EMAIL, "falsch"), TEST_IP))
						.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);
			}
		}

		@Test
		@DisplayName("Nach fuenf Fehlversuchen greift die Sperre - auch mit dem richtigen Passwort")
		void sechsterVersuchWirdGesperrt() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));

			versucheMitFalschemPasswort(5);

			// Diesmal ist das Passwort korrekt - die Sperre gilt trotzdem, weil
			// sie vor der Passwortpruefung greift.
			assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP))
					.isInstanceOf(AuthService.ZuVieleAnmeldeversucheException.class);
		}

		@Test
		@DisplayName("Bei gesperrtem Schluessel wird die Datenbank gar nicht erst gefragt")
		void keinDatenbankzugriffBeiSperre() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));

			versucheMitFalschemPasswort(5);
			verify(userRepository, times(5)).findByEmail(PRIVATE_EMAIL);

			assertThatThrownBy(() -> authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP))
					.isInstanceOf(AuthService.ZuVieleAnmeldeversucheException.class);

			// Immer noch fuenf: der gesperrte Versuch hat nicht nachgeschlagen.
			verify(userRepository, times(5)).findByEmail(PRIVATE_EMAIL);
		}

		@Test
		@DisplayName("Erfolgreicher Login vor der Grenze setzt den Zaehler zurueck")
		void erfolgSetztZaehlerZurueck() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));

			versucheMitFalschemPasswort(4);

			// Der Erfolg raeumt den Zaehler ab ...
			assertThat(authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP).token())
					.isNotBlank();

			// ... daher fuehren vier weitere Fehlversuche noch nicht zur Sperre.
			versucheMitFalschemPasswort(4);
			assertThat(authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), TEST_IP).token())
					.isNotBlank();
		}

		@Test
		@DisplayName("Unbekannte E-Mail wird genauso gesperrt wie eine existierende")
		void keinUnterschiedZwischenBekanntUndUnbekannt() {
			String unbekannt = "gibtesnicht@example.org";
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));
			when(userRepository.findByEmail(unbekannt)).thenReturn(Optional.empty());

			// Beide Adressen von verschiedenen IPs aus, damit sich die
			// IP-Zaehler nicht gegenseitig beeinflussen.
			for (int i = 0; i < 5; i++) {
				assertThatThrownBy(() -> authService.anmelden(
						new LoginAnfrage(PRIVATE_EMAIL, "falsch"), "192.0.2.1"))
						.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);
				assertThatThrownBy(() -> authService.anmelden(
						new LoginAnfrage(unbekannt, "falsch"), "192.0.2.2"))
						.isInstanceOf(AuthService.AnmeldungFehlgeschlagenException.class);
			}

			Throwable bekannt = catchThrowable(
					() -> authService.anmelden(new LoginAnfrage(PRIVATE_EMAIL, "falsch"), "192.0.2.1"));
			Throwable unbekanntesKonto = catchThrowable(
					() -> authService.anmelden(new LoginAnfrage(unbekannt, "falsch"), "192.0.2.2"));

			// Gleiche Ausnahme, gleiche Meldung. Aus dem Sperrverhalten laesst
			// sich nicht ableiten, welche Adressen registriert sind.
			assertThat(bekannt).isInstanceOf(AuthService.ZuVieleAnmeldeversucheException.class);
			assertThat(unbekanntesKonto).isInstanceOf(AuthService.ZuVieleAnmeldeversucheException.class);
			assertThat(bekannt.getMessage()).isEqualTo(unbekanntesKonto.getMessage());
		}

		@Test
		@DisplayName("Die Sperre trennt nach E-Mail und nach IP")
		void getrennteSchluessel() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(nutzer(UserStatus.AKTIV)));

			versucheMitFalschemPasswort(5);

			// Dieselbe Adresse von einer anderen IP: bleibt gesperrt (E-Mail-Zaehler).
			assertThatThrownBy(() -> authService.anmelden(
					new LoginAnfrage(PRIVATE_EMAIL, PASSWORT), "203.0.113.99"))
					.isInstanceOf(AuthService.ZuVieleAnmeldeversucheException.class);

			// Dieselbe IP mit anderer Adresse: ebenfalls gesperrt (IP-Zaehler).
			assertThatThrownBy(() -> authService.anmelden(
					new LoginAnfrage("jemand.anderes@example.org", PASSWORT), TEST_IP))
					.isInstanceOf(AuthService.ZuVieleAnmeldeversucheException.class);
		}
	}
}
