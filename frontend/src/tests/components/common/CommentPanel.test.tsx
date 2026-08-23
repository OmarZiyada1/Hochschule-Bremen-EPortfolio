import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { CommentResponse, ProjectDetailResponse } from "@/api/types"
import { CommentPanel } from "@/components/common/CommentPanel"
import {
  creatableTypes,
  maySetChangeRequestStatus,
} from "@/components/common/commentPermissions"
import i18n from "@/i18n"
import { comment, person, projectDetail } from "@/tests/fixtures"
import { currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/** Die ID, die {@code signInAs} in die Sitzung legt. */
const SESSION_USER = "00000000-0000-0000-0000-000000000001"

function commentsHandler(comments: CommentResponse[]) {
  return http.get("*/api/projects/:projectId/comments", () =>
    HttpResponse.json(comments)
  )
}

function project(
  overrides: Partial<ProjectDetailResponse> = {}
): ProjectDetailResponse {
  return projectDetail({
    id: "pr-1",
    status: "SUBMITTED",
    author: person({ id: "author-1", firstName: "Jan", lastName: "Schulz" }),
    ...overrides,
  })
}

/**
 * Die gemeinsame Kommentarspalte (Ticket KAN-37): Sichtbarkeit der drei
 * Typen, Unterscheidbarkeit ohne Farbe, der Statusumschalter nach §5 und
 * der eingeschraenkte Umfang im Editor.
 */
describe("CommentPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    server.use(currentUserHandler())
  })

  it("bietet einer Redakteur:in im Review-Modus alle drei Typen an", async () => {
    signInAs("EDITOR")
    server.use(commentsHandler([]))

    renderWithProviders(<CommentPanel project={project()} />)

    /* Ueber die sichtbare Oberflaeche und nicht ueber interne Props: die
       drei Typen stehen als Segmente der Typwahl (§2.3). */
    const group = await screen.findByRole("group", {
      name: i18n.t("comment.form.typeLabel"),
    })
    expect(
      within(group).getByRole("button", { name: i18n.t("comment.type.REPLY") })
    ).toBeInTheDocument()
    expect(
      within(group).getByRole("button", { name: i18n.t("comment.type.NOTE") })
    ).toBeInTheDocument()
    expect(
      within(group).getByRole("button", {
        name: i18n.t("comment.type.CHANGE_REQUEST"),
      })
    ).toBeInTheDocument()
  })

  it("legt einen Aenderungswunsch an und schickt Typ und Text mit", async () => {
    signInAs("EDITOR")
    const sent: unknown[] = []
    server.use(
      commentsHandler([]),
      http.post("*/api/projects/:projectId/comments", async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json(
          comment({ type: "CHANGE_REQUEST", status: "OPEN" }),
          { status: 201 }
        )
      })
    )

    renderWithProviders(<CommentPanel project={project()} />)

    const group = await screen.findByRole("group", {
      name: i18n.t("comment.form.typeLabel"),
    })
    await userEvent.click(
      within(group).getByRole("button", {
        name: i18n.t("comment.type.CHANGE_REQUEST"),
      })
    )
    await userEvent.type(
      screen.getByLabelText(i18n.t("comment.form.textLabel")),
      "Bitte die Quellen ergaenzen."
    )
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("comment.form.submit") })
    )

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).toEqual({
      type: "CHANGE_REQUEST",
      text: "Bitte die Quellen ergaenzen.",
    })
  })

  it("unterscheidet die Typen ohne Farbwahrnehmung", async () => {
    signInAs("EDITOR")
    server.use(
      commentsHandler([
        comment({ id: "c-1", type: "REPLY" }),
        comment({ id: "c-2", type: "NOTE" }),
        comment({ id: "c-3", type: "CHANGE_REQUEST", status: "OPEN" }),
      ])
    )

    renderWithProviders(<CommentPanel project={project()} />)

    /* Jeder Eintrag traegt seine Art als Text, nicht nur als Flaechenfarbe
       (SC 1.4.1). Der Stand steht ebenfalls als Wort da. */
    const list = await screen.findByRole("list")
    expect(
      within(list).getByText(i18n.t("comment.type.REPLY"))
    ).toBeInTheDocument()
    expect(
      within(list).getByText(i18n.t("comment.type.NOTE"))
    ).toBeInTheDocument()
    expect(
      within(list).getByText(i18n.t("comment.type.CHANGE_REQUEST"))
    ).toBeInTheDocument()
    expect(
      within(list).getByText(i18n.t("comment.status.OPEN"))
    ).toBeInTheDocument()
  })

  it("zeigt keine NOTE, die der Server nicht liefert, und filtert nichts selbst", async () => {
    signInAs("STUDENT")
    /* Die Sichtbarkeitsfilterung liegt im Server (§6.1): an ein
       studentisches Konto geht die NOTE gar nicht erst hinaus. Der Client
       zeigt genau das, was ankommt. */
    server.use(commentsHandler([comment({ id: "c-1", type: "REPLY" })]))

    renderWithProviders(
      <CommentPanel
        project={project({
          author: person({ id: SESSION_USER }),
        })}
      />
    )

    const list = await screen.findByRole("list")
    expect(
      within(list).getByText(i18n.t("comment.type.REPLY"))
    ).toBeInTheDocument()
    expect(
      within(list).queryByText(i18n.t("comment.type.NOTE"))
    ).not.toBeInTheDocument()
  })

  it("zeigt den Statusumschalter nur an einem Aenderungswunsch", async () => {
    signInAs("EDITOR")
    server.use(
      commentsHandler([
        comment({ id: "c-1", type: "REPLY" }),
        comment({ id: "c-2", type: "NOTE" }),
      ])
    )

    renderWithProviders(<CommentPanel project={project()} />)

    await screen.findByRole("list")
    /* REPLY und NOTE tragen keinen Stand (§2.4); an ihnen gaebe es nichts
       umzuschalten, und der Server antwortete mit 409. */
    expect(
      screen.queryByRole("button", { name: i18n.t("comment.action.resolve") })
    ).not.toBeInTheDocument()
  })

  it("laesst die Redaktion ein zu frueh gesetztes RESOLVED wieder oeffnen", async () => {
    signInAs("EDITOR")
    const sent: unknown[] = []
    server.use(
      commentsHandler([
        comment({ id: "c-3", type: "CHANGE_REQUEST", status: "RESOLVED" }),
      ]),
      http.patch("*/api/comments/:commentId/status", async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json(
          comment({ id: "c-3", type: "CHANGE_REQUEST", status: "OPEN" })
        )
      })
    )

    renderWithProviders(<CommentPanel project={project()} />)

    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("comment.action.reopen"),
      })
    )

    /* §2.4 begruendet den Rueckweg ausdruecklich: die Redaktion soll ohne
       neuen Kommentar korrigieren koennen. */
    await waitFor(() => expect(sent).toEqual([{ status: "OPEN" }]))
  })

  it("bietet im Editor allein die Antwort an", async () => {
    signInAs("STUDENT")
    server.use(commentsHandler([]))

    renderWithProviders(
      <CommentPanel
        project={project({ author: person({ id: SESSION_USER }) })}
        context="editor"
      />
    )

    /* Im Editor beginnt die Spalte zugeklappt: dort gehoert die Seite der
       Schreibflaeche. Aufgeklappt ist sie nur in REVISION, wo die offenen
       Aenderungswuensche der Arbeitsauftrag sind. */
    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("comment.panel.expand"),
      })
    )

    await screen.findByLabelText(i18n.t("comment.form.textLabel"))
    /* Eine Gruppe mit einem Knopf waere ein Ziel ohne Zweck; bei einem
       einzigen erlaubten Typ entfaellt die Wahl ganz. */
    expect(
      screen.queryByRole("group", { name: i18n.t("comment.form.typeLabel") })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("comment.type.NOTE") })
    ).not.toBeInTheDocument()
  })

  it("zeigt einem Projektmitglied dieselbe Ansicht wie der Autor:in", async () => {
    signInAs("STUDENT")
    server.use(
      commentsHandler([
        comment({ id: "c-3", type: "CHANGE_REQUEST", status: "OPEN" }),
      ])
    )

    renderWithProviders(
      <CommentPanel
        project={project({
          author: person({ id: "author-1" }),
          members: [
            {
              userId: SESSION_USER,
              firstName: "Mira",
              lastName: "Beispiel",
              projectRole: "Frontend",
            },
          ],
        })}
        context="editor"
      />
    )

    await userEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("comment.panel.expand"),
      })
    )

    /* Die Projektseite hakt den an sie gerichteten Aenderungswunsch selbst
       ab (§2.4, §5 Fussnote 2); ein Mitglied gehoert dazu (§3.13). */
    expect(
      await screen.findByRole("button", {
        name: i18n.t("comment.action.resolve"),
      })
    ).toBeInTheDocument()
  })

  it("beginnt im Editor in REVISION aufgeklappt", async () => {
    signInAs("STUDENT")
    server.use(
      commentsHandler([
        comment({ id: "c-3", type: "CHANGE_REQUEST", status: "OPEN" }),
      ])
    )

    renderWithProviders(
      <CommentPanel
        project={project({
          status: "REVISION",
          author: person({ id: SESSION_USER }),
        })}
        context="editor"
      />
    )

    /* Dort sind die offenen Aenderungswuensche der Arbeitsauftrag; eine
       zugeklappte Spalte verstuende sich als Nebensache. */
    expect(await screen.findByRole("list")).toBeInTheDocument()
    expect(screen.getByText(i18n.t("comment.status.OPEN"))).toBeInTheDocument()
  })

  it("meldet die Zahl der offenen Aenderungswuensche in der Kopfzeile", async () => {
    signInAs("EDITOR")
    server.use(
      commentsHandler([
        comment({ id: "c-3", type: "CHANGE_REQUEST", status: "OPEN" }),
        comment({ id: "c-4", type: "CHANGE_REQUEST", status: "RESOLVED" }),
      ])
    )

    renderWithProviders(<CommentPanel project={project()} />)

    expect(
      await screen.findByText(i18n.t("comment.panel.openCount", { count: 1 }))
    ).toBeInTheDocument()
  })
})

/** Die beiden reinen Funktionen, ohne Rendern. */
describe("Rechte der Kommentarspalte", () => {
  describe("creatableTypes", () => {
    it("gibt der Redaktion im Review-Modus alle drei Typen", () => {
      expect(creatableTypes("EDITOR", "review")).toEqual([
        "REPLY",
        "NOTE",
        "CHANGE_REQUEST",
      ])
      expect(creatableTypes("ADMIN", "review")).toEqual([
        "REPLY",
        "NOTE",
        "CHANGE_REQUEST",
      ])
    })

    it("gibt einem studentischen Konto allein die Antwort", () => {
      expect(creatableTypes("STUDENT", "review")).toEqual(["REPLY"])
    })

    it("laesst im Editor auch fuer die Redaktion nur die Antwort zu", () => {
      expect(creatableTypes("EDITOR", "editor")).toEqual(["REPLY"])
    })

    it("gibt ohne Anmeldung nichts", () => {
      expect(creatableTypes(undefined, "review")).toEqual([])
    })
  })

  describe("maySetChangeRequestStatus", () => {
    const target = project({ author: person({ id: "author-1" }) })

    it("erlaubt es Redaktion und Administration aus ihrer Rolle heraus", () => {
      expect(
        maySetChangeRequestStatus(target, { id: "x", role: "EDITOR" })
      ).toBe(true)
      expect(
        maySetChangeRequestStatus(target, { id: "x", role: "ADMIN" })
      ).toBe(true)
    })

    it("erlaubt es der Projektseite aus ihrer Beteiligung heraus", () => {
      expect(
        maySetChangeRequestStatus(target, { id: "author-1", role: "STUDENT" })
      ).toBe(true)
      expect(
        maySetChangeRequestStatus(
          project({
            author: person({ id: "author-1" }),
            members: [
              {
                userId: "member-1",
                firstName: "Mira",
                lastName: "Beispiel",
                projectRole: null,
              },
            ],
          }),
          { id: "member-1", role: "STUDENT" }
        )
      ).toBe(true)
    })

    it("verweigert es einem unbeteiligten studentischen Konto", () => {
      expect(
        maySetChangeRequestStatus(target, { id: "fremd", role: "STUDENT" })
      ).toBe(false)
      expect(maySetChangeRequestStatus(target, null)).toBe(false)
    })
  })
})
