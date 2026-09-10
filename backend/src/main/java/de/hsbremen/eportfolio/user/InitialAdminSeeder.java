package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.auth.PasswordPolicy;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Legt das <strong>erste</strong> ADMIN-Konto einer frisch aufgesetzten
 * Umgebung an (KAN-99).
 *
 * <p><strong>Das Problem, das diese Klasse loest.</strong> Nach dem ersten Start
 * einer neuen Umgebung ist {@code app_user} leer, und es gibt keinen Weg zu
 * einem Admin: {@code RegistrationService} leitet die Rolle aus der Domain der
 * Hochschuladresse ab und kann nachweislich nie {@code ADMIN} ergeben (§3.1.1),
 * waehrend {@code SecurityConfig} fuer {@code /api/admin/**} genau diese Rolle
 * verlangt (§5). Ohne Admin bleiben Kategorien, Semester, Top 10, die
 * Startseitentexte und die gesamte Kontoverwaltung dauerhaft unerreichbar. Die
 * Instanz laesst sich dann anschauen, aber nicht betreiben.
 *
 * <p><strong>Warum im Programmcode und nicht als Handgriff.</strong> Der
 * naheliegende Weg waere, sich regulaer zu registrieren und die Rolle einmalig
 * per SQL hochzustufen. Das funktioniert, ist aber nicht wiederholbar: bei einem
 * neuen Server, einem geloeschten Volume oder einer Uebergabe an die Hochschule
 * faengt man von vorn an, und der Weg steht dann nur in einem Dokument.
 * Entschieden in der Klaerungsrunde zu KAN-99 am 09.09.2026.
 *
 * <p><strong>Zwei Riegel, und beide muessen fallen.</strong> Diese Klasse legt
 * ein Konto an und ist damit die gefaehrlichste Art von Code in einem
 * ausgelieferten Programm. Sie wird deshalb doppelt gesichert:
 * <ol>
 *   <li>Alle drei Werte {@code BOOTSTRAP_ADMIN_EMAIL},
 *       {@code BOOTSTRAP_ADMIN_HSB_EMAIL} und {@code BOOTSTRAP_ADMIN_PASSWORD}
 *       muessen gesetzt sein. Fehlt einer, geschieht nichts. Es gibt bewusst
 *       keinen Vorgabewert: ein eingebautes Standardpasswort waere ein
 *       oeffentlich bekannter Zugang zu jeder Installation.</li>
 *   <li>{@code app_user} muss <strong>vollstaendig leer</strong> sein. Damit
 *       kann der Runner eine bestehende Installation nicht uebernehmen, auch
 *       dann nicht, wenn die Werte in der Umgebung stehen bleiben. Er ist ein
 *       Erstaufsetz-Werkzeug und kein Wartungswerkzeug.</li>
 * </ol>
 *
 * <p><strong>Warum {@code passwordChangeRequired = true}.</strong> Das
 * Initialpasswort steht in der Umgebung des Prozesses und ist damit fuer jedes
 * Mitglied der Gruppe {@code docker} ueber {@code docker inspect} lesbar. Es ist
 * genau der Fall aus §6.7, den die Kontoanlage durch die Administration schon
 * kennt: eine zweite Partei kennt das Passwort, also wird die Aenderung bei der
 * ersten Anmeldung erzwungen.
 *
 * <p><strong>Warum die Reihenfolge festgelegt ist.</strong> Die Ausfuehrung
 * mehrerer {@link ApplicationRunner} ist ohne {@link Order} nicht bestimmt.
 * Ohne eine Festlegung koennte dieser Runner in einer frischen
 * Entwicklungsdatenbank <em>vor</em> {@link DevTestUserSeeder} laufen, dort eine
 * leere Tabelle vorfinden und ein viertes Konto anlegen. Das waere nicht
 * gefaehrlich, aber es machte Testlaeufe vom Zufall abhaengig. Dieser Runner
 * traegt deshalb die spaetere Ordnungszahl und sieht die Dev-Testkonten
 * garantiert schon.
 *
 * <p>Liegt im Paket {@code user}, weil der Konstruktor von {@link User} fuer JPA
 * {@code protected} ist. Dieselbe Ueberlegung wie beim
 * {@link DevTestUserSeeder}.
 */
@Component
@Order(InitialAdminSeeder.ORDER)
public class InitialAdminSeeder implements ApplicationRunner {

	/**
	 * Laeuft nach {@link DevTestUserSeeder#ORDER}. Siehe Klassen-Javadoc: die
	 * Reihenfolge ist festgelegt, damit eine frische Entwicklungsdatenbank nicht
	 * je nach Zufall ein zusaetzliches Konto bekommt.
	 */
	public static final int ORDER = 100;

	private static final Logger LOG = LoggerFactory.getLogger(InitialAdminSeeder.class);

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	/** Portfolio im selben Vorgang wie das Konto, dritter Anlageweg aus §3.2.1. */
	private final PortfolioService portfolioService;

	private final String email;

	private final String hsbEmail;

	private final String password;

	private final String firstName;

	private final String lastName;

	public InitialAdminSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder,
			PortfolioService portfolioService,
			@Value("${BOOTSTRAP_ADMIN_EMAIL:}") String email,
			@Value("${BOOTSTRAP_ADMIN_HSB_EMAIL:}") String hsbEmail,
			@Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String password,
			@Value("${BOOTSTRAP_ADMIN_FIRST_NAME:System}") String firstName,
			@Value("${BOOTSTRAP_ADMIN_LAST_NAME:Administration}") String lastName) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.portfolioService = portfolioService;
		this.email = email;
		this.hsbEmail = hsbEmail;
		this.password = password;
		this.firstName = firstName;
		this.lastName = lastName;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (isBlank(email) || isBlank(hsbEmail) || isBlank(password)) {
			// Der Regelfall in jeder Entwicklungsumgebung. Bewusst kein warn:
			// eine Warnung bei jedem Start waere Laerm, den niemand mehr liest.
			LOG.debug("Kein Bootstrap-Admin: BOOTSTRAP_ADMIN_EMAIL, "
					+ "BOOTSTRAP_ADMIN_HSB_EMAIL oder BOOTSTRAP_ADMIN_PASSWORD fehlt.");
			return;
		}

		// Zu kurz ist ein Fehler und kein Grund zum Weitermachen: ein
		// Admin-Konto mit schwachem Passwort waere schlimmer als gar keines,
		// weil niemand mehr danach sucht. Dieselbe Grenze wie fuer jedes
		// selbst gewaehlte Passwort (§3.1.1).
		if (password.length() < PasswordPolicy.MIN_LENGTH) {
			LOG.error("Kein Bootstrap-Admin: BOOTSTRAP_ADMIN_PASSWORD ist kuerzer als {} Zeichen.",
					PasswordPolicy.MIN_LENGTH);
			return;
		}

		long vorhandene = userRepository.count();
		if (vorhandene > 0) {
			// Der zweite Riegel. Steht die Umgebung dauerhaft, laeuft der Runner
			// bei jedem Start hier hinein; das ist der gewollte Normalfall nach
			// dem Erstaufsetzen.
			LOG.info("Kein Bootstrap-Admin: es bestehen bereits {} Konten.", vorhandene);
			return;
		}

		User user = new User();
		// email = private Adresse und damit die Anmeldekennung.
		user.setEmail(email);
		// hsbEmail = Zugehoerigkeitsnachweis (§3.1). Mit ihr ist keine Anmeldung
		// moeglich; sie steht hier, weil die Spalte not null ist.
		user.setHsbEmail(hsbEmail);
		// Beide Bestaetigungen gesetzt: der Flow aus §3.1.1 verschickt Codes an
		// zwei Postfaecher, und genau das ist beim Erstaufsetzen niemand da, um
		// zu bestaetigen. Wer die Werte setzt, hat Zugriff auf den Server und
		// belegt die Zugehoerigkeit damit staerker als eine Mail es koennte.
		user.setEmailVerified(true);
		user.setHsbEmailVerified(true);
		user.setPasswordHash(passwordEncoder.encode(password));
		user.setFirstName(firstName);
		user.setLastName(lastName);
		user.setRole(Role.ADMIN);
		// Nur ACTIVE kann sich anmelden (§2.9).
		user.setStatus(UserStatus.ACTIVE);
		// §6.7: eine zweite Partei kennt das Initialpasswort.
		user.setPasswordChangeRequired(true);

		User saved = userRepository.save(user);
		portfolioService.createFor(saved);

		// warn und nicht info: das ist ein Vorgang, der genau einmal im Leben
		// einer Installation vorkommt und im Protokoll auffallen soll.
		LOG.warn("Bootstrap-Admin angelegt: {}. Das Passwort stammt aus der Umgebung und ist "
				+ "bei der ersten Anmeldung zu aendern. Danach koennen die "
				+ "BOOTSTRAP_ADMIN_-Werte aus der Umgebung entfernt werden.", email);
	}

	private static boolean isBlank(String wert) {
		return wert == null || wert.isBlank();
	}
}
