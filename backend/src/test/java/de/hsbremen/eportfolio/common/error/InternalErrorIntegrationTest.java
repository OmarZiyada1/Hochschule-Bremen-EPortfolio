package de.hsbremen.eportfolio.common.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.file.AllowedFileType;
import de.hsbremen.eportfolio.file.FileStorage;
import de.hsbremen.eportfolio.file.FileStorageException;
import de.hsbremen.eportfolio.file.TestFiles;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der Auffang-Handler aus §6.2 und §6.3 (KAN-55): auch ein unerwarteter
 * Serverfehler antwortet im Envelope, und die bestehenden Zuordnungen bleiben
 * davon unberuehrt.
 *
 * <p><strong>Warum der Speicher der Ausloeser ist:</strong> ein 500 laesst sich
 * nicht sinnvoll ueber einen Endpoint erzwingen, der fachlich funktioniert. Der
 * Objektspeicher ist der erste Fremddienst im Request-Pfad (KAN-23), und ein
 * nicht erreichbarer Speicher ist der realistischste Weg in diesen Fall: die
 * Datenbankzeile ist da, die Bytes sind es nicht. Der Adapter unten wirft
 * deshalb bei jedem {@code load}.
 *
 * <p>Der Austausch laeuft ueber {@code @TestBean} wie im
 * {@code FileIntegrationTest}; die Begruendung gegen eine verschachtelte
 * {@code @TestConfiguration} mit {@code @Primary} steht dort.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class InternalErrorIntegrationTest {

	private static final FailingFileStorage STORAGE = new FailingFileStorage();

	/** Ersetzt den {@code LocalFileStorage} des dev-Profils im Kontext. */
	@TestBean
	private FileStorage fileStorage;

	static FileStorage fileStorage() {
		return STORAGE;
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	private ch.qos.logback.classic.Logger handlerLogger;

	private ListAppender<ILoggingEvent> appender;

	private User author;

	private Project draft;

	@BeforeEach
	void buildData() {
		author = userRepository.saveAndFlush(TestUser.activeWithoutId(Role.STUDENT, "egal"));
		draft = projectRepository.saveAndFlush(
				TestProject.withoutId(author, ProjectStatus.DRAFT, "Mit Medien"));

		LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
		handlerLogger = context.getLogger(GlobalExceptionHandler.class);
		appender = new ListAppender<>();
		appender.setContext(context);
		appender.start();
		handlerLogger.addAppender(appender);
	}

	@AfterEach
	void releaseLog() {
		handlerLogger.detachAppender(appender);
		appender.stop();
	}

	// ==================================================================
	// Der unerwartete Fehler selbst
	// ==================================================================

	@Nested
	@DisplayName("Erzwungener Speicherfehler")
	class StorageFailure {

		@Test
		@DisplayName("Ergibt 500 im Envelope aus §6.2 mit errorCode INTERNAL_ERROR")
		void answersWithEnvelope() throws Exception {
			UUID id = uploadedFileId();

			String body = mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(status().isInternalServerError())
					.andExpect(jsonPath("$.errorCode").value("INTERNAL_ERROR"))
					.andExpect(jsonPath("$.status").value(500))
					.andExpect(jsonPath("$.path").value("/api/files/" + id))
					.andExpect(jsonPath("$.timestamp").exists())
					.andReturn()
					.getResponse()
					.getContentAsString(StandardCharsets.UTF_8);

			// Genau die fuenf Felder aus §6.2, nicht mehr: ein zusaetzliches
			// Feld waere die Stelle, an der Interna doch wieder hinausgehen.
			List<String> fields = new ArrayList<>();
			objectMapper.readTree(body).fieldNames().forEachRemaining(fields::add);
			assertThat(fields).containsExactlyInAnyOrder("timestamp", "status", "errorCode",
					"message", "path");
		}

		@Test
		@DisplayName("Kein Ausnahmetext in der Antwort: weder Speicherschluessel noch Klassenname")
		void keepsTheExceptionTextInside() throws Exception {
			UUID id = uploadedFileId();

			String body = mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(status().isInternalServerError())
					.andExpect(jsonPath("$.message")
							.value(GlobalExceptionHandler.INTERNAL_ERROR_MESSAGE))
					.andReturn()
					.getResponse()
					.getContentAsString(StandardCharsets.UTF_8);

			assertThat(body)
					.doesNotContain(FailingFileStorage.INTERNAL_DETAIL)
					.doesNotContain("FileStorageException")
					.doesNotContain("de.hsbremen.eportfolio");
		}

		@Test
		@DisplayName("Die Ausnahme steht mit Stacktrace im Protokoll")
		void writesStacktraceToLog() throws Exception {
			UUID id = uploadedFileId();

			mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(status().isInternalServerError());

			List<ILoggingEvent> errors = appender.list.stream()
					.filter(event -> event.getLevel() == Level.ERROR)
					.toList();
			assertThat(errors).hasSize(1);

			ILoggingEvent event = errors.get(0);
			// Ohne Methode und Pfad ist die Zeile im Betrieb keiner Anfrage
			// zuzuordnen; die Antwort nennt beide ebenfalls.
			assertThat(event.getFormattedMessage())
					.contains("GET")
					.contains("/api/files/" + id);
			assertThat(event.getThrowableProxy()).isNotNull();
			assertThat(event.getThrowableProxy().getClassName())
					.isEqualTo(FileStorageException.class.getName());
			assertThat(event.getThrowableProxy().getStackTraceElementProxyArray()).isNotEmpty();
			// Was aus der Antwort herausgehalten wird, muss hier stehen: sonst
			// waere der Fehler nirgends mehr zu finden.
			assertThat(event.getThrowableProxy().getMessage())
					.contains(FailingFileStorage.INTERNAL_DETAIL);
		}
	}

	// ==================================================================
	// Ausnahmen des Rahmenwerks behalten ihren Statuscode
	// ==================================================================

	@Nested
	@DisplayName("Rahmenfehler mit eigenem Statuscode")
	class FrameworkErrors {

		@Test
		@DisplayName("Unbekannter Pfad bleibt 404 und wird zu RESOURCE_NOT_FOUND")
		void unknownPathStaysNotFound() throws Exception {
			mockMvc.perform(asUser(get("/api/gibtesnicht"), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
					.andExpect(jsonPath("$.status").value(404))
					.andExpect(jsonPath("$.path").value("/api/gibtesnicht"));
		}

		@Test
		@DisplayName("Nicht zugelassene Methode bleibt 405, mit Allow-Header")
		void wrongMethodStaysMethodNotAllowed() throws Exception {
			mockMvc.perform(asUser(put("/api/files/" + UUID.randomUUID()), author))
					.andExpect(status().isMethodNotAllowed())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.status").value(405))
					// Der Allow-Header ist nach RFC 9110 Teil der Antwort und das
					// einzige maschinenlesbare Stueck, das der Client hier bekommt.
					.andExpect(header().exists(HttpHeaders.ALLOW));
		}

		@Test
		@DisplayName("Falscher Content-Type bleibt 415")
		void wrongContentTypeStaysUnsupported() throws Exception {
			mockMvc.perform(asUser(post("/api/files")
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}"), author))
					.andExpect(status().isUnsupportedMediaType())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
					.andExpect(jsonPath("$.status").value(415));
		}
	}

	// ==================================================================
	// Der Auffang-Handler verdeckt die bestehenden nicht
	// ==================================================================

	@Nested
	@DisplayName("Bestehende Zuordnungen")
	class SpecificHandlersStayInPlace {

		@Test
		@DisplayName("Ohne Token weiterhin 401 NOT_AUTHENTICATED statt 500")
		void unauthenticatedStays401() throws Exception {
			mockMvc.perform(post("/api/files"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));
		}

		@Test
		@DisplayName("Fremdes Projekt weiterhin 403 NO_PERMISSION statt 500")
		void forbiddenStays403() throws Exception {
			User other = userRepository.saveAndFlush(
					TestUser.activeWithoutId(Role.STUDENT, "egal"));
			MockMultipartFile file = new MockMultipartFile("file", "bild.png", "image/png",
					TestFiles.sample(AllowedFileType.PNG));

			mockMvc.perform(asUser(multipart("/api/files")
							.file(file)
							.param("projectId", draft.getId().toString()), other))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
		}

		@Test
		@DisplayName("Unbekannte Datei-ID weiterhin 404 RESOURCE_NOT_FOUND statt 500")
		void unknownIdStays404() throws Exception {
			mockMvc.perform(asUser(get("/api/files/" + UUID.randomUUID()), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Unbrauchbarer Pfadparameter weiterhin 400 VALIDATION_FAILED statt 500")
		void typeMismatchStays400() throws Exception {
			mockMvc.perform(asUser(get("/api/files/keine-uuid"), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		@Test
		@DisplayName("Kein Client-Fehler landet als Fehlerzeile im Protokoll")
		void clientErrorsStayOutOfTheErrorLog() throws Exception {
			mockMvc.perform(asUser(get("/api/gibtesnicht"), author));
			mockMvc.perform(asUser(get("/api/files/" + UUID.randomUUID()), author));
			mockMvc.perform(asUser(get("/api/files/keine-uuid"), author));

			assertThat(appender.list)
					.noneMatch(event -> event.getLevel() == Level.ERROR);
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	/**
	 * Laedt eine Datei hoch und liefert ihre ID. Der Adapter nimmt den Upload an
	 * und wirft erst beim Lesen: genau die Lage, in der eine Datenbankzeile
	 * existiert und die Bytes trotzdem nicht zu holen sind.
	 */
	private UUID uploadedFileId() throws Exception {
		MockMultipartFile file = new MockMultipartFile("file", "bild.png", "image/png",
				TestFiles.sample(AllowedFileType.PNG));

		String body = mockMvc.perform(asUser(multipart("/api/files")
						.file(file)
						.param("projectId", draft.getId().toString()), author))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);

		JsonNode response = objectMapper.readTree(body);
		return UUID.fromString(response.get("id").asText());
	}

	/** Haengt ein echtes Bearer-Token an; {@code null} laesst die Anfrage anonym. */
	private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request,
			User user) {
		if (user == null) {
			return request;
		}
		String token = jwtService.createToken(AuthenticatedUser.from(user));
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
	}

	/**
	 * Nimmt jeden Upload an und scheitert bei jedem Lesezugriff, so wie ein nicht
	 * erreichbarer Objektspeicher es taete.
	 *
	 * <p>Die Meldung traegt bewusst Interna in der Form, in der echte
	 * Speicherfehler sie tragen (Container und Schluessel): nur so beweist der
	 * Test, dass sie im Protokoll landen und nicht in der Antwort.
	 */
	private static final class FailingFileStorage implements FileStorage {

		static final String INTERNAL_DETAIL =
				"container=eportfolio-files, schluessel=projects/4711/geheim.png";

		@Override
		public void store(String key, InputStream data, long size, String contentType) {
			// Nimmt an, ohne zu speichern: dieser Test braucht die Bytes nie.
		}

		@Override
		public InputStream load(String key) {
			throw new FileStorageException("Speicher nicht erreichbar (" + INTERNAL_DETAIL + ")");
		}

		/** Der Bereichsabruf scheitert wie der vollstaendige (§3.15, KAN-72). */
		@Override
		public InputStream load(String key, long offset, long length) {
			throw new FileStorageException("Speicher nicht erreichbar (" + INTERNAL_DETAIL + ")");
		}

		@Override
		public void delete(String key) {
			// Kein Speicher, nichts zu loeschen.
		}
	}
}
