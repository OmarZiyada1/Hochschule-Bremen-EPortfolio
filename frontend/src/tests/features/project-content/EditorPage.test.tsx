import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
import { LocationProbe, signInAs } from "@/tests/routes/helpers"

/*
 * Die Seite wird direkt gerendert und nicht ueber den Routenbaum: sonst
 * zoege jeder Fall NavBar, Fusszeile und das Portfolio der Kopfleiste mit,
 * und jeder braeuchte Handler fuer Dinge, um die es ihm nicht geht. Dass die
 * Route selbst erreichbar ist, prueft routes/index.test.tsx.
 *
 * <p>Die Grenzen sind grosszuegig: die Schreibflaeche baut ein vollstaendiges
 * ProseMirror-Schema auf, und der Rechner, auf dem hier gearbeitet wird, ist
 * langsam.
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
const USER_ID = "00000000-0000-0000-0000-000000000001"
const WAIT = { timeout: 20000 }

function textBlock(text: string, id = "b1"): BlockResponse {
  return {
    id: `aaaaaaaa-bbbb-4ccc-8ddd-00000000000${id.slice(-1)}`,
    type: "TEXT",
    orderIndex: 0,
    schemaVersion: 3,
    content: {
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text }],
    },
  } as unknown as BlockResponse
}

/** Ein Block, den diese Ansicht nicht lesen kann (kuenftige Schemaversion). */
function unreadableBlock(): BlockResponse {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-999999999999",
    type: "TEXT",
    orderIndex: 1,
    schemaVersion: 99,
    content: { type: "somethingNew" },
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

function renderEditor(
  project: ProjectDetailResponse,
  blocks: BlockResponse[] = []
) {
  server.use(
    currentUserHandler({ id: USER_ID }),
    /* Bloecke vor dem Detail: das Muster /projects/:projectId faengt sonst
       den laengeren Pfad zuerst ab. */
    projectBlocksHandler(blocks),
    projectDetailHandler(project),
    http.put("*/api/projects/:projectId/blocks", () =>
      HttpResponse.json({ version: 2, blocks })
    )
  )
  signInAs("STUDENT")
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/editor" element={<EditorPage />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    `/projects/${PROJECT_ID}/editor`
  )
}

describe("EditorPage", () => {
  beforeEach(() => {
    signInAs("STUDENT")
  })

  it("zeigt den Projekttitel als einzige h1 und die Schreibflaeche", async () => {
    renderEditor(ownDraft(), [textBlock("Ein erster Absatz.")])

    expect(
      await screen.findByRole("heading", { level: 1 }, WAIT)
    ).toHaveTextContent("Beitrag im Entwurf")
    expect(
      await screen.findByText("Ein erster Absatz.", undefined, WAIT)
    ).toBeInTheDocument()
  })

  it("gibt eine Ueberschrift auf der Schreibflaeche versetzt aus", async () => {
    const heading = {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000009",
      type: "HEADING",
      orderIndex: 0,
      schemaVersion: 3,
      content: {
        type: "heading",
        attrs: { level: 1, textAlign: null },
        content: [{ type: "text", text: "Erste Gliederungsebene" }],
      },
    } as unknown as BlockResponse

    renderEditor(ownDraft(), [heading])

    /* Gespeichert ist die Ebene 1, angezeigt wird sie eine Stufe tiefer:
       die einzige h1 der Seite bleibt der Projekttitel (Contract 2.5, 3.3).
       Ohne die Knotenansicht stuende hier ein zweites h1. */
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: "Erste Gliederungsebene" },
        WAIT
      )
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("ist in PUBLISHED read-only und sagt sichtbar warum", async () => {
    renderEditor(ownDraft({ status: "PUBLISHED" }), [textBlock("Fertig.")])

    expect(
      await screen.findByText(
        /laesst sich gerade nicht bearbeiten|lässt sich gerade nicht bearbeiten/i,
        undefined,
        WAIT
      )
    ).toBeInTheDocument()

    /* Keine Blockbedienung und keine Workflow-Aktion, die ins Leere fuehrt:
       aus PUBLISHED liegen beide Uebergaenge bei der Redaktion (§4.1). */
    expect(
      screen.queryByRole("button", { name: /Block einfügen/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Einreichen" })
    ).not.toBeInTheDocument()
  })

  it("speichert nicht, wenn ein Block nicht gelesen werden konnte", async () => {
    let puts = 0
    server.use(
      http.put("*/api/projects/:projectId/blocks", () => {
        puts = puts + 1
        return HttpResponse.json({ version: 2, blocks: [] })
      })
    )
    renderEditor(ownDraft(), [textBlock("Lesbar."), unreadableBlock()])

    /* Die Meldung nennt die Zahl und die Position: der PUT ersetzt die
       gesamte Liste und loeschte genau den Block, den diese Ansicht nicht
       lesen kann. */
    expect(
      await screen.findByText(/wird nicht gespeichert/i, undefined, WAIT)
    ).toBeInTheDocument()
    expect(screen.getByText(/Position(en)? 2/)).toBeInTheDocument()
    expect(puts).toBe(0)
  })

  it("oeffnet am Plus die Einfuegeleiste mit den zehn Blocktypen", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    const plus = await screen.findByRole(
      "button",
      { name: "Block einfügen" },
      WAIT
    )
    await user.click(plus)

    const bar = await screen.findByRole(
      "group",
      { name: "Block einfügen" },
      WAIT
    )
    for (const label of [
      "Bild",
      "Galerie",
      "Video",
      "Audio",
      "Dokument",
      "Einbettung",
      "Formel",
      "Tabelle",
      "Quelltext",
      "Trenner",
    ]) {
      expect(
        within(bar).getByRole("button", { name: label }),
        label
      ).toBeInTheDocument()
    }

    /* Aufgabenlisten sind nicht Teil des Schemas (Contract 2.5); der alte
       Prototyp zeichnet an dieser Stelle noch ein Kaestchen. */
    expect(
      within(bar).queryByRole("button", { name: /Aufgabe|Checkliste/i })
    ).not.toBeInTheDocument()
  })

  /*
   * Der Zeigerweg laeuft seit KAN-36 ueber
   * @tiptap/extension-drag-handle-react. Die Erweiterung blendet ihren
   * Griff aus, solange niemand zeigt, und zwar mit visibility: hidden; ein
   * so verstecktes Element nimmt keinen Fokus an. Ohne einen zweiten,
   * erreichbaren Weg waeren Einfuegen, Verschieben und Loeschen fuer
   * Tastatur- und Sprachbedienung unerreichbar (SC 2.1.1).
   */
  it("haelt die Blockbedienung auch ohne Zeiger erreichbar", async () => {
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    const bar = await screen.findByRole(
      "group",
      { name: /Blockbedienung, Block 1 von/ },
      WAIT
    )
    /* Die drei Bedienelemente stehen darin und sind echte Schaltflaechen,
       also mit Tab erreichbar. */
    expect(
      within(bar).getByRole("button", { name: "Block einfügen" })
    ).toBeInTheDocument()
    expect(
      within(bar).getByRole("button", { name: /anheben|ablegen/i })
    ).toBeInTheDocument()
    expect(
      within(bar).getByRole("button", { name: /löschen/i })
    ).toBeInTheDocument()
  })

  it("legt einen Medienblock als leeren Platzhalter im Text an", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    await user.click(
      await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    )
    await user.click(await screen.findByRole("button", { name: "Bild" }, WAIT))

    /* Kein Dialog, sondern eine Ablageflaeche an Ort und Stelle. */
    expect(
      await screen.findByText(
        /Bild hochladen oder hierher ziehen/i,
        undefined,
        WAIT
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("fuehrt Einreichen zuerst in die Metadaten und nennt die fehlenden Angaben", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    await user.click(
      await screen.findByRole("button", { name: "Einreichen" }, WAIT)
    )

    /* Statt eines 400 PROJECT_INCOMPLETE steht dort, was fehlt, und zwar
       an der Stelle, an der es sich eintragen laesst (§3.3). */
    expect(
      await screen.findByText(/Es fehlen noch Angaben/i, undefined, WAIT)
    ).toBeInTheDocument()
    expect(screen.getByText(/Redaktionszuweisung/)).toBeInTheDocument()
  })

  it("fuehrt der Vorschau-Schalter auf die oeffentliche Detailseite", async () => {
    const user = userEvent.setup()
    renderEditor(ownDraft(), [textBlock("Ein Absatz.")])

    await user.click(
      await screen.findByRole("switch", { name: "Bearbeiten" }, WAIT)
    )

    await waitFor(
      () =>
        expect(screen.getByTestId("pathname")).toHaveTextContent(
          `/projects/${PROJECT_ID}`
        ),
      WAIT
    )
  })

  it("zeigt einem fremden Konto keine Workflow-Aktion", async () => {
    /* §5 und §4.1: Einreichen und Zurueckziehen fuehrt die Autor:in aus.
       Ein Projektmitglied darf den Inhalt bearbeiten, aber nicht
       einreichen; eine Schaltflaeche, die mit 403 endet, waere ein Weg ins
       Leere. */
    renderEditor(
      ownDraft({
        author: person({ id: "99999999-9999-4999-8999-999999999999" }),
      }),
      [textBlock("Ein Absatz.")]
    )

    await screen.findByRole("heading", { level: 1 }, WAIT)
    expect(
      screen.queryByRole("button", { name: "Einreichen" })
    ).not.toBeInTheDocument()
  })
})
