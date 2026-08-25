package de.hsbremen.eportfolio.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.NominationTier;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.masterdata.Faculty;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.masterdata.TestMasterData;
import de.hsbremen.eportfolio.project.Block;
import de.hsbremen.eportfolio.project.BlockRepository;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.top10.TestTop10;
import de.hsbremen.eportfolio.top10.Top10NominationRepository;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code GET /api/admin/dashboard} aus §6.1 gegen die echte Datenbank (KAN-25).
 *
 * <p><strong>Geprueft wird die Differenz, nicht der absolute Wert.</strong> Die
 * Kennzahlen zaehlen den gesamten Bestand, und in der Entwicklungsdatenbank
 * stehen bereits Seed-Daten und Reste frueherer Laeufe. Der Test liest deshalb
 * zuerst den Ausgangsstand, legt dann eine bekannte Menge an und vergleicht die
 * Zuwaechse. Absolute Erwartungen waeren an genau einem Rechner gruen.
 *
 * <p>Zweiter Schwerpunkt ist die Vollstaendigkeit der Karten: jede
 * Aufschluesselung muss <em>alle</em> Werte ihres Enums tragen, auch die mit 0.
 * Eine {@code group by}-Abfrage liefert das nicht von selbst, und ohne das
 * Auffuellen muesste das Frontend die Enums aus §2 ein zweites Mal kennen.
 *
 * <p>Fuer {@code projectsByFaculty} (Contract v76, KAN-38) gilt dasselbe, nur
 * gegen den Fakultaetsbestand der Datenbank statt gegen ein Enum. Dazu kommt
 * eine Zusage, die keine der Enum-Karten kennt: Projekte ohne Fakultaet gehen
 * nicht ein, weil {@code Project.facultyId} bis zum Einreichen null ist (§3.3).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminDashboardIntegrationTest {

	private static final String DASHBOARD = "/api/admin/dashboard";

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
	private BlockRepository blockRepository;

	@Autowired
	private Top10NominationRepository nominationRepository;

	@Autowired
	private FacultyRepository facultyRepository;

	private User admin;

	private User student;

	@BeforeEach
	void buildData() {
		admin = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.ADMIN, "nicht-relevant"));
		student = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
	}

	@Test
	@DisplayName("Jede Aufschluesselung traegt alle Werte ihres Enums, auch die mit 0")
	void everyEnumValueIsPresent() throws Exception {
		JsonNode dashboard = read();

		assertKeys(dashboard, "projectsByStatus", ProjectStatus.values());
		assertKeys(dashboard, "usersByRole", Role.values());
		assertKeys(dashboard, "usersByStatus", UserStatus.values());
		assertKeys(dashboard, "blocksByType", BlockType.values());
	}

	@Test
	@DisplayName("projectsByStatus zaehlt jeden Status, auch Entwuerfe (§5: ADMIN sieht alles)")
	void countsProjectsByStatus() throws Exception {
		JsonNode before = read();

		project(ProjectStatus.DRAFT);
		project(ProjectStatus.DRAFT);
		project(ProjectStatus.PUBLISHED);

		JsonNode after = read();

		assertThat(delta(before, after, "projectsByStatus", "DRAFT")).isEqualTo(2);
		assertThat(delta(before, after, "projectsByStatus", "PUBLISHED")).isEqualTo(1);
		assertThat(delta(before, after, "projectsByStatus", "SUBMITTED")).isZero();
	}

	@Test
	@DisplayName("usersTotal, usersByRole und usersByStatus zaehlen auch deaktivierte Konten")
	void countsUsers() throws Exception {
		JsonNode before = read();

		userRepository.saveAndFlush(
				TestUser.withoutId(Role.EDITOR, UserStatus.DEACTIVATED, "nicht-relevant"));

		JsonNode after = read();

		assertThat(after.get("usersTotal").asLong() - before.get("usersTotal").asLong())
				.isEqualTo(1);
		assertThat(delta(before, after, "usersByRole", "EDITOR")).isEqualTo(1);
		assertThat(delta(before, after, "usersByStatus", "DEACTIVATED")).isEqualTo(1);
	}

	@Test
	@DisplayName("blocksByType zaehlt je Blocktyp; moeglich, weil Block.type eine Spalte ist (§2.5)")
	void countsBlocksByType() throws Exception {
		JsonNode before = read();

		Project project = project(ProjectStatus.DRAFT);
		block(project, BlockType.TEXT, 0);
		block(project, BlockType.TEXT, 1);
		block(project, BlockType.HEADING, 2);

		JsonNode after = read();

		assertThat(delta(before, after, "blocksByType", "TEXT")).isEqualTo(2);
		assertThat(delta(before, after, "blocksByType", "HEADING")).isEqualTo(1);
	}

	@Test
	@DisplayName("openNominations zaehlt nur PENDING, nicht die entschiedenen (§2.8)")
	void countsOnlyPendingNominations() throws Exception {
		JsonNode before = read();

		Project first = project(ProjectStatus.PUBLISHED);
		Project second = project(ProjectStatus.PUBLISHED);
		nominationRepository.saveAndFlush(TestTop10.pending(first, student, NominationTier.TOP_10));
		nominationRepository.saveAndFlush(
				TestTop10.decided(second, student, admin, NominationStatus.ACCEPTED));

		JsonNode after = read();

		assertThat(after.get("openNominations").asLong() - before.get("openNominations").asLong())
				.isEqualTo(1);
	}

	@Test
	@DisplayName("Ohne Token 401, mit fremdem Token 403 (§5, Zeile Admin-Dashboard)")
	void requiresAdmin() throws Exception {
		mockMvc.perform(get(DASHBOARD))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(as(student, get(DASHBOARD)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
	}

	@Test
	@DisplayName("projectsByFaculty fuehrt jede Fakultaet, sortiert nach Kuerzel")
	void listsEveryFaculty() throws Exception {
		JsonNode faculties = read().get("projectsByFaculty");

		List<String> actual = new ArrayList<>();
		faculties.forEach(entry -> actual.add(entry.get("faculty").get("abbreviation").asText()));

		/*
		 * Zwei getrennte Zusicherungen, und das mit Absicht. Die Vollstaendigkeit
		 * darf gegen das Repository pruefen, denn "alle Zeilen der Tabelle" hat
		 * keine zweite Quelle. Die Reihenfolge dagegen nicht: sie kaeme aus
		 * derselben Methode, die der Dienst benutzt, und ein Umbenennen auf
		 * findAllByOrderByNameAsc zoege Soll und Ist gemeinsam mit. Sie wird
		 * deshalb unabhaengig zugesichert.
		 */
		List<String> everyFaculty = facultyRepository.findAll().stream()
				.map(Faculty::getAbbreviation)
				.sorted()
				.toList();
		assertThat(everyFaculty).as("Die Testdatenbank fuehrt Fakultaeten").isNotEmpty();
		assertThat(actual)
				.as("jede Fakultaet steht genau einmal in der Liste")
				.containsExactlyInAnyOrderElementsOf(everyFaculty);
		assertThat(actual).as("aufsteigend nach Kuerzel").isSorted();

		faculties.forEach(entry -> {
			assertThat(entry.get("faculty").get("name").asText()).isNotBlank();
			assertThat(entry.get("faculty").get("id").asText()).isNotBlank();
		});
	}

	@Test
	@DisplayName("Eine Fakultaet ohne Projekte steht mit 0 in der Liste, nicht als Luecke")
	void fillsFacultiesWithoutProjects() throws Exception {
		/*
		 * Eine eigene Fakultaet mit unverwechselbarem Kuerzel: der Seeder fuehrt
		 * FK1 bis FK5, und faculty.abbreviation ist unique. Ohne diesen Fall
		 * waere das Auffuellen nur zufaellig gedeckt, naemlich dann, wenn im
		 * Bestand gerade eine Fakultaet ohne Projekt steht.
		 *
		 * <p>Das Kuerzel kommt ohne Sonderzeichen aus: die Datenbank sortiert
		 * nach ihrer Collation, {@code isSorted()} im Test daneben nach der
		 * Java-Ordnung, und bei einem Bindestrich laufen die beiden
		 * auseinander. Heute traegt das nicht, weil jeder Test seine eigene
		 * Transaktion zurueckrollt; es soll auch dann nicht brechen, wenn das
		 * einmal nicht mehr gilt.
		 */
		Faculty empty = facultyRepository.saveAndFlush(
				TestMasterData.facultyWithoutId("FKTEST9", "Fakultaet ohne Projekte"));

		assertThat(facultyCount(read(), empty.getId()))
				.as("aufgefuellt mit 0 statt zu fehlen")
				.isZero();
	}

	@Test
	@DisplayName("projectsByFaculty zaehlt je Fakultaet, ueber alle Status hinweg")
	void countsProjectsByFaculty() throws Exception {
		Faculty faculty = facultyRepository.findAllByOrderByAbbreviationAsc().getFirst();
		JsonNode before = read();

		projectAt(faculty, ProjectStatus.DRAFT);
		projectAt(faculty, ProjectStatus.PUBLISHED);

		JsonNode after = read();

		assertThat(facultyCount(after, faculty.getId()) - facultyCount(before, faculty.getId()))
				.isEqualTo(2);
	}

	@Test
	@DisplayName("Ein Projekt ohne Fakultaet geht nicht ein (§3.3: facultyId ist bis zum Einreichen null)")
	void ignoresProjectsWithoutFaculty() throws Exception {
		JsonNode before = read();

		project(ProjectStatus.DRAFT);

		JsonNode after = read();

		assertThat(facultySum(after) - facultySum(before))
				.as("die Summe der Liste waechst nicht, obwohl ein Projekt dazukam")
				.isZero();
		assertThat(delta(before, after, "projectsByStatus", "DRAFT"))
				.as("in projectsByStatus steht es dagegen sehr wohl")
				.isEqualTo(1);
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private JsonNode read() throws Exception {
		String body = mockMvc.perform(as(admin, get(DASHBOARD)))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);

		return objectMapper.readTree(body);
	}

	private static void assertKeys(JsonNode dashboard, String field, Enum<?>[] values) {
		JsonNode card = dashboard.get(field);
		for (Enum<?> value : values) {
			assertThat(card.has(value.name()))
					.as("%s enthaelt den Schluessel %s", field, value.name())
					.isTrue();
		}
		assertThat(card.size())
				.as("%s enthaelt keine Schluessel ausser den Enum-Werten", field)
				.isEqualTo(values.length);
	}

	private static long delta(JsonNode before, JsonNode after, String field, String key) {
		return after.get(field).get(key).asLong() - before.get(field).get(key).asLong();
	}

	private Project project(ProjectStatus status) {
		Project project = TestProject.withoutId(student, status, "Kennzahlenprojekt");
		return projectRepository.saveAndFlush(project);
	}

	/** Dasselbe, aber an einer Fakultaet: fuer projectsByFaculty (§6.1, v76). */
	private Project projectAt(Faculty faculty, ProjectStatus status) {
		Project project = TestProject.withoutId(student, status, "Kennzahlenprojekt");
		project.setFaculty(faculty);
		return projectRepository.saveAndFlush(project);
	}

	/** Die Zahl einer bestimmten Fakultaet aus projectsByFaculty. */
	private static long facultyCount(JsonNode dashboard, UUID facultyId) {
		for (JsonNode entry : dashboard.get("projectsByFaculty")) {
			if (entry.get("faculty").get("id").asText().equals(facultyId.toString())) {
				return entry.get("count").asLong();
			}
		}
		throw new AssertionError("Fakultaet " + facultyId + " fehlt in projectsByFaculty");
	}

	/** Summe ueber alle Zeilen; sie zaehlt nur Projekte mit Fakultaet. */
	private static long facultySum(JsonNode dashboard) {
		long sum = 0;
		for (JsonNode entry : dashboard.get("projectsByFaculty")) {
			sum += entry.get("count").asLong();
		}
		return sum;
	}

	private void block(Project project, BlockType type, int orderIndex) throws Exception {
		Block block = TestProject.blockWithoutId(project, type, orderIndex,
				objectMapper.readTree("{\"type\":\"paragraph\"}"));
		blockRepository.saveAndFlush(block);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
