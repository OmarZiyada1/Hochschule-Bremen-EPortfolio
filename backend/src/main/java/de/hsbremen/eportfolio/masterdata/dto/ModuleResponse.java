package de.hsbremen.eportfolio.masterdata.dto;

import de.hsbremen.eportfolio.masterdata.Module;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Modul in der Antwort von {@code GET /api/modules} (§6.1).
 *
 * @param id             technischer Schluessel
 * @param name           ausgeschriebener Name
 * @param abbreviation   Kurzform; seit Contract v81 Pflicht und damit nie
 *                       {@code null}
 * @param studyProgramId Studiengang, zu dem das Modul gehoert
 * @param collective     ob dies das Sammelmodul des Studiengangs ist (§3.9,
 *                       seit Contract v84)
 */
public record ModuleResponse(
		UUID id,

		String name,

		@Schema(description = "Kurzform des Moduls, z. B. \"MMI\".", example = "MMI")
		String abbreviation,

		@Schema(description = "Studiengang, zu dem das Modul gehoert. Derselbe Wert "
				+ "dient als Filter: GET /api/modules?studyProgram={id}.")
		UUID studyProgramId,

		@Schema(description = "Das Sammelmodul des Studiengangs: waehlbar, wenn kein "
				+ "Fachmodul passt (§3.9). Je Studiengang gibt es genau eines. Die "
				+ "Oberflaeche stellt es ans Listenende.", example = "false")
		boolean collective) {

	public static ModuleResponse from(Module module) {
		return new ModuleResponse(
				module.getId(),
				module.getName(),
				module.getAbbreviation(),
				module.getStudyProgram().getId(),
				module.isCollective());
	}
}
