import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

import { NavBar } from "@/components/layout/NavBar"

describe("NavBar", () => {
  /* Die i18n-Instanz ist ein Modul-Singleton; der Sprachtest unten wuerde
     sonst alle nachfolgenden Faelle auf Englisch stellen. */
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt nicht angemeldet die oeffentlichen Eintraege und die Anmeldung", () => {
    renderWithProviders(<NavBar />)

    expect(
      screen.getByRole("navigation", { name: "Hauptnavigation" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Startseite" })).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Projektbibliothek" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Mein Portfolio")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Anmelden" })).toBeInTheDocument()
  })

  it("nennt die Marke einmal, obwohl sie zweizeilig steht", () => {
    renderWithProviders(<NavBar />)

    /* Sichtbar zwei Zeilen, vorgelesen der Projektname: sonst hoerte man
       "Hochschule Bremen E-Portfolio" als zwei zusammenhanglose Teile. */
    expect(
      screen.getByRole("link", { name: "E-Portfolio Hochschule Bremen" })
    ).toHaveAttribute("href", "/")
  })

  it("markiert den aktiven Eintrag nicht nur mit dem Unterstrich", () => {
    renderWithProviders(<NavBar activeHref="/projects" />)

    expect(
      screen.getByRole("link", { name: "Projektbibliothek" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      screen.getByRole("link", { name: "Startseite" })
    ).not.toHaveAttribute("aria-current")
  })

  it("zeigt angemeldet das Portfolio und das Nutzermenue mit Abmeldung", async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    renderWithProviders(
      <NavBar
        user={{ firstName: "Mira", lastName: "Beispiel" }}
        onLogout={onLogout}
      />
    )

    expect(
      screen.getByRole("link", { name: "Mein Portfolio" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Anmelden" })
    ).not.toBeInTheDocument()

    /* Der zugaengliche Name ist der Name der Person, nicht mehr eine
       allgemeine Beschriftung: er steht sichtbar in der Schaltflaeche. */
    const trigger = screen.getByRole("button", { name: /Mira Beispiel/ })
    expect(trigger).toHaveTextContent("MB")

    await user.click(trigger)
    expect(await screen.findByText("Profil")).toBeInTheDocument()

    await user.click(screen.getByText("Abmelden"))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it("bietet den Sprachwechsel mit dem Ziel als Beschriftung an", async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavBar />)

    const toggle = screen.getAllByRole("button", {
      name: "Auf Englisch umschalten",
    })[0]
    await user.click(toggle)

    expect(
      await screen.findByRole("button", { name: "Switch to German" })
    ).toBeInTheDocument()
  })
})
