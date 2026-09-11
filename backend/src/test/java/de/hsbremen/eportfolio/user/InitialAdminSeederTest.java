package de.hsbremen.eportfolio.user;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
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
	private static final String PASSWORD = "bootstrap-99";

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private PortfolioService portfolioService;

	@Autowired
	private PortfolioRepository portfolioRepository;

	/**
	 * Zum Leeren der Tabellen in Fremdschluesselreihenfolge. Ueber Repositories
	 * ginge das nicht: fuer die meisten der beteiligten Tabellen gibt es keines,
	 * und {@code deleteAll()} setzte ohnehin nur Einzel-DELETEs in der falschen
	 * Reihenfolge ab.
	 */
	@PersistenceContext
	private EntityManager entityManager;

	private InitialAdminSeeder seeder(String email, String hsbEmail, String password) {
		return new InitialAdminSeeder(userRepository, passwordEncoder, portfolioService,
				email, hsbEmail, password, "System", "Administration");
	}

	private InitialAdminSeeder seeder() {
		return seeder(EMAIL, HSB_EMAIL, PASSWORD);
	}

	/**
	 * Versetzt die Datenbank in den Zustand einer frisch aufgesetzten Umgebung.
	 *
	 * <p><strong>Warum hier so viele Tabellen stehen.</strong> Die erste Fassung
	 * loeschte nur Portfolios und Konten und war deshalb nur auf einer
	 * projektlosen Datenbank gruen. Sieben Fremdschluessel auf {@code app_user}
	 * kaskadieren bewusst <em>nicht</em> ({@code project.author_id},
	 * {@code comment.author_id}, {@code project_status_history.changed_by},
	 * {@code stored_file.uploaded_by}, {@code top10_audit_entry.admin_id} und
	 * beide Nutzerspalten von {@code top10_nomination}); die Migration begruendet
	 * das ausdruecklich. Sobald jemand den Demobestand aus KAN-99 geladen hat,
	 * also im dokumentierten Normalzustand der Entwicklungsdatenbank, waere jeder
	 * Test dieser Klasse an einer Fremdschluesselverletzung gescheitert. Ein Test,
	 * dessen Ergebnis vom Datenbestand des jeweiligen Rechners abhaengt, prueft
	 * nichts Verlaessliches.
	 *
	 * <p>Die Reihenfolge ist dieselbe wie in {@code demo-daten-raeumen.sh} und
	 * folgt den Fremdschluesseln von aussen nach innen. {@code @Transactional} an
	 * der Testklasse rollt alles wieder zurueck: die Entwicklungsdatenbank
	 * ueberlebt den Lauf unveraendert.
	 */
	private void emptyAccountTable() {
		for (String table : List.of(
				"top10_audit_entry", "top10_nomination", "top10_entry", "reaction",
				"comment", "project_status_history", "project_member", "project_editor",
				"project_tag", "block", "stored_file", "project", "portfolio", "app_user")) {
			entityManager.createNativeQuery("delete from " + table).executeUpdate();
		}
		entityManager.flush();
		// Der Persistenzkontext haelt sonst die eben geloeschten Zeilen weiter
		// vor, und der Seeder saehe ueber findByEmail ein Konto, das es in der
		// Datenbank nicht mehr gibt.
		entityManager.clear();
	}

	@Nested
	@DisplayName("Frische Umgebung, alle Werte gesetzt")
	class FreshEnvironment {

		@Test
		@DisplayName("Legt genau ein Konto an, und zwar mit der Rolle ADMIN")
		void createsAdminAccount() {
			emptyAccountTable();

			seeder().run(null);

			assertThat(userRepository.count()).isEqualTo(1);
			User admin = userRepository.findByEmail(EMAIL).orElseThrow(
					() -> new AssertionError("Bootstrap-Admin fehlt"));
			assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
			assertThat(admin.getStatus()).isEqualTo(UserStatus.ACTIVE);
		}

		@Test
		@DisplayName("Das Konto ist anmeldbar: beide Bestaetigungen stehen, das Passwort passt")
		void accountCanLogIn() {
			emptyAccountTable();

			seeder().run(null);

			User admin = userRepository.findByEmail(EMAIL).orElseThrow();
			assertThat(admin.isEmailVerified()).isTrue();
			assertThat(admin.isHsbEmailVerified()).isTrue();
			assertThat(passwordEncoder.matches(PASSWORD, admin.getPasswordHash()))
					.as("das gesetzte Passwort muss zum gespeicherten Hash passen")
					.isTrue();
		}

		@Test
		@DisplayName("Die Passwortaenderung ist erzwungen (§6.7): eine zweite Partei kennt das Initialpasswort")
		void requiresPasswordChange() {
			emptyAccountTable();

			seeder().run(null);

			assertThat(userRepository.findByEmail(EMAIL).orElseThrow().isPasswordChangeRequired())
					.isTrue();
		}

		@Test
		@DisplayName("Das Konto bekommt sein Portfolio (§3.2.1)")
		void createsPortfolio() {
			emptyAccountTable();

			seeder().run(null);

			User admin = userRepository.findByEmail(EMAIL).orElseThrow();
			assertThat(portfolioRepository.findByUserId(admin.getId())).isPresent();
		}

		@Test
		@DisplayName("Ein zweiter Lauf legt kein zweites Konto an, weil die Tabelle dann nicht mehr leer ist")
		void secondRunCreatesNothing() {
			emptyAccountTable();

			seeder().run(null);
			long afterFirstRun = userRepository.count();
			seeder().run(null);

			assertThat(userRepository.count()).isEqualTo(afterFirstRun);
		}

		/**
		 * Der teuerste denkbare Fehler dieser Klasse, deshalb ein eigener Test.
		 *
		 * <p>§3.1 verlangt, dass Adressen kleingeschrieben gespeichert und
		 * gesucht werden, und {@code AuthService} normalisiert die Eingabe beim
		 * Anmelden. Landete die Adresse hier ungewandelt in der Tabelle, faende
		 * die Anmeldung sie nie: 401, und zwar dauerhaft. Auch
		 * {@code POST /auth/forgot-password} hilft dann nicht, denn es
		 * normalisiert ebenso. Und der zweite Riegel verhindert, dass ein
		 * Neustart es richtigstellt, weil {@code app_user} nicht mehr leer ist.
		 * Die Umgebung waere ohne Handgriff per SQL nicht mehr in Betrieb zu
		 * nehmen.
		 *
		 * <p>Der Fall ist keine Spitzfindigkeit: eine {@code .env} auf einem
		 * Server entsteht von Hand, und eine Adresse mit grossem Anfangsbuchstaben
		 * oder ein Leerzeichen am Zeilenende sind dabei das Naheliegendste.
		 */
		@Test
		@DisplayName("Gross geschriebene Adressen mit Leerraum landen klein in der Tabelle (§3.1)")
		void storesAddressesInLowerCase() {
			emptyAccountTable();

			seeder("  Bootstrap.Admin@Test.INVALID  ", "Bootstrap.Admin@HS-Bremen.DE ", PASSWORD)
					.run(null);

			assertThat(userRepository.findByEmail("bootstrap.admin@test.invalid"))
					.as("die Anmeldung sucht kleingeschrieben; genau so muss die Zeile stehen")
					.isPresent();
			User admin = userRepository.findByEmail("bootstrap.admin@test.invalid").orElseThrow();
			assertThat(admin.getHsbEmail()).isEqualTo("bootstrap.admin@hs-bremen.de");
		}
	}

	@Nested
	@DisplayName("Riegel: der Runner darf nichts anlegen")
	class Guards {

		@Test
		@DisplayName("Bestehende Konten: der Runner uebernimmt keine laufende Installation")
		void existingAccountsBlockTheRunner() {
			// Die Dev-Testkonten aus dem Kontextstart genuegen als Bestand. Falls
			// die Umgebung ohne DEV_TEST_PASSWORD laeuft, wird hier eines angelegt,
			// damit der Fall auch dann geprueft wird.
			if (userRepository.count() == 0) {
				seeder("vorhandener@test.invalid", "vorhandener@hs-bremen.de", PASSWORD).run(null);
			}
			long before = userRepository.count();
			assertThat(before).isPositive();

			seeder().run(null);

			assertThat(userRepository.count()).isEqualTo(before);
			assertThat(userRepository.findByEmail(EMAIL)).isEmpty();
		}

		@Test
		@DisplayName("Fehlende Adresse: kein Konto")
		void withoutEmailNothingHappens() {
			emptyAccountTable();

			seeder("", HSB_EMAIL, PASSWORD).run(null);

			assertThat(userRepository.count()).isZero();
		}

		@Test
		@DisplayName("Fehlende Hochschuladresse: kein Konto")
		void withoutHsbEmailNothingHappens() {
			emptyAccountTable();

			seeder(EMAIL, "   ", PASSWORD).run(null);

			assertThat(userRepository.count()).isZero();
		}

		@Test
		@DisplayName("Fehlendes Passwort: kein Konto")
		void withoutPasswordNothingHappens() {
			emptyAccountTable();

			seeder(EMAIL, HSB_EMAIL, "").run(null);

			assertThat(userRepository.count()).isZero();
		}

		@Test
		@DisplayName("Zu kurzes Passwort: kein Konto, statt eines schwachen Admins")
		void tooShortPasswordCreatesNothing() {
			emptyAccountTable();

			// Elf Zeichen, also eines zu wenig fuer PasswordPolicy.MIN_LENGTH.
			seeder(EMAIL, HSB_EMAIL, "elfzeichen1").run(null);

			assertThat(userRepository.count()).isZero();
		}
	}
}
