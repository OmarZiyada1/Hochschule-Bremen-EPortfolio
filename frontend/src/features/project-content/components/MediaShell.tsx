import { NodeViewWrapper } from "@tiptap/react"
import { TriangleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * Der gemeinsame Rahmen der sieben Medien- und Formelknoten auf der
 * <strong>Schreibflaeche</strong>: das NodeViewWrapper mit Ziehgriff-Anker,
 * Abstand und dem Hinweis, dass dem Block noch etwas fehlt.
 *
 * <p><strong>Der Ausklapper "Angaben zum Block" ist weg</strong>
 * (Nutzerentscheidung, WYSIWYG-Umbau in KAN-36): jeder Block zeigt seine
 * echte Darstellung wie im Renderer, und was einstellbar ist, steht direkt
 * am Block: die Bildbreite und die Galerie-Spalten als Leiste am Medium,
 * Alternativtexte und Unterschriften als schlanke Felder darunter. Ein
 * Formular neben dem Block war der Umweg, den dieser Umbau beendet.
 *
 * <p><strong>Der Warnhinweis ist sichtbar und nicht nur farbig.</strong> Er
 * traegt ein Symbol und Text (SC 1.4.1); er blockiert nichts, denn ein
 * unfertiger Block ist ein Arbeitszustand. Gespeichert wird er erst, wenn
 * er seine Pflichtattribute hat ({@code blockSerialization.docToBlocks}).
 */
export function MediaShell({
  incompleteHint,
  children,
}: {
  /** Gesetzt, solange dem Block etwas Notwendiges fehlt. */
  incompleteHint?: string | null
  children: ReactNode
}) {
  return (
    <NodeViewWrapper
      contentEditable={false}
      draggable
      data-drag-handle
      className="project-content-node group/media my-4 flex flex-col gap-2"
    >
      {children}

      {incompleteHint != null && incompleteHint !== "" && (
        <p className="type-caption flex items-center gap-1.5 text-muted-foreground">
          <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
          {incompleteHint}
        </p>
      )}
    </NodeViewWrapper>
  )
}
