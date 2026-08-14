import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/test/render"

import { NavBar } from "./NavBar"

describe("NavBar", () => {
  it("zeigt nicht angemeldet die oeffentlichen Eintraege und die Anmeldung", () => {
    renderWithProviders(<NavBar />)

    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" })
    expect(nav).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Startseite" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Projektbibliothek" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Mein Portfolio")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Anmelden" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Nutzermenü" })
    ).not.toBeInTheDocument()
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

    const trigger = screen.getByRole("button", { name: "Nutzermenü" })
    expect(trigger).toHaveTextContent("MB")

    await user.click(trigger)
    expect(await screen.findByText("Mira Beispiel")).toBeInTheDocument()
    expect(screen.getByText("Profil")).toBeInTheDocument()

    await user.click(screen.getByText("Abmelden"))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
