import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { PageResponse } from "@/api/page"
import type { SupportRequestResponse } from "@/api/types"
import AdminSupportListPage from "@/features/administration/AdminSupportListPage"
import i18n from "@/i18n"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/** Das Admin-Konto, das die Staende gesetzt hat (Contract 3.20, seit v88). */
const HANDLER = { id: "ad-1", firstName: "Mira", lastName: "Beispiel" }

const OPEN_REQUEST: SupportRequestResponse = {
  id: "sr-1",
  name: "Lena Brandt",
  email: "lena.brandt@example.org",
  category: "TECHNICAL_ISSUE",
  subject: "Anmeldung schlaegt fehl",
  message: "Seit gestern komme ich nicht mehr in mein Portfolio.",
  status: "OPEN",
  submittedByUserId: null,
  /* Unberuehrt im Eingang: beide Felder stehen auf null und fehlen nicht
     (Jackson laeuft auf Include.ALWAYS, Contract 3.20). */
  handledBy: null,
  handledAt: null,
  createdAt: "2026-08-27T10:27:00Z",
  updatedAt: "2026-08-27T10:27:00Z",
}

const IN_PROGRESS_REQUEST: SupportRequestResponse = {
  ...OPEN_REQUEST,
  id: "sr-2",
  name: "Mert Yildiz",
  email: "mert.yildiz@example.org",
  category: "PROJECT_SUBMISSION",
  subject: "Projekt laesst sich nicht einreichen",
  status: "IN_PROGRESS",
  handledBy: HANDLER,
  handledAt: "2026-08-26T08:30:00Z",
  createdAt: "2026-08-26T07:14:00Z",
}

const RESOLVED_REQUEST: SupportRequestResponse = {
  ...OPEN_REQUEST,
  id: "sr-3",
  name: "Jonas Peters",
  email: "jonas.peters@example.org",
  category: "ACCOUNT_ACCESS",
  subject: "HSB-Adresse wird nicht bestaetigt",
  status: "RESOLVED",
  handledBy: HANDLER,
  handledAt: "2026-08-24T16:20:00Z",
  createdAt: "2026-08-24T14:02:00Z",
}

function pageOf(
  content: SupportRequestResponse[]
): PageResponse<SupportRequestResponse> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

/**
 * Die Liste beantwortet zwei Abfragen desselben Pfades: die angezeigte Seite
 * und die Zaehlung „N offen" ({@code status=OPEN&size=1}). Der Handler
 * unterscheidet sie an den Parametern, damit beide Zahlen im Test dasselbe
 * bedeuten wie in der Anwendung.
 */
function listHandler(all: SupportRequestResponse[]) {
  return http.get("*/api/admin/support", ({ request }) => {
    const params = new URL(request.url).searchParams
    const status = params.get("status")
    const filtered =
      status === null ? all : all.filter((entry) => entry.status === status)

    if (params.get("size") === "1") {
      return HttpResponse.json({ ...pageOf(filtered), size: 1 })
    }
    return HttpResponse.json(pageOf(filtered))
  })
}

function baseHandlers(all: SupportRequestResponse[]) {
  return [currentUserHandler({ role: "ADMIN" }), listHandler(all)]
}

/**
 * Die Karte einer Anfrage, ueber ihre Betreffzeile gefunden.
 *
 * <p>Die Aktionen in der Karte heissen teils wie die Segmente der
 * Filterleiste darueber („In Bearbeitung"); ohne diese Eingrenzung traefe eine
 * Suche ueber die ganze Seite das falsche Element und der Test filterte, statt
 * den Stand zu setzen.
 */
async function cardOf(request: SupportRequestResponse): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: request.subject })
  return heading.closest("li") as HTMLElement
}

/**
 * Die Support-Verwaltung der Administrationsseite (§6.1 Abschnitt „Support",
 * §2.15; KAN-85).
 */
describe("AdminSupportListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("zaehlt die offenen Anfragen im Kopfbereich", async () => {
    server.use(
      ...baseHandlers([OPEN_REQUEST, IN_PROGRESS_REQUEST, RESOLVED_REQUEST])
    )

    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    expect(await screen.findByText("1 offen")).toBeInTheDocument()
  })

  /**
   * §2.15: Aus {@code OPEN} stehen beide Wege da, aus {@code IN_PROGRESS} nur
   * der Abschluss, aus {@code RESOLVED} nur der Weg zurueck. Die Oberflaeche
   * bietet nie einen Uebergang an, den der Server mit 409 beantworten wuerde.
   */
  it("zeigt je Bearbeitungsstand die erlaubten Schaltflaechen", async () => {
    server.use(
      ...baseHandlers([OPEN_REQUEST, IN_PROGRESS_REQUEST, RESOLVED_REQUEST])
    )

    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    const open = within(await cardOf(OPEN_REQUEST))
    expect(
      open.getByRole("button", { name: "In Bearbeitung" })
    ).toBeInTheDocument()
    expect(
      open.getByRole("button", { name: "Als erledigt markieren" })
    ).toBeInTheDocument()
    expect(
      open.queryByRole("button", { name: "Wieder öffnen" })
    ).not.toBeInTheDocument()

    const inProgress = within(await cardOf(IN_PROGRESS_REQUEST))
    expect(
      inProgress.getByRole("button", { name: "Als erledigt markieren" })
    ).toBeInTheDocument()
    expect(
      inProgress.queryByRole("button", { name: "In Bearbeitung" })
    ).not.toBeInTheDocument()

    const resolved = within(await cardOf(RESOLVED_REQUEST))
    expect(
      resolved.getByRole("button", { name: "Wieder öffnen" })
    ).toBeInTheDocument()
    expect(
      resolved.queryByRole("button", { name: "Als erledigt markieren" })
    ).not.toBeInTheDocument()
  })

  it("zeigt den Leerzustand bei leerer Antwort", async () => {
    server.use(...baseHandlers([]))

    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    expect(
      await screen.findByText("Keine Support-Anfragen vorhanden.")
    ).toBeInTheDocument()
    expect(screen.getByText("0 offen")).toBeInTheDocument()
  })

  it("schickt den Statuswechsel und meldet ihn in einer Live-Region", async () => {
    const patched: unknown[] = []
    server.use(
      ...baseHandlers([OPEN_REQUEST]),
      http.patch("*/api/admin/support/sr-1", async ({ request }) => {
        patched.push(await request.json())
        return HttpResponse.json({
          ...OPEN_REQUEST,
          status: "IN_PROGRESS",
          handledBy: HANDLER,
          handledAt: "2026-08-27T12:40:00Z",
        })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    /* Innerhalb der Karte suchen: „In Bearbeitung" heisst auch das Segment
       der Filterleiste darueber, und ein Klick darauf filtert nur. */
    await user.click(
      within(await cardOf(OPEN_REQUEST)).getByRole("button", {
        name: "In Bearbeitung",
      })
    )

    expect(patched).toEqual([{ status: "IN_PROGRESS" }])
    expect(
      await screen.findByText(
        `Anfrage „${OPEN_REQUEST.subject}“ steht jetzt auf In Bearbeitung,` +
          " bearbeitet von Ihnen."
      )
    ).toBeInTheDocument()
  })

  /**
   * §2.15: geloescht wird endgueltig, es gibt keinen Archivzustand. Deshalb
   * steht vor dem Papierkorb eine Rueckfrage, wie an den uebrigen
   * Verwaltungslisten.
   */
  it("fragt vor dem Loeschen nach und loescht erst nach der Bestaetigung", async () => {
    const deleted: string[] = []
    server.use(
      ...baseHandlers([OPEN_REQUEST]),
      http.delete("*/api/admin/support/sr-1", () => {
        deleted.push("sr-1")
        return new HttpResponse(null, { status: 204 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    await user.click(
      await screen.findByRole("button", {
        name: `Anfrage „${OPEN_REQUEST.subject}“ löschen`,
      })
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Anfrage löschen?")).toBeInTheDocument()
    expect(deleted).toHaveLength(0)

    await user.click(
      within(dialog).getByRole("button", { name: "Endgültig löschen" })
    )

    expect(deleted).toEqual(["sr-1"])
  })

  it("bricht das Loeschen ab, ohne zu senden", async () => {
    server.use(...baseHandlers([OPEN_REQUEST]))

    const user = userEvent.setup()
    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    await user.click(
      await screen.findByRole("button", {
        name: `Anfrage „${OPEN_REQUEST.subject}“ löschen`,
      })
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  /**
   * §3.20: Geantwortet wird ausserhalb der Anwendung. Das Briefsymbol ist
   * deshalb ein {@code mailto:}-Verweis an die absendende Person und keine
   * Schaltflaeche, die etwas ausloest.
   */
  it("verweist mit dem Briefsymbol ins Mailprogramm der absendenden Person", async () => {
    server.use(...baseHandlers([OPEN_REQUEST]))

    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    const link = await screen.findByRole("link", {
      name: `Per E-Mail an ${OPEN_REQUEST.name} antworten`,
    })
    expect(link).toHaveAttribute(
      "href",
      `mailto:${encodeURIComponent(OPEN_REQUEST.email)}?subject=${encodeURIComponent(
        `Ihre Support-Anfrage: ${OPEN_REQUEST.subject}`
      )}`
    )
  })

  it("schraenkt ueber den Statusfilter ein und schreibt ihn in die Adresse", async () => {
    server.use(
      ...baseHandlers([OPEN_REQUEST, IN_PROGRESS_REQUEST, RESOLVED_REQUEST])
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    await screen.findByRole("heading", { name: OPEN_REQUEST.subject })
    await user.click(screen.getByRole("button", { name: "Erledigt" }))

    expect(
      await screen.findByRole("heading", { name: RESOLVED_REQUEST.subject })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: OPEN_REQUEST.subject })
    ).not.toBeInTheDocument()
  })

  /**
   * Contract 3.20 seit v88: was der Name bedeutet, sagt der Stand daneben.
   * Die Karte formuliert deshalb je Stand anders und nicht einmal blass.
   */
  it("nennt je Stand, wer gehandelt hat", async () => {
    server.use(
      ...baseHandlers([OPEN_REQUEST, IN_PROGRESS_REQUEST, RESOLVED_REQUEST])
    )

    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    const inProgress = within(await cardOf(IN_PROGRESS_REQUEST))
    expect(
      inProgress.getByText(/In Bearbeitung von Mira Beispiel seit/)
    ).toBeInTheDocument()

    const resolved = within(await cardOf(RESOLVED_REQUEST))
    expect(
      resolved.getByText(/Erledigt von Mira Beispiel am/)
    ).toBeInTheDocument()
  })

  /** Eine unberuehrte Anfrage zeigt keinen Namen, auch keinen leeren. */
  it("zeigt an einer offenen Anfrage keine Zustaendigkeit", async () => {
    server.use(...baseHandlers([OPEN_REQUEST]))

    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    const open = within(await cardOf(OPEN_REQUEST))
    expect(open.queryByText(/Mira Beispiel/)).not.toBeInTheDocument()
    expect(open.queryByText(/In Bearbeitung von/)).not.toBeInTheDocument()
  })

  it("zeigt einen 409 beim Statuswechsel als Meldung", async () => {
    server.use(
      ...baseHandlers([OPEN_REQUEST]),
      http.patch("*/api/admin/support/sr-1", () =>
        apiErrorResponse(
          409,
          "SUPPORT_STATUS_TRANSITION_INVALID",
          "/api/admin/support/sr-1"
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSupportListPage />, "/administration/support")

    await user.click(
      within(await cardOf(OPEN_REQUEST)).getByRole("button", {
        name: "In Bearbeitung",
      })
    )

    expect(
      await screen.findByText(
        "Dieser Bearbeitungsstand lässt sich von hier aus nicht setzen. Bitte laden Sie die Liste neu."
      )
    ).toBeInTheDocument()
  })
})
