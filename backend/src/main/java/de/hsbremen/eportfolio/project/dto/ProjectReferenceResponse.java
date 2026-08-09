package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.project.Project;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Projekt als reiner Verweis: ID zum Verlinken, Titel zum Anzeigen.
 *
 * <p><strong>Warum nicht {@link ProjectCardResponse}.</strong> Die Kachel ist die
 * richtige Antwort, wenn ein Projekt <em>gezeigt</em> wird: Titel, Teaser,
 * Kachelbild, Stammdatenbezuege und Reaktionszahl. In einem Protokoll wird es
 * dagegen nur <em>genannt</em>. Eine Kachel je Zeile muesste Tags und
 * Reaktionszahlen fuer Projekte nachladen, die dort nur als Historie stehen, und
 * sie liesse eine Zeile wie einen aktuellen Bestand aussehen, obwohl sie
 * festhaelt, dass das Projekt die Liste verlassen hat.
 *
 * <p>Erster Aufrufer ist {@code Top10AuditEntryResponse} (§3.17, KAN-45). Das
 * Gegenstueck fuer Personen ist {@link PersonResponse}, das fuer Stammdaten
 * {@link ReferenceResponse}; ein Projekt braucht ein eigenes Record, weil sein
 * anzeigbares Feld {@code title} heisst und nicht {@code name}.
 *
 * @param id    ID des Projekts, zugleich Pfadwert von
 *              {@code GET /api/projects/{id}}
 * @param title Titel; Metadatum, kein Inhaltsblock (§3.3)
 */
@Schema(name = "ProjectReferenceResponse",
		description = "Verweis auf ein Projekt: ID und Titel.")
public record ProjectReferenceResponse(
		UUID id,

		String title) {

	/**
	 * @param project darf {@code null} sein, dann ist auch das Ergebnis
	 *                {@code null}. Das ist kein Randfall: das Protokoll der
	 *                Top-10 verliert seinen Projektverweis, wenn das Projekt
	 *                geloescht wird (§3.17)
	 */
	public static ProjectReferenceResponse from(Project project) {
		if (project == null) {
			return null;
		}
		return new ProjectReferenceResponse(project.getId(), project.getTitle());
	}
}
