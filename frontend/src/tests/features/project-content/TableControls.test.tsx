import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { HttpResponse, http } from "msw"
import { useEffect } from "react"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import type { BlockResponse } from "@/api/types"
import EditorPage from "@/features/project-content/EditorPage"
import { BlockControls } from "@/features/project-content/components/BlockControls"
import { TableControls } from "@/features/project-content/components/TableControls"
import { TableControlsLayer } from "@/features/project-content/components/TableControlsLayer"
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
 * Befund aus KAN-36: es liess sich nur eine Tabelle mit drei mal drei
 * Zellen anlegen, und von dem, was die Tabellen-Erweiterung kann, fuehrte
 * die Bedienung nur einen Teil. Beides steht hier als Test: die Groesse
 * wird beim Einfuegen gewaehlt, und die Bedienung fuehrt jeden Vorgang, den
 * das Schema zulaesst.
 *
 * Der Editor braucht in jsdom laenger als die Standardsekunde von Vitest,
 * bis er steht; die Faelle tragen deshalb eine eigene Grenze.
 */

const WAIT = { timeout: 20000 }
const LIMIT = 30000

let captured: Editor | null = null

/**
 * Die Einfuegeleiste und die Tabellenbedienung tragen beide die
 * Beschriftung "Tabelle". Nebeneinander gerendert waere jede Suche danach
 * mehrdeutig, deshalb steht je Fall nur die eine, um die es geht.
 */
function Harness({
  content,
  show,
}: {
  content: string
  show: "insert" | "table"
}) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content,
  })
  useEffect(() => {
    captured = editor
  }, [editor])

  if (editor === null) {
    return null
  }
  return (
    <div>
      {show === "insert" ? (
        <BlockControls
          editor={editor}
          index={0}
          disabled={false}
          onAnnounce={() => undefined}
        />
      ) : (
        <TableControls editor={editor} />
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

/** Zeilen, Spalten und Kopfzellen der ersten Tabelle im Dokument. */
function tableShape(): { rows: number; cols: number; headers: number } | null {
  const doc = captured?.state.doc
  if (doc === undefined) {
    return null
  }
  let table: ProseMirrorNode | null = null
  doc.forEach((node) => {
    if (table === null && node.type.name === "table") {
      table = node
    }
  })
  if (table === null) {
    return null
  }
  const found = table as ProseMirrorNode
  let headers = 0
  found.forEach((row) =>
    row.forEach((cell) => {
      if (cell.type.name === "tableHeader") {
        headers += 1
      }
    })
  )
  return { rows: found.childCount, cols: found.child(0).childCount, headers }
}

describe("Tabelle einfuegen", () => {
  it(
    "fragt nach der Groesse und legt sie an",
    async () => {
      const user = userEvent.setup()
      renderWithProviders(<Harness content="<p>Ein Absatz</p>" show="insert" />)

      await user.click(
        await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
      )
      await user.click(
        await screen.findByRole("button", { name: "Tabelle" }, WAIT)
      )

      /* Nicht sofort eingefuegt: erst die Groesse. */
      expect(tableShape()).toBeNull()

      const rows = await screen.findByLabelText("Zeilen", {}, WAIT)
      const cols = screen.getByLabelText("Spalten")
      await user.clear(rows)
      await user.type(rows, "4")
      await user.clear(cols)
      await user.type(cols, "5")
      await user.click(screen.getByRole("button", { name: "Tabelle einfügen" }))

      /* Vier Zeilen einschliesslich der Kopfzeile, fuenf Spalten. */
      await waitFor(
        () => expect(tableShape()).toEqual({ rows: 4, cols: 5, headers: 5 }),
        WAIT
      )
    },
    LIMIT
  )

  it(
    "legt ohne Kopfzeile nur Inhaltszeilen an",
    async () => {
      const user = userEvent.setup()
      renderWithProviders(<Harness content="<p>Ein Absatz</p>" show="insert" />)

      await user.click(
        await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
      )
      await user.click(
        await screen.findByRole("button", { name: "Tabelle" }, WAIT)
      )
      /* Ueber die Rolle und nicht ueber das Label: Base UI legt neben das
         bedienbare Element ein verstecktes input, und beide tragen die
         Beschriftung. */
      await user.click(
        await screen.findByRole("checkbox", { name: "Mit Kopfzeile" }, WAIT)
      )
      await user.click(screen.getByRole("button", { name: "Tabelle einfügen" }))

      await waitFor(
        () => expect(tableShape()).toEqual({ rows: 3, cols: 3, headers: 0 }),
        WAIT
      )
    },
    LIMIT
  )

  it(
    "fuehrt ueber Zurueck wieder zu den zehn Typen",
    async () => {
      const user = userEvent.setup()
      renderWithProviders(<Harness content="<p>Ein Absatz</p>" show="insert" />)

      await user.click(
        await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
      )
      await user.click(
        await screen.findByRole("button", { name: "Tabelle" }, WAIT)
      )
      await user.click(
        await screen.findByRole("button", { name: "Zurück" }, WAIT)
      )

      expect(
        await screen.findByRole("group", { name: "Block einfügen" }, WAIT)
      ).toBeInTheDocument()
      expect(tableShape()).toBeNull()
    },
    LIMIT
  )
})

describe("Tabellenbedienung", () => {
  const TABLE = `<table><tbody>
    <tr><th><p>A</p></th><th><p>B</p></th></tr>
    <tr><td><p>1</p></td><td><p>2</p></td></tr>
  </tbody></table>`

  /**
   * Oeffnet das Menue mit der Textmarke in der ersten Zelle.
   *
   * <p>Die Marke wird gesetzt und nicht geklickt: jsdom hat kein Layout,
   * und ProseMirror ermittelt die Stelle eines Klicks aus Koordinaten. Ohne
   * Textmarke in der Tabelle kann kein Tabellenvorgang laufen, und das
   * Menue waere durchweg gesperrt.
   */
  async function openMenu() {
    const user = userEvent.setup()
    renderWithProviders(<Harness content={TABLE} show="table" />)
    await screen.findByRole("button", { name: "Tabelle" }, WAIT)
    await act(async () => {
      /* 1 Tabelle, 2 Zeile, 3 Zelle, 4 Absatz, 5 im Text. */
      captured?.commands.setTextSelection(5)
    })
    await user.click(screen.getByRole("button", { name: "Tabelle" }))
    return { user, menu: await screen.findByRole("menu", {}, WAIT) }
  }

  it(
    "fuehrt jeden Vorgang, den das Schema zulaesst",
    async () => {
      const { menu } = await openMenu()

      for (const name of [
        "Zeile darüber einfügen",
        "Zeile darunter einfügen",
        "Zeile löschen",
        "Spalte links einfügen",
        "Spalte rechts einfügen",
        "Spalte löschen",
        "Kopfzeile umschalten",
        "Kopfspalte umschalten",
        "Zelle als Kopfzelle umschalten",
        "Zellen verbinden",
        "Zelle teilen",
        "Zellen verbinden oder teilen",
        "Tabelle löschen",
      ]) {
        expect(within(menu).getByRole("menuitem", { name }), name).toBeVisible()
      }
    },
    LIMIT
  )

  it(
    "sperrt, was gerade nicht geht, statt es zu verstecken",
    async () => {
      const { menu } = await openMenu()

      /* Ohne Mehrfachauswahl gibt es nichts zu verbinden. Der Eintrag bleibt
         trotzdem stehen: ein verschwindender aenderte bei jedem
         Zellenwechsel die Laenge des Menues (SC 3.2.4). */
      expect(
        within(menu).getByRole("menuitem", { name: "Zellen verbinden" })
      ).toHaveAttribute("aria-disabled", "true")
      expect(
        within(menu).getByRole("menuitem", { name: "Zeile löschen" })
      ).not.toHaveAttribute("aria-disabled", "true")
    },
    LIMIT
  )

  it(
    "schaltet die Kopfspalte um",
    async () => {
      const { user, menu } = await openMenu()
      const before = tableShape()?.headers ?? 0

      await user.click(
        within(menu).getByRole("menuitem", { name: "Kopfspalte umschalten" })
      )

      await waitFor(() => expect(tableShape()?.headers).not.toBe(before), WAIT)
    },
    LIMIT
  )
})

describe("Tabellenbedienung am Ort der Tabelle", () => {
  const TWO_TABLES = `
    <table><tbody><tr><td><p>A1</p></td></tr></tbody></table>
    <p>Dazwischen</p>
    <table><tbody><tr><td><p>B1</p></td></tr></tbody></table>`

  /** Eine Schreibflaeche mit der Ebene, so wie EditorPage sie einbindet. */
  function LayerHarness({ content }: { content: string }) {
    const editor = useEditor({
      extensions: createEditorExtensions(),
      content,
    })
    useEffect(() => {
      captured = editor
    }, [editor])

    if (editor === null) {
      return null
    }
    return (
      <div className="project-content relative">
        <EditorContent editor={editor} />
        <TableControlsLayer editor={editor} />
      </div>
    )
  }

  it(
    "haengt je Tabelle eine Bedienung in deren eigenen Rahmen",
    async () => {
      renderWithProviders(<LayerHarness content={TWO_TABLES} />)

      /*
       * Der Regressionsfall: die Bedienung stand einmal ganz oben in der
       * Seite, weit weg von der Tabelle, auf die sie wirkt. Jetzt liegt sie
       * im Rahmen der Tabellen-Erweiterung (div.tableWrapper), und damit
       * ohne jede Messung an der richtigen Stelle.
       */
      await waitFor(
        () =>
          expect(
            screen.getAllByRole("button", { name: /^Tabelle \d+ bearbeiten$/ })
          ).toHaveLength(2),
        WAIT
      )

      const wrappers = document.querySelectorAll(".tableWrapper")
      expect(wrappers).toHaveLength(2)
      for (const wrapper of wrappers) {
        const controls = wrapper.querySelector("[data-table-controls]")
        expect(controls).not.toBeNull()
        /* Nicht beschreibbar: sonst liesse sich in die Bedienung
           hineinschreiben, sie steht ja in der Schreibflaeche. */
        expect(controls).toHaveAttribute("contenteditable", "false")
      }
    },
    LIMIT
  )

  it(
    "setzt die Textmarke in die eigene Tabelle, bevor das Menue oeffnet",
    async () => {
      const user = userEvent.setup()
      renderWithProviders(<LayerHarness content={TWO_TABLES} />)

      const triggers = await waitFor(() => {
        const found = screen.getAllByRole("button", {
          name: /^Tabelle \d+ bearbeiten$/,
        })
        expect(found).toHaveLength(2)
        return found
      }, WAIT)

      /* Textmarke im Absatz zwischen den Tabellen, also in keiner. */
      await act(async () => {
        captured?.commands.setTextSelection(1)
      })

      /* Die Bedienung der zweiten Tabelle: ohne das Nachziehen der
         Textmarke traefe jeder Vorgang die Tabelle, in der der Cursor
         zufaellig stand. */
      await user.click(triggers[1])
      await screen.findByRole("menu", {}, WAIT)

      expect(captured?.isActive("table")).toBe(true)
      const cursor = captured?.state.selection.from ?? 0
      const secondTable = tablePositions()[1]
      const size = captured?.state.doc.nodeAt(secondTable)?.nodeSize ?? 0
      expect(cursor).toBeGreaterThan(secondTable)
      expect(cursor).toBeLessThan(secondTable + size)
    },
    LIMIT
  )

  it(
    "laesst den Tabulator nicht in die Tabelle durch",
    async () => {
      const user = userEvent.setup()
      renderWithProviders(<LayerHarness content={TWO_TABLES} />)

      const trigger = (
        await waitFor(() => {
          const found = screen.getAllByRole("button", {
            name: /^Tabelle \d+ bearbeiten$/,
          })
          expect(found).toHaveLength(2)
          return found
        }, WAIT)
      )[0]

      trigger.focus()
      const rowsBefore = captured?.state.doc.child(0).childCount

      /*
       * Die Bedienung liegt im DOM der Schreibflaeche, und dort horcht die
       * Tabellen-Erweiterung auf Tab (goToNextCell, an der letzten Zelle
       * addRowAfter). Ohne den Riegel haengte ein Tabulator auf dem
       * Ausloeser der Tabelle eine Zeile an.
       */
      await user.tab()
      expect(captured?.state.doc.child(0).childCount).toBe(rowsBefore)
      /* Und der Fokus wandert weiter, statt haengenzubleiben (SC 2.1.2). */
      expect(trigger).not.toHaveFocus()
    },
    LIMIT
  )

  it(
    "fuehrt mit Escape zurueck in den Text",
    async () => {
      const user = userEvent.setup()
      renderWithProviders(<LayerHarness content={TWO_TABLES} />)

      const trigger = (
        await waitFor(() => {
          const found = screen.getAllByRole("button", {
            name: /^Tabelle \d+ bearbeiten$/,
          })
          expect(found).toHaveLength(2)
          return found
        }, WAIT)
      )[1]

      trigger.focus()
      await user.keyboard("{Escape}")

      /* Der Rueckweg aus der Bedienung, wie aus der Formatierungsleiste. */
      await waitFor(() => {
        expect(document.querySelector(".ProseMirror")).toHaveFocus()
      }, WAIT)
    },
    LIMIT
  )
})

/*
 * Der Sprung in die Tabellenbedienung laeuft ueber die editorProps der
 * Seite, nicht ueber die Komponenten: geprueft wird deshalb die echte
 * EditorPage und keine nachgebaute Schreibflaeche.
 */
describe("Alt+F8 fuehrt in die Tabellenbedienung", () => {
  const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"
  const USER_ID = "00000000-0000-0000-0000-000000000001"

  function tableBlock(): BlockResponse {
    return {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000009",
      type: "TABLE",
      orderIndex: 0,
      schemaVersion: 3,
      content: {
        type: "table",
        attrs: { caption: "" },
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: {},
                content: [
                  {
                    type: "paragraph",
                    attrs: { textAlign: null },
                    content: [{ type: "text", text: "A1" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as unknown as BlockResponse
  }

  function renderEditorPage() {
    server.use(
      currentUserHandler({ id: USER_ID }),
      projectCommentsHandler(),
      projectBlocksHandler([tableBlock()]),
      projectDetailHandler(
        projectDetail({
          id: PROJECT_ID,
          title: "Beitrag im Entwurf",
          status: "DRAFT",
          author: person({ id: USER_ID }),
        })
      ),
      http.put("*/api/projects/:projectId/blocks", () =>
        HttpResponse.json({ version: 2, blocks: [tableBlock()] })
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

  it(
    "springt aus der Tabelle auf ihre Bedienung",
    async () => {
      renderEditorPage()

      /*
       * Der Regressionsfall dahinter: die Seite baut den Editor neu auf,
       * sobald der Beitrag geladen ist, und beim ersten Rendern der Ebene
       * haengt der Rahmen der Tabelle noch nicht im Dokument. Ohne den
       * Nachlauf blieb die Bedienung an jeder geladenen Tabelle aus.
       */
      const trigger = await screen.findByRole(
        "button",
        { name: "Tabelle 1 bearbeiten" },
        WAIT
      )

      /*
       * Der Grund fuer die Taste: die Tabellen-Erweiterung belegt den
       * Tabulator so, dass er nie aus der Tabelle herausfuehrt. Ohne einen
       * eigenen Weg waere die Bedienung an ihrem neuen Ort fuer die
       * Tastatur unerreichbar (SC 2.1.1).
       */
      const surface = document.querySelector<HTMLElement>(".ProseMirror")
      expect(surface).not.toBeNull()
      surface?.focus()
      fireEvent.keyDown(surface as HTMLElement, { key: "F8", altKey: true })

      await waitFor(() => expect(trigger).toHaveFocus(), WAIT)
    },
    LIMIT
  )
})

/** Die Anfangspositionen aller Tabellen im Dokument. */
function tablePositions(): number[] {
  const doc = captured?.state.doc
  const positions: number[] = []
  let offset = 0
  if (doc === undefined) {
    return positions
  }
  for (let index = 0; index < doc.childCount; index++) {
    const child = doc.child(index)
    if (child.type.name === "table") {
      positions.push(offset)
    }
    offset += child.nodeSize
  }
  return positions
}
