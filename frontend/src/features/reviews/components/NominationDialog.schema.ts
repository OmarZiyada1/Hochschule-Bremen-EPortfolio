import { z } from "zod"

import type { NominationTier } from "@/api/types"

/**
 * Die drei Stufen aus §2.13 in der Reihenfolge des Entwurfs, mit dem
 * Platzbereich, den sie meinen.
 *
 * <p>Record ueber den Enum-Typ statt Array-Literal (Skill frontend-shadcn,
 * Abschnitt 6): eine vierte Stufe bricht den Typecheck, statt still aus dem
 * Dialog zu fehlen.
 *
 * <p><strong>Die Platzangabe ist Erlaeuterung.</strong> Sie bindet nichts:
 * ueber den Platz entscheidet die Administration beim Annehmen, und der
 * Server prueft nicht, ob er in den Bereich der Stufe faellt (§3.11.1
 * Regel 4).
 */
const TIER_ORDER: Record<NominationTier, number> = {
  TOP_1: 1,
  TOP_5: 2,
  TOP_10: 3,
}

export const NOMINATION_TIERS: readonly NominationTier[] = (
  Object.keys(TIER_ORDER) as NominationTier[]
).sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b])

/**
 * Eingaben des Nominierungsdialogs (Frontend-Regel 12, Skill
 * frontend-modul Abschnitt 3b).
 *
 * <p>Die Stufe ist Pflicht, wie serverseitig auch: ohne sie antwortet der
 * Server mit 400 {@code VALIDATION_FAILED}. Das Schema macht denselben
 * Fehler vor dem Absenden sichtbar und ersetzt die Serverpruefung nicht.
 * Der Fehlertext ist ein i18n-Schluessel, kein Literal.
 */
export const nominationSchema = z.object({
  proposedTier: z.enum(
    [...NOMINATION_TIERS] as [NominationTier, ...NominationTier[]],
    { message: "validation.nomination.tierRequired" }
  ),
})

export type NominationFormValues = z.infer<typeof nominationSchema>
