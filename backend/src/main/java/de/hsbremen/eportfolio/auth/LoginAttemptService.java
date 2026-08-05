package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Begrenzt die Anzahl fehlgeschlagener Anmeldeversuche.
 *
 * <p><strong>Der Zaehler liegt ausschliesslich im Arbeitsspeicher und ist nach
 * einem Neustart weg.</strong> Fuer den Prototyp bewusst so gewaehlt (keine
 * Tabelle, keine Migration, kein Redis). Fuer den Produktivbetrieb braucht es
 * einen persistenten bzw. ueber mehrere Instanzen geteilten Zaehler, weil sonst
 * ein Neustart die Sperre aufhebt und bei mehreren Instanzen jede fuer sich
 * zaehlt.
 *
 * <p><strong>Zwei getrennte Schluessel je Versuch:</strong> einmal die
 * E-Mail-Adresse, einmal die Client-IP. Nur ueber die E-Mail zu zaehlen wuerde
 * einem Angreifer erlauben, mit einer IP der Reihe nach beliebig viele Konten
 * durchzuprobieren; nur ueber die IP zu zaehlen wuerde erlauben, ein einzelnes
 * Konto durch IP-Wechsel weiter anzugreifen. Beide Zaehler gelten unabhaengig
 * voneinander: schon einer reicht fuer die Sperre.
 *
 * <p><strong>Keine Rueckschluesse auf vorhandene Konten:</strong> gezaehlt wird
 * allein die uebermittelte Zeichenkette. Ob dazu ein Konto existiert, spielt
 * hier keine Rolle und wird auch nicht abgefragt. Eine unbekannte Adresse wird
 * nach denselben fuenf Versuchen genauso gesperrt wie eine bekannte, mit
 * derselben Antwort. Aus dem Sperrverhalten laesst sich damit nicht ablesen,
 * welche Adressen registriert sind.
 */
@Service
public class LoginAttemptService {

	private final LoginAttemptProperties properties;

	private final Clock clock;

	/**
	 * Schluessel ist {@code "email:<adresse>"} bzw. {@code "ip:<adresse>"}, damit
	 * sich beide Zaehlerarten dieselbe Map teilen koennen, ohne zu kollidieren.
	 */
	private final Map<String, State> states = new ConcurrentHashMap<>();

	/** Zaehlt Aufrufe, um gelegentlich abgelaufene Eintraege wegzuraeumen. */
	private final AtomicInteger callsSinceCleanUp = new AtomicInteger();

	private static final int CLEAN_UP_EVERY = 100;

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
		this.properties = properties;
		this.clock = clock;
	}

	/**
	 * Prueft, ob E-Mail oder IP derzeit gesperrt sind. Wird <em>vor</em> der
	 * Passwortpruefung aufgerufen: ein gesperrter Schluessel bekommt sofort die
	 * Fehlerantwort, ohne dass ueberhaupt ein Passwort geprueft wird.
	 */
	public boolean isBlocked(String email, String clientIp) {
		return isKeyBlocked(emailKey(email)) || isKeyBlocked(ipKey(clientIp));
	}

	/** Zaehlt einen Fehlversuch auf beiden Schluesseln hoch. */
	public void recordFailedAttempt(String email, String clientIp) {
		cleanUpOccasionally();
		increment(emailKey(email));
		increment(ipKey(clientIp));
	}

	/**
	 * Setzt beide Zaehler nach einer erfolgreichen Anmeldung zurueck, damit
	 * vereinzelte Vertipper sich ueber die Zeit nicht zu einer Sperre summieren.
	 */
	public void reset(String email, String clientIp) {
		states.remove(emailKey(email));
		states.remove(ipKey(clientIp));
	}

	// ------------------------------------------------------------------

	private boolean isKeyBlocked(String key) {
		State state = states.get(key);
		if (state == null) {
			return false;
		}
		if (state.blockedUntil() == null) {
			return false;
		}
		if (Instant.now(clock).isBefore(state.blockedUntil())) {
			return true;
		}
		// Sperre abgelaufen: Eintrag verwerfen, der Schluessel faengt bei null an.
		states.remove(key, state);
		return false;
	}

	private void increment(String key) {
		Instant now = Instant.now(clock);
		states.compute(key, (unused, previous) -> {
			int failedAttempts = (previous == null ? 0 : previous.failedAttempts()) + 1;
			Instant blockedUntil = failedAttempts >= properties.maxFailedAttempts()
					? now.plus(properties.lockoutDuration())
					: null;
			return new State(failedAttempts, blockedUntil, now);
		});
	}

	/**
	 * Haelt die Map klein. Ohne das wuechse sie mit jeder je probierten Adresse
	 * weiter; bei einem Angriff mit wechselnden Adressen waere das ein
	 * Speicherleck.
	 */
	private void cleanUpOccasionally() {
		if (callsSinceCleanUp.incrementAndGet() < CLEAN_UP_EVERY) {
			return;
		}
		callsSinceCleanUp.set(0);
		Instant threshold = Instant.now(clock).minus(properties.lockoutDuration());
		states.values().removeIf(state -> state.lastAttempt().isBefore(threshold));
	}

	/**
	 * Kleinschreibung, damit {@code Max@Example.org} und {@code max@example.org}
	 * denselben Zaehler treffen; sonst waere die Sperre trivial zu umgehen.
	 */
	private static String emailKey(String email) {
		return "email:" + (email == null ? "" : email.trim().toLowerCase(Locale.ROOT));
	}

	private static String ipKey(String clientIp) {
		return "ip:" + (clientIp == null ? "" : clientIp);
	}

	/**
	 * @param blockedUntil {@code null}, solange die Grenze nicht erreicht ist
	 * @param lastAttempt  nur fuers Aufraeumen
	 */
	private record State(int failedAttempts, Instant blockedUntil, Instant lastAttempt) {
	}
}
