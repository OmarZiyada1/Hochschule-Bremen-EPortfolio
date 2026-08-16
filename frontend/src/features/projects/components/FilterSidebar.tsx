import type { UseQueryResult } from "@tanstack/react-query"
import { ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { StudyProgramResponse } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useFilterOptions } from "@/features/projects/hooks/useFilterOptions"
import {
  FILTER_DEGREES,
  FILTER_KEYS,
  FILTER_PROJECT_TYPES,
  toggleValue,
  type ProjectFilterSelection,
} from "@/features/projects/projectFilters"

type FilterGroupKey = (typeof FILTER_KEYS)[number]

/*
 * Aufklappzustand beim ersten Rendern, wie im Template "Projekte
 * (Oeffentlich)": Studiengang und Kategorie starten zugeklappt, die
 * uebrigen offen. Eine Gruppe mit aktiver Auswahl aus der URL startet
 * immer offen, sonst versteckte ein Reload die wirksame Filterung.
 */
const OPEN_BY_TEMPLATE: Record<FilterGroupKey, boolean> = {
  faculty: true,
  studyProgram: false,
  degree: true,
  semester: true,
  type: true,
  category: false,
}

/**
 * Schraenkt die Studiengang-Optionen auf die gewaehlten Fakultaeten ein
 * (Ticket KAN-64); ohne Fakultaetsauswahl gibt es nichts einzuschraenken
 * und alle Studiengaenge bleiben sichtbar (Klaerungsrunde).
 */
function programsOfFaculties(
  programs: readonly StudyProgramResponse[],
  facultyIds: readonly string[]
): StudyProgramResponse[] {
  if (facultyIds.length === 0) {
    return [...programs]
  }
  return programs.filter(
    (program) =>
      program.facultyId !== undefined &&
      facultyIds.includes(program.facultyId)
  )
}

/**
 * Filter-Seitenleiste der Projektbibliothek nach Template "Projekte
 * (Oeffentlich)" (KAN-64, ersetzt den Kommt-bald-Rahmen aus KAN-31):
 * aufklappbare Gruppen mit Checkbox-Mehrfachauswahl. Werte innerhalb einer
 * Gruppe sind ODER-verknuepft, Gruppen untereinander UND-verknuepft
 * (Contract §6.1, v43).
 *
 * Die Auswahl gehoert der Seite: sie liest sie aus der URL und schreibt
 * sie dorthin zurueck; die Seitenleiste meldet jede Aenderung als ganzes
 * Auswahlobjekt. Die Abwahl einer Fakultaet entfernt dabei die gewaehlten
 * Studiengaenge, die dadurch aus der Optionsliste verschwinden: es filtert
 * nie ein Wert, den die Seitenleiste nicht mehr anzeigt (Klaerungsrunde).
 * Die Zusage gilt fuer Aenderungen ueber die Seitenleiste; eine von Hand
 * geschriebene URL wie ?faculty=A&studyProgram=P mit fremdem P filtert
 * weiter (der Server beantwortet sie ohnehin, §6.1), die URL wird beim
 * Laden bewusst nicht umgeschrieben: ein geteilter Link bleibt, was er
 * ist, und die Historie bekommt keinen stillen Ersatz-Eintrag.
 */
export function FilterSidebar({
  selection,
  onSelectionChange,
  className,
}: {
  selection: ProjectFilterSelection
  onSelectionChange: (selection: ProjectFilterSelection) => void
  className?: string
}) {
  const { t } = useTranslation()
  const { faculties, studyPrograms, categories, semesters } = useFilterOptions()

  function isOpenByDefault(group: FilterGroupKey): boolean {
    return OPEN_BY_TEMPLATE[group] || selection[group].length > 0
  }

  function changeFaculty(facultyId: string) {
    const faculty = toggleValue(selection.faculty, facultyId)
    const loadedPrograms = studyPrograms.data
    /* Solange die Studiengaenge noch laden, kann die Kaskade nicht
       rechnen; die Auswahl bleibt dann unveraendert stehen. */
    const studyProgram =
      loadedPrograms === undefined
        ? selection.studyProgram
        : selection.studyProgram.filter((programId) =>
            programsOfFaculties(loadedPrograms, faculty).some(
              (program) => program.id === programId
            )
          )
    onSelectionChange({ ...selection, faculty, studyProgram })
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3">
        <h2 className="type-label-xs tracking-widest text-muted-foreground uppercase">
          {t("project.list.filter.title")}
        </h2>
        <div className="flex flex-col">
          <FilterGroup group="faculty" defaultOpen={isOpenByDefault("faculty")}>
            <OptionsState query={faculties}>
              {(options) =>
                options.map((faculty) => {
                  const id = faculty.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={faculty.name ?? id}
                      checked={selection.faculty.includes(id)}
                      onToggle={() => changeFaculty(id)}
                    />
                  )
                })
              }
            </OptionsState>
          </FilterGroup>

          <FilterGroup
            group="studyProgram"
            defaultOpen={isOpenByDefault("studyProgram")}
          >
            <OptionsState query={studyPrograms}>
              {(options) => {
                const visible = programsOfFaculties(options, selection.faculty)
                if (visible.length === 0) {
                  return <NoOptionsNote />
                }
                return visible.map((program) => {
                  const id = program.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={program.name ?? id}
                      checked={selection.studyProgram.includes(id)}
                      onToggle={() =>
                        onSelectionChange({
                          ...selection,
                          studyProgram: toggleValue(
                            selection.studyProgram,
                            id
                          ),
                        })
                      }
                    />
                  )
                })
              }}
            </OptionsState>
          </FilterGroup>

          <FilterGroup group="degree" defaultOpen={isOpenByDefault("degree")}>
            {FILTER_DEGREES.map((degree) => (
              <FilterOption
                key={degree}
                label={t(`project.degree.${degree}`)}
                checked={selection.degree.includes(degree)}
                onToggle={() =>
                  onSelectionChange({
                    ...selection,
                    degree: toggleValue(selection.degree, degree),
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup
            group="semester"
            defaultOpen={isOpenByDefault("semester")}
          >
            <OptionsState query={semesters}>
              {(options) =>
                options.map((semester) => {
                  const id = semester.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={semester.name ?? id}
                      checked={selection.semester.includes(id)}
                      onToggle={() =>
                        onSelectionChange({
                          ...selection,
                          semester: toggleValue(selection.semester, id),
                        })
                      }
                    />
                  )
                })
              }
            </OptionsState>
          </FilterGroup>

          <FilterGroup group="type" defaultOpen={isOpenByDefault("type")}>
            {FILTER_PROJECT_TYPES.map((type) => (
              <FilterOption
                key={type}
                label={t(`project.type.${type}`)}
                checked={selection.type.includes(type)}
                onToggle={() =>
                  onSelectionChange({
                    ...selection,
                    type: toggleValue(selection.type, type),
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup
            group="category"
            defaultOpen={isOpenByDefault("category")}
          >
            <OptionsState query={categories}>
              {(options) =>
                options.map((category) => {
                  const id = category.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={category.name ?? id}
                      checked={selection.category.includes(id)}
                      onToggle={() =>
                        onSelectionChange({
                          ...selection,
                          category: toggleValue(selection.category, id),
                        })
                      }
                    />
                  )
                })
              }
            </OptionsState>
          </FilterGroup>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Eine aufklappbare Filtergruppe: Trigger mit Gruppenname und Chevron
 * (zugeklappt nach rechts, offen nach unten gedreht, wie im Template),
 * darunter die Optionsliste. Base UI meldet den Zustand ueber
 * data-panel-open am Trigger und aria-expanded fuer Screenreader.
 */
function FilterGroup({
  group,
  defaultOpen,
  children,
}: {
  group: FilterGroupKey
  defaultOpen: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="border-b py-3 last:border-b-0 last:pb-0"
    >
      <CollapsibleTrigger className="group type-label-xs flex w-full items-center justify-between gap-2 rounded-selection tracking-wide uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {t(`project.list.filter.group.${group}`)}
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1 pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Eine Checkbox-Zeile; das umschliessende Label macht die ganze Zeile klickbar. */
function FilterOption({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <Label className="py-1 font-normal">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {label}
    </Label>
  )
}

/**
 * Die drei Zustaende einer Optionsliste aus Stammdaten (Skill
 * frontend-modul, Abschnitt 5): Skeleton in Zeilenform, Fehler aus dem
 * ApiError-Envelope, Leermeldung; sonst rendert der Aufrufer die Optionen.
 */
function OptionsState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T[], Error>
  children: (data: T[]) => ReactNode
}) {
  const { t } = useTranslation()
  if (query.isPending) {
    return (
      <>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-full" />
      </>
    )
  }
  if (query.error !== null) {
    return (
      <p className="type-body-sm text-destructive">
        {isApiError(query.error)
          ? t(apiErrorMessageKey(query.error), {
              defaultValue: query.error.message,
            })
          : t("apiError.INTERNAL_ERROR")}
      </p>
    )
  }
  if (query.data.length === 0) {
    return <NoOptionsNote />
  }
  return <>{children(query.data)}</>
}

function NoOptionsNote() {
  const { t } = useTranslation()
  return (
    <p className="type-body-sm text-muted-foreground">
      {t("project.list.filter.noOptions")}
    </p>
  )
}
