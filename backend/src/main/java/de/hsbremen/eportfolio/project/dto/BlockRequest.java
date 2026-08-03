package de.hsbremen.eportfolio.project.dto;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.UUID;

/**
 * Ein Inhaltsblock im Autosave-Pfad {@code PUT /api/projects/{id}/blocks}
 * (§6.1). Gegenstueck zu {@link BlockResponse}.
 *
 * <p><strong>Warum {@code type} ein {@code String} ist</strong> und nicht das
 * Enum {@code BlockType}: ein unbekannter Wert scheiterte als Enum schon an der
 * JSON-Umwandlung, also bevor fachlicher Code laeuft. Die Antwort waere dann
 * <strong>400</strong> {@code VALIDATION_FAILED}, und §6.2 fuehrt fuer diesen
 * Fall ausdruecklich {@code BLOCK_TYPE_UNKNOWN}. Der Unterschied ist fuer den
 * Editor nicht kosmetisch: „diesen Blocktyp gibt es nicht" nennt den Block, den
 * er nicht speichern kann, „die Anfrage ist ungueltig" nicht.
 *
 * @param id            {@code null} legt einen neuen Block an, ein Wert
 *                      aktualisiert den vorhandenen (§6.1, „Stabile
 *                      Block-IDs"). Eine ID, die es nicht gibt oder die zu einem
 *                      anderen Projekt gehoert, ergibt <strong>400</strong>
 * @param type          Blocktyp aus §2.5, als Zeichenkette
 * @param orderIndex    Sortierindex; ueber die ganze Liste lueckenlos ab 0,
 *                      sonst <strong>400</strong> (§3.4)
 * @param content       genau ein Top-Level-Knoten des ProseMirror-Dokuments,
 *                      unveraendert (§2.5)
 * @param schemaVersion Version des Editor-Schemas (§2.10); fehlt sie, gilt 1 wie
 *                      der Default der Spalte
 */
public record BlockRequest(
		@Schema(description = "ID eines vorhandenen Blocks. Weglassen legt einen neuen an; die "
				+ "server-vergebene UUID steht in der Antwort.", nullable = true)
		UUID id,

		@Schema(description = "Blocktyp aus §2.5. Ein unbekannter Wert ergibt 400 "
				+ "BLOCK_TYPE_UNKNOWN.", example = "TEXT")
		@NotBlank(message = "type fehlt.")
		String type,

		@Schema(description = "Sortierindex. Ueber die gesamte Liste lueckenlos ab 0.",
				example = "0")
		@NotNull(message = "orderIndex fehlt.")
		@PositiveOrZero(message = "orderIndex darf nicht negativ sein.")
		Integer orderIndex,

		@Schema(description = "Top-Level-Knoten des ProseMirror-Dokuments, unveraendert (§2.5).",
				type = "object")
		@NotNull(message = "content fehlt.")
		JsonNode content,

		@Schema(description = "Version des Editor-Schemas (§2.10). Fehlt sie, gilt 1.",
				example = "1", nullable = true)
		@Positive(message = "schemaVersion muss groesser als 0 sein.")
		Integer schemaVersion) {

	/** Default aus §2.10 und aus der Spaltendefinition von {@code block}. */
	public static final int DEFAULT_SCHEMA_VERSION = 1;

	/**
	 * {@code schemaVersion} mit Default. Ein Editor, der das Feld nicht kennt,
	 * schreibt damit dasselbe wie einer, der ausdruecklich {@code 1} schickt.
	 */
	public int schemaVersionOrDefault() {
		return schemaVersion == null ? DEFAULT_SCHEMA_VERSION : schemaVersion;
	}
}
