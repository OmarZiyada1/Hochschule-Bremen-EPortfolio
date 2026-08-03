package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.project.Project;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ein Projekt in der Listenansicht von {@code GET /api/projects} (§6.1).
 *
 * <p>Die Kachel traegt genau das, was Uebersicht und Filterleiste anzeigen.
 * Nicht enthalten sind {@code blocks}, {@code members}, {@code editors}, die
 * Statushistorie und {@code version}: das Blockdokument je Treffer zu laden
 * waere fuer eine Liste unverhaeltnismaessig, und die uebrigen Felder
 * unterliegen einer Sichtbarkeitspruefung, die je Projekt zu treffen waere.
 * Wer sie braucht, holt sich {@link ProjectDetailResponse}.
 *
 * @param id              ID des Projekts
 * @param title           Titel; Metadatum, kein Inhaltsblock (§3.3)
 * @param summary         Teaser fuer die Kachel
 * @param coverImageUrl   Kachelbild
 * @param status          aktueller Status (§2.2)
 * @param projectType     (§2.6)
 * @param degree          (§2.7)
 * @param semester        z. B. „WS 2025/26"
 * @param category        (§3.6)
 * @param faculty         (§3.8)
 * @param studyProgram    (§3.7)
 * @param author          Ersteller:in und Eigentuemer:in
 * @param tags            freie Schlagwoerter, hoechstens fuenf
 * @param reactionCount   {@code COUNT} der Reaktionen (§3.10)
 * @param publishedAt     gesetzt beim Uebergang nach {@code PUBLISHED}
 */
public record ProjectCardResponse(
		UUID id,

		String title,

		@Schema(description = "Teaser fuer Kachel- und Listenansicht. Kann fehlen.", nullable = true)
		String summary,

		@Schema(description = "Kachelbild. Kann fehlen.", nullable = true)
		String coverImageUrl,

		ProjectStatus status,

		@Schema(description = "Im DRAFT noch nicht gesetzt; Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		ProjectType projectType,

		@Schema(description = "Im DRAFT noch nicht gesetzt; Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		Degree degree,

		@Schema(description = "Semester der Entstehung, z. B. \"WS 2025/26\".",
				example = "WS 2025/26", nullable = true)
		String semester,

		ReferenceResponse category,

		ReferenceResponse faculty,

		ReferenceResponse studyProgram,

		PersonResponse author,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf. Alphabetisch sortiert, "
				+ "damit die Reihenfolge zwischen zwei Aufrufen stabil bleibt.")
		List<String> tags,

		@Schema(description = "Zahl der Reaktionen auf dieses Projekt (§3.10).", example = "12")
		long reactionCount,

		@Schema(description = "Zeitpunkt der Veroeffentlichung. Null, solange das Projekt "
				+ "nicht veroeffentlicht ist.", nullable = true)
		Instant publishedAt) {

	/**
	 * Baut die Kachel.
	 *
	 * <p>{@code tags} und {@code reactionCount} kommen von aussen und werden
	 * nicht am Projekt nachgeladen: der Lesedienst holt beides fuer die ganze
	 * Seite in je einer Abfrage. Wuerde dieses Record sie selbst vom Projekt
	 * ziehen, entstuenden pro Kachel zwei zusaetzliche Abfragen und damit genau
	 * das N+1-Problem, das der Ticket-Hinweis meint.
	 *
	 * @param project       Projekt mit bereits geladenen Bezuegen (Autor,
	 *                      Kategorie, Fakultaet, Studiengang)
	 * @param tags          Schlagwoerter dieses Projekts, sortiert
	 * @param reactionCount Zahl der Reaktionen
	 */
	public static ProjectCardResponse from(Project project, List<String> tags, long reactionCount) {
		return new ProjectCardResponse(
				project.getId(),
				project.getTitle(),
				project.getSummary(),
				project.getCoverImageUrl(),
				project.getStatus(),
				project.getProjectType(),
				project.getDegree(),
				project.getSemester(),
				ReferenceResponse.from(project.getCategory()),
				ReferenceResponse.from(project.getFaculty()),
				ReferenceResponse.from(project.getStudyProgram()),
				PersonResponse.from(project.getAuthor()),
				tags,
				reactionCount,
				project.getPublishedAt());
	}
}
