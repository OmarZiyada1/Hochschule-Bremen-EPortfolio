package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Legt je einen aktiven Testnutzer pro Rolle an, <strong>nur im Profil
 * dev</strong>.
 *
 * <p>Bewusst ein Seeder und keine Flyway-Migration:
 * <ul>
 *   <li>Der BCrypt-Hash entsteht zur Laufzeit. In einer Migration muesste ein
 *       fertiger Hash als SQL-Literal im Repository liegen; zusammen mit dem
 *       zugehoerigen Klartextpasswort waere das ein eingecheckter Zugang.</li>
 *   <li>Die {@code flyway_schema_history} bleibt in allen Umgebungen gleich.
 *       Ein zusaetzlicher, nur im dev-Profil geladener Migrationsordner
 *       erzeugt dagegen abweichende Historien, was spaetere Migrationen
 *       schwerer nachvollziehbar macht.</li>
 * </ul>
 *
 * <p>Die bestehenden Migrationen aus KAN-4 und KAN-9 bleiben unberuehrt.
 *
 * <p>Liegt im Paket {@code user}, weil der Konstruktor von {@link User}
 * bewusst {@code protected} ist (JPA). Die Entity aus KAN-4 bleibt dadurch
 * unveraendert.
 *
 * <p>Alle drei Konten tragen die Domain {@code @dev.invalid} (RFC 2606,
 * garantiert nicht aufloesbar) und ein sprechendes {@code dev-}-Praefix. Sie
 * sind damit auf einen Blick als Testdaten erkennbar und koennen niemals mit
 * echten HSB-Adressen kollidieren.
 *
 * <p><strong>Jedes Konto bekommt sein Portfolio</strong> (KAN-22). §3.2.1 zaehlt
 * den Dev-Seeder als einen der drei Anlagewege auf, und ohne ihn liefen die
 * Portfolio-Endpoints in der Entwicklungsumgebung gegen eine leere Tabelle. Die
 * Anlage laeuft ueber {@link PortfolioService#createFor(User)}, also ueber
 * dieselbe idempotente Methode wie Registrierung (KAN-26) und Kontoanlage durch
 * die Administration (KAN-25); eine zweite Anlagestelle entsteht hier
 * ausdruecklich nicht.
 */
@Component
@Profile("dev")
public class DevTestUserSeeder implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(DevTestUserSeeder.class);

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	/**
	 * Der dritte Anlageweg aus §3.2.1. Das Portfolio entsteht zusammen mit dem
	 * Konto und nicht erst beim ersten Schreibzugriff; siehe
	 * {@link PortfolioService#createFor(User)}.
	 */
	private final PortfolioService portfolioService;

	/**
	 * Passwort der Testkonten. Kommt aus der nicht eingecheckten {@code .env};
	 * ohne den Wert legt der Seeder nichts an, statt auf ein fest verdrahtetes
	 * Standardpasswort zurueckzufallen.
	 */
	private final String testPassword;

	public DevTestUserSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder,
			PortfolioService portfolioService,
			@Value("${DEV_TEST_PASSWORD:}") String testPassword) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.portfolioService = portfolioService;
		this.testPassword = testPassword;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (testPassword == null || testPassword.isBlank()) {
			LOG.warn("DEV_TEST_PASSWORD ist nicht gesetzt - es werden keine Testnutzer angelegt. "
					+ "Wert in der .env ergaenzen (Vorlage: .env.example).");
			return;
		}

		createIfMissing("dev-studi@dev.invalid", "dev-studi@stud.hs-bremen.de",
				"Dev", "Studierende", Role.STUDENT);
		createIfMissing("dev-redakteur@dev.invalid", "dev-redakteur@hs-bremen.de",
				"Dev", "Redakteur", Role.EDITOR);
		createIfMissing("dev-admin@dev.invalid", "dev-admin@hs-bremen.de",
				"Dev", "Admin", Role.ADMIN);
	}

	/**
	 * Legt das Konto an, falls es fehlt, und stellt in jedem Fall sicher, dass es
	 * ein Portfolio hat (§3.2.1).
	 *
	 * <p>Die Portfolio-Anlage steht bewusst <em>ausserhalb</em> der Abfrage auf
	 * ein vorhandenes Konto: die drei Testkonten existieren in jeder
	 * Entwicklungsdatenbank bereits seit KAN-5, ihre Portfolio-Zeile aber erst
	 * seit KAN-22. Stuende der Aufruf im Anlagezweig, bekaeme genau die
	 * vorhandene Datenbank nie eines. {@code createFor} ist idempotent, ein
	 * wiederholter Start legt also keine zweite Zeile an.
	 */
	private void createIfMissing(String email, String hsbEmail, String firstName, String lastName, Role role) {
		User existing = userRepository.findByEmail(email).orElse(null);
		if (existing != null) {
			portfolioService.createFor(existing);
			return;
		}

		User user = new User();
		// email = private Adresse und damit die Login-Kennung.
		user.setEmail(email);
		// hsbEmail = Zugehoerigkeitsnachweis. Mit dieser Adresse ist keine
		// Anmeldung moeglich - der Seeder legt sie nur an, weil die Spalte
		// not null ist.
		user.setHsbEmail(hsbEmail);
		user.setEmailVerified(true);
		user.setHsbEmailVerified(true);
		user.setPasswordHash(passwordEncoder.encode(testPassword));
		user.setFirstName(firstName);
		user.setLastName(lastName);
		user.setRole(role);
		// Nur ACTIVE kann sich anmelden (§2.9).
		user.setStatus(UserStatus.ACTIVE);

		User saved = userRepository.save(user);
		// Portfolio im selben Vorgang wie das Konto (§3.2.1).
		portfolioService.createFor(saved);
		LOG.info("Dev-Testnutzer angelegt: {} ({})", email, role);
	}
}
