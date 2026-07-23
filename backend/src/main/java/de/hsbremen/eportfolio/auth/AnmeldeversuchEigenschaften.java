package de.hsbremen.eportfolio.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Grenzwerte der Anmeldeversuchs-Sperre ({@code app.security.anmeldeversuche}).
 *
 * @param maxFehlversuche Fehlversuche pro Schluessel, bevor gesperrt wird.
 *                        Default 5.
 * @param sperrdauer      Dauer der Sperre. Default 15 Minuten.
 */
@ConfigurationProperties(prefix = "app.security.anmeldeversuche")
public record AnmeldeversuchEigenschaften(
		int maxFehlversuche,
		Duration sperrdauer) {

	public AnmeldeversuchEigenschaften {
		if (maxFehlversuche <= 0) {
			maxFehlversuche = 5;
		}
		if (sperrdauer == null) {
			sperrdauer = Duration.ofMinutes(15);
		}
	}
}
