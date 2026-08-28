import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { Top10NominationResponse } from "@/api/types"
import ReviewListPage from "@/features/reviews/ReviewListPage"
import i18n from "@/i18n"
import { nomination, projectCard } from "@/tests/fixtures"
import { currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const EMPTY_PAGE = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
}

/**
 * Die Grundlast der Seite ohne Projektzeilen: der Nominierungsbereich ist
 * hier der Gegenstand, die Tabelle darueber bleibt leer.
 *
 * <p>Die Ueberschreibungen stehen <strong>vor</strong> den Basis-Handlern:
 * {@code server.use} nimmt den ersten passenden Handler der Liste.
 */
function handlers(
  nominations: Top10NominationResponse[],
  options: {
    role?: "EDITOR" | "ADMIN"
    top10Count?: number
    /** Belegte Plaetze mit echten Projekt-IDs, fuer die Platzanzeige. */
    top10?: { position: number; projectId: string }[]
  } = {}
) {
  const top10 =
    options.top10 !== undefined
      ? options.top10.map((entry) => ({
          position: entry.position,
          addedAt: "2026-01-01T10:00:00Z",
          project: projectCard({ id: entry.projectId }),
        }))
      : Array.from({ length: options.top10Count ?? 0 }, (_, index) => ({
          position: index + 1,
          addedAt: "2026-01-01T10:00:00Z",
          project: projectCard({ id: `top-${index}` }),
        }))
  return [
    http.get("*/api/top10-nominations", () => HttpResponse.json(nominations)),
    http.get("*/api/top10", () => HttpResponse.json(top10)),
    currentUserHandler({ role: options.role ?? "EDITOR" }),
    http.get("*/api/projects", () => HttpResponse.json(EMPTY_PAGE)),
    http.get("*/api/study-programs", () => HttpResponse.json([])),
    http.get("*/api/semesters", () => HttpResponse.json([])),
    http.get("*/api/modules", () => HttpResponse.json([])),
  ]
}

const PENDING = nomination({
  id: "n-pending",
  status: "PENDING",
  proposedTier: "TOP_1",
  project: projectCard({ id: "p-1", title: "RoboNav" }),
})

const ACCEPTED = nomination({
  id: "n-accepted",
  status: "ACCEPTED",
  proposedPosition: 3,
  proposedTier: "TOP_5",
  project: projectCard({ id: "p-2", title: "Klimadaten" }),
})

const REJECTED = nomination({
  id: "n-rejected",
  status: "REJECTED",
  project: projectCard({ id: "p-3", title: "Stadtlabor" }),
})

const WITHDRAWN = nomination({
  id: "n-withdrawn",
  status: "WITHDRAWN",
  project: projectCard({ id: "p-4", title: "Lichtwerk" }),
})

function panel(): HTMLElement {
  return screen
    .getByRole("heading", { name: i18n.t("review.nomination.own.title") })
    .closest("div[data-slot=card-content]") as HTMLElement
}

/**
 * Der zusammengelegte Nominierungsbereich von „Meine Reviews" (KAN-37,
 * Contract v70): eine Liste fuer laufende wie erledigte Vorschlaege, eine
 * Standsleiste darueber und das Zurueckziehen im Zeilenmenue.
 */
describe("NominationPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("EDITOR")
  })

  it("zeigt jeden Stand in einer Liste, ohne zweiten Verlaufsbereich", async () => {
    server.use(...handlers([PENDING, ACCEPTED, REJECTED, WITHDRAWN]))

    renderWithProviders(<ReviewListPage />, "/reviews")

    expect(await screen.findByText("RoboNav")).toBeInTheDocument()
    expect(screen.getByText("Klimadaten")).toBeInTheDocument()
    expect(screen.getByText("Stadtlabor")).toBeInTheDocument()
    expect(screen.getByText("Lichtwerk")).toBeInTheDocument()

    /* Der frühere zweite Kasten „Mein Nominierungs-Verlauf" zeigte
       dieselben Zeilen ein zweites Mal; er ist ersatzlos entfallen. */
    expect(screen.queryByText("Mein Nominierungs-Verlauf")).toBeNull()
  })

  it("nennt die belegten Plaetze der kuratierten Liste", async () => {
    server.use(...handlers([PENDING], { top10Count: 7 }))

    renderWithProviders(<ReviewListPage />, "/reviews")

    expect(
      await screen.findByText(
        i18n.t("review.nomination.own.places", { count: 7, total: 10 })
      )
    ).toBeInTheDocument()
  })

  it("filtert die Liste ueber die Standsleiste", async () => {
    server.use(...handlers([PENDING, ACCEPTED, REJECTED, WITHDRAWN]))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      within(panel()).getByRole("button", {
        name: i18n.t("top10.nominationStatus.ACCEPTED"),
      })
    )

    await waitFor(() => expect(screen.queryByText("RoboNav")).toBeNull())
    expect(screen.getByText("Klimadaten")).toBeInTheDocument()
  })

  it("erklaert einen leeren Ausschnitt, statt eine leere Flaeche zu zeigen", async () => {
    server.use(...handlers([PENDING]))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    await userEvent.click(
      within(panel()).getByRole("button", {
        name: i18n.t("top10.nominationStatus.REJECTED"),
      })
    )

    expect(
      await screen.findByText(
        i18n.t("review.nomination.own.emptyFiltered.REJECTED")
      )
    ).toBeInTheDocument()
  })

  it("zieht einen offenen Vorschlag nach Rueckfrage zurueck", async () => {
    const withdrawn: string[] = []
    server.use(
      http.post("*/api/top10-nominations/:id/withdraw", ({ params }) => {
        withdrawn.push(String(params.id))
        return HttpResponse.json({ ...PENDING, status: "WITHDRAWN" })
      }),
      ...handlers([PENDING])
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    /* Ein Klick, kein Menue: der Symbolknopf traegt die Handlung selbst. */
    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.nomination.withdraw.actionFor", {
          title: "RoboNav",
        }),
      })
    )

    /* Erst die Rueckfrage: der Vorgang laesst sich nicht rueckgaengig
       machen. */
    expect(
      await screen.findByRole("heading", {
        name: i18n.t("review.nomination.withdraw.title"),
      })
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("review.nomination.withdraw.confirm"),
      })
    )

    await waitFor(() => expect(withdrawn).toEqual(["n-pending"]))
  })

  it("bietet der Redaktion keinen Rueckzug bei entschiedenen Vorschlaegen", async () => {
    server.use(...handlers([ACCEPTED, REJECTED, WITHDRAWN]))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("Klimadaten")

    /* Kein Knopf, wo es nichts zu tun gibt: ein gesperrter Knopf an jeder
       zweiten Zeile waere Ruhe ohne Auskunft. */
    for (const title of ["Klimadaten", "Stadtlabor", "Lichtwerk"]) {
      expect(
        screen.queryByRole("button", {
          name: i18n.t("review.nomination.withdraw.actionFor", { title }),
        })
      ).toBeNull()
    }
  })

  it("bietet auch der Administration keinen Rueckzug bei entschiedenen Vorschlaegen", async () => {
    /*
     * Vorgabe zur Nacharbeit an KAN-87: zurueckgezogen wird nur der eigene
     * <em>offene</em> Vorschlag, und zwar unabhaengig von der Rolle. Bis
     * dahin durfte ein Admin-Konto einen eigenen angenommenen Vorschlag
     * zurueckziehen und nahm das Projekt damit nebenbei von der
     * oeffentlichen Startseite; dafuer gibt es „Vom Platz nehmen" in der
     * Platzliste. Der Server liesse es weiterhin zu (§3.11.1), die
     * Oberflaeche bietet es nicht mehr an.
     */
    signInAs("ADMIN")
    server.use(...handlers([ACCEPTED, REJECTED], { role: "ADMIN" }))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("Klimadaten")

    for (const title of ["Klimadaten", "Stadtlabor"]) {
      expect(
        screen.queryByRole("button", {
          name: i18n.t("review.nomination.withdraw.actionFor", { title }),
        })
      ).toBeNull()
    }
  })

  it("nennt bei einem angenommenen Vorschlag den Platz aus der kuratierten Liste", async () => {
    /*
     * Nicht proposedPosition, sondern der Platz, auf dem das Projekt jetzt
     * steht: die beiden laufen auseinander, sobald die Administration
     * umsortiert. Hier wurde auf Platz 3 angenommen und spaeter auf 7
     * geschoben; die Zeile soll sagen, wo es steht.
     */
    server.use(
      ...handlers([ACCEPTED], {
        top10: [{ position: 7, projectId: "p-2" }],
      })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("Klimadaten")

    expect(
      within(panel()).getByText(i18n.t("top10.position", { position: 7 }))
    ).toBeInTheDocument()
    expect(
      within(panel()).queryByText(i18n.t("top10.position", { position: 3 }))
    ).toBeNull()
  })

  it("nennt den entschiedenen Platz in der Vergangenheit, wenn das Projekt die Liste verlassen hat", async () => {
    server.use(...handlers([ACCEPTED], { top10: [] }))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("Klimadaten")

    expect(
      within(panel()).getByText(
        i18n.t("review.nomination.own.formerPosition", { position: 3 })
      )
    ).toBeInTheDocument()
  })

  it("nennt gar keinen Platz, wenn keiner entschieden wurde", async () => {
    /* proposedPosition bleibt nach §3.11.1 Regel 5 leer, wenn die
       Administration ueber PUT /admin/top10 direkt aufgenommen hat. Ein
       „Platz null" waere schlechter als keine Angabe. */
    const ohnePlatz = nomination({
      id: "n-ohne-platz",
      status: "ACCEPTED",
      proposedPosition: null,
      /* Der Titel enthaelt bewusst nicht das Wort „Platz": die Behauptung
         unten sucht danach im ganzen Bereich. */
      project: projectCard({ id: "p-9", title: "Direkt aufgenommen" }),
    })
    server.use(...handlers([ohnePlatz], { top10: [] }))

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("Direkt aufgenommen")

    expect(within(panel()).queryByText(/Platz/)).toBeNull()
  })

  it("nennt bei offenen und abgelehnten Vorschlaegen keinen Platz", async () => {
    server.use(
      ...handlers([PENDING, REJECTED], {
        top10: [{ position: 1, projectId: "p-1" }],
      })
    )

    renderWithProviders(<ReviewListPage />, "/reviews")
    await screen.findByText("RoboNav")

    expect(within(panel()).queryByText(/Platz/)).toBeNull()
  })
})
