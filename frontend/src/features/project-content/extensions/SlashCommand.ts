import { Extension, ReactRenderer, type Range } from "@tiptap/react"
import { Suggestion } from "@tiptap/suggestion"
import { PluginKey } from "@tiptap/pm/state"
import { createRef, type RefObject } from "react"

import {
  INSERT_ENTRIES,
  contentFor,
  type InsertKind,
} from "@/features/project-content/blockInsert"
import { insertBlockAtRange } from "@/features/project-content/editorCommands"
import {
  SlashCommandMenu,
  type SlashCommandMenuHandle,
} from "@/features/project-content/components/SlashCommandMenu"

/**
 * Der Slash-Befehl auf der Schreibflaeche (KAN-36).
 *
 * <p><strong>Gebaut auf {@code @tiptap/suggestion}</strong>, der offiziellen
 * Hilfsschicht fuer genau diesen Fall, und nicht auf einer eigenen
 * Eingaberegel. Sie bringt das Erkennen des Ausloesers, den laufenden
 * Suchbegriff, das Verwerfen bei Escape und das Verankern des Fensters am
 * Cursor mit; ein Nachbau haette all das noch einmal, nur schlechter.
 *
 * <p><strong>Positioniert wird ueber {@code props.mount}</strong>, den
 * empfohlenen Weg: das Plugin haengt das Element in den Container, haelt es
 * ueber Floating UI am Cursor und folgt Scrollen, Groessenaenderungen und
 * Layoutspruengen von selbst. Der Rueckgabewert raeumt alles wieder ab. Der
 * Weg ueber {@code clientRect} und eine eigene Positionierungsschleife ist
 * ausdruecklich der Notausgang und wird hier nicht gebraucht.
 *
 * <p><strong>Die Liste wird ueber {@code ReactRenderer} gerendert</strong>,
 * nicht ueber eine zweite React-Wurzel. {@code ReactRenderer} meldet sich
 * bei {@code editor.contentComponent} an, das Fenster haengt also im selben
 * React-Baum wie die Seite und behaelt Uebersetzung, Farbmodus und den
 * Editor-Kontext.
 *
 * <p><strong>Nur am Anfang einer leeren Zeile</strong>
 * ({@code startOfLine}). Ein Schraegstrich mitten im Satz ist ein
 * Schraegstrich und kein Befehl; ohne diese Einschraenkung oeffnete sich das
 * Fenster in jedem Datum und in jeder Adresse.
 */

export const slashCommandPluginKey = new PluginKey("slashCommand")

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    const editor = this.editor
    let renderer: ReactRenderer | null = null
    let unmount: (() => void) | null = null
    let handle: RefObject<SlashCommandMenuHandle | null> | null = null

    const select = (kind: InsertKind, range: Range) => {
      insertBlockAtRange(editor, range, contentFor(kind))
    }

    return [
      Suggestion({
        editor,
        pluginKey: slashCommandPluginKey,
        char: "/",
        startOfLine: true,
        /*
         * Gefiltert wird in der Liste und nicht hier: die Beschriftungen
         * kommen aus i18n, und {@code useTranslation} steht nur in der
         * Komponente zur Verfuegung. Diese Stelle reicht deshalb die
         * vollstaendige Liste durch, die Auswahl selbst laeuft ueber
         * {@code onSelect}.
         */
        items: () => INSERT_ENTRIES.map((entry) => entry.kind),
        command: () => undefined,
        render: () => ({
          onStart: (props) => {
            handle = createRef<SlashCommandMenuHandle>()
            renderer = new ReactRenderer(SlashCommandMenu, {
              editor: props.editor,
              props: {
                editor: props.editor,
                range: props.range,
                query: props.query,
                ref: handle,
                onSelect: select,
              },
            })
            unmount = props.mount(renderer.element)
          },
          onUpdate: (props) => {
            renderer?.updateProps({
              range: props.range,
              query: props.query,
            })
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              /* Escape gehoert dem Plugin: es verwirft die Auswahl und
                 laesst den getippten Schraegstrich stehen. */
              return false
            }
            return handle?.current?.onKeyDown(props.event) ?? false
          },
          onExit: () => {
            unmount?.()
            unmount = null
            renderer?.destroy()
            renderer = null
            handle = null
          },
        }),
      }),
    ]
  },
})
