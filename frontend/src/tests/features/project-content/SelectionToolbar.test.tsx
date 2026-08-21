import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Editor } from "@tiptap/react"
import { afterEach, describe, expect, it } from "vitest"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { SelectionToolbarContent } from "@/features/project-content/components/SelectionToolbar"
import { renderWithProviders } from "@/tests/render"

/**
 * Die Auswahlleiste (KAN-36): vier Gruppen, ein Tabstopp, Pfeiltasten
 * darin, und die Sonderregeln aus Contract 2.5.
 *
 * <p>Geprueft wird gegen einen echten Editor: die Leiste liest ihren
 * Zustand aus ihm, und eine Attrappe pruefte nur die Attrappe. Die
 * Textauswahl setzt der Test ueber die Editor-Befehle, weil eine echte
 * Mausauswahl in jsdom keine ProseMirror-Selektion erzeugt.
 */

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

function createEditor(content: ProjectDocument): Editor {
  editor = new Editor({
    extensions: createBlockExtensions(),
    content,
  })
  return editor
}

function paragraphDocument(text: string): ProjectDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [{ type: "text", text }],
      },
    ],
  }
}

function headingDocument(text: string): ProjectDocument {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, textAlign: null },
        content: [{ type: "text", text }],
      },
    ],
  }
}

/**
 * Markiert den Text des ersten Blocks.
 *
 * <p><strong>Eine Textauswahl und kein {@code selectAll}</strong>, und der
 * Unterschied ist keine Feinheit: {@code selectAll} erzeugt eine
 * {@code AllSelection} ueber dem Dokumentknoten, und {@code isActive} mit
 * Attributen meldet darin nichts, weil es keinen umschliessenden Block
 * gibt. Die Leiste erscheint ohnehin nur ueber markiertem Text, also ist
 * die Textauswahl auch der wirklichkeitsnahe Fall.
 */
function selectFirstBlock(instance: Editor): Editor {
  const first = instance.state.doc.child(0)
  instance.commands.setTextSelection({ from: 1, to: first.nodeSize - 1 })
  return instance
}

/**
 * Rendert den Inhalt der Leiste mit einer Auswahl ueber dem ersten Block.
 *
 * <p>Geprueft wird {@code SelectionToolbarContent} und nicht die Blase
 * darum: {@code BubbleMenu} haengt sein Kind an die View des Editors und
 * entscheidet ueber die Positionierung ueber floating-ui, das in jsdom
 * nicht rechnet. Dass die Blase erscheint, sobald Text markiert ist, ist
 * Verhalten der Bibliothek; hier geht es um die vier Gruppen darin.
 */
function renderToolbar(content: ProjectDocument) {
  const instance = selectFirstBlock(createEditor(content))
  return renderWithProviders(<SelectionToolbarContent editor={instance} />)
}

function toolbar(): HTMLElement {
  return screen.getByRole("toolbar", { name: "Textformatierung" })
}

describe("Aufbau und Reihenfolge", () => {
  it("fuehrt die vier Gruppen in der Reihenfolge des Templates", () => {
    renderToolbar(paragraphDocument("Ein Absatz."))

    const groups = within(toolbar()).getAllByRole("group")
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Zeichenauszeichnung",
      "Blockformat",
    ])
    /* Blocktyp und Farbe sind Auslöser und keine Gruppen: sie tragen ihren
       Namen selbst. */
    expect(
      within(toolbar()).getByRole("button", { name: "Blocktyp" })
    ).toBeInTheDocument()
    expect(
      within(toolbar()).getByRole("button", { name: "Farbe" })
    ).toBeInTheDocument()
  })

  it("fuehrt genau die acht Auszeichnungen aus 2.5", () => {
    renderToolbar(paragraphDocument("Ein Absatz."))

    const marks = within(toolbar()).getByRole("group", {
      name: "Zeichenauszeichnung",
    })
    expect(
      within(marks)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual([
      "Fett",
      "Kursiv",
      "Unterstrichen",
      "Durchgestrichen",
      "Inline-Code",
      "Hochgestellt",
      "Tiefgestellt",
      "Link",
    ])
  })

  /*
   * Der zugaengliche Name steht als sr-only-Text im Element und nicht als
   * aria-label: der Tooltip ergaenzt ihn und ersetzt ihn nicht, und auf
   * Touch erscheint er gar nicht. Ein aria-label allein braeche ausserdem
   * SC 2.5.3, sobald jemand die Schaltflaeche per Sprache anspricht.
   */
  it("gibt jeder Symbolschaltflaeche ihren Namen als Text im Element", () => {
    renderToolbar(paragraphDocument("Ein Absatz."))

    const marks = within(toolbar()).getByRole("group", {
      name: "Zeichenauszeichnung",
    })
    for (const button of within(marks).getAllByRole("button")) {
      expect(button.querySelector(".sr-only")?.textContent).toBe(
        button.textContent
      )
      expect(button).not.toHaveAttribute("aria-label")
    }
  })
})

describe("Tastatur und Fokus", () => {
  /*
   * WAI-ARIA Toolbar Pattern: die Leiste ist ein Tabstopp, innerhalb wird
   * mit den Pfeiltasten gewechselt.
   */
  it("traegt genau einen Tabstopp", () => {
    renderToolbar(paragraphDocument("Ein Absatz."))

    const focusable = within(toolbar())
      .getAllByRole("button")
      .filter((button) => button.getAttribute("tabindex") === "0")

    expect(focusable).toHaveLength(1)
  })

  it("wechselt mit den Pfeiltasten und springt mit Pos1 und Ende", async () => {
    const user = userEvent.setup()
    renderToolbar(paragraphDocument("Ein Absatz."))

    const buttons = within(toolbar()).getAllByRole("button")
    buttons[0].focus()

    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(buttons[1])

    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(buttons[0])

    await user.keyboard("{End}")
    expect(document.activeElement).toBe(buttons[buttons.length - 1])

    await user.keyboard("{Home}")
    expect(document.activeElement).toBe(buttons[0])
  })

  it("laeuft mit den Pfeiltasten ueber Gruppengrenzen hinweg", async () => {
    const user = userEvent.setup()
    renderToolbar(paragraphDocument("Ein Absatz."))

    const link = within(toolbar()).getByRole("button", { name: "Link" })
    link.focus()

    await user.keyboard("{ArrowRight}")

    /* Hinter dem Link endet die zweite Gruppe; der Fokus geht in die
       dritte und bleibt nicht darin stecken. */
    expect(document.activeElement).toBe(
      within(toolbar()).getByRole("button", { name: "Aufzählungsliste" })
    )
  })
})

describe("Einstieg aus dem Text", () => {
  /*
   * Confluence „Template: Editor (Bearbeiten)", Abschnitt Tastatur und
   * Fokus: Alt+F10 setzt den Fokus aus dem Text in die Leiste. Ohne den
   * Hinweg gibt es fuer eine Tastaturbedienung keinen: die Leiste erscheint
   * erst mit der Auswahl, und wer sie mit Tab suchte, verloere unterwegs die
   * Markierung, an der sie haengt.
   */
  it("holt den Fokus mit Alt+F10 in die Leiste", async () => {
    const user = userEvent.setup()
    const container = document.createElement("div")
    document.body.append(container)
    const instance = new Editor({
      element: container,
      extensions: createBlockExtensions(),
      content: paragraphDocument("Ein Absatz."),
    })
    editor = instance
    selectFirstBlock(instance)
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    instance.view.dom.focus()
    await user.keyboard("{Alt>}{F10}{/Alt}")

    const first = within(toolbar()).getAllByRole("button")[0]
    expect(document.activeElement).toBe(first)

    container.remove()
  })
})

describe("Auszeichnungen", () => {
  it("meldet den gesetzten Zustand ueber aria-pressed", async () => {
    const user = userEvent.setup()
    const instance = selectFirstBlock(createEditor(paragraphDocument("Ein Absatz.")))
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    const bold = within(toolbar()).getByRole("button", { name: "Fett" })
    expect(bold).toHaveAttribute("aria-pressed", "false")

    await user.click(bold)

    expect(instance.isActive("bold")).toBe(true)
  })
})

describe("Blockformat", () => {
  /*
   * Der Happy Path der drei Schaltflaechen. Er fehlte, und deshalb blieb
   * unbemerkt, dass toggleBlockquote nach dem Wechsel auf einen eigenen
   * Blockquote-Knoten gar nicht mehr existierte: der Klick endete in einem
   * TypeError, und der Typecheck sah ihn nicht, weil die Kommandotypen der
   * Bibliothek transitiv im Typgraphen stehen.
   */
  it("schaltet Zitat, Aufzaehlung und Nummerierung wirklich um", async () => {
    const user = userEvent.setup()
    const instance = selectFirstBlock(
      createEditor(paragraphDocument("Ein Absatz."))
    )
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    await user.click(within(toolbar()).getByRole("button", { name: "Zitat" }))
    expect(instance.isActive("blockquote")).toBe(true)

    await user.click(
      within(toolbar()).getByRole("button", { name: "Aufzählungsliste" })
    )
    expect(instance.isActive("bulletList")).toBe(true)

    await user.click(
      within(toolbar()).getByRole("button", { name: "Nummerierte Liste" })
    )
    expect(instance.isActive("orderedList")).toBe(true)
  })
})

describe("Ausrichtung", () => {
  /*
   * 2.5 seit v63: textAlign am HEADING nur mit left, center und right. Die
   * Schaltflaeche verschwindet nicht, sondern wird deaktiviert; eine
   * verschwindende aenderte Breite und Reihenfolge der Gruppe (SC 3.2.4).
   */
  it("deaktiviert den Blocksatz bei markierter Ueberschrift, statt ihn zu verstecken", async () => {
    const user = userEvent.setup()
    renderToolbar(headingDocument("Eine Ueberschrift"))

    await user.click(
      within(toolbar()).getByRole("button", { name: "Ausrichtung" })
    )

    const justify = await screen.findByRole("button", { name: "Blocksatz" })
    expect(justify).toBeInTheDocument()
    expect(justify).toHaveAttribute("aria-disabled", "true")
    /* aria-disabled und nicht disabled: die Schaltflaeche bleibt
       anfokussierbar und damit erklaerbar. */
    expect(justify).not.toBeDisabled()
    expect(
      screen.getByText(/Blocksatz gibt es nur im Absatz/)
    ).toBeInTheDocument()
  })

  /*
   * Der gefaehrliche Fall: editor.isActive("heading") meldet bei einer
   * Auswahl ueber mehrere Bloecke false. Waere er die einzige Schranke,
   * liesse sich der Blocksatz ueber Strg+A doch an einer Ueberschrift
   * setzen, und danach scheiterte jeder Autosave des Projekts dauerhaft mit
   * 400 (§2.5 seit v63, Befund des Contract-Abgleichs zu KAN-36).
   */
  it("deaktiviert den Blocksatz auch bei Auswahl ueber Absatz und Ueberschrift", async () => {
    const user = userEvent.setup()
    const instance = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [{ type: "text", text: "Ein Absatz." }],
        },
        {
          type: "heading",
          attrs: { level: 1, textAlign: null },
          content: [{ type: "text", text: "Eine Ueberschrift" }],
        },
      ],
    })
    /* Auswahl ueber beide Bloecke hinweg, wie bei Strg+A. */
    instance.commands.setTextSelection({
      from: 1,
      to: instance.state.doc.content.size - 1,
    })
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    await user.click(
      within(toolbar()).getByRole("button", { name: "Ausrichtung" })
    )

    const justify = await screen.findByRole("button", { name: "Blocksatz" })
    expect(justify).toHaveAttribute("aria-disabled", "true")

    await user.click(justify)
    /* Und geschrieben wird auch nichts. */
    expect(instance.isActive({ textAlign: "justify" })).toBe(false)
  })

  it("laesst den Blocksatz am Absatz zu", async () => {
    const user = userEvent.setup()
    renderToolbar(paragraphDocument("Ein Absatz."))

    await user.click(
      within(toolbar()).getByRole("button", { name: "Ausrichtung" })
    )

    const justify = await screen.findByRole("button", { name: "Blocksatz" })
    expect(justify).not.toHaveAttribute("aria-disabled")
    expect(
      screen.queryByText(/Blocksatz gibt es nur im Absatz/)
    ).not.toBeInTheDocument()
  })
})

describe("Farbe", () => {
  /*
   * Die Schrift auf einer Hervorhebung bleibt --foreground; fuer eine
   * Kombination aus Textfarbe und Hervorhebung ist kein Kontrast von 4,5:1
   * zugesichert (SC 1.4.3).
   */
  it("setzt eine Textfarbe und entfernt dabei die Hervorhebung", async () => {
    const user = userEvent.setup()
    const instance = selectFirstBlock(
      createEditor(paragraphDocument("Ein Absatz."))
    )
    /* Ausgangslage: die Auswahl traegt bereits eine Hervorhebung. */
    instance.chain().setHighlight({ color: "amber" }).run()
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    await user.click(within(toolbar()).getByRole("button", { name: "Farbe" }))
    /* Jeder Rollenname steht zweimal im Menue, je Gruppe einmal: das erste
       Feld gehoert zur Textfarbe, das zweite zur Hervorhebung. */
    const swatches = await screen.findAllByRole("menuitemradio", {
      name: "Blau",
    })
    expect(swatches).toHaveLength(2)
    await user.click(swatches[0])

    expect(instance.getAttributes("textStyle").color).toBe("blue")
    expect(instance.isActive("highlight")).toBe(false)
  })

  it("setzt eine Hervorhebung und entfernt dabei die Textfarbe", async () => {
    const user = userEvent.setup()
    const instance = selectFirstBlock(
      createEditor(paragraphDocument("Ein Absatz."))
    )
    instance.chain().setMark("textStyle", { color: "red" }).run()
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    await user.click(within(toolbar()).getByRole("button", { name: "Farbe" }))
    const swatches = await screen.findAllByRole("menuitemradio", {
      name: "Grün",
    })
    await user.click(swatches[1])

    expect(instance.getAttributes("highlight").color).toBe("green")
    expect(instance.getAttributes("textStyle").color).toBeFalsy()
  })

  it("fuehrt je Gruppe Standard und die neun Rollen", async () => {
    const user = userEvent.setup()
    renderToolbar(paragraphDocument("Ein Absatz."))

    await user.click(within(toolbar()).getByRole("button", { name: "Farbe" }))

    const swatches = await screen.findAllByRole("menuitemradio")
    /* Zwei Gruppen mit je zehn Feldern: Standard und neun Rollen (2.5 seit
       v63). */
    expect(swatches).toHaveLength(20)
  })
})

describe("Blocktyp", () => {
  it("fuehrt Text und die sechs Ebenen und markiert den aktuellen Eintrag", async () => {
    const user = userEvent.setup()
    renderToolbar(headingDocument("Eine Ueberschrift"))

    await user.click(within(toolbar()).getByRole("button", { name: "Blocktyp" }))

    const items = await screen.findAllByRole("menuitemradio")
    expect(items.map((item) => item.textContent)).toEqual([
      "Text",
      "Überschrift 1",
      "Überschrift 2",
      "Überschrift 3",
      "Überschrift 4",
      "Überschrift 5",
      "Überschrift 6",
    ])
    /* Der aktuelle Eintrag steht nicht nur im Auslöser: ohne aria-checked
       traegt die Liste keinen erkennbaren Ist-Zustand. */
    expect(items[1]).toHaveAttribute("aria-checked", "true")
  })

  it("setzt die gewaehlte Ebene im Dokument", async () => {
    const user = userEvent.setup()
    const instance = selectFirstBlock(createEditor(paragraphDocument("Ein Absatz.")))
    renderWithProviders(<SelectionToolbarContent editor={instance} />)

    await user.click(within(toolbar()).getByRole("button", { name: "Blocktyp" }))
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Überschrift 4" })
    )

    expect(instance.isActive("heading", { level: 4 })).toBe(true)
  })
})
