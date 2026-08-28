import type { ReactNodeViewProps } from "@tiptap/react"
import { ListIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useEditorContext } from "@/features/project-content/EditorContext"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import type { TocEntry } from "@/features/project-content/blockTypes"
import { tocDotClass } from "@/features/project-content/renderer/tocDot"
import {
  collectHeadings,
  sameEntries,
} from "@/features/project-content/tableOfContents"

/**
 * Das Inhaltsverzeichnis auf der Schreibflaeche (Contract 2.5, seit v84).
 *
 * <p>Es zeigt, was danach im Beitrag steht: dieselben Eintraege in derselben
 * Reihenfolge. Aufgeklappt ist es hier immer, denn im Editor ist es das, was
 * bearbeitet wird, und nicht eine Lesehilfe.
 *
 * <p><strong>Der Hinweis „nicht mehr aktuell" steht nur hier.</strong> Die
 * gespeicherte Momentaufnahme darf von den Ueberschriften abweichen, das ist
 * die Festlegung aus 2.5; wer schreibt, soll es aber sehen und mit einem
 * Griff nachziehen koennen. Die Leseansicht sagt dazu nichts: sie kann nichts
 * daran aendern, und ein Warnhinweis am fertigen Beitrag verunsichert nur.
 *
 * <p>Die Schaltflaeche daneben tut dasselbe wie die Aktion in der Toolbar und
 * ruft dieselbe Funktion; sie steht hier, weil der Weg von einem veralteten
 * Verzeichnis zur Aktualisierung sonst durch die halbe Oberflaeche fuehrte.
 *
 * <p><strong>Punkte und Trennlinie stehen hier wie im Lesepfad</strong>, aus
 * denselben Klassen ({@code tocDot.ts}). Was der Editor zeigt, soll aussehen
 * wie das, was danach im Beitrag steht; zwei verschiedene Verzeichnisse waeren
 * eine Ueberraschung beim ersten Blick auf die fertige Seite. Die Eintraege
 * sind hier trotzdem kein Verweis: auf der Schreibflaeche gibt es kein Ziel,
 * zu dem ein Sprung fuehren koennte.
 */
export function TableOfContentsNodeView({
  node,
  updateAttributes,
  editor,
}: ReactNodeViewProps) {
  const { t } = useTranslation()
  const { editable, announce } = useEditorContext()
  const entries = (node.attrs as { entries: TocEntry[] }).entries
  const current = collectHeadings(editor)
  const stale = !sameEntries(entries, current)

  return (
    <MediaShell
      incompleteHint={
        entries.length === 0 ? t("projectContent.toc.incomplete") : null
      }
    >
      <div
        data-block="toc"
        className="rounded-card border border-border px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="type-label-xs flex items-center gap-2 font-semibold tracking-wide uppercase">
            <ListIcon aria-hidden="true" className="size-3.5 text-primary" />
            {t("projectContent.toc.title")}
          </p>
          {editable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                updateAttributes({ entries: collectHeadings(editor) })
                announce(t("projectContent.toc.refreshed"))
              }}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("projectContent.toc.refresh")}
            </Button>
          )}
        </div>

        {editable && stale && (
          <p className="type-caption mt-2 flex items-center gap-1.5 text-muted-foreground">
            <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
            {t("projectContent.toc.stale")}
          </p>
        )}

        {entries.length > 0 && (
          <ol className="mt-3 flex list-none flex-col gap-1.5 border-t p-0 pt-3">
            {entries.map((entry) => (
              <li
                key={`${entry.index}-${entry.level}`}
                data-toc-level={entry.level}
                className="type-body-sm flex items-baseline gap-2 text-muted-foreground"
              >
                <span aria-hidden="true" className={tocDotClass(entry.level)} />
                {entry.text}
              </li>
            ))}
          </ol>
        )}
      </div>
    </MediaShell>
  )
}
