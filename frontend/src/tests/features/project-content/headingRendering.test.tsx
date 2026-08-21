import { render } from "@testing-library/react"
import { Editor } from "@tiptap/react"
import { afterEach, describe, expect, it } from "vitest"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import type {
  HeadingLevel,
  ProjectDocument,
} from "@/features/project-content/blockTypes"
import {
  ariaLevelFor,
  headingTagFor,
} from "@/features/project-content/headingRendering"

/**
 * Die Renderabbildung der Ueberschriftenebenen (Contract 2.5 seit v63) auf
 * <strong>beiden</strong> Wegen: Schreibflaeche und Lesepfad.
 *
 * <p>Genau daran hat es gehakt. Der Editor gab {@code h1} bis {@code h6}
 * aus, waehrend die Detailseite {@code h2} bis {@code h6} und ein
 * {@code div} zeigte: auf der Schreibflaeche standen zwei {@code h1}
 * (Projekttitel und Block), und die Ueberschriftenliste eines Screenreaders
 * sah im Editor anders aus als in der Vorschau daneben (SC 1.3.1). Der
 * Contract sagt die Abbildung ausdruecklich „im Editor wie in der
 * oeffentlichen Detailansicht" zu; dieser Test haelt beide Wege daran fest.
 */

const LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6]

/** Die Abbildung aus 2.5, hier ausgeschrieben statt aus dem Code geholt. */
const EXPECTED: Record<HeadingLevel, string> = {
  1: "H2",
  2: "H3",
  3: "H4",
  4: "H5",
  5: "H6",
  6: "DIV",
}

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

function documentOf(level: HeadingLevel): ProjectDocument {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level, textAlign: null },
        content: [{ type: "text", text: `Ebene ${level}` }],
      },
    ],
  }
}

describe("Die gemeinsame Abbildung", () => {
  it("bildet jede Ebene auf das Element aus 2.5 ab", () => {
    for (const level of LEVELS) {
      expect(headingTagFor(level).toUpperCase(), String(level)).toBe(
        EXPECTED[level]
      )
    }
  })

  it("gibt nur Ebene 6 ein aria-level, naemlich 7", () => {
    for (const level of LEVELS) {
      expect(ariaLevelFor(level), String(level)).toBe(
        level === 6 ? 7 : undefined
      )
    }
  })

  it("erzeugt nie ein h1: die einzige Ebene 1 ist der Projekttitel", () => {
    for (const level of LEVELS) {
      expect(headingTagFor(level)).not.toBe("h1")
    }
  })
})

describe("Schreibflaeche", () => {
  it("gibt jede Ebene in demselben Element aus wie der Lesepfad", () => {
    for (const level of LEVELS) {
      const container = document.createElement("div")
      document.body.append(container)

      editor = new Editor({
        element: container,
        extensions: createBlockExtensions(),
        content: documentOf(level),
      })

      const rendered = container.querySelector(".ProseMirror")?.firstElementChild
      expect(rendered?.tagName, String(level)).toBe(EXPECTED[level])
      expect(rendered?.textContent).toBe(`Ebene ${level}`)

      editor.destroy()
      editor = null
      container.remove()
    }
  })

  it("zeichnet Ebene 6 als role=heading mit aria-level 7 aus", () => {
    const container = document.createElement("div")
    document.body.append(container)

    editor = new Editor({
      element: container,
      extensions: createBlockExtensions(),
      content: documentOf(6),
    })

    const rendered = container.querySelector(".ProseMirror")?.firstElementChild
    expect(rendered?.getAttribute("role")).toBe("heading")
    expect(rendered?.getAttribute("aria-level")).toBe("7")

    container.remove()
  })

  it("traegt die Ausrichtung als Datenattribut, nicht als Inline-Stil", () => {
    const container = document.createElement("div")
    document.body.append(container)

    editor = new Editor({
      element: container,
      extensions: createBlockExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: "center" },
            content: [{ type: "text", text: "Mittig" }],
          },
        ],
      } as ProjectDocument,
    })

    const rendered = container.querySelector(".ProseMirror")?.firstElementChild
    expect(rendered?.getAttribute("data-text-align")).toBe("center")
    expect(rendered?.getAttribute("style")).toBeNull()

    container.remove()
  })

  /*
   * Der Kern des Befunds: der Projekttitel ist die einzige h1 der Seite,
   * und ein HEADING-Block darf ihm keine zweite danebenstellen.
   */
  it("stellt dem Projekttitel keine zweite h1 daneben", () => {
    const container = document.createElement("div")
    document.body.append(container)

    editor = new Editor({
      element: container,
      extensions: createBlockExtensions(),
      content: documentOf(1),
    })

    render(<h1>Projekttitel</h1>)

    expect(document.querySelectorAll("h1")).toHaveLength(1)

    container.remove()
  })
})
