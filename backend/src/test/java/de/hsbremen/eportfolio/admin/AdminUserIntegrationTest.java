package de.hsbremen.eportfolio.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die fuenf Zeilen der Nutzerverwaltung aus §6.1 gegen die echte Datenbank
 * (KAN-25).
 *
 * <p>Schwerpunkte sind die Zusagen des Contracts und die Entscheidungen aus der
 * Klaerungsrunde: das administrativ angelegte Konto bekommt ein Portfolio
 * (§3.2.1) und den erzwungenen Passwortwechsel (§6.7), der Tutor-Fall laeuft
 * ueber die Rollenaenderung (§3.1.1), das Loeschen deaktiviert und entfernt
 * keine Zeile (§6.1), und das eigene Konto ist gegen Rolle und Status
 * geschuetzt.
 *
 * <p><strong>Alle Testkonten tragen denselben Nachnamen</strong>, der je Lauf
 * neu gewuerfelt wird, und die Suche grenzt darauf ein. Ohne das haengen die
 * Erwartungen am Bestand der Entwicklungsdatenbank, in der bereits Konten aus
 * dem {@code DevTestUserSeeder} und aus frueheren Laeufen stehen.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck. Die Anmeldung laeuft
 * ueber echte Tokens aus dem {@link JwtService}, damit jede Anfrage dieselbe
 * Filterkette durchlaeuft wie in Produktion; nur so sind die 401- und
 * 403-Faelle aussagekraeftig.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminUserIntegrationTest {

	private static final String USERS = "/api/admin/users";

	/** Genuegt der Passwortregel aus §3.1.1 (mindestens zwoelf Zeichen). */
	private static final String INITIAL_PASSWORD = "Startpasswort-2026";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PortfolioRepository portfolioRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/** Nachname aller in diesem Lauf angelegten Konten, zugleich Suchbegriff. */
	private String marker;

	private User admin;

	private User student;

	private User editor;

	private User deactivated;

	@BeforeEach
	void buildData() {
		marker = "Pruefkonto" + UUID.randomUUID().toString().substring(0, 8);

		admin = save(Role.ADMIN, UserStatus.ACTIVE, "Ada");
		student = save(Role.STUDENT, UserStatus.ACTIVE, "Sven");
		editor = save(Role.EDITOR, UserStatus.ACTIVE, "Elke");
		deactivated = save(Role.STUDENT, UserStatus.DEACTIVATED, "Dirk");
	}

	// ==================================================================
	// GET /api/admin/users
	// ==================================================================

	@Nested
	@DisplayName("GET /api/admin/users")
	class List {

		@Test
		@DisplayName("Liefert alle Konten im Seitenformat aus §6.6")
		void returnsPageFormat() throws Exception {
			mockMvc.perform(as(admin, get(USERS).param("q", marker)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content.length()").value(4))
					.andExpect(jsonPath("$.page").value(0))
					.andExpect(jsonPath("$.size").value(20))
					.andExpect(jsonPath("$.totalElements").value(4))
					.andExpect(jsonPath("$.totalPages").value(1));
		}

		@Test
		@DisplayName("Deaktivierte Konten stehen in der Liste, sonst waeren sie nicht mehr freizuschalten")
		void includesDeactivatedAccounts() throws Exception {
			mockMvc.perform(as(admin, get(USERS)
							.param("q", marker)
							.param("status", "DEACTIVATED")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(1))
					.andExpect(jsonPath("$.content[0].id").value(deactivated.getId().toString()));
		}

		@Test
		@DisplayName("Der Filter role grenzt auf eine Rolle ein (§2.1)")
		void filtersByRole() throws Exception {
			mockMvc.perform(as(admin, get(USERS).param("q", marker).param("role", "EDITOR")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(1))
					.andExpect(jsonPath("$.content[0].id").value(editor.getId().toString()));
		}

		@Test
		@DisplayName("Der Suchbegriff greift auch auf die HSB-Adresse")
		void searchesHsbEmail() throws Exception {
			mockMvc.perform(as(admin, get(USERS).param("q", student.getHsbEmail())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.totalElements").value(1))
					.andExpect(jsonPath("$.content[0].id").value(student.getId().toString()));
		}

		@Test
		@DisplayName("Ohne sort steht die Liste alphabetisch nach Nachname und Vorname")
		void defaultSortIsAlphabetical() throws Exception {
			// Alle vier Konten teilen sich den Nachnamen, entscheidend ist also
			// der Vorname: Ada, Dirk, Elke, Sven.
			mockMvc.perform(as(admin, get(USERS).param("q", marker)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[0].firstName").value("Ada"))
					.andExpect(jsonPath("$.content[1].firstName").value("Dirk"))
					.andExpect(jsonPath("$.content[2].firstName").value("Elke"))
					.andExpect(jsonPath("$.content[3].firstName").value("Sven"));
		}

		@Test
		@DisplayName("Ein Feld ausserhalb der Positivliste ergibt 400 und sortiert nicht nach passwordHash")
		void unknownSortFieldIsRejected() throws Exception {
			mockMvc.perform(as(admin, get(USERS).param("sort", "passwordHash,asc")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ohne Token 401, mit fremdem Token 403 (§5)")
		void requiresAdmin() throws Exception {
			mockMvc.perform(get(USERS))
					.andExpect(status().isUnauthorized());

			mockMvc.perform(as(editor, get(USERS)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}
	}

	// ==================================================================
	// GET /api/admin/users/{id}
	// ==================================================================

	@Nested
	@DisplayName("GET /api/admin/users/{id}")
	class Detail {

		@Test
		@DisplayName("Liefert das Konto einschliesslich hsbEmail (§3.1)")
		void returnsSingleAccount() throws Exception {
			mockMvc.perform(as(admin, get(USERS + "/" + student.getId())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.id").value(student.getId().toString()))
					.andExpect(jsonPath("$.hsbEmail").value(student.getHsbEmail()))
					.andExpect(jsonPath("$.passwordHash").doesNotExist());
		}

		@Test
		@DisplayName("Unbekannte ID ergibt 404 RESOURCE_NOT_FOUND (§6.3.1)")
		void unknownIdIsNotFound() throws Exception {
			mockMvc.perform(as(admin, get(USERS + "/" + UUID.randomUUID())))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}
	}

	// ==================================================================
	// POST /api/admin/users
	// ==================================================================

	@Nested
	@DisplayName("POST /api/admin/users")
	class Create {

		@Test
		@DisplayName("Erzeugt Konto und Portfolio (§3.2.1) mit erzwungenem Passwortwechsel (§6.7)")
		void createsUserAndPortfolio() throws Exception {
			String response = mockMvc.perform(as(admin, create(body(Role.STUDENT,
							"neu@example.org", "neu@stud.hs-bremen.de"))))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.status").value("ACTIVE"))
					.andExpect(jsonPath("$.emailVerified").value(true))
					.andExpect(jsonPath("$.hsbEmailVerified").value(true))
					.andExpect(jsonPath("$.passwordChangeRequired").value(true))
					.andExpect(jsonPath("$.hsbEmail").value("neu@stud.hs-bremen.de"))
					.andExpect(jsonPath("$.passwordHash").doesNotExist())
					.andReturn().getResponse().getContentAsString();

			UUID id = UUID.fromString(objectMapper.readTree(response).get("id").asText());

			assertThat(portfolioRepository.findByUserId(id))
					.as("§3.2.1: die Kontoanlage durch die Administration legt das Portfolio mit an")
					.isPresent();

			User created = userRepository.findById(id).orElseThrow();
			assertThat(passwordEncoder.matches(INITIAL_PASSWORD, created.getPasswordHash()))
					.as("Das Initialpasswort wird als BCrypt-Hash gespeichert, nicht im Klartext")
					.isTrue();
		}

		@Test
		@DisplayName("Die Rolle aus dem Body gilt, auch ADMIN (§3.1.1)")
		void takesRoleFromBody() throws Exception {
			// Die Adresse liegt in student-domains; bei der Selbstregistrierung
			// waere daraus zwingend STUDENT geworden. §3.1.1 verlangt fuer ADMIN
			// ausdruecklich diesen Weg, weil keine Domain ADMIN ergeben kann.
			mockMvc.perform(as(admin, create(body(Role.ADMIN,
							"chef@example.org", "chef@stud.hs-bremen.de"))))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.role").value("ADMIN"));
		}

		@Test
		@DisplayName("Eine fremde Domain der hsbEmail ergibt 400 (§3.1.1)")
		void foreignDomainIsRejected() throws Exception {
			mockMvc.perform(as(admin, create(body(Role.STUDENT,
							"extern@example.org", "extern@beispiel.invalid"))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(containsString("hsbEmail")));
		}

		@Test
		@DisplayName("Eine bereits vergebene Adresse ergibt 409 RESOURCE_IN_USE und nennt das Feld")
		void takenAddressIsConflict() throws Exception {
			mockMvc.perform(as(admin, create(body(Role.STUDENT,
							student.getEmail(), "frei@stud.hs-bremen.de"))))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"))
					.andExpect(jsonPath("$.message").value(containsString("email:")));
		}

		@Test
		@DisplayName("Ein zu kurzes Initialpasswort ergibt 400 (§3.1.1)")
		void shortPasswordIsRejected() throws Exception {
			Map<String, Object> body = body(Role.STUDENT, "kurz@example.org", "kurz@stud.hs-bremen.de");
			body.put("password", "kurz");

			mockMvc.perform(as(admin, create(body)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ohne ADMIN-Rolle 403, und es entsteht kein Konto (§5)")
		void requiresAdmin() throws Exception {
			mockMvc.perform(as(student, create(body(Role.STUDENT,
							"heimlich@example.org", "heimlich@stud.hs-bremen.de"))))
					.andExpect(status().isForbidden());

			assertThat(userRepository.findByEmail("heimlich@example.org")).isEmpty();
		}
	}

	// ==================================================================
	// PATCH /api/admin/users/{id}
	// ==================================================================

	@Nested
	@DisplayName("PATCH /api/admin/users/{id}")
	class Update {

		@Test
		@DisplayName("Stuft einen STUDENT auf EDITOR hoch (Tutor-Fall, §3.1.1)")
		void promotesStudentToEditor() throws Exception {
			mockMvc.perform(as(admin, patchUser(student, Map.of("role", "EDITOR"))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.role").value("EDITOR"));

			assertThat(userRepository.findById(student.getId()).orElseThrow().getRole())
					.isEqualTo(Role.EDITOR);
		}

		@Test
		@DisplayName("Weggelassene Felder bleiben unveraendert")
		void omittedFieldsStayUnchanged() throws Exception {
			mockMvc.perform(as(admin, patchUser(student, Map.of("firstName", "Svenja"))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.firstName").value("Svenja"))
					.andExpect(jsonPath("$.lastName").value(marker))
					.andExpect(jsonPath("$.role").value("STUDENT"))
					.andExpect(jsonPath("$.status").value("ACTIVE"));
		}

		@Test
		@DisplayName("status = DEACTIVATED sperrt das Konto, wie das DELETE")
		void statusFieldDeactivates() throws Exception {
			mockMvc.perform(as(admin, patchUser(student, Map.of("status", "DEACTIVATED"))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value("DEACTIVATED"));
		}

		@Test
		@DisplayName("status = REGISTRATION_PENDING ergibt 400: das waere eine Sperre ohne Ausweg (§2.9)")
		void registrationPendingIsRejected() throws Exception {
			mockMvc.perform(as(admin, patchUser(student, Map.of("status", "REGISTRATION_PENDING"))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(userRepository.findById(student.getId()).orElseThrow().getStatus())
					.isEqualTo(UserStatus.ACTIVE);
		}

		@Test
		@DisplayName("Ein uebermittelter, aber leerer Name ergibt 400")
		void blankNameIsRejected() throws Exception {
			mockMvc.perform(as(admin, patchUser(student, Map.of("lastName", "   "))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Die eigene Rolle laesst sich nicht aendern, sonst sperrt sich der Admin aus (§6.5)")
		void ownRoleIsProtected() throws Exception {
			mockMvc.perform(as(admin, patchUser(admin, Map.of("role", "STUDENT"))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(userRepository.findById(admin.getId()).orElseThrow().getRole())
					.isEqualTo(Role.ADMIN);
		}

		@Test
		@DisplayName("Der eigene Status laesst sich nicht aendern")
		void ownStatusIsProtected() throws Exception {
			mockMvc.perform(as(admin, patchUser(admin, Map.of("status", "DEACTIVATED"))))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Der eigene Name bleibt aenderbar: eine Namenskorrektur sperrt niemanden aus")
		void ownNameStaysEditable() throws Exception {
			mockMvc.perform(as(admin, patchUser(admin, Map.of("firstName", "Adalbert"))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.firstName").value("Adalbert"));
		}

		@Test
		@DisplayName("Ein fremdes Admin-Konto bleibt aenderbar: geschuetzt ist nur das eigene")
		void foreignAdminStaysEditable() throws Exception {
			User secondAdmin = save(Role.ADMIN, UserStatus.ACTIVE, "Achim");

			mockMvc.perform(as(admin, patchUser(secondAdmin, Map.of("role", "EDITOR"))))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.role").value("EDITOR"));
		}

		@Test
		@DisplayName("Unbekannte ID ergibt 404")
		void unknownIdIsNotFound() throws Exception {
			mockMvc.perform(as(admin, patch(USERS + "/" + UUID.randomUUID())
							.contentType(MediaType.APPLICATION_JSON)
							.content(json(Map.of("firstName", "Egal")))))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}
	}

	// ==================================================================
	// DELETE /api/admin/users/{id}
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/admin/users/{id}")
	class Deactivate {

		@Test
		@DisplayName("Setzt DEACTIVATED und loescht keine Zeile (§6.1)")
		void deactivatesWithoutDeleting() throws Exception {
			long before = userRepository.count();

			mockMvc.perform(as(admin, delete(USERS + "/" + student.getId())))
					.andExpect(status().isNoContent());

			assertThat(userRepository.findById(student.getId()))
					.get()
					.extracting(User::getStatus)
					.isEqualTo(UserStatus.DEACTIVATED);
			assertThat(userRepository.count()).isEqualTo(before);
		}

		@Test
		@DisplayName("Ein zweiter Aufruf ergibt wieder 204")
		void isIdempotent() throws Exception {
			mockMvc.perform(as(admin, delete(USERS + "/" + student.getId())))
					.andExpect(status().isNoContent());
			mockMvc.perform(as(admin, delete(USERS + "/" + student.getId())))
					.andExpect(status().isNoContent());
		}

		@Test
		@DisplayName("Das eigene Konto laesst sich nicht deaktivieren")
		void ownAccountIsProtected() throws Exception {
			mockMvc.perform(as(admin, delete(USERS + "/" + admin.getId())))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(userRepository.findById(admin.getId()).orElseThrow().getStatus())
					.isEqualTo(UserStatus.ACTIVE);
		}

		@Test
		@DisplayName("Unbekannte ID ergibt 404")
		void unknownIdIsNotFound() throws Exception {
			mockMvc.perform(as(admin, delete(USERS + "/" + UUID.randomUUID())))
					.andExpect(status().isNotFound());
		}

		@Test
		@DisplayName("Ohne ADMIN-Rolle 403, und das Konto bleibt aktiv (§5)")
		void requiresAdmin() throws Exception {
			mockMvc.perform(as(editor, delete(USERS + "/" + student.getId())))
					.andExpect(status().isForbidden());

			assertThat(userRepository.findById(student.getId()).orElseThrow().getStatus())
					.isEqualTo(UserStatus.ACTIVE);
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role, UserStatus status, String firstName) {
		User user = TestUser.withoutId(role, status, "nicht-relevant");
		user.setFirstName(firstName);
		user.setLastName(marker);
		return userRepository.saveAndFlush(user);
	}

	private Map<String, Object> body(Role role, String email, String hsbEmail) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("firstName", "Neu");
		body.put("lastName", marker);
		body.put("email", email);
		body.put("hsbEmail", hsbEmail);
		body.put("role", role.name());
		body.put("password", INITIAL_PASSWORD);
		return body;
	}

	private MockHttpServletRequestBuilder create(Map<String, Object> body) throws Exception {
		return post(USERS)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(body));
	}

	private MockHttpServletRequestBuilder patchUser(User target, Map<String, Object> body)
			throws Exception {

		return patch(USERS + "/" + target.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(body));
	}

	private String json(Map<String, Object> body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
