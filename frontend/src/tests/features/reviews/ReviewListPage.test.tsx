import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuthState } from "@/api/auth/authStore"
import { setAuthNavigate } from "@/api/auth/redirect"
import type { ProjectCardResponse } from "@/api/types"
import ReviewListPage from "@/features/reviews/ReviewListPage"
import i18n from "@/i18n"
import { nomination, person, projectCard, reference } from "@/tests/fixtures"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

function pageOf(
  content: ProjectCardResponse[],
  totalElements = content.length
) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / 20),
  }
}

/**
 * Die Anfragen, die die Seite beim Betreten stellt: die Liste, die vier
 * Kennzahlen, die eigenen Nominierungen, die Top-10 und die drei
 * Optionslisten. Sie stehen als eine Funktion beisammen, damit jeder Test
 * nur das ueberschreibt, worum es ihm geht.
 */
function baseHandlers(
  options: {
    projects?: ProjectCardResponse[]
    onProjectsRequest?: (url: URL) => void
  } = {}
) {
  const projects = options.projects ?? []
  return [
    currentUserHandler({ role: "EDITOR" }),
    http.get("*/api/projects", ({ request }) => {
      const url = new URL(request.url)
      options.onProjectsRequest?.(url)
      /* Die Kennzahlen fragen mit size=1 je Status; die Liste ohne. */
      if (url.searchParams.get("size") === "1") {
        return HttpResponse.json(pageOf([], 3))
      }
      return HttpResponse.json(pageOf(projects))
    }),
    http.get("*/api/top10-nominations", () => HttpResponse.json([])),
    http.get("*/api/top10", () => HttpResponse.json([])),
    http.get("*/api/study-programs", () => HttpResponse.json([])),
    http.get("*/api/semesters", () => HttpResponse.json([])),
    http.get("*/api/modules", () => HttpResponse.json([])),
  ]
}

const ASSIGNED = projectCard({
  id: "pr-1",
  title: "RoboNav",
  status: "SUBMITTED",
  author: person({ firstName: "Jan", lastName: "Schulz" }),
  studyProgram: reference({ id: "sp-1", name: "Mechatronik B. Eng." }),
  semester: reference({ id: "se-1", name: "WiSe 2024/25" }),
  module: reference({ id: "m-1", name: "Elektrotechnik" }),
})

/**
 * „Meine Reviews" (Ticket KAN-37): der Zuschnitt auf die eigenen
 * Zuweisungen, der Ansichtszustand in der Adresse, das Zeilenmenue samt
 * begruendeten Sperren und der Nominierungsdialog.
 */
describe("ReviewListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("EDITOR")
  })

  it("fragt ausschliesslich die eigenen Zuweisungen ab und zeigt sie", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        projects: [ASSIGNED],
        onProjectsRequest: (url) => requests.push(url),
      })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")

    expect(await screen.findByText("RoboNav")).toBeInTheDocument()
    /* Der Zuschnitt editor=me ist keine Einstellung, sondern die Ressource
       (§6.1); er steht an jeder Abfrage dieser Seite. */
    expect(requests.length).toBeGreaterThan(0)
    for (const url of requests) {
      expect(url.searchParams.get("editor")).toBe("me")
    }
  })

  it("zeigt Studiengang, Semester und Fach in der Zeile", async () => {
    server.use(...baseHandlers({ projects: [ASSIGNED] }))

    renderWithProviders(<ReviewListPage />, "/reviews")

    const row = (await screen.findByText("RoboNav")).closest("tr")
    expect(row).not.toBeNull()
    expect(within(row!).getByText("Jan Schulz")).toBeInTheDocument()
    expect(within(row!).getByText("Mechatronik B. Eng.")).toBeInTheDocument()
    expect(within(row!).getByText("WiSe 2024/25")).toBeInTheDocument()
    /* Die Spalte „Fach" ist der Grund, aus dem die Kachel seit Contract
       v68 module fuehrt. */
    expect(within(row!).getByText("Elektrotechnik")).toBeInTheDocument()
  })

  it("fuehrt einen 401 sichtbar zur Anmeldung statt in eine leere Liste", async () => {
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    server.use(
      currentUserHandler({ role: "EDITOR" }),
      http.get("*/api/projects", () =>
        apiErrorResponse(401, "NOT_AUTHENTICATED", "/api/projects")
      ),
      http.get("*/api/top10-nominations", () => HttpResponse.json([])),
      http.get("*/api/top10", () => HttpResponse.json([])),
      http.get("*/api/study-programs", () => HttpResponse.json([])),
      http.get("*/api/semesters", () => HttpResponse.json([])),
      http.get("*/api/modules", () => HttpResponse.json([]))
    )

    renderWithProviders(<ReviewListPage />, "/reviews")

    /* editor=me ohne gueltiges Token ergibt 401 und keine leere Liste
       (§5); die zentrale Reaktion verwirft die Sitzung und fuehrt zum
       Login (Skill frontend-api, Abschnitt 3). */
    await waitFor(() => expect(getAuthState().session).toBeNull())
    await waitFor(() => expect(navigate).toHaveBeenCalled())
  })

  it("uebernimmt Statusleiste und Suche in die Adresse und in den Request", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        projects: [ASSIGNED],
        onProjectsRequest: (url) => requests.push(url),
      })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("project.status.APPROVED") })
    )

    await waitFor(() =>
      expect(
        requests.some(
          (url) =>
            url.searchParams.get("status") === "APPROVED" &&
            url.searchParams.get("size") !== "1"
        )
      ).toBe(true)
    )
  })

  it("stellt den Ansichtszustand aus der Adresse wieder her", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        projects: [ASSIGNED],
        onProjectsRequest: (url) => requests.push(url),
      })
    )

    renderWithProviders(
      <ReviewListPage />,
      "/reviews?q=Robo&status=REVISION&semester=se-1"
    )

    await screen.findByText("RoboNav")
    /* Der Zustand steht in der Adresse und uebersteht damit einen
       Neuaufbau der Seite: der erste Request traegt ihn bereits. */
    await waitFor(() =>
      expect(
        requests.some(
          (url) =>
            url.searchParams.get("q") === "Robo" &&
            url.searchParams.get("status") === "REVISION" &&
            url.searchParams.get("semester") === "se-1" &&
            url.searchParams.get("size") !== "1"
        )
      ).toBe(true)
    )
  })

  it("sperrt die Nominierung begruendet, solange das Projekt nicht veroeffentlicht ist", async () => {
    server.use(...baseHandlers({ projects: [ASSIGNED] }))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )

    /* Gesperrt ueber aria-disabled statt disabled: nur so bleibt der
       Eintrag fokussierbar und der Grund fuer die Tastatur erreichbar. */
    const item = await screen.findByRole("menuitem", {
      name: i18n.t("review.list.row.nominate"),
    })
    expect(item).toHaveAttribute("aria-disabled", "true")

    /* Der Grund steht im Kurzhinweis, nicht nur im Ausgrauen (SC 3.3.2). */
    await userEvent.hover(item)
    expect(
      await screen.findByText(
        i18n.t("review.list.row.nominateBlocked.notPublished")
      )
    ).toBeInTheDocument()
  })

  it("sperrt die Nominierung begruendet bei einem Projekt aus der Top-10", async () => {
    const published = projectCard({ ...ASSIGNED, status: "PUBLISHED" })
    /* Die Ueberschreibung steht vor den Basis-Handlern: server.use nimmt
       den ersten passenden Handler der Liste. */
    server.use(
      http.get("*/api/top10", () =>
        HttpResponse.json([
          { position: 1, addedAt: "2026-01-01T10:00:00Z", project: published },
        ])
      ),
      ...baseHandlers({ projects: [published] })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )

    await userEvent.hover(
      await screen.findByRole("menuitem", {
        name: i18n.t("review.list.row.nominate"),
      })
    )
    expect(
      await screen.findByText(i18n.t("review.list.row.nominateBlocked.inTop10"))
    ).toBeInTheDocument()
  })

  it("sperrt die Nominierung begruendet bei eigener offener Nominierung", async () => {
    const published = projectCard({ ...ASSIGNED, status: "PUBLISHED" })
    server.use(
      http.get("*/api/top10-nominations", () =>
        HttpResponse.json([
          nomination({ project: published, status: "PENDING" }),
        ])
      ),
      ...baseHandlers({ projects: [published] })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")

    /* Der Titel steht hier zweimal: in der Zeile und in der Karte „Meine
       Top-10-Nominierungen". Gewartet wird deshalb auf das Zeilenmenue. */
    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )

    expect(
      await screen.findByText(
        i18n.t("review.list.row.nominateBlocked.nominated")
      )
    ).toBeInTheDocument()
  })

  it("sendet die gewaehlte Stufe und behandelt 409 sichtbar", async () => {
    const published = projectCard({ ...ASSIGNED, status: "PUBLISHED" })
    const sent: unknown[] = []
    server.use(
      http.post(
        "*/api/projects/:projectId/top10-nomination",
        async ({ request }) => {
          sent.push(await request.json())
          return apiErrorResponse(
            409,
            "RESOURCE_IN_USE",
            "/api/projects/pr-1/top10-nomination"
          )
        }
      ),
      ...baseHandlers({ projects: [published] })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )
    await userEvent.click(
      await screen.findByText(i18n.t("review.list.row.nominate"))
    )

    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("radio", { name: /Top 5/ }))
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("review.nomination.dialog.submit"),
      })
    )

    await waitFor(() => expect(sent).toEqual([{ proposedTier: "TOP_5" }]))
    /* Der 409 erscheint sichtbar und wird nicht wiederholt. */
    expect(
      await screen.findByText(i18n.t("apiError.RESOURCE_IN_USE"))
    ).toBeInTheDocument()
    expect(sent).toHaveLength(1)
  })

  it("fuehrt im Zeilenmenue keinen Eintrag Anzeigen mehr", async () => {
    server.use(...baseHandlers({ projects: [ASSIGNED] }))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )

    /* Der Projektname der Zeile ist bereits der Weg auf die Detailseite
       (Nutzerentscheidung zur Nacharbeit an KAN-37). */
    expect(
      await screen.findByText(i18n.t("review.list.row.review"))
    ).toBeInTheDocument()
    /* Woertlich und nicht ueber einen i18n-Schluessel: der Schluessel ist
       mit dem Eintrag entfallen, und t() gaebe sonst den Schluesselnamen
       zurueck, den die Seite nie rendert. Der Test waere stumm gruen. */
    expect(screen.queryByText("Anzeigen")).not.toBeInTheDocument()
  })

  it("bietet Zuweisung abgeben nur in SUBMITTED und REVISION an", async () => {
    const approved = projectCard({
      ...ASSIGNED,
      id: "pr-2",
      title: "Genehmigt",
      status: "APPROVED",
    })
    server.use(...baseHandlers({ projects: [ASSIGNED, approved] }))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "Genehmigt" }),
      })
    )
    expect(
      screen.queryByText(i18n.t("review.list.row.resign"))
    ).not.toBeInTheDocument()

    await userEvent.keyboard("{Escape}")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )
    expect(
      await screen.findByText(i18n.t("review.list.row.resign"))
    ).toBeInTheDocument()
  })

  it("fragt vor dem Abgeben zurueck und nennt den Rueckfall nach Entwurf", async () => {
    let deleted = 0
    server.use(
      http.delete("*/api/projects/:projectId/editors/me", () => {
        deleted += 1
        return HttpResponse.json({
          ...ASSIGNED,
          status: "DRAFT",
          authorRole: null,
          members: [],
          blocks: [],
          editors: [],
          statusHistory: [],
          version: 2,
          createdAt: "2026-01-01T10:00:00Z",
          updatedAt: "2026-01-02T10:00:00Z",
        })
      }),
      ...baseHandlers({ projects: [ASSIGNED] })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.list.row.menuFor", { title: "RoboNav" }),
      })
    )
    await userEvent.click(
      await screen.findByText(i18n.t("review.list.row.resign"))
    )

    /* Die Rueckfrage nennt die Folge; ob es die letzte Zuweisung ist, weiss
       die Zeile nicht (die Kachel fuehrt editors nicht), deshalb steht sie
       als Bedingung da. */
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Entwurf/)).toBeInTheDocument()
    expect(deleted).toBe(0)

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("review.list.resignDialog.confirm"),
      })
    )

    await waitFor(() => expect(deleted).toBe(1))
  })

  it("zeigt den Leerzustand statt einer leeren Flaeche", async () => {
    server.use(...baseHandlers({ projects: [] }))

    renderWithProviders(<ReviewListPage />, "/reviews")

    expect(
      await screen.findByText(i18n.t("review.list.empty.title"))
    ).toBeInTheDocument()
  })
})
