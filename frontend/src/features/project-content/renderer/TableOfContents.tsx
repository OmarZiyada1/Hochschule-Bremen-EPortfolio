import { useId, useState } from "react"

import type { TocEntry } from "@/features/project-content/blockTypes"
import {
  headingAnchorId,
  type RenderContext,
} from "@/features/project-content/renderer/renderBlockNode"

/**
 * Das Inhaltsverzeichnis im Lesepfad (§2.5, seit Contract v84, KAN-83).
 *
 * <p><strong>Offen als Vorgabe, zuklappbar am Bildschirm.</strong> Ein
 * Verzeichnis, das sich selbst verbirgt, hilft niemandem: es steht offen da
 * und laesst sich zuklappen, wer den Beitrag am Stueck liest. Im Ausdruck ist
 * es immer aufgeschlagen und nicht bedienbar, weil ein Blatt nichts
 * aufklappen kann.
 *
 * <p>Den Druckfall entscheidet die Eigenschaft {@code forPrint} aus dem
 * Renderkontext und keine CSS-Regel: ein zugeklapptes {@code details}
 * verbirgt seinen Inhalt ueber den eigenen Mechanismus des Browsers, und der
 * laesst sich mit {@code display} nicht wieder aufmachen. Ohne die Bindung an
 * {@code forPrint} bliebe das Verzeichnis auf dem Papier zugeklappt, sobald
 * jemand es am Bildschirm zugeklappt und dann gedruckt hat.
 *
 * <p><strong>{@code details} und {@code summary} statt der Primitive
 * {@code Collapsible}</strong>, die es im Projekt gibt und die
 * {@code CommentPanel} und {@code ProjectInfoSection} benutzen. Der Grund
 * ist nicht der Zustand, den fuehrt diese Datei ohnehin: es sind die beiden
 * Faehigkeiten, die nur das native Element mitbringt. Die Suche des Browsers
 * oeffnet ein zugeklapptes {@code details}, um einen Treffer darin zu zeigen
 * (die Verzeichniseintraege bleiben also auffindbar), und der Ausdruck
 * erreicht es ohne React, was fuer den Druckbereich aus KAN-41 zaehlt. Eine
 * nachgebaute Aufklapplogik haette beides nicht.
 *
 * <p><strong>Die Eintraege stehen im Dokument.</strong> Sie werden hier nicht
 * aus den Ueberschriften errechnet, sondern kommen als Momentaufnahme aus dem
 * Block (§2.5). Ist sie veraltet, zeigt der Editor es an; die Leseansicht
 * sagt dazu nichts, weil sie nichts daran aendern kann und ein Warnhinweis am
 * fertigen Beitrag nur verunsichert.
 *
 * <p>Die Einrueckung folgt der Ebene und ist reine Darstellung; die Liste ist
 * flach, damit eine uebersprungene Ebene keine leeren Zwischenebenen erzeugt
 * (§2.5 laesst Spruenge zu).
 */
export function TableOfContents({
  entries,
  context,
}: {
  entries: readonly TocEntry[]
  context: RenderContext
}) {
  const labelId = useId()
  /* Nur der aufgeklappte Zustand dieser Ansicht, kein gespeicherter Wert:
     ein Verzeichnis ist eine Lesehilfe und keine Einstellung. Deshalb
     beginnt jede Ansicht offen, und ein Zuklappen gilt nur fuer sie. */
  const [open, setOpen] = useState(true)

  if (entries.length === 0) {
    return (
      <p data-block="toc-empty" className="type-body-sm text-muted-foreground">
        {context.t("projectContent.toc.empty")}
      </p>
    )
  }

  return (
    <details
      data-block="toc"
      open={context.forPrint === true || open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-card border border-border px-4 py-3"
    >
      <summary
        id={labelId}
        className="type-label-xs cursor-pointer font-semibold tracking-wide uppercase"
      >
        {context.t("projectContent.toc.title")}
      </summary>
      <nav aria-labelledby={labelId} className="mt-2">
        <ol className="flex list-none flex-col gap-1 p-0">
          {entries.map((entry) => (
            <li
              key={`${entry.index}-${entry.level}`}
              data-toc-level={entry.level}
              className="type-body-sm"
            >
              <a
                href={`#${headingAnchorId(context.idPrefix, entry.index)}`}
                className="text-primary hover:underline focus-visible:underline"
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  )
}
