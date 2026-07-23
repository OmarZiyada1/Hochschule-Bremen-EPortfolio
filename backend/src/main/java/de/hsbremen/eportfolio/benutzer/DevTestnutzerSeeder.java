package de.hsbremen.eportfolio.benutzer;

import de.hsbremen.eportfolio.common.enums.Rolle;
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
 * Legt je einen aktiven Testnutzer pro Rolle an — <strong>nur im Profil
 * dev</strong>.
 *
 * <p>Bewusst ein Seeder und keine Flyway-Migration:
 * <ul>
 *   <li>Der BCrypt-Hash entsteht zur Laufzeit. In einer Migration muesste ein
 *       fertiger Hash als SQL-Literal im Repository liegen — zusammen mit dem
 *       zugehoerigen Klartextpasswort waere das ein eingecheckter Zugang.</li>
 *   <li>Die {@code flyway_schema_history} bleibt in allen Umgebungen gleich.
 *       Ein zusaetzlicher, nur im dev-Profil geladener Migrationsordner
 *       erzeugt dagegen abweichende Historien, was spaetere Migrationen
 *       schwerer nachvollziehbar macht.</li>
 * </ul>
 *
 * <p>Die bestehenden Migrationen aus KAN-4 und KAN-9 bleiben unberuehrt.
 *
 * <p>Liegt im Paket {@code benutzer}, weil der Konstruktor von {@link User}
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
public class DevTestnutzerSeeder implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(DevTestnutzerSeeder.class);

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	/**
	 * Passwort der Testkonten. Kommt aus der nicht eingecheckten {@code .env};
	 * ohne den Wert legt der Seeder nichts an, statt auf ein fest verdrahtetes
	 * Standardpasswort zurueckzufallen.
	 */
	private final String testPasswort;

	public DevTestnutzerSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder,
			@Value("${DEV_TEST_PASSWORT:}") String testPasswort) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.testPasswort = testPasswort;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (testPasswort == null || testPasswort.isBlank()) {
			LOG.warn("DEV_TEST_PASSWORT ist nicht gesetzt - es werden keine Testnutzer angelegt. "
					+ "Wert in der .env ergaenzen (Vorlage: .env.example).");
			return;
		}

		legeAnFallsFehlend("dev-studi@dev.invalid", "dev-studi@stud.hs-bremen.de",
				"Dev", "Studierende", Rolle.STUDIERENDE);
		legeAnFallsFehlend("dev-redakteur@dev.invalid", "dev-redakteur@hs-bremen.de",
				"Dev", "Redakteur", Rolle.REDAKTEUR);
		legeAnFallsFehlend("dev-admin@dev.invalid", "dev-admin@hs-bremen.de",
				"Dev", "Admin", Rolle.ADMIN);
	}

	private void legeAnFallsFehlend(String email, String hsbEmail, String vorname, String nachname, Rolle rolle) {
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
		user.setEmailVerifiziert(true);
		user.setHsbEmailVerifiziert(true);
		user.setPasswortHash(passwordEncoder.encode(testPasswort));
		user.setVorname(vorname);
		user.setNachname(nachname);
		user.setRolle(rolle);
		// Nur AKTIV kann sich anmelden (§2.9).
		user.setStatus(UserStatus.AKTIV);

		userRepository.save(user);
		LOG.info("Dev-Testnutzer angelegt: {} ({})", email, rolle);
	}
}
