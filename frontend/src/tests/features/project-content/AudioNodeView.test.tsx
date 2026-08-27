import { screen } from "@testing-library/react"
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
 * Der Audioblock zeigt seit dem WYSIWYG-Umbau den echten Player statt
 * einer benannten Karte, wie im Renderer.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const FILE_ID = "f1f1f1f1-0000-4000-8000-00000000000c"
const WAIT = { timeout: 20000 }

function audioBlock(): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000004",
    type: "AUDIO",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "audioBlock",
      attrs: { fileId: FILE_ID, caption: "" },
    },
  } as unknown as BlockResponse
}

function ownDraft(): ProjectDetailResponse {
  return projectDetail({
    id: PROJECT_ID,
    title: "Beitrag im Entwurf",
    status: "DRAFT",
    author: person({ id: USER_ID, firstName: "Mira", lastName: "Beispiel" }),
  })
}

function renderEditor(blocks: BlockResponse[]) {
  server.use(
    currentUserHandler({ id: USER_ID }),
    projectCommentsHandler(),
    projectBlocksHandler(blocks),
    projectDetailHandler(ownDraft()),
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

describe("AudioNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt den echten Player mit Unterschrift-Feld, ohne Karte und ohne Ersetzen", async () => {
    renderEditor([audioBlock()])

    const audio = await screen.findByLabelText(
      "Audioaufnahme aus diesem Beitrag",
      undefined,
      WAIT
    )
    expect(audio.tagName).toBe("AUDIO")
    expect(audio).toHaveAttribute("controls")
    /* Nichts laedt und nichts startet von allein (SC 1.4.2). */
    expect(audio).toHaveAttribute("preload", "metadata")

    /* "Audiounterschrift" und nicht "Bildunterschrift": jeder Medienblock
       benennt sein Unterschriftfeld nach seiner eigenen Art (KAN-83,
       Nutzeransage), und an einer Tonaufnahme gibt es kein Bild. */
    expect(screen.getByLabelText("Audiounterschrift")).toBeInTheDocument()
    expect(screen.queryByText("Hochgeladene Datei")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Aufnahme ersetzen" })
    ).not.toBeInTheDocument()
  }, 60000)
})
