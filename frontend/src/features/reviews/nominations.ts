import { AwardIcon, MedalIcon, TrophyIcon } from "lucide-react"

import type { NominationStatus, NominationTier } from "@/api/types"
import type { PillTone } from "@/components/common/Pill"

/**
 * Der Nominierungsbereich von „Meine Reviews" als reine Werte und
 * Funktionen, damit er ohne Rendern pruefbar ist (Skill frontend-modul,
 * Abschnitt 3) und die Komponentendatei ausschliesslich Komponenten
 * ausfuehrt (Lint react-refresh/only-export-components).
 *
 * <p>Hier liegt jede Zuordnung <em>einmal</em>: Stufe zu Ton, Stufe zu
 * Symbol, Stand zu Ton, Stand zu Handlung. Vor der Zusammenlegung der
 * beiden Nominierungskarten standen Teile davon in der Karte und Teile im
 * Verlauf, und der Verlauf zeigte den Stand am Ende gar nicht.
 */

/*
 * Record ueber den Enum-Typ ohne Standardzweig: eine vierte Stufe bricht den
 * Typecheck, statt still ohne Ton oder ohne Symbol zu erscheinen.
 *
 * Der Ton ist Zugabe und nie die Aussage: die Stufe steht immer als Text in
 * der Pille, das Symbol daneben ist dekorativ (SC 1.4.1).
 */
export const tierTones: Record<NominationTier, PillTone> = {
  TOP_1: "success",
  TOP_5: "info",
  TOP_10: "neutral",
}

/**
 * Symbol je Stufe, absteigend in der Wertigkeit: Pokal, Auszeichnung,
 * Medaille. Alle drei aus lucide-react, wie jedes andere Symbol des
 * Projekts.
 */
export const tierIcons: Record<NominationTier, typeof TrophyIcon> = {
  TOP_1: TrophyIcon,
  TOP_5: AwardIcon,
  TOP_10: MedalIcon,
}

/**
 * Ton je Stand (§2.8). Gedaempfte Toene statt gesaettigter Farben: der
 * Projekttitel bleibt das Erste, was eine Zeile zeigt, die Marke daneben
 * ordnet nur ein.
 */
export const nominationStatusTones: Record<NominationStatus, PillTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
}

/*
 * Die Reihenfolge der Leiste: erst der offene Fall, dann die beiden
 * Entscheidungen, zuletzt der Rueckzug. Record statt Array-Literal, damit
 * ein fuenfter Contract-Stand den Typecheck bricht, statt still aus der
 * Leiste zu fehlen (Skill frontend-shadcn, Abschnitt 6).
 */
const STATUS_ORDER: Record<NominationStatus, number> = {
  PENDING: 1,
  ACCEPTED: 2,
  REJECTED: 3,
  WITHDRAWN: 4,
}

/** Die vier Staende in Anzeigereihenfolge, ohne „Alle". */
export const NOMINATION_STATUSES: readonly NominationStatus[] = (
  Object.keys(STATUS_ORDER) as NominationStatus[]
).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])

/**
 * Wert des Knopfes „Alle". Kein Contract-Wert, deshalb bewusst klein
 * geschrieben: so kann er mit keinem Enum-Wert aus §2.8 kollidieren, auch
 * nicht mit einem kuenftigen. Dieselbe Ueberlegung wie bei
 * {@code ALL_STATUSES} des Projektfilters.
 */
export const ALL_NOMINATION_STATUSES = "all" as const

export type NominationFilterValue =
  NominationStatus | typeof ALL_NOMINATION_STATUSES

/**
 * Laesst sich dieser Vorschlag ueber die Oberflaeche zurueckziehen (§3.11.1,
 * seit Contract v70)?
 *
 * <p>Die nominierende Person zieht ihren eigenen Vorschlag zurueck, solange
 * er offen ist; ist sie zugleich Administration, auch einen bereits
 * angenommenen. Ein abgelehnter oder schon zurueckgezogener Vorschlag ist in
 * keinem Fall mehr zurueckziehbar.
 *
 * <p><strong>Ein fremder Vorschlag wird hier nie zurueckgezogen</strong>
 * (Entscheidung zur Nacharbeit an KAN-87). Der Server erlaubt der
 * Administration mehr: §3.11.1 laesst sie jeden Vorschlag zurueckziehen. Die
 * Oberflaeche bietet das bewusst nicht an, weil Zurueckziehen und Ablehnen
 * zwei verschiedene Vorgaenge sind und im Protokoll auch verschieden gelesen
 * werden. „Zurueckgezogen" heisst „die vorschlagende Person hat es sich
 * anders ueberlegt"; die Administration entscheidet dagegen ueber einen
 * fremden Vorschlag, und dafuer gibt es <em>Ablehnen</em>. Soll ein bereits
 * aufgenommenes Projekt die Liste verlassen, ist der Weg
 * „Vom Platz nehmen" in der Platzliste, nicht der Rueckzug eines fremden
 * Vorschlags.
 *
 * <p>In „Meine Reviews" ist {@code isOwn} immer wahr: die Liste steht auf
 * {@code nominatedBy=me}. In der Top-10-Verwaltung stehen alle Vorschlaege
 * nebeneinander, und dort traegt dieser Parameter die Unterscheidung.
 *
 * <p>Die Funktion bildet §3.11.1 ab und ersetzt es nicht: verbindlich bleibt
 * der Server, der dieselben Faelle mit 409
 * {@code NOMINATION_ALREADY_DECIDED} beantwortet. Die Oberflaeche kennt nur
 * den Stand des letzten Ladevorgangs.
 *
 * @param isOwn stammt der Vorschlag von der angemeldeten Person?
 */
export function nominationWithdrawable(
  status: NominationStatus,
  isAdmin: boolean,
  isOwn: boolean
): boolean {
  if (!isOwn) {
    return false
  }
  if (status === "PENDING") {
    return true
  }
  return isAdmin && status === "ACCEPTED"
}
