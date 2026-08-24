package de.hsbremen.eportfolio.top10;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.NominationTier;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.Top10Action;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
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
 * Das Aenderungsprotokoll der Top-10 gegen die echte Datenbank (KAN-45, §3.17,
 * {@code GET /api/admin/top10-audit} aus §6.1).
 *
 * <p>Zwei Schwerpunkte. Der erste sind die <strong>vier Schreibwege</strong> aus
 * dem Nachtrag zu Contract v28: jeder von ihnen muss genau die Zeilen erzeugen,
 * die er soll, und ein Projekt, das auf seinem Platz stehen bleibt, darf keine
 * erzeugen. Der zweite ist der <strong>Lesepfad</strong>: Rechte, die drei
 * Filter, das Seitenformat und die Ordnung, an der hier mehr haengt als sonst,
 * weil alle Zeilen eines Aufrufs denselben Zeitstempel tragen.
 *
 * <p>Aufbau, Anmeldung und Rollback wie in {@code Top10AdminIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class Top10AuditIntegrationTest {

	private static final String AUDIT = "/api/admin/top10-audit";

	private static final String NOMINATIONS = "/api/admin/top10-nominations";

	private static final String ORDER = "/api/admin/top10";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private Top10EntryRepository entryRepository;

	@Autowired
	private Top10NominationRepository nominationRepository;

	@Autowired
	private Top10AuditEntryRepository auditRepository;

	private User author;

	private User student;

	private User editor;

	private User admin;

	private Project first;

	private Project second;

	private Project third;

	@BeforeEach
	void buildData() {
		// Wie im Top10AdminIntegrationTest: die Top-10 ist eine globale Liste, ein
		// Restbestand der Entwicklungsdatenbank wuerde jede Positionspruefung
		// verfaelschen. Das Protokoll muss aus demselben Grund leer anfangen, sonst
		// zaehlt jede Erwartung an eine Seite die Altlast mit. Der Rollback nimmt
		// beides wieder zurueck.
		auditRepository.deleteAll();
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
	// Die vier Schreibwege (§3.17, Nachtrag Contract v28)
	// ==================================================================

	@Nested
	@DisplayName("Schreibwege")
	class Writing {

		@Test
		@DisplayName("Die Annahme einer Nominierung schreibt genau ein ADDED mit newPosition")
		void acceptingWritesAdded() throws Exception {
			Top10Nomination nomination = nominationRepository.saveAndFlush(
					TestTop10.pending(first, editor, NominationTier.TOP_10));

			mockMvc.perform(as(admin, post(NOMINATIONS + "/" + nomination.getId() + "/accept"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"position\":4}"))
					.andExpect(status().isOk());

			assertThat(auditRepository.findAll())
					.singleElement()
					.satisfies(entry -> {
						assertThat(entry.getAction()).isEqualTo(Top10Action.ADDED);
						assertThat(entry.getProject().getId()).isEqualTo(first.getId());
						assertThat(entry.getAdmin().getId()).isEqualTo(admin.getId());
						assertThat(entry.getPreviousPosition()).isNull();
						assertThat(entry.getNewPosition()).isEqualTo(4);
						assertThat(entry.getTimestamp()).isNotNull();
					});
		}

		@Test
		@DisplayName("PUT /admin/top10 schreibt je bewegtem Projekt eine Zeile: ADDED, REORDERED "
				+ "und REMOVED nebeneinander")
		void orderingWritesOnePerMovedProject() throws Exception {
			entry(first, 1);
			entry(second, 2);

			// Erster bleibt auf Platz 1, Zweiter wandert von 2 auf 3, Dritter kommt
			// auf Platz 2 dazu. Ein viertes Projekt faellt heraus.
			Project dropped = project(ProjectStatus.PUBLISHED, "Rausgefallener");
			entry(dropped, 5);

			setOrder(admin, first, third, second).andExpect(status().isOk());

			List<Top10AuditEntry> entries = auditRepository.findAll();
			assertThat(entries).hasSize(3);

			// Der unveraenderte Platz erzeugt keine Zeile: eine Umsortierung, die ein
			// Projekt stehen laesst, hat es nicht bewegt.
			assertThat(entries)
					.noneSatisfy(entry ->
							assertThat(entry.getProject().getId()).isEqualTo(first.getId()));

			assertThat(byProject(entries, third))
					.satisfies(entry -> {
						assertThat(entry.getAction()).isEqualTo(Top10Action.ADDED);
						assertThat(entry.getPreviousPosition()).isNull();
						assertThat(entry.getNewPosition()).isEqualTo(2);
					});
			assertThat(byProject(entries, second))
					.satisfies(entry -> {
						assertThat(entry.getAction()).isEqualTo(Top10Action.REORDERED);
						assertThat(entry.getPreviousPosition()).isEqualTo(2);
						assertThat(entry.getNewPosition()).isEqualTo(3);
					});
			assertThat(byProject(entries, dropped))
					.satisfies(entry -> {
						assertThat(entry.getAction()).isEqualTo(Top10Action.REMOVED);
						assertThat(entry.getPreviousPosition()).isEqualTo(5);
						assertThat(entry.getNewPosition()).isNull();
					});

			// Alle Zeilen eines Aufrufs tragen denselben Zeitpunkt (§3.17): sie
			// gehoeren zu einer Entscheidung.
			assertThat(entries).extracting(Top10AuditEntry::getTimestamp).containsOnly(
					entries.get(0).getTimestamp());
			assertThat(entries).allSatisfy(entry ->
					assertThat(entry.getAdmin().getId()).isEqualTo(admin.getId()));
		}

		@Test
		@DisplayName("Eine Umsortierung, die nichts bewegt, schreibt nichts")
		void unchangedOrderWritesNothing() throws Exception {
			entry(first, 1);
			entry(second, 2);

			setOrder(admin, first, second).andExpect(status().isOk());

			assertThat(auditRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Seit Contract v72 kommt der Entzug ueber den Statuswechsel gar nicht "
				+ "mehr zustande: die Liste sperrt ihn, und es entsteht keine Zeile")
		void leavingPublishedIsRefusedWhileInTheList() throws Exception {
			entry(first, 3);
			assignEditor(first, editor);

			/*
			 * Bis v71 entzog dieser Aufruf den Platz still mit und schrieb dafuer
			 * eine Zeile REMOVED. §4.1 dreht die Reihenfolge seit v72 um: erst
			 * aus der Liste nehmen, dann zurueckgeben. Der Schreibweg aus dem
			 * Nachtrag zu v28 bleibt in §3.17 stehen, kann auf diesem Weg aber
			 * nicht mehr ausloesen; frei wird ein Platz jetzt ueber
			 * PUT /admin/top10, ueber das Zurueckziehen einer angenommenen
			 * Nominierung (v70) oder ueber das Loeschen des Projekts.
			 */
			mockMvc.perform(as(editor, post("/api/projects/" + first.getId() + "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Bitte die Quellenangaben ergaenzen.\"}"))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(entryRepository.findByProjectId(first.getId())).isPresent();
			assertThat(auditRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein Statuswechsel eines Projekts ohne Platz schreibt nichts")
		void leavingPublishedWithoutSeatWritesNothing() throws Exception {
			assignEditor(first, editor);

			mockMvc.perform(as(editor, post("/api/projects/" + first.getId() + "/request-revision"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"reason\":\"Bitte die Quellenangaben ergaenzen.\"}"))
					.andExpect(status().isOk());

			assertThat(auditRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Wird ein Projekt geloescht, bleibt die Zeile stehen, ohne Projektverweis")
		void deletingProjectKeepsTheEntry() throws Exception {
			entry(first, 7);

			mockMvc.perform(as(admin, delete("/api/projects/" + first.getId())))
					.andExpect(status().isNoContent());

			// Erzwingt genau den Flush, an dem die Loeschung tatsaechlich in die
			// Datenbank geht. Ohne ihn faende der Test einen Fehler nicht, der im
			// Betrieb erst beim Commit auftritt.
			entityManager.flush();
			entityManager.clear();

			assertThat(projectRepository.findById(first.getId())).isEmpty();
			assertThat(auditRepository.findAll())
					.singleElement()
					.satisfies(entry -> {
						assertThat(entry.getAction()).isEqualTo(Top10Action.REMOVED);
						assertThat(entry.getPreviousPosition()).isEqualTo(7);
						assertThat(entry.getAdmin().getId()).isEqualTo(admin.getId());
						// Die Zeile bleibt, der Verweis nicht: das ist die Zusage „das
						// Protokoll wird nie geloescht" aus §3.17.
						assertThat(entry.getProject()).isNull();
					});
		}

		@Test
		@DisplayName("Zeilen zu frueheren Aenderungen verlieren beim Loeschen ihren Verweis, "
				+ "bleiben aber stehen (on delete set null)")
		void deletingProjectEmptiesOlderReferences() throws Exception {
			audit(admin, first, Top10Action.ADDED, Instant.now().minus(1, ChronoUnit.DAYS),
					null, 2);
			entry(first, 2);

			// Der Vorzustand stammt fachlich aus einer frueheren Anfrage. Ohne
			// clear() haenge er noch im Persistenzkontext dieser Anfrage, und der
			// Test pruefte einen Zustand, den es im Betrieb nicht gibt: der
			// Loesch-Endpoint liest das Protokoll nicht.
			entityManager.flush();
			entityManager.clear();

			mockMvc.perform(as(admin, delete("/api/projects/" + first.getId())))
					.andExpect(status().isNoContent());

			entityManager.flush();
			entityManager.clear();

			assertThat(auditRepository.findAll())
					.hasSize(2)
					.allSatisfy(entry -> assertThat(entry.getProject()).isNull())
					.extracting(Top10AuditEntry::getAction)
					.containsExactlyInAnyOrder(Top10Action.ADDED, Top10Action.REMOVED);
		}

		@Test
		@DisplayName("Ein Projekt ohne Platz zu loeschen schreibt nichts")
		void deletingProjectWithoutSeatWritesNothing() throws Exception {
			Project draft = project(ProjectStatus.DRAFT, "Entwurf");

			mockMvc.perform(as(admin, delete("/api/projects/" + draft.getId())))
					.andExpect(status().isNoContent());

			assertThat(auditRepository.findAll()).isEmpty();
		}
	}

	// ==================================================================
	// GET /api/admin/top10-audit
	// ==================================================================

	@Nested
	@DisplayName("GET /api/admin/top10-audit")
	class Reading {

		@Test
		@DisplayName("Ohne Token 401, mit fremder Rolle 403 NO_PERMISSION "
				+ "(§5: das Protokoll liest nur ADMIN)")
		void adminOnly() throws Exception {
			mockMvc.perform(get(AUDIT))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			for (User user : List.of(student, editor, author)) {
				mockMvc.perform(as(user, get(AUDIT)))
						.andExpect(status().isForbidden())
						.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			}
		}

		@Test
		@DisplayName("Antwortet im Seitenformat aus §6.6, neueste Aenderung zuerst")
		void pageFormatAndDefaultOrder() throws Exception {
			Instant now = Instant.now();
			audit(admin, first, Top10Action.ADDED, now.minus(2, ChronoUnit.HOURS), null, 1);
			audit(admin, second, Top10Action.ADDED, now.minus(1, ChronoUnit.HOURS), null, 2);
			audit(editor, third, Top10Action.REMOVED, now, 2, null);

			mockMvc.perform(as(admin, get(AUDIT)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content.length()").value(3))
					.andExpect(jsonPath("$.page").value(0))
					.andExpect(jsonPath("$.size").value(20))
					.andExpect(jsonPath("$.totalElements").value(3))
					.andExpect(jsonPath("$.totalPages").value(1))
					// Ohne sort gilt timestamp,desc (§6.1).
					.andExpect(jsonPath("$.content[0].project.title").value("Dritter"))
					.andExpect(jsonPath("$.content[0].action").value("REMOVED"))
					.andExpect(jsonPath("$.content[0].previousPosition").value(2))
					.andExpect(jsonPath("$.content[0].newPosition").isEmpty())
					.andExpect(jsonPath("$.content[0].admin.id").value(editor.getId().toString()))
					.andExpect(jsonPath("$.content[1].project.title").value("Zweiter"))
					.andExpect(jsonPath("$.content[2].project.title").value("Erster"));
		}

		@Test
		@DisplayName("Die Filter from und to schliessen beide Grenzen ein "
				+ "(§6.1, praezisiert mit v28)")
		void rangeFilterIncludesBothBounds() throws Exception {
			Instant from = Instant.parse("2026-08-01T00:00:00Z");
			Instant to = Instant.parse("2026-08-03T00:00:00Z");

			audit(admin, first, Top10Action.ADDED, from.minusMillis(1), null, 1);
			audit(admin, second, Top10Action.ADDED, from, null, 2);
			audit(admin, third, Top10Action.ADDED, to, null, 3);
			audit(admin, first, Top10Action.REMOVED, to.plusMillis(1), 1, null);

			mockMvc.perform(as(admin, get(AUDIT + "?from=" + from + "&to=" + to)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(2))
					.andExpect(jsonPath("$.content[0].project.title").value("Dritter"))
					.andExpect(jsonPath("$.content[1].project.title").value("Zweiter"));

			// Jede Grenze wirkt auch allein.
			mockMvc.perform(as(admin, get(AUDIT + "?from=" + to)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(2));
			mockMvc.perform(as(admin, get(AUDIT + "?to=" + from)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(2));
		}

		@Test
		@DisplayName("Der Filter admin grenzt auf die handelnde Person ein")
		void adminFilter() throws Exception {
			Instant now = Instant.now();
			audit(admin, first, Top10Action.ADDED, now, null, 1);
			audit(editor, second, Top10Action.REMOVED, now.minusSeconds(60), 2, null);

			mockMvc.perform(as(admin, get(AUDIT + "?admin=" + admin.getId())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(1))
					.andExpect(jsonPath("$.content[0].project.title").value("Erster"));

			mockMvc.perform(as(admin, get(AUDIT + "?admin=" + editor.getId())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(1))
					.andExpect(jsonPath("$.content[0].project.title").value("Zweiter"));

			// Eine unbekannte ID ist kein Fehler, sie filtert alles heraus.
			mockMvc.perform(as(admin, get(AUDIT + "?admin=" + UUID.randomUUID())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(0));
		}

		@Test
		@DisplayName("Die drei Filter werden mit UND verknuepft")
		void filtersCombine() throws Exception {
			Instant now = Instant.parse("2026-08-05T12:00:00Z");
			audit(admin, first, Top10Action.ADDED, now, null, 1);
			audit(editor, second, Top10Action.REMOVED, now, 2, null);
			audit(admin, third, Top10Action.ADDED, now.minus(30, ChronoUnit.DAYS), null, 3);

			mockMvc.perform(as(admin, get(AUDIT
							+ "?from=" + now.minus(1, ChronoUnit.DAYS)
							+ "&to=" + now
							+ "&admin=" + admin.getId())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(1))
					.andExpect(jsonPath("$.content[0].project.title").value("Erster"));
		}

		@Test
		@DisplayName("from nach to ergibt 400 VALIDATION_FAILED und keine leere Seite")
		void invertedRange() throws Exception {
			mockMvc.perform(as(admin, get(AUDIT
							+ "?from=2026-08-09T00:00:00Z&to=2026-08-01T00:00:00Z")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ein unbrauchbarer Zeitpunkt und eine unbrauchbare UUID ergeben 400 "
				+ "im Envelope")
		void unparseableParameters() throws Exception {
			for (String query : List.of("?from=gestern", "?to=2026-08-01", "?admin=abc")) {
				mockMvc.perform(as(admin, get(AUDIT + query)))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
			}
		}

		@Test
		@DisplayName("Ein anderes Sortierfeld als timestamp ergibt 400 (§6.6)")
		void rejectsUnknownSortField() throws Exception {
			for (String field : List.of("action", "admin.passwordHash", "newPosition")) {
				mockMvc.perform(as(admin, get(AUDIT + "?sort=" + field + ",desc")))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
			}

			mockMvc.perform(as(admin, get(AUDIT + "?sort=timestamp,asc")))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("Beim Blaettern erscheint keine Zeile doppelt, obwohl alle denselben "
				+ "Zeitstempel tragen (§6.6, Gleichstandsbrecher id,asc)")
		void paginationIsStableAcrossEqualTimestamps() throws Exception {
			// Der Regelfall und kein Randfall: eine vollstaendige Umsortierung
			// schreibt alle ihre Zeilen mit demselben Zeitpunkt.
			for (int position = 1; position <= 6; position++) {
				entry(project(ProjectStatus.PUBLISHED, "Platz " + position), position);
			}
			List<Project> reordered = new ArrayList<>(entryRepository.findAllByOrderByPositionAsc()
					.stream()
					.sorted(Comparator.comparingInt(Top10Entry::getPosition).reversed())
					.map(Top10Entry::getProject)
					.toList());

			setOrder(admin, reordered.toArray(new Project[0])).andExpect(status().isOk());
			assertThat(auditRepository.findAll()).hasSize(6);

			List<String> firstPage = idsOf(AUDIT + "?page=0&size=4");
			List<String> secondPage = idsOf(AUDIT + "?page=1&size=4");

			assertThat(firstPage).hasSize(4);
			assertThat(secondPage).hasSize(2);
			assertThat(firstPage).doesNotContainAnyElementsOf(secondPage);
		}

		@Test
		@DisplayName("Das Protokoll hat keinen schreibenden Endpoint (§3.17)")
		void hasNoWriteEndpoint() throws Exception {
			audit(admin, first, Top10Action.ADDED, Instant.now(), null, 1);

			for (MockHttpServletRequestBuilder request :
					List.of(post(AUDIT), put(AUDIT), delete(AUDIT))) {

				mockMvc.perform(as(admin, request).contentType(MediaType.APPLICATION_JSON)
								.content("{}"))
						.andExpect(status().isMethodNotAllowed());
			}

			assertThat(auditRepository.findAll()).hasSize(1);
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

	/**
	 * Haengt eine:n zustaendige:n Redakteur:in an das Projekt. Notwendig fuer die
	 * Ruecknahme: {@code request-revision} steht nach §5 der Redaktion offen, und
	 * die Antwort zeigt anschliessend Felder, die nur Beteiligte sehen.
	 */
	private void assignEditor(Project project, User assigned) {
		project.getEditors().add(assigned);
		projectRepository.saveAndFlush(project);
	}

	private Top10Entry entry(Project project, int position) {
		return entryRepository.saveAndFlush(TestTop10.entry(project, position, Instant.now()));
	}

	private Top10AuditEntry audit(User actor, Project project, Top10Action action,
			Instant timestamp, Integer previousPosition, Integer newPosition) {

		return auditRepository.saveAndFlush(TestTop10.auditEntry(actor, project, action, timestamp,
				previousPosition, newPosition));
	}

	private static Top10AuditEntry byProject(List<Top10AuditEntry> entries, Project project) {
		return entries.stream()
				.filter(entry -> entry.getProject() != null
						&& entry.getProject().getId().equals(project.getId()))
				.findFirst()
				.orElseThrow(() -> new AssertionError(
						"Keine Protokollzeile zum Projekt " + project.getTitle()));
	}

	/** Die IDs der Protokollzeilen einer Seite, in der gelieferten Reihenfolge. */
	private List<String> idsOf(String path) throws Exception {
		String body = mockMvc.perform(as(admin, get(path)))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString();

		List<String> ids = new ArrayList<>();
		for (JsonNode row : objectMapper.readTree(body).get("content")) {
			ids.add(row.get("id").asText());
		}
		return ids;
	}

	private ResultActions setOrder(User user, Project... projects) throws Exception {
		List<UUID> ids = new ArrayList<>();
		for (Project project : projects) {
			ids.add(project.getId());
		}
		return mockMvc.perform(as(user, put(ORDER)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"projectIds\":["
						+ ids.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(","))
						+ "]}"));
	}

	/** Haengt ein echtes Bearer-Token an; ohne Aufruf bleibt die Anfrage anonym. */
	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
