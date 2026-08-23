import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import EditorPage from "@/features/project-content/EditorPage"
import { person, projectDetail } from "@/tests/fixtures"
import {
  currentUserHandler,
  fileBlobHandler,
  projectBlocksHandler,
  projectCommentsHandler,
  projectDetailHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Die Inline-Bedienung der Galerie: Spaltenleiste am Raster, Unterschrift
 * und Alternativtexte als schlanke Felder darunter, kein Ausklapper mehr.
 * Gerendert wird ueber die ganze Seite, weil die Knotenansicht nur im
 * echten Editor entsteht (ReactNodeViewRenderer).
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const FILE_A = "f1f1f1f1-0000-4000-8000-00000000000a"
const FILE_B = "f1f1f1f1-0000-4000-8000-00000000000b"
const WAIT = { timeout: 20000 }

function galleryBlock(
  attrs: Partial<{
    items: { fileId: string; alt: string }[]
    columns: 2 | 3
    caption: string
  }> = {}
): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000003",
    type: "GALLERY",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "galleryBlock",
      attrs: {
        items: [
          { fileId: FILE_A, alt: "Aufbau" },
          { fileId: FILE_B, alt: "Ergebnis" },
        ],
        columns: 2,
        caption: "Messreihe",
        ...attrs,
      },
    },
  } as unknown as BlockResponse
}

function ownDraft(
  overrides: Partial<ProjectDetailResponse> = {}
): ProjectDetailResponse {
  return projectDetail({
    id: PROJECT_ID,
    title: "Beitrag im Entwurf",
    status: "DRAFT",
    author: person({ id: USER_ID, firstName: "Mira", lastName: "Beispiel" }),
    ...overrides,
  })
}

function renderEditor(project: ProjectDetailResponse, blocks: BlockResponse[]) {
  server.use(
    currentUserHandler({ id: USER_ID }),
    projectCommentsHandler(),
    projectBlocksHandler(blocks),
    projectDetailHandler(project),
    fileBlobHandler(),
    http.put("*/api/projects/:projectId/blocks", () =>
      HttpResponse.json({ version: 2, blocks })
    )
  )
  signInAs("STUDENT")
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/editor" element={<EditorPage />} />
    </Routes>,
    `/projects/${PROJECT_ID}/editor`
  )
}

describe("GalleryNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("stellt die Spalten direkt ueber die Leiste am Raster um", async () => {
    const { container } = renderEditor(ownDraft(), [galleryBlock()])

    await screen.findByRole("toolbar", { name: "Spalten" }, WAIT)

    /* Der fruehere Ausklapper existiert an der Galerie nicht mehr. */
    expect(
      screen.queryByText("Angaben zum Block Galerie")
    ).not.toBeInTheDocument()

    expect(screen.getByRole("button", { name: "2 Spalten" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    await userEvent.click(screen.getByRole("button", { name: "3 Spalten" }))

    await waitFor(() => {
      expect(container.querySelector("figure")).toHaveAttribute(
        "data-columns",
        "3"
      )
    })
    expect(screen.getByRole("button", { name: "3 Spalten" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    /* Die Aenderung ist rein visuell; die Live-Region sagt sie an. */
    expect(
      screen.getByText("Galerie auf 3 Spalten gestellt.")
    ).toBeInTheDocument()
  }, 60000)

  it("fuehrt Unterschrift und Alternativtexte als schlanke Felder unter dem Raster", async () => {
    renderEditor(ownDraft(), [galleryBlock()])

    const caption = await screen.findByLabelText(
      "Bildunterschrift der Galerie",
      undefined,
      WAIT
    )
    expect(caption).toHaveValue("Messreihe")

    /* Je Bild ein eigener Alternativtext (SC 1.1.1); die Pflicht bleibt
       auch ohne den Ausklapper. */
    expect(screen.getByLabelText("Bild 1")).toHaveValue("Aufbau")
    expect(screen.getByLabelText("Bild 2")).toHaveValue("Ergebnis")

    await userEvent.type(caption, " 2026")
    expect(caption).toHaveValue("Messreihe 2026")
  }, 60000)

  it("zeigt ohne Schreibrecht nur Raster und figcaption", async () => {
    const { container } = renderEditor(ownDraft({ status: "PUBLISHED" }), [
      galleryBlock(),
    ])

    await screen.findByRole("heading", { level: 1 }, WAIT)
    await waitFor(() => {
      expect(container.querySelectorAll("figure li").length).toBe(2)
    }, WAIT)

    expect(
      screen.queryByRole("toolbar", { name: "Spalten" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Bildunterschrift der Galerie")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Bild zur Galerie hinzufügen")
    ).not.toBeInTheDocument()
    expect(screen.getByText("Messreihe")).toBeInTheDocument()
  }, 60000)
})
