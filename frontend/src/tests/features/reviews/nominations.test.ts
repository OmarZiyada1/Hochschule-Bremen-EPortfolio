import { describe, expect, it } from "vitest"

import type { NominationStatus } from "@/api/types"
import {
  NOMINATION_STATUSES,
  nominationWithdrawable,
} from "@/features/reviews/nominations"

/**
 * §3.11.1 in einer reinen Funktion (Contract v70, KAN-37): wer darf einen
 * Vorschlag in welchem Stand zurueckziehen. Verbindlich bleibt der Server;
 * geprueft wird hier, dass die Oberflaeche die Handlung nicht dort anbietet,
 * wo sie in einem 409 oder 403 endete. Sie zieht die Grenze seit der
 * Nacharbeit an KAN-87 enger als der Server: nur der eigene und nur der
 * offene Vorschlag.
 */
describe("nominationWithdrawable", () => {
  it("laesst einen eigenen offenen Vorschlag zurueckziehen", () => {
    expect(nominationWithdrawable("PENDING", true)).toBe(true)
  })

  /*
   * Vorgabe zur Nacharbeit an KAN-87: entschieden ist entschieden. Bis dahin
   * durfte die Administration einen eigenen angenommenen Vorschlag
   * zurueckziehen und nahm das Projekt damit nebenbei von der oeffentlichen
   * Startseite; dafuer gibt es „Vom Platz nehmen" in der Platzliste. Die
   * Rolle spielt hier deshalb keine Rolle mehr, und der Parameter dafuer ist
   * weg.
   */
  it("sperrt jeden entschiedenen Vorschlag, auch den eigenen angenommenen", () => {
    for (const status of [
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ] as NominationStatus[]) {
      expect(nominationWithdrawable(status, true)).toBe(false)
    }
  })

  /*
   * Ein fremder Vorschlag wird abgelehnt und nicht zurueckgezogen; die
   * Top-10-Verwaltung bietet den Rueckzug seit der Nacharbeit ueberhaupt
   * nicht mehr an.
   */
  it("sperrt fremde Vorschlaege in jedem Stand", () => {
    for (const status of NOMINATION_STATUSES) {
      expect(nominationWithdrawable(status, false)).toBe(false)
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
