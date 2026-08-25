package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body von {@code PATCH /api/admin/modules/{id}} (§6.1, §3.9).
 *
 * <p>Alle drei Felder sind optional: {@code null} heisst „unveraendert lassen".
 * Zur leeren Zeichenkette bei {@link #abbreviation} siehe
 * {@link StudyProgramUpdateRequest}: sie loescht die Kurzform seit Contract v81
 * nicht mehr, sondern ergibt 400.
 *
 * @param name           neuer Name; {@code null} laesst ihn unveraendert.
 * @param abbreviation   neue Kurzform; {@code null} laesst sie unveraendert,
 *                       eine leere Zeichenkette ergibt 400.
 * @param studyProgramId neuer Studiengang; {@code null} laesst die Zuordnung
 *                       unveraendert. Eine unbekannte ID ergibt 400.
 */
public record ModuleUpdateRequest(

		@Schema(description = "Neuer Name. Fehlt das Feld, bleibt er unveraendert.",
				example = "Mensch-Computer-Interaktion")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Neue Kurzform. Fehlt das Feld, bleibt sie unveraendert; eine "
				+ "leere Zeichenkette ergibt 400.", example = "MCI")
		@Size(min = 1, max = 64, message = "Kurzform ist zu lang oder leer.")
		String abbreviation,

		@Schema(description = "Neuer Studiengang. Fehlt das Feld, bleibt die Zuordnung "
				+ "unveraendert.")
		UUID studyProgramId) {
}
