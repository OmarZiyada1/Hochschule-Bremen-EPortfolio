import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"

/**
 * Entfernt {@code textAlign: "justify"} an jeder Ueberschrift, sobald es
 * entsteht (Contract 2.5 seit v63).
 *
 * <p><strong>Warum eine Schaltflaeche allein nicht genuegt.</strong> Die
 * Auswahlleiste zeigt den Blocksatz bei markierter Ueberschrift deaktiviert,
 * aber sie ist nicht der einzige Weg zu dem Wert: {@code TextAlign} bringt
 * eigene Tastenkuerzel mit, und eingefuegter Inhalt kann das Attribut
 * mitbringen. Beides fuehrte zu einem Dokument, das der Server mit 400
 * {@code BLOCK_CONTENT_INVALID} abweist, und weil
 * {@code PUT /projects/{id}/blocks} die <em>gesamte</em> Liste prueft, bevor
 * es die erste Zeile schreibt, waere danach kein Autosave des ganzen
 * Beitrags mehr moeglich. Ein einziges Tastenkuerzel machte den Beitrag
 * unspeicherbar.
 *
 * <p>Es ist deshalb die zweite von drei Absicherungen: deaktivierte
 * Schaltflaeche in der Leiste, dieses Plugin gegen Kuerzel und Einfuegen,
 * und die Serverpruefung als letzte Instanz.
 *
 * <p>Der Eingriff laeuft ueber {@code appendTransaction} und nicht ueber
 * einen Filter: die Aenderung soll durchgehen und der unzulaessige Wert
 * unmittelbar danach fallen. Ein abgewiesener Tastendruck fuehlte sich an
 * wie eine haengende Tastatur.
 */
export const HeadingAlignGuard = Extension.create({
  name: "headingAlignGuard",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingAlignGuard"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }
          let transaction = newState.tr
          let touched = false
          newState.doc.descendants((node, position) => {
            if (
              node.type.name === "heading" &&
              node.attrs.textAlign === "justify"
            ) {
              transaction = transaction.setNodeMarkup(position, undefined, {
                ...node.attrs,
                textAlign: null,
              })
              touched = true
            }
            /* Ueberschriften stehen nur auf der obersten Ebene; tiefer zu
               steigen kostet bei langen Beitraegen ohne Nutzen. */
            return false
          })
          return touched ? transaction : null
        },
      }),
    ]
  },
})
