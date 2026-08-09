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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
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
 * Die Selbstbedienung bei vergessenem Passwort aus API-Contract §6.1 gegen die
 * echte Datenbank (KAN-43), also die Zusagen aus der Definition of Done:
 * <ol>
 *   <li><strong>Bekannte und unbekannte Adressen sind ununterscheidbar</strong>,
 *       bei {@code forgot-password} (immer 204) wie bei {@code reset-password}
 *       (immer dieselbe 400-Antwort).</li>
 *   <li><strong>Ein Code taugt nur fuer seinen Zweck</strong>: ein
 *       {@code PRIVATE_EMAIL}-Code setzt kein Passwort zurueck und ein
 *       {@code PASSWORD_RESET}-Code bestaetigt keine Adresse.</li>
 *   <li><strong>Der Code verlaesst den Server nur per Mail</strong> und steht
 *       in keiner Antwort.</li>
 *   <li><strong>Die Endpoints bleiben bei gesetztem
 *       {@code passwordChangeRequired} erreichbar</strong> (§6.7), sonst
 *       sperrte sich ein Konto mit vergessenem Initialpasswort selbst aus.</li>
 * </ol>
 *
 * <p>Wie in {@code RegistrationIntegrationTest} benutzt jeder Test eine eigene
 * Absender-Adresse, weil der Zaehler aus {@link VerificationAttemptService} ein
 * Singleton im Testkontext ist und auch je Client-IP zaehlt.
 * {@code @Transactional} rollt am Ende alles zurueck.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PasswordResetIntegrationTest {

	private static final String FORGOT = "/api/auth/forgot-password";

	private static final String RESET = "/api/auth/reset-password";

	private static final String VERIFY = "/api/auth/verify";

	private static final String LOGIN = "/api/auth/login";

	private static final String OLD_PASSWORD = "altes-korrekt-pferd";

	private static final String NEW_PASSWORD = "neues-korrekt-pferd";

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
	private VerificationCodeService codeService;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * Der einzige Weg an den Klartext eines Codes: er verlaesst den Server
	 * ausschliesslich ueber diese Schnittstelle, und genau das haelt
	 * {@link ForgotPassword#codeGoesOutByMailAndNeverIntoAResponse} fest.
	 */
	@MockitoBean
	private MailTemplateService mailTemplateService;

	/** Absender-Adresse dieses Tests, siehe Klassenkommentar. */
	private String clientIp;

	private User user;

	@BeforeEach
	void freshIdentities() {
		String unique = UUID.randomUUID().toString();
		clientIp = "203.0.113." + Math.abs(unique.hashCode() % 200) + "-" + unique;
		user = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(OLD_PASSWORD)));
	}

	// ==================================================================
	// POST /api/auth/forgot-password
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/forgot-password")
	class ForgotPassword {

		@Test
		@DisplayName("Stellt einen PASSWORD_RESET-Code aus und schickt ihn an die private Adresse")
		void issuesCodeAndSendsMail() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());

			verify(mailTemplateService).sendPasswordReset(eq(user.getEmail()), anyString(), any());
			assertThat(openCodes(user)).hasSize(1);
		}

		@Test
		@DisplayName("Ein zweites Anfordern entwertet den ersten Code")
		void secondRequestInvalidatesTheFirstCode() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());
			String first = capturedResetCode();

			forgot(user.getEmail()).andExpect(status().isNoContent());
			String second = capturedResetCode();

			// Blieben beide gueltig, haette das erneute Anfordern die Zahl der
			// Geheimnisse erhoeht statt das alte zu ersetzen (§6.1).
			assertThat(openCodes(user)).hasSize(1);
			reset(user.getEmail(), first, NEW_PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));
			reset(user.getEmail(), second, NEW_PASSWORD).andExpect(status().isOk());
		}

		@Test
		@DisplayName("Unbekannte und bekannte Adresse ergeben dieselbe Antwort: 204 ohne Inhalt")
		void unknownAddressIsIndistinguishable() throws Exception {
			String known = bodyOf(forgot(user.getEmail()).andExpect(status().isNoContent()));
			String unknown = bodyOf(forgot("gibt-es-nicht-" + UUID.randomUUID() + "@example.org")
					.andExpect(status().isNoContent()));

			assertThat(unknown).isEqualTo(known).isEmpty();
			// Nur fuer die bekannte Adresse ging tatsaechlich eine Mail raus.
			verify(mailTemplateService).sendPasswordReset(anyString(), anyString(), any());
		}

		@Test
		@DisplayName("Ein deaktiviertes Konto verhaelt sich wie eine unbekannte Adresse")
		void deactivatedAccountGetsNoCode() throws Exception {
			user.setStatus(UserStatus.DEACTIVATED);
			userRepository.saveAndFlush(user);

			forgot(user.getEmail()).andExpect(status().isNoContent());

			// Ein gesperrtes Konto hat keinen Selbstbedienungsweg zurueck; das
			// entscheidet die Administration (§2.9, Klaerungsrunde KAN-43).
			verify(mailTemplateService, never()).sendPasswordReset(anyString(), anyString(), any());
			assertThat(openCodes(user)).isEmpty();
		}

		@Test
		@DisplayName("Ein Konto mit offener Registrierung bekommt ebenfalls keinen Code")
		void pendingAccountGetsNoCode() throws Exception {
			user.setStatus(UserStatus.REGISTRATION_PENDING);
			userRepository.saveAndFlush(user);

			forgot(user.getEmail()).andExpect(status().isNoContent());

			verify(mailTemplateService, never()).sendPasswordReset(anyString(), anyString(), any());
			assertThat(openCodes(user)).isEmpty();
		}

		@Test
		@DisplayName("Nach fuenf Anforderungen antwortet der Endpoint mit 429")
		void forgotIsRateLimited() throws Exception {
			for (int i = 0; i < 5; i++) {
				forgot(user.getEmail()).andExpect(status().isNoContent());
			}

			// Gezaehlt wird jeder Aufruf, nicht nur ein fehlgeschlagener: sonst
			// waere der Endpoint ein Versandgenerator fuer fremde Postfaecher (§6.5).
			forgot(user.getEmail())
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"));
		}

		@Test
		@DisplayName("Die Sperre der Ruecksetzung sperrt nicht die Anmeldung")
		void forgotLimitLeavesLoginAlone() throws Exception {
			for (int i = 0; i < 6; i++) {
				forgot(user.getEmail());
			}

			// Zwei getrennte Zaehler (§6.5): eine angeforderte Ruecksetzung darf
			// niemanden aus der Anmeldung aussperren.
			login(user.getEmail(), OLD_PASSWORD).andExpect(status().isOk());
		}

		@Test
		@DisplayName("Der Code geht ueber MailSender raus und steht in keiner Antwort")
		void codeGoesOutByMailAndNeverIntoAResponse() throws Exception {
			String body = bodyOf(forgot(user.getEmail()).andExpect(status().isNoContent()));
			String code = capturedResetCode();

			assertThat(code).matches("\\d{6}");
			assertThat(body).isEmpty();
			// In der Datenbank liegt nur der Hash (§3.16).
			assertThat(openCodes(user).getFirst().getCodeHash()).doesNotContain(code);
		}

		@Test
		@DisplayName("Bei gesetztem passwordChangeRequired bleibt der Endpoint erreichbar (§6.7)")
		void endpointIsExemptFromThePasswordChangeGate() throws Exception {
			user.setPasswordChangeRequired(true);
			userRepository.saveAndFlush(user);

			// Mit Token: das Gate beantwortet sonst jeden Request mit 403. Ohne
			// die Ausnahme kaeme ein Konto mit vergessenem Initialpasswort hier
			// nie an.
			forgot(user.getEmail(), as(user)).andExpect(status().isNoContent());
		}
	}

	// ==================================================================
	// POST /api/auth/reset-password
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/reset-password")
	class ResetPassword {

		@Test
		@DisplayName("Setzt das neue Passwort: altes weg, neues gilt, Flag ist false")
		void happyPathSetsTheNewPassword() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());

			reset(user.getEmail(), capturedResetCode(), NEW_PASSWORD)
					.andExpect(status().isOk())
					// Wie bei PUT /auth/password: 200 ohne Body (KAN-28).
					.andExpect(content().string(""));

			User reloaded = userRepository.findById(user.getId()).orElseThrow();
			assertThat(reloaded.isPasswordChangeRequired()).isFalse();
			assertThat(passwordEncoder.matches(NEW_PASSWORD, reloaded.getPasswordHash())).isTrue();
			assertThat(passwordEncoder.matches(OLD_PASSWORD, reloaded.getPasswordHash())).isFalse();

			login(user.getEmail(), NEW_PASSWORD).andExpect(status().isOk());
			login(user.getEmail(), OLD_PASSWORD).andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("Unbekannte Adresse und falscher Code sind nicht zu unterscheiden")
		void unknownAddressAnswersLikeAWrongCode() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());

			String known = bodyOf(reset(user.getEmail(), otherThan(capturedResetCode()), NEW_PASSWORD)
					.andExpect(status().isBadRequest()));
			String unknown = bodyOf(
					reset("gibt-es-nicht-" + UUID.randomUUID() + "@example.org", "123456", NEW_PASSWORD)
							.andExpect(status().isBadRequest()));

			// Verglichen wird ohne den Zeitstempel: er unterscheidet sich
			// zwangslaeufig und sagt nichts ueber das Konto aus.
			assertThat(withoutTimestamp(unknown)).isEqualTo(withoutTimestamp(known));
		}

		@Test
		@DisplayName("Ein verbrauchter Code ergibt 400 VERIFICATION_CODE_INVALID")
		void consumedCodeIsRejected() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());
			String code = capturedResetCode();

			reset(user.getEmail(), code, NEW_PASSWORD).andExpect(status().isOk());

			reset(user.getEmail(), code, "drittes-korrekt-pferd")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));

			// Das Passwort aus dem ersten, gueltigen Aufruf bleibt bestehen.
			login(user.getEmail(), NEW_PASSWORD).andExpect(status().isOk());
		}

		@Test
		@DisplayName("Ein PRIVATE_EMAIL-Code setzt kein Passwort zurueck")
		void verificationCodeCannotResetThePassword() throws Exception {
			// Direkt ueber den Service ausgestellt: der Registrierungsweg stuende
			// diesem laengst aktiven Konto nicht mehr offen.
			String verificationCode = codeService
					.issue(user, VerificationPurpose.PRIVATE_EMAIL).plainCode();

			// Sonst genuegte ein abgefangener Verifizierungscode, um ein fremdes
			// Passwort zu setzen (§2.11: gleicher Mechanismus, getrennte Zwecke).
			reset(user.getEmail(), verificationCode, NEW_PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));

			assertThat(passwordEncoder.matches(OLD_PASSWORD,
					userRepository.findById(user.getId()).orElseThrow().getPasswordHash())).isTrue();
		}

		@Test
		@DisplayName("Ein PASSWORD_RESET-Code bestaetigt umgekehrt keine Adresse")
		void resetCodeCannotVerifyAnAddress() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());

			// Der Zweck selbst wird am Verifizierungs-Endpoint abgewiesen (§6.1);
			// der Ruecksetzcode laeuft dort also nicht einmal bis zur Pruefung.
			Map<String, Object> body = new LinkedHashMap<>();
			body.put("email", user.getEmail());
			body.put("purpose", VerificationPurpose.PASSWORD_RESET.name());
			body.put("code", capturedResetCode());

			perform(post(VERIFY), body)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ein zu kurzes neues Passwort ergibt 400 VALIDATION_FAILED")
		void tooShortPasswordIsRejected() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());
			String code = capturedResetCode();

			reset(user.getEmail(), code, "kurz123")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message")
							.value(org.hamcrest.Matchers.containsString("newPassword")));

			// Die Bean-Validation greift vor der Code-Pruefung: der Code ist noch
			// nicht verbraucht und funktioniert mit gueltigem Passwort weiterhin.
			reset(user.getEmail(), code, NEW_PASSWORD).andExpect(status().isOk());
		}

		@Test
		@DisplayName("Ein zwischenzeitlich deaktiviertes Konto kann seinen Code nicht mehr einloesen")
		void deactivationInvalidatesTheOpenCode() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());
			String code = capturedResetCode();

			user.setStatus(UserStatus.DEACTIVATED);
			userRepository.saveAndFlush(user);

			// Die Deaktivierung wirkt sofort (§6.5), nicht erst mit dem Ablauf
			// des Codes; die Antwort bleibt die generische.
			reset(user.getEmail(), code, NEW_PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));
		}

		@Test
		@DisplayName("Nach fuenf Fehlversuchen antwortet der Endpoint mit 429")
		void resetIsRateLimited() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());
			String wrong = otherThan(capturedResetCode());

			for (int i = 0; i < 4; i++) {
				reset(user.getEmail(), wrong, NEW_PASSWORD).andExpect(status().isBadRequest());
			}

			// Ohne diese Bremse waere ein gueltiger Ruecksetzcode in einer Million
			// Versuchen durchprobierbar und der Endpoint eine Kontouebernahme
			// (§3.16; nachgetragen in §6.1 und §6.5 mit Contract v34).
			reset(user.getEmail(), wrong, NEW_PASSWORD)
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"));
		}

		@Test
		@DisplayName("Ein Erfolg setzt den Zaehler zurueck")
		void successResetsTheAttemptCounter() throws Exception {
			forgot(user.getEmail()).andExpect(status().isNoContent());
			String code = capturedResetCode();
			String wrong = otherThan(code);

			for (int i = 0; i < 3; i++) {
				reset(user.getEmail(), wrong, NEW_PASSWORD).andExpect(status().isBadRequest());
			}

			reset(user.getEmail(), code, NEW_PASSWORD).andExpect(status().isOk());

			// Wer den Code nach ein paar Tippfehlern richtig eingegeben hat, hat
			// den Postfachzugriff bewiesen und faengt wieder bei null an.
			forgot(user.getEmail()).andExpect(status().isNoContent());
		}

		@Test
		@DisplayName("Loest die erzwungene Passwortaenderung auf: Gate offen, Flag false (§6.7)")
		void resetLiftsThePasswordChangeGate() throws Exception {
			user.setPasswordChangeRequired(true);
			userRepository.saveAndFlush(user);

			// Vor der Ruecksetzung: das Gate blockiert normale Endpoints.
			mockMvc.perform(get("/api/projects").with(fromThisTest())
							.header(HttpHeaders.AUTHORIZATION, bearer(user)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("PASSWORD_CHANGE_REQUIRED"));

			// Die Ruecksetzung selbst bleibt erreichbar, auch mit Token (§6.7).
			forgot(user.getEmail(), as(user)).andExpect(status().isNoContent());
			reset(user.getEmail(), capturedResetCode(), NEW_PASSWORD, as(user))
					.andExpect(status().isOk());

			mockMvc.perform(get("/api/projects").with(fromThisTest())
							.header(HttpHeaders.AUTHORIZATION, bearer(user)))
					.andExpect(status().isOk());
			assertThat(userRepository.findById(user.getId()).orElseThrow()
					.isPasswordChangeRequired()).isFalse();
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private ResultActions forgot(String address) throws Exception {
		return forgot(address, request -> request);
	}

	private ResultActions forgot(String address, RequestPostProcessor authentication) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		return perform(post(FORGOT).with(authentication), body);
	}

	private ResultActions reset(String address, String code, String newPassword) throws Exception {
		return reset(address, code, newPassword, request -> request);
	}

	private ResultActions reset(String address, String code, String newPassword,
			RequestPostProcessor authentication) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("code", code);
		body.put("newPassword", newPassword);
		return perform(post(RESET).with(authentication), body);
	}

	private ResultActions login(String address, String password) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("password", password);
		return perform(post(LOGIN), body);
	}

	private ResultActions perform(MockHttpServletRequestBuilder request, Object body)
			throws Exception {
		return mockMvc.perform(request
				.with(fromThisTest())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

	/** Siehe Klassenkommentar: eine eigene Absender-Adresse je Testmethode. */
	private RequestPostProcessor fromThisTest() {
		return request -> {
			request.setRemoteAddr(clientIp);
			return request;
		};
	}

	private RequestPostProcessor as(User user) {
		return request -> {
			request.addHeader(HttpHeaders.AUTHORIZATION, bearer(user));
			return request;
		};
	}

	private String bearer(User user) {
		return "Bearer " + jwtService.createToken(AuthenticatedUser.from(user));
	}

	/** Der zuletzt verschickte Ruecksetzcode. */
	private String capturedResetCode() {
		ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
		verify(mailTemplateService, atLeastOnce())
				.sendPasswordReset(anyString(), captor.capture(), any());
		return captor.getValue();
	}

	/** Ein anderer sechsstelliger Code als der uebergebene. */
	private static String otherThan(String code) {
		return code.equals("000000") ? "111111" : "000000";
	}

	private List<VerificationCode> openCodes(User user) {
		return codeRepository.findByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
				user.getId(), VerificationPurpose.PASSWORD_RESET);
	}

	private static String bodyOf(ResultActions actions) throws Exception {
		return actions.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	/**
	 * Schneidet den Zeitstempel aus dem Fehler-Envelope. Er unterscheidet sich
	 * zwischen zwei Aufrufen zwangslaeufig und traegt keine Aussage ueber das
	 * Konto.
	 */
	private static String withoutTimestamp(String body) {
		return body.replaceAll("\"timestamp\":\"[^\"]*\"", "\"timestamp\":\"...\"");
	}
}
