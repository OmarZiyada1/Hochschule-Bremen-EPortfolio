package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.project.Block;
import de.hsbremen.eportfolio.project.Project;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Comparator;
import java.util.List;

/**
 * Antwort von {@code GET} und {@code PUT /api/projects/{id}/blocks} (§6.1).
 *
 * <p><strong>Warum die Antwort die Bloecke zurueckliefert.</strong> Neue Bloecke
 * schickt der Client ohne {@code id}, die UUIDs entstehen serverseitig. Ohne
 * Rueckgabe haette der Editor beim naechsten Autosave-Takt keine IDs fuer die
 * eben gespeicherten Bloecke und legte sie erneut an; der Upsert waere
 * wirkungslos (§6.1).
 *
 * <p><strong>Warum {@code version} dabei ist.</strong> Ohne die neue Version
 * scheitert der folgende Request am Optimistic Locking (§6.4). Deshalb steht sie
 * auch in der Antwort auf {@code GET}: §6.4 verlangt sie „bei jedem GET", und
 * der Editor kaeme sonst nur ueber einen zweiten Aufruf von
 * {@code GET /projects/{id}} an den Wert, den er fuer sein erstes Speichern
 * braucht.
 *
 * @param version aktueller Stand des Projekts fuer den naechsten schreibenden
 *                Request (§6.4)
 * @param blocks  Inhalt des Projekts, geordnet nach {@code orderIndex}
 */
public record BlocksResponse(
		@Schema(description = "Stand des Projekts fuer den naechsten schreibenden Request (§6.4).",
				example = "4")
		Long version,

		@Schema(description = "Inhalt des Projekts, geordnet nach orderIndex.")
		List<BlockResponse> blocks) {

	/**
	 * Baut die Antwort aus dem Projekt und seinen Bloecken.
	 *
	 * <p>Ausdruecklich hier sortiert und nicht auf die Lesereihenfolge des
	 * {@code @OrderBy} an {@code Project.blocks} verlassen: nach einem Autosave
	 * steht die Sammlung in der Reihenfolge im Arbeitsspeicher, in der sie
	 * veraendert wurde, und die muss nicht die neue Sortierung sein. Der Client
	 * baut aus dieser Liste sein Dokument auf; eine falsche Reihenfolge waere
	 * dort ein sichtbarer Fehler.
	 */
	public static BlocksResponse from(Project project, List<Block> blocks) {
		return new BlocksResponse(
				project.getVersion(),
				blocks.stream()
						.sorted(Comparator.comparingInt(Block::getOrderIndex))
						.map(BlockResponse::from)
						.toList());
	}
}
