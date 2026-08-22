import { XIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  INSERT_ENTRIES,
  type InsertKind,
} from "@/features/project-content/blockInsert"

/**
 * Die Einfuegeleiste am Plus der Blockbedienung (Figma
 * {@code Template / Studierende · Editor}).
 *
 * <p><strong>Eine Pille mit runden Symbolschaltflaechen</strong>, wie im
 * Template gezeichnet, und kein Auswahlmenue: die zehn Typen stehen
 * nebeneinander und sind mit einem Klick erreichbar. Die Symbole sind
 * dieselben, die danach im Beitrag stehen.
 *
 * <p><strong>Sie liegt in einem Popover und nicht mehr im Fluss der
 * Blockbedienung.</strong> Zuvor wurde sie in dieselbe absolut gesetzte
 * Huelle gerendert, die mit {@code -translate-x-full} um ihre eigene Breite
 * nach links geschoben wird. Fuer drei kleine Schaltflaechen ging das auf,
 * fuer eine Pille von rund vierhundert Pixeln nicht: sie landete links
 * ausserhalb des Sichtbereichs und war nicht mehr erreichbar. Das Popover
 * kennt die Raender des Fensters und weicht ihnen aus.
 *
 * <p><strong>Derselbe Inhalt wie der Slash-Befehl.</strong> Beide Wege
 * lesen {@code INSERT_ENTRIES} und legen ueber {@code contentFor} denselben
 * Knoten an. Die Medienknoten entstehen als leerer Platzhalter im Text und
 * werden dort gefuellt.
 *
 * <p>Der Fokus springt beim Oeffnen auf die erste Schaltflaeche; das
 * Schliessen und die Rueckgabe des Fokus besorgt das Popover.
 */
export function BlockInsertBar({
  onSelect,
  onClose,
}: {
  onSelect: (kind: InsertKind) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  return (
    <div
      role="group"
      aria-label={t("projectContent.insert.label")}
      className="flex items-center gap-1.5"
    >
      <button
        type="button"
        ref={firstRef}
        onClick={onClose}
        className="flex size-8 shrink-0 items-center justify-center rounded-pill border-2 border-border text-muted-foreground outline-none hover:border-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <XIcon aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{t("projectContent.insert.close")}</span>
      </button>

      {INSERT_ENTRIES.map(({ kind, icon: Icon }) => {
        const label = t(`projectContent.insert.type.${kind}`)
        return (
          <Tooltip key={kind}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onSelect(kind)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-pill border-2 border-primary text-primary transition-colors outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              }
            >
              <Icon aria-hidden="true" className="size-3.5" />
              <span className="sr-only">{label}</span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export type { InsertKind }
