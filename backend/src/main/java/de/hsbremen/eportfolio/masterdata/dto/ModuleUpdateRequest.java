package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body von {@code PATCH /api/admin/modules/{id}} (§6.1, §3.9).
 *
 * <p>Alle drei Felder sind optional: {@code null} heisst „unveraendert lassen".
 * Zur leeren Zeichenkette bei {@link #abbreviation} siehe
 * {@link StudyProgramUpdateRequest}.
 *
 * @param name           neuer Name; {@code null} laesst ihn unveraendert.
 * @param abbreviation   neue Kurzform; {@code null} laesst sie unveraendert,
 *                       eine leere Zeichenkette loescht sie.
 * @param studyProgramId neuer Studiengang; {@code null} laesst die Zuordnung
 *                       unveraendert. Eine unbekannte ID ergibt 400.
 */
public record ModuleUpdateRequest(

		@Schema(description = "Neuer Name. Fehlt das Feld, bleibt er unveraendert.",
				example = "Mensch-Computer-Interaktion")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Neue Kurzform. Fehlt das Feld, bleibt sie unveraendert; eine "
				+ "leere Zeichenkette loescht sie.", example = "MCI", nullable = true)
		@Size(max = 64, message = "Kurzform ist zu lang.")
		String abbreviation,

		@Schema(description = "Neuer Studiengang. Fehlt das Feld, bleibt die Zuordnung "
				+ "unveraendert.")
		UUID studyProgramId) {
}
