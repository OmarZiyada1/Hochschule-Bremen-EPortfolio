import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  CategoryCreateRequest,
  CategoryMergeRequest,
  CategoryResponse,
  CategoryUpdateRequest,
  FacultyCreateRequest,
  FacultyResponse,
  FacultyUpdateRequest,
  ModuleCreateRequest,
  ModuleResponse,
  ModuleUpdateRequest,
  SemesterCreateRequest,
  SemesterMoveDirection,
  SemesterMoveRequest,
  SemesterResponse,
  SemesterUpdateRequest,
  StudyProgramCreateRequest,
  StudyProgramResponse,
  StudyProgramUpdateRequest,
} from "@/api/types"

/**
 * queryOptions-Fabriken der Stammdaten (§6.1, Backend-Modul masterdata):
 * PUBLIC, vollstaendige Listen ohne PageResponse, ein Nachladen gibt es
 * nicht. Eine Datei fuer die Ressourcen dieses Moduls, wie das Backend sie
 * buendelt.
 *
 * Erste Verwender: die Kennzahlen der CTA-Sektion der Startseite (KAN-31)
 * fuer faculties und studyPrograms, die Filter-Seitenleiste der
 * Projektbibliothek (KAN-64) fuer categories und semesters, das
 * Metadatenformular (KAN-35) fuer modules und fuer die Parameter unten.
 *
 * <p><strong>Die Parameter sind optional, und das ist der Punkt.</strong>
 * Ohne Angabe verhalten sich die Fabriken wie bisher, es gibt also keine
 * Aenderung an den bestehenden Verwendern. Filtern muss aber genau das
 * Gegenteil von Bearbeiten:
 *
 * <ul>
 * <li>Die Seitenleiste braucht <em>alle</em> Semester, auch deaktivierte.
 * Sonst fielen veroeffentlichte Projekte aus der Suche, sobald ihr Semester
 * vorbei ist (§3.18). Das Metadatenformular braucht umgekehrt nur die
 * aktiven, denn nur die sind waehlbar; ein inaktives ergibt 400
 * VALIDATION_FAILED.</li>
 * <li>Die Seitenleiste zeigt alle Studiengaenge nebeneinander, das
 * Formular nur die der gewaehlten Fakultaet.</li>
 * </ul>
 *
 * <p>Die Parameter stehen im Query-Key, nicht nur im Request. Ohne das
 * teilten sich „alle Semester" und „nur aktive" einen Cache-Eintrag, und
 * welche Liste die Auswahl zeigt, entschiede die Reihenfolge der Aufrufe.
 */
export const masterDataQueries = {
  faculties: () =>
    queryOptions({
      queryKey: ["faculties"] as const,
      queryFn: () => api.get<FacultyResponse[]>(apiPaths.masterData.faculties),
    }),

  /**
   * @param facultyId Nur Studiengaenge dieser Fakultaet (§6.1, Filter
   *   {@code faculty}). Ohne Angabe kommen alle. Eine unbekannte ID ergibt
   *   eine leere Liste, keinen 404.
   */
  studyPrograms: (facultyId?: string) =>
    queryOptions({
      queryKey: ["studyPrograms", { faculty: facultyId ?? null }] as const,
      queryFn: () =>
        api.get<StudyProgramResponse[]>(apiPaths.masterData.studyPrograms, {
          query: { faculty: facultyId },
        }),
    }),
  categories: () =>
    queryOptions({
      queryKey: ["categories"] as const,
      queryFn: () =>
        api.get<CategoryResponse[]>(apiPaths.masterData.categories),
    }),

  /**
   * @param active Nur aktive Semester (§3.18, §6.1). Ohne Angabe kommen
   *   alle, auch die deaktivierten.
   */
  semesters: (active?: boolean) =>
    queryOptions({
      queryKey: ["semesters", { active: active ?? null }] as const,
      queryFn: () =>
        api.get<SemesterResponse[]>(apiPaths.masterData.semesters, {
          query: { active },
        }),
    }),

  /**
   * Module (§3.9, KAN-35).
   *
   * @param studyProgramId Nur Module dieses Studiengangs (§6.1, Filter
   *   {@code studyProgram}). Ohne Angabe kommen alle.
   */
  modules: (studyProgramId?: string) =>
    queryOptions({
      queryKey: ["modules", { studyProgram: studyProgramId ?? null }] as const,
      queryFn: () =>
        api.get<ModuleResponse[]>(apiPaths.masterData.modules, {
          query: { studyProgram: studyProgramId },
        }),
    }),
}

/*
 * Die schreibende Seite der Stammdaten (§6.1, KAN-39).
 *
 * <p><strong>Hier und nicht in admin.ts</strong>, obwohl die Pfade unter
 * /api/admin liegen: der Zuschnitt ist die Ressource, nicht die Rolle. Was
 * hier geaendert wird, ist genau das, was die Fabriken oben lesen, und das
 * Backend buendelt es ebenso (MasterDataAdminController im Paket masterdata,
 * AdminUserController im Paket admin). In admin.ts steht, was es nur fuer
 * ADMIN ueberhaupt gibt.
 *
 * <p><strong>Zwei Fehler tragen denselben Code.</strong> 409
 * RESOURCE_IN_USE meint beim Anlegen und Umbenennen den bereits vergebenen
 * eindeutigen Wert, beim Loeschen die noch referenzierte Zeile (Contract
 * v26). Unterschieden wird nach der ausgeloesten Aktion, nie nach dem Code
 * allein; die aufrufende Ansicht weiss, welche sie war.
 *
 * <p><strong>Eine unbekannte ID im Body ergibt 400, nicht 404</strong>
 * (§6.3.1): ein Studiengang mit unbekannter facultyId ist eine unbrauchbare
 * Anfrage und keine fehlende Ressource. Der 404 bleibt der unbekannten ID im
 * Pfad vorbehalten.
 */

export function createCategory(
  request: CategoryCreateRequest
): Promise<CategoryResponse> {
  return api.post<CategoryResponse>(apiPaths.admin.categories, request)
}

export function updateCategory(
  categoryId: string,
  request: CategoryUpdateRequest
): Promise<CategoryResponse> {
  return api.patch<CategoryResponse>(
    apiPaths.admin.category(categoryId),
    request
  )
}

export function deleteCategory(categoryId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.category(categoryId))
}

/**
 * Zusammenfuehren zweier Kategorien (§6.1, seit Contract v32, KAN-46).
 *
 * <p>Haengt alle Projekte der Quelle an das Ziel um und loescht die Quelle;
 * die Antwort ist die <em>Ziel</em>kategorie. Quelle gleich Ziel ergibt
 * <strong>400</strong>, eine unbekannte targetCategoryId ebenfalls; nur die
 * unbekannte ID im Pfad ergibt <strong>404</strong>.
 *
 * <p>Der Vorgang erfasst auch veroeffentlichte Projekte und gibt ihnen eine
 * neue version (§6.4). Die Liste wird danach neu geladen, denn die Quelle
 * gibt es nicht mehr.
 */
export function mergeCategories(
  sourceCategoryId: string,
  targetCategoryId: string
): Promise<CategoryResponse> {
  return api.post<CategoryResponse>(
    apiPaths.admin.categoryMerge(sourceCategoryId),
    { targetCategoryId } satisfies CategoryMergeRequest
  )
}

export function createFaculty(
  request: FacultyCreateRequest
): Promise<FacultyResponse> {
  return api.post<FacultyResponse>(apiPaths.admin.faculties, request)
}

export function updateFaculty(
  facultyId: string,
  request: FacultyUpdateRequest
): Promise<FacultyResponse> {
  return api.patch<FacultyResponse>(apiPaths.admin.faculty(facultyId), request)
}

export function deleteFaculty(facultyId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.faculty(facultyId))
}

export function createStudyProgram(
  request: StudyProgramCreateRequest
): Promise<StudyProgramResponse> {
  return api.post<StudyProgramResponse>(apiPaths.admin.studyPrograms, request)
}

export function updateStudyProgram(
  studyProgramId: string,
  request: StudyProgramUpdateRequest
): Promise<StudyProgramResponse> {
  return api.patch<StudyProgramResponse>(
    apiPaths.admin.studyProgram(studyProgramId),
    request
  )
}

export function deleteStudyProgram(studyProgramId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.studyProgram(studyProgramId))
}

export function createModule(
  request: ModuleCreateRequest
): Promise<ModuleResponse> {
  return api.post<ModuleResponse>(apiPaths.admin.modules, request)
}

export function updateModule(
  moduleId: string,
  request: ModuleUpdateRequest
): Promise<ModuleResponse> {
  return api.patch<ModuleResponse>(apiPaths.admin.module(moduleId), request)
}

export function deleteModule(moduleId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.module(moduleId))
}

/**
 * Semester anlegen (§3.18, §6.1). Die neue Zeile bekommt den hoechsten
 * sortOrder und steht damit am Ende der Reihenfolge; {@code active} fehlt
 * bewusst im Koerper, denn ohne Angabe ist ein Semester aktiv.
 */
export function createSemester(
  request: SemesterCreateRequest
): Promise<SemesterResponse> {
  return api.post<SemesterResponse>(apiPaths.admin.semesters, request)
}

/**
 * Semester umbenennen oder aus der Auswahl nehmen (§3.18, §6.1).
 *
 * <p>Ein eigener Endpoint fuer das Deaktivieren gibt es nicht, und das ist
 * kein Versaeumnis: {@code active} ist ein gewoehnliches Attribut der Zeile
 * und kein Zustandsuebergang im Sinne von §4.1.
 */
export function updateSemester(
  semesterId: string,
  request: SemesterUpdateRequest
): Promise<SemesterResponse> {
  return api.patch<SemesterResponse>(
    apiPaths.admin.semester(semesterId),
    request
  )
}

export function deleteSemester(semesterId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.semester(semesterId))
}

/**
 * Ein Semester in der Reihenfolge verschieben (§3.18, §6.1).
 *
 * <p><strong>Die Antwort ist die vollstaendige neue Reihenfolge</strong> und
 * nicht die eine verschobene Zeile: der Tausch betrifft immer zwei. Am
 * oberen oder unteren Rand ist der Aufruf wirkungslos und ergibt trotzdem
 * <strong>200</strong>, weil der gewuenschte Zustand bereits besteht; die
 * Oberflaeche sperrt die Pfeile dort trotzdem.
 */
export function moveSemester(
  semesterId: string,
  direction: SemesterMoveDirection
): Promise<SemesterResponse[]> {
  return api.post<SemesterResponse[]>(apiPaths.admin.semesterMove(semesterId), {
    direction,
  } satisfies SemesterMoveRequest)
}
