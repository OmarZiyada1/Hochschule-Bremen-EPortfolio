package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Optimistic Locking am Projekt (API-Contract §3.3 und §6.4): zwei Sitzungen
 * bearbeiten dasselbe Projekt, die spaetere darf die fruehere nicht
 * ueberschreiben.
 *
 * <p>Laeuft gegen die echte Datenbank, weil der Versionszaehler dort gepflegt
 * wird: Hibernate haengt beim Update ein {@code where version = ?} an und
 * erkennt den Konflikt an der Zahl der betroffenen Zeilen. {@code @Transactional}
 * rollt am Ende alles zurueck, die Entwicklungsdatenbank bleibt unveraendert.
 *
 * <p>Die zweite Sitzung wird nicht ueber einen zweiten Thread nachgestellt,
 * sondern ueber eine abgeloeste (detached) Kopie mit dem alten Versionsstand.
 * Das ist derselbe Zustand, den ein Client zwischen zwei Requests haelt, und es
 * ist reproduzierbar; echte Nebenlaeufigkeit waere hier nur schwer
 * verlaesslich zu takten.
 */
@SpringBootTest
@Transactional
class ProjectVersionConflictTest {

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private UserRepository userRepository;

	@PersistenceContext
	private EntityManager entityManager;

	@Test
	@DisplayName("Neues Projekt startet mit version 0, eine Aenderung macht daraus 1")
	void versionCountsUp() {
		Project project = newProject();
		assertThat(project.getVersion()).isZero();

		project.setTitle("Erste Aenderung");
		projectRepository.saveAndFlush(project);

		assertThat(project.getVersion()).isEqualTo(1L);
	}

	@Test
	@DisplayName("Die zweite von zwei konkurrierenden Aenderungen scheitert am Versionszaehler")
	void secondChangeFails() {
		Project stale = staleCopyAfterForeignChange();

		assertThatThrownBy(() -> projectRepository.saveAndFlush(stale))
				.isInstanceOf(ObjectOptimisticLockingFailureException.class);
	}

	@Test
	@DisplayName("Der Konflikt kommt als 409 PROJECT_VERSION_CONFLICT im Envelope aus §6.2 an")
	void conflictYields409InEnvelope() throws Exception {
		Project stale = staleCopyAfterForeignChange();
		String path = "/test/projects/" + stale.getId();

		MockMvc mockMvc = MockMvcBuilders
				.standaloneSetup(new WriteStub(projectRepository, stale))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();

		mockMvc.perform(put(path))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.errorCode").value("PROJECT_VERSION_CONFLICT"))
				.andExpect(jsonPath("$.path").value(path))
				.andExpect(jsonPath("$.timestamp").exists())
				// Die Meldung ist die Handlungsanweisung an den Client und darf
				// keine Interna aus der Ausnahme durchreichen.
				.andExpect(jsonPath("$.message", containsString("neu laden")))
				.andExpect(jsonPath("$.message", not(containsString(stale.getId().toString()))));
	}

	// --- Hilfsmittel -----------------------------------------------------------

	private Project newProject() {
		User author = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		return projectRepository.saveAndFlush(TestProject.draftWithoutId(author));
	}

	/**
	 * Stellt den Ausgangspunkt beider Konflikttests her und gibt die veraltete
	 * Kopie der zweiten Sitzung zurueck: beide haben das Projekt mit
	 * {@code version 0} geladen, die erste hat bereits gespeichert.
	 */
	private Project staleCopyAfterForeignChange() {
		Project secondSession = newProject();
		UUID id = secondSession.getId();

		// Abloesen, damit die Instanz den Stand version 0 behaelt und das
		// spaetere findById wirklich aus der Datenbank liest, statt dieselbe
		// verwaltete Instanz noch einmal zu liefern.
		entityManager.detach(secondSession);

		Project firstSession = projectRepository.findById(id).orElseThrow();
		firstSession.setTitle("Aenderung der ersten Sitzung");
		projectRepository.saveAndFlush(firstSession);
		assertThat(firstSession.getVersion()).isEqualTo(1L);

		secondSession.setTitle("Aenderung der zweiten Sitzung");
		return secondSession;
	}

	/**
	 * Steht anstelle des schreibenden Projekt-Endpoints, den erst KAN-17
	 * liefert. Sie speichert die uebergebene veraltete Kopie und laeuft dabei
	 * in denselben Konflikt, so wird die ganze Kette vom Datenbankfehler bis
	 * zur HTTP-Antwort geprueft und nicht nur der Handler mit einer von Hand
	 * geworfenen Ausnahme.
	 */
	@RestController
	static class WriteStub {

		private final ProjectRepository projectRepository;

		private final Project stale;

		WriteStub(ProjectRepository projectRepository, Project stale) {
			this.projectRepository = projectRepository;
			this.stale = stale;
		}

		@PutMapping("/test/projects/{id}")
		void save() {
			projectRepository.saveAndFlush(stale);
		}
	}
}
