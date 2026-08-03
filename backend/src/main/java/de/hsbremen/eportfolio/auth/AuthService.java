package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.LoginResponse;
import de.hsbremen.eportfolio.auth.dto.UserResponse;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fachlogik der Anmeldung.
 *
 * <p>Bewusst ohne den {@code AuthenticationManager}: der wuerde die drei Faelle
 * „unbekannte E-Mail", „falsches Passwort" und „Konto nicht aktiv" in
 * unterschiedliche Exceptions aufteilen, die dann wieder zusammengefuehrt
 * werden muessten. Hier ist direkt sichtbar, welcher Fall welchen Fehlercode
 * ergibt.
 */
@Service
public class AuthService {

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	private final JwtService jwtService;

	private final LoginAttemptService loginAttemptService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
			LoginAttemptService loginAttemptService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.loginAttemptService = loginAttemptService;
	}

	/**
	 * Meldet einen Benutzer anhand seiner <strong>privaten</strong>
	 * E-Mail-Adresse an.
	 *
	 * <p>Die Suche laeuft ueber {@code findByEmail}. Ein Login-Versuch mit der
	 * HSB-Adresse findet damit kein Konto und scheitert mit demselben Fehler wie
	 * eine unbekannte Adresse; genau so ist die Trennung aus §3.1.1 gemeint.
	 *
	 * <p>Vorgeschaltet ist die Sperre aus {@link LoginAttemptService}: sie
	 * greift <em>vor</em> jeder Datenbankabfrage und vor der Passwortpruefung.
	 * Ein gesperrter Schluessel erfaehrt damit nichts darueber, ob die Adresse
	 * ueberhaupt existiert.
	 *
	 * @param clientIp Absender-Adresse, zweiter Schluessel der Sperre
	 * @throws TooManyLoginAttemptsException wenn E-Mail oder IP gesperrt sind
	 * @throws LoginFailedException          bei unbekannter Adresse oder
	 *                                       falschem Passwort. Dieselbe Meldung
	 *                                       fuer beide Faelle, damit sich ueber
	 *                                       die API nicht herausfinden laesst,
	 *                                       welche Adressen registriert sind
	 * @throws AccountNotActiveException     wenn der Status nicht ACTIVE ist
	 *                                       (§2.9)
	 */
	@Transactional(readOnly = true)
	public LoginResponse login(LoginRequest request, String clientIp) {
		if (loginAttemptService.isBlocked(request.email(), clientIp)) {
			// Sofortiger Abbruch: kein Datenbankzugriff, keine Passwortpruefung.
			throw new TooManyLoginAttemptsException();
		}

		Optional<User> found = userRepository.findByEmail(request.email());

		if (found.isEmpty()) {
			// Trotzdem hashen: sonst antwortet der Server auf unbekannte
			// Adressen messbar schneller als auf bekannte mit falschem
			// Passwort und verraet darueber, welche Konten es gibt.
			passwordEncoder.matches(request.password(), PLACEHOLDER_HASH);
			loginAttemptService.recordFailedAttempt(request.email(), clientIp);
			throw new LoginFailedException();
		}

		User user = found.get();
		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			// Exakt dieselbe Behandlung wie oben: gleiche Zaehlung, gleiche
			// Ausnahme. Aus dem Sperrverhalten laesst sich nicht ablesen, ob es
			// die Adresse gibt.
			loginAttemptService.recordFailedAttempt(request.email(), clientIp);
			throw new LoginFailedException();
		}

		// Erst nach erfolgreicher Passwortpruefung, damit der Statusfehler nicht
		// unbeteiligten Dritten verraet, dass es das Konto gibt.
		if (user.getStatus() != UserStatus.ACTIVE) {
			// Weder zaehlen noch zuruecksetzen: das Passwort war richtig, es ist
			// also kein Fehlversuch; angemeldet ist aber auch niemand.
			throw new AccountNotActiveException(messageFor(user.getStatus()));
		}

		loginAttemptService.reset(request.email(), clientIp);

		AuthenticatedUser authenticatedUser = AuthenticatedUser.from(user);
		Instant issuedAt = Instant.now();
		String token = jwtService.createToken(authenticatedUser);

		return new LoginResponse(token, jwtService.expiresAt(issuedAt), UserResponse.from(user));
	}

	private static String messageFor(UserStatus status) {
		return switch (status) {
			case REGISTRATION_PENDING -> "Die Registrierung ist noch nicht abgeschlossen. "
					+ "Bitte zuerst beide E-Mail-Adressen bestaetigen.";
			case DEACTIVATED -> "Das Konto wurde deaktiviert.";
			case ACTIVE -> "Das Konto ist aktiv.";
		};
	}

	/**
	 * BCrypt-Hash eines Zufallswerts, gegen den bei unbekannter E-Mail geprueft
	 * wird. Dient ausschliesslich dazu, den Zeitaufwand anzugleichen; das
	 * zugehoerige Klartextpasswort existiert nirgends.
	 */
	private static final String PLACEHOLDER_HASH =
			"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

	/** Unbekannte E-Mail oder falsches Passwort. Fuehrt zu 401. */
	public static class LoginFailedException extends RuntimeException {
		public LoginFailedException() {
			super("E-Mail-Adresse oder Passwort ist falsch.");
		}
	}

	/**
	 * Zu viele Fehlversuche fuer diese E-Mail oder diese IP. Fuehrt zu 429.
	 *
	 * <p>Die Meldung ist bewusst generisch und nennt weder die Restzeit noch den
	 * ausloesenden Schluessel; sonst wuerde die Antwort bestaetigen, dass es das
	 * Konto gibt.
	 */
	public static class TooManyLoginAttemptsException extends RuntimeException {
		public TooManyLoginAttemptsException() {
			super("Zu viele fehlgeschlagene Anmeldeversuche. Bitte spaeter erneut versuchen.");
		}
	}

	/** Konto existiert, ist aber nicht ACTIVE (§2.9). Fuehrt zu 401. */
	public static class AccountNotActiveException extends RuntimeException {
		public AccountNotActiveException(String message) {
			super(message);
		}
	}
}
