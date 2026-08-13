package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.ProfileUpdateRequest;
import de.hsbremen.eportfolio.auth.dto.VerificationStatusResponse;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Selbstaendiger Wechsel der privaten E-Mail-Adresse (§3.1, §6.1, KAN-60).
 *
 * <p>Der Flow hat zwei Haelften: {@link #requestChange} nimmt die Wunschadresse
 * aus {@code PUT /auth/me} entgegen und verschickt einen Code an die
 * <em>neue</em> Adresse; {@link #confirm} loest ihn ueber
 * {@code POST /auth/verify} ein und macht die Adresse erst dann zur
 * Login-Kennung. Bis dahin steht sie nur in {@code User.pendingEmail}, und
 * Anmeldung wie alle Antworten fuehren die alte Adresse weiter.
 *
 * <p><strong>Warum das aktuelle Passwort verlangt wird:</strong> die private
 * Adresse ist die Login-Kennung und empfaengt auch die Ruecksetzcodes
 * (§6.1, {@code POST /auth/forgot-password}). Wer nur ein fremdes Token
 * besitzt, koennte die Kennung sonst auf die eigene Adresse umleiten und das
 * Konto anschliessend per Ruecksetzung uebernehmen. Dieselbe Rueckversicherung
 * verlangt {@code PUT /auth/password} aus demselben Grund. Entschieden in der
 * Klaerungsrunde zu KAN-60.
 *
 * <p><strong>Warum jeder Wechselversuch gezaehlt wird:</strong> der Endpoint
 * verschickt an eine frei waehlbare Adresse, unter dem Absender der
 * Hochschule. Ohne die Bremse aus dem {@link VerificationAttemptService}
 * waere er trotz Anmeldung ein Versandgenerator, wie es §6.5 fuer
 * {@code resend} und {@code forgot-password} beschreibt.
 */
@Service
public class EmailChangeService {

	private final UserRepository userRepository;

	private final VerificationCodeService codeService;

	private final VerificationAttemptService attempts;

	private final MailTemplateService mailTemplateService;

	private final PasswordEncoder passwordEncoder;

	public EmailChangeService(UserRepository userRepository, VerificationCodeService codeService,
			VerificationAttemptService attempts, MailTemplateService mailTemplateService,
			PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.codeService = codeService;
		this.attempts = attempts;
		this.mailTemplateService = mailTemplateService;
		this.passwordEncoder = passwordEncoder;
	}

	// ------------------------------------------------------------------
	// PUT /api/auth/me: Wunschadresse entgegennehmen
	// ------------------------------------------------------------------

	/**
	 * Wertet das Feld {@code email} eines Profil-Updates aus (§6.1).
	 *
	 * <p>Drei Faelle, in dieser Reihenfolge:
	 * <ol>
	 *   <li><strong>Feld fehlt:</strong> reine Namensaenderung, an den Adressen
	 *       aendert sich nichts, auch nicht an einem laufenden Wechsel.</li>
	 *   <li><strong>Aktuelle Adresse:</strong> ein laufender Wechsel wird
	 *       abgebrochen, {@code pendingEmail} geleert und offene Codes
	 *       entwertet. Das ist der einzige Weg, einen versehentlich
	 *       angestossenen Wechsel zurueckzunehmen, ohne eine dritte Adresse
	 *       anzugeben.</li>
	 *   <li><strong>Neue Adresse:</strong> Bremse, Passwortpruefung,
	 *       Eindeutigkeit, dann Wunschadresse speichern und Code an die neue
	 *       Adresse schicken. Ein vorheriger Wechselcode ist damit entwertet
	 *       ({@link VerificationCodeService#issue}).</li>
	 * </ol>
	 *
	 * <p>Laeuft in der Transaktion von {@code AuthService.updateProfile}:
	 * scheitert der Wechsel, bleibt auch die Namensaenderung aus demselben
	 * Request aus. Alles oder nichts, wie es ein Formular mit einem
	 * Speichern-Knopf erwartet.
	 *
	 * @throws AuthService.LoginFailedException          fehlendes oder falsches
	 *                                                   Passwort (401)
	 * @throws AuthService.TooManyLoginAttemptsException Bremse erreicht (429)
	 * @throws ConflictException                         Adresse vergeben (409)
	 */
	@Transactional
	public void requestChange(User user, ProfileUpdateRequest request, String clientIp) {
		String requested = EmailAddresses.normalize(request.email());
		if (requested == null) {
			return;
		}

		if (requested.equals(user.getEmail())) {
			cancelOpenChange(user);
			return;
		}

		guardAttempt(requested, clientIp);
		requireCurrentPassword(user, request.currentPassword());
		requireAddressFree(requested);

		user.setPendingEmail(requested);
		sendCode(user, requested);
	}

	// ------------------------------------------------------------------
	// POST /api/auth/verify mit purpose = EMAIL_CHANGE
	// ------------------------------------------------------------------

	/**
	 * Loest den Wechselcode ein und macht die Wunschadresse zur Login-Kennung.
	 *
	 * <p>{@code newEmail} ist die <em>neue</em> Adresse, denn nur sie kennt die
	 * Person in diesem Moment sicher; gesucht wird deshalb ueber
	 * {@code pendingEmail}. Mehrere Konten mit derselben Wunschadresse sind
	 * zulaessig, der passende Code entscheidet, welches gemeint ist.
	 *
	 * <p><strong>Die Eindeutigkeit wird hier erneut geprueft:</strong> zwischen
	 * Anstossen und Bestaetigen koennen Tage liegen, in denen sich ein anderes
	 * Konto die Adresse geholt hat. Faengt die Pruefung das nicht, tut es der
	 * Unique-Constraint beim Speichern; beide Wege antworten mit demselben 409
	 * (siehe {@link #saveGuardingUniqueness}). Der Code ist dann nicht
	 * verbraucht, die Transaktion rollt zurueck.
	 *
	 * <p>Unbekannte Adresse und falscher Code antworten identisch und in
	 * gleicher Zeit (Placeholder-Hashing), wie an allen Code-Endpoints (§6.1).
	 *
	 * <p>Ein deaktiviertes Konto wird uebersprungen: es darf seinen Wechsel
	 * nicht abschliessen, waehrend es ausgesperrt ist (§2.9), und die Antwort
	 * bleibt von einem unbekannten Konto ununterscheidbar.
	 *
	 * @throws de.hsbremen.eportfolio.common.error.ValidationException Code
	 *         ungueltig (400 {@code VERIFICATION_CODE_INVALID})
	 * @throws ConflictException Adresse inzwischen vergeben (409)
	 */
	@Transactional
	public VerificationStatusResponse confirm(String newEmail, String submittedCode, String clientIp) {
		List<User> candidates = userRepository.findByPendingEmail(newEmail);

		boolean compared = false;
		for (User user : candidates) {
			if (user.getStatus() == UserStatus.DEACTIVATED) {
				continue;
			}
			compared = true;
			if (codeService.consume(user, VerificationPurpose.EMAIL_CHANGE, submittedCode)) {
				requireAddressFree(newEmail);
				user.setEmail(newEmail);
				user.setPendingEmail(null);
				attempts.reset(newEmail, clientIp);
				return VerificationStatusResponse.from(saveGuardingUniqueness(user));
			}
		}

		if (!compared) {
			codeService.matchPlaceholder(submittedCode);
		}
		throw VerificationCodeService.invalidCodeError();
	}

	// ------------------------------------------------------------------
	// POST /api/auth/verify/resend mit purpose = EMAIL_CHANGE
	// ------------------------------------------------------------------

	/**
	 * Neuer Wechselcode an die Wunschadresse, der vorherige ist entwertet.
	 *
	 * <p>Die Bremse zaehlt der Aufrufer ({@code RegistrationService.resend}),
	 * gemeinsam fuer alle Code-Endpoints; hier steht nur der Versand. Kein
	 * laufender Wechsel zu dieser Adresse heisst: nichts geschieht, und die
	 * Antwort bleibt 204, wie fuer jeden anderen Fall auch (§6.1).
	 */
	@Transactional
	public void resend(String newEmail) {
		for (User user : userRepository.findByPendingEmail(newEmail)) {
			if (user.getStatus() == UserStatus.DEACTIVATED) {
				continue;
			}
			sendCode(user, newEmail);
		}
	}

	// ------------------------------------------------------------------

	/**
	 * Bricht einen laufenden Wechsel ab.
	 *
	 * <p>Das Entwerten der Codes gehoert dazu: bliebe ein Code gueltig, koennte
	 * er die soeben zurueckgenommene Adresse spaeter doch noch zur Kennung
	 * machen, obwohl die Person den Wechsel ausdruecklich verworfen hat.
	 */
	private void cancelOpenChange(User user) {
		if (user.getPendingEmail() == null) {
			return;
		}
		user.setPendingEmail(null);
		codeService.invalidateOpen(user, VerificationPurpose.EMAIL_CHANGE);
	}

	/**
	 * Beide Fehlermeldungen duerfen konkret sein: die Person ist
	 * authentifiziert, eine Konto-Enumeration ist hier unmoeglich. Dieselbe
	 * Ueberlegung wie bei {@code AuthService.changePassword}.
	 */
	private void requireCurrentPassword(User user, String currentPassword) {
		if (currentPassword == null || currentPassword.isBlank()) {
			throw new AuthService.LoginFailedException(
					"Zum Wechsel der E-Mail-Adresse muss das aktuelle Passwort mitgeschickt werden.");
		}
		if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
			throw new AuthService.LoginFailedException("Das aktuelle Passwort ist falsch.");
		}
	}

	/**
	 * Sperre pruefen und den Versuch zaehlen, in dieser Reihenfolge; dasselbe
	 * Muster wie im {@code RegistrationService}. Gezaehlt wird <strong>vor</strong>
	 * der Passwortpruefung, wie §6.1 es mit „jeder Wechselversuch zaehlt"
	 * verlangt: das Passwort ist hier die Rueckversicherung gegen ein
	 * gestohlenes Token, und ohne Zaehlung liesse es sich an diesem Endpoint
	 * unbegrenzt durchprobieren. Der Preis ist, dass ein vertipptes Passwort
	 * einen der fuenf Versuche kostet; der IP-Zaehler des
	 * {@link AttemptCounter} greift dabei auch, wenn je Versuch eine andere
	 * Wunschadresse eingesetzt wird. Befund aus dem Contract-Abgleich zu
	 * KAN-60.
	 */
	private void guardAttempt(String email, String clientIp) {
		if (attempts.isBlocked(email, clientIp)) {
			throw AuthService.TooManyLoginAttemptsException.forVerification();
		}
		attempts.recordAttempt(email, clientIp);
	}

	/**
	 * Die Wunschadresse darf weder als private noch als Hochschuladresse
	 * vergeben sein, dieselbe Regel wie bei der Registrierung (§6.1). Die
	 * eigene {@code hsbEmail} faellt bewusst mit darunter: die beiden Adressen
	 * eines Kontos muessen getrennt bleiben (§3.1.1).
	 *
	 * <p>Der 409 verraet, dass die Adresse vergeben ist, wie die Registrierung
	 * auch; §6.1 traegt diese eine Offenlegung ausdruecklich, und die Bremse
	 * aus {@link #guardAttempt} begrenzt das Durchprobieren.
	 */
	private void requireAddressFree(String email) {
		if (userRepository.findByEmail(email).isPresent()
				|| userRepository.findByHsbEmail(email).isPresent()) {
			throw ConflictException.addressInUse("email");
		}
	}

	/**
	 * Faengt den Wettlauf zweier gleichzeitiger Bestaetigungen: passieren beide
	 * {@link #requireAddressFree}, bevor eine schreibt, greift der
	 * Unique-Constraint auf {@code email}, und die Antwort ist derselbe 409 wie
	 * bei der Vorabpruefung. Dasselbe Muster wie {@code RegistrationService#save}.
	 */
	private User saveGuardingUniqueness(User user) {
		try {
			return userRepository.saveAndFlush(user);
		}
		catch (DataIntegrityViolationException e) {
			throw ConflictException.addressInUse("email");
		}
	}

	/** Der Klartext existiert nur zwischen diesen beiden Zeilen (§3.16). */
	private void sendCode(User user, String recipient) {
		VerificationCodeService.IssuedCode issued = codeService.issue(user, VerificationPurpose.EMAIL_CHANGE);
		mailTemplateService.sendEmailChangeVerification(recipient, issued.plainCode(), issued.validity());
	}
}
