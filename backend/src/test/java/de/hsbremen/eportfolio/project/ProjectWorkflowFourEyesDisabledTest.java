package de.hsbremen.eportfolio.project;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.DevMasterDataSeeder;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.StudyProgramRepository;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dieselben Endpoints wie in {@link ProjectWorkflowIntegrationTest}, aber mit
 * abgeschaltetem Vier-Augen-Prinzip ({@code app.permission.four-eyes-principle
 * = false}).
 *
 * <p><strong>Warum eine eigene Klasse.</strong> Die Property gehoert zur
 * Anwendungskonfiguration und laesst sich nicht je Testmethode umschalten; ein
 * abweichender Wert bedeutet einen eigenen Anwendungskontext. Der Fall muss
 * trotzdem gegen die echten Endpoints laufen und nicht nur gegen den
 * Berechtigungsdienst: §7 fuehrt das Prinzip als offene Frage 1, und wenn die
 * Pruefer sie umdrehen, wird genau diese Konfiguration die produktive. Dann darf
 * sich nicht herausstellen, dass der Schalter nur eine Ebene tiefer wirkt und der
 * Endpoint trotzdem 403 liefert.
 *
 * <p>Geprueft wird ausschliesslich der Unterschied. Alles Uebrige, was von der
 * Property nicht beruehrt wird, steht in {@link ProjectWorkflowIntegrationTest}
 * und wird hier nicht wiederholt.
 */
@SpringBootTest(properties = "app.permission.four-eyes-principle=false")
@AutoConfigureMockMvc
@Transactional
class ProjectWorkflowFourEyesDisabledTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private DevMasterDataSeeder seeder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	private User editor;

	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());
		editor = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.EDITOR, "nicht-relevant"));
	}

	@Test
	@DisplayName("Abgeschaltet: die Redakteur:in genehmigt ihr eigenes eingereichtes Projekt")
	void mayApproveOwnProject() throws Exception {
		Project ownProject = ownProject(ProjectStatus.SUBMITTED);

		mockMvc.perform(as(editor, post("/api/projects/" + ownProject.getId() + "/approve")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("APPROVED"));
	}

	@Test
	@DisplayName("Abgeschaltet: sie veroeffentlicht es auch selbst")
	void mayPublishOwnProject() throws Exception {
		Project ownProject = ownProject(ProjectStatus.APPROVED);

		mockMvc.perform(as(editor, post("/api/projects/" + ownProject.getId() + "/publish")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("PUBLISHED"))
				.andExpect(jsonPath("$.publishedAt").exists());
	}

	private Project ownProject(ProjectStatus status) {
		Project project = TestProject.withoutId(editor, status, "Projekt der Redaktion");
		project.setProjectType(ProjectType.REGULAR);
		project.setFaculty(facultyRepository.findAllByOrderByNameAsc().getFirst());
		project.setStudyProgram(studyProgramRepository.findAllByOrderByNameAsc().getFirst());
		project.setDegree(Degree.MASTER);
		project.setCategory(categoryRepository.findAllByOrderByNameAsc().getFirst());
		project.setSemester("SS 2026");
		Project stored = projectRepository.saveAndFlush(project);
		// Seit v42 entscheidet nur die zugewiesene Redaktion (§5 Fussnote 11);
		// die Autor:in hat sich hier selbst gewaehlt, was §5 Fussnote 3 beim
		// Anlegen erlaubt. Erst dadurch prueft der Test wirklich den
		// Vier-Augen-Schalter und nicht die Zuweisungsregel.
		stored.getEditors().add(editor);
		return projectRepository.saveAndFlush(stored);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		return request.header(HttpHeaders.AUTHORIZATION,
				"Bearer " + jwtService.createToken(AuthenticatedUser.from(user)));
	}
}
