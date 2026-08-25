import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  CHART_COLOR_COUNT,
  CHART_MUTED_COLOR,
  chartColor,
} from "@/lib/chartColors"

const tokensCss = readFileSync(
  join(import.meta.dirname, "..", "..", "styles", "tokens", "tokens.css"),
  "utf8"
)

/**
 * Die Farbvergabe der Diagramme (KAN-80).
 */
describe("chartColor", () => {
  it("vergibt nach Position und beginnt nach dem letzten Eintrag von vorn", () => {
    expect(chartColor(0)).toBe("var(--chart-1)")
    expect(chartColor(1)).toBe("var(--chart-2)")
    expect(chartColor(CHART_COLOR_COUNT - 1)).toBe(
      `var(--chart-${CHART_COLOR_COUNT})`
    )
    expect(chartColor(CHART_COLOR_COUNT)).toBe("var(--chart-1)")
  })

  /*
   * Der Index kommt aus einer Schleife ueber Stammdaten; ein negativer Wert
   * waere ein Fehler, aber eine Farbe wie "chart-0" oder "chart--3" gaebe es
   * nicht und das Segment bliebe ungefaerbt. Der Rest wird deshalb zweimal
   * genommen.
   */
  it("bleibt auch bei einem negativen Index in der Palette", () => {
    expect(chartColor(-1)).toBe(`var(--chart-${CHART_COLOR_COUNT})`)
  })

  /*
   * Der haeufigste Fehlermodus dieser Schicht: eine Variable, die es im CSS
   * gar nicht gibt. Das faellt weder dem Typecheck noch dem Linter auf, das
   * Segment ist einfach farblos (derselbe Befund wie bei --radius in
   * input-group.tsx, Review zu KAN-29).
   */
  it("nennt nur Variablen, die tokens.css auch definiert", () => {
    for (let index = 0; index < CHART_COLOR_COUNT; index++) {
      const name = chartColor(index).slice("var(".length, -1)
      expect(tokensCss, `${name} fehlt in tokens.css`).toContain(`${name}:`)
    }
    const muted = CHART_MUTED_COLOR.slice("var(".length, -1)
    expect(tokensCss).toContain(`${muted}:`)
  })

  it("laesst keine zwei Eintraege auf dieselbe Farbe zeigen", () => {
    const used = new Set<string>()
    for (let index = 0; index < CHART_COLOR_COUNT; index++) {
      used.add(chartColor(index))
    }
    expect(used.size).toBe(CHART_COLOR_COUNT)
  })
})
