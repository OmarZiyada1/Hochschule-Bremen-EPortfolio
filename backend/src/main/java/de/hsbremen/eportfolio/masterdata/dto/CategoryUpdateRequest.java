package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code PATCH /api/admin/categories/{id}} (§6.1, §3.6).
 *
 * <p>Das Feld ist optional: {@code null} heisst „unveraendert lassen". Ein
 * uebermittelter, aber leerer Name wird im Dienst mit 400 abgewiesen, weil
 * {@code category.name} {@code not null} ist.
 *
 * @param name neuer Anzeigename; {@code null} laesst ihn unveraendert.
 */
public record CategoryUpdateRequest(

		@Schema(description = "Neuer Anzeigename. Fehlt das Feld, bleibt er unveraendert.",
				example = "Interaction Design")
		@Size(max = 255, message = "Name ist zu lang.")
		String name) {
}
