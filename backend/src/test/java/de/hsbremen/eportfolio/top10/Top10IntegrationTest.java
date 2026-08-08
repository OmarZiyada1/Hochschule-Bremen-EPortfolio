package de.hsbremen.eportfolio.top10;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der oeffentliche Endpoint {@code GET /api/top10} und die Nominierung aus §6.1
 * gegen die echte Datenbank (KAN-24).
 *
 * <p>Schwerpunkt sind die drei Zusagen, an denen dieses Modul haengt: die Liste
 * ist geordnet, sie zeigt ausschliesslich veroeffentlichte Projekte (§3.11.1
 * Regel 1), und ein Projekt bekommt hoechstens eine offene Nominierung
 * (Regel 2). Geprueft wird jeweils nicht nur die Antwort, sondern auch der
 * Bestand in der Datenbank; eine Liste, die richtig aussieht, waehrend die
 * Tabelle etwas anderes fuehrt, waere kein bestandener Fall.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck. Die Anmeldung laeuft
 * ueber echte Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe
 * Filterkette durchlaeuft wie in Produktion.
 *
 * <p>Die Admin-Endpoints stehen in {@code Top10AdminIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class Top10IntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private Top10EntryRepository entryRepository;

	@Autowired
	private Top10NominationRepository nominationRepository;

	private User author;

	private User student;

	private User editor;

	private User admin;

	private Project published;

	private Project draft;

	@BeforeEach
	void buildData() {
		// Die Tests laufen im Profil dev gegen die Entwicklungsdatenbank, in der
		// noch anderes stehen kann. Die Top-10 ist aber eine einzige globale
		// Liste; ein Restbestand aus einem frueheren Lauf wuerde jede
		// Positionspruefung verfaelschen. Deshalb wird sie hier geleert, was der
		// Rollback am Ende wieder zuruecknimmt.
		entryRepository.deleteAll();
		entryRepository.flush();

		author = save(Role.STUDENT);
		student = save(Role.STUDENT);
		editor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		published = project(ProjectStatus.PUBLISHED, "Veroeffentlicht");
		draft = project(ProjectStatus.DRAFT, "Entwurf");
	}

	// ==================================================================
	// GET /api/top10
	// ==================================================================

	@Nested
	@DisplayName("GET /api/top10")
	class PublicList {

		@Test
		@DisplayName("Ohne Token abrufbar und leer, solange nichts kuratiert wurde")
		void emptyWithoutToken() throws Exception {
			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(0));
		}

		@Test
		@DisplayName("Aufsteigend nach Platz, je Eintrag position, addedAt und die Projektkachel")
		void orderedByPosition() throws Exception {
			Project second = project(ProjectStatus.PUBLISHED, "Zweiter");
			Project third = project(ProjectStatus.PUBLISHED, "Dritter");

			// Absichtlich in verkehrter Reihenfolge angelegt: die Ordnung darf
			// nicht zufaellig aus der Einfuegereihenfolge stammen.
			entry(third, 3);
			entry(published, 1);
			entry(second, 2);

			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(3))
					.andExpect(jsonPath("$[0].position").value(1))
					.andExpect(jsonPath("$[0].project.title").value("Veroeffentlicht"))
					.andExpect(jsonPath("$[0].addedAt").isNotEmpty())
					.andExpect(jsonPath("$[1].position").value(2))
					.andExpect(jsonPath("$[1].project.title").value("Zweiter"))
					.andExpect(jsonPath("$[2].position").value(3))
					.andExpect(jsonPath("$[2].project.title").value("Dritter"));
		}

		@Test
		@DisplayName("Ein Eintrag zu einem nicht veroeffentlichten Projekt erscheint nicht "
				+ "(zweite Sperre gegen das Sichtbarkeitsleck aus §3.11.1)")
		void hidesUnpublished() throws Exception {
			entry(published, 1);
			// Am Dienst vorbei geschrieben: ueber die API kann dieser Zustand gar
			// nicht entstehen, weil ein Projekt beim Verlassen von PUBLISHED
			// seinen Platz raeumt. Genau darum steht der Filter in der Abfrage.
			entry(draft, 2);

			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].position").value(1));

			assertThat(entryRepository.findAll()).hasSize(2);
		}
	}

	// ==================================================================
	// Entzug beim Verlassen von PUBLISHED
	// ==================================================================

	@Nested
	@DisplayName("Ruecknahme eines Top-10-Projekts nach REVISION")
	class Withdrawal {

		@Test
		@DisplayName("Raeumt den Platz und laesst ihn frei; die uebrigen ruecken nicht nach")
		void freesTheSlotWithoutShifting() throws Exception {
			Project second = project(ProjectStatus.PUBLISHED, "Zweiter");
			Project third = project(ProjectStatus.PUBLISHED, "Dritter");
			entry(published, 1);
			entry(second, 2);
			entry(third, 3);

			mockMvc.perform(as(editor, post("/api/projects/" + second.getId() + "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Bitte die Quellen ergaenzen.\"}"))
					.andExpect(status().isOk());

			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(2))
					.andExpect(jsonPath("$[0].position").value(1))
					.andExpect(jsonPath("$[1].position").value(3));

			assertThat(entryRepository.findByProjectId(second.getId())).isEmpty();
			assertThat(entryRepository.findByProjectId(third.getId()))
					.get()
					.extracting(Top10Entry::getPosition)
					.isEqualTo(3);
		}

		@Test
		@DisplayName("Die Nominierung bleibt als Protokoll bestehen")
		void keepsTheNomination() throws Exception {
			Top10Nomination nomination = nominationRepository.saveAndFlush(
					TestTop10.decided(published, editor, admin, NominationStatus.ACCEPTED));
			entry(published, 1);

			mockMvc.perform(as(admin, post("/api/projects/" + published.getId()
							+ "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Zurueck in die Ueberarbeitung.\"}"))
					.andExpect(status().isOk());

			assertThat(entryRepository.findAll()).isEmpty();
			assertThat(nominationRepository.findById(nomination.getId()))
					.get()
					.extracting(Top10Nomination::getStatus)
					.isEqualTo(NominationStatus.ACCEPTED);
		}
	}

	// ==================================================================
	// POST /api/projects/{id}/top10-nomination
	// ==================================================================

	@Nested
	@DisplayName("POST /api/projects/{id}/top10-nomination")
	class Nominating {

		@Test
		@DisplayName("Redaktion nominiert ein veroeffentlichtes Projekt: 201 und Stand PENDING")
		void editorNominates() throws Exception {
			nominate(editor, published, "{\"proposedPosition\":3}")
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.status").value("PENDING"))
					.andExpect(jsonPath("$.proposedPosition").value(3))
					.andExpect(jsonPath("$.nominatedBy.id").value(editor.getId().toString()))
					.andExpect(jsonPath("$.decidedBy").doesNotExist())
					.andExpect(jsonPath("$.decidedAt").doesNotExist())
					.andExpect(jsonPath("$.project.title").value("Veroeffentlicht"));

			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(1);
		}

		@Test
		@DisplayName("Auch ohne Body: der Platzvorschlag ist optional (§3.11)")
		void nominatesWithoutBody() throws Exception {
			mockMvc.perform(as(editor, post(path(published))))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.proposedPosition").doesNotExist());
		}

		@Test
		@DisplayName("Ein Platzvorschlag ausserhalb von 1 bis 10 ergibt 400")
		void rejectsInvalidProposedPosition() throws Exception {
			nominate(editor, published, "{\"proposedPosition\":11}")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Ohne Token 401, weil §5 fuer PUBLIC ein Kreuz traegt")
		void unauthenticated() throws Exception {
			mockMvc.perform(post(path(published)))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Studierende duerfen nicht nominieren: 403 (§5)")
		void studentForbidden() throws Exception {
			nominate(student, published, null)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			// Auch die Autor:in des Projekts nicht: die Matrixzeile fragt nach der
			// Rolle und nicht nach der Beziehung zum Projekt.
			nominate(author, published, null)
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Unbekannte Projekt-ID ergibt 404 und nicht 403 (§6.3.1)")
		void unknownProject() throws Exception {
			mockMvc.perform(as(editor, post("/api/projects/" + UUID.randomUUID()
							+ "/top10-nomination")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ein nicht veroeffentlichtes Projekt ergibt 409 PROJECT_NOT_PUBLISHED "
				+ "(§3.11.1 Regel 1)")
		void notPublished() throws Exception {
			for (ProjectStatus status : List.of(ProjectStatus.DRAFT, ProjectStatus.SUBMITTED,
					ProjectStatus.APPROVED, ProjectStatus.REVISION)) {

				Project candidate = project(status, "Im Status " + status);
				nominate(editor, candidate, null)
						.andExpect(status().isConflict())
						.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_PUBLISHED"));

				assertThat(nominationRepository.findByProjectId(candidate.getId())).isEmpty();
			}
		}

		@Test
		@DisplayName("Eine zweite offene Nominierung zum selben Projekt ergibt 409 "
				+ "RESOURCE_IN_USE (§3.11.1 Regel 2)")
		void secondOpenNomination() throws Exception {
			nominate(editor, published, null).andExpect(status().isCreated());

			nominate(admin, published, null)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(1);
		}

		@Test
		@DisplayName("Ein Projekt, das bereits in der Top-10 steht, laesst sich nicht nominieren: "
				+ "409 RESOURCE_IN_USE (§3.11.1 Regel 2)")
		void alreadyInTheList() throws Exception {
			entry(published, 1);

			nominate(editor, published, null)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(nominationRepository.findByProjectId(published.getId())).isEmpty();
		}

		@Test
		@DisplayName("Nach einer Ablehnung ist dasselbe Projekt wieder nominierbar: Regel 2 "
				+ "spricht von der offenen Nominierung")
		void renominationAfterRejection() throws Exception {
			nominationRepository.saveAndFlush(
					TestTop10.decided(published, editor, admin, NominationStatus.REJECTED));

			nominate(editor, published, null).andExpect(status().isCreated());

			assertThat(nominationRepository.findByProjectId(published.getId())).hasSize(2);
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
	 * bleiben leer: fuer die Top-10 zaehlt allein der Status.
	 */
	private Project project(ProjectStatus status, String title) {
		return projectRepository.saveAndFlush(TestProject.withoutId(author, status, title));
	}

	/**
	 * Ein Platz in der Liste, am Dienst vorbei geschrieben. Der Zeitstempel liegt
	 * bewusst in der Vergangenheit, damit sich ein spaeter neu vergebener
	 * {@code addedAt} davon unterscheiden laesst.
	 */
	private Top10Entry entry(Project project, int position) {
		return entryRepository.saveAndFlush(TestTop10.entry(project, position,
				Instant.now().minus(7, ChronoUnit.DAYS)));
	}

	private String path(Project project) {
		return "/api/projects/" + project.getId() + "/top10-nomination";
	}

	private ResultActions nominate(User user, Project project, String body) throws Exception {
		MockHttpServletRequestBuilder request = as(user, post(path(project)));
		if (body != null) {
			request = request.contentType(MediaType.APPLICATION_JSON).content(body);
		}
		return mockMvc.perform(request);
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
