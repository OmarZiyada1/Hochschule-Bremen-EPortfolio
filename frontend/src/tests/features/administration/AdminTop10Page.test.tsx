import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import AdminTop10Page from "@/features/administration/AdminTop10Page"
import i18n from "@/i18n"
import { nomination, projectCard, top10Entry } from "@/tests/fixtures"
import {
  apiErrorResponse,
  currentUserHandler,
  top10AdminHandlers,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const SMART = projectCard({ id: "p-1", title: "SmartCampus" })
const BREMEN = projectCard({ id: "p-2", title: "BremenConnect" })
const GREEN = projectCard({ id: "p-3", title: "GreenRoute" })

const OPEN_NOMINATION = nomination({
  id: "n-1",
  project: projectCard({ id: "p-9", title: "PortLogix" }),
  proposedTier: "TOP_5",
})

function base(entries = [top10Entry({ position: 1, project: SMART })]) {
  return [
    currentUserHandler({ role: "ADMIN" }),
    ...top10AdminHandlers({ entries, nominations: [OPEN_NOMINATION] }),
  ]
}

function render(route = "/administration/top10") {
  return renderWithProviders(<AdminTop10Page />, route)
}

/**
 * Die Top-10-Verwaltung (Ticket KAN-40, Tests 1, 2, 4, 5, 6 und 10).
 *
 * <p>Geprueft wird ueber die sichtbare Oberflaeche: welche Anfrage hinausgeht
 * und was danach dasteht, nicht wie es innen zusammengesetzt ist.
 */
describe("AdminTop10Page", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  /* Ticket KAN-40, Test 1. */
  it("nimmt eine Nominierung ueber den Dialog an und laedt die Liste ohne Reload nach", async () => {
    const user = userEvent.setup()
    let body: unknown = null
    let nominationsCalls = 0

    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/top10", () =>
        HttpResponse.json([top10Entry({ position: 1, project: SMART })])
      ),
      http.get("*/api/admin/top10-nominations", () => {
        nominationsCalls += 1
        return HttpResponse.json(
          nominationsCalls === 1
            ? [OPEN_NOMINATION]
            : [{ ...OPEN_NOMINATION, status: "ACCEPTED", proposedPosition: 2 }]
        )
      }),
      http.post(
        "*/api/admin/top10-nominations/n-1/accept",
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            ...OPEN_NOMINATION,
            status: "ACCEPTED",
            proposedPosition: 2,
          })
        }
      )
    )

    render()

    await user.click(await screen.findByRole("button", { name: "Annehmen" }))
    const dialog = await screen.findByRole("dialog")
    /* Die Stufe TOP_5 belegt den ersten freien Platz ihres Bereichs vor,
       hier Platz 2 (§2.13). Sie bindet die Entscheidung nicht. */
    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Platz 2")

    await user.click(
      within(dialog).getByRole("button", { name: "Annehmen" })
    )

    await waitFor(() => expect(body).toEqual({ position: 2 }))
    /* Ohne Reload: die Liste wird ueber den Query-Cache neu geladen. */
    await waitFor(() => expect(nominationsCalls).toBeGreaterThan(1))
  })

  /* Ticket KAN-40, Test 1, zweite Haelfte. */
  it("lehnt eine Nominierung nach einer Rueckfrage ab", async () => {
    const user = userEvent.setup()
    let rejected = false

    server.use(
      ...base(),
      http.post("*/api/admin/top10-nominations/n-1/reject", () => {
        rejected = true
        return HttpResponse.json({ ...OPEN_NOMINATION, status: "REJECTED" })
      })
    )

    render()

    await user.click(await screen.findByRole("button", { name: "Ablehnen" }))

    /* Ablehnen entscheidet ueber den Vorschlag einer anderen Person und
       laesst sich nicht mit demselben Klick zuruecknehmen (Skill
       frontend-design, Abschnitt 5). */
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("PortLogix")
    expect(rejected).toBe(false)

    await user.click(within(dialog).getByRole("button", { name: "Ablehnen" }))
    await waitFor(() => expect(rejected).toBe(true))
  })

  /* Ticket KAN-40, Test 2. */
  it("schickt beim Umsortieren erst mit dem Speichern und dann genau eine geordnete Liste", async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []

    server.use(
      ...base([
        top10Entry({ position: 1, project: SMART }),
        top10Entry({ position: 2, project: BREMEN }),
        top10Entry({ position: 3, project: GREEN }),
      ]),
      http.put("*/api/admin/top10", async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json([
          top10Entry({ position: 1, project: BREMEN }),
          top10Entry({ position: 2, project: SMART }),
          top10Entry({ position: 3, project: GREEN }),
        ])
      })
    )

    render()

    await user.click(
      await screen.findByRole("button", {
        name: "BremenConnect von Platz 2 nach oben",
      })
    )

    /* Ein Klick auf „nach oben" allein schickt nichts: sonst entstuende je
       Klick ein Schreibvorgang und je Schreibvorgang eine Protokollzeile
       (§3.17). */
    expect(calls).toHaveLength(0)

    await user.click(
      screen.getByRole("button", { name: "Reihenfolge speichern" })
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))

    await waitFor(() => expect(calls).toHaveLength(1))
    /* §3.11.1 Regel 3: die vollstaendige, geordnete Liste, kein
       position-Parameter. */
    expect(calls[0]).toEqual({ projectIds: ["p-2", "p-1", "p-3"] })
  })

  /* Ticket KAN-40, Test 3, an der Oberflaeche. */
  it("sperrt den ersten Platz nach oben und den letzten nach unten", async () => {
    server.use(
      ...base([
        top10Entry({ position: 1, project: SMART }),
        top10Entry({ position: 2, project: BREMEN }),
      ])
    )

    render()

    expect(
      await screen.findByRole("button", {
        name: "SmartCampus von Platz 1 nach oben",
      })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "BremenConnect von Platz 2 nach unten" })
    ).toBeDisabled()
  })

  /* Ticket KAN-40, Test 4. */
  it("stellt eine Luecke mitten in der Liste dar und laesst trotzdem speichern", async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []

    server.use(
      ...base([
        top10Entry({ position: 1, project: SMART }),
        top10Entry({ position: 3, project: GREEN }),
      ]),
      http.put("*/api/admin/top10", async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json([])
      })
    )

    render()

    /* Zehn Plaetze, davon acht frei: ein freier Platz steht als eigener
       Eintrag da und nicht als leere Flaeche (SC 1.3.1). Die Luecke liegt
       auf Platz 2, mitten in der Liste. */
    expect(await screen.findAllByText("Platz frei")).toHaveLength(8)
    const slots = within(
      screen.getByRole("list", { name: "Plätze der Top 10" })
    ).getAllByRole("listitem")
    expect(slots[1]).toHaveTextContent("Platz frei")
    expect(slots[2]).toHaveTextContent("GreenRoute")

    await user.click(
      screen.getByRole("button", { name: "GreenRoute von Platz 3 nach oben" })
    )
    await user.click(
      screen.getByRole("button", { name: "Reihenfolge speichern" })
    )
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Speichern",
      })
    )

    /* Die Luecke blockiert nicht, und sie geht auch nicht als Platzhalter
       mit: der Server nummeriert dicht durch (§3.11.1 Regel 3). */
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({ projectIds: ["p-3", "p-1"] })
  })

  /* Ticket KAN-40, Test 5. */
  it("bietet bei zehn belegten Plaetzen keinen elften Eintrag an", async () => {
    server.use(
      ...base(
        Array.from({ length: 10 }, (_, index) =>
          top10Entry({
            position: index + 1,
            project: projectCard({ id: `p${index}`, title: `Projekt ${index}` }),
          })
        )
      )
    )

    render()

    expect(await screen.findByText(/Alle zehn Plätze sind belegt/)).toBeVisible()
    expect(screen.queryByText("Platz frei")).not.toBeInTheDocument()
    /* Auch das Annehmen faellt aus: accept raeumt keinen belegten Platz,
       sondern antwortete mit 409 RESOURCE_IN_USE (§3.11.1). */
    expect(screen.getByRole("button", { name: "Annehmen" })).toBeDisabled()
  })

  /*
   * Ticket KAN-40, Test 6: alle vier Fehlercodes der Tabelle, jeder mit
   * eigener Meldung und jeder ueber den errorCode entschieden.
   *
   * Die drei 409er sagen nichts ueber die Eingabe aus, sondern ueber den
   * Stand: sie erscheinen als Meldung am Dialog, mit dem Text aus i18n.
   */
  it.each([
    ["RESOURCE_IN_USE", 409],
    ["PROJECT_NOT_PUBLISHED", 409],
    ["NOMINATION_ALREADY_DECIDED", 409],
  ])(
    "behandelt %s ueber den errorCode und nicht ueber den Meldungstext",
    async (code, status) => {
      const user = userEvent.setup()

      server.use(
        ...base(),
        http.post("*/api/admin/top10-nominations/n-1/accept", () =>
          apiErrorResponse(
            status as number,
            code as "RESOURCE_IN_USE",
            "/api/admin/top10-nominations/n-1/accept",
            "Egal welcher Text hier steht."
          )
        )
      )

      render()

      await user.click(await screen.findByRole("button", { name: "Annehmen" }))
      const dialog = await screen.findByRole("dialog")
      await user.click(within(dialog).getByRole("button", { name: "Annehmen" }))

      const expected = i18n.t(`apiError.${code}`)
      expect(await within(dialog).findByText(expected)).toBeInTheDocument()
      expect(
        within(dialog).queryByText("Egal welcher Text hier steht.")
      ).not.toBeInTheDocument()
    }
  )

  /*
   * Der vierte Code der Tabelle laeuft bewusst anders: ein 400
   * VALIDATION_FAILED nennt das betroffene Feld im Format „feld: Text"
   * (§6.2) und gehoert deshalb an das Feld und nicht an den Dialog (Skill
   * frontend-api, Abschnitt 3). Entschieden wird auch hier ueber den
   * errorCode; nur das Ziel der Meldung ist ein anderes.
   */
  it("legt einen 400 VALIDATION_FAILED an das benannte Feld", async () => {
    const user = userEvent.setup()

    server.use(
      ...base(),
      http.post("*/api/admin/top10-nominations/n-1/accept", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/admin/top10-nominations/n-1/accept",
          "position: Der Platz muss zwischen 1 und 10 liegen."
        )
      )
    )

    render()

    await user.click(await screen.findByRole("button", { name: "Annehmen" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Annehmen" }))

    expect(
      await within(dialog).findByText("Der Platz muss zwischen 1 und 10 liegen.")
    ).toBeInTheDocument()
  })

  /* Ticket KAN-40, Test 7, erste Haelfte: ohne Wahl kein Request. */
  it("beanstandet eine fehlende Platzwahl im Dialog, ohne einen Request zu schicken", async () => {
    const user = userEvent.setup()
    let called = false

    server.use(
      currentUserHandler({ role: "ADMIN" }),
      ...top10AdminHandlers({
        /* Alle Plaetze des Bereichs TOP_5 belegt: dann gibt es keine
           Vorbelegung und das Feld bleibt leer. */
        entries: [2, 3, 4, 5].map((position) =>
          top10Entry({
            position,
            project: projectCard({ id: `p${position}` }),
          })
        ),
        nominations: [OPEN_NOMINATION],
      }),
      http.post("*/api/admin/top10-nominations/n-1/accept", () => {
        called = true
        return HttpResponse.json(OPEN_NOMINATION)
      })
    )

    render()

    await user.click(await screen.findByRole("button", { name: "Annehmen" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Annehmen" }))

    expect(
      await within(dialog).findByText("Bitte einen Platz wählen.")
    ).toBeInTheDocument()
    expect(called).toBe(false)
  })

  /* Ticket KAN-40, Test 10. */
  it("zieht eine angenommene Nominierung nach einer Rueckfrage zurueck", async () => {
    const user = userEvent.setup()
    let withdrawn = false
    const accepted = nomination({
      id: "n-2",
      project: projectCard({ id: "p-1", title: "SmartCampus" }),
      status: "ACCEPTED",
      proposedPosition: 1,
    })

    server.use(
      currentUserHandler({ role: "ADMIN" }),
      ...top10AdminHandlers({
        entries: [top10Entry({ position: 1, project: SMART })],
        nominations: [accepted],
      }),
      http.post("*/api/top10-nominations/n-2/withdraw", () => {
        withdrawn = true
        return HttpResponse.json({ ...accepted, status: "WITHDRAWN" })
      })
    )

    render("/administration/top10?status=ACCEPTED")

    await user.click(
      await screen.findByRole("button", {
        name: "Nominierung zurückziehen und Projekt aus der Top-10 nehmen: SmartCampus",
      })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(withdrawn).toBe(false)

    await user.click(
      within(dialog).getByRole("button", { name: "Zurückziehen" })
    )
    await waitFor(() => expect(withdrawn).toBe(true))
  })

  /* §3.11.1: an einem abgelehnten Vorschlag gibt es die Handlung nicht. */
  it("bietet an einer abgelehnten Nominierung kein Zurueckziehen an", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      ...top10AdminHandlers({
        nominations: [nomination({ id: "n-3", status: "REJECTED" })],
      })
    )

    render("/administration/top10?status=REJECTED")

    expect(await screen.findByText("Abgelehnt")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /zurückziehen/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Annehmen" })
    ).not.toBeInTheDocument()
  })

  it("haelt den Statusfilter in der Adresse und laedt damit neu", async () => {
    const user = userEvent.setup()
    const seen: (string | null)[] = []

    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/top10", () => HttpResponse.json([])),
      http.get("*/api/admin/top10-nominations", ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("status"))
        return HttpResponse.json([])
      })
    )

    render()

    /* Klaerungsrunde zu KAN-40: ohne Parameter zeigt die Verwaltung die
       offenen Vorschlaege. */
    await waitFor(() => expect(seen[0]).toBe("PENDING"))

    await user.click(screen.getByRole("button", { name: "Abgelehnt" }))
    await waitFor(() => expect(seen).toContain("REJECTED"))
  })
})
