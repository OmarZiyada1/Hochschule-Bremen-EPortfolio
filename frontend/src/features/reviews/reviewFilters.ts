import type { ProjectStatus } from "@/api/types"
import {
  ALL_STATUSES,
  isProjectStatus,
  type StatusFilterValue,
} from "@/features/portfolio/ownProjectStatus"

/**
 * Ansichtszustand von „Meine Reviews" (KAN-37) als reine Funktionen, damit
 * er ohne Rendern pruefbar ist (Skill frontend-modul, Abschnitt 3). Vorbild
 * ist {@code features/portfolio/ownProjectStatus.ts}, von dort kommen auch
 * {@code ALL_STATUSES} und die Statuspruefung: zwei Fassungen desselben
 * Sonderwerts liefen auseinander.
 *
 * <p>Suche, Statusleiste, die drei Filter und die Seite stehen in der
 * Adresse und nicht in {@code useState}: ein Ergebnis ist sonst weder
 * teilbar noch uebersteht es den Zurueck-Knopf.
 */

/*
 * Record ueber den Enum-Typ statt Array-Literal (Skill frontend-shadcn,
 * Abschnitt 6): ein sechster Contract-Status bricht den Typecheck, statt
 * still aus der Leiste zu fehlen. Der Zahlwert ist die Reihenfolge aus dem
 * Template „Meine Reviews".
 *
 * DRAFT steht bewusst auf 0 und faellt damit heraus: die Redaktion liest
 * nicht veroeffentlichte Projekte erst ab SUBMITTED (§5 Fussnote 11), ein
 * Entwurf erscheint in editor=me also gar nicht erst. Ein Segment, das
 * zuverlaessig nichts findet, waere ein Ziel ohne Zweck.
 */
const REVIEW_STATUS_ORDER: Record<ProjectStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  PUBLISHED: 3,
  REVISION: 4,
}

/** Die vier Status der Leiste in der Reihenfolge des Templates, ohne „Alle". */
export const REVIEW_STATUSES: readonly ProjectStatus[] = (
  Object.keys(REVIEW_STATUS_ORDER) as ProjectStatus[]
)
  .filter((status) => REVIEW_STATUS_ORDER[status] > 0)
  .sort((a, b) => REVIEW_STATUS_ORDER[a] - REVIEW_STATUS_ORDER[b])

/** Die drei Auswahlfelder des Templates, in ihrer Reihenfolge. */
export const REVIEW_FILTER_KEYS = [
  "studyProgram",
  "semester",
  "module",
] as const

export type ReviewFilterKey = (typeof REVIEW_FILTER_KEYS)[number]

/**
 * Der vollstaendige Ansichtszustand. Ein leerer Suchbegriff und ein
 * {@code null} in einem Auswahlfeld heissen „nicht gesetzt"; sie erscheinen
 * nicht in der Adresse.
 */
export interface ReviewViewState {
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
export function readReviewState(params: URLSearchParams): ReviewViewState {
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
export function writeReviewState(
  params: URLSearchParams,
  change: Partial<ReviewViewState>
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
  for (const key of REVIEW_FILTER_KEYS) {
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
