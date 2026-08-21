import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"

import { AlignMenu } from "@/features/project-content/components/AlignMenu"
import { BlockTypeMenu } from "@/features/project-content/components/BlockTypeMenu"
import { ColorMenu } from "@/features/project-content/components/ColorMenu"
import { SelectionToolbar } from "@/features/project-content/components/SelectionToolbar"
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
    /* Alles markieren: die Leiste erscheint ueber markiertem Text, und die
       Menues lesen den Zustand der Auswahl. */
    editor?.commands.selectAll()
  }, [editor])

  if (editor === null) {
    return null
  }
  return (
    <div>
      {children(editor)}
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
    seen.editor
      ?.chain()
      .focus()
      .setMark("textStyle", { color: "purple" })
      .run()

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
    renderMenus("<p>Ein Absatz</p>", (editor) => (
      <SelectionToolbar editor={editor} disabled={false} />
    ))

    const toolbar = await screen.findByRole(
      "toolbar",
      { name: "Textauszeichnung", hidden: true },
      WAIT
    )
    const items = Array.from(
      toolbar.querySelectorAll<HTMLElement>("[data-toolbar-item]")
    )

    /* Zwoelf einzelne Tabstopps zwischen Text und Leiste waeren fuer
       Tastaturbedienung unbenutzbar (WAI-ARIA Authoring Practices). */
    expect(items.length).toBeGreaterThan(5)
    expect(items.filter((item) => item.tabIndex === 0)).toHaveLength(1)
    expect(items[0].tabIndex).toBe(0)

    items[0].focus()
    await user.keyboard("{ArrowRight}")

    await waitFor(() => {
      expect(items[1]).toHaveFocus()
      expect(items[1].tabIndex).toBe(0)
      expect(items[0].tabIndex).toBe(-1)
    }, WAIT)
  })
})
