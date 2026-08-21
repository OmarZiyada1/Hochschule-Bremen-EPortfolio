import {
  ChevronDownIcon,
  EyeIcon,
  HistoryIcon,
  InfoIcon,
  PencilIcon,
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
import { Switch } from "@/components/ui/switch"
import { HistoryDialog } from "@/features/project-content/components/HistoryDialog"
import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"

/**
 * Die rechte Spalte des Editors (Figma
 * {@code Template / Studierende · Editor · Auswahlleiste}, Knoten
 * {@code Right}).
 *
 * <p>Zwei Karten: oben der Umschalter zwischen Vorschau und Bearbeiten,
 * darunter die Karte mit Statusbadge, Historie und den ausklappbaren
 * Projektinformationen.
 *
 * <p><strong>Der Umschalter ist ein {@code switch} mit ausdruecklichem
 * Namen.</strong> Die beiden Woerter links und rechts sind Zierat und
 * werden nicht vorgelesen; sie sagen nicht, welcher Zustand gerade gilt.
 * Der zugaengliche Name nennt deshalb genau eine Sache („Vorschau"), und
 * {@code aria-checked} sagt ein oder aus. Ohne das hoerte man nur
 * „Schalter, aktiviert" und wuesste nicht, wovon.
 *
 * <p><strong>Die Projektinformationen kommen aus
 * {@code ProjectMetaSidebar}</strong>, also aus derselben Komponente wie
 * auf der oeffentlichen Detailseite. Sie zeigt genau die Felder des
 * Templates in derselben Reihenfolge; eine zweite Fassung daneben waere ein
 * zweites Aussehen derselben Metadaten und liefe beim naechsten neuen Feld
 * auseinander.
 */
export function EditorSidebar({
  project,
  previewing,
  onPreviewingChange,
}: {
  project: ProjectDetailResponse
  previewing: boolean
  onPreviewingChange: (previewing: boolean) => void
}) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <aside
      aria-label={t("projectContent.sidebar.label")}
      className="flex w-full flex-col gap-4 lg:w-90"
    >
      <div className="flex items-center justify-center gap-3 rounded-card border border-border bg-card px-4 py-3">
        <span
          aria-hidden="true"
          className="type-body-sm flex items-center gap-1.5 text-muted-foreground"
        >
          <EyeIcon className="size-3.5" />
          {t("projectContent.sidebar.preview")}
        </span>
        <Switch
          checked={previewing}
          onCheckedChange={onPreviewingChange}
          aria-label={t("projectContent.sidebar.previewToggle")}
        />
        <span
          aria-hidden="true"
          className="type-body-sm flex items-center gap-1.5 text-muted-foreground"
        >
          <PencilIcon className="size-3.5" />
          {t("projectContent.sidebar.edit")}
        </span>
      </div>

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
             * [data-panel-open="false"] traefe deshalb nie, und der Pfeil
             * bliebe stehen, ohne dass ein Test rot wuerde.
             */}
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3.5 transition-transform group-data-[panel-open]/info:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <ProjectMetaSidebar project={project} />
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
