package de.hsbremen.eportfolio.admin;

import de.hsbremen.eportfolio.admin.dto.AdminPasswordResetResponse;
import de.hsbremen.eportfolio.admin.dto.AdminUserCreateRequest;
import de.hsbremen.eportfolio.admin.dto.AdminUserResponse;
import de.hsbremen.eportfolio.admin.dto.AdminUserUpdateRequest;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.EmailAddresses;
import de.hsbremen.eportfolio.auth.PasswordPolicy;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.config.RegistrationProperties;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die Nutzerverwaltung der Administrationsseite aus §6.1: Liste, Einzelabruf,
 * Anlage, Aenderung und Deaktivierung von Konten (KAN-25).
 *
 * <p><strong>Der einzige Ort, an dem {@code hsbEmail} fremder Konten
 * ausgegeben wird</strong> (§3.1), und zwar ueber {@code AdminUserResponse};
 * die eigene Adresse fuehren seit v50 auch die Auth-Antworten an die Person
 * selbst (KAN-69). Zur Begruendung und zur Trennung von
 * {@code auth.dto.UserResponse} siehe dort.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie in den uebrigen Diensten,
 * nach §6.3.1: laden (fehlt → 404 {@code RESOURCE_NOT_FOUND}) → Berechtigung
 * (nein → 403) → fachliche Regeln (nein → 400 oder 409) → schreiben. Praktisch
 * wird der Unterschied zwischen 404 und 403 hier nie sichtbar, weil die
 * Filterkette auf {@code /api/admin/**} ohnehin nur ADMIN durchlaesst; die
 * Reihenfolge steht trotzdem so da, damit dieser Dienst auch fuer sich genommen
 * dieselbe Semantik hat wie die uebrigen.
 *
 * <p><strong>Das eigene Konto ist gegen Rolle und Status geschuetzt.</strong>
 * Beides wirkt nach §6.5 sofort, auch bei gueltigem Token: wer sich selbst
 * deaktiviert oder herabstuft, ist mit dem naechsten Request ausgesperrt und
 * kann den Schritt nicht zuruecknehmen. Contract und Ticket sagen dazu nichts;
 * entschieden in der Klaerungsrunde zu KAN-25, siehe
 * {@link #requireNotSelf(AuthenticatedUser, UUID, String)}.
 *
 * <p><strong>Kein Hard-Delete.</strong> {@link #deactivate} setzt
 * {@code status = DEACTIVATED} und loescht keine Zeile. {@code Project.authorId}
 * ist {@code not null} (§3.3); ein echtes Loeschen muesste entweder fremde
 * Projekte mitreissen oder die Fremdschluessel verletzen, dasselbe gilt fuer
 * Kommentare, Reaktionen und die Statushistorie. Ein Portfolio-Portal, in dem
 * das Sperren einer Person Beitraege Dritter zerstoert, waere nicht betreibbar
 * (§6.1, §7 offener Punkt 9).
 */
@Service
public class AdminUserService {

	/**
	 * Sortierbare Felder von {@code GET /api/admin/users}.
	 *
	 * <p>Positivliste aus demselben Grund wie in {@code ProjectReadService}: ohne
	 * sie geht {@code sort} ungefiltert in eine {@code order by}-Klausel ueber
	 * beliebige Pfade des Objektmodells. Ein {@code ?sort=passwordHash,asc} waere
	 * hier besonders folgenreich, weil die Sortierung ueber die Reihenfolge
	 * Rueckschluesse auf ein Feld erlaubte, das nach §3.1 den Server nie
	 * verlassen darf; unbekannte Felder enden ausserdem in einer Ausnahme aus dem
	 * Persistenzlayer, also in einem 500 statt in einer verstaendlichen Antwort.
	 *
	 * <p>{@code hsbEmail} steht bewusst darin: dieser Endpoint gibt die Adresse
	 * ohnehin aus (§3.1), es gibt also nichts, worauf eine Sortierung noch
	 * schliessen liesse.
	 */
	private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
			"lastName", "firstName", "email", "hsbEmail", "role", "status",
			"createdAt", "updatedAt");

	/**
	 * Standardsortierung: alphabetisch nach Nachname, dann Vorname.
	 *
	 * <p>§6.1 legt fuer diesen Endpoint keine fest. Eine Nutzerverwaltung ist ein
	 * Verzeichnis, in dem eine bestimmte Person gesucht wird; dafuer ist die
	 * alphabetische Ordnung die brauchbare. {@code createdAt,desc} waere die
	 * Ordnung eines Protokolls und liesse dieselbe Person je nach Bestand auf
	 * einer anderen Seite stehen.
	 */
	private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "lastName", "firstName");

	/**
	 * Startwert der UND-Verknuepfung, wenn kein Filter gesetzt ist.
	 *
	 * <p>Ein {@code null}-Praedikat bedeutet „keine Einschraenkung"; die
	 * Verknuepfung laesst es weg. Anders als bei {@code ProjectSpecifications} ist
	 * hier keine Sichtbarkeitsschranke der Startwert, weil es fuer diesen
	 * Endpoint keine gibt: er ist ADMIN vorbehalten, und §5 gibt dieser Rolle
	 * jedes Konto.
	 */
	private static final Specification<User> NO_RESTRICTION = (root, query, cb) -> null;

	private final UserRepository userRepository;

	private final PortfolioService portfolioService;

	private final ProjectPermissionService permissions;

	private final PasswordEncoder passwordEncoder;

	private final RegistrationProperties registrationProperties;

	public AdminUserService(UserRepository userRepository,
			PortfolioService portfolioService,
			ProjectPermissionService permissions,
			PasswordEncoder passwordEncoder,
			RegistrationProperties registrationProperties) {
		this.userRepository = userRepository;
		this.portfolioService = portfolioService;
		this.permissions = permissions;
		this.passwordEncoder = passwordEncoder;
		this.registrationProperties = registrationProperties;
	}

	// ------------------------------------------------------------------
	// GET /api/admin/users
	// ------------------------------------------------------------------

	/**
	 * Die gefilterte Kontoliste im Seitenformat aus §6.6.
	 *
	 * <p>Enthaelt <strong>alle</strong> Konten, auch deaktivierte und solche mit
	 * offener Registrierung. Genau dafuer gibt es den Filter {@code status}: eine
	 * Nutzerverwaltung, die gesperrte Konten verschweigt, koennte sie nicht
	 * wieder freischalten.
	 *
	 * @param user     angemeldete Person; die Filterkette laesst auf
	 *                 {@code /api/admin/**} nur ADMIN durch
	 * @param role     Filter auf eine Rolle (§2.1); {@code null} liefert alle
	 * @param status   Filter auf einen Kontostatus (§2.9); {@code null} liefert
	 *                 alle
	 * @param q        Suchbegriff ueber Namen und beide Adressen; {@code null}
	 *                 oder leer filtert nicht
	 * @param pageable Seite, Groesse und Sortierung
	 * @throws AccessDeniedException wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException   bei einem unbekannten Sortierfeld (400)
	 */
	@Transactional(readOnly = true)
	public PageResponse<AdminUserResponse> list(AuthenticatedUser user, Role role, UserStatus status,
			String q, Pageable pageable) {

		requireUserAdministration(user);

		Page<User> page = userRepository.findAll(
				conditions(role, status, q),
				completeSort(pageable));

		return PageResponse.from(page.map(AdminUserResponse::from));
	}

	// ------------------------------------------------------------------
	// GET /api/admin/users/{id}
	// ------------------------------------------------------------------

	/**
	 * Ein einzelnes Konto (§3.1).
	 *
	 * <p><strong>Warum es diesen Endpoint gibt</strong>, obwohl die Liste
	 * dieselben Felder liefert: §3.1 nennt ihn ausdruecklich als einen der beiden
	 * Orte, an denen {@code hsbEmail} ausgegeben wird. Die Endpoint-Tabelle in
	 * §6.1 fuehrte ihn bis v25 nicht; der Widerspruch ist in der Klaerungsrunde zu
	 * KAN-25 zugunsten von §3.1 entschieden und mit v26 in §6.1 nachgetragen
	 * worden. Fachlich braucht ihn die Detailansicht der Nutzerverwaltung, die
	 * sonst nur ueber einen Listenaufruf mit passendem Filter an eine einzelne
	 * Person kaeme.
	 *
	 * @throws ResourceNotFoundException wenn es das Konto nicht gibt (404)
	 */
	@Transactional(readOnly = true)
	public AdminUserResponse detail(AuthenticatedUser user, UUID userId) {
		User target = load(userId);
		requireUserAdministration(user);

		return AdminUserResponse.from(target);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/users
	// ------------------------------------------------------------------

	/**
	 * Legt ein sofort nutzbares Konto samt Portfolio an, <strong>201</strong>
	 * (§6.1).
	 *
	 * <p>Der Zustand des neuen Kontos steht nicht im Body, sondern hier:
	 * {@code status = ACTIVE}, beide Verifizierungsflags {@code true} und
	 * {@code passwordChangeRequired = true} (§6.7). Die Verifizierung aus §3.1.1
	 * entfaellt, weil sie dem System belegen soll, dass die Person die beiden
	 * Postfaecher besitzt; diese Zusicherung gibt hier der Admin. Das
	 * Initialpasswort kennt damit eine zweite Person, und genau deshalb steht das
	 * Flag: bis zur Aenderung beantwortet der Authentifizierungsfilter jeden
	 * Request ausser den fuenf Ausnahmen aus §6.7 mit 403.
	 *
	 * <p><strong>Die Rolle kommt aus dem Body, die Domain wird trotzdem
	 * geprueft.</strong> §3.1.1 leitet die Rolle aus der Domain ab, weil sich bei
	 * der Selbstregistrierung sonst jede Person mit studentischer Adresse
	 * Redaktionsrechte verschaffen koennte. Diese Gefahr besteht hier nicht: es
	 * entscheidet ein Admin ueber ein fremdes Konto. Umgekehrt verlangt §3.1.1
	 * fuer ADMIN ausdruecklich diesen Weg, und keine Domain kann ADMIN ergeben.
	 * Die {@code hsbEmail} muss aber weiterhin zur Hochschule gehoeren, sonst
	 * waere sie kein Zugehoerigkeitsnachweis mehr (§3.1) und das Feld nur noch
	 * eine zweite Adresse. Entschieden in der Klaerungsrunde zu KAN-25.
	 *
	 * <p><strong>Das Portfolio entsteht im selben Vorgang</strong> ueber
	 * {@link PortfolioService#createFor(User)}, die eine vorgesehene Anlagestelle
	 * (§3.2.1). Ohne diesen Aufruf bekaeme ein administrativ angelegtes Konto nie
	 * ein Portfolio und die 1:1-Beziehung aus §3.2 waere verletzt; §3.2.1 nennt
	 * genau diesen Weg als den, der typischerweise vergessen wird.
	 *
	 * @throws AccessDeniedException wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException   wenn die Domain der {@code hsbEmail} in keiner
	 *                               der beiden Listen aus §3.1.1 steht (400)
	 * @throws ConflictException     wenn eine der beiden Adressen vergeben ist
	 *                               (409 {@code RESOURCE_IN_USE})
	 */
	@Transactional
	public AdminUserResponse create(AuthenticatedUser user, AdminUserCreateRequest request) {
		requireUserAdministration(user);

		String email = EmailAddresses.normalize(request.email());
		String hsbEmail = EmailAddresses.normalize(request.hsbEmail());

		requireHochschuleDomain(hsbEmail);
		requireAddressesFree(email, hsbEmail);

		User created = User.newAccount(email, hsbEmail,
				passwordEncoder.encode(request.password()),
				request.firstName().trim(), request.lastName().trim(), request.role());

		// Die drei Abweichungen vom selbst registrierten Konto, siehe Javadoc.
		created.setEmailVerified(true);
		created.setHsbEmailVerified(true);
		created.setStatus(UserStatus.ACTIVE);
		created.setPasswordChangeRequired(true);

		User saved = save(created);
		portfolioService.createFor(saved);

		return AdminUserResponse.from(saved);
	}

	// ------------------------------------------------------------------
	// PATCH /api/admin/users/{id}
	// ------------------------------------------------------------------

	/**
	 * Aendert Name, Rolle oder Status eines Kontos (§6.1). Alle vier Felder sind
	 * optional; was fehlt, bleibt stehen.
	 *
	 * <p><strong>Hierueber laeuft der Tutor-Fall aus §3.1.1.</strong> Eine Person
	 * mit studentischer Adresse, die redaktionell arbeitet, registriert sich
	 * regulaer als {@code STUDENT}, weil die Domain der einzige maschinell
	 * pruefbare Nachweis im Registrierungsflow ist, und wird hier auf
	 * {@code EDITOR} hochgestuft. Es ist derselbe Endpoint und keine eigene
	 * Logik, aber der einzige Weg dorthin.
	 *
	 * @throws ResourceNotFoundException wenn es das Konto nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException       bei leerem Namen, bei
	 *                                   {@code REGISTRATION_PENDING} oder beim
	 *                                   Versuch, die eigene Rolle oder den eigenen
	 *                                   Status zu aendern (400)
	 */
	@Transactional
	public AdminUserResponse update(AuthenticatedUser user, UUID userId,
			AdminUserUpdateRequest request) {

		User target = load(userId);
		requireUserAdministration(user);

		if (request.firstName() != null) {
			target.setFirstName(requireFilled(request.firstName(), "firstName"));
		}
		if (request.lastName() != null) {
			target.setLastName(requireFilled(request.lastName(), "lastName"));
		}
		if (request.role() != null) {
			requireNotSelf(user, userId, "role: Die eigene Rolle laesst sich hier nicht aendern.");
			target.setRole(request.role());
		}
		if (request.status() != null) {
			requireAdministrableStatus(request.status());
			requireNotSelf(user, userId,
					"status: Das eigene Konto laesst sich hier nicht sperren oder freischalten.");
			target.setStatus(request.status());
		}

		return AdminUserResponse.from(userRepository.save(target));
	}

	// ------------------------------------------------------------------
	// DELETE /api/admin/users/{id}
	// ------------------------------------------------------------------

	/**
	 * Deaktiviert ein Konto, <strong>204</strong> (§6.1). Kein Hard-Delete, siehe
	 * Klassenkommentar.
	 *
	 * <p><strong>Wirkt sofort</strong>, auch bei noch gueltigem Token: Rolle und
	 * Status werden bei jedem Request frisch aus der Datenbank gelesen und nicht
	 * dem Token entnommen (§6.5). Der naechste Aufruf der betroffenen Person
	 * endet mit 401 {@code ACCOUNT_NOT_ACTIVE}.
	 *
	 * <p><strong>Ein zweiter Aufruf ergibt wieder 204</strong> und keinen
	 * Konflikt. Das Ergebnis ist beim zweiten Mal dasselbe wie beim ersten, das
	 * Konto ist gesperrt; ein 409 waere die Meldung eines Fehlers, den niemand
	 * beheben muesste. Dass die Zeile dabei unveraendert bleibt, ist der Grund,
	 * warum {@code updatedAt} nicht ohne Not verschoben wird.
	 *
	 * @throws ResourceNotFoundException wenn es das Konto nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException       beim Versuch, das eigene Konto zu sperren
	 *                                   (400)
	 */
	@Transactional
	public void deactivate(AuthenticatedUser user, UUID userId) {
		User target = load(userId);
		requireUserAdministration(user);
		requireNotSelf(user, userId, "Das eigene Konto laesst sich nicht deaktivieren.");

		if (target.getStatus() == UserStatus.DEACTIVATED) {
			return;
		}

		target.setStatus(UserStatus.DEACTIVATED);
		userRepository.save(target);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/users/{id}/reset-password
	// ------------------------------------------------------------------

	/**
	 * Setzt ein neues, serverseitig erzeugtes Initialpasswort,
	 * <strong>200</strong> mit {@code { initialPassword }} (§6.1, KAN-43).
	 *
	 * <p><strong>Die Erzeugung liegt beim Server</strong>, anders als bei
	 * {@link #create}, wo der Admin das Passwort selbst eintraegt: hier gibt es
	 * kein Formularfeld, das er fuellen koennte (§6.1). In beiden Faellen kennt
	 * am Ende eine zweite Person das Passwort, und in beiden Faellen steht
	 * deshalb {@code passwordChangeRequired} auf {@code true} (§6.7); der
	 * naechste Login der Person erzwingt die Aenderung. Das Klartextpasswort
	 * erscheint genau einmal in der Antwort und wird nirgends geloggt.
	 *
	 * <p><strong>Ohne Statuspruefung und ohne Selbstschutz</strong>, beides
	 * entschieden in der Klaerungsrunde zu KAN-43 und seit Contract v35 in
	 * §6.1 festgehalten. Der Status: ob sich das Konto
	 * anmelden kann, entscheidet §2.9 ohnehin beim Login, eine zweite Pruefung
	 * hier waere dieselbe Regel an zwei Orten, und der Ablauf „erst Passwort
	 * neu, dann reaktivieren" bliebe sonst an eine Reihenfolge gebunden. Das
	 * eigene Konto: die {@code requireNotSelf}-Sperre aus KAN-25 schuetzt vor
	 * Schritten, die sich nicht zuruecknehmen lassen; dieser laesst sich
	 * zuruecknehmen, denn das {@code initialPassword} steht in der Antwort und
	 * {@code PUT /auth/password} bleibt als Gate-Ausnahme erreichbar.
	 *
	 * @throws ResourceNotFoundException wenn es das Konto nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Rolle nicht ADMIN ist (403)
	 */
	@Transactional
	public AdminPasswordResetResponse resetPassword(AuthenticatedUser user, UUID userId) {
		User target = load(userId);
		requireUserAdministration(user);

		String initialPassword = generateInitialPassword();
		target.setPasswordHash(passwordEncoder.encode(initialPassword));
		target.setPasswordChangeRequired(true);
		userRepository.save(target);

		return new AdminPasswordResetResponse(initialPassword);
	}

	// ------------------------------------------------------------------
	// Pruefungen und gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Zeichenvorrat des Initialpassworts: Buchstaben und Ziffern ohne die
	 * verwechselbaren {@code 0/O}, {@code 1/l/I} und {@code o}. Das Passwort
	 * wird vorgelesen oder abgetippt (§6.1: der Admin uebergibt es der Person);
	 * ein Zeichen, das je nach Schriftart zwei Lesarten hat, produziert dabei
	 * nur Fehlversuche.
	 */
	private static final char[] INITIAL_PASSWORD_ALPHABET =
			"ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789".toCharArray();

	/**
	 * Laenge des Initialpassworts. Mehr als {@link PasswordPolicy#MIN_LENGTH},
	 * weil das eingeschraenkte Alphabet je Zeichen weniger Moeglichkeiten
	 * bietet; 16 Zeichen aus 54 sind rund 92 Bit und damit ausserhalb jeder
	 * Rateweite. Ein Test haelt fest, dass die Laenge innerhalb der Policy
	 * liegt.
	 */
	private static final int INITIAL_PASSWORD_LENGTH = 16;

	private final SecureRandom random = new SecureRandom();

	/**
	 * Erzeugt das Initialpasswort mit {@link SecureRandom}, aus demselben Grund
	 * wie beim Verifizierungscode (§3.1.1): ein vorhersagbarer Generator machte
	 * aus dem Geheimnis eine Formalitaet.
	 */
	private String generateInitialPassword() {
		StringBuilder password = new StringBuilder(INITIAL_PASSWORD_LENGTH);
		for (int i = 0; i < INITIAL_PASSWORD_LENGTH; i++) {
			password.append(INITIAL_PASSWORD_ALPHABET[random.nextInt(INITIAL_PASSWORD_ALPHABET.length)]);
		}
		return password.toString();
	}

	/**
	 * Laedt ein Konto. Fehlt es, folgt <strong>404</strong>
	 * {@code RESOURCE_NOT_FOUND}: §6.2 fuehrt einen eigenen 404er nur fuer das
	 * Projekt.
	 */
	private User load(UUID userId) {
		return userRepository.findById(userId)
				.orElseThrow(() -> ResourceNotFoundException.forUser(userId));
	}

	/** Zeile „User verwalten, inkl. deaktivieren" aus §5: nur ADMIN. */
	private void requireUserAdministration(AuthenticatedUser user) {
		if (!permissions.mayManageUsers(user)) {
			throw new AccessDeniedException(
					"Konten verwaltet ausschliesslich die Administration (§5).");
		}
	}

	/**
	 * Sperrt Rollen- und Statusaenderungen am <em>eigenen</em> Konto.
	 *
	 * <p>Contract und Ticket schweigen dazu; entschieden in der Klaerungsrunde zu
	 * KAN-25. Der Grund ist die Wirkung aus §6.5: beides greift beim naechsten
	 * Request, ohne dass eine Abmeldung noetig waere. Wer sich selbst deaktiviert
	 * oder auf {@code STUDENT} herabstuft, kommt anschliessend nicht mehr an
	 * diesen Endpoint und kann den Schritt nicht zuruecknehmen; in einer
	 * Installation mit einer einzigen Admin-Person waere das System danach ohne
	 * Verwaltung. Es ist kein Berechtigungsproblem und deshalb kein 403: die
	 * Person darf Konten verwalten, nur nicht so.
	 *
	 * <p><strong>Bewusst nicht geschuetzt ist der letzte verbleibende Admin.</strong>
	 * Diese Regel braeuchte bei jedem Schreibvorgang eine Zaehlabfrage und
	 * verhinderte doch nur einen von mehreren Wegen in denselben Zustand, etwa
	 * zwei Admins, die sich gegenseitig sperren. Die haeufige Verwechslung, das
	 * eigene Konto mit einem fremden, faengt die Regel oben ab; alles Weitere ist
	 * eine Frage der Betriebsfuehrung und kein Fall fuer den Endpoint.
	 *
	 * <p>Der Name bleibt aus demselben Grund aenderbar: eine Namenskorrektur
	 * sperrt niemanden aus.
	 */
	private static void requireNotSelf(AuthenticatedUser user, UUID userId, String message) {
		if (user != null && user.getId().equals(userId)) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED, message);
		}
	}

	/**
	 * {@code REGISTRATION_PENDING} ist kein Wert, den die Administration setzt.
	 *
	 * <p>Er beschreibt eine begonnene Registrierung und wird ausschliesslich vom
	 * Flow aus §3.1.1 vergeben und wieder verlassen. Ein bereits verifiziertes
	 * Konto dorthin zurueckzusetzen waere eine Sperre ohne Ausweg: die Anmeldung
	 * endete mit 401 {@code ACCOUNT_NOT_ACTIVE}, und
	 * {@code POST /auth/verify/resend} verschickt fuer ein bereits bestaetigtes
	 * Flag nichts mehr, die Person bekaeme also nie wieder einen Code. Wer ein
	 * Konto sperren will, nimmt {@code DEACTIVATED} (§2.9).
	 */
	private static void requireAdministrableStatus(UserStatus status) {
		if (status == UserStatus.REGISTRATION_PENDING) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"status: REGISTRATION_PENDING beschreibt eine begonnene Registrierung und "
							+ "laesst sich nicht setzen. Zum Sperren eines Kontos dient "
							+ "DEACTIVATED (§2.9).");
		}
	}

	/**
	 * Ein uebermitteltes Namensfeld darf nicht leer sein.
	 *
	 * <p>Bean-Validation kann das nicht ausdruecken: {@code @NotBlank} wuerde auch
	 * das Fehlen des Feldes beanstanden, und genau das ist bei einem PATCH der
	 * Regelfall. Die Meldung traegt den Feldnamen im selben Format wie die
	 * Bean-Validation im {@code GlobalExceptionHandler} ({@code "feld: Meldung"}),
	 * damit das Formular sie an die richtige Zeile haengen kann.
	 */
	private static String requireFilled(String value, String field) {
		String trimmed = value.trim();
		if (trimmed.isEmpty()) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					field + ": Das Feld darf nicht leer sein. Zum Beibehalten weglassen.");
		}
		return trimmed;
	}

	/**
	 * Die {@code hsbEmail} muss zur Hochschule gehoeren (§3.1.1), auch wenn ihre
	 * Domain hier nicht ueber die Rolle entscheidet.
	 *
	 * <p>Verglichen wird wie bei der Registrierung der Teil hinter dem letzten
	 * {@code @}, kleingeschrieben, auf Gleichheit mit einem Listeneintrag. Ein
	 * {@code endsWith("hs-bremen.de")} liesse {@code boesehs-bremen.de} durch und
	 * entwertete die Pruefung.
	 */
	private void requireHochschuleDomain(String hsbEmail) {
		String domain = EmailAddresses.domainOf(hsbEmail);
		if (registrationProperties.isStudentDomain(domain)
				|| registrationProperties.isStaffDomain(domain)) {
			return;
		}

		throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
				"hsbEmail: \"" + domain + "\" ist keine anerkannte Adressendung der Hochschule "
						+ "Bremen. Die Adresse belegt die Hochschulzugehoerigkeit (§3.1) und "
						+ "muss deshalb aus einer der konfigurierten Domains stammen.");
	}

	/**
	 * Weist eine bereits vergebene Adresse ab, bevor die Datenbank es tut, und
	 * nennt dabei das betroffene Feld. Dieselbe Ueberlegung wie im
	 * {@code RegistrationService}: aus der Constraint-Verletzung liesse sich
	 * nicht mehr ablesen, welche der beiden Adressen gemeint ist.
	 */
	private void requireAddressesFree(String email, String hsbEmail) {
		if (userRepository.findByEmail(email).isPresent()) {
			throw ConflictException.addressInUse("email");
		}
		if (userRepository.findByHsbEmail(hsbEmail).isPresent()) {
			throw ConflictException.addressInUse("hsbEmail");
		}
	}

	/**
	 * Speichert das Konto und uebersetzt den Constraint-Verstoss in dieselbe
	 * 409-Antwort wie die Vorabpruefung. Hierher fuehrt nur der Wettlauf zweier
	 * gleichzeitiger Anlagen auf dieselbe Adresse; ohne die Uebersetzung waere das
	 * ein 500, obwohl der Fall fachlich derselbe ist.
	 */
	private User save(User user) {
		try {
			return userRepository.saveAndFlush(user);
		}
		catch (DataIntegrityViolationException e) {
			throw ConflictException.addressInUse("email");
		}
	}

	/** Verknuepft die gesetzten Filter mit UND. */
	private Specification<User> conditions(Role role, UserStatus status, String q) {
		List<Specification<User>> parts = new ArrayList<>();

		if (role != null) {
			parts.add(AdminUserSpecifications.role(role));
		}
		if (status != null) {
			parts.add(AdminUserSpecifications.status(status));
		}
		if (q != null && !q.isBlank()) {
			parts.add(AdminUserSpecifications.searchText(q.trim()));
		}

		return parts.stream().reduce(Specification::and).orElse(NO_RESTRICTION);
	}

	/**
	 * Prueft die gewuenschte Sortierung und ergaenzt einen festen
	 * Gleichstandsbrecher, wie in {@code ProjectReadService}.
	 *
	 * <p>Ohne eindeutige Ordnung darf die Datenbank gleichrangige Zeilen zwischen
	 * zwei Abfragen unterschiedlich anordnen. Beim Blaettern erschiene dieselbe
	 * Person dann auf zwei Seiten und eine andere auf keiner, was bei einer Liste
	 * voller Namensvettern kein Sonderfall ist.
	 */
	private Pageable completeSort(Pageable pageable) {
		Sort requested = pageable.getSort().isSorted() ? pageable.getSort() : DEFAULT_SORT;

		for (Sort.Order order : requested) {
			if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Nach diesem Feld kann nicht sortiert werden. Erlaubt sind: "
								+ ALLOWED_SORT_FIELDS.stream().sorted().collect(Collectors.joining(", "))
								+ ".");
			}
		}

		return PageRequest.of(
				pageable.getPageNumber(),
				pageable.getPageSize(),
				requested.and(Sort.by(Sort.Direction.ASC, "id")));
	}
}
