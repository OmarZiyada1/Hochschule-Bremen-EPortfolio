import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"

import {
  numberAttribute,
  textAttribute,
} from "@/features/project-content/extensions/attributes"
import { MediaNodeView } from "@/features/project-content/extensions/MediaNodeView"

/**
 * DOCUMENT (Contract 2.5): eine herunterladbare Datei, nach 3.15 genau ein
 * PDF.
 *
 * <p>Alle drei Attribute sind Pflicht und gegen
 * {@code BlockValidationService} verifiziert: ohne {@code fileName} haette
 * der Link keinen Text, ohne {@code size} liesse sich vor dem Klick nicht
 * abschaetzen, was geladen wird. {@code size} steht in Bytes und ist
 * groesser als null.
 */
export const DocumentBlock = Node.create({
  name: "documentBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: textAttribute("fileId"),
      fileName: textAttribute("fileName", ""),
      size: numberAttribute("size", 0),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="document-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "document-block" }),
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
