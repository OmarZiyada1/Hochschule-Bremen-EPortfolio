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
