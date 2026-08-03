package de.hsbremen.eportfolio.masterdata.dto;

import de.hsbremen.eportfolio.masterdata.Faculty;
import java.util.UUID;

/**
 * Eine Fakultaet in der Antwort von {@code GET /api/faculties} (§6.1).
 *
 * @param id           technischer Schluessel, zugleich der Filterwert von
 *                     {@code GET /api/study-programs?faculty={id}}
 * @param name         ausgeschriebener Name, z. B. „Elektrotechnik und Informatik"
 * @param abbreviation Kurzform wie {@code FK4}; in {@code faculty.abbreviation}
 *                     eindeutig und not null
 */
public record FacultyResponse(UUID id, String name, String abbreviation) {

	public static FacultyResponse from(Faculty faculty) {
		return new FacultyResponse(faculty.getId(), faculty.getName(), faculty.getAbbreviation());
	}
}
