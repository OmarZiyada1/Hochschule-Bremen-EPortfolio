import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"

import { textAttribute } from "@/features/project-content/extensions/attributes"
import { MediaNodeView } from "@/features/project-content/extensions/MediaNodeView"

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

  /**
   * Die Ansicht auf der Schreibflaeche (KAN-36).
   *
   * <p>Ohne sie stuende hier ein leeres Element: {@link renderHTML} gibt die
   * Attribute aus, aber keinen Inhalt, weil die Anzeige im Lesepfad ueber
   * einen eigenen JSON-Renderer laeuft. Beim Schreiben waere der Block damit
   * unsichtbar. Was die Ansicht zeigt und was bewusst nicht, steht in
   * {@code MediaNodeView}.
   */
  addNodeView() {
    return ReactNodeViewRenderer(MediaNodeView)
  },
})
