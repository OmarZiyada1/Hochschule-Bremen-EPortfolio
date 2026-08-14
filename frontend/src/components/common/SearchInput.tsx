import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Suchfeld mit verbundenem Label (SC 1.3.1, 3.3.2). Die Komponente haelt
 * keinen eigenen Zustand: der Suchbegriff gehoert in die URL, deshalb
 * kommen Wert und Aenderung vom Aufrufer. Ein Platzhalter ist kein Label,
 * er verschwindet beim Tippen.
 */
export function SearchInput({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  className,
}: {
  id?: string
  label?: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={inputId}>{label ?? t("common.search.label")}</Label>
      <Input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
