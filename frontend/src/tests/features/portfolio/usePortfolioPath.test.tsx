import { describe, expect, it } from "vitest"

import { usePortfolioPath } from "@/features/portfolio/hooks/usePortfolioPath"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/** Die ID, die signInAs der Sitzung gibt. */
const OWN_USER_ID = "00000000-0000-0000-0000-000000000001"

/**
 * Der eigene Name fuehrt ins eigene Portfolio und nicht in die oeffentliche
 * Fremdsicht (KAN-83). Dort fehlen die eigenen Entwuerfe, die Kachelaktionen
 * und der Weg in die Profildaten.
 *
 * <p>Gepruft wird ueber eine Sondierungskomponente statt ueber
 * {@code renderHook}: der Hook liest den Auth-Kontext, und den bringt
 * {@code renderWithProviders} mit.
 */
function pathFor(userId: string): string | undefined {
  let result: string | undefined
  function Probe() {
    result = usePortfolioPath()(userId)
    return null
  }
  renderWithProviders(<Probe />)
  return result
}

describe("usePortfolioPath", () => {
  it("fuehrt bei der eigenen ID nach /my-portfolio", () => {
    signInAs("STUDENT")

    expect(pathFor(OWN_USER_ID)).toBe("/my-portfolio")
  })

  it("fuehrt bei einer fremden ID in die oeffentliche Ansicht", () => {
    signInAs("STUDENT")

    expect(pathFor("00000000-0000-0000-0000-0000000000ff")).toBe(
      "/portfolios/00000000-0000-0000-0000-0000000000ff"
    )
  })

  it("fuehrt ohne Anmeldung immer in die oeffentliche Ansicht", () => {
    /* Ohne Sitzung gibt es keinen eigenen Bereich, auf den sich umleiten
       liesse; die Fremdsicht ist dann die richtige Auskunft. */
    expect(pathFor(OWN_USER_ID)).toBe(`/portfolios/${OWN_USER_ID}`)
  })
})
