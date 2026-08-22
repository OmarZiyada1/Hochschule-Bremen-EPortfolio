import {
  ChevronDownIcon,
  HistoryIcon,
  InfoIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { HistoryDialog } from "@/features/project-content/components/HistoryDialog"
import { ViewModeSwitch } from "@/features/project-content/components/ViewModeSwitch"
import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"

/**
 * Die rechte Spalte des Editors (Figma, Knoten {@code Right}).
 *
 * <p>Zwei Karten: oben der Umschalter zwischen Vorschau und Bearbeiten,
 * darunter die Karte mit Statusbadge, Historie und den ausklappbaren
 * Projektinformationen.
 *
 * <p><strong>Vorschau heisst: die oeffentliche Seite.</strong> Der
 * Umschalter fuehrt auf {@code /projects/:id}, also genau in die Ansicht,
 * die auch Externe sehen, und dort steht derselbe Schalter fuer den Weg
 * zurueck. Eine eingebaute Vorschau zeigte denselben Renderer in einem
 * anderen Rahmen, mit anderer Breite und ohne die Umgebung der Seite; die
 * Frage „sieht das nachher so aus?" beantwortet nur die Seite selbst.
 * Vor dem Wechsel leert die Seite den Speichertakt, damit die Vorschau den
 * eben geschriebenen Stand zeigt.
 *
 * <p><strong>Der Umschalter ist ein {@code switch} mit ausdruecklichem
 * Namen.</strong> Die beiden Woerter links und rechts sind Zierat und
 * werden nicht vorgelesen; sie sagen nicht, welcher Zustand gerade gilt.
 * Der zugaengliche Name nennt deshalb genau eine Sache, und
 * {@code aria-checked} sagt ein oder aus.
 *
 * <p><strong>Die Projektinformationen kommen aus
 * {@code ProjectMetaSidebar}</strong>, also aus derselben Komponente wie
 * auf der oeffentlichen Detailseite. Eine zweite Fassung daneben waere ein
 * zweites Aussehen derselben Metadaten und liefe beim naechsten neuen Feld
 * auseinander.
 */
export function EditorSidebar({
  project,
  onPreview,
  onEditMetadata,
}: {
  project: ProjectDetailResponse
  /** Wechselt in die oeffentliche Ansicht; die Seite speichert vorher. */
  onPreview: () => void
  /**
   * Oeffnet die Metadatenseite zum Bearbeiten, ohne den Einreichweg.
   *
   * <p>Die Karte zeigt die Angaben, aber es gab von hier keinen Weg, sie
   * zu aendern: dafuer musste man ins Portfolio zurueck und das Projekt
   * dort wieder aufmachen. Die Seite speichert vorher den Text, wie bei
   * jedem anderen Weg aus dem Editor heraus.
   */
  onEditMetadata: () => void
}) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <aside
      aria-label={t("projectContent.sidebar.label")}
      className="flex w-full flex-col gap-4 lg:w-90"
    >
      <ViewModeSwitch
        mode="edit"
        onModeChange={(mode) => {
          if (mode === "preview") {
            onPreview()
          }
        }}
      />

      <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={project.status} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon aria-hidden="true" />
            {t("projectContent.sidebar.history")}
          </Button>
        </div>

        <Collapsible defaultOpen>
          <CollapsibleTrigger className="group/info flex w-full items-center justify-between gap-2 text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <span className="type-body flex items-center gap-2 font-semibold">
              <InfoIcon aria-hidden="true" className="size-4" />
              {t("projectContent.sidebar.projectInfo")}
            </span>
            {/*
             * Auf die Anwesenheit geprueft und nicht auf den Wert "false":
             * Base UI setzt data-panel-open ohne Wert, solange offen, und
             * entfernt das Attribut sonst. Ein Selektor
             * [data-panel-open="false"] traefe nie, und der Pfeil bliebe
             * stehen, ohne dass ein Test rot wuerde.
             */}
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3.5 transition-transform group-data-[panel-open]/info:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-4">
            <ProjectMetaSidebar project={project} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={onEditMetadata}
            >
              <SlidersHorizontalIcon aria-hidden="true" />
              {t("projectContent.sidebar.editMetadata")}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={project.statusHistory}
      />
    </aside>
  )
}
