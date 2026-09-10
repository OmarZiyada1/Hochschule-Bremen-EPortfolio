package de.hsbremen.eportfolio.user;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der Bootstrap des ersten ADMIN-Kontos (KAN-99).
 *
 * <p>Diese Klasse legt Konten an und laeuft anders als der
 * {@link DevTestUserSeeder} <strong>in jedem Profil</strong>, also auch im
 * Betrieb. Getestet wird deshalb nicht nur, dass sie das Richtige tut, sondern
 * vor allem, dass sie es <strong>nicht</strong> tut, sobald einer der beiden
 * Riegel steht: fehlende Umgebungswerte oder eine nicht leere Tabelle. Der
 * zweite Fall ist der wichtigere, denn er ist der Unterschied zwischen einem
 * Erstaufsetz-Werkzeug und einer Hintertuer.
 *
 * <p><strong>Der Seeder wird hier selbst gebaut</strong> und nicht aus dem
 * Kontext geholt, genau wie beim {@link DevTestUserSeeder}: so stehen die Werte
 * im Test, und der Fall haengt nicht daran, was in der {@code .env} der
 * Entwicklungsmaschine gerade gesetzt ist.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, auch das Leeren der
 * Tabelle im Zweig fuer die frische Umgebung.
 */
@SpringBootTest
@Transactional
class InitialAdminSeederTest {

	private static final String EMAIL = "bootstrap-admin@test.invalid";

	private static final String HSB_EMAIL = "bootstrap-admin@hs-bremen.de";

	/** Zwoelf Zeichen, also genau an der Grenze aus {@code PasswordPolicy}. */
	private static final String PASSWORT = "bootstrap-99";

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private PortfolioService portfolioService;

	@Autowired
	private PortfolioRepository portfolioRepository;

	private InitialAdminSeeder seeder(String email, String hsbEmail, String passwort) {
		return new InitialAdminSeeder(userRepository, passwordEncoder, portfolioService,
				email, hsbEmail, passwort, "System", "Administration");
	}

	private InitialAdminSeeder seeder() {
		return seeder(EMAIL, HSB_EMAIL, PASSWORT);
	}

	/**
	 * Versetzt die Datenbank in den Zustand einer frisch aufgesetzten Umgebung.
	 *
	 * <p>Portfolios zuerst: {@code portfolio.user_id} zeigt auf {@code app_user},
	 * und die andere Reihenfolge liefe in den Fremdschluessel.
	 */
	private void leereKontotabelle() {
		portfolioRepository.deleteAll();
		portfolioRepository.flush();
		userRepository.deleteAll();
		userRepository.flush();
	}

	@Nested
	@DisplayName("Frische Umgebung, alle Werte gesetzt")
	class FrischeUmgebung {

		@Test
		@DisplayName("Legt genau ein Konto an, und zwar mit der Rolle ADMIN")
		void legtAdminAn() {
			leereKontotabelle();

			seeder().run(null);

			assertThat(userRepository.count()).isEqualTo(1);
			User admin = userRepository.findByEmail(EMAIL).orElseThrow(
					() -> new AssertionError("Bootstrap-Admin fehlt"));
			assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
			assertThat(admin.getStatus()).isEqualTo(UserStatus.ACTIVE);
		}

		@Test
		@DisplayName("Das Konto ist anmeldbar: beide Bestaetigungen stehen, das Passwort passt")
		void istAnmeldbar() {
			leereKontotabelle();

			seeder().run(null);

			User admin = userRepository.findByEmail(EMAIL).orElseThrow();
			assertThat(admin.isEmailVerified()).isTrue();
			assertThat(admin.isHsbEmailVerified()).isTrue();
			assertThat(passwordEncoder.matches(PASSWORT, admin.getPasswordHash()))
					.as("das gesetzte Passwort muss zum gespeicherten Hash passen")
					.isTrue();
		}

		@Test
		@DisplayName("Die Passwortaenderung ist erzwungen (§6.7): eine zweite Partei kennt das Initialpasswort")
		void erzwingtPasswortaenderung() {
			leereKontotabelle();

			seeder().run(null);

			assertThat(userRepository.findByEmail(EMAIL).orElseThrow().isPasswordChangeRequired())
					.isTrue();
		}

		@Test
		@DisplayName("Das Konto bekommt sein Portfolio (§3.2.1)")
		void legtPortfolioAn() {
			leereKontotabelle();

			seeder().run(null);

			User admin = userRepository.findByEmail(EMAIL).orElseThrow();
			assertThat(portfolioRepository.findByUserId(admin.getId())).isPresent();
		}

		@Test
		@DisplayName("Ein zweiter Lauf legt kein zweites Konto an, weil die Tabelle dann nicht mehr leer ist")
		void zweiterLaufLegtNichtsAn() {
			leereKontotabelle();

			seeder().run(null);
			long nachErstemLauf = userRepository.count();
			seeder().run(null);

			assertThat(userRepository.count()).isEqualTo(nachErstemLauf);
		}
	}

	@Nested
	@DisplayName("Riegel: der Runner darf nichts anlegen")
	class Riegel {

		@Test
		@DisplayName("Bestehende Konten: der Runner uebernimmt keine laufende Installation")
		void bestehendeKonteBlockieren() {
			// Die Dev-Testkonten aus dem Kontextstart genuegen als Bestand. Falls
			// die Umgebung ohne DEV_TEST_PASSWORD laeuft, wird hier eines angelegt,
			// damit der Fall auch dann geprueft wird.
			if (userRepository.count() == 0) {
				seeder("vorhandener@test.invalid", "vorhandener@hs-bremen.de", PASSWORT).run(null);
			}
			long vorher = userRepository.count();
			assertThat(vorher).isPositive();

			seeder().run(null);

			assertThat(userRepository.count()).isEqualTo(vorher);
			assertThat(userRepository.findByEmail(EMAIL)).isEmpty();
		}

		@Test
		@DisplayName("Fehlende Adresse: kein Konto")
		void ohneAdresseNichts() {
			leereKontotabelle();

			seeder("", HSB_EMAIL, PASSWORT).run(null);

			assertThat(userRepository.count()).isZero();
		}

		@Test
		@DisplayName("Fehlende Hochschuladresse: kein Konto")
		void ohneHsbAdresseNichts() {
			leereKontotabelle();

			seeder(EMAIL, "   ", PASSWORT).run(null);

			assertThat(userRepository.count()).isZero();
		}

		@Test
		@DisplayName("Fehlendes Passwort: kein Konto")
		void ohnePasswortNichts() {
			leereKontotabelle();

			seeder(EMAIL, HSB_EMAIL, "").run(null);

			assertThat(userRepository.count()).isZero();
		}

		@Test
		@DisplayName("Zu kurzes Passwort: kein Konto, statt eines schwachen Admins")
		void zuKurzesPasswortNichts() {
			leereKontotabelle();

			// Elf Zeichen, also eines zu wenig fuer PasswordPolicy.MIN_LENGTH.
			seeder(EMAIL, HSB_EMAIL, "elfzeichen1").run(null);

			assertThat(userRepository.count()).isZero();
		}
	}
}
