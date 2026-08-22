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
  type TableSize,
} from "@/features/project-content/blockInsert"
import { TableSizeForm } from "@/features/project-content/components/TableSizeForm"

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
 * <p><strong>Ein Typ fragt vorher nach: die Tabelle.</strong> Sie ist der
 * einzige der zehn, dessen Gestalt beim Anlegen feststeht; alle anderen
 * entstehen leer und werden im Text gefuellt. Zuvor entstand jede Tabelle
 * als drei mal drei, und wer fuenf Spalten brauchte, fuegte sie danach
 * einzeln an. Die Leiste tauscht deshalb ihren Inhalt gegen
 * {@link TableSizeForm}, statt ein zweites Popover darueber zu oeffnen:
 * zwei ineinander liegende Flaechen haetten zwei Escape-Ebenen und zwei
 * Fokusfallen.
 *
 * <p>Der Fokus springt beim Oeffnen auf die erste Schaltflaeche; das
 * Schliessen und die Rueckgabe des Fokus besorgt das Popover.
 */
export function BlockInsertBar({
  mode,
  onModeChange,
  onSelect,
  onClose,
}: {
  /** Was die Leiste zeigt: die zehn Typen oder die Tabellengroesse. */
  mode: "types" | "table"
  onModeChange: (mode: "types" | "table") => void
  onSelect: (kind: InsertKind, table?: TableSize) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (mode === "types") {
      firstRef.current?.focus()
    }
  }, [mode])

  if (mode === "table") {
    return (
      <TableSizeForm
        onInsert={(size) => {
          onSelect("table", size)
          onModeChange("types")
        }}
        onCancel={() => onModeChange("types")}
      />
    )
  }

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
                  onClick={() =>
                    kind === "table" ? onModeChange("table") : onSelect(kind)
                  }
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
