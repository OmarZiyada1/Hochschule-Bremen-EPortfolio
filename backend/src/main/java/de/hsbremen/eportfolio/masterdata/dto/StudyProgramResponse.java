package de.hsbremen.eportfolio.masterdata.dto;

import de.hsbremen.eportfolio.masterdata.StudyProgram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Studiengang in der Antwort von {@code GET /api/study-programs} (§6.1).
 *
 * @param id           technischer Schluessel, zugleich der Filterwert von
 *                     {@code GET /api/modules?studyProgram={id}}
 * @param name         ausgeschriebener Name
 * @param abbreviation Kurzform; seit Contract v81 Pflicht und damit nie
 *                     {@code null}
 * @param facultyId    Fakultaet, zu der der Studiengang gehoert
 */
public record StudyProgramResponse(
		UUID id,

		String name,

		// Seit Contract v81 wie bei der Fakultaet: not null. Bis dahin war die
		// Spalte nullable, und die Projektkachel haette das Kuerzel nicht
		// verlaesslich zeigen koennen (Migration 23).
		@Schema(description = "Kurzform des Studiengangs, z. B. \"MIN\".", example = "MIN")
		String abbreviation,

		@Schema(description = "Fakultaet, zu der der Studiengang gehoert. Derselbe Wert "
				+ "dient als Filter: GET /api/study-programs?faculty={id}.")
		UUID facultyId) {

	public static StudyProgramResponse from(StudyProgram studyProgram) {
		return new StudyProgramResponse(
				studyProgram.getId(),
				studyProgram.getName(),
				studyProgram.getAbbreviation(),
				studyProgram.getFaculty().getId());
	}
}
