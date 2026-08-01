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
		return baue(HttpStatus.BAD_REQUEST, Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN, meldung, request);
	}

	/**
	 * Ein Query- oder Pfadparameter laesst sich nicht in den erwarteten Typ
	 * umwandeln, etwa {@code GET /api/studiengaenge?fakultaet=abc}.
	 *
	 * <p>Ohne diesen Handler beantwortet Spring den Fall mit seinem eigenen
	 * Standardkoerper — die API haette damit ein zweites Fehlerformat neben §6.2.
	 * Die Meldung nennt nur Parametername und erwarteten Typ und gibt bewusst
	 * nicht den Wert zurueck, den der Aufrufer geschickt hat: was ungeprueft
	 * hereinkommt, geht nicht ungeprueft wieder hinaus.
	 */
	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiFehler> behandleTypfehler(MethodArgumentTypeMismatchException ex,
			HttpServletRequest request) {
		Class<?> erwartet = ex.getRequiredType();
		String meldung = "Der Parameter \"" + ex.getName() + "\" hat nicht das erwartete Format"
				+ (erwartet == null ? "." : " (" + erwartet.getSimpleName() + ").");
		return baue(HttpStatus.BAD_REQUEST, Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN, meldung, request);
	}

	/**
	 * Optimistic-Locking-Konflikt am Projekt (§6.4): zwischen Laden und
	 * Speichern hat jemand anderes dieselbe Zeile geaendert, die
	 * {@code version} im Request passt also nicht mehr zum Stand in der
	 * Datenbank. Hibernate bricht den Schreibvorgang ab, Spring uebersetzt das
	 * in {@link ObjectOptimisticLockingFailureException}, und hier wird daraus
	 * 409 {@code PROJEKT_VERSION_KONFLIKT}.
	 *
	 * <p>Die Meldung ist bewusst fest verdrahtet und uebernimmt nicht
	 * {@code ex.getMessage()}: die Ausnahme nennt Entity-Klasse und
	 * Primaerschluessel, also Interna, die in keiner Antwort an den Client
	 * verloren haben. Was der Client braucht, ist ohnehin nur die
	 * Handlungsanweisung — neu laden und die Aenderung wiederholen.
	 */
	@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
	public ResponseEntity<ApiFehler> behandleVersionskonflikt(ObjectOptimisticLockingFailureException ex,
			HttpServletRequest request) {
		return baue(HttpStatus.CONFLICT, Fehlercodes.PROJEKT_VERSION_KONFLIKT,
				"Das Projekt wurde zwischenzeitlich von jemand anderem geaendert. "
						+ "Bitte neu laden und die Aenderung wiederholen.", request);
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
