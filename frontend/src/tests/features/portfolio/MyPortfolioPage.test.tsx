import { HttpResponse, http } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { apiErrorResponse, ownPortfolioHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/** Die ID, die signInAs der Sitzung gibt; zugleich der erwartete author. */
const OWN_USER_ID = "00000000-0000-0000-0000-000000000001"

function projectsPage(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 100,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

const DRAFT_PROJECT = {
  id: "11111111-0000-4000-8000-000000000001",
  title: "EdgeML Toolkit",
  summary: "Erste Konzeption eines TypeScript-Toolkits.",
  status: "DRAFT",
  author: { firstName: "Mira", lastName: "Beispiel" },
  semester: { id: "5e000000-0000-4000-8000-000000000001", name: "WiSe 2025/26" },
}

const PUBLISHED_PROJECT = {
  id: "11111111-0000-4000-8000-000000000002",
  title: "Voice2Text HSB",
  summary: "Whisper-basierte Vorlesungstranskription.",
  status: "PUBLISHED",
  author: { firstName: "Mira", lastName: "Beispiel" },
  semester: { id: "5e000000-0000-4000-8000-000000000002", name: "SoSe 2025" },
}

/**
 * "My Portfolio" (KAN-34): eigene Projekte mit Status, der Statusfilter in
 * der URL, die Profilkarte aus zwei Quellen und die Rollengrenze aus §5
 * (Fussnote 10), nach der ein Admin-Konto hier keine Projekte fuehrt.
 */
describe("MyPortfolioPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("fragt die eigenen Projekte ueber die eigene ID ab, nicht ueber author=me", async () => {
    /* §6.1: den Sonderwert "me" kennt nur editor; author verlangt die UUID.
       Die ID kommt aus dem Auth-Kontext. */
    let requestUrl: URL | null = null
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", ({ request }) => {
        requestUrl = new URL(request.url)
        return HttpResponse.json(projectsPage([DRAFT_PROJECT]))
      })
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    await screen.findByRole("heading", { level: 2, name: "EdgeML Toolkit" })
    expect(requestUrl!.searchParams.get("author")).toBe(OWN_USER_ID)
    expect(requestUrl!.searchParams.has("status")).toBe(false)
  })

  it("zeigt zu jedem eigenen Projekt seinen Status", async () => {
    /* Anders als in der Bibliothek stehen hier Entwurf und
       Veroeffentlichtes nebeneinander (Contract v42, §5 Fussnote 11). */
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(projectsPage([DRAFT_PROJECT, PUBLISHED_PROJECT]))
      )
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(await screen.findByText("Entwurf")).toBeVisible()
    expect(screen.getByText("Veröffentlicht")).toBeVisible()
  })

  it("legt den Statusfilter in die URL und in den Request", async () => {
    const requests: URL[] = []
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        return HttpResponse.json(
          projectsPage(
            url.searchParams.get("status") === "DRAFT"
              ? [DRAFT_PROJECT]
              : [DRAFT_PROJECT, PUBLISHED_PROJECT]
          )
        )
      })
    )
    signInAs("STUDENT")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )
    await screen.findByText("Veröffentlicht")

    await userEvent.click(screen.getByRole("button", { name: "Entwurf" }))

    /* Teilbar und reload-fest: die Auswahl steht in der URL, nicht in
       einem lokalen Zustand daneben. */
    await waitFor(() =>
      expect(screen.getByTestId("search")).toHaveTextContent("status=DRAFT")
    )
    await waitFor(() =>
      expect(
        requests.some((url) => url.searchParams.get("status") === "DRAFT")
      ).toBe(true)
    )
    /* Geprueft wird am Projekttitel, nicht am Wort "Veroeffentlicht": das
       traegt auch der Filterknopf daneben und waere kein Beleg. */
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 2, name: "Voice2Text HSB" })
      ).not.toBeInTheDocument()
    )
  })

  it("liest den Statusfilter aus einer aufgerufenen Adresse", async () => {
    let requestUrl: URL | null = null
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", ({ request }) => {
        requestUrl = new URL(request.url)
        return HttpResponse.json(projectsPage([PUBLISHED_PROJECT]))
      })
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio?status=PUBLISHED")

    await screen.findByRole("heading", { level: 2, name: "Voice2Text HSB" })
    expect(requestUrl!.searchParams.get("status")).toBe("PUBLISHED")
  })

  it("zeigt einem Admin-Konto weder Projektliste noch den Knopf Neues Projekt", async () => {
    /* §5, Fussnote 10 (serverseitig mit KAN-57): ADMIN legt keine eigenen
       Projekte an. Das Profil pflegt das Konto trotzdem (§3.2). */
    server.use(
      ownPortfolioHandler({ biography: "Verwaltet das Portal." }),
      http.get("*/api/projects", () => {
        throw new Error("Ein Admin-Konto fragt hier keine Projekte ab.")
      })
    )
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(await screen.findByText("Verwaltet das Portal.")).toBeVisible()
    /* Die Button-Primitive rendert ein Navigationsziel als a mit
       role="button" (Base UI, nativeButton={false}); abgefragt wird
       deshalb die Rolle button, wie schon in KAN-31. */
    expect(
      screen.queryByRole("button", { name: "Neues Projekt" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Entwurf" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Profil bearbeiten" })
    ).toBeVisible()
  })

  it("kommt mit einem Konto ohne Portfolio-Zeile ohne Fehler aus", async () => {
    /* §3.2.1: GET /portfolio/me antwortet dann 200 mit leeren Feldern. Die
       Karte zeigt Name und Adresse aus dem Auth-Kontext. */
    server.use(
      ownPortfolioHandler({}),
      http.get("*/api/projects", () => HttpResponse.json(projectsPage([])))
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(
      await screen.findByRole("heading", { level: 2, name: "Mira Beispiel" })
    ).toBeVisible()
    expect(screen.getByText("mira.beispiel@example.org")).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("zeigt den Leerzustand mit dem Weg zur Projektanlage", async () => {
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () => HttpResponse.json(projectsPage([])))
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(
      await screen.findByRole("heading", { level: 2, name: "Noch kein Projekt" })
    ).toBeVisible()
  })

  it("unterscheidet den leeren Filter vom leeren Portfolio", async () => {
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () => HttpResponse.json(projectsPage([])))
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio?status=REVISION")

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Kein Projekt in diesem Status",
      })
    ).toBeVisible()
  })

  it("macht eine Fehlerantwort der Liste sichtbar", async () => {
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/projects")
      )
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(
      await screen.findByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).toBeVisible()
  })

  it("fuehrt ohne Anmeldung sichtbar zum Login", async () => {
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
  })
})
