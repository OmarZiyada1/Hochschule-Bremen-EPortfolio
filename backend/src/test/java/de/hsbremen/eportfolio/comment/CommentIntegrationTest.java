package de.hsbremen.eportfolio.comment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.CommentStatus;
import de.hsbremen.eportfolio.common.enums.CommentType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectMemberRepository;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
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
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die fuenf Kommentar-Endpoints aus §6.1 gegen die echte Datenbank: Liste mit
 * Sichtbarkeitsfilter, Anlegen, Text- und Statusaenderung, Loeschen.
 *
 * <p>Schwerpunkt ist die Sichtbarkeit aus §2.3. Der Satz, um den es geht, ist
 * „eine {@code NOTE} darf in keiner Antwort an Studierende erscheinen, auch
 * nicht ausgeblendet im JSON"; deshalb prueft {@link Listing} nicht nur die
 * Anzahl der Eintraege, sondern auch den unveraenderten Antworttext.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert. Die Anmeldung laeuft ueber echte
 * Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe Filterkette
 * durchlaeuft wie in Produktion; nur so sind die 401-Faelle hier
 * aussagekraeftig.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CommentIntegrationTest {

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
	private ProjectMemberRepository projectMemberRepository;

	@Autowired
	private CommentRepository commentRepository;

	private User author;

	private User member;

	private User otherStudent;

	private User assignedEditor;

	private User otherEditor;

	private User admin;

	/** Entwurf der Autor:in, mit {@code member} als Projektmitglied. */
	private Project draft;

	/** Dasselbe Personengefuege an einem veroeffentlichten Projekt (§5). */
	private Project published;

	@BeforeEach
	void buildData() {
		author = save(Role.STUDENT);
		member = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		otherEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		draft = project(ProjectStatus.DRAFT, "Entwurf");
		published = project(ProjectStatus.PUBLISHED, "Veroeffentlicht");
	}

	// ==================================================================
	// GET /api/projects/{id}/comments
	// ==================================================================

	@Nested
	@DisplayName("GET /api/projects/{id}/comments")
	class Listing {

		@Test
		@DisplayName("Sortiert nach createdAt aufsteigend, also in der Reihenfolge des Gespraechs")
		void sortedByCreatedAt() throws Exception {
			write(published, assignedEditor, CommentType.CHANGE_REQUEST, "Erstens.");
			write(published, author, CommentType.REPLY, "Zweitens.");
			write(published, assignedEditor, CommentType.REPLY, "Drittens.");

			JsonNode list = list(author, published);

			assertThat(texts(list)).containsExactly("Erstens.", "Zweitens.", "Drittens.");
			assertThat(timestamps(list)).isSorted();
		}

		@Test
		@DisplayName("Eine NOTE erreicht die Projektseite in keiner Form: weder als Eintrag noch "
				+ "irgendwo im Antworttext (§2.3)")
		void noteNeverReachesTheProjectSide() throws Exception {
			allThreeTypes(published);

			for (User user : List.of(author, member, otherStudent)) {
				String raw = raw(as(user, get(commentsPath(published))));

				assertThat(objectMapper.readTree(raw)).hasSize(2);
				assertThat(texts(objectMapper.readTree(raw)))
						.containsExactly("Bitte nachbessern.", "Ist erledigt.");
				assertThat(raw).doesNotContain("Intern besprochen.", "NOTE");
			}
		}

		@Test
		@DisplayName("Auch ohne Anmeldung nicht: PUBLIC sieht am veroeffentlichten Projekt REPLY "
				+ "und CHANGE_REQUEST, aber keine NOTE")
		void publicSeesEverythingButTheNote() throws Exception {
			allThreeTypes(published);

			String raw = raw(get(commentsPath(published)));

			assertThat(texts(objectMapper.readTree(raw)))
					.containsExactly("Bitte nachbessern.", "Ist erledigt.");
			assertThat(raw).doesNotContain("Intern besprochen.");
		}

		@Test
		@DisplayName("Redaktion und Administration sehen alle drei Typen, auch ohne Zuweisung")
		void editorialSeesAll() throws Exception {
			allThreeTypes(published);

			for (User user : List.of(assignedEditor, otherEditor, admin)) {
				assertThat(texts(list(user, published)))
						.containsExactly("Bitte nachbessern.", "Intern besprochen.",
								"Ist erledigt.");
			}
		}

		@Test
		@DisplayName("Am Entwurf gilt die Sichtbarkeit des Projekts: ohne Token 401, fremde "
				+ "Studierende 403 (§6.3.1)")
		void draftFollowsProjectVisibility() throws Exception {
			write(draft, author, CommentType.REPLY, "Noch nicht oeffentlich.");

			mockMvc.perform(get(commentsPath(draft)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(as(otherStudent, get(commentsPath(draft))))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			for (User user : List.of(author, member, assignedEditor, admin)) {
				assertThat(list(user, draft)).hasSize(1);
			}
		}

		@Test
		@DisplayName("Ein Projekt ohne Kommentare ergibt eine leere Liste, kein 404")
		void emptyList() throws Exception {
			assertThat(list(author, draft)).isEmpty();
		}

		@Test
		@DisplayName("Unbekannte Projekt-ID: 404 PROJECT_NOT_FOUND")
		void unknownProject() throws Exception {
			mockMvc.perform(as(author, get("/api/projects/" + UUID.randomUUID() + "/comments")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Jeder Eintrag traegt Verfasser:in samt Rolle, aber keine E-Mail-Adresse "
				+ "(§3.1)")
		void entryShape() throws Exception {
			write(published, assignedEditor, CommentType.CHANGE_REQUEST, "Bitte nachbessern.");

			String raw = raw(as(author, get(commentsPath(published))));
			JsonNode entry = objectMapper.readTree(raw).get(0);

			assertThat(entry.get("author").get("id").asText())
					.isEqualTo(assignedEditor.getId().toString());
			assertThat(entry.get("author").get("role").asText()).isEqualTo("EDITOR");
			assertThat(entry.get("type").asText()).isEqualTo("CHANGE_REQUEST");
			assertThat(entry.get("status").asText()).isEqualTo("OPEN");
			assertThat(entry.get("createdAt").isNull()).isFalse();
			assertThat(entry.get("updatedAt").isNull()).isFalse();
			assertThat(raw).doesNotContain("email", "hsbEmail", "passwordHash");
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/comments
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/comments")
	class Creating {

		@Test
		@DisplayName("Die Projektseite schreibt eine REPLY: 201, ohne status")
		void projectSideWritesReply() throws Exception {
			for (User user : List.of(author, member)) {
				JsonNode created = create(user, draft, "REPLY", "Ich habe eine Rueckfrage.");

				assertThat(created.get("type").asText()).isEqualTo("REPLY");
				assertThat(created.get("status").isNull()).isTrue();
				assertThat(created.get("author").get("id").asText())
						.isEqualTo(user.getId().toString());
			}
		}

		@Test
		@DisplayName("Die Redaktion schreibt eine NOTE ohne status und einen CHANGE_REQUEST, der in "
				+ "OPEN startet (§2.4)")
		void editorialWritesNoteAndChangeRequest() throws Exception {
			assertThat(create(assignedEditor, draft, "NOTE", "Intern besprochen.")
					.get("status").isNull()).isTrue();

			assertThat(create(assignedEditor, draft, "CHANGE_REQUEST", "Bitte nachbessern.")
					.get("status").asText()).isEqualTo("OPEN");

			assertThat(create(admin, draft, "NOTE", "Auch der Admin darf das.")
					.get("status").isNull()).isTrue();
		}

		@Test
		@DisplayName("Studierende duerfen weder NOTE noch CHANGE_REQUEST anlegen: 403, und es "
				+ "entsteht nichts (§5)")
		void studentsMayNotUseEditorialTypes() throws Exception {
			for (String type : List.of("NOTE", "CHANGE_REQUEST")) {
				mockMvc.perform(as(author, createRequest(draft, type, "Nicht erlaubt.")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(commentRepository.findByProjectId(draft.getId())).isEmpty();
		}

		@Test
		@DisplayName("Fremde Studierende kommentieren ein Projekt nicht, auch kein "
				+ "veroeffentlichtes: 403 (§5, STUDENT nur die eigene Ressource)")
		void foreignStudentsMayNotComment() throws Exception {
			for (Project project : List.of(draft, published)) {
				mockMvc.perform(as(otherStudent, createRequest(project, "REPLY", "Schoene Arbeit.")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@ParameterizedTest(name = "Status {0}")
		@EnumSource(ProjectStatus.class)
		@DisplayName("Der Projektstatus sperrt das Kommentieren nicht: die Sperre aus §4.1 gilt dem "
				+ "Inhalt, nicht der Rueckmeldung")
		void statusDoesNotBlockComments(ProjectStatus status) throws Exception {
			Project project = project(status, "Projekt in " + status.name());

			assertThat(create(assignedEditor, project, "CHANGE_REQUEST", "Bitte nachbessern.")
					.get("status").asText()).isEqualTo("OPEN");
		}

		@Test
		@DisplayName("Ohne Token: 401, unbekanntes Projekt: 404")
		void anonymousAndUnknownProject() throws Exception {
			mockMvc.perform(createRequest(draft, "REPLY", "Ohne Token."))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(as(author, post("/api/projects/" + UUID.randomUUID() + "/comments")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("type", "REPLY", "text", "Gibt es nicht."))))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Fehlender Text, fehlender Typ und ein Typ ausserhalb von §2.3: 400 "
				+ "VALIDATION_FAILED")
		void invalidBodies() throws Exception {
			List<String> bodies = List.of(
					"{\"type\":\"REPLY\"}",
					"{\"type\":\"REPLY\",\"text\":\"   \"}",
					"{\"text\":\"Ohne Typ.\"}",
					"{\"type\":\"GEFAELLT_MIR\",\"text\":\"Kein Typ aus §2.3.\"}");

			for (String body : bodies) {
				mockMvc.perform(as(author, post(commentsPath(draft))
								.contentType(MediaType.APPLICATION_JSON)
								.content(body)))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
			}

			assertThat(commentRepository.findByProjectId(draft.getId())).isEmpty();
		}
	}

	// ==================================================================
	// PATCH /api/comments/{id}
	// ==================================================================

	@Nested
	@DisplayName("PATCH /api/comments/{id}")
	class UpdatingText {

		@Test
		@DisplayName("Die Verfasser:in aendert ihren Text: 200, type und status bleiben")
		void authorEditsOwnComment() throws Exception {
			Comment comment = write(draft, assignedEditor, CommentType.CHANGE_REQUEST,
					"Bitte nachbessern.");

			JsonNode updated = body(as(assignedEditor, textRequest(comment, "Bitte Quellen "
					+ "ergaenzen.")));

			assertThat(updated.get("text").asText()).isEqualTo("Bitte Quellen ergaenzen.");
			assertThat(updated.get("type").asText()).isEqualTo("CHANGE_REQUEST");
			assertThat(updated.get("status").asText()).isEqualTo("OPEN");
		}

		@Test
		@DisplayName("Niemand sonst, auch nicht die Projekt-Autor:in oder die Administration: 403")
		void nobodyElseMayRewriteIt() throws Exception {
			Comment comment = write(draft, assignedEditor, CommentType.REPLY, "Original.");

			for (User user : List.of(author, member, otherStudent, otherEditor, admin)) {
				mockMvc.perform(as(user, textRequest(comment, "Fremder Text.")))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(reload(comment).getText()).isEqualTo("Original.");
		}

		@Test
		@DisplayName("Leerer Text: 400. Unbekannte ID: 404 RESOURCE_NOT_FOUND. Ohne Token: 401")
		void invalidCases() throws Exception {
			Comment comment = write(draft, author, CommentType.REPLY, "Original.");

			mockMvc.perform(as(author, textRequest(comment, "   ")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			mockMvc.perform(as(author, patch("/api/comments/" + UUID.randomUUID())
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("text", "Gibt es nicht."))))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

			mockMvc.perform(textRequest(comment, "Ohne Token."))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(reload(comment).getText()).isEqualTo("Original.");
		}
	}

	// ==================================================================
	// PATCH /api/comments/{id}/status
	// ==================================================================

	@Nested
	@DisplayName("PATCH /api/comments/{id}/status")
	class UpdatingStatus {

		@Test
		@DisplayName("Die Projektseite schaltet einen CHANGE_REQUEST auf RESOLVED (§2.4, §5 "
				+ "Fussnote ²)")
		void projectSideResolvesIt() throws Exception {
			for (User user : List.of(author, member)) {
				Comment comment = write(draft, assignedEditor, CommentType.CHANGE_REQUEST,
						"Bitte nachbessern.");

				assertThat(body(as(user, statusRequest(comment, "RESOLVED")))
						.get("status").asText()).isEqualTo("RESOLVED");
				assertThat(reload(comment).getStatus()).isEqualTo(CommentStatus.RESOLVED);
			}
		}

		@Test
		@DisplayName("Beide Richtungen: ein versehentlich abgehakter Punkt laesst sich wieder "
				+ "oeffnen")
		void bothDirections() throws Exception {
			Comment comment = write(draft, assignedEditor, CommentType.CHANGE_REQUEST,
					"Bitte nachbessern.");

			body(as(author, statusRequest(comment, "RESOLVED")));

			assertThat(body(as(author, statusRequest(comment, "OPEN")))
					.get("status").asText()).isEqualTo("OPEN");
		}

		@Test
		@DisplayName("Redaktion und Administration duerfen es ebenfalls, fremde Studierende nicht: "
				+ "403")
		void editorialMayToo() throws Exception {
			Comment comment = write(draft, assignedEditor, CommentType.CHANGE_REQUEST,
					"Bitte nachbessern.");

			for (User user : List.of(assignedEditor, otherEditor, admin)) {
				assertThat(body(as(user, statusRequest(comment, "RESOLVED")))
						.get("status").asText()).isEqualTo("RESOLVED");
			}

			mockMvc.perform(as(otherStudent, statusRequest(comment, "OPEN")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("REPLY und NOTE tragen keinen Erledigungsstand: 400 VALIDATION_FAILED, und der "
				+ "Kommentar bleibt unveraendert (§3.5)")
		void onlyChangeRequestsCarryAStatus() throws Exception {
			for (CommentType type : List.of(CommentType.REPLY, CommentType.NOTE)) {
				Comment comment = write(draft, assignedEditor, type, "Ohne Erledigungsstand.");

				mockMvc.perform(as(author, statusRequest(comment, "RESOLVED")))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

				assertThat(reload(comment).getStatus()).isNull();
			}
		}

		@Test
		@DisplayName("Fehlender status: 400. Unbekannte ID: 404. Ohne Token: 401")
		void invalidCases() throws Exception {
			Comment comment = write(draft, assignedEditor, CommentType.CHANGE_REQUEST,
					"Bitte nachbessern.");

			mockMvc.perform(as(author, patch("/api/comments/" + comment.getId() + "/status")
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			mockMvc.perform(as(author, patch("/api/comments/" + UUID.randomUUID() + "/status")
							.contentType(MediaType.APPLICATION_JSON)
							.content(json("status", "RESOLVED"))))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

			mockMvc.perform(statusRequest(comment, "RESOLVED"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(reload(comment).getStatus()).isEqualTo(CommentStatus.OPEN);
		}
	}

	// ==================================================================
	// DELETE /api/comments/{id}
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/comments/{id}")
	class Deleting {

		@Test
		@DisplayName("Die Verfasser:in loescht ihren Kommentar: 204, und er ist aus der Liste "
				+ "verschwunden")
		void authorDeletesOwnComment() throws Exception {
			Comment comment = write(draft, author, CommentType.REPLY, "Hat sich erledigt.");

			mockMvc.perform(as(author, delete(commentPath(comment))))
					.andExpect(status().isNoContent());

			assertThat(list(author, draft)).isEmpty();
		}

		@Test
		@DisplayName("Die Administration loescht auch fremde Kommentare: 204")
		void adminDeletesForeignComment() throws Exception {
			Comment comment = write(draft, assignedEditor, CommentType.CHANGE_REQUEST,
					"Bitte nachbessern.");

			mockMvc.perform(as(admin, delete(commentPath(comment))))
					.andExpect(status().isNoContent());

			assertThat(list(admin, draft)).isEmpty();
		}

		@Test
		@DisplayName("Weder die Projektseite noch die betreuende Redaktion loeschen fremde "
				+ "Kommentare: 403")
		void nobodyElseMayDeleteIt() throws Exception {
			Comment comment = write(draft, author, CommentType.REPLY, "Meine Rueckfrage.");

			for (User user : List.of(member, otherStudent, assignedEditor, otherEditor)) {
				mockMvc.perform(as(user, delete(commentPath(comment))))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(list(author, draft)).hasSize(1);
		}

		@Test
		@DisplayName("Unbekannte ID: 404 RESOURCE_NOT_FOUND. Ohne Token: 401")
		void invalidCases() throws Exception {
			mockMvc.perform(as(admin, delete("/api/comments/" + UUID.randomUUID())))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

			Comment comment = write(draft, author, CommentType.REPLY, "Bleibt stehen.");

			mockMvc.perform(delete(commentPath(comment)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(list(author, draft)).hasSize(1);
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	/**
	 * Ein Projekt der Autor:in mit {@code member} als Projektmitglied und
	 * {@code assignedEditor} als betreuender Redaktion. Die Metadaten aus §3.3
	 * bleiben leer: fuer Kommentare spielen sie keine Rolle, gebraucht werden nur
	 * Autorschaft, Mitgliedschaft und Status.
	 */
	private Project project(ProjectStatus status, String title) {
		Project project = projectRepository.saveAndFlush(
				TestProject.withoutId(author, status, title));
		project.getEditors().add(assignedEditor);
		project = projectRepository.saveAndFlush(project);
		// Wie in den Tests zu KAN-16 bis KAN-19: die Zeile steht in der Datenbank,
		// die Sammlung des bereits verwalteten Projekts kennt sie noch nicht. Test
		// und Endpoint teilen sich hier einen Persistenzkontext.
		project.getMembers().add(projectMemberRepository.saveAndFlush(
				TestProject.memberWithoutId(project, member, "Frontend")));
		return project;
	}

	/** Legt einen Kommentar am Repository vorbei an den Endpoints an. */
	private Comment write(Project project, User commentAuthor, CommentType type, String text) {
		return commentRepository.saveAndFlush(Comment.of(project, commentAuthor, type, text));
	}

	/**
	 * Ein Kommentar je Typ aus §2.3, in dieser Reihenfolge: der
	 * Aenderungswunsch, die interne Notiz, die Antwort darauf.
	 */
	private void allThreeTypes(Project project) {
		write(project, assignedEditor, CommentType.CHANGE_REQUEST, "Bitte nachbessern.");
		write(project, assignedEditor, CommentType.NOTE, "Intern besprochen.");
		write(project, author, CommentType.REPLY, "Ist erledigt.");
	}

	private String commentsPath(Project project) {
		return "/api/projects/" + project.getId() + "/comments";
	}

	private String commentPath(Comment comment) {
		return "/api/comments/" + comment.getId();
	}

	private MockHttpServletRequestBuilder createRequest(Project project, String type, String text)
			throws Exception {

		return post(commentsPath(project))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("type", type, "text", text));
	}

	private MockHttpServletRequestBuilder textRequest(Comment comment, String text)
			throws Exception {

		return patch(commentPath(comment))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("text", text));
	}

	private MockHttpServletRequestBuilder statusRequest(Comment comment, String status)
			throws Exception {

		return patch(commentPath(comment) + "/status")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("status", status));
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	private JsonNode list(User user, Project project) throws Exception {
		return body(as(user, get(commentsPath(project))));
	}

	private JsonNode create(User user, Project project, String type, String text) throws Exception {
		String response = mockMvc.perform(as(user, createRequest(project, type, text)))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
		return objectMapper.readTree(response);
	}

	private JsonNode body(MockHttpServletRequestBuilder request) throws Exception {
		return objectMapper.readTree(raw(request));
	}

	private String raw(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private List<String> texts(JsonNode list) {
		List<String> texts = new ArrayList<>();
		list.forEach(entry -> texts.add(entry.get("text").asText()));
		return texts;
	}

	private List<Instant> timestamps(JsonNode list) {
		List<Instant> timestamps = new ArrayList<>();
		list.forEach(entry -> timestamps.add(Instant.parse(entry.get("createdAt").asText())));
		return timestamps;
	}

	private String json(Object... pairs) throws Exception {
		Map<String, Object> fields = new LinkedHashMap<>();
		for (int i = 0; i + 1 < pairs.length; i += 2) {
			fields.put((String) pairs[i], pairs[i + 1]);
		}
		return objectMapper.writeValueAsString(fields);
	}

	private Comment reload(Comment comment) {
		return commentRepository.findById(comment.getId()).orElseThrow();
	}
}
