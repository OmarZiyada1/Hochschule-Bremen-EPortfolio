package de.hsbremen.eportfolio.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import de.hsbremen.eportfolio.support.dto.SupportRequestCreateRequest;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

/**
 * Das Support-Modul von aussen (§6.1 Abschnitt „Support", §3.20, KAN-85): das
 * oeffentliche Formular und die drei Verwaltungspfade.
 *
 * <p>Aufbau wie {@code EditLockIntegrationTest}: echte Postgres, echtes JWT,
 * {@code @Transactional} rollt die Datenbank am Ende zurueck.
 *
 * <p><strong>Jeder Test bekommt seine eigene Client-IP und seine eigene
 * Absenderadresse.</strong> Der Zaehler aus §6.5 liegt im Arbeitsspeicher des
 * Anwendungskontexts und rollt mit der Test-Transaktion nicht zurueck; mit der
 * Standardadresse 127.0.0.1 liefe der vierte POST dieser Klasse in ein 429,
 * ganz gleich aus welchem Test er kaeme. <strong>Beide</strong> Schluessel
 * muessen wechseln, denn §6.5 sperrt schon, wenn einer von ihnen die Grenze
 * erreicht: eine feste Adresse in allen Tests haette dasselbe bewirkt wie eine
 * feste IP. Das ist der Weg, der ohne eine nur fuer Tests vorhandene Tuer in
 * der Produktivklasse auskommt; die IP-Bereiche stammen aus RFC 5737, die
 * Adressform aus RFC 2606.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SupportIntegrationTest {

	private static final String PATH = "/api/support";

	private static final String ADMIN_PATH = "/api/admin/support";

	/** Vergibt je Aufruf eine neue Dokumentations-IP, siehe Klassenkommentar. */
	private static final AtomicInteger IP_COUNTER = new AtomicInteger();

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private SupportRequestRepository requestRepository;

	private User student;

	private User admin;

	private String clientIp;

	private String formEmail;

	@BeforeEach
	void buildData() {
		student = save(Role.STUDENT);
		admin = save(Role.ADMIN);

		int testNumber = IP_COUNTER.getAndIncrement();
		clientIp = "198.51.100." + (testNumber % 250 + 1);
		formEmail = "lena.brandt+" + testNumber + "@example.org";
	}

	// ==================================================================
	// POST /api/support
	// ==================================================================

	@Nested
	@DisplayName("POST /api/support")
	class Create {

		@Test
		@DisplayName("Ohne Token: 201 und eine Zeile in der Tabelle")
		void createsWithoutToken() throws Exception {
			long before = requestRepository.count();

			mockMvc.perform(form(valid()))
					.andExpect(status().isCreated())
					.andExpect(content().string(""));

			assertThat(requestRepository.count()).isEqualTo(before + 1);
			SupportRequest saved = newest();
			assertThat(saved.getName()).isEqualTo("Lena Brandt");
			assertThat(saved.getEmail()).isEqualTo(formEmail);
			assertThat(saved.getCategory()).isEqualTo(SupportRequestCategory.TECHNICAL_ISSUE);
			assertThat(saved.getStatus()).isEqualTo(SupportRequestStatus.OPEN);
			assertThat(saved.getSubmittedBy()).isNull();
		}

		/**
		 * §3.20: {@code name} und {@code email} kommen auch bei angemeldeten
		 * Konten aus dem Formular. Der Server ueberschreibt sie nicht mit den
		 * Kontodaten, sonst gaebe es fuer die Person, die ihre eigene Adresse
		 * gerade nicht erreicht, keinen Weg mehr zur Antwort.
		 */
		@Test
		@DisplayName("Mit Token: submittedByUserId gesetzt, Name und Adresse aus dem Formular")
		void keepsFormValuesAndRecordsAccount() throws Exception {
			mockMvc.perform(as(student, form(valid())))
					.andExpect(status().isCreated());

			SupportRequest saved = newest();
			assertThat(saved.getSubmittedBy()).isNotNull();
			assertThat(saved.getSubmittedBy().getId()).isEqualTo(student.getId());
			assertThat(saved.getEmail()).isEqualTo(formEmail)
					.isNotEqualTo(student.getEmail());
		}

		/**
		 * §6.1: Der Erfolg ist Absicht. Ein Fehler verriete, dass das Feld
		 * geprueft wird, und die naechste Fassung des Programms liesse es aus.
		 */
		@Test
		@DisplayName("Gefuelltes Honeypot-Feld: 201 und keine Zeile")
		void honeypotSilentlyDiscards() throws Exception {
			long before = requestRepository.count();

			mockMvc.perform(form(body("website", "http://spam.invalid")))
					.andExpect(status().isCreated());

			assertThat(requestRepository.count()).isEqualTo(before);
		}

		@Test
		@DisplayName("Der vierte Versuch innerhalb einer Stunde ergibt 429")
		void blocksFourthRequest() throws Exception {
			for (int i = 0; i < 3; i++) {
				mockMvc.perform(form(valid()))
						.andExpect(status().isCreated());
			}

			mockMvc.perform(form(valid()))
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_SUPPORT_REQUESTS"))
					.andExpect(jsonPath("$.status").value(429))
					.andExpect(jsonPath("$.path").value(PATH));
		}

		/**
		 * Die Sperre sitzt vor jeder Arbeit (§6.5): der abgewiesene Versuch legt
		 * keine Zeile an.
		 */
		@Test
		@DisplayName("Der abgewiesene vierte Versuch speichert nichts")
		void blockedRequestStoresNothing() throws Exception {
			for (int i = 0; i < 3; i++) {
				mockMvc.perform(form(valid())).andExpect(status().isCreated());
			}
			long after3 = requestRepository.count();

			mockMvc.perform(form(valid())).andExpect(status().isTooManyRequests());

			assertThat(requestRepository.count()).isEqualTo(after3);
		}

		/**
		 * §6.7, seit Contract v87: wer im Initialpasswort feststeckt, ist genau
		 * der Fall, fuer den es das Formular gibt. Ohne die Ausnahme im
		 * {@code JwtAuthenticationFilter} bekaeme diese Person hier 403.
		 */
		@Test
		@DisplayName("Ein Konto mit erzwungener Passwortaenderung darf absenden (§6.7)")
		void exemptFromPasswordChangeGate() throws Exception {
			User locked = save(Role.STUDENT);
			locked.setPasswordChangeRequired(true);
			userRepository.saveAndFlush(locked);

			mockMvc.perform(as(locked, form(valid())))
					.andExpect(status().isCreated());

			assertThat(newest().getSubmittedBy().getId()).isEqualTo(locked.getId());
		}

		@ParameterizedTest(name = "{0} = {1} ergibt 400")
		@CsvSource({
				"name,''",
				"name,A",
				"email,keine-adresse",
				"subject,ab",
				"message,'zu kurz'"
		})
		@DisplayName("Verletzte Feldregeln ergeben 400 VALIDATION_FAILED")
		void rejectsInvalidFields(String field, String value) throws Exception {
			mockMvc.perform(form(body(field, value)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(
							org.hamcrest.Matchers.containsString(field + ":")));
		}

		@Test
		@DisplayName("Eine unbekannte Kategorie ergibt 400 VALIDATION_FAILED")
		void rejectsUnknownCategory() throws Exception {
			mockMvc.perform(form(body("category", "TECHNIK")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}
	}

	// ==================================================================
	// GET /api/admin/support
	// ==================================================================

	@Nested
	@DisplayName("GET /api/admin/support")
	class ListRequests {

		@Test
		@DisplayName("Ohne Token 401, mit STUDENT 403 NO_PERMISSION")
		void requiresAdmin() throws Exception {
			mockMvc.perform(get(ADMIN_PATH))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(as(student, get(ADMIN_PATH)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Neueste zuerst, im Seitenformat aus §6.6")
		void newestFirst() throws Exception {
			SupportRequest first = store("Aelter", SupportRequestCategory.OTHER);
			SupportRequest second = store("Neuer", SupportRequestCategory.OTHER);
			List<String> expected = expectedOrder(first, second);

			mockMvc.perform(as(admin, get(ADMIN_PATH).param("size", "50")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[0].subject").value(expected.get(0)))
					.andExpect(jsonPath("$.content[1].subject").value(expected.get(1)))
					.andExpect(jsonPath("$.page").value(0))
					.andExpect(jsonPath("$.totalElements").value(2));
		}

		@Test
		@DisplayName("Filter status und category schraenken ein")
		void filters() throws Exception {
			store("Technik", SupportRequestCategory.TECHNICAL_ISSUE);
			SupportRequest abuse = store("Meldung", SupportRequestCategory.ABUSE_REPORT);

			mockMvc.perform(as(admin, get(ADMIN_PATH)
							.param("category", "ABUSE_REPORT")
							.param("size", "50")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[0].subject").value(abuse.getSubject()))
					.andExpect(jsonPath("$.content[1]").doesNotExist());

			mockMvc.perform(as(admin, get(ADMIN_PATH)
							.param("status", "RESOLVED")
							.param("size", "50")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content").isEmpty());
		}

		/**
		 * §6.6: Die Reihenfolge ist fest, ein mitgeschickter {@code sort} wird
		 * verworfen. Ohne diese Zusage koennte ein Client nach {@code name}
		 * sortieren und damit die zeitliche Naehe verdecken, an der eine Serie
		 * erkennbar ist.
		 */
		@Test
		@DisplayName("Ein mitgeschickter sort aendert die Reihenfolge nicht")
		void ignoresSortParameter() throws Exception {
			SupportRequest first = store("Aelter", SupportRequestCategory.OTHER);
			SupportRequest second = store("Neuer", SupportRequestCategory.OTHER);
			List<String> expected = expectedOrder(first, second);

			mockMvc.perform(as(admin, get(ADMIN_PATH)
							.param("sort", "subject,asc")
							.param("size", "50")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[0].subject").value(expected.get(0)))
					.andExpect(jsonPath("$.content[1].subject").value(expected.get(1)));
		}

		/** §3.20: die Adresse steht in der Antwort, das Konto nur als Kennung. */
		@Test
		@DisplayName("Die Antwort traegt alle Felder aus §3.20")
		void carriesContractFields() throws Exception {
			store("Vollstaendig", SupportRequestCategory.ACCOUNT_ACCESS);

			mockMvc.perform(as(admin, get(ADMIN_PATH).param("size", "50")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[0].id").exists())
					.andExpect(jsonPath("$.content[0].name").exists())
					.andExpect(jsonPath("$.content[0].email").exists())
					.andExpect(jsonPath("$.content[0].category").value("ACCOUNT_ACCESS"))
					.andExpect(jsonPath("$.content[0].subject").value("Vollstaendig"))
					.andExpect(jsonPath("$.content[0].message").exists())
					.andExpect(jsonPath("$.content[0].status").value("OPEN"))
					.andExpect(jsonPath("$.content[0].createdAt").exists())
					.andExpect(jsonPath("$.content[0].updatedAt").exists());
		}
	}

	// ==================================================================
	// PATCH /api/admin/support/{id}
	// ==================================================================

	@Nested
	@DisplayName("PATCH /api/admin/support/{id}")
	class UpdateStatus {

		@Test
		@DisplayName("Mit STUDENT 403 NO_PERMISSION")
		void requiresAdmin() throws Exception {
			SupportRequest request = store("Offen", SupportRequestCategory.OTHER);

			mockMvc.perform(as(student, statusPatch(request.getId(), "IN_PROGRESS")))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@ParameterizedTest(name = "{0} nach {1} ist erlaubt")
		@CsvSource({
				"OPEN,IN_PROGRESS",
				"OPEN,RESOLVED",
				"IN_PROGRESS,RESOLVED",
				"RESOLVED,OPEN"
		})
		@DisplayName("Die vier Uebergaenge aus §2.15 gehen durch")
		void allowsContractTransitions(SupportRequestStatus from, SupportRequestStatus to)
				throws Exception {

			SupportRequest request = store("Wechsel", SupportRequestCategory.OTHER);
			moveTo(request, from);

			mockMvc.perform(as(admin, statusPatch(request.getId(), to.name())))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.status").value(to.name()));

			assertThat(reload(request.getId()).getStatus()).isEqualTo(to);
		}

		@Test
		@DisplayName("RESOLVED nach IN_PROGRESS ergibt 409")
		void rejectsInvalidTransition() throws Exception {
			SupportRequest request = store("Erledigt", SupportRequestCategory.OTHER);
			moveTo(request, SupportRequestStatus.RESOLVED);

			mockMvc.perform(as(admin, statusPatch(request.getId(), "IN_PROGRESS")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode")
							.value("SUPPORT_STATUS_TRANSITION_INVALID"));

			assertThat(reload(request.getId()).getStatus())
					.isEqualTo(SupportRequestStatus.RESOLVED);
		}

		/**
		 * §2.15: auch der Wechsel auf den bereits stehenden Wert ist keiner. Ein
		 * stilles 200 verdeckte einen Fehler im aufrufenden Client.
		 */
		@Test
		@DisplayName("Derselbe Status noch einmal ergibt 409")
		void rejectsNoOpTransition() throws Exception {
			SupportRequest request = store("Offen", SupportRequestCategory.OTHER);

			mockMvc.perform(as(admin, statusPatch(request.getId(), "OPEN")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode")
							.value("SUPPORT_STATUS_TRANSITION_INVALID"));
		}

		@Test
		@DisplayName("Eine unbekannte Kennung ergibt 404 RESOURCE_NOT_FOUND")
		void rejectsUnknownId() throws Exception {
			mockMvc.perform(as(admin, statusPatch(UUID.randomUUID(), "IN_PROGRESS")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Fehlender Status ergibt 400 VALIDATION_FAILED")
		void rejectsMissingStatus() throws Exception {
			SupportRequest request = store("Offen", SupportRequestCategory.OTHER);

			mockMvc.perform(as(admin, patch(ADMIN_PATH + "/" + request.getId())
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}")))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}
	}

	// ==================================================================
	// DELETE /api/admin/support/{id}
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/admin/support/{id}")
	class Delete {

		@Test
		@DisplayName("Mit STUDENT 403 NO_PERMISSION, die Zeile bleibt")
		void requiresAdmin() throws Exception {
			SupportRequest request = store("Bleibt", SupportRequestCategory.OTHER);

			mockMvc.perform(as(student, delete(ADMIN_PATH + "/" + request.getId())))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			assertThat(requestRepository.findById(request.getId())).isPresent();
		}

		@Test
		@DisplayName("Mit ADMIN 204, die Zeile ist weg")
		void deletes() throws Exception {
			SupportRequest request = store("Weg", SupportRequestCategory.OTHER);

			mockMvc.perform(as(admin, delete(ADMIN_PATH + "/" + request.getId())))
					.andExpect(status().isNoContent());

			assertThat(requestRepository.findById(request.getId())).isEmpty();
		}

		@Test
		@DisplayName("Eine unbekannte Kennung ergibt 404 RESOURCE_NOT_FOUND")
		void rejectsUnknownId() throws Exception {
			mockMvc.perform(as(admin, delete(ADMIN_PATH + "/" + UUID.randomUUID())))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}
	}

	// ==================================================================
	// Helfer
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	/** Ein vollstaendiger, gueltiger Formularkoerper. */
	private Map<String, Object> valid() {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("name", "Lena Brandt");
		body.put("email", formEmail);
		body.put("category", "TECHNICAL_ISSUE");
		body.put("subject", "Anmeldung schlaegt fehl");
		body.put("message", "Seit gestern komme ich mit meiner HSB-Kennung nicht mehr hinein.");
		body.put("website", "");
		return body;
	}

	/** Derselbe Koerper mit genau einem geaenderten Feld. */
	private Map<String, Object> body(String field, Object value) {
		Map<String, Object> body = valid();
		body.put(field, value);
		return body;
	}

	/**
	 * Ein POST auf das Formular, mit der Client-IP dieses Tests. Ohne sie zaehlte
	 * jeder Test auf denselben Schluessel, siehe den Klassenkommentar.
	 */
	private MockHttpServletRequestBuilder form(Map<String, Object> body) throws Exception {
		return post(PATH)
				.with(fromTestIp())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body));
	}

	private RequestPostProcessor fromTestIp() {
		return request -> {
			request.setRemoteAddr(clientIp);
			return request;
		};
	}

	private MockHttpServletRequestBuilder statusPatch(UUID id, String status) throws Exception {
		return patch(ADMIN_PATH + "/" + id)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("status", status)));
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/** Legt eine Anfrage unmittelbar an, ohne den Endpoint und seine Bremse. */
	private SupportRequest store(String subject, SupportRequestCategory category) {
		return requestRepository.saveAndFlush(SupportRequest.of(
				"Mert Yildiz",
				"mert.yildiz@example.org",
				category,
				subject,
				"Beim Einreichen meines Projekts passiert nichts.",
				null));
	}

	/**
	 * Bringt eine frisch angelegte Anfrage auf den gewuenschten Stand.
	 *
	 * <p>Die Behauptung im {@code assert} ist der Grund, warum der Helfer so kurz
	 * sein darf: von {@code OPEN} aus ist nach §2.15 jeder andere Stand in einem
	 * Schritt erreichbar. Kaeme ein vierter Status dazu, der das nicht ist,
	 * schluege der Aufbau fehl statt still einen unmoeglichen Zustand zu bauen.
	 */
	private void moveTo(SupportRequest request, SupportRequestStatus target) {
		if (request.getStatus() == target) {
			return;
		}
		assertThat(request.getStatus().mayTransitionTo(target)).isTrue();
		request.setStatus(target);
		requestRepository.saveAndFlush(request);
	}

	/**
	 * Die Betreffzeilen in der Reihenfolge, die §6.6 fuer diesen Endpoint
	 * festlegt: {@code createdAt} absteigend, {@code id} aufsteigend.
	 *
	 * <p>Bewusst berechnet und nicht als Einfuegereihenfolge angenommen: zwei
	 * Zeilen koennen in dieselbe Mikrosekunde fallen, und dann entscheidet der
	 * Gleichstandsbrecher. Genau er ist hier mitgeprueft.
	 */
	private List<String> expectedOrder(SupportRequest... requests) {
		return java.util.Arrays.stream(requests)
				.sorted(java.util.Comparator
						.comparing(SupportRequest::getCreatedAt).reversed()
						.thenComparing(SupportRequest::getId))
				.map(SupportRequest::getSubject)
				.toList();
	}

	private SupportRequest reload(UUID id) {
		return requestRepository.findById(id).orElseThrow();
	}

	/** Die zuletzt eingegangene Anfrage. */
	private SupportRequest newest() {
		List<SupportRequest> all = requestRepository.findAll();
		return all.stream()
				.max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
				.orElseThrow();
	}

	/**
	 * Der Vollstaendigkeit halber: das Record wird hier nur benutzt, damit ein
	 * Feldumbenennen am DTO diesen Test bricht statt still an ihm vorbeizugehen.
	 */
	@Test
	@DisplayName("Der Anfragekoerper traegt genau die sechs Felder aus §6.1")
	void requestRecordShape() {
		assertThat(SupportRequestCreateRequest.class.getRecordComponents())
				.extracting(java.lang.reflect.RecordComponent::getName)
				.containsExactly("name", "email", "category", "subject", "message", "website");
	}
}
