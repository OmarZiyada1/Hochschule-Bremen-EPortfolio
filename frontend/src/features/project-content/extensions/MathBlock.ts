import { mergeAttributes, Node } from "@tiptap/react"

import { textAttribute } from "@/features/project-content/extensions/attributes"

/**
 * FORMULA (Contract 2.5): eine Formel in KaTeX-Syntax.
 *
 * <p>2.5 nennt allein {@code latex}; ein {@code displayMode} gibt es nicht,
 * Formeln stehen im Blockmodus. Dargestellt wird ueber
 * {@code renderer/renderMath.ts}, den einzigen KaTeX-Aufruf des Projekts.
 */
export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: textAttribute("latex", ""),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "math-block" }),
    ]
  },
})
