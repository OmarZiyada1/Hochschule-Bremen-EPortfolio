import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { renderWithProviders } from "@/test/render"

import { LanguageToggle } from "./LanguageToggle"

describe("LanguageToggle", () => {
  /* Die i18n-Instanz ist ein Modul-Singleton: ohne Ruecksetzen startet der
     zweite Test in der Sprache, in die der erste umgeschaltet hat. */
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("nennt das Ziel des Klicks und schaltet um", async () => {
    const user = userEvent.setup()
    renderWithProviders(<LanguageToggle />)

    const toggle = screen.getByRole("button", {
      name: "Auf Englisch umschalten",
    })
    await user.click(toggle)

    expect(
      await screen.findByRole("button", { name: "Switch to German" })
    ).toBeInTheDocument()
  })

  it("kennzeichnet das Kuerzel mit seiner Sprache", async () => {
    const user = userEvent.setup()
    renderWithProviders(<LanguageToggle />)

    /* Ohne lang liest eine deutsche Stimme "en" als deutsches Wort vor
       (SC 3.1.2). */
    expect(screen.getByText("en")).toHaveAttribute("lang", "en")

    await user.click(screen.getByRole("button"))
    expect(await screen.findByText("de")).toHaveAttribute("lang", "de")
  })
})
