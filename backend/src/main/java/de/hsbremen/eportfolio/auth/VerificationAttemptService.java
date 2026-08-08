package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Bremse fuer {@code POST /auth/verify} und {@code POST /auth/verify/resend}
 * (API-Contract §6.1, §6.5).
 *
 * <p><strong>Warum {@code resend} gebremst wird:</strong> der Endpoint versendet
 * an eine frei waehlbare Adresse und antwortet fuer bekannte wie unbekannte
 * Adressen gleich. Ohne Grenze waere er ein Versandgenerator, mit dem sich ein
 * fremdes Postfach fluten liesse, und zwar unter dem Absender der Hochschule.
 * Gezaehlt wird hier deshalb <em>jeder</em> Aufruf und nicht nur ein
 * fehlgeschlagener: ein erfolgreicher Versand ist genau das, was begrenzt
 * werden soll.
 *
 * <p><strong>Warum {@code verify} mitgebremst wird</strong>, obwohl §6.1 dort
 * kein 429 auffuehrt: sechs Stellen sind eine Million Moeglichkeiten. Ohne
 * Bremse liesse sich ein gueltiger Code in dieser Groessenordnung
 * durchprobieren, und §3.16 stuetzt die Sicherheit des Codes ausdruecklich auf
 * Ablauf <em>und</em> Rate-Limit statt auf seine Laenge. Ohne diese Zeile stuende
 * die Zusage aus §3.16 auf einem Bein. Nachgetragen in §6.1 mit Contract v23.
 *
 * <p><strong>Ein gemeinsamer Zaehler fuer beide Endpoints.</strong> Sie fuehren
 * zum selben Ziel, also waeren zwei Zaehler nur zwei Wege, dieselbe Grenze zu
 * umgehen: wer fuenf Codes durchprobiert hat, koennte sich sonst einen neuen
 * schicken lassen und weitermachen.
 *
 * <p>Grenzwert und Sperrdauer kommen aus {@link LoginAttemptProperties}, also
 * denselben fuenf Versuchen und fuenfzehn Minuten wie am Login. §6.5 verlangt
 * ausdruecklich „denselben Mechanismus"; ein zweites Wertepaar an anderer Stelle
 * waere dieselbe Entscheidung zweimal getroffen. Der <em>Zaehler</em> ist
 * trotzdem ein eigener, siehe {@link LoginAttemptService}.
 */
@Service
public class VerificationAttemptService {

	private final AttemptCounter counter;

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll.
	 */
	@Autowired
	public VerificationAttemptService(LoginAttemptProperties properties) {
		this(properties, Clock.systemUTC());
	}

	/** Fuer Tests, die die Uhr vorstellen muessen. */
	VerificationAttemptService(LoginAttemptProperties properties, Clock clock) {
		this.counter = new AttemptCounter(properties, clock);
	}

	/** Prueft vor jeder Arbeit, ob E-Mail oder IP derzeit gesperrt sind. */
	public boolean isBlocked(String email, String clientIp) {
		return counter.isBlocked(email, clientIp);
	}

	/**
	 * Zaehlt einen Aufruf, unabhaengig davon, ob er erfolgreich war.
	 *
	 * <p>Anders als am Login gibt es hier kein Zuruecksetzen bei Erfolg: der
	 * Versand selbst ist die begrenzte Ressource. Nur bei einer <em>gelungenen</em>
	 * Verifizierung wird zurueckgesetzt, siehe {@link #reset}.
	 */
	public void recordAttempt(String email, String clientIp) {
		counter.record(email, clientIp);
	}

	/**
	 * Setzt nach einer erfolgreich eingeloesten Verifizierung zurueck.
	 *
	 * <p>Ohne das summierten sich die beiden Schritte des Flusses: wer die private
	 * Adresse nach drei Anlaeufen bestaetigt hat, haette fuer die HSB-Adresse nur
	 * noch zwei uebrig, obwohl er gerade bewiesen hat, dass er Zugriff auf das
	 * Postfach hat.
	 */
	public void reset(String email, String clientIp) {
		counter.reset(email, clientIp);
	}
}
