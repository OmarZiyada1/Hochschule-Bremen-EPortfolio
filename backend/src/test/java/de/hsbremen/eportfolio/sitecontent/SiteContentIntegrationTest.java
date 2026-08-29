package de.hsbremen.eportfolio.sitecontent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die pflegbaren Startseitentexte (§3.21, §6.1) gegen die echte Datenbank.
 *
 * <p>Vier Zusagen stehen im Mittelpunkt. Erstens der Rueckfall: was nicht
 * gepflegt ist, fehlt in der Antwort, und die leere Tabelle ist der
 * Regelzustand und kein Fehler. Zweitens die Sprachtrennung: gepflegt wird je
 * Schluessel <em>und</em> je Sprache, die ungepflegte Sprache kommt als
 * {@code null} zurueck und nicht als Text der anderen. Drittens das Loeschen
 * ueber den leeren Wert, den einzigen Weg zurueck zur mitgelieferten Fassung.
 * Viertens die Platzhalterpruefung: der Server laesst weder einen fehlenden
 * noch einen ueberzaehligen Platzhalter durch, denn beides faellt erst auf der
 * fertigen Seite auf.
 *
 * <p>Dazu die Abstufung der Zugriffe: das Lesen ist PUBLIC, das Pflegen
 * ausschliesslich ADMIN, und ohne Token kommt 401 und nicht 403 (§5, §6.3).
 *
 * <p>Und die Bean-Validation: fehlende Liste, leerer oder zu langer Schluessel
 * und zu langer Text landen im selben Envelope aus §6.2 wie die Pruefungen des
 * Dienstes, also mit 400 {@code VALIDATION_FAILED} und dem Feldnamen in der
 * Meldung. Ohne diese Faelle waere nur belegt, dass der Dienst prueft, nicht
 * dass beide Wege dasselbe Format liefern.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck; die Tabelle startet in
 * jedem Lauf leer, weil es zu ihr keine Seed-Daten gibt.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SiteContentIntegrationTest {

	private static final String PUBLIC_PATH = "/api/site-content";

	private static final String ADMIN_PATH = "/api/admin/site-content";

	private static final String SUBTITLE = "home.hero.subtitle";

	private static final String LABEL = "home.hero.label";

	private static final String TOP10_TITLE = "home.top10.title";

	private static final String CTA_DESCRIPTION = "home.cta.description";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private SiteContentRepository siteContentRepository;

	private User admin;

	private User student;

	private User editor;

	@BeforeEach
	void buildData() {
		siteContentRepository.deleteAll();
		siteContentRepository.flush();

		admin = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.ADMIN, "nicht-relevant"));
		student = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
		editor = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.EDITOR, "nicht-relevant"));
	}

	// ==================================================================
	// GET /api/site-content (PUBLIC)
	// ==================================================================

	@Nested
	@DisplayName("Lesen (§6.1, PUBLIC)")
	class Reading {

		@Test
		@DisplayName("Ohne Token 200; ungepflegt heisst leere Liste und nicht 404")
		void emptyWithoutToken() throws Exception {
			mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries").isArray())
					.andExpect(jsonPath("$.entries").isEmpty());
		}

		@Test
		@DisplayName("Nur eine Sprache gepflegt: die andere kommt als null zurueck")
		void singleLanguageLeavesTheOtherNull() throws Exception {
			replaceAsAdmin(entry(SUBTITLE, "Nur deutsch", null));

			String response = mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries.length()").value(1))
					.andExpect(jsonPath("$.entries[0].key").value(SUBTITLE))
					.andExpect(jsonPath("$.entries[0].valueDe").value("Nur deutsch"))
					.andReturn().getResponse().getContentAsString();

			// Das Feld steht in der Antwort und traegt null. Weggelassen waere es
			// vom gepflegten Leerstring nicht zu unterscheiden, und genau dieser
			// Unterschied entscheidet, ob der Client seine Sprachdatei nimmt.
			JsonNode entry = objectMapper.readTree(response).path("entries").get(0);
			assertThat(entry.has("valueEn")).isTrue();
			assertThat(entry.get("valueEn").isNull()).isTrue();
		}

		@Test
		@DisplayName("Ungepflegte Schluessel fehlen ganz, gepflegte stehen in Abschnittsreihenfolge")
		void onlyMaintainedKeysAppear() throws Exception {
			replaceAsAdmin(entry(CTA_DESCRIPTION, "{{works}} Projekte aus {{faculties}} Fakultaeten",
							"{{works}} projects from {{faculties}} faculties"),
					entry(LABEL, "Marke", "Brand"));

			List<String> keys = keysOf(mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString());

			assertThat(keys).containsExactly(LABEL, CTA_DESCRIPTION);
		}
	}

	// ==================================================================
	// PUT /api/admin/site-content (ADMIN)
	// ==================================================================

	@Nested
	@DisplayName("Pflegen (§6.1, ADMIN)")
	class Writing {

		@Test
		@DisplayName("Beide Sprachen werden gespeichert und danach zurueckgeliefert")
		void bothLanguagesAreStored() throws Exception {
			mockMvc.perform(asAdmin(entry(SUBTITLE, "Deutscher Text", "English text")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries.length()").value(1))
					.andExpect(jsonPath("$.entries[0].valueDe").value("Deutscher Text"))
					.andExpect(jsonPath("$.entries[0].valueEn").value("English text"));

			mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries[0].key").value(SUBTITLE))
					.andExpect(jsonPath("$.entries[0].valueDe").value("Deutscher Text"))
					.andExpect(jsonPath("$.entries[0].valueEn").value("English text"));

			assertThat(siteContentRepository.findAll()).hasSize(2);
		}

		@Test
		@DisplayName("Ein leerer Wert loescht die Zeile dieser Sprache")
		void blankValueDeletesOneLanguage() throws Exception {
			replaceAsAdmin(entry(SUBTITLE, "Deutscher Text", "English text"));

			mockMvc.perform(asAdmin(entry(SUBTITLE, "Deutscher Text", "   ")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries[0].valueDe").value("Deutscher Text"))
					.andExpect(jsonPath("$.entries[0].valueEn").doesNotExist());

			assertThat(siteContentRepository.findAll())
					.noneMatch(row -> row.getContentKey() == SiteContentKey.HOME_HERO_SUBTITLE
							&& SiteContent.LOCALE_EN.equals(row.getLocale()));
		}

		@Test
		@DisplayName("Sind beide Sprachen leer, verschwindet der Schluessel aus der Antwort")
		void blankInBothLanguagesRemovesTheKey() throws Exception {
			replaceAsAdmin(entry(SUBTITLE, "Deutscher Text", "English text"));

			mockMvc.perform(asAdmin(entry(SUBTITLE, "", null)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries").isEmpty());

			mockMvc.perform(get(PUBLIC_PATH))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries").isEmpty());
			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Nicht genannte Schluessel bleiben unberuehrt")
		void untouchedKeysSurvive() throws Exception {
			replaceAsAdmin(entry(LABEL, "Marke", "Brand"));

			mockMvc.perform(asAdmin(entry(SUBTITLE, "Deutscher Text", "English text")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.entries.length()").value(2));

			assertThat(keysOf(mockMvc.perform(get(PUBLIC_PATH))
					.andReturn().getResponse().getContentAsString()))
					.containsExactly(LABEL, SUBTITLE);
		}
	}

	// ==================================================================
	// Zugriff (§5, §6.3)
	// ==================================================================

	@Nested
	@DisplayName("Zugriff (§5)")
	class Access {

		@Test
		@DisplayName("Ohne Token 401 NOT_AUTHENTICATED")
		void writingNeedsToken() throws Exception {
			mockMvc.perform(put(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content(body(entry(SUBTITLE, "Deutscher Text", "English text"))))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		/**
		 * Geantwortet hat hier die Filterkette und nicht der Dienst:
		 * {@code SecurityConfig} faengt {@code /api/admin/**} schon mit
		 * {@code hasRole("ADMIN")} ab, und der {@code RestAccessDeniedHandler}
		 * schreibt dasselbe Envelope aus §6.2 wie der
		 * {@code GlobalExceptionHandler}. Genau deshalb steht die zweite Stufe,
		 * {@code ProjectPermissionService.mayManageSiteContent}, nicht hier,
		 * sondern im {@code ProjectPermissionServiceTest}: ueber HTTP ist sie
		 * nicht erreichbar, solange die erste Stufe haelt.
		 */
		@Test
		@DisplayName("STUDENT und EDITOR bekommen 403 NO_PERMISSION")
		void writingNeedsAdmin() throws Exception {
			mockMvc.perform(as(student, put(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content(body(entry(SUBTITLE, "Verboten", "Forbidden")))))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			mockMvc.perform(as(editor, put(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content(body(entry(SUBTITLE, "Verboten", "Forbidden")))))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}
	}

	// ==================================================================
	// Validierung (§6.2)
	// ==================================================================

	@Nested
	@DisplayName("Validierung (§6.2)")
	class Validation {

		@Test
		@DisplayName("Unbekannter Schluessel ergibt 400 VALIDATION_FAILED im Envelope aus §6.2")
		void unknownKeyIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry("home.top10.viewProject", "Ansehen", "View")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.path").value(ADMIN_PATH))
					.andExpect(jsonPath("$.timestamp").exists())
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].key")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("home.top10.title ohne {{year}} ergibt 400 am betroffenen Feld")
		void missingYearPlaceholderIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry(TOP10_TITLE, "Top 10", "Top 10 - {{year}}")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].valueDe")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("home.cta.description ohne {{faculties}} ergibt 400 am betroffenen Feld")
		void missingFacultiesPlaceholderIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry(CTA_DESCRIPTION,
							"{{works}} Projekte aus {{faculties}} Fakultaeten",
							"{{works}} projects")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].valueEn")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein Platzhalter in home.hero.label ergibt 400, dort gehoert keiner hin")
		void unexpectedPlaceholderIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry(LABEL, "HSB {{year}}", "HSB")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].valueDe")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Derselbe Schluessel zweimal im Body ergibt 400")
		void duplicateKeyIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry(SUBTITLE, "Erster", "First"),
							entry(SUBTITLE, "Zweiter", "Second")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[1].key")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein zu langer Text ergibt 400 VALIDATION_FAILED, im selben Envelope")
		void tooLongValueIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry(SUBTITLE, "x".repeat(1001), "English text")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].valueDe")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein leerer Schluessel ergibt 400 VALIDATION_FAILED")
		void blankKeyIsRejected() throws Exception {
			mockMvc.perform(asAdmin(entry("   ", "Deutscher Text", "English text")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].key")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein zu langer Schluessel ergibt 400 und steht nicht selbst im Fehlertext")
		void tooLongKeyIsRejected() throws Exception {
			// Ohne die obere Schranke am Feld spiegelte requireKnownKey den Wert
			// woertlich in die message des Envelopes aus §6.2, in beliebiger Laenge.
			String overlyLongKey = "home." + "x".repeat(124);

			String message = mockMvc.perform(asAdmin(entry(overlyLongKey, "Deutsch", "English")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							containsString("entries[0].key")))
					.andReturn().getResponse().getContentAsString();

			assertThat(message).doesNotContain(overlyLongKey);
			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Fehlt die Liste entries ganz, ergibt das 400 und keinen Serverfehler")
		void missingEntriesIsRejected() throws Exception {
			mockMvc.perform(as(admin, put(ADMIN_PATH)
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(containsString("entries")));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}

		@Test
		@DisplayName("Ein fehlerhafter Eintrag laesst auch die fehlerfreien daneben unangetastet")
		void nothingIsWrittenWhenOneEntryFails() throws Exception {
			mockMvc.perform(asAdmin(entry(SUBTITLE, "Deutscher Text", "English text"),
							entry(TOP10_TITLE, "Top 10", "Top 10")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(siteContentRepository.findAll()).isEmpty();
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	/** Ein Eintrag des Bodys; {@code null} bleibt {@code null} im JSON. */
	private Map<String, Object> entry(String key, String valueDe, String valueEn) {
		Map<String, Object> fields = new LinkedHashMap<>();
		fields.put("key", key);
		fields.put("valueDe", valueDe);
		fields.put("valueEn", valueEn);
		return fields;
	}

	@SafeVarargs
	private String body(Map<String, Object>... entries) throws Exception {
		return objectMapper.writeValueAsString(Map.of("entries", List.of(entries)));
	}

	@SafeVarargs
	private MockHttpServletRequestBuilder asAdmin(Map<String, Object>... entries) throws Exception {
		return as(admin, put(ADMIN_PATH)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(entries)));
	}

	@SafeVarargs
	private void replaceAsAdmin(Map<String, Object>... entries) throws Exception {
		mockMvc.perform(asAdmin(entries)).andExpect(status().isOk());
	}

	private List<String> keysOf(String response) throws Exception {
		List<String> keys = new ArrayList<>();
		objectMapper.readTree(response).path("entries")
				.forEach(node -> keys.add(node.path("key").asText()));
		return keys;
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}
}
