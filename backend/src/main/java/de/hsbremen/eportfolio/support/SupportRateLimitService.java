package de.hsbremen.eportfolio.support;

import de.hsbremen.eportfolio.auth.AttemptCounter;
import de.hsbremen.eportfolio.config.SupportProperties;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Bremse fuer {@code POST /api/support} (API-Contract §6.1, §6.5).
 *
 * <p><strong>Warum der Endpoint eine Bremse braucht.</strong> Er ist der einzige
 * schreibende Pfad, den §5 fuer PUBLIC freigibt, und ohne Grenze waere er ein
 * Eingangsbuch, das sich beliebig fuellen laesst. Anders als am Login geht es
 * dabei nicht um das Erraten eines Geheimnisses, sondern um die Menge: gezaehlt
 * wird deshalb <em>jede</em> Einsendung und nicht nur eine fehlgeschlagene, und
 * es gibt kein Zuruecksetzen bei Erfolg.
 *
 * <p><strong>Ein eigener Zaehler, getrennt von Login und Code-Endpoints.</strong>
 * Derselbe Grund, der jene beiden trennt (§6.5): eine abgeschickte Hilfeanfrage
 * darf niemanden aus der Anmeldung aussperren, und ein gesperrter Login darf
 * die Hilfeanfrage nicht verhindern. Gerade die zweite Richtung ist hier
 * wesentlich, denn wer sich nicht anmelden kann, ist der typische Absender.
 *
 * <p><strong>Eigene Grenzwerte, und das ist neu.</strong> Login und
 * Verifizierung teilen sich nach §6.5 ausdruecklich dieselben Werte; fuer das
 * Kontaktformular gilt das seit v87 nicht mehr. Eine Anmeldung wiederholt man
 * nach einem Vertipper sofort, eine Support-Anfrage schreibt man einmal.
 * Die Werte stehen in {@link SupportProperties} (Standard drei Einsendungen je
 * Stunde), die Mechanik unveraendert in {@link AttemptCounter}.
 *
 * <p>Gezaehlt wird getrennt nach angegebener E-Mail-Adresse und Client-IP, wie
 * ueberall in §6.5: nur ueber die Adresse zu zaehlen liesse einen Absender mit
 * wechselnden Adressen durch, nur ueber die IP traefe ein ganzes Hochschulnetz
 * gemeinsam. Wie am Login liegt der Zaehler nur im Arbeitsspeicher und ist nach
 * einem Neustart leer.
 */
@Service
public class SupportRateLimitService {

	private final AttemptCounter counter;

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll.
	 */
	@Autowired
	public SupportRateLimitService(SupportProperties properties) {
		this(properties, Clock.systemUTC());
	}

	/** Fuer Tests, die die Uhr vorstellen muessen. */
	SupportRateLimitService(SupportProperties properties, Clock clock) {
		this.counter = new AttemptCounter(properties, clock);
	}

	/**
	 * Prueft vor jeder Arbeit, ob Adresse oder IP derzeit gesperrt sind. Ein
	 * gesperrter Schluessel bekommt sofort 429, ohne dass etwas gespeichert
	 * wird.
	 */
	public boolean isBlocked(String email, String clientIp) {
		return counter.isBlocked(email, clientIp);
	}

	/**
	 * Zaehlt eine Einsendung, unabhaengig davon, was daraus geworden ist.
	 *
	 * <p>Auch der Versuch mit gefuelltem Honeypot-Feld zaehlt mit, obwohl er
	 * nichts speichert: er hat den Endpoint in Anspruch genommen, und ein
	 * Programm, das ihn wiederholt, soll dieselbe Grenze treffen wie ein
	 * Programm, das ihn richtig ausfuellt.
	 *
	 * <p><strong>Ein 400 zaehlt dagegen nicht mit.</strong> Die Bean-Validation
	 * laeuft vor dem Dienst, ein unbrauchbarer Koerper kommt hier also gar nicht
	 * an. Das ist bewusst so gelassen: ein solcher Versuch legt keine Zeile an,
	 * und die Grenze bewacht das Eingangsbuch, nicht den Verkehr. Wer den Server
	 * mit unbrauchbaren Anfragen belasten will, tut das ohnehin an jedem anderen
	 * Endpoint ebenso; dagegen hilft eine Bremse vor der Anwendung und nicht
	 * eine in ihr (§6.5, Abschnitt „Grenzen").
	 */
	public void recordAttempt(String email, String clientIp) {
		counter.record(email, clientIp);
	}
}
