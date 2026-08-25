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
 * <p><strong>Gespeichert wird trotzdem dicht.</strong> {@code PUT
 * /admin/top10} nimmt die vollstaendige, geordnete Liste der Projekte und
 * nummeriert sie anschliessend lueckenlos ab 1 durch (§3.11.1 Regel 3). Eine
 * Luecke ueberlebt das Speichern also nicht, und das ist kein Fehler,
 * sondern die Zusage des Endpoints: sie entsteht durch ein Ereignis von
 * aussen, nicht durch eine Entscheidung der Administration.
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
 * Der Index des naechsten besetzten Platzes in dieser Richtung, oder
 * {@code null}, wenn es keinen gibt.
 *
 * <p>Freie Plaetze werden uebersprungen und bleiben, wo sie sind: getauscht
 * werden immer zwei Projekte. Ein Tausch mit einer leeren Zelle saehe wie
 * eine Bewegung aus, verschoebe aber nur die Luecke und aenderte an der
 * gespeicherten Reihenfolge nichts, weil {@code PUT /admin/top10} ohnehin
 * dicht durchnummeriert.
 */
function neighbourIndex(
  slots: Top10Slots,
  index: number,
  direction: -1 | 1
): number | null {
  for (let i = index + direction; i >= 0 && i < slots.length; i += direction) {
    if (slots[i] !== null) {
      return i
    }
  }
  return null
}

/**
 * Laesst sich der Eintrag an dieser Zelle nach oben schieben? Am ersten
 * besetzten Platz nicht, dort ist der Knopf gesperrt (SC 4.1.2: ein Knopf,
 * der nichts tut, sagt das auch).
 */
export function canMoveUp(slots: Top10Slots, index: number): boolean {
  return slots[index] !== null && neighbourIndex(slots, index, -1) !== null
}

/** Dasselbe nach unten, am letzten besetzten Platz gesperrt. */
export function canMoveDown(slots: Top10Slots, index: number): boolean {
  return slots[index] !== null && neighbourIndex(slots, index, 1) !== null
}

/**
 * Tauscht den Eintrag mit dem naechsten besetzten Platz darueber
 * beziehungsweise darunter und liefert ein neues Feld.
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
 * Die Nutzlast von {@code PUT /admin/top10}: die IDs der besetzten Plaetze
 * in ihrer Reihenfolge, freie Plaetze fallen weg.
 *
 * <p>Die Reihenfolge <em>ist</em> die Aussage (§3.11.1 Regel 3): Platz 1 ist
 * das erste Element. Eine Platzangabe geht bewusst nicht mit.
 */
export function orderedProjectIds(slots: Top10Slots): string[] {
  return slots.flatMap((slot) => (slot === null ? [] : [slot.project.id]))
}

/**
 * Unterscheidet sich der Arbeitszustand vom zuletzt geladenen Stand?
 *
 * <p>Verglichen wird die gespeicherte Nutzlast und nicht das Feld: eine
 * verschobene Luecke aendert am Ergebnis von {@code PUT /admin/top10}
 * nichts, weil der Server dicht durchnummeriert. „Reihenfolge speichern"
 * bleibt deshalb gesperrt, solange sich nur eine Luecke bewegt hat, und
 * verspricht damit keine Aenderung, die keine waere.
 */
export function hasOrderChanged(
  slots: Top10Slots,
  original: Top10Slots
): boolean {
  const next = orderedProjectIds(slots)
  const before = orderedProjectIds(original)
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

/**
 * Die Signatur eines Serverstands: Platz und Projekt je Eintrag.
 *
 * <p>Sie ist der {@code key}, mit dem die Seite diesen Editor rendert, und
 * damit der ganze Mechanismus, der den Arbeitszustand mit dem Server
 * abgleicht. Aendert sich der Stand, aendert sich die Signatur, React baut
 * den Editor neu auf und {@code useState} liest den frischen Stand als
 * Anfangswert. Solange nur lokal umsortiert wird, bleibt sie gleich und die
 * Arbeit steht.
 *
 * <p><strong>Warum nicht ein Effekt mit {@code setSlots}.</strong> Ein
 * {@code setState} im Effektkoerper loest eine zweite Renderrunde aus und
 * ist genau das, wovon „You Might Not Need an Effect" abraet; der
 * React-Compiler-Lint weist es zurueck. Der {@code key} ist der von React
 * vorgesehene Weg, den Zustand einer Teilansicht zurueckzusetzen, und er
 * kommt ohne Effekt und ohne zweite Runde aus.
 */
export function slotSignature(entries: readonly Top10EntryResponse[]): string {
  return entries.map((entry) => `${entry.position}:${entry.project.id}`).join(",")
}
