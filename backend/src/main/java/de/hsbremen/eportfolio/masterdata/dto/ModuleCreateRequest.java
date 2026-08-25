package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body von {@code POST /api/admin/modules} (§6.1, §3.9).
 *
 * @param name           ausgeschriebener Name.
 * @param abbreviation   Kurzform. Pflicht seit Contract v81, wie beim
 *                       Studiengang.
 * @param studyProgramId Studiengang, zu dem das Modul gehoert. Pflicht, weil die
 *                       Fremdschluesselspalte {@code not null} ist; eine
 *                       unbekannte ID ergibt 400.
 */
public record ModuleCreateRequest(

		@Schema(description = "Ausgeschriebener Name des Moduls.",
				example = "Mensch-Computer-Interaktion")
		@NotBlank(message = "Name fehlt.")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		@Schema(description = "Kurzform des Moduls.", example = "MCI")
		@NotBlank(message = "Kurzform fehlt.")
		@Size(max = 64, message = "Kurzform ist zu lang.")
		String abbreviation,

		@Schema(description = "ID des Studiengangs aus GET /api/study-programs.")
		@NotNull(message = "Studiengang fehlt.")
		UUID studyProgramId) {
}
