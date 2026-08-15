import { SearchIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Suchfeld mit Lupe im Feld (Figma "Search Input") und verbundenem Label
 * (SC 1.3.1, 3.3.2).
 *
 * Die Komponente haelt keinen eigenen Zustand: der Suchbegriff gehoert in
 * die URL, deshalb kommen Wert und Aenderung vom Aufrufer.
 *
 * Das Label bleibt immer im Markup und wird hoechstens optisch versteckt.
 * Figma zeigt das Feld nur mit Platzhalter, und ein Platzhalter ist kein
 * Label: er verschwindet beim Tippen, und wer die Seite vorgelesen bekommt,
 * erfaehrt sonst nie, was das Feld durchsucht. labelHidden ist deshalb eine
 * Frage der Darstellung und nie eine, ob es das Label gibt.
 *
 * Die Lupe ist Zierat neben dem Label und traegt keinen eigenen Namen.
 */
export function SearchInput({
  id,
  label,
  labelHidden = false,
  value,
  onValueChange,
  placeholder,
  className,
}: {
  id?: string
  label?: string
  labelHidden?: boolean
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
      <Label htmlFor={inputId} className={cn(labelHidden && "sr-only")}>
        {label ?? t("common.search.label")}
      </Label>
      <InputGroup className="h-11 rounded-control">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
        />
      </InputGroup>
    </div>
  )
}
