import { Fragment, useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { resolveApiUrl } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { BlockResponse } from "@/api/types"
import { blocksToDoc } from "@/features/project-content/blockSerialization"
import {
  renderBlockNode,
  type RenderContext,
  type TranslateFn,
} from "@/features/project-content/renderer/renderBlockNode"
import type { FileState } from "@/features/project-content/renderer/MediaSlot"
import { UnknownBlockNotice } from "@/features/project-content/renderer/UnknownBlockNotice"
import { cn } from "@/lib/utils"

/**
 * Der Einstieg des Read-Only-Renderers: eine gespeicherte Blockliste als
 * semantisches HTML.
 *
 * <p>Verwendet von der oeffentlichen Detailseite (KAN-32), dem Review-Modus
 * (KAN-37) samt seiner Vorschau, der Vorschau im Editor an Ort und Stelle
 * (KAN-104) und der Druckausgabe (KAN-41). Er ist statusfrei: was jemand
 * sehen darf, entscheidet der Server.
 *
 * <p><strong>Kein Tiptap im Lesepfad.</strong> Der Renderer laeuft ueber
 * das Typmodell und die Whitelist, nicht ueber ein ProseMirror-Dokument.
 * {@code blocksToDoc} sortiert nach {@code orderIndex}, laesst jeden Inhalt
 * durch die Whitelist und liefert die Lesereihenfolge einschliesslich der
 * Loecher; deshalb steht der Platzhalter dort, wo der Block stand.
 *
 * <p>Die Klasse {@code .project-content} haengt nicht an
 * {@code .ProseMirror}: KAN-36 setzt sie spaeter auch auf der
 * Schreibflaeche, damit ein Beitrag im Editor aussieht wie danach.
 */
export function ProjectContent({
  blocks,
  resolveFileUrl,
  fileState,
  forPrint = false,
  className,
}: {
  blocks: readonly BlockResponse[]
  /**
   * Eigene Aufloesung der Dateiadresse. Der Standard ist der Eintrag aus
   * {@code apiPaths}; auf der Detailseite genuegt er, in der Vorschau eines
   * Entwurfs nicht, weil {@code GET /api/files/{id}} nur bei PUBLISHED
   * oeffentlich ist.
   */
  resolveFileUrl?: (fileId: string) => string
  /**
   * Wie es um eine Datei steht, wenn die Seite sie selbst abruft. Ohne
   * Angabe gilt jede als abrufbar; Naeheres an {@code MediaSlot}.
   */
  fileState?: (fileId: string) => FileState
  /**
   * Ansicht fuer das Papier: das Inhaltsverzeichnis steht dann
   * aufgeschlagen da (§2.5, seit Contract v84).
   *
   * <p>Als Eigenschaft und nicht als CSS-Regel: ein zugeklapptes
   * {@code details} verbirgt seinen Inhalt ueber den eigenen Mechanismus
   * des Browsers, und der laesst sich mit {@code display} nicht wieder
   * aufmachen. Aufgeschlagen sein muss es, weil ein Blatt nichts
   * aufklappen kann.
   */
  forPrint?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const idPrefix = useId()

  const { entries } = useMemo(() => blocksToDoc(blocks), [blocks])

  /*
   * Die laufende Nummer je Ueberschrift, in Dokumentreihenfolge ab 0
   * (§2.5 seit v84). Sie steht nicht im Dokument: das Inhaltsverzeichnis
   * merkt sie sich in seinen Eintraegen, und Anzeige wie Druck vergeben die
   * Sprungmarke daraus. Gezaehlt wird ueber alle Eintraege, auch die
   * verworfenen: der Schluessel ist der Index in dieser Liste, und ihn hier
   * anders zu zaehlen als beim Rendern ergaebe verschobene Anker.
   */
  const headingOrdinals = useMemo(() => {
    const ordinals = new Map<string, number>()
    let next = 0
    entries.forEach((entry, index) => {
      if (entry.kind === "node" && entry.node.type === "heading") {
        ordinals.set(String(index), next)
        next += 1
      }
    })
    return ordinals
  }, [entries])

  const context: RenderContext = useMemo(
    () => ({
      t: t as TranslateFn,
      locale: i18n.language,
      /*
       * Ueber resolveApiUrl, nicht ueber den nackten Pfad: die Adresse landet
       * im src eines img, video oder iframe und laeuft nie durch request(),
       * die Basis-URL muesste sie also selbst tragen. Ohne das laedt bei
       * gesetztem VITE_API_BASE_URL kein einziges Blockmedium, waehrend das
       * Titelbild daneben erscheint (aufgefallen in KAN-32, dem ersten
       * Verwender des Standards).
       */
      resolveFileUrl:
        resolveFileUrl ??
        ((fileId: string) => resolveApiUrl(apiPaths.files.detail(fileId))),
      fileState,
      idPrefix,
      headingOrdinal: (nodeKey: string) => headingOrdinals.get(nodeKey),
      forPrint,
    }),
    [
      t,
      i18n.language,
      resolveFileUrl,
      fileState,
      idPrefix,
      headingOrdinals,
      forPrint,
    ]
  )

  return (
    <div className={cn("project-content", className)}>
      {entries.map((entry, index) =>
        entry.kind === "node" ? (
          <Fragment key={entry.id ?? `block-${index}`}>
            {renderBlockNode(entry.node, String(index), context)}
          </Fragment>
        ) : (
          <UnknownBlockNotice
            key={entry.dropped.id ?? `dropped-${index}`}
            nodeType={entry.dropped.nodeType}
            reason={entry.dropped.reason}
            detail={entry.dropped.detail}
          />
        )
      )}
    </div>
  )
}
