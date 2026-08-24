import { useTranslation } from "react-i18next"

import type { ProjectStatus } from "@/api/types"
import {
  SegmentedFilter,
  type SegmentedOption,
} from "@/components/common/SegmentedFilter"
import {
  ALL_STATUSES,
  OWN_PROJECT_STATUSES,
  type StatusFilterValue,
} from "@/features/portfolio/ownProjectStatus"

/**
 * Der Statusfilter als Segmentschalter ueber "Alle" und die Werte aus §2.2.
 *
 * <p><strong>Zwei Seiten, ein Baustein.</strong> Er stand bis KAN-37 unter
 * features/portfolio und zeigte dort die fuenf Werte des Templates
 * "My Portfolio". "Meine Reviews" zeigt dieselbe Leiste ohne DRAFT: ein
 * Entwurf erscheint in editor=me gar nicht erst, weil die Redaktion nicht
 * veroeffentlichte Projekte erst ab SUBMITTED liest (§5 Fussnote 11). Statt
 * einer zweiten Leiste daneben nimmt diese die Werte jetzt entgegen; sie
 * liegt deshalb in der Bibliothek und nicht mehr im Feature (Skill
 * frontend-modul, Abschnitt 0.5).
 *
 * <p><strong>Die Gestalt liegt seit der Nacharbeit an KAN-37 im
 * {@link SegmentedFilter}</strong>, weil der Nominierungsbereich dieselbe
 * Leiste ueber {@code NominationStatus} zeigt. Diese Komponente traegt nur
 * noch das Domaenenwissen: welche Status es gibt, wie sie heissen und dass
 * "Alle" davorsteht.
 */
export function ProjectStatusFilter({
  value,
  onValueChange,
  label,
  statuses = OWN_PROJECT_STATUSES,
}: {
  value: StatusFilterValue
  onValueChange: (value: StatusFilterValue) => void
  /** Zugaenglicher Name der Gruppe, siehe {@link SegmentedFilter}. */
  label: string
  /**
   * Die anzubietenden Status, in Anzeigereihenfolge. "Alle" kommt immer
   * davor und ist kein Contract-Wert.
   */
  statuses?: readonly ProjectStatus[]
}) {
  const { t } = useTranslation()

  const options: SegmentedOption<StatusFilterValue>[] = [
    { value: ALL_STATUSES, label: t("common.filter.all") },
    ...statuses.map((status) => ({
      value: status as StatusFilterValue,
      label: t(`project.status.${status}`),
    })),
  ]

  return (
    <SegmentedFilter
      label={label}
      options={options}
      value={value}
      onValueChange={onValueChange}
      fallback={ALL_STATUSES}
    />
  )
}
