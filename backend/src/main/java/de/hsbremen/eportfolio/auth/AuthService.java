package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.LoginResponse;
import de.hsbremen.eportfolio.auth.dto.PasswordChangeRequest;
import de.hsbremen.eportfolio.auth.dto.UserResponse;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
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
	 * <p><strong>Die Adresse wird vor der Suche kleingeschrieben</strong>
	 * ({@link EmailAddresses}, seit KAN-26). Die Registrierung legt sie so ab;
	 * ohne dieselbe Regel hier scheiterte jede Anmeldung, bei der jemand seine
	 * Adresse anders schreibt als bei der Registrierung, und zwar mit
	 * „E-Mail-Adresse oder Passwort ist falsch" und damit unaufloesbar. Der
	 * {@link LoginAttemptService} normalisiert seinen Schluessel aus demselben
	 * Grund schon seit KAN-5.
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
		String email = EmailAddresses.normalize(request.email());

		if (loginAttemptService.isBlocked(email, clientIp)) {
			// Sofortiger Abbruch: kein Datenbankzugriff, keine Passwortpruefung.
			throw new TooManyLoginAttemptsException();
		}

		Optional<User> found = userRepository.findByEmail(email);

		if (found.isEmpty()) {
			// Trotzdem hashen: sonst antwortet der Server auf unbekannte
			// Adressen messbar schneller als auf bekannte mit falschem
			// Passwort und verraet darueber, welche Konten es gibt.
			passwordEncoder.matches(request.password(), PLACEHOLDER_HASH);
			loginAttemptService.recordFailedAttempt(email, clientIp);
			throw new LoginFailedException();
		}

		User user = found.get();
		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			// Exakt dieselbe Behandlung wie oben: gleiche Zaehlung, gleiche
			// Ausnahme. Aus dem Sperrverhalten laesst sich nicht ablesen, ob es
			// die Adresse gibt.
			loginAttemptService.recordFailedAttempt(email, clientIp);
			throw new LoginFailedException();
		}

		// Erst nach erfolgreicher Passwortpruefung, damit der Statusfehler nicht
		// unbeteiligten Dritten verraet, dass es das Konto gibt.
		if (user.getStatus() != UserStatus.ACTIVE) {
			// Weder zaehlen noch zuruecksetzen: das Passwort war richtig, es ist
			// also kein Fehlversuch; angemeldet ist aber auch niemand.
			throw new AccountNotActiveException(messageFor(user.getStatus()));
		}

		loginAttemptService.reset(email, clientIp);

		AuthenticatedUser authenticatedUser = AuthenticatedUser.from(user);
		Instant issuedAt = Instant.now();
		String token = jwtService.createToken(authenticatedUser);

		return new LoginResponse(token, jwtService.expiresAt(issuedAt),
				user.isPasswordChangeRequired(), UserResponse.from(user));
	}

	/**
	 * Aendert das Passwort der angemeldeten Person und loest damit eine
	 * erzwungene Passwortaenderung auf (§6.7).
	 *
	 * <p>Setzt {@code passwordChangeRequired} immer zurueck, nicht nur wenn es
	 * gesetzt war: nach einer selbst veranlassten Aenderung gibt es in beiden
	 * Faellen kein fremdbekanntes Passwort mehr, das der Server noch erzwingen
	 * muesste.
	 *
	 * @param userId ID aus dem SecurityContext, nie aus dem Request-Body
	 * @throws LoginFailedException wenn {@code currentPassword} nicht zum
	 *                              gespeicherten Hash passt. Das Flag bleibt
	 *                              dann gesetzt.
	 */
	@Transactional
	public void changePassword(UUID userId, PasswordChangeRequest request) {
		User user = userRepository.findById(userId)
				.orElseThrow(LoginFailedException::new);

		if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
			// Anders als beim Login darf die Meldung konkret sein: die Person
			// ist authentifiziert, eine Konto-Enumeration ist hier unmoeglich.
			throw new LoginFailedException("Das aktuelle Passwort ist falsch.");
		}

		user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
		user.setPasswordChangeRequired(false);
		userRepository.save(user);
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

	/**
	 * Unbekannte E-Mail oder falsches Passwort. Fuehrt zu 401
	 * {@code LOGIN_FAILED}.
	 *
	 * <p>Beim Login bleibt die Meldung bewusst unspezifisch (kein Hinweis, ob
	 * es die Adresse gibt). Die zweite Fassung mit eigenem Wortlaut existiert
	 * fuer {@code PUT /auth/password} (§6.7): dort ist die Person
	 * authentifiziert, eine Konto-Enumeration ist unmoeglich, und die Meldung
	 * darf das Feld benennen. Der Fehlercode bleibt derselbe, §6.2 fuehrt
	 * „Falsches Passwort" als seinen Ausloeser.
	 */
	public static class LoginFailedException extends RuntimeException {

		public LoginFailedException() {
			super("E-Mail-Adresse oder Passwort ist falsch.");
		}

		public LoginFailedException(String message) {
			super(message);
		}
	}

	/**
	 * Zu viele Versuche fuer diese E-Mail oder diese IP. Fuehrt zu 429
	 * {@code TOO_MANY_LOGIN_ATTEMPTS}.
	 *
	 * <p>Die Meldung ist bewusst generisch und nennt weder die Restzeit noch den
	 * ausloesenden Schluessel; sonst wuerde die Antwort bestaetigen, dass es das
	 * Konto gibt.
	 *
	 * <p><strong>Sie gilt seit KAN-26 auch fuer die Verifizierungs-Endpoints</strong>
	 * (§6.5, {@link VerificationAttemptService}), deshalb die zweite Fassung mit
	 * eigenem Wortlaut: dort ist von Anmeldeversuchen keine Rede. Der Name der
	 * Klasse bleibt trotzdem stehen, weil er dem Fehlercode aus §6.2 folgt, den
	 * beide Faelle teilen.
	 */
	public static class TooManyLoginAttemptsException extends RuntimeException {

		public TooManyLoginAttemptsException() {
			super("Zu viele fehlgeschlagene Anmeldeversuche. Bitte spaeter erneut versuchen.");
		}

		public TooManyLoginAttemptsException(String message) {
			super(message);
		}

		/** Zu viele Verifizierungsversuche oder Code-Anforderungen (§6.1, §6.5). */
		public static TooManyLoginAttemptsException forVerification() {
			return new TooManyLoginAttemptsException(
					"Zu viele Versuche. Bitte spaeter erneut versuchen.");
		}
	}

	/** Konto existiert, ist aber nicht ACTIVE (§2.9). Fuehrt zu 401. */
	public static class AccountNotActiveException extends RuntimeException {
		public AccountNotActiveException(String message) {
			super(message);
		}
	}
}
