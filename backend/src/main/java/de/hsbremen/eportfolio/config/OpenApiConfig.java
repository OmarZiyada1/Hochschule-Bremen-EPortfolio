package de.hsbremen.eportfolio.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Beschreibung der API fuer OpenAPI/Swagger-UI (KAN-11).
 *
 * <p>Alle Grundangaben stehen bewusst in dieser einen Bean statt verteilt in
 * {@code application.yml} und Controller-Annotationen: die Metadaten der API
 * gehoeren an eine Stelle, sonst weiss beim naechsten Contract-Stand niemand,
 * wo die Versionsnummer nachzuziehen ist.
 *
 * <p>Diese Klasse erzeugt <strong>keine</strong> Endpoint-Dokumentation.
 * Springdoc liest die Endpoints selbst aus den {@code @RestController}-Klassen
 * und den DTO-Typen; die Oberflaeche fuellt sich daher automatisch, sobald
 * weitere Controller entstehen. Hier steht nur, was springdoc nicht aus dem
 * Code ableiten kann.
 */
@Configuration
public class OpenApiConfig {

	/**
	 * Name des Sicherheitsschemas. Taucht in der Swagger-UI als Beschriftung im
	 * „Authorize"-Dialog auf.
	 */
	private static final String BEARER_SCHEMA = "bearerAuth";

	@Bean
	public OpenAPI eportfolioOpenApi() {
		SecurityScheme bearer = new SecurityScheme()
				.type(SecurityScheme.Type.HTTP)
				.scheme("bearer")
				.bearerFormat("JWT")
				.description("""
						Token aus POST /api/auth/login (Feld "token") hier \
						eintragen. Die UI setzt daraufhin bei jedem Aufruf den \
						Header "Authorization: Bearer <token>", so wie es der \
						JwtAuthenticationFilter erwartet. Das "Bearer "- \
						Praefix ergaenzt die UI selbst, es gehoert nicht ins \
						Eingabefeld.""");

		return new OpenAPI()
				.info(new Info()
						.title("E-Portfolio Hochschule Bremen: API")
						.version("v49")
						.description("""
								REST-API des E-Portfolio-Systems der Hochschule \
								Bremen (FK4). Stand entspricht dem API-Contract \
								v49, §6.

								Authentifizierung: JWT als Bearer-Token. Ohne \
								gueltiges Token antworten geschuetzte Pfade mit \
								401 im Fehler-Envelope aus §6.2 \
								(timestamp, status, errorCode, message, path). \
								Jede Fehlerantwort hat diese Form, auch ein \
								unerwarteter Serverfehler: 500 INTERNAL_ERROR \
								(§6.3).

								Diese Oberflaeche ist nur im Profil dev \
								erreichbar."""))
				.components(new Components().addSecuritySchemes(BEARER_SCHEMA, bearer))
				// Global statt pro Controller: jeder kuenftige Endpoint erbt das
				// Schema automatisch und niemand muss daran denken, es zu
				// annotieren. Das ist eine reine Doku-Angabe; welche Pfade
				// tatsaechlich ein Token verlangen, entscheidet allein die
				// SecurityFilterChain.
				.addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEMA));
	}
}
