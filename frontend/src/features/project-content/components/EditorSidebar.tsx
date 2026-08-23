import {
  ChevronDownIcon,
  HistoryIcon,
  InfoIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { CommentPanel } from "@/components/common/CommentPanel"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { HistoryDialog } from "@/features/project-content/components/HistoryDialog"
import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"
import { cn } from "@/lib/utils"

/**
 * Die rechte Spalte des Editors (Figma, Knoten {@code Right}).
 *
 * <p>Eine Karte mit Statusbadge, Historie und den ausklappbaren
 * Projektinformationen. Der Umschalter zwischen Vorschau und Bearbeiten
 * stand hier als eigene Karte darueber und steht seit dem Umzug der
 * Formatierungsleiste in der Kopfzeile ({@code EditorHeader}): er gehoert
 * zur Bedienung des Editors, nicht zu den Projektinformationen.
 *
 * <p><strong>Die Projektinformationen kommen aus
 * {@code ProjectMetaSidebar}</strong>, also aus derselben Komponente wie
 * auf der oeffentlichen Detailseite. Eine zweite Fassung daneben waere ein
 * zweites Aussehen derselben Metadaten und liefe beim naechsten neuen Feld
 * auseinander.
 *
 * <p><strong>Darunter steht die Kommentarspalte</strong> (KAN-37), und zwar
 * derselbe {@code CommentPanel} wie im Review-Modus. Ohne sie saehe die
 * Autor:in ihre Aenderungswuensche nirgends und liefe beim Einreichen in
 * ein sackgassenartiges 409 {@code CHANGE_REQUESTS_OPEN}. Sichtbar ist sie
 * fuer die gesamte Projektseite, also Autor:in und Projektmitglieder;
 * erstellbar ist hier allein eine Antwort ({@code context="editor"}).
 * Welche Kommentare in der Liste stehen, entscheidet ohnehin der Server:
 * eine {@code NOTE} erscheint fuer die Projektseite gar nicht erst darin
 * (§6.1).
 */
export function EditorSidebar({
  project,
  onEditMetadata,
  className,
}: {
  project: ProjectDetailResponse
  /**
   * Zusaetzliche Klassen fuer die Huelle.
   *
   * <p>Gebraucht, weil dieselbe Leiste an zwei Stellen steht: breit neben
   * der Schreibflaeche, schmal in einer Schublade. Was sie zeigt, ist
   * beidemal dasselbe; wo sie steht und ob sie sichtbar ist, entscheidet
   * die Seite.
   */
  className?: string
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
      className={cn("flex w-full flex-col gap-4 lg:w-90", className)}
    >
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
            {/*
             * Mit den leeren Feldern: waehrend des Schreibens zeigt die
             * vollstaendige Liste, was eingetragen ist und was nicht, und
             * sie springt nicht, sobald ein Feld gefuellt wird. Auf der
             * oeffentlichen Seite bleibt es beim Weglassen.
             */}
            <ProjectMetaSidebar project={project} showEmptyFields />
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

      <CommentPanel project={project} context="editor" />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={project.statusHistory}
      />
    </aside>
  )
}
