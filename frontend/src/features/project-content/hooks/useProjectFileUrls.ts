import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { resolveApiUrl } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import { fileQueries } from "@/api/queries/files"
import type { BlockResponse } from "@/api/types"
import { blocksToDoc } from "@/features/project-content/blockSerialization"
import type { FileState } from "@/features/project-content/renderer/MediaSlot"

/**
 * Loest die Dateiadressen eines <strong>noch nicht veroeffentlichten</strong>
 * Beitrags auf, damit die Vorschau zeigt, was der Beitrag enthaelt.
 *
 * <p><strong>Warum es das braucht.</strong> {@code GET /api/files/{id}} ist
 * oeffentlich, sobald das Projekt PUBLISHED ist; davor entscheidet die
 * Berechtigung der anfragenden Person (§3.15, §5, Zeile „Datei lesen"). Ein
 * {@code img}, {@code video} oder {@code audio} weist nichts nach, das
 * Token liegt im Store und nicht in einem Cookie, und so beantwortet der
 * Server jede Medienanfrage der Vorschau eines Entwurfs mit 401. Zu sehen
 * war davon nichts: kein Fehler, keine Meldung, nur leere Stellen im
 * Beitrag. Die Detailseite hat den Einstieg dafuer von Anfang an vorgesehen
 * ({@code ProjectContent.resolveFileUrl}), gefuellt wird er hier.
 *
 * <p><strong>Alle Medien, nicht nur die Bilder.</strong> Die Vorschau ist
 * die echte Seite und keine Nachbildung; ein Beitrag, in dem das Video
 * fehlt, beantwortet die Frage nicht, um derentwillen jemand die Vorschau
 * oeffnet. Video, Ton und Dokument laufen deshalb denselben Weg wie Bild
 * und Galerie.
 *
 * <p><strong>Was das kostet, und warum es hier vertretbar ist.</strong> Eine
 * Object-URL liegt vollstaendig im Browser: der Inhalt wird im Voraus
 * geladen, und die Bereichsanfragen, die {@code GET /api/files/{id}} seit
 * KAN-72 beantwortet, entfallen fuer diesen einen Weg. Bei einem grossen
 * Video ist das spuerbar. Es trifft ausschliesslich die Vorschau eines
 * eigenen, noch nicht veroeffentlichten Beitrags, also eine bewusste
 * Handlung an eigenen Dateien; sobald der Beitrag veroeffentlicht ist,
 * laeuft jede Datei wieder ueber die blosse Adresse mitsamt Bereichen und
 * Zwischenspeicher. Ein sparsamerer Weg waere eine kurzlebige signierte
 * Adresse vom Server; das ist eine Contract-Aenderung und steht als
 * benannter offener Punkt an KAN-36.
 *
 * <p>Die Object-URLs gehoeren dem Query-Cache und werden mit ihm freigegeben
 * ({@code fileQueries.objectUrl}); dieselbe Datei an zwei Stellen teilt sich
 * eine Adresse.
 *
 * @param blocks  Blockliste des Projekts, wie sie die Detailseite laedt
 * @param enabled falsch bei PUBLISHED: dort genuegt die blosse Adresse, und
 *                sie ist obendrein oeffentlich zwischenspeicherbar
 */
export function useProjectFileUrls(
  blocks: readonly BlockResponse[],
  enabled: boolean
): {
  resolveFileUrl: (fileId: string) => string
  fileState: (fileId: string) => FileState
} {
  const fileIds = useMemo(
    () => (enabled ? blockFileIds(blocks) : []),
    [blocks, enabled]
  )

  const ergebnisse = useQueries({
    queries: fileIds.map((fileId) =>
      fileQueries.objectUrl(apiPaths.files.detail(fileId))
    ),
    /* Aus den Ergebnissen wird gleich hier eine schlichte Liste aus Adresse
       und Zustand: sie laesst sich strukturell teilen und behaelt damit
       ihre Identitaet, solange sich nichts geaendert hat. Ein Objekt mit
       Funktionen taete das nicht, und der Renderer baute dann bei jedem
       Rendern neu auf. */
    combine: (results) =>
      results.map((result) => ({
        url: typeof result.data === "string" ? result.data : null,
        state: (result.isError
          ? "error"
          : result.isPending
            ? "pending"
            : "ready") as FileState,
      })),
  })

  return useMemo(() => {
    const byFileId = new Map<string, { url: string | null; state: FileState }>()
    fileIds.forEach((fileId, index) => {
      const eintrag = ergebnisse[index]
      if (eintrag !== undefined) {
        byFileId.set(fileId, eintrag)
      }
    })
    return {
      /* Der Rueckfall ist der Standard der Detailseite: fuer alles, was hier
         nicht aufgeloest wird, aendert sich nichts. Solange der Abruf laeuft
         oder gescheitert ist, kommt die Adresse nicht ins DOM, denn dann
         zeigt MediaSlot Hinweis oder Meldung. */
      resolveFileUrl: (fileId: string) =>
        byFileId.get(fileId)?.url ??
        resolveApiUrl(apiPaths.files.detail(fileId)),
      /* Was hier nicht abgerufen wird, gilt als abrufbar: die oeffentliche
         Adresse traegt sich selbst, und ob etwas dahinter liegt, merkt der
         Browser. */
      fileState: (fileId: string) => byFileId.get(fileId)?.state ?? "ready",
    }
  }, [fileIds, ergebnisse])
}

/**
 * Die Datei-IDs aller Medien eines Beitrags, ohne Doppelte und in
 * Lesereihenfolge.
 *
 * <p>Ueber {@code blocksToDoc} und nicht ueber das rohe JSON: damit gilt
 * hier dieselbe Whitelist wie beim Rendern, ein unlesbarer Block faellt
 * also weg, statt eine Datei-ID vorzutaeuschen. Ein {@code VIDEO} mit
 * Anbieter statt Datei traegt keine ID und faellt von selbst heraus; die
 * Einbettung laeuft ohnehin ueber den Anbieter und nicht ueber den
 * Objektspeicher.
 */
function blockFileIds(blocks: readonly BlockResponse[]): string[] {
  const found = new Set<string>()
  for (const node of blocksToDoc(blocks).doc.content) {
    switch (node.type) {
      case "imageBlock":
      case "audioBlock":
      case "documentBlock":
        found.add(node.attrs.fileId)
        break
      case "galleryBlock":
        for (const item of node.attrs.items) {
          found.add(item.fileId)
        }
        break
      case "videoBlock":
        if (node.attrs.fileId !== undefined) {
          found.add(node.attrs.fileId)
        }
        break
      default:
        break
    }
  }
  return [...found]
}
