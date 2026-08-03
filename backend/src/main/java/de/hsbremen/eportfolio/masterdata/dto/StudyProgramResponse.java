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
 * @param abbreviation Kurzform; in der Tabelle nullable und deshalb auch hier
 *                     moeglicherweise {@code null}
 * @param facultyId    Fakultaet, zu der der Studiengang gehoert
 */
public record StudyProgramResponse(
		UUID id,

		String name,

		// Anders als bei der Fakultaet ist diese Spalte nullable (Migration 2).
		// Ohne den Hinweis baut das Frontend die Anzeige auf einen Wert, den es
		// nicht immer gibt.
		@Schema(description = "Kurzform des Studiengangs. Kann fehlen.", nullable = true)
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
