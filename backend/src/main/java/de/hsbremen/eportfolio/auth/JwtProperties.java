package de.hsbremen.eportfolio.auth;

import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Konfiguration der Zugriffstokens ({@code app.security.jwt}).
 *
 * @param secret   Signaturschluessel, ausschliesslich aus der Umgebung
 *                 ({@code JWT_SECRET}). Steht bewusst nirgends im Code und in
 *                 keiner eingecheckten Datei; ohne den Wert startet die
 *                 Anwendung nicht.
 * @param lifetime Gueltigkeitsdauer eines Tokens, Default 8 Stunden. Kuerzere
 *                 Werte lassen den Autosave des Editors mitten in der Sitzung
 *                 mit 401 auflaufen.
 * @param issuer   Aussteller-Claim.
 */
@Validated
@ConfigurationProperties(prefix = "app.security.jwt")
public record JwtProperties(
		@NotBlank String secret,
		Duration lifetime,
		String issuer) {

	public JwtProperties {
		if (lifetime == null) {
			lifetime = Duration.ofHours(8);
		}
		if (issuer == null || issuer.isBlank()) {
			issuer = "eportfolio";
		}
	}
}
