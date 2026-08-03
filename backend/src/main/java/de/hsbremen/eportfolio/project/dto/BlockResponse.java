package de.hsbremen.eportfolio.project.dto;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.project.Block;
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
		return new BlockResponse(
				block.getId(),
				block.getType(),
				block.getOrderIndex(),
				block.getContent(),
				block.getSchemaVersion());
	}
}
