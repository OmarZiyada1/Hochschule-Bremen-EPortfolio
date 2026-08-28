import {
  CheckCircle2Icon,
  ClockIcon,
  EyeIcon,
  FolderOpenIcon,
  LayersIcon,
  RotateCcwIcon,
} from "lucide-react"

import type { ProjectStatus } from "@/api/types"

/**
 * Der Statusfilter von "My Portfolio" (KAN-34) als reine Funktionen, damit
 * er ohne Rendern pruefbar ist (Skill frontend-modul, Abschnitt 3).
 *
 * Der Filter ist eine Bequemlichkeit: die Sichtbarkeitsregel aus §5 steht
 * serverseitig immer mit UND davor. Auswaehlbar sind die fuenf Werte aus
 * §2.2 und "Alle"; letzteres ist kein Status, sondern das Fehlen des
 * Parameters.
 */

/*
 * Record ueber den Enum-Typ statt Array-Literal (Skill frontend-shadcn,
 * Abschnitt 6): ein sechster Contract-Status bricht den Typecheck, statt
 * still aus dem Filter zu fehlen. Der Zahlwert ist die Reihenfolge aus dem
 * Template "My Portfolio".
 */
const STATUS_ORDER: Record<ProjectStatus, number> = {
  DRAFT: 1,
  SUBMITTED: 2,
  APPROVED: 3,
  PUBLISHED: 4,
  REVISION: 5,
}

/** Die fuenf Status in der Reihenfolge des Templates, ohne "Alle". */
export const OWN_PROJECT_STATUSES: readonly ProjectStatus[] = (
  Object.keys(STATUS_ORDER) as ProjectStatus[]
).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])

/**
 * Symbol je Projektstatus fuer die Kennzahlkacheln.
 *
 * <p><strong>Eine Zuordnung, zwei Seiten.</strong> Die Kacheln stehen auf dem
 * Dashboard der Administrationsseite und in „Meine Reviews"; bis zur
 * Vereinheitlichung fuehrte nur die zweite Seite Symbole, und zwar in einer
 * eigenen Liste in ihrer Komponentendatei. Sie steht jetzt hier, damit
 * derselbe Status auf beiden Seiten dasselbe Sinnbild traegt und ein
 * sechster Contract-Status an genau einer Stelle nachzutragen ist.
 *
 * <p>Record ueber den Enum-Typ ohne Standardzweig: ein neuer Wert bricht den
 * Typecheck, statt still ohne Symbol zu erscheinen. Vorbild ist
 * {@code tierIcons} in {@code features/reviews/nominations.ts}.
 *
 * <p>Die Symbole sind Beiwerk und nie die Aussage (SC 1.4.1): den Status
 * nennt die Beschriftung der Kachel, und fuer Hilfsmittel sind sie
 * {@code aria-hidden}.
 */
export const PROJECT_STATUS_ICONS: Record<ProjectStatus, typeof ClockIcon> = {
  DRAFT: FolderOpenIcon,
  SUBMITTED: ClockIcon,
  APPROVED: CheckCircle2Icon,
  PUBLISHED: EyeIcon,
  REVISION: RotateCcwIcon,
}

/**
 * Symbol der Kachel, die ueber alle Status summiert („Alle Projekte im
 * System" auf dem Dashboard). Kein Status und deshalb kein Eintrag in
 * {@link PROJECT_STATUS_ICONS}; Schichten stehen fuer den Stapel aus allen
 * fuenf.
 */
export const ALL_PROJECTS_ICON = LayersIcon

/**
 * Wert des Knopfes "Alle". Kein Contract-Wert, deshalb bewusst kleinge-
 * schrieben: so kann er mit keinem Enum-Wert aus §2.2 kollidieren, auch
 * nicht mit einem kuenftigen.
 */
export const ALL_STATUSES = "all" as const

export type StatusFilterValue = ProjectStatus | typeof ALL_STATUSES

export function isProjectStatus(value: string): value is ProjectStatus {
  return (OWN_PROJECT_STATUSES as readonly string[]).includes(value)
}

/**
 * Liest den Filter aus der URL. Ein unbekannter oder fehlender Wert ergibt
 * "Alle": ein von Hand geschriebener Fantasiestatus endete am Server als
 * 400, obwohl ihn kein Knopf erzeugen kann.
 */
export function readStatusFilter(params: URLSearchParams): StatusFilterValue {
  const value = params.get("status")
  return value !== null && isProjectStatus(value) ? value : ALL_STATUSES
}

/**
 * Schreibt den Filter in die URL. "Alle" entfernt den Parameter, statt
 * ?status=all zu hinterlassen: der Grundzustand einer Seite hat keine
 * Parameter, und der Wert ginge ohnehin nicht an den Server.
 */
export function writeStatusFilter(
  params: URLSearchParams,
  value: StatusFilterValue
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (value === ALL_STATUSES) {
    next.delete("status")
  } else {
    next.set("status", value)
  }
  return next
}

/** Der Wert, den die Query-Fabrik erwartet: undefined heisst "Alle". */
export function statusQueryValue(
  value: StatusFilterValue
): ProjectStatus | undefined {
  return value === ALL_STATUSES ? undefined : value
}

/**
 * Traegt eine Kachel unter „Mein Portfolio" eine Handlung (KAN-69, erweitert
 * mit KAN-83)?
 *
 * <p><strong>Als Autor:in</strong> haengt es am Status: Bearbeiten in DRAFT
 * und REVISION, Loeschen in DRAFT, Zurueckziehen in SUBMITTED; APPROVED und
 * PUBLISHED bekommen keine, damit die veroeffentlichte Kachel ihre
 * Reaktionszahl behaelt.
 *
 * <p><strong>Als Mitglied</strong> stehen dieselben Handlungen zur Verfuegung
 * wie der Autor:in, ausser dem Loeschen (§4.1 und §5 seit Contract v85,
 * KAN-86); an dessen Stelle steht das Verlassen (§3.13.1, seit Contract
 * v84). Das Verlassen gilt in jedem Status, dort greift die Statusschranke
 * ausdruecklich nicht, sonst kaeme niemand je aus einem veroeffentlichten
 * Projekt heraus. Eine Kachel eines Mitglieds traegt deshalb in jedem Status
 * eine Handlung, und die Antwort dieser Funktion bleibt fuer sie unveraendert
 * {@code true}.
 *
 * <p>Die Antwort steht hier und nicht zusaetzlich in der Seite: sonst
 * muesste ein neuer Status an zwei Stellen nachgezogen werden (Befund aus
 * dem Review zu KAN-69). Welche Handlung es genau ist, entscheidet
 * {@code OwnProjectCardActions}.
 */
export function hasOwnCardAction(
  status: ProjectStatus | undefined,
  isAuthor: boolean
): boolean {
  if (!isAuthor) {
    return true
  }
  return status === "DRAFT" || status === "REVISION" || status === "SUBMITTED"
}
