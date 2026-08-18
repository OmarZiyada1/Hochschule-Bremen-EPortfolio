package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.ForgotPasswordRequest;
import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.LoginResponse;
import de.hsbremen.eportfolio.auth.dto.PasswordChangeRequest;
import de.hsbremen.eportfolio.auth.dto.ProfileUpdateRequest;
import de.hsbremen.eportfolio.auth.dto.RegisterRequest;
import de.hsbremen.eportfolio.auth.dto.ResendVerificationRequest;
import de.hsbremen.eportfolio.auth.dto.ResetPasswordRequest;
import de.hsbremen.eportfolio.auth.dto.UserResponse;
import de.hsbremen.eportfolio.auth.dto.VerificationStatusResponse;
import de.hsbremen.eportfolio.auth.dto.VerifyRequest;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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
import org.springframework.web.bind.annotation.PutMapping;
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

	private final PasswordResetService passwordResetService;

	private final UserRepository userRepository;

	public AuthController(AuthService authService, RegistrationService registrationService,
			PasswordResetService passwordResetService, UserRepository userRepository) {
		this.authService = authService;
		this.registrationService = registrationService;
		this.passwordResetService = passwordResetService;
		this.userRepository = userRepository;
	}

	/**
	 * Anmeldung mit privater E-Mail + Passwort. Liefert Token und
	 * Benutzerdaten: nie {@code passwordHash}, seit v50 mit der eigenen
	 * {@code hsbEmail} (§3.1).
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
	 * Selbstregistrierung, Schritt 2 aus §3.1.1.
	 *
	 * <p>Legt Konto und Portfolio an und verschickt beide Codes. Die Rolle kommt
	 * ausschliesslich aus der Domain der Hochschuladresse; eine Rollenangabe im
	 * Request gibt es seit Contract v41 nicht mehr (KAN-63), siehe
	 * {@link RegistrationService#register}.
	 */
	@SecurityRequirements
	@Operation(summary = "Registrieren und beide Codes anfordern",
			description = "Legt ein Konto im Status REGISTRATION_PENDING samt Portfolio an "
					+ "und verschickt je einen sechsstelligen Code an die private und an die "
					+ "Hochschuladresse. Die Rolle leitet der Server aus der Domain der "
					+ "hsbEmail ab (§3.1.1). Eine Anmeldung ist erst nach beiden "
					+ "Bestaetigungen moeglich.")
	@ApiResponse(responseCode = "201", description = "Konto angelegt, Codes unterwegs.")
	@ApiResponse(responseCode = "400",
			description = "Pflichtfeld fehlt, Passwort zu kurz oder HSB-Domain nicht "
					+ "anerkannt.")
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
					+ "Abschluss erkennt. Im Feld email steht die private Adresse, auch beim "
					+ "Zweck HSB_EMAIL: sie ist die Kennung des Kontos. Einzige Ausnahme ist "
					+ "der Zweck EMAIL_CHANGE (KAN-60): dort steht die neue Adresse, und das "
					+ "Einloesen macht sie zur Login-Kennung; ist sie inzwischen vergeben, "
					+ "antwortet der Endpoint mit 409.")
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

	// --- Passwort vergessen und zuruecksetzen (§6.1, KAN-43) ----------------
	// Liegen aus demselben Grund in diesem Controller wie die
	// Verifizierungs-Endpoints: gleicher Pfadpraefix, gleiche Fehlerabbildung,
	// derselbe 429-Handler weiter unten.

	/**
	 * Ruecksetzcode anfordern (§6.1).
	 *
	 * <p><strong>204 ohne Inhalt, und zwar immer.</strong> Ob es die Adresse
	 * gibt und ob eine Mail rausging, ist von aussen nicht zu unterscheiden;
	 * sonst waere der Endpoint ein Verzeichnis registrierter Adressen. Vom
	 * Passwortzwang-Gate (§6.7) ist der Pfad ausgenommen, sonst kaeme ein Konto
	 * mit vergessenem Initialpasswort hier nie an.
	 */
	@SecurityRequirements
	@Operation(summary = "Ruecksetzcode anfordern",
			description = "Erzeugt einen sechsstelligen Code mit Zweck PASSWORD_RESET, "
					+ "verschickt ihn an die private Adresse und entwertet einen etwaigen "
					+ "vorherigen. Antwortet immer mit 204, auch fuer unbekannte Adressen: "
					+ "eine unterscheidbare Antwort waere ein Verzeichnis registrierter "
					+ "Adressen (§6.1). Gezaehlt wird jeder Aufruf, sonst waere der Endpoint "
					+ "ein Versandgenerator.")
	@ApiResponse(responseCode = "204", description = "Angenommen. Ob eine Mail rausging, sagt die Antwort nicht.")
	@ApiResponse(responseCode = "400", description = "E-Mail-Adresse fehlt oder ist keine gueltige Adresse.")
	@ApiResponse(responseCode = "429", description = "Zu viele Anforderungen, voruebergehend gesperrt.")
	@PostMapping("/forgot-password")
	public ResponseEntity<Void> forgotPassword(
			@Valid @RequestBody ForgotPasswordRequest forgotPasswordRequest, HttpServletRequest request) {
		passwordResetService.requestReset(forgotPasswordRequest, clientIp(request));
		return ResponseEntity.noContent().build();
	}

	/**
	 * Ruecksetzcode einloesen und neues Passwort setzen (§6.1).
	 *
	 * <p><strong>200 ohne Body</strong>, wie {@code PUT /auth/password}: der
	 * Client braucht nach der Aenderung keine Daten, die Anmeldung laeuft
	 * ohnehin ueber {@code POST /auth/login}.
	 */
	@SecurityRequirements
	@Operation(summary = "Passwort mit Ruecksetzcode neu setzen",
			description = "Prueft den Code mit Zweck PASSWORD_RESET, setzt den neuen "
					+ "BCrypt-Hash, verbraucht den Code und setzt passwordChangeRequired "
					+ "zurueck. Unbekannte Adresse, falscher, abgelaufener und bereits "
					+ "verbrauchter Code ergeben dieselbe Antwort (§6.1).")
	@ApiResponse(responseCode = "200", description = "Passwort gesetzt, ohne Body.")
	// Bewusst dieselbe Antwort fuer unbekannte Adresse, falschen, abgelaufenen
	// und bereits verbrauchten Code (§6.1, §6.2).
	@ApiResponse(responseCode = "400", description = "Code ungueltig, abgelaufen oder bereits verwendet, "
			+ "oder das neue Passwort verletzt die Laengenregel.")
	@ApiResponse(responseCode = "429", description = "Zu viele Versuche, voruebergehend gesperrt.")
	@PostMapping("/reset-password")
	public ResponseEntity<Void> resetPassword(
			@Valid @RequestBody ResetPasswordRequest resetPasswordRequest, HttpServletRequest request) {
		passwordResetService.resetPassword(resetPasswordRequest, clientIp(request));
		return ResponseEntity.ok().build();
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

	/**
	 * Eigene Profildaten aendern (§6.1, KAN-44, KAN-60).
	 *
	 * <p>Vor- und Nachname wirken sofort. Eine abweichende private Adresse im
	 * Feld {@code email} stoesst den Wechselflow an: aktuelles Passwort
	 * verpflichtend, Code an die neue Adresse, gueltig erst nach
	 * {@code POST /auth/verify} mit Zweck {@code EMAIL_CHANGE}
	 * ({@link EmailChangeService}). Rolle und Status vergibt die
	 * Administration, {@code hsbEmail} bleibt unveraenderlich. Vom Gate der
	 * erzwungenen Passwortaenderung (§6.7) ist dieser Pfad <em>nicht</em>
	 * ausgenommen: die Ausnahmeliste im {@link JwtAuthenticationFilter}
	 * unterscheidet nach Methode und laesst nur {@code GET /auth/me} durch.
	 */
	@Operation(summary = "Eigene Profildaten aendern",
			description = "Aendert Vor- und Nachnamen der angemeldeten Person und antwortet "
					+ "wie GET /auth/me. Eine abweichende Adresse im Feld email stoesst den "
					+ "E-Mail-Wechsel an: currentPassword ist dann Pflicht, ein Code geht an "
					+ "die neue Adresse, und gueltig wird sie erst nach POST /auth/verify mit "
					+ "Zweck EMAIL_CHANGE; bis dahin nennt pendingEmail den laufenden Wechsel. "
					+ "Die aktuelle Adresse im Feld email bricht einen laufenden Wechsel ab. "
					+ "Unbekannte Felder im Body werden ignoriert (§6.1).")
	@ApiResponse(responseCode = "200", description = "Aktualisierte Benutzerdaten.")
	@ApiResponse(responseCode = "400", description = "Vor- oder Nachname fehlt oder ist zu lang, "
			+ "oder email ist keine gueltige Adresse.")
	@ApiResponse(responseCode = "401", description = "Kein brauchbares Token, oder beim "
			+ "Adresswechsel fehlt das aktuelle Passwort bzw. ist falsch.")
	@ApiResponse(responseCode = "409", description = "Die gewuenschte Adresse ist bereits vergeben.")
	@ApiResponse(responseCode = "429", description = "Zu viele Wechselversuche, voruebergehend gesperrt.")
	@PutMapping("/me")
	public UserResponse updateMe(@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
			@Valid @RequestBody ProfileUpdateRequest profileUpdateRequest, HttpServletRequest request) {
		return authService.updateProfile(authenticatedUser.getId(), profileUpdateRequest,
				clientIp(request));
	}

	/**
	 * Eigenes Passwort aendern (§6.1); loest die erzwungene Passwortaenderung
	 * aus §6.7 auf, deshalb ist der Endpoint vom Gate im
	 * {@link JwtAuthenticationFilter} ausgenommen.
	 *
	 * <p><strong>200 ohne Body:</strong> §6.1 nennt hier bewusst kein
	 * Antwortschema, anders als bei {@code PUT /auth/me}. Der Client braucht
	 * nach der Aenderung keine Daten; dass das Flag jetzt {@code false} ist,
	 * weiss er selbst. Entschieden in der Klaerungsrunde zu KAN-28.
	 */
	@Operation(summary = "Eigenes Passwort aendern",
			description = "Prueft das bisherige Passwort und setzt den neuen BCrypt-Hash. "
					+ "Setzt passwordChangeRequired zurueck und hebt damit die Sperre aus "
					+ "§6.7 auf. Wessen Passwort gemeint ist, bestimmt allein das Token.")
	@ApiResponse(responseCode = "200", description = "Passwort geaendert, ohne Body.")
	@ApiResponse(responseCode = "400", description = "Pflichtfeld fehlt oder neues Passwort verletzt die Laengenregel.")
	@ApiResponse(responseCode = "401", description = "Kein brauchbares Token, oder das aktuelle Passwort ist falsch.")
	@PutMapping("/password")
	public ResponseEntity<Void> changePassword(
			@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
			@Valid @RequestBody PasswordChangeRequest passwordChangeRequest) {
		authService.changePassword(authenticatedUser.getId(), passwordChangeRequest);
		return ResponseEntity.ok().build();
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

	/**
	 * Unterscheidet seit KAN-68 nach dem Status: ein Konto in
	 * {@code REGISTRATION_PENDING} erhaelt {@code REGISTRATION_NOT_COMPLETED},
	 * damit das Frontend den Wiedereinstieg in die Verifizierung anbieten kann
	 * (§6.2); ein deaktiviertes Konto bleibt bei {@code ACCOUNT_NOT_ACTIVE}
	 * ohne ein solches Angebot. Der {@link JwtAuthenticationFilter} bleibt
	 * unveraendert bei {@code ACCOUNT_NOT_ACTIVE}: ein Konto in
	 * {@code REGISTRATION_PENDING} besitzt kein Token, sein Filterfall betrifft
	 * nur zwischenzeitlich deaktivierte Konten.
	 */
	@ExceptionHandler(AuthService.AccountNotActiveException.class)
	public ResponseEntity<ApiError> handleAccountNotActive(
			AuthService.AccountNotActiveException ex, HttpServletRequest request) {
		String errorCode = ex.getStatus() == UserStatus.REGISTRATION_PENDING
				? ErrorCodes.REGISTRATION_NOT_COMPLETED
				: ErrorCodes.ACCOUNT_NOT_ACTIVE;
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError(
				Instant.now(),
				HttpStatus.UNAUTHORIZED.value(),
				errorCode,
				ex.getMessage(),
				request.getRequestURI()));
	}
}
