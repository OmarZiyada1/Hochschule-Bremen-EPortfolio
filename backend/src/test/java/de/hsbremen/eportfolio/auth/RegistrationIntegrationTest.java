package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der vollstaendige Registrierungsflow aus API-Contract §3.1.1 gegen die echte
 * Datenbank (KAN-26).
 *
 * <p>Im Mittelpunkt stehen vier Zusagen, die sich nur hier pruefen lassen, weil
 * an ihnen Konto, Portfolio, Codes und Filterkette zusammenhaengen:
 * <ol>
 *   <li><strong>Die Rolle folgt der Domain</strong> und nicht der Auswahl im
 *       Formular. Waere das anders, koennte sich jede studentische Person durch
 *       Umsetzen eines Feldes Redaktionsrechte verschaffen.</li>
 *   <li><strong>Verglichen wird exakt</strong>: {@code boesehs-bremen.de} ist
 *       keine Hochschuladresse.</li>
 *   <li><strong>Der Code steht nur als Hash in der Datenbank</strong> (§3.16).</li>
 *   <li><strong>Bekannte und unbekannte Adressen sind ununterscheidbar</strong>
 *       (§6.1), sonst waeren die Endpoints ein Verzeichnis registrierter
 *       Adressen.</li>
 * </ol>
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck, die
 * Entwicklungsdatenbank bleibt unveraendert.
 *
 * <p><strong>Warum jeder Test eine eigene Absender-Adresse benutzt:</strong> der
 * Zaehler aus {@link VerificationAttemptService} ist ein Singleton im
 * Testkontext und zaehlt auch je Client-IP. Ohne eigene Adresse je Test
 * summierten sich die Aufrufe aller Methoden auf denselben Zaehler, und die
 * Reihenfolge der Tests waere ploetzlich relevant.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RegistrationIntegrationTest {

	private static final String REGISTER = "/api/auth/register";

	private static final String VERIFY = "/api/auth/verify";

	private static final String RESEND = "/api/auth/verify/resend";

	private static final String LOGIN = "/api/auth/login";

	/** Zwoelf Zeichen, die Mindestlaenge aus {@link PasswordPolicy}. */
	private static final String PASSWORD = "korrekt-pferd-batterie";

	private static final String STUDENT_DOMAIN = "stud.hs-bremen.de";

	private static final String STAFF_DOMAIN = "hs-bremen.de";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PortfolioRepository portfolioRepository;

	@Autowired
	private VerificationCodeRepository codeRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * Der einzige Weg an den Klartext eines Codes. Er verlaesst den Server sonst
	 * ausschliesslich per Mail; in der Datenbank steht nur sein Hash, und genau
	 * das haelt {@link Registrierung#codeIsStoredHashedOnly} fest.
	 */
	@MockitoBean
	private MailTemplateService mailTemplateService;

	/** Absender-Adresse dieses Tests, siehe Klassenkommentar. */
	private String clientIp;

	private String email;

	private String studentHsbEmail;

	@BeforeEach
	void freshIdentities() {
		String unique = UUID.randomUUID().toString();
		clientIp = "198.51.100." + Math.abs(unique.hashCode() % 200) + "-" + unique;
		email = "privat-" + unique + "@example.org";
		studentHsbEmail = "hsb-" + unique + "@" + STUDENT_DOMAIN;
	}

	// ==================================================================
	// POST /api/auth/register
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/register")
	class Registrierung {

		@Test
		@DisplayName("Legt Konto, Portfolio und zwei Codes an und antwortet mit 201")
		void createsAccountPortfolioAndCodes() throws Exception {
			register(email, studentHsbEmail)
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.email").value(email))
					.andExpect(jsonPath("$.firstName").value("Erika"))
					.andExpect(jsonPath("$.role").value("STUDENT"))
					.andExpect(jsonPath("$.status").value("REGISTRATION_PENDING"));

			User created = requireUser(email);
			assertThat(created.isEmailVerified()).isFalse();
			assertThat(created.isHsbEmailVerified()).isFalse();
			assertThat(created.getStatus()).isEqualTo(UserStatus.REGISTRATION_PENDING);

			// §3.2.1: das Portfolio entsteht in Schritt 2, nicht erst bei der
			// Aktivierung in Schritt 5.
			assertThat(portfolioRepository.findByUserId(created.getId())).isPresent();

			assertThat(openCodes(created, VerificationPurpose.PRIVATE_EMAIL)).hasSize(1);
			assertThat(openCodes(created, VerificationPurpose.HSB_EMAIL)).hasSize(1);
		}

		@Test
		@DisplayName("Beide Codes gehen an ihre jeweilige Adresse")
		void sendsBothCodesToTheirOwnAddress() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			verify(mailTemplateService).sendPrivateEmailVerification(eq(email), anyString(), any());
			verify(mailTemplateService).sendHsbEmailVerification(eq(studentHsbEmail), anyString(), any());
		}

		@Test
		@DisplayName("Die Mail nennt dieselbe Gueltigkeit, die auch gilt")
		void mailStatesTheConfiguredValidity() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			ArgumentCaptor<Duration> validity = ArgumentCaptor.forClass(Duration.class);
			verify(mailTemplateService)
					.sendPrivateEmailVerification(eq(email), anyString(), validity.capture());

			VerificationCode stored = openCodes(requireUser(email), VerificationPurpose.PRIVATE_EMAIL)
					.getFirst();
			// Stuende die Dauer an zwei Stellen, naennte die Mail irgendwann eine
			// andere Frist als die Pruefung anwendet.
			assertThat(stored.getExpiresAt())
					.isCloseTo(Instant.now().plus(validity.getValue()), within(Duration.ofMinutes(5)));
		}

		@Test
		@DisplayName("Die Antwort enthaelt die HSB-Adresse nicht, an keiner Stelle")
		void responseNeverCarriesHsbEmail() throws Exception {
			String body = register(email, studentHsbEmail)
					.andExpect(status().isCreated())
					.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

			// Geprueft wird der gesamte Text und nicht nur das Feld: die Adresse
			// schadet auch dann, wenn sie an unerwarteter Stelle im JSON auftaucht
			// (§3.1).
			assertThat(body).doesNotContain(studentHsbEmail);
			assertThat(body).doesNotContain("passwordHash");
		}

		@Test
		@DisplayName("Eine Mitarbeitendenadresse ergibt die Rolle EDITOR")
		void staffDomainYieldsEditor() throws Exception {
			// Die Rolle haengt allein an der Domain; eine Rollenangabe im Request
			// gibt es seit Contract v41 nicht mehr (KAN-63). Tutor:innen mit
			// studentischer Adresse registrieren sich als STUDENT und werden vom
			// Admin hochgestuft (§3.1.1).
			String staffEmail = "hsb-" + UUID.randomUUID() + "@" + STAFF_DOMAIN;

			register(email, staffEmail)
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.role").value("EDITOR"));

			assertThat(requireUser(email).getRole()).isEqualTo(Role.EDITOR);
		}

		@Test
		@DisplayName("boesehs-bremen.de wird abgelehnt, verglichen wird exakt und nicht per Suffix")
		void lookalikeDomainIsRejected() throws Exception {
			// Mit einem endsWith("hs-bremen.de") waere diese Registrierung
			// erfolgreich und die gesamte Pruefung entwertet (§3.1.1).
			register(email, "x@boesehs-bremen.de")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(userRepository.findByEmail(email)).isEmpty();
		}

		@Test
		@DisplayName("Eine hochschulfremde Adresse wird abgelehnt")
		void foreignDomainIsRejected() throws Exception {
			register(email, "erika@example.com")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));

			assertThat(userRepository.findByEmail(email)).isEmpty();
		}

		@Test
		@DisplayName("Eine bereits vergebene private Adresse ergibt 409 RESOURCE_IN_USE")
		void duplicateEmailConflicts() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			register(email, "hsb-" + UUID.randomUUID() + "@" + STUDENT_DOMAIN)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"))
					.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("email")));
		}

		@Test
		@DisplayName("Eine bereits vergebene HSB-Adresse ergibt 409 und nennt das Feld")
		void duplicateHsbEmailConflicts() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			register("zweite-" + email, studentHsbEmail)
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_IN_USE"))
					.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("hsbEmail")));
		}

		@Test
		@DisplayName("Adressen werden kleingeschrieben gespeichert, Schreibweise ergibt kein zweites Konto")
		void addressesAreCaseInsensitive() throws Exception {
			register(email.toUpperCase(java.util.Locale.ROOT),
					studentHsbEmail.toUpperCase(java.util.Locale.ROOT))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.email").value(email));

			assertThat(userRepository.findByEmail(email)).isPresent();

			register(email, studentHsbEmail)
					.andExpect(status().isConflict());
		}

		@Test
		@DisplayName("Ein zu kurzes Passwort ergibt 400 und kein Konto")
		void shortPasswordIsRejected() throws Exception {
			Map<String, Object> body = registerBody(email, studentHsbEmail);
			body.put("password", "kurz123");

			perform(REGISTER, body)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("password")));

			assertThat(userRepository.findByEmail(email)).isEmpty();
		}

		@Test
		@DisplayName("Vor Abschluss ist keine Anmeldung moeglich: 401 REGISTRATION_NOT_COMPLETED")
		void loginBlockedUntilBothAddressesAreVerified() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			// Seit KAN-68 traegt die Antwort den eigenen Code, damit das
			// Frontend den Wiedereinstieg in die Verifizierung anbieten kann.
			login(email, PASSWORD)
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("REGISTRATION_NOT_COMPLETED"));
		}

		@Test
		@DisplayName("Der Code liegt ausschliesslich als Hash in der Datenbank")
		void codeIsStoredHashedOnly() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			String plainCode = capturedPrivateCode();
			VerificationCode stored = openCodes(requireUser(email), VerificationPurpose.PRIVATE_EMAIL)
					.getFirst();

			// Laege der Code im Klartext, koennte jede Person mit Lesezugriff
			// fremde Konten aktivieren (§3.16).
			assertThat(stored.getCodeHash()).isNotEqualTo(plainCode);
			assertThat(stored.getCodeHash()).doesNotContain(plainCode);
			assertThat(stored.getCodeHash()).startsWith("$2a$");
			assertThat(passwordEncoder.matches(plainCode, stored.getCodeHash())).isTrue();
		}

		@Test
		@DisplayName("Der Code hat sechs Stellen, fuehrende Nullen eingeschlossen")
		void codeHasSixDigits() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			assertThat(capturedPrivateCode()).matches("\\d{6}");
		}
	}

	// ==================================================================
	// POST /api/auth/verify
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/verify")
	class Verifizierung {

		@Test
		@DisplayName("Beide Codes eingeloest: Konto wird ACTIVE und die Anmeldung gelingt")
		void bothCodesActivateTheAccount() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			submitCode(VerificationPurpose.PRIVATE_EMAIL, capturedPrivateCode())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.emailVerified").value(true))
					.andExpect(jsonPath("$.hsbEmailVerified").value(false))
					// Schritt 5 ist noch nicht erreicht: eine Adresse fehlt.
					.andExpect(jsonPath("$.status").value("REGISTRATION_PENDING"));

			submitCode(VerificationPurpose.HSB_EMAIL, capturedHsbCode())
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.emailVerified").value(true))
					.andExpect(jsonPath("$.hsbEmailVerified").value(true))
					.andExpect(jsonPath("$.status").value("ACTIVE"));

			assertThat(requireUser(email).getStatus()).isEqualTo(UserStatus.ACTIVE);

			login(email, PASSWORD)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.token").isNotEmpty());
		}

		@Test
		@DisplayName("Nach Abschluss gelingt die Anmeldung auch in anderer Schreibweise")
		void loginIsCaseInsensitive() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());
			submitCode(VerificationPurpose.PRIVATE_EMAIL, capturedPrivateCode())
					.andExpect(status().isOk());
			submitCode(VerificationPurpose.HSB_EMAIL, capturedHsbCode()).andExpect(status().isOk());

			// Die Registrierung legt die Adresse kleingeschrieben ab. Ohne
			// dieselbe Regel beim Login liefe jede abweichende Schreibweise in
			// ein LOGIN_FAILED, das die Person nicht aufloesen kann.
			login(email.toUpperCase(java.util.Locale.ROOT), PASSWORD)
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.token").isNotEmpty());
		}

		@Test
		@DisplayName("Ein falscher Code ergibt 400 VERIFICATION_CODE_INVALID")
		void wrongCodeIsRejected() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			submitCode(VerificationPurpose.PRIVATE_EMAIL, otherThan(capturedPrivateCode()))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));

			assertThat(requireUser(email).isEmailVerified()).isFalse();
		}

		@Test
		@DisplayName("Ein abgelaufener Code ergibt 400, mit derselben Meldung wie ein falscher")
		void expiredCodeIsRejected() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());
			String code = capturedPrivateCode();

			VerificationCode stored = openCodes(requireUser(email), VerificationPurpose.PRIVATE_EMAIL)
					.getFirst();
			stored.setExpiresAt(Instant.now().minusSeconds(60));
			codeRepository.saveAndFlush(stored);

			submitCode(VerificationPurpose.PRIVATE_EMAIL, code)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));

			assertThat(requireUser(email).isEmailVerified()).isFalse();
		}

		@Test
		@DisplayName("Ein bereits verbrauchter Code laesst sich kein zweites Mal einloesen")
		void consumedCodeIsRejected() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());
			String code = capturedPrivateCode();

			submitCode(VerificationPurpose.PRIVATE_EMAIL, code).andExpect(status().isOk());

			submitCode(VerificationPurpose.PRIVATE_EMAIL, code)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));
		}

		@Test
		@DisplayName("Ein Code taugt nur fuer seinen eigenen Zweck")
		void codeIsBoundToItsPurpose() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			// Sonst genuegte der Zugriff auf ein Postfach, um beide Adressen zu
			// bestaetigen, und die HSB-Adresse belegte nichts mehr.
			submitCode(VerificationPurpose.HSB_EMAIL, capturedPrivateCode())
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));
		}

		@Test
		@DisplayName("Unbekannte Adresse und falscher Code sind nicht zu unterscheiden")
		void unknownAddressAnswersLikeAWrongCode() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			String known = bodyOf(submitCode(VerificationPurpose.PRIVATE_EMAIL,
					otherThan(capturedPrivateCode())).andExpect(status().isBadRequest()));
			String unknown = bodyOf(submitCode("gibt-es-nicht-" + UUID.randomUUID() + "@example.org",
					VerificationPurpose.PRIVATE_EMAIL, "123456").andExpect(status().isBadRequest()));

			// Verglichen wird ohne den Zeitstempel: er unterscheidet sich
			// zwangslaeufig und sagt nichts ueber das Konto aus.
			assertThat(withoutTimestamp(unknown)).isEqualTo(withoutTimestamp(known));
		}

		@Test
		@DisplayName("PASSWORD_RESET gehoert nicht an diesen Endpoint")
		void passwordResetPurposeIsRejected() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			// Der Zweck ist ein gueltiger Wert aus §2.11, aber der eines anderen
			// Flusses (KAN-43). Ein Ruecksetzcode darf keine Adresse bestaetigen.
			submitCode(VerificationPurpose.PASSWORD_RESET, capturedPrivateCode())
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Ein deaktiviertes Konto aktiviert sich nicht ueber einen Code selbst")
		void deactivatedAccountStaysDeactivated() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());
			String privateCode = capturedPrivateCode();
			String hsbCode = capturedHsbCode();

			User user = requireUser(email);
			user.setStatus(UserStatus.DEACTIVATED);
			userRepository.saveAndFlush(user);

			submitCode(VerificationPurpose.PRIVATE_EMAIL, privateCode).andExpect(status().isOk());
			submitCode(VerificationPurpose.HSB_EMAIL, hsbCode)
					.andExpect(status().isOk())
					// §2.9 fuehrt den Status getrennt von den Flags, gerade damit
					// "verifiziert und trotzdem gesperrt" abbildbar bleibt.
					.andExpect(jsonPath("$.status").value("DEACTIVATED"));
		}

		@Test
		@DisplayName("Nach fuenf Versuchen antwortet der Endpoint mit 429")
		void tooManyAttemptsAreBlocked() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());
			String wrong = otherThan(capturedPrivateCode());

			for (int i = 0; i < 5; i++) {
				submitCode(VerificationPurpose.PRIVATE_EMAIL, wrong).andExpect(status().isBadRequest());
			}

			// Ohne diese Bremse waere eine Million Moeglichkeiten in
			// ueberschaubarer Zeit durchprobierbar (§3.16).
			submitCode(VerificationPurpose.PRIVATE_EMAIL, wrong)
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"));
		}
	}

	// ==================================================================
	// POST /api/auth/verify/resend
	// ==================================================================

	@Nested
	@DisplayName("POST /api/auth/verify/resend")
	class ErneutSenden {

		@Test
		@DisplayName("Ein neuer Code entwertet den vorherigen")
		void resendInvalidatesThePreviousCode() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());
			String first = capturedPrivateCode();

			resend(email, VerificationPurpose.PRIVATE_EMAIL).andExpect(status().isNoContent());
			String second = capturedPrivateCode();

			assertThat(second).isNotEqualTo(first);
			assertThat(openCodes(requireUser(email), VerificationPurpose.PRIVATE_EMAIL)).hasSize(1);

			// Blieben beide gueltig, haette das erneute Senden die Zahl der
			// Geheimnisse erhoeht statt das alte zu ersetzen (§6.1).
			submitCode(VerificationPurpose.PRIVATE_EMAIL, first)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VERIFICATION_CODE_INVALID"));

			submitCode(VerificationPurpose.PRIVATE_EMAIL, second).andExpect(status().isOk());
		}

		@Test
		@DisplayName("Eine unbekannte Adresse ergibt 204 ohne Versand")
		void unknownAddressIsIndistinguishable() throws Exception {
			resend("gibt-es-nicht-" + UUID.randomUUID() + "@example.org",
					VerificationPurpose.PRIVATE_EMAIL)
					.andExpect(status().isNoContent());

			verify(mailTemplateService, never()).sendPrivateEmailVerification(anyString(), anyString(), any());
			verify(mailTemplateService, never()).sendHsbEmailVerification(anyString(), anyString(), any());
		}

		@Test
		@DisplayName("Eine laengst bestaetigte Adresse ergibt ebenfalls 204 ohne Versand")
		void alreadyVerifiedAddressSendsNothing() throws Exception {
			User active = userRepository.saveAndFlush(
					TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(PASSWORD)));

			resend(active.getEmail(), VerificationPurpose.PRIVATE_EMAIL)
					.andExpect(status().isNoContent());

			verify(mailTemplateService, never()).sendPrivateEmailVerification(anyString(), anyString(), any());
		}

		@Test
		@DisplayName("Nach fuenf Anforderungen antwortet der Endpoint mit 429")
		void resendIsRateLimited() throws Exception {
			register(email, studentHsbEmail).andExpect(status().isCreated());

			for (int i = 0; i < 5; i++) {
				resend(email, VerificationPurpose.PRIVATE_EMAIL).andExpect(status().isNoContent());
			}

			// Gezaehlt wird jeder Aufruf, nicht nur ein fehlgeschlagener: sonst
			// waere der Endpoint ein Versandgenerator fuer fremde Postfaecher.
			resend(email, VerificationPurpose.PRIVATE_EMAIL)
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.errorCode").value("TOO_MANY_LOGIN_ATTEMPTS"));
		}

		@Test
		@DisplayName("Die Sperre der Verifizierung sperrt nicht die Anmeldung")
		void resendLimitLeavesLoginAlone() throws Exception {
			User active = userRepository.saveAndFlush(
					TestUser.activeWithoutId(Role.STUDENT, passwordEncoder.encode(PASSWORD)));

			for (int i = 0; i < 6; i++) {
				resend(active.getEmail(), VerificationPurpose.PRIVATE_EMAIL);
			}

			// Zwei getrennte Zaehler (§6.5). Waeren es dieselben, koennte sich
			// niemand mehr anmelden, dessen Adresse jemand anderes hier eingibt.
			login(active.getEmail(), PASSWORD).andExpect(status().isOk());
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private ResultActions register(String email, String hsbEmail) throws Exception {
		return perform(REGISTER, registerBody(email, hsbEmail));
	}

	private Map<String, Object> registerBody(String email, String hsbEmail) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("firstName", "Erika");
		body.put("lastName", "Musterfrau");
		body.put("email", email);
		body.put("hsbEmail", hsbEmail);
		body.put("password", PASSWORD);
		return body;
	}

	private ResultActions submitCode(VerificationPurpose purpose, String code) throws Exception {
		return submitCode(email, purpose, code);
	}

	private ResultActions submitCode(String address, VerificationPurpose purpose, String code)
			throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("purpose", purpose.name());
		body.put("code", code);
		return perform(VERIFY, body);
	}

	private ResultActions resend(String address, VerificationPurpose purpose) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("email", address);
		body.put("purpose", purpose.name());
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

	/** Siehe Klassenkommentar: eine eigene Absender-Adresse je Testmethode. */
	private RequestPostProcessor fromThisTest() {
		return request -> {
			request.setRemoteAddr(clientIp);
			return request;
		};
	}

	/** Der zuletzt an die private Adresse verschickte Code. */
	private String capturedPrivateCode() {
		ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
		verify(mailTemplateService, atLeastOnce())
				.sendPrivateEmailVerification(anyString(), captor.capture(), any());
		return captor.getValue();
	}

	/** Der zuletzt an die Hochschuladresse verschickte Code. */
	private String capturedHsbCode() {
		ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
		verify(mailTemplateService, atLeastOnce())
				.sendHsbEmailVerification(anyString(), captor.capture(), any());
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

	private List<VerificationCode> openCodes(User user, VerificationPurpose purpose) {
		return codeRepository.findByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
				user.getId(), purpose);
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

	private static org.assertj.core.data.TemporalUnitOffset within(Duration tolerance) {
		return new org.assertj.core.data.TemporalUnitWithinOffset(
				tolerance.toMillis(), java.time.temporal.ChronoUnit.MILLIS);
	}
}
