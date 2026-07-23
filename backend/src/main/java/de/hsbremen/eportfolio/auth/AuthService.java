package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.BenutzerAntwort;
import de.hsbremen.eportfolio.auth.dto.LoginAnfrage;
import de.hsbremen.eportfolio.auth.dto.LoginAntwort;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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

	private final AnmeldeversuchService anmeldeversuchService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
			AnmeldeversuchService anmeldeversuchService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.anmeldeversuchService = anmeldeversuchService;
	}

	/**
	 * Meldet einen Benutzer anhand seiner <strong>privaten</strong>
	 * E-Mail-Adresse an.
	 *
	 * <p>Die Suche laeuft ueber {@code findByEmail}. Ein Login-Versuch mit der
	 * HSB-Adresse findet damit kein Konto und scheitert mit demselben Fehler wie
	 * eine unbekannte Adresse — genau so ist die Trennung aus §3.1.1 gemeint.
	 *
	 * <p>Vorgeschaltet ist die Sperre aus {@link AnmeldeversuchService}: sie
	 * greift <em>vor</em> jeder Datenbankabfrage und vor der Passwortpruefung.
	 * Ein gesperrter Schluessel erfaehrt damit nichts darueber, ob die Adresse
	 * ueberhaupt existiert.
	 *
	 * @param clientIp Absender-Adresse, zweiter Schluessel der Sperre
	 * @throws ZuVieleAnmeldeversucheException  wenn E-Mail oder IP gesperrt sind
	 * @throws AnmeldungFehlgeschlagenException bei unbekannter Adresse oder
	 *                                          falschem Passwort — dieselbe
	 *                                          Meldung fuer beide Faelle, damit
	 *                                          sich ueber die API nicht
	 *                                          herausfinden laesst, welche
	 *                                          Adressen registriert sind
	 * @throws KontoNichtAktivException         wenn der Status nicht AKTIV ist
	 *                                          (§2.9)
	 */
	@Transactional(readOnly = true)
	public LoginAntwort anmelden(LoginAnfrage anfrage, String clientIp) {
		if (anmeldeversuchService.istGesperrt(anfrage.email(), clientIp)) {
			// Sofortiger Abbruch: kein Datenbankzugriff, keine Passwortpruefung.
			throw new ZuVieleAnmeldeversucheException();
		}

		Optional<User> gefunden = userRepository.findByEmail(anfrage.email());

		if (gefunden.isEmpty()) {
			// Trotzdem hashen: sonst antwortet der Server auf unbekannte
			// Adressen messbar schneller als auf bekannte mit falschem
			// Passwort und verraet darueber, welche Konten es gibt.
			passwordEncoder.matches(anfrage.passwort(), PLATZHALTER_HASH);
			anmeldeversuchService.registriereFehlversuch(anfrage.email(), clientIp);
			throw new AnmeldungFehlgeschlagenException();
		}

		User user = gefunden.get();
		if (!passwordEncoder.matches(anfrage.passwort(), user.getPasswortHash())) {
			// Exakt dieselbe Behandlung wie oben: gleiche Zaehlung, gleiche
			// Ausnahme. Aus dem Sperrverhalten laesst sich nicht ablesen, ob es
			// die Adresse gibt.
			anmeldeversuchService.registriereFehlversuch(anfrage.email(), clientIp);
			throw new AnmeldungFehlgeschlagenException();
		}

		// Erst nach erfolgreicher Passwortpruefung, damit der Statusfehler nicht
		// unbeteiligten Dritten verraet, dass es das Konto gibt.
		if (user.getStatus() != UserStatus.AKTIV) {
			// Weder zaehlen noch zuruecksetzen: das Passwort war richtig, es ist
			// also kein Fehlversuch — angemeldet ist aber auch niemand.
			throw new KontoNichtAktivException(meldungZu(user.getStatus()));
		}

		anmeldeversuchService.setzeZurueck(anfrage.email(), clientIp);

		AngemeldeterBenutzer benutzer = AngemeldeterBenutzer.aus(user);
		Instant ausgestelltAm = Instant.now();
		String token = jwtService.erzeugeToken(benutzer);

		return new LoginAntwort(token, jwtService.ablaufZeitpunkt(ausgestelltAm), BenutzerAntwort.aus(user));
	}

	private static String meldungZu(UserStatus status) {
		return switch (status) {
			case REGISTRIERUNG_OFFEN -> "Die Registrierung ist noch nicht abgeschlossen. "
					+ "Bitte zuerst beide E-Mail-Adressen bestaetigen.";
			case DEAKTIVIERT -> "Das Konto wurde deaktiviert.";
			case AKTIV -> "Das Konto ist aktiv.";
		};
	}

	/**
	 * BCrypt-Hash eines Zufallswerts, gegen den bei unbekannter E-Mail geprueft
	 * wird. Dient ausschliesslich dazu, den Zeitaufwand anzugleichen; das
	 * zugehoerige Klartextpasswort existiert nirgends.
	 */
	private static final String PLATZHALTER_HASH =
			"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

	/** Unbekannte E-Mail oder falsches Passwort. Fuehrt zu 401. */
	public static class AnmeldungFehlgeschlagenException extends RuntimeException {
		public AnmeldungFehlgeschlagenException() {
			super("E-Mail-Adresse oder Passwort ist falsch.");
		}
	}

	/**
	 * Zu viele Fehlversuche fuer diese E-Mail oder diese IP. Fuehrt zu 429.
	 *
	 * <p>Die Meldung ist bewusst generisch und nennt weder die Restzeit noch den
	 * ausloesenden Schluessel — sonst wuerde die Antwort bestaetigen, dass es
	 * das Konto gibt.
	 */
	public static class ZuVieleAnmeldeversucheException extends RuntimeException {
		public ZuVieleAnmeldeversucheException() {
			super("Zu viele fehlgeschlagene Anmeldeversuche. Bitte spaeter erneut versuchen.");
		}
	}

	/** Konto existiert, ist aber nicht AKTIV (§2.9). Fuehrt zu 401. */
	public static class KontoNichtAktivException extends RuntimeException {
		public KontoNichtAktivException(String meldung) {
			super(meldung);
		}
	}
}
