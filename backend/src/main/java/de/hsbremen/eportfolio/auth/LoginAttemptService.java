package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Begrenzt die Anzahl fehlgeschlagener Anmeldeversuche (API-Contract §6.5).
 *
 * <p>Die Zaehlmechanik samt ihrer Begruendungen steht seit KAN-26 in
 * {@link AttemptCounter} und wird von dort auch fuer die Verifizierungs-
 * Endpoints benutzt ({@link VerificationAttemptService}). Diese Klasse bleibt
 * die Anlaufstelle des Logins und haelt fest, <em>was</em> hier gezaehlt wird:
 * ausschliesslich fehlgeschlagene Anmeldungen, und ein erfolgreicher Login
 * setzt zurueck.
 *
 * <p>Der Zaehler dieser Klasse ist von dem der Verifizierung getrennt. Ein
 * erneut angeforderter Verifizierungscode darf niemanden aus der Anmeldung
 * aussperren: das waeren zwei ganz verschiedene Vorgaenge, die sich gegenseitig
 * blockieren, und die Person koennte den Zustand nicht einmal deuten.
 */
@Service
public class LoginAttemptService {

	private final AttemptCounter counter;

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll.
	 */
	@Autowired
	public LoginAttemptService(LoginAttemptProperties properties) {
		this(properties, Clock.systemUTC());
	}

	/** Fuer Tests, die die Uhr vorstellen muessen. */
	LoginAttemptService(LoginAttemptProperties properties, Clock clock) {
		this.counter = new AttemptCounter(properties, clock);
	}

	/**
	 * Prueft, ob E-Mail oder IP derzeit gesperrt sind. Wird <em>vor</em> der
	 * Passwortpruefung aufgerufen: ein gesperrter Schluessel bekommt sofort die
	 * Fehlerantwort, ohne dass ueberhaupt ein Passwort geprueft wird.
	 */
	public boolean isBlocked(String email, String clientIp) {
		return counter.isBlocked(email, clientIp);
	}

	/** Zaehlt einen Fehlversuch auf beiden Schluesseln hoch. */
	public void recordFailedAttempt(String email, String clientIp) {
		counter.record(email, clientIp);
	}

	/**
	 * Setzt beide Zaehler nach einer erfolgreichen Anmeldung zurueck, damit
	 * vereinzelte Vertipper sich ueber die Zeit nicht zu einer Sperre summieren.
	 */
	public void reset(String email, String clientIp) {
		counter.reset(email, clientIp);
	}
}
