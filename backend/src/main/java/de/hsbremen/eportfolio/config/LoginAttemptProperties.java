package de.hsbremen.eportfolio.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Grenzwerte der Anmeldeversuchs-Sperre ({@code app.security.login-attempts}).
 *
 * <p>Dieselben Werte gelten fuer die Verifizierungs- und Passwort-Endpoints:
 * §6.5 verlangt dort ausdruecklich „denselben Mechanismus", und ein zweites
 * Wertepaar an anderer Stelle waere dieselbe Entscheidung zweimal getroffen.
 * Der <em>Zaehler</em> ist trotzdem ein eigener (siehe
 * {@code auth.VerificationAttemptService}).
 *
 * <p>Seit KAN-85 implementiert der Record {@link AttemptLimits}. Das
 * Kontaktformular bringt mit {@link SupportProperties} den ersten Anlass mit
 * eigenen Werten mit; der Zaehler nimmt deshalb die Schnittstelle entgegen und
 * nicht mehr diesen Record. An den Werten hier aendert das nichts.
 *
 * @param maxFailedAttempts Fehlversuche pro Schluessel, bevor gesperrt wird.
 *                          Default 5.
 * @param lockoutDuration   Dauer der Sperre. Default 15 Minuten.
 */
@ConfigurationProperties(prefix = "app.security.login-attempts")
public record LoginAttemptProperties(
		int maxFailedAttempts,
		Duration lockoutDuration) implements AttemptLimits {

	public LoginAttemptProperties {
		if (maxFailedAttempts <= 0) {
			maxFailedAttempts = 5;
		}
		if (lockoutDuration == null) {
			lockoutDuration = Duration.ofMinutes(15);
		}
	}

	/**
	 * Der Name bleibt {@code maxFailedAttempts}, weil er an dieser Stelle die
	 * genauere Aussage ist: am Login zaehlt ausschliesslich der Fehlversuch, ein
	 * gelungener setzt zurueck.
	 */
	@Override
	public int maxAttempts() {
		return maxFailedAttempts;
	}
}
