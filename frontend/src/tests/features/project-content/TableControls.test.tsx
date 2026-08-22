import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"

import { BlockControls } from "@/features/project-content/components/BlockControls"
import { TableControls } from "@/features/project-content/components/TableControls"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { renderWithProviders } from "@/tests/render"

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
        <TableControls editor={editor} disabled={false} />
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
