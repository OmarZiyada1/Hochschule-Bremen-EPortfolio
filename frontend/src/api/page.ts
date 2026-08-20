import type { ApiSchemas } from "@/api/types"

/**
 * Seitenformat nach Contract 6.6. Die Feldnamen entsprechen seit v18 denen
 * von Springs Page, das Record ist aber ein eigenes: Spring markiert die
 * direkte Serialisierung von Page seit 3.3 als instabil. Es gibt deshalb
 * bewusst kein pageable, sort, first, last und numberOfElements; wer eines
 * davon liest, bekommt undefined, ohne dass ein Fehler auftritt.
 *
 * Generisch, weil die generierte schema.d.ts genau ein PageResponse-Schema
 * fuehrt, dessen content fest auf ProjectCardResponse[] steht, obwohl auch
 * andere Endpoints (etwa /admin/users) paginiert antworten. Die Metafelder
 * kommen deshalb aus der generierten Form (eine Contract-Umbenennung bricht
 * hier den Typecheck, statt still zu driften); nur content wird je
 * Element-Typ aufgespannt, und der Element-Typ selbst kommt weiterhin aus
 * der schema.d.ts.
 *
 * Die Stammdaten-Endpoints (/categories, /faculties, /study-programs,
 * /modules) liefern bewusst keine Seite, sondern vollstaendige Listen.
 */
export type PageResponse<T> = Omit<ApiSchemas["PageResponse"], "content"> & {
  content: T[]
}

/**
 * Ob nach dieser Seite eine weitere folgt, etwa fuer "Mehr laden" oder
 * getNextPageParam. page ist 0-basiert (Contract 6.6).
 */
export function hasNextPage(
  page: Pick<PageResponse<unknown>, "page" | "totalPages">
): boolean {
  return page.page + 1 < page.totalPages
}

/**
 * Leere Seite als Ausgangs- oder Rueckfallwert, damit Ansichten nicht mit
 * undefined rechnen muessen, bevor die erste Antwort da ist.
 */
export function emptyPage<T>(): PageResponse<T> {
  return { content: [], page: 0, size: 0, totalElements: 0, totalPages: 0 }
}
