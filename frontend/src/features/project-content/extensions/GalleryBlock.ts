import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"

import {
  galleryColumnsAttribute,
  galleryItemsAttribute,
  textAttribute,
} from "@/features/project-content/extensions/attributes"
import { MediaNodeView } from "@/features/project-content/extensions/MediaNodeView"

/**
 * GALLERY (Contract 2.5, seit v51 mit {@code items} statt {@code fileIds}).
 *
 * <p>Jedes Bild traegt seinen eigenen Alternativtext: {@code items} ist ein
 * Array aus {@code { fileId, alt }}, die Array-Reihenfolge ist die
 * Anzeigereihenfolge. Der gemeinsame {@code caption} beschreibt die Gruppe
 * und ersetzt die Textalternative des einzelnen Bildes nicht; wer sich eine
 * Galerie vorlesen laesst, erfuehre sonst zum dritten Bild nichts
 * (SC 1.1.1). Ein leerer {@code alt} bleibt zulaessig und heisst
 * ausdruecklich "schmueckend".
 */
export const GalleryBlock = Node.create({
  name: "galleryBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      items: galleryItemsAttribute(),
      columns: galleryColumnsAttribute(),
      caption: textAttribute("caption", ""),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="gallery-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "gallery-block" }),
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
