package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.error.ApiErrorWriter;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * Antwortet mit 403 im Envelope aus §6.2, wenn ein angemeldeter Benutzer eine
 * Aktion versucht, die die Rechtematrix (§5) ihm nicht erlaubt.
 *
 * <p>Gegenstueck zum {@link RestAuthenticationEntryPoint}: 401 heisst „nicht
 * angemeldet", 403 „angemeldet, aber nicht berechtigt" (§6.3).
 */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

	private final ApiErrorWriter errorWriter;

	public RestAccessDeniedHandler(ApiErrorWriter errorWriter) {
		this.errorWriter = errorWriter;
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response,
			AccessDeniedException ex) throws IOException {
		errorWriter.write(request, response, HttpStatus.FORBIDDEN.value(),
				ErrorCodes.NO_PERMISSION,
				"Fuer diese Aktion fehlt die Berechtigung.");
	}
}
