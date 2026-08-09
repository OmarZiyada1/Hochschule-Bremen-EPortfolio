package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code PATCH /api/admin/faculties/{id}} (§6.1, §3.8).
 *
 * <p>Beide Felder sind optional: {@code null} heisst „unveraendert lassen".
 * Beide sind in der Tabelle {@code not null}, ein uebermittelter, aber leerer
 * Wert wird deshalb im Dienst mit 400 abgewiesen.
 *
 * @param name         neuer ausgeschriebener Name; {@code null} laesst ihn
 *                     unveraendert.
 * @param abbreviation neues Kuerzel; {@code null} laesst es unveraendert. Ein
 *                     bereits an eine andere Fakultaet vergebenes Kuerzel ergibt
 *                     409 {@code RESOURCE_IN_USE}.
 */
public record FacultyUpdateRequest(

		@Schema(description = "Neuer Name. Fehlt das Feld, bleibt er unveraendert.",
				example = "Elektrotechnik und Informatik")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Neues Kuerzel, eindeutig. Fehlt das Feld, bleibt es unveraendert.",
				example = "FK4")
		@Size(max = 64, message = "Kuerzel ist zu lang.")
		String abbreviation) {
}
