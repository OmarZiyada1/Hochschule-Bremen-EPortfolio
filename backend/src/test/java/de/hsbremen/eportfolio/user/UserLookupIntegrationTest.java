package de.hsbremen.eportfolio.user;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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
 * {@code GET /api/users/lookup} aus API-Contract §6.1 gegen die echte
 * Datenbank (KAN-44), einschliesslich der beiden Zusagen aus der Definition
 * of Done: die Antwort enthaelt keine E-Mail-Adressen, und ohne Token gibt es
 * 401.
 *
 * <p>Alle Abfragen filtern ueber {@code q} auf einen je Testlauf eindeutigen
 * Namenszusatz: die Entwicklungsdatenbank enthaelt weitere Konten (Seeder),
 * und ohne den Zusatz hingen die Erwartungen an fremdem Bestand.
 * {@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserLookupIntegrationTest {

	private static final String LOOKUP_PATH = "/api/users/lookup";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	/** Eindeutiger Namenszusatz dieses Testlaufs, siehe Klassen-Javadoc. */
	private String marker;

	private User caller;

	private User editorAbel;

	private User editorZobel;

	/**
	 * Fuenf Konten: die aufrufende Studentin, zwei aktive Redakteur:innen,
	 * ein deaktiviertes und ein unfertiges Redaktionskonto. Die Nachnamen der
	 * beiden aktiven beginnen nach dem Zusatz einmal klein und einmal gross,
	 * damit die Sortierung nur mit Gross-Klein-Ignoranz stimmt.
	 */
	@BeforeEach
	void createAccounts() {
		marker = "Kan44x" + UUID.randomUUID().toString().substring(0, 8);

		caller = saved(Role.STUDENT, UserStatus.ACTIVE, "Mia", marker + "Meier");
		editorAbel = saved(Role.EDITOR, UserStatus.ACTIVE, "Anna", marker + "abel");
		editorZobel = saved(Role.EDITOR, UserStatus.ACTIVE, "Zoe", marker + "Zobel");
		saved(Role.EDITOR, UserStatus.DEACTIVATED, "Weg", marker + "Deaktiviert");
		saved(Role.EDITOR, UserStatus.REGISTRATION_PENDING, "Noch", marker + "Unfertig");
	}

	private User saved(Role role, UserStatus status, String firstName, String lastName) {
		User user = TestUser.withoutId(role, status, "egal-hier-kein-login");
		user.setFirstName(firstName);
		user.setLastName(lastName);
		return userRepository.save(user);
	}

	private MockHttpServletRequestBuilder asCaller(MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(caller));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	@Test
	@DisplayName("role=EDITOR und q: nur aktive Redaktionskonten, sortiert nach Nachname, ohne Adressen (DoD)")
	void filtersByRoleAndExcludesInactiveAccounts() throws Exception {
		mockMvc.perform(asCaller(get(LOOKUP_PATH).param("role", "EDITOR").param("q", marker)))
				.andExpect(status().isOk())
				// Deaktiviert und unfertig fehlen, sonst waeren es vier.
				.andExpect(jsonPath("$", hasSize(2)))
				// "abel" vor "Zobel" gelingt nur ohne Beachtung der
				// Grossschreibung; byteweise laege Z (90) vor a (97).
				.andExpect(jsonPath("$[0].id").value(editorAbel.getId().toString()))
				.andExpect(jsonPath("$[0].firstName").value("Anna"))
				.andExpect(jsonPath("$[0].lastName").value(marker + "abel"))
				.andExpect(jsonPath("$[1].id").value(editorZobel.getId().toString()))
				// Die Zusage aus §3.1 und der Definition of Done: weder die
				// private noch die HSB-Adresse, und erst recht kein Hash.
				.andExpect(jsonPath("$[0].email").doesNotExist())
				.andExpect(jsonPath("$[0].hsbEmail").doesNotExist())
				.andExpect(jsonPath("$[0].passwordHash").doesNotExist())
				.andExpect(jsonPath("$[1].email").doesNotExist())
				.andExpect(jsonPath("$[1].hsbEmail").doesNotExist());
	}

	@Test
	@DisplayName("Ohne role: alle aktiven Konten zum Suchbegriff, auch Studierende")
	void withoutRoleReturnsAllActiveMatches() throws Exception {
		mockMvc.perform(asCaller(get(LOOKUP_PATH).param("q", marker)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(3)))
				.andExpect(jsonPath("$[0].lastName").value(marker + "abel"))
				.andExpect(jsonPath("$[1].lastName").value(marker + "Meier"))
				.andExpect(jsonPath("$[2].lastName").value(marker + "Zobel"));
	}

	@Test
	@DisplayName("q trifft keine E-Mail-Adressen: der Endpoint ist kein Adressverzeichnis (§6.1)")
	void searchDoesNotMatchEmailAddresses() throws Exception {
		// Die Adresse existiert und gehoert zu einem aktiven Konto; ein
		// Treffer wuerde jeder angemeldeten Person verraten, dass sie
		// registriert ist.
		mockMvc.perform(asCaller(get(LOOKUP_PATH).param("q", editorAbel.getEmail())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));

		mockMvc.perform(asCaller(get(LOOKUP_PATH).param("q", editorAbel.getHsbEmail())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	@DisplayName("Wildcards im Suchbegriff werden maskiert, kein Prozentzeichen-Vollzugriff")
	void escapesLikeWildcards() throws Exception {
		// Ohne Maskierung stuende hier ein like auf '%<marker>%%' und faende
		// alle drei aktiven Konten; mit Maskierung sucht es das Zeichen '%'
		// im Namen und findet nichts.
		mockMvc.perform(asCaller(get(LOOKUP_PATH).param("q", marker + "%")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	@DisplayName("Ohne Token: 401 NOT_AUTHENTICATED im Envelope (DoD)")
	void requiresAuthentication() throws Exception {
		mockMvc.perform(get(LOOKUP_PATH))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"))
				.andExpect(jsonPath("$.path").value(LOOKUP_PATH));
	}

	@Test
	@DisplayName("Unbekannter role-Wert: 400 VALIDATION_FAILED im Envelope")
	void rejectsUnknownRoleValue() throws Exception {
		mockMvc.perform(asCaller(get(LOOKUP_PATH).param("role", "HAUSMEISTER")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
	}
}
