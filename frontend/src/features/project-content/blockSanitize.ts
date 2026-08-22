import {
  isBlockNodeName,
  type BlockNode,
  type ContentTextAlign,
  type FlowNode,
  type GalleryColumns,
  type GalleryItem,
  type HeadingLevel,
  type HeadingTextAlign,
  type ImageWidth,
  type InlineNode,
  type ListItemNode,
  type ParagraphNode,
  type TableCellNode,
  type TableRowNode,
  type ContentMark,
} from "@/features/project-content/blockTypes"
import { isContentColorRole } from "@/features/project-content/contentColors"
import {
  VIDEO_HASH_PATTERN,
  isAllowedEmbedUrl,
  isEmbedProvider,
  isValidVideoId,
  isVideoProvider,
  type EmbedProvider,
  type VideoProvider,
} from "@/features/project-content/providers"
import { parseEmbedInput } from "@/features/project-content/providerInput"

/**
 * Die Whitelist beim Lesen: was nicht in Contract 2.5 steht, faellt weg.
 *
 * <p><strong>Warum es sie ueberhaupt gibt, obwohl der Server prueft.</strong>
 * {@code Block.content} ist serverseitig ein {@code jsonb} ohne Schema.
 * {@code BlockValidationService} prueft den Wurzelknoten, seine Pflicht-attrs
 * und jede Mark im Baum, aber es gibt bis heute keine Knotentyp-Grammatik im
 * Contract: ein von 2.5 ausgeschlossener Knoten innerhalb einer Liste oder
 * Tabellenzelle laeuft serverseitig durch (dort ausdruecklich als getragene
 * Grenze benannt). Dazu kommt der Bestand aus aelteren Contract-Versionen,
 * der Werte tragen kann, die der Schreibweg heute zurueckweist. Der Lesepfad
 * ist damit die einzige Stelle, die den gesamten Baum prueft, und zugleich
 * die einzige Ansicht ohne Anmeldung.
 *
 * <p><strong>Was hier nicht passiert.</strong> Diese Datei ersetzt keine
 * Serverpruefung und darf keine sein: eine reine Frontend-Pruefung liesse
 * sich ueber direkte API-Aufrufe umgehen, und ein Filter in der Anzeige
 * versteckt einen Wert, loescht ihn aber nicht. Sie schuetzt die Anzeige,
 * der Server schuetzt den Bestand.
 *
 * <p><strong>Attribute werden neu aufgebaut, nicht durchgereicht.</strong>
 * Jeder Knoten bekommt genau die Attribute, die 2.5 fuer ihn nennt. Damit
 * verschwinden {@code colwidth} an Tabellenzellen (das Schema laeuft mit
 * {@code resizable: false}), {@code src} am Audioblock, {@code fileIds} an
 * der Galerie und {@code embedUrl} am Videoblock, ohne dass jedes einzeln
 * aufgezaehlt werden muesste.
 */

/**
 * Obergrenze der Schachtelungstiefe, den Top-Level-Knoten als Ebene 1
 * gezaehlt (Contract 2.5 seit v54, wortgleich mit
 * {@code BlockValidationService.MAX_NODE_DEPTH}). Ein Dokument aus dem
 * Editor liegt bei fuenf bis sieben Ebenen; ein von Hand gebautes JSON
 * treibt eine rekursive Pruefung ohne Grenze mit wenigen Kilobyte in einen
 * Stapelueberlauf. Geprueft wird hier mit, damit ein zu tiefer Block in
 * KAN-36 das Speichern blockiert, statt den Autosave-Takt spaeter am 400
 * des Servers scheitern zu lassen. Auf die <em>Anzahl</em> der Bloecke
 * wirkt sie nicht; die ist weder hier noch serverseitig begrenzt.
 */
export const MAX_NODE_DEPTH = 20

/** Warum ein Block gar nicht dargestellt werden kann. */
export type DropReason =
  | "CONTENT_NOT_AN_OBJECT"
  | "NODE_TYPE_UNKNOWN"
  | "SCHEMA_VERSION_UNSUPPORTED"
  | "NODE_DEPTH_EXCEEDED"
  | "IMAGE_FILE_ID_INVALID"
  | "GALLERY_ITEMS_EMPTY"
  | "VIDEO_SOURCE_AMBIGUOUS"
  | "VIDEO_SOURCE_MISSING"
  | "VIDEO_FILE_ID_INVALID"
  | "VIDEO_PROVIDER_NOT_ALLOWED"
  | "VIDEO_ID_INVALID"
  | "AUDIO_FILE_ID_INVALID"
  | "DOCUMENT_ATTRS_INVALID"
  | "EMBED_PROVIDER_NOT_ALLOWED"
  | "EMBED_URL_NOT_ALLOWED"
  | "MATH_LATEX_MISSING"

/**
 * Was am Block geradegezogen wurde, ohne ihn zu verwerfen. Normalisierungen
 * blockieren das Speichern nicht (anders als {@link DropReason}); sie werden
 * vermerkt, damit der Editor sie benennen kann.
 */
export type NormalizationReason =
  | "HEADING_LEVEL_CLAMPED"
  | "HEADING_JUSTIFY_REMOVED"
  | "IMAGE_WIDTH_DEFAULTED"
  | "GALLERY_COLUMNS_DEFAULTED"
  | "GALLERY_ITEM_DROPPED"
  | "GALLERY_ITEM_ALT_DEFAULTED"
  | "GALLERY_FILE_IDS_REMOVED"
  | "AUDIO_SRC_REMOVED"
  | "VIDEO_URL_REMOVED"
  /* Eine alte Einbettungsadresse in die kanonische Form gerechnet (v64). */
  | "EMBED_URL_NORMALIZED"
  /* Ein Gist-Block zu einem Absatz mit Link geworden (v64). */
  | "EMBED_GIST_CONVERTED_TO_LINK"

export type SanitizeResult =
  | { ok: true; node: BlockNode; normalizations: NormalizationReason[] }
  | { ok: false; reason: DropReason; detail?: string }

/** Standardwerte aus Contract 2.5 und dem Ticketumfang von KAN-10. */
const DEFAULT_IMAGE_WIDTH: ImageWidth = 100
const DEFAULT_GALLERY_COLUMNS: GalleryColumns = 2
const DEFAULT_EMBED_HEIGHT = 460

const IMAGE_WIDTHS: readonly ImageWidth[] = [100, 75, 50]
const GALLERY_COLUMN_COUNTS: readonly GalleryColumns[] = [2, 3]
const TEXT_ALIGNMENTS: readonly ContentTextAlign[] = [
  "left",
  "center",
  "right",
  "justify",
]

/**
 * Kanonische UUID-Form.
 *
 * <p>Bewusst enger als der Server: {@code UUID.fromString} nimmt auch
 * verkuerzte Gruppen an ({@code 1-1-1-1-1}). Der Bestand kann so etwas
 * nicht enthalten, weil jede fileId aus einer Entity-ID stammt; und wenn
 * doch, erscheint der Platzhalter statt eines Bildes, das ohnehin nirgends
 * liegt. Ein Fehlschlag in diese Richtung ist der harmlose.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Zulaessige Schemata am link-Mark (Contract 2.5 seit v54). */
const ALLOWED_LINK_SCHEMES = ["http", "https", "mailto"]

/**
 * Die zehn Marks aus 2.5. Sie kommen nur in HEADING, TEXT, LIST, QUOTE und
 * TABLE vor; in CODE und in jedem Medienblock werden sie entfernt, wie es
 * {@code BlockValidationService.MARKABLE_TYPES} verlangt.
 */
const MARKS_WITHOUT_ATTRS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "superscript",
  "subscript",
] as const

type MarkWithoutAttrs = (typeof MARKS_WITHOUT_ATTRS)[number]

/** Wurzelknoten, in denen 2.5 Marks zulaesst. */
const MARKABLE_ROOT_NODES = [
  "heading",
  "paragraph",
  "bulletList",
  "orderedList",
  "blockquote",
  "table",
]

type SanitizeContext = {
  normalizations: NormalizationReason[]
  depthExceeded: boolean
  marksAllowed: boolean
}

/* ------------------------------------------------------------------ */
/* Kleine Pruefungen, auch ausserhalb dieser Datei gebraucht            */
/* ------------------------------------------------------------------ */

/**
 * Der Protokollfilter auf {@code link.href} (Contract 2.5 seit v54),
 * Schritt fuer Schritt wie {@code BlockValidationService.requireSafeHref}.
 *
 * <p>Zuerst faellt alles, was vor dem Doppelpunkt ein Steuerzeichen oder
 * Leerraum traegt: manche Browser ziehen ein zerteiltes Schema wieder
 * zusammen und machen aus einem eingeschobenen Zeilenumbruch doch noch ein
 * ausfuehrbares {@code javascript:}. Erst danach wird getrimmt und geparst.
 * Verglichen wird kleingeschrieben, denn gemischte Schreibweise ist
 * derselbe Angriff.
 *
 * <p>Eine Adresse ohne Schema faellt ebenfalls, relativ wie protokollrelativ:
 * {@code //fremde.tld} waere sonst der bequeme Weg an der Pruefung vorbei.
 * {@code new URL} ohne Basis wirft dafuer von sich aus.
 */
export function isSafeHref(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false
  }
  const colon = value.indexOf(":")
  const prefix = colon < 0 ? value : value.slice(0, colon)
  for (const character of prefix) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f || /\s/.test(character)) {
      return false
    }
  }
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    return false
  }
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase()
  return ALLOWED_LINK_SCHEMES.includes(scheme)
}

/**
 * Bildbreite aus einem beliebigen Wert (Contract 2.5). Alles ausserhalb von
 * 100, 75 und 50 ergibt den Standardwert 100, auch die Zeichenkette
 * {@code "50"}: {@code content} ist JSON, und wuerde sie umgedeutet, waere
 * der Round-Trip keine Identitaet mehr. Nie {@code NaN}.
 */
export function toImageWidth(value: unknown): ImageWidth {
  return typeof value === "number" &&
    (IMAGE_WIDTHS as readonly number[]).includes(value)
    ? (value as ImageWidth)
    : DEFAULT_IMAGE_WIDTH
}

/** Spaltenzahl der Galerie, nach derselben Regel wie {@link toImageWidth}. */
export function toGalleryColumns(value: unknown): GalleryColumns {
  return typeof value === "number" &&
    (GALLERY_COLUMN_COUNTS as readonly number[]).includes(value)
    ? (value as GalleryColumns)
    : DEFAULT_GALLERY_COLUMNS
}

/* ------------------------------------------------------------------ */
/* Einstieg                                                             */
/* ------------------------------------------------------------------ */

/**
 * Prueft einen gespeicherten {@code content} und gibt ihn als
 * {@link BlockNode} zurueck oder nennt den Grund, warum er nicht
 * darstellbar ist.
 */
export function sanitizeBlockNode(value: unknown): SanitizeResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, reason: "CONTENT_NOT_AN_OBJECT" }
  }
  const raw = value as RawNode
  if (!isBlockNodeName(raw.type)) {
    return { ok: false, reason: "NODE_TYPE_UNKNOWN" }
  }
  const context: SanitizeContext = {
    normalizations: [],
    depthExceeded: false,
    marksAllowed: MARKABLE_ROOT_NODES.includes(raw.type),
  }
  const result = sanitizeRoot(raw, context)
  if (context.depthExceeded) {
    return { ok: false, reason: "NODE_DEPTH_EXCEEDED" }
  }
  if ("reason" in result) {
    return result.detail === undefined
      ? { ok: false, reason: result.reason }
      : { ok: false, reason: result.reason, detail: result.detail }
  }
  return { ok: true, node: result.node, normalizations: context.normalizations }
}

/* ------------------------------------------------------------------ */
/* Wurzelknoten                                                         */
/* ------------------------------------------------------------------ */

type RawNode = {
  type?: unknown
  attrs?: unknown
  content?: unknown
  marks?: unknown
  text?: unknown
}

type RootResult = { node: BlockNode } | { reason: DropReason; detail?: string }

function sanitizeRoot(raw: RawNode, context: SanitizeContext): RootResult {
  const attrs = asRecord(raw.attrs)
  switch (raw.type as BlockNode["type"]) {
    case "heading":
      return {
        node: {
          type: "heading",
          attrs: {
            level: toHeadingLevel(attrs.level, context),
            textAlign: toHeadingTextAlign(attrs.textAlign, context),
          },
          content: sanitizeInlineList(raw.content, context, 2),
        },
      }
    case "paragraph":
      return { node: sanitizeParagraph(raw, context, 1) }
    case "bulletList":
      return {
        node: {
          type: "bulletList",
          content: sanitizeListItems(raw.content, context, 2),
        },
      }
    case "orderedList":
      return {
        node: {
          type: "orderedList",
          attrs: { start: toPositiveInteger(attrs.start) },
          content: sanitizeListItems(raw.content, context, 2),
        },
      }
    case "blockquote":
      return {
        node: {
          type: "blockquote",
          content: asArray(raw.content)
            .map((child) => sanitizeParagraphOrNull(child, context, 2))
            .filter((child): child is ParagraphNode => child !== null),
        },
      }
    case "codeBlock":
      return {
        node: {
          type: "codeBlock",
          attrs: { language: toOptionalText(attrs.language) },
          /* Marks sind in CODE nicht zulaessig (2.5); der Kontext traegt das
             bereits, der Textinhalt bleibt unveraendert. */
          content: sanitizeInlineList(raw.content, context, 2),
        },
      }
    case "horizontalRule":
      return { node: { type: "horizontalRule" } }
    case "table":
      return {
        node: {
          type: "table",
          attrs: { caption: toOptionalText(attrs.caption) },
          content: sanitizeTableRows(raw.content, context, 2),
        },
      }
    case "imageBlock":
      return sanitizeImage(attrs, context)
    case "galleryBlock":
      return sanitizeGallery(attrs, context)
    case "videoBlock":
      return sanitizeVideo(attrs, context)
    case "audioBlock":
      return sanitizeAudio(attrs, context)
    case "documentBlock":
      return sanitizeDocument(attrs)
    case "embedBlock":
      return sanitizeEmbed(attrs, context)
    case "mathBlock":
      return sanitizeMath(attrs)
  }
}

/* ------------------------------------------------------------------ */
/* Struktur                                                             */
/* ------------------------------------------------------------------ */

function sanitizeParagraph(
  raw: RawNode,
  context: SanitizeContext,
  depth: number
): ParagraphNode {
  const attrs = asRecord(raw.attrs)
  const textAlign = TEXT_ALIGNMENTS.includes(
    attrs.textAlign as ContentTextAlign
  )
    ? (attrs.textAlign as ContentTextAlign)
    : null
  return {
    type: "paragraph",
    attrs: { textAlign },
    content: sanitizeInlineList(raw.content, context, depth + 1),
  }
}

function sanitizeParagraphOrNull(
  value: unknown,
  context: SanitizeContext,
  depth: number
): ParagraphNode | null {
  if (!checkDepth(depth, context)) {
    return null
  }
  const raw = asNode(value)
  return raw?.type === "paragraph"
    ? sanitizeParagraph(raw, context, depth)
    : null
}

/** Inhalt eines Listeneintrags und einer Tabellenzelle (2.5). */
function sanitizeFlowList(
  value: unknown,
  context: SanitizeContext,
  depth: number
): FlowNode[] {
  const children = asArray(value)
  if (children.length > 0 && !checkDepth(depth, context)) {
    return []
  }
  const nodes: FlowNode[] = []
  for (const child of children) {
    const raw = asNode(child)
    if (raw?.type === "paragraph") {
      nodes.push(sanitizeParagraph(raw, context, depth))
    } else if (raw?.type === "bulletList") {
      nodes.push({
        type: "bulletList",
        content: sanitizeListItems(raw.content, context, depth + 1),
      })
    } else if (raw?.type === "orderedList") {
      nodes.push({
        type: "orderedList",
        attrs: { start: toPositiveInteger(asRecord(raw.attrs).start) },
        content: sanitizeListItems(raw.content, context, depth + 1),
      })
    }
  }
  return nodes
}

function sanitizeListItems(
  value: unknown,
  context: SanitizeContext,
  depth: number
): ListItemNode[] {
  const children = asArray(value)
  if (children.length > 0 && !checkDepth(depth, context)) {
    return []
  }
  const items: ListItemNode[] = []
  for (const child of children) {
    const raw = asNode(child)
    if (raw?.type === "listItem") {
      items.push({
        type: "listItem",
        content: sanitizeFlowList(raw.content, context, depth + 1),
      })
    }
  }
  return items
}

function sanitizeTableRows(
  value: unknown,
  context: SanitizeContext,
  depth: number
): TableRowNode[] {
  const children = asArray(value)
  if (children.length > 0 && !checkDepth(depth, context)) {
    return []
  }
  const rows: TableRowNode[] = []
  for (const child of children) {
    const raw = asNode(child)
    if (raw?.type === "tableRow") {
      rows.push({
        type: "tableRow",
        content: sanitizeTableCells(raw.content, context, depth + 1),
      })
    }
  }
  return rows
}

function sanitizeTableCells(
  value: unknown,
  context: SanitizeContext,
  depth: number
): TableCellNode[] {
  const children = asArray(value)
  if (children.length > 0 && !checkDepth(depth, context)) {
    return []
  }
  const cells: TableCellNode[] = []
  for (const child of children) {
    const raw = asNode(child)
    if (raw?.type !== "tableCell" && raw?.type !== "tableHeader") {
      continue
    }
    const attrs = asRecord(raw.attrs)
    cells.push({
      type: raw.type,
      /* colspan und rowspan bleiben, colwidth faellt weg: das Schema laeuft
         mit resizable: false, und ein Umschalten braeuchte die Migration
         aus Contract 2.10. */
      attrs: {
        colspan: toPositiveInteger(attrs.colspan),
        rowspan: toPositiveInteger(attrs.rowspan),
      },
      content: sanitizeFlowList(raw.content, context, depth + 1),
    })
  }
  return cells
}

/* ------------------------------------------------------------------ */
/* Inline und Marks                                                     */
/* ------------------------------------------------------------------ */

function sanitizeInlineList(
  value: unknown,
  context: SanitizeContext,
  depth: number
): InlineNode[] {
  const children = asArray(value)
  if (children.length > 0 && !checkDepth(depth, context)) {
    return []
  }
  const nodes: InlineNode[] = []
  for (const child of children) {
    const raw = asNode(child)
    if (raw?.type !== "text" || typeof raw.text !== "string") {
      continue
    }
    const marks = context.marksAllowed ? sanitizeMarks(raw.marks) : []
    nodes.push(
      marks.length > 0
        ? { type: "text", text: raw.text, marks }
        : { type: "text", text: raw.text }
    )
  }
  return nodes
}

/**
 * Nur die zehn Marks aus 2.5 ueberleben, und nur mit den Attributen, die
 * dort stehen. Eine unbekannte Mark wird entfernt, der Text bleibt.
 */
function sanitizeMarks(value: unknown): ContentMark[] {
  const marks: ContentMark[] = []
  for (const entry of asArray(value)) {
    const raw = asNode(entry)
    if (raw === null || typeof raw.type !== "string") {
      continue
    }
    const attrs = asRecord(raw.attrs)
    if ((MARKS_WITHOUT_ATTRS as readonly string[]).includes(raw.type)) {
      marks.push({ type: raw.type as MarkWithoutAttrs })
      continue
    }
    if (raw.type === "link") {
      /* Faellt href weg, faellt die Mark weg und der Text bleibt: ein
         Linktext ohne Ziel ist immer noch der Satz, den jemand geschrieben
         hat. Ueberleben tut allein href; target und rel setzt die Anzeige. */
      if (isSafeHref(attrs.href)) {
        marks.push({ type: "link", attrs: { href: attrs.href } })
      }
      continue
    }
    if (raw.type === "textStyle" || raw.type === "highlight") {
      /* Der Wert ist ein Rollenname aus der Palette, kein Hex-Wert und kein
         CSS-Ausdruck. Ein unbekannter Wert verwirft die Mark (2.5). */
      if (isContentColorRole(attrs.color)) {
        marks.push({ type: raw.type, attrs: { color: attrs.color } })
      }
    }
  }
  return marks
}

/* ------------------------------------------------------------------ */
/* Die sieben Medien- und Formelknoten                                  */
/* ------------------------------------------------------------------ */

function sanitizeImage(
  attrs: Record<string, unknown>,
  context: SanitizeContext
): RootResult {
  if (!isUuid(attrs.fileId)) {
    return { reason: "IMAGE_FILE_ID_INVALID" }
  }
  const width = toImageWidth(attrs.width)
  if (
    attrs.width !== undefined &&
    attrs.width !== null &&
    attrs.width !== width
  ) {
    context.normalizations.push("IMAGE_WIDTH_DEFAULTED")
  }
  return {
    node: {
      type: "imageBlock",
      attrs: {
        fileId: attrs.fileId.trim(),
        alt: toText(attrs.alt),
        caption: toText(attrs.caption),
        width,
      },
    },
  }
}

function sanitizeGallery(
  attrs: Record<string, unknown>,
  context: SanitizeContext
): RootResult {
  /* fileIds ist mit 2.5 gestrichen; der Server weist es aktiv mit 400 ab.
     Der Neuaufbau der attrs laesst es ohnehin verschwinden, aber nicht
     spurlos: ein Altdokument aus v50 soll nicht unbemerkt umgeschrieben
     werden (Befund des Contract-Abgleichs zu KAN-10). */
  if (attrs.fileIds !== undefined && attrs.fileIds !== null) {
    context.normalizations.push("GALLERY_FILE_IDS_REMOVED")
  }
  const items: GalleryItem[] = []
  for (const entry of asArray(attrs.items)) {
    const item = asRecord(entry)
    if (!isUuid(item.fileId)) {
      context.normalizations.push("GALLERY_ITEM_DROPPED")
      continue
    }
    /* Ein leeres alt ist die ausdrueckliche Aussage "schmueckend", ein
       fehlendes ein vergessener Alternativtext: der Server unterscheidet
       das und weist den zweiten Fall ab (2.5, SC 1.1.1). Der Lesepfad
       repariert ihn, damit der Beitrag lesbar bleibt, vermerkt ihn aber,
       statt aus "vergessen" stillschweigend "schmueckend" zu machen. */
    if (typeof item.alt !== "string") {
      context.normalizations.push("GALLERY_ITEM_ALT_DEFAULTED")
    }
    items.push({ fileId: item.fileId.trim(), alt: toText(item.alt) })
  }
  if (items.length === 0) {
    return { reason: "GALLERY_ITEMS_EMPTY" }
  }
  const columns = toGalleryColumns(attrs.columns)
  if (
    attrs.columns !== undefined &&
    attrs.columns !== null &&
    attrs.columns !== columns
  ) {
    context.normalizations.push("GALLERY_COLUMNS_DEFAULTED")
  }
  return {
    node: {
      type: "galleryBlock",
      attrs: { items, columns, caption: toText(attrs.caption) },
    },
  }
}

/**
 * Genau eine Quelle ist gueltig (2.5). Bei zweien waere jede Wahl geraten,
 * bei keiner gibt es kein Video; beides wird deshalb verworfen und nicht
 * normalisiert. Was als "Quelle vorhanden" zaehlt, ist wortgleich mit
 * {@code BlockValidationService.validateVideo}: ein ausdrueckliches
 * {@code null} gilt als nicht gesetzt, weil Tiptap bei {@code toJSON} alle
 * deklarierten Attribute mitschreibt, auch die ohne Wert.
 */
function sanitizeVideo(
  attrs: Record<string, unknown>,
  context: SanitizeContext
): RootResult {
  /* embedUrl und src sind mit 2.5 gestrichen und werden serverseitig aktiv
     abgewiesen. Der Neuaufbau der attrs entfernt sie; vermerkt wird es
     trotzdem, damit ein Altdokument nicht unbemerkt umgeschrieben wird. */
  if (
    (attrs.embedUrl !== undefined && attrs.embedUrl !== null) ||
    (attrs.src !== undefined && attrs.src !== null)
  ) {
    context.normalizations.push("VIDEO_URL_REMOVED")
  }
  const hasFile = attrs.fileId !== undefined && attrs.fileId !== null
  const hasEmbed =
    (attrs.provider !== undefined && attrs.provider !== null) ||
    (attrs.videoId !== undefined && attrs.videoId !== null)
  if (hasFile && hasEmbed) {
    return { reason: "VIDEO_SOURCE_AMBIGUOUS" }
  }
  if (!hasFile && !hasEmbed) {
    return { reason: "VIDEO_SOURCE_MISSING" }
  }
  const caption = toText(attrs.caption)
  if (hasFile) {
    if (!isUuid(attrs.fileId)) {
      return { reason: "VIDEO_FILE_ID_INVALID" }
    }
    return {
      node: {
        type: "videoBlock",
        attrs: { fileId: attrs.fileId.trim(), caption },
      },
    }
  }
  if (!isVideoProvider(attrs.provider)) {
    return { reason: "VIDEO_PROVIDER_NOT_ALLOWED" }
  }
  const provider: VideoProvider = attrs.provider
  if (!isValidVideoId(provider, attrs.videoId)) {
    return { reason: "VIDEO_ID_INVALID" }
  }
  /*
   * Der Freigabe-Hash gehoert nur an ein nicht gelistetes Vimeo-Video
   * (2.5 seit v64). Ein unbrauchbarer Wert wird still verworfen und macht
   * den Block nicht ungueltig: ohne ihn ist ein oeffentliches Video
   * weiterhin abspielbar, und ein nicht gelistetes zeigt den Fehler des
   * Anbieters im Rahmen, was besser ist als ein verschwundener Block.
   */
  const hash =
    provider === "vimeo" &&
    typeof attrs.hash === "string" &&
    VIDEO_HASH_PATTERN.test(attrs.hash)
      ? attrs.hash
      : null
  return {
    node: {
      type: "videoBlock",
      attrs: { provider, videoId: attrs.videoId, hash, caption },
    },
  }
}

function sanitizeAudio(
  attrs: Record<string, unknown>,
  context: SanitizeContext
): RootResult {
  /* Das bis Contract v50 geduldete src erzeugt das Schema nicht mehr; ein
     mitgeliefertes wird entfernt, der Block bleibt. Der Renderer laedt nie
     eine fremde URL (2.5, 3.15). */
  if (attrs.src !== undefined && attrs.src !== null) {
    context.normalizations.push("AUDIO_SRC_REMOVED")
  }
  if (!isUuid(attrs.fileId)) {
    return { reason: "AUDIO_FILE_ID_INVALID" }
  }
  return {
    node: {
      type: "audioBlock",
      attrs: { fileId: attrs.fileId.trim(), caption: toText(attrs.caption) },
    },
  }
}

function sanitizeDocument(attrs: Record<string, unknown>): RootResult {
  const fileName = toText(attrs.fileName)
  const size = attrs.size
  /* Auf Leerraum geprueft und nicht auf Laenge: der Server nutzt
     isBlank, und ein Dateiname aus drei Leerzeichen waere hier sonst
     gueltig und beim Speichern ein 400. */
  if (
    !isUuid(attrs.fileId) ||
    fileName.trim().length === 0 ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return { reason: "DOCUMENT_ATTRS_INVALID" }
  }
  return {
    node: {
      type: "documentBlock",
      attrs: { fileId: attrs.fileId.trim(), fileName, size },
    },
  }
}

/**
 * <p><strong>Alte Einbettungen werden beim Lesen umgeschrieben</strong>
 * (Contract v64). Bis dahin genuegte der Host: gespeichert wurde, was
 * jemand eingefuegt hatte, also auch die Zuschauerseite
 * {@code youtube.com/watch?v=…} oder {@code codepen.io/…/pen/…}, die sich
 * beide nicht einbetten lassen. Seit v64 gilt zusaetzlich der Pfad, und
 * Figma bettet ueber einen eigenen Host ein. Ohne diese Umrechnung waeren
 * solche Bloecke nicht mehr lesbar, und weil
 * {@code BlockService.replace} die <em>gesamte</em> Liste prueft, waere
 * der ganze Beitrag danach nicht mehr speicherbar: eine Sackgasse, aus der
 * die Autor:in nicht einmal durch Loeschen des Blocks herauskaeme.
 *
 * <p><strong>Ein Gist-Block wird zu einem Absatz mit Link.</strong> Er
 * laesst sich nicht umrechnen, weil GitHub fuer Gists keinen einbettbaren
 * Rahmen anbietet; das war schon vor v64 so, nur fiel es nicht auf, weil
 * die Adresse angenommen wurde und erst der leere Rahmen es zeigte. Statt
 * den Block zu verwerfen, bleibt die Adresse als anklickbarer Text
 * stehen: der Beitrag bleibt speicherbar, und nichts verschwindet
 * unbemerkt.
 */
function sanitizeEmbed(
  attrs: Record<string, unknown>,
  context: SanitizeContext
): RootResult {
  const url = typeof attrs.embedUrl === "string" ? attrs.embedUrl : null

  if (attrs.provider === "gist") {
    if (url === null) {
      return { reason: "EMBED_PROVIDER_NOT_ALLOWED" }
    }
    context.normalizations.push("EMBED_GIST_CONVERTED_TO_LINK")
    return {
      node: {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [
          {
            type: "text",
            text: url,
            marks: [{ type: "link", attrs: { href: url } }],
          },
        ],
      },
    }
  }

  if (!isEmbedProvider(attrs.provider)) {
    return { reason: "EMBED_PROVIDER_NOT_ALLOWED" }
  }
  let provider: EmbedProvider = attrs.provider
  let embedUrl: string

  if (isAllowedEmbedUrl(provider, attrs.embedUrl)) {
    embedUrl = attrs.embedUrl
  } else {
    /* Vor dem Verwerfen der Versuch, die alte Adresse in die kanonische
       Form zu rechnen. parseEmbedInput liefert nur zurueck, was Host und
       Pfad der Allowlist erfuellt. */
    const repaired = url === null ? null : parseEmbedInput(url)
    if (repaired === null) {
      /* Die Adresse wird als reiner Text weitergereicht, damit der
         Platzhalter sie nennen kann (2.5). Ein iframe entsteht nicht, und
         href wird sie nirgends: sichtbar ist sie ausschliesslich als
         Textinhalt. */
      return { reason: "EMBED_URL_NOT_ALLOWED", detail: url ?? undefined }
    }
    context.normalizations.push("EMBED_URL_NORMALIZED")
    provider = repaired.provider
    embedUrl = repaired.embedUrl
  }
  /* Die Hoehe wird hier nicht begrenzt, nur auf einen brauchbaren Wert
     gebracht. Weder 2.5 noch BlockValidationService kennen eine Spanne;
     zoege der Client sie hier, schriebe er beim naechsten Speichern einen
     Wert zurueck, den niemand verlangt hat. Die Spanne ist eine reine
     Anzeigeentscheidung und steht deshalb im Renderer (Befund des
     Contract-Abgleichs zu KAN-10). */
  const raw = attrs.height
  const height =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0
      ? Math.round(raw)
      : DEFAULT_EMBED_HEIGHT
  return {
    node: {
      type: "embedBlock",
      attrs: { provider, embedUrl, height },
    },
  }
}

function sanitizeMath(attrs: Record<string, unknown>): RootResult {
  /* Auf Leerraum geprueft wie beim Dateinamen und aus demselben Grund. */
  const latex = toText(attrs.latex)
  return latex.trim().length === 0
    ? { reason: "MATH_LATEX_MISSING" }
    : { node: { type: "mathBlock", attrs: { latex } } }
}

/* ------------------------------------------------------------------ */
/* Hilfsmittel                                                          */
/* ------------------------------------------------------------------ */

/**
 * Meldet, ob die Tiefe noch im Rahmen ist, und merkt die Ueberschreitung im
 * Kontext an. Der Aufrufer bricht seine Schleife ab; der Block wird
 * anschliessend als Ganzes verworfen, statt still gekuerzt zu werden.
 *
 * <p>Gefragt wird erst, wenn auf der Ebene wirklich ein Knoten steht.
 * {@code BlockValidationService.walkMarks} steigt genauso ab: es prueft die
 * Tiefe beim Betreten eines Knotens und nicht vor einer leeren Kindliste.
 * Ohne diese Feinheit galte ein Baum mit genau zwanzig Ebenen hier als zu
 * tief und serverseitig als in Ordnung.
 */
function checkDepth(depth: number, context: SanitizeContext): boolean {
  if (depth > MAX_NODE_DEPTH) {
    context.depthExceeded = true
    return false
  }
  return true
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asNode(value: unknown): RawNode | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RawNode)
    : null
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim())
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function toOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function toPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null
}

/**
 * Ueberschriftenebene 1 bis 6 (2.5 seit v63). Eine Ebene ausserhalb wird
 * auf den naechsten erlaubten Wert geklemmt und vermerkt, nicht verworfen:
 * der Text der Ueberschrift ist Inhalt, ihre Ebene ist Gliederung, und eine
 * verworfene Ueberschrift naehme dem Beitrag mehr als eine verschobene.
 */
function toHeadingLevel(
  value: unknown,
  context: SanitizeContext
): HeadingLevel {
  if (
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  ) {
    return value
  }
  context.normalizations.push("HEADING_LEVEL_CLAMPED")
  return typeof value === "number" && value > 6 ? 6 : 1
}

/**
 * Ausrichtung einer Ueberschrift (2.5 seit v63): {@code justify} faellt
 * weg und wird vermerkt, alles Unbekannte wird still zu {@code null}.
 *
 * <p>Der Unterschied ist gewollt. Ein {@code justify} ist ein Wert, den die
 * Autor:in einmal gesetzt hat und der seit v63 nicht mehr zulaessig ist;
 * ihn zu verschweigen hiesse, eine sichtbare Aenderung zu verschweigen.
 * Eine Zeichenkette, die gar keine Ausrichtung ist, war nie Inhalt.
 */
function toHeadingTextAlign(
  value: unknown,
  context: SanitizeContext
): HeadingTextAlign | null {
  if (value === "left" || value === "center" || value === "right") {
    return value
  }
  if (value === "justify") {
    context.normalizations.push("HEADING_JUSTIFY_REMOVED")
  }
  return null
}
