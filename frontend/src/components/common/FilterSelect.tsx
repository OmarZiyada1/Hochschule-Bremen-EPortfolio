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
 * <p>Seit KAN-85 traegt sie zusaetzlich das Pflicht-Auswahlfeld des
 * Kontaktformulars. Dafuer ist {@code includeAllOption} dazugekommen: ein
 * Feld, das einen Wert haben <em>muss</em> (die Kategorie nach Contract
 * §3.20), darf keinen Sammeleintrag anbieten, denn „alle" ist dort kein
 * Zustand und ein null-Wert liefe in ein 400. Erweitert statt daneben gebaut,
 * aus demselben Grund wie oben.
 *
 * <p>Gerahmt wird seitdem mit {@code Field} statt einem eigenen div: die
 * Primitive bringt die Gruppenrolle, die Abstufung bei
 * {@code data-invalid} und die Anbindung von Beschreibung und Fehlertext
 * mit, die sonst je Verwendungsstelle nachgebaut wuerden.
 */
export function FilterSelect({
  id,
  label,
  labelHidden = false,
  options,
  value,
  onValueChange,
  allLabel,
  includeAllOption = true,
  className,
  labelSuffix,
  description,
  error,
  disabled = false,
}: {
  id?: string
  label: string
  /**
   * Beschriftung nur fuer Hilfsmittel, wie bei {@code SearchInput}. Eine
   * Filterzeile aus mehreren Auswahlfeldern kommt ohne sichtbare
   * Beschriftungen aus, sobald jeder Sammeleintrag das Feld benennt
   * („Studiengang (alle)"): der Text darueber sagte dann dasselbe ein
   * zweites Mal und schoebe die Felder gegeneinander, weil ein Suchfeld
   * daneben keine Beschriftung braucht. Entfernt wird sie nie, sie wandert
   * nur in {@code sr-only}: ohne sie waere das Feld fuer einen Screenreader
   * unbeschriftet (SC 1.3.1, SC 3.3.2).
   */
  labelHidden?: boolean
  options: FilterOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  allLabel?: string
  /**
   * Steht der Sammeleintrag „alle" zur Wahl? Standard ja, denn dafuer ist
   * die Komponente entstanden: ein Filter, dessen Wahl sich nicht mehr
   * aufheben liesse, waere eine Sackgasse.
   *
   * <p>{@code false} setzt ein Feld, das einen Wert haben muss. Der
   * Aufrufer bekommt dann nie {@code null} und muss den Anfangswert selbst
   * setzen; ohne diesen Schalter stuende in einem Pflichtfeld ein
   * auswaehlbares „alle", das der Server mit 400 beantwortet.
   */
  includeAllOption?: boolean
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
    () =>
      includeAllOption
        ? [{ label: allLabel ?? t("common.filter.all"), value: null }, ...options]
        : options,
    [allLabel, includeAllOption, options, t]
  )

  /* Nur anbinden, was auch dasteht: ein aria-describedby auf ein Element,
     das nicht gerendert wird, verweist ins Leere. */
  const describedBy =
    [description !== undefined ? descriptionId : null, invalid ? errorId : null]
      .filter((entry) => entry !== null)
      .join(" ") || undefined

  return (
    <Field data-invalid={invalid} className={cn("gap-2", className)}>
      {/* Der Hausstil fuer Feldbeschriftungen, wie in den Auth-Seiten und
          im Profilformular: klein, gedaempft, in Versalien. So tragen alle
          Beschriftungen einer Seite dieselbe Farbe und dasselbe Gewicht. */}
      <FieldLabel
        htmlFor={triggerId}
        className={cn(
          "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive",
          labelHidden && "sr-only"
        )}
      >
        {label}
        {labelSuffix}
      </FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onValueChange(next as string | null)}
        disabled={disabled}
      >
        {/* Die Hoehe steht mit demselben Modifikator da, den die
            erzeugte Datei benutzt. Ein blankes h-11 taeuscht hier:
            select.tsx fuehrt seine Hoehe ausschliesslich als
            data-[size=default]:h-8, und data-size steht immer am
            Element. Fuer tailwind-merge sind das zwei Schluessel,
            beide Klassen ueberleben, und dann gewinnt der
            Attributselektor mit (0,2,0) gegen (0,1,0): das Feld
            blieb 32px hoch, waehrend SearchInput auf 44px stand.
            Bei InputGroup faellt das nicht auf, weil dort ein
            schlichtes h-8 steht, das dieselbe Gruppe trifft.
            Dasselbe Muster wie in UserAvatar (Befund aus KAN-34). */}
        <SelectTrigger
          id={triggerId}
          className="w-full data-[size=default]:h-11"
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
