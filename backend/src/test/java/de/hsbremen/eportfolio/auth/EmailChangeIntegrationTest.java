package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.dto.ProfileUpdateRequest;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der selbstaendige Wechsel der privaten E-Mail-Adresse aus API-Contract §3.1
 * und §6.1 gegen die echte Datenbank (KAN-60).
 *
 * <p>Im Mittelpunkt stehen die Zusagen, an denen Konto, Codes, Bremse und
 * Filterkette zusammenhaengen:
 * <ol>
 *   <li><strong>Ohne aktuelles Passwort kein Wechsel</strong>, und dann auch
 *       keine Namensaenderung aus demselben Request: alles oder nichts.</li>
 *   <li><strong>Bis zum eingeloesten Code aendert sich die Login-Kennung
 *       nicht</strong>; die Wunschadresse steht nur in {@code pendingEmail}.</li>
 *   <li><strong>Die Eindeutigkeit wird zweimal geprueft</strong>, beim
 *       Anstossen und beim Bestaetigen (§6.1).</li>
 *   <li><strong>Jeder Wechselversuch zaehlt auf die Bremse</strong>, sonst
 *       waere der authentifizierte Endpoint ein Versandgenerator (§6.5).</li>
 * </ol>
 *
 * <p>Wie im {@link RegistrationIntegrationTest} benutzt jede Testmethode eine
 * eigene Absender-Adresse, weil der Zaehler des
 * {@link VerificationAttemptService} ein Singleton im Testkontext ist; und wie
 * dort ist der gemockte {@link MailTemplateService} der einzige Weg an den
 * Klartext eines Codes. {@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmailChangeIntegrationTest {

	private static final String ME_PATH = "/api/auth/me";

	private static final String VERIFY = "/api/auth/verify";

	private static final String RESEND = "/api/auth/verify/resend";

	private static final String LOGIN = "/api/auth/login";

	private static final String PASSWORD = "korrekt-pferd-batterie";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private VerificationCodeRepository codeRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@MockitoBean
	private MailTemplateService mailTemplateService;

	private String clientIp;

	private String wishAddress;

	@BeforeEach
	void freshIdentities() {
		String unique = UUID.randomUUID().toString();
		clientIp = "198.51.100." + Math.abs(unique.hashCode() % 200) + "-" + unique;
		wishAddress = "wunsch-" + unique + "@example.org";
	}

	// ==================================================================
	// PUT /api/auth/me mit Feld email
	// ==================================================================

	@Nested
	@DisplayName("PUT /api/auth/me mit Feld email")
	class RequestChange {

		@Test
		@DisplayName("Happy Path: pendingEmail gesetzt, Login-Kennung unveraendert, Code an die neue Adresse")
		void storesWishAndSendsCode() throws Exception {
			User user = activeUser();
			String emailBefore = user.getEmail();

			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.email").value(emailBefore))
					.andExpect(jsonPath("$.pendingEmail").value(wishAddress));

			User reloaded = requireUser(emailBefore);
			assertThat(reloaded.getPendingEmail()).isEqualTo(wishAddress);
			assertThat(reloaded.getEmail()).isEqualTo(emailBefore);
			assertThat(openCodes(reloaded)).hasSize(1);

			verify(mailTemplateService).sendEmailChangeVerification(eq(wishAddress), anyString(), any());

			// Der laufende Wechsel ist auch fuer GET /auth/me sichtbar, damit die
			// Oberflaeche "Bestaetigung ausstehend" anzeigen kann.
			mockMvc.perform(as(user, get(ME_PATH)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pendingEmail").value(wishAddress));
		}

		@Test
		@DisplayName("Ohne aktuelles Passwort: 401 LOGIN_FAILED, auch der Name bleibt unveraendert")
		void requiresThePassword() throws Exception {
			User user = activeUser();
			String firstNameBefore = user.getFirstName();

			putProfile(user, "Neuer", "Name", wishAddress, null)
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));

			// Alles oder nichts: das Formular hat einen Speichern-Knopf, und ein
			// halb uebernommener Request waere nicht aufloesbar.
			User reloaded = requireUser(user.getEmail());
			assertThat(reloaded.getPendingEmail()).isNull();
			assertThat(reloaded.getFirstName()).isEqualTo(firstNameBefore);
			verify(mailTemplateService, never()).sendEmailChangeVerification(anyString(), anyString(), any());
		}

		@Test
		@DisplayName("Falsches Passwort: 401 LOGIN_FAILED, kein Versand")
		void rejectsAWrongPassword() throws Exception {
			User user = activeUser();

			putProfile(user, "Erika", "Musterfrau", wishAddress, "voellig-falsch")
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));

			assertThat(requireUser(user.getEmail()).getPendingEmail()).isNull();
			verify(mailTemplateService, never()).sendEmailChangeVerification(anyString(), anyString(), any());
		}

		@Test
		@DisplayName("Vergebene Adresse (email oder hsbEmail eines Kontos): 409 RESOURCE_IN_USE")
		void rejectsATakenAddress() throws Exception {
			User user = activeUser();
			User other = activeUser();

			putProfile(user, "Erika", "Musterfrau", other.getEmail(), PASSWORD)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			// Auch die eigene Hochschuladresse ist tabu: die beiden Adressen
			// eines Kontos muessen getrennt bleiben (§3.1.1).
			putProfile(user, "Erika", "Musterfrau", user.getHsbEmail(), PASSWORD)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			assertThat(requireUser(user.getEmail()).getPendingEmail()).isNull();
		}

		@Test
		@DisplayName("Keine gueltige Adresse: 400 VALIDATION_FAILED")
		void rejectsAMalformedAddress() throws Exception {
			User user = activeUser();

			putProfile(user, "Erika", "Musterfrau", "kein-at-zeichen", PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Die aktuelle Adresse bricht einen laufenden Wechsel ab und entwertet den Code")
		void currentAddressCancelsTheChange() throws Exception {
			User user = activeUser();
			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD).andExpect(status().isOk());
			String code = capturedChangeCode();

			// Der Abbruch braucht kein Passwort: er stellt nur den Zustand vor
			// dem Wechsel wieder her.
			putProfile(user, "Erika", "Musterfrau", user.getEmail(), null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pendingEmail").doesNotExist());

			assertThat(requireUser(user.getEmail()).getPendingEmail()).isNull();
			assertThat(openCodes(requireUser(user.getEmail()))).isEmpty();

			// Der Code aus dem Postfach darf danach nichts mehr bestaetigen.
			submitCode(wishAddress, code)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));
		}

		@Test
		@DisplayName("Ohne Feld email bleibt ein laufender Wechsel unberuehrt")
		void nameOnlyUpdateKeepsThePendingChange() throws Exception {
			User user = activeUser();
			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD).andExpect(status().isOk());

			putProfile(user, "Nur", "Umbenannt", null, null)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pendingEmail").value(wishAddress));

			assertThat(requireUser(user.getEmail()).getPendingEmail()).isEqualTo(wishAddress);
		}

		@Test
		@DisplayName("Jeder Wechselversuch zaehlt: der sechste ergibt 429")
		void rateLimitsRepeatedAttempts() throws Exception {
			User user = activeUser();

			// max-failed-attempts: 5 (application.yml). Gezaehlt wird jeder
			// Versand, nicht nur ein fehlgeschlagener, sonst waere der Endpoint
			// ein Versandgenerator fuer fremde Postfaecher (§6.5).
			for (int i = 0; i < 5; i++) {
				putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD)
						.andExpect(status().isOk());
			}

			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD)
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"));
		}

		@Test
		@DisplayName("Auch Versuche mit falschem Passwort zaehlen auf die Bremse")
		void wrongPasswordAttemptsCountTowardsTheLimit() throws Exception {
			User user = activeUser();

			// Das Passwort ist die Rueckversicherung gegen ein gestohlenes
			// Token (§3.1). Zaehlte nur der erfolgreiche Versand, liesse es
			// sich an diesem Endpoint unbegrenzt durchprobieren; §6.1 verlangt
			// deshalb, dass jeder Wechselversuch zaehlt.
			for (int i = 0; i < 5; i++) {
				putProfile(user, "Erika", "Musterfrau", wishAddress, "voellig-falsch")
						.andExpect(status().isUnauthorized());
			}

			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD)
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"));

			// Kein einziger Versand: die fuenf 401er haben nichts verschickt,
			// und der sechste Versuch scheiterte an der Sperre.
			verify(mailTemplateService, never()).sendEmailChangeVerification(anyString(), anyString(), any());
			assertThat(requireUser(user.getEmail()).getPendingEmail()).isNull();
		}
	}

	// ==================================================================
	// POST /api/auth/verify mit purpose = EMAIL_CHANGE
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/verify mit purpose = EMAIL_CHANGE")
	class Confirm {

		@Test
		@DisplayName("Ende-zu-Ende: Code einloesen macht die neue Adresse zur Login-Kennung")
		void switchesTheLoginAddress() throws Exception {
			User user = activeUser();
			String oldAddress = user.getEmail();
			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD).andExpect(status().isOk());

			submitCode(wishAddress, capturedChangeCode())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.emailVerified").value(true))
					.andExpect(jsonPath("$.status").value("ACTIVE"));

			User reloaded = requireUser(wishAddress);
			assertThat(reloaded.getId()).isEqualTo(user.getId());
			assertThat(reloaded.getPendingEmail()).isNull();
			assertThat(reloaded.isEmailVerified()).isTrue();

			// Die Anmeldung folgt der Kennung: neu ja, alt nicht mehr.
			login(wishAddress, PASSWORD).andExpect(status().isOk());
			login(oldAddress, PASSWORD)
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));
		}

		@Test
		@DisplayName("Falscher Code: 400 VERIFICATION_CODE_INVALID, Kennung unveraendert")
		void rejectsAWrongCode() throws Exception {
			User user = activeUser();
			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD).andExpect(status().isOk());

			submitCode(wishAddress, otherThan(capturedChangeCode()))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));

			User reloaded = requireUser(user.getEmail());
			assertThat(reloaded.getPendingEmail()).isEqualTo(wishAddress);
		}

		@Test
		@DisplayName("Adresse ohne laufenden Wechsel: dieselbe Antwort wie ein falscher Code")
		void unknownAddressIsIndistinguishable() throws Exception {
			submitCode("niemand-" + UUID.randomUUID() + "@example.org", "123456")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));
		}

		@Test
		@DisplayName("Adresse inzwischen vergeben: 409 RESOURCE_IN_USE, Kennung unveraendert")
		void reChecksUniquenessOnConfirm() throws Exception {
			User user = activeUser();
			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD).andExpect(status().isOk());
			String code = capturedChangeCode();

			// Zwischen Anstossen und Bestaetigen koennen Tage liegen; hier holt
			// sich ein anderes Konto die Adresse in der Zwischenzeit.
			User interloper = TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(PASSWORD));
			interloper.setEmail(wishAddress);
			userRepository.saveAndFlush(interloper);

			submitCode(wishAddress, code)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"));

			User reloaded = userRepository.findById(user.getId()).orElseThrow();
			assertThat(reloaded.getEmail()).isNotEqualTo(wishAddress);
		}
	}

	// ==================================================================
	// POST /api/auth/verify/resend mit purpose = EMAIL_CHANGE
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/verify/resend mit purpose = EMAIL_CHANGE")
	class Resend {

		@Test
		@DisplayName("204, genau ein offener Code, und der juengste zaehlt")
		void reissuesTheCode() throws Exception {
			User user = activeUser();
			putProfile(user, "Erika", "Musterfrau", wishAddress, PASSWORD).andExpect(status().isOk());

			resend(wishAddress).andExpect(status().isNoContent());

			// Der vorherige Code ist entwertet, nicht ergaenzt: es gibt zu jedem
			// Zeitpunkt hoechstens ein gueltiges Geheimnis (§3.16).
			assertThat(openCodes(requireUser(user.getEmail()))).hasSize(1);

			submitCode(wishAddress, capturedChangeCode()).andExpect(status().isOk());
			assertThat(requireUser(wishAddress).getPendingEmail()).isNull();
		}

		@Test
		@DisplayName("Adresse ohne laufenden Wechsel: 204 ohne Versand, nicht unterscheidbar")
		void unknownAddressStaysSilent() throws Exception {
			resend("niemand-" + UUID.randomUUID() + "@example.org").andExpect(status().isNoContent());

			verify(mailTemplateService, never()).sendEmailChangeVerification(anyString(), anyString(), any());
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User activeUser() {
		return userRepository.save(
				TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(PASSWORD)));
	}

	private ResultActions putProfile(User user, String firstName, String lastName,
			String email, String currentPassword) throws Exception {
		return mockMvc.perform(as(user, put(ME_PATH))
				.with(fromThisTest())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(
						new ProfileUpdateRequest(firstName, lastName, email, currentPassword))));
	}

	private ResultActions submitCode(String address, String code) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("purpose", VerificationPurpose.EMAIL_CHANGE.name());
		body.put("code", code);
		return perform(VERIFY, body);
	}

	private ResultActions resend(String address) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("purpose", VerificationPurpose.EMAIL_CHANGE.name());
		return perform(RESEND, body);
	}

	private ResultActions login(String address, String password) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("password", password);
		return perform(LOGIN, body);
	}

	private ResultActions perform(String path, Object body) throws Exception {
		return mockMvc.perform(post(path)
				.with(fromThisTest())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

	private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/** Eigene Absender-Adresse je Testmethode, siehe Klassenkommentar. */
	private RequestPostProcessor fromThisTest() {
		return request -> {
			request.setRemoteAddr(clientIp);
			return request;
		};
	}

	/** Der zuletzt verschickte Wechselcode; der Mock ist der einzige Weg daran. */
	private String capturedChangeCode() {
		ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
		verify(mailTemplateService, atLeastOnce())
				.sendEmailChangeVerification(anyString(), captor.capture(), any());
		return captor.getValue();
	}

	/** Ein anderer sechsstelliger Code als der uebergebene. */
	private static String otherThan(String code) {
		return code.equals("000000") ? "111111" : "000000";
	}

	private User requireUser(String address) {
		return userRepository.findByEmail(address).orElseThrow(
				() -> new AssertionError("Konto zu " + address + " fehlt in der Datenbank."));
	}

	private List<VerificationCode> openCodes(User user) {
		return codeRepository.findByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
				user.getId(), VerificationPurpose.EMAIL_CHANGE);
	}
}
