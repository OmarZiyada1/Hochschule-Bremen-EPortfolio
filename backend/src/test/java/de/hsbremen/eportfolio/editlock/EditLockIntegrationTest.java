package de.hsbremen.eportfolio.editlock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.masterdata.Category;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.DevMasterDataSeeder;
import de.hsbremen.eportfolio.masterdata.Faculty;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.SemesterRepository;
import de.hsbremen.eportfolio.masterdata.StudyProgram;
import de.hsbremen.eportfolio.masterdata.StudyProgramRepository;
import de.hsbremen.eportfolio.masterdata.TestMasterData;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectMemberRepository;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die Bearbeitungssperre von aussen (§6.9, KAN-86): die beiden Endpoints und
 * ihre Durchsetzung an den schreibenden Pfaden aus §6.1.
 *
 * <p>Aufbau wie in {@code ProjectWorkflowIntegrationTest}: echte Postgres,
 * echtes JWT, {@code @Transactional} rollt die Datenbank am Ende zurueck.
 *
 * <p><strong>Die Registry rollt dabei nicht zurueck.</strong> Sie liegt im
 * Arbeitsspeicher des Anwendungskontexts und ueberlebt jede Test-Transaktion;
 * ohne das {@code clear()} im {@code @BeforeEach} truege der naechste Test die
 * Sperre des vorigen mit. Genau diese Eigenschaft macht die Sperre aus, sie ist
 * hier nur unbequem.
 *
 * <p><strong>Der Ablauf einer Sperre steht nicht hier</strong>, sondern in
 * {@link EditLockRegistryTest}: er haengt an der Uhr, und eine vorgestellte Uhr
 * gehoert nicht in einen Spring-Kontext, der sie mit allen anderen Tests teilt.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EditLockIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private DevMasterDataSeeder seeder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ProjectMemberRepository projectMemberRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	@Autowired
	private SemesterRepository semesterRepository;

	@Autowired
	private EditLockRegistry registry;

	/**
	 * Test und Endpoint teilen sich wegen {@code @Transactional} einen
	 * Persistenzkontext. Ohne {@code flush} und {@code clear} liefert ein
	 * Neuladen dieselbe Instanz, und eine Aussage ueber die {@code version}
	 * belegte nichts.
	 */
	@PersistenceContext
	private EntityManager entityManager;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User admin;

	private Category category;

	private Faculty faculty;

	private StudyProgram studyProgram;

	private Semester semester;

	private Project draft;

	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());
		registry.clear();

		author = save(Role.STUDENT);
		member = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		category = categoryRepository.findAllByOrderByNameAsc().getFirst();
		semester = semesterRepository.findAllByOrderBySortOrderAsc().getFirst();
		// Kategorie und Semester stammen aus dem Seeder, die Hierarchie nicht mehr:
		// sie kommt seit dem Umzug in das Seeder-Skript aus dem Bestand, und falls
		// der leer ist, legt der Helfer sie an (TestMasterData.anyStudyProgram).
		studyProgram = TestMasterData.anyStudyProgram(facultyRepository, studyProgramRepository);
		faculty = studyProgram.getFaculty();

		draft = complete(author, ProjectStatus.DRAFT, "Gruppenarbeit");
		draft.getEditors().add(assignedEditor);
		draft = projectRepository.saveAndFlush(draft);
		draft.getMembers().add(projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(draft, member, "Frontend")));
	}

	// ==================================================================
	// POST /api/projects/{projectId}/edit-lock
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{projectId}/edit-lock")
	class Acquiring {

		@Test
		@DisplayName("Wer zuerst kommt, haelt: 200 mit heldBySelf=true")
		void firstOneHolds() throws Exception {
			JsonNode response = acquire(author);

			assertThat(response.get("heldBySelf").asBoolean()).isTrue();
			assertThat(response.get("holder").get("userId").asText())
					.isEqualTo(author.getId().toString());
			assertThat(response.get("holder").get("since").asText()).isNotBlank();
		}

		@Test
		@DisplayName("Die zweite Sitzung wird nicht abgewiesen, sondern erfaehrt den Namen der "
				+ "ersten: 200 mit heldBySelf=false")
		void secondOneLearnsWhoHolds() throws Exception {
			acquire(author);

			JsonNode response = acquire(member);

			// Kein 409: der Aufruf ist die Auskunft, nicht der Schreibversuch.
			// Abgewiesen wird erst das Schreiben, siehe Enforcing.
			assertThat(response.get("heldBySelf").asBoolean()).isFalse();
			assertThat(response.get("holder").get("userId").asText())
					.isEqualTo(author.getId().toString());
			assertThat(response.get("holder").get("firstName").asText()).isEqualTo("Test");
			assertThat(response.get("holder").get("lastName").asText()).isEqualTo("Person");
		}

		@Test
		@DisplayName("Idempotent: der Herzschlag erneuert die Frist und laesst den Beginn stehen")
		void heartbeatKeepsTheBeginning() throws Exception {
			String first = acquire(author).get("holder").get("since").asText();

			String second = acquire(author).get("holder").get("since").asText();

			assertThat(second).isEqualTo(first);
		}

		@Test
		@DisplayName("Der Herzschlag ist kein Autosave: die version des Projekts bleibt stehen")
		void heartbeatDoesNotTouchTheProject() throws Exception {
			Long before = reload().getVersion();

			acquire(author);
			acquire(author);
			acquire(author);

			// Erst aus dem geteilten Persistenzkontext heraus: ohne flush und
			// clear kaeme dieselbe Instanz zurueck, und eine unveraenderte
			// Version waere keine Aussage.
			entityManager.flush();
			entityManager.clear();

			// Eine erhoehte Version erzeugte in jeder anderen offenen Sitzung
			// genau den Konflikt, den die Sperre vermeiden soll (§6.4).
			assertThat(reload().getVersion()).isEqualTo(before);
		}

		@Test
		@DisplayName("Die Antwort traegt keine E-Mail-Adresse (§3.1)")
		void responseCarriesNoAddress() throws Exception {
			mockMvc.perform(as(author, post(path(draft))))
					.andExpect(status().isOk())
					.andExpect(content().string(not(containsString("@"))));
		}

		@Test
		@DisplayName("Ohne Token: 401, der Pfad faellt unter anyRequest().authenticated()")
		void unauthenticated() throws Exception {
			mockMvc.perform(post(path(draft)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		@Test
		@DisplayName("Wer nicht zur Projektseite gehoert, haelt auch keine Sperre: 403")
		void strangersAndEditorsGet403() throws Exception {
			for (User user : List.of(otherStudent, assignedEditor, admin)) {
				mockMvc.perform(as(user, post(path(draft))))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@Test
		@DisplayName("Unbekanntes Projekt: 404 vor 403, auch fuer ein fremdes Konto (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(otherStudent, post("/api/projects/" + UUID.randomUUID()
							+ "/edit-lock")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@ParameterizedTest(name = "im Status {0}")
		@EnumSource(value = ProjectStatus.class, names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("In einem gesperrten Status gibt es nichts zu halten: 409")
		void statusNotEditable(ProjectStatus status) throws Exception {
			Project project = projectRepository.saveAndFlush(
					complete(author, status, "Nicht bearbeitbar"));

			mockMvc.perform(as(author, post(path(project))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
		}
	}

	// ==================================================================
	// DELETE /api/projects/{projectId}/edit-lock
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/projects/{projectId}/edit-lock")
	class Releasing {

		@Test
		@DisplayName("Nach dem Freigeben uebernimmt die wartende Sitzung sofort: 204, dann 200 "
				+ "mit heldBySelf=true")
		void lockPassesOnImmediately() throws Exception {
			acquire(author);
			assertThat(acquire(member).get("heldBySelf").asBoolean()).isFalse();

			mockMvc.perform(as(author, delete(path(draft))))
					.andExpect(status().isNoContent());

			assertThat(acquire(member).get("heldBySelf").asBoolean()).isTrue();
		}

		@Test
		@DisplayName("Eine fremde Sperre bricht der Aufruf nicht, auch nicht die Autor:in (§6.9)")
		void foreignLockSurvives() throws Exception {
			acquire(member);

			mockMvc.perform(as(author, delete(path(draft))))
					.andExpect(status().isNoContent());

			// Der 204 sagt "deine Sperre ist weg", nicht "die Sperre ist weg".
			assertThat(acquire(author).get("heldBySelf").asBoolean()).isFalse();
			assertThat(acquire(author).get("holder").get("userId").asText())
					.isEqualTo(member.getId().toString());
		}

		@Test
		@DisplayName("Idempotent: auch ohne gehaltene Sperre und beim zweiten Mal 204")
		void releaseIsIdempotent() throws Exception {
			mockMvc.perform(as(author, delete(path(draft))))
					.andExpect(status().isNoContent());

			acquire(author);
			mockMvc.perform(as(author, delete(path(draft))))
					.andExpect(status().isNoContent());
			mockMvc.perform(as(author, delete(path(draft))))
					.andExpect(status().isNoContent());
		}

		@Test
		@DisplayName("Ohne Token: 401")
		void unauthenticated() throws Exception {
			mockMvc.perform(delete(path(draft)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		@Test
		@DisplayName("Ohne Zugehoerigkeit zur Projektseite: 403")
		void strangerForbidden() throws Exception {
			mockMvc.perform(as(otherStudent, delete(path(draft))))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Unbekanntes Projekt: 404 vor 403 (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(otherStudent, delete("/api/projects/" + UUID.randomUUID()
							+ "/edit-lock")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@ParameterizedTest(name = "im Status {0}")
		@EnumSource(value = ProjectStatus.class, names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("In einem gesperrten Status: 409, dieselbe Schranke wie beim Beanspruchen")
		void statusNotEditable(ProjectStatus status) throws Exception {
			Project project = projectRepository.saveAndFlush(
					complete(author, status, "Nicht bearbeitbar"));

			// Die Sperre laeuft dann nach ihrer Frist von selbst ab; bearbeitbar
			// ist das Projekt in diesem Zustand ohnehin nicht.
			mockMvc.perform(as(author, delete(path(project))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
		}
	}

	// ==================================================================
	// Durchsetzung an den schreibenden Endpoints (§6.1)
	// ==================================================================

	@Nested
	@DisplayName("Durchsetzung an den schreibenden Endpoints")
	class Enforcing {

		@Test
		@DisplayName("PUT /blocks gegen eine fremde Sperre: 409 PROJECT_LOCKED_BY_OTHER, mit "
				+ "dem Namen in der Meldung")
		void blocksAreLocked() throws Exception {
			acquire(author);

			mockMvc.perform(as(member, blocksRequest()))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_LOCKED_BY_OTHER"))
					.andExpect(jsonPath("$.message").value(containsString("Test Person")));
		}

		@Test
		@DisplayName("PUT /projects/{id} gegen eine fremde Sperre: 409, die Metadaten fallen "
				+ "mit unter die Sperre")
		void metadataIsLocked() throws Exception {
			acquire(author);

			mockMvc.perform(as(member, metadataRequest()))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_LOCKED_BY_OTHER"));
		}

		@Test
		@DisplayName("Mit der eigenen Sperre wird geschrieben: 200 auf beiden Wegen")
		void ownLockWrites() throws Exception {
			acquire(author);

			mockMvc.perform(as(author, blocksRequest()))
					.andExpect(status().isOk());
			mockMvc.perform(as(author, metadataRequest()))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("Ohne jede Sperre wird geschrieben: die Sperre entsteht erst mit dem Editor")
		void noLockWrites() throws Exception {
			mockMvc.perform(as(member, blocksRequest()))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("Nach dem Freigeben schreibt die andere Sitzung wieder")
		void writingWorksAfterRelease() throws Exception {
			acquire(author);
			mockMvc.perform(as(member, blocksRequest()))
					.andExpect(status().isConflict());

			mockMvc.perform(as(author, delete(path(draft))))
					.andExpect(status().isNoContent());

			mockMvc.perform(as(member, blocksRequest()))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("Die Sperre steht vor der Versionspruefung: sie ist der speziellere Grund")
		void lockComesBeforeTheVersion() throws Exception {
			acquire(author);

			// Veraltete Version UND fremde Sperre. Ohne die Reihenfolge bekaeme
			// die Person PROJECT_VERSION_CONFLICT, laede neu und liefe danach
			// erneut gegen dieselbe Wand.
			mockMvc.perform(as(member, put("/api/projects/" + draft.getId() + "/blocks")
							.contentType(MediaType.APPLICATION_JSON)
							.content(objectMapper.writeValueAsString(
									json("version", 999, "blocks", List.of())))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_LOCKED_BY_OTHER"));
		}

		@Test
		@DisplayName("Der Lesepfad bleibt unberuehrt: gesperrt wird der Inhalt, nicht das "
				+ "Verfahren")
		void readingAndWorkflowStayOpen() throws Exception {
			acquire(member);

			// Die Autor:in kann einreichen, obwohl ein Mitglied im Editor sitzt:
			// §4.1 laeuft ohne die Sperre.
			mockMvc.perform(as(author, post("/api/projects/" + draft.getId() + "/submit")))
					.andExpect(status().isOk());
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	/** Ein Projekt mit allen Pflichtfeldern aus §3.3. */
	private Project complete(User owner, ProjectStatus status, String title) {
		Project project = TestProject.withoutId(owner, status, title);
		project.setProjectType(ProjectType.THESIS);
		project.setFaculty(faculty);
		project.setStudyProgram(studyProgram);
		project.setDegree(Degree.BACHELOR);
		project.setCategory(category);
		project.setSemester(semester);
		return project;
	}

	private String path(Project project) {
		return "/api/projects/" + project.getId() + "/edit-lock";
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/** Beansprucht die Sperre und liefert die Antwort. Erwartet 200. */
	private JsonNode acquire(User user) throws Exception {
		String body = mockMvc.perform(as(user, post(path(draft))))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return objectMapper.readTree(body);
	}

	/**
	 * Ein gueltiges Ersetzen der Blockliste. Die Version kommt frisch aus der
	 * Datenbank, damit allein die Sperre ueber den Ausgang entscheidet.
	 */
	private MockHttpServletRequestBuilder blocksRequest() throws Exception {
		return put("/api/projects/" + draft.getId() + "/blocks")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(
						json("version", reload().getVersion(), "blocks", List.of())));
	}

	/** Eine gueltige Metadatenaenderung, aus demselben Grund mit frischer Version. */
	private MockHttpServletRequestBuilder metadataRequest() throws Exception {
		return put("/api/projects/" + draft.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(
						json("version", reload().getVersion(), "title", "Anderer Titel")));
	}

	private Project reload() {
		return projectRepository.findById(draft.getId()).orElseThrow();
	}

	private Map<String, Object> json(Object... pairs) {
		Map<String, Object> body = new LinkedHashMap<>();
		for (int i = 0; i < pairs.length; i += 2) {
			body.put((String) pairs[i], pairs[i + 1]);
		}
		return body;
	}
}
