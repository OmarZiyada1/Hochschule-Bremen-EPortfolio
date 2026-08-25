import { useMutation, useQueryClient } from "@tanstack/react-query"

import { adminQueries } from "@/api/queries/admin"
import {
  createCategory,
  createFaculty,
  createModule,
  createSemester,
  createStudyProgram,
  deleteCategory,
  deleteFaculty,
  deleteModule,
  deleteSemester,
  deleteStudyProgram,
  masterDataQueries,
  mergeCategories,
  moveSemester,
  updateCategory,
  updateFaculty,
  updateModule,
  updateSemester,
  updateStudyProgram,
} from "@/api/queries/masterData"
import { projectQueries } from "@/api/queries/projects"
import type {
  CategoryUpdateRequest,
  FacultyCreateRequest,
  FacultyUpdateRequest,
  ModuleCreateRequest,
  ModuleUpdateRequest,
  SemesterMoveDirection,
  SemesterResponse,
  SemesterUpdateRequest,
  StudyProgramCreateRequest,
  StudyProgramUpdateRequest,
} from "@/api/types"

/**
 * Die Mutation-Hooks der Stammdatenpflege (§3.6 bis §3.9, §3.18, §6.1,
 * KAN-39): Kategorien, Fakultaeten, Studiengaenge, Module und Semester.
 * Gelesen wird ueber {@code masterDataQueries}, also ueber dieselben
 * PUBLIC-Listen, die auch Filterleiste und Metadatenformular benutzen.
 *
 * <p><strong>Wer die Liste aendert, macht ihren Cache-Eintrag ungueltig,
 * und zwar in jeder Variante.</strong> Die Fabriken tragen ihre Parameter im
 * Key ({@code ["semesters", { active }]}), und die Seitenleiste liest eine
 * andere Variante als das Formular. Invalidiert wird deshalb ueber den
 * Praefix aus der Fabrik, nicht ueber einen einzelnen Key.
 *
 * <p><strong>Ein Umbenennen trifft mehr als seine eigene Liste.</strong>
 * Projektkacheln fuehren Kategorie, Semester, Fakultaet, Studiengang und
 * Modul als eingebettete Referenz mit Namen (§3.3). Bliebe die
 * Projektliste im Cache, zeigte sie den alten Namen weiter, ohne dass etwas
 * falsch geladen waere. Anlegen betrifft sie nicht: eine neue Zeile haengt
 * an keinem Projekt.
 */

/** Der Listenpraefix einer Ressource, aus ihrer Fabrik statt als Literal. */
const listKeys = {
  categories: () => masterDataQueries.categories().queryKey.slice(0, 1),
  faculties: () => masterDataQueries.faculties().queryKey.slice(0, 1),
  studyPrograms: () => masterDataQueries.studyPrograms().queryKey.slice(0, 1),
  modules: () => masterDataQueries.modules().queryKey.slice(0, 1),
  semesters: () => masterDataQueries.semesters().queryKey.slice(0, 1),
}

/**
 * Baut einen Mutation-Hook mit der Invalidierung, die zu seiner Ressource
 * gehoert. Der Zuschnitt steht damit einmal da und nicht fuenfzehnmal
 * abgeschrieben; was sich je Ressource unterscheidet, sind genau die drei
 * Angaben unten.
 *
 * @param touchesProjects ob die Aenderung an Projekten sichtbar wird, also
 *   bei jedem Umbenennen, Loeschen und Zusammenfuehren
 * @param touchesDashboard ob sie eine Kennzahl der Startansicht verschiebt.
 *   Das trifft die Fakultaeten: {@code projectsByFaculty} fuehrt jede
 *   Fakultaet, auch die ohne Projekte (Contract v76).
 */
function useMasterDataMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    listKey: () => readonly unknown[]
    touchesProjects?: boolean
    touchesDashboard?: boolean
    onSuccess?: (data: TData, variables: TVariables) => void
  }
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: options.listKey() })
      if (options.touchesProjects === true) {
        void queryClient.invalidateQueries({
          queryKey: projectQueries.list({}).queryKey.slice(0, 1),
        })
      }
      if (options.touchesDashboard === true) {
        void queryClient.invalidateQueries({
          queryKey: adminQueries.dashboard().queryKey,
        })
      }
      options.onSuccess?.(data, variables)
    },
  })
}

/* ------------------------------------------------------------------ */
/* Kategorien (§3.6)                                                   */
/* ------------------------------------------------------------------ */

export function useCreateCategory() {
  return useMasterDataMutation((name: string) => createCategory({ name }), {
    listKey: listKeys.categories,
  })
}

export function useUpdateCategory() {
  return useMasterDataMutation(
    (variables: { categoryId: string; request: CategoryUpdateRequest }) =>
      updateCategory(variables.categoryId, variables.request),
    { listKey: listKeys.categories, touchesProjects: true }
  )
}

export function useDeleteCategory() {
  return useMasterDataMutation(
    (categoryId: string) => deleteCategory(categoryId),
    { listKey: listKeys.categories, touchesProjects: true }
  )
}

/**
 * Zwei Kategorien zusammenfuehren (§6.1, KAN-46).
 *
 * <p>Danach gibt es die Quelle nicht mehr, und die betroffenen Projekte
 * tragen eine neue Kategorie und eine neue version (§6.4). Beide Listen
 * werden deshalb neu geladen; die Auswahl im Dialog setzt die aufrufende
 * Seite zurueck, denn sie zeigt sonst auf eine geloeschte Zeile.
 */
export function useMergeCategories() {
  return useMasterDataMutation(
    (variables: { sourceCategoryId: string; targetCategoryId: string }) =>
      mergeCategories(variables.sourceCategoryId, variables.targetCategoryId),
    { listKey: listKeys.categories, touchesProjects: true }
  )
}

/* ------------------------------------------------------------------ */
/* Fakultaeten (§3.8)                                                  */
/* ------------------------------------------------------------------ */

export function useCreateFaculty() {
  return useMasterDataMutation(
    (request: FacultyCreateRequest) => createFaculty(request),
    { listKey: listKeys.faculties, touchesDashboard: true }
  )
}

export function useUpdateFaculty() {
  return useMasterDataMutation(
    (variables: { facultyId: string; request: FacultyUpdateRequest }) =>
      updateFaculty(variables.facultyId, variables.request),
    {
      listKey: listKeys.faculties,
      touchesProjects: true,
      touchesDashboard: true,
    }
  )
}

export function useDeleteFaculty() {
  return useMasterDataMutation(
    (facultyId: string) => deleteFaculty(facultyId),
    {
      listKey: listKeys.faculties,
      touchesProjects: true,
      touchesDashboard: true,
    }
  )
}

/* ------------------------------------------------------------------ */
/* Studiengaenge (§3.7)                                                */
/* ------------------------------------------------------------------ */

export function useCreateStudyProgram() {
  return useMasterDataMutation(
    (request: StudyProgramCreateRequest) => createStudyProgram(request),
    { listKey: listKeys.studyPrograms }
  )
}

export function useUpdateStudyProgram() {
  return useMasterDataMutation(
    (variables: {
      studyProgramId: string
      request: StudyProgramUpdateRequest
    }) => updateStudyProgram(variables.studyProgramId, variables.request),
    { listKey: listKeys.studyPrograms, touchesProjects: true }
  )
}

export function useDeleteStudyProgram() {
  return useMasterDataMutation(
    (studyProgramId: string) => deleteStudyProgram(studyProgramId),
    { listKey: listKeys.studyPrograms, touchesProjects: true }
  )
}

/* ------------------------------------------------------------------ */
/* Module (§3.9)                                                       */
/* ------------------------------------------------------------------ */

export function useCreateModule() {
  return useMasterDataMutation(
    (request: ModuleCreateRequest) => createModule(request),
    { listKey: listKeys.modules }
  )
}

export function useUpdateModule() {
  return useMasterDataMutation(
    (variables: { moduleId: string; request: ModuleUpdateRequest }) =>
      updateModule(variables.moduleId, variables.request),
    { listKey: listKeys.modules, touchesProjects: true }
  )
}

export function useDeleteModule() {
  return useMasterDataMutation((moduleId: string) => deleteModule(moduleId), {
    listKey: listKeys.modules,
    touchesProjects: true,
  })
}

/* ------------------------------------------------------------------ */
/* Semester (§3.18)                                                    */
/* ------------------------------------------------------------------ */

export function useCreateSemester() {
  return useMasterDataMutation((name: string) => createSemester({ name }), {
    listKey: listKeys.semesters,
  })
}

/**
 * Umbenennen und Umschalten laufen ueber denselben Endpoint (§6.1): beides
 * ist ein gewoehnliches Attribut der Zeile und kein Zustandsuebergang.
 *
 * <p>Auch das blosse Umschalten von {@code active} beruehrt die Projekte:
 * ein deaktiviertes Semester bleibt an ihnen stehen, aber die Auswahl im
 * Metadatenformular liest dieselbe Liste in ihrer aktiven Variante.
 */
export function useUpdateSemester() {
  return useMasterDataMutation(
    (variables: { semesterId: string; request: SemesterUpdateRequest }) =>
      updateSemester(variables.semesterId, variables.request),
    { listKey: listKeys.semesters, touchesProjects: true }
  )
}

export function useDeleteSemester() {
  return useMasterDataMutation(
    (semesterId: string) => deleteSemester(semesterId),
    { listKey: listKeys.semesters, touchesProjects: true }
  )
}

/**
 * Ein Semester in der Reihenfolge verschieben (§3.18, §6.1).
 *
 * <p><strong>Die neue Reihenfolge kommt aus der Antwort, nicht aus einer
 * Vorwegnahme im Client.</strong> Der Server schickt die vollstaendige
 * Liste zurueck; sie wird als Wert des Cache-Eintrags gesetzt, damit die
 * Tabelle ohne zweiten Rundlauf umspringt. Danach wird trotzdem
 * invalidiert, weil die uebrigen Varianten des Keys (die aktiven Semester
 * fuer das Metadatenformular) dieselbe Ordnung tragen.
 */
export function useMoveSemester() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: {
      semesterId: string
      direction: SemesterMoveDirection
    }) => moveSemester(variables.semesterId, variables.direction),
    onSuccess: (order: SemesterResponse[]) => {
      queryClient.setQueryData(masterDataQueries.semesters().queryKey, order)
      void queryClient.invalidateQueries({ queryKey: listKeys.semesters() })
    },
  })
}
