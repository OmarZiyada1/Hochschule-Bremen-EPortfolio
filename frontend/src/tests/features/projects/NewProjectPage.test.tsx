import { screen, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { http, HttpResponse } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import NewProjectPage from "@/features/projects/NewProjectPage"
import { projectDetail } from "@/tests/fixtures"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { LocationProbe, signInAs } from "@/tests/routes/helpers"

/*
 * /projects/new legt an und leitet weiter; ein Formular steht dort nicht
 * (KAN-35). Geprueft wird der Body, die Weiterleitung und dass genau ein
 * Projekt entsteht.
 */

const NEW_PROJECT_ID = "1c2b3a4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

let bodies: unknown[] = []

function renderNewProject() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/new"
        element={
          <>
            <NewProjectPage />
            <LocationProbe />
          </>
        }
      />
      {/* Auffangroute, damit die Adresse nach der Weiterleitung ablesbar
          bleibt. */}
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    "/projects/new"
  )
}

describe("NewProjectPage", () => {
  beforeEach(() => {
    bodies = []
  })

  it("legt das Projekt an und fuehrt sofort auf seine Metadatenseite", async () => {
    signInAs("STUDENT")
    server.use(
      http.post("*/api/projects", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(
          projectDetail({ id: NEW_PROJECT_ID, title: "Unbenanntes Projekt" }),
          { status: 201 }
        )
      })
    )

    renderNewProject()

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        `/projects/${NEW_PROJECT_ID}/metadata`
      )
    )

    /* Titel ist das einzige Pflichtfeld beim Anlegen (§3.3); alles Weitere
       wird auf der Metadatenseite gepflegt. */
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toEqual({ title: "Unbenanntes Projekt" })
  })

  it("legt genau ein Projekt an, obwohl StrictMode den Effekt zweimal einhaengt", async () => {
    signInAs("STUDENT")
    server.use(
      http.post("*/api/projects", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(projectDetail({ id: NEW_PROJECT_ID }), {
          status: 201,
        })
      })
    )

    /*
     * Die Anwendung laeuft unter StrictMode (main.tsx), und der haengt
     * Effekte im Entwicklungsbetrieb zweimal ein. Ohne die Ref-Sperre in der
     * Komponente entstuenden bei jedem Aufruf zwei Projekte, und das faellt
     * erst in der Projektliste auf.
     */
    renderWithProviders(
      <StrictMode>
        <Routes>
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </StrictMode>,
      "/projects/new"
    )

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0))
    expect(bodies).toHaveLength(1)
  })

  it("macht einen 403 NO_PERMISSION sichtbar, statt leer zu bleiben", async () => {
    signInAs("STUDENT")
    server.use(
      http.post("*/api/projects", () =>
        apiErrorResponse(403, "NO_PERMISSION", "/api/projects")
      )
    )

    renderNewProject()

    /* Die Sichtbarkeitsregel im Routing ist Bequemlichkeit, keine
       Sicherheitsmassnahme (§5): ein trotzdem eintreffender 403 erscheint. */
    expect(
      await screen.findByText("Dafür fehlt Ihnen die Berechtigung.")
    ).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Zurück zum Portfolio" })
    ).toBeVisible()
    /* Und die Adresse bleibt stehen, damit der Vorgang nachvollziehbar ist. */
    expect(screen.getByTestId("pathname")).toHaveTextContent("/projects/new")
  })
})
