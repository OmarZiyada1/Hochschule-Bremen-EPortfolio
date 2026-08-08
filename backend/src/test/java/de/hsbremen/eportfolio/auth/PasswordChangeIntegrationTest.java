package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.dto.LoginRequest;
import de.hsbremen.eportfolio.auth.dto.PasswordChangeRequest;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die erzwungene Passwortaenderung aus API-Contract §6.7 gegen die echte
 * Datenbank (KAN-28), also genau die drei Zusagen aus der Definition of Done
 * des Tickets:
 * <ol>
 *   <li>Ein Konto mit gesetztem Flag erreicht keinen normalen Endpoint mehr
 *       (403 {@code PASSWORD_CHANGE_REQUIRED}), wohl aber die Ausnahmen aus
 *       §6.7.</li>
 *   <li>Nach erfolgreichem {@code PUT /auth/password} ist die API wieder
 *       vollstaendig erreichbar.</li>
 *   <li>Ein falsches {@code currentPassword} ergibt 401 und laesst Flag und
 *       Hash unangetastet.</li>
 * </ol>
 *
 * <p>Der Test laeuft ueber die volle Filterkette mit echten Tokens: das Gate
 * sitzt im {@link JwtAuthenticationFilter}, ein Test am Controller vorbei
 * wuerde es gar nicht durchlaufen. {@code @Transactional} rollt am Ende alles
 * zurueck, die Entwicklungsdatenbank bleibt unveraendert.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PasswordChangeIntegrationTest {

	private static final String PASSWORD_PATH = "/api/auth/password";

	/** Das administrativ gesetzte Initialpasswort, das der Admin kennt (§6.7). */
	private static final String INITIAL_PASSWORD = "initial-vom-admin";

	private static final String NEW_PASSWORD = "korrekt-pferd-batterie";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/** Konto, wie es die Kontoanlage durch die Administration hinterlaesst (KAN-25). */
	private User userWithInitialPassword() {
		User user = TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(INITIAL_PASSWORD));
		user.setPasswordChangeRequired(true);
		return userRepository.save(user);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	private String asJson(Object value) throws Exception {
		return objectMapper.writeValueAsString(value);
	}

	@Test
	@DisplayName("Gesetztes Flag: 403 auf /api/projects, aber 200 auf /auth/me (§6.7)")
	void gateBlocksProjectsButExemptsMe() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(as(user, get("/api/projects")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"))
				.andExpect(jsonPath("$.path").value("/api/projects"));

		mockMvc.perform(as(user, get("/api/auth/me")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(user.getId().toString()));
	}

	@Test
	@DisplayName("Nach erfolgreichem PUT /auth/password ist die API wieder erreichbar")
	void successfulChangeLiftsTheGate() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(as(user, put(PASSWORD_PATH))
						.contentType("application/json")
						.content(asJson(new PasswordChangeRequest(INITIAL_PASSWORD, NEW_PASSWORD))))
				.andExpect(status().isOk())
				// Entschieden in der Klaerungsrunde zu KAN-28: 200 ohne Body.
				.andExpect(content().string(""));

		mockMvc.perform(as(user, get("/api/projects")))
				.andExpect(status().isOk());

		User reloaded = userRepository.findById(user.getId()).orElseThrow();
		assertThat(reloaded.isPasswordChangeRequired()).isFalse();
		assertThat(passwordEncoder.matches(NEW_PASSWORD, reloaded.getPasswordHash()))
				.as("Der gespeicherte Hash gehoert zum neuen Passwort")
				.isTrue();
		assertThat(passwordEncoder.matches(INITIAL_PASSWORD, reloaded.getPasswordHash()))
				.as("Das Initialpasswort ist entwertet")
				.isFalse();
	}

	@Test
	@DisplayName("Falsches currentPassword: 401, Flag und Hash bleiben stehen")
	void wrongCurrentPasswordKeepsTheGate() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(as(user, put(PASSWORD_PATH))
						.contentType("application/json")
						.content(asJson(new PasswordChangeRequest("falsch-geraten-123", NEW_PASSWORD))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));

		User reloaded = userRepository.findById(user.getId()).orElseThrow();
		assertThat(reloaded.isPasswordChangeRequired()).isTrue();
		assertThat(passwordEncoder.matches(INITIAL_PASSWORD, reloaded.getPasswordHash()))
				.as("Der alte Hash bleibt unveraendert")
				.isTrue();

		// Das Gate steht weiterhin.
		mockMvc.perform(as(user, get("/api/projects")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"));
	}

	@Test
	@DisplayName("Login mit Initialpasswort gelingt und traegt das Flag in der Response (§6.1)")
	void loginCarriesTheFlag() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest(user.getEmail(), INITIAL_PASSWORD))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").isNotEmpty())
				.andExpect(jsonPath("$.passwordChangeRequired").value(true));
	}
}
