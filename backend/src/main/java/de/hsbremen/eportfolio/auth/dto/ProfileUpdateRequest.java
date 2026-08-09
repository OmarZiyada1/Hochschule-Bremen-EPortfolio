package de.hsbremen.eportfolio.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Eigene Profildaten aendern, {@code PUT /api/auth/me} (§6.1, KAN-44).
 *
 * <p>Bewusst nur die beiden Namensfelder. Die private E-Mail ist die
 * Login-Identitaet und braeuchte fuer einen Wechsel einen eigenen Flow mit
 * Verifizierung der neuen Adresse (§3.1.1, offener Punkt in §7); Rolle und
 * Status vergibt ausschliesslich die Administration (§5). Weil das Record
 * diese Felder gar nicht kennt, ignoriert die JSON-Umwandlung sie in jedem
 * Request; ein Test belegt das.
 *
 * @param firstName Vorname.
 * @param lastName  Nachname.
 */
public record ProfileUpdateRequest(

		@Schema(example = "Erika")
		@NotBlank(message = "Vorname fehlt.")
		@Size(max = 255, message = "Vorname ist zu lang.")
		String firstName,

		@Schema(example = "Musterfrau")
		@NotBlank(message = "Nachname fehlt.")
		@Size(max = 255, message = "Nachname ist zu lang.")
		String lastName) {
}
