package de.hsbremen.eportfolio.common.error;

/**
 * Die Anfrage ist formal richtig, passt aber nicht zum aktuellen Zustand der
 * Ressource. Wird vom {@link GlobalExceptionHandler} auf HTTP 409 mit dem
 * Envelope aus API-Contract §6.2 abgebildet.
 *
 * <p>Der Fehlercode ist ein Feld und nicht fest verdrahtet, weil §6.2 vier
 * verschiedene 409er kennt: {@code PROJECT_VERSION_CONFLICT},
 * {@code PROJECT_STATUS_NOT_EDITABLE}, {@code PROJECT_STATUS_TRANSITION_INVALID}
 * und {@code RESOURCE_IN_USE}. Dieselbe Ueberlegung wie bei
 * {@link ResourceNotFoundException}: eine Ausnahmeklasse je Code waere derselbe
 * Ablauf in vier Klassen.
 *
 * <p><strong>Abgrenzung zu 400:</strong> {@link ValidationException} meint „die
 * Anfrage selbst ist unbrauchbar" (fehlendes Pflichtfeld, unbekannte ID im
 * Body). Diese Ausnahme meint „die Anfrage waere brauchbar, nur nicht jetzt".
 * Der Unterschied ist fuer den Client entscheidend: einen 400 behebt er, indem
 * er die Eingabe korrigiert, einen 409, indem er neu laedt oder wartet.
 */
public class ConflictException extends RuntimeException {

	/**
	 * Wortlaut fuer den Versionskonflikt, an einer Stelle gefuehrt.
	 *
	 * <p>Der Konflikt kann auf zwei Wegen entstehen: durch die ausdrueckliche
	 * Pruefung von {@code version} im {@code ProjectWriteService} und durch
	 * Hibernate selbst, wenn zwei Transaktionen dieselbe Zeile schreiben (§6.4).
	 * Beide Wege muessen dieselbe Antwort liefern, sonst haengt der Text am
	 * Zufall der Taktung.
	 */
	public static final String VERSION_CONFLICT_MESSAGE =
			"Das Projekt wurde zwischenzeitlich von jemand anderem geaendert. "
					+ "Bitte neu laden und die Aenderung wiederholen.";

	private final String errorCode;

	public ConflictException(String errorCode, String message) {
		super(message);
		this.errorCode = errorCode;
	}

	/**
	 * Die mitgeschickte {@code version} passt nicht mehr zum Stand in der
	 * Datenbank (§6.4).
	 */
	public static ConflictException versionConflict() {
		return new ConflictException(ErrorCodes.PROJECT_VERSION_CONFLICT, VERSION_CONFLICT_MESSAGE);
	}

	/**
	 * Inhalts- oder Metadatenaenderung in einem Status, der das nicht mehr
	 * zulaesst (§4.1: nur {@code DRAFT} und {@code REVISION}).
	 */
	public static ConflictException statusNotEditable(String status) {
		return new ConflictException(ErrorCodes.PROJECT_STATUS_NOT_EDITABLE,
				"Ein Projekt im Status " + status + " kann nicht mehr bearbeitet werden. "
						+ "Aenderungen sind nur in DRAFT und REVISION moeglich.");
	}

	public String getErrorCode() {
		return errorCode;
	}
}
