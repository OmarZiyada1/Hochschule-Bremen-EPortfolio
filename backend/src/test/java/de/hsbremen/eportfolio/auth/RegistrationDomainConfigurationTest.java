package de.hsbremen.eportfolio.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.mail.MailTemplateService;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * Belegt, dass die Domainlisten aus der Konfiguration kommen und nicht im Code
 * stehen (API-Contract §3.1.1, §6.8).
 *
 * <p>Der Test laeuft mit <strong>anderen</strong> Domains als
 * {@code application.yml} und dreht die Zuordnung dabei um: was in Produktion
 * studentisch ist, gilt hier gar nicht, und die erfundene Endung
 * {@code tutorium.example} fuehrt zur Redakteursrolle. Waeren die Domains im
 * Code verdrahtet, muesste dieser Test scheitern; damit ist die
 * Konfigurierbarkeit belegt und nicht nur behauptet.
 *
 * <p>Sie ist kein Selbstzweck: §6.8 zaehlt die Listen ausdruecklich zu den
 * Zusagen an den Client. Nimmt die Hochschule eine weitere Adressendung in
 * Betrieb, soll das eine Zeile Konfiguration sein und keine neue Version der
 * Software.
 *
 * <p>Eigene Testklasse und nicht Teil von {@link RegistrationIntegrationTest},
 * weil {@code @TestPropertySource} fuer die gesamte Klasse gilt und deren
 * uebrige Faelle gegen die echten Domains laufen sollen.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = {
		"app.registration.student-domains=erstsemester.example",
		"app.registration.staff-domains=tutorium.example,lehre.example",
		"app.registration.code-lifetime=PT30M"
})
class RegistrationDomainConfigurationTest {

	private static final String REGISTER = "/api/auth/register";

	private static final String PASSWORD = "korrekt-pferd-batterie";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	/** Kein Versand im Test; der Flow selbst steht in {@link RegistrationIntegrationTest}. */
	@MockitoBean
	private MailTemplateService mailTemplateService;

	@Test
	@DisplayName("Eine nur hier konfigurierte Studierendendomain wird angenommen")
	void configuredStudentDomainIsAccepted() throws Exception {
		register("erstsemester.example")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("STUDENT"));
	}

	@Test
	@DisplayName("Eine nur hier konfigurierte Mitarbeitendendomain ergibt EDITOR")
	void configuredStaffDomainYieldsEditor() throws Exception {
		register("tutorium.example")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("EDITOR"));
	}

	@Test
	@DisplayName("Der zweite Eintrag der Liste zaehlt genauso wie der erste")
	void everyEntryOfTheListCounts() throws Exception {
		register("lehre.example")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("EDITOR"));
	}

	@Test
	@DisplayName("Die Domain aus application.yml gilt hier nicht mehr")
	void productionDomainIsRejectedHere() throws Exception {
		// Der eigentliche Beleg: stuende stud.hs-bremen.de im Code, ginge dieser
		// Aufruf durch, obwohl die Konfiguration die Endung gar nicht kennt.
		register("stud.hs-bremen.de")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
	}

	private ResultActions register(String hsbDomain) throws Exception {
		String unique = UUID.randomUUID().toString();

		Map<String, Object> body = new LinkedHashMap<>();
		body.put("firstName", "Erika");
		body.put("lastName", "Musterfrau");
		body.put("email", "privat-" + unique + "@example.org");
		body.put("hsbEmail", "hsb-" + unique + "@" + hsbDomain);
		body.put("password", PASSWORD);

		return mockMvc.perform(post(REGISTER)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}
}
