package de.hsbremen.eportfolio.project.dto;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.project.Block;
import de.hsbremen.eportfolio.project.BlockSchemaMigration;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Inhaltsblock in {@code ProjectDetailResponse} (§3.4).
 *
 * <p>{@code content} geht unveraendert als JSON heraus: es ist genau ein
 * Top-Level-Knoten des ProseMirror-Dokuments (§2.5), den der Editor so wieder
 * einliest, wie er ihn geschrieben hat. Jede Umformung hier waere eine zweite
 * Schema-Definition neben der des Editors und muesste bei jeder Aenderung
 * mitgezogen werden.
 *
 * <p><strong>Die eine Ausnahme ist die Schemamigration</strong> (§2.10,
 * KAN-72). Steht in der Zeile eine aeltere {@code schemaVersion}, bringt
 * {@link BlockSchemaMigration} den Knoten beim Lesen in die aktuelle Form, und
 * die Antwort meldet die neue Version. Das ist keine zweite Schemadefinition,
 * sondern die von §2.10 verlangte Uebersetzung: ohne sie liesse sich ein
 * Dokument aus einer aelteren Version nicht mehr speichern, weil der
 * Schreibweg die alten Attributformen seit v51 abweist. Diese Fabrik ist der
 * einzige Weg vom {@link Block} in eine Antwort, deshalb steht die Migration
 * hier und nicht in jedem Aufrufer.
 *
 * @param id            stabile Block-ID; der Autosave-Pfad aus §6.1 schickt sie
 *                      zurueck, damit Blocke aktualisiert statt neu angelegt
 *                      werden
 * @param type          abfragbare Projektion von {@code content.type} (§2.5)
 * @param orderIndex    Sortierindex, lueckenlos ab 0
 * @param content       ProseMirror-Knoten
 * @param schemaVersion Version des Editor-Schemas, gegen das der Knoten
 *                      geschrieben wurde (§2.10)
 */
public record BlockResponse(
		UUID id,

		BlockType type,

		int orderIndex,

		@Schema(description = "Top-Level-Knoten des ProseMirror-Dokuments, unveraendert (§2.5).",
				type = "object")
		JsonNode content,

		int schemaVersion) {

	public static BlockResponse from(Block block) {
		JsonNode content = BlockSchemaMigration.toCurrent(
				block.getType(), block.getContent(), block.getSchemaVersion());
		return new BlockResponse(
				block.getId(),
				block.getType(),
				block.getOrderIndex(),
				content,
				Math.max(block.getSchemaVersion(), BlockSchemaMigration.CURRENT_VERSION));
	}
}
