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
    /* Seit Contract v72 fragt die Seite die kuratierte Liste ab: sie
       entscheidet, ob der Weg nach REVISION offen ist (§4.1). */
    http.get("*/api/top10", () => HttpResponse.json([])),
    http.get("*/api/top10-nominations", () => HttpResponse.json([])),
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
 * Oeffnet das Statusmenue. Seit der Nacharbeit stecken die drei Aktionen
 * dort und nicht mehr als Knopfreihe unter der Statuszeile.
 */
async function openStatusMenu() {
  const trigger = await screen.findByRole("button", {
    name: new RegExp(i18n.t("review.detail.statusMenu.label")),
  })
  await userEvent.click(trigger)
  /* Erst wenn das Menue wirklich offen ist, weiter: die Karte rendert
     waehrend der laufenden Kommentarabfrage noch einmal, und ein Klick
     davor ginge ins Leere. */
  await screen.findByRole("menu")
}

/** Ein Eintrag des Statusmenues, gesperrt oder nicht. */
function statusItem(status: ProjectDetailResponse["status"]) {
  return screen.getByRole("menuitem", {
    name: new RegExp(i18n.t(`project.status.${status}`)),
  })
}

/**
 * Genehmigen samt Rueckfrage. Beide Freigabeschritte fragen vorher zurueck
 * (Skill frontend-design, Abschnitt 5): sie aendern die Sicht anderer.
 */
async function approveWithConfirmation() {
  await openStatusMenu()
  await userEvent.click(statusItem("APPROVED"))
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

  it("bietet in SUBMITTED Genehmigt und Ueberarbeitung an, Veroeffentlicht gesperrt", async () => {
    server.use(...handlers(review()))

    renderPage()
    await openStatusMenu()

    /* Das Menue zeigt immer alle vier redaktionellen Staende; welcher geht,
       entscheidet §4.1. Gesperrt statt versteckt, damit sichtbar bleibt,
       was es sonst noch gaebe. */
    expect(statusItem("APPROVED")).not.toHaveAttribute("aria-disabled")
    expect(statusItem("REVISION")).not.toHaveAttribute("aria-disabled")
    expect(statusItem("PUBLISHED")).toHaveAttribute("aria-disabled", "true")
    expect(statusItem("SUBMITTED")).toHaveAttribute("aria-disabled", "true")

    /* Entwurf steht gar nicht darin: dorthin fuehrt kein redaktioneller
       Weg (§4.1). */
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(i18n.t("project.status.DRAFT")),
      })
    ).toBeNull()

    /* Ein gesperrter Eintrag sagt, warum (SC 3.3.2). */
    expect(
      within(statusItem("PUBLISHED")).getByText(
        i18n.t("review.detail.statusMenu.blocked.from")
      )
    ).toBeInTheDocument()

    /* Wieder schliessen: Base UI sperrt die Zeigerereignisse am body,
       solange ein Menue offen ist, und ein Abbau mitten im offenen Zustand
       laesst die Sperre stehen. Der naechste Test klickte dann ins Leere. */
    await userEvent.keyboard("{Escape}")
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: new RegExp(i18n.t("project.status.APPROVED")),
        })
      ).toBeInTheDocument()
    )
    await openStatusMenu()
    expect(statusItem("PUBLISHED")).not.toHaveAttribute("aria-disabled")
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

    await openStatusMenu()
    await userEvent.click(statusItem("APPROVED"))

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

    await openStatusMenu()
    await userEvent.click(statusItem("PUBLISHED"))

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

    await openStatusMenu()
    expect(statusItem("APPROVED")).toHaveAttribute("aria-disabled", "true")
    expect(
      within(statusItem("APPROVED")).getByText(
        i18n.t("review.detail.statusMenu.blocked.ownProject")
      )
    ).toBeInTheDocument()
    /* Zurueckgeben bleibt moeglich: es ist keine Freigabe. */
    expect(statusItem("REVISION")).not.toHaveAttribute("aria-disabled")
  })

  it("sperrt die Freigabe seit KAN-82 auch fuer ein Admin-Konto", async () => {
    /* Bis dahin stand hier eine Ausnahme: ein Admin gab sein eigenes
       Projekt frei, weil Fussnote 1 nur an den EDITOR-Zellen hing. Fremde
       Projekte entscheidet er weiterhin ohne Zuweisung. */
    signInAs("ADMIN")
    server.use(...handlers(review({ author: person({ id: SESSION_USER }) })))

    renderPage()

    expect(
      await screen.findByText(i18n.t("review.detail.actions.ownProject"))
    ).toBeInTheDocument()

    await openStatusMenu()
    expect(statusItem("APPROVED")).toHaveAttribute("aria-disabled", "true")
  })

  it("sperrt die Freigabe auch fuer ein Projektmitglied", async () => {
    server.use(
      ...handlers(
        review({
          members: [
            {
              userId: SESSION_USER,
              avatarUrl: null,
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

    await openStatusMenu()
    expect(statusItem("APPROVED")).toHaveAttribute("aria-disabled", "true")
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

    await openStatusMenu()
    await userEvent.click(statusItem("REVISION"))
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

    await openStatusMenu()
    await userEvent.click(statusItem("REVISION"))
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

  it("fuehrt keinen zweiten Weg zurueck neben dem Brotkrumenband", async () => {
    server.use(...handlers(review()))

    renderPage()

    await screen.findByRole("heading", { level: 1, name: "RoboNav" })
    /* Der Pfad traegt den Weg zurueck vollstaendig; ein Knopf „Zurueck zu
       Meine Reviews" daneben sagte dasselbe ein zweites Mal (stehende
       Entscheidung, Skill frontend-modul Abschnitt 0a). Das Band selbst
       zeichnet seit KAN-80 der Anwendungsrahmen und nicht mehr diese Seite;
       geprueft wird es in tests/routes/AppBreadcrumb.test.tsx. */
    expect(
      screen.queryByRole("link", { name: i18n.t("review.detail.back") })
    ).not.toBeInTheDocument()
  })

  it("zeigt die Kommentarspalte in jedem Status ausser PUBLISHED", async () => {
    server.use(...handlers(review({ status: "SUBMITTED" })))

    renderPage()

    expect(
      await screen.findByRole("region", { name: i18n.t("comment.panel.label") })
    ).toBeInTheDocument()
  })

  it("zeigt die Kommentarspalte bei PUBLISHED nicht", async () => {
    server.use(...handlers(review({ status: "PUBLISHED" })))

    renderPage()

    await screen.findByRole("heading", { level: 1, name: "RoboNav" })
    /* Dort ist die redaktionelle Arbeit vorbei und der Beitrag
       oeffentlich; die Spalte zeigte nur noch einen Verlauf, an dem nichts
       mehr haengt (Nutzerentscheidung zur Nacharbeit an KAN-37). */
    expect(
      screen.queryByRole("region", { name: i18n.t("comment.panel.label") })
    ).not.toBeInTheDocument()
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

  it("zeigt einen 404 als Leerzustand mit dem Weg zurueck", async () => {
    /* §6.3.1: eine unbekannte ID ergibt 404 und nicht 403. Die Seite darf
       dann nicht leer bleiben (Frontend-Regel 4 sinngemaess). */
    server.use(
      currentUserHandler({ role: "EDITOR" }),
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      http.get("*/api/projects/:projectId", () =>
        apiErrorResponse(
          404,
          "PROJECT_NOT_FOUND",
          `/api/projects/${PROJECT_ID}`
        )
      )
    )

    renderPage()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: i18n.t("project.detail.notFound.title"),
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("review.detail.back") })
    ).toBeInTheDocument()
  })

  it("meldet den Statuswechsel nach einem Aenderungswunsch (§4.1, v71)", async () => {
    /*
     * Seit Contract v71 loest der Aenderungswunsch selbst den Uebergang
     * aus. Die Antwort des Kommentar-Endpoints traegt den Status nicht; die
     * Oberflaeche laedt das Projekt nach und vergleicht. Hier liefert der
     * Server deshalb erst SUBMITTED und nach dem POST REVISION.
     */
    let status: ProjectDetailResponse["status"] = "SUBMITTED"
    server.use(
      http.post("*/api/projects/:projectId/comments", () => {
        status = "REVISION"
        return HttpResponse.json(
          {
            id: "c-neu",
            author: person({ id: SESSION_USER }),
            type: "CHANGE_REQUEST",
            text: "Bitte nachbessern.",
            status: "OPEN",
            createdAt: "2026-02-01T10:00:00Z",
            updatedAt: "2026-02-01T10:00:00Z",
          },
          { status: 201 }
        )
      }),
      currentUserHandler({ role: "EDITOR" }),
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      http.get("*/api/projects/:projectId", () =>
        HttpResponse.json(review({ status }))
      )
    )
    signInAs("EDITOR")

    renderPage()

    await userEvent.click(
      within(
        await screen.findByRole("group", {
          name: i18n.t("comment.form.typeLabel"),
        })
      ).getByRole("button", { name: i18n.t("comment.type.CHANGE_REQUEST") })
    )
    await userEvent.type(
      screen.getByLabelText(i18n.t("comment.form.textLabel")),
      "Bitte nachbessern."
    )
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("comment.form.submit") })
    )

    expect(
      await screen.findByText(
        i18n.t("comment.panel.statusChanged", {
          status: i18n.t("project.status.REVISION"),
        })
      )
    ).toBeInTheDocument()
  })

  it("meldet keinen Statuswechsel, wo der Status stehen bleibt", async () => {
    /* In REVISION bleibt er nach §4.1 stehen, und das ist kein Fehlerfall.
       Eine Meldung waere hier schlicht falsch. */
    server.use(
      http.post("*/api/projects/:projectId/comments", () =>
        HttpResponse.json(
          {
            id: "c-neu",
            author: person({ id: SESSION_USER }),
            type: "CHANGE_REQUEST",
            text: "Noch ein Punkt.",
            status: "OPEN",
            createdAt: "2026-02-01T10:00:00Z",
            updatedAt: "2026-02-01T10:00:00Z",
          },
          { status: 201 }
        )
      ),
      ...handlers(review({ status: "REVISION" }))
    )
    signInAs("EDITOR")

    renderPage()

    await userEvent.click(
      within(
        await screen.findByRole("group", {
          name: i18n.t("comment.form.typeLabel"),
        })
      ).getByRole("button", { name: i18n.t("comment.type.CHANGE_REQUEST") })
    )
    await userEvent.type(
      screen.getByLabelText(i18n.t("comment.form.textLabel")),
      "Noch ein Punkt."
    )
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("comment.form.submit") })
    )

    await screen.findByText(i18n.t("comment.panel.announce.created"))
    expect(
      screen.queryByText(
        i18n.t("comment.panel.statusChanged", {
          status: i18n.t("project.status.REVISION"),
        })
      )
    ).toBeNull()
  })

  it("sperrt den Weg nach Ueberarbeitung, solange das Projekt in der Top-10 steht", async () => {
    /*
     * §4.1 seit Contract v72: erst aus der Liste nehmen, dann zurueckgeben.
     * Sonst naehme ein einziges Zurueckgeben einen kuratierten Beitrag aus
     * der oeffentlichen Auswahl, ohne dass jemand darueber entschieden
     * haette. Verbindlich bleibt der Server mit 409 RESOURCE_IN_USE.
     */
    server.use(
      http.get("*/api/top10", () =>
        HttpResponse.json([
          {
            position: 2,
            addedAt: "2026-01-01T10:00:00Z",
            project: { ...review({ status: "PUBLISHED" }), id: PROJECT_ID },
          },
        ])
      ),
      ...handlers(review({ status: "PUBLISHED" }))
    )

    renderPage()
    await openStatusMenu()

    expect(statusItem("REVISION")).toHaveAttribute("aria-disabled", "true")
    expect(
      within(statusItem("REVISION")).getByText(
        i18n.t("review.detail.statusMenu.blocked.inTop10")
      )
    ).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
  })

  it("gibt den Weg frei, sobald das Projekt nicht mehr in der Liste steht", async () => {
    server.use(...handlers(review({ status: "PUBLISHED" })))

    renderPage()
    await openStatusMenu()

    expect(statusItem("REVISION")).not.toHaveAttribute("aria-disabled")
    await userEvent.keyboard("{Escape}")
  })

  it("gibt aus Ueberarbeitung zurueck in die Pruefung (§4.1, v73)", async () => {
    /*
     * Bis v72 konnte das allein die Autor:in, und die Ruecknahme war damit
     * ein Weg ohne Rueckweg. Mit Rueckfrage: der Schritt nimmt der Autor:in
     * die Bearbeitbarkeit (REVISION ist editierbar, SUBMITTED nicht) und
     * schiebt das Projekt in eine fremde Warteschlange; der Skill
     * frontend-design fuehrt „einreichen" in Abschnitt 5 als
     * bestaetigungspflichtig.
     */
    let calls = 0
    let current = review({ status: "REVISION" })
    server.use(
      http.post("*/api/projects/:projectId/submit", () => {
        calls += 1
        current = review({ status: "SUBMITTED", version: 2 })
        return HttpResponse.json(current)
      }),
      currentUserHandler({ role: "EDITOR" }),
      http.get("*/api/projects/:projectId/comments", () =>
        HttpResponse.json([])
      ),
      http.get("*/api/top10", () => HttpResponse.json([])),
      http.get("*/api/top10-nominations", () => HttpResponse.json([])),
      http.get("*/api/projects/:projectId", () => HttpResponse.json(current))
    )

    renderPage()
    await openStatusMenu()

    expect(statusItem("SUBMITTED")).not.toHaveAttribute("aria-disabled")
    await userEvent.click(statusItem("SUBMITTED"))

    // Erst der Dialog, dann der Aufruf.
    const dialog = await screen.findByRole("alertdialog")
    expect(calls).toBe(0)
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("review.detail.actions.submitDialog.confirm"),
      })
    )

    await waitFor(() => expect(calls).toBe(1))
  })

  it("bricht den Weg in die Pruefung ab, wenn die Rueckfrage verneint wird", async () => {
    let calls = 0
    server.use(
      http.post("*/api/projects/:projectId/submit", () => {
        calls += 1
        return HttpResponse.json(review({ status: "SUBMITTED", version: 2 }))
      }),
      ...handlers(review({ status: "REVISION" }))
    )

    renderPage()
    await openStatusMenu()
    await userEvent.click(statusItem("SUBMITTED"))

    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("common.action.cancel"),
      })
    )

    expect(calls).toBe(0)
  })

  it("zeigt einen 409 CHANGE_REQUESTS_OPEN am Weg zurueck in die Pruefung", async () => {
    /*
     * §4.1: auch die Redaktion reicht nicht ein, solange
     * CHANGE_REQUEST-Kommentare im Stand OPEN haengen. Kein zweiter
     * Versuch, er scheiterte mit derselben Begruendung.
     */
    server.use(
      http.post("*/api/projects/:projectId/submit", () =>
        apiErrorResponse(409, "CHANGE_REQUESTS_OPEN", "Es sind 2 Punkte offen.")
      ),
      ...handlers(review({ status: "REVISION" }))
    )

    renderPage()
    await openStatusMenu()
    await userEvent.click(statusItem("SUBMITTED"))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: i18n.t("review.detail.actions.submitDialog.confirm"),
      })
    )

    expect(
      await screen.findByText(i18n.t("apiError.CHANGE_REQUESTS_OPEN"))
    ).toBeInTheDocument()
  })

  it("bietet den Weg in die Pruefung nicht aus Genehmigt an", async () => {
    /*
     * §4.1 kennt ihn nur aus REVISION. Aus APPROVED fuehrt ueberhaupt kein
     * Weg zurueck nach SUBMITTED, auch nicht fuer die Autor:in; der Grund
     * ist deshalb der Ausgangsstand und nicht das fehlende Recht (Befund
     * des frontend-reviewers).
     */
    server.use(...handlers(review({ status: "APPROVED" })))

    renderPage()
    await openStatusMenu()

    expect(statusItem("SUBMITTED")).toHaveAttribute("aria-disabled", "true")
    expect(
      within(statusItem("SUBMITTED")).getByText(
        i18n.t("review.detail.statusMenu.blocked.from")
      )
    ).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
  })

  it("nennt aus Entwurf das fehlende Recht und nicht den Stand", async () => {
    server.use(...handlers(review({ status: "DRAFT" })))

    renderPage()
    await openStatusMenu()

    expect(
      within(statusItem("SUBMITTED")).getByText(
        i18n.t("review.detail.statusMenu.blocked.editorial")
      )
    ).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
  })

  it("meldet in Ueberarbeitung nicht mehr, es stehe keine Aktion an", async () => {
    /* Seit v73 gibt es dort den Weg zurueck in die Pruefung; die Karte darf
       ihn nicht wegreden, waehrend das Menue ihn anbietet. */
    server.use(...handlers(review({ status: "REVISION" })))

    renderPage()
    await screen.findByRole("heading", { level: 1, name: "RoboNav" })

    expect(screen.queryByText(i18n.t("review.detail.actions.none"))).toBeNull()
  })
})
