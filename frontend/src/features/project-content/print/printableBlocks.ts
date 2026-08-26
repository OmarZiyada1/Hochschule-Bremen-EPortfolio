import type { BlockResponse } from "@/api/types"
import {
  BLOCK_SCHEMA_VERSION,
  docToBlocks,
} from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"

/**
 * Das Dokument der Schreibflaeche als Blockliste fuer den Druckbereich
 * (KAN-41).
 *
 * <p><strong>Warum nicht die gespeicherte Liste.</strong> Der Editor liest
 * seine Bloecke einmal beim Oeffnen; danach ist das Dokument der Stand, und
 * der Speichertakt laeuft dem Tippen mit gut einer Sekunde hinterher. Wer
 * einen Satz schreibt und sofort druckt, bekaeme sonst das Blatt von
 * vorhin. Gedruckt wird deshalb, was auf der Schreibflaeche steht.
 *
 * <p><strong>Es ist dieselbe Uebersetzung wie beim Speichern.</strong>
 * {@code docToBlocks} laesst den leeren Schlussabsatz und jeden
 * unvollstaendigen Medienknoten weg, also genau das, was auch nicht
 * gespeichert wuerde: der Ausdruck zeigt damit den Beitrag und nicht den
 * Bedienzustand des Editors.
 *
 * <p><strong>Die Kennung ist hier nur ein Schluessel.</strong> Ein noch
 * nicht gespeicherter Block hat keine, und der Lesepfad braucht eine, um
 * seine Liste stabil zu halten. Sie kommt deshalb aus der Position und geht
 * nirgends hin: diese Liste wird nie geschrieben, sie wird gedruckt.
 */
export function printableBlocks(doc: ProjectDocument): BlockResponse[] {
  return docToBlocks(doc).map((block, index) => ({
    id: block.id ?? `print-${index}`,
    type: block.type,
    orderIndex: block.orderIndex,
    /* Am Request ist die Fassung optional, an der Antwort nicht. Gesetzt
       wird sie von docToBlocks ohnehin immer; der Rueckfall haelt nur den
       Typ zusammen. */
    schemaVersion: block.schemaVersion ?? BLOCK_SCHEMA_VERSION,
    /*
     * docToBlocks liefert den geprueften Knoten aus dem Typmodell; die
     * Generierung kennt fuer JsonNode nur Record<string, never>. Dieselbe
     * Umdeutung nimmt ContentBlockResponse vor, nur in die andere Richtung
     * (blockTypes).
     */
    content: block.content as unknown as BlockResponse["content"],
  }))
}
