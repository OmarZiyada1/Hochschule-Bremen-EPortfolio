import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { BreadcrumbProvider } from "@/routes/AppBreadcrumb"
import { useBreadcrumbTitle } from "@/routes/useBreadcrumb"
import { renderWithProviders } from "@/tests/render"

/** Eine Seite, die ihren Namen an das Band im Rahmen meldet. */
function PageWithTitle({ title }: { title?: string }) {
  useBreadcrumbTitle(title)
  return <p>Inhalt</p>
}

function renderAt(route: string, title?: string) {
  return renderWithProviders(
    <BreadcrumbProvider>
      <PageWithTitle title={title} />
    </BreadcrumbProvider>,
    route
  )
}

function path() {
  return screen.getByRole("navigation", {
    name: i18n.t("common.breadcrumb.label"),
  })
}

/**
 * Das Brotkrumenband steht seit KAN-80 im Anwendungsrahmen und leitet sich
 * aus der Route ab. Geprueft wird hier das Zusammenspiel aus Baum, Herkunft,
 * Seitenname und Kuerzung; der Baum selbst liegt in breadcrumbs.test.ts.
 */
describe("Brotkrumenband im Anwendungsrahmen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("steht auf jeder Seite mit Kopfleiste, auch in der Administration", () => {
    renderAt("/administration/users")

    expect(
      within(path()).getByRole("link", { name: "Administration" })
    ).toHaveAttribute("href", "/administration")
    expect(within(path()).getByText("Nutzer:innen")).toBeVisible()
  })

  /* Ein Pfad mit einer einzigen Ebene sagt nichts, was die markierte
     Hauptnavigation nicht schon sagt. */
  it("entfaellt auf der Startseite", () => {
    renderAt("/")

    expect(
      screen.queryByRole("navigation", {
        name: i18n.t("common.breadcrumb.label"),
      })
    ).not.toBeInTheDocument()
  })

  it("traegt den Namen der Seite als letzte Ebene", () => {
    renderAt("/projects/p-1", "Campus-Garten")

    expect(within(path()).getByText("Campus-Garten")).toBeVisible()
    expect(
      within(path()).getByRole("link", { name: "Projekte" })
    ).toHaveAttribute("href", "/projects")
  })

  /*
   * Punkt 2 aus KAN-80: ein langer Titel zwang das Band in die zweite Zeile.
   * Sichtbar bleiben zwanzig Zeichen, vorgelesen wird der ganze Titel.
   */
  it("kuerzt einen langen Titel und behaelt ihn als zugaenglichen Namen", () => {
    const long = "Nachhaltige Mobilitaetskonzepte fuer die Innenstadt"
    renderAt("/projects/p-1", long)

    expect(within(path()).getByText("Nachhaltige Mobilita…")).toBeVisible()
    expect(within(path()).getByLabelText(long)).toBeInTheDocument()
  })

  /*
   * Punkt 10: Wer aus der Projektverwaltung kommt, sieht den Weg dorthin und
   * nicht den Standardweg ueber die Bibliothek.
   */
  it("folgt der Herkunft aus dem Router-State", () => {
    renderWithProviders(
      <BreadcrumbProvider>
        <PageWithTitle title="Campus-Garten" />
      </BreadcrumbProvider>,
      {
        pathname: "/projects/p-1",
        state: { breadcrumbFrom: "/administration/projects" },
      }
    )

    expect(
      within(path()).getByRole("link", { name: "Administration" })
    ).toBeInTheDocument()
    expect(
      within(path()).getByRole("link", { name: "Projekte" })
    ).toHaveAttribute("href", "/administration/projects")
  })

  it("zeigt auf dem Einreichweg den Editor als Station davor", () => {
    renderWithProviders(
      <BreadcrumbProvider>
        <PageWithTitle title="Einreichen: Pflichtangaben" />
      </BreadcrumbProvider>,
      "/projects/p-1/metadata?submit=1"
    )

    /* Ohne Herkunft ist es der Weg zum Bearbeiten: ueber „Mein Portfolio".
       Der Editor kommt als Station dazu, wenn er die Herkunft mitgibt; das
       prueft breadcrumbs.test.ts an der reinen Funktion. Die Beschriftung
       bleibt ungekuerzt: sie ist ein Schritt und kein Name. */
    expect(
      within(path()).getByRole("link", { name: "Mein Portfolio" })
    ).toHaveAttribute("href", "/my-portfolio")
    expect(within(path()).getByText("Einreichen: Pflichtangaben")).toBeVisible()
  })
})
