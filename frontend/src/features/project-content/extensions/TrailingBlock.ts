import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"

/** Damit die Ergaenzung nicht als eigener Schritt im Rueckgaengig steht. */
const TRAILING_BLOCK_KEY = new PluginKey("trailingBlock")

/**
 * Hinter dem letzten Block liegt immer ein leerer Absatz (KAN-83).
 *
 * <p><strong>Das Problem.</strong> Endete ein Beitrag mit einem Bild, einer
 * Tabelle, einem Video oder einer Trennlinie, gab es darunter keine Stelle
 * mehr, in die sich klicken liess. Wer etwas anhaengen wollte, musste die
 * Einfuegen-Schaltflaeche am letzten Block treffen oder erst hineinklicken
 * und Enter druecken. Beides ist ein Umweg um etwas, das eine Schreibflaeche
 * von sich aus anbieten sollte.
 *
 * <p><strong>Warum nicht die offizielle {@code TrailingNode}</strong> aus
 * {@code @tiptap/extensions} (Frontend-Regel 11, Ausnahmefall „Bibliothek hat
 * es nicht"). Sie loest nur die Haelfte des Falls, und einstellen laesst sich
 * das nicht: ihre Sperrliste entsteht als
 * {@code (options.notAfter || []).concat(defaultNode)}, und
 * {@code defaultNode} ist der Absatz. Der Absatz steht damit immer darin,
 * gleich was {@code notAfter} sagt. Ein Beitrag, der auf einen gefuellten
 * Absatz endet, bekommt von ihr also keinen Schlussblock. Die Sperre ist
 * dort auch richtig: ohne sie haenge die Erweiterung an ihren eigenen leeren
 * Absatz sofort den naechsten und liefe endlos. Diese Fassung bricht die
 * Schleife stattdessen an der Bedingung, nicht am Knotentyp: angehaengt wird
 * nur, wenn der letzte Knoten kein <em>leerer</em> Absatz ist, und nach dem
 * Anhaengen ist er genau das.
 *
 * <p>Dasselbe Vorgehen und dieselbe Begruendung wie bei
 * {@code BlockDropCursor} (KAN-36): das StarterKit schaltet seine Fassung ab,
 * diese nimmt ihren Platz ein, und der Nachweis steht hier.
 *
 * <p><strong>Ohne Eintrag in der Historie.</strong> Die Transaktion laeuft
 * mit {@code addToHistory: false}, sonst naehme ein Rueckgaengig zuerst den
 * Schlussblock weg statt den letzten Handgriff der Autor:in.
 *
 * <p><strong>Nur mit Schreibrecht.</strong> In der gesperrten Ansicht (Status
 * ausserhalb von DRAFT und REVISION, oder ein fremdes Projekt in der
 * Redaktionsansicht) waere eine leere Zeile am Ende Raum ohne Anlass. Im
 * Lesepfad gibt es die Erweiterung ohnehin nicht: sie wird im Editor-Schema
 * angemeldet und nicht im Blockschema.
 *
 * <p><strong>Gespeichert wird er nicht.</strong> {@code docToBlocks} schneidet
 * genau einen abschliessenden leeren Absatz ab. Deshalb haengt diese
 * Erweiterung auch nie zwei hintereinander an: gaebe es zwei, bliebe einer
 * stehen und erschiene im Lesepfad und im Ausdruck als Leerraum.
 */
export const TrailingBlock = Extension.create({
  name: "trailingBlock",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: TRAILING_BLOCK_KEY,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!this.editor.isEditable) {
            return null
          }
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }

          const { doc, tr, schema } = newState
          const last = doc.lastChild
          const isEmptyParagraph =
            last !== null &&
            last.type.name === "paragraph" &&
            last.content.size === 0
          if (isEmptyParagraph) {
            return null
          }

          const paragraph = schema.nodes.paragraph
          if (paragraph === undefined) {
            return null
          }
          return tr
            .insert(doc.content.size, paragraph.create())
            .setMeta("addToHistory", false)
        },
      }),
    ]
  },
})
