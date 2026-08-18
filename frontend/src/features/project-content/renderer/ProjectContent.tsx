import { Fragment, useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { apiPaths } from "@/api/endpoints"
import type { BlockResponse } from "@/api/types"
import { blocksToDoc } from "@/features/project-content/blockSerialization"
import {
  renderBlockNode,
  type RenderContext,
  type TranslateFn,
} from "@/features/project-content/renderer/renderBlockNode"
import { UnknownBlockNotice } from "@/features/project-content/renderer/UnknownBlockNotice"
import { cn } from "@/lib/utils"

/**
 * Der Einstieg des Read-Only-Renderers: eine gespeicherte Blockliste als
 * semantisches HTML.
 *
 * <p>Verwendet von der oeffentlichen Detailseite (KAN-32), der Vorschau im
 * Editor (KAN-36), dem Review-Modus (KAN-37) und der Druckausgabe
 * (KAN-41). Er ist statusfrei: was jemand sehen darf, entscheidet der
 * Server.
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
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const idPrefix = useId()

  const { entries } = useMemo(() => blocksToDoc(blocks), [blocks])

  const context: RenderContext = useMemo(
    () => ({
      t: t as TranslateFn,
      locale: i18n.language,
      resolveFileUrl:
        resolveFileUrl ?? ((fileId: string) => apiPaths.files.detail(fileId)),
      idPrefix,
    }),
    [t, i18n.language, resolveFileUrl, idPrefix]
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
