package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.masterdata.Category;
import de.hsbremen.eportfolio.masterdata.Faculty;
import de.hsbremen.eportfolio.masterdata.Module;
import de.hsbremen.eportfolio.masterdata.StudyProgram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Stammdatenbezug eines Projekts: Kategorie, Fakultaet, Studiengang oder
 * Modul (§3.6 bis §3.9).
 *
 * <p>Ein gemeinsames Record fuer alle vier, weil die Projektantwort von ihnen
 * genau dasselbe braucht: die ID zum Weiterfiltern und einen anzeigbaren Namen.
 * Vier fast gleiche Records wuerden das Frontend zwingen, viermal denselben
 * Baustein zu bauen. Die vollstaendigen Stammdaten samt ihrer Hierarchie
 * liefern weiterhin die Endpoints aus §6.1 (Stammdaten).
 *
 * <p>Alle Bezuege sind am Projekt <em>nullable</em> (§3.3): im {@code DRAFT}
 * duerfen sie fehlen, Pflicht werden sie erst beim Einreichen.
 *
 * @param id           ID der Stammdatenzeile, zugleich Filterwert von
 *                     {@code GET /api/projects}
 * @param name         ausgeschriebener Name
 * @param abbreviation Kurzform; bei der Kategorie gibt es keine, dort immer
 *                     {@code null}
 */
public record ReferenceResponse(
		UUID id,

		String name,

		@Schema(description = "Kurzform, z. B. \"FK4\". Fehlt bei Kategorien und kann "
				+ "auch bei Studiengang und Modul null sein.", nullable = true)
		String abbreviation) {

	/** Die Kategorie fuehrt kein Kuerzel (§3.6). */
	public static ReferenceResponse from(Category category) {
		if (category == null) {
			return null;
		}
		return new ReferenceResponse(category.getId(), category.getName(), null);
	}

	public static ReferenceResponse from(Faculty faculty) {
		if (faculty == null) {
			return null;
		}
		return new ReferenceResponse(faculty.getId(), faculty.getName(), faculty.getAbbreviation());
	}

	public static ReferenceResponse from(StudyProgram studyProgram) {
		if (studyProgram == null) {
			return null;
		}
		return new ReferenceResponse(studyProgram.getId(), studyProgram.getName(),
				studyProgram.getAbbreviation());
	}

	public static ReferenceResponse from(Module module) {
		if (module == null) {
			return null;
		}
		return new ReferenceResponse(module.getId(), module.getName(), module.getAbbreviation());
	}
}
