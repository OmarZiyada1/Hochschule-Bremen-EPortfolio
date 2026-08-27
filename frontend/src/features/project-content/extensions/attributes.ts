import {
  toGalleryColumns,
  toImageWidth,
} from "@/features/project-content/blockSanitize"
import type {
  GalleryItem,
  TocEntry,
} from "@/features/project-content/blockTypes"

/**
 * Die gemeinsame Form der Attribute der sieben eigenen Nodes.
 *
 * <p><strong>Warum jedes Attribut sein eigenes parseHTML und renderHTML
 * braucht.</strong> Ein {@code renderHTML} nur auf Knotenebene schreibt die
 * Attribute zwar hinaus, aber Tiptap liest sie nicht zurueck: beim
 * Wiedereinlesen aus HTML stuende der Knoten mit seinen Standardwerten da,
 * und der Verlust faellt nirgends auf. Deshalb liegt die Umwandlung je
 * Attribut hier, an einer Stelle statt siebenmal.
 *
 * <p>Verbindliche Form (KAN-10, Umfangspunkt 4): je Attribut genau ein
 * {@code data}-Attribut am Huellenelement, camelCase wird kebab-case
 * ({@code fileId} wird {@code data-file-id}), Arrays und Objekte werden
 * JSON-kodiert, Zahlen werden beim Lesen zurueckgewandelt und bei
 * ungueltigem Wert auf den Standardwert gesetzt, nie auf {@code NaN}.
 */

/**
 * Die Form, die Tiptap fuer ein Attribut erwartet. Bewusst eng typisiert:
 * die Bibliothek selbst fuehrt hier {@code any}, und ein {@code any} in
 * unserem Code waere ein Lint-Befund.
 */
export type NodeAttribute = {
  default: unknown
  parseHTML: (element: HTMLElement) => unknown
  renderHTML: (attributes: Record<string, unknown>) => Record<string, string>
}

/** {@code fileId} wird {@code data-file-id}, {@code videoId} wird {@code data-video-id}. */
export function dataAttributeName(name: string): string {
  return `data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

/**
 * Zeichenkette. Geschrieben wird auch die leere, damit der Round-Trip ueber
 * HTML eine Identitaet bleibt: ein weggelassenes {@code data-caption} kaeme
 * als Standardwert zurueck und nicht als das, was dastand.
 */
export function textAttribute(
  name: string,
  fallback: string | null = null
): NodeAttribute {
  const attribute = dataAttributeName(name)
  return {
    default: fallback,
    parseHTML: (element) => element.getAttribute(attribute) ?? fallback,
    renderHTML: (attributes) => {
      const value = attributes[name]
      return typeof value === "string" ? { [attribute]: value } : {}
    },
  }
}

/**
 * Zahl. Im Knoten und im JSON steht danach eine Zahl: {@code 75}, nie
 * {@code "75"}. {@code normalize} bekommt das Ergebnis von
 * {@code Number.parseInt} und faengt damit auch {@code NaN} ab.
 */
export function numberAttribute(
  name: string,
  fallback: number,
  normalize?: (value: number) => number
): NodeAttribute {
  const attribute = dataAttributeName(name)
  return {
    default: normalize ? normalize(fallback) : fallback,
    parseHTML: (element) => {
      const raw = element.getAttribute(attribute)
      const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10)
      if (normalize) {
        return normalize(parsed)
      }
      return Number.isFinite(parsed) ? parsed : fallback
    },
    renderHTML: (attributes) => {
      const value = attributes[name]
      return typeof value === "number" && Number.isFinite(value)
        ? { [attribute]: String(value) }
        : {}
    },
  }
}

/**
 * Medienbreite und Spaltenzahl laufen ueber dieselben Funktionen wie die
 * Whitelist.
 *
 * <p>Seit Contract v84 fuehren Bild <em>und</em> Video dieselbe Stufung
 * (100, 75, 50), deshalb heisst die Fabrik nicht mehr nach dem Bild. Zwei
 * Fabriken mit denselben drei Zahlen waeren die Einladung, dass sie mit der
 * Zeit auseinanderlaufen.
 */
export function mediaWidthAttribute(): NodeAttribute {
  return numberAttribute("width", 100, (value) => toImageWidth(value))
}

export function galleryColumnsAttribute(): NodeAttribute {
  return numberAttribute("columns", 2, (value) => toGalleryColumns(value))
}

/**
 * Die Galerieeintraege als JSON-kodiertes {@code data-items}. Ein
 * unlesbarer Wert ergibt die leere Liste; der Block faellt dann in der
 * Whitelist mit dem Grund GALLERY_ITEMS_EMPTY heraus, statt hier still ein
 * halbes Array zu bilden.
 */
export function galleryItemsAttribute(): NodeAttribute {
  const attribute = dataAttributeName("items")
  return {
    default: [],
    parseHTML: (element) => {
      const raw = element.getAttribute(attribute)
      if (raw === null) {
        return []
      }
      try {
        return toGalleryItems(JSON.parse(raw))
      } catch {
        return []
      }
    },
    renderHTML: (attributes) => {
      const value = attributes.items
      return Array.isArray(value)
        ? { [attribute]: JSON.stringify(toGalleryItems(value)) }
        : {}
    },
  }
}

/**
 * Die Verzeichniseintraege als JSON-kodiertes {@code data-entries} (2.5 seit
 * v84), nach demselben Muster wie die Galerieeintraege.
 *
 * <p>Ein unlesbarer Wert ergibt die leere Liste. Das ist hier kein
 * Datenverlust, sondern der richtige Ausgang: ein Verzeichnis ohne Eintraege
 * bleibt ein gueltiger Block, und die Aktion in der Toolbar fuellt es mit
 * einem Griff wieder.
 */
export function tocEntriesAttribute(): NodeAttribute {
  const attribute = dataAttributeName("entries")
  return {
    default: [],
    parseHTML: (element) => {
      const raw = element.getAttribute(attribute)
      if (raw === null) {
        return []
      }
      try {
        return toTocEntries(JSON.parse(raw))
      } catch {
        return []
      }
    },
    renderHTML: (attributes) => {
      const value = attributes.entries
      return Array.isArray(value)
        ? { [attribute]: JSON.stringify(toTocEntries(value)) }
        : {}
    },
  }
}

function toTocEntries(value: unknown): TocEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: TocEntry[] = []
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) {
      continue
    }
    const entry = candidate as Record<string, unknown>
    const level = entry.level
    const index = entry.index
    if (
      typeof level !== "number" ||
      level < 1 ||
      level > 6 ||
      !Number.isInteger(level) ||
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0
    ) {
      continue
    }
    entries.push({
      level: level as TocEntry["level"],
      text: typeof entry.text === "string" ? entry.text : "",
      index,
    })
  }
  return entries
}

function toGalleryItems(value: unknown): GalleryItem[] {
  if (!Array.isArray(value)) {
    return []
  }
  const items: GalleryItem[] = []
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const item = entry as { fileId?: unknown; alt?: unknown }
    if (typeof item.fileId !== "string") {
      continue
    }
    items.push({
      fileId: item.fileId,
      alt: typeof item.alt === "string" ? item.alt : "",
    })
  }
  return items
}
