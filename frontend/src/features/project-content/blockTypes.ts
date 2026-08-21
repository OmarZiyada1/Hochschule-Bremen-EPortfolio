import type { BlockRequest, BlockResponse, BlockType } from "@/api/types"

import type { ContentColorRole } from "@/features/project-content/contentColors"
import type {
  EmbedProvider,
  VideoProvider,
} from "@/features/project-content/providers"

/**
 * Das Typmodell fuer {@code Block.content} (Contract 2.5, 3.4).
 *
 * <p><strong>Warum diese Datei von Hand entsteht und sonst nichts.</strong>
 * Response- und Request-Huellen kommen aus der Generierung
 * (Frontend-Regel 2): BlockRequest, BlockResponse, BlocksResponse,
 * BlocksUpdateRequest und der Enum BlockType stehen in
 * {@code api/schema.d.ts}. Nur {@code content} gibt sie nicht her: springdoc
 * erzeugt fuer JsonNode ein {@code Record<string, never>}, also einen Typ
 * ohne jede Eigenschaft. Gegen ihn liesse sich weder lesen noch schreiben.
 *
 * <p><strong>Enge Typen statt {@code number}.</strong> {@code width: 80},
 * {@code columns: 4} und {@code width: "50"} sind Typfehler und keine
 * Laufzeitueberraschung: der Server weist dieselben Werte mit 400
 * BLOCK_CONTENT_INVALID ab, und ein Typfehler faellt beim Uebersetzen auf.
 * Was der Compiler verhindert, prueft die Whitelist beim Lesen noch einmal
 * ({@code blockSanitize.ts}): der Bestand kann Werte tragen, die der
 * Schreibweg kuenftig zurueckweist.
 *
 * <p><strong>Fuenfzehn Knotennamen auf vierzehn Blocktypen</strong>, weil
 * LIST die beiden Listenarten zusammenfasst. Contract 2.5 sagt nicht, wie
 * beim Lesen unterschieden wird; unterschieden wird ueber
 * {@code content.type}, wie serverseitig in
 * {@code BlockValidationService.ALLOWED_NODE_TYPES}.
 */

/* ------------------------------------------------------------------ */
/* Attributwerte mit fester Wertemenge                                  */
/* ------------------------------------------------------------------ */

/**
 * Ueberschriftenebenen 1 bis 6 (Contract 2.5 seit v63).
 *
 * <p>Der gespeicherte Wert ist die <strong>Gliederungsebene des
 * Beitrags</strong> und nicht das HTML-Element: die einzige Ebene 1 einer
 * Projektseite bleibt der Projekttitel aus {@code Project.title} (3.3),
 * deshalb schiebt die Anzeige jede Ebene um genau eine Stufe nach unten
 * ({@code headingRendering.ts}). Eine zweite Ebene 1 im selben Dokument
 * machte die Gliederung fuer Screenreader mehrdeutig (SC 1.3.1).
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** Ausrichtung eines Absatzes (Contract 2.5). */
export type ContentTextAlign = "left" | "center" | "right" | "justify"

/**
 * Ausrichtung einer Ueberschrift (Contract 2.5 seit v63): dieselben Werte
 * ohne {@code justify}. Blocksatz an einer ein- oder zweizeiligen
 * Ueberschrift erzeugt Wortabstaende, die den Zeilenfall zerreissen, ohne
 * einen Satzspiegel zu gewinnen; serverseitig ergibt er 400
 * {@code BLOCK_CONTENT_INVALID}.
 */
export type HeadingTextAlign = Exclude<ContentTextAlign, "justify">

/** Bildbreite in Prozent der Textspalte: genau drei Stufen (Contract 2.5). */
export type ImageWidth = 100 | 75 | 50

/** Spaltenzahl der Galerie: genau zwei Werte (Contract 2.5). */
export type GalleryColumns = 2 | 3

/**
 * Ein Galerieeintrag. Die Reihenfolge des Arrays ist die
 * Anzeigereihenfolge; {@code alt} darf leer sein und heisst dann
 * ausdruecklich "schmueckend" (SC 1.1.1, Contract 2.5 seit v51).
 */
export type GalleryItem = { fileId: string; alt: string }

/**
 * Die beiden Videoquellen (Contract 2.5 seit v51): entweder die
 * hochgeladene Datei oder die Einbettung, nie beides und nie keine. Die
 * {@code never}-Zweige sind der Grund fuer diese Form: ohne sie liesse sich
 * ein Objekt mit fileId <em>und</em> provider bilden, das der Server mit
 * 400 abweist.
 */
export type VideoSource =
  | { fileId: string; provider?: never; videoId?: never }
  | { fileId?: never; provider: VideoProvider; videoId: string }

/* ------------------------------------------------------------------ */
/* Inline: Text und die zehn Marks                                      */
/* ------------------------------------------------------------------ */

/**
 * Die zehn zulaessigen Marks aus Contract 2.5, abschliessend. Sie sind nur
 * in HEADING, TEXT, LIST, QUOTE und TABLE erlaubt; in einem Medien- oder
 * Strukturblock gibt es keinen Textknoten, den sie auszeichnen koennten.
 */
export type ContentMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "code" }
  | { type: "superscript" }
  | { type: "subscript" }
  | { type: "link"; attrs: { href: string } }
  | { type: "textStyle"; attrs: { color: ContentColorRole } }
  | { type: "highlight"; attrs: { color: ContentColorRole } }

/** Textknoten mit optionalen Marks. Der einzige Blattknoten des Modells. */
export type TextNode = { type: "text"; text: string; marks?: ContentMark[] }

export type InlineNode = TextNode

/* ------------------------------------------------------------------ */
/* Struktur- und Textblocke                                             */
/* ------------------------------------------------------------------ */

export type HeadingNode = {
  type: "heading"
  attrs: { level: HeadingLevel; textAlign?: HeadingTextAlign | null }
  content?: InlineNode[]
}

export type ParagraphNode = {
  type: "paragraph"
  attrs?: { textAlign?: ContentTextAlign | null }
  content?: InlineNode[]
}

/** Inhalt eines Listeneintrags und einer Tabellenzelle (Contract 2.5). */
export type FlowNode = ParagraphNode | BulletListNode | OrderedListNode

export type ListItemNode = { type: "listItem"; content?: FlowNode[] }

export type BulletListNode = { type: "bulletList"; content?: ListItemNode[] }

export type OrderedListNode = {
  type: "orderedList"
  attrs?: { start?: number | null }
  content?: ListItemNode[]
}

export type BlockquoteNode = {
  type: "blockquote"
  content?: ParagraphNode[]
}

export type CodeBlockNode = {
  type: "codeBlock"
  attrs?: { language?: string | null }
  content?: TextNode[]
}

export type HorizontalRuleNode = { type: "horizontalRule" }

export type TableCellNode = {
  type: "tableCell" | "tableHeader"
  attrs?: { colspan?: number | null; rowspan?: number | null }
  content?: FlowNode[]
}

export type TableRowNode = { type: "tableRow"; content?: TableCellNode[] }

/**
 * Der Tabellenknoten. {@code caption} steht nicht im Tiptap-Schema und
 * entsteht im Editor nicht; ein Bestand, der es traegt, verliert es beim
 * Lesen aber nicht, und der Renderer gibt dann ein {@code caption}-Element
 * aus. {@code colwidth} an den Zellen faellt dagegen weg, weil das
 * Tabellenschema mit {@code resizable: false} laeuft.
 */
export type TableNode = {
  type: "table"
  attrs?: { caption?: string | null }
  content?: TableRowNode[]
}

/* ------------------------------------------------------------------ */
/* Die sieben Medien- und Formelknoten                                  */
/* ------------------------------------------------------------------ */

export type ImageBlockNode = {
  type: "imageBlock"
  attrs: { fileId: string; alt: string; caption: string; width: ImageWidth }
}

export type GalleryBlockNode = {
  type: "galleryBlock"
  attrs: { items: GalleryItem[]; columns: GalleryColumns; caption: string }
}

export type VideoBlockNode = {
  type: "videoBlock"
  attrs: VideoSource & { caption: string }
}

export type AudioBlockNode = {
  type: "audioBlock"
  attrs: { fileId: string; caption: string }
}

export type DocumentBlockNode = {
  type: "documentBlock"
  attrs: { fileId: string; fileName: string; size: number }
}

export type EmbedBlockNode = {
  type: "embedBlock"
  attrs: { provider: EmbedProvider; embedUrl: string; height: number }
}

export type MathBlockNode = {
  type: "mathBlock"
  attrs: { latex: string }
}

/* ------------------------------------------------------------------ */
/* Dokument und Zuordnung auf den Enum                                  */
/* ------------------------------------------------------------------ */

/** Die fuenfzehn zulaessigen Top-Level-Knoten. Ein Block ist genau einer. */
export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | CodeBlockNode
  | HorizontalRuleNode
  | TableNode
  | ImageBlockNode
  | GalleryBlockNode
  | VideoBlockNode
  | AudioBlockNode
  | DocumentBlockNode
  | EmbedBlockNode
  | MathBlockNode

export type BlockNodeName = BlockNode["type"]

/** Das ProseMirror-Dokument des Editors. */
export type ProjectDocument = { type: "doc"; content: BlockNode[] }

/**
 * Die einzige Stelle der Zuordnung Knotenname zu Blocktyp.
 * {@code blocksToDoc} braucht sie nicht rueckwaerts, weil der Knotenname im
 * Inhalt steht: {@code Block.type} ist die abfragbare Projektion von
 * {@code content.type} (Contract 3.4).
 */
export const NODE_TYPE_TO_BLOCK_TYPE: Record<BlockNodeName, BlockType> = {
  heading: "HEADING",
  paragraph: "TEXT",
  bulletList: "LIST",
  orderedList: "LIST",
  blockquote: "QUOTE",
  codeBlock: "CODE",
  horizontalRule: "DIVIDER",
  table: "TABLE",
  imageBlock: "IMAGE",
  galleryBlock: "GALLERY",
  videoBlock: "VIDEO",
  audioBlock: "AUDIO",
  documentBlock: "DOCUMENT",
  embedBlock: "EMBED",
  mathBlock: "FORMULA",
}

const BLOCK_NODE_NAMES = Object.keys(NODE_TYPE_TO_BLOCK_TYPE) as BlockNodeName[]

export function isBlockNodeName(value: unknown): value is BlockNodeName {
  return (
    typeof value === "string" &&
    (BLOCK_NODE_NAMES as readonly string[]).includes(value)
  )
}

/**
 * Typwaechter an der Lesegrenze: ein Objekt mit einem der fuenfzehn
 * bekannten Knotennamen. Bewusst flach. Was innerhalb des Knotens steht,
 * prueft die Whitelist ({@code blockSanitize.ts}) Knoten fuer Knoten; ein
 * Typwaechter, der den ganzen Baum durchliefe, waere dieselbe Pruefung ein
 * zweites Mal und liefe erfahrungsgemaess davon weg.
 */
export function isBlockNode(value: unknown): value is BlockNode {
  return (
    typeof value === "object" &&
    value !== null &&
    isBlockNodeName((value as { type?: unknown }).type)
  )
}

/* ------------------------------------------------------------------ */
/* Huellen mit eigenem content-Typ                                      */
/* ------------------------------------------------------------------ */

/**
 * {@code BlockRequest} aus der Generierung, verengt an zwei Stellen. Kein
 * handgeschriebener Request-Typ: alle uebrigen Felder kommen unveraendert
 * aus {@code schema.d.ts}, und beide Verengungen holen sich ihren Typ von
 * dort.
 *
 * <p>{@code content} traegt das Typmodell dieser Datei, weil springdoc fuer
 * JsonNode ein {@code Record<string, never>} erzeugt.
 *
 * <p>{@code type} traegt {@link BlockType} statt {@code string}: springdoc
 * gibt den Enum nur an der Antwort aus, am Request steht eine blosse
 * Zeichenkette. Ein Tippfehler im Blocktyp faellt damit erst als 400
 * BLOCK_TYPE_UNKNOWN auf, statt beim Uebersetzen. Der Wert kommt aus
 * {@code BlockResponse} und ist damit weiterhin generiert.
 */
export type ContentBlockRequest = Omit<BlockRequest, "content" | "type"> & {
  content: BlockNode
  type: BlockType
}

/**
 * {@code BlockResponse} aus der Generierung, dessen {@code content} als
 * {@code unknown} gilt: was vom Server kommt, ist erst nach der Whitelist
 * ein {@code BlockNode}.
 */
export type ContentBlockResponse = Omit<BlockResponse, "content"> & {
  content?: unknown
}
