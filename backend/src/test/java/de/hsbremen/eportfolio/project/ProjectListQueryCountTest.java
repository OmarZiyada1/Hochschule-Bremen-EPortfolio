package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.SemesterRepository;
import de.hsbremen.eportfolio.masterdata.TestMasterData;
import de.hsbremen.eportfolio.portfolio.Portfolio;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import de.hsbremen.eportfolio.reaction.ReactionRepository;
import de.hsbremen.eportfolio.reaction.TestReaction;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Haelt fest, dass {@code GET /api/projects} kein N+1-Verhalten zeigt: die Zahl
 * der Datenbankabfragen bleibt gleich, egal wie viele Projekte auf der Seite
 * stehen.
 *
 * <p>Das ist der technische Hinweis aus KAN-16 („N+1 im Blick behalten"), und
 * er laesst sich nur so festhalten. Ohne diesen Test wuerde ein spaeter
 * entfernter {@code @EntityGraph} oder ein zusaetzliches Feld in der Kachel,
 * das eine Beziehung nachlaedt, unbemerkt aus einer Abfrage je Seite eine je
 * Kachel machen. Funktional faellt das nicht auf, die Antwort bliebe richtig.
 *
 * <p>Gezaehlt wird ueber Hibernates {@link Statistics}, die dieser Test eigens
 * einschaltet. Vor jeder Messung wird der Persistenzkontext geleert, sonst
 * beantwortete Hibernate die Abfragen aus dem First-Level-Cache und die Messung
 * waere wertlos.
 *
 * <p>Geprueft wird die Gleichheit zweier Messungen und keine feste Zahl: die
 * absolute Zahl haengt daran, wie Spring Data die Zaehlabfrage baut, und wuerde
 * bei jedem Framework-Update wackeln, ohne dass sich fachlich etwas geaendert
 * haette.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Transactional
class ProjectListQueryCountTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ReactionRepository reactionRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private SemesterRepository semesterRepository;

	@Autowired
	private PortfolioRepository portfolioRepository;

	@Autowired
	private PortfolioService portfolioService;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@PersistenceContext
	private EntityManager entityManager;

	private Semester semester;

	private User author;

	private User reacting;

	@BeforeEach
	void createUsers() {
		semester = semesterRepository.saveAndFlush(
				TestMasterData.semesterWithoutId("KAN16-N1 " + UUID.randomUUID(), 1));
		author = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		reacting = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));

		/*
		 * Mit hinterlegtem Profilbild, damit die Sammelabfrage der Avatare
		 * (KAN-34) hier wirklich Zeilen findet. Ohne sie liefe der Test an
		 * genau dem Feld vorbei, das seit KAN-34 am ehesten ein N+1
		 * ausloesen wuerde: das Bild haengt am Portfolio und nicht am
		 * Projekt (§3.2).
		 */
		Portfolio portfolio = portfolioService.createFor(author);
		portfolio.setAvatarUrl("/api/files/" + UUID.randomUUID());
		portfolioRepository.saveAndFlush(portfolio);
	}

	@Test
	@DisplayName("Zehn Kacheln kosten so viele Abfragen wie zwei")
	void queryCountDoesNotGrowWithPageSize() throws Exception {
		create(2);
		long withTwo = queriesForList(2);

		create(8);
		long withTen = queriesForList(10);

		assertThat(withTen)
				.as("Die Kachelliste darf pro Projekt keine eigene Abfrage ausloesen")
				.isEqualTo(withTwo);
	}

	// --- Hilfsmittel -------------------------------------------------------

	/**
	 * Legt Projekte an, die jede in der Kachel gezeigte Beziehung benutzen:
	 * Stammdatenbezuege, Tags und Reaktionen. Ohne sie liefe der Test ins
	 * Leere, weil es gar nichts nachzuladen gaebe.
	 */
	private void create(int count) {
		var category = categoryRepository.findAllByOrderByNameAsc().getFirst();
		var faculty = facultyRepository.findAllByOrderByNameAsc().getFirst();

		for (int i = 0; i < count; i++) {
			Project project = TestProject.withoutId(author, ProjectStatus.PUBLISHED, "Projekt " + i);
			project.setSemester(semester);
			project.setCategory(category);
			project.setFaculty(faculty);
			project.setPublishedAt(Instant.now());
			project = projectRepository.saveAndFlush(project);

			project.getTags().addAll(List.of("tag-a", "tag-b"));
			projectRepository.saveAndFlush(project);

			reactionRepository.saveAndFlush(TestReaction.withoutId(project, reacting));
		}
	}

	/** Ruft die Liste als PUBLIC ab und gibt die Zahl der dabei abgesetzten Abfragen zurueck. */
	private long queriesForList(int expectedCards) throws Exception {
		entityManager.flush();
		entityManager.clear();

		Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.clear();

		mockMvc.perform(get("/api/projects")
						.param("semester", semester.getId().toString())
						.param("size", "50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(expectedCards))
				// Gegenprobe, dass wirklich etwas nachzuladen war.
				.andExpect(jsonPath("$.content[0].tags.length()").value(2))
				.andExpect(jsonPath("$.content[0].reactionCount").value(1))
				.andExpect(jsonPath("$.content[0].category.name").exists());

		return statistics.getPrepareStatementCount();
	}
}
