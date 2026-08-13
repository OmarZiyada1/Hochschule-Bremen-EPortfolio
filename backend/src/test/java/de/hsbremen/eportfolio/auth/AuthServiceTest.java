package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.LoginResponse;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.config.JwtProperties;
import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
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

	private static final String PASSWORD = "geheim1234";

	private static final String PRIVATE_EMAIL = "studi.privat@example.org";

	private static final String HSB_EMAIL = "studi@stud.hs-bremen.de";

	private static final String TEST_IP = "192.0.2.10";

	@Mock
	private UserRepository userRepository;

	@Mock
	private EmailChangeService emailChangeService;

	private PasswordEncoder passwordEncoder;

	private AuthService authService;

	private LoginAttemptService loginAttemptService;

	private String passwordHash;

	@BeforeEach
	void setUp() {
		passwordEncoder = new BCryptPasswordEncoder();
		passwordHash = passwordEncoder.encode(PASSWORD);

		JwtProperties properties = new JwtProperties(
				"a".repeat(88), Duration.ofHours(8), "eportfolio");
		loginAttemptService = new LoginAttemptService(
				new LoginAttemptProperties(5, Duration.ofMinutes(15)));
		authService = new AuthService(userRepository, passwordEncoder, new JwtService(properties),
				loginAttemptService, emailChangeService);
	}

	private User account(UserStatus status) {
		return TestUser.create(UUID.randomUUID(), PRIVATE_EMAIL, HSB_EMAIL,
				Role.STUDENT, status, passwordHash);
	}

	@Test
	@DisplayName("Gueltige Anmeldung mit privater E-Mail liefert Token und Benutzerdaten")
	void loginWithPrivateEmailSucceeds() {
		User user = account(UserStatus.ACTIVE);
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(user));

		LoginResponse response = authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP);

		assertThat(response.token()).isNotBlank();
		assertThat(response.expiresAt()).isNotNull();
		assertThat(response.user().id()).isEqualTo(user.getId());
		assertThat(response.user().email()).isEqualTo(PRIVATE_EMAIL);
		assertThat(response.user().role()).isEqualTo(Role.STUDENT);
	}

	@Test
	@DisplayName("Falsches Passwort wird abgewiesen")
	void wrongPassword() {
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));

		assertThatThrownBy(() -> authService.login(new LoginRequest(PRIVATE_EMAIL, "falsch"), TEST_IP))
				.isInstanceOf(AuthService.LoginFailedException.class);
	}

	@Test
	@DisplayName("Unbekannte E-Mail wird abgewiesen")
	void unknownEmail() {
		when(userRepository.findByEmail(any())).thenReturn(Optional.empty());

		assertThatThrownBy(() -> authService.login(new LoginRequest("niemand@example.org", PASSWORD), TEST_IP))
				.isInstanceOf(AuthService.LoginFailedException.class);
	}

	@Test
	@DisplayName("Unbekannte E-Mail und falsches Passwort liefern dieselbe Meldung")
	void sameMessageForBothFailures() {
		when(userRepository.findByEmail("niemand@example.org")).thenReturn(Optional.empty());
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));

		String messageUnknown = errorMessage("niemand@example.org", PASSWORD);
		String messageWrongPassword = errorMessage(PRIVATE_EMAIL, "falsch");

		// Sonst laesst sich ueber die API herausfinden, welche Adressen
		// registriert sind.
		assertThat(messageUnknown).isEqualTo(messageWrongPassword);
	}

	private String errorMessage(String email, String password) {
		try {
			authService.login(new LoginRequest(email, password), TEST_IP);
			throw new AssertionError("Anmeldung haette fehlschlagen muessen.");
		} catch (AuthService.LoginFailedException ex) {
			return ex.getMessage();
		}
	}

	@Test
	@DisplayName("Status DEACTIVATED verhindert die Anmeldung (§2.9)")
	void deactivatedAccount() {
		when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.DEACTIVATED)));

		assertThatThrownBy(() -> authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP))
				.isInstanceOf(AuthService.AccountNotActiveException.class)
				.hasMessageContaining("deaktiviert");
	}

	@Test
	@DisplayName("Status REGISTRATION_PENDING verhindert die Anmeldung (§2.9)")
	void registrationStillPending() {
		when(userRepository.findByEmail(PRIVATE_EMAIL))
				.thenReturn(Optional.of(account(UserStatus.REGISTRATION_PENDING)));

		assertThatThrownBy(() -> authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP))
				.isInstanceOf(AuthService.AccountNotActiveException.class)
				.hasMessageContaining("Registrierung");
	}

	/**
	 * Belegt die Trennung der beiden Adressen aus §3.1.1: die HSB-Adresse ist
	 * Zugehoerigkeitsnachweis, keine Login-Kennung.
	 */
	@Nested
	@DisplayName("Trennung von privater und HSB-Adresse (§3.1.1)")
	class HsbAddressTest {

		@Test
		@DisplayName("Anmeldung mit der HSB-Adresse schlaegt fehl, obwohl das Konto existiert")
		void loginWithHsbAddressFails() {
			// Das Konto existiert und ist aktiv - gesucht wird aber
			// ausschliesslich ueber die private Adresse, deshalb findet
			// findByEmail(hsbEmail) nichts.
			when(userRepository.findByEmail(HSB_EMAIL)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> authService.login(new LoginRequest(HSB_EMAIL, PASSWORD), TEST_IP))
					.isInstanceOf(AuthService.LoginFailedException.class);
		}

		@Test
		@DisplayName("Die Anmeldung fragt niemals ueber findByHsbEmail")
		void findByHsbEmailIsNeverUsed() {
			when(userRepository.findByEmail(HSB_EMAIL)).thenReturn(Optional.empty());

			assertThatThrownBy(() -> authService.login(new LoginRequest(HSB_EMAIL, PASSWORD), TEST_IP))
					.isInstanceOf(AuthService.LoginFailedException.class);

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
	class LockoutTest {

		private void attemptsWithWrongPassword(int count) {
			for (int i = 0; i < count; i++) {
				assertThatThrownBy(() -> authService.login(
						new LoginRequest(PRIVATE_EMAIL, "falsch"), TEST_IP))
						.isInstanceOf(AuthService.LoginFailedException.class);
			}
		}

		@Test
		@DisplayName("Nach fuenf Fehlversuchen greift die Sperre, auch mit dem richtigen Passwort")
		void sixthAttemptIsBlocked() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));

			attemptsWithWrongPassword(5);

			// Diesmal ist das Passwort korrekt - die Sperre gilt trotzdem, weil
			// sie vor der Passwortpruefung greift.
			assertThatThrownBy(() -> authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP))
					.isInstanceOf(AuthService.TooManyLoginAttemptsException.class);
		}

		@Test
		@DisplayName("Bei gesperrtem Schluessel wird die Datenbank gar nicht erst gefragt")
		void noDatabaseAccessWhenBlocked() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));

			attemptsWithWrongPassword(5);
			verify(userRepository, times(5)).findByEmail(PRIVATE_EMAIL);

			assertThatThrownBy(() -> authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP))
					.isInstanceOf(AuthService.TooManyLoginAttemptsException.class);

			// Immer noch fuenf: der gesperrte Versuch hat nicht nachgeschlagen.
			verify(userRepository, times(5)).findByEmail(PRIVATE_EMAIL);
		}

		@Test
		@DisplayName("Erfolgreicher Login vor der Grenze setzt den Zaehler zurueck")
		void successResetsCounter() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));

			attemptsWithWrongPassword(4);

			// Der Erfolg raeumt den Zaehler ab ...
			assertThat(authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP).token())
					.isNotBlank();

			// ... daher fuehren vier weitere Fehlversuche noch nicht zur Sperre.
			attemptsWithWrongPassword(4);
			assertThat(authService.login(new LoginRequest(PRIVATE_EMAIL, PASSWORD), TEST_IP).token())
					.isNotBlank();
		}

		@Test
		@DisplayName("Unbekannte E-Mail wird genauso gesperrt wie eine existierende")
		void noDifferenceBetweenKnownAndUnknown() {
			String unknown = "gibtesnicht@example.org";
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));
			when(userRepository.findByEmail(unknown)).thenReturn(Optional.empty());

			// Beide Adressen von verschiedenen IPs aus, damit sich die
			// IP-Zaehler nicht gegenseitig beeinflussen.
			for (int i = 0; i < 5; i++) {
				assertThatThrownBy(() -> authService.login(
						new LoginRequest(PRIVATE_EMAIL, "falsch"), "192.0.2.1"))
						.isInstanceOf(AuthService.LoginFailedException.class);
				assertThatThrownBy(() -> authService.login(
						new LoginRequest(unknown, "falsch"), "192.0.2.2"))
						.isInstanceOf(AuthService.LoginFailedException.class);
			}

			Throwable known = catchThrowable(
					() -> authService.login(new LoginRequest(PRIVATE_EMAIL, "falsch"), "192.0.2.1"));
			Throwable unknownAccount = catchThrowable(
					() -> authService.login(new LoginRequest(unknown, "falsch"), "192.0.2.2"));

			// Gleiche Ausnahme, gleiche Meldung. Aus dem Sperrverhalten laesst
			// sich nicht ableiten, welche Adressen registriert sind.
			assertThat(known).isInstanceOf(AuthService.TooManyLoginAttemptsException.class);
			assertThat(unknownAccount).isInstanceOf(AuthService.TooManyLoginAttemptsException.class);
			assertThat(known.getMessage()).isEqualTo(unknownAccount.getMessage());
		}

		@Test
		@DisplayName("Die Sperre trennt nach E-Mail und nach IP")
		void separateKeys() {
			when(userRepository.findByEmail(PRIVATE_EMAIL)).thenReturn(Optional.of(account(UserStatus.ACTIVE)));

			attemptsWithWrongPassword(5);

			// Dieselbe Adresse von einer anderen IP: bleibt gesperrt (E-Mail-Zaehler).
			assertThatThrownBy(() -> authService.login(
					new LoginRequest(PRIVATE_EMAIL, PASSWORD), "203.0.113.99"))
					.isInstanceOf(AuthService.TooManyLoginAttemptsException.class);

			// Dieselbe IP mit anderer Adresse: ebenfalls gesperrt (IP-Zaehler).
			assertThatThrownBy(() -> authService.login(
					new LoginRequest("jemand.anderes@example.org", PASSWORD), TEST_IP))
					.isInstanceOf(AuthService.TooManyLoginAttemptsException.class);
		}
	}
}
