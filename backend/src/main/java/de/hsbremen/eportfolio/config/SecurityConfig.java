package de.hsbremen.eportfolio.config;

import de.hsbremen.eportfolio.auth.JwtAuthenticationFilter;
import de.hsbremen.eportfolio.auth.RestAccessDeniedHandler;
import de.hsbremen.eportfolio.auth.RestAuthenticationEntryPoint;
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
 * Ressourcenebene („nur eigene Ressource", ✓) laesst sich damit nicht abbilden
 * und liegt im {@code ProjectPermissionService}.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

	private final JwtAuthenticationFilter jwtFilter;

	private final RestAuthenticationEntryPoint authenticationEntryPoint;

	private final RestAccessDeniedHandler accessDeniedHandler;

	private final CorsProperties corsProperties;

	public SecurityConfig(JwtAuthenticationFilter jwtFilter,
			RestAuthenticationEntryPoint authenticationEntryPoint,
			RestAccessDeniedHandler accessDeniedHandler,
			CorsProperties corsProperties) {
		this.jwtFilter = jwtFilter;
		this.authenticationEntryPoint = authenticationEntryPoint;
		this.accessDeniedHandler = accessDeniedHandler;
		this.corsProperties = corsProperties;
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
			// einem Cookie landet: dann muss CSRF-Schutz zurueck.
			.csrf(csrf -> csrf.disable())

			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

			.exceptionHandling(exceptions -> exceptions
					// Ohne diese beiden Zeilen antwortet Spring Security an
					// GlobalExceptionHandler vorbei und die API haette zwei
					// verschiedene Fehlerformate (§6.2).
					.authenticationEntryPoint(authenticationEntryPoint)
					.accessDeniedHandler(accessDeniedHandler))

			.authorizeHttpRequests(requests -> requests
					// Preflight muss ohne Token durchgehen.
					.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

					.requestMatchers("/api/auth/login").permitAll()

					// Registrierung und Verifizierung (KAN-26, §6.1). Alle drei
					// sind PUBLIC, und zwar zwangslaeufig: wer sich gerade erst
					// registriert, hat noch kein Token, und wessen Konto in
					// REGISTRATION_PENDING steht, bekaeme selbst mit Token ein
					// 401 ACCOUNT_NOT_ACTIVE (§2.9). Waeren die Pfade
					// authentifiziert, koennte niemand die Registrierung je
					// abschliessen.
					// An die Stelle der Anmeldung tritt hier zweierlei: das
					// Einmalgeheimnis im Postfach und das Rate-Limit aus
					// VerificationAttemptService. Die Pfade stehen einzeln da und
					// nicht als /api/auth/**, weil unter demselben Praefix mit
					// /auth/me und /auth/logout Endpoints liegen, die ein Token
					// brauchen.
					// Die Passwort-Ruecksetzung (KAN-43, §6.1) ist aus demselben
					// Grund PUBLIC: wer sein Passwort vergessen hat, kann sich
					// nicht anmelden. An die Stelle der Anmeldung treten der
					// Ruecksetzcode im Postfach und das Rate-Limit aus §6.5.
					.requestMatchers(HttpMethod.POST,
							"/api/auth/register",
							"/api/auth/verify",
							"/api/auth/verify/resend",
							"/api/auth/forgot-password",
							"/api/auth/reset-password").permitAll()

					// Das oeffentliche Kontaktformular (KAN-85, §6.1). Der
					// einzige schreibende Endpoint, den §5 fuer PUBLIC
					// freigibt, und zwangslaeufig offen: der haeufigste
					// Support-Fall ist "ich komme nicht hinein", und ein
					// Formular hinter der Anmeldung hilft genau dort nicht.
					// An die Stelle der Anmeldung treten die Bremse aus §6.5
					// (SupportRateLimitService, eigener Zaehler und eigene
					// Grenzwerte) und das versteckte Formularfeld aus §6.1.
					// Bewusst nur POST auf genau diesen Pfad: die drei
					// lesenden und schreibenden Verwaltungspfade liegen unter
					// /api/admin/support und fallen damit unter die
					// hasRole("ADMIN")-Zeile weiter unten. Ein Token darf
					// mitkommen und wird dann als submittedByUserId vermerkt
					// (§3.20); noetig ist es nicht.
					.requestMatchers(HttpMethod.POST, "/api/support").permitAll()

					.requestMatchers("/actuator/health").permitAll()

					// Swagger-UI und das OpenAPI-Dokument (KAN-11).
					// Ohne diese Freigabe greift .anyRequest().authenticated()
					// und der Aufruf der Doku endet mit 401; die Seite ist ja
					// gerade der Ort, an dem man sich sein Token erst besorgt.
					// Bewusst nur diese drei Muster; ein pauschales permitAll
					// auf statische Pfade wuerde mehr oeffnen als noetig.
					// Dass diese Pfade offen sind, ist unkritisch, weil sie im
					// Profil prod ueberhaupt nicht bedient werden (springdoc ist
					// dort abgeschaltet, siehe application.yml) und weil hinter
					// ihnen nur die Beschreibung der API liegt, keine Daten.
					.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

					// PUBLIC-Lesezugriff aus §5 auf veroeffentlichte Inhalte.
					// Ein Teil dieser Endpoints gibt es noch nicht; die Regeln
					// stehen hier, damit die spaeteren Controller nicht
					// versehentlich hinter authenticated() verschwinden.
					// Innerhalb dieser Pfade entscheidet der
					// Berechtigungsservice, was ein nicht angemeldeter Aufrufer
					// tatsaechlich zu sehen bekommt.
					// Die Einschraenkung auf GET ist der Grund, warum die
					// schreibenden Projekt-Endpoints aus KAN-17 hier keine
					// eigene Zeile brauchen: POST, PUT und DELETE auf
					// dieselben Pfade fallen unter anyRequest().authenticated()
					// und ergeben ohne Token 401. Wer angemeldet was darf,
					// haengt an der Ressource und entscheidet der
					// ProjectPermissionService, nicht die Filterkette. Auch
					// PUT /api/projects/*/editors steht bewusst nicht als
					// hasRole("ADMIN") hier: sonst kaeme der 403 vor dem
					// Laden des Projekts und eine unbekannte ID ergaebe 403
					// statt 404 (§6.3.1).
					// Dasselbe gilt fuer die Workflow-Pfade aus KAN-19 und
					// KAN-69 (POST /api/projects/*/submit, /withdraw,
					// /approve, /publish und
					// /request-revision): kein Muster hier erfasst sie, sie
					// fallen also unter authenticated() und ergeben ohne Token
					// 401. Ein hasRole("EDITOR") fuer /approve und /publish
					// waere hier ohnehin zu grob, weil das Recht am
					// Projektstatus und an der Autorschaft haengt (§4.1).
					// /api/projects/*/comments kam mit KAN-20 dazu und stand
					// als einziger Lesepfad aus §6.1 noch nicht in dieser
					// Liste. Nach §2.3 sind REPLY und CHANGE_REQUEST "sichtbar
					// fuer alle mit Projektzugriff", und bei einem
					// veroeffentlichten Projekt ist das auch ohne Anmeldung der
					// Fall. Welche Kommentare tatsaechlich in der Antwort
					// stehen, entscheidet der CommentService: eine NOTE ist dort
					// fuer niemanden ausser Redaktion und Administration dabei.
					// PATCH und DELETE auf /api/comments/* stehen bewusst nicht
					// hier und fallen damit unter authenticated().
					// Die Reaktions-Endpoints aus KAN-21 (POST und DELETE auf
					// /api/projects/*/reaction) brauchen aus demselben Grund
					// keine eigene Zeile: das Muster /api/projects/* gilt nur
					// fuer GET, sie fallen also unter authenticated() und
					// ergeben ohne Token 401. Genau das verlangt §5, wo die
					// Zeile "Reaktion geben" fuer PUBLIC ein Kreuz traegt. Eine
					// Rollenregel waere hier zu grob, weil das Recht am
					// Projektstatus haengt (§3.10) und nicht an der Rolle.
					// /api/portfolios/* stand hier schon vorab und wird mit
					// KAN-22 tatsaechlich bedient: das oeffentliche Profil ist
					// nach §6.1 PUBLIC. Die beiden Pfade /api/portfolio/me
					// (Einzahl) sind davon nicht erfasst, weder als GET noch
					// als PUT, und fallen unter authenticated(). Das ist so
					// gewollt: "me" ist ohne Identitaet nicht aufloesbar, und
					// §5 gibt das eigene Portfolio nur seinem Besitzer frei.
					// Wer das darf, entscheidet der ProjectPermissionService.
					// /api/files/* kam mit KAN-23 dazu: Avatare und Dateien
					// veroeffentlichter Projekte sind nach §3.15 ohne
					// Anmeldung abrufbar, und ein oeffentliches Profil mit
					// nicht abrufbarem Profilbild waere in sich
					// widerspruechlich. Ohne diese Zeile ergaebe der Abruf
					// eines Avatars 401, obwohl §5 ihn fuer PUBLIC freigibt.
					// Freigegeben ist nur GET; POST und DELETE auf /api/files
					// fallen unter authenticated(). Ob ein Aufrufer die Datei
					// tatsaechlich zu sehen bekommt, entscheidet der
					// FileService am Projektstatus, nicht die Filterkette.
					// /api/semesters kam mit KAN-65 dazu und steht in derselben
					// Zeile wie die vier uebrigen Stammdatenlisten: §6.1 fuehrt
					// den Endpoint als PUBLIC, weil Projektbibliothek und
					// Metadaten-Formular ihre Auswahl daraus fuellen, und ein
					// Semestername ist nichts Schuetzenswertes. Nur GET; POST,
					// PATCH, DELETE liegen unter /api/admin/semesters und
					// fallen damit unter hasRole("ADMIN").
					// GET /api/users/lookup (KAN-44) steht bewusst nicht hier:
					// §6.1 verlangt eine gueltige Anmeldung, ohne Token 401
					// NOT_AUTHENTICATED. Eine oeffentliche Personensuche ueber
					// alle Konten waere etwas anderes als eine Auswahlhilfe
					// fuer angemeldete Autor:innen. Eine Rollenregel braucht
					// der Pfad nicht, schon Studierende nutzen ihn fuer die
					// Redaktionszuweisung (§5, Fussnote 3).
					// /api/tags kam mit KAN-75 dazu und steht aus demselben Grund
					// wie /api/semesters bei den uebrigen Stammdatenlisten: §6.1
					// fuehrt den Endpoint als PUBLIC. Die Vorschlagsliste enthaelt
					// nur Woerter und ihre Verwendungszahl, keine Projektbezuege;
					// aus ihr laesst sich nicht ablesen, welches Projekt welches
					// Tag traegt, auch nicht fuer Entwuerfe. Nur GET: geschrieben
					// wird an dieser Tabelle allein als Nebenwirkung von
					// POST/PUT /api/projects, und die fallen unter
					// authenticated().
					// Die drei Pfade aus KAN-37 stehen bewusst nicht in dieser
					// Liste. DELETE /api/projects/*/editors/me faellt unter
					// anyRequest().authenticated(), weil /api/projects/* nur als
					// GET freigegeben ist; ohne Token ergibt es damit 401, wie §5
					// es fuer die Zeile „Eigene Redaktionszuweisung abgeben"
					// verlangt. Dasselbe gilt seit KAN-83 fuer DELETE
					// /api/projects/*/members/me (§5, Zeile
					// „Projektmitgliedschaft beenden"): auch dieser Pfad ist
					// laenger als das freigegebene Muster und braucht deshalb
					// keine eigene Zeile. GET /api/top10-nominations ist ebenfalls nicht
					// erfasst: /api/top10 steht als exaktes Muster und nicht als
					// /api/top10/**, greift also nicht auf den laengeren Pfad. Eine
					// Rollenregel bekaeme keiner davon: sie kaeme vor dem Laden, und
					// ein fehlender Parameter ergaebe dann 403 statt des 400, das
					// §6.1 vorsieht.
					.requestMatchers(HttpMethod.GET,
							"/api/projects", "/api/projects/*",
							"/api/projects/*/blocks",
							"/api/projects/*/comments",
							"/api/portfolios/*",
							"/api/files/*",
							"/api/categories", "/api/faculties",
							"/api/study-programs", "/api/modules",
							"/api/semesters", "/api/tags",
							"/api/top10").permitAll()

					// HEAD auf /api/files/* kam mit KAN-72 dazu, zusammen mit
					// der Range-Auslieferung (§3.15). RFC 9110 definiert HEAD
					// als GET ohne Rumpf: wo das GET oeffentlich ist, gibt HEAD
					// nichts preis, was jenes nicht schon preisgibt. Ohne diese
					// Zeile ergaebe ein anonymes HEAD auf die Datei eines
					// veroeffentlichten Projekts 401, waehrend das GET
					// derselben Datei 200 liefert, und ein Medienelement
					// koennte Groesse und Accept-Ranges nicht vorab erfragen,
					// ohne Bytes zu ziehen. Spring beantwortet HEAD ueber
					// dasselbe @GetMapping; die Entscheidung, ob die Datei
					// sichtbar ist, trifft weiterhin der FileService am
					// Projektstatus und nicht die Filterkette. Bewusst nur
					// fuer diesen Pfad: die uebrigen PUBLIC-GETs liefern JSON,
					// fuer das ein HEAD keinen Zweck hat.
					.requestMatchers(HttpMethod.HEAD, "/api/files/*").permitAll()

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
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(corsProperties.allowedOrigins());
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		// Keine Credentials: die Anmeldung laeuft ueber den Authorization-Header,
		// nicht ueber Cookies.
		configuration.setAllowCredentials(false);
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}
}
