package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.config.AttemptLimits;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Zaehlt Versuche je E-Mail-Adresse und je Client-IP und sperrt beide
 * unabhaengig voneinander (API-Contract §6.5).
 *
 * <p>Die Klasse traegt die Mechanik, nicht den Anlass. Wofuer gezaehlt wird,
 * entscheidet die aufrufende Seite: {@link LoginAttemptService} zaehlt
 * fehlgeschlagene Anmeldungen, {@link VerificationAttemptService} den Verkehr
 * auf den Verifizierungs-Endpoints, und seit KAN-85 zaehlt der
 * {@code support.SupportRateLimitService} die Einsendungen am oeffentlichen
 * Kontaktformular. <strong>Jede Instanz fuehrt ihre eigene Map</strong>, die
 * Zaehler laufen also getrennt; sonst sperrte ein erneut angeforderter
 * Verifizierungscode zugleich die Anmeldung derselben Adresse.
 *
 * <p><strong>Warum die Grenzwerte als {@link AttemptLimits} hereinkommen und
 * nicht als ein bestimmter Properties-Record.</strong> Bis KAN-85 lasen alle
 * Anlaesse dieselben Werte, weil §6.5 fuer die Verifizierung ausdruecklich
 * „denselben Mechanismus" verlangt. Das Kontaktformular bringt mit
 * {@code SupportProperties} den ersten Anlass mit eigenen Werten mit (§6.5,
 * Absatz zu v87): eine Anmeldung wiederholt man nach einem Vertipper sofort,
 * eine Support-Anfrage schreibt man einmal. Die Klasse ist deshalb seit KAN-85
 * oeffentlich und nimmt die Schnittstelle entgegen; die Mechanik selbst und
 * jede Begruendung daran sind unveraendert geblieben.
 *
 * <p>Herausgeloest mit KAN-26. Vorher stand diese Logik vollstaendig im
 * {@code LoginAttemptService}; sie ein zweites Mal fuer die Verifizierung zu
 * schreiben haette dieselbe sicherheitsrelevante Regel an zwei Orten gefuehrt,
 * mit der ueblichen Folge, dass eine spaetere Korrektur nur einen davon trifft.
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
public class AttemptCounter {

	private final AttemptLimits limits;

	private final Clock clock;

	/**
	 * Schluessel ist {@code "email:<adresse>"} bzw. {@code "ip:<adresse>"}, damit
	 * sich beide Zaehlerarten dieselbe Map teilen koennen, ohne zu kollidieren.
	 */
	private final Map<String, State> states = new ConcurrentHashMap<>();

	/** Zaehlt Aufrufe, um gelegentlich abgelaufene Eintraege wegzuraeumen. */
	private final AtomicInteger callsSinceCleanUp = new AtomicInteger();

	private static final int CLEAN_UP_EVERY = 100;

	public AttemptCounter(AttemptLimits limits, Clock clock) {
		this.limits = limits;
		this.clock = clock;
	}

	/**
	 * Prueft, ob E-Mail oder IP derzeit gesperrt sind. Wird <em>vor</em> der
	 * eigentlichen Pruefung aufgerufen: ein gesperrter Schluessel bekommt sofort
	 * die Fehlerantwort, ohne dass ueberhaupt etwas geprueft wird.
	 */
	public boolean isBlocked(String email, String clientIp) {
		return isKeyBlocked(emailKey(email)) || isKeyBlocked(ipKey(clientIp));
	}

	/** Zaehlt einen Versuch auf beiden Schluesseln hoch. */
	public void record(String email, String clientIp) {
		cleanUpOccasionally();
		increment(emailKey(email));
		increment(ipKey(clientIp));
	}

	/**
	 * Setzt beide Zaehler zurueck, damit vereinzelte Vertipper sich ueber die Zeit
	 * nicht zu einer Sperre summieren.
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
			Instant blockedUntil = failedAttempts >= limits.maxAttempts()
					? now.plus(limits.lockoutDuration())
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
		Instant threshold = Instant.now(clock).minus(limits.lockoutDuration());
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
