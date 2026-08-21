import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"

import {
  imageWidthAttribute,
  textAttribute,
} from "@/features/project-content/extensions/attributes"
import { MediaNodeView } from "@/features/project-content/extensions/MediaNodeView"

/**
 * IMAGE (Contract 2.5): ein einzelnes Bild aus dem Objektspeicher.
 *
 * <p>Im Dokument steht ausschliesslich die {@code fileId}; weder Base64
 * noch eine Speicheradresse (Containername, Endpoint, Speicherschluessel)
 * liegt im Inhalt, weil der Objektspeicher austauschbar ist (3.15, 3.15.1).
 * Die Adresse entsteht erst zur Anzeige aus {@code apiPaths.files.detail}.
 *
 * <p>{@code width} traegt das Layout im Dokument und nicht im Stylesheet,
 * damit ein Beitrag in Editor, Vorschau, Detailseite und PDF gleich
 * aussieht. Genau drei Stufen, serverseitig gegen dieselbe Menge geprueft.
 */
export const ImageBlock = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: textAttribute("fileId"),
      alt: textAttribute("alt", ""),
      caption: textAttribute("caption", ""),
      width: imageWidthAttribute(),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "image-block" }),
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
