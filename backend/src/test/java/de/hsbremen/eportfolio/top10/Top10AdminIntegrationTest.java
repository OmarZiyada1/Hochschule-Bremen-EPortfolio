package de.hsbremen.eportfolio.top10;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
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
 * Die vier Admin-Zeilen der Top-10 aus §6.1 gegen die echte Datenbank (KAN-24):
 * Protokoll lesen, annehmen, ablehnen, Reihenfolge setzen.
 *
 * <p>Schwerpunkte sind die Zusagen aus §3.11 und der Klaerungsrunde: das
 * Protokoll bleibt nach einer Entscheidung vollstaendig, die Grenze von zehn
 * Plaetzen ist nicht ueberschreitbar, ein belegter Platz wird nicht geraeumt,
 * und {@code PUT /api/admin/top10} ersetzt die Liste vollstaendig, ohne
 * {@code addedAt} zu verschieben.
 *
 * <p>Aufbau, Anmeldung und Rollback wie in {@code Top10IntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class Top10AdminIntegrationTest {

	private static final String NOMINATIONS = "/api/admin/top10-nominations";

	private static final String ORDER = "/api/admin/top10";

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

	private Project first;

	private Project second;

	private Project third;

	@BeforeEach
	void buildData() {
		// Siehe Top10IntegrationTest: die Top-10 ist eine globale Liste, ein
		// Restbestand der Entwicklungsdatenbank wuerde jede Positionspruefung
		// verfaelschen. Der Rollback nimmt das Leeren wieder zurueck.
		entryRepository.deleteAll();
		entryRepository.flush();

		author = save(Role.STUDENT);
		student = save(Role.STUDENT);
		editor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		first = project(ProjectStatus.PUBLISHED, "Erster");
		second = project(ProjectStatus.PUBLISHED, "Zweiter");
		third = project(ProjectStatus.PUBLISHED, "Dritter");
	}

	// ==================================================================
	// GET /api/admin/top10-nominations
	// ==================================================================

	@Nested
	@DisplayName("GET /api/admin/top10-nominations")
	class Protocol {

		@Test
		@DisplayName("Nach einer Entscheidung bleibt das Protokoll vollstaendig (§3.11)")
		void keepsDecidedNominations() throws Exception {
			Top10Nomination open = nomination(first, null);
			nominationRepository.saveAndFlush(
					TestTop10.decided(second, editor, admin, NominationStatus.REJECTED));

			accept(open, 1).andExpect(status().isOk());

			mockMvc.perform(as(admin, get(NOMINATIONS)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(2));

			assertThat(nominationRepository.findAll()).hasSize(2);
		}

		@Test
		@DisplayName("Der Filter status grenzt auf einen Stand ein (§2.8)")
		void filtersByStatus() throws Exception {
			nomination(first, null);
			nominationRepository.saveAndFlush(
					TestTop10.decided(second, editor, admin, NominationStatus.REJECTED));

			mockMvc.perform(as(admin, get(NOMINATIONS + "?status=PENDING")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].project.title").value("Erster"));

			mockMvc.perform(as(admin, get(NOMINATIONS + "?status=REJECTED")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].project.title").value("Zweiter"));

			mockMvc.perform(as(admin, get(NOMINATIONS + "?status=ACCEPTED")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(0));
		}

		@Test
		@DisplayName("Ein unbekannter Stand ergibt 400 im Envelope")
		void rejectsUnknownStatus() throws Exception {
			mockMvc.perform(as(admin, get(NOMINATIONS + "?status=OFFEN")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ohne Token 401, mit fremder Rolle 403 (§5: kuratieren darf nur ADMIN)")
		void adminOnly() throws Exception {
			mockMvc.perform(get(NOMINATIONS))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			for (User user : List.of(student, editor)) {
				mockMvc.perform(as(user, get(NOMINATIONS)))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}
	}

	// ==================================================================
	// POST /api/admin/top10-nominations/{id}/accept
	// ==================================================================

	@Nested
	@DisplayName("POST /api/admin/top10-nominations/{id}/accept")
	class Accepting {

		@Test
		@DisplayName("Setzt status, decidedBy und decidedAt und legt den Eintrag auf dem Platz an")
		void createsEntry() throws Exception {
			Top10Nomination nomination = nomination(first, 9);

			accept(nomination, 4)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("ACCEPTED"))
					.andExpect(jsonPath("$.decidedBy.id").value(admin.getId().toString()))
					.andExpect(jsonPath("$.decidedAt").isNotEmpty())
					// Der Vorschlag bleibt stehen und wird nicht durch den
					// tatsaechlichen Platz ueberschrieben: er ist Teil des
					// Protokolls.
					.andExpect(jsonPath("$.proposedPosition").value(9));

			assertThat(entryRepository.findByProjectId(first.getId()))
					.get()
					.extracting(Top10Entry::getPosition)
					.isEqualTo(4);
		}

		@Test
		@DisplayName("Der unverbindliche Platzvorschlag entscheidet nicht: es gilt der Body")
		void ignoresProposedPosition() throws Exception {
			accept(nomination(first, 1), 7).andExpect(status().isOk());

			assertThat(entryRepository.findByProjectId(first.getId()))
					.get()
					.extracting(Top10Entry::getPosition)
					.isEqualTo(7);
		}

		@Test
		@DisplayName("Ein belegter Platz ergibt 409 RESOURCE_IN_USE und veraendert nichts")
		void occupiedPosition() throws Exception {
			entry(first, 2);
			Top10Nomination nomination = nomination(second, null);

			accept(nomination, 2)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(entryRepository.findByProjectId(second.getId())).isEmpty();
			assertThat(nominationRepository.findById(nomination.getId()))
					.get()
					.extracting(Top10Nomination::getStatus)
					.isEqualTo(NominationStatus.PENDING);
		}

		@Test
		@DisplayName("Bei zehn belegten Plaetzen ist die Grenze erreicht: jede Position ergibt 409")
		void listIsFull() throws Exception {
			for (int i = 1; i <= 10; i++) {
				entry(project(ProjectStatus.PUBLISHED, "Platz " + i), i);
			}

			Top10Nomination nomination = nomination(first, null);
			for (int position = 1; position <= 10; position++) {
				accept(nomination, position)
						.andExpect(status().isConflict())
						.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));
			}

			assertThat(entryRepository.findAll()).hasSize(10);
		}

		@Test
		@DisplayName("Ein Platz ausserhalb von 1 bis 10 und ein fehlender Platz ergeben 400")
		void invalidPosition() throws Exception {
			Top10Nomination nomination = nomination(first, null);

			for (String body : List.of("{\"position\":0}", "{\"position\":11}", "{}")) {
				mockMvc.perform(as(admin, post(NOMINATIONS + "/" + nomination.getId() + "/accept"))
								.contentType(MediaType.APPLICATION_JSON)
								.content(body))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
			}

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Eine bereits entschiedene Nominierung ergibt 409 NOMINATION_ALREADY_DECIDED")
		void alreadyDecided() throws Exception {
			Top10Nomination nomination = nomination(first, null);
			accept(nomination, 1).andExpect(status().isOk());

			accept(nomination, 2)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("NOMINATION_ALREADY_DECIDED"));

			// Der zweite Aufruf hat weder einen zweiten Eintrag angelegt noch den
			// ersten verschoben.
			assertThat(entryRepository.findAll()).hasSize(1);
			assertThat(entryRepository.findByProjectId(first.getId()))
					.get()
					.extracting(Top10Entry::getPosition)
					.isEqualTo(1);
		}

		@Test
		@DisplayName("Ein inzwischen zurueckgezogenes Projekt ergibt 409 PROJECT_NOT_PUBLISHED: "
				+ "§3.11.1 Regel 1 gilt auch fuer die Aufnahme")
		void projectWithdrawnMeanwhile() throws Exception {
			Top10Nomination nomination = nomination(first, null);

			first.setStatus(ProjectStatus.REVISION);
			projectRepository.saveAndFlush(first);

			accept(nomination, 1)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_PUBLISHED"));

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Unbekannte Nominierungs-ID ergibt 404 RESOURCE_NOT_FOUND (§6.3.1)")
		void unknownNomination() throws Exception {
			mockMvc.perform(as(admin, post(NOMINATIONS + "/" + UUID.randomUUID() + "/accept"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"position\":1}"))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Ohne Token 401, mit fremder Rolle 403")
		void adminOnly() throws Exception {
			Top10Nomination nomination = nomination(first, null);
			String path = NOMINATIONS + "/" + nomination.getId() + "/accept";

			mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
							.content("{\"position\":1}"))
					.andExpect(status().isUnauthorized());

			for (User user : List.of(student, editor)) {
				mockMvc.perform(as(user, post(path)).contentType(MediaType.APPLICATION_JSON)
								.content("{\"position\":1}"))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(entryRepository.findAll()).isEmpty();
		}
	}

	// ==================================================================
	// POST /api/admin/top10-nominations/{id}/reject
	// ==================================================================

	@Nested
	@DisplayName("POST /api/admin/top10-nominations/{id}/reject")
	class Rejecting {

		@Test
		@DisplayName("Setzt status, decidedBy und decidedAt, ohne die Liste anzufassen")
		void rejectsWithoutTouchingTheList() throws Exception {
			Top10Nomination nomination = nomination(first, null);

			mockMvc.perform(as(admin, post(NOMINATIONS + "/" + nomination.getId() + "/reject")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("REJECTED"))
					.andExpect(jsonPath("$.decidedBy.id").value(admin.getId().toString()))
					.andExpect(jsonPath("$.decidedAt").isNotEmpty());

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein Vorschlag zu einem zurueckgezogenen Projekt laesst sich ablehnen: "
				+ "die Statuspruefung haengt an der Aufnahme, nicht an der Entscheidung")
		void rejectsWithdrawnProject() throws Exception {
			Top10Nomination nomination = nomination(first, null);

			first.setStatus(ProjectStatus.REVISION);
			projectRepository.saveAndFlush(first);

			mockMvc.perform(as(admin, post(NOMINATIONS + "/" + nomination.getId() + "/reject")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("REJECTED"));
		}

		@Test
		@DisplayName("Eine zweite Entscheidung ergibt 409 NOMINATION_ALREADY_DECIDED")
		void alreadyDecided() throws Exception {
			Top10Nomination nomination = nominationRepository.saveAndFlush(
					TestTop10.decided(first, editor, admin, NominationStatus.ACCEPTED));

			mockMvc.perform(as(admin, post(NOMINATIONS + "/" + nomination.getId() + "/reject")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("NOMINATION_ALREADY_DECIDED"));

			assertThat(nominationRepository.findById(nomination.getId()))
					.get()
					.extracting(Top10Nomination::getStatus)
					.isEqualTo(NominationStatus.ACCEPTED);
		}
	}

	// ==================================================================
	// PUT /api/admin/top10
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/admin/top10")
	class Ordering {

		@Test
		@DisplayName("Der Array-Index ist der Platz: das erste Element steht auf Platz 1 "
				+ "(§3.11.1 Regel 3)")
		void indexIsPosition() throws Exception {
			setOrder(admin, third, first, second)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(3))
					.andExpect(jsonPath("$[0].position").value(1))
					.andExpect(jsonPath("$[0].project.title").value("Dritter"))
					.andExpect(jsonPath("$[1].position").value(2))
					.andExpect(jsonPath("$[1].project.title").value("Erster"))
					.andExpect(jsonPath("$[2].position").value(3))
					.andExpect(jsonPath("$[2].project.title").value("Zweiter"));
		}

		@Test
		@DisplayName("Ersetzt die Liste vollstaendig; eine leere Liste leert sie")
		void replacesCompletely() throws Exception {
			setOrder(admin, first, second, third).andExpect(status().isOk());

			setOrder(admin, second)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(1))
					.andExpect(jsonPath("$[0].project.title").value("Zweiter"));

			assertThat(entryRepository.findAll()).hasSize(1);

			mockMvc.perform(as(admin, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
							.content("{\"projectIds\":[]}"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(0));

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("addedAt bleibt beim Umsortieren stehen: eine Umsortierung ist keine Aufnahme")
		void keepsAddedAt() throws Exception {
			Instant added = Instant.now().minus(7, ChronoUnit.DAYS);
			entryRepository.saveAndFlush(TestTop10.entry(first, 1, added));

			setOrder(admin, second, first).andExpect(status().isOk());

			assertThat(entryRepository.findByProjectId(first.getId()))
					.get()
					.satisfies(entry -> {
						assertThat(entry.getPosition()).isEqualTo(2);
						assertThat(entry.getAddedAt()).isCloseTo(added,
								within(1, ChronoUnit.SECONDS));
					});
			assertThat(entryRepository.findByProjectId(second.getId()))
					.get()
					.satisfies(entry -> assertThat(entry.getAddedAt()).isAfter(added));
		}

		@Test
		@DisplayName("Offene Nominierungen der aufgenommenen Projekte gelten als angenommen")
		void closesOpenNominations() throws Exception {
			Top10Nomination taken = nomination(first, null);
			Top10Nomination untouched = nomination(third, null);

			setOrder(admin, first, second).andExpect(status().isOk());

			assertThat(nominationRepository.findById(taken.getId()))
					.get()
					.satisfies(nomination -> {
						assertThat(nomination.getStatus()).isEqualTo(NominationStatus.ACCEPTED);
						assertThat(nomination.getDecidedBy().getId()).isEqualTo(admin.getId());
						assertThat(nomination.getDecidedAt()).isNotNull();
					});
			assertThat(nominationRepository.findById(untouched.getId()))
					.get()
					.extracting(Top10Nomination::getStatus)
					.isEqualTo(NominationStatus.PENDING);
		}

		@Test
		@DisplayName("Mehr als zehn Eintraege ergeben 400 und veraendern nichts")
		void rejectsMoreThanTen() throws Exception {
			entry(first, 1);

			List<UUID> eleven = new ArrayList<>();
			for (int i = 0; i < 11; i++) {
				eleven.add(project(ProjectStatus.PUBLISHED, "Kandidat " + i).getId());
			}

			mockMvc.perform(as(admin, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
							.content(body(eleven)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(entryRepository.findAll()).hasSize(1);
		}

		@Test
		@DisplayName("Eine unbekannte Projekt-ID ergibt 400 und nicht 404: geprueft wird der Body")
		void rejectsUnknownProject() throws Exception {
			mockMvc.perform(as(admin, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
							.content(body(List.of(first.getId(), UUID.randomUUID()))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein nicht veroeffentlichtes Projekt ergibt 400 (§3.11.1 Regel 1)")
		void rejectsUnpublishedProject() throws Exception {
			Project draft = project(ProjectStatus.DRAFT, "Entwurf");

			mockMvc.perform(as(admin, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
							.content(body(List.of(first.getId(), draft.getId()))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein doppelt genanntes Projekt ergibt 400: ein Projekt belegt einen Platz")
		void rejectsDuplicates() throws Exception {
			mockMvc.perform(as(admin, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
							.content(body(List.of(first.getId(), second.getId(), first.getId()))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ohne Token 401, mit fremder Rolle 403 (§5: kuratieren darf nur ADMIN)")
		void adminOnly() throws Exception {
			mockMvc.perform(put(ORDER).contentType(MediaType.APPLICATION_JSON)
							.content(body(List.of(first.getId()))))
					.andExpect(status().isUnauthorized());

			for (User user : List.of(student, editor)) {
				setOrder(user, first)
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}

			assertThat(entryRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Die neue Liste erscheint anschliessend unveraendert in GET /api/top10")
		void matchesPublicList() throws Exception {
			setOrder(admin, second, third).andExpect(status().isOk());

			mockMvc.perform(get("/api/top10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.length()").value(2))
					.andExpect(jsonPath("$[0].project.title").value("Zweiter"))
					.andExpect(jsonPath("$[1].project.title").value("Dritter"));
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	private Project project(ProjectStatus status, String title) {
		return projectRepository.saveAndFlush(TestProject.withoutId(author, status, title));
	}

	private Top10Entry entry(Project project, int position) {
		return entryRepository.saveAndFlush(TestTop10.entry(project, position, Instant.now()));
	}

	private Top10Nomination nomination(Project project, Integer proposedPosition) {
		return nominationRepository.saveAndFlush(
				TestTop10.pending(project, editor, proposedPosition));
	}

	private ResultActions accept(Top10Nomination nomination, int position) throws Exception {
		return mockMvc.perform(as(admin, post(NOMINATIONS + "/" + nomination.getId() + "/accept"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"position\":" + position + "}"));
	}

	private ResultActions setOrder(User user, Project... projects) throws Exception {
		List<UUID> ids = new ArrayList<>();
		for (Project project : projects) {
			ids.add(project.getId());
		}
		return mockMvc.perform(as(user, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
				.content(body(ids)));
	}

	private static String body(List<UUID> projectIds) {
		return "{\"projectIds\":["
				+ projectIds.stream()
						.map(id -> "\"" + id + "\"")
						.collect(Collectors.joining(","))
				+ "]}";
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
