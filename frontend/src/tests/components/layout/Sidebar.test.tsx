import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { Sidebar, SidebarItem } from "@/components/layout/Sidebar"

describe("Sidebar", () => {
  it("traegt einen eigenen Namen und listet ihre Eintraege", () => {
    renderWithProviders(
      <Sidebar label="Administrationsseite">
        <SidebarItem href="/admin" active>
          Dashboard
        </SidebarItem>
        <SidebarItem href="/admin/users">Nutzer:innen</SidebarItem>
      </Sidebar>
    )

    const nav = screen.getByRole("navigation", { name: "Administrationsseite" })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Nutzer:innen" })).toBeVisible()
  })

  it("markiert den aktiven Eintrag nicht nur farblich", () => {
    /* Ohne aria-current ist die Markierung fuer alle weg, die die Flaeche
       nicht sehen (SC 1.4.1). */
    renderWithProviders(
      <Sidebar label="Administrationsseite">
        <SidebarItem href="/admin" active>
          Dashboard
        </SidebarItem>
        <SidebarItem href="/admin/users">Nutzer:innen</SidebarItem>
      </Sidebar>
    )

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      screen.getByRole("link", { name: "Nutzer:innen" })
    ).not.toHaveAttribute("aria-current")
  })
})
