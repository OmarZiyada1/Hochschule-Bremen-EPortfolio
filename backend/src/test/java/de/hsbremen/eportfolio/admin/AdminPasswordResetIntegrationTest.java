package de.hsbremen.eportfolio.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.auth.PasswordPolicy;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die Admin-Ruecksetzung {@code POST /api/admin/users/{id}/reset-password} aus
 * API-Contract §6.1 gegen die echte Datenbank (KAN-43).
 *
 * <p>Schwerpunkte sind die Zusagen des Contracts und die Entscheidungen aus der
 * Klaerungsrunde: das Initialpasswort erzeugt der Server, es erscheint genau
 * einmal in der Antwort, {@code passwordChangeRequired} steht danach (§6.7),
 * und der Endpoint funktioniert fuer jedes Konto einschliesslich des eigenen,
 * weil sich der Schritt anders als eine Rollen- oder Statusaenderung selbst
 * aufloesen laesst.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck. Die Anmeldung laeuft
 * ueber echte Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe
 * Filterkette durchlaeuft wie in Produktion.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminPasswordResetIntegrationTest {

	private static final String OLD_PASSWORD = "bisheriges-passwort-123";

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

	private User admin;

	private User student;

	@BeforeEach
	void buildData() {
		admin = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.ADMIN, passwordEncoder.encode(OLD_PASSWORD)));
		student = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(OLD_PASSWORD)));
	}

	@Test
	@DisplayName("Setzt ein neues Initialpasswort: Antwort einmalig, Flag gesetzt, altes Passwort weg")
	void resetsThePasswordAndSetsTheFlag() throws Exception {
		String initialPassword = resetAs(admin, student.getId());

		// Die Regel aus §3.1.1 gilt auch fuer das erzeugte Passwort.
		assertThat(initialPassword.length())
				.isBetween(PasswordPolicy.MIN_LENGTH, PasswordPolicy.MAX_LENGTH);

		User reloaded = userRepository.findById(student.getId()).orElseThrow();
		assertThat(reloaded.isPasswordChangeRequired()).isTrue();
		assertThat(passwordEncoder.matches(initialPassword, reloaded.getPasswordHash())).isTrue();
		assertThat(passwordEncoder.matches(OLD_PASSWORD, reloaded.getPasswordHash())).isFalse();

		// Anmeldung gelingt und traegt das Flag (§6.7); danach steht das Gate.
		login(student.getEmail(), initialPassword)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.passwordChangeRequired").value(true));
		login(student.getEmail(), OLD_PASSWORD).andExpect(status().isUnauthorized());

		mockMvc.perform(as(student, get("/api/projects")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"));
	}

	@Test
	@DisplayName("Jeder Aufruf erzeugt ein anderes Passwort")
	void everyCallYieldsADifferentPassword() throws Exception {
		String first = resetAs(admin, student.getId());
		String second = resetAs(admin, student.getId());

		assertThat(first).isNotEqualTo(second);
		// Es gilt nur das zuletzt gesetzte.
		User reloaded = userRepository.findById(student.getId()).orElseThrow();
		assertThat(passwordEncoder.matches(second, reloaded.getPasswordHash())).isTrue();
		assertThat(passwordEncoder.matches(first, reloaded.getPasswordHash())).isFalse();
	}

	@Test
	@DisplayName("Das eigene Konto ist erlaubt: der Schritt laesst sich selbst aufloesen")
	void ownAccountIsAllowed() throws Exception {
		// Anders als bei Rolle und Status (KAN-25) gibt es kein Aussperr-Risiko:
		// das initialPassword steht in der Antwort, und PUT /auth/password bleibt
		// als Gate-Ausnahme erreichbar (§6.7). Klaerungsrunde KAN-43.
		String initialPassword = resetAs(admin, admin.getId());

		User reloaded = userRepository.findById(admin.getId()).orElseThrow();
		assertThat(reloaded.isPasswordChangeRequired()).isTrue();
		assertThat(passwordEncoder.matches(initialPassword, reloaded.getPasswordHash())).isTrue();
	}

	@Test
	@DisplayName("Ein deaktiviertes Konto bekommt ein Passwort, anmelden kann es sich trotzdem nicht")
	void deactivatedAccountStaysLockedOut() throws Exception {
		student.setStatus(UserStatus.DEACTIVATED);
		userRepository.saveAndFlush(student);

		// Keine Statuspruefung (Klaerungsrunde KAN-43): ob sich das Konto
		// anmelden kann, entscheidet §2.9 ohnehin beim Login. Der Ablauf "erst
		// Passwort neu, dann reaktivieren" bleibt so in beliebiger Reihenfolge
		// moeglich.
		String initialPassword = resetAs(admin, student.getId());

		login(student.getEmail(), initialPassword)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("ACCOUNT_NOT_ACTIVE"));
	}

	@Test
	@DisplayName("Ein Konto mit bereits gesetztem Flag laesst sich erneut zuruecksetzen")
	void alreadyFlaggedAccountCanBeResetAgain() throws Exception {
		student.setPasswordChangeRequired(true);
		userRepository.saveAndFlush(student);

		// Der Fall aus dem Ticket: die Person hat auch das Initialpasswort
		// vergessen. Das Flag am Zielkonto spielt fuer den Admin-Aufruf keine
		// Rolle; das Gate aus §6.7 haengt am Token der aufrufenden Person.
		String initialPassword = resetAs(admin, student.getId());

		login(student.getEmail(), initialPassword)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.passwordChangeRequired").value(true));
	}

	@Test
	@DisplayName("Ein Admin mit eigenem Initialpasswort haengt selbst im Gate (§6.7)")
	void flaggedAdminIsGatedLikeEveryoneElse() throws Exception {
		admin.setPasswordChangeRequired(true);
		userRepository.saveAndFlush(admin);

		// §6.7 nennt genau fuenf Ausnahmen, und dieser Endpoint gehoert bewusst
		// nicht dazu: ihn ruft der Admin fuer fremde Konten auf, nicht das
		// gesperrte Konto fuer sich selbst. Erst das eigene Passwort aendern,
		// dann verwalten.
		mockMvc.perform(as(admin, post("/api/admin/users/" + student.getId() + "/reset-password")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"));
	}

	@Test
	@DisplayName("Unbekannte ID ergibt 404 RESOURCE_NOT_FOUND")
	void unknownIdIsNotFound() throws Exception {
		mockMvc.perform(as(admin, post("/api/admin/users/" + UUID.randomUUID() + "/reset-password")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	@DisplayName("Ohne Token 401, als Nicht-Admin 403")
	void requiresTheAdminRole() throws Exception {
		mockMvc.perform(post("/api/admin/users/" + student.getId() + "/reset-password"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

		mockMvc.perform(as(student, post("/api/admin/users/" + admin.getId() + "/reset-password")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

		// In beiden Faellen bleibt der Hash unangetastet.
		assertThat(passwordEncoder.matches(OLD_PASSWORD,
				userRepository.findById(admin.getId()).orElseThrow().getPasswordHash())).isTrue();
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	/** Fuehrt die Ruecksetzung aus und liefert das Initialpasswort der Antwort. */
	private String resetAs(User caller, UUID targetId) throws Exception {
		MvcResult result = mockMvc
				.perform(as(caller, post("/api/admin/users/" + targetId + "/reset-password")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.initialPassword").isNotEmpty())
				.andReturn();

		return objectMapper.readTree(result.getResponse().getContentAsString())
				.get("initialPassword").asText();
	}

	private ResultActions login(String email, String password) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", email);
		body.put("password", password);
		return mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
