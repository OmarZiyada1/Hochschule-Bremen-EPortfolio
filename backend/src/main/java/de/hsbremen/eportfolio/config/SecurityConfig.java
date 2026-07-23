package de.hsbremen.eportfolio.config;

import de.hsbremen.eportfolio.auth.JwtAuthentifizierungsFilter;
import de.hsbremen.eportfolio.auth.RestAuthentifizierungsEinstieg;
import de.hsbremen.eportfolio.auth.RestZugriffVerweigertHandler;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Zentrale Security-Konfiguration.
 *
 * <p>{@code @EnableMethodSecurity} schaltet die Rollenebene der Autorisierung
 * frei ({@code @PreAuthorize} auf den kommenden Controllern, §5). Die
 * Ressourcenebene — „nur eigene Ressource" (✓) — laesst sich damit nicht
 * abbilden und liegt im {@code ProjektBerechtigungService}.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

	private final JwtAuthentifizierungsFilter jwtFilter;

	private final RestAuthentifizierungsEinstieg authentifizierungsEinstieg;

	private final RestZugriffVerweigertHandler zugriffVerweigertHandler;

	private final CorsEigenschaften corsEigenschaften;

	public SecurityConfig(JwtAuthentifizierungsFilter jwtFilter,
			RestAuthentifizierungsEinstieg authentifizierungsEinstieg,
			RestZugriffVerweigertHandler zugriffVerweigertHandler,
			CorsEigenschaften corsEigenschaften) {
		this.jwtFilter = jwtFilter;
		this.authentifizierungsEinstieg = authentifizierungsEinstieg;
		this.zugriffVerweigertHandler = zugriffVerweigertHandler;
		this.corsEigenschaften = corsEigenschaften;
	}

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			.cors(Customizer.withDefaults())

			// CSRF ist hier abgeschaltet, und zwar begruendet:
			// Ein CSRF-Angriff funktioniert, weil der Browser Cookies zu einer
			// Domain automatisch mitschickt. Diese API fuehrt keine Session und
			// setzt kein Cookie (SessionCreationPolicy.STATELESS); die
			// Anmeldung steckt im Authorization-Header, den der Client bei
			// jedem Request aktiv setzen muss. Eine fremde Seite kann diesen
			// Header nicht erzeugen, also gibt es nichts zu faelschen.
			// Diese Begruendung faellt in dem Moment weg, in dem das Token in
			// einem Cookie landet — dann muss CSRF-Schutz zurueck.
			.csrf(csrf -> csrf.disable())

			.sessionManagement(sitzung -> sitzung.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

			.exceptionHandling(fehler -> fehler
					// Ohne diese beiden Zeilen antwortet Spring Security an
					// GlobalExceptionHandler vorbei und die API haette zwei
					// verschiedene Fehlerformate (§6.2).
					.authenticationEntryPoint(authentifizierungsEinstieg)
					.accessDeniedHandler(zugriffVerweigertHandler))

			.authorizeHttpRequests(anfragen -> anfragen
					// Preflight muss ohne Token durchgehen.
					.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

					.requestMatchers("/api/auth/login").permitAll()
					.requestMatchers("/actuator/health").permitAll()

					// PUBLIC-Lesezugriff aus §5 auf veroeffentlichte Inhalte.
					// Die Endpoints gibt es noch nicht; die Regeln stehen hier,
					// damit die spaeteren Controller nicht versehentlich hinter
					// authenticated() verschwinden. Innerhalb dieser Pfade
					// entscheidet der Berechtigungsservice, was ein nicht
					// angemeldeter Aufrufer tatsaechlich zu sehen bekommt.
					.requestMatchers(HttpMethod.GET,
							"/api/projekte", "/api/projekte/*",
							"/api/projekte/*/blocks",
							"/api/portfolios/*",
							"/api/kategorien", "/api/fakultaeten",
							"/api/studiengaenge", "/api/module",
							"/api/top10").permitAll()

					// Rollenebene fuer den Admin-Bereich. Der Rest der Matrix
					// haengt an der Ressource und wird pro Endpoint geprueft.
					.requestMatchers("/api/admin/**").hasRole("ADMIN")

					.anyRequest().authenticated())

			.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

	/**
	 * BCrypt mit dem Spring-Default (Staerke 10). Der Algorithmus versieht jeden
	 * Hash mit eigenem Salt und ist absichtlich langsam.
	 */
	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration konfiguration = new CorsConfiguration();
		konfiguration.setAllowedOrigins(corsEigenschaften.erlaubteOrigins());
		konfiguration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		konfiguration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		// Keine Credentials: die Anmeldung laeuft ueber den Authorization-Header,
		// nicht ueber Cookies.
		konfiguration.setAllowCredentials(false);
		konfiguration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource quelle = new UrlBasedCorsConfigurationSource();
		quelle.registerCorsConfiguration("/api/**", konfiguration);
		return quelle;
	}
}
