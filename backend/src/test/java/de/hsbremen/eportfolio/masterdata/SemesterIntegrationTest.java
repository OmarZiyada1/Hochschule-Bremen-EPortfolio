package de.hsbremen.eportfolio.masterdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
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
 * Das Semester als Stammdatenzeile (§3.18, §6.1) gegen die echte Datenbank
 * (KAN-65).
 *
 * <p>Drei Zusagen stehen im Mittelpunkt. Erstens die Trennung von
 * {@code active} und Loeschen: ein deaktiviertes Semester verschwindet aus der
 * Auswahl, bleibt aber an den Projekten stehen, die es tragen. Zweitens die
 * Reihenfolge: sie wird gesetzt und nicht aus dem Namen abgeleitet, weshalb
 * {@code move} zwei Zeilen tauscht und am Rand wirkungslos bleibt. Drittens die
 * Abgrenzung der Statuscodes wie bei den uebrigen Stammdaten: 409 fuer den
 * vergebenen Namen und die referenzierte Zeile, 400 fuer die unbrauchbare
 * Angabe im Body, 404 nur fuer die unbekannte ID im Pfad.
 *
 * <p>Alle Zeilen dieses Tests tragen einen je Lauf gewuerfelten Namensteil,
 * sonst kollidierte der Unique-Index auf {@code semester.name} mit den
 * Seed-Daten und mit frueheren Laeufen. Die Listenpruefungen filtern deshalb
 * ueber die IDs dieses Laufs und nicht ueber die Laenge der Gesamtliste.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SemesterIntegrationTest {

	private static final String PUBLIC_PATH = "/api/semesters";

	private static final String ADMIN_PATH = "/api/admin/semesters";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private SemesterRepository semesterRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	@Autowired
	private DevMasterDataSeeder seeder;

	/** Je Lauf eindeutig, damit der Unique-Index nicht mit Altbestand kollidiert. */
	private String marker;

	private User admin;

	private User student;

	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());
		marker = UUID.randomUUID().toString().substring(0, 8);

		admin = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.ADMIN, "nicht-relevant"));
		student = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
	}

	// ==================================================================
	// GET /api/semesters (PUBLIC)
	// ==================================================================

	@Nested
	@DisplayName("Leseliste (§6.1, PUBLIC)")
	class Reading {

		@Test
		@DisplayName("Ohne Token 200; die Reihenfolge ist die gepflegte, nicht die alphabetische")
		void publicListIsOrderedBySortOrder() throws Exception {
			UUID first = createdId("Alpha " + marker);
			UUID second = createdId("Beta " + marker);

			List<String> namesInOrder = namesOf(mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString());

			assertThat(namesInOrder).containsSubsequence("Alpha " + marker, "Beta " + marker);
			assertThat(semesterRepository.findById(first).orElseThrow().getSortOrder())
					.isLessThan(semesterRepository.findById(second).orElseThrow().getSortOrder());
		}

		@Test
		@DisplayName("active=true blendet ein deaktiviertes Semester aus, ohne Filter kommt es mit")
		void activeFilterHidesDeactivated() throws Exception {
			UUID id = createdId("Abgelaufen " + marker);
			deactivate(id);

			mockMvc.perform(get(PUBLIC_PATH).param("active", "true"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$[?(@.id == '" + id + "')]").isEmpty());

			mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$[?(@.id == '" + id + "')].active").value(false));
		}
	}

	// ==================================================================
	// Verwaltung (§6.1, ADMIN)
	// ==================================================================

	@Nested
	@DisplayName("Verwaltung (§6.1, ADMIN)")
	class Administration {

		@Test
		@DisplayName("POST legt am Ende der Reihenfolge an, PATCH benennt um und deaktiviert")
		void createUpdateAndDeactivate() throws Exception {
			UUID id = createdId("Neu " + marker);

			mockMvc.perform(as(admin, patch(ADMIN_PATH + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("name", "Umbenannt " + marker, "active", false))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.name").value("Umbenannt " + marker))
					.andExpect(jsonPath("$.active").value(false));

			Semester stored = semesterRepository.findById(id).orElseThrow();
			assertThat(stored.getName()).isEqualTo("Umbenannt " + marker);
			assertThat(stored.isActive()).isFalse();
		}

		@Test
		@DisplayName("Ein bereits vergebener Name ergibt 409 RESOURCE_IN_USE")
		void duplicateNameIsConflict() throws Exception {
			createdId("Doppelt " + marker);

			mockMvc.perform(as(admin, post(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("name", "Doppelt " + marker))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));
		}

		@Test
		@DisplayName("DELETE ohne Referenzen ergibt 204, mit anhaengendem Projekt 409")
		void deleteIsBlockedByProjects() throws Exception {
			UUID free = createdId("Frei " + marker);
			UUID used = createdId("Belegt " + marker);

			Project project = TestProject.withoutId(student, ProjectStatus.DRAFT, "Mit Semester");
			project.setSemester(semesterRepository.findById(used).orElseThrow());
			projectRepository.saveAndFlush(project);

			mockMvc.perform(as(admin, delete(ADMIN_PATH + "/" + used)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));
			assertThat(semesterRepository.findById(used)).isPresent();

			mockMvc.perform(as(admin, delete(ADMIN_PATH + "/" + free)))
					.andExpect(status().isNoContent());
			assertThat(semesterRepository.findById(free)).isEmpty();
		}

		@Test
		@DisplayName("Unbekannte ID im Pfad ergibt 404 (§6.3.1)")
		void unknownIdIsNotFound() throws Exception {
			mockMvc.perform(as(admin, delete(ADMIN_PATH + "/" + UUID.randomUUID())))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ohne ADMIN-Rolle 403 auf jedem schreibenden Pfad")
		void writingNeedsAdmin() throws Exception {
			UUID id = createdId("Geschuetzt " + marker);

			mockMvc.perform(as(student, post(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("name", "Verboten " + marker))))
					.andExpect(status().isForbidden());
			mockMvc.perform(as(student, patch(ADMIN_PATH + "/" + id)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("name", "Verboten " + marker))))
					.andExpect(status().isForbidden());
			mockMvc.perform(as(student, delete(ADMIN_PATH + "/" + id)))
					.andExpect(status().isForbidden());
			mockMvc.perform(as(student, post(ADMIN_PATH + "/" + id + "/move")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("direction", "UP"))))
					.andExpect(status().isForbidden());
		}

		@Test
		@DisplayName("Ohne Token 401 statt 403")
		void writingNeedsToken() throws Exception {
			mockMvc.perform(post(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("name", "Ohne Token " + marker)))
					.andExpect(status().isUnauthorized());
		}
	}

	// ==================================================================
	// Reihenfolge (§3.18)
	// ==================================================================

	@Nested
	@DisplayName("Reihenfolge (§3.18)")
	class Ordering {

		@Test
		@DisplayName("move tauscht genau zwei Zeilen und antwortet mit der ganzen Liste")
		void moveSwapsTwoRows() throws Exception {
			UUID upper = createdId("Oben " + marker);
			UUID lower = createdId("Unten " + marker);
			int upperBefore = sortOrderOf(upper);
			int lowerBefore = sortOrderOf(lower);

			mockMvc.perform(as(admin, post(ADMIN_PATH + "/" + lower + "/move")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("direction", "UP"))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$[0].id").exists());

			assertThat(sortOrderOf(lower)).isEqualTo(upperBefore);
			assertThat(sortOrderOf(upper)).isEqualTo(lowerBefore);
		}

		@Test
		@DisplayName("Am unteren Rand ist move wirkungslos und ergibt trotzdem 200")
		void moveAtTheEdgeChangesNothing() throws Exception {
			UUID last = createdId("Letztes " + marker);
			int before = sortOrderOf(last);

			mockMvc.perform(as(admin, post(ADMIN_PATH + "/" + last + "/move")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("direction", "DOWN"))))
					.andExpect(status().isOk());

			assertThat(sortOrderOf(last)).isEqualTo(before);
		}

		@Test
		@DisplayName("Fehlende Richtung ergibt 400 VALIDATION_FAILED")
		void missingDirectionIsValidationError() throws Exception {
			UUID id = createdId("Ohne Richtung " + marker);

			mockMvc.perform(as(admin, post(ADMIN_PATH + "/" + id + "/move")
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}
	}

	// ==================================================================
	// Wirkung am Projekt (§3.3)
	// ==================================================================

	@Nested
	@DisplayName("Wirkung am Projekt (§3.3)")
	class AtTheProject {

		@Test
		@DisplayName("POST /api/projects nimmt ein aktives Semester an")
		void activeSemesterIsAccepted() throws Exception {
			UUID id = createdId("Waehlbar " + marker);

			mockMvc.perform(as(student, post("/api/projects")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("title", "Mit Semester", "semesterId", id.toString()))))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.semester.id").value(id.toString()));
		}

		@Test
		@DisplayName("Eine unbekannte semesterId ergibt 400 VALIDATION_FAILED (§6.3.1)")
		void unknownSemesterIsValidationError() throws Exception {
			mockMvc.perform(as(student, post("/api/projects")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("title", "Unbekannt",
									"semesterId", UUID.randomUUID().toString()))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ein deaktiviertes Semester laesst sich nicht neu setzen (400)")
		void inactiveSemesterCannotBeChosen() throws Exception {
			UUID id = createdId("Nicht mehr waehlbar " + marker);
			deactivate(id);

			mockMvc.perform(as(student, post("/api/projects")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("title", "Zu spaet", "semesterId", id.toString()))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(Matchers.containsString("semesterId")));
		}

		@Test
		@DisplayName("Ein bereits gesetztes Semester bleibt speicherbar, auch nach dem "
				+ "Deaktivieren")
		void alreadySetSemesterSurvivesDeactivation() throws Exception {
			UUID id = createdId("Spaeter deaktiviert " + marker);

			String created = mockMvc.perform(as(student, post("/api/projects")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("title", "Laufendes Projekt", "semesterId", id.toString()))))
					.andExpect(status().isCreated())
					.andReturn().getResponse().getContentAsString();
			UUID projectId = UUID.fromString(objectMapper.readTree(created).get("id").asText());
			long version = objectMapper.readTree(created).get("version").asLong();

			deactivate(id);

			mockMvc.perform(as(student, put("/api/projects/" + projectId)
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("version", version, "title", "Weiter bearbeitet",
									"semesterId", id.toString()))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.semester.id").value(id.toString()));
		}

		@Test
		@DisplayName("Einreichen ohne Semester ergibt 400 PROJECT_INCOMPLETE mit semesterId")
		void submitWithoutSemesterNamesTheField() throws Exception {
			Project project = TestProject.withoutId(student, ProjectStatus.DRAFT, "Ohne Semester");
			project.setProjectType(ProjectType.THESIS);
			project.setDegree(Degree.BACHELOR);
			project.setCategory(categoryRepository.findAllByOrderByNameAsc().getFirst());
			StudyProgram studyProgram =
					TestMasterData.anyStudyProgram(facultyRepository, studyProgramRepository);
			project.setFaculty(studyProgram.getFaculty());
			project.setStudyProgram(studyProgram);
			Project stored = projectRepository.saveAndFlush(project);

			mockMvc.perform(as(student, post("/api/projects/" + stored.getId() + "/submit")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_INCOMPLETE"))
					.andExpect(jsonPath("$.message").value(Matchers.containsString("semesterId")));
		}

		@Test
		@DisplayName("Der Filter nimmt die ID; eine unbekannte ergibt eine leere Seite, keinen 404")
		void filterUsesTheId() throws Exception {
			UUID id = createdId("Gefiltert " + marker);
			Project project = TestProject.withoutId(student, ProjectStatus.PUBLISHED, "Sichtbar");
			project.setSemester(semesterRepository.findById(id).orElseThrow());
			projectRepository.saveAndFlush(project);

			mockMvc.perform(get("/api/projects").param("semester", id.toString()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content.length()").value(1))
					.andExpect(jsonPath("$.content[0].semester.name")
							.value("Gefiltert " + marker));

			mockMvc.perform(get("/api/projects").param("semester", UUID.randomUUID().toString()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content.length()").value(0));
		}

		@Test
		@DisplayName("sort=semester ordnet nach sortOrder und nicht nach dem Namen")
		void sortingFollowsSortOrder() throws Exception {
			UUID early = createdId("Zuerst " + marker);
			UUID late = createdId("Alphabetisch frueher " + marker);

			publishedWith(early, "Projekt A " + marker);
			publishedWith(late, "Projekt B " + marker);

			String response = mockMvc.perform(get("/api/projects")
							.param("author", student.getId().toString())
							.param("sort", "semester,asc")
							.param("size", "100"))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString();

			List<String> titles = objectMapper.readTree(response).get("content").findValuesAsText("title")
					.stream()
					.filter(title -> title.endsWith(marker))
					.toList();
			assertThat(titles).containsExactly("Projekt A " + marker, "Projekt B " + marker);
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	/** Legt ein Semester ueber den Endpoint an, erwartet 201 und liefert seine ID. */
	private UUID createdId(String name) throws Exception {
		String response = mockMvc.perform(as(admin, post(ADMIN_PATH)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json("name", name))))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString();

		return UUID.fromString(objectMapper.readTree(response).get("id").asText());
	}

	private void deactivate(UUID id) throws Exception {
		mockMvc.perform(as(admin, patch(ADMIN_PATH + "/" + id)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json("active", false))))
				.andExpect(status().isOk());
	}

	private int sortOrderOf(UUID id) {
		return semesterRepository.findById(id).orElseThrow().getSortOrder();
	}

	private List<String> namesOf(String listResponse) throws Exception {
		return objectMapper.readTree(listResponse).findValuesAsText("name");
	}

	private void publishedWith(UUID semesterId, String title) {
		Project project = TestProject.withoutId(student, ProjectStatus.PUBLISHED, title);
		project.setSemester(semesterRepository.findById(semesterId).orElseThrow());
		projectRepository.saveAndFlush(project);
	}

	/** Baut einen JSON-Koerper aus Paaren von Feldname und Wert. */
	private String json(Object... pairs) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		for (int i = 0; i + 1 < pairs.length; i += 2) {
			fields.put((String) pairs[i], pairs[i + 1]);
		}
		return objectMapper.writeValueAsString(fields);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
