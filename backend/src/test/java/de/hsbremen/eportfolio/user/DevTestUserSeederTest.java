package de.hsbremen.eportfolio.user;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der Dev-Seeder als dritter Anlageweg aus §3.2.1 (KAN-22): jedes Testkonto
 * bekommt sein Portfolio, und ein wiederholter Lauf legt keine zweite Zeile an.
 *
 * <p><strong>Der Seeder wird hier selbst gebaut</strong> statt aus dem Kontext
 * geholt: so steht das Testpasswort im Test und der Fall haengt nicht daran, ob
 * in der {@code .env} der Entwicklungsmaschine gerade ein
 * {@code DEV_TEST_PASSWORD} gesetzt ist. Die Bestandteile (Repositories,
 * Encoder, {@link PortfolioService}) kommen unveraendert aus dem Kontext, es
 * wird also derselbe Ablauf geprueft wie beim Anwendungsstart.
 *
 * <p><strong>Der Lauf ist idempotent in zwei Richtungen.</strong> Die drei
 * Konten existieren in einer gewachsenen Entwicklungsdatenbank bereits, ihre
 * Portfolio-Zeile aber unter Umstaenden noch nicht; auf einer frischen
 * Datenbank ist beides neu. Beide Ausgangslagen muessen zum selben Ergebnis
 * fuehren, und genau das prueft dieser Test, indem er zweimal laeuft.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@Transactional
class DevTestUserSeederTest {

	/** Die Login-Kennungen aus dem Seeder, also die privaten Adressen (§3.1.1). */
	private static final List<String> SEED_ACCOUNTS = List.of(
			"dev-studi@dev.invalid",
			"dev-redakteur@dev.invalid",
			"dev-admin@dev.invalid");

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private PortfolioService portfolioService;

	@Autowired
	private PortfolioRepository portfolioRepository;

	private DevTestUserSeeder seeder;

	@BeforeEach
	void buildSeeder() {
		seeder = new DevTestUserSeeder(userRepository, passwordEncoder, portfolioService,
				"seeder-test-passwort");
	}

	@Test
	@DisplayName("Legt fuer jedes Seed-Konto ein Portfolio an (§3.2.1)")
	void createsPortfolioForEverySeedAccount() {
		seeder.run(null);

		for (String email : SEED_ACCOUNTS) {
			User user = userRepository.findByEmail(email).orElseThrow(
					() -> new AssertionError("Seed-Konto fehlt: " + email));
			assertThat(portfolioRepository.findByUserId(user.getId()))
					.as("Portfolio zu %s", email)
					.isPresent();
		}
	}

	@Test
	@DisplayName("Mehrfach ausfuehrbar: der zweite Lauf legt weder Konto noch Portfolio erneut an")
	void isIdempotent() {
		seeder.run(null);
		long usersAfterFirstRun = userRepository.count();
		long portfoliosAfterFirstRun = portfolioRepository.count();

		seeder.run(null);

		assertThat(userRepository.count()).isEqualTo(usersAfterFirstRun);
		assertThat(portfolioRepository.count()).isEqualTo(portfoliosAfterFirstRun);
	}

	@Test
	@DisplayName("Ergaenzt das Portfolio auch fuer ein Konto, das den Seeder schon ueberlebt hat")
	void addsPortfolioToExistingAccount() {
		seeder.run(null);

		User existing = userRepository.findByEmail(SEED_ACCOUNTS.get(0)).orElseThrow();
		portfolioRepository.findByUserId(existing.getId()).ifPresent(portfolioRepository::delete);
		portfolioRepository.flush();

		seeder.run(null);

		assertThat(portfolioRepository.findByUserId(existing.getId())).isPresent();
	}

	@Test
	@DisplayName("Ohne gesetztes Testpasswort legt der Seeder nichts an")
	void withoutPasswordNothingHappens() {
		long usersBefore = userRepository.count();
		long portfoliosBefore = portfolioRepository.count();

		new DevTestUserSeeder(userRepository, passwordEncoder, portfolioService, "").run(null);

		assertThat(userRepository.count()).isEqualTo(usersBefore);
		assertThat(portfolioRepository.count()).isEqualTo(portfoliosBefore);
	}
}
