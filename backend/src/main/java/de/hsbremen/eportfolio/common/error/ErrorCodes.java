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
 * <p>Umgekehrt fuehrt §6.2 Codes, die hier noch fehlen: die Datei-Codes,
 * {@code RESOURCE_IN_USE}, {@code PASSWORD_CHANGE_REQUIRED} und seit v17
 * {@code VERIFICATION_CODE_INVALID}. Sie kommen mit dem jeweiligen Modul dazu;
 * das ist keine Abweichung, sondern der noch offene Umsetzungsstand aus §8.
 * {@link #PROJECT_STATUS_NOT_EDITABLE} kam mit KAN-17 dazu,
 * {@link #BLOCK_TYPE_UNKNOWN} und {@link #EMBED_PROVIDER_NOT_ALLOWED} mit
 * KAN-18, {@link #PROJECT_INCOMPLETE} und
 * {@link #PROJECT_STATUS_TRANSITION_INVALID} mit KAN-19,
 * {@link #RESOURCE_NOT_FOUND} mit KAN-20. Alle sechs standen wie die uebrigen
 * schon vorher in §6.2; eine neue Contract-Version braucht es dafuer nicht.
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
	 * 404: die adressierte Ressource existiert nicht. §6.2 fuehrt ihn als den
	 * generischen 404 fuer Stammdaten, Kommentare, Dateien und User, also fuer
	 * alles ausser dem Projekt mit seinem eigenen {@link #PROJECT_NOT_FOUND}.
	 *
	 * <p>Wie dort gilt §6.3.1: der Code sagt „gibt es nicht" und maskiert kein
	 * fehlendes Recht. Ein vorhandener Kommentar, den die anfragende Person nicht
	 * aendern darf, ergibt 403 {@link #NO_PERMISSION}.
	 *
	 * <p>Der Code stand seit jeher in §6.2 und kam mit KAN-20 hier dazu, weil die
	 * Kommentar-Endpoints die erste Ressource ausser dem Projekt sind, die
	 * einzeln adressiert wird.
	 */
	public static final String RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND";

	/**
	 * 400: der Wert im Feld {@code type} eines Inhaltsblocks steht nicht in der
	 * Liste aus §2.5.
	 *
	 * <p><strong>Warum {@code BlockRequest.type} deshalb ein {@code String}
	 * ist</strong> und kein {@code BlockType}: als Enum scheiterte ein
	 * unbekannter Wert schon an der JSON-Umwandlung, also bevor fachlicher Code
	 * laeuft. Der Client bekaeme dann {@link #VALIDATION_FAILED} und koennte
	 * einen vertippten Blocktyp nicht von einem kaputten Body unterscheiden,
	 * obwohl §6.2 fuer beides verschiedene Codes fuehrt.
	 *
	 * <p><strong>Nicht zu verwechseln mit</strong> {@link #BLOCK_CONTENT_INVALID}:
	 * dort ist der Typ bekannt und der Inhalt passt nicht dazu.
	 */
	public static final String BLOCK_TYPE_UNKNOWN = "BLOCK_TYPE_UNKNOWN";

	/**
	 * 400: ein Inhaltsblock passt nicht zum Block-Schema aus §2.5. Der Typ passt
	 * nicht zu {@code content.type} oder ein typabhaengiges Pflichtfeld fehlt.
	 *
	 * <p>Der {@code BlockValidationService} fuehrte den Code bis KAN-49 als
	 * eigenes Literal {@code BLOCK_UNGUELTIG}, das es in §6.2 nie gab. Er heisst
	 * jetzt wie dort und steht wie jeder andere Code an dieser einen Stelle. Bis
	 * KAN-18 beantwortete er zusaetzlich die Provider-Allowlist; dafuer fuehrt
	 * §6.2 mit {@link #EMBED_PROVIDER_NOT_ALLOWED} einen eigenen Code.
	 */
	public static final String BLOCK_CONTENT_INVALID = "BLOCK_CONTENT_INVALID";

	/**
	 * 400: der Provider eines VIDEO- oder EMBED-Blocks steht nicht in der
	 * Allowlist aus §2.5 ({@code youtube}, {@code vimeo}, {@code figma},
	 * {@code codepen}, {@code gist}), oder der Host der {@code embedUrl} gehoert
	 * nicht zum angegebenen Provider.
	 *
	 * <p><strong>Warum ein eigener Code neben
	 * {@link #BLOCK_CONTENT_INVALID}:</strong> die beiden verlangen von der
	 * Person am Editor Verschiedenes. Ein ungueltiger Inhalt ist ein Fehler im
	 * Dokument, eine gesperrte Quelle dagegen eine Aussage darueber, was das
	 * Portal ueberhaupt einbettet. Nur mit eigenem Code kann das Frontend „diese
	 * Quelle ist hier nicht erlaubt" statt „der Block ist kaputt" melden.
	 */
	public static final String EMBED_PROVIDER_NOT_ALLOWED = "EMBED_PROVIDER_NOT_ALLOWED";

	/**
	 * 400: beim Einreichen fehlt mindestens eines der Pflichtfelder aus §3.3
	 * ({@code projectType}, {@code facultyId}, {@code studyProgramId},
	 * {@code degree}, {@code categoryId}, {@code semester}).
	 *
	 * <p><strong>Warum die Pruefung erst hier greift und nicht im Entwurf:</strong>
	 * ein {@code DRAFT} ist ein Arbeitszustand. Vollstaendigkeit schon beim ersten
	 * Speichern zu verlangen hiesse, dass niemand mit dem Schreiben anfangen kann,
	 * bevor alle Rahmendaten feststehen (§3.3). Die Meldung nennt deshalb die
	 * fehlenden Felder namentlich: der Editor soll sie anzeigen koennen, ohne sie
	 * selbst zu ermitteln.
	 */
	public static final String PROJECT_INCOMPLETE = "PROJECT_INCOMPLETE";

	/**
	 * 409: das Projekt wurde zwischen Laden und Speichern von jemand anderem
	 * geaendert (Optimistic Locking, §6.4). Der Client laedt neu und meldet den
	 * Konflikt, statt fremde Arbeit zu ueberschreiben.
	 */
	public static final String PROJECT_VERSION_CONFLICT = "PROJECT_VERSION_CONFLICT";

	/**
	 * 409: das Projekt steht in einem Status, in dem sein Inhalt nicht mehr
	 * geaendert werden darf. Nach §4.1 sind das alle ausser {@code DRAFT} und
	 * {@code REVISION}.
	 *
	 * <p><strong>Nicht zu verwechseln mit</strong>
	 * {@link #PROJECT_STATUS_TRANSITION_INVALID} (§4.1): dort ist der
	 * <em>Uebergang</em> unzulaessig, etwa DRAFT direkt nach PUBLISHED. Hier ist
	 * der Uebergang gar nicht gemeint, sondern die Bearbeitung im aktuellen
	 * Zustand.
	 */
	public static final String PROJECT_STATUS_NOT_EDITABLE = "PROJECT_STATUS_NOT_EDITABLE";

	/**
	 * 409: der angeforderte Statusuebergang steht nicht in der Tabelle aus §4.1,
	 * etwa {@code DRAFT} direkt nach {@code PUBLISHED} oder ein zweites
	 * Genehmigen desselben Projekts.
	 *
	 * <p><strong>Nicht zu verwechseln mit</strong>
	 * {@link #PROJECT_STATUS_NOT_EDITABLE}: dort geht es um eine Aenderung am
	 * <em>Inhalt</em> in einem gesperrten Status, hier um den Wechsel des Status
	 * selbst. Der Contract weist in §4.1 ausdruecklich darauf hin, die beiden beim
	 * Implementieren nicht zu vertauschen; fuer das Frontend sind sie zwei
	 * verschiedene Meldungen („bitte neu laden" gegenueber „das Projekt ist nicht
	 * mehr bearbeitbar").
	 *
	 * <p><strong>Er ist auch die Antwort auf einen doppelten Klick.</strong> Weil
	 * die Workflow-Endpoints ohne {@code version} arbeiten, ist der Vorzustand aus
	 * §4.1 die Sperre gegen den zweiten, gleichlautenden Aufruf: der erste bewegt
	 * das Projekt aus dem erwarteten Status heraus, der zweite findet ihn nicht
	 * mehr vor.
	 */
	public static final String PROJECT_STATUS_TRANSITION_INVALID =
			"PROJECT_STATUS_TRANSITION_INVALID";

	private ErrorCodes() {
		// Nur Konstanten.
	}
}
