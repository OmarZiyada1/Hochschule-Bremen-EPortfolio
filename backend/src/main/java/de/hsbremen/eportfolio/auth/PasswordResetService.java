package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.auth.dto.ForgotPasswordRequest;
import de.hsbremen.eportfolio.auth.dto.ResetPasswordRequest;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Selbstbedienung bei vergessenem Passwort, {@code POST /auth/forgot-password}
 * und {@code POST /auth/reset-password} (API-Contract §6.1, KAN-43).
 *
 * <p>Der Fluss benutzt durchgehend die Bausteine der Registrierung und baut
 * keinen zweiten Weg daneben (§2.11): Codes stellt der
 * {@link VerificationCodeService} mit dem Zweck {@code PASSWORD_RESET} aus,
 * gebremst wird ueber den {@link VerificationAttemptService}, verschickt ueber
 * den {@link MailTemplateService}. Ein Ruecksetzcode ist fachlich dasselbe wie
 * ein Verifizierungscode: ein kurzlebiges Einmalgeheimnis, dessen Sicherheit
 * aus Ablauf und Rate-Limit stammt (§3.16).
 *
 * <p><strong>Beide Endpoints antworten fuer bekannte und unbekannte Adressen
 * identisch</strong> (§6.1): {@code forgot-password} immer 204,
 * {@code reset-password} bei jedem Scheitern 400
 * {@code VERIFICATION_CODE_INVALID}, und zwar auch in der Antwortzeit (siehe
 * {@link VerificationCodeService#matchPlaceholder}). Andernfalls liesse sich
 * ueber sie ermitteln, welche Adressen im System registriert sind.
 *
 * <p><strong>Ein Code entsteht nur fuer aktive Konten.</strong> Ein
 * deaktiviertes Konto hat keinen Selbstbedienungsweg zurueck (das entscheidet
 * die Administration, §2.9), und ein Konto in {@code REGISTRATION_PENDING}
 * schliesst zuerst die Registrierung ab; sein Passwort hat die Person eben
 * erst selbst gewaehlt. Beide verhalten sich nach aussen exakt wie eine
 * unbekannte Adresse. Entschieden in der Klaerungsrunde zu KAN-43,
 * festgehalten in §6.1 mit Contract v35.
 *
 * <p><strong>Der Zaehler ist der der Verifizierung, nicht der des Logins</strong>
 * (§6.5): eine angeforderte Ruecksetzung darf niemanden aus der Anmeldung
 * aussperren. {@code reset-password} wird mitgebremst, obwohl das Ticket das
 * Rate-Limit nur bei {@code forgot-password} nannte: der Endpoint nimmt einen
 * sechsstelligen Code entgegen, und ohne Bremse waere ein gueltiger
 * Ruecksetzcode in einer Million Versuchen durchprobierbar; das waere eine
 * Kontouebernahme. Dieselbe Ueberlegung wie bei {@code POST /auth/verify}.
 * Entschieden in der Klaerungsrunde zu KAN-43, nachgetragen in §6.1 und §6.5
 * mit Contract v34.
 */
@Service
public class PasswordResetService {

	private final UserRepository userRepository;

	private final VerificationCodeService codeService;

	private final VerificationAttemptService attempts;

	private final MailTemplateService mailTemplateService;

	private final PasswordEncoder passwordEncoder;

	public PasswordResetService(UserRepository userRepository, VerificationCodeService codeService,
			VerificationAttemptService attempts, MailTemplateService mailTemplateService,
			PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.codeService = codeService;
		this.attempts = attempts;
		this.mailTemplateService = mailTemplateService;
		this.passwordEncoder = passwordEncoder;
	}

	// ------------------------------------------------------------------
	// POST /api/auth/forgot-password
	// ------------------------------------------------------------------

	/**
	 * Stellt einen Ruecksetzcode aus und verschickt ihn an die private Adresse.
	 *
	 * <p><strong>Die Methode antwortet immer gleich und wirft nur bei erreichter
	 * Grenze.</strong> Eine unbekannte Adresse und ein nicht aktives Konto
	 * fuehren beide dazu, dass nichts geschieht und der Controller trotzdem 204
	 * liefert; von aussen ist das von einem Versand nicht zu unterscheiden.
	 *
	 * <p>Gezaehlt wird <em>jeder</em> Aufruf, auch der erfolgreiche, wie bei
	 * {@code POST /auth/verify/resend}: der Versand selbst ist die begrenzte
	 * Ressource, sonst waere der Endpoint ein Versandgenerator fuer fremde
	 * Postfaecher (§6.5).
	 *
	 * <p>{@link VerificationCodeService#issue} entwertet alle bisher offenen
	 * Ruecksetzcodes desselben Kontos; es gilt immer nur der zuletzt
	 * verschickte.
	 *
	 * @throws AuthService.TooManyLoginAttemptsException bei erreichter Grenze (429)
	 */
	@Transactional
	public void requestReset(ForgotPasswordRequest request, String clientIp) {
		String email = EmailAddresses.normalize(request.email());
		guardAttempt(email, clientIp);

		Optional<User> found = userRepository.findByEmail(email);
		if (found.isEmpty() || found.get().getStatus() != UserStatus.ACTIVE) {
			return;
		}

		User user = found.get();
		VerificationCodeService.IssuedCode issued =
				codeService.issue(user, VerificationPurpose.PASSWORD_RESET);
		// Der Klartext existiert nur zwischen diesen beiden Zeilen; gespeichert
		// wird ausschliesslich sein Hash (§3.16), und in der Antwort steht er nie.
		mailTemplateService.sendPasswordReset(user.getEmail(), issued.plainCode(), issued.validity());
	}

	// ------------------------------------------------------------------
	// POST /api/auth/reset-password
	// ------------------------------------------------------------------

	/**
	 * Loest den Ruecksetzcode ein und setzt das neue Passwort.
	 *
	 * <p>Setzt {@code passwordChangeRequired} auf {@code false} (§6.1): das neue
	 * Passwort ist selbst gewaehlt und nur der Person bekannt, es gibt also kein
	 * fremdbekanntes Initialpasswort mehr, dessen Aenderung der Server noch
	 * erzwingen muesste. Derselbe Grundsatz wie bei {@code PUT /auth/password}.
	 *
	 * <p><strong>Unbekannte Adresse und nicht aktives Konto ergeben dieselbe
	 * Antwort wie ein falscher Code</strong>, naemlich 400
	 * {@code VERIFICATION_CODE_INVALID}, und zwar auch in der Antwortzeit: gibt
	 * es keinen Kandidaten, wird trotzdem einmal gegen den Platzhalter-Hash
	 * gerechnet. Der Statusfall ist kein theoretischer: ein Konto kann zwischen
	 * Anfordern und Einloesen deaktiviert worden sein, und die Deaktivierung
	 * muss sofort greifen (§6.5), nicht erst mit dem Ablauf des Codes.
	 *
	 * <p>Zurueckgesetzt wird der Zaehler nur bei Erfolg, wie bei
	 * {@code POST /auth/verify}: wer den Code nach ein paar Tippfehlern richtig
	 * eingibt, hat bewiesen, dass er Zugriff auf das Postfach hat.
	 *
	 * @throws AuthService.TooManyLoginAttemptsException bei erreichter Grenze (429)
	 * @throws ValidationException                       bei ungueltigem Code
	 *                                                   (400 VERIFICATION_CODE_INVALID)
	 */
	@Transactional
	public void resetPassword(ResetPasswordRequest request, String clientIp) {
		String email = EmailAddresses.normalize(request.email());
		guardAttempt(email, clientIp);

		Optional<User> found = userRepository.findByEmail(email);
		if (found.isEmpty() || found.get().getStatus() != UserStatus.ACTIVE) {
			codeService.matchPlaceholder(request.code());
			throw VerificationCodeService.invalidCodeError();
		}

		User user = found.get();
		if (!codeService.consume(user, VerificationPurpose.PASSWORD_RESET, request.code())) {
			throw VerificationCodeService.invalidCodeError();
		}

		user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
		user.setPasswordChangeRequired(false);
		userRepository.save(user);
		attempts.reset(email, clientIp);
	}

	/**
	 * Sperre pruefen und den Versuch zaehlen, in dieser Reihenfolge.
	 *
	 * <p>Die Pruefung steht vor jedem Datenbankzugriff: ein gesperrter
	 * Schluessel erfaehrt damit nichts darueber, ob es die Adresse ueberhaupt
	 * gibt. Dieselbe Reihenfolge wie im {@code RegistrationService}.
	 */
	private void guardAttempt(String email, String clientIp) {
		if (attempts.isBlocked(email, clientIp)) {
			throw AuthService.TooManyLoginAttemptsException.forVerification();
		}
		attempts.recordAttempt(email, clientIp);
	}
}
