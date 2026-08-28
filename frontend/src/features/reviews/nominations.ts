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
 * <p><strong>Zwei Bedingungen, und die Rolle gehoert nicht dazu</strong>
 * (Vorgabe zur Nacharbeit an KAN-87): der Vorschlag stammt von der
 * angemeldeten Person, und er ist noch offen. Wer nominiert hat, nimmt seinen
 * Vorschlag zurueck, solange niemand entschieden hat; danach ist die
 * Entscheidung getroffen, und sie wird nicht ueber den Rueckzug rueckgaengig
 * gemacht.
 *
 * <p><strong>Ein fremder Vorschlag wird nie zurueckgezogen.</strong>
 * „Zurueckgezogen" heisst „die vorschlagende Person hat es sich anders
 * ueberlegt"; ueber einen fremden Vorschlag entscheidet die Administration,
 * und dafuer gibt es <em>Annehmen</em> und <em>Ablehnen</em> in der
 * Top-10-Verwaltung. Soll ein bereits aufgenommenes Projekt die Liste
 * verlassen, ist der Weg „Vom Platz nehmen" in der Platzliste.
 *
 * <p><strong>Ein angenommener Vorschlag auch dann nicht, wenn er der eigene
 * ist.</strong> Bis zur Nacharbeit durfte die Administration ihn
 * zurueckziehen, und das Projekt verliess damit als Nebenwirkung die
 * oeffentliche Startseite. Zwei Wege zu demselben Ergebnis sind einer zu
 * viel, und der zweite lag ausserdem an der falschen Stelle: eine
 * Entscheidung ueber die kuratierte Liste faellt in der Platzliste und nicht
 * in „Meine Reviews".
 *
 * <p><strong>Deshalb steht der Rueckzug nur noch in „Meine Reviews".</strong>
 * Die Liste dort steht auf {@code nominatedBy=me}, {@code isOwn} ist also
 * immer wahr; die Top-10-Verwaltung bietet ihn ueberhaupt nicht mehr an.
 * Der Parameter bleibt trotzdem, weil die Funktion sonst eine Zusage machte,
 * die sie nicht selbst prueft.
 *
 * <p>Die Oberflaeche ist damit enger als der Server, und das ist Absicht:
 * §3.11.1 laesst die Kuratierung mehr zu, verbindlich bleibt sie mit 409
 * {@code NOMINATION_ALREADY_DECIDED} beziehungsweise 403 die Grenze nach
 * unten. Die Oberflaeche kennt ohnehin nur den Stand des letzten
 * Ladevorgangs.
 *
 * @param isOwn stammt der Vorschlag von der angemeldeten Person?
 */
export function nominationWithdrawable(
  status: NominationStatus,
  isOwn: boolean
): boolean {
  return isOwn && status === "PENDING"
}
