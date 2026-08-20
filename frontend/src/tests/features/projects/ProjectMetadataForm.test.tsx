import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import type {
  ProjectDetailResponse,
  ProjectUpdateRequest,
  TagResponse,
} from "@/api/types"
import { ProjectMetadataForm } from "@/features/projects/ProjectMetadataForm"
import { projectDetail } from "@/tests/fixtures"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Der Exportvertrag aus KAN-35: die Komponente traegt keine Seitenhuelle und
 * setzt keine eigene Mutation ab. Beides wird hier geprueft, weil KAN-36
 * genau darauf baut, wenn es dieselben Felder als Dialog oeffnet.
 */

/** Die Kennung, die signInAs in die Sitzung legt. */
const SIGNED_IN_ID = "00000000-0000-0000-0000-000000000001"

const TAGS: TagResponse[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Nachhaltigkeit",
    usageCount: 12,
  },
]

function masterDataHandlers() {
  return [
    http.get("*/api/faculties", () => HttpResponse.json([])),
    http.get("*/api/categories", () => HttpResponse.json([])),
    http.get("*/api/semesters", () => HttpResponse.json([])),
    http.get("*/api/study-programs", () => HttpResponse.json([])),
    http.get("*/api/modules", () => HttpResponse.json([])),
    http.get("*/api/users/lookup", () => HttpResponse.json([])),
    http.get("*/api/tags", () => HttpResponse.json(TAGS)),
  ]
}

function renderForm(
  overrides: Partial<ProjectDetailResponse> = {},
  onSubmit: (
    request: ProjectUpdateRequest
  ) => Promise<ProjectDetailResponse> = (request) =>
    Promise.resolve(projectDetail({ ...overrides, version: request.version }))
) {
  server.use(...masterDataHandlers())
  signInAs("STUDENT")
  const project = projectDetail({
    id: "p-1",
    title: "Campus-Garten",
    status: "DRAFT",
    editors: [],
    /* Die angemeldete Person ist die Autor:in. Sonst greift die Schranke
       aus §5 Fussnote 3 („die Redaktion bestimmt die Autor:in"), und das
       Feld staende schreibgeschuetzt da. */
    author: {
      id: SIGNED_IN_ID,
      firstName: "Mira",
      lastName: "Beispiel",
      avatarUrl: null,
    },
    version: 3,
    ...overrides,
  })
  renderWithProviders(
    <ProjectMetadataForm
      project={project}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />
  )
  return project
}

describe("ProjectMetadataForm", () => {
  it("bringt weder Brotkrume noch Seitenueberschrift mit", async () => {
    renderForm()

    /* Die Huelle ist Sache der Route. Braechte die Komponente sie mit,
       stuende die Brotkrume spaeter im Editor-Dialog (KAN-36). */
    expect(await screen.findByLabelText("Projekttitel")).toBeVisible()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("gliedert die Abschnitte auf Ebene 2, damit die h1 der Route darueber steht", async () => {
    renderForm()

    await screen.findByLabelText("Projekttitel")
    for (const name of [
      "Vorschau",
      "Klassifikation",
      "Tags",
      "Redaktion",
      "Projektmitglieder",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
        name
      ).toBeVisible()
    }
  })

  it("setzt keine eigene Mutation ab, sondern reicht den Body an onSubmit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (request: ProjectUpdateRequest): Promise<ProjectDetailResponse> =>
        Promise.resolve(projectDetail({ version: request.version + 1 }))
    )
    renderForm({}, onSubmit)

    await user.click(
      await screen.findByRole("button", {
        name: "Speichern & weiter zum Editor",
      })
    )

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    /* version kommt aus dem Projekt, nie aus dem Formular (§6.4). */
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ version: 3 })
  })

  it("nutzt fuer die Tags die TagCombobox und sendet sie als Namen", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (request: ProjectUpdateRequest): Promise<ProjectDetailResponse> =>
        Promise.resolve(projectDetail({ version: request.version + 1 }))
    )
    renderForm({}, onSubmit)

    await user.click(await screen.findByLabelText("Schlagwörter"))
    await user.click(
      await screen.findByRole("option", { name: "Nachhaltigkeit" })
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Nachhaltigkeit entfernen" })
      ).toBeVisible()
    )

    await user.click(
      screen.getByRole("button", { name: "Speichern & weiter zum Editor" })
    )

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    /* Seit KAN-75 steht hinter jedem Tag eine Stammdatenzeile; die Anfrage
       traegt trotzdem Namen, das Aufloesen macht der Server (§3.19). */
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      tags: ["Nachhaltigkeit"],
    })
  })

  it("kennzeichnet die Pflichtfelder des Einreichens, ohne das Speichern zu sperren", async () => {
    renderForm()

    /* §3.3, seit Contract v59 einschliesslich editorIds. Text und Symbol,
       nicht Farbe allein (SC 1.4.1). */
    expect(
      await screen.findByText(
        "Mit * markierte Angaben brauchen Sie erst zum Einreichen, nicht zum Speichern."
      )
    ).toBeVisible()

    /*
     * Der Marker steht als Text im Label, nicht nur als Symbol, und er ist
     * erreichbar: ein sr-only-Text unter aria-hidden besteht getByText
     * anstandslos und wird trotzdem nie vorgelesen (Befund aus KAN-29).
     */
    const markers = screen.getAllByText("erforderlich zum Einreichen")
    expect(markers).toHaveLength(7)
    for (const marker of markers) {
      expect(marker.closest("[aria-hidden]")).toBeNull()
    }

    for (const label of [
      "Fakultät",
      "Studiengang",
      "Abschluss",
      "Semester",
      "Typ",
      "Kategorie",
      "Redakteur:in",
    ]) {
      expect(
        screen.getByLabelText(`${label} erforderlich zum Einreichen`),
        label
      ).toBeVisible()
    }

    /* Das Fach traegt keinen Stern: §3.3 fuehrt es als dauerhaft
       freiwilligen Bezug. */
    expect(screen.getByLabelText("Fach")).toBeVisible()

    /* Gespeichert wird trotzdem. */
    expect(
      screen.getByRole("button", { name: "Speichern & weiter zum Editor" })
    ).toBeEnabled()
  })
})
