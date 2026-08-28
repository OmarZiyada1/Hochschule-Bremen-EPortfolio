import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EditLockGate } from "@/features/project-content/components/EditLockGate"
import { apiErrorResponse, editLockHandler } from "@/tests/msw/handlers"
import { renderWithProviders } from "@/tests/render"
import { LocationProbe, signInAs } from "@/tests/routes/helpers"
import { server } from "@/tests/msw/server"

/**
 * Das Gatter vor jeder Schreibansicht eines Projekts (§6.9, KAN-86).
 *
 * <p>Geprueft wird die sichtbare Zusage: an einem Beitrag schreibt jeweils
 * eine Person, und wer nicht drankommt, erfaehrt auf wen zu warten ist. Die
 * Durchsetzung selbst liegt im Server (§6.1) und wird dort geprueft; hier
 * geht es darum, dass die Schreibflaeche gar nicht erst entsteht und, wenn
 * sie einmal steht, nicht wieder verschwindet.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const OTHER_PROJECT_ID = "1f9d7a10-0000-0000-0000-0000000000ff"

const OTHER = {
  userId: "99999999-9999-4999-8999-999999999999",
  firstName: "Jo",
  lastName: "Schmidt",
}

const SELF = {
  userId: "00000000-0000-0000-0000-000000000001",
  firstName: "Mira",
  lastName: "Beispiel",
}

/** Eine Antwort im Format aus §6.9. */
function lockResponse(holder: typeof OTHER, heldBySelf: boolean) {
  return HttpResponse.json({
    holder: { ...holder, since: "2026-08-27T10:00:00Z" },
    heldBySelf,
  })
}

function renderGate(projectId = PROJECT_ID) {
  signInAs("STUDENT")
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:projectId/editor"
        element={
          <EditLockGate projectId={projectId} fallback={<p>Wird geladen …</p>}>
            <h1>Schreibflaeche</h1>
          </EditLockGate>
        }
      />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    `/projects/${projectId}/editor`
  )
}

describe("EditLockGate", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("laesst die Schreibansicht entstehen, wenn die eigene Sitzung haelt", async () => {
    server.use(...editLockHandler())
    renderGate()

    expect(
      await screen.findByRole("heading", { name: "Schreibflaeche" })
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Wird gerade bearbeitet" })
    ).not.toBeInTheDocument()
  })

  it("zeigt statt der Schreibansicht, wer den Beitrag seit wann haelt", async () => {
    server.use(...editLockHandler(OTHER))
    renderGate()

    /* Ebene 1 und kein Dialog: die Seite besteht in diesem Zustand aus
       nichts anderem, und eine main-Landmarke ohne Ueberschrift haette
       keinen Sprungpunkt (SC 1.3.1). */
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Wird gerade bearbeitet",
    })
    expect(heading).toBeVisible()
    /* Name und Beginn stehen in der Beschreibung; §6.9 fuehrt since als
       Beginn der Sperre und nicht als letzten Herzschlag. Der zweite
       Treffer auf den Namen ist die Live-Region, die den Ausgang eines
       Versuchs ansagt. */
    expect(
      screen.getByText(/^Jo Schmidt bearbeitet diesen Beitrag seit \d{2}:\d{2} Uhr\./)
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Schreibflaeche" })
    ).not.toBeInTheDocument()
  })

  it("oeffnet, sobald die Sperre frei geworden ist", async () => {
    /* Im Betrieb bemerkt das der Herzschlag von selbst; hier geht der Knopf
       denselben Weg sofort. */
    let held = true
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () =>
        held ? lockResponse(OTHER, false) : lockResponse(SELF, true)
      ),
      http.delete(
        "*/api/projects/:projectId/edit-lock",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    renderGate()

    await screen.findByRole("heading", { name: "Wird gerade bearbeitet" })
    held = false
    await userEvent.click(
      screen.getByRole("button", { name: "Erneut versuchen" })
    )

    expect(
      await screen.findByRole("heading", { name: "Schreibflaeche" })
    ).toBeVisible()
  })

  it("haelt den Herzschlag im Takt und bemerkt das Freiwerden von selbst", async () => {
    let calls = 0
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () => {
        calls = calls + 1
        return calls === 1
          ? lockResponse(OTHER, false)
          : lockResponse(SELF, true)
      }),
      http.delete(
        "*/api/projects/:projectId/edit-lock",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    /* Die Uhr muss vor dem Rendern gestellt sein, sonst haengt der schon
       gesetzte Zeitgeber der Query an der echten. shouldAdvanceTime laesst
       die Zeit daneben real laufen, damit MSW und die Promises der Query
       weiterkommen. */
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderGate()
    await screen.findByRole("heading", { name: "Wird gerade bearbeitet" })

    /* Zehn Sekunden weiter, ohne dass jemand etwas anklickt: der Takt aus
       §6.9 fragt erneut, und die wartende Seite oeffnet sich. */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000)
    })

    expect(
      await screen.findByRole("heading", { name: "Schreibflaeche" })
    ).toBeVisible()
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it("laesst die Schreibflaeche stehen, wenn die Sperre unterwegs verloren geht", async () => {
    /*
     * Der teuerste Fall: ein gedrosselter Hintergrundtab, ein Ruhezustand
     * oder ein Netzwechsel laesst die Frist ablaufen, waehrend die Person am
     * Text sitzt. Wuerde das Gatter jetzt abraeumen, waere der ungespeicherte
     * Text weg und die Fehlermeldung des letzten Speicherversuchs mit ihm.
     */
    let mine = true
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () =>
        mine ? lockResponse(SELF, true) : lockResponse(OTHER, false)
      ),
      http.delete(
        "*/api/projects/:projectId/edit-lock",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderGate()
    await screen.findByRole("heading", { name: "Schreibflaeche" })

    mine = false
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000)
    })

    /* Der Hinweis legt sich darueber, die Schreibflaeche bleibt stehen. */
    expect(
      await screen.findByRole("alertdialog", undefined, { timeout: 3000 })
    ).toHaveTextContent("Jo Schmidt")
    /* Ueber getByText und nicht ueber die Rolle: ein modaler Dialog nimmt
       den Rest der Seite aus dem Accessibility-Baum, im DOM steht der Text
       aber weiter, und genau darum geht es. */
    expect(screen.getByText("Schreibflaeche")).toBeInTheDocument()

    /* Und nach dem Wegklicken ist er auch wieder bedienbar: der Hinweis
       nimmt den Text nicht weg, er legt sich nur davor. */
    await userEvent.keyboard("{Escape}")
    expect(
      await screen.findByRole("heading", { name: "Schreibflaeche" })
    ).toBeVisible()
  })

  it("fuehrt der Weg hinaus auf die Detailseite des Projekts", async () => {
    server.use(...editLockHandler(OTHER))
    renderGate()

    await screen.findByRole("heading", { name: "Wird gerade bearbeitet" })
    await userEvent.click(screen.getByRole("button", { name: "Zum Projekt" }))

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        `/projects/${PROJECT_ID}`
      )
    )
  })

  it("sperrt nicht, wenn sich die Sperre gar nicht beanspruchen laesst", async () => {
    /*
     * 403, 404 und 409 sind keine Sperrfaelle: dahinter steht kein anderer
     * Mensch, sondern ein fehlendes Recht, ein fehlendes Projekt oder ein
     * Status, in dem ohnehin niemand schreibt. Die Seite dahinter zeigt
     * dann ihre eigene Meldung, und entschieden wird ohnehin im Server.
     */
    let calls = 0
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () => {
        calls = calls + 1
        return apiErrorResponse(
          409,
          "PROJECT_STATUS_NOT_EDITABLE",
          `/api/projects/${PROJECT_ID}/edit-lock`
        )
      })
    )
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderGate()

    expect(
      await screen.findByRole("heading", { name: "Schreibflaeche" })
    ).toBeVisible()

    /* Und der Takt haelt an: ein Status, der die Bearbeitung verwehrt,
       bessert sich nicht in dreissig Sekunden, und ein Herzschlag alle zehn
       liefe im Hintergrundtab endlos weiter. */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31000)
    })
    expect(calls).toBe(1)
  })

  it("gibt die eigene Sperre beim Verlassen der Seite frei", async () => {
    const released: string[] = []
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () =>
        lockResponse(SELF, true)
      ),
      http.delete("*/api/projects/:projectId/edit-lock", ({ params }) => {
        released.push(String(params.projectId))
        return new HttpResponse(null, { status: 204 })
      })
    )
    const { unmount } = renderGate()
    await screen.findByRole("heading", { name: "Schreibflaeche" })

    unmount()

    /* Verzoegert, damit der Wechsel zwischen Editor und Metadatenseite die
       eigene Sperre nicht wegwirft; deshalb wird gewartet und nicht sofort
       geprueft. */
    await waitFor(() => expect(released).toEqual([PROJECT_ID]), {
      timeout: 3000,
    })
  })

  it("gibt beim sofortigen Wiedereintritt nicht frei", async () => {
    /*
     * Der Weg Editor nach Metadatenseite: der eine Hook raeumt ab, waehrend
     * der andere beansprucht. Gaebe die Freigabe hier hinaus, sperrte die
     * Sitzung sich selbst aus, bis die Frist ablaeuft.
     */
    const released: string[] = []
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () =>
        lockResponse(SELF, true)
      ),
      http.delete("*/api/projects/:projectId/edit-lock", ({ params }) => {
        released.push(String(params.projectId))
        return new HttpResponse(null, { status: 204 })
      })
    )
    const first = renderGate()
    await screen.findByRole("heading", { name: "Schreibflaeche" })

    first.unmount()
    renderGate()
    await screen.findByRole("heading", { name: "Schreibflaeche" })

    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(released).toEqual([])
  })

  it("gibt beim Wechsel auf ein anderes Projekt die richtige Sperre frei", async () => {
    const released: string[] = []
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () =>
        lockResponse(SELF, true)
      ),
      http.delete("*/api/projects/:projectId/edit-lock", ({ params }) => {
        released.push(String(params.projectId))
        return new HttpResponse(null, { status: 204 })
      })
    )
    const first = renderGate()
    await screen.findByRole("heading", { name: "Schreibflaeche" })

    first.unmount()
    renderGate(OTHER_PROJECT_ID)
    await screen.findByRole("heading", { name: "Schreibflaeche" })

    /* Die Freigabe des ersten Projekts geht hinaus, die des zweiten nicht:
       das eine ist verlassen, das andere gerade beansprucht. */
    await waitFor(() => expect(released).toEqual([PROJECT_ID]), {
      timeout: 3000,
    })
  })

  it("gibt nichts frei, was diese Sitzung nie gehalten hat", async () => {
    const released: string[] = []
    server.use(
      http.post("*/api/projects/:projectId/edit-lock", () =>
        lockResponse(OTHER, false)
      ),
      http.delete("*/api/projects/:projectId/edit-lock", ({ params }) => {
        released.push(String(params.projectId))
        return new HttpResponse(null, { status: 204 })
      })
    )
    const { unmount } = renderGate()
    await screen.findByRole("heading", { name: "Wird gerade bearbeitet" })

    unmount()

    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(released).toEqual([])
  })
})
