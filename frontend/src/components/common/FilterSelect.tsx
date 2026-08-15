import { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface FilterOption {
  value: string
  label: string
}

/**
 * Auswahlfilter mit verbundenem Label. Die Optionen kommen aus den
 * Stammdaten, der gewaehlte Wert gehoert in die URL; beides liefert der
 * Aufrufer. null steht fuer "kein Filter" und wird als erste Option
 * angezeigt, damit sich ein gesetzter Filter auch wieder aufheben laesst.
 */
export function FilterSelect({
  id,
  label,
  options,
  value,
  onValueChange,
  allLabel,
  className,
}: {
  id?: string
  label: string
  options: FilterOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  allLabel?: string
  className?: string
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const items = useMemo(
    () => [{ label: allLabel ?? t("common.filter.all"), value: null }, ...options],
    [allLabel, options, t]
  )
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={triggerId}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onValueChange(next as string | null)}
      >
        <SelectTrigger id={triggerId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* Der Praefix trennt Aufrufer-Werte vom Sammeleintrag: ohne ihn
              faellt eine Option mit dem Wert "all" (bei einem Statusfilter
              naheliegend) mit ihm zusammen und React reconciled falsch. */}
          {items.map((item) => (
            <SelectItem
              key={item.value === null ? "all" : `value:${item.value}`}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
