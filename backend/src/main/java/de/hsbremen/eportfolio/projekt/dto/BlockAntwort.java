package de.hsbremen.eportfolio.projekt.dto;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockTyp;
import de.hsbremen.eportfolio.projekt.Block;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Inhaltsblock in {@code ProjektDetailAntwort} (§3.4).
 *
 * <p>{@code inhalt} geht unveraendert als JSON heraus: es ist genau ein
 * Top-Level-Knoten des ProseMirror-Dokuments (§2.5), den der Editor so wieder
 * einliest, wie er ihn geschrieben hat. Jede Umformung hier waere eine zweite
 * Schema-Definition neben der des Editors und muesste bei jeder Aenderung
 * mitgezogen werden.
 *
 * @param id            stabile Block-ID; der Autosave-Pfad aus §6.1 schickt sie
 *                      zurueck, damit Blocke aktualisiert statt neu angelegt
 *                      werden
 * @param typ           abfragbare Projektion von {@code inhalt.type} (§2.5)
 * @param reihenfolge   Sortierindex, lueckenlos ab 0
 * @param inhalt        ProseMirror-Knoten
 * @param schemaVersion Version des Editor-Schemas, gegen das der Knoten
 *                      geschrieben wurde (§2.10)
 */
public record BlockAntwort(
		UUID id,

		BlockTyp typ,

		int reihenfolge,

		@Schema(description = "Top-Level-Knoten des ProseMirror-Dokuments, unveraendert (§2.5).",
				type = "object")
		JsonNode inhalt,

		int schemaVersion) {

	public static BlockAntwort aus(Block block) {
		return new BlockAntwort(
				block.getId(),
				block.getTyp(),
				block.getReihenfolge(),
				block.getInhalt(),
				block.getSchemaVersion());
	}
}
