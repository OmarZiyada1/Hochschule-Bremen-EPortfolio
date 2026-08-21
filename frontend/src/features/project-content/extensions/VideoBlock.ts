import { Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react"

import { textAttribute } from "@/features/project-content/extensions/attributes"
import { MediaNodeView } from "@/features/project-content/extensions/MediaNodeView"

/**
 * VIDEO (Contract 2.5, seit v51 mit zwei Quellen).
 *
 * <p>Der Block traegt <strong>entweder</strong> {@code fileId} fuer die
 * hochgeladene Datei <strong>oder</strong> {@code provider} mit
 * {@code videoId} fuer die Einbettung, nie beides und nie keines; beides
 * zugleich oder keines ergibt serverseitig 400 BLOCK_CONTENT_INVALID.
 *
 * <p><strong>Keine URL, in keinem Feld.</strong> Im Einbettungsfall
 * speichert der Block nur Anbieter und Kennung; die Adresse entsteht erst
 * zur Anzeige in {@code embedUrlFor()}, aus fester Vorlage und nie aus
 * Eingabetext. Eine vom Client gelieferte Fremd-URL in der Datenbank waere
 * ein unnoetiger Angriffspunkt, weil sie beim Rendern in ein iframe
 * gelangt. Deshalb gibt es hier weder {@code embedUrl} noch {@code src}.
 *
 * <p>Dass Tiptap bei {@code toJSON} auch die unbelegten Attribute
 * mitschreibt ({@code fileId: null} neben einer Einbettung), ist
 * eingeplant: der Server wertet mit {@code hasNonNull} aus, und die
 * Whitelist beim Lesen tut dasselbe.
 */
export const VideoBlock = Node.create({
  name: "videoBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: textAttribute("fileId"),
      provider: textAttribute("provider"),
      videoId: textAttribute("videoId"),
      caption: textAttribute("caption", ""),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="video-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "video-block" }),
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
