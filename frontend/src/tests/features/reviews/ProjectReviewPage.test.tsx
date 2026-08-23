import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import ProjectReviewPage from "@/features/reviews/ProjectReviewPage"
import i18n from "@/i18n"
import { person, projectDetail } from "@/tests/fixtures"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const SESSION_USER = "00000000-0000-0000-0000-000000000001"
const PROJECT_ID = "pr-1"

function review(overrides: Partial<ProjectDetailResponse> = {}) {
  return projectDetail({
    id: PROJECT_ID,
    title: "RoboNav",
    status: "SUBMITTED",
    summary: "Ein mobiler Roboter navigiert durch das HSB-Gebaeude.",
    author: person({ id: "author-1", firstName: "Jan", lastName: "Schulz" }),
    statusHistory: [],
    ...overrides,
  })
}

function handlers(project: ProjectDetailResponse, extra: unknown[] = []) {
  return [
    ...(extra as never[]),
    currentUserHandler({ role: "EDITOR" }),
    http.get("*/api/projects/:projectId/comments", () => HttpResponse.json([])),
    http.get("*/api/projects/:projectId", () => HttpResponse.json(project)),
  ]
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:projectId/review"
        element={<ProjectReviewPage />}
      />
    </Routes>,
    `/projects/${PROJECT_ID}/review`
  )
}

/**
 * Genehmigen samt Rueckfrage. Beide Freigabeschritte fragen vorher zurueck
 * (Skill frontend-design, Abschnitt 5): sie aendern die Sicht anderer.
 */
async function approveWithConfirmation() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: i18n.t("review.detail.actions.approve"),
    })
  )
  const dialog = await screen.findByRole("alertdialog")
  await userEvent.click(
    within(dialog).getByRole("button", {
      name: i18n.t("review.detail.actions.approveDialog.confirm"),
    })
  )
}

/**
 * Der Review-Modus (Ticket KAN-37): der Inhalt aus dem Renderer, die im
 * Status moeglichen Aktionen, das Vier-Augen-Prinzip und die Begruendung
 * beim Zurueckgeben.
 */
describe("ProjectReviewPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("EDITOR")
  })

  it("rendert den Beitrag ueber ProjectContent, ohne einen Editor einzubinden", async () => {
    const blocks: BlockResponse[] = [
      {
        id: "b-1",
        type: "TEXT",
        orderIndex: 0,
        schemaVersion: 3,
        content: {
          type: "paragraph",
          content: [{ type: "text", text: "Gerenderter Absatz." }],
        } as unknown as BlockResponse["content"],
      },
    ]
    server.use(...handlers(review({ blocks })))

    renderPage()

    expect(
      await screen.findByRole("heading", { level: 1, name: "RoboNav" })
    ).toBeInTheDocument()
    expect(await screen.findByText("Gerenderter Absatz.")).toBeInTheDocument()
    /* Kein Schreibbereich: der Lesepfad hat keine contenteditable-Flaeche. */
    expect(document.querySelector("[contenteditable]")).toBeNull()
  })

  it("stellt einen unbekannten Blocktyp als Platzhalter dar, ohne Absturz", async () => {
    const blocks: BlockResponse[] = [
      {
        id: "b-1",
        type: "TEXT",
        orderIndex: 0,
        schemaVersion: 3,
        content: {
          type: "erfundenerKnoten",
        } as unknown as BlockResponse["content"],
      },
    ]
    server.use(...handlers(review({ blocks })))

    renderPage()

    /* Der Renderer faellt auf den Platzhalter zurueck (KAN-10); die Seite
       bleibt stehen und zeigt weiter ihren Titel. */
    expect(
      await screen.findByRole("heading", { level: 1, name: "RoboNav" })
    ).toBeInTheDocument()
  })

  it("bietet in SUBMITTED Genehmigen und Zurueckgeben an, aber nicht Veroeffentlichen", async () => {
    server.use(...handlers(review()))

    renderPage()

    expect(
      await screen.findByRole("button", {
        name: i18n.t("review.detail.actions.approve"),
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("review.detail.actions.requestRevision"),
      })
    ).toBeInTheDocument()
    /* §4.1 kennt keinen Uebergang SUBMITTED nach PUBLISHED; ein dauerhaft
       gesperrter Knopf entsteht nicht. */
    expect(
      screen.queryByRole("button", {
        name: i18n.t("review.detail.actions.publish"),
      })
    ).not.toBeInTheDocument()
  })

  it("genehmigt und zeigt danach die naechste moegliche Aktion", async () => {
    let calls = 0
    /*
     * Der Handler haelt den Stand wie ein Server: die Mutation invalidiert
     * den projects-Ast, und ein Mock mit festem SUBMITTED liesse die Seite
     * danach wieder in den alten Status zurueckfallen.
     */
    let current = review()
    server.use(
      http.post("*/api/projects/:projectId/approve", () => {
        calls += 1
        current = review({ status: "APPROVED", version: 2 })
        return HttpResponse.json(current)
      }),
      currentUserHandler({ role: "EDITOR" }),
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      http.get("*/api/projects/:projectId", () => HttpResponse.json(current))
    )

    renderPage()

    await approveWithConfirmation()

    await waitFor(() => expect(calls).toBe(1))
    /* APPROVED nach PUBLISHED ist der naechste Uebergang aus §4.1. */
    expect(
      await screen.findByRole("button", {
        name: i18n.t("review.detail.actions.publish"),
      })
    ).toBeInTheDocument()
  })

  it("fragt vor dem Genehmigen zurueck und schickt ohne Bestaetigung nichts", async () => {
    let calls = 0
    server.use(
      ...handlers(review(), [
        http.post("*/api/projects/:projectId/approve", () => {
          calls += 1
          return HttpResponse.json(review({ status: "APPROVED" }))
        }),
      ])
    )

    renderPage()

    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("review.detail.actions.approve"),
      })
    )

    /* Beide Freigabeschritte aendern die Sicht anderer und fragen deshalb
       vorher zurueck (Skill frontend-design, Abschnitt 5). */
    const dialog = await screen.findByRole("alertdialog")
    expect(calls).toBe(0)

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("common.action.cancel"),
      })
    )
    expect(calls).toBe(0)
  })

  it("nennt beim Veroeffentlichen die oeffentliche Sichtbarkeit", async () => {
    server.use(...handlers(review({ status: "APPROVED" })))

    renderPage()

    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("review.detail.actions.publish"),
      })
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/für alle sichtbar/)).toBeInTheDocument()
  })

  it("weist einen unzulaessigen Uebergang sichtbar ab und wiederholt ihn nicht", async () => {
    let calls = 0
    server.use(
      ...handlers(review(), [
        http.post("*/api/projects/:projectId/approve", () => {
          calls += 1
          return apiErrorResponse(
            409,
            "PROJECT_STATUS_TRANSITION_INVALID",
            `/api/projects/${PROJECT_ID}/approve`
          )
        }),
      ])
    )

    renderPage()

    await approveWithConfirmation()

    expect(
      await screen.findByText(
        i18n.t("apiError.PROJECT_STATUS_TRANSITION_INVALID")
      )
    ).toBeInTheDocument()
    expect(calls).toBe(1)
  })

  it("bietet am eigenen Projekt weder Genehmigen noch Veroeffentlichen an", async () => {
    server.use(...handlers(review({ author: person({ id: SESSION_USER }) })))

    renderPage()

    /* Vier-Augen-Prinzip (§4.1 seit v61): wer zur Projektseite gehoert,
       gibt sie nicht frei, auch nicht als zugewiesene Redaktion. */
    expect(
      await screen.findByText(i18n.t("review.detail.actions.ownProject"))
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("review.detail.actions.approve"),
      })
    ).not.toBeInTheDocument()
    /* Zurueckgeben bleibt moeglich: es ist keine Freigabe. */
    expect(
      screen.getByRole("button", {
        name: i18n.t("review.detail.actions.requestRevision"),
      })
    ).toBeInTheDocument()
  })

  it("sperrt die Freigabe auch fuer ein Projektmitglied", async () => {
    server.use(
      ...handlers(
        review({
          members: [
            {
              userId: SESSION_USER,
              firstName: "Mira",
              lastName: "Beispiel",
              projectRole: "Backend",
            },
          ],
        })
      )
    )

    renderPage()

    expect(
      await screen.findByText(i18n.t("review.detail.actions.ownProject"))
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("review.detail.actions.approve"),
      })
    ).not.toBeInTheDocument()
  })

  it("behandelt ein trotzdem eintreffendes 403 sichtbar", async () => {
    server.use(
      ...handlers(review(), [
        http.post("*/api/projects/:projectId/approve", () =>
          apiErrorResponse(
            403,
            "NO_PERMISSION",
            `/api/projects/${PROJECT_ID}/approve`
          )
        ),
      ])
    )

    renderPage()

    await approveWithConfirmation()

    expect(
      await screen.findByText(i18n.t("apiError.NO_PERMISSION"))
    ).toBeInTheDocument()
  })

  it("laesst die Ruecknahme ohne Begruendung nicht hinaus", async () => {
    let calls = 0
    server.use(
      ...handlers(review(), [
        http.post("*/api/projects/:projectId/request-revision", () => {
          calls += 1
          return HttpResponse.json(review({ status: "REVISION" }))
        }),
      ])
    )

    renderPage()

    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("review.detail.actions.requestRevision"),
      })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("review.detail.revision.submit"),
      })
    )

    /* Das zod-Schema haelt den Request auf; ohne Begruendung bliebe die
       Autor:in ohne Arbeitsauftrag (§4.1). */
    expect(
      await within(dialog).findByText(
        i18n.t("validation.revision.reasonRequired")
      )
    ).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it("schickt die Begruendung mit und meldet den Erfolg", async () => {
    const sent: unknown[] = []
    server.use(
      ...handlers(review(), [
        http.post(
          "*/api/projects/:projectId/request-revision",
          async ({ request }) => {
            sent.push(await request.json())
            return HttpResponse.json(review({ status: "REVISION" }))
          }
        ),
      ])
    )

    renderPage()

    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("review.detail.actions.requestRevision"),
      })
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(
      within(dialog).getByLabelText(i18n.t("review.detail.revision.label")),
      "Bitte die Quellen ergaenzen."
    )
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("review.detail.revision.submit"),
      })
    )

    await waitFor(() =>
      expect(sent).toEqual([{ reason: "Bitte die Quellen ergaenzen." }])
    )
  })

  it("zeigt einen 403 auf die Seite selbst als Kein-Zugriff-Flaeche", async () => {
    server.use(
      currentUserHandler({ role: "EDITOR" }),
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      http.get("*/api/projects/:projectId", () =>
        apiErrorResponse(403, "NO_PERMISSION", `/api/projects/${PROJECT_ID}`)
      )
    )

    renderPage()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: i18n.t("review.detail.forbidden.title"),
      })
    ).toBeInTheDocument()
  })
})
