package de.hsbremen.eportfolio.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.portfolio.PortfolioService;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
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
 * Die Sichtbarkeitsregel fuer {@code hsbEmail} aus §3.1, von beiden Seiten
 * geprueft (KAN-25).
 *
 * <p>§3.1 legt fest: die HSB-Adresse erscheint <strong>ausschliesslich</strong>
 * in der Admin-Nutzerverwaltung und nirgends sonst, auch nicht gegenueber
 * Admins. Sie ist ein internes Nachweismerkmal; der Admin braucht sie, um ein
 * Konto zu beurteilen, jede andere Ansicht nicht.
 *
 * <p><strong>Geprueft wird der gesamte Antworttext</strong> und nicht nur ein
 * benanntes Feld, wie schon im {@code PortfolioIntegrationTest}: eine Adresse
 * schadet auch dann, wenn sie an unerwarteter Stelle im JSON auftaucht, etwa
 * weil ein eingebettetes DTO sie mitbringt.
 *
 * <p>Das ist der Test, den §3.1 als Umsetzungspflicht verlangt. Er ist der
 * Grund, warum {@code AdminUserResponse} ein eigenes Record neben
 * {@code auth.dto.UserResponse} ist: mit einem gemeinsamen Record waere er
 * nicht gruen zu bekommen.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminUserHsbEmailVisibilityTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private PortfolioService portfolioService;

	private User admin;

	private User author;

	private Project published;

	@BeforeEach
	void buildData() {
		admin = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.ADMIN, "nicht-relevant"));
		author = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		portfolioService.createFor(author);

		published = projectRepository.saveAndFlush(
				TestProject.withoutId(author, ProjectStatus.PUBLISHED, "Sichtbare Arbeit"));
	}

	@Test
	@DisplayName("GET /api/admin/users gibt hsbEmail aus, als einziger Endpoint (§3.1)")
	void adminListContainsHsbEmail() throws Exception {
		mockMvc.perform(as(admin, get("/api/admin/users").param("q", author.getHsbEmail())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].hsbEmail").value(author.getHsbEmail()));
	}

	@Test
	@DisplayName("GET /api/admin/users/{id} ebenfalls, und ohne passwordHash")
	void adminDetailContainsHsbEmail() throws Exception {
		mockMvc.perform(as(admin, get("/api/admin/users/" + author.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hsbEmail").value(author.getHsbEmail()))
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	@DisplayName("GET /api/auth/me enthaelt die HSB-Adresse nicht, auch nicht beim Admin selbst")
	void ownProfileHidesHsbEmail() throws Exception {
		assertHidden(as(author, get("/api/auth/me")), author);
		assertHidden(as(admin, get("/api/auth/me")), admin);
	}

	@Test
	@DisplayName("Projektantworten enthalten die HSB-Adresse der Autor:in nicht, auch fuer Admins")
	void projectResponsesHideHsbEmail() throws Exception {
		assertHidden(as(admin, get("/api/projects/" + published.getId())), author);
		assertHidden(as(admin, get("/api/projects")), author);
	}

	@Test
	@DisplayName("Portfolio-Antworten enthalten die HSB-Adresse nicht (§3.2)")
	void portfolioResponsesHideHsbEmail() throws Exception {
		assertHidden(as(admin, get("/api/portfolios/" + author.getId())), author);
		assertHidden(as(author, get("/api/portfolio/me")), author);
	}

	// ==================================================================

	/**
	 * Die HSB-Adresse der Person kommt im gesamten Antworttext nicht vor, die
	 * private darf es.
	 */
	private void assertHidden(MockHttpServletRequestBuilder request, User person) throws Exception {
		String body = mockMvc.perform(request)
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);

		assertThat(body)
				.as("§3.1: hsbEmail verlaesst den Server nur in der Admin-Nutzerverwaltung")
				.doesNotContain(person.getHsbEmail());
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
