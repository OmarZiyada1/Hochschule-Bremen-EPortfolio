import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { CharacterCounter } from "./CharacterCounter"

/* max=100 ergibt eine Ansageschwelle von 10 Zeichen (ein Zehntel, mindestens
   fuenf); angesagt wird darunter in Schritten von fuenf. */
const text = (length: number) => "a".repeat(length)

describe("CharacterCounter", () => {
  it("zeigt die genaue Restanzahl immer an", () => {
    renderWithProviders(<CharacterCounter value={text(5)} max={100} />)

    expect(screen.getByText("Noch 95 Zeichen")).toBeVisible()
  })

  it("schweigt fern der Grenze, statt jedes Zeichen anzusagen", () => {
    renderWithProviders(<CharacterCounter value={text(5)} max={100} />)

    /* Die Live-Region ist da, sagt aber nichts: sonst bekaeme der Screenreader
       eine Ansage je Tastendruck und uebertoente die eigene Eingabe. */
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("meldet die Restanzahl an der Schwelle", () => {
    renderWithProviders(<CharacterCounter value={text(90)} max={100} />)

    expect(screen.getByRole("status")).toHaveTextContent("Noch 10 Zeichen")
  })

  it("schweigt zwischen zwei Schritten", () => {
    renderWithProviders(<CharacterCounter value={text(93)} max={100} />)

    expect(screen.getByText("Noch 7 Zeichen")).toBeVisible()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("meldet ueberzaehlige Zeichen sofort", () => {
    renderWithProviders(<CharacterCounter value={text(7)} max={5} />)

    /* Ueberschreitung ist ein Fehlerzustand und haengt an keiner Schwelle. */
    expect(screen.getByRole("status")).toHaveTextContent("2 Zeichen zu viel")
  })
})
