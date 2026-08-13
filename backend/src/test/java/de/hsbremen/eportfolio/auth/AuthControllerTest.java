package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ApiErrorWriter;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.config.CorsProperties;
import de.hsbremen.eportfolio.config.JwtProperties;
import de.hsbremen.eportfolio.config.LoginAttemptProperties;
import de.hsbremen.eportfolio.config.SecurityConfig;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Tests der Auth-Endpoints ueber die volle Filterkette: Token-Pruefung,
 * Fehlerformat (§6.2/§6.3) und die Felder, die eine Response nie enthalten darf.
 *
 * <p>Bewusst ein {@code @WebMvcTest} ohne Datenbank: geprueft wird die
 * HTTP-Schicht. Die fachliche Anmeldung deckt {@link AuthServiceTest} ab.
 */
@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, RestAuthenticationEntryPoint.class,
		RestAccessDeniedHandler.class, ApiErrorWriter.class, GlobalExceptionHandler.class,
		AuthService.class, AuthControllerTest.TestConfig.class})
class AuthControllerTest {

	private static final String SECRET = "a".repeat(88);

	private static final String PASSWORD = "geheim1234";

	@TestConfiguration
	static class TestConfig {

		@Bean
		JwtProperties jwtProperties() {
			return new JwtProperties(SECRET, Duration.ofHours(8), "eportfolio");
		}

		@Bean
		JwtService jwtService(JwtProperties properties) {
			return new JwtService(properties);
		}

		@Bean
		CorsProperties corsProperties() {
			return new CorsProperties(null);
		}

		@Bean
		LoginAttemptProperties loginAttemptProperties() {
			return new LoginAttemptProperties(5, Duration.ofMinutes(15));
		}

		@Bean
		LoginAttemptService loginAttemptService(LoginAttemptProperties properties) {
			return new LoginAttemptService(properties);
		}

		@Bean
		@Primary
		PasswordEncoder testPasswordEncoder() {
			return new BCryptPasswordEncoder();
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private LoginAttemptService loginAttemptService;

	@MockitoBean
	private UserRepository userRepository;

	/**
	 * Nur damit der Controller sich verdrahten laesst: die Registrierung kam mit
	 * KAN-26 in denselben Controller. Ihre Endpoints prueft
	 * {@code RegistrationIntegrationTest} gegen die echte Datenbank, weil an
	 * ihnen Konto, Portfolio und Codes zusammenhaengen und ein Mock davon nichts
	 * uebrig liesse, das noch etwas belegte.
	 */
	@MockitoBean
	private RegistrationService registrationService;

	/**
	 * Aus demselben Grund gemockt: die Passwort-Ruecksetzung kam mit KAN-43 in
	 * denselben Controller, und ihre Endpoints prueft
	 * {@code PasswordResetIntegrationTest} gegen die echte Datenbank.
	 */
	@MockitoBean
	private PasswordResetService passwordResetService;

	/**
	 * Ebenfalls gemockt, weil {@code AuthService} ihn seit KAN-60 braucht: der
	 * E-Mail-Wechselflow haengt an Konto, Codes und Mailversand und wird im
	 * {@code EmailChangeIntegrationTest} gegen die echte Datenbank geprueft.
	 */
	@MockitoBean
	private EmailChangeService emailChangeService;

	/**
	 * Der Zaehler ist ein Singleton im Testkontext. Ohne Ruecksetzen wuerden
	 * sich die Fehlversuche der einzelnen Testmethoden addieren und die
	 * Reihenfolge der Tests waere plotzlich relevant.
	 */
	@BeforeEach
	void resetCounters() {
		// MockMvc meldet immer dieselbe Absender-Adresse.
		for (String email : new String[] {"privat@example.org", "hsb@stud.hs-bremen.de",
				"unbekannt@example.org"}) {
			loginAttemptService.reset(email, "127.0.0.1");
		}
	}

	private User activeUser() {
		return TestUser.create(UUID.randomUUID(), "privat@example.org", "hsb@stud.hs-bremen.de",
				Role.STUDENT, UserStatus.ACTIVE, passwordEncoder.encode(PASSWORD));
	}

	private String tokenFor(User user) {
		return jwtService.createToken(AuthenticatedUser.from(user));
	}

	private String asJson(Object value) throws Exception {
		return objectMapper.writeValueAsString(value);
	}

	// --- /auth/me und Tokenpruefung ---------------------------------------

	@Test
	@DisplayName("Gueltiges Token: /auth/me liefert den Benutzer")
	void meWithValidToken() throws Exception {
		User user = activeUser();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tokenFor(user)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(user.getId().toString()))
				.andExpect(jsonPath("$.email").value("privat@example.org"))
				.andExpect(jsonPath("$.role").value("STUDENT"));
	}

	@Test
	@DisplayName("Fehlendes Token: 401 im Envelope aus §6.2")
	void meWithoutToken() throws Exception {
		mockMvc.perform(get("/api/auth/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"))
				.andExpect(jsonPath("$.timestamp").exists())
				.andExpect(jsonPath("$.message").exists())
				.andExpect(jsonPath("$.path").value("/api/auth/me"));
	}

	@Test
	@DisplayName("Manipuliertes Token: 401 mit TOKEN_INVALID")
	void meWithTamperedToken() throws Exception {
		User user = activeUser();
		String token = tokenFor(user);
		String[] parts = token.split("\\.");
		char replacement = parts[1].charAt(5) == 'A' ? 'B' : 'A';
		String tampered = parts[0] + "." + parts[1].substring(0, 5) + replacement + parts[1].substring(6)
				+ "." + parts[2];

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tampered))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("TOKEN_INVALID"))
				.andExpect(jsonPath("$.path").value("/api/auth/me"));
	}

	@Test
	@DisplayName("Abgelaufenes Token: 401 mit TOKEN_EXPIRED")
	void meWithExpiredToken() throws Exception {
		JwtService expired = new JwtService(
				new JwtProperties(SECRET, Duration.ofSeconds(-60), "eportfolio"));
		User user = activeUser();
		String token = expired.createToken(AuthenticatedUser.from(user));

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("TOKEN_EXPIRED"));
	}

	@Test
	@DisplayName("Konto zwischenzeitlich deaktiviert: gueltiges Token nuetzt nichts mehr")
	void tokenOfDeactivatedAccount() throws Exception {
		User user = activeUser();
		String token = tokenFor(user);

		// Der Admin deaktiviert das Konto, nachdem das Token ausgegeben wurde.
		User deactivated = TestUser.create(user.getId(), user.getEmail(), user.getHsbEmail(),
				Role.STUDENT, UserStatus.DEACTIVATED, user.getPasswordHash());
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(deactivated));

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("ACCOUNT_NOT_ACTIVE"));
	}

	// --- 403 ---------------------------------------------------------------

	@Test
	@DisplayName("Angemeldet, aber falsche Rolle: 403 im selben Envelope")
	void adminAreaWithWrongRole() throws Exception {
		User user = activeUser();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		// /api/admin/** ist in der SecurityConfig auf ROLE_ADMIN beschraenkt.
		mockMvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + tokenFor(user)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"))
				.andExpect(jsonPath("$.timestamp").exists())
				.andExpect(jsonPath("$.path").value("/api/admin/dashboard"));
	}

	// --- Login -------------------------------------------------------------

	@Test
	@DisplayName("Login mit privater E-Mail: 200 mit Token")
	void loginSucceeds() throws Exception {
		User user = activeUser();
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("privat@example.org", PASSWORD))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").isNotEmpty())
				.andExpect(jsonPath("$.passwordChangeRequired").value(false))
				.andExpect(jsonPath("$.user.email").value("privat@example.org"));
	}

	@Test
	@DisplayName("Login mit Initialpasswort: Response traegt passwordChangeRequired = true (§6.1)")
	void loginAnnouncesPasswordChange() throws Exception {
		User user = activeUser();
		user.setPasswordChangeRequired(true);
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));

		// Der Login selbst gelingt normal (§6.7); der Client erfaehrt die
		// anstehende Aenderung aus der Antwort statt aus dem ersten 403.
		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("privat@example.org", PASSWORD))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").isNotEmpty())
				.andExpect(jsonPath("$.passwordChangeRequired").value(true));
	}

	@Test
	@DisplayName("Login mit der HSB-Adresse: 401, weil die Adresse keine Login-Kennung ist (§3.1.1)")
	void loginWithHsbAddress() throws Exception {
		User user = activeUser();
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));
		when(userRepository.findByEmail("hsb@stud.hs-bremen.de")).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("hsb@stud.hs-bremen.de", PASSWORD))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"))
				.andExpect(jsonPath("$.status").value(401));
	}

	@Test
	@DisplayName("Login mit falschem Passwort: 401 im Envelope")
	void loginWithWrongPassword() throws Exception {
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(activeUser()));

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("privat@example.org", "falsch"))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));
	}

	@Test
	@DisplayName("Login eines deaktivierten Kontos: 401 mit ACCOUNT_NOT_ACTIVE")
	void loginDeactivated() throws Exception {
		User user = TestUser.create(UUID.randomUUID(), "privat@example.org", "hsb@stud.hs-bremen.de",
				Role.STUDENT, UserStatus.DEACTIVATED, passwordEncoder.encode(PASSWORD));
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("privat@example.org", PASSWORD))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("ACCOUNT_NOT_ACTIVE"));
	}

	@Test
	@DisplayName("Login ist ohne Token erreichbar (PUBLIC)")
	void loginReachableWithoutToken() throws Exception {
		when(userRepository.findByEmail(any())).thenReturn(Optional.empty());

		// Nicht 401 vom EntryPoint, sondern die fachliche Antwort des Controllers.
		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("unbekannt@example.org", PASSWORD))))
				.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));
	}

	@Test
	@DisplayName("Sechster Fehlversuch: 429 TOO_MANY_LOGIN_ATTEMPTS im §6.2-Envelope")
	void tooManyLoginAttempts() throws Exception {
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(activeUser()));

		for (int i = 0; i < 5; i++) {
			mockMvc.perform(post("/api/auth/login")
							.contentType("application/json")
							.content(asJson(new LoginRequest("privat@example.org", "falsch"))))
					.andExpect(status().isUnauthorized());
		}

		// Auch mit korrektem Passwort - die Sperre greift vor der Pruefung.
		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("privat@example.org", PASSWORD))))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.status").value(429))
				.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"))
				.andExpect(jsonPath("$.timestamp").exists())
				.andExpect(jsonPath("$.path").value("/api/auth/login"))
				// Die Meldung nennt keine Restzeit und kein Konto.
				.andExpect(jsonPath("$.message").value(
						org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Minute"))));
	}

	// --- Logout ------------------------------------------------------------

	@Test
	@DisplayName("Logout quittiert mit 204 - das Token bleibt technisch gueltig")
	void logout() throws Exception {
		User user = activeUser();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		String token = tokenFor(user);

		mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
				.andExpect(status().isNoContent());

		// Dokumentiert die Einschraenkung des stateless Ansatzes: derselbe
		// Token funktioniert nach dem Logout weiter. Abmeldung heisst, dass der
		// Client ihn verwirft.
		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk());
	}

	// --- Gate der erzwungenen Passwortaenderung (§6.7) ---------------------

	private User userWithInitialPassword() {
		User user = activeUser();
		user.setPasswordChangeRequired(true);
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		return user;
	}

	@Test
	@DisplayName("Gesetztes Flag: 403 PASSWORD_CHANGE_REQUIRED im §6.2-Envelope, auch auf PUBLIC-Pfaden")
	void gateBlocksEveryEndpoint() throws Exception {
		User user = userWithInitialPassword();

		// GET /api/projects ist PUBLIC; mit Token greift das Gate trotzdem,
		// sonst bliebe das Initialpasswort fuer alles Lesbare nutzbar.
		mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + tokenFor(user)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"))
				.andExpect(jsonPath("$.timestamp").exists())
				.andExpect(jsonPath("$.message").exists())
				.andExpect(jsonPath("$.path").value("/api/projects"));
	}

	@Test
	@DisplayName("Ausnahmen vom Gate: /auth/me und /auth/logout bleiben erreichbar (§6.7)")
	void gateExemptsMeAndLogout() throws Exception {
		User user = userWithInitialPassword();
		String token = tokenFor(user);

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("privat@example.org"));

		mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
				.andExpect(status().isNoContent());
	}

	@Test
	@DisplayName("Ohne Flag kein Gate: /api/projects mit Token nicht 403")
	void gateStaysQuietWithoutFlag() throws Exception {
		User user = activeUser();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		// 404, weil dieser Test-Slice keinen ProjectController kennt; belegt
		// ist damit, dass der Filter die Anfrage passieren laesst.
		mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + tokenFor(user)))
				.andExpect(status().isNotFound());
	}

	// --- PUT /auth/password ------------------------------------------------

	@Test
	@DisplayName("Passwort aendern: 200 ohne Body, neuer Hash, Flag zurueckgesetzt")
	void changePasswordSucceeds() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(put("/api/auth/password")
						.header("Authorization", "Bearer " + tokenFor(user))
						.contentType("application/json")
						.content(asJson(new PasswordChangeRequest(PASSWORD, "korrekt-pferd-batterie"))))
				.andExpect(status().isOk())
				.andExpect(content().string(""));

		assertThat(user.isPasswordChangeRequired())
				.as("Das Flag ist nach der Aenderung aufgeloest (§6.7)")
				.isFalse();
		assertThat(passwordEncoder.matches("korrekt-pferd-batterie", user.getPasswordHash()))
				.as("Der neue Hash gehoert zum neuen Passwort")
				.isTrue();
	}

	@Test
	@DisplayName("Falsches currentPassword: 401 LOGIN_FAILED, das Flag bleibt gesetzt")
	void changePasswordWithWrongCurrentPassword() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(put("/api/auth/password")
						.header("Authorization", "Bearer " + tokenFor(user))
						.contentType("application/json")
						.content(asJson(new PasswordChangeRequest("falsch", "korrekt-pferd-batterie"))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"))
				.andExpect(jsonPath("$.path").value("/api/auth/password"));

		assertThat(user.isPasswordChangeRequired()).isTrue();
		assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash()))
				.as("Der alte Hash bleibt unveraendert")
				.isTrue();
	}

	@Test
	@DisplayName("Neues Passwort zu kurz: 400 VALIDATION_FAILED, Regeln wie bei der Registrierung")
	void changePasswordTooShort() throws Exception {
		User user = userWithInitialPassword();

		mockMvc.perform(put("/api/auth/password")
						.header("Authorization", "Bearer " + tokenFor(user))
						.contentType("application/json")
						.content(asJson(new PasswordChangeRequest(PASSWORD, "kurz"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

		assertThat(user.isPasswordChangeRequired()).isTrue();
	}

	@Test
	@DisplayName("PUT /auth/password ohne Token: 401 NOT_AUTHENTICATED")
	void changePasswordWithoutToken() throws Exception {
		mockMvc.perform(put("/api/auth/password")
						.contentType("application/json")
						.content(asJson(new PasswordChangeRequest(PASSWORD, "korrekt-pferd-batterie"))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
	}

	// --- Keine Geheimnisse in Responses ------------------------------------

	@Test
	@DisplayName("Keine Auth-Response enthaelt passwordHash oder hsbEmail (§3.1)")
	void noPasswordHashAndNoHsbEmailInResponses() throws Exception {
		User user = activeUser();
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		MvcResult login = mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(asJson(new LoginRequest("privat@example.org", PASSWORD))))
				.andExpect(status().isOk())
				.andReturn();

		MvcResult me = mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Bearer " + tokenFor(user)))
				.andExpect(status().isOk())
				.andReturn();

		for (MvcResult result : new MvcResult[] {login, me}) {
			String body = result.getResponse().getContentAsString();

			assertThat(body)
					.as("Feldname passwordHash darf nicht vorkommen")
					.doesNotContain("passwordHash");
			assertThat(body)
					.as("Der BCrypt-Hash selbst darf nicht vorkommen")
					.doesNotContain(user.getPasswordHash());
			assertThat(body)
					.as("Feldname hsbEmail darf nicht vorkommen")
					.doesNotContain("hsbEmail");
			assertThat(body)
					.as("Die HSB-Adresse selbst darf nicht vorkommen")
					.doesNotContain(user.getHsbEmail());
		}
	}
}
