import { screen, within } from "@testing-library/react"
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

  it("zentriert den Trennstrich, statt ihn an den oberen Rand zu haengen", () => {
    const { container } = renderWithProviders(<NavBar links={publicLinks} />)

    /* Die Primitive traegt data-vertical:self-stretch, und stretch verhaelt
       sich wie flex-start, sobald das Element eine feste Hoehe hat. Mit der
       h-5 aus dem Template (Figma fuehrt den Strich mit 20px mittig in einer
       28px hohen Zeile) sass er dadurch sichtbar zu hoch. Geprueft wird die
       Klasse und nicht die Lage: jsdom rechnet kein Layout, und ohne diesen
       Test faellt ein Rueckfall weder im Typecheck noch im Lint auf. */
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).not.toBeNull()
    expect(separator!.className).toContain("self-center")
    expect(separator!.className).not.toContain("self-stretch")
  })

  it("fuehrt im Menue auch die Nutzerpunkte, die Person und das Abmelden", async () => {
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

    await user.click(screen.getByRole("button", { name: "Menü öffnen" }))
    const sheet = within(await screen.findByRole("dialog"))

    /* Auf schmalen Bildschirmen gibt es nur dieses eine Menue, also traegt
       es beides: die Leisteneintraege und die Punkte, die oben im
       Nutzermenue liegen. */
    expect(sheet.getByRole("link", { name: "Startseite" })).toBeInTheDocument()
    expect(sheet.getByRole("link", { name: "Neues Projekt" })).toHaveAttribute(
      "href",
      "/projects/new"
    )
    /* "Mein Portfolio" steht in beiden Listen und darf trotzdem nur einmal
       erscheinen. */
    expect(sheet.getAllByRole("link", { name: "Mein Portfolio" })).toHaveLength(
      1
    )
    expect(sheet.getByText("Mira Beispiel")).toBeInTheDocument()
    expect(sheet.getByText("Studierende:r")).toBeInTheDocument()

    await user.click(sheet.getByRole("button", { name: "Abmelden" }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it("laesst Sprache und Modus ausserhalb des Menues stehen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavBar links={publicLinks} />)

    /* Beide Umschalter wirken sofort und sind keine Navigationsziele: sie
       stehen in jeder Breite an derselben Stelle und genau einmal, sonst
       kostete ein Moduswechsel Menue oeffnen, umschalten, schliessen. */
    expect(
      screen.getAllByRole("button", { name: "Auf Englisch umschalten" })
    ).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Menü öffnen" }))
    const sheet = within(await screen.findByRole("dialog"))

    expect(
      sheet.queryByRole("button", { name: "Auf Englisch umschalten" })
    ).not.toBeInTheDocument()
    expect(
      sheet.queryByRole("button", { name: "Dunklen Modus einschalten" })
    ).not.toBeInTheDocument()
    /* Ohne Anmeldung fuehrt das Menue den Weg zur Login-Seite. */
    expect(sheet.getByRole("link", { name: "Anmelden" })).toHaveAttribute(
      "href",
      "/login"
    )
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
