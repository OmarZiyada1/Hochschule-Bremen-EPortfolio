package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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
 */
@Component
@Profile("dev")
public class DevTestUserSeeder implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(DevTestUserSeeder.class);

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	/**
	 * Passwort der Testkonten. Kommt aus der nicht eingecheckten {@code .env};
	 * ohne den Wert legt der Seeder nichts an, statt auf ein fest verdrahtetes
	 * Standardpasswort zurueckzufallen.
	 */
	private final String testPassword;

	public DevTestUserSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder,
			@Value("${DEV_TEST_PASSWORD:}") String testPassword) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
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

	private void createIfMissing(String email, String hsbEmail, String firstName, String lastName, Role role) {
		if (userRepository.findByEmail(email).isPresent()) {
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

		userRepository.save(user);
		LOG.info("Dev-Testnutzer angelegt: {} ({})", email, role);
	}
}
