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
 * <p><strong>Voreingestellt offen sind die Kommentare</strong>, im Editor wie
 * in der Reviewansicht und in jedem Status (KAN-104, Entscheidung). Bis dahin
 * oeffnete der Editor die Angaben und nur in REVISION die Kommentare, die
 * Reviewansicht setzte die Kommentare ausdruecklich. Die Regel steht jetzt
 * einmal hier: die Kommentare sind an beiden Orten die Stelle, an der
 * gearbeitet wird, die Angaben der Nachschlagefall.
 *
 * <p><strong>Keine Kommentare bei PUBLISHED</strong> (Nutzerentscheidung zur
 * Nacharbeit an KAN-37): dort ist die redaktionelle Arbeit vorbei, und die
 * Spalte zeigte nur noch einen Verlauf, an dem nichts mehr haengt. Die Regel
 * steht hier an einer Stelle statt in jeder Ansicht.
 *
 * <p><strong>Daraus folgt die eine Ausnahme von der Vorgabe:</strong> bei
 * PUBLISHED stehen die Projektinformationen offen, sonst stuende eine Karte
 * da, in der nichts offen ist (KAN-104). Abgeleitet und nicht beim Montieren
 * einmal gesetzt, denn der Status kann waehrend der Anzeige dorthin wechseln:
 * die Reviewansicht veroeffentlicht an Ort und Stelle, und die offene
 * Kommentarspalte verschwaende dabei samt ihrem Zustand.
 */
export function ProjectSidePanels({
  project,
  context,
  defaultPanel = "comments",
  infoAction,
  showEmptyFields = false,
}: {
  project: ProjectDetailResponse
  /** Kommentarzusammenhang (§2.4): bestimmt die anbietbaren Kommentararten. */
  context: "editor" | "review"
  /**
   * Welcher Aufklapper beim Oeffnen der Seite offen ist.
   *
   * <p>Ohne Angabe die Kommentare (KAN-104, Entscheidung); bei PUBLISHED
   * treten an ihre Stelle die Projektinformationen, weil es die
   * Kommentarspalte dort nicht gibt.
   */
  defaultPanel?: Panel
  /** Zusatzhandlung im Kopf der Projektinformationen, etwa „Angaben aendern". */
  infoAction?: ReactNode
  /** Auch leere Felder zeigen; im Editor der Hinweis, was noch fehlt. */
  showEmptyFields?: boolean
}) {
  const [panel, setPanel] = useState<Panel>(defaultPanel)

  const hasComments = project.status !== "PUBLISHED"
  /*
   * Was offen steht. Ohne Kommentarspalte fallen die Kommentare auf die
   * Angaben zurueck; wer sie dort zuklappt, setzt den Zustand auf null und
   * sieht danach genau das. Geht der Status aus PUBLISHED wieder heraus,
   * stehen die Kommentare wieder offen, sofern niemand etwas angefasst hat.
   */
  const open: Panel = panel === "comments" && !hasComments ? "info" : panel

  return (
    <>
      <hr />
      <ProjectInfoSection
        project={project}
        open={open === "info"}
        onOpenChange={(next) => setPanel(next ? "info" : null)}
        action={infoAction}
        showEmptyFields={showEmptyFields}
      />

      {hasComments && (
        <CommentPanel
          project={project}
          context={context}
          open={open === "comments"}
          onOpenChange={(next) => setPanel(next ? "comments" : null)}
        />
      )}
    </>
  )
}
