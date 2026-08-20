package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Antwort von {@code POST /api/admin/projects/status} (§6.1, KAN-46): je ein
 * {@link ProjectBulkStatusResultResponse} zu jeder angefragten ID, in der Reihenfolge
 * des Bodys.
 *
 * <p><strong>Der Statuscode ist 200, auch wenn jede Zeile gescheitert ist.</strong>
 * Die Anfrage selbst war in Ordnung und wurde vollstaendig bearbeitet; was
 * einzelne Projekte betrifft, steht in ihren Zeilen. Ein 4xx haette hier kein
 * Envelope nach §6.2 tragen koennen, das mehr als einen Grund nennt.
 *
 * <p><strong>Ein Objekt und keine nackte Liste</strong>, damit sich spaeter ein
 * Feld daneben ergaenzen laesst, ohne den Typ zu brechen, den das Frontend aus
 * {@code /v3/api-docs} erzeugt. Entschieden in der Klaerungsrunde zu KAN-46.
 *
 * <p><strong>Keine Bilanz und keine Zaehlung.</strong> Wie viele Zeilen
 * erfolgreich waren, ergibt sich aus der Liste; eine zweite Darstellung
 * derselben Auskunft koennte von ihr abweichen.
 *
 * @param results je Zeile ein Ergebnis, gleiche Anzahl und gleiche Reihenfolge
 *                wie {@code projectIds} im Body
 */
public record ProjectBulkStatusResponse(

		@Schema(description = "Ein Ergebnis je angefragter Projekt-ID, in der Reihenfolge des "
				+ "Bodys.")
		List<ProjectBulkStatusResultResponse> results) {
}
