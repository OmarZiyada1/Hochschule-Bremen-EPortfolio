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
 * Groesse einer neuen Tabelle.
 *
 * <p><strong>Sie wird beim Einfuegen gewaehlt und nicht danach
 * zusammengeklickt.</strong> Zuvor entstand jede Tabelle als drei mal drei,
 * und wer fuenf Spalten brauchte, fuegte zweimal einzeln eine Spalte an.
 * Die Groesse ist die eine Angabe, die beim Anlegen feststeht; alles
 * andere, also Zeilen und Spalten spaeter zu aendern, Kopfzeile und
 * Kopfspalte umzuschalten, Zellen zu verbinden und zu teilen, steht in der
 * Tabellenbedienung ({@code TableControls}).
 */
export type TableSize = {
  rows: number
  cols: number
  withHeaderRow: boolean
}

/** Wie im Figma-Template: drei mal drei mit Kopfzeile. */
export const DEFAULT_TABLE_SIZE: TableSize = {
  rows: 3,
  cols: 3,
  withHeaderRow: true,
}

/**
 * Grenzen der Eingabe.
 *
 * <p>Der Contract kennt fuer {@code TABLE} keine Obergrenze, und
 * gespeichert wird auch eine grosse Tabelle anstandslos. Die Grenze steht
 * trotzdem im Eingabefeld: eine versehentlich eingetippte Zahl mit vier
 * Stellen legte den Browser lahm, bevor irgendetwas gespeichert waere.
 * Zwanzig mal zwanzig sind vierhundert Zellen und fuer einen Beitrag
 * reichlich; groesser wird die Tabelle danach ueber die Bedienung.
 */
export const TABLE_MIN = 1
export const TABLE_MAX = 20

/**
 * Der Knoten, den ein Eintrag anlegt.
 *
 * <p>Die Medienknoten entstehen leer und werden auf der Schreibflaeche
 * gefuellt; gespeichert werden sie erst mit ihren Pflichtattributen
 * ({@code blockSerialization.docToBlocks}).
 *
 * @param table Groesse einer neuen Tabelle; ohne Angabe
 *              {@link DEFAULT_TABLE_SIZE}. Fuer jeden anderen Typ ohne
 *              Wirkung.
 */
export function contentFor(
  kind: InsertKind,
  table: TableSize = DEFAULT_TABLE_SIZE
): Record<string, unknown> {
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
      return tableNode(table)
  }
}

function clamp(value: number): number {
  return Math.min(TABLE_MAX, Math.max(TABLE_MIN, Math.round(value)))
}

function tableNode(size: TableSize): Record<string, unknown> {
  const rows = clamp(size.rows)
  const cols = clamp(size.cols)
  /* Die Kopfzeile zaehlt als Zeile: „drei Zeilen mit Kopfzeile" ergibt eine
     Kopfzeile und zwei Inhaltszeilen, so wie eine Tabelle gelesen wird. */
  const bodyRows = size.withHeaderRow ? Math.max(0, rows - 1) : rows
  return {
    type: "table",
    content: [
      ...(size.withHeaderRow ? [headerRow(cols)] : []),
      ...Array.from({ length: bodyRows }, () => bodyRow(cols)),
    ],
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
