package de.hsbremen.eportfolio.masterdata.dto;

import de.hsbremen.eportfolio.masterdata.Semester;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Semester in der Antwort von {@code GET /api/semesters} und der
 * Semester-Verwaltung (§6.1, §3.18).
 *
 * <p>Eigenes Record und keine serialisierte Entity, aus demselben Grund wie bei
 * {@link CategoryResponse}.
 *
 * <p>{@code active} und {@code sortOrder} stehen auch in der oeffentlichen
 * Antwort und nicht nur in der Admin-Sicht. Beides ist nichts Schuetzenswertes,
 * und die Projektbibliothek braucht sie: die Filtergruppe zeigt auch
 * abgelaufene Semester, muss aber erkennen koennen, welche davon bei der
 * Projektanlage noch zur Auswahl stehen. Ein zweites Record allein fuer diesen
 * Unterschied waere eine Kopie, die beim naechsten Feld auseinanderlaeuft.
 *
 * @param id        technischer Schluessel; zugleich Filterwert von
 *                  {@code GET /api/projects?semester=}
 * @param name      Anzeigename, in {@code semester.name} eindeutig
 * @param active    steht das Semester bei der Projektanlage zur Auswahl?
 * @param sortOrder Reihenfolge in Liste, Auswahl und Filter
 */
public record SemesterResponse(
		UUID id,

		String name,

		@Schema(description = "Nur aktive Semester stehen beim Anlegen und Bearbeiten eines "
				+ "Projekts zur Auswahl. Ein inaktives bleibt an bestehenden Projekten und "
				+ "als Filterwert erhalten.", example = "true")
		boolean active,

		@Schema(description = "Reihenfolge in Liste und Auswahl, von der Administration gesetzt. "
				+ "Kleiner heisst weiter oben.", example = "3")
		int sortOrder) {

	public static SemesterResponse from(Semester semester) {
		return new SemesterResponse(semester.getId(), semester.getName(), semester.isActive(),
				semester.getSortOrder());
	}
}
