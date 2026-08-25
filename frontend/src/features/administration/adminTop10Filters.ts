import type { NominationStatus } from "@/api/types"
import {
  ALL_NOMINATION_STATUSES,
  type NominationFilterValue,
  NOMINATION_STATUSES,
} from "@/features/reviews/nominations"

/**
 * Ansichtszustand der Top-10-Verwaltung und ihres Protokolls als reine
 * Funktionen, damit er ohne Rendern pruefbar ist (Skill frontend-modul,
 * Abschnitt 3; KAN-40). Vorbild ist {@code adminUserFilters.ts} aus KAN-39.
 *
 * <p>Statusfilter, Zeitraum, Person und Seite stehen in der Adresse und
 * nicht in {@code useState}: ein Ergebnis ist sonst weder teilbar noch
 * uebersteht es den Zurueck-Knopf. Ein geoeffneter Dialog bleibt dagegen
 * Komponentenzustand, er beschreibt keine Ansicht.
 *
 * <p><strong>Die vier Staende kommen aus {@code reviews/nominations}</strong>
 * und werden hier nicht ein zweites Mal aufgezaehlt: es sind dieselben Werte
 * aus §2.8, und eine zweite Liste liefe beim naechsten Contract-Stand
 * auseinander.
 */

/**
 * Der Stand, den die Verwaltung ohne Filter in der Adresse zeigt.
 *
 * <p><strong>Offene Vorschlaege, nicht alle.</strong> Der Frame
 * {@code Admin · Top 10} ueberschreibt den Bereich mit „Offene
 * Nominierungen" und nennt ihre Anzahl; das ist die Arbeitsliste, und
 * entschiedene Vorgaenge wuerden sie zuschuetten. Die uebrigen drei Staende
 * stehen im Filter bereit und landen dann in der Adresse (Klaerungsrunde zu
 * KAN-40).
 */
export const DEFAULT_NOMINATION_FILTER: NominationStatus = "PENDING"

export function isNominationStatus(value: string): value is NominationStatus {
  return (NOMINATION_STATUSES as readonly string[]).includes(value)
}

/**
 * Liest den Statusfilter aus der Adresse.
 *
 * <p>Kein Parameter heisst {@link DEFAULT_NOMINATION_FILTER}, der Sonderwert
 * „alle" steht ausdruecklich als {@code status=all} darin. Ein unbekannter
 * Wert faellt auf den Standard zurueck, statt als Fantasiewert an den Server
 * zu gehen und dort 400 {@code VALIDATION_FAILED} zu ergeben.
 */
export function readNominationFilter(
  params: URLSearchParams
): NominationFilterValue {
  const status = params.get("status")
  if (status === ALL_NOMINATION_STATUSES) {
    return ALL_NOMINATION_STATUSES
  }
  return status !== null && isNominationStatus(status)
    ? status
    : DEFAULT_NOMINATION_FILTER
}

/**
 * Schreibt den Statusfilter in die Adresse. Der Standard erscheint nicht
 * darin: eine Adresse soll sagen, was von der Voreinstellung abweicht.
 */
export function writeNominationFilter(
  params: URLSearchParams,
  status: NominationFilterValue
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (status === DEFAULT_NOMINATION_FILTER) {
    next.delete("status")
  } else {
    next.set("status", status)
  }
  return next
}

/**
 * Der Zustand der Protokollseite.
 *
 * <p><strong>from und to sind Tage, keine Zeitpunkte.</strong> In der
 * Adresse steht {@code JJJJ-MM-TT}, weil eine Person einen Tag waehlt und
 * keine Sekunde. Die Tagesgrenzen bildet {@link auditQueryOf} daraus, in der
 * Zeitzone der lesenden Person; der Server legt bewusst keine fest (§6.1).
 */
export interface AdminTop10AuditState {
  /** Frueheste beruecksichtigte Tagesgrenze, {@code JJJJ-MM-TT}. */
  from: string | null
  /** Spaeteste beruecksichtigte Tagesgrenze, {@code JJJJ-MM-TT}. */
  to: string | null
  /** UUID des Kontos, dessen Aenderungen gezeigt werden. */
  admin: string | null
  /** 1-basiert wie in der Adresse; der Server zaehlt ab 0 (§6.6). */
  page: number
}

/**
 * Ein Tagesdatum in der Form {@code JJJJ-MM-TT}. Geprueft wird zusaetzlich,
 * dass es den Tag wirklich gibt: {@code 2026-02-31} passt auf das Muster und
 * ist trotzdem keiner.
 */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/** Liest den Zustand der Protokollseite aus der Adresse. */
export function readAdminTop10AuditState(
  params: URLSearchParams
): AdminTop10AuditState {
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10)
  const from = params.get("from")
  const to = params.get("to")
  const admin = params.get("admin")

  return {
    from: from !== null && isIsoDate(from) ? from : null,
    to: to !== null && isIsoDate(to) ? to : null,
    admin: admin === null || admin === "" ? null : admin,
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
  }
}

/**
 * Schreibt eine Aenderung in die Adresse und setzt dabei auf Seite 1
 * zurueck, sofern nicht die Seite selbst gewechselt wird: die alte
 * Seitenzahl gehoerte zur alten Treffermenge.
 */
export function writeAdminTop10AuditState(
  params: URLSearchParams,
  change: Partial<AdminTop10AuditState>
): URLSearchParams {
  const next = new URLSearchParams(params)

  for (const key of ["from", "to", "admin"] as const) {
    const value = change[key]
    if (value === undefined) {
      continue
    }
    if (value === null || value === "") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }

  if (change.page !== undefined) {
    if (change.page > 1) {
      next.set("page", String(change.page))
    } else {
      next.delete("page")
    }
  } else {
    next.delete("page")
  }

  return next
}

/**
 * Der Beginn dieses Tages als ISO-8601-Zeitpunkt in UTC.
 *
 * <p>Gebildet ueber den lokalen Konstruktor und erst danach nach UTC
 * gewandelt: der Server legt keine Zeitzone fest, die Tagesgrenze ist die
 * der lesenden Person (§6.1). In Bremen wird aus dem 1. August damit
 * {@code 2026-07-31T22:00:00.000Z}, und genau das ist gemeint.
 */
export function dayStartIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
}

/**
 * Das Ende dieses Tages als ISO-8601-Zeitpunkt in UTC.
 *
 * <p><strong>Die letzte Millisekunde, nicht der naechste Mitternacht.</strong>
 * Beide Grenzen des Endpoints sind eingeschlossen (§6.1); mit dem Beginn des
 * Folgetages faenge der Bereich einen Eintrag mit, der nicht mehr
 * dazugehoert. Ein Bereich bis heute schliesst den heutigen Tag damit
 * vollstaendig ein, bis 23:59:59.999 Ortszeit.
 */
export function dayEndIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
}

/**
 * Uebersetzt den Ansichtszustand in die Parameter von
 * {@code GET /api/admin/top10-audit}.
 *
 * <p>Die Seite zaehlt hier ab 0, in der Adresse ab 1 (§6.6). Ein nicht
 * gesetzter Filter faellt weg und schraenkt damit nicht ein.
 */
export function auditQueryOf(state: AdminTop10AuditState): {
  from?: string
  to?: string
  admin?: string
  page?: number
} {
  return {
    from: state.from === null ? undefined : dayStartIso(state.from),
    to: state.to === null ? undefined : dayEndIso(state.to),
    admin: state.admin ?? undefined,
    page: state.page - 1,
  }
}
