package de.hsbremen.eportfolio.common.error;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Bildet Ausnahmen auf das einheitliche Fehler-Envelope ab (API-Contract §6.2).
 *
 * <p>Fehler, die bereits in den Security-Filtern auftreten, erreichen diesen
 * Handler nicht — dafuer gibt es {@code RestAuthentifizierungsEinstieg} und
 * {@code RestZugriffVerweigertHandler}, die denselben {@link ApiFehlerSchreiber}
 * benutzen. Beide Wege muessen dasselbe Format liefern.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ValidierungException.class)
	public ResponseEntity<ApiFehler> behandleValidierung(ValidierungException ex, HttpServletRequest request) {
		return baue(HttpStatus.BAD_REQUEST, ex.getFehlercode(), ex.getMessage(), request);
	}

	/** Bean-Validation an Request-Bodies, z. B. leeres Passwort beim Login. */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiFehler> behandleBeanValidierung(MethodArgumentNotValidException ex,
			HttpServletRequest request) {
		String meldung = ex.getBindingResult().getFieldErrors().stream()
				.map(fehler -> fehler.getField() + ": " + fehler.getDefaultMessage())
				.reduce((a, b) -> a + "; " + b)
				.orElse("Die Anfrage ist ungueltig.");
		return baue(HttpStatus.BAD_REQUEST, "VALIDIERUNG_FEHLGESCHLAGEN", meldung, request);
	}

	/**
	 * Greift, wenn die Autorisierung erst in der Methodensicherheit
	 * ({@code @PreAuthorize}) scheitert — also nach den Filtern.
	 */
	@ExceptionHandler(AccessDeniedException.class)
	public ResponseEntity<ApiFehler> behandleZugriffVerweigert(AccessDeniedException ex,
			HttpServletRequest request) {
		return baue(HttpStatus.FORBIDDEN, Fehlercodes.KEINE_BERECHTIGUNG,
				"Fuer diese Aktion fehlt die Berechtigung.", request);
	}

	@ExceptionHandler(AuthenticationException.class)
	public ResponseEntity<ApiFehler> behandleAuthentifizierung(AuthenticationException ex,
			HttpServletRequest request) {
		return baue(HttpStatus.UNAUTHORIZED, Fehlercodes.NICHT_AUTHENTIFIZIERT,
				"Anmeldung erforderlich.", request);
	}

	private ResponseEntity<ApiFehler> baue(HttpStatus status, String fehlercode, String meldung,
			HttpServletRequest request) {
		ApiFehler fehler = new ApiFehler(
				Instant.now(),
				status.value(),
				fehlercode,
				meldung,
				request.getRequestURI());
		return ResponseEntity.status(status).body(fehler);
	}
}
