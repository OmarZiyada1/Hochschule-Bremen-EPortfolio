import type { BlockType } from "@/api/types"

import {
  isBlockNode,
  NODE_TYPE_TO_BLOCK_TYPE,
  type BlockNode,
  type ContentBlockRequest,
  type ContentBlockResponse,
  type ProjectDocument,
} from "@/features/project-content/blockTypes"
import {
  sanitizeBlockNode,
  type DropReason,
  type NormalizationReason,
} from "@/features/project-content/blockSanitize"

/**
 * Die beiden Uebersetzungen zwischen dem ProseMirror-Dokument des Editors
 * und der Blockliste der API (Contract 2.5, 3.4, 6.1).
 *
 * <p>Reine Funktionen: kein React, kein Netzwerk, kein Zustand, ohne DOM
 * testbar. Sie sind der gemeinsame Nenner von Editor, Vorschau, Detailseite,
 * Review-Ansicht und Druckausgabe; deshalb steht diese Datei vor allen
 * Editor-Tickets und importiert nichts aus {@code @tiptap/*}.
 */

/**
 * Version des Editor-Schemas, mit der geschrieben wird (Contract 2.10).
 * Bei jeder Aenderung der Knotentypen wird sie erhoeht und
 * {@link migrateBlockContent} um einen Schritt ergaenzt.
 *
 * <p><strong>2 seit Contract v51</strong>, im Backend
 * {@code BlockSchemaMigration.CURRENT_VERSION}. Die Formen, die dieses Modul
 * und der Renderer erwarten, sind genau die der Version 2: die Galerie
 * fuehrt {@code items} statt {@code fileIds}, AUDIO kennt kein {@code src},
 * und HEADING beginnt bei Ebene 2. Die Konstante stand bis KAN-32
 * gleichwohl auf 1, und weil {@link blocksToDoc} alles verwirft, was eine
 * hoehere Version traegt, fiel jeder real gespeicherte Block durch: der
 * Server liefert seit KAN-72 immer mindestens 2 (BlockResponse.from
 * migriert beim Lesen). Auf der Detailseite waeren damit nur Platzhalter
 * erschienen.
 */
export const BLOCK_SCHEMA_VERSION = 2

/**
 * Die letzte Serverantwort, auf das reduziert, was fuer stabile IDs noetig
 * ist. Mehr braucht {@link docToBlocks} nicht, und weniger zu uebergeben
 * hiesse, den Upsert aufzugeben.
 */
export type PreviousBlock = { id?: string; type?: BlockType }

/** Ein Block, der nicht dargestellt werden kann, samt Grund. */
export type DroppedBlock = {
  /* Immer gesetzt: BlockResponse.id ist Pflicht (Contract 3.4, KAN-76). */
  id: string
  orderIndex: number
  /** Knotenname aus {@code content.type}, soweit lesbar. */
  nodeType: string | null
  reason: DropReason
  /** Zusatzangabe zum Grund, etwa die abgewiesene Einbettungsadresse. */
  detail?: string
}

/** Ein Block, der geradegezogen wurde, ohne verworfen zu werden. */
export type NormalizedBlock = {
  id?: string
  orderIndex: number
  reasons: NormalizationReason[]
}

/**
 * Ein Platz in der Lesereihenfolge: entweder ein darstellbarer Knoten oder
 * ein Loch mit Begruendung. Der Renderer laeuft ueber diese Liste, damit
 * der Platzhalter dort steht, wo der Block stand, und nicht am Ende der
 * Seite.
 */
export type BlockEntry =
  | { kind: "node"; node: BlockNode; id?: string; orderIndex: number }
  | { kind: "dropped"; dropped: DroppedBlock }

export type BlocksToDocResult = {
  /** Das Dokument fuer den Editor: nur darstellbare Knoten, in Reihenfolge. */
  doc: ProjectDocument
  /** Dieselbe Reihenfolge, Loecher eingeschlossen (fuer die Anzeige). */
  entries: BlockEntry[]
  /**
   * Solange hier etwas steht, darf der Editor nicht speichern: der PUT
   * ersetzt die Liste vollstaendig und loeschte die nicht gelesenen Bloecke
   * (Contract 6.1). Die Regel steht hier, umgesetzt wird sie in KAN-36.
   */
  dropped: DroppedBlock[]
  /** Normalisierungen blockieren das Speichern nicht. */
  normalized: NormalizedBlock[]
  /**
   * Ob die gelesene Fassung zurueckgeschrieben werden darf, also
   * {@code dropped.length === 0}.
   *
   * <p>Dieselbe Zusage steht als Prosa an {@code dropped}, und genau das
   * war der Befund: eine Regel, die nur im Kommentar steht, uebersieht der
   * Aufrufer. Als Feld laesst sie sich in KAN-36 vor jedem Speicherlauf
   * abfragen, ohne dass jemand die Laenge einer Liste von Hand mit null
   * vergleicht.
   */
  canSave: boolean
}

/* ------------------------------------------------------------------ */
/* Dokument nach Blockliste                                             */
/* ------------------------------------------------------------------ */

/**
 * Uebersetzt das Dokument des Editors in den Rumpf von
 * {@code PUT /api/projects/{id}/blocks}.
 *
 * <p><strong>Der leere Schlussabsatz faellt weg.</strong> Er ist
 * Editor-Verhalten und kein Inhalt: Tiptap haengt ihn an, damit sich nach
 * einem Medienblock am Dokumentende weiterschreiben laesst. Gespeichert
 * erschiene er in Detailseite und Ausdruck als Leerraum.
 *
 * <p><strong>Stabile IDs ueber die Position.</strong> Der Block an Position
 * {@code i} bekommt {@code previous[i].id} genau dann, wenn der Typ
 * uebereinstimmt, sonst geht er ohne id und wird neu angelegt. Ohne diesen
 * Upsert bekaemen alle Bloecke bei jedem Autosave-Takt neue UUIDs, womit
 * blockbezogene Kommentare unmoeglich waeren (Contract 6.1, offener Punkt 6
 * in 7). <strong>Benannte Grenze:</strong> beim Einfuegen oder Umsortieren
 * wandern IDs, weil 3.4 kein {@code attrs.id} vorsieht; ein Anker waere
 * eine Contract-Aenderung. Fuer den Inhalt ist das folgenlos, weil der PUT
 * die Liste vollstaendig ersetzt.
 */
export function docToBlocks(
  doc: ProjectDocument,
  previous: readonly PreviousBlock[] = []
): ContentBlockRequest[] {
  const nodes = [...doc.content]
  const last = nodes[nodes.length - 1]
  if (last !== undefined && isEmptyParagraph(last)) {
    nodes.pop()
  }
  return nodes.map((node, index) => {
    const type = NODE_TYPE_TO_BLOCK_TYPE[node.type]
    const carried = previous[index]
    const request: ContentBlockRequest = {
      type,
      /* Lueckenlos ab 0 in Dokumentreihenfolge (Contract 6.1); eine Luecke
         ergibt 400 VALIDATION_FAILED. */
      orderIndex: index,
      content: node,
      schemaVersion: BLOCK_SCHEMA_VERSION,
    }
    if (carried !== undefined && carried.type === type) {
      request.id = carried.id
    }
    return request
  })
}

function isEmptyParagraph(node: BlockNode): boolean {
  return (
    node.type === "paragraph" &&
    (node.content === undefined || node.content.length === 0)
  )
}

/* ------------------------------------------------------------------ */
/* Blockliste nach Dokument                                             */
/* ------------------------------------------------------------------ */

/**
 * Uebersetzt die Antwort von {@code GET /api/projects/{id}/blocks} in ein
 * Dokument und benennt, was dabei nicht gelesen werden konnte.
 *
 * <p>Sortiert wird nach {@code orderIndex}; der Reihenfolge des Arrays wird
 * nicht geglaubt, denn verbindlich ist das Feld (Contract 3.4, 6.1).
 */
export function blocksToDoc(
  blocks: readonly ContentBlockResponse[]
): BlocksToDocResult {
  const sorted = [...blocks].sort(
    (left, right) => left.orderIndex - right.orderIndex
  )

  const entries: BlockEntry[] = []
  const dropped: DroppedBlock[] = []
  const normalized: NormalizedBlock[] = []

  for (const block of sorted) {
    const orderIndex = block.orderIndex
    const schemaVersion = block.schemaVersion

    const drop = (
      reason: DropReason,
      nodeType: string | null,
      detail?: string
    ) => {
      const entry: DroppedBlock = {
        orderIndex,
        nodeType,
        reason,
        id: block.id,
      }
      if (detail !== undefined) {
        entry.detail = detail
      }
      dropped.push(entry)
      entries.push({ kind: "dropped", dropped: entry })
    }

    if (schemaVersion > BLOCK_SCHEMA_VERSION) {
      /* Nicht raten: ein Dokument aus einer kuenftigen Schemaversion kann
         Knoten tragen, die es hier noch nicht gibt. */
      drop("SCHEMA_VERSION_UNSUPPORTED", readNodeType(block.content))
      continue
    }

    const migrated = migrateBlockContent(block.content, schemaVersion)
    if (!isBlockNode(migrated)) {
      drop(
        typeof migrated === "object" && migrated !== null
          ? "NODE_TYPE_UNKNOWN"
          : "CONTENT_NOT_AN_OBJECT",
        readNodeType(migrated)
      )
      continue
    }

    const result = sanitizeBlockNode(migrated)
    if (!result.ok) {
      drop(result.reason, migrated.type, result.detail)
      continue
    }

    if (result.normalizations.length > 0) {
      const note: NormalizedBlock = {
        orderIndex,
        reasons: result.normalizations,
      }
      if (block.id !== undefined) {
        note.id = block.id
      }
      normalized.push(note)
    }

    const entry: BlockEntry = { kind: "node", node: result.node, orderIndex }
    if (block.id !== undefined) {
      entry.id = block.id
    }
    entries.push(entry)
  }

  const doc: ProjectDocument = {
    type: "doc",
    content: entries
      .filter(
        (entry): entry is Extract<BlockEntry, { kind: "node" }> =>
          entry.kind === "node"
      )
      .map((entry) => entry.node),
  }

  return { doc, entries, dropped, normalized, canSave: dropped.length === 0 }
}

function readNodeType(content: unknown): string | null {
  if (typeof content !== "object" || content === null) {
    return null
  }
  const type = (content as { type?: unknown }).type
  return typeof type === "string" ? type : null
}

/**
 * Der benannte Ort der Migrationsfunktion, die Contract 2.10 zusagt
 * ("bei jeder Aenderung der Node-Typen wird die Version erhoeht und eine
 * Migrationsfunktion ergaenzt"), die aber bis KAN-10 nirgends verortet war.
 *
 * <p>Sie ist fuer jede Version die Identitaet, und das bleibt sie
 * absichtlich: den Schritt von 1 nach 2 (Contract v51) geht der Server
 * bereits beim Lesen, {@code BlockResponse.from} geht jeden gespeicherten
 * Knoten durch {@code BlockSchemaMigration} und meldet danach mindestens
 * {@link BLOCK_SCHEMA_VERSION}. Ein Dokument der Version 1 erreicht diese
 * Funktion also gar nicht. Ihn hier ein zweites Mal auszuformulieren hiesse,
 * Serverlogik ohne Verwender nachzubauen, und zwei Fassungen derselben
 * Migration liefen frueher oder spaeter auseinander.
 *
 * <p>Der benannte Ort bleibt trotzdem stehen: der Aufrufer in
 * {@link blocksToDoc} ist die einzige Stelle, an der ein alter Bestand
 * vorbeikaeme, und ihn nachtraeglich zu suchen waere teurer, als ihn zu
 * halten. Die naechste Schemaaenderung traegt ihren Schritt hier ein.
 */
export function migrateBlockContent(
  content: unknown,
  schemaVersion: number
): unknown {
  switch (schemaVersion) {
    case 1:
    default:
      return content
  }
}
