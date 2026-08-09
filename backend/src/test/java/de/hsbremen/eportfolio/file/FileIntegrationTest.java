package de.hsbremen.eportfolio.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.TestProject;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die drei Datei-Endpoints aus §6.1 gegen die echte Datenbank: Upload,
 * Auslieferung und Loeschen, mit der Allowlist und den Limits aus §3.15, der
 * Sichtbarkeit am Projektstatus, dem HTTP-Caching aus §3.15 und der
 * Fehlerpolitik aus §6.3.1.
 *
 * <p><strong>Der Speicher ist hier ein In-Memory-Adapter</strong> (KAN-23):
 * Sichtbarkeit, Allowlist, Limits und Statuscodes brauchen keinen echten
 * Speicher. Die Adapter selbst beweisen {@code LocalFileStorageTest} und
 * {@code AzureBlobFileStorageTest}.
 *
 * <p><strong>Der Austausch laeuft ueber {@code @TestBean}</strong> und
 * ausdruecklich nicht ueber eine verschachtelte {@code @TestConfiguration}
 * mit {@code @Primary}: die wird von den {@code @Nested}-Klassen nicht in
 * den Kontext-Cache-Schluessel geerbt. Die Folge waren zwei Kontexte
 * nebeneinander, die Test-Transaktion lief im einen, die injizierten
 * Repositories im anderen, und jede Repository-Operation hat einzeln
 * committet: die Testdaten landeten dauerhaft in der Entwicklungsdatenbank.
 * {@code @TestBean} nutzt dieselbe Override-Mechanik wie das
 * {@code @MockitoBean} im {@code RegistrationIntegrationTest} und wird von
 * {@code @Nested}-Klassen korrekt geerbt.
 *
 * <p>{@code @Transactional} rollt am Ende alles zurueck; der In-Memory-Adapter
 * kennt keine Transaktionen und wird deshalb je Test geleert.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FileIntegrationTest {

	/**
	 * Eine Instanz fuer die ganze Klasse: {@code @TestBean} verlangt eine
	 * statische Fabrik, und die Tests brauchen denselben Gegenstand fuer
	 * ihre Einblicke ({@code keys()}, {@code objectCount()}).
	 */
	private static final InMemoryFileStorage STORAGE = new InMemoryFileStorage();

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

	@Autowired
	private StoredFileRepository storedFileRepository;

	/**
	 * Zeilenstand vor dem Test. Die Pruefungen "nichts gespeichert" vergleichen
	 * gegen diesen Stand statt gegen 0: die Entwicklungsdatenbank kann Zeilen
	 * aus anderer Quelle enthalten, und die gehen diesen Test nichts an.
	 */
	private long baselineFileCount;

	private User author;

	private User otherStudent;

	private User assignedEditor;

	private User unassignedEditor;

	private User admin;

	/** Entwurf der Autor:in mit zugewiesener Redaktion. */
	private Project draft;

	@BeforeEach
	void buildData() {
		STORAGE.clear();
		baselineFileCount = storedFileRepository.count();

		author = save(Role.STUDENT);
		otherStudent = save(Role.STUDENT);
		assignedEditor = save(Role.EDITOR);
		unassignedEditor = save(Role.EDITOR);
		admin = save(Role.ADMIN);

		draft = TestProject.withoutId(author, ProjectStatus.DRAFT, "Mit Medien");
		draft.getEditors().add(assignedEditor);
		draft = projectRepository.saveAndFlush(draft);
	}

	// ==================================================================
	// POST /api/files
	// ==================================================================

	@Nested
	@DisplayName("POST /api/files")
	class Uploading {

		@ParameterizedTest
		@EnumSource(AllowedFileType.class)
		@DisplayName("Round-Trip je erlaubtem Typ: 201, Download liefert dieselben Bytes")
		void roundTripPerType(AllowedFileType type) throws Exception {
			byte[] content = TestFiles.sample(type);

			JsonNode response = upload(author, part(type, content), draft.getId());

			assertThat(response.get("mimeType").asText()).isEqualTo(type.mimeType());
			assertThat(response.get("size").asLong()).isEqualTo(content.length);
			UUID id = UUID.fromString(response.get("id").asText());
			assertThat(response.get("url").asText()).isEqualTo("/api/files/" + id);

			MvcResult download = mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(status().isOk())
					.andReturn();
			assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(content);
			assertThat(download.getResponse().getContentType()).isEqualTo(type.mimeType());
			assertThat(download.getResponse().getContentLength()).isEqualTo(content.length);
		}

		@Test
		@DisplayName("Ohne projectId entsteht ein Avatar, den jede angemeldete Person "
				+ "hochladen darf")
		void avatarUpload() throws Exception {
			JsonNode response = upload(otherStudent, pngPart(), null);

			assertThat(response.get("fileName").asText()).isEqualTo("bild.png");
			assertThat(STORAGE.keys()).allSatisfy(key ->
					assertThat(key).startsWith("avatars/"));
		}

		@Test
		@DisplayName("Die Antwort traegt genau die fuenf Felder aus §6.1: kein path, kein "
				+ "Container, kein Endpoint")
		void responseCarriesNoStorageInternals() throws Exception {
			JsonNode response = upload(author, pngPart(), draft.getId());

			List<String> fields = new ArrayList<>();
			response.fieldNames().forEachRemaining(fields::add);
			assertThat(fields).containsExactlyInAnyOrder("id", "fileName", "mimeType", "size",
					"url");

			// Der Speicherschluessel darf nirgends in der Antwort stehen
			// (§3.15.1), auch nicht als Teilzeichenkette der url.
			String key = STORAGE.keys().iterator().next();
			assertThat(response.toString()).doesNotContain(key);
		}

		@Test
		@DisplayName("Schluesselform nach §3.15.1: projects/{projectId}/{uuid}")
		void keyIsProviderNeutral() throws Exception {
			upload(author, pngPart(), draft.getId());

			String key = STORAGE.keys().iterator().next();
			assertThat(key).startsWith("projects/" + draft.getId() + "/");
			assertThat(UUID.fromString(key.substring(key.lastIndexOf('/') + 1))).isNotNull();
		}

		@Test
		@DisplayName("Typ nicht in der Allowlist: 400 FILE_TYPE_NOT_ALLOWED, nichts gespeichert")
		void forbiddenType() throws Exception {
			MockMultipartFile file = new MockMultipartFile("file", "notizen.txt",
					"text/plain", "nur Text".getBytes(StandardCharsets.UTF_8));

			expectUpload400(file, "FILE_TYPE_NOT_ALLOWED");
		}

		@Test
		@DisplayName("Erlaubter Typ mit fremder Signatur: 400 FILE_TYPE_NOT_ALLOWED, nichts "
				+ "gespeichert")
		void wrongSignature() throws Exception {
			MockMultipartFile file = new MockMultipartFile("file", "getarnt.png", "image/png",
					TestFiles.sample(AllowedFileType.PDF));

			expectUpload400(file, "FILE_TYPE_NOT_ALLOWED");
		}

		@Test
		@DisplayName("Ueber dem fachlichen Limit: 400 FILE_TOO_LARGE, nichts gespeichert")
		void overBusinessLimit() throws Exception {
			MockMultipartFile file = new MockMultipartFile("file", "riesig.png", "image/png",
					TestFiles.sample(AllowedFileType.PNG, 10 * 1024 * 1024 + 1));

			expectUpload400(file, "FILE_TOO_LARGE");
		}

		@Test
		@DisplayName("Projekt nicht in DRAFT oder REVISION: 409 PROJECT_STATUS_NOT_EDITABLE")
		void lockedStatus() throws Exception {
			for (ProjectStatus status : List.of(ProjectStatus.SUBMITTED, ProjectStatus.APPROVED,
					ProjectStatus.PUBLISHED)) {
				draft.setStatus(status);
				projectRepository.saveAndFlush(draft);

				mockMvc.perform(asUser(uploadRequest(pngPart(), draft.getId()), author))
						.andExpect(status().isConflict())
						.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
			}
			assertThat(STORAGE.objectCount()).isZero();
		}

		@Test
		@DisplayName("In REVISION ist der Upload wieder erlaubt (§4.1)")
		void revisionIsEditable() throws Exception {
			draft.setStatus(ProjectStatus.REVISION);
			projectRepository.saveAndFlush(draft);

			upload(author, pngPart(), draft.getId());
		}

		@Test
		@DisplayName("Fremdes Projekt: 403 fuer Studierende und nicht zugewiesene Redaktion, "
				+ "201 fuer zugewiesene Redaktion und Admin (§5)")
		void projectPermissions() throws Exception {
			mockMvc.perform(asUser(uploadRequest(pngPart(), draft.getId()), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			mockMvc.perform(asUser(uploadRequest(pngPart(), draft.getId()), unassignedEditor))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			upload(assignedEditor, pngPart(), draft.getId());
			upload(admin, pngPart(), draft.getId());
		}

		@Test
		@DisplayName("Ohne Token: 401, unbekannte projectId: 404 PROJECT_NOT_FOUND")
		void unauthenticatedAndUnknownProject() throws Exception {
			mockMvc.perform(uploadRequest(pngPart(), draft.getId()))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(asUser(uploadRequest(pngPart(), UUID.randomUUID()), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
		}

		@Test
		@DisplayName("Fehlender Multipart-Teil \"file\": 400 VALIDATION_FAILED im Envelope")
		void missingFilePart() throws Exception {
			mockMvc.perform(asUser(multipart("/api/files"), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
		}

		private void expectUpload400(MockMultipartFile file, String errorCode) throws Exception {
			mockMvc.perform(asUser(uploadRequest(file, draft.getId()), author))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.errorCode").value(errorCode))
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.timestamp").exists())
					.andExpect(jsonPath("$.path").value("/api/files"));

			assertThat(STORAGE.objectCount()).isZero();
			assertThat(storedFileRepository.count()).isEqualTo(baselineFileCount);
		}
	}

	// ==================================================================
	// GET /api/files/{id}: Sichtbarkeit und Caching
	// ==================================================================

	@Nested
	@DisplayName("GET /api/files/{id}")
	class Reading {

		@Test
		@DisplayName("Datei eines Entwurfs: 401 unangemeldet, 403 ohne Recht, 200 fuer die "
				+ "Projektseite; nach PUBLISHED ergibt derselbe Abruf 200 fuer alle (§3.15)")
		void visibilityFollowsProjectStatus() throws Exception {
			UUID id = uploadedFileId();

			mockMvc.perform(get("/api/files/" + id))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			mockMvc.perform(asUser(get("/api/files/" + id), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(status().isOk());

			draft.setStatus(ProjectStatus.PUBLISHED);
			projectRepository.saveAndFlush(draft);

			mockMvc.perform(get("/api/files/" + id))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("Ein Avatar ist auch unangemeldet abrufbar (§3.15)")
		void avatarIsPublic() throws Exception {
			JsonNode avatar = upload(author, pngPart(), null);

			mockMvc.perform(get("/api/files/" + avatar.get("id").asText()))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("Cache-Control und ETag nach §3.15, unterschieden nach Projektstatus")
		void cacheHeaders() throws Exception {
			UUID id = uploadedFileId();

			// Unveroeffentlicht: private, no-store, damit keine Kopie in einem
			// Zwischenspeicher landet, der die Berechtigungspruefung nicht
			// kennt.
			mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"))
					.andExpect(header().string(HttpHeaders.ETAG, "\"" + id + "\""));

			draft.setStatus(ProjectStatus.PUBLISHED);
			projectRepository.saveAndFlush(draft);

			mockMvc.perform(get("/api/files/" + id))
					.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
					.andExpect(header().string(HttpHeaders.ETAG, "\"" + id + "\""));
		}

		@Test
		@DisplayName("Avatare fallen nach dem Contract-Wortlaut unter \"sonst\": private, "
				+ "no-store trotz oeffentlicher Abrufbarkeit")
		void avatarCacheHeaders() throws Exception {
			JsonNode avatar = upload(author, pngPart(), null);

			mockMvc.perform(get("/api/files/" + avatar.get("id").asText()))
					.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"));
		}

		@Test
		@DisplayName("Unbekannte ID: 404 RESOURCE_NOT_FOUND")
		void unknownId() throws Exception {
			mockMvc.perform(asUser(get("/api/files/" + UUID.randomUUID()), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}
	}

	// ==================================================================
	// DELETE /api/files/{id}
	// ==================================================================

	@Nested
	@DisplayName("DELETE /api/files/{id}")
	class Deleting {

		@Test
		@DisplayName("Uploader:in loescht: 204, Zeile und Objekt sind weg, load scheitert")
		void uploaderDeletes() throws Exception {
			UUID id = uploadedFileId();
			String key = STORAGE.keys().iterator().next();

			mockMvc.perform(asUser(delete("/api/files/" + id), author))
					.andExpect(status().isNoContent());

			assertThat(storedFileRepository.findById(id)).isEmpty();
			assertThatThrownBy(() -> STORAGE.load(key))
					.isInstanceOf(FileStorageException.class);

			mockMvc.perform(asUser(get("/api/files/" + id), author))
					.andExpect(status().isNotFound());
		}

		@Test
		@DisplayName("ADMIN darf fremde Dateien loeschen, andere nicht (§6.1)")
		void deletePermissions() throws Exception {
			UUID id = uploadedFileId();

			mockMvc.perform(delete("/api/files/" + id))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.errorCode").value("NOT_AUTHENTICATED"));

			// Auch die zugewiesene Redaktion nicht: §6.1 fuehrt in dieser
			// Zeile allein Uploader:in und ADMIN.
			mockMvc.perform(asUser(delete("/api/files/" + id), otherStudent))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));
			mockMvc.perform(asUser(delete("/api/files/" + id), assignedEditor))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.errorCode").value("NO_PERMISSION"));

			mockMvc.perform(asUser(delete("/api/files/" + id), admin))
					.andExpect(status().isNoContent());
			assertThat(STORAGE.objectCount()).isZero();
		}

		@Test
		@DisplayName("Unbekannte ID: 404 RESOURCE_NOT_FOUND, auch beim zweiten Loeschen")
		void unknownId() throws Exception {
			UUID id = uploadedFileId();
			mockMvc.perform(asUser(delete("/api/files/" + id), author))
					.andExpect(status().isNoContent());

			mockMvc.perform(asUser(delete("/api/files/" + id), author))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
		}

		@Test
		@DisplayName("Projektdatei ausserhalb von DRAFT/REVISION: 409 fuer die Uploader:in, "
				+ "204 fuer ADMIN (§6.1, Contract v25)")
		void lockedStatusProtectsPublishedContent() throws Exception {
			UUID id = uploadedFileId();

			draft.setStatus(ProjectStatus.PUBLISHED);
			projectRepository.saveAndFlush(draft);

			mockMvc.perform(asUser(delete("/api/files/" + id), author))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.errorCode").value("PROJECT_STATUS_NOT_EDITABLE"));
			assertThat(storedFileRepository.findById(id)).isPresent();
			assertThat(STORAGE.objectCount()).isEqualTo(1);

			mockMvc.perform(asUser(delete("/api/files/" + id), admin))
					.andExpect(status().isNoContent());
			assertThat(STORAGE.objectCount()).isZero();
		}

		@Test
		@DisplayName("In REVISION loescht die Uploader:in wieder selbst; Avatare haengen an "
				+ "keinem Projekt und bleiben statusfrei loeschbar")
		void revisionAndAvatarsStayDeletable() throws Exception {
			UUID projectFile = uploadedFileId();
			draft.setStatus(ProjectStatus.REVISION);
			projectRepository.saveAndFlush(draft);

			mockMvc.perform(asUser(delete("/api/files/" + projectFile), author))
					.andExpect(status().isNoContent());

			UUID avatar = UUID.fromString(
					upload(author, pngPart(), null).get("id").asText());
			mockMvc.perform(asUser(delete("/api/files/" + avatar), author))
					.andExpect(status().isNoContent());
		}
	}

	// ==================================================================
	// Hilfsmittel
	// ==================================================================

	private User save(Role role) {
		return userRepository.saveAndFlush(TestUser.activeWithoutId(role, "nicht-relevant"));
	}

	private MockMultipartFile pngPart() {
		return part(AllowedFileType.PNG, TestFiles.sample(AllowedFileType.PNG));
	}

	private MockMultipartFile part(AllowedFileType type, byte[] content) {
		String name = switch (type) {
			case PNG -> "bild.png";
			case JPEG -> "foto.jpg";
			case WEBP -> "grafik.webp";
			case MP3 -> "ton.mp3";
			case WAV -> "aufnahme.wav";
			case OGG -> "klang.ogg";
			case PDF -> "dokument.pdf";
		};
		return new MockMultipartFile("file", name, type.mimeType(), content);
	}

	private MockMultipartHttpServletRequestBuilder uploadRequest(MockMultipartFile file,
			UUID projectId) {
		MockMultipartHttpServletRequestBuilder request = multipart("/api/files").file(file);
		if (projectId != null) {
			request.param("projectId", projectId.toString());
		}
		return request;
	}

	/** Laedt hoch und erwartet 201; liefert die Antwort als JSON. */
	private JsonNode upload(User user, MockMultipartFile file, UUID projectId) throws Exception {
		String body = mockMvc.perform(asUser(uploadRequest(file, projectId), user))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
		return objectMapper.readTree(body);
	}

	/** Eine PNG-Datei am Entwurf der Autor:in, fuer die Lese- und Loeschtests. */
	private UUID uploadedFileId() throws Exception {
		return UUID.fromString(upload(author, pngPart(), draft.getId()).get("id").asText());
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
}
