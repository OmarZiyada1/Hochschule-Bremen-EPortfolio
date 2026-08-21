import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"

import { textAttribute } from "@/features/project-content/extensions/attributes"
import { MediaNodeView } from "@/features/project-content/extensions/MediaNodeView"

/**
 * AUDIO (Contract 2.5, seit v51 ausschliesslich als Upload).
 *
 * <p>Der Block traegt {@code fileId} und {@code caption}, <strong>kein
 * {@code src}</strong>. Eine Fremdadresse im Dokument braeche die Regel aus
 * 3.15, dass Dateien nie im Dokument liegen, und waere beim Rendern ein
 * ungepruefter Abruf gegen einen beliebigen Host. Das bis v50 im Code
 * geduldete {@code src} erzeugt dieses Schema deshalb nicht; die Whitelist
 * entfernt ein mitgeliefertes, und der Server weist es mit 400 ab.
 */
export const AudioBlock = Node.create({
  name: "audioBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: textAttribute("fileId"),
      caption: textAttribute("caption", ""),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="audio-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "audio-block" }),
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
