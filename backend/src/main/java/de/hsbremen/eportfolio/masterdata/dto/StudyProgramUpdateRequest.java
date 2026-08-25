package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body von {@code PATCH /api/admin/study-programs/{id}} (§6.1, §3.7).
 *
 * <p>Alle drei Felder sind optional: {@code null} heisst „unveraendert lassen".
 *
 * <p><strong>Eine Kurzform laesst sich seit Contract v81 nicht mehr
 * loeschen.</strong> Bis v80 war {@code abbreviation} das einzige
 * {@code nullable} Feld dieser Stammdaten, und die leere Zeichenkette war der
 * Weg, es zu leeren. Mit v81 ist die Spalte {@code not null}: das Kuerzel steht
 * auf der Projektkachel und in den Projektdetails, eine leere Stelle waere dort
 * nicht zu fuellen. {@code null} heisst weiterhin „unveraendert", die leere
 * Zeichenkette ist jetzt ein 400 {@code VALIDATION_FAILED}. Dasselbe gilt fuer
 * {@link ModuleUpdateRequest}.
 *
 * @param name         neuer Name; {@code null} laesst ihn unveraendert.
 * @param abbreviation neue Kurzform; {@code null} laesst sie unveraendert, eine
 *                     leere Zeichenkette ergibt 400.
 * @param facultyId    neue Fakultaet; {@code null} laesst die Zuordnung
 *                     unveraendert. Eine unbekannte ID ergibt 400.
 */
public record StudyProgramUpdateRequest(

		@Schema(description = "Neuer Name. Fehlt das Feld, bleibt er unveraendert.",
				example = "Medieninformatik")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Neue Kurzform. Fehlt das Feld, bleibt sie unveraendert; eine "
				+ "leere Zeichenkette ergibt 400.", example = "MI")
		@Size(min = 1, max = 64, message = "Kurzform ist zu lang oder leer.")
		String abbreviation,

		@Schema(description = "Neue Fakultaet. Fehlt das Feld, bleibt die Zuordnung unveraendert.")
		UUID facultyId) {
}
