package de.hsbremen.eportfolio.common.error;

/**
 * Fehlercodes fuer das Envelope aus API-Contract §6.2.
 *
 * <p>Stand Contract v18 steht jede Konstante dieser Klasse auch in §6.2.
 * {@link #VALIDATION_FAILED} war bis v14 nur hier gefuehrt und wurde mit v15
 * nachgetragen (Tabelle „Fehlercodes Anfrageformat", Historieneintrag in §10).
 * {@link #PROJECT_NOT_FOUND} lag umgekehrt: er stand seit jeher in §6.2 und kam
 * mit KAN-16 hier dazu.
 *
 * <p>Umgekehrt fuehrt §6.2 Codes, die hier noch fehlen: die Block- und
 * Datei-Codes, {@code PROJECT_INCOMPLETE}, {@code RESOURCE_NOT_FOUND}, die
 * beiden {@code PROJECT_STATUS_*}-Konflikte, {@code RESOURCE_IN_USE},
 * {@code PASSWORD_CHANGE_REQUIRED} und seit v17
 * {@code VERIFICATION_CODE_INVALID}. Sie kommen mit dem jeweiligen Modul dazu;
 * das ist keine Abweichung, sondern der noch offene Umsetzungsstand aus §8.
 */
public final class ErrorCodes {

	/** 401: gar kein Token mitgeschickt. */
	public static final String NOT_AUTHENTICATED = "NOT_AUTHENTICATED";

	/** 401: Token vorhanden, aber Signatur oder Aufbau stimmen nicht. */
	public static final String TOKEN_INVALID = "TOKEN_INVALID";

	/** 401: Token war gueltig, ist aber abgelaufen. */
	public static final String TOKEN_EXPIRED = "TOKEN_EXPIRED";

	/** 401: E-Mail oder Passwort falsch. Bewusst ohne Unterscheidung. */
	public static final String LOGIN_FAILED = "LOGIN_FAILED";

	/** 401: Konto nicht ACTIVE (REGISTRATION_PENDING oder DEACTIVATED), §2.9. */
	public static final String ACCOUNT_NOT_ACTIVE = "ACCOUNT_NOT_ACTIVE";

	/**
	 * 429: zu viele fehlgeschlagene Anmeldeversuche fuer diese E-Mail-Adresse
	 * oder diese IP. Die Meldung bleibt bewusst generisch und nennt keine
	 * Restzeit, damit sie nicht bestaetigt, dass es das Konto gibt.
	 */
	public static final String TOO_MANY_LOGIN_ATTEMPTS = "TOO_MANY_LOGIN_ATTEMPTS";

	/** 403: angemeldet, aber die Rechtematrix (§5) erlaubt die Aktion nicht. */
	public static final String NO_PERMISSION = "NO_PERMISSION";

	/**
	 * 400: die Anfrage ist formal unbrauchbar. Bean-Validation an einem
	 * Request-Body schlaegt fehl oder ein Parameter hat nicht den erwarteten Typ
	 * (z. B. {@code ?faculty=abc}, wo eine UUID stehen muss).
	 *
	 * <p>Der Code wurde im {@code GlobalExceptionHandler} bereits als Literal
	 * benutzt und steht jetzt hier, damit er nicht an zwei Stellen auseinander
	 * laufen kann. Wie die uebrigen Codes ist er in §6.2 nachzutragen.
	 */
	public static final String VALIDATION_FAILED = "VALIDATION_FAILED";

	/**
	 * 404: unter dieser ID gibt es kein Projekt.
	 *
	 * <p>Wird auch dann geliefert, wenn die anfragende Person das Projekt gar
	 * nicht lesen duerfte: die Existenz einer Ressource wird nach §6.3.1 nicht
	 * verschleiert. Ein vorhandenes Projekt ohne Leserecht ergibt stattdessen
	 * 403 {@link #NO_PERMISSION} bzw. 401 {@link #NOT_AUTHENTICATED}.
	 */
	public static final String PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND";

	/**
	 * 400: ein Inhaltsblock passt nicht zum Block-Schema aus §2.5. Der Typ passt
	 * nicht zu {@code content.type}, ein typabhaengiges Pflichtfeld fehlt, oder
	 * die Provider-Allowlist fuer VIDEO und EMBED greift.
	 *
	 * <p>Der {@code BlockValidationService} fuehrte den Code bis KAN-49 als
	 * eigenes Literal {@code BLOCK_UNGUELTIG}, das es in §6.2 nie gab. Er heisst
	 * jetzt wie dort und steht wie jeder andere Code an dieser einen Stelle.
	 */
	public static final String BLOCK_CONTENT_INVALID = "BLOCK_CONTENT_INVALID";

	/**
	 * 409: das Projekt wurde zwischen Laden und Speichern von jemand anderem
	 * geaendert (Optimistic Locking, §6.4). Der Client laedt neu und meldet den
	 * Konflikt, statt fremde Arbeit zu ueberschreiben.
	 */
	public static final String PROJECT_VERSION_CONFLICT = "PROJECT_VERSION_CONFLICT";

	private ErrorCodes() {
		// Nur Konstanten.
	}
}
