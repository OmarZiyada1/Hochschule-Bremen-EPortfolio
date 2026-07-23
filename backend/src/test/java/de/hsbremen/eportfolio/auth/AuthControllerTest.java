package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.dto.LoginAnfrage;
import de.hsbremen.eportfolio.benutzer.TestUser;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ApiFehlerSchreiber;
import de.hsbremen.eportfolio.common.error.GlobalExceptionHandler;
import de.hsbremen.eportfolio.config.CorsEigenschaften;
import de.hsbremen.eportfolio.config.SecurityConfig;
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
 * <p>Bewusst ein {@code @WebMvcTest} ohne Datenbank — geprueft wird die
 * HTTP-Schicht. Die fachliche Anmeldung deckt {@link AuthServiceTest} ab.
 */
@ExtendWith(SpringExtension.class)
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthentifizierungsFilter.class, RestAuthentifizierungsEinstieg.class,
		RestZugriffVerweigertHandler.class, ApiFehlerSchreiber.class, GlobalExceptionHandler.class,
		AuthService.class, AuthControllerTest.Testkonfiguration.class})
class AuthControllerTest {

	private static final String SECRET = "a".repeat(88);

	private static final String PASSWORT = "geheim1234";

	@TestConfiguration
	static class Testkonfiguration {

		@Bean
		JwtEigenschaften jwtEigenschaften() {
			return new JwtEigenschaften(SECRET, Duration.ofHours(8), "eportfolio");
		}

		@Bean
		JwtService jwtService(JwtEigenschaften eigenschaften) {
			return new JwtService(eigenschaften);
		}

		@Bean
		CorsEigenschaften corsEigenschaften() {
			return new CorsEigenschaften(null);
		}

		@Bean
		AnmeldeversuchEigenschaften anmeldeversuchEigenschaften() {
			return new AnmeldeversuchEigenschaften(5, Duration.ofMinutes(15));
		}

		@Bean
		AnmeldeversuchService anmeldeversuchService(AnmeldeversuchEigenschaften eigenschaften) {
			return new AnmeldeversuchService(eigenschaften);
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
	private AnmeldeversuchService anmeldeversuchService;

	@MockitoBean
	private UserRepository userRepository;

	/**
	 * Der Zaehler ist ein Singleton im Testkontext. Ohne Ruecksetzen wuerden
	 * sich die Fehlversuche der einzelnen Testmethoden addieren und die
	 * Reihenfolge der Tests waere plotzlich relevant.
	 */
	@BeforeEach
	void zaehlerZuruecksetzen() {
		// MockMvc meldet immer dieselbe Absender-Adresse.
		for (String email : new String[] {"privat@example.org", "hsb@stud.hs-bremen.de",
				"unbekannt@example.org"}) {
			anmeldeversuchService.setzeZurueck(email, "127.0.0.1");
		}
	}

	private User aktiverNutzer() {
		return TestUser.erzeuge(UUID.randomUUID(), "privat@example.org", "hsb@stud.hs-bremen.de",
				Rolle.STUDIERENDE, UserStatus.AKTIV, passwordEncoder.encode(PASSWORT));
	}

	private String tokenFuer(User user) {
		return jwtService.erzeugeToken(AngemeldeterBenutzer.aus(user));
	}

	private String alsJson(Object objekt) throws Exception {
		return objectMapper.writeValueAsString(objekt);
	}

	// --- /auth/me und Tokenpruefung ---------------------------------------

	@Test
	@DisplayName("Gueltiges Token: /auth/me liefert den Benutzer")
	void meMitGueltigemToken() throws Exception {
		User user = aktiverNutzer();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tokenFuer(user)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(user.getId().toString()))
				.andExpect(jsonPath("$.email").value("privat@example.org"))
				.andExpect(jsonPath("$.rolle").value("STUDIERENDE"));
	}

	@Test
	@DisplayName("Fehlendes Token: 401 im Envelope aus §6.2")
	void meOhneToken() throws Exception {
		mockMvc.perform(get("/api/auth/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.fehlercode").value("NICHT_AUTHENTIFIZIERT"))
				.andExpect(jsonPath("$.zeitpunkt").exists())
				.andExpect(jsonPath("$.meldung").exists())
				.andExpect(jsonPath("$.pfad").value("/api/auth/me"));
	}

	@Test
	@DisplayName("Manipuliertes Token: 401 mit TOKEN_UNGUELTIG")
	void meMitManipuliertemToken() throws Exception {
		User user = aktiverNutzer();
		String token = tokenFuer(user);
		String[] teile = token.split("\\.");
		char ersetzt = teile[1].charAt(5) == 'A' ? 'B' : 'A';
		String manipuliert = teile[0] + "." + teile[1].substring(0, 5) + ersetzt + teile[1].substring(6)
				+ "." + teile[2];

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + manipuliert))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value("TOKEN_UNGUELTIG"))
				.andExpect(jsonPath("$.pfad").value("/api/auth/me"));
	}

	@Test
	@DisplayName("Abgelaufenes Token: 401 mit TOKEN_ABGELAUFEN")
	void meMitAbgelaufenemToken() throws Exception {
		JwtService abgelaufen = new JwtService(
				new JwtEigenschaften(SECRET, Duration.ofSeconds(-60), "eportfolio"));
		User user = aktiverNutzer();
		String token = abgelaufen.erzeugeToken(AngemeldeterBenutzer.aus(user));

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value("TOKEN_ABGELAUFEN"));
	}

	@Test
	@DisplayName("Konto zwischenzeitlich deaktiviert: gueltiges Token nuetzt nichts mehr")
	void tokenEinesDeaktiviertenKontos() throws Exception {
		User user = aktiverNutzer();
		String token = tokenFuer(user);

		// Der Admin deaktiviert das Konto, nachdem das Token ausgegeben wurde.
		User deaktiviert = TestUser.erzeuge(user.getId(), user.getEmail(), user.getHsbEmail(),
				Rolle.STUDIERENDE, UserStatus.DEAKTIVIERT, user.getPasswortHash());
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(deaktiviert));

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value("KONTO_NICHT_AKTIV"));
	}

	// --- 403 ---------------------------------------------------------------

	@Test
	@DisplayName("Angemeldet, aber falsche Rolle: 403 im selben Envelope")
	void adminBereichMitFalscherRolle() throws Exception {
		User user = aktiverNutzer();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		// /api/admin/** ist in der SecurityConfig auf ROLE_ADMIN beschraenkt.
		mockMvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + tokenFuer(user)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.fehlercode").value("KEINE_BERECHTIGUNG"))
				.andExpect(jsonPath("$.zeitpunkt").exists())
				.andExpect(jsonPath("$.pfad").value("/api/admin/dashboard"));
	}

	// --- Login -------------------------------------------------------------

	@Test
	@DisplayName("Login mit privater E-Mail: 200 mit Token")
	void loginErfolgreich() throws Exception {
		User user = aktiverNutzer();
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("privat@example.org", PASSWORT))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").isNotEmpty())
				.andExpect(jsonPath("$.benutzer.email").value("privat@example.org"));
	}

	@Test
	@DisplayName("Login mit der HSB-Adresse: 401, weil die Adresse keine Login-Kennung ist (§3.1.1)")
	void loginMitHsbAdresse() throws Exception {
		User user = aktiverNutzer();
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));
		when(userRepository.findByEmail("hsb@stud.hs-bremen.de")).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("hsb@stud.hs-bremen.de", PASSWORT))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value("ANMELDUNG_FEHLGESCHLAGEN"))
				.andExpect(jsonPath("$.status").value(401));
	}

	@Test
	@DisplayName("Login mit falschem Passwort: 401 im Envelope")
	void loginFalschesPasswort() throws Exception {
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(aktiverNutzer()));

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("privat@example.org", "falsch"))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value("ANMELDUNG_FEHLGESCHLAGEN"));
	}

	@Test
	@DisplayName("Login eines deaktivierten Kontos: 401 mit KONTO_NICHT_AKTIV")
	void loginDeaktiviert() throws Exception {
		User user = TestUser.erzeuge(UUID.randomUUID(), "privat@example.org", "hsb@stud.hs-bremen.de",
				Rolle.STUDIERENDE, UserStatus.DEAKTIVIERT, passwordEncoder.encode(PASSWORT));
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));

		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("privat@example.org", PASSWORT))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.fehlercode").value("KONTO_NICHT_AKTIV"));
	}

	@Test
	@DisplayName("Login ist ohne Token erreichbar (PUBLIC)")
	void loginOhneTokenErreichbar() throws Exception {
		when(userRepository.findByEmail(any())).thenReturn(Optional.empty());

		// Nicht 401 vom EntryPoint, sondern die fachliche Antwort des Controllers.
		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("unbekannt@example.org", PASSWORT))))
				.andExpect(jsonPath("$.fehlercode").value("ANMELDUNG_FEHLGESCHLAGEN"));
	}

	@Test
	@DisplayName("Sechster Fehlversuch: 429 ZU_VIELE_ANMELDEVERSUCHE im §6.2-Envelope")
	void zuVieleAnmeldeversuche() throws Exception {
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(aktiverNutzer()));

		for (int i = 0; i < 5; i++) {
			mockMvc.perform(post("/api/auth/login")
							.contentType("application/json")
							.content(alsJson(new LoginAnfrage("privat@example.org", "falsch"))))
					.andExpect(status().isUnauthorized());
		}

		// Auch mit korrektem Passwort - die Sperre greift vor der Pruefung.
		mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("privat@example.org", PASSWORT))))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.status").value(429))
				.andExpect(jsonPath("$.fehlercode").value("ZU_VIELE_ANMELDEVERSUCHE"))
				.andExpect(jsonPath("$.zeitpunkt").exists())
				.andExpect(jsonPath("$.pfad").value("/api/auth/login"))
				// Die Meldung nennt keine Restzeit und kein Konto.
				.andExpect(jsonPath("$.meldung").value(
						org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Minute"))));
	}

	// --- Logout ------------------------------------------------------------

	@Test
	@DisplayName("Logout quittiert mit 204 - das Token bleibt technisch gueltig")
	void logout() throws Exception {
		User user = aktiverNutzer();
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		String token = tokenFuer(user);

		mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
				.andExpect(status().isNoContent());

		// Dokumentiert die Einschraenkung des stateless Ansatzes: derselbe
		// Token funktioniert nach dem Logout weiter. Abmeldung heisst, dass der
		// Client ihn verwirft.
		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk());
	}

	// --- Keine Geheimnisse in Responses ------------------------------------

	@Test
	@DisplayName("Keine Auth-Response enthaelt passwortHash oder hsbEmail (§3.1)")
	void keinePasswortHashUndKeineHsbEmailInResponses() throws Exception {
		User user = aktiverNutzer();
		when(userRepository.findByEmail("privat@example.org")).thenReturn(Optional.of(user));
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

		MvcResult login = mockMvc.perform(post("/api/auth/login")
						.contentType("application/json")
						.content(alsJson(new LoginAnfrage("privat@example.org", PASSWORT))))
				.andExpect(status().isOk())
				.andReturn();

		MvcResult me = mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Bearer " + tokenFuer(user)))
				.andExpect(status().isOk())
				.andReturn();

		for (MvcResult ergebnis : new MvcResult[] {login, me}) {
			String koerper = ergebnis.getResponse().getContentAsString();

			assertThat(koerper)
					.as("Feldname passwortHash darf nicht vorkommen")
					.doesNotContain("passwortHash");
			assertThat(koerper)
					.as("Der BCrypt-Hash selbst darf nicht vorkommen")
					.doesNotContain(user.getPasswortHash());
			assertThat(koerper)
					.as("Feldname hsbEmail darf nicht vorkommen")
					.doesNotContain("hsbEmail");
			assertThat(koerper)
					.as("Die HSB-Adresse selbst darf nicht vorkommen")
					.doesNotContain(user.getHsbEmail());
		}
	}
}
