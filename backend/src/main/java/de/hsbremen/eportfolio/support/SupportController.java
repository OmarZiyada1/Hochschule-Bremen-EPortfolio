package de.hsbremen.eportfolio.support;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.error.ApiError;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.support.dto.SupportRequestCreateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Das oeffentliche Kontaktformular, {@code POST /api/support} (§6.1).
 *
 * <p><strong>Der einzige schreibende Endpoint, den §5 fuer PUBLIC
 * freigibt.</strong> Er ist zwangslaeufig offen: der haeufigste Support-Fall
 * ist „ich komme nicht hinein", und ein Formular hinter der Anmeldung hilft
 * genau dort nicht. An die Stelle der Anmeldung treten die Bremse aus §6.5 und
 * das versteckte Formularfeld aus §6.1; beides liegt im {@link SupportService}
 * beziehungsweise im {@link SupportRateLimitService}.
 *
 * <p><strong>Ein Token ist erlaubt, aber nicht noetig.</strong> Kommt eines mit,
 * wird das Konto in {@code submittedByUserId} vermerkt (§3.20); ohne Token
 * bleibt das Feld leer. {@code name} und {@code email} kommen in beiden Faellen
 * aus dem Formular: wer die Anmeldung mit der eigenen Adresse gerade nicht
 * schafft, muss eine erreichbare zweite nennen koennen.
 *
 * <p>Der Endpoint ist ausserdem vom Gate der erzwungenen Passwortaenderung
 * ausgenommen (§6.7, {@code JwtAuthenticationFilter}). Ohne diese Ausnahme
 * bekaeme ausgerechnet die im Initialpasswort feststeckende Person auf ihre
 * Hilfeanfrage ein 403, waehrend dieselbe Anfrage nach dem Abmelden durchginge.
 */
@RestController
@RequestMapping("/api/support")
@Tag(name = "Support", description = "Das oeffentliche Kontaktformular (§6.1). Ohne Anmeldung "
		+ "absendbar; die eingegangenen Anfragen verwaltet die Administration unter "
		+ "/api/admin/support.")
public class SupportController {

	private final SupportService supportService;

	public SupportController(SupportService supportService) {
		this.supportService = supportService;
	}

	@Operation(summary = "Support-Anfrage senden",
			description = "Nimmt eine Anfrage aus dem Kontaktformular entgegen und legt sie im "
					+ "Eingang der Administration ab (§3.20). Ohne Token absendbar; ein "
					+ "mitgeschicktes Token vermerkt das Konto in submittedByUserId. Der "
					+ "Server verschickt keine E-Mail, weder eine Bestaetigung noch eine "
					+ "Benachrichtigung: geantwortet wird ausserhalb der Anwendung.")
	@ApiResponse(responseCode = "201", description = "Die Anfrage ist eingegangen. Ohne Body: "
			+ "die absendende Person hat auf ihre eigene Anfrage keinen lesenden Zugriff (§5), "
			+ "eine Kennung waere damit eine Adresse ohne Ressource.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: ein Pflichtfeld fehlt "
			+ "oder verletzt eine Laengenregel aus §3.20.")
	@ApiResponse(responseCode = "429", description = "TOO_MANY_SUPPORT_REQUESTS: zu viele "
			+ "Einsendungen von dieser Adresse oder dieser IP (§6.5).")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public void create(
			@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
			@Valid @RequestBody SupportRequestCreateRequest request,
			HttpServletRequest httpRequest) {

		supportService.create(request, clientIp(httpRequest),
				authenticatedUser == null ? null : authenticatedUser.getId());
	}

	/**
	 * Bewusst {@code getRemoteAddr()} ohne Auswertung von
	 * {@code X-Forwarded-For}, wie im {@code AuthController}: der Header ist
	 * frei setzbar, und ihn ungeprueft auszuwerten machte die IP-Sperre mit
	 * jedem Request umgehbar (§6.5).
	 *
	 * <p>Seit Contract v97 (KAN-98) laeuft die Anwendung im Profil {@code prod}
	 * tatsaechlich hinter einem Reverse Proxy, und wie §6.5 es verlangt, ist das
	 * in der Rahmenkonfiguration geloest und nicht hier:
	 * {@code server.forward-headers-strategy: native} setzt die Adresse bereits
	 * vor dieser Methode um. Ausfuehrliche Begruendung samt Begleitbedingung im
	 * gleichnamigen Javadoc des {@code AuthController}.
	 */
	private static String clientIp(HttpServletRequest request) {
		return request.getRemoteAddr();
	}

	// --- Fehlerabbildung auf das Envelope aus §6.2 -------------------------
	// Liegt hier statt im GlobalExceptionHandler, wie schon die beiden
	// Auth-Ausnahmen: sie tritt ausserhalb dieses Moduls nicht auf.

	@ExceptionHandler(SupportService.TooManySupportRequestsException.class)
	public ResponseEntity<ApiError> handleTooManyRequests(
			SupportService.TooManySupportRequestsException ex, HttpServletRequest request) {

		return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(new ApiError(
				Instant.now(),
				HttpStatus.TOO_MANY_REQUESTS.value(),
				ErrorCodes.TOO_MANY_SUPPORT_REQUESTS,
				ex.getMessage(),
				request.getRequestURI()));
	}
}
