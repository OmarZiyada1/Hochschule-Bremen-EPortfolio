package de.hsbremen.eportfolio.reaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die beiden Reaktions-Endpoints aus §6.1 gegen die echte Datenbank (KAN-21).
 *
 * <p>Schwerpunkt ist die Idempotenz, weil sie die eigentliche Zusage dieser
 * beiden Zeilen ist: ein zweiter Klick darf den Zaehler nicht verfaelschen. Die
 * Pruefungen zaehlen deshalb nicht nur das Feld {@code count} in der Antwort,
 * sondern auch die Zeilen in der Datenbank; ein Zaehler, der stimmt, waehrend
 * die Tabelle zwei Zeilen fuehrt, waere kein bestandener Fall.
 *
 * <p>Gezaehlt wird immer projektbezogen und nie ueber die ganze Tabelle: die
 * Tests laufen im Profil {@code dev} gegen die Entwicklungsdatenbank, in der
 * noch anderes stehen kann.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck. Die Anmeldung laeuft
 * ueber echte Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe
 * Filterkette durchlaeuft wie in Produktion; nur so sind die 401-Faelle hier
 * aussagekraeftig.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReactionIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ReactionRepository reactionRepository;

	private User author;

	private User student;

	private User otherStudent;

	private User editor;

	private User admin;

	/** Das veroeffentlichte Projekt der Autor:in, der Normalfall aus §3.10. */
	private Project published;

	/** Dasselbe Projekt im Entwurf: hier ist keine Reaktion moeglich. */
	private Project draft;

	@BeforeEach
	void buildData() {
		author = save(Role.STUDENT);
		student = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		editor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		published = project(ProjectStatus.PUBLISHED, "Veroeffentlicht");
		draft = project(ProjectStatus.DRAFT, "Entwurf");
	}

	// ==================================================================
	// POST /api/projects/{id}/reaction
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/reaction")
	class Setting {

		@Test
		@DisplayName("Setzt die Reaktion und antwortet mit 200 und dem neuen Zaehler")
		void setsReaction() throws Exception {
			react(student, published)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.count").value(1));

			assertThat(reactionRepository.findByProjectIdAndUserId(
					published.getId(), student.getId())).isPresent();
		}

		@Test
		@DisplayName("Ein zweiter Aufruf legt keine zweite Zeile an und laesst den Zaehler stehen")
		void isIdempotent() throws Exception {
			react(student, published).andExpect(jsonPath("$.count").value(1));
			react(student, published)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.count").value(1));

			assertThat(rows(published)).isEqualTo(1);
		}

		@Test
		@DisplayName("Jede angemeldete Rolle darf reagieren, auch die Autor:in am eigenen Projekt "
				+ "(§5 kennt hier kein Vier-Augen-Prinzip)")
		void everyRoleMayReact() throws Exception {
			long expected = 0;
			for (User user : List.of(student, editor, admin, author)) {
				expected++;
				react(user, published)
						.andExpect(status().isOk())
						.andExpect(jsonPath("$.count").value(expected));
			}

			assertThat(rows(published)).isEqualTo(4);
		}

		@Test
		@DisplayName("Ohne Token 401, weil §5 fuer PUBLIC ein Kreuz traegt")
		void unauthenticated() throws Exception {
			mockMvc.perform(post(path(published)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(rows(published)).isZero();
		}

		@Test
		@DisplayName("Am nicht veroeffentlichten Projekt 403, auch fuer die Autor:in selbst (§3.10)")
		void notPublished() throws Exception {
			for (User user : List.of(student, editor, admin, author)) {
				react(user, draft)
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(rows(draft)).isZero();
		}

		@Test
		@DisplayName("Unbekannte Projekt-ID ergibt 404 und nicht 403 (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(student, post("/api/projects/" + UUID.randomUUID() + "/reaction")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}
	}

	// ==================================================================
	// DELETE /api/projects/{id}/reaction
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/projects/{id}/reaction")
	class Withdrawing {

		@Test
		@DisplayName("Entfernt die eigene Reaktion und antwortet mit 200 und dem neuen Zaehler")
		void removesOwnReaction() throws Exception {
			react(student, published);

			withdraw(student, published)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.count").value(0));

			assertThat(reactionRepository.findByProjectIdAndUserId(
					published.getId(), student.getId())).isEmpty();
		}

		@Test
		@DisplayName("Ohne vorhandene Reaktion trotzdem 200: der Aufruf bleibt folgenlos")
		void isIdempotent() throws Exception {
			react(otherStudent, published);

			// Diese Person hat gar nicht reagiert; der fremde Zaehler bleibt stehen.
			withdraw(student, published)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.count").value(1));

			// Und ein zweites DELETE derselben Person aendert weiterhin nichts.
			withdraw(student, published).andExpect(jsonPath("$.count").value(1));

			assertThat(rows(published)).isEqualTo(1);
		}

		@Test
		@DisplayName("Betrifft ausschliesslich die eigene Zeile, fremde Reaktionen bleiben stehen")
		void leavesForeignReactionsUntouched() throws Exception {
			react(student, published);
			react(otherStudent, published);
			react(editor, published);

			withdraw(student, published).andExpect(jsonPath("$.count").value(2));

			assertThat(reactionRepository.findByProjectIdAndUserId(
					published.getId(), student.getId())).isEmpty();
			for (User user : List.of(otherStudent, editor)) {
				assertThat(reactionRepository.findByProjectIdAndUserId(
						published.getId(), user.getId())).isPresent();
			}
		}

		@Test
		@DisplayName("Ohne Token 401")
		void unauthenticated() throws Exception {
			react(student, published);

			mockMvc.perform(delete(path(published)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(rows(published)).isEqualTo(1);
		}

		@Test
		@DisplayName("Am nicht veroeffentlichten Projekt 403, dieselbe Pruefung wie beim Setzen "
				+ "(Entscheidung aus der Klaerungsrunde zu KAN-21)")
		void notPublished() throws Exception {
			withdraw(student, draft)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Unbekannte Projekt-ID ergibt 404 und nicht 403 (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(student, delete("/api/projects/" + UUID.randomUUID() + "/reaction")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}
	}

	// ==================================================================
	// Der Zaehler in den Projektantworten (§3.10)
	// ==================================================================

	@Nested
	@DisplayName("Zusammenspiel mit reactionCount aus §6.1")
	class Counter {

		@Test
		@DisplayName("count der Antwort und reactionCount in Kachel und Detail stimmen ueberein, "
				+ "nach dem Setzen wie nach dem Zuruecknehmen")
		void matchesProjectResponses() throws Exception {
			react(student, published).andExpect(jsonPath("$.count").value(1));
			react(editor, published).andExpect(jsonPath("$.count").value(2));
			assertReactionCount(2);

			withdraw(student, published).andExpect(jsonPath("$.count").value(1));
			assertReactionCount(1);
		}

		/**
		 * Dieselbe Zahl in Detail und Kachel. Beide lesen sie ueber {@code COUNT}
		 * und nicht aus einem mitgefuehrten Feld (§3.10), es kann also nichts
		 * auseinanderlaufen; genau das prueft dieser Fall nach.
		 */
		private void assertReactionCount(int expected) throws Exception {
			mockMvc.perform(get("/api/projects/" + published.getId()))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.reactionCount").value(expected));

			mockMvc.perform(as(admin, get("/api/projects?author=" + author.getId()
							+ "&status=PUBLISHED")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content.length()").value(1))
					.andExpect(jsonPath("$.content[0].reactionCount").value(expected));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	/**
	 * Ein Projekt der Autor:in im gewuenschten Status. Die Metadaten aus §3.3
	 * bleiben leer: fuer Reaktionen zaehlt allein der Status.
	 */
	private Project project(ProjectStatus status, String title) {
		return projectRepository.saveAndFlush(TestProject.withoutId(author, status, title));
	}

	private String path(Project project) {
		return "/api/projects/" + project.getId() + "/reaction";
	}

	private ResultActions react(User user, Project project) throws Exception {
		return mockMvc.perform(as(user, post(path(project))));
	}

	private ResultActions withdraw(User user, Project project) throws Exception {
		return mockMvc.perform(as(user, delete(path(project))));
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/** Die Zeilen in der Datenbank, unabhaengig von dem, was die Antwort behauptet. */
	private long rows(Project project) {
		return reactionRepository.countByProjectId(project.getId());
	}
}
