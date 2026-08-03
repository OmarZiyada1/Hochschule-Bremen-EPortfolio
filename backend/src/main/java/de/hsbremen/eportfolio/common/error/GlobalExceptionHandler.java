package de.hsbremen.eportfolio.common.error;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Bildet Ausnahmen auf das einheitliche Fehler-Envelope ab (API-Contract §6.2).
 *
 * <p>Fehler, die bereits in den Security-Filtern auftreten, erreichen diesen
 * Handler nicht. Dafuer gibt es {@code RestAuthenticationEntryPoint} und
 * {@code RestAccessDeniedHandler}, die denselben {@link ApiErrorWriter}
 * benutzen. Beide Wege muessen dasselbe Format liefern.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ValidationException.class)
	public ResponseEntity<ApiError> handleValidation(ValidationException ex, HttpServletRequest request) {
		return build(HttpStatus.BAD_REQUEST, ex.getErrorCode(), ex.getMessage(), request);
	}

	/** Bean-Validation an Request-Bodies, z. B. leeres Passwort beim Login. */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiError> handleBeanValidation(MethodArgumentNotValidException ex,
			HttpServletRequest request) {
		String message = ex.getBindingResult().getFieldErrors().stream()
				.map(error -> error.getField() + ": " + error.getDefaultMessage())
				.reduce((a, b) -> a + "; " + b)
				.orElse("Die Anfrage ist ungueltig.");
		return build(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, message, request);
	}

	/**
	 * Ein Query- oder Pfadparameter laesst sich nicht in den erwarteten Typ
	 * umwandeln, etwa {@code GET /api/study-programs?faculty=abc}.
	 *
	 * <p>Ohne diesen Handler beantwortet Spring den Fall mit seinem eigenen
	 * Standardkoerper; die API haette damit ein zweites Fehlerformat neben §6.2.
	 * Die Meldung nennt nur Parametername und erwarteten Typ und gibt bewusst
	 * nicht den Wert zurueck, den der Aufrufer geschickt hat: was ungeprueft
	 * hereinkommt, geht nicht ungeprueft wieder hinaus.
	 */
	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
			HttpServletRequest request) {
		Class<?> expected = ex.getRequiredType();
		String message = "Der Parameter \"" + ex.getName() + "\" hat nicht das erwartete Format"
				+ (expected == null ? "." : " (" + expected.getSimpleName() + ").");
		return build(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, message, request);
	}

	/**
	 * Die adressierte Ressource gibt es nicht (§6.3.1, erste Zeile).
	 *
	 * <p>Die Meldung nennt die angefragte ID. Das ist unbedenklich, weil der
	 * Aufrufer sie selbst geschickt hat, und es macht den haeufigsten
	 * Client-Fehler sofort erkennbar: eine vertippte oder veraltete ID.
	 */
	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex,
			HttpServletRequest request) {
		return build(HttpStatus.NOT_FOUND, ex.getErrorCode(), ex.getMessage(), request);
	}

	/**
	 * Fachlicher Konflikt mit dem Zustand der Ressource (§6.3, Zeile 409):
	 * Bearbeitung in einem gesperrten Status, unzulaessiger Statusuebergang,
	 * Versionskonflikt oder eine noch referenzierte Zeile. Welcher der vier
	 * Codes aus §6.2 es ist, entscheidet die Ausnahme selbst.
	 */
	@ExceptionHandler(ConflictException.class)
	public ResponseEntity<ApiError> handleConflict(ConflictException ex, HttpServletRequest request) {
		return build(HttpStatus.CONFLICT, ex.getErrorCode(), ex.getMessage(), request);
	}

	/**
	 * Optimistic-Locking-Konflikt am Projekt (§6.4): zwischen Laden und
	 * Speichern hat jemand anderes dieselbe Zeile geaendert, die
	 * {@code version} im Request passt also nicht mehr zum Stand in der
	 * Datenbank. Hibernate bricht den Schreibvorgang ab, Spring uebersetzt das
	 * in {@link ObjectOptimisticLockingFailureException}, und hier wird daraus
	 * 409 {@code PROJECT_VERSION_CONFLICT}.
	 *
	 * <p><strong>Zweiter Weg zum selben Code:</strong> der
	 * {@code ProjectWriteService} vergleicht die {@code version} aus dem Body
	 * schon vor dem Schreiben und wirft dabei
	 * {@link ConflictException#versionConflict()}. Dieser Handler bleibt
	 * trotzdem noetig, weil er den echten Wettlauf zweier gleichzeitiger
	 * Transaktionen abfaengt, den eine Pruefung im Anwendungscode
	 * grundsaetzlich nicht sehen kann. Beide Wege teilen sich den Wortlaut aus
	 * {@link ConflictException#VERSION_CONFLICT_MESSAGE}.
	 *
	 * <p>Die Meldung ist bewusst fest verdrahtet und uebernimmt nicht
	 * {@code ex.getMessage()}: die Ausnahme nennt Entity-Klasse und
	 * Primaerschluessel, also Interna, die in keiner Antwort an den Client
	 * verloren haben. Was der Client braucht, ist ohnehin nur die
	 * Handlungsanweisung: neu laden und die Aenderung wiederholen.
	 *
	 * <p><strong>Einschraenkung:</strong> die Methode fangt jede
	 * {@code ObjectOptimisticLockingFailureException} ab, nicht nur die von
	 * {@code Project}. Das stimmt, solange {@code Project} die einzige Entity
	 * mit {@code @Version} ist. Was bei einer zweiten zu tun ist, steht in
	 * {@code docs/ARCHITEKTUR.md} §8.
	 */
	@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
	public ResponseEntity<ApiError> handleVersionConflict(ObjectOptimisticLockingFailureException ex,
			HttpServletRequest request) {
		return build(HttpStatus.CONFLICT, ErrorCodes.PROJECT_VERSION_CONFLICT,
				ConflictException.VERSION_CONFLICT_MESSAGE, request);
	}

	/**
	 * Greift, wenn die Autorisierung erst in der Methodensicherheit
	 * ({@code @PreAuthorize}) scheitert, also nach den Filtern.
	 */
	@ExceptionHandler(AccessDeniedException.class)
	public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex,
			HttpServletRequest request) {
		return build(HttpStatus.FORBIDDEN, ErrorCodes.NO_PERMISSION,
				"Fuer diese Aktion fehlt die Berechtigung.", request);
	}

	@ExceptionHandler(AuthenticationException.class)
	public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex,
			HttpServletRequest request) {
		return build(HttpStatus.UNAUTHORIZED, ErrorCodes.NOT_AUTHENTICATED,
				"Anmeldung erforderlich.", request);
	}

	private ResponseEntity<ApiError> build(HttpStatus status, String errorCode, String message,
			HttpServletRequest request) {
		ApiError error = new ApiError(
				Instant.now(),
				status.value(),
				errorCode,
				message,
				request.getRequestURI());
		return ResponseEntity.status(status).body(error);
	}
}
