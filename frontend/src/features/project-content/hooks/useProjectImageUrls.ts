import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { resolveApiUrl } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import { fileQueries } from "@/api/queries/files"
import type { BlockResponse } from "@/api/types"
import { blocksToDoc } from "@/features/project-content/blockSerialization"

/**
 * Loest die Bildadressen eines <strong>noch nicht veroeffentlichten</strong>
 * Beitrags auf, damit die Vorschau zeigt, was der Beitrag enthaelt.
 *
 * <p><strong>Warum es das braucht.</strong> {@code GET /api/files/{id}} ist
 * oeffentlich, sobald das Projekt PUBLISHED ist; davor entscheidet die
 * Berechtigung der anfragenden Person (§3.15, §5, Zeile „Datei lesen"). Ein
 * {@code img} weist nichts nach, das Token liegt im Store und nicht in
 * einem Cookie, und so beantwortet der Server jede Bildanfrage der Vorschau
 * eines Entwurfs mit 401. Zu sehen war davon nichts: kein Fehler, keine
 * Meldung, nur leere Stellen im Beitrag. Die Detailseite hat den Einstieg
 * dafuer von Anfang an vorgesehen ({@code ProjectContent.resolveFileUrl}),
 * gefuellt wird er hier.
 *
 * <p><strong>Nur Bilder.</strong> Ein Bild muss im Fluss stehen und darf
 * hoechstens 10 MiB gross sein; es ueber den angemeldeten Weg zu holen
 * kostet also wenig und ist der einzige Weg, es ueberhaupt zu zeigen. Ton
 * (25 MiB), Dokument (25 MiB) und Video (200 MiB) bleiben bei der blossen
 * Adresse: eine Object-URL zwaenge den Browser, die ganze Datei im Voraus
 * zu laden, und nimmt ihm die Bereichsanfragen, mit denen ein Video
 * ueberhaupt erst abspielbar wird (§3.15, KAN-72). In der Vorschau eines
 * Entwurfs bleiben diese drei deshalb stumm; das ist ein benannter offener
 * Punkt an KAN-36 und keine stille Annahme.
 *
 * <p>Die Object-URLs selbst gehoeren dem Query-Cache und werden mit ihm
 * freigegeben ({@code fileQueries.objectUrl}); dieselbe Datei an zwei
 * Stellen teilt sich eine Adresse.
 *
 * @param blocks  Blockliste des Projekts, wie sie die Detailseite laedt
 * @param enabled falsch bei PUBLISHED: dort genuegt die blosse Adresse, und
 *                sie ist obendrein oeffentlich zwischenspeicherbar
 */
export function useProjectImageUrls(
  blocks: readonly BlockResponse[],
  enabled: boolean
): (fileId: string) => string {
  const fileIds = useMemo(
    () => (enabled ? imageFileIds(blocks) : []),
    [blocks, enabled]
  )

  const urls = useQueries({
    queries: fileIds.map((fileId) =>
      fileQueries.objectUrl(apiPaths.files.detail(fileId))
    ),
    /* Aus den Ergebnissen wird gleich hier eine schlichte Liste: sie laesst
       sich strukturell teilen und behaelt damit ihre Identitaet, solange
       sich nichts geaendert hat. Ein Objekt mit Funktionen taete das
       nicht, und der Renderer baute dann bei jedem Rendern neu auf. */
    combine: (results) =>
      results.map((result) =>
        typeof result.data === "string" ? result.data : null
      ),
  })

  return useMemo(() => {
    const byFileId = new Map<string, string>()
    fileIds.forEach((fileId, index) => {
      const url = urls[index]
      if (url != null) {
        byFileId.set(fileId, url)
      }
    })
    /* Der Rueckfall ist der Standard der Detailseite: fuer alles, was hier
       nicht aufgeloest wird, aendert sich nichts. */
    return (fileId: string) =>
      byFileId.get(fileId) ?? resolveApiUrl(apiPaths.files.detail(fileId))
  }, [fileIds, urls])
}

/**
 * Die Datei-IDs aller Bilder eines Beitrags, ohne Doppelte und in
 * Lesereihenfolge.
 *
 * <p>Ueber {@code blocksToDoc} und nicht ueber das rohe JSON: damit gilt
 * hier dieselbe Whitelist wie beim Rendern, ein unlesbarer Block faellt
 * also weg, statt eine Datei-ID vorzutaeuschen.
 */
function imageFileIds(blocks: readonly BlockResponse[]): string[] {
  const found = new Set<string>()
  for (const node of blocksToDoc(blocks).doc.content) {
    if (node.type === "imageBlock") {
      found.add(node.attrs.fileId)
    }
    if (node.type === "galleryBlock") {
      for (const item of node.attrs.items) {
        found.add(item.fileId)
      }
    }
  }
  return [...found]
}
