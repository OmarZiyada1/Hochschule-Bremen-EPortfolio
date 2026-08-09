package de.hsbremen.eportfolio.common.error;

/**
 * Fehlercodes fuer das Envelope aus API-Contract §6.2.
 *
 * <p>Stand Contract v27 steht jede Konstante dieser Klasse auch in §6.2.
 * {@link #VALIDATION_FAILED} war bis v14 nur hier gefuehrt und wurde mit v15
 * nachgetragen (Tabelle „Fehlercodes Anfrageformat", Historieneintrag in §10).
 * {@link #PROJECT_NOT_FOUND} lag umgekehrt: er stand seit jeher in §6.2 und kam
 * mit KAN-16 hier dazu.
 *
 * <p>Die uebrigen Codes kamen jeweils mit ihrem Modul dazu:
 * {@link #PROJECT_STATUS_NOT_EDITABLE} mit KAN-17,
 * {@link #BLOCK_TYPE_UNKNOWN} und {@link #EMBED_PROVIDER_NOT_ALLOWED} mit
 * KAN-18, {@link #PROJECT_INCOMPLETE} und
 * {@link #PROJECT_STATUS_TRANSITION_INVALID} mit KAN-19,
 * {@link #RESOURCE_NOT_FOUND} mit KAN-20, {@link #VERIFICATION_CODE_INVALID}
 * und {@link #RESOURCE_IN_USE} mit KAN-26,
 * {@link #PASSWORD_CHANGE_REQUIRED} mit KAN-28, zuletzt
 * {@link #FILE_TYPE_NOT_ALLOWED} und {@link #FILE_TOO_LARGE} mit KAN-23.
 * Alle elf standen wie die uebrigen schon vorher in §6.2; eine neue
 * Contract-Version brauchte es fuer die Konstanten selbst nicht. Contract v25
 * hat bei {@link #FILE_TYPE_NOT_ALLOWED} nur den Ausloesertext um die
 * Signaturpruefung ergaenzt, der Code blieb derselbe. Ebenso KAN-25: die
 * Administrationsseite kommt mit den vorhandenen Codes aus, {@link #RESOURCE_IN_USE}
 * traegt dort mit der noch referenzierten Stammdaten-Zeile den dritten
 * Ausloeser, den §6.2 fuer ihn seit jeher nennt.
 *
 * <p>Zwei Codes sind dagegen mit KAN-24 <em>neu entstanden</em> und deshalb in
 * §6.2 nachgetragen worden (Contract v23): {@link #PROJECT_NOT_PUBLISHED} und
 * {@link #NOMINATION_ALREADY_DECIDED}. §3.11.1 verlangte fuer beide Faelle einen
 * 409, ohne einen Code zu nennen, und keiner der bis dahin gefuehrten 409er
 * beschreibt sie.
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
	 * 403: das Konto traegt ein administrativ gesetztes Initialpasswort und muss
	 * es zuerst aendern (§6.7). Der {@code JwtAuthenticationFilter} beantwortet
	 * damit jeden Request mit gesetztem Flag, ausser den fuenf Ausnahmen aus
	 * §6.7 ({@code PUT /auth/password}, {@code GET /auth/me},
	 * {@code POST /auth/logout}, {@code POST /auth/forgot-password},
	 * {@code POST /auth/reset-password}).
	 *
	 * <p><strong>Nicht zu verwechseln mit</strong> {@link #NO_PERMISSION}: beide
	 * sind 403, aber dieser Zustand ist von der Person selbst aufloesbar. Nur
	 * mit eigenem Code kann das Frontend zur Passwortseite umleiten, statt eine
	 * Fehlermeldung zu zeigen.
	 */
	public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";

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
	 * 400: der Dateityp eines Uploads ist nicht zugelassen (§3.15). Zwei
	 * Ausloeser, bewusst unter einem Code: der gemeldete MIME-Typ steht nicht
	 * in der Allowlist, oder die ersten Bytes der Datei passen nicht zur
	 * Signatur dieses Typs.
	 *
	 * <p><strong>Warum die Signatur mitentscheidet:</strong> der Content-Type
	 * eines Multipart-Teils ist ein Wert, den der Client frei setzt. Ohne die
	 * Pruefung am Inhalt genuegte ein umbenanntes Archiv mit
	 * {@code Content-Type: image/png}, um beliebige Bytes abzulegen, die das
	 * Portal anschliessend als Bild ausliefert. Fuer den Client ist die
	 * Antwort in beiden Faellen dieselbe: diese Datei nimmt das Portal so
	 * nicht an.
	 */
	public static final String FILE_TYPE_NOT_ALLOWED = "FILE_TYPE_NOT_ALLOWED";

	/**
	 * 400: die Datei ueberschreitet das Groessenlimit ihrer Verwendung
	 * (§3.15): 10 MB fuer Bilder, 25 MB fuer Audio und PDF.
	 *
	 * <p>Derselbe Code antwortet auch, wenn schon der Multipart-Filter den
	 * Upload abweist ({@code MaxUploadSizeExceededException} im
	 * {@code GlobalExceptionHandler}): fuer den Client ist es dieselbe
	 * Aussage, egal welche der beiden Schranken zuerst griff.
	 */
	public static final String FILE_TOO_LARGE = "FILE_TOO_LARGE";

	/**
	 * 400: der eingegebene Verifizierungscode passt nicht, ist abgelaufen oder
	 * wurde bereits verbraucht (§3.16). Gilt fuer die Registrierung (§3.1.1)
	 * ebenso wie spaeter fuer das Zuruecksetzen des Passworts (§6.1, KAN-43).
	 *
	 * <p><strong>Ein Code fuer alle drei Faelle, und das ist Absicht.</strong>
	 * Nach §6.1 antworten die Verifizierungs-Endpoints fuer bekannte und
	 * unbekannte Adressen identisch. Unterschiede zwischen „falsch",
	 * „abgelaufen" und „schon benutzt" waeren derselbe Bruch: aus „abgelaufen"
	 * liesse sich ablesen, dass es zu dieser Adresse ueberhaupt ein Konto mit
	 * offener Verifizierung gibt. Was die Person tun muss, ist in allen drei
	 * Faellen dasselbe, naemlich einen neuen Code anfordern.
	 *
	 * <p><strong>Nicht zu verwechseln mit</strong> {@link #VALIDATION_FAILED}:
	 * der greift, wenn die Anfrage formal unbrauchbar ist, etwa ohne Code oder
	 * mit einem Zweck, den dieser Endpoint nicht kennt.
	 */
	public static final String VERIFICATION_CODE_INVALID = "VERIFICATION_CODE_INVALID";

	/**
	 * 409: die Ressource ist bereits vergeben oder noch referenziert. §6.2 nennt
	 * drei Ausloeser, und seit KAN-25 sind alle drei umgesetzt. Der erste ist die
	 * bei der Registrierung bereits vergebene {@code email} oder
	 * {@code hsbEmail} (§6.1, KAN-26), der zweite die Top-10 (§3.11.1, KAN-24),
	 * dort gleich in drei Auspraegungen derselben Aussage „dieser Platz
	 * beziehungsweise dieses Projekt ist schon vergeben": eine zweite offene
	 * Nominierung zum selben Projekt, ein Projekt, das bereits in der Liste
	 * steht, und eine belegte Position beim Annehmen.
	 *
	 * <p>Der dritte ist die <strong>noch referenzierte Stammdaten-Zeile</strong>
	 * beim Loeschen ueber die Administrationsseite (§6.1, KAN-25): eine
	 * Kategorie mit anhaengenden Projekten, eine Fakultaet mit Studiengaengen
	 * oder Projekten, ein Studiengang mit Modulen oder Projekten, ein Modul mit
	 * Projekten. Denselben Code traegt dort auch der bereits vergebene
	 * eindeutige Wert ({@code category.name}, {@code faculty.abbreviation}),
	 * weil er dieselbe Aussage macht wie die vergebene Adresse bei der
	 * Registrierung: der Wert ist in Ordnung, nur schon in Gebrauch
	 * (Contract v26).
	 *
	 * <p><strong>Nicht zu verwechseln mit</strong>
	 * {@link #NOMINATION_ALREADY_DECIDED}: dort ist nicht der Platz belegt,
	 * sondern die Entscheidung schon gefallen. Beide sind 409, verlangen vom
	 * Client aber Verschiedenes (anderen Platz waehlen gegenueber neu laden).
	 *
	 * <p><strong>Warum die Registrierung hier eine Existenz preisgibt</strong>,
	 * obwohl §6.1 sonst generisch antwortet: beide Adressen sind eindeutig
	 * (§3.1), eine zweite Registrierung darauf muss also scheitern, und der Grund
	 * muss benennbar sein. Sonst steht die Person vor einem Fehler, den sie nicht
	 * aufloesen kann. Diese Offenlegung ist bei jedem System mit
	 * Selbstregistrierung unvermeidbar und wird deshalb getragen.
	 */
	public static final String RESOURCE_IN_USE = "RESOURCE_IN_USE";

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

	/**
	 * 409: die Aktion setzt ein veroeffentlichtes Projekt voraus, das Projekt
	 * steht aber in einem anderen Status (§2.2).
	 *
	 * <p>Ausloeser ist §3.11.1 Regel 1: nur Projekte im Status {@code PUBLISHED}
	 * sind fuer die Top-10 nominierbar, und nur ein solches darf ueber
	 * {@code POST /api/admin/top10-nominations/{id}/accept} in die Liste kommen.
	 * Die Top-10 erscheint auf der oeffentlichen Startseite; ein Entwurf dort
	 * waere ein Sichtbarkeitsleck, das die gesamte Statuslogik unterlaeuft.
	 *
	 * <p><strong>Warum ein eigener Code und nicht
	 * {@link #PROJECT_STATUS_NOT_EDITABLE}:</strong> dieser sagt nach §4.1 „der
	 * Inhalt darf im aktuellen Status nicht geaendert werden". Hier wird gar
	 * nichts am Projekt geaendert; verlangt wird eine Eigenschaft, die es gerade
	 * nicht hat. Der Client muss die beiden auseinanderhalten koennen, weil die
	 * eine Meldung „erst veroeffentlichen" heisst und die andere „nicht mehr
	 * bearbeitbar".
	 *
	 * <p>Vergeben mit KAN-24, nachgetragen in §6.2 mit Contract v23.
	 */
	public static final String PROJECT_NOT_PUBLISHED = "PROJECT_NOT_PUBLISHED";

	/**
	 * 409: ueber diese Top-10-Nominierung ist bereits entschieden worden, ihr
	 * {@code status} ist also nicht mehr {@code PENDING} (§2.8).
	 *
	 * <p>Der haeufigste Weg hierher ist derselbe wie bei
	 * {@link #PROJECT_STATUS_TRANSITION_INVALID}: ein zweiter Klick auf denselben
	 * Knopf, ein zweiter offener Tab oder eine Admin-Ansicht, die den Stand noch
	 * veraltet zeigt. Die Antwort ist deshalb kein stilles Ueberschreiben,
	 * sondern die Aufforderung neu zu laden: das Entscheidungsprotokoll aus §3.11
	 * haelt fest, wer wann entschieden hat, und das bliebe von einer zweiten
	 * Entscheidung nicht uebrig.
	 *
	 * <p>Vergeben mit KAN-24, nachgetragen in §6.2 mit Contract v23.
	 */
	public static final String NOMINATION_ALREADY_DECIDED = "NOMINATION_ALREADY_DECIDED";

	private ErrorCodes() {
		// Nur Konstanten.
	}
}
