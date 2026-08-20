import type { ReactNode } from "react"
import { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
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
 * Auswahlfeld mit verbundenem Label. Die Optionen kommen aus den
 * Stammdaten, den gewaehlten Wert haelt der Aufrufer; beides liefert er.
 * null steht fuer "nichts gewaehlt" und wird als erste Option angezeigt,
 * damit sich eine getroffene Wahl auch wieder aufheben laesst.
 *
 * <p>Der Name stammt aus der Filter-Seitenleiste, fuer die die Komponente
 * entstanden ist, und ist zugleich der Name der Figma-Komponente. Seit
 * KAN-35 traegt sie auch die Klassifikationsfelder des Metadatenformulars,
 * die im Template dieselbe Komponente benennen. Dafuer sind
 * {@code description}, {@code error}, {@code labelSuffix} und
 * {@code disabled} dazugekommen, alle optional: ohne sie rendert die
 * Komponente wie zuvor. Erweitert statt daneben gebaut, weil eine zweite
 * Auswahlhuelle genau die Art Dopplung waere, die der Befund aus KAN-7
 * meint.
 *
 * <p>Gerahmt wird seitdem mit {@code Field} statt einem eigenen div: die
 * Primitive bringt die Gruppenrolle, die Abstufung bei
 * {@code data-invalid} und die Anbindung von Beschreibung und Fehlertext
 * mit, die sonst je Verwendungsstelle nachgebaut wuerden.
 */
export function FilterSelect({
  id,
  label,
  options,
  value,
  onValueChange,
  allLabel,
  className,
  labelSuffix,
  description,
  error,
  disabled = false,
}: {
  id?: string
  label: string
  options: FilterOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  allLabel?: string
  className?: string
  /**
   * Zusatz hinter der Beschriftung, etwa die Kennzeichnung "erforderlich
   * zum Einreichen". Bewusst ein Knoten und kein Wahrheitswert: was ein
   * Stern bedeutet, weiss nur der Aufrufer, und die Erklaerung dazu gehoert
   * in seine Legende.
   */
  labelSuffix?: ReactNode
  /** Hilfetext unter dem Feld, ueber aria-describedby angebunden. */
  description?: ReactNode
  /**
   * Fehlertext unter dem Feld. Gesetzt heisst zugleich aria-invalid am
   * Ausloeser; der Text wird als role="alert" angesagt (FieldError).
   */
  error?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const descriptionId = `${triggerId}-description`
  const errorId = `${triggerId}-error`
  const invalid = error !== undefined

  const items = useMemo(
    () => [
      { label: allLabel ?? t("common.filter.all"), value: null },
      ...options,
    ],
    [allLabel, options, t]
  )

  /* Nur anbinden, was auch dasteht: ein aria-describedby auf ein Element,
     das nicht gerendert wird, verweist ins Leere. */
  const describedBy =
    [description !== undefined ? descriptionId : null, invalid ? errorId : null]
      .filter((entry) => entry !== null)
      .join(" ") || undefined

  return (
    <Field data-invalid={invalid} className={cn("gap-2", className)}>
      <FieldLabel htmlFor={triggerId}>
        {label}
        {labelSuffix}
      </FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onValueChange(next as string | null)}
        disabled={disabled}
      >
        <SelectTrigger
          id={triggerId}
          className="w-full"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
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
      {description !== undefined && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {invalid && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  )
}
