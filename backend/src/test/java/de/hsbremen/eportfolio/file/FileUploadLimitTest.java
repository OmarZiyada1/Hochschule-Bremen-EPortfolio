package de.hsbremen.eportfolio.file;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.auth.JwtService;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * Ein Upload oberhalb des Servlet-Limits ({@code spring.servlet.multipart},
 * KAN-23) ergibt 400 {@code FILE_TOO_LARGE} im Envelope aus §6.2 und keinen
 * 500.
 *
 * <p><strong>Die Grenze setzt der Test selbst herab</strong> (KAN-72). Bis
 * Contract v50 stand sie auf 30 MB, und der Test schickte 31 MB dagegen. Mit
 * dem Video-Upload liegt sie bei 210 MB; ein Test, der 211 MB durch eine
 * HTTP-Verbindung schoebe, pruefte nicht mehr, was sein Name sagt, sondern
 * vor allem die Geduld des Testlaufs. Ueber {@code @SpringBootTest(properties
 * = ...)} steht sie hier auf 1 MB, und ein 2-MB-PNG loest dieselbe
 * {@code MaxUploadSizeExceededException} aus wie 211 MB im Betrieb: der
 * Multipart-Filter unterscheidet die beiden Faelle nicht. Die echten Werte
 * aus {@code application.yml} deckt kein Test ab, weil sie Konfiguration
 * sind und keine Logik; dass sie oberhalb des fachlichen Limits liegen,
 * begruendet der Kommentar dort.
 *
 *
 * <p><strong>{@code @DirtiesContext} gibt die Verbindungen wieder frei.</strong>
 * Diese Klasse braucht einen eigenen Anwendungskontext, den keine andere
 * Klasse teilt, und ohne diese Angabe bliebe er samt seinem Verbindungspool
 * bis zum Ende des gesamten Laufs im Kontext-Cache stehen. Der volle
 * {@code ./mvnw test} haelt neun solcher Kontexte gleichzeitig, und die
 * Entwicklungsdatenbank aus den {@code compose.*.yml} laesst hundert
 * Verbindungen zu: der Lauf scheiterte reproduzierbar mit
 * {@code FATAL: sorry, too many clients already}, und zwar an einer spaeter
 * startenden Klasse, die mit der Ursache nichts zu tun hatte (KAN-72).
 *
 * <p><strong>Warum gegen einen echten Server und nicht per MockMvc:</strong>
 * die Multipart-Grenzen setzt der Servlet-Container beim Einlesen des
 * Requests durch. MockMvc baut den Request fertig zusammen und laesst diese
 * Stufe aus; ein MockMvc-Test wuerde also nur beweisen, dass es die Grenze
 * nicht gibt. Deshalb {@code RANDOM_PORT}, und deshalb raeumt der Test sein
 * Konto selbst wieder ab: die Anfrage laeuft in einem anderen Thread, die
 * Test-Transaktion wuerde dort nichts zurueckrollen. Dateizeilen entstehen
 * keine, der Upload scheitert vor dem Controller.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.servlet.multipart.max-file-size=1MB",
				"spring.servlet.multipart.max-request-size=2MB",
				"server.tomcat.max-swallow-size=4MB" })
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class FileUploadLimitTest {

	@Autowired
	private TestRestTemplate rest;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private UserRepository userRepository;

	private User uploader;

	@BeforeEach
	void createUploader() {
		uploader = userRepository.saveAndFlush(
				TestUser.activeWithoutId(Role.STUDENT, "nicht-relevant"));
	}

	@AfterEach
	void removeUploader() {
		userRepository.delete(uploader);
	}

	@Test
	@DisplayName("2 MB gegen ein im Test auf 1 MB gesetztes Servlet-Limit: 400 FILE_TOO_LARGE "
			+ "im Envelope")
	void uploadAboveServletLimit() throws Exception {
		byte[] bytes = TestFiles.sample(AllowedFileType.PNG, 2 * 1024 * 1024);
		ByteArrayResource resource = new ByteArrayResource(bytes) {
			@Override
			public String getFilename() {
				return "viel-zu-gross.png";
			}
		};
		MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
		body.add("file", resource);

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.MULTIPART_FORM_DATA);
		headers.setBearerAuth(jwtService.createToken(AuthenticatedUser.from(uploader)));

		ResponseEntity<String> response = rest.postForEntity("/api/files",
				new HttpEntity<>(body, headers), String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		JsonNode envelope = objectMapper.readTree(response.getBody());
		assertThat(envelope.get("errorCode").asText()).isEqualTo("FILE_TOO_LARGE");
		assertThat(envelope.get("status").asInt()).isEqualTo(400);
		assertThat(envelope.get("path").asText()).isEqualTo("/api/files");
	}
}
