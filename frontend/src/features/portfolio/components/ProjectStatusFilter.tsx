import { useTranslation } from "react-i18next"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ALL_STATUSES,
  OWN_PROJECT_STATUSES,
  type StatusFilterValue,
} from "@/features/portfolio/ownProjectStatus"

/**
 * Der Statusfilter aus dem Template "My Portfolio": ein Segmentschalter
 * ueber "Alle" und die fuenf Werte aus §2.2.
 *
 * <p>Komponiert die Registry-Primitive toggle-group, statt einen eigenen
 * Schalter zu bauen: Tastaturbedienung, Fokusfuehrung und die
 * Zustandsmeldung ueber aria-pressed bringt Base UI mit, und genau die
 * gehen bei einem nachgebauten Segmentschalter zuverlaessig verloren
 * (Skill frontend-shadcn, Abschnitt 1). Von Hand kommt nur das
 * Domaenenwissen dazu: welche Werte es gibt und wie sie heissen.
 *
 * <p>Die Zustandsfarben stehen mit denselben Modifikatoren wie in der
 * erzeugten Datei (aria-pressed, data-[state=on]), damit tailwind-merge sie
 * gegeneinander aufloest und die aktive Flaeche nicht von der Vorgabe der
 * Registry ueberschrieben wird. Der Komponentencode selbst bleibt
 * unangetastet.
 */
export function ProjectStatusFilter({
  value,
  onValueChange,
  label,
}: {
  value: StatusFilterValue
  onValueChange: (value: StatusFilterValue) => void
  /**
   * Zugaenglicher Name der Gruppe. Sichtbar steht ueber dem Schalter
   * bewusst keine Ueberschrift mehr; ohne diesen Namen waere die Gruppe
   * fuer einen Screenreader eine Reihe unbeschrifteter Knoepfe.
   */
  label: string
}) {
  const { t } = useTranslation()

  const options: { value: StatusFilterValue; label: string }[] = [
    { value: ALL_STATUSES, label: t("common.filter.all") },
    ...OWN_PROJECT_STATUSES.map((status) => ({
      value: status as StatusFilterValue,
      label: t(`project.status.${status}`),
    })),
  ]

  return (
    <ToggleGroup
      aria-label={label}
      spacing={0}
      value={[value]}
      onValueChange={(next) => {
        /*
         * Base UI hebt den Druck auf, wenn das aktive Segment erneut
         * betaetigt wird; die Liste ist dann leer. Ein Filter ohne jeden
         * Wert ist kein Zustand dieser Seite: er faellt auf "Alle" zurueck,
         * statt eine leere Liste zu zeigen.
         */
        onValueChange((next[0] as StatusFilterValue | undefined) ?? ALL_STATUSES)
      }}
      className="max-w-full flex-wrap rounded-control border bg-muted p-1"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="rounded-control px-4 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm data-[state=on]:bg-card"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
