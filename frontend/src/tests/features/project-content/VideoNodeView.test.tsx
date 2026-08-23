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
 * Der Videoblock zeigt seit der Inline-Bedienung den echten Player statt
 * einer benannten Karte: die Datei als video-Element, die Einbettung als
 * iframe des Anbieters. Gerendert wird ueber die ganze Seite, weil die
 * Knotenansicht nur im echten Editor entsteht (ReactNodeViewRenderer).
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const FILE_ID = "f1f1f1f1-0000-4000-8000-000000000002"
const WAIT = { timeout: 20000 }

function videoBlock(
  attrs: Partial<{
    fileId: string | null
    provider: string | null
    videoId: string | null
    hash: string | null
    caption: string
  }> = {}
): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000002",
    type: "VIDEO",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "videoBlock",
      attrs: {
        fileId: null,
        provider: null,
        videoId: null,
        hash: null,
        caption: "",
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

describe("VideoNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt fuer eine hochgeladene Datei den echten Player statt einer Karte", async () => {
    renderEditor(ownDraft(), [videoBlock({ fileId: FILE_ID })])

    const video = await screen.findByLabelText(
      "Video aus diesem Beitrag",
      undefined,
      WAIT
    )
    expect(video.tagName).toBe("VIDEO")
    expect(video).toHaveAttribute("controls")
    /* Nichts laedt und nichts startet von allein (SC 1.4.2). */
    expect(video).toHaveAttribute("preload", "metadata")
    expect(video).not.toHaveAttribute("autoplay")

    /* Das Upload- und Adressformular dominiert den Block nicht mehr. */
    expect(
      screen.queryByText("Oder Videoadresse einfügen")
    ).not.toBeInTheDocument()
    /* Die Unterschrift ist direkt am Block editierbar. */
    expect(screen.getByLabelText("Bildunterschrift")).toBeInTheDocument()
  }, 60000)

  it("zeigt fuer eine Einbettung den Player des Anbieters", async () => {
    renderEditor(ownDraft(), [
      videoBlock({ provider: "youtube", videoId: "mx4c5TrvHWU" }),
    ])

    const frame = await screen.findByTitle(
      "Eingebettetes Video von YouTube",
      undefined,
      WAIT
    )
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/mx4c5TrvHWU"
    )
    /* Anbietername und Kennung stehen nicht mehr als blosser Text da. */
    expect(
      screen.queryByText("YouTube, Video mx4c5TrvHWU")
    ).not.toBeInTheDocument()
  }, 60000)

  it("fuehrt ueber Ersetzen zurueck zu Upload und Adresse, ohne die Unterschrift zu verlieren", async () => {
    renderEditor(ownDraft(), [
      videoBlock({
        provider: "youtube",
        videoId: "mx4c5TrvHWU",
        caption: "Erster Lauf",
      }),
    ])

    await screen.findByTitle("Eingebettetes Video von YouTube", undefined, WAIT)
    await userEvent.click(
      screen.getByRole("button", { name: "Video ersetzen" })
    )

    await waitFor(() => {
      expect(
        screen.getByText("Video hochladen oder hierher ziehen")
      ).toBeInTheDocument()
    })
    expect(screen.getByText("Oder Videoadresse einfügen")).toBeInTheDocument()

    /* Die Unterschrift haengt am Block, nicht an der Quelle: eine neue
       Quelle uebernimmt sie wieder. */
    const url = screen.getByPlaceholderText(
      "Adresse, Teilen-Link oder Einbettungscode"
    )
    await userEvent.type(url, "https://vimeo.com/76979871")
    await userEvent.click(screen.getByRole("button", { name: "Einbetten" }))

    expect(
      await screen.findByTitle("Eingebettetes Video von Vimeo", undefined, WAIT)
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Bildunterschrift")).toHaveValue("Erster Lauf")
  }, 60000)

  it("zeigt ohne Schreibrecht den Player mit figcaption, ohne Bedienelemente", async () => {
    renderEditor(ownDraft({ status: "PUBLISHED" }), [
      videoBlock({
        provider: "youtube",
        videoId: "mx4c5TrvHWU",
        caption: "Erster Lauf",
      }),
    ])

    /* Der Player selbst bleibt: read-only heisst ansehen, nicht aendern. */
    expect(
      await screen.findByTitle(
        "Eingebettetes Video von YouTube",
        undefined,
        WAIT
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByRole("button", { name: "Video ersetzen" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Bildunterschrift")).not.toBeInTheDocument()
    expect(screen.getByText("Erster Lauf")).toBeInTheDocument()
  }, 60000)
})
