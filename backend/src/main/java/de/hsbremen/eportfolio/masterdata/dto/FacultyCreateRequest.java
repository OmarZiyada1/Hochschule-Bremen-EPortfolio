package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code POST /api/admin/faculties} (§6.1, §3.8).
 *
 * @param name         ausgeschriebener Name. In der Tabelle <em>nicht</em>
 *                     eindeutig, siehe {@link #abbreviation}.
 * @param abbreviation Kuerzel wie {@code FK4}. In {@code faculty.abbreviation}
 *                     eindeutig; ein bereits vergebenes Kuerzel ergibt 409
 *                     {@code RESOURCE_IN_USE}.
 */
public record FacultyCreateRequest(

		@Schema(description = "Ausgeschriebener Name der Fakultaet.",
				example = "Elektrotechnik und Informatik")
		@NotBlank(message = "Name fehlt.")
		@Size(max = 255, message = "Name ist zu lang.")
		String name,

		// Unique ist in der Tabelle das Kuerzel und nicht der Name. Das passt zur
		// Sache: der ausgeschriebene Name einer Fakultaet aendert sich mit
		// Umbenennungen, das Kuerzel ist die Kennung, unter der sie an der
		// Hochschule gefuehrt wird.
		@Schema(description = "Kuerzel der Fakultaet, eindeutig.", example = "FK4")
		@NotBlank(message = "Kuerzel fehlt.")
		@Size(max = 64, message = "Kuerzel ist zu lang.")
		String abbreviation) {
}
