import type { Role, UserStatus } from "@/api/types"

/**
 * Ansichtszustand der Nutzerverwaltung (KAN-39) als reine Funktionen, damit
 * er ohne Rendern pruefbar ist (Skill frontend-modul, Abschnitt 3). Vorbild
 * ist {@code adminProjectFilters.ts} aus KAN-38, bis hin zum Sonderwert
 * „Alle", der kein Contract-Wert ist.
 *
 * <p>Suchbegriff, Rolle, Status und Seite stehen in der Adresse und nicht in
 * {@code useState}: ein Ergebnis ist sonst weder teilbar noch uebersteht es
 * den Zurueck-Knopf.
 */

/*
 * Record ueber den Enum-Typ statt Array-Literal (Skill frontend-shadcn,
 * Abschnitt 6): eine vierte Rolle bricht den Typecheck, statt still aus dem
 * Filter zu fehlen. Der Zahlwert ist die Reihenfolge der Leiste im Frame
 * „Admin · Nutzer:innen".
 */
const ROLE_ORDER: Record<Role, number> = {
  STUDENT: 1,
  EDITOR: 2,
  ADMIN: 3,
}

/** Die drei Rollen aus §2.1, in der Reihenfolge des Frames, ohne „Alle". */
export const ADMIN_USER_ROLES: readonly Role[] = (
  Object.keys(ROLE_ORDER) as Role[]
).sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b])

/*
 * Dieselbe Zusage fuer den Kontostatus (§2.9). Anders als beim Setzen sind
 * hier alle drei Werte zulaessig: REGISTRATION_PENDING laesst sich nicht
 * setzen (400 VALIDATION_FAILED), beschreibt aber einen Bestand, den die
 * Administration sehen koennen muss.
 */
const STATUS_ORDER: Record<UserStatus, number> = {
  ACTIVE: 1,
  DEACTIVATED: 2,
  REGISTRATION_PENDING: 3,
}

/** Die drei Kontostatus aus §2.9, in Anzeigereihenfolge. */
export const ADMIN_USER_STATUSES: readonly UserStatus[] = (
  Object.keys(STATUS_ORDER) as UserStatus[]
).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])

/**
 * Wert des Segments „Alle". Kein Contract-Wert, deshalb bewusst
 * kleingeschrieben: so kann er mit keinem Enum-Wert aus §2.1 kollidieren,
 * auch nicht mit einem kuenftigen.
 */
export const ALL_ROLES = "all" as const

export type RoleFilterValue = Role | typeof ALL_ROLES

export function isRole(value: string): value is Role {
  return (ADMIN_USER_ROLES as readonly string[]).includes(value)
}

export function isUserStatus(value: string): value is UserStatus {
  return (ADMIN_USER_STATUSES as readonly string[]).includes(value)
}

/**
 * Der vollstaendige Ansichtszustand. Ein leerer Suchbegriff, „Alle" und ein
 * {@code null} im Statusfeld heissen „nicht gesetzt"; sie erscheinen nicht in
 * der Adresse.
 */
export interface AdminUserViewState {
  q: string
  role: RoleFilterValue
  status: UserStatus | null
  /** 1-basiert wie in der Adresse; der Server zaehlt ab 0 (§6.6). */
  page: number
}

/**
 * Liest den Zustand aus der Adresse.
 *
 * <p>Ein unbekannter Wert in Rolle oder Status ergibt „nicht gesetzt". Beide
 * gehen als Enum an den Server, und ein von Hand geschriebener Fantasiewert
 * endete dort als 400 VALIDATION_FAILED, obwohl ihn kein Bedienelement
 * erzeugen kann.
 */
export function readAdminUserState(
  params: URLSearchParams
): AdminUserViewState {
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10)
  const role = params.get("role")
  const status = params.get("status")

  return {
    q: params.get("q") ?? "",
    role: role !== null && isRole(role) ? role : ALL_ROLES,
    status: status !== null && isUserStatus(status) ? status : null,
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
  }
}

/**
 * Schreibt eine Aenderung in die Adresse und setzt dabei auf Seite 1
 * zurueck, sofern nicht die Seite selbst gewechselt wird: die alte
 * Seitenzahl gehoerte zur alten Treffermenge.
 */
export function writeAdminUserState(
  params: URLSearchParams,
  change: Partial<AdminUserViewState>
): URLSearchParams {
  const next = new URLSearchParams(params)

  if (change.q !== undefined) {
    setOrDelete(next, "q", change.q === "" ? null : change.q)
  }
  if (change.role !== undefined) {
    setOrDelete(next, "role", change.role === ALL_ROLES ? null : change.role)
  }
  if (change.status !== undefined) {
    setOrDelete(next, "status", change.status)
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
