import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { ClapIcon } from "@/components/common/ClapIcon"

/*
 * Das Symbol traegt weder Rolle noch Namen (aria-hidden), es ist also ueber
 * keine der Rollen- oder Textabfragen zu erreichen. Die Marke data-clap ist
 * der einzige Weg dorthin, und genau die haelt auch die Animation im
 * ReactionPanel fest.
 */
function clapIcon(container: HTMLElement): HTMLElement {
  const icon = container.querySelector<HTMLElement>('[data-clap="icon"]')
  if (icon === null) {
    throw new Error('Kein Element mit data-clap="icon" im Baum')
  }
  return icon
}

/*
 * Der Dateiname der Maske ist ein Bauartefakt: Vite liefert beide Grafiken
 * mit einem Hash aus, und im Testlauf steht dort wieder ein anderer Pfad.
 * Geprueft wird deshalb, DASS eine Quelle gesetzt ist und dass die beiden
 * Zustaende verschiedene benutzen, nie welche.
 */
function maskSource(icon: HTMLElement): string {
  return icon.style.getPropertyValue("mask-image")
}

describe("ClapIcon", () => {
  it("zeigt die Grafik als Maske, nicht als Bild", () => {
    /* Als <img> traege die Grafik ihre Farbe im Bild: reines Schwarz, im
       Dunkelmodus auf dunklem Grund unsichtbar. Die Faerbung haengt daran,
       dass die Form als Maske kommt und die Klasse .clap-icon darunter
       currentColor legt. Faellt eines von beidem weg, verschwindet das
       Symbol, ohne dass sonst ein Test rot wird. */
    const { container } = renderWithProviders(<ClapIcon />)
    const icon = clapIcon(container)

    expect(icon.tagName).toBe("SPAN")
    expect(icon).toHaveClass("clap-icon")
    expect(maskSource(icon)).toMatch(/^url\(.+\)$/)
  })

  it("unterscheidet den gefuellten Zustand von der Ruhe", () => {
    /* Die beiden Zustaende sind zwei Dateien und nicht eine Datei mit einer
       CSS-Fuellung: Der aktive Zustand darf nicht allein an der Farbe
       haengen (SC 1.4.1). */
    const ruhe = renderWithProviders(<ClapIcon />)
    const gefuellt = renderWithProviders(<ClapIcon filled />)

    const quelleRuhe = maskSource(clapIcon(ruhe.container))
    const quelleGefuellt = maskSource(clapIcon(gefuellt.container))

    expect(quelleRuhe).not.toBe("")
    expect(quelleGefuellt).not.toBe("")
    expect(quelleGefuellt).not.toBe(quelleRuhe)
  })

  it("bleibt vor dem Screenreader verborgen", () => {
    /* Den Namen traegt die Schaltflaeche daneben ("128 Reaktionen"); ein
       zweiter Name hier wuerde doppelt vorgelesen. */
    const { container } = renderWithProviders(<ClapIcon />)

    expect(clapIcon(container)).toHaveAttribute("aria-hidden", "true")
  })

  it("laesst die Groesse von aussen setzen", () => {
    /* Die Vorgabe size-4 ersetzte bis KAN-83 die Regel
       [&_svg:not([class*='size-'])]:size-4 aus button.tsx, die auf ein span
       nicht mehr greift. Sie darf die Angabe des Aufrufs nicht ueberstimmen:
       die Seitenleiste zeigt size-5, die Kachel size-3.5. */
    const { container } = renderWithProviders(<ClapIcon className="size-5" />)
    const icon = clapIcon(container)

    expect(icon).toHaveClass("size-5")
    expect(icon).not.toHaveClass("size-4")
  })

  it("bringt eine Groesse mit, wenn der Aufruf keine nennt", () => {
    const { container } = renderWithProviders(<ClapIcon />)

    expect(clapIcon(container)).toHaveClass("size-4")
  })
})
