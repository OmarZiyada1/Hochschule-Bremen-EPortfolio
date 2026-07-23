package de.hsbremen.eportfolio.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Erlaubte Herkuenfte fuer Cross-Origin-Requests ({@code app.security.cors}).
 *
 * <p>Konfigurierbar statt fest verdrahtet, weil der Vite-Dev-Server je nach
 * Setup auf einem anderen Port laeuft und die spaetere Produktivadresse hier
 * nichts zu suchen hat.
 *
 * @param erlaubteOrigins Komma-getrennte Liste, Default {@code
 *                        http://localhost:5173}
 */
@ConfigurationProperties(prefix = "app.security.cors")
public record CorsEigenschaften(List<String> erlaubteOrigins) {

	public CorsEigenschaften {
		if (erlaubteOrigins == null || erlaubteOrigins.isEmpty()) {
			erlaubteOrigins = List.of("http://localhost:5173");
		}
	}
}
