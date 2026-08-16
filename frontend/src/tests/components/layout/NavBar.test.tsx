import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

import { NavBar, type NavBarLink } from "@/components/layout/NavBar"

/* Die Eintraege entscheidet seit KAN-7 der Anwendungsrahmen und gibt sie
   als Props herein; die Tests stellen die Ebenen deshalb selbst nach. */
const publicLinks: NavBarLink[] = [
  { key: "home", href: "/" },
  { key: "projects", href: "/projects" },
]

const studentLinks: NavBarLink[] = [
  ...publicLinks,
  { key: "myPortfolio", href: "/my-portfolio" },
]

const studentMenu: NavBarLink[] = [
  { key: "myPortfolio", href: "/my-portfolio" },
  { key: "newProject", href: "/projects/new" },
]

describe("NavBar", () => {
  /* Die i18n-Instanz ist ein Modul-Singleton; der Sprachtest unten wuerde
     sonst alle nachfolgenden Faelle auf Englisch stellen. */
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt nicht angemeldet die Eintraege und allein die Anmeldung", () => {
    renderWithProviders(<NavBar links={publicLinks} />)

    expect(
      screen.getByRole("navigation", { name: "Hauptnavigation" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Startseite" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Projekte" })).toBeInTheDocument()
    expect(screen.queryByText("Mein Portfolio")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Anmelden" })).toHaveAttribute(
      "href",
      "/login"
    )
    /* Nach Template gibt es keinen eigenen Registrieren-Button mehr; der
       Weg zur Registrierung fuehrt ueber die Login-Seite (Review KAN-8). */
    expect(
      screen.queryByRole("link", { name: "Registrieren" })
    ).not.toBeInTheDocument()
  })

  it("nennt die Marke einmal, obwohl sie zweizeilig steht", () => {
    renderWithProviders(<NavBar links={publicLinks} />)

    /* Sichtbar zwei Zeilen, vorgelesen der Projektname: sonst hoerte man
       "Hochschule Bremen E-Portfolio" als zwei zusammenhanglose Teile. */
    expect(
      screen.getByRole("link", { name: "E-Portfolio Hochschule Bremen" })
    ).toHaveAttribute("href", "/")
  })

  it("markiert den aktiven Eintrag nicht nur mit dem Unterstrich", () => {
    renderWithProviders(<NavBar links={publicLinks} activeHref="/projects" />)

    expect(screen.getByRole("link", { name: "Projekte" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      screen.getByRole("link", { name: "Startseite" })
    ).not.toHaveAttribute("aria-current")
  })

  it("zeigt angemeldet die Eintraege und das Nutzermenue mit Rolle und Abmelden", async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    renderWithProviders(
      <NavBar
        user={{ firstName: "Mira", lastName: "Beispiel" }}
        role="STUDENT"
        links={studentLinks}
        menuItems={studentMenu}
        onLogout={onLogout}
      />
    )

    expect(
      screen.getByRole("link", { name: "Mein Portfolio" })
    ).toBeInTheDocument()
    /* "Neues Projekt" ist nach Template kein Leisteneintrag mehr, sondern
       liegt im Nutzermenue. */
    expect(
      screen.queryByRole("link", { name: "Neues Projekt" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Anmelden" })
    ).not.toBeInTheDocument()

    /* Der zugaengliche Name ist der Name der Person, nicht mehr eine
       allgemeine Beschriftung: er steht sichtbar in der Schaltflaeche. */
    const trigger = screen.getByRole("button", { name: /Mira Beispiel/ })
    expect(trigger).toHaveTextContent("MB")

    await user.click(trigger)
    /* Das Menue traegt die Rollenbeschriftung aus dem Template und die
       rollenabhaengigen Eintraege; "Profil" gibt es nicht mehr, das
       Portfolio uebernimmt diese Aufgabe. */
    expect(await screen.findByText("Studierende:r")).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Neues Projekt" })
    ).toHaveAttribute("href", "/projects/new")
    expect(
      screen.getByRole("menuitem", { name: "Mein Portfolio" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Profil")).not.toBeInTheDocument()

    await user.click(screen.getByText("Abmelden"))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it("bietet den Sprachwechsel mit dem Ziel als Beschriftung an", async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavBar links={publicLinks} />)

    const toggle = screen.getAllByRole("button", {
      name: "Auf Englisch umschalten",
    })[0]
    await user.click(toggle)

    expect(
      await screen.findByRole("button", { name: "Switch to German" })
    ).toBeInTheDocument()
  })

  it("traegt den Moduswechsel in der Leiste", async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavBar links={publicLinks} />)

    await user.click(
      screen.getByRole("button", { name: "Dunklen Modus einschalten" })
    )

    expect(document.documentElement).toHaveClass("dark")
    expect(
      screen.getByRole("button", { name: "Hellen Modus einschalten" })
    ).toBeInTheDocument()
  })
})
