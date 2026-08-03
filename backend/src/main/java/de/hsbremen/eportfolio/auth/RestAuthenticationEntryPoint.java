package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.error.ApiErrorWriter;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/**
 * Antwortet mit 401 im Envelope aus §6.2, wenn eine geschuetzte Ressource ohne
 * gueltige Anmeldung aufgerufen wird.
 *
 * <p>Ohne diesen EntryPoint liefert Spring Security eine leere 401 bzw. die
 * Standard-Fehlerseite; die API haette dann zwei Fehlerformate.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

	private final ApiErrorWriter errorWriter;

	public RestAuthenticationEntryPoint(ApiErrorWriter errorWriter) {
		this.errorWriter = errorWriter;
	}

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException ex) throws IOException {
		errorWriter.write(request, response, HttpStatus.UNAUTHORIZED.value(),
				ErrorCodes.NOT_AUTHENTICATED,
				"Fuer diesen Aufruf ist eine Anmeldung erforderlich.");
	}
}
