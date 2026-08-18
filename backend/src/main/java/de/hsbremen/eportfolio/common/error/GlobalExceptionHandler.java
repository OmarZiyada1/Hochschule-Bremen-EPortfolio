package de.hsbremen.eportfolio.common.error;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * Bildet Ausnahmen auf das einheitliche Fehler-Envelope ab (API-Contract §6.2).
 *
 * <p>Fehler, die bereits in den Security-Filtern auftreten, erreichen diesen
 * Handler nicht. Dafuer gibt es {@code RestAuthenticationEntryPoint} und
 * {@code RestAccessDeniedHandler}, die denselben {@link ApiErrorWriter}
 * benutzen. Beide Wege muessen dasselbe Format liefern.
 *
 * <p><strong>Kein Weg fuehrt an §6.2 vorbei</strong> (KAN-55): Was keiner der
 * spezifischen Methoden zugeordnet ist, faengt
 * {@link #handleUnexpected(Exception, HttpServletRequest)} ab und beantwortet es
 * mit 500 {@code INTERNAL_ERROR}. Spring waehlt immer den spezifischsten
 * Handler, die bestehenden Zuordnungen bleiben davon also unberuehrt.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	/**
	 * Wortlaut jeder 500er-Antwort. Fest verdrahtet und ohne Ursache: was zur
	 * Fehlersuche taugt, steht im Protokoll, nicht in der Response.
	 */
	static final String INTERNAL_ERROR_MESSAGE = "Interner Fehler. Bitte spaeter erneut versuchen.";

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
	 * Der Request-Body laesst sich gar nicht erst lesen: kein oder kaputtes JSON,
	 * ein Wert, der nicht in das Zielfeld passt, ein fehlender Body bei einem
	 * {@code POST} oder {@code PUT}.
	 *
	 * <p>Ohne diesen Handler beantwortet Spring den Fall mit seinem eigenen
	 * Standardkoerper. Damit haette die API neben §6.2 ein zweites Fehlerformat,
	 * und zwar ausgerechnet an der Stelle, an der ein Client-Fehler am
	 * wahrscheinlichsten ist. Aufgefallen ist die Luecke bei den
	 * Block-Endpoints (KAN-18).
	 *
	 * <p>Die Meldung bleibt bewusst allgemein und gibt {@code ex.getMessage()}
	 * nicht weiter: Jackson nennt darin Klassennamen, Feldpfade und den Ausschnitt
	 * des eingeschickten Bodys, also Interna und ungeprueft hereingekommene
	 * Zeichen. Dieselbe Zurueckhaltung wie bei
	 * {@link #handleTypeMismatch(MethodArgumentTypeMismatchException, HttpServletRequest)}.
	 */
	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex,
			HttpServletRequest request) {
		return build(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
				"Der Request-Body fehlt oder ist kein gueltiges JSON in der erwarteten Form.",
				request);
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
	 * Der Multipart-Filter hat einen Upload schon vor dem Controller
	 * abgewiesen, weil er das Servlet-Limit aus
	 * {@code spring.servlet.multipart} ueberschreitet (KAN-23).
	 *
	 * <p>Das Servlet-Limit liegt bewusst oberhalb des groessten fachlichen
	 * Limits aus §3.15; wer hier landet, haette also auch die fachliche
	 * Pruefung nicht bestanden. Die Antwort ist deshalb dieselbe wie dort:
	 * 400 {@code FILE_TOO_LARGE} im Envelope aus §6.2, egal welche der beiden
	 * Schranken zuerst griff. Ohne diesen Handler antwortete Spring mit einem
	 * 500 in eigenem Format.
	 */
	@ExceptionHandler(MaxUploadSizeExceededException.class)
	public ResponseEntity<ApiError> handleUploadTooLarge(MaxUploadSizeExceededException ex,
			HttpServletRequest request) {
		return build(HttpStatus.BAD_REQUEST, ErrorCodes.FILE_TOO_LARGE,
				"Die Datei ueberschreitet das Groessenlimit (§3.15): hoechstens 10 MB fuer "
						+ "Bilder, 25 MB fuer Audio und PDF, 200 MB fuer Video.",
				request);
	}

	/**
	 * Der angeforderte Bereich einer Datei liegt jenseits ihrer Groesse
	 * (§3.15, KAN-72): 416 {@code FILE_RANGE_NOT_SATISFIABLE}.
	 *
	 * <p>Die Antwort traegt zusaetzlich zum Envelope aus §6.2 zwei Kopfzeilen.
	 * {@code Content-Range: bytes &#42;/&lt;size&gt;} verlangt RFC 9110 fuer
	 * jeden 416; erst damit kann der Client seine Rechnung korrigieren, ohne
	 * die Datei erneut anzufragen. {@code Accept-Ranges: bytes} steht wie bei
	 * jeder anderen Antwort des Datei-Endpoints daneben: der Bereichsabruf ist
	 * nicht deshalb ausgeschlossen, weil dieser eine misslang.
	 */
	@ExceptionHandler(RangeNotSatisfiableException.class)
	public ResponseEntity<ApiError> handleRangeNotSatisfiable(RangeNotSatisfiableException ex,
			HttpServletRequest request) {
		HttpHeaders headers = new HttpHeaders();
		headers.set(HttpHeaders.CONTENT_RANGE, "bytes */" + ex.getTotalSize());
		headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
		return build(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
				ErrorCodes.FILE_RANGE_NOT_SATISFIABLE, ex.getMessage(), headers, request);
	}

	/**
	 * Ein Pflicht-Teil eines Multipart-Requests fehlt, etwa ein
	 * {@code POST /api/files} ohne den Teil {@code file}.
	 *
	 * <p>Wie bei den uebrigen Formfehlern: ohne diesen Handler antwortete
	 * Spring in eigenem Format an §6.2 vorbei. Die Meldung nennt nur den
	 * Namen des fehlenden Teils, und der stammt aus der eigenen
	 * Controller-Signatur, nicht aus dem Request.
	 */
	@ExceptionHandler(MissingServletRequestPartException.class)
	public ResponseEntity<ApiError> handleMissingPart(MissingServletRequestPartException ex,
			HttpServletRequest request) {
		return build(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
				"Der Multipart-Teil \"" + ex.getRequestPartName() + "\" fehlt.", request);
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

	/**
	 * Auffang-Handler: was keine der Methoden oben kennt, wird trotzdem zu einer
	 * Antwort nach §6.2 (KAN-55). Ohne ihn beantwortete Spring einen
	 * unerwarteten Fehler mit seinem eigenen Standardkoerper, also ohne
	 * {@code errorCode}, und das Frontend haette an genau der Stelle ein zweites
	 * Fehlerformat, an der es ohnehin nichts mehr retten kann.
	 *
	 * <p>Aufgefallen ist die Luecke bei KAN-23: der Objektspeicher ist der erste
	 * Fremddienst im Request-Pfad, und eine {@code FileStorageException} lief bis
	 * zum Servlet-Container durch. Betroffen war aber jeder Endpoint.
	 *
	 * <p><strong>Die Antwort nennt die Ursache nicht.</strong> Weder
	 * {@code ex.getMessage()} noch der Klassenname gehen hinaus: Ausnahmetexte
	 * nennen Klassen, Pfade und bei Speicherfehlern den Speicherschluessel
	 * (§3.15.1). Stattdessen protokolliert der Handler die Ausnahme vollstaendig
	 * mit Stacktrace; die Zuordnung Protokollzeile zu Antwort laeuft ueber
	 * Zeitpunkt, Methode und Pfad, die in beiden stehen.
	 *
	 * <p><strong>Ausnahmen mit eigenem Statuscode behalten ihn.</strong> Der
	 * Handler traegt {@code Exception} und faengt damit auch die Faelle, die
	 * Spring selbst beantwortet: unbekannter Pfad (404), nicht zugelassene
	 * Methode (405), nicht unterstuetzter Content-Type (415). Sie alle tragen
	 * {@link ErrorResponse} und werden deshalb an
	 * {@link #frameworkError(Exception, ErrorResponse, HttpServletRequest)}
	 * weitergereicht, statt zu einem 500 zu werden. Ohne diese Abzweigung
	 * verdeckte der Auffang-Handler die Statuscodes des Rahmenwerks; aus einem
	 * 405 wuerde ein 500.
	 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
		if (ex instanceof ErrorResponse errorResponse) {
			return frameworkError(ex, errorResponse, request);
		}
		LOG.error("Unerwarteter Fehler bei {} {}", request.getMethod(), request.getRequestURI(), ex);
		return build(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR,
				INTERNAL_ERROR_MESSAGE, request);
	}

	/**
	 * Ausnahmen des Rahmenwerks, die ihren Statuscode selbst mitbringen: 404 fuer
	 * einen Pfad, den kein Controller bedient, 405 fuer eine nicht zugelassene
	 * Methode, 415 fuer einen Content-Type, den der Endpoint nicht liest.
	 *
	 * <p>Der Status bleibt der von Spring gesetzte, die Antwort ist aber das
	 * Envelope aus §6.2 und traegt einen der bereits gefuehrten Codes: 404 ergibt
	 * {@code RESOURCE_NOT_FOUND} wie jede andere nicht vorhandene Ressource, die
	 * uebrigen 4xx {@code VALIDATION_FAILED}, weil die Anfrage in dieser Form
	 * nicht bedient werden kann. Eigene Codes je Statuscode brauchte es dafuer
	 * nicht: der Statuscode steht im Envelope und sagt bereits, was nicht passt
	 * (Entscheidung zu KAN-55).
	 *
	 * <p>Die Header aus {@link ErrorResponse#getHeaders()} gehen mit hinaus. Bei
	 * 405 ist das {@code Allow} und bei 415 {@code Accept}; beide gehoeren nach
	 * RFC 9110 zur Antwort und sind das einzige maschinenlesbare Stueck, das der
	 * Client hier bekommt.
	 *
	 * <p>Die wenigen Rahmenfehler mit 5xx (etwa eine fehlende Pfadvariable in
	 * einer Controller-Signatur) sind Programmierfehler im Backend und laufen
	 * deshalb wie jeder unerwartete Fehler: 500 {@code INTERNAL_ERROR} und
	 * Stacktrace im Protokoll.
	 */
	private ResponseEntity<ApiError> frameworkError(Exception ex, ErrorResponse errorResponse,
			HttpServletRequest request) {
		HttpStatusCode status = errorResponse.getStatusCode();
		if (status.is5xxServerError()) {
			LOG.error("Unerwarteter Fehler bei {} {}", request.getMethod(),
					request.getRequestURI(), ex);
			return build(status, ErrorCodes.INTERNAL_ERROR, INTERNAL_ERROR_MESSAGE,
					errorResponse.getHeaders(), request);
		}

		// Ein Client-Fehler ist kein Betriebsvorfall: er gehoert nicht als
		// Fehlerzeile ins Protokoll, sondern hoechstens in die Fehlersuche.
		LOG.debug("Vom Rahmenwerk abgewiesen ({}): {} {}", status.value(), request.getMethod(),
				request.getRequestURI(), ex);

		boolean notFound = status.value() == HttpStatus.NOT_FOUND.value();
		return build(status,
				notFound ? ErrorCodes.RESOURCE_NOT_FOUND : ErrorCodes.VALIDATION_FAILED,
				notFound
						? "Die angeforderte Ressource existiert nicht."
						: "Die Anfrage ist in dieser Form nicht zulaessig.",
				errorResponse.getHeaders(), request);
	}

	private ResponseEntity<ApiError> build(HttpStatusCode status, String errorCode, String message,
			HttpServletRequest request) {
		return build(status, errorCode, message, HttpHeaders.EMPTY, request);
	}

	private ResponseEntity<ApiError> build(HttpStatusCode status, String errorCode, String message,
			HttpHeaders headers, HttpServletRequest request) {
		ApiError error = new ApiError(
				Instant.now(),
				status.value(),
				errorCode,
				message,
				request.getRequestURI());
		return ResponseEntity.status(status).headers(headers).body(error);
	}
}
