import type { Top10EntryResponse } from "@/api/types"

export interface Top10Slot {
  position: number
  entry?: Top10EntryResponse
}

/**
 * Legt die zehn Plaetze der Bestenliste an und fuellt sie ueber position,
 * nie ueber den Array-Index: die Antwort von GET /top10 traegt nur besetzte
 * Plaetze und kann Luecken haben (§3.11, Ticket KAN-31). Wird Platz 4
 * geraeumt, ruecken die uebrigen nicht nach; die Antwort lautet dann
 * 1, 2, 3, 5 und so weiter, und Platz 4 bleibt hier leer.
 *
 * Eintraege ausserhalb von 1 bis 10 bleiben unberuecksichtigt, statt die
 * Liste zu verruecken. Eine leere Antwort ist ein gueltiger Zustand und
 * ergibt zehn leere Plaetze.
 */
export function top10Slots(
  entries: readonly Top10EntryResponse[]
): Top10Slot[] {
  const byPosition = new Map<number, Top10EntryResponse>()
  for (const entry of entries) {
    if (entry.position >= 1 && entry.position <= 10) {
      byPosition.set(entry.position, entry)
    }
  }
  return Array.from({ length: 10 }, (_, index) => ({
    position: index + 1,
    entry: byPosition.get(index + 1),
  }))
}
