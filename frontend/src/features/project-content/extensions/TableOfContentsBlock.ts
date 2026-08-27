import { mergeAttributes, Node } from "@tiptap/react"

import { tocEntriesAttribute } from "@/features/project-content/extensions/attributes"

/**
 * TABLE_OF_CONTENTS (Contract 2.5, seit v84).
 *
 * <p>Ein Atom: der Block hat keinen bearbeitbaren Inhalt, seine Eintraege
 * stehen in {@code attrs.entries}. Geschrieben werden sie nicht von Hand,
 * sondern von der Aktion „Inhaltsverzeichnis aktualisieren" in der Toolbar,
 * die die Ueberschriften des Dokuments abliest.
 *
 * <p><strong>Eine Momentaufnahme und keine Ableitung.</strong> Die Gliederung
 * steht im Dokument und wird ausdruecklich aktualisiert. Der Grund liegt im
 * Lesepfad: Detailansicht, Redaktionsansicht und PDF-Export rendern
 * gespeicherte Bloecke ohne laufenden Editor, und eine Ableitung waere dort
 * dreimal getrennt zu bauen und liefe auseinander. Der Preis ist, dass ein
 * Verzeichnis veralten kann; der Editor weist darauf hin.
 *
 * <p><strong>Loeschbar wie jeder andere Block.</strong> Wer keines will,
 * entfernt ihn ueber den Blockgriff; es entsteht nicht von selbst wieder.
 */
export const TableOfContentsBlock = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      entries: tocEntriesAttribute(),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="table-of-contents"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "table-of-contents" }),
    ]
  },
})
