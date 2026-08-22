import {
  BracesIcon,
  CodeIcon,
  FileTextIcon,
  ImageIcon,
  ImagePlusIcon,
  MinusIcon,
  MusicIcon,
  SigmaIcon,
  TableIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * Die zehn einfuegbaren Blocktypen und der Knoten, den jeder anlegt
 * (Contract 2.5).
 *
 * <p><strong>Warum das hier steht und nicht in der Einfuegeleiste.</strong>
 * Seit es zwei Wege zum Einfuegen gibt, die Pille am Plus und den
 * Slash-Befehl im Text, brauchen beide dieselbe Liste und dieselben Knoten.
 * Zwei Listen liefen auseinander, und der Unterschied fiele erst auf, wenn
 * ein Typ auf einem der beiden Wege fehlt oder anders entsteht.
 *
 * <p><strong>Keine Aufgabenliste.</strong> Der alte Prototyp zeichnet an
 * dieser Stelle ein Kaestchen-Symbol; {@code taskList} ist kein Teil des
 * Schemas (Contract 2.5, „Keine Aufgabenlisten"). Das Portal ist ein
 * Praesentationsportfolio.
 */

export type InsertKind =
  | "image"
  | "gallery"
  | "video"
  | "audio"
  | "document"
  | "embed"
  | "formula"
  | "table"
  | "code"
  | "divider"

/** Reihenfolge und Symbole wie im Figma-Template. */
export const INSERT_ENTRIES: readonly { kind: InsertKind; icon: LucideIcon }[] =
  [
    { kind: "image", icon: ImageIcon },
    { kind: "gallery", icon: ImagePlusIcon },
    { kind: "video", icon: VideoIcon },
    { kind: "audio", icon: MusicIcon },
    { kind: "document", icon: FileTextIcon },
    { kind: "embed", icon: BracesIcon },
    { kind: "formula", icon: SigmaIcon },
    { kind: "table", icon: TableIcon },
    { kind: "code", icon: CodeIcon },
    { kind: "divider", icon: MinusIcon },
  ]

/**
 * Der Knoten, den ein Eintrag anlegt.
 *
 * <p>Die Medienknoten entstehen leer und werden auf der Schreibflaeche
 * gefuellt; gespeichert werden sie erst mit ihren Pflichtattributen
 * ({@code blockSerialization.docToBlocks}).
 */
export function contentFor(kind: InsertKind): Record<string, unknown> {
  switch (kind) {
    case "image":
      return { type: "imageBlock" }
    case "gallery":
      return { type: "galleryBlock" }
    case "video":
      return { type: "videoBlock" }
    case "audio":
      return { type: "audioBlock" }
    case "document":
      return { type: "documentBlock" }
    case "embed":
      return { type: "embedBlock" }
    case "formula":
      return { type: "mathBlock" }
    case "code":
      return { type: "codeBlock" }
    case "divider":
      return { type: "horizontalRule" }
    case "table":
      /* Drei mal drei mit Kopfzeile, wie im Template. */
      return {
        type: "table",
        content: [headerRow(3), bodyRow(3), bodyRow(3)],
      }
  }
}

function headerRow(cells: number): Record<string, unknown> {
  return {
    type: "tableRow",
    content: Array.from({ length: cells }, () => ({
      type: "tableHeader",
      content: [{ type: "paragraph" }],
    })),
  }
}

function bodyRow(cells: number): Record<string, unknown> {
  return {
    type: "tableRow",
    content: Array.from({ length: cells }, () => ({
      type: "tableCell",
      content: [{ type: "paragraph" }],
    })),
  }
}
