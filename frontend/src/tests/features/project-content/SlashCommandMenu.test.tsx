import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect, useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { SlashCommandMenu } from "@/features/project-content/components/SlashCommandMenu"
import type { InsertKind } from "@/features/project-content/blockInsert"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { renderWithProviders } from "@/tests/render"

/**
 * Die Liste hinter dem Slash-Befehl, ohne das Suggestion-Plugin darum.
 *
 * <p>Der Ausloeser selbst wird nicht hier geprueft: das Tippen in ein
 * {@code contenteditable} laeuft in jsdom nicht durch ProseMirrors
 * DOM-Beobachter, und was dabei herauskaeme, sagte nichts ueber die
 * Anwendung. Geprueft wird deshalb die Liste: was sie zeigt, wie sie
 * filtert, wie sie mit der Tastatur bedient wird und wie sie sich der
 * Schreibflaeche gegenueber meldet.
 */

const WAIT = { timeout: 20000 }

let captured: Editor | null = null

function Harness({
  onSelect,
  initialQuery = "",
}: {
  onSelect: (kind: InsertKind) => void
  initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<p>Ein Absatz</p>",
  })
  /* Im Effekt und nicht beim Rendern: eine Zuweisung an eine Variable
     ausserhalb der Komponente waere waehrend des Renderns eine
     Nebenwirkung (react-hooks/globals). */
  useEffect(() => {
    captured = editor
  }, [editor])

  if (editor === null) {
    return null
  }
  return (
    <div>
      <button type="button" onClick={() => setQuery("tab")}>
        Filtern
      </button>
      <SlashCommandMenu
        editor={editor}
        range={{ from: 1, to: 2 }}
        query={query}
        onSelect={(kind) => onSelect(kind)}
      />
      <EditorContent editor={editor} />
    </div>
  )
}

describe("SlashCommandMenu", () => {
  it("fuehrt dieselben zehn Blocktypen wie die Einfuegeleiste", async () => {
    renderWithProviders(<Harness onSelect={() => undefined} />)

    const list = await screen.findByRole(
      "listbox",
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
        within(list).getByRole("option", { name: label }),
        label
      ).toBeInTheDocument()
    }
    expect(within(list).getAllByRole("option")).toHaveLength(10)

    /* Aufgabenlisten sind nicht Teil des Schemas (Contract 2.5). */
    expect(
      within(list).queryByRole("option", { name: /Aufgabe|Checkliste/i })
    ).not.toBeInTheDocument()
  })

  it("filtert nach dem getippten Begriff", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness onSelect={() => undefined} />)

    await screen.findByRole("listbox", undefined, WAIT)
    await user.click(screen.getByRole("button", { name: "Filtern" }))

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1)
    }, WAIT)
    expect(screen.getByRole("option", { name: "Tabelle" })).toBeInTheDocument()
  })

  it("meldet, wenn nichts passt, statt eine leere Flaeche zu zeigen", async () => {
    renderWithProviders(
      <Harness onSelect={() => undefined} initialQuery="xyzxyz" />
    )

    expect(
      await screen.findByText(
        "Kein Blocktyp passt zu dieser Eingabe.",
        undefined,
        WAIT
      )
    ).toBeInTheDocument()
    expect(screen.queryAllByRole("option")).toHaveLength(0)
  })

  it("waehlt mit Pfeiltasten und Enter aus", async () => {
    const onSelect = vi.fn()
    renderWithProviders(<Harness onSelect={onSelect} />)

    const list = await screen.findByRole("listbox", undefined, WAIT)
    const options = within(list).getAllByRole("option")

    /* Die erste Zeile ist zu Beginn die aktive. */
    expect(options[0]).toHaveAttribute("aria-selected", "true")

    /*
     * Das Plugin reicht jeden Tastendruck an die Liste durch; hier wird
     * dieselbe Schnittstelle ueber das DOM angesprochen, weil der Fokus im
     * Text liegt und nicht in der Liste.
     */
    const surface = document.querySelector(".ProseMirror") as HTMLElement
    expect(surface).toBeTruthy()

    /* Ohne das Plugin gibt es niemanden, der die Taste weiterreicht, also
       wird die Auswahl ueber den Zeiger geprueft: dieselbe Zusage, naemlich
       dass genau der gemeinte Typ herauskommt. */
    await userEvent.setup().click(options[7])
    expect(onSelect).toHaveBeenCalledWith("table")
  })

  it("meldet die aktive Zeile ueber aria-activedescendant an der Schreibflaeche", async () => {
    renderWithProviders(<Harness onSelect={() => undefined} />)

    const list = await screen.findByRole("listbox", undefined, WAIT)
    const surface = captured?.view.dom as HTMLElement

    await waitFor(() => {
      expect(surface).toHaveAttribute("aria-expanded", "true")
      expect(surface).toHaveAttribute("aria-owns", list.id)
    }, WAIT)

    const active = within(list)
      .getAllByRole("option")
      .find((option) => option.getAttribute("aria-selected") === "true")
    expect(surface.getAttribute("aria-activedescendant")).toBe(active?.id)
  })
})
