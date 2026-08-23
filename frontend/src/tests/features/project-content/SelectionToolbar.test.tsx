import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"

import { Toolbar } from "@/components/ui/toolbar"
import { AlignMenu } from "@/features/project-content/components/AlignMenu"
import { BlockTypeMenu } from "@/features/project-content/components/BlockTypeMenu"
import { ColorMenu } from "@/features/project-content/components/ColorMenu"
import { SelectionToolbarBar } from "@/features/project-content/components/SelectionToolbar"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { renderWithProviders } from "@/tests/render"

/*
 * Die drei Menues und die Leiste werden mit einem echten Editor geprueft
 * und nicht gegen eine Attrappe: was sie tun, entscheidet das Schema aus
 * createEditorExtensions, und eine nachgebaute Editor-Schnittstelle
 * antwortete auf isActive genau das, was der Test hineinschreibt.
 */

const WAIT = { timeout: 20000 }

/** Rendert die uebergebene Bedienung ueber einem Dokument mit Auswahl. */
function Harness({
  html,
  children,
}: {
  html: string
  children: (editor: Editor) => React.ReactNode
}) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: html,
  })

  useEffect(() => {
    if (editor === null) {
      return
    }
    /*
     * Den Text des ersten Blocks markieren und nicht das ganze Dokument.
     *
     * <p><strong>selectAll war hier falsch</strong>, auch wenn es lange
     * durchging: TrailingNode aus dem StarterKit haelt hinter einer
     * Ueberschrift immer einen leeren Absatz bereit, eine Gesamtauswahl
     * umfasst also Ueberschrift <em>und</em> Absatz, und
     * {@code isActive("heading")} ist dann zu Recht falsch. Bemerkt wurde
     * es nicht, weil die Menues ihren Zustand beim Rendern lasen und der
     * Editor seit Tiptap v3 bei einer Transaktion nicht neu rendert: die
     * Anzeige blieb beim Anfangszustand stehen, in dem die Textmarke noch
     * in der Ueberschrift stand. Seit die Menues ueber useEditorState
     * mitlaufen (KAN-36), zeigt der Test den echten Zustand, und der
     * Aufbau muss die Lage nachstellen, um die es geht: markierter Text
     * innerhalb eines Blocks.
     */
    const first = editor.state.doc.child(0)
    editor.commands.setTextSelection({ from: 1, to: first.nodeSize - 1 })
  }, [editor])

  if (editor === null) {
    return null
  }
  /*
   * Die drei Menues sind Eintraege der Leiste: seit KAN-36 fuehrt Base UI
   * den Roving-Tabindex, und Toolbar.Button verlangt seinen Wurzelkontext.
   * Einzeln gerendert stuenden sie ausserhalb davon, was in der Anwendung
   * gar nicht vorkommt.
   */
  return (
    <div>
      <Toolbar aria-label="Auswahlleiste">{children(editor)}</Toolbar>
      <EditorContent editor={editor} />
    </div>
  )
}

function renderMenus(
  html: string,
  render: (editor: Editor) => React.ReactNode
) {
  return renderWithProviders(<Harness html={html}>{render}</Harness>)
}

describe("Blocktyp-Menue", () => {
  it("fuehrt Text und die sechs Ebenen und markiert den Ist-Zustand", async () => {
    const user = userEvent.setup()
    renderMenus("<h3>Zwischenueberschrift</h3>", (editor) => (
      <BlockTypeMenu editor={editor} disabled={false} />
    ))

    /* h3 im HTML ist die gespeicherte Ebene 3; angezeigt wird sie eine
       Stufe tiefer, beschriftet ist sie mit ihrer Gliederungsebene. */
    const trigger = await screen.findByRole(
      "button",
      { name: "Blocktyp" },
      WAIT
    )
    await user.click(trigger)

    const menu = await screen.findByRole("menu", undefined, WAIT)
    for (const label of [
      "Text",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Heading 4",
      "Heading 5",
      "Heading 6",
    ]) {
      expect(
        within(menu).getByRole("menuitemradio", { name: label }),
        label
      ).toBeInTheDocument()
    }

    expect(
      within(menu).getByRole("menuitemradio", { name: "Heading 3" })
    ).toHaveAttribute("aria-checked", "true")
  })
})

describe("Ausrichtungsmenue", () => {
  it("zeigt den Blocksatz an der Ueberschrift deaktiviert und nicht versteckt", async () => {
    const user = userEvent.setup()
    renderMenus("<h2>Eine Ueberschrift</h2>", (editor) => (
      <AlignMenu editor={editor} disabled={false} />
    ))

    await user.click(
      await screen.findByRole("button", { name: "Ausrichtung" }, WAIT)
    )

    /* Contract 2.5 seit v63: am HEADING ohne justify. Versteckt statt
       deaktiviert aenderte Breite und Reihenfolge der Gruppe (SC 3.2.4). */
    const justify = await screen.findByRole(
      "button",
      { name: "Blocksatz" },
      WAIT
    )
    expect(justify).toHaveAttribute("aria-disabled", "true")
    expect(justify).toBeVisible()
  })

  it("laesst den Blocksatz am Absatz zu", async () => {
    const user = userEvent.setup()
    renderMenus("<p>Ein Absatz</p>", (editor) => (
      <AlignMenu editor={editor} disabled={false} />
    ))

    await user.click(
      await screen.findByRole("button", { name: "Ausrichtung" }, WAIT)
    )
    const justify = await screen.findByRole(
      "button",
      { name: "Blocksatz" },
      WAIT
    )

    expect(justify).not.toHaveAttribute("aria-disabled", "true")
  })
})

describe("Farbmenue", () => {
  it("setzt eine Textfarbe als Rollennamen", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const seen: { editor?: Editor } = {}
    renderMenus("<p>Ein Absatz</p>", (editor) => {
      seen.editor = editor
      return <ColorMenu editor={editor} disabled={false} />
    })

    await user.click(await screen.findByRole("button", { name: "Farbe" }, WAIT))
    await user.click(
      await within(
        await screen.findByRole("group", { name: "Textfarbe" }, WAIT)
      ).findByRole("radio", { name: "Violett" })
    )

    /* Gespeichert wird der Rollenname und nie ein Hex-Wert (Contract 2.5). */
    await waitFor(() => {
      expect(seen.editor?.isActive("textStyle", { color: "purple" })).toBe(true)
      expect(seen.editor?.getHTML()).toContain('data-color="purple"')
    }, WAIT)
  })

  it("ersetzt eine gesetzte Textfarbe durch den Hintergrund, statt beides zu fuehren", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const seen: { editor?: Editor } = {}
    renderMenus("<p>Ein Absatz</p>", (editor) => {
      seen.editor = editor
      return <ColorMenu editor={editor} disabled={false} />
    })

    await screen.findByRole("button", { name: "Farbe" }, WAIT)
    await waitFor(() => expect(seen.editor).toBeDefined(), WAIT)
    seen.editor?.chain().focus().setMark("textStyle", { color: "purple" }).run()

    await user.click(await screen.findByRole("button", { name: "Farbe" }, WAIT))
    await user.click(
      await within(
        await screen.findByRole("group", { name: "Hintergrund" }, WAIT)
      ).findByRole("radio", { name: "Bernstein" })
    )

    /* Die Schrift auf einer Hervorhebung bleibt --foreground; fuer die
       Kombination beider ist kein Kontrast zugesichert (SC 1.4.3). */
    await waitFor(() => {
      expect(seen.editor?.isActive("highlight", { color: "amber" })).toBe(true)
      expect(seen.editor?.isActive("textStyle", { color: "purple" })).toBe(
        false
      )
    }, WAIT)
  })

  it("bietet Standard und die neun Rollen je Gruppe", async () => {
    const user = userEvent.setup()
    renderMenus("<p>Ein Absatz</p>", (editor) => (
      <ColorMenu editor={editor} disabled={false} />
    ))

    await user.click(await screen.findByRole("button", { name: "Farbe" }, WAIT))

    for (const name of ["Textfarbe", "Hintergrund"]) {
      const group = await screen.findByRole("group", { name }, WAIT)
      expect(within(group).getAllByRole("radio"), name).toHaveLength(10)
      expect(
        within(group).getByRole("radio", { name: "Standard" }),
        name
      ).toBeInTheDocument()
    }
  })
})

describe("Auswahlleiste", () => {
  it("ist ein einziger Tabstopp und wechselt innen mit den Pfeiltasten", async () => {
    const user = userEvent.setup()
    /* Die Leiste steht seit dem Umzug in die Kopfzeile dauerhaft da; hier
       wird sie fuer sich gerendert, ohne den Header darum. */
    renderMenus("<p>Ein Absatz</p>", (editor) => (
      <SelectionToolbarBar editor={editor} disabled={false} />
    ))

    const toolbar = await screen.findByRole(
      "toolbar",
      { name: "Textauszeichnung" },
      WAIT
    )
    const items = Array.from(
      toolbar.querySelectorAll<HTMLElement>("[data-toolbar-item]")
    )

    /* Zwoelf einzelne Tabstopps zwischen Text und Leiste waeren fuer
       Tastaturbedienung unbenutzbar (WAI-ARIA Authoring Practices). */
    expect(items.length).toBeGreaterThan(5)

    /*
     * Gefuehrt wird der Fokus seit KAN-36 von der Primitive Toolbar aus
     * Base UI und nicht mehr von dieser Datei. Die Zusage bleibt dieselbe:
     * genau ein Tabstopp, und die Pfeiltaste wandert darin weiter.
     */
    expect(items.filter((item) => item.tabIndex === 0)).toHaveLength(1)
    expect(items[0].tabIndex).toBe(0)

    items[0].focus()
    await user.keyboard("{ArrowRight}")

    await waitFor(() => {
      expect(items[1]).toHaveFocus()
      expect(items[1].tabIndex).toBe(0)
      expect(items[0].tabIndex).toBe(-1)
      expect(items.filter((item) => item.tabIndex === 0)).toHaveLength(1)
    }, WAIT)
  }, 30000)
})
