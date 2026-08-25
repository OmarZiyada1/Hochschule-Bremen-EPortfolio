import type { ProjectStatus } from "@/api/types"
import {
  ALL_STATUSES,
  isProjectStatus,
  OWN_PROJECT_STATUSES,
  type StatusFilterValue,
} from "@/features/portfolio/ownProjectStatus"

/**
 * Ansichtszustand der Projektverwaltung (KAN-38) als reine Funktionen, damit
 * er ohne Rendern pruefbar ist (Skill frontend-modul, Abschnitt 3). Vorbild
 * ist {@code features/reviews/reviewFilters.ts}; von dort kommen auch
 * {@code ALL_STATUSES} und die Statuspruefung, zwei Fassungen desselben
 * Sonderwerts liefen auseinander.
 *
 * <p>Suche, Statusleiste, die drei Auswahlfelder und die Seite stehen in der
 * Adresse und nicht in {@code useState}: ein Ergebnis ist sonst weder teilbar
 * noch uebersteht es den Zurueck-Knopf.
 */

/**
 * Alle fuenf Status aus §2.2, in der Reihenfolge des Zustandsautomaten.
 *
 * <p><strong>Anders als bei „Meine Reviews" ist DRAFT dabei.</strong> Die
 * Redaktion sieht Entwuerfe gar nicht erst (§5 Fussnote 11), die
 * Administration sieht alles; die Projektverwaltung ist seit Contract v42 die
 * einzige Ansicht, in der ein fremder Entwurf ueberhaupt erscheint. Der Frame
 * zeichnet die Leiste entsprechend mit sechs Segmenten, „Alle" mitgezaehlt.
 *
 * <p>Die Liste stammt aus {@code OWN_PROJECT_STATUSES} und wird nicht daneben
 * neu geschrieben: dort steht bereits die Reihenfolge des Templates, und ein
 * sechster Contract-Status soll an genau einer Stelle nachgezogen werden.
 */
export const ADMIN_PROJECT_STATUSES: readonly ProjectStatus[] =
  OWN_PROJECT_STATUSES

/** Die drei Auswahlfelder des Templates, in ihrer Reihenfolge. */
export const ADMIN_FILTER_KEYS = ["studyProgram", "semester", "module"] as const

export type AdminFilterKey = (typeof ADMIN_FILTER_KEYS)[number]

/**
 * Der vollstaendige Ansichtszustand. Ein leerer Suchbegriff und ein
 * {@code null} in einem Auswahlfeld heissen „nicht gesetzt"; sie erscheinen
 * nicht in der Adresse.
 */
export interface AdminProjectViewState {
  q: string
  status: StatusFilterValue
  studyProgram: string | null
  semester: string | null
  module: string | null
  /** 1-basiert wie in der Adresse; der Server zaehlt ab 0 (§6.6). */
  page: number
}

/**
 * Liest den Zustand aus der Adresse.
 *
 * <p>Ein unbekannter Status ergibt „Alle": ein von Hand geschriebener
 * Fantasiewert endete am Server als 400, obwohl ihn kein Segment erzeugen
 * kann. Die drei ID-Filter bleiben ungeprueft, denn eine unbekannte ID ist
 * laut Contract ein gueltiger Filter mit leerem Ergebnis und kein Fehler
 * (Skill frontend-api, Abschnitt 5).
 */
export function readAdminProjectState(
  params: URLSearchParams
): AdminProjectViewState {
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10)
  const status = params.get("status")

  return {
    q: params.get("q") ?? "",
    status: status !== null && isProjectStatus(status) ? status : ALL_STATUSES,
    studyProgram: params.get("studyProgram"),
    semester: params.get("semester"),
    module: params.get("module"),
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
  }
}

/**
 * Schreibt eine Aenderung in die Adresse und setzt dabei auf Seite 1
 * zurueck, sofern nicht die Seite selbst gewechselt wird: die alte
 * Seitenzahl gehoerte zur alten Treffermenge.
 *
 * <p>Der Grundzustand hat keine Parameter: ein leerer Wert und „Alle"
 * entfernen den Eintrag, statt {@code ?status=all} zu hinterlassen.
 */
export function writeAdminProjectState(
  params: URLSearchParams,
  change: Partial<AdminProjectViewState>
): URLSearchParams {
  const next = new URLSearchParams(params)

  if (change.q !== undefined) {
    setOrDelete(next, "q", change.q === "" ? null : change.q)
  }
  if (change.status !== undefined) {
    setOrDelete(
      next,
      "status",
      change.status === ALL_STATUSES ? null : change.status
    )
  }
  for (const key of ADMIN_FILTER_KEYS) {
    if (change[key] !== undefined) {
      setOrDelete(next, key, change[key])
    }
  }

  if (change.page !== undefined) {
    setOrDelete(next, "page", change.page > 1 ? String(change.page) : null)
  } else {
    next.delete("page")
  }

  return next
}

function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string | null
): void {
  if (value === null || value === "") {
    params.delete(key)
  } else {
    params.set(key, value)
  }
}
