package de.hsbremen.eportfolio.common.error;

/**
 * Die Anfrage ist formal richtig, passt aber nicht zum aktuellen Zustand der
 * Ressource. Wird vom {@link GlobalExceptionHandler} auf HTTP 409 mit dem
 * Envelope aus API-Contract §6.2 abgebildet.
 *
 * <p>Der Fehlercode ist ein Feld und nicht fest verdrahtet, weil §6.2 acht
 * verschiedene 409er kennt: {@code PROJECT_VERSION_CONFLICT},
 * {@code PROJECT_STATUS_NOT_EDITABLE}, {@code PROJECT_STATUS_TRANSITION_INVALID},
 * {@code RESOURCE_IN_USE}, seit v23 {@code PROJECT_NOT_PUBLISHED} und
 * {@code NOMINATION_ALREADY_DECIDED}, seit v38 {@code CHANGE_REQUESTS_OPEN},
 * seit v85 {@code PROJECT_LOCKED_BY_OTHER}.
 * Dieselbe Ueberlegung wie bei
 * {@link ResourceNotFoundException}: eine Ausnahmeklasse je Code waere derselbe
 * Ablauf in acht Klassen.
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

	/**
	 * An diesem Projekt arbeitet gerade jemand anders (§6.9, seit Contract v85).
	 *
	 * <p><strong>Die einzige Fehlermeldung im Projekt, die einen Namen
	 * traegt.</strong> Ohne ihn waere die Auskunft wertlos: wer in einer
	 * Gruppenarbeit vor einer gesperrten Schreibflaeche sitzt, fragt nicht, ob
	 * gesperrt ist, sondern auf wen zu warten ist. Vertretbar ist das, weil
	 * bis hierher nur kommt, wer selbst zur Projektseite gehoert und die
	 * Beteiligten ohnehin sieht (§3.13); die Rechtepruefung des Schreibpfads
	 * laeuft vor dieser Ausnahme. Ein Konto ausserhalb des Projekts bekommt
	 * schon davor 403 und erfaehrt nichts.
	 *
	 * @param name Anzeigename der haltenden Person, aus Vor- und Nachnamen
	 */
	public static ConflictException lockedByOther(String name) {
		return new ConflictException(ErrorCodes.PROJECT_LOCKED_BY_OTHER,
				name + " bearbeitet diesen Beitrag gerade. Es kann immer nur eine Person "
						+ "gleichzeitig schreiben; die Sperre endet, sobald diese Person den "
						+ "Editor verlaesst.");
	}

	/**
	 * Das Abgeben der eigenen Redaktionszuweisung in einem Status, der es nicht
	 * zulaesst (§4.1, seit Contract v68: nur {@code SUBMITTED} und
	 * {@code REVISION}).
	 *
	 * <p><strong>Eigene Fabrik trotz gleichem Fehlercode.</strong> §6.2 deckt
	 * den Fall seit v68 ausdruecklich mit
	 * {@code PROJECT_STATUS_NOT_EDITABLE} ab, aber die Meldung von
	 * {@link #statusNotEditable} passt nicht: sie nennt {@code DRAFT} und
	 * {@code REVISION} als erlaubt, und im {@code DRAFT} laese sie sich sogar
	 * als Widerspruch („im Status DRAFT nicht bearbeitbar, erlaubt sind DRAFT
	 * und REVISION"). Beim Abgeben ist es genau umgekehrt: der {@code DRAFT}
	 * ist der eine Status, in dem es <em>nicht</em> geht, weil die Autor:in
	 * die Zuweisung dort selbst pflegt (§5 Fussnote 3).
	 *
	 * @param status Status, in dem das Projekt tatsaechlich steht
	 */
	public static ConflictException resignNotAllowed(String status) {
		return new ConflictException(ErrorCodes.PROJECT_STATUS_NOT_EDITABLE,
				"Die Redaktionszuweisung laesst sich im Status " + status + " nicht abgeben. "
						+ "Moeglich ist das nur in SUBMITTED und REVISION: im Entwurf pflegt "
						+ "die Autor:in die Zuweisung selbst, ab APPROVED ist die "
						+ "redaktionelle Arbeit getan.");
	}

	/**
	 * Der angeforderte Statusuebergang steht nicht in der Tabelle aus §4.1.
	 *
	 * <p>Die Meldung nennt den tatsaechlichen Status und die zulaessigen
	 * Ausgangsstatus. Beides weiss der Aufrufer in dem Moment gerade nicht, sonst
	 * haette er den Aufruf nicht abgeschickt: der haeufigste Weg hierher ist ein
	 * zweiter Klick auf denselben Knopf oder eine Ansicht, die den Status noch
	 * veraltet anzeigt.
	 *
	 * <p>Die Parameter sind Zeichenketten und nicht die Enums aus dem
	 * Projekt-Paket: dieses Paket haelt die feature-uebergreifende
	 * Fehlerbehandlung und kennt die Fachpakete nicht.
	 *
	 * @param actual         Status, in dem das Projekt tatsaechlich steht
	 * @param transition     Name des angeforderten Uebergangs (§4.1)
	 * @param allowedSources die dafuer zulaessigen Ausgangsstatus, lesbar
	 *                       aufgezaehlt
	 */
	public static ConflictException statusTransitionInvalid(String actual, String transition,
			String allowedSources) {

		return new ConflictException(ErrorCodes.PROJECT_STATUS_TRANSITION_INVALID,
				"Dieser Uebergang ist aus dem Status " + actual + " nicht vorgesehen (§4.1). "
						+ transition + " ist nur aus " + allowedSources + " heraus moeglich.");
	}

	/**
	 * Die Ressource ist bereits gebunden und laesst die Aktion deshalb nicht zu
	 * (§6.2, {@code RESOURCE_IN_USE}).
	 *
	 * <p>Die Meldung kommt von aussen, weil dieser Code sehr verschiedene Faelle
	 * traegt: eine belegte Top-10-Position, ein Projekt, das schon in der Liste
	 * steht, eine offene Nominierung desselben Projekts (§3.11.1) und spaeter das
	 * Loeschen einer noch referenzierten Stammdaten-Zeile. Eine gemeinsame
	 * Formulierung dafuer waere so allgemein, dass sie nichts mehr sagte;
	 * entschieden wird im Client ohnehin nach {@code errorCode} und nie nach dem
	 * Text (§6.2).
	 *
	 * <p><strong>Diese Fabrik baut den Code an einer Stelle</strong>, auch fuer
	 * {@link #addressInUse(String)}. Sonst stuenden zwei Konstruktoraufrufe mit
	 * demselben Code nebeneinander, und beim naechsten Ausloeser waere unklar,
	 * welchem der beiden man folgt.
	 *
	 * @param message was genau belegt ist, ohne ungeprueft hereingekommene Werte
	 */
	public static ConflictException resourceInUse(String message) {
		return new ConflictException(ErrorCodes.RESOURCE_IN_USE, message);
	}

	/**
	 * Bei der Registrierung ist eine der beiden Adressen bereits vergeben (§6.1,
	 * KAN-26).
	 *
	 * <p><strong>Die Meldung nennt das betroffene Feld</strong>, im selben Format
	 * wie die Bean-Validation im {@link GlobalExceptionHandler}
	 * ({@code "feld: Meldung"}), damit das Formular sie an die richtige Zeile
	 * haengen kann. Das ist an dieser einen Stelle bewusst mehr Auskunft, als die
	 * uebrigen Auth-Endpoints geben: beide Adressen sind eindeutig, eine zweite
	 * Registrierung darauf muss scheitern, und wer nicht erfaehrt <em>welche</em>
	 * der beiden schon vergeben ist, kann den Fehler nicht aufloesen.
	 *
	 * <p>Eigene Fabrik und nicht bloss ein Aufruf von
	 * {@link #resourceInUse(String)} an der Aufrufstelle: der Wortlaut ist an das
	 * Format des Formulars gebunden und gehoert deshalb an eine Stelle, nicht in
	 * die drei Zweige des Registrierungsdienstes.
	 *
	 * @param field {@code email} oder {@code hsbEmail}
	 */
	public static ConflictException addressInUse(String field) {
		return resourceInUse(field + ": Diese E-Mail-Adresse ist bereits registriert.");
	}

	/**
	 * Das Projekt laesst sich nicht einreichen, solange daran Aenderungswuensche
	 * im Status {@code OPEN} haengen (§2.4, {@code CHANGE_REQUESTS_OPEN}).
	 *
	 * <p><strong>Die Meldung nennt die Anzahl</strong> der offenen Punkte und
	 * nicht deren Inhalt: was zu tun ist, steht in den Kommentaren selbst, und
	 * die hat die Projektseite ohnehin vor sich. Die Zahl sagt ihr, ob sie einen
	 * Punkt uebersehen hat oder ob die Liste veraltet angezeigt wird.
	 *
	 * @param openCount Anzahl der Kommentare {@code CHANGE_REQUEST} im Status
	 *                  {@code OPEN} an diesem Projekt, groesser null
	 */
	public static ConflictException changeRequestsOpen(long openCount) {
		String countPhrase = openCount == 1
				? "haengt noch 1 offener Aenderungswunsch"
				: "haengen noch " + openCount + " offene Aenderungswuensche";
		return new ConflictException(ErrorCodes.CHANGE_REQUESTS_OPEN,
				"An diesem Projekt " + countPhrase + " (§2.4). "
						+ "Bitte erst alle Aenderungswuensche als erledigt markieren, "
						+ "dann erneut einreichen.");
	}

	/**
	 * Die Aktion setzt ein veroeffentlichtes Projekt voraus (§3.11.1 Regel 1),
	 * das Projekt steht aber in einem anderen Status.
	 *
	 * <p>Der Status wird als Zeichenkette uebergeben und nicht als Enum, aus
	 * demselben Grund wie bei {@link #statusTransitionInvalid}: dieses Paket haelt
	 * die feature-uebergreifende Fehlerbehandlung und kennt die Fachpakete nicht.
	 *
	 * @param actual Status, in dem das Projekt tatsaechlich steht
	 */
	public static ConflictException projectNotPublished(String actual) {
		return new ConflictException(ErrorCodes.PROJECT_NOT_PUBLISHED,
				"Dafuer muss das Projekt veroeffentlicht sein; es steht im Status " + actual
						+ " (§3.11.1).");
	}

	/**
	 * Ueber diese Nominierung ist bereits entschieden worden (§2.8, §3.11).
	 *
	 * <p>Die Meldung nennt den vorgefundenen Stand, weil der Aufrufer ihn in
	 * diesem Moment gerade nicht kennt: der haeufigste Weg hierher ist ein
	 * zweiter Klick oder eine veraltete Admin-Ansicht.
	 *
	 * @param actual Stand der Nominierung, {@code ACCEPTED} oder {@code REJECTED}
	 */
	public static ConflictException nominationAlreadyDecided(String actual) {
		return new ConflictException(ErrorCodes.NOMINATION_ALREADY_DECIDED,
				"Ueber diese Nominierung ist bereits entschieden worden (Stand: " + actual + "). "
						+ "Bitte neu laden.");
	}

	/**
	 * Diese Nominierung laesst sich nicht mehr zurueckziehen (§3.11.1, seit
	 * Contract v70).
	 *
	 * <p><strong>Derselbe Fehlercode wie bei der zweiten Entscheidung</strong>
	 * ({@link #nominationAlreadyDecided}), weil es derselbe Fall ist: ueber den
	 * Vorschlag ist bereits verfuegt worden. Eine eigene Konstante daneben
	 * traeuge nichts bei, was der Client anders behandeln muesste. Die Meldung
	 * unterscheidet sich trotzdem, denn hier ist {@code ACCEPTED} fuer die
	 * Administration <em>kein</em> Grund zur Abweisung, und ein Text, der das
	 * Gegenteil nahelegt, waere schlicht falsch.
	 *
	 * @param actual Stand der Nominierung, {@code ACCEPTED}, {@code REJECTED}
	 *               oder {@code WITHDRAWN}
	 */
	public static ConflictException nominationNotWithdrawable(String actual) {
		return new ConflictException(ErrorCodes.NOMINATION_ALREADY_DECIDED,
				"Diese Nominierung laesst sich nicht mehr zurueckziehen; sie steht auf "
						+ actual + ". Zurueckziehen laesst sich ein offener Vorschlag, die "
						+ "Administration zusaetzlich einen angenommenen (§3.11.1).");
	}

	public String getErrorCode() {
		return errorCode;
	}
}
