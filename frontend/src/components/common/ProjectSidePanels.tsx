import { useState, type ReactNode } from "react"

import type { ProjectDetailResponse } from "@/api/types"
import { CommentPanel } from "@/components/common/CommentPanel"
import { ProjectInfoSection } from "@/components/common/ProjectInfoSection"

/** Welcher der beiden Aufklapper offen ist, oder keiner. */
type Panel = "info" | "comments" | null

/**
 * Projektinformationen und Kommentare als Akkordeon in einer Karte (KAN-83).
 *
 * <p><strong>Warum ein gemeinsamer Baustein.</strong> Die Reviewansicht
 * fuehrte dieses Paar seit KAN-37, die Seitenleiste des Editors dagegen zwei
 * getrennte Karten; genau das war der gemeldete Unterschied. Ihn durch
 * Abschreiben aufzuloesen hiesse, denselben Zustand an zwei Stellen zu
 * fuehren, und die beiden liefen beim naechsten Feinschliff auseinander.
 *
 * <p><strong>Warum ein Akkordeon und nicht zwei offene Kaesten.</strong> Zwei
 * offene Kaesten untereinander schieben die Kommentare unter die Falz. Der
 * Zustand liegt deshalb hier und nicht in den beiden Bausteinen: ein
 * Akkordeon ist eine Aussage ueber das Paar, nicht ueber ein Glied. Beide
 * nehmen dafuer {@code open} und {@code onOpenChange} entgegen.
 *
 * <p><strong>Keine Kommentare bei PUBLISHED</strong> (Nutzerentscheidung zur
 * Nacharbeit an KAN-37): dort ist die redaktionelle Arbeit vorbei, und die
 * Spalte zeigte nur noch einen Verlauf, an dem nichts mehr haengt. Die Regel
 * steht hier an einer Stelle statt in jeder Ansicht.
 */
export function ProjectSidePanels({
  project,
  context,
  defaultPanel = null,
  infoAction,
  showEmptyFields = false,
}: {
  project: ProjectDetailResponse
  /** Kommentarzusammenhang (§2.4): bestimmt die anbietbaren Kommentararten. */
  context: "editor" | "review"
  /**
   * Welcher Aufklapper beim Oeffnen der Seite offen ist.
   *
   * <p>Im Review sind es die Kommentare: sie sind dort die Arbeitsflaeche,
   * die Angaben der Nachschlagefall. Im Editor umgekehrt.
   */
  defaultPanel?: Panel
  /** Zusatzhandlung im Kopf der Projektinformationen, etwa „Angaben aendern". */
  infoAction?: ReactNode
  /** Auch leere Felder zeigen; im Editor der Hinweis, was noch fehlt. */
  showEmptyFields?: boolean
}) {
  const [panel, setPanel] = useState<Panel>(defaultPanel)

  return (
    <>
      <hr />
      <ProjectInfoSection
        project={project}
        open={panel === "info"}
        onOpenChange={(next) => setPanel(next ? "info" : null)}
        action={infoAction}
        showEmptyFields={showEmptyFields}
      />

      {project.status !== "PUBLISHED" && (
        <CommentPanel
          project={project}
          context={context}
          open={panel === "comments"}
          onOpenChange={(next) => setPanel(next ? "comments" : null)}
        />
      )}
    </>
  )
}
