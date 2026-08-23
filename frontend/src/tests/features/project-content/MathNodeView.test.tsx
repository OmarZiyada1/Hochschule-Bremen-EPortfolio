import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor } from "@tiptap/react"
import { HttpResponse, http } from "msw"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import { EditorContextProvider } from "@/features/project-content/EditorContext"
import EditorPage from "@/features/project-content/EditorPage"
import { BlockControls } from "@/features/project-content/components/BlockControls"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { person, projectDetail } from "@/tests/fixtures"
import {
  currentUserHandler,
  projectBlocksHandler,
  projectCommentsHandler,
  projectDetailHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Der Formelblock zeigt seit dem WYSIWYG-Umbau die gesetzte Formel und nicht
 * das Eingabefeld; das Feld erscheint erst auf den Bearbeiten-Knopf.
 * Gerendert wird ueber die ganze Seite, weil die Knotenansicht nur im echten
 * Editor entsteht (ReactNodeViewRenderer).
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const WAIT = { timeout: 20000 }

function mathBlock(latex: string): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000007",
    type: "FORMULA",
    orderIndex: 0,
    schemaVersion: 3,
    content: { type: "mathBlock", attrs: { latex } },
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

describe("MathNodeView", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt die gesetzte Formel und nicht das Eingabefeld", async () => {
    renderEditor([mathBlock("e^{i\\pi} + 1 = 0")])

    /* Die Formel steht als eigener Bereich da, wie im Renderer. */
    await screen.findByRole(
      "region",
      { name: "Formel, waagerecht scrollbar" },
      WAIT
    )
    expect(
      screen.queryByLabelText("Formel in KaTeX-Schreibweise")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Formel bearbeiten" })
    ).toBeInTheDocument()
  }, 60000)

  it("oeffnet das Feld auf den Bearbeiten-Knopf und schliesst es mit Fertig", async () => {
    const user = userEvent.setup()
    renderEditor([mathBlock("a^2 + b^2 = c^2")])

    await user.click(
      await screen.findByRole("button", { name: "Formel bearbeiten" }, WAIT)
    )

    const field = screen.getByLabelText("Formel in KaTeX-Schreibweise")
    expect(field).toHaveValue("a^2 + b^2 = c^2")

    await user.click(screen.getByRole("button", { name: "Fertig" }))

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Formel in KaTeX-Schreibweise")
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: "Formel bearbeiten" })
    ).toBeInTheDocument()
  }, 60000)

  it("stellt die Aenderung waehrend des Tippens dar, ohne Knopfdruck", async () => {
    const user = userEvent.setup()
    renderEditor([mathBlock("x")])

    await user.click(
      await screen.findByRole("button", { name: "Formel bearbeiten" }, WAIT)
    )

    const field = screen.getByLabelText("Formel in KaTeX-Schreibweise")
    await user.clear(field)
    await user.type(field, "y")

    /* Ohne „Rendern": nach der kurzen Ruhepause steht der neue Stand am
       Knoten, und die Vorschau liest ihn von dort. */
    await waitFor(
      () => {
        expect(field).toHaveValue("y")
        expect(document.querySelector(".katex")?.textContent).toContain("y")
      },
      { timeout: 5000 }
    )
  }, 60000)

  it("verliert die Formel nicht, wenn das Feld leer geschlossen wird", async () => {
    const user = userEvent.setup()
    renderEditor([mathBlock("a^2")])

    await user.click(
      await screen.findByRole("button", { name: "Formel bearbeiten" }, WAIT)
    )
    const field = screen.getByLabelText("Formel in KaTeX-Schreibweise")
    await user.clear(field)

    /*
     * Der Regressionsfall (Befund des Frontend-Reviews): Escape und
     * Strg+Enter fuehrten am gesperrten Fertig-Knopf vorbei und
     * hinterliessen einen Block ohne Formel, ohne Bearbeiten-Knopf und
     * damit ohne Weg zurueck. Jetzt ist das leere Feld ein abgebrochener
     * Austausch: es schliesst, und die gespeicherte Formel steht noch da.
     */
    expect(screen.getByRole("button", { name: "Fertig" })).toBeDisabled()
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Formel in KaTeX-Schreibweise")
      ).not.toBeInTheDocument()
    })
    expect(document.querySelector(".katex")?.textContent).toContain("a")
    expect(
      screen.getByRole("button", { name: "Formel bearbeiten" })
    ).toBeInTheDocument()
  }, 60000)

  it("bleibt nach Rueckgaengig bedienbar", async () => {
    const user = userEvent.setup()
    renderEditor([mathBlock("a^2")])

    await user.click(
      await screen.findByRole("button", { name: "Formel bearbeiten" }, WAIT)
    )
    const field = screen.getByLabelText("Formel in KaTeX-Schreibweise")
    await user.clear(field)
    await user.type(field, "b^2")
    await user.click(screen.getByRole("button", { name: "Fertig" }))
    await waitFor(() =>
      expect(document.querySelector(".katex")?.textContent).toContain("b")
    )

    /*
     * Rueckgaengig nimmt die Formel vom Knoten. Ohne das Nachziehen des
     * Zustands stuende danach ein Block ohne Formel, ohne Stift und ohne
     * Feld da, und der naechste Speichertakt liesse ihn aus der Blockliste
     * fallen (Befund des Frontend-Reviews).
     */
    await user.click(screen.getByRole("button", { name: "Rückgängig" }))
    await user.click(screen.getByRole("button", { name: "Rückgängig" }))

    await waitFor(
      () =>
        expect(
          screen.queryByLabelText("Formel in KaTeX-Schreibweise") ??
            screen.queryByRole("button", { name: "Formel bearbeiten" })
        ).not.toBeNull(),
      { timeout: 5000 }
    )
  }, 60000)

  it("bleibt beim frisch eingefuegten Block offen, solange nichts drinsteht", async () => {
    const user = userEvent.setup()
    renderWithProviders(<InsertHarness />)

    await user.click(
      await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    )
    await user.click(
      await screen.findByRole("button", { name: "Formel" }, WAIT)
    )
    const field = await screen.findByLabelText(
      "Formel in KaTeX-Schreibweise",
      {},
      WAIT
    )

    /* Ohne Formel gibt es nichts anzuzeigen und keinen Weg zurueck ins
       Feld; es bleibt offen, statt einen unbedienbaren Block zu
       hinterlassen. Weg wird der Block ueber die Blockbedienung. */
    await user.keyboard("{Escape}")
    expect(field).toBeInTheDocument()

    await user.keyboard("{Control>}{Enter}{/Control}")
    expect(field).toBeInTheDocument()
  }, 60000)

  /*
   * Ein Formelblock ohne Formel kommt nie vom Server: gespeichert wird er
   * erst mit seinen Pflichtattributen (docToBlocks). Er entsteht allein beim
   * Einfuegen im Editor, deshalb steht dieser Fall an einer eigenen
   * Schreibflaeche und nicht an der geladenen Seite.
   */
  it("oeffnet einen frisch eingefuegten Block gleich im Feld", async () => {
    renderWithProviders(<FreshFormula />)

    expect(
      await screen.findByLabelText("Formel in KaTeX-Schreibweise", {}, WAIT)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Formel bearbeiten" })
    ).not.toBeInTheDocument()
    /* Und er sagt, dass ihm noch etwas fehlt. */
    expect(screen.getByText(/Noch keine Formel eingegeben/)).toBeInTheDocument()
  }, 60000)

  it("gibt dem ueber die Einfuegeleiste angelegten Block den Fokus ins Feld", async () => {
    const user = userEvent.setup()
    renderWithProviders(<InsertHarness />)

    /* Ueber die sichtbare Oberflaeche und nicht ueber eine gesetzte
       Auswahl: geprueft werden soll der echte Weg, auf dem der Block
       entsteht. Wer „Formel" gewaehlt hat, will tippen und nicht erst
       klicken. */
    await user.click(
      await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    )
    await user.click(
      await screen.findByRole("button", { name: "Formel" }, WAIT)
    )

    const field = await screen.findByLabelText(
      "Formel in KaTeX-Schreibweise",
      {},
      WAIT
    )
    await waitFor(() => expect(field).toHaveFocus())
  }, 60000)

  it("holt den Fokus nicht zurueck, wenn die Auswahl den Block verlaesst", async () => {
    const user = userEvent.setup()
    renderEditor([mathBlock("a^2")])

    await user.click(
      await screen.findByRole("button", { name: "Formel bearbeiten" }, WAIT)
    )
    const field = screen.getByLabelText("Formel in KaTeX-Schreibweise")
    await waitFor(() => expect(field).toHaveFocus())

    /*
     * Der Regressionsfall (Befund des Frontend-Reviews): stand `selected`
     * in der Abhaengigkeitsliste des Fokus-Effekts, holte jede
     * Auswahlaenderung den Fokus in dieses Feld zurueck. Der Block liess
     * sich dann nicht mehr verlassen.
     */
    const outside = screen.getByRole("heading", { level: 1 })
    outside.setAttribute("tabindex", "-1")
    outside.focus()
    expect(outside).toHaveFocus()

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(field).not.toHaveFocus()
    expect(outside).toHaveFocus()
  }, 60000)

  it("haelt die gespeicherte Formel, solange das Feld leer ist", async () => {
    const user = userEvent.setup()
    renderEditor([mathBlock("a^2")])

    await user.click(
      await screen.findByRole("button", { name: "Formel bearbeiten" }, WAIT)
    )
    const field = screen.getByLabelText("Formel in KaTeX-Schreibweise")
    await user.clear(field)

    /*
     * Deutlich laenger als PREVIEW_DELAY_MS: der leere Entwurf darf den
     * Knoten nicht erreichen. Sonst fiele der Block beim naechsten
     * Speichertakt aus der Liste (isReadyToSave), und weil der PUT die
     * Liste ersetzt, waere er serverseitig fort.
     */
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(document.querySelector(".katex")?.textContent).toContain("a")
    expect(
      screen.queryByText(/Noch keine Formel eingegeben/)
    ).not.toBeInTheDocument()

    /* Absichtlich aendern bleibt moeglich. */
    await user.type(field, "b^2")
    await waitFor(
      () =>
        expect(document.querySelector(".katex")?.textContent).toContain("b"),
      { timeout: 5000 }
    )
  }, 60000)
})

/** Eine Schreibflaeche mit der Einfuegeleiste davor, wie im Editor. */
function InsertHarness() {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<p>Ein Absatz</p>",
  })

  if (editor === null) {
    return null
  }
  return (
    <EditorContextProvider
      value={{
        projectId: PROJECT_ID,
        editable: true,
        announce: () => undefined,
      }}
    >
      <BlockControls
        editor={editor}
        index={0}
        disabled={false}
        onAnnounce={() => undefined}
      />
      <EditorContent editor={editor} />
    </EditorContextProvider>
  )
}

/** Eine Schreibflaeche mit genau einem leeren Formelblock. */
function FreshFormula() {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: { type: "doc", content: [{ type: "mathBlock" }] },
  })

  return (
    <EditorContextProvider
      value={{
        projectId: PROJECT_ID,
        editable: true,
        announce: () => undefined,
      }}
    >
      <EditorContent editor={editor} />
    </EditorContextProvider>
  )
}
