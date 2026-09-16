import { ChevronDownIcon, InfoIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"
import { cn } from "@/lib/utils"

/**
 * Die aufklappbaren Projektinformationen der rechten Spalte.
 *
 * <p><strong>Ein Baustein fuer zwei Orte.</strong> Der Editor und der
 * Review-Modus zeigen dieselbe Karte: Statuszeile oben, darunter die
 * Projektinformationen, darunter die Kommentarspalte. Bis zur Nacharbeit an
 * KAN-37 stand der Aufklapper nur im {@code EditorSidebar}; die Review-Seite
 * haette ihn abschreiben muessen, und zwei Abschriften liefen beim naechsten
 * neuen Feld auseinander.
 *
 * <p><strong>Die Daten selbst kommen aus {@code ProjectMetaSidebar}</strong>,
 * also aus derselben Komponente wie auf der oeffentlichen Detailseite. Diese
 * Huelle setzt allein den Aufklapper darum und den Platz fuer eine Handlung
 * darunter.
 *
 * <p>Der Pfeil prueft auf die <em>Anwesenheit</em> von
 * {@code data-panel-open} und nicht auf den Wert „false": Base UI setzt das
 * Attribut ohne Wert, solange offen, und entfernt es sonst. Ein Selektor
 * {@code [data-panel-open="false"]} traefe nie, und der Pfeil bliebe stehen,
 * ohne dass ein Test rot wuerde.
 */
export function ProjectInfoSection({
  project,
  defaultOpen = false,
  open,
  onOpenChange,
  action,
  className,
}: {
  project: ProjectDetailResponse
  defaultOpen?: boolean
  /**
   * Gesteuert statt selbst verwaltet. Gesetzt, wo der Aufklapper zu einem
   * Akkordeon gehoert: dann entscheidet der Aufrufer, weil ein Akkordeon
   * eine Aussage ueber das Paar ist und nicht ueber ein Glied. Ohne diese
   * beiden Props verwaltet die Huelle sich weiter selbst.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Handlung unter den Daten, etwa der Weg ins Metadatenformular. */
  action?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <Collapsible
      defaultOpen={open === undefined ? defaultOpen : undefined}
      open={open}
      onOpenChange={onOpenChange}
      className={cn(className)}
    >
      {/* Der Trigger liegt in der Ueberschrift und nicht daneben: sonst
          haette die Statuskarte keinen Sprungpunkt (APG-Muster Disclosure,
          Befund des frontend-reviewers). Kein outline-none, es schaltete die
          globale Fokusregel ab und liesse nur den halbdurchsichtigen Ring
          uebrig (SC 1.4.11). */}
      <h2>
        <CollapsibleTrigger className="group/info flex w-full items-center justify-between gap-2 text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="type-body flex items-center gap-2 font-semibold">
            <InfoIcon aria-hidden="true" className="size-4" />
            {t("projectContent.sidebar.projectInfo")}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-3.5 transition-transform group-data-[panel-open]/info:rotate-180"
          />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="flex flex-col gap-4 pt-4">
        {/* Ob leere Felder als Strichzeile stehenbleiben, entscheidet
            die Sidebar selbst am Status des Projekts. Ein Schalter je
            Verwendungsstelle beantwortete dieselbe Frage dreimal
            verschieden. */}
        <ProjectMetaSidebar project={project} />
        {action}
      </CollapsibleContent>
    </Collapsible>
  )
}
