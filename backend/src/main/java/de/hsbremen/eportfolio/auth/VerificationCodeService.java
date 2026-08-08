package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.config.RegistrationProperties;
import de.hsbremen.eportfolio.user.User;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Erzeugt, prueft und entwertet die Einmalcodes aus API-Contract §3.16.
 *
 * <p>Die Klasse ist die einzige Stelle, an der ein Code im Klartext existiert,
 * und zwar ausschliesslich als Rueckgabewert von {@link #issue}, damit der
 * Aufrufer ihn dem Mailmodul uebergeben kann. In der Datenbank steht nur der
 * BCrypt-Hash.
 *
 * <p><strong>Warum BCrypt und kein schneller Hash.</strong> Es ist derselbe
 * {@code PasswordEncoder} wie beim Passwort, also dieselbe Einstellung, dasselbe
 * Salt-Verhalten und keine zweite Stelle, an der ueber ein Hashverfahren
 * entschieden wird. Die Kosten fallen nicht ins Gewicht: je Registrierung sind
 * es zwei Hashes, je Verifizierung ein Vergleich. Der Preis ist, dass sich ein
 * Code nicht ueber den Hash <em>suchen</em> laesst; gesucht wird deshalb ueber
 * Konto und Zweck, und die wenigen offenen Codes werden einzeln verglichen.
 *
 * <p><strong>Erzeugt wird mit {@link SecureRandom}</strong> (§3.1.1). Sechs
 * Stellen sind eine Million Moeglichkeiten; ein vorhersagbarer Generator wie
 * {@code Math.random} macht daraus faktisch eine.
 */
@Service
public class VerificationCodeService {

	private static final Logger LOG = LoggerFactory.getLogger(VerificationCodeService.class);

	/**
	 * Sechs Stellen mit fuehrenden Nullen (§3.1.1). Der Bereich ist bewusst
	 * {@code 000000} bis {@code 999999} und nicht {@code 100000} aufwaerts: die
	 * fuehrende Null wegzulassen strich ein Zehntel des Wertebereichs, ohne dass
	 * irgendetwas dadurch besser wuerde.
	 */
	private static final int CODE_BOUND = 1_000_000;

	private static final String CODE_FORMAT = "%06d";

	/**
	 * BCrypt-Hash eines Zufallswerts, gegen den geprueft wird, wenn es gar keinen
	 * Kandidaten gibt. Dient ausschliesslich dazu, den Zeitaufwand anzugleichen;
	 * das zugehoerige Klartextgeheimnis existiert nirgends. Dieselbe Ueberlegung
	 * und derselbe Wert wie in {@code AuthService}.
	 */
	private static final String PLACEHOLDER_HASH =
			"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

	private final VerificationCodeRepository codeRepository;

	private final PasswordEncoder passwordEncoder;

	private final RegistrationProperties properties;

	private final Clock clock;

	private final SecureRandom random = new SecureRandom();

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll.
	 */
	@Autowired
	public VerificationCodeService(VerificationCodeRepository codeRepository,
			PasswordEncoder passwordEncoder, RegistrationProperties properties) {
		this(codeRepository, passwordEncoder, properties, Clock.systemUTC());
	}

	/** Fuer Tests, die den Ablauf eines Codes ohne Warten pruefen muessen. */
	VerificationCodeService(VerificationCodeRepository codeRepository, PasswordEncoder passwordEncoder,
			RegistrationProperties properties, Clock clock) {
		this.codeRepository = codeRepository;
		this.passwordEncoder = passwordEncoder;
		this.properties = properties;
		this.clock = clock;
	}

	/**
	 * Der ausgestellte Code im Klartext, zusammen mit seiner Gueltigkeitsdauer.
	 *
	 * <p>Beides gehoert zusammen, weil die Mail beides nennt: den Code und wie
	 * lange er gilt. Gaebe der Aufrufer die Dauer selbst an, koennte die Mail
	 * eine andere Frist nennen als die Pruefung anwendet.
	 *
	 * <p>Bewusst ohne {@code toString}-Ueberschreibung mit Inhalt: das Record
	 * traegt ein Einmalgeheimnis, und eine einzige spaetere Logzeile
	 * {@code log.debug("{}", issued)} wuerde es ins Protokoll tragen.
	 */
	public record IssuedCode(String plainCode, Duration validity) {

		@Override
		public String toString() {
			return "IssuedCode[plainCode=***, validity=" + validity + "]";
		}
	}

	/**
	 * Stellt einen neuen Code aus und <strong>entwertet alle bisher offenen</strong>
	 * desselben Kontos und Zwecks (§6.1, {@code /auth/verify/resend}).
	 *
	 * <p>Das Entwerten ist der Grund, warum es diese Methode und nicht nur ein
	 * {@code save} gibt: bliebe der alte Code gueltig, haette ein erneutes Senden
	 * die Zahl der gleichzeitig gueltigen Geheimnisse erhoeht statt den alten zu
	 * ersetzen, und niemand koennte nachvollziehen, welcher Code gerade zaehlt.
	 *
	 * @return Klartext und Gueltigkeitsdauer; der Klartext ist danach nirgends
	 *         mehr abrufbar
	 */
	@Transactional
	public IssuedCode issue(User user, VerificationPurpose purpose) {
		invalidateOpenCodes(user, purpose);

		String plainCode = CODE_FORMAT.formatted(random.nextInt(CODE_BOUND));
		Duration validity = properties.codeLifetime();

		VerificationCode code = new VerificationCode();
		code.setUser(user);
		code.setPurpose(purpose);
		code.setCodeHash(passwordEncoder.encode(plainCode));
		code.setExpiresAt(Instant.now(clock).plus(validity));
		code.setConsumed(false);
		codeRepository.save(code);

		return new IssuedCode(plainCode, validity);
	}

	/**
	 * Prueft den eingegebenen Code und verbraucht ihn bei Treffer.
	 *
	 * <p>Geprueft werden alle offenen Codes dieses Kontos und Zwecks, nicht nur
	 * der neueste: im Regelfall ist es ohnehin genau einer, und liegen ausnahmsweise
	 * zwei vor, laege einer davon in einem Postfach und wuerde grundlos abgelehnt.
	 * Abgelaufene Codes werden uebersprungen, nicht abgelehnt: fuer die Antwort
	 * macht das keinen Unterschied, §6.2 fuehrt „ungueltig, abgelaufen oder bereits
	 * verbraucht" unter demselben Code {@code VERIFICATION_CODE_INVALID}.
	 *
	 * <p><strong>Findet sich kein Kandidat, wird trotzdem einmal gehasht.</strong>
	 * Sonst antwortete ein Konto ohne offenen Code messbar schneller als eines mit
	 * falsch eingegebenem Code, und aus der Antwortzeit liesse sich ablesen, ob
	 * gerade eine Verifizierung offen ist.
	 *
	 * @return {@code true}, wenn der Code gepasst hat und jetzt verbraucht ist
	 */
	@Transactional
	public boolean consume(User user, VerificationPurpose purpose, String submittedCode) {
		Instant now = Instant.now(clock);
		boolean compared = false;

		for (VerificationCode candidate : openCodes(user, purpose)) {
			if (!candidate.isUsable(now)) {
				continue;
			}
			compared = true;
			if (passwordEncoder.matches(submittedCode, candidate.getCodeHash())) {
				candidate.setConsumed(true);
				codeRepository.save(candidate);
				return true;
			}
		}

		if (!compared) {
			matchPlaceholder(submittedCode);
		}
		return false;
	}

	/**
	 * Verbraucht denselben Zeitaufwand wie eine echte Pruefung, ohne etwas zu
	 * pruefen.
	 *
	 * <p>Aufzurufen, wenn es zu der eingegebenen Adresse gar kein Konto gibt.
	 * §6.1 verlangt fuer bekannte und unbekannte Adressen dieselbe Antwort; das
	 * gilt auch fuer die Zeit, die sie braucht, sonst waere der Endpoint ueber eine
	 * Stoppuhr doch wieder ein Verzeichnis registrierter Adressen.
	 */
	public void matchPlaceholder(String submittedCode) {
		passwordEncoder.matches(submittedCode == null ? "" : submittedCode, PLACEHOLDER_HASH);
	}

	/** Entwertet alle offenen Codes eines Kontos zu einem Zweck. */
	private void invalidateOpenCodes(User user, VerificationPurpose purpose) {
		List<VerificationCode> open = openCodes(user, purpose);
		open.forEach(code -> code.setConsumed(true));
		codeRepository.saveAll(open);
	}

	private List<VerificationCode> openCodes(User user, VerificationPurpose purpose) {
		return codeRepository.findByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
				user.getId(), purpose);
	}

	// ------------------------------------------------------------------
	// §3.16: Aufraeumen
	// ------------------------------------------------------------------

	/**
	 * Entfernt verbrauchte und abgelaufene Codes (§3.16).
	 *
	 * <p>Ohne dieses Aufraeumen wuechse die Tabelle mit jedem Registrierungs-
	 * versuch und jedem erneuten Senden dauerhaft weiter, obwohl keine dieser
	 * Zeilen noch einen Zweck hat: der dauerhafte Nachweis der Verifizierung sind
	 * die Flags am Konto (§3.1), nicht diese Tabelle.
	 *
	 * <p>Der erste Lauf ist bewusst verzoegert. Ein Aufraeumen unmittelbar beim
	 * Start braechte nichts, was eine Stunde spaeter nicht genauso gaebe, und
	 * liefe in jedem Test- und Entwicklungsstart mit.
	 */
	@Scheduled(initialDelay = 1, fixedDelay = 6, timeUnit = TimeUnit.HOURS)
	@Transactional
	public void removeSpentCodes() {
		long removed = codeRepository.deleteByConsumedTrueOrExpiresAtBefore(Instant.now(clock));
		if (removed > 0) {
			LOG.info("{} verbrauchte oder abgelaufene Verifizierungscodes entfernt (§3.16).", removed);
		}
	}
}
