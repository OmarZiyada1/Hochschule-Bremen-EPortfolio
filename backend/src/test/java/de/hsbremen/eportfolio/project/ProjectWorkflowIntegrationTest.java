package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.comment.Comment;
import de.hsbremen.eportfolio.comment.CommentRepository;
import de.hsbremen.eportfolio.common.enums.CommentStatus;
import de.hsbremen.eportfolio.common.enums.CommentType;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.masterdata.Category;
import de.hsbremen.eportfolio.masterdata.CategoryRepository;
import de.hsbremen.eportfolio.masterdata.DevMasterDataSeeder;
import de.hsbremen.eportfolio.masterdata.Faculty;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.StudyProgram;
import de.hsbremen.eportfolio.masterdata.StudyProgramRepository;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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
 * Die vier Workflow-Endpoints aus §6.1 gegen die echte Datenbank: einreichen,
 * genehmigen, veroeffentlichen und zur Ueberarbeitung zurueckgeben, jeweils mit
 * der Uebergangstabelle aus §4.1, den Rechten aus §5, den Pflichtfeldern aus
 * §3.3 und der Fehlerpolitik aus §6.3.1.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert. Die Anmeldung laeuft ueber echte
 * Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe Filterkette
 * durchlaeuft wie in Produktion; nur so sind die 401-Faelle hier
 * aussagekraeftig.
 *
 * <p>Das abgeschaltete Vier-Augen-Prinzip braucht eine andere
 * Anwendungskonfiguration und steht deshalb in
 * {@link ProjectWorkflowFourEyesDisabledTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProjectWorkflowIntegrationTest {

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
	private ProjectStatusHistoryRepository statusHistoryRepository;

	@Autowired
	private CommentRepository commentRepository;

	@Autowired
	private CategoryRepository categoryRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	@Autowired
	private StudyProgramRepository studyProgramRepository;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User otherEditor;

	private User admin;

	private Category category;

	private Faculty faculty;

	private StudyProgram studyProgram;

	/**
	 * Ein vollstaendig ausgefuellter Entwurf der Autor:in, mit {@code member} als
	 * Projektmitglied und {@code assignedEditor} als betreuender Redaktion. Er ist
	 * einreichbar; die Pflichtfeldpruefung bekommt ihre eigenen Projekte.
	 */
	private Project draft;

	@BeforeEach
	void buildData() {
		seeder.run(new DefaultApplicationArguments());

		author = save(Role.STUDENT);
		member = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		otherEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		category = categoryRepository.findAllByOrderByNameAsc().getFirst();
		faculty = facultyRepository.findAllByOrderByNameAsc().getFirst();
		studyProgram = studyProgramRepository.findByFacultyIdOrderByNameAsc(faculty.getId())
				.getFirst();

		draft = complete(author, ProjectStatus.DRAFT, "Gruppenarbeit");
		draft.getEditors().add(assignedEditor);
		draft = projectRepository.saveAndFlush(draft);
		// Wie in den Tests zu KAN-16 und KAN-17: die Zeile steht in der
		// Datenbank, die Sammlung des bereits verwalteten Projekts kennt sie noch
		// nicht. Test und Endpoint teilen sich hier einen Persistenzkontext.
		draft.getMembers().add(projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(draft, member, "Frontend")));
	}

	// ==================================================================
	// POST /api/projects/{id}/submit
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/submit")
	class Submitting {

		@Test
		@DisplayName("Die Autor:in reicht den vollstaendigen Entwurf ein: 200, Status SUBMITTED, "
				+ "Eintrag DRAFT nach SUBMITTED in der Historie")
		void authorSubmits() throws Exception {
			JsonNode response = ok(author, draft, "submit");

			assertThat(response.get("status").asText()).isEqualTo("SUBMITTED");
			assertThat(history(draft)).hasSize(1);
			assertThat(response.get("statusHistory")).hasSize(1);

			JsonNode entry = response.get("statusHistory").get(0);
			assertThat(entry.get("fromStatus").asText()).isEqualTo("DRAFT");
			assertThat(entry.get("toStatus").asText()).isEqualTo("SUBMITTED");
			assertThat(entry.get("changedBy").get("id").asText())
					.isEqualTo(author.getId().toString());
			assertThat(entry.get("timestamp").isNull()).isFalse();
		}

		@Test
		@DisplayName("Auch aus REVISION heraus, das ist das erneute Einreichen (§4.1)")
		void submitsAgainFromRevision() throws Exception {
			Project returned = saved(complete(author, ProjectStatus.REVISION, "Nachgebessert"));

			assertThat(ok(author, returned, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Ohne die Pflichtfelder aus §3.3: 400 PROJECT_INCOMPLETE, und die Meldung "
				+ "nennt alle sechs")
		void incompleteDraft() throws Exception {
			Project bare = saved(TestProject.withoutId(author, ProjectStatus.DRAFT, "Nur ein Titel"));

			mockMvc.perform(as(author, action(bare, "submit")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.errorCode").value("PROJECT_INCOMPLETE"))
					.andExpect(jsonPath("$.path")
							.value("/api/projects/" + bare.getId() + "/submit"))
					.andExpect(jsonPath("$.timestamp").exists())
					.andExpect(jsonPath("$.message").value(containsString("projectType")))
					.andExpect(jsonPath("$.message").value(containsString("facultyId")))
					.andExpect(jsonPath("$.message").value(containsString("studyProgramId")))
					.andExpect(jsonPath("$.message").value(containsString("degree")))
					.andExpect(jsonPath("$.message").value(containsString("categoryId")))
					.andExpect(jsonPath("$.message").value(containsString("semester")));

			// Der Status bleibt, wo er war: die Pruefung greift vor dem Schreiben.
			assertThat(reload(bare).getStatus()).isEqualTo(ProjectStatus.DRAFT);
			assertThat(history(bare)).isEmpty();
		}

		@Test
		@DisplayName("Fehlt nur ein Feld, nennt die Meldung genau dieses")
		void namesOnlyTheMissingField() throws Exception {
			Project almost = complete(author, ProjectStatus.DRAFT, "Fast fertig");
			almost.setSemester(null);

			mockMvc.perform(as(author, action(saved(almost), "submit")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_INCOMPLETE"))
					.andExpect(jsonPath("$.message").value(containsString("semester")))
					.andExpect(jsonPath("$.message").value(not(containsString("categoryId"))));
		}

		@Test
		@DisplayName("Ein leeres Semester zaehlt als fehlendes (§3.3)")
		void blankSemesterCountsAsMissing() throws Exception {
			Project almost = complete(author, ProjectStatus.DRAFT, "Leeres Semester");
			almost.setSemester("   ");

			mockMvc.perform(as(author, action(saved(almost), "submit")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_INCOMPLETE"));
		}

		@Test
		@DisplayName("Ein Projekt ohne Inhaltsbloecke laesst sich einreichen: §3.3 zaehlt die "
				+ "Pflichtfelder abschliessend auf und nennt den Inhalt nicht")
		void contentIsNotChecked() throws Exception {
			assertThat(draft.getBlocks()).isEmpty();

			assertThat(ok(author, draft, "submit").get("status").asText()).isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Mitglieder, fremde Studierende, Redaktion und Admin duerfen nicht einreichen: "
				+ "403 (§4.1 nennt die Autor:in, ADMIN steht in §5 mit ✗)")
		void onlyTheAuthorMaySubmit() throws Exception {
			for (User user : List.of(member, otherStudent, assignedEditor, otherEditor, admin)) {
				mockMvc.perform(as(user, action(draft, "submit")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(reload(draft).getStatus()).isEqualTo(ProjectStatus.DRAFT);
		}

		@ParameterizedTest(name = "aus {0}")
		@EnumSource(value = ProjectStatus.class,
				names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("Aus jedem anderen Status: 409 PROJECT_STATUS_TRANSITION_INVALID")
		void invalidSources(ProjectStatus status) throws Exception {
			Project project = saved(complete(author, status, "Schon unterwegs"));

			mockMvc.perform(as(author, action(project, "submit")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_TRANSITION_INVALID"))
					.andExpect(jsonPath("$.message").value(containsString(status.name())));
		}

		@Test
		@DisplayName("Der zweite Klick auf denselben Knopf ergibt 409, nicht einen zweiten "
				+ "Historieneintrag")
		void doubleSubmit() throws Exception {
			ok(author, draft, "submit");

			mockMvc.perform(as(author, action(draft, "submit")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_TRANSITION_INVALID"));

			assertThat(history(draft)).hasSize(1);
		}

		@Test
		@DisplayName("Unbekannte ID: 404, ohne Token: 401")
		void notFoundAndAnonymous() throws Exception {
			mockMvc.perform(as(author, post("/api/projects/" + UUID.randomUUID() + "/submit")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			mockMvc.perform(action(draft, "submit"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/approve
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/approve")
	class Approving {

		@Test
		@DisplayName("Die zugewiesene Redaktion genehmigt: 200, Status APPROVED, publishedAt bleibt "
				+ "leer")
		void assignedEditorApproves() throws Exception {
			Project submitted = submitted();

			JsonNode response = ok(assignedEditor, submitted, "approve");

			assertThat(response.get("status").asText()).isEqualTo("APPROVED");
			// Genehmigt heisst noch nicht oeffentlich (§2.2).
			assertThat(response.get("publishedAt").isNull()).isTrue();
			assertThat(lastEntry(submitted).getFromStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(lastEntry(submitted).getToStatus()).isEqualTo(ProjectStatus.APPROVED);
			assertThat(lastEntry(submitted).getChangedBy().getId())
					.isEqualTo(assignedEditor.getId());
		}

		@Test
		@DisplayName("Auch eine nicht zugewiesene Redaktion und der Admin duerfen genehmigen "
				+ "(§5 fuehrt dort einen vollen Haken)")
		void otherEditorAndAdminMayApprove() throws Exception {
			assertThat(ok(otherEditor, submitted(), "approve").get("status").asText())
					.isEqualTo("APPROVED");

			assertThat(ok(admin, submitted(), "approve").get("status").asText())
					.isEqualTo("APPROVED");
		}

		@Test
		@DisplayName("Studierende duerfen nicht genehmigen, auch nicht am eigenen Projekt: 403")
		void studentsMayNot() throws Exception {
			Project submitted = submitted();

			for (User user : List.of(author, member, otherStudent)) {
				mockMvc.perform(as(user, action(submitted, "approve")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@Test
		@DisplayName("Vier-Augen-Prinzip: eine Redakteur:in genehmigt das eigene Projekt nicht, "
				+ "403 (§4.1)")
		void fourEyesPrinciple() throws Exception {
			Project ownProject = saved(complete(assignedEditor, ProjectStatus.SUBMITTED,
					"Projekt der Redaktion"));

			mockMvc.perform(as(assignedEditor, action(ownProject, "approve")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			// Eine andere Redakteur:in darf dasselbe Projekt genehmigen: die
			// Sperre haengt an der Person, nicht am Projekt.
			assertThat(ok(otherEditor, ownProject, "approve").get("status").asText())
					.isEqualTo("APPROVED");
		}

		@Test
		@DisplayName("Fussnote ⁵: fuer den Admin greift die Sperre nicht, er genehmigt sein eigenes "
				+ "Projekt (offener Punkt 7)")
		void adminIsNotBlockedByFourEyes() throws Exception {
			Project ownProject = saved(complete(admin, ProjectStatus.SUBMITTED, "Projekt des Admins"));

			assertThat(ok(admin, ownProject, "approve").get("status").asText()).isEqualTo("APPROVED");
		}

		@ParameterizedTest(name = "aus {0}")
		@EnumSource(value = ProjectStatus.class,
				names = {"DRAFT", "APPROVED", "PUBLISHED", "REVISION"})
		@DisplayName("Aus jedem anderen Status: 409, denn §4.1 fuehrt nur SUBMITTED")
		void invalidSources(ProjectStatus status) throws Exception {
			Project project = saved(complete(author, status, "Falscher Zeitpunkt"));

			mockMvc.perform(as(assignedEditor, action(project, "approve")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_TRANSITION_INVALID"))
					.andExpect(jsonPath("$.message").value(containsString("SUBMITTED")));
		}

		@Test
		@DisplayName("Fehlendes Recht geht vor falschem Status: eine fremde Studierende bekommt "
				+ "auch am Entwurf 403 und nicht 409 (§6.3.1)")
		void permissionBeforeStatus() throws Exception {
			mockMvc.perform(as(otherStudent, action(draft, "approve")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Unbekannte ID: 404, ohne Token: 401")
		void notFoundAndAnonymous() throws Exception {
			mockMvc.perform(as(assignedEditor,
							post("/api/projects/" + UUID.randomUUID() + "/approve")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			mockMvc.perform(action(submitted(), "approve"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/publish
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/publish")
	class Publishing {

		@Test
		@DisplayName("Die Redaktion veroeffentlicht: 200, Status PUBLISHED, publishedAt gesetzt")
		void editorPublishes() throws Exception {
			Project approved = saved(complete(author, ProjectStatus.APPROVED, "Freigegeben"));
			Instant before = Instant.now();

			JsonNode response = ok(assignedEditor, approved, "publish");

			assertThat(response.get("status").asText()).isEqualTo("PUBLISHED");
			assertThat(reload(approved).getPublishedAt()).isNotNull()
					.isAfterOrEqualTo(before.minusSeconds(1));
			assertThat(response.get("publishedAt").isNull()).isFalse();
		}

		@Test
		@DisplayName("Ab jetzt ist das Projekt auch ohne Token lesbar (§5)")
		void publiclyReadableAfterwards() throws Exception {
			Project approved = saved(complete(author, ProjectStatus.APPROVED, "Bald oeffentlich"));

			mockMvc.perform(get("/api/projects/" + approved.getId()))
					.andExpect(status().isUnauthorized());

			ok(assignedEditor, approved, "publish");

			mockMvc.perform(get("/api/projects/" + approved.getId()))
					.andExpect(status().isOk())
					// Die Statushistorie bleibt PUBLIC verborgen, auch beim
					// veroeffentlichten Projekt (§3.12).
					.andExpect(jsonPath("$.statusHistory").value(nullValue()));
		}

		@Test
		@DisplayName("Eine erneute Veroeffentlichung nach der Ueberarbeitung laesst publishedAt "
				+ "stehen")
		void publishedAtSurvivesRepublication() throws Exception {
			Project approved = saved(complete(author, ProjectStatus.APPROVED, "Zweimal veroeffentlicht"));

			ok(assignedEditor, approved, "publish");
			Instant firstPublication = reload(approved).getPublishedAt();

			revision(assignedEditor, approved, "Bitte die Bildrechte klaeren.");
			// publishedAt bleibt auch bei der Ruecknahme stehen; oeffentlich ist
			// das Projekt trotzdem nicht mehr, das entscheidet der Status.
			assertThat(reload(approved).getPublishedAt()).isEqualTo(firstPublication);
			mockMvc.perform(get("/api/projects/" + approved.getId()))
					.andExpect(status().isUnauthorized());

			ok(author, approved, "submit");
			ok(assignedEditor, approved, "approve");
			ok(assignedEditor, approved, "publish");

			assertThat(reload(approved).getPublishedAt()).isEqualTo(firstPublication);
		}

		@ParameterizedTest(name = "aus {0}")
		@EnumSource(value = ProjectStatus.class,
				names = {"DRAFT", "SUBMITTED", "PUBLISHED", "REVISION"})
		@DisplayName("Aus jedem anderen Status: 409, denn §4.1 fuehrt nur APPROVED")
		void invalidSources(ProjectStatus status) throws Exception {
			Project project = saved(complete(author, status, "Noch nicht freigegeben"));

			mockMvc.perform(as(admin, action(project, "publish")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_TRANSITION_INVALID"))
					.andExpect(jsonPath("$.message").value(containsString("APPROVED")));
		}

		@Test
		@DisplayName("Studierende duerfen nicht veroeffentlichen: 403")
		void studentsMayNot() throws Exception {
			Project approved = saved(complete(author, ProjectStatus.APPROVED, "Nicht durch Studi"));

			mockMvc.perform(as(author, action(approved, "publish")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Vier-Augen-Prinzip greift auch beim Veroeffentlichen: 403 (§4.1)")
		void fourEyesPrinciple() throws Exception {
			Project ownProject = saved(complete(assignedEditor, ProjectStatus.APPROVED,
					"Projekt der Redaktion"));

			mockMvc.perform(as(assignedEditor, action(ownProject, "publish")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Unbekannte ID: 404, ohne Token: 401")
		void notFoundAndAnonymous() throws Exception {
			mockMvc.perform(as(admin, post("/api/projects/" + UUID.randomUUID() + "/publish")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			Project approved = saved(complete(author, ProjectStatus.APPROVED, "Ohne Token"));
			mockMvc.perform(action(approved, "publish"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/request-revision
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/request-revision")
	class RequestingRevision {

		@Test
		@DisplayName("Die Redaktion gibt zurueck: 200, Status REVISION, genau ein "
				+ "CHANGE_REQUEST-Kommentar im Status OPEN mit der Begruendung")
		void editorReturnsProject() throws Exception {
			Project submitted = submitted();

			JsonNode response = revision(assignedEditor, submitted,
					"Bitte die Quellenangaben ergaenzen.");

			assertThat(response.get("status").asText()).isEqualTo("REVISION");

			List<Comment> comments = commentRepository.findByProjectId(submitted.getId());
			assertThat(comments).hasSize(1);
			Comment comment = comments.getFirst();
			assertThat(comment.getType()).isEqualTo(CommentType.CHANGE_REQUEST);
			assertThat(comment.getStatus()).isEqualTo(CommentStatus.OPEN);
			assertThat(comment.getText()).isEqualTo("Bitte die Quellenangaben ergaenzen.");
			assertThat(comment.getAuthor().getId()).isEqualTo(assignedEditor.getId());
		}

		@Test
		@DisplayName("Die Begruendung steht im Kommentar und nicht in der Statushistorie (§4.1)")
		void reasonBelongsToTheComment() throws Exception {
			Project submitted = submitted();

			revision(assignedEditor, submitted, "Der Abschnitt Methodik fehlt.");

			ProjectStatusHistory entry = lastEntry(submitted);
			assertThat(entry.getFromStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(entry.getToStatus()).isEqualTo(ProjectStatus.REVISION);
			assertThat(entry.getChangedBy().getId()).isEqualTo(assignedEditor.getId());
			// Die Entity hat kein Textfeld: die Historie sagt, was passiert ist,
			// der Kommentar, was zu tun ist.
			assertThat(statusHistoryRepository.findByProjectIdOrderByTimestampAsc(
					submitted.getId())).hasSize(2);
		}

		@ParameterizedTest(name = "aus {0}")
		@EnumSource(value = ProjectStatus.class, names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("Aus allen drei Status aus §4.1 heraus, aus PUBLISHED ist es das Zurueckziehen")
		void allSources(ProjectStatus status) throws Exception {
			Project project = saved(complete(author, status, "Zurueck aus " + status));

			assertThat(revision(assignedEditor, project, "Bitte nachbessern.")
					.get("status").asText()).isEqualTo("REVISION");
		}

		@Test
		@DisplayName("Danach ist das Projekt wieder bearbeitbar: PUT /projects/{id} ist offen, "
				+ "vorher 409 PROJECT_STATUS_NOT_EDITABLE")
		void contentIsEditableAgain() throws Exception {
			Project submitted = submitted();

			// Der andere der beiden aehnlichen 409er (§4.1): gesperrter Inhalt.
			mockMvc.perform(as(author, metadata(submitted, reload(submitted).getVersion())))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));

			revision(assignedEditor, submitted, "Bitte den Titel praezisieren.");

			mockMvc.perform(as(author, metadata(submitted, reload(submitted).getVersion())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.title").value("Praeziser Titel"));
		}

		@ParameterizedTest(name = "aus {0}")
		@EnumSource(value = ProjectStatus.class, names = {"DRAFT", "REVISION"})
		@DisplayName("Aus DRAFT und REVISION gibt es nichts zurueckzugeben: 409")
		void invalidSources(ProjectStatus status) throws Exception {
			Project project = saved(complete(author, status, "Noch nicht eingereicht"));

			mockMvc.perform(as(assignedEditor, revisionRequest(project, "Zu frueh.")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_TRANSITION_INVALID"));
		}

		@Test
		@DisplayName("Kein Vier-Augen-Prinzip: eine Redakteur:in darf ihr eigenes Projekt "
				+ "zurueckziehen (§5 fuehrt hier keine Fussnote ¹)")
		void withoutFourEyes() throws Exception {
			Project ownProject = saved(complete(assignedEditor, ProjectStatus.SUBMITTED,
					"Projekt der Redaktion"));

			assertThat(revision(assignedEditor, ownProject, "Ich bessere selbst nach.")
					.get("status").asText()).isEqualTo("REVISION");
		}

		@Test
		@DisplayName("Studierende duerfen nicht zurueckgeben, auch nicht die Autor:in: 403")
		void studentsMayNot() throws Exception {
			Project submitted = submitted();

			for (User user : List.of(author, member, otherStudent)) {
				mockMvc.perform(as(user, revisionRequest(submitted, "Ich moechte weiterarbeiten.")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(reload(submitted).getStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(commentRepository.findByProjectId(submitted.getId())).isEmpty();
		}

		@Test
		@DisplayName("Ohne reason: 400, und es entsteht weder ein Kommentar noch ein "
				+ "Statuswechsel")
		void reasonIsRequired() throws Exception {
			Project submitted = submitted();

			for (String body : List.of("{}", "{\"reason\":\"\"}", "{\"reason\":\"   \"}")) {
				mockMvc.perform(as(assignedEditor,
								post("/api/projects/" + submitted.getId() + "/request-revision")
										.contentType(MediaType.APPLICATION_JSON)
										.content(body)))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
			}

			assertThat(reload(submitted).getStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(commentRepository.findByProjectId(submitted.getId())).isEmpty();
			assertThat(history(submitted)).hasSize(1);
		}

		@Test
		@DisplayName("Unbekannte ID: 404, ohne Token: 401")
		void notFoundAndAnonymous() throws Exception {
			mockMvc.perform(as(assignedEditor,
							post("/api/projects/" + UUID.randomUUID() + "/request-revision")
									.contentType(MediaType.APPLICATION_JSON)
									.content(json("reason", "Gibt es nicht."))))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			mockMvc.perform(revisionRequest(submitted(), "Ohne Token."))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}
	}

	// ==================================================================
	// Der ganze Ablauf
	// ==================================================================

	@Nested
	@DisplayName("Zustandsautomat als Ganzes (§4)")
	class WholeCycle {

		@Test
		@DisplayName("Ein Durchlauf mit Ruecknahme hinterlaesst die Historie in der Reihenfolge "
				+ "der Uebergaenge, mit dem Anlagevorgang als erstem Eintrag")
		void fullCycle() throws Exception {
			Project project = created();

			ok(author, project, "submit");
			revision(assignedEditor, project, "Bitte die Gliederung ueberarbeiten.");
			ok(author, project, "submit");
			ok(assignedEditor, project, "approve");
			ok(assignedEditor, project, "publish");

			assertThat(history(project).stream().map(ProjectStatusHistory::getToStatus))
					.containsExactly(
							ProjectStatus.DRAFT,
							ProjectStatus.SUBMITTED,
							ProjectStatus.REVISION,
							ProjectStatus.SUBMITTED,
							ProjectStatus.APPROVED,
							ProjectStatus.PUBLISHED);

			assertThat(history(project).stream().map(ProjectStatusHistory::getFromStatus))
					.containsExactly(
							null,
							ProjectStatus.DRAFT,
							ProjectStatus.SUBMITTED,
							ProjectStatus.REVISION,
							ProjectStatus.SUBMITTED,
							ProjectStatus.APPROVED);

			// Genau ein Aenderungswunsch, aus der einen Ruecknahme.
			assertThat(commentRepository.findByProjectId(project.getId())).hasSize(1);
		}

		@Test
		@DisplayName("version zaehlt bei jedem Uebergang hoch, obwohl kein Body sie mitschickt")
		void versionMovesWithEveryTransition() throws Exception {
			long atDraft = reload(draft).getVersion();

			long afterSubmit = ok(author, draft, "submit").get("version").asLong();
			long afterApprove = ok(assignedEditor, draft, "approve").get("version").asLong();

			assertThat(afterSubmit).isGreaterThan(atDraft);
			assertThat(afterApprove).isGreaterThan(afterSubmit);
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	/**
	 * Ein Projekt mit allen Pflichtfeldern aus §3.3, also einreichbar. Noch nicht
	 * gespeichert, damit der Test einzelne Felder vorher wieder leeren kann.
	 */
	private Project complete(User owner, ProjectStatus status, String title) {
		Project project = TestProject.withoutId(owner, status, title);
		project.setProjectType(ProjectType.THESIS);
		project.setFaculty(faculty);
		project.setStudyProgram(studyProgram);
		project.setDegree(Degree.BACHELOR);
		project.setCategory(category);
		project.setSemester("WS 2025/26");
		return project;
	}

	private Project saved(Project project) {
		Project stored = projectRepository.saveAndFlush(project);
		stored.getEditors().add(assignedEditor);
		return projectRepository.saveAndFlush(stored);
	}

	/** Ein eingereichtes Projekt der Autor:in, mit dem Uebergang in der Historie. */
	private Project submitted() throws Exception {
		Project project = saved(complete(author, ProjectStatus.DRAFT, "Eingereicht"));
		ok(author, project, "submit");
		return project;
	}

	/**
	 * Ein Projekt ueber {@code POST /api/projects} angelegt, damit der
	 * Anlagevorgang aus §4.1 mit in der Historie steht.
	 */
	private Project created() throws Exception {
		String body = json(
				"title", "Voller Durchlauf",
				"projectType", "THESIS",
				"degree", "BACHELOR",
				"semester", "WS 2025/26",
				"categoryId", category.getId().toString(),
				"facultyId", faculty.getId().toString(),
				"studyProgramId", studyProgram.getId().toString(),
				"editorIds", List.of(assignedEditor.getId().toString()));

		String response = mockMvc.perform(as(author, post("/api/projects")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);

		UUID id = UUID.fromString(objectMapper.readTree(response).get("id").asText());
		return projectRepository.findById(id).orElseThrow();
	}

	private MockHttpServletRequestBuilder action(Project project, String action) {
		return post("/api/projects/" + project.getId() + "/" + action);
	}

	private MockHttpServletRequestBuilder revisionRequest(Project project, String reason)
			throws Exception {

		return post("/api/projects/" + project.getId() + "/request-revision")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("reason", reason));
	}

	/** Metadatenaenderung, um die Statussperre aus §4.1 gegenzupruefen. */
	private MockHttpServletRequestBuilder metadata(Project project, Long version) throws Exception {
		return put("/api/projects/" + project.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("version", version, "title", "Praeziser Titel"));
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/** Fuehrt einen Uebergang ohne Body aus, erwartet 200 und liefert die Antwort. */
	private JsonNode ok(User user, Project project, String action) throws Exception {
		return body(as(user, action(project, action)));
	}

	private JsonNode revision(User user, Project project, String reason) throws Exception {
		return body(as(user, revisionRequest(project, reason)));
	}

	private JsonNode body(MockHttpServletRequestBuilder request) throws Exception {
		String response = mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
		return objectMapper.readTree(response);
	}

	private String json(Object... pairs) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		for (int i = 0; i + 1 < pairs.length; i += 2) {
			fields.put((String) pairs[i], pairs[i + 1]);
		}
		return objectMapper.writeValueAsString(fields);
	}

	private Project reload(Project project) {
		return projectRepository.findById(project.getId()).orElseThrow();
	}

	private List<ProjectStatusHistory> history(Project project) {
		return statusHistoryRepository.findByProjectIdOrderByTimestampAsc(project.getId());
	}

	private ProjectStatusHistory lastEntry(Project project) {
		return history(project).getLast();
	}
}
