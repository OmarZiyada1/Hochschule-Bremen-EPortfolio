import { describe, expect, it } from "vitest"

import type { NominationStatus } from "@/api/types"
import {
  NOMINATION_STATUSES,
  nominationWithdrawable,
} from "@/features/reviews/nominations"

/**
 * §3.11.1 in einer reinen Funktion (Contract v70, KAN-37): wer darf einen
 * Vorschlag in welchem Stand zurueckziehen. Verbindlich bleibt der Server;
 * geprueft wird hier, dass die Oberflaeche dieselbe Grenze zieht und die
 * Handlung nicht dort anbietet, wo sie in einem 409 endete.
 */
describe("nominationWithdrawable", () => {
  it("laesst einen offenen Vorschlag in beiden Rollen zurueckziehen", () => {
    expect(nominationWithdrawable("PENDING", false)).toBe(true)
    expect(nominationWithdrawable("PENDING", true)).toBe(true)
  })

  it("laesst einen angenommenen Vorschlag allein der Administration", () => {
    expect(nominationWithdrawable("ACCEPTED", false)).toBe(false)
    expect(nominationWithdrawable("ACCEPTED", true)).toBe(true)
  })

  it("sperrt abgelehnte und bereits zurueckgezogene Vorschlaege ganz", () => {
    for (const status of ["REJECTED", "WITHDRAWN"] as NominationStatus[]) {
      expect(nominationWithdrawable(status, false)).toBe(false)
      expect(nominationWithdrawable(status, true)).toBe(false)
    }
  })

  it("fuehrt die vier Staende aus §2.8 in Anzeigereihenfolge", () => {
    expect(NOMINATION_STATUSES).toEqual([
      "PENDING",
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ])
  })
})
