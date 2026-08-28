import type { SupportRequestStatus } from "@/api/types"

/**
 * Ansichtszustand der Support-Verwaltung (KAN-85) als reine Funktionen, damit
 * er ohne Rendern pruefbar ist (Skill frontend-modul, Abschnitt 3). Vorbild ist
 * {@code adminUserFilters.ts} aus KAN-39, bis hin zum Sonderwert „Alle", der
 * kein Contract-Wert ist.
 *
 * <p>Stand und Seite stehen in der Adresse und nicht in {@code useState}: ein
 * Ergebnis ist sonst weder teilbar noch uebersteht es den Zurueck-Knopf.
 *
 * <p><strong>Der Filter {@code category} bleibt vorerst ungenutzt.</strong>
 * §6.1 fuehrt ihn, der Frame {@code Admin · Support} zeigt aber kein
 * Bedienelement dafuer. Ihn hier auf Vorrat zu fuehren waere ein Zustand ohne
 * Bedienung; wer ihn braucht, ergaenzt ein zweites Segment und diese Datei.
 */

/*
 * Record ueber den Enum-Typ statt Array-Literal (Skill frontend-shadcn,
 * Abschnitt 6): ein vierter Stand bricht den Typecheck, statt still aus dem
 * Filter zu fehlen. Der Zahlwert ist die Reihenfolge der Leiste, und sie folgt
 * dem Ablauf aus §2.15 und nicht dem Alphabet.
 */
const STATUS_ORDER: Record<SupportRequestStatus, number> = {
  OPEN: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
}

/** Die drei Staende aus §2.15, in Anzeigereihenfolge, ohne „Alle". */
export const SUPPORT_STATUSES: readonly SupportRequestStatus[] = (
  Object.keys(STATUS_ORDER) as SupportRequestStatus[]
).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])

/**
 * Wert des Segments „Alle". Kein Contract-Wert, deshalb bewusst
 * kleingeschrieben: so kann er mit keinem Wert aus §2.15 kollidieren, auch
 * nicht mit einem kuenftigen.
 */
export const ALL_SUPPORT_STATUSES = "all" as const

export type SupportStatusFilterValue =
  SupportRequestStatus | typeof ALL_SUPPORT_STATUSES

export function isSupportStatus(value: string): value is SupportRequestStatus {
  return (SUPPORT_STATUSES as readonly string[]).includes(value)
}

/**
 * Der vollstaendige Ansichtszustand. „Alle" heisst „nicht gesetzt" und
 * erscheint nicht in der Adresse.
 */
export interface AdminSupportViewState {
  status: SupportStatusFilterValue
  /** 1-basiert wie in der Adresse; der Server zaehlt ab 0 (§6.6). */
  page: number
}

/**
 * Liest den Zustand aus der Adresse.
 *
 * <p>Ein unbekannter Stand ergibt „Alle". Der Wert geht als Enum an den
 * Server, und ein von Hand geschriebener Fantasiewert endete dort als 400
 * VALIDATION_FAILED, obwohl ihn kein Bedienelement erzeugen kann.
 */
export function readAdminSupportState(
  params: URLSearchParams
): AdminSupportViewState {
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10)
  const status = params.get("status")

  return {
    status:
      status !== null && isSupportStatus(status)
        ? status
        : ALL_SUPPORT_STATUSES,
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
  }
}

/**
 * Schreibt eine Aenderung in die Adresse und setzt dabei auf Seite 1 zurueck,
 * sofern nicht die Seite selbst gewechselt wird: die alte Seitenzahl gehoerte
 * zur alten Treffermenge.
 */
export function writeAdminSupportState(
  params: URLSearchParams,
  change: Partial<AdminSupportViewState>
): URLSearchParams {
  const next = new URLSearchParams(params)

  if (change.status !== undefined) {
    setOrDelete(
      next,
      "status",
      change.status === ALL_SUPPORT_STATUSES ? null : change.status
    )
  }

  if (change.page !== undefined) {
    setOrDelete(next, "page", change.page > 1 ? String(change.page) : null)
  } else {
    next.delete("page")
  }

  return next
}

/**
 * Die Anfrageparameter zu einem Ansichtszustand (§6.1, §6.6). „Alle" wird zu
 * {@code undefined} und faellt damit aus der Anfrage, und die 1-basierte
 * Seitenzahl der Adresse wird zur 0-basierten des Servers.
 */
export function supportQueryOf(state: AdminSupportViewState) {
  return {
    status:
      state.status === ALL_SUPPORT_STATUSES
        ? undefined
        : (state.status as SupportRequestStatus),
    page: state.page - 1,
  }
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
