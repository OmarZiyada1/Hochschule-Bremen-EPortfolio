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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * Ein Upload oberhalb des Servlet-Limits ({@code spring.servlet.multipart},
 * KAN-23) ergibt 400 {@code FILE_TOO_LARGE} im Envelope aus §6.2 und keinen
 * 500.
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
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
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
	@DisplayName("31 MB gegen das 30-MB-Servlet-Limit: 400 FILE_TOO_LARGE im Envelope")
	void uploadAboveServletLimit() throws Exception {
		byte[] bytes = TestFiles.sample(AllowedFileType.PNG, 31 * 1024 * 1024);
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
