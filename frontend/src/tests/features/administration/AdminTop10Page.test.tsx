import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import AdminTop10Page from "@/features/administration/AdminTop10Page"
import i18n from "@/i18n"
import { nomination, person, projectCard, top10Entry } from "@/tests/fixtures"
import {
  apiErrorResponse,
  currentUserHandler,
  top10AdminHandlers,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Dieselbe Kennung, die currentUserHandler vergibt. Sie wird gebraucht, seit
 * der Rueckzug nur noch am eigenen Vorschlag angeboten wird (Nacharbeit an
 * KAN-87): ohne uebereinstimmende ID gilt jeder Vorschlag als fremd.
 */
const ADMIN_ID = "00000000-0000-0000-0000-000000000001"

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

    await user.click(within(dialog).getByRole("button", { name: "Annehmen" }))

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

  /*
   * Ticket KAN-40, Test 2, in der Fassung nach der Nacharbeit: es gibt
   * keinen Knopf „Reihenfolge speichern" mehr, jede Bewegung wirkt sofort.
   */
  it("speichert jeden Zug sofort und schickt die vollstaendige Belegung", async () => {
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

    expect(
      screen.queryByRole("button", { name: "Reihenfolge speichern" })
    ).not.toBeInTheDocument()

    await user.click(
      await screen.findByRole("button", {
        name: "BremenConnect von Platz 2 nach oben",
      })
    )

    await waitFor(() => expect(calls).toHaveLength(1))
    /* §3.11.1 Regel 3: die Belegung, kein position-Parameter. */
    expect(calls[0]).toEqual({ projectIds: ["p-2", "p-1", "p-3"] })
  })

  /*
   * Ein Klick ist genau ein Platz, auch wenn der Nachbar frei ist. Seit
   * Contract v78 traegt die Nutzlast den freien Platz als null mit, der Zug
   * ist damit speicherbar.
   */
  it("rueckt einen Schritt in einen freien Platz und traegt ihn als null mit", async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []

    server.use(
      ...base([
        top10Entry({ position: 1, project: SMART }),
        top10Entry({ position: 4, project: GREEN }),
      ]),
      http.put("*/api/admin/top10", async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json([
          top10Entry({ position: 1, project: SMART }),
          top10Entry({ position: 3, project: GREEN }),
        ])
      })
    )

    render()

    await user.click(
      await screen.findByRole("button", {
        name: "GreenRoute von Platz 4 nach oben",
      })
    )

    await waitFor(() => expect(calls).toHaveLength(1))
    /* Von Platz 4 auf Platz 3, nicht ueber die Luecke hinweg auf Platz 2. */
    expect(calls[0]).toEqual({ projectIds: ["p-1", null, "p-3"] })
  })

  /* Ticket KAN-40, Test 3, in der Fassung nach der Nacharbeit. */
  it("sperrt Platz 1 nach oben und Platz 10 nach unten", async () => {
    server.use(
      ...base(
        Array.from({ length: 10 }, (_, index) =>
          top10Entry({
            position: index + 1,
            project: projectCard({
              id: `p${index}`,
              title: `Projekt ${index}`,
            }),
          })
        )
      )
    )

    render()

    expect(
      await screen.findByRole("button", {
        name: "Projekt 0 von Platz 1 nach oben",
      })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Projekt 9 von Platz 10 nach unten" })
    ).toBeDisabled()
    /* Dazwischen ist jeder Zug moeglich. */
    expect(
      screen.getByRole("button", { name: "Projekt 4 von Platz 5 nach oben" })
    ).toBeEnabled()
  })

  /* Ticket KAN-40, Test 4. */
  it("stellt eine Luecke mitten in der Liste dar", async () => {
    server.use(
      ...base([
        top10Entry({ position: 1, project: SMART }),
        top10Entry({ position: 3, project: GREEN }),
      ])
    )

    /* Zehn Plaetze, davon acht frei: ein freier Platz steht als eigener
       Eintrag da und nicht als leere Flaeche (SC 1.3.1). Die Luecke liegt
       auf Platz 2, mitten in der Liste. */
    render()

    expect(await screen.findAllByText("Platz frei")).toHaveLength(8)
    const slots = within(
      screen.getByRole("list", { name: "Plätze der Top 10" })
    ).getAllByRole("listitem")
    expect(slots[1]).toHaveTextContent("Platz frei")
    expect(slots[2]).toHaveTextContent("GreenRoute")
  })

  /*
   * Entfernen fragt zurueck und laesst den Platz danach frei; die uebrigen
   * Eintraege ruecken nicht nach (§3.11, Contract v78).
   */
  it("nimmt ein Projekt nach einer Rueckfrage vom Platz und laesst ihn frei", async () => {
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
          top10Entry({ position: 1, project: SMART }),
          top10Entry({ position: 3, project: GREEN }),
        ])
      })
    )

    render()

    await user.click(
      await screen.findByRole("button", {
        name: "BremenConnect von seinem Platz nehmen",
      })
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("BremenConnect")
    /* Vor der Bestaetigung geht nichts hinaus. */
    expect(calls).toHaveLength(0)

    await user.click(
      within(dialog).getByRole("button", { name: "Vom Platz nehmen" })
    )

    await waitFor(() => expect(calls).toHaveLength(1))
    /* Platz 2 bleibt frei, GreenRoute behaelt Platz 3. */
    expect(calls[0]).toEqual({ projectIds: ["p-1", null, "p-3"] })
  })

  /* Ticket KAN-40, Test 5. */
  it("bietet bei zehn belegten Plaetzen keinen elften Eintrag an", async () => {
    server.use(
      ...base(
        Array.from({ length: 10 }, (_, index) =>
          top10Entry({
            position: index + 1,
            project: projectCard({
              id: `p${index}`,
              title: `Projekt ${index}`,
            }),
          })
        )
      )
    )

    render()

    expect(
      await screen.findByText(/Alle zehn Plätze sind belegt/)
    ).toBeVisible()
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
      await within(dialog).findByText(
        "Der Platz muss zwischen 1 und 10 liegen."
      )
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

  /*
   * Ticket KAN-40, Test 10, verengt mit der Nacharbeit an KAN-87:
   * zurueckgezogen wird nur der eigene Vorschlag.
   */
  /*
   * Vorgabe zur Nacharbeit an KAN-87: in der Top-10-Verwaltung wird
   * angenommen und abgelehnt, nie zurueckgezogen. Bis dahin trug ein eigener
   * Vorschlag hier einen Rueckzugsknopf, und an einem angenommenen nahm er
   * das Projekt nebenbei von der oeffentlichen Startseite; dafuer gibt es
   * „Vom Platz nehmen" in der Platzliste. Wer seinen eigenen Vorschlag
   * zurueckholen will, tut das in „Meine Reviews", und nur solange er offen
   * ist.
   */
  it("bietet auch am eigenen Vorschlag kein Zurueckziehen an", async () => {
    const own = nomination({
      id: "n-2",
      project: projectCard({ id: "p-1", title: "SmartCampus" }),
      nominatedBy: person({ id: ADMIN_ID }),
      status: "ACCEPTED",
      proposedPosition: 1,
    })

    server.use(
      currentUserHandler({ role: "ADMIN", id: ADMIN_ID }),
      ...top10AdminHandlers({
        entries: [top10Entry({ position: 1, project: SMART })],
        nominations: [own],
      })
    )

    render("/administration/top10?status=ACCEPTED")

    expect(await screen.findByText("Angenommen")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /zurückziehen/i })
    ).not.toBeInTheDocument()
  })

  /*
   * Nacharbeit an KAN-87. Der Server liesse die Administration jeden
   * Vorschlag zurueckziehen (§3.11.1), die Oberflaeche bietet es bewusst
   * nicht an: ein fremder Vorschlag wird abgelehnt, nicht zurueckgezogen,
   * sonst stuende im Protokoll „zurueckgezogen" fuer eine Entscheidung, die
   * die vorschlagende Person nie getroffen hat (§3.17). Ein bereits
   * aufgenommenes Projekt verlaesst die Liste ueber „Vom Platz nehmen".
   */
  it("bietet an einem fremden Vorschlag kein Zurueckziehen an", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN", id: ADMIN_ID }),
      ...top10AdminHandlers({
        entries: [top10Entry({ position: 1, project: SMART })],
        nominations: [
          nomination({
            id: "n-4",
            project: projectCard({ id: "p-1", title: "SmartCampus" }),
            nominatedBy: person({ id: "p-fremd" }),
            status: "ACCEPTED",
            proposedPosition: 1,
          }),
        ],
      })
    )

    render("/administration/top10?status=ACCEPTED")

    expect(await screen.findByText("Angenommen")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /zurückziehen/i })
    ).not.toBeInTheDocument()
  })

  it("bietet an einem fremden offenen Vorschlag nur Annehmen und Ablehnen an", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN", id: ADMIN_ID }),
      ...top10AdminHandlers({
        nominations: [nomination({ id: "n-5", nominatedBy: person() })],
      })
    )

    render("/administration/top10?status=PENDING")

    expect(
      await screen.findByRole("button", { name: "Annehmen" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ablehnen" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /zurückziehen/i })
    ).not.toBeInTheDocument()
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
