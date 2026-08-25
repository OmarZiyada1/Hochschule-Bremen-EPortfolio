package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body von {@code POST /api/admin/study-programs} (§6.1, §3.7).
 *
 * @param name         ausgeschriebener Name.
 * @param abbreviation Kurzform. Pflicht seit Contract v81, weil die
 *                     Projektkachel und die Projektdetails sie anzeigen.
 * @param facultyId    Fakultaet, zu der der Studiengang gehoert. Pflicht, weil
 *                     die Fremdschluesselspalte {@code not null} ist; eine
 *                     unbekannte ID ergibt 400.
 */
public record StudyProgramCreateRequest(

		@Schema(description = "Ausgeschriebener Name des Studiengangs.",
				example = "Medieninformatik")
		@NotBlank(message = "Name fehlt.")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Kurzform des Studiengangs.", example = "MI")
		@NotBlank(message = "Kurzform fehlt.")
		@Size(max = 64, message = "Kurzform ist zu lang.")
		String abbreviation,

		@Schema(description = "ID der Fakultaet aus GET /api/faculties.")
		@NotNull(message = "Fakultaet fehlt.")
		UUID facultyId) {
}
