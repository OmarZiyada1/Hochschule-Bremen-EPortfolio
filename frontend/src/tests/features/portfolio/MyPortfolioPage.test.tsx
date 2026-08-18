import { HttpResponse, http } from "msw"
import { screen, waitFor, within } from "@testing-library/react"
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
  semester: {
    id: "5e000000-0000-4000-8000-000000000001",
    name: "WiSe 2025/26",
  },
}

const PUBLISHED_PROJECT = {
  id: "11111111-0000-4000-8000-000000000002",
  title: "Voice2Text HSB",
  summary: "Whisper-basierte Vorlesungstranskription.",
  status: "PUBLISHED",
  author: { firstName: "Mira", lastName: "Beispiel" },
  semester: { id: "5e000000-0000-4000-8000-000000000002", name: "SoSe 2025" },
  reactionCount: 58,
}

const SUBMITTED_PROJECT = {
  id: "11111111-0000-4000-8000-000000000003",
  title: "GreenLab",
  summary: "Sensor-Plattform fuer HSB-Labore.",
  status: "SUBMITTED",
  author: { firstName: "Mira", lastName: "Beispiel" },
  semester: {
    id: "5e000000-0000-4000-8000-000000000001",
    name: "WiSe 2025/26",
  },
}

const REVISION_PROJECT = {
  id: "11111111-0000-4000-8000-000000000004",
  title: "OpenSchedule",
  summary: "Open-Source-Stundenplaner.",
  status: "REVISION",
  author: { firstName: "Mira", lastName: "Beispiel" },
  semester: { id: "5e000000-0000-4000-8000-000000000002", name: "SoSe 2025" },
}

const APPROVED_PROJECT = {
  id: "11111111-0000-4000-8000-000000000005",
  title: "FlowNet",
  summary: "Stream-Processing-Framework.",
  status: "APPROVED",
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
      await screen.findByRole("heading", {
        level: 2,
        name: "Noch kein Projekt",
      })
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

  it("traegt je Status genau die vorgesehene Kartenhandlung (KAN-69)", async () => {
    /* DRAFT und REVISION: Bearbeiten (DRAFT zusaetzlich Loeschen);
       SUBMITTED: Zurueckziehen; APPROVED: nichts; PUBLISHED: nichts, aber
       die Reaktionszahl. */
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(
          projectsPage([
            DRAFT_PROJECT,
            SUBMITTED_PROJECT,
            REVISION_PROJECT,
            APPROVED_PROJECT,
            PUBLISHED_PROJECT,
          ])
        )
      )
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")
    await screen.findByRole("heading", { level: 2, name: "FlowNet" })

    /* Base UI rendert das Navigationsziel als a mit role="button". */
    const editButtons = screen.getAllByRole("button", { name: /^Bearbeiten:/ })
    expect(editButtons).toHaveLength(2)
    expect(editButtons[0]).toHaveAttribute(
      "href",
      `/projects/${DRAFT_PROJECT.id}/editor`
    )
    expect(editButtons[1]).toHaveAttribute(
      "href",
      `/projects/${REVISION_PROJECT.id}/editor`
    )
    expect(screen.getAllByRole("button", { name: /^Löschen:/ })).toHaveLength(1)
    expect(
      screen.getAllByRole("button", { name: /^Zurückziehen:/ })
    ).toHaveLength(1)
    /* Die veroeffentlichte Karte behaelt ihre Reaktionszahl. */
    expect(screen.getByText("58 Reaktionen")).toBeInTheDocument()
  })

  it("zeigt beim Zeigen auf einen Symbolknopf seine Beschriftung", async () => {
    /* Der Tooltip ist die sichtbare Ergaenzung fuer die Maus; der
       zugaengliche Name bleibt der sr-only-Text und wird durch ihn nicht
       ersetzt (Skill frontend-design, Abschnitt 4). */
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(projectsPage([SUBMITTED_PROJECT]))
      )
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")
    await screen.findByRole("heading", { level: 2, name: "GreenLab" })

    const button = screen.getByRole("button", { name: /^Zurückziehen:/ })
    await userEvent.hover(button)

    /* Die Primitive rendert die Flaeche ohne eigene Rolle (nachgemessen
       unter jsdom), gesucht wird deshalb der Text. Er steht exakt so da;
       der Name des Knopfes traegt zusaetzlich den Projekttitel. */
    expect(
      await screen.findByText(
        "Zurückziehen",
        { exact: true },
        { timeout: 3000 }
      )
    ).toBeVisible()
    /* Der Name kommt weiterhin aus dem sr-only-Text, nicht aus dem
       Tooltip: sonst fiele der Projekttitel aus der Ansage. */
    expect(button).toHaveAccessibleName(
      `Zurückziehen: ${SUBMITTED_PROJECT.title}`
    )
  })

  it("zieht eine Einreichung zurueck und zeigt sie danach als Entwurf", async () => {
    /* POST /projects/{id}/withdraw (§4.1, seit Contract v50); die Liste
       wird danach neu geladen. */
    let withdrawn = false
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(
          projectsPage([
            withdrawn
              ? { ...SUBMITTED_PROJECT, status: "DRAFT" }
              : SUBMITTED_PROJECT,
          ])
        )
      ),
      http.post(`*/api/projects/${SUBMITTED_PROJECT.id}/withdraw`, () => {
        withdrawn = true
        return HttpResponse.json({
          ...SUBMITTED_PROJECT,
          status: "DRAFT",
        })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")
    await screen.findByRole("heading", { level: 2, name: "GreenLab" })

    await userEvent.click(
      screen.getByRole("button", { name: /^Zurückziehen:/ })
    )

    /* Erst der Dialog, noch kein Request: der Statuswechsel ist fuer die
       Redaktion sichtbar (Skill frontend-design, Abschnitt 5). */
    expect(
      await screen.findByRole("heading", { name: "Projekt zurückziehen" })
    ).toBeVisible()
    expect(withdrawn).toBe(false)

    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Zurückziehen",
      })
    )

    /* Der Beleg ist die Kartenhandlung des Entwurfs, nicht das Wort
       "Entwurf": das traegt auch der Filterknopf daneben. */
    expect(
      await screen.findByRole("button", { name: /^Bearbeiten:/ })
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: /^Zurückziehen:/ })
    ).not.toBeInTheDocument()
  })

  it("loescht einen Entwurf erst nach der Bestaetigung im Dialog", async () => {
    let deleteCalls = 0
    let deleted = false
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(projectsPage(deleted ? [] : [DRAFT_PROJECT]))
      ),
      http.delete(`*/api/projects/${DRAFT_PROJECT.id}`, () => {
        deleteCalls += 1
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")
    await screen.findByRole("heading", { level: 2, name: "EdgeML Toolkit" })

    await userEvent.click(screen.getByRole("button", { name: /^Löschen:/ }))

    /* Erst der Dialog, noch kein Request: die Aktion ist endgueltig. */
    expect(
      await screen.findByRole("heading", { name: "Projekt löschen?" })
    ).toBeVisible()
    expect(deleteCalls).toBe(0)

    await userEvent.click(
      screen.getByRole("button", { name: "Endgültig löschen" })
    )

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Noch kein Projekt",
      })
    ).toBeVisible()
    expect(deleteCalls).toBe(1)
  })

  it("meldet einen 409 an der Kachel, wenn die Redaktion schneller war", async () => {
    /* Der fachlich erwartete Fehlschlag des Zurueckziehens (§4.1): das
       Projekt steht nicht mehr in SUBMITTED. */
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(projectsPage([SUBMITTED_PROJECT]))
      ),
      http.post(`*/api/projects/${SUBMITTED_PROJECT.id}/withdraw`, () =>
        apiErrorResponse(
          409,
          "PROJECT_STATUS_TRANSITION_INVALID",
          `/api/projects/${SUBMITTED_PROJECT.id}/withdraw`
        )
      )
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")
    await screen.findByRole("heading", { level: 2, name: "GreenLab" })

    await userEvent.click(
      screen.getByRole("button", { name: /^Zurückziehen:/ })
    )
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Zurückziehen",
      })
    )

    expect(
      await screen.findByText("Dieser Statuswechsel ist nicht zulässig.")
    ).toBeVisible()
    /* Der Dialog schliesst auch im Fehlerfall, sonst laege die Meldung
       unsichtbar dahinter (Skill frontend-design, Abschnitt 5). */
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("loescht nicht, wenn der Bestaetigungsdialog abgebrochen wird", async () => {
    let deleteCalls = 0
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/projects", () =>
        HttpResponse.json(projectsPage([DRAFT_PROJECT]))
      ),
      http.delete(`*/api/projects/${DRAFT_PROJECT.id}`, () => {
        deleteCalls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")
    await screen.findByRole("heading", { level: 2, name: "EdgeML Toolkit" })

    await userEvent.click(screen.getByRole("button", { name: /^Löschen:/ }))
    await screen.findByRole("heading", { name: "Projekt löschen?" })
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Projekt löschen?" })
      ).not.toBeInTheDocument()
    )
    expect(deleteCalls).toBe(0)
    expect(
      screen.getByRole("heading", { level: 2, name: "EdgeML Toolkit" })
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
