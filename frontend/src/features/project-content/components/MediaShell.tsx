import { NodeViewWrapper } from "@tiptap/react"
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * Der gemeinsame Rahmen der sieben Medien- und Formelknoten auf der
 * <strong>Schreibflaeche</strong>.
 *
 * <p>Er traegt drei Dinge: die Vorschau, die Angaben zum Block und den
 * Hinweis darauf, dass noch etwas fehlt.
 *
 * <p><strong>Die Angaben stehen in einem Ausklapper und nicht dauerhaft
 * offen.</strong> Alternativtext, Bildunterschrift und Breite sind drei
 * Felder je Bild; dauerhaft sichtbar zerlegten sie einen Beitrag mit fuenf
 * Bildern in ein Formular. Zugeklappt bleibt der Beitrag lesbar, und der
 * Ausklapper ist ueber die Tastatur erreichbar wie jede Schaltflaeche
 * (SC 2.1.1). Ein Blaettern in der Auswahl braucht es dafuer nicht: der
 * Zustand haengt am Block und nicht an der Textmarke.
 *
 * <p><strong>Der Block bleibt aenderbar, solange er steht.</strong> Das ist
 * der Unterschied zu einem Dialog beim Einfuegen: wer sich im Alternativtext
 * vertippt oder die Bildbreite anders will, klappt die Angaben auf. Es gibt
 * keinen Zustand, aus dem heraus nur noch Loeschen und Neuanlegen hilft.
 *
 * <p><strong>Der Warnhinweis ist sichtbar und nicht nur farbig.</strong> Er
 * traegt ein Symbol und Text (SC 1.4.1); er blockiert nichts, denn ein
 * unfertiger Block ist ein Arbeitszustand. Gespeichert wird er erst, wenn
 * er seine Pflichtattribute hat ({@code blockSerialization.docToBlocks}).
 */
export function MediaShell({
  label,
  incompleteHint,
  settings,
  children,
}: {
  /** Name des Blocktyps, fuer die Beschriftung des Ausklappers. */
  label: string
  /** Gesetzt, solange dem Block etwas Notwendiges fehlt. */
  incompleteHint?: string | null
  /** Die Felder des Blocks; ohne sie entfaellt der Ausklapper. */
  settings?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()

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

      {settings !== undefined && (
        <Collapsible>
          <CollapsibleTrigger className="group/settings type-caption flex items-center gap-1 rounded-control text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3.5 transition-transform group-data-[panel-open]/settings:rotate-180"
            />
            {t("projectContent.mediaShell.settings", { block: label })}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="flex flex-col gap-3 rounded-card border border-border bg-muted/40 p-4">
              {settings}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </NodeViewWrapper>
  )
}
