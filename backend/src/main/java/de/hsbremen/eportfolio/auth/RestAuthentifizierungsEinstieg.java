package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.error.ApiFehlerSchreiber;
import de.hsbremen.eportfolio.common.error.Fehlercodes;
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
 * Standard-Fehlerseite — die API haette dann zwei Fehlerformate.
 */
@Component
public class RestAuthentifizierungsEinstieg implements AuthenticationEntryPoint {

	private final ApiFehlerSchreiber fehlerSchreiber;

	public RestAuthentifizierungsEinstieg(ApiFehlerSchreiber fehlerSchreiber) {
		this.fehlerSchreiber = fehlerSchreiber;
	}

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException ex) throws IOException {
		fehlerSchreiber.schreibe(request, response, HttpStatus.UNAUTHORIZED.value(),
				Fehlercodes.NICHT_AUTHENTIFIZIERT,
				"Fuer diesen Aufruf ist eine Anmeldung erforderlich.");
	}
}
