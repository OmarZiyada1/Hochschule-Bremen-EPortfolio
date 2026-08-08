package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.LoginResponse;
import de.hsbremen.eportfolio.auth.dto.RegisterRequest;
import de.hsbremen.eportfolio.auth.dto.ResendVerificationRequest;
import de.hsbremen.eportfolio.auth.dto.UserResponse;
import de.hsbremen.eportfolio.auth.dto.VerificationStatusResponse;
import de.hsbremen.eportfolio.auth.dto.VerifyRequest;
import de.hsbremen.eportfolio.common.error.ApiError;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auth-Endpoints aus API-Contract §6.1.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Registrierung, Verifizierung, Anmeldung, Abmeldung und "
		+ "aktueller Benutzer (§6.1).")
public class AuthController {

	private final AuthService authService;

	private final RegistrationService registrationService;

	private final UserRepository userRepository;

	public AuthController(AuthService authService, RegistrationService registrationService,
			UserRepository userRepository) {
		this.authService = authService;
		this.registrationService = registrationService;
		this.userRepository = userRepository;
	}

	/**
	 * Anmeldung mit privater E-Mail + Passwort. Liefert Token und
	 * Benutzerdaten (ohne {@code passwordHash}, ohne {@code hsbEmail}).
	 */
	// Kein Bearer-Token: dieser Endpoint liefert das Token ja erst. Hebt die
	// global registrierte Anforderung aus OpenApiConfig gezielt fuer diesen
	// einen Pfad auf, damit die UI hier kein Schloss anzeigt.
	@SecurityRequirements
	@Operation(summary = "Anmelden und JWT erhalten",
			description = "Das Feld \"token\" der Antwort gehoert oben rechts unter "
					+ "\"Authorize\" eingetragen; danach schickt die UI es bei jedem "
					+ "weiteren Aufruf mit.")
	@ApiResponse(responseCode = "200", description = "Token und Benutzerdaten.")
	@ApiResponse(responseCode = "400", description = "E-Mail oder Passwort fehlt bzw. keine gueltige E-Mail.")
	// Bewusst dieselbe Meldung fuer unbekannte Adresse und falsches Passwort -
	// sonst waere der Endpoint ein Verzeichnis existierender Konten.
	@ApiResponse(responseCode = "401", description = "Anmeldedaten falsch oder Konto nicht aktiv.")
	@ApiResponse(responseCode = "429", description = "Zu viele Fehlversuche, Konto bzw. IP ist voruebergehend gesperrt.")
	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest loginRequest, HttpServletRequest request) {
		return authService.login(loginRequest, clientIp(request));
	}

	// --- Registrierung und Verifizierung (§3.1.1, §6.1) --------------------
	// Die drei Endpoints liegen in diesem Controller und nicht in einem eigenen,
	// weil sie denselben Pfadpraefix und dieselbe Fehlerabbildung teilen: der
	// 429-Handler weiter unten gilt fuer Anmeldung und Verifizierung
	// gleichermassen. Ein zweiter Controller auf /api/auth muesste ihn
	// verdoppeln, denn @ExceptionHandler wirkt nur in seiner eigenen Klasse.

	/**
	 * Selbstregistrierung, Schritte 1 und 2 aus §3.1.1.
	 *
	 * <p>Legt Konto und Portfolio an und verschickt beide Codes. Die Rolle kommt
	 * aus der Domain der Hochschuladresse und nicht aus {@code selectedRole},
	 * siehe {@link RegistrationService#register}.
	 */
	@SecurityRequirements
	@Operation(summary = "Registrieren und beide Codes anfordern",
			description = "Legt ein Konto im Status REGISTRATION_PENDING samt Portfolio an "
					+ "und verschickt je einen sechsstelligen Code an die private und an die "
					+ "Hochschuladresse. Die Rolle leitet der Server aus der Domain der "
					+ "hsbEmail ab; selectedRole wird nur dagegen geprueft (§3.1.1). Eine "
					+ "Anmeldung ist erst nach beiden Bestaetigungen moeglich.")
	@ApiResponse(responseCode = "201", description = "Konto angelegt, Codes unterwegs.")
	@ApiResponse(responseCode = "400",
			description = "Pflichtfeld fehlt, Passwort zu kurz, HSB-Domain nicht anerkannt "
					+ "oder selectedRole passt nicht zur abgeleiteten Rolle.")
	@ApiResponse(responseCode = "409", description = "Private oder HSB-Adresse ist bereits vergeben.")
	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public UserResponse register(@Valid @RequestBody RegisterRequest registerRequest) {
		return registrationService.register(registerRequest);
	}

	/**
	 * Bestaetigung einer der beiden Adressen, Schritte 3 bis 5 aus §3.1.1.
	 *
	 * <p>Antwortet fuer eine unbekannte Adresse genauso wie fuer einen falschen
	 * Code, naemlich 400; sonst waere der Endpoint ein Verzeichnis registrierter
	 * Adressen (§6.1).
	 */
	@SecurityRequirements
	@Operation(summary = "E-Mail-Adresse mit Code bestaetigen",
			description = "Setzt das Flag zur angegebenen Adresse. Sobald beide gesetzt sind, "
					+ "wechselt das Konto nach ACTIVE und die Anmeldung ist moeglich. Die "
					+ "Antwort gibt beide Flags und den Status zurueck, damit der Client den "
					+ "Abschluss erkennt. Im Feld email steht immer die private Adresse, auch "
					+ "beim Zweck HSB_EMAIL: sie ist die Kennung des Kontos.")
	@ApiResponse(responseCode = "200", description = "Code angenommen, Verifizierungsstand der Antwort.")
	// Bewusst dieselbe Antwort fuer unbekannte Adresse, falschen, abgelaufenen
	// und bereits verbrauchten Code (§6.1, §6.2).
	@ApiResponse(responseCode = "400", description = "Code ungueltig, abgelaufen oder bereits verwendet.")
	@ApiResponse(responseCode = "429", description = "Zu viele Versuche, voruebergehend gesperrt.")
	@PostMapping("/verify")
	public VerificationStatusResponse verify(@Valid @RequestBody VerifyRequest verifyRequest,
			HttpServletRequest request) {
		return registrationService.verify(verifyRequest, clientIp(request));
	}

	/**
	 * Neuer Code, der vorherige wird entwertet (§6.1).
	 *
	 * <p><strong>204 ohne Inhalt, und zwar immer.</strong> Ob es die Adresse gibt,
	 * ob sie schon bestaetigt ist und ob eine Mail rausging, ist von aussen nicht
	 * zu unterscheiden. Anders liesse sich ueber diesen Endpoint ermitteln, welche
	 * Adressen registriert sind.
	 */
	@SecurityRequirements
	@Operation(summary = "Verifizierungscode erneut anfordern",
			description = "Erzeugt einen neuen Code und entwertet den vorherigen. Antwortet "
					+ "immer mit 204, auch fuer unbekannte oder laengst bestaetigte Adressen: "
					+ "eine unterscheidbare Antwort waere ein Verzeichnis registrierter "
					+ "Adressen (§6.1). Gezaehlt wird jeder Aufruf, nicht nur ein "
					+ "fehlgeschlagener, sonst waere der Endpoint ein Versandgenerator.")
	@ApiResponse(responseCode = "204", description = "Angenommen. Ob eine Mail rausging, sagt die Antwort nicht.")
	@ApiResponse(responseCode = "429", description = "Zu viele Anforderungen, voruebergehend gesperrt.")
	@PostMapping("/verify/resend")
	public ResponseEntity<Void> resendVerification(
			@Valid @RequestBody ResendVerificationRequest resendRequest, HttpServletRequest request) {
		registrationService.resend(resendRequest, clientIp(request));
		return ResponseEntity.noContent().build();
	}

	/**
	 * Absender-Adresse fuer die Anmeldeversuchs-Sperre.
	 *
	 * <p>Bewusst {@code getRemoteAddr()} ohne Auswertung von
	 * {@code X-Forwarded-For}: dieser Header ist frei setzbar, solange kein
	 * vertrauenswuerdiger Reverse Proxy davorsteht, der ihn ueberschreibt. Ein
	 * Angreifer koennte die IP-Sperre sonst mit jedem Request umgehen. Sobald
	 * die Anwendung hinter einem Proxy laeuft, gehoert das ueber
	 * {@code server.forward-headers-strategy} geloest, nicht hier.
	 */
	private static String clientIp(HttpServletRequest request) {
		return request.getRemoteAddr();
	}

	/**
	 * Abmeldung.
	 *
	 * <p><strong>Was dieser Endpoint tatsaechlich bewirkt:</strong> serverseitig
	 * nichts, was das ausgegebene Token entwerten wuerde. Die API ist stateless
	 * (§1); ein einmal signiertes JWT bleibt bis zum Ablauf gueltig, weil der
	 * Server keine Sitzung fuehrt, die er beenden koennte. Der Endpoint leert
	 * den SecurityContext dieses einen Requests und quittiert mit 204; die
	 * eigentliche Abmeldung ist, dass der Client sein Token verwirft.
	 *
	 * <p>Er existiert trotzdem, weil §6.1 ihn vorsieht und das Frontend einen
	 * definierten Aufhaenger braucht. Wer tatsaechlich serverseitig
	 * zurueckziehen will, braucht kurzlebige Access-Tokens plus Refresh-Token
	 * oder eine Denylist, beides eigene Tickets, siehe Rueckmeldung zu KAN-5.
	 *
	 * <p>Kompensiert wird das Restrisiko dadurch, dass der
	 * {@link JwtAuthenticationFilter} bei jedem Request
	 * {@code User.status = ACTIVE} nachprueft: ein deaktiviertes Konto ist
	 * sofort draussen, unabhaengig von der Token-Laufzeit.
	 */
	@Operation(summary = "Abmelden",
			description = "Antwortet mit 204 und leert den SecurityContext dieses Requests. "
					+ "Das bereits ausgegebene Token bleibt bis zum Ablauf gueltig - die API "
					+ "ist stateless und fuehrt keine Sitzung, die sie beenden koennte. Die "
					+ "eigentliche Abmeldung ist, dass der Client sein Token verwirft.")
	@PostMapping("/logout")
	public ResponseEntity<Void> logout() {
		SecurityContextHolder.clearContext();
		return ResponseEntity.noContent().build();
	}

	/**
	 * Aktueller Benutzer inklusive Rolle.
	 *
	 * <p>Wird frisch aus der Datenbank gelesen statt aus dem Principal
	 * zusammengesetzt, damit z. B. eine zwischenzeitliche Rollenaenderung durch
	 * den Admin sichtbar wird.
	 */
	@Operation(summary = "Aktuellen Benutzer lesen",
			description = "Benoetigt ein Token. Liefert die Daten frisch aus der Datenbank, "
					+ "nicht aus den Token-Claims - eine zwischenzeitliche Rollenaenderung "
					+ "durch den Admin ist damit sofort sichtbar.")
	@ApiResponse(responseCode = "200", description = "Benutzerdaten des Token-Inhabers.")
	@ApiResponse(responseCode = "401", description = "Kein, abgelaufenes oder ungueltiges Token.")
	@GetMapping("/me")
	public UserResponse me(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		User user = userRepository.findById(authenticatedUser.getId())
				.orElseThrow(() -> new AuthService.LoginFailedException());
		return UserResponse.from(user);
	}

	// --- Fehlerabbildung auf das Envelope aus §6.2 -------------------------
	// Liegt hier statt im GlobalExceptionHandler, weil beide Exceptions rein
	// auth-fachlich sind und ausserhalb dieses Controllers nicht auftreten.

	@ExceptionHandler(AuthService.LoginFailedException.class)
	public ResponseEntity<ApiError> handleLoginFailed(
			AuthService.LoginFailedException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError(
				Instant.now(),
				HttpStatus.UNAUTHORIZED.value(),
				ErrorCodes.LOGIN_FAILED,
				ex.getMessage(),
				request.getRequestURI()));
	}

	@ExceptionHandler(AuthService.TooManyLoginAttemptsException.class)
	public ResponseEntity<ApiError> handleTooManyAttempts(
			AuthService.TooManyLoginAttemptsException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(new ApiError(
				Instant.now(),
				HttpStatus.TOO_MANY_REQUESTS.value(),
				ErrorCodes.TOO_MANY_LOGIN_ATTEMPTS,
				ex.getMessage(),
				request.getRequestURI()));
	}

	@ExceptionHandler(AuthService.AccountNotActiveException.class)
	public ResponseEntity<ApiError> handleAccountNotActive(
			AuthService.AccountNotActiveException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError(
				Instant.now(),
				HttpStatus.UNAUTHORIZED.value(),
				ErrorCodes.ACCOUNT_NOT_ACTIVE,
				ex.getMessage(),
				request.getRequestURI()));
	}
}
