import { useTranslation } from "react-i18next"

import { Card, CardContent } from "@/components/ui/card"

/*
 * Reihenfolge und Zuschnitt der Gruppen wie im Template "Projekte
 * (Oeffentlich)"; die Schluessel entsprechen den Filterparametern aus
 * Contract §6.1.
 */
const FILTER_GROUPS = [
  "faculty",
  "studyProgram",
  "degree",
  "semester",
  "type",
  "category",
] as const

/**
 * Rahmen der Filter-Seitenleiste nach Template "Projekte (Oeffentlich)",
 * getragen von der Card-Primitive.
 *
 * Die Gruppen erscheinen als Kommt-bald-Hinweis ohne Bedienelemente: die
 * Mehrfachauswahl braucht mehrwertige Filterparameter und entsteht mit
 * KAN-64 (Contract §6.1 seit v43). Entschieden in der Klaerungsrunde zu
 * KAN-31. Die Wertequelle der Semester-Gruppe ist seit Contract v45 nicht
 * mehr offen: sie kommt aus GET /api/semesters (§3.18, KAN-65).
 * Bewusst keine Checkboxen und keine Aufklapp-Pfeile: ein Bedienelement,
 * das nichts tut, verbietet die DoD des Tickets.
 */
export function FilterSidebar({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3">
        <h2 className="type-label-xs tracking-widest text-muted-foreground uppercase">
          {t("project.list.filter.title")}
        </h2>
        <p className="type-body-sm text-muted-foreground">
          {t("project.list.filter.comingSoon", { ticket: "KAN-64" })}
        </p>
        <ul className="flex flex-col">
          {FILTER_GROUPS.map((group) => (
            <li
              key={group}
              className="type-label-xs border-b py-3 tracking-wide text-muted-foreground uppercase last:border-b-0 last:pb-0"
            >
              {t(`project.list.filter.group.${group}`)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
