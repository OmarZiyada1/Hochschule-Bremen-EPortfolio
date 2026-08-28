package de.hsbremen.eportfolio.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Grenzwerte der Bremse am oeffentlichen Kontaktformular
 * ({@code app.support}, API-Contract §6.5, §6.1).
 *
 * <p><strong>Eigene Werte statt derer des Logins.</strong> §6.5 verlangt fuer
 * die Verifizierungs- und Passwort-Endpoints ausdruecklich „denselben
 * Mechanismus" <em>und</em> dieselben Werte; fuer das Kontaktformular gilt seit
 * v87 nur noch der erste Teil. Der Grund liegt in der Art des Vorgangs: eine
 * Anmeldung wiederholt man nach einem Vertipper sofort, eine Support-Anfrage
 * schreibt man einmal. Fuenf Versuche in einer Viertelstunde waeren fuer den
 * ersten Fall knapp und fuer den zweiten weit.
 *
 * <p>Der Zaehler selbst ist ohnehin ein eigener ({@code SupportRateLimitService}),
 * aus demselben Grund, der Login- und Code-Zaehler trennt: eine abgeschickte
 * Hilfeanfrage darf niemanden aus der Anmeldung aussperren, und ein gesperrter
 * Login darf die Hilfeanfrage nicht verhindern.
 *
 * <p>Wie beim Login liegt der Zaehler nur im Arbeitsspeicher und ist nach einem
 * Neustart leer (§6.5).
 *
 * @param maxRequests Einsendungen je Schluessel innerhalb des Fensters, bevor
 *                    gesperrt wird. Default 3. Gezaehlt wird <em>jede</em>
 *                    Einsendung und nicht nur eine fehlgeschlagene: die Zeile im
 *                    Eingangsbuch ist genau das, was begrenzt werden soll
 * @param window      Dauer der Sperre und zugleich das Zeitfenster der
 *                    Zaehlung. Default 1 Stunde
 */
@ConfigurationProperties(prefix = "app.support")
public record SupportProperties(
		int maxRequests,
		Duration window) implements AttemptLimits {

	public SupportProperties {
		if (maxRequests <= 0) {
			maxRequests = 3;
		}
		if (window == null) {
			window = Duration.ofHours(1);
		}
	}

	/**
	 * Der Name aus §6.5 heisst hier {@code maxRequests}, weil jede Einsendung
	 * zaehlt und nicht nur ein Fehlversuch.
	 */
	@Override
	public int maxAttempts() {
		return maxRequests;
	}

	/**
	 * Fenster und Sperrdauer fallen hier zusammen: wer die Grenze erreicht hat,
	 * wartet bis zum Ende des Fensters. Ein zweiter Wert daneben waere eine
	 * Unterscheidung ohne Fall, denn anders als am Login gibt es hier kein
	 * Zuruecksetzen bei Erfolg.
	 */
	@Override
	public Duration lockoutDuration() {
		return window;
	}
}
