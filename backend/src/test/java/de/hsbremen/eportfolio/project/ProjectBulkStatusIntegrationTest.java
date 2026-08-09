package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Der Sammel-Statuswechsel {@code POST /api/admin/projects/status} aus §6.1
 * gegen die echte Datenbank (KAN-46).
 *
 * <p>Im Mittelpunkt steht die Zusage, die diesen Endpoint von einem
 * Alles-oder-nichts unterscheidet: eine Auswahl mit einem nach §4.1
 * unzulaessigen Uebergang ergibt <strong>200</strong> mit einer Ergebnisliste, in
 * der genau diese eine Zeile {@code PROJECT_STATUS_TRANSITION_INVALID} traegt,
 * waehrend die uebrigen Projekte tatsaechlich uebergegangen sind.
 *
 * <p><strong>Warum dieser Test als einziger im Paket ohne
 * {@code @Transactional} auskommt</strong> und stattdessen selbst aufraeumt: der
 * Endpoint verarbeitet jedes Projekt in einer <em>eigenen</em> Transaktion
 * ({@code ProjectAdminService}, {@code Propagation.NOT_SUPPORTED}). Eine
 * umschliessende Test-Transaktion wuerde dabei ausgesetzt; die Projekte dieses
 * Tests waeren fuer den Endpoint dann gar nicht sichtbar, und was er schreibt,
 * rollte am Ende nicht zurueck. Genau diese Unabhaengigkeit ist die zweite
 * Zusage des Tickets, also wird sie hier auch so gepruft.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProjectBulkStatusIntegrationTest {

	private static final String BULK = "/api/admin/projects/status";

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
	private ProjectStatusHistoryRepository statusHistoryRepository;

	@Autowired
	private CommentRepository commentRepository;

	private User admin;

	private User editor;

	private User author;

	/** Alles, was dieser Test angelegt hat; wird in umgekehrter Reihenfolge abgeraeumt. */
	private final List<UUID> createdProjects = new ArrayList<>();

	private final List<User> createdUsers = new ArrayList<>();

	@BeforeEach
	void buildData() {
		admin = createUser(Role.ADMIN);
		editor = createUser(Role.EDITOR);
		author = createUser(Role.STUDENT);
	}

	/**
	 * Raeumt in der Reihenfolge der Fremdschluessel ab: erst die Zeilen, die auf
	 * ein Projekt zeigen (Kommentare aus {@code request-revision} und die
	 * Statushistorie aus §3.12), dann die Projekte, zuletzt die Konten.
	 */
	@AfterEach
	void removeData() {
		for (UUID projectId : createdProjects) {
			commentRepository.deleteAll(commentRepository.findByProjectId(projectId));
			statusHistoryRepository.deleteAll(
					statusHistoryRepository.findByProjectIdOrderByTimestampAsc(projectId));
			projectRepository.findById(projectId).ifPresent(projectRepository::delete);
		}
		createdProjects.clear();

		userRepository.deleteAll(createdUsers);
		createdUsers.clear();
	}

	// ==================================================================
	// Der Kern des Tickets
	// ==================================================================

	@Test
	@DisplayName("Eine Auswahl mit einem unzulaessigen Uebergang ergibt 200 mit Ergebnisliste")
	void invalidTransitionIsReportedPerRow() throws Exception {
		UUID first = createProject(ProjectStatus.APPROVED);
		UUID blocked = createProject(ProjectStatus.DRAFT);
		UUID last = createProject(ProjectStatus.APPROVED);

		String response = mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(first, blocked, last), "publish", null)))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results.length()").value(3))
				.andExpect(jsonPath("$.results[0].projectId").value(first.toString()))
				.andExpect(jsonPath("$.results[0].success").value(true))
				.andExpect(jsonPath("$.results[1].projectId").value(blocked.toString()))
				.andExpect(jsonPath("$.results[1].success").value(false))
				.andExpect(jsonPath("$.results[1].errorCode")
						.value("PROJECT_STATUS_TRANSITION_INVALID"))
				.andExpect(jsonPath("$.results[2].success").value(true))
				.andReturn()
				.getResponse()
				.getContentAsString();

		// Die Form ist ueber alle Zeilen dieselbe: errorCode steht auch bei
		// Erfolg im JSON, nur eben als null (siehe ProjectBulkStatusResult).
		JsonNode successRow = objectMapper.readTree(response).get("results").get(0);
		assertThat(successRow.has("errorCode")).isTrue();
		assertThat(successRow.get("errorCode").isNull()).isTrue();

		// Die gescheiterte Zeile hat die beiden erfolgreichen nicht mitgerissen.
		assertThat(statusOf(first)).isEqualTo(ProjectStatus.PUBLISHED);
		assertThat(statusOf(blocked)).isEqualTo(ProjectStatus.DRAFT);
		assertThat(statusOf(last)).isEqualTo(ProjectStatus.PUBLISHED);
	}

	@Test
	@DisplayName("publish setzt publishedAt und schreibt je Projekt einen Historieneintrag (§3.12)")
	void publishWritesHistory() throws Exception {
		UUID projectId = createProject(ProjectStatus.APPROVED);

		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(projectId), "publish", null)))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results[0].success").value(true));

		Project project = projectRepository.findById(projectId).orElseThrow();
		assertThat(project.getStatus()).isEqualTo(ProjectStatus.PUBLISHED);
		assertThat(project.getPublishedAt()).isNotNull();

		List<ProjectStatusHistory> history =
				statusHistoryRepository.findByProjectIdOrderByTimestampAsc(projectId);
		assertThat(history).hasSize(1);
		assertThat(history.get(0).getFromStatus()).isEqualTo(ProjectStatus.APPROVED);
		assertThat(history.get(0).getToStatus()).isEqualTo(ProjectStatus.PUBLISHED);
		assertThat(history.get(0).getChangedBy().getId()).isEqualTo(admin.getId());
	}

	@Test
	@DisplayName("request-revision legt je Projekt einen CHANGE_REQUEST-Kommentar im Status OPEN an")
	void requestRevisionWritesChangeRequestPerProject() throws Exception {
		UUID first = createProject(ProjectStatus.SUBMITTED);
		UUID second = createProject(ProjectStatus.PUBLISHED);

		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(first, second), "request-revision",
								"Bitte die Quellenangaben ergaenzen.")))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results[0].success").value(true))
				.andExpect(jsonPath("$.results[1].success").value(true));

		assertThat(statusOf(first)).isEqualTo(ProjectStatus.REVISION);
		assertThat(statusOf(second)).isEqualTo(ProjectStatus.REVISION);

		for (UUID projectId : List.of(first, second)) {
			List<Comment> comments = commentRepository.findByProjectIdAndType(projectId,
					CommentType.CHANGE_REQUEST);
			assertThat(comments).hasSize(1);
			assertThat(comments.get(0).getStatus()).isEqualTo(CommentStatus.OPEN);
			assertThat(comments.get(0).getText()).isEqualTo("Bitte die Quellenangaben ergaenzen.");
		}
	}

	// ==================================================================
	// Unbrauchbarer Aufruf: 400 fuer die ganze Anfrage
	// ==================================================================

	@Test
	@DisplayName("Unbekannte action ergibt 400 VALIDATION_FAILED und bewegt nichts")
	void unknownActionIsRejected() throws Exception {
		UUID projectId = createProject(ProjectStatus.SUBMITTED);

		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(projectId), "approve", null)))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

		assertThat(statusOf(projectId)).isEqualTo(ProjectStatus.SUBMITTED);
	}

	@Test
	@DisplayName("request-revision ohne reason ergibt 400, publish mit reason ebenfalls")
	void reasonMustMatchAction() throws Exception {
		UUID projectId = createProject(ProjectStatus.SUBMITTED);

		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(projectId), "request-revision", null)))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(projectId), "publish", "ueberfluessig")))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

		assertThat(statusOf(projectId)).isEqualTo(ProjectStatus.SUBMITTED);
		assertThat(commentRepository.findByProjectId(projectId)).isEmpty();
	}

	@Test
	@DisplayName("Leere projectIds ergibt 400 VALIDATION_FAILED")
	void emptySelectionIsRejected() throws Exception {
		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(), "publish", null)))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
	}

	@Test
	@DisplayName("Eine unbekannte Projekt-ID ist eine Zeile mit PROJECT_NOT_FOUND, kein 404")
	void unknownProjectIsARow() throws Exception {
		UUID known = createProject(ProjectStatus.APPROVED);
		UUID unknown = UUID.randomUUID();

		mockMvc.perform(as(admin, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(body(List.of(unknown, known), "publish", null)))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results[0].projectId").value(unknown.toString()))
				.andExpect(jsonPath("$.results[0].success").value(false))
				.andExpect(jsonPath("$.results[0].errorCode").value("PROJECT_NOT_FOUND"))
				.andExpect(jsonPath("$.results[1].success").value(true));

		assertThat(statusOf(known)).isEqualTo(ProjectStatus.PUBLISHED);
	}

	// ==================================================================
	// Rechte (§5)
	// ==================================================================

	@Test
	@DisplayName("Ohne Token 401, mit EDITOR-Token 403 NO_PERMISSION, und nichts bewegt sich")
	void requiresAdmin() throws Exception {
		UUID projectId = createProject(ProjectStatus.APPROVED);
		String body = json(body(List.of(projectId), "publish", null));

		mockMvc.perform(post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(as(editor, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(body)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

		mockMvc.perform(as(author, post(BULK)
						.contentType(MediaType.APPLICATION_JSON)
						.content(body)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

		assertThat(statusOf(projectId)).isEqualTo(ProjectStatus.APPROVED);
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User createUser(Role role) {
		User user = userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
		createdUsers.add(user);
		return user;
	}

	private UUID createProject(ProjectStatus status) {
		Project project = projectRepository.saveAndFlush(
				TestProject.withoutId(author, status, "Sammelwechsel " + status));
		createdProjects.add(project.getId());
		return project.getId();
	}

	private ProjectStatus statusOf(UUID projectId) {
		return projectRepository.findById(projectId).orElseThrow().getStatus();
	}

	/**
	 * Baut den Body. {@link LinkedHashMap} statt {@code Map.of}, weil
	 * {@code reason} bewusst {@code null} sein darf und {@code Map.of} das nicht
	 * zulaesst: das Feld soll dann als {@code null} im JSON stehen und nicht
	 * fehlen, denn genau so schickt es ein Client, der es leer laesst.
	 */
	private Map<String, Object> body(List<UUID> projectIds, String action, String reason) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("projectIds", projectIds.stream().map(UUID::toString).toList());
		body.put("action", action);
		body.put("reason", reason);
		return body;
	}

	private String json(Map<String, Object> body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
