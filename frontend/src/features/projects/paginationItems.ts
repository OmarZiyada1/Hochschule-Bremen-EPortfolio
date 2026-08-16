export type PaginationItemValue = number | "ellipsis-start" | "ellipsis-end"

/**
 * Sichtbare Seitenzahlen der Bibliotheks-Paginierung (Template "Projekte
 * (Oeffentlich)"): immer die erste und letzte Seite, dazu ein Fenster um
 * die aktuelle; Luecken werden zu genau einer Auslassung je Seite der
 * aktuellen Position. Als Funktion neben der Seite, damit die Faelle ohne
 * Rendern testbar sind (Skill frontend-modul, Abschnitt 3).
 *
 * page ist hier 1-basiert, wie in der URL sichtbar; die 0-basierte Zaehlung
 * des Servers (§6.6) betrifft nur den Request.
 */
export function paginationItems(
  page: number,
  totalPages: number
): PaginationItemValue[] {
  if (totalPages <= 0) {
    return []
  }
  const candidates = new Set([1, totalPages, page - 1, page, page + 1])
  const pages = [...candidates]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b)

  const items: PaginationItemValue[] = []
  let previous = 0
  for (const candidate of pages) {
    if (previous !== 0 && candidate - previous > 1) {
      items.push(candidate <= page ? "ellipsis-start" : "ellipsis-end")
    }
    items.push(candidate)
    previous = candidate
  }
  return items
}
