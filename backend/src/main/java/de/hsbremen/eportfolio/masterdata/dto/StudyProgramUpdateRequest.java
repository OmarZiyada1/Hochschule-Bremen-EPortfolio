package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body von {@code PATCH /api/admin/study-programs/{id}} (§6.1, §3.7).
 *
 * <p>Alle drei Felder sind optional: {@code null} heisst „unveraendert lassen".
 *
 * <p><strong>Wie sich eine Kurzform loeschen laesst.</strong>
 * {@code abbreviation} ist als einziges Feld dieser Stammdaten
 * {@code nullable}, {@code null} kann hier also nicht zugleich „unveraendert"
 * und „leeren" bedeuten. Es heisst „unveraendert"; zum Leeren dient die leere
 * Zeichenkette, die der Dienst als {@code null} speichert. Die umgekehrte
 * Belegung waere schlechter: dann liesse ein Aufruf, der nur den Namen aendern
 * will, die Kurzform stillschweigend verschwinden. Dasselbe gilt fuer
 * {@link ModuleUpdateRequest}.
 *
 * @param name         neuer Name; {@code null} laesst ihn unveraendert.
 * @param abbreviation neue Kurzform; {@code null} laesst sie unveraendert, eine
 *                     leere Zeichenkette loescht sie.
 * @param facultyId    neue Fakultaet; {@code null} laesst die Zuordnung
 *                     unveraendert. Eine unbekannte ID ergibt 400.
 */
public record StudyProgramUpdateRequest(

		@Schema(description = "Neuer Name. Fehlt das Feld, bleibt er unveraendert.",
				example = "Medieninformatik")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Neue Kurzform. Fehlt das Feld, bleibt sie unveraendert; eine "
				+ "leere Zeichenkette loescht sie.", example = "MI", nullable = true)
		@Size(max = 64, message = "Kurzform ist zu lang.")
		String abbreviation,

		@Schema(description = "Neue Fakultaet. Fehlt das Feld, bleibt die Zuordnung unveraendert.")
		UUID facultyId) {
}
