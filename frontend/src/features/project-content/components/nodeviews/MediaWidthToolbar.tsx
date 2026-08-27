import { useTranslation } from "react-i18next"

import { Toggle } from "@/components/ui/toggle"
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorContext } from "@/features/project-content/EditorContext"
import type { ImageWidth } from "@/features/project-content/blockTypes"

/** Die drei Stufen aus Contract 2.5, aufsteigend wie in der Leiste am Medium. */
const WIDTHS: readonly ImageWidth[] = [50, 75, 100]

/**
 * Die Breitenleiste ueber einem Medienblock (Contract 2.5).
 *
 * <p><strong>Eine Leiste fuer Bild und Video</strong> (KAN-83). Sie stand bis
 * dahin nur am Bild und inline in dessen NodeView; seit Contract v84 fuehrt
 * auch das Video dieselben drei Stufen, und sie ein zweites Mal zu schreiben
 * hiesse, zwei Fassungen derselben Zusagen zu pflegen.
 *
 * <p>Erst beim Zeigen oder mit dem Fokus sichtbar, damit sie das Medium nicht
 * dauerhaft verdeckt. {@code focus-within} macht sie fuer die Tastatur
 * sichtbar, bevor der erste Eintrag den Fokus traegt (Base UI setzt den
 * Tabstopp auf die Leiste).
 *
 * <p><strong>Kein Zeigerweg allein</strong> (SC 2.1.1): die Leiste ist eine
 * {@code toolbar} mit einem Tabstopp, mit dem Fokus wird sie sichtbar, und die
 * gewaehlte Stufe traegt {@code aria-pressed}. Beschriftet ist jede Stufe mit
 * ihrem vollen Namen; die sichtbare Zahl allein ist als Name zu wenig. Symbole
 * dafuer gibt es nicht: lucide fuehrt keine Dreierreihe fuer Breitenstufen.
 *
 * <p>Die Aenderung ist rein visuell, deshalb sagt sie die Live-Region der
 * Seite an und nicht die Leiste selbst.
 */
export function MediaWidthToolbar({
  value,
  onChange,
  kind,
}: {
  value: ImageWidth
  onChange: (width: ImageWidth) => void
  /**
   * Um welches Medium es geht. Der Namensraum entscheidet ueber jede
   * Beschriftung dieser Leiste, nicht nur ueber ihren eigenen Namen: sonst
   * hoerte ein Screenreader am Video eine Leiste „Breite des Videos" mit
   * Schaltflaechen „Bildbreite 75 Prozent" und danach die Ansage
   * „Bildbreite auf 75 Prozent gesetzt" (SC 4.1.2, SC 2.4.6; Befund des
   * frontend-reviewers).
   */
  kind: "image" | "video"
}) {
  const { t } = useTranslation()
  const { announce } = useEditorContext()
  const label = t(`projectContent.${kind}.widthToolbar`)

  return (
    <Toolbar
      aria-label={label}
      className="absolute inset-e-2 top-2 rounded-control border border-border bg-popover p-0.5 opacity-0 shadow-md transition-opacity group-hover/media:opacity-100 focus-within:opacity-100 motion-reduce:transition-none"
    >
      {WIDTHS.map((width) => (
        <Tooltip key={width}>
          <TooltipTrigger
            render={
              <ToolbarButton
                render={
                  <Toggle
                    size="sm"
                    pressed={value === width}
                    onPressedChange={() => {
                      if (value === width) {
                        return
                      }
                      onChange(width)
                      announce(
                        t(`projectContent.${kind}.widthChanged`, { width })
                      )
                    }}
                    className="h-7 min-w-0 px-2"
                  />
                }
              />
            }
          >
            <span aria-hidden="true" className="type-caption">
              {t(`projectContent.${kind}.widthValue`, { width })}
            </span>
            <span className="sr-only">
              {t(`projectContent.${kind}.widthOption`, { width })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t(`projectContent.${kind}.widthOption`, { width })}
          </TooltipContent>
        </Tooltip>
      ))}
    </Toolbar>
  )
}
