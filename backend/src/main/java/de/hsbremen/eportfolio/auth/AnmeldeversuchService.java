package de.hsbremen.eportfolio.auth;

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
 * einem Neustart weg</strong> — fuer den Prototyp bewusst so gewaehlt (keine
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
 * voneinander — schon einer reicht fuer die Sperre.
 *
 * <p><strong>Keine Rueckschluesse auf vorhandene Konten:</strong> gezaehlt wird
 * allein die uebermittelte Zeichenkette. Ob dazu ein Konto existiert, spielt
 * hier keine Rolle und wird auch nicht abgefragt — eine unbekannte Adresse wird
 * nach denselben fuenf Versuchen genauso gesperrt wie eine bekannte, mit
 * derselben Antwort. Aus dem Sperrverhalten laesst sich damit nicht ablesen,
 * welche Adressen registriert sind.
 */
@Service
public class AnmeldeversuchService {

	private final AnmeldeversuchEigenschaften eigenschaften;

	private final Clock clock;

	/**
	 * Schluessel ist {@code "email:<adresse>"} bzw. {@code "ip:<adresse>"}, damit
	 * sich beide Zaehlerarten dieselbe Map teilen koennen, ohne zu kollidieren.
	 */
	private final Map<String, Zustand> zustaende = new ConcurrentHashMap<>();

	/** Zaehlt Aufrufe, um gelegentlich abgelaufene Eintraege wegzuraeumen. */
	private final AtomicInteger aufrufeSeitAufraeumen = new AtomicInteger();

	private static final int AUFRAEUMEN_ALLE = 100;

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll.
	 */
	@Autowired
	public AnmeldeversuchService(AnmeldeversuchEigenschaften eigenschaften) {
		this(eigenschaften, Clock.systemUTC());
	}

	/** Fuer Tests, die die Uhr vorstellen muessen. */
	AnmeldeversuchService(AnmeldeversuchEigenschaften eigenschaften, Clock clock) {
		this.eigenschaften = eigenschaften;
		this.clock = clock;
	}

	/**
	 * Prueft, ob E-Mail oder IP derzeit gesperrt sind. Wird <em>vor</em> der
	 * Passwortpruefung aufgerufen: ein gesperrter Schluessel bekommt sofort die
	 * Fehlerantwort, ohne dass ueberhaupt ein Passwort geprueft wird.
	 */
	public boolean istGesperrt(String email, String clientIp) {
		return istSchluesselGesperrt(emailSchluessel(email)) || istSchluesselGesperrt(ipSchluessel(clientIp));
	}

	/** Zaehlt einen Fehlversuch auf beiden Schluesseln hoch. */
	public void registriereFehlversuch(String email, String clientIp) {
		raeumeGelegentlichAuf();
		erhoehe(emailSchluessel(email));
		erhoehe(ipSchluessel(clientIp));
	}

	/**
	 * Setzt beide Zaehler nach einer erfolgreichen Anmeldung zurueck, damit
	 * vereinzelte Vertipper sich ueber die Zeit nicht zu einer Sperre summieren.
	 */
	public void setzeZurueck(String email, String clientIp) {
		zustaende.remove(emailSchluessel(email));
		zustaende.remove(ipSchluessel(clientIp));
	}

	// ------------------------------------------------------------------

	private boolean istSchluesselGesperrt(String schluessel) {
		Zustand zustand = zustaende.get(schluessel);
		if (zustand == null) {
			return false;
		}
		if (zustand.gesperrtBis() == null) {
			return false;
		}
		if (Instant.now(clock).isBefore(zustand.gesperrtBis())) {
			return true;
		}
		// Sperre abgelaufen: Eintrag verwerfen, der Schluessel faengt bei null an.
		zustaende.remove(schluessel, zustand);
		return false;
	}

	private void erhoehe(String schluessel) {
		Instant jetzt = Instant.now(clock);
		zustaende.compute(schluessel, (unbenutzt, vorher) -> {
			int fehlversuche = (vorher == null ? 0 : vorher.fehlversuche()) + 1;
			Instant gesperrtBis = fehlversuche >= eigenschaften.maxFehlversuche()
					? jetzt.plus(eigenschaften.sperrdauer())
					: null;
			return new Zustand(fehlversuche, gesperrtBis, jetzt);
		});
	}

	/**
	 * Haelt die Map klein. Ohne das wuechse sie mit jeder je probierten Adresse
	 * weiter — bei einem Angriff mit wechselnden Adressen waere das ein
	 * Speicherleck.
	 */
	private void raeumeGelegentlichAuf() {
		if (aufrufeSeitAufraeumen.incrementAndGet() < AUFRAEUMEN_ALLE) {
			return;
		}
		aufrufeSeitAufraeumen.set(0);
		Instant grenze = Instant.now(clock).minus(eigenschaften.sperrdauer());
		zustaende.values().removeIf(zustand -> zustand.letzterVersuch().isBefore(grenze));
	}

	/**
	 * Kleinschreibung, damit {@code Max@Example.org} und {@code max@example.org}
	 * denselben Zaehler treffen — sonst waere die Sperre trivial zu umgehen.
	 */
	private static String emailSchluessel(String email) {
		return "email:" + (email == null ? "" : email.trim().toLowerCase(Locale.ROOT));
	}

	private static String ipSchluessel(String clientIp) {
		return "ip:" + (clientIp == null ? "" : clientIp);
	}

	/**
	 * @param gesperrtBis   {@code null}, solange die Grenze nicht erreicht ist
	 * @param letzterVersuch nur fuers Aufraeumen
	 */
	private record Zustand(int fehlversuche, Instant gesperrtBis, Instant letzterVersuch) {
	}
}
