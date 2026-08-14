import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { CharacterCounter } from "./CharacterCounter"

describe("CharacterCounter", () => {
  it("meldet die Restanzahl ueber eine Live-Region", () => {
    renderWithProviders(<CharacterCounter value="Titel" max={100} />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Noch 95 Zeichen")
  })

  it("meldet ueberzaehlige Zeichen", () => {
    renderWithProviders(<CharacterCounter value="1234567" max={5} />)
    expect(screen.getByRole("status")).toHaveTextContent("2 Zeichen zu viel")
  })
})
