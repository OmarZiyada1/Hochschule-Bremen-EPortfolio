package de.hsbremen.eportfolio.common.error;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/**
 * Schreibt das Fehler-Envelope aus API-Contract §6.2 direkt in eine
 * {@link HttpServletResponse}.
 *
 * <p>Notwendig, weil die Spring-Security-Filter <em>vor</em> dem
 * DispatcherServlet laufen. Ein dort geworfener Fehler erreicht den
 * {@link GlobalExceptionHandler} nie — ohne diese Klasse wuerde Spring
 * Security eine leere Antwort bzw. das Servlet-Standardformat liefern und die
 * API haette zwei verschiedene Fehlerformate.
 */
@Component
public class ApiFehlerSchreiber {

	private final ObjectMapper objectMapper;

	public ApiFehlerSchreiber(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public void schreibe(HttpServletRequest request, HttpServletResponse response,
			int status, String fehlercode, String meldung) throws IOException {
		ApiFehler fehler = new ApiFehler(
				Instant.now(),
				status,
				fehlercode,
				meldung,
				request.getRequestURI());

		response.setStatus(status);
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		objectMapper.writeValue(response.getOutputStream(), fehler);
	}
}
