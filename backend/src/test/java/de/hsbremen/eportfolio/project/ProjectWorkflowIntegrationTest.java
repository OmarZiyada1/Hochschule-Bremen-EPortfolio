package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.SemesterRepository;
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
 * Die Workflow-Endpoints aus §6.1 gegen die echte Datenbank: einreichen,
 * zurueckziehen (seit v50), genehmigen, veroeffentlichen und zur Ueberarbeitung
 * zurueckgeben, jeweils mit der Uebergangstabelle aus §4.1, den Rechten aus §5,
 * den Pflichtfeldern aus §3.3 und der Fehlerpolitik aus §6.3.1.
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

	@Autowired
	private SemesterRepository semesterRepository;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User otherEditor;

	private User admin;

	private Category category;

	private Faculty faculty;

	private StudyProgram studyProgram;

	private Semester semester;

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
		semester = semesterRepository.findAllByOrderBySortOrderAsc().getFirst();
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
		@DisplayName("Die zugewiesene Redaktion gibt aus REVISION zurueck in die Pruefung "
				+ "(§4.1, v73), protokolliert mit ihr als handelnder Person")
		void assignedEditorReturnsItToReview() throws Exception {
			Project returned = saved(complete(author, ProjectStatus.REVISION, "Nachgebessert"));
			returned.getEditors().add(assignedEditor);
			returned = saved(returned);

			JsonNode response = ok(assignedEditor, returned, "submit");

			assertThat(response.get("status").asText()).isEqualTo("SUBMITTED");
			/*
			 * §3.12: ablesbar bleibt, dass dieser Schritt aus der Redaktion
			 * kam und nicht von der Autor:in.
			 */
			JsonNode entry = response.get("statusHistory").get(0);
			assertThat(entry.get("fromStatus").asText()).isEqualTo("REVISION");
			assertThat(entry.get("toStatus").asText()).isEqualTo("SUBMITTED");
			assertThat(entry.get("changedBy").get("id").asText())
					.isEqualTo(assignedEditor.getId().toString());
		}

		@Test
		@DisplayName("Die Administration ebenfalls, auch ohne Zuweisung")
		void adminReturnsItToReview() throws Exception {
			Project returned = saved(complete(author, ProjectStatus.REVISION, "Nachgebessert"));

			assertThat(ok(admin, returned, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Aus DRAFT reicht weiterhin allein die Autor:in ein: 403 fuer die "
				+ "Redaktion (§4.1, v73)")
		void editorMayNotSubmitADraft() throws Exception {
			Project ownDraft = saved(complete(author, ProjectStatus.DRAFT, "Entwurf"));
			ownDraft.getEditors().add(assignedEditor);
			ownDraft = saved(ownDraft);

			mockMvc.perform(as(assignedEditor, action(ownDraft, "submit")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Ein nicht zugewiesenes Redaktionskonto bekommt 403 (§5 Fussnote 11)")
		void unassignedEditorMayNotReturnIt() throws Exception {
			Project returned = saved(complete(author, ProjectStatus.REVISION, "Nachgebessert"));

			mockMvc.perform(as(otherEditor, action(returned, "submit")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		/**
		 * Eine Zuweisung ueberlebt die Herabstufung eines Kontos: die Zeile in
		 * {@code project_editor} raeumt {@code PATCH /admin/users/{id}} nicht
		 * mit (§3.1.1). Geprueft wird deshalb die Rolle und nicht nur die
		 * Zuweisung, sonst haette die Herabstufung an jedem schon zugewiesenen
		 * Projekt keine Wirkung (Contract v74, §4.1).
		 */
		@Test
		@DisplayName("Ein nach der Zuweisung auf STUDENT herabgestuftes Konto bekommt 403 "
				+ "(§4.1, v74)")
		void downgradedEditorMayNotReturnIt() throws Exception {
			Project returned = saved(complete(author, ProjectStatus.REVISION, "Nachgebessert"));
			User downgraded = save(Role.STUDENT);
			returned.getEditors().add(downgraded);
			returned = saved(returned);

			mockMvc.perform(as(downgraded, action(returned, "submit")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(reload(returned).getStatus()).isEqualTo(ProjectStatus.REVISION);
		}

		@Test
		@DisplayName("Auch die Redaktion reicht nicht ein, solange Aenderungswuensche offen "
				+ "sind: 409 CHANGE_REQUESTS_OPEN")
		void openChangeRequestsBlockTheEditorToo() throws Exception {
			Project returned = saved(complete(author, ProjectStatus.REVISION, "Nachgebessert"));
			returned.getEditors().add(assignedEditor);
			returned = saved(returned);
			commentRepository.saveAndFlush(
					Comment.changeRequest(returned, assignedEditor, "Bitte nachbessern."));

			mockMvc.perform(as(assignedEditor, action(returned, "submit")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("CHANGE_REQUESTS_OPEN"));
		}

		@Test
		@DisplayName("Ohne die Pflichtfelder aus §3.3: 400 PROJECT_INCOMPLETE, und die Meldung "
				+ "nennt alle sieben")
		void incompleteDraft() throws Exception {
			Project bare = savedWithoutEditor(
					TestProject.withoutId(author, ProjectStatus.DRAFT, "Nur ein Titel"));

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
					.andExpect(jsonPath("$.message").value(containsString("semesterId")))
					.andExpect(jsonPath("$.message").value(containsString("editorIds")));

			// Der Status bleibt, wo er war: die Pruefung greift vor dem Schreiben.
			assertThat(reload(bare).getStatus()).isEqualTo(ProjectStatus.DRAFT);
			assertThat(history(bare)).isEmpty();
		}

		@Test
		@DisplayName("Fehlt allein die Redaktionszuweisung: 400 PROJECT_INCOMPLETE, und die "
				+ "Meldung nennt editorIds (§3.3, seit Contract v59)")
		void withoutAssignedEditors() throws Exception {
			Project complete = savedWithoutEditor(
					complete(author, ProjectStatus.DRAFT, "Ohne Redaktion"));

			mockMvc.perform(as(author, action(complete, "submit")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_INCOMPLETE"))
					.andExpect(jsonPath("$.message").value(containsString("editorIds")))
					.andExpect(jsonPath("$.message").value(not(containsString("semesterId"))));

			assertThat(reload(complete).getStatus()).isEqualTo(ProjectStatus.DRAFT);

			// Mit Zuweisung geht derselbe Entwurf durch: die Schranke gilt der
			// fehlenden Angabe und nicht dem Projekt.
			complete.getEditors().add(assignedEditor);
			projectRepository.saveAndFlush(complete);

			assertThat(ok(author, complete, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Fehlt nur ein Feld, nennt die Meldung genau dieses")
		void namesOnlyTheMissingField() throws Exception {
			Project almost = complete(author, ProjectStatus.DRAFT, "Fast fertig");
			almost.setSemester(null);

			mockMvc.perform(as(author, action(saved(almost), "submit")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_INCOMPLETE"))
					.andExpect(jsonPath("$.message").value(containsString("semesterId")))
					.andExpect(jsonPath("$.message").value(not(containsString("categoryId"))));
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

		@Test
		@DisplayName("Ein offener Aenderungswunsch sperrt das erneute Einreichen: 409 "
				+ "CHANGE_REQUESTS_OPEN; nach RESOLVED geht derselbe Aufruf durch (§2.4)")
		void openChangeRequestBlocksResubmit() throws Exception {
			Project returned = submitted();
			revision(assignedEditor, returned, "Bitte die Quellenangaben ergaenzen.");

			mockMvc.perform(as(author, action(returned, "submit")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("CHANGE_REQUESTS_OPEN"))
					.andExpect(jsonPath("$.message")
							.value(containsString("1 offener Aenderungswunsch")));

			// Der Status bleibt, wo er war, und die Historie bekommt keinen
			// Eintrag: die Pruefung greift vor dem Schreiben.
			assertThat(reload(returned).getStatus()).isEqualTo(ProjectStatus.REVISION);
			assertThat(history(returned)).hasSize(2);

			// Die Projektseite hakt den Punkt ab (§2.4), dann geht es durch.
			Comment changeRequest = commentRepository
					.findByProjectId(returned.getId()).getFirst();
			mockMvc.perform(as(author,
							patch("/api/comments/" + changeRequest.getId() + "/status")
									.contentType(MediaType.APPLICATION_JSON)
									.content(json("status", "RESOLVED"))))
					.andExpect(status().isOk());

			assertThat(ok(author, returned, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Die Meldung nennt die Anzahl der offenen Punkte; erledigte zaehlen "
				+ "nicht mit")
		void messageNamesTheNumberOfOpenChangeRequests() throws Exception {
			Project returned = submitted();
			revision(assignedEditor, returned, "Erster Punkt.");
			commentRepository.saveAndFlush(
					Comment.changeRequest(returned, assignedEditor, "Zweiter Punkt."));
			Comment resolved = Comment.changeRequest(returned, assignedEditor, "Schon erledigt.");
			resolved.setStatus(CommentStatus.RESOLVED);
			commentRepository.saveAndFlush(resolved);

			mockMvc.perform(as(author, action(returned, "submit")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("CHANGE_REQUESTS_OPEN"))
					.andExpect(jsonPath("$.message")
							.value(containsString("2 offene Aenderungswuensche")));
		}

		@Test
		@DisplayName("NOTE und REPLY blockieren nie: sie tragen keinen Erledigungsstatus "
				+ "(§2.3)")
		void notesAndRepliesDoNotBlock() throws Exception {
			commentRepository.saveAndFlush(
					Comment.of(draft, assignedEditor, CommentType.NOTE, "Interne Notiz."));
			commentRepository.saveAndFlush(
					Comment.of(draft, member, CommentType.REPLY, "Eine Antwort."));

			assertThat(ok(author, draft, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");
		}

		@Test
		@DisplayName("Zustandskonflikt vor Formvollstaendigkeit: mit offenem "
				+ "Aenderungswunsch und fehlendem Pflichtfeld antwortet 409, nicht 400")
		void conflictComesBeforeCompleteness() throws Exception {
			Project returned = submitted();
			revision(assignedEditor, returned, "Bitte nachbessern.");
			Project reloaded = reload(returned);
			reloaded.setSemester(null);
			projectRepository.saveAndFlush(reloaded);

			mockMvc.perform(as(author, action(returned, "submit")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("CHANGE_REQUESTS_OPEN"));
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/withdraw
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/withdraw")
	class Withdrawing {

		@Test
		@DisplayName("Die Autor:in zieht die Einreichung zurueck: 200, Status DRAFT, Eintrag "
				+ "SUBMITTED nach DRAFT in der Historie")
		void authorWithdraws() throws Exception {
			Project submitted = submitted();

			JsonNode response = ok(author, submitted, "withdraw");

			assertThat(response.get("status").asText()).isEqualTo("DRAFT");
			assertThat(lastEntry(submitted).getFromStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(lastEntry(submitted).getToStatus()).isEqualTo(ProjectStatus.DRAFT);
			assertThat(lastEntry(submitted).getChangedBy().getId()).isEqualTo(author.getId());
			// Anders als bei request-revision entsteht kein Aenderungswunsch: die
			// Autor:in schuldet sich selbst keine Begruendung.
			assertThat(commentRepository.findByProjectId(submitted.getId())).isEmpty();
		}

		@Test
		@DisplayName("Danach ist das Projekt wieder ein Entwurf: bearbeitbar, erneut einreichbar "
				+ "und von der Autor:in loeschbar (§6.1)")
		void withdrawnProjectIsADraftAgain() throws Exception {
			Project submitted = submitted();
			ok(author, submitted, "withdraw");

			// Erneut einreichbar: das Hin und Her Autor:in / Redaktion bleibt offen.
			assertThat(ok(author, submitted, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");

			// Wieder bearbeitbar. Das PUT ersetzt die Metadaten als Ganzes und
			// leert dabei die Pflichtfelder; deshalb steht es nach dem letzten
			// Einreichen und nicht davor.
			ok(author, submitted, "withdraw");
			mockMvc.perform(as(author, metadata(submitted, reload(submitted).getVersion())))
					.andExpect(status().isOk());

			// Der Weg aus der Klaerungsrunde: zurueckziehen, dann loeschen. Die
			// Rechtematrix erlaubt der Autor:in das Loeschen nur im DRAFT.
			mockMvc.perform(as(author, delete("/api/projects/" + submitted.getId())))
					.andExpect(status().isNoContent());
			assertThat(projectRepository.findById(submitted.getId())).isEmpty();
		}

		@Test
		@DisplayName("Mitglieder, fremde Studierende, Redaktion und Admin duerfen nicht "
				+ "zurueckziehen: 403, wie beim Einreichen (§4.1)")
		void onlyTheAuthorMayWithdraw() throws Exception {
			Project submitted = submitted();

			for (User user : List.of(member, otherStudent, assignedEditor, otherEditor, admin)) {
				mockMvc.perform(as(user, action(submitted, "withdraw")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(reload(submitted).getStatus()).isEqualTo(ProjectStatus.SUBMITTED);
		}

		@ParameterizedTest(name = "aus {0}")
		@EnumSource(value = ProjectStatus.class,
				names = {"DRAFT", "APPROVED", "PUBLISHED", "REVISION"})
		@DisplayName("Aus jedem anderen Status: 409, denn §4.1 fuehrt nur SUBMITTED; nach der "
				+ "redaktionellen Entscheidung geht es nur ueber request-revision zurueck")
		void invalidSources(ProjectStatus status) throws Exception {
			Project project = saved(complete(author, status, "Nicht eingereicht"));

			mockMvc.perform(as(author, action(project, "withdraw")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_TRANSITION_INVALID"))
					.andExpect(jsonPath("$.message").value(containsString("SUBMITTED")));
		}

		@Test
		@DisplayName("Unbekannte ID: 404, ohne Token: 401")
		void notFoundAndAnonymous() throws Exception {
			mockMvc.perform(as(author, post("/api/projects/" + UUID.randomUUID() + "/withdraw")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));

			mockMvc.perform(action(submitted(), "withdraw"))
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
		@DisplayName("Eine nicht zugewiesene Redaktion darf nicht genehmigen, der Admin ohne "
				+ "Zuweisung schon (§5 Fussnote 11, v42)")
		void onlyAssignedEditorsAndAdminsApprove() throws Exception {
			mockMvc.perform(as(otherEditor, action(submitted(), "approve")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

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
			// Beide Redakteur:innen sind zugewiesen, sonst pruefte der Test die
			// Zuweisungsregel (Fussnote 11) statt des Vier-Augen-Prinzips.
			ownProject.getEditors().add(otherEditor);
			ownProject = projectRepository.saveAndFlush(ownProject);

			mockMvc.perform(as(assignedEditor, action(ownProject, "approve")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			// Die andere zugewiesene Redakteur:in darf dasselbe Projekt
			// genehmigen: die Sperre haengt an der Person, nicht am Projekt.
			assertThat(ok(otherEditor, ownProject, "approve").get("status").asText())
					.isEqualTo("APPROVED");
		}

		@Test
		@DisplayName("Reichweite seit v61: ein zugewiesenes Projektmitglied genehmigt nicht und "
				+ "veroeffentlicht nicht, gibt aber zurueck (§4.1, §5 Fussnote 1)")
		void fourEyesCoversProjectMembers() throws Exception {
			Project submitted = withMemberAsEditor(ProjectStatus.SUBMITTED);

			mockMvc.perform(as(otherEditor, action(submitted, "approve")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			Project approved = withMemberAsEditor(ProjectStatus.APPROVED);

			mockMvc.perform(as(otherEditor, action(approved, "publish")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			// Die Ruecknahme traegt in §5 keine Fussnote ¹ und bleibt offen: sie
			// gibt die Arbeit an die Projektseite zurueck, sie gibt nichts frei.
			assertThat(revision(otherEditor, submitted, "Ich bessere mit nach.")
					.get("status").asText()).isEqualTo("REVISION");
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

			resolveChangeRequests(approved);
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
		@DisplayName("Eine nicht zugewiesene Redaktion gibt nicht zurueck: 403 (§5 Fussnote 11, "
				+ "v42)")
		void unassignedEditorMayNot() throws Exception {
			Project submitted = submitted();

			mockMvc.perform(as(otherEditor, revisionRequest(submitted, "Nicht zustaendig.")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(reload(submitted).getStatus()).isEqualTo(ProjectStatus.SUBMITTED);
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
			// Erst abhaken, dann erneut einreichen: seit KAN-59 sperrt ein
			// offener Aenderungswunsch das Einreichen (§2.4).
			resolveChangeRequests(project);
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
	// DELETE /api/projects/{projectId}/editors/me
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/projects/{projectId}/editors/me")
	class ResigningAsEditor {

		@Test
		@DisplayName("Eine von zwei zugewiesenen Redakteur:innen gibt ab: die Zuweisung "
				+ "verschwindet, der Status bleibt SUBMITTED")
		void oneOfTwoResigns() throws Exception {
			Project project = submitted();
			project.getEditors().add(otherEditor);
			projectRepository.saveAndFlush(project);

			JsonNode response = body(as(otherEditor, resign(project)));

			assertThat(response.get("status").asText()).isEqualTo("SUBMITTED");
			assertThat(reload(project).getStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(reload(project).getEditors())
					.extracting(User::getId)
					.containsExactly(assignedEditor.getId());

			// Nur der Uebergang des Einreichens, kein zweiter Eintrag: es hat
			// sich kein Status geaendert.
			assertThat(history(project)).hasSize(1);
		}

		@Test
		@DisplayName("Die letzte gibt ab: Status DRAFT, Historieneintrag mit ihr als changedBy")
		void lastResignFallsBackToDraft() throws Exception {
			Project project = submitted();

			JsonNode response = body(as(assignedEditor, resign(project)));

			assertThat(response.get("status").asText()).isEqualTo("DRAFT");
			assertThat(reload(project).getStatus()).isEqualTo(ProjectStatus.DRAFT);
			assertThat(reload(project).getEditors()).isEmpty();

			ProjectStatusHistory entry = lastEntry(project);
			assertThat(entry.getFromStatus()).isEqualTo(ProjectStatus.SUBMITTED);
			assertThat(entry.getToStatus()).isEqualTo(ProjectStatus.DRAFT);
			assertThat(entry.getChangedBy().getId()).isEqualTo(assignedEditor.getId());

			// Die Antwort traegt die frische Historie und eine neue version
			// (§6.1).
			assertThat(response.get("statusHistory")).hasSize(2);
			assertThat(response.get("version").isNull()).isFalse();
		}

		@Test
		@DisplayName("Auch aus REVISION heraus: der Rueckfall geht nach DRAFT, offene "
				+ "Aenderungswuensche bleiben stehen")
		void resignFromRevision() throws Exception {
			Project project = submitted();
			revision(assignedEditor, project, "Bitte die Quellen ergaenzen.");

			assertThat(reload(project).getStatus()).isEqualTo(ProjectStatus.REVISION);
			long openBefore = commentRepository.countByProjectIdAndTypeAndStatus(
					project.getId(), CommentType.CHANGE_REQUEST, CommentStatus.OPEN);
			assertThat(openBefore).isEqualTo(1);

			JsonNode response = body(as(assignedEditor, resign(project)));

			assertThat(response.get("status").asText()).isEqualTo("DRAFT");
			assertThat(commentRepository.countByProjectIdAndTypeAndStatus(
					project.getId(), CommentType.CHANGE_REQUEST, CommentStatus.OPEN))
					.isEqualTo(openBefore);
		}

		@Test
		@DisplayName("In APPROVED ergibt das Abgeben 409 PROJECT_STATUS_NOT_EDITABLE")
		void notEditableAfterApproval() throws Exception {
			Project project = submitted();
			ok(assignedEditor, project, "approve");

			mockMvc.perform(as(assignedEditor, resign(project)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));

			assertThat(reload(project).getEditors())
					.extracting(User::getId)
					.containsExactly(assignedEditor.getId());
		}

		@Test
		@DisplayName("In PUBLISHED ebenfalls 409, und die Meldung nennt die richtigen Status")
		void notEditableAfterPublication() throws Exception {
			Project project = submitted();
			ok(assignedEditor, project, "approve");
			ok(assignedEditor, project, "publish");

			mockMvc.perform(as(assignedEditor, resign(project)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"))
					// Die Meldung von statusNotEditable nennt DRAFT und REVISION
					// als erlaubt und waere hier in beiden Richtungen falsch;
					// deshalb hat das Abgeben eine eigene (Befund des
					// code-reviewers zu KAN-37).
					.andExpect(jsonPath("$.message", containsString("SUBMITTED und REVISION")));
		}

		@Test
		@DisplayName("Im DRAFT ebenfalls 409: dort pflegt die Autor:in die Zuweisung selbst")
		void notEditableInDraft() throws Exception {
			mockMvc.perform(as(assignedEditor, resign(draft)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"))
					// Die allgemeine Meldung laese sich hier als Widerspruch
					// lesen („im Status DRAFT nicht bearbeitbar, erlaubt sind
					// DRAFT und REVISION"); die eigene sagt, worum es geht.
					.andExpect(jsonPath("$.message", not(containsString("nicht mehr bearbeitet"))))
					.andExpect(jsonPath("$.message", containsString("SUBMITTED und REVISION")));
		}

		@Test
		@DisplayName("Ein nicht zugewiesenes Redaktionskonto bekommt 403 und nicht 409")
		void unassignedEditorForbidden() throws Exception {
			Project project = submitted();

			mockMvc.perform(as(otherEditor, resign(project)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(reload(project).getEditors())
					.extracting(User::getId)
					.containsExactly(assignedEditor.getId());
		}

		@Test
		@DisplayName("Ein Admin ist nie zugewiesen und bekommt deshalb 403")
		void adminForbidden() throws Exception {
			Project project = submitted();

			mockMvc.perform(as(admin, resign(project)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Ein technisch zugewiesener Admin darf abgeben: die Zuweisung zaehlt, "
				+ "nicht die Rolle")
		void assignedAdminMayResign() throws Exception {
			Project project = submitted();
			/* §5 Fussnote 11 nennt eine solche Zuweisung moeglich und
			   wirkungslos; das Kreuz bei ADMIN in §5 beschreibt den Regelfall,
			   dass ein Admin gar nicht erst zugewiesen wird (Contract v69,
			   Klaerungsrunde zu KAN-37). Steht er doch drin, wird er sie los. */
			project.getEditors().add(admin);
			projectRepository.saveAndFlush(project);

			body(as(admin, resign(project)));

			assertThat(reload(project).getEditors())
					.extracting(User::getId)
					.containsExactly(assignedEditor.getId());
			assertThat(reload(project).getStatus()).isEqualTo(ProjectStatus.SUBMITTED);
		}

		@Test
		@DisplayName("Die Autor:in bekommt 403: sie gibt keine Redaktionszuweisung ab")
		void authorForbidden() throws Exception {
			Project project = submitted();

			mockMvc.perform(as(author, resign(project)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Ohne Token 401")
		void unauthenticated() throws Exception {
			Project project = submitted();

			mockMvc.perform(resign(project))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		@Test
		@DisplayName("Eine unbekannte Projekt-ID ergibt 404 und nicht 403 (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(assignedEditor,
							delete("/api/projects/" + UUID.randomUUID() + "/editors/me")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Nach dem Rueckfall kann die Autor:in neu zuweisen und erneut einreichen")
		void authorRegainsControl() throws Exception {
			Project project = submitted();
			body(as(assignedEditor, resign(project)));

			mockMvc.perform(as(author, put("/api/projects/" + project.getId())
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(
									"version", reload(project).getVersion(),
									"title", "Gruppenarbeit",
									"projectType", "THESIS",
									"degree", "BACHELOR",
									"semesterId", semester.getId().toString(),
									"categoryId", category.getId().toString(),
									"facultyId", faculty.getId().toString(),
									"studyProgramId", studyProgram.getId().toString(),
									"editorIds", List.of(otherEditor.getId().toString())))))
					.andExpect(status().isOk());

			assertThat(ok(author, project, "submit").get("status").asText())
					.isEqualTo("SUBMITTED");
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
		project.setSemester(semester);
		return project;
	}

	private Project saved(Project project) {
		Project stored = savedWithoutEditor(project);
		stored.getEditors().add(assignedEditor);
		return projectRepository.saveAndFlush(stored);
	}

	/**
	 * Wie {@link #saved}, aber ohne Redaktionszuweisung: fuer die
	 * Pflichtfeldpruefung, seit {@code editorIds} mit Contract v59 dazugehoert
	 * (§3.3). Alle anderen Tests bekommen ihre Zuweisung ueber {@link #saved},
	 * sonst scheiterte jedes Einreichen schon an dieser Angabe.
	 */
	private Project savedWithoutEditor(Project project) {
		return projectRepository.saveAndFlush(project);
	}

	/**
	 * Ein Projekt, an dem {@code otherEditor} zugleich mitgeschrieben hat und dem
	 * er als Redaktion zugewiesen ist.
	 *
	 * <p><strong>Bewusst an den Schreibwegen vorbei aufgebaut.</strong> Seit
	 * Contract v61 laesst der Server diesen Zustand gar nicht erst entstehen (§5,
	 * Fussnote ³), Bestandsdaten koennen ihn aber tragen. Genau dafuer ist das
	 * Vier-Augen-Prinzip die letzte Sicherung und nicht die einzige.
	 */
	private Project withMemberAsEditor(ProjectStatus status) {
		Project project = saved(complete(author, status, "Mit Beteiligung " + status));
		project.getEditors().add(otherEditor);
		Project stored = projectRepository.saveAndFlush(project);
		stored.getMembers().add(projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(stored, otherEditor, "Backend")));
		return stored;
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
				"semesterId", semester.getId().toString(),
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

	/** {@code DELETE /api/projects/{id}/editors/me} (§6.1, seit Contract v68). */
	private MockHttpServletRequestBuilder resign(Project project) {
		return delete("/api/projects/" + project.getId() + "/editors/me");
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

	/**
	 * Hakt alle Aenderungswuensche des Projekts ab, damit das erneute Einreichen
	 * nicht an der Sperre aus KAN-59 scheitert (§2.4). Direkt ueber das
	 * Repository; der Weg ueber {@code PATCH /comments/{id}/status} steht in
	 * {@code Submitting.openChangeRequestBlocksResubmit}.
	 */
	private void resolveChangeRequests(Project project) {
		commentRepository.findByProjectIdAndType(project.getId(), CommentType.CHANGE_REQUEST)
				.forEach(comment -> {
					comment.setStatus(CommentStatus.RESOLVED);
					commentRepository.saveAndFlush(comment);
				});
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
