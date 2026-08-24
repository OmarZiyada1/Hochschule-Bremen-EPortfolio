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
 * Der Dokumentblock sieht seit dem WYSIWYG-Umbau aus wie im Renderer: der
 * Dateiname als Link mit der Groesse dahinter, keine Karte, kein Ersetzen.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const FILE_ID = "f1f1f1f1-0000-4000-8000-00000000000d"
const WAIT = { timeout: 20000 }

function documentBlock(): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000005",
    type: "DOCUMENT",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "documentBlock",
      attrs: { fileId: FILE_ID, fileName: "Bericht.pdf", size: 1_500_000 },
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

describe("DocumentNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt den Dokumentlink wie im Renderer, ohne Karte und ohne Ersetzen", async () => {
    renderEditor([documentBlock()])

    /* Der zugaengliche Name nennt Datei, Typ und Groesse (SC 2.4.4). */
    const link = await screen.findByRole(
      "link",
      { name: /Bericht\.pdf herunterladen/ },
      WAIT
    )
    expect(link).toHaveTextContent("Bericht.pdf")
    expect(link).toHaveAttribute("download", "Bericht.pdf")
    /* Dieselbe Groesse wie im Renderer: dezimal ueber Intl ("1,5 MB"),
       nicht die fruehere 1024er-Teilung ("1,4 MB"). */
    expect(screen.getByText("1,5 MB")).toBeInTheDocument()

    expect(
      screen.queryByRole("button", { name: "Dokument ersetzen" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Angaben zum Block Dokument")
    ).not.toBeInTheDocument()
  }, 60000)
})
