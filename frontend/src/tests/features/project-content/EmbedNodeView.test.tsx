import { screen } from "@testing-library/react"
import { HttpResponse, http } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import EditorPage from "@/features/project-content/EditorPage"
import { person, projectDetail } from "@/tests/fixtures"
import {
  currentUserHandler,
  projectBlocksHandler,
  projectDetailHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Der Einbettungsblock zeigt seit dem WYSIWYG-Umbau den echten Rahmen des
 * Anbieters statt einer benannten Karte, mit derselben begrenzten Hoehe
 * wie im Renderer.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const WAIT = { timeout: 20000 }

function embedBlock(): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000006",
    type: "EMBED",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "embedBlock",
      attrs: {
        provider: "codepen",
        embedUrl: "https://codepen.io/team/embed/abcDEF",
        height: 400,
      },
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
    projectBlocksHandler(blocks),
    projectDetailHandler(ownDraft()),
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

describe("EmbedNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt den echten Rahmen des Anbieters, ohne Karte und ohne Ersetzen", async () => {
    renderEditor([embedBlock()])

    const frame = await screen.findByTitle(
      "Eingebetteter Inhalt von CodePen",
      undefined,
      WAIT
    )
    expect(frame).toHaveAttribute("src", "https://codepen.io/team/embed/abcDEF")
    /* Dieselbe begrenzte Hoehe wie im Renderer (displayHeight). */
    expect(frame).toHaveAttribute("height", "400")

    expect(
      screen.queryByRole("button", { name: "Einbettung ersetzen" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/CodePen · https:/)).not.toBeInTheDocument()
  }, 60000)
})
