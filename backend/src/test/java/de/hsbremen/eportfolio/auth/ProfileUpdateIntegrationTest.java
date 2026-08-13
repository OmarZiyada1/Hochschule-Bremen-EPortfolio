package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.dto.ProfileUpdateRequest;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
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
 * {@code PUT /api/auth/me} aus API-Contract §6.1 gegen die echte Datenbank
 * (KAN-44), einschliesslich der Zusage aus der Definition of Done: der
 * Endpoint aendert weder Rolle noch Status noch die Hochschuladresse, auch
 * wenn der Body sie mitschickt. Das Feld {@code email} ist seit KAN-60 kein
 * ignoriertes Feld mehr, sondern stoesst den Wechselflow an; seine Faelle
 * prueft {@link EmailChangeIntegrationTest}.
 *
 * <p>Der Test laeuft ueber die volle Filterkette mit echten Tokens, weil das
 * Gate der erzwungenen Passwortaenderung (§6.7) im
 * {@link JwtAuthenticationFilter} sitzt und nach Methode unterscheidet:
 * {@code GET /auth/me} ist ausgenommen, {@code PUT /auth/me} nicht.
 * {@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProfileUpdateIntegrationTest {

	private static final String ME_PATH = "/api/auth/me";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	private User activeStudent() {
		return userRepository.save(TestUser.activeWithoutId(Role.STUDENT, "egal-hier-kein-login"));
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	@Test
	@DisplayName("Happy Path: 200, Antwort wie GET /auth/me, Namen in der Datenbank geaendert")
	void updatesOwnName() throws Exception {
		User user = activeStudent();

		mockMvc.perform(as(user, put(ME_PATH))
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(
								new ProfileUpdateRequest("Erika", "Musterfrau"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(user.getId().toString()))
				.andExpect(jsonPath("$.firstName").value("Erika"))
				.andExpect(jsonPath("$.lastName").value("Musterfrau"))
				.andExpect(jsonPath("$.email").value(user.getEmail()))
				// Die beiden Verbote aus §3.1, wie bei GET /auth/me.
				.andExpect(jsonPath("$.passwordHash").doesNotExist())
				.andExpect(jsonPath("$.hsbEmail").doesNotExist());

		User reloaded = userRepository.findById(user.getId()).orElseThrow();
		assertThat(reloaded.getFirstName()).isEqualTo("Erika");
		assertThat(reloaded.getLastName()).isEqualTo("Musterfrau");
	}

	@Test
	@DisplayName("Extra-Felder im Body aendern weder Rolle noch Status noch die HSB-Adresse (DoD)")
	void ignoresFieldsBeyondTheName() throws Exception {
		User user = activeStudent();
		String emailBefore = user.getEmail();
		String hsbEmailBefore = user.getHsbEmail();

		// Bewusst rohes JSON statt des Records: das Record kennt diese Felder
		// gar nicht, und genau dieser Angriffsversuch soll wirkungslos bleiben.
		// email steht nicht mehr in dieser Liste: seit KAN-60 ist es ein aktives
		// Feld mit eigenem Flow samt Passwortpflicht, siehe
		// EmailChangeIntegrationTest.
		String body = """
				{
					"firstName": "Neuer",
					"lastName": "Name",
					"hsbEmail": "angreifer@hs-bremen.de",
					"role": "ADMIN",
					"status": "DEACTIVATED",
					"passwordChangeRequired": true,
					"passwordHash": "unterjubeln"
				}
				""";

		mockMvc.perform(as(user, put(ME_PATH))
						.contentType("application/json")
						.content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.role").value("STUDENT"))
				.andExpect(jsonPath("$.status").value("ACTIVE"));

		User reloaded = userRepository.findById(user.getId()).orElseThrow();
		assertThat(reloaded.getFirstName()).isEqualTo("Neuer");
		assertThat(reloaded.getLastName()).isEqualTo("Name");
		assertThat(reloaded.getRole()).isEqualTo(Role.STUDENT);
		assertThat(reloaded.getStatus()).isEqualTo(UserStatus.ACTIVE);
		assertThat(reloaded.getEmail()).isEqualTo(emailBefore);
		assertThat(reloaded.getHsbEmail()).isEqualTo(hsbEmailBefore);
		assertThat(reloaded.getPendingEmail()).isNull();
		assertThat(reloaded.isPasswordChangeRequired()).isFalse();
	}

	@Test
	@DisplayName("Ohne Token: 401 NOT_AUTHENTICATED im Envelope")
	void requiresAuthentication() throws Exception {
		mockMvc.perform(put(ME_PATH)
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(
								new ProfileUpdateRequest("Erika", "Musterfrau"))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"))
				.andExpect(jsonPath("$.path").value(ME_PATH));
	}

	@Test
	@DisplayName("Leerer Vorname: 400 VALIDATION_FAILED, Datenbank unveraendert")
	void rejectsBlankFirstName() throws Exception {
		User user = activeStudent();
		String firstNameBefore = user.getFirstName();

		mockMvc.perform(as(user, put(ME_PATH))
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(
								new ProfileUpdateRequest("  ", "Musterfrau"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

		User reloaded = userRepository.findById(user.getId()).orElseThrow();
		assertThat(reloaded.getFirstName()).isEqualTo(firstNameBefore);
	}

	@Test
	@DisplayName("Gesetztes Initialpasswort-Flag: PUT /auth/me bleibt hinter dem Gate (§6.7)")
	void passwordChangeGateBlocksTheUpdate() throws Exception {
		User user = TestUser.activeWithoutId(Role.STUDENT, "egal-hier-kein-login");
		user.setPasswordChangeRequired(true);
		user = userRepository.save(user);

		// Die Ausnahmeliste in §6.7 nennt GET /auth/me, nicht PUT: wer sein
		// Initialpasswort noch nicht geaendert hat, pflegt auch kein Profil.
		mockMvc.perform(as(user, put(ME_PATH))
						.contentType("application/json")
						.content(objectMapper.writeValueAsString(
								new ProfileUpdateRequest("Erika", "Musterfrau"))))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"));
	}
}
