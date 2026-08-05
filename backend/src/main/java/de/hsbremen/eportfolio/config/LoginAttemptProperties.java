package de.hsbremen.eportfolio.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Grenzwerte der Anmeldeversuchs-Sperre ({@code app.security.login-attempts}).
 *
 * @param maxFailedAttempts Fehlversuche pro Schluessel, bevor gesperrt wird.
 *                          Default 5.
 * @param lockoutDuration   Dauer der Sperre. Default 15 Minuten.
 */
@ConfigurationProperties(prefix = "app.security.login-attempts")
public record LoginAttemptProperties(
		int maxFailedAttempts,
		Duration lockoutDuration) {

	public LoginAttemptProperties {
		if (maxFailedAttempts <= 0) {
			maxFailedAttempts = 5;
		}
		if (lockoutDuration == null) {
			lockoutDuration = Duration.ofMinutes(15);
		}
	}
}
