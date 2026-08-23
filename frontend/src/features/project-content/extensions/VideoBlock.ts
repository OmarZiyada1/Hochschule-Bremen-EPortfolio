import { mergeAttributes, Node } from "@tiptap/react"

import { textAttribute } from "@/features/project-content/extensions/attributes"

/**
 * VIDEO (Contract 2.5, seit v51 mit zwei Quellen).
 *
 * <p>Der Block traegt <strong>entweder</strong> {@code fileId} fuer die
 * hochgeladene Datei <strong>oder</strong> {@code provider} mit
 * {@code videoId} fuer die Einbettung, nie beides und nie keines; beides
 * zugleich oder keines ergibt serverseitig 400 BLOCK_CONTENT_INVALID.
 *
 * <p><strong>Keine URL, in keinem Feld.</strong> Im Einbettungsfall
 * speichert der Block nur Anbieter, Kennung und, bei einem nicht
 * gelisteten Vimeo-Video, dessen Freigabe-Hash; die Adresse entsteht erst
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
      /* Nur bei vimeo und nur bei nicht gelisteten Videos (2.5 seit
         v64). */
      hash: textAttribute("hash"),
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
})
