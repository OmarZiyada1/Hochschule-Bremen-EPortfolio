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
  it("laesst einen eigenen offenen Vorschlag in beiden Rollen zurueckziehen", () => {
    expect(nominationWithdrawable("PENDING", false, true)).toBe(true)
    expect(nominationWithdrawable("PENDING", true, true)).toBe(true)
  })

  it("laesst einen eigenen angenommenen Vorschlag allein der Administration", () => {
    expect(nominationWithdrawable("ACCEPTED", false, true)).toBe(false)
    expect(nominationWithdrawable("ACCEPTED", true, true)).toBe(true)
  })

  it("sperrt abgelehnte und bereits zurueckgezogene Vorschlaege ganz", () => {
    for (const status of ["REJECTED", "WITHDRAWN"] as NominationStatus[]) {
      expect(nominationWithdrawable(status, false, true)).toBe(false)
      expect(nominationWithdrawable(status, true, true)).toBe(false)
    }
  })

  /*
   * Nacharbeit an KAN-87: Die Top-10-Verwaltung zeigt alle Vorschlaege
   * nebeneinander, nicht nur eigene. Der Server liesse die Administration
   * jeden zurueckziehen (§3.11.1); die Oberflaeche bietet es bewusst nicht
   * an, weil ein fremder Vorschlag abgelehnt und nicht zurueckgezogen wird.
   */
  it("sperrt fremde Vorschlaege in jedem Stand und jeder Rolle", () => {
    for (const status of NOMINATION_STATUSES) {
      expect(nominationWithdrawable(status, false, false)).toBe(false)
      expect(nominationWithdrawable(status, true, false)).toBe(false)
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
