import type {
  NominationTier,
  ProjectCardResponse,
  Top10EntryResponse,
} from "@/api/types"

/**
 * Die zehn Plaetze der Top-10 als reine Werte und Funktionen, damit sie ohne
 * Rendern pruefbar sind (Skill frontend-modul, Abschnitt 3; KAN-40).
 *
 * <p><strong>Plaetze sind Plaetze, keine dichte Rangfolge</strong> (§3.11.1,
 * KAN-24). Verlaesst ein Projekt PUBLISHED, wird es geloescht oder zieht die
 * Administration seine angenommene Nominierung zurueck, raeumt es seinen
 * Platz und die uebrigen Eintraege ruecken <em>nicht</em> nach. Es kann also
 * eine Luecke mitten in der Liste stehen, und die Verwaltung muss sie
 * darstellen koennen. Deshalb ist der Arbeitszustand ein Feld fester Laenge
 * mit zehn Zellen und keine Liste der besetzten Eintraege: nur so behaelt
 * eine Luecke ihren Ort.
 *
 * <p><strong>Und so wird es auch gespeichert.</strong> Seit Contract v78
 * nimmt {@code PUT /admin/top10} {@code null}-Eintraege entgegen; der Index
 * bleibt der Platz, {@code null} heisst „Platz frei" (§3.11.1 Regel 3). Was
 * die Oberflaeche zeigt, laesst sich damit genau so ablegen. Bis v77 zog
 * jeder Aufruf die Liste wieder zusammen, ein entferntes Projekt riss also
 * die darunterliegenden mit nach oben.
 */

/** Zehn Plaetze, nicht mehr (§3.11). */
export const TOP10_SLOT_COUNT = 10

/**
 * Der Inhalt eines besetzten Platzes.
 *
 * <p>{@code addedAt} steht nur an Eintraegen, die vom Server kommen: ein
 * gerade erst hinzugefuegtes Projekt ist noch nicht aufgenommen, und ein
 * erfundener Zeitpunkt waere eine Behauptung.
 */
export interface Top10SlotEntry {
  project: ProjectCardResponse
  addedAt: string | null
}

/**
 * Der Arbeitszustand: genau {@link TOP10_SLOT_COUNT} Zellen, Index 0 ist
 * Platz 1. {@code null} heisst „Platz frei".
 */
export type Top10Slots = readonly (Top10SlotEntry | null)[]

/**
 * Baut die Zellen aus der Antwort von {@code GET /api/top10}.
 *
 * <p>Einsortiert wird ueber {@code position} und nie ueber die Reihenfolge im
 * Array: unbesetzte Plaetze fehlen in der Antwort, der Index waere also
 * verschoben, sobald es eine Luecke gibt. Ein Platz ausserhalb von 1 bis 10
 * wird uebergangen statt geraten; er kann nach §3.11 nicht vorkommen, und
 * eine stille Verschiebung waere schlimmer als ein fehlender Eintrag.
 */
export function buildSlots(entries: readonly Top10EntryResponse[]): Top10Slots {
  const slots: (Top10SlotEntry | null)[] = Array.from(
    { length: TOP10_SLOT_COUNT },
    () => null
  )
  for (const entry of entries) {
    const index = entry.position - 1
    if (index >= 0 && index < TOP10_SLOT_COUNT) {
      slots[index] = { project: entry.project, addedAt: entry.addedAt }
    }
  }
  return slots
}

/**
 * Der Nachbarplatz in dieser Richtung, oder {@code null} am Rand der Liste.
 *
 * <p><strong>Genau ein Schritt, nicht der naechste besetzte Platz.</strong>
 * Ein Klick auf „nach unten" an Platz 2 fuehrt auf Platz 3, gleichgueltig ob
 * dort ein Projekt steht. Ist der Platz besetzt, tauschen die beiden; ist er
 * frei, rueckt das Projekt hinein und laesst seinen alten Platz frei. Die
 * Bewegung ist damit die, die man an der Ziffer ablesen kann, und nicht eine,
 * die je nach Luecke mal einen und mal drei Plaetze weit springt.
 */
function neighbourIndex(
  slots: Top10Slots,
  index: number,
  direction: -1 | 1
): number | null {
  const target = index + direction
  return target >= 0 && target < slots.length ? target : null
}

/**
 * Laesst sich der Eintrag an dieser Zelle nach oben schieben? Auf Platz 1
 * nicht, dort ist der Knopf gesperrt (SC 4.1.2: ein Knopf, der nichts tut,
 * sagt das auch).
 */
export function canMoveUp(slots: Top10Slots, index: number): boolean {
  return slots[index] !== null && neighbourIndex(slots, index, -1) !== null
}

/** Dasselbe nach unten, auf Platz 10 gesperrt. */
export function canMoveDown(slots: Top10Slots, index: number): boolean {
  return slots[index] !== null && neighbourIndex(slots, index, 1) !== null
}

/**
 * Tauscht den Eintrag mit dem Nachbarplatz und liefert ein neues Feld.
 *
 * <p>Der Nachbar darf leer sein: dann rueckt das Projekt einen Platz weiter
 * und laesst seinen alten frei. Getauscht wird also die Zelle und nicht das
 * Projekt mit dem naechsten Projekt.
 *
 * <p>Ist der Zug nicht moeglich, kommt das unveraenderte Feld zurueck: die
 * Funktion ist damit an jedem Rand wirkungslos statt fehlerhaft, und die
 * Oberflaeche muss den Fall nicht zweimal pruefen.
 */
export function moveSlot(
  slots: Top10Slots,
  index: number,
  direction: "up" | "down"
): Top10Slots {
  const target = neighbourIndex(slots, index, direction === "up" ? -1 : 1)
  if (slots[index] === null || target === null) {
    return slots
  }
  const next = [...slots]
  next[target] = slots[index]
  next[index] = slots[target]
  return next
}

/**
 * Nimmt das Projekt von seinem Platz. Der Platz bleibt frei und die uebrigen
 * ruecken nicht nach, genau wie beim Entzug durch den Server (§3.11).
 * Endgueltig wird das erst mit „Reihenfolge speichern".
 */
export function clearSlot(slots: Top10Slots, index: number): Top10Slots {
  const next = [...slots]
  next[index] = null
  return next
}

/** Steht auf jedem der zehn Plaetze ein Projekt? */
export function isFull(slots: Top10Slots): boolean {
  return slots.every((slot) => slot !== null)
}

/** Steht dieses Projekt bereits auf einem Platz? */
export function containsProject(slots: Top10Slots, projectId: string): boolean {
  return slots.some((slot) => slot?.project.id === projectId)
}

/**
 * Setzt ein Projekt auf den ersten freien Platz und liefert ein neues Feld.
 *
 * <p>Unveraendert bleibt es, wenn alle zehn Plaetze belegt sind oder das
 * Projekt schon dabei ist: ein elfter Eintrag ist nicht anlegbar, und ein
 * doppelter ergaebe serverseitig 400 {@code VALIDATION_FAILED}. Die
 * Oberflaeche bietet beides gar nicht erst an; hier steht dieselbe Zusage
 * noch einmal, damit sie ohne Rendern pruefbar ist.
 */
export function addProject(
  slots: Top10Slots,
  project: ProjectCardResponse
): Top10Slots {
  if (isFull(slots) || containsProject(slots, project.id)) {
    return slots
  }
  const free = slots.findIndex((slot) => slot === null)
  const next = [...slots]
  next[free] = { project, addedAt: null }
  return next
}

/**
 * Die Projekte der Liste in ihrer Reihenfolge, ohne die freien Plaetze.
 *
 * <p>Nicht die Nutzlast des Endpoints, dafuer gibt es
 * {@link placementPayload}. Diese Funktion beantwortet „welche Projekte
 * stehen in der Top-10 und in welcher Reihenfolge", etwa fuer eine Anzahl
 * oder einen Vergleich.
 */
export function orderedProjectIds(slots: Top10Slots): string[] {
  return slots.flatMap((slot) => (slot === null ? [] : [slot.project.id]))
}

/**
 * Die Nutzlast von {@code PUT /admin/top10} (§3.11.1 Regel 3, seit Contract
 * v78): je Zelle ihr Projekt oder {@code null} fuer „Platz frei".
 *
 * <p><strong>Der Index ist der Platz, auch ueber eine Luecke hinweg.</strong>
 * {@code [A, null, C]} setzt A auf 1 und C auf 3 und laesst 2 unbesetzt. Eine
 * Platzangabe geht bewusst nicht mit; Reihenfolge und ausdrueckliche Position
 * koennten einander widersprechen.
 *
 * <p><strong>Nachlaufende freie Plaetze fallen weg.</strong> Ein freier Platz
 * hinter dem letzten Projekt ist dasselbe wie kein Platz, und der Server
 * schneidet sie ohnehin ab. Ohne das Abschneiden schickte die Oberflaeche bei
 * drei Projekten sieben bedeutungslose {@code null} mit, und zwei Aufrufe mit
 * gleicher Wirkung saehen im Vergleich verschieden aus.
 */
export function placementPayload(slots: Top10Slots): (string | null)[] {
  const cells = slots.map((slot) => slot?.project.id ?? null)
  let last = cells.length
  while (last > 0 && cells[last - 1] === null) {
    last -= 1
  }
  return cells.slice(0, last)
}

/**
 * Unterscheidet sich diese Belegung von der zuletzt geladenen?
 *
 * <p>Verglichen wird die Nutzlast, also das, was tatsaechlich hinausginge.
 * Seit Contract v78 zaehlt dabei auch der Ort einer Luecke: {@code [A, null,
 * C]} und {@code [A, C]} sind zwei verschiedene Belegungen, und genau
 * deshalb ist ein Zug in einen freien Platz jetzt eine echte Aenderung und
 * kein Zug ins Leere.
 *
 * <p>Gebraucht wird der Vergleich, damit ein Klick ohne Wirkung keinen
 * Schreibvorgang und damit keine Protokollzeile ausloest (§3.17).
 */
export function hasOrderChanged(
  slots: Top10Slots,
  original: Top10Slots
): boolean {
  const next = placementPayload(slots)
  const before = placementPayload(original)
  return (
    next.length !== before.length ||
    next.some((projectId, index) => projectId !== before[index])
  )
}

/**
 * Die noch unbesetzten Plaetze, aufsteigend.
 *
 * <p>Sie sind die Auswahl des Annahme-Dialogs: {@code accept} raeumt keinen
 * belegten Platz, sondern antwortet mit 409 {@code RESOURCE_IN_USE}
 * (§3.11.1). Ist die Liste leer, sind alle zehn Plaetze vergeben, und
 * angenommen wird erst wieder, wenn einer frei ist.
 */
export function freePositions(slots: Top10Slots): number[] {
  return slots.flatMap((slot, index) => (slot === null ? [index + 1] : []))
}

/*
 * Der Platzbereich je Stufe (§2.13). Record ueber den Enum-Typ ohne
 * Standardzweig: eine vierte Stufe bricht den Typecheck, statt still ohne
 * Vorbelegung zu bleiben.
 *
 * Die Bereiche sind Erlaeuterung und keine Zusage. Der Server prueft beim
 * Annehmen nicht, ob der vergebene Platz zur Stufe passt (§3.11.1 Regel 4);
 * sie bereitet die Entscheidung vor und nimmt sie nicht vorweg.
 */
const TIER_RANGES: Record<NominationTier, { first: number; last: number }> = {
  TOP_1: { first: 1, last: 1 },
  TOP_5: { first: 2, last: 5 },
  TOP_10: { first: 6, last: 10 },
}

/**
 * Der Platz, mit dem der Annahme-Dialog vorbelegt wird: der erste freie im
 * Bereich der vorgeschlagenen Stufe.
 *
 * <p>{@code null}, wenn dort keiner mehr frei ist. Dann bleibt das Feld leer
 * und verlangt eine ausdrueckliche Wahl, statt in einen fremden Bereich zu
 * springen und eine Empfehlung vorzutaeuschen, die niemand gegeben hat.
 *
 * <p><strong>Nicht aus {@code proposedPosition}.</strong> Das Feld traegt
 * seit Contract v68 den von der Administration <em>entschiedenen</em> Platz
 * und ist leer, solange der Vorschlag offen ist (§3.11); als Vorbelegung
 * taugt es damit nicht mehr.
 */
export function suggestedPositionFor(
  tier: NominationTier,
  free: readonly number[]
): number | null {
  const range = TIER_RANGES[tier]
  return (
    free.find(
      (position) => position >= range.first && position <= range.last
    ) ?? null
  )
}
