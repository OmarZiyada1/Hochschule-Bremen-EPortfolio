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
  projectDetailHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Die Inline-Bedienung des Bildblocks: Breitenleiste am Bild, Alternativtext
 * und Bildunterschrift direkt darunter, kein Ausklapper mehr. Gerendert wird
 * ueber die ganze Seite, weil die Knotenansicht nur im echten Editor
 * entsteht (ReactNodeViewRenderer); die Grenzen sind grosszuegig wie in
 * EditorPage.test.tsx, das ProseMirror-Schema ist gross.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const FILE_ID = "f1f1f1f1-0000-4000-8000-000000000001"
const WAIT = { timeout: 20000 }

function imageBlock(
  attrs: Partial<{
    fileId: string | null
    alt: string
    caption: string
    width: 100 | 75 | 50
  }> = {}
): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
    type: "IMAGE",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "imageBlock",
      attrs: {
        fileId: FILE_ID,
        alt: "Ein Messaufbau",
        caption: "Abbildung 1",
        width: 100,
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

describe("ImageNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("setzt die Breite direkt ueber die Leiste am Bild, mit aria-pressed", async () => {
    const { container } = renderEditor(ownDraft(), [imageBlock()])

    const toolbar = await screen.findByRole(
      "toolbar",
      { name: "Bildbreite" },
      WAIT
    )
    expect(toolbar).toBeInTheDocument()

    /* Die aktive Stufe ist als gedrueckt ausgezeichnet. */
    expect(
      screen.getByRole("button", { name: "Bildbreite 100 Prozent" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Bildbreite 50 Prozent" })
    ).toHaveAttribute("aria-pressed", "false")

    /* Ein Klick wirkt sofort am Block: kein Panel, keine Bestaetigung. */
    await userEvent.click(
      screen.getByRole("button", { name: "Bildbreite 50 Prozent" })
    )

    await waitFor(() => {
      expect(container.querySelector("figure")).toHaveAttribute(
        "data-width",
        "50"
      )
    })
    expect(
      screen.getByRole("button", { name: "Bildbreite 50 Prozent" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Bildbreite 100 Prozent" })
    ).toHaveAttribute("aria-pressed", "false")

    /* Die Aenderung ist rein visuell; die Live-Region der Seite sagt sie
       an (SC 4.1.3). */
    expect(
      screen.getByText("Bildbreite auf 50 Prozent gesetzt.")
    ).toBeInTheDocument()
  }, 60000)

  it("Ersetzen behaelt Alternativtext, Unterschrift und Breite", async () => {
    const NEW_FILE_ID = "f1f1f1f1-0000-4000-8000-000000000009"
    renderEditor(ownDraft(), [imageBlock({ width: 75 })])
    server.use(
      http.post("*/api/files", () =>
        HttpResponse.json(
          {
            id: NEW_FILE_ID,
            url: `/api/files/${NEW_FILE_ID}`,
            mimeType: "image/png",
            size: 1024,
          },
          { status: 201 }
        )
      )
    )

    await screen.findByRole("toolbar", { name: "Bildbreite" }, WAIT)
    await userEvent.click(screen.getByRole("button", { name: "Bild ersetzen" }))

    /* Zurueck im leeren Zustand: die Ablageflaeche steht wieder da. */
    expect(
      await screen.findByText("Bild hochladen oder hierher ziehen")
    ).toBeInTheDocument()

    /* Ein neues Bild uebernimmt die stehengebliebenen Angaben: Ersetzen
       setzt nur fileId zurueck, nie alt, caption oder width. */
    await userEvent.upload(
      screen.getByLabelText(/Bild hochladen oder hierher ziehen/),
      new File(["x"], "neu.png", { type: "image/png" })
    )

    await waitFor(() => {
      expect(screen.getByLabelText("Bildunterschrift")).toHaveValue(
        "Abbildung 1"
      )
    }, WAIT)
    expect(screen.getByLabelText("Alternativtext")).toHaveValue(
      "Ein Messaufbau"
    )
    expect(
      screen.getByRole("button", { name: "Bildbreite 75 Prozent" })
    ).toHaveAttribute("aria-pressed", "true")
  }, 60000)

  it("fuehrt Alternativtext und Bildunterschrift direkt unter dem Bild, ohne Ausklapper", async () => {
    renderEditor(ownDraft(), [imageBlock({ alt: "", caption: "" })])

    const alt = await screen.findByLabelText("Alternativtext", undefined, WAIT)
    const caption = screen.getByLabelText("Bildunterschrift")

    /* Der fruehere Ausklapper existiert am Bild nicht mehr. */
    expect(screen.queryByText("Angaben zum Block Bild")).not.toBeInTheDocument()

    await userEvent.type(alt, "Ein Messaufbau")
    expect(alt).toHaveValue("Ein Messaufbau")

    await userEvent.type(caption, "Abbildung 1")
    expect(caption).toHaveValue("Abbildung 1")
  }, 60000)

  it("zeigt ohne Schreibrecht weder Leiste noch Felder, sondern die Unterschrift", async () => {
    const { container } = renderEditor(ownDraft({ status: "PUBLISHED" }), [
      imageBlock(),
    ])

    await screen.findByRole("heading", { level: 1 }, WAIT)
    await waitFor(() => {
      expect(container.querySelector("figure img")).toBeInTheDocument()
    }, WAIT)

    expect(
      screen.queryByRole("toolbar", { name: "Bildbreite" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Alternativtext")).not.toBeInTheDocument()
    expect(screen.getByText("Abbildung 1")).toBeInTheDocument()
  }, 60000)
})
