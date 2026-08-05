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
 * @param allowedOrigins Komma-getrennte Liste, Default {@code
 *                       http://localhost:5173}
 */
@ConfigurationProperties(prefix = "app.security.cors")
public record CorsProperties(List<String> allowedOrigins) {

	public CorsProperties {
		if (allowedOrigins == null || allowedOrigins.isEmpty()) {
			allowedOrigins = List.of("http://localhost:5173");
		}
		// Im Profil prod kommt der Wert aus der Umgebung. Fehlt er, stuende hier
		// die Zeichenfolge "${CORS_ALLOWED_ORIGINS}" als einzige erlaubte
		// Herkunft (siehe ConfigurationValues): das Frontend bekaeme bei jedem
		// Aufruf einen CORS-Fehler, ohne dass im Log etwas darauf hindeutet.
		boolean unresolved = allowedOrigins.stream().anyMatch(ConfigurationValues::isMissing);
		ConfigurationValues.failIfMissing("app.security.cors ist konfiguriert",
				unresolved ? List.of("app.security.cors.allowed-origins (CORS_ALLOWED_ORIGINS)") : List.of());
	}
}
