import { mergeAttributes, Node } from "@tiptap/react"

import {
  numberAttribute,
  textAttribute,
} from "@/features/project-content/extensions/attributes"

/**
 * EMBED (Contract 2.5): eine Einbettung eines der fuenf zugelassenen
 * Anbieter.
 *
 * <p>Anders als VIDEO fuehrt EMBED seine {@code embedUrl} mit, weil es fuer
 * figma und codepen keine Ableitung aus einer Kennung gibt. Dafuer
 * prueft der Server Anbieter <em>und</em> Host: ein passender Providername
 * mit fremdem Host waere sonst der bequeme Weg an der Allowlist vorbei und
 * ergibt 400 EMBED_PROVIDER_NOT_ALLOWED. Der Lesepfad prueft dasselbe noch
 * einmal und gibt bei fremdem Host kein iframe aus, sondern einen
 * Platzhalter mit der Adresse als reinem Text.
 *
 * <p>{@code height} steht in CSS-Pixeln; die Whitelist begrenzt sie beim
 * Lesen auf 200 bis 1200, damit eine Einbettung den Textfluss nicht sprengt
 * (SC 1.4.10).
 */
export const EmbedBlock = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      provider: textAttribute("provider"),
      embedUrl: textAttribute("embedUrl"),
      height: numberAttribute("height", 460),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "embed-block" }),
    ]
  },
})
