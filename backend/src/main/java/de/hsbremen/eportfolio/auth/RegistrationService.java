package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.RegisterRequest;
import de.hsbremen.eportfolio.auth.dto.ResendVerificationRequest;
import de.hsbremen.eportfolio.auth.dto.UserResponse;
import de.hsbremen.eportfolio.auth.dto.VerificationStatusResponse;
import de.hsbremen.eportfolio.auth.dto.VerifyRequest;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.config.RegistrationProperties;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der fuenfstufige Registrierungsflow aus API-Contract §3.1.1 (KAN-26).
 *
 * <p>Drei Endpoints, drei Methoden: {@link #register}, {@link #verify} und
 * {@link #resend}. Alle drei sind PUBLIC, weil sich zu diesem Zeitpunkt niemand
 * anmelden kann; die Zugangskontrolle uebernehmen an ihrer Stelle das
 * Rate-Limit und das Einmalgeheimnis im Postfach.
 *
 * <p><strong>Die Rolle folgt der Domain, nicht der Auswahl im Formular</strong>
 * (§3.1.1). {@code selectedRole} steuert in der Oberflaeche nur Beschriftung und
 * erwartete Domain und wird hier ausschliesslich gegen die abgeleitete Rolle
 * geprueft. Bestimmte die uebermittelte Auswahl die Rolle, koennte jede Person
 * mit studentischer Adresse durch Umsetzen eines Feldes im Request
 * Redaktionsrechte erhalten, und die Freigabe von Portfolios haenge an einer
 * Selbstauskunft.
 *
 * <p><strong>Verglichen wird exakt, nicht per Suffix.</strong> Ein
 * {@code endsWith("hs-bremen.de")} liesse {@code boesehs-bremen.de} durch und
 * entwertete die gesamte Pruefung. Soll eine Subdomain gelten, wird sie in die
 * Liste aufgenommen.
 *
 * <p><strong>Zwei der drei Endpoints antworten fuer bekannte und unbekannte
 * Adressen gleich</strong> (§6.1). Andernfalls liesse sich ueber sie ermitteln,
 * welche Adressen im System registriert sind. Die Registrierung selbst kann das
 * nicht: beide Adressen sind eindeutig, eine zweite Anmeldung darauf muss
 * scheitern und der Grund muss benennbar sein. Diese eine Offenlegung ist
 * unvermeidbar und in §6.1 ausdruecklich getragen.
 */
@Service
public class RegistrationService {

	private final UserRepository userRepository;

	private final PortfolioService portfolioService;

	private final VerificationCodeService codeService;

	private final VerificationAttemptService attempts;

	private final MailTemplateService mailTemplateService;

	private final PasswordEncoder passwordEncoder;

	private final RegistrationProperties properties;

	public RegistrationService(UserRepository userRepository, PortfolioService portfolioService,
			VerificationCodeService codeService, VerificationAttemptService attempts,
			MailTemplateService mailTemplateService, PasswordEncoder passwordEncoder,
			RegistrationProperties properties) {
		this.userRepository = userRepository;
		this.portfolioService = portfolioService;
		this.codeService = codeService;
		this.attempts = attempts;
		this.mailTemplateService = mailTemplateService;
		this.passwordEncoder = passwordEncoder;
		this.properties = properties;
	}

	// ------------------------------------------------------------------
	// POST /api/auth/register (Schritte 1 und 2 aus §3.1.1)
	// ------------------------------------------------------------------

	/**
	 * Legt Konto und Portfolio an und verschickt beide Codes.
	 *
	 * <p>Reihenfolge der Pruefungen, und sie ist nicht beliebig:
	 * <ol>
	 *   <li><strong>Domain</strong> der {@code hsbEmail} gegen die beiden Listen.
	 *       Steht sie in keiner, endet es hier mit 400. Diese Pruefung steht
	 *       zuerst, weil sie nichts ueber vorhandene Konten verraet: eine
	 *       fremde Domain ergibt dieselbe Antwort, ob die Adresse nun vergeben
	 *       ist oder nicht.</li>
	 *   <li><strong>Abgleich mit {@code selectedRole}</strong>, ebenfalls 400 mit
	 *       Meldung am Feld {@code hsbEmail}.</li>
	 *   <li><strong>Eindeutigkeit</strong> beider Adressen, sonst 409
	 *       {@code RESOURCE_IN_USE}.</li>
	 * </ol>
	 *
	 * <p><strong>Das Portfolio entsteht hier und nicht erst bei der
	 * Aktivierung</strong> (§3.2.1, Schritt 2). §3.2 legt eine 1:1-Beziehung
	 * fest; entstuende die Zeile erst in Schritt 5, waere sie fuer jedes noch
	 * nicht abgeschlossene Konto faktisch 1:0..1. Angelegt wird ueber
	 * {@link PortfolioService#createFor(User)}, die eine vorgesehene Anlagestelle.
	 *
	 * <p><strong>Der Mailversand entscheidet nicht ueber den Erfolg</strong>
	 * (§6.8). Er laeuft asynchron und schluckt seine Fehler; ein Rollback nur
	 * wegen eines kurz nicht erreichbaren Relays wuerde ein bereits angelegtes
	 * Konto samt Portfolio verwerfen und die Person vor einen Fehler stellen, den
	 * sie nicht aufloesen kann. Der Wiederholungsweg ist {@link #resend}.
	 *
	 * @return das angelegte Konto ohne {@code passwordHash} und ohne
	 *         {@code hsbEmail} (§3.1)
	 * @throws ValidationException bei fremder Domain oder abweichender
	 *                             {@code selectedRole} (400)
	 * @throws ConflictException   wenn eine der beiden Adressen vergeben ist (409)
	 */
	@Transactional
	public UserResponse register(RegisterRequest request) {
		String email = EmailAddresses.normalize(request.email());
		String hsbEmail = EmailAddresses.normalize(request.hsbEmail());

		Role role = roleFor(hsbEmail);
		requireMatchingSelection(request.selectedRole(), role);
		requireAddressesFree(email, hsbEmail);

		// Beide Flags stehen auf false und der Status auf REGISTRATION_PENDING:
		// bis beide Adressen bestaetigt sind, ist keine Anmeldung moeglich (§2.9).
		// Beides sind die Vorgabewerte, siehe User.newAccount.
		User user = User.newAccount(email, hsbEmail,
				passwordEncoder.encode(request.password()),
				request.firstName().trim(), request.lastName().trim(), role);

		User saved = save(user);
		// Schritt 2 aus §3.2.1: Portfolio im selben Vorgang wie das Konto.
		portfolioService.createFor(saved);

		sendCode(saved, VerificationPurpose.PRIVATE_EMAIL);
		sendCode(saved, VerificationPurpose.HSB_EMAIL);

		return UserResponse.from(saved);
	}

	// ------------------------------------------------------------------
	// POST /api/auth/verify (Schritte 3 bis 5 aus §3.1.1)
	// ------------------------------------------------------------------

	/**
	 * Loest einen Code ein und setzt das zugehoerige Flag; sind danach beide
	 * gesetzt, wird das Konto {@code ACTIVE}.
	 *
	 * <p><strong>Eine unbekannte Adresse ergibt dieselbe Antwort wie ein falscher
	 * Code</strong>, naemlich 400 {@code VERIFICATION_CODE_INVALID}, und zwar
	 * auch in der Antwortzeit (siehe
	 * {@link VerificationCodeService#matchPlaceholder}). Beide Faelle sind
	 * fachlich dasselbe: es gibt keinen gueltigen Code zu dieser Eingabe.
	 *
	 * <p>Zurueckgesetzt wird der Zaehler nur bei Erfolg. Damit summieren sich die
	 * beiden Schritte des Flusses nicht: wer die private Adresse nach drei
	 * Anlaeufen bestaetigt hat, hat fuer die HSB-Adresse wieder volle fuenf.
	 *
	 * @throws AuthService.TooManyLoginAttemptsException bei erreichter Grenze (429)
	 * @throws ValidationException                       bei unzulaessigem Zweck
	 *                                                   (400 VALIDATION_FAILED)
	 *                                                   oder ungueltigem Code
	 *                                                   (400 VERIFICATION_CODE_INVALID)
	 */
	@Transactional
	public VerificationStatusResponse verify(VerifyRequest request, String clientIp) {
		VerificationPurpose purpose = requireEmailPurpose(request.purpose());
		String email = EmailAddresses.normalize(request.email());
		guardAttempt(email, clientIp);

		Optional<User> found = userRepository.findByEmail(email);
		if (found.isEmpty()) {
			codeService.matchPlaceholder(request.code());
			throw invalidCode();
		}

		User user = found.get();
		if (!codeService.consume(user, purpose, request.code())) {
			throw invalidCode();
		}

		markVerified(user, purpose);
		activateIfFullyVerified(user);
		attempts.reset(email, clientIp);

		return VerificationStatusResponse.from(userRepository.save(user));
	}

	// ------------------------------------------------------------------
	// POST /api/auth/verify/resend
	// ------------------------------------------------------------------

	/**
	 * Stellt einen neuen Code aus und entwertet den vorherigen (§6.1).
	 *
	 * <p><strong>Die Methode antwortet immer gleich und wirft nur bei erreichter
	 * Grenze.</strong> Eine unbekannte Adresse, ein bereits bestaetigtes Flag und
	 * ein deaktiviertes Konto fuehren alle dazu, dass nichts geschieht und der
	 * Controller trotzdem 204 liefert. Jede Unterscheidung an dieser Stelle waere
	 * ein Verzeichnis registrierter Adressen.
	 *
	 * <p>Gezaehlt wird hier <em>jeder</em> Aufruf, auch der erfolgreiche: der
	 * Versand selbst ist die begrenzte Ressource, sonst waere der Endpoint ein
	 * Versandgenerator fuer beliebige Postfaecher.
	 *
	 * @throws AuthService.TooManyLoginAttemptsException bei erreichter Grenze (429)
	 * @throws ValidationException                       bei unzulaessigem Zweck (400)
	 */
	@Transactional
	public void resend(ResendVerificationRequest request, String clientIp) {
		VerificationPurpose purpose = requireEmailPurpose(request.purpose());
		String email = EmailAddresses.normalize(request.email());
		guardAttempt(email, clientIp);

		Optional<User> found = userRepository.findByEmail(email);
		if (found.isEmpty()) {
			return;
		}

		User user = found.get();
		if (isAlreadyVerified(user, purpose) || user.getStatus() == UserStatus.DEACTIVATED) {
			// Nichts zu bestaetigen. Von aussen nicht von einem Versand zu
			// unterscheiden, weil die Antwort dieselbe ist.
			return;
		}

		sendCode(user, purpose);
	}

	// ------------------------------------------------------------------
	// Domain-Regel aus §3.1.1
	// ------------------------------------------------------------------

	/**
	 * Leitet die Rolle aus der Domain der Hochschuladresse ab.
	 *
	 * <p>Verglichen wird der Teil hinter dem letzten {@code @}, kleingeschrieben,
	 * auf <strong>Gleichheit</strong> mit einem Listeneintrag. {@code ADMIN} kann
	 * hier nicht herauskommen: administrative Rechte an eine Domain zu koppeln
	 * hiesse, die Verwaltung des Systems an den Besitz einer E-Mail-Adresse zu
	 * binden (§3.1.1).
	 *
	 * @throws ValidationException wenn die Domain in keiner der beiden Listen
	 *                             steht (400, es entsteht kein Konto)
	 */
	private Role roleFor(String hsbEmail) {
		String domain = EmailAddresses.domainOf(hsbEmail);

		if (properties.isStudentDomain(domain)) {
			return Role.STUDENT;
		}
		if (properties.isStaffDomain(domain)) {
			return Role.EDITOR;
		}

		// Die Meldung nennt die eingeschickte Domain, nicht die erlaubten: welche
		// Endungen die Hochschule fuehrt, gehoert in die Oberflaeche und nicht in
		// eine Fehlerantwort, die jede:r ohne Anmeldung abrufen kann.
		throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
				"hsbEmail: \"" + domain + "\" ist keine anerkannte Adressendung der Hochschule Bremen. "
						+ "Bitte die Hochschuladresse verwenden.");
	}

	/**
	 * Prueft die Formularauswahl gegen die abgeleitete Rolle (§3.1.1).
	 *
	 * <p>Die Meldung haengt am Feld {@code hsbEmail} und nicht an
	 * {@code selectedRole}, weil das die Stelle ist, an der die Person etwas
	 * korrigieren kann: entweder sie hat die falsche Art gewaehlt oder die falsche
	 * Adresse eingetragen, und die Adresse ist die Angabe mit dem Nachweis
	 * dahinter.
	 *
	 * <p>Der Fall „studentische Adresse, Auswahl EDITOR" ist der Tutor-Fall aus
	 * §3.1.1 und wird bewusst hier abgewiesen: die Domain belegt den
	 * Studierendenstatus, aber nicht die Tutorentaetigkeit. Die Hochstufung
	 * uebernimmt ein Admin ueber {@code PATCH /admin/users/{id}} (KAN-25).
	 */
	private static void requireMatchingSelection(Role selected, Role derived) {
		if (selected == derived) {
			return;
		}

		throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
				"hsbEmail: Diese Adresse gehoert nicht zur gewaehlten Art des Zugangs. "
						+ "Die Rolle ergibt sich aus der Hochschuladresse und laesst sich nicht "
						+ "im Formular waehlen.");
	}

	// ------------------------------------------------------------------

	/**
	 * Weist eine bereits vergebene Adresse ab, bevor die Datenbank es tut.
	 *
	 * <p>Die Vorabpruefung ersetzt den Unique-Constraint nicht, sie ergaenzt ihn:
	 * ohne sie kaeme eine bereits vergebene Adresse als
	 * {@code DataIntegrityViolationException} zurueck, und die Antwort koennte
	 * nicht sagen, welche der beiden Adressen gemeint ist. Den Wettlauf zweier
	 * gleichzeitiger Registrierungen faengt weiterhin die Datenbank, siehe
	 * {@link #save}.
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
	 * 409-Antwort wie die Vorabpruefung.
	 *
	 * <p>Hierher fuehrt nur der Wettlauf: zwei Registrierungen auf dieselbe
	 * Adresse, die beide die Vorabpruefung passieren, bevor eine von ihnen
	 * schreibt. Ohne diese Uebersetzung waere das ein 500, obwohl der Fall
	 * fachlich derselbe ist, den §6.1 mit 409 beantwortet. Welche der beiden
	 * Adressen es war, laesst sich hier nicht mehr sagen, weil die Meldung der
	 * Datenbank den Constraint-Namen traegt und keine Feldzuordnung.
	 */
	private User save(User user) {
		try {
			return userRepository.saveAndFlush(user);
		}
		catch (DataIntegrityViolationException e) {
			throw ConflictException.addressInUse("email");
		}
	}

	/**
	 * Stellt einen Code aus und uebergibt ihn dem Mailmodul.
	 *
	 * <p>Der private Code geht an die private Adresse, der HSB-Code an die
	 * Hochschuladresse. Der Klartext existiert nur zwischen diesen beiden Zeilen;
	 * gespeichert wird ausschliesslich sein Hash (§3.16).
	 */
	private void sendCode(User user, VerificationPurpose purpose) {
		VerificationCodeService.IssuedCode issued = codeService.issue(user, purpose);

		if (purpose == VerificationPurpose.PRIVATE_EMAIL) {
			mailTemplateService.sendPrivateEmailVerification(
					user.getEmail(), issued.plainCode(), issued.validity());
		}
		else {
			mailTemplateService.sendHsbEmailVerification(
					user.getHsbEmail(), issued.plainCode(), issued.validity());
		}
	}

	/**
	 * Sperre pruefen und den Versuch zaehlen, in dieser Reihenfolge.
	 *
	 * <p>Die Pruefung steht vor jedem Datenbankzugriff: ein gesperrter Schluessel
	 * erfaehrt damit nichts darueber, ob es die Adresse ueberhaupt gibt.
	 */
	private void guardAttempt(String email, String clientIp) {
		if (attempts.isBlocked(email, clientIp)) {
			throw AuthService.TooManyLoginAttemptsException.forVerification();
		}
		attempts.recordAttempt(email, clientIp);
	}

	/**
	 * Nur die beiden E-Mail-Zwecke gehoeren an diese Endpoints.
	 *
	 * <p>{@code PASSWORD_RESET} ist ein gueltiger Wert aus §2.11, aber der eines
	 * anderen Flusses ({@code POST /auth/reset-password}, KAN-43). Ihn hier
	 * durchzulassen hiesse, dass ein Ruecksetzcode eine E-Mail-Adresse
	 * bestaetigen koennte.
	 */
	private static VerificationPurpose requireEmailPurpose(VerificationPurpose purpose) {
		if (purpose == VerificationPurpose.PRIVATE_EMAIL || purpose == VerificationPurpose.HSB_EMAIL) {
			return purpose;
		}

		throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
				"purpose: An diesem Endpoint sind nur PRIVATE_EMAIL und HSB_EMAIL zulaessig.");
	}

	private static boolean isAlreadyVerified(User user, VerificationPurpose purpose) {
		return purpose == VerificationPurpose.PRIVATE_EMAIL
				? user.isEmailVerified()
				: user.isHsbEmailVerified();
	}

	private static void markVerified(User user, VerificationPurpose purpose) {
		if (purpose == VerificationPurpose.PRIVATE_EMAIL) {
			user.setEmailVerified(true);
		}
		else {
			user.setHsbEmailVerified(true);
		}
	}

	/**
	 * Schritt 5 aus §3.1.1: sind beide Adressen bestaetigt, wird das Konto aktiv.
	 *
	 * <p>Nur aus {@code REGISTRATION_PENDING} heraus. Ein vom Admin
	 * deaktiviertes Konto darf sich nicht dadurch selbst entsperren, dass jemand
	 * einen alten Code einloest; §2.9 fuehrt den Status ausdruecklich getrennt von
	 * den Flags, gerade damit „verifiziert und trotzdem gesperrt" abbildbar
	 * bleibt.
	 */
	private static void activateIfFullyVerified(User user) {
		if (user.isEmailVerified() && user.isHsbEmailVerified()
				&& user.getStatus() == UserStatus.REGISTRATION_PENDING) {
			user.setStatus(UserStatus.ACTIVE);
		}
	}

	/** Ein Wortlaut fuer alle drei Faelle aus §6.2, siehe dort. */
	private static ValidationException invalidCode() {
		return new ValidationException(ErrorCodes.VERIFICATION_CODE_INVALID,
				"Der Code ist ungueltig, abgelaufen oder bereits verwendet worden. "
						+ "Bitte einen neuen Code anfordern.");
	}
}
