package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.LoginResponse;
import de.hsbremen.eportfolio.auth.dto.UserResponse;
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
import org.springframework.web.bind.annotation.RestController;

/**
 * Auth-Endpoints aus API-Contract §6.1.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Anmeldung, Abmeldung und aktueller Benutzer (§6.1).")
public class AuthController {

	private final AuthService authService;

	private final UserRepository userRepository;

	public AuthController(AuthService authService, UserRepository userRepository) {
		this.authService = authService;
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
