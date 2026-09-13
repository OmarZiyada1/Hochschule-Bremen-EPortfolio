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

  it("haengt den Druckbereich ein und bietet den Ausdruck an (KAN-83)", async () => {
    /*
     * Reiner Wiedereinbau des Druckwegs aus KAN-41: derselbe Umfang wie auf
     * der Detailseite, Kopfbereich und Beitrag, ohne Redaktionelles. Je
     * Seite gibt es genau einen Druckbereich, deshalb wird auch das
     * geprueft.
     */
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

    await screen.findByRole("heading", { level: 1, name: "RoboNav" })
    const trigger = screen.getByRole("button", { name: "Als PDF drucken" })
    expect(trigger).toBeInTheDocument()
    expect(document.querySelectorAll('[data-print="area"]')).toHaveLength(1)

    /*
     * Die Lage gehoert zur Zusicherung (KAN-83). Ohne Titelbild steht der
     * Knopf in der Zeile ueber dem Titel, also in derselben Karte wie der
     * Beitrag und vor der h1, und nicht mehr in der Aktionskarte der
     * rechten Spalte. Rein rollenbasiert gesucht bliebe ein Umzug
     * unbemerkt.
     */
    const title = screen.getByRole("heading", { level: 1, name: "RoboNav" })
    const card = trigger.closest('[data-slot="card"]')
    expect(card).not.toBeNull()
    expect(card).toContainElement(title)
    expect(
      trigger.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    /* Nicht mehr bei den redaktionellen Handlungen: dort steht das
       Statusmenue, und der Ausdruck ist keine redaktionelle Handlung. */
    const statusMenu = await screen.findByRole("button", {
      name: new RegExp(i18n.t("review.detail.statusMenu.label")),
    })
    expect(card).not.toContainElement(statusMenu)
    /* Reiner Symbolknopf wie ueberall sonst: der Name kommt aus
       aria-label, sichtbarer Text steht nicht daran. */
    expect(trigger).toHaveAttribute("aria-label", "Als PDF drucken")
    expect(trigger.textContent).toBe("")

    /* Ohne Titelbild steht er in der Zeile ueber dem Titel, nach rechts
       geschoben, und schwebt nicht. Dieselbe Huelle wie mit Titelbild. */
    expect(trigger).not.toHaveClass("absolute")
    expect(trigger.parentElement).toHaveClass("ms-auto")
  })

  it("legt den Ausdruck bei vorhandenem Titelbild schwebend darauf", async () => {
    /* Dasselbe Muster wie auf der Detailseite: oben rechts auf dem Bild.
       Er steht dort allein, denn die Reviewansicht fuehrt keine Schublade
       fuer die Projektdaten und damit keinen zweiten Knopf. */
    server.use(
      ...handlers(
        review({
          /* PUBLISHED, damit die Bildadresse ohne Token aufloest und der
             Test nicht am Blob-Abruf haengt (§3.15). */
          status: "PUBLISHED",
          coverImageUrl: "/api/files/11111111-2222-4333-8444-555555555555",
        })
      )
    )

    const { container } = renderPage()

    await screen.findByRole("heading", { level: 1, name: "RoboNav" })
    const trigger = screen.getByRole("button", { name: "Als PDF drucken" })

    /* Absolut gesetzt, der Anker ist die Karte mit relative; damit liegt er
       oben rechts auf dem Bild. Geprueft wird die Lage ueber die Klassen und
       ueber die gemeinsame Karte, nicht ueber die Geschwisterfolge: der
       Knopf steht bewusst in derselben Zeile des Baums wie ohne Bild und
       wechselt nur seine Lage, damit er beim Nachladen der Bildadresse nicht
       ab- und wieder aufgebaut wird und dabei den Fokus verliert
       (SC 2.4.3). */
    expect(trigger).toHaveClass("absolute", "top-4", "right-4")
    const image = container.querySelector("img")
    expect(image).not.toBeNull()
    expect(trigger.closest("[data-slot=card]")).toBe(
      image?.closest("[data-slot=card]")
    )

    /* Und zwar aus derselben Huelle heraus wie ohne Titelbild: der Knopf
       steht an genau einer Stelle des Baums und wechselt nur seine Lage.
       Zwei getrennte Zweige baute React beim Nachladen der angemeldeten
       Bildadresse um, und ein Knopf, der unter dem Fokus verschwindet, gibt
       ihn an body zurueck (SC 2.4.3). */
    expect(trigger.parentElement).toHaveClass("ms-auto")
  })

  it("fuehrt den Beitrag ohne sichtbare Rubrik und ohne Trennlinie", async () => {
    /* Wie auf der Detailseite (KAN-83): die Ueberschrift bleibt sr-only
       stehen, damit die Gliederung zwischen h1 und erster Blockueberschrift
       eine Sprungmarke behaelt, und benennt zugleich den Abschnitt. */
    server.use(...handlers(review()))

    renderPage()

    const title = await screen.findByRole("heading", {
      level: 1,
      name: "RoboNav",
    })

    const rubric = screen.getByRole("heading", {
      level: 2,
      name: i18n.t("project.detail.content"),
    })
    expect(rubric).toHaveClass("sr-only")
    const region = screen.getByRole("region", {
      name: i18n.t("project.detail.content"),
    })
    expect(region).toContainElement(rubric)

    const summary = screen.getByText(
      "Ein mobiler Roboter navigiert durch das HSB-Gebaeude."
    )
    expect(summary.nextElementSibling).toBe(region)
    const article = title.closest("article") as HTMLElement
    expect(article.querySelector(":scope > hr")).toBeNull()
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

  /*
   * KAN-104: die Reviewansicht schaltet an Ort und Stelle zwischen Review und
   * Vorschau. Bis dahin fuehrte der Schalter auf die oeffentliche Detailseite
   * und brauchte dort einen eigenen Rueckweg.
   */
  describe("Vorschau an Ort und Stelle (KAN-104)", () => {
    const REACTIONS = () => i18n.t("project.detail.reactions.heading")

    function commentsTrigger(): HTMLElement {
      return screen.getByRole("button", {
        name: new RegExp(`^${i18n.t("comment.panel.title")}(\\s|$)`),
      })
    }

    function infoTrigger(): HTMLElement {
      return screen.getByRole("button", {
        name: i18n.t("projectContent.sidebar.projectInfo"),
      })
    }

    it("zeigt den Beitrag ohne Karte und mit Reaktionen, die rechte Spalte vollstaendig", async () => {
      const user = userEvent.setup()
      server.use(...handlers(review()))

      renderPage()

      const title = await screen.findByRole("heading", {
        level: 1,
        name: "RoboNav",
      })
      expect(title.closest('[data-slot="card"]')).not.toBeNull()
      expect(screen.queryByRole("heading", { name: REACTIONS() })).toBeNull()

      await user.click(
        screen.getByRole("button", {
          name: i18n.t("projectContent.sidebar.preview"),
        })
      )

      const previewTitle = await screen.findByRole("heading", {
        level: 1,
        name: "RoboNav",
      })
      /* Kein Kartenrahmen mehr um den Beitrag, und weiter genau eine h1. */
      expect(previewTitle.closest('[data-slot="card"]')).toBeNull()
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
      expect(
        screen.getByText(
          "Ein mobiler Roboter navigiert durch das HSB-Gebaeude."
        )
      ).toBeInTheDocument()

      /* Die Reaktionen wie auf der Detailseite; reagieren geht erst bei
         PUBLISHED (§3.10), und die Komponente sagt es sichtbar. */
      expect(
        screen.getByRole("heading", { name: REACTIONS() })
      ).toBeInTheDocument()
      expect(
        screen.getByText(i18n.t("project.detail.reactions.publishedRequired"))
      ).toBeInTheDocument()

      /* Die rechte Spalte bleibt vollstaendig. */
      expect(
        screen.getByRole("button", {
          name: new RegExp(i18n.t("review.detail.statusMenu.label")),
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: i18n.t("review.detail.history") })
      ).toBeInTheDocument()
      expect(infoTrigger()).toBeInTheDocument()
      expect(
        screen.getByRole("region", { name: i18n.t("comment.panel.label") })
      ).toBeInTheDocument()
      /* Und es bleibt bei einem Druckbereich. */
      expect(document.querySelectorAll('[data-print="area"]')).toHaveLength(1)

      await user.click(
        screen.getByRole("button", {
          name: i18n.t("review.detail.mode.review"),
        })
      )

      const back = await screen.findByRole("heading", {
        level: 1,
        name: "RoboNav",
      })
      expect(back.closest('[data-slot="card"]')).not.toBeNull()
      expect(screen.queryByRole("heading", { name: REACTIONS() })).toBeNull()
    })

    it("legt den Druckknopf in der Vorschau weiter auf das Titelbild", async () => {
      const user = userEvent.setup()
      server.use(
        ...handlers(
          review({
            /* PUBLISHED, damit die Bildadresse ohne Token aufloest (§3.15). */
            status: "PUBLISHED",
            coverImageUrl: "/api/files/11111111-2222-4333-8444-555555555555",
          })
        )
      )

      const { container } = renderPage()
      await screen.findByRole("heading", { level: 1, name: "RoboNav" })
      await user.click(
        screen.getByRole("button", {
          name: i18n.t("projectContent.sidebar.preview"),
        })
      )

      const trigger = await screen.findByRole("button", {
        name: "Als PDF drucken",
      })
      expect(trigger).toHaveClass("absolute", "top-4", "right-4")
      const image = container.querySelector("img")
      expect(image).not.toBeNull()
      /* Der positionierte Vorfahr traegt Bild und Knopf zugleich. */
      const frame = image?.parentElement
      expect(frame).toHaveClass("relative")
      expect(frame).toContainElement(trigger)
    })

    it("sagt den Wechsel an und laesst den Fokus am Umschalter", async () => {
      const user = userEvent.setup()
      server.use(...handlers(review()))

      renderPage()
      await screen.findByRole("heading", { level: 1, name: "RoboNav" })

      const toggle = screen.getByRole("button", {
        name: i18n.t("projectContent.sidebar.preview"),
      })
      await user.click(toggle)

      /* Derselbe Knoten mit neuer Beschriftung, und der Fokus bleibt darauf
         (SC 2.4.3). Kein aria-pressed an einem Knopf, dessen Name wechselt. */
      const reviewToggle = await screen.findByRole("button", {
        name: i18n.t("review.detail.mode.review"),
      })
      expect(reviewToggle).toBe(toggle)
      expect(reviewToggle).toHaveFocus()
      expect(reviewToggle).not.toHaveAttribute("aria-pressed")

      /* Eine polite Region, die dauerhaft steht und nur ihren Text wechselt. */
      const notice = screen.getByText(
        i18n.t("review.detail.mode.announce.preview")
      )
      expect(notice).toHaveAttribute("aria-live", "polite")

      await user.click(reviewToggle)
      expect(
        screen.getByText(i18n.t("review.detail.mode.announce.review"))
      ).toBe(notice)
      expect(toggle).toHaveFocus()
    })

    it("oeffnet mit offener Kommentarspalte und zugeklappten Projektinformationen", async () => {
      server.use(...handlers(review()))

      renderPage()

      await screen.findByRole("region", { name: i18n.t("comment.panel.label") })
      expect(commentsTrigger()).toHaveAttribute("aria-expanded", "true")
      expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")
    })

    it("oeffnet bei PUBLISHED die Projektinformationen", async () => {
      server.use(...handlers(review({ status: "PUBLISHED" })))

      renderPage()

      await screen.findByRole("heading", { level: 1, name: "RoboNav" })
      expect(infoTrigger()).toHaveAttribute("aria-expanded", "true")
    })
  })
})
