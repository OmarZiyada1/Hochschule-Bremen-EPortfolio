import {
  ReactNodeViewRenderer,
  type Extensions,
  type Node,
  type ReactNodeViewProps,
} from "@tiptap/react"
import { Placeholder } from "@tiptap/extensions"
import type { ComponentType } from "react"

import i18n from "@/i18n"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import { BlockDropCursor } from "@/features/project-content/extensions/BlockDropCursor"
import { HeadingNodeView } from "@/features/project-content/extensions/HeadingNodeView"
import { SlashCommand } from "@/features/project-content/extensions/SlashCommand"
import { AudioNodeView } from "@/features/project-content/components/nodeviews/AudioNodeView"
import { DocumentNodeView } from "@/features/project-content/components/nodeviews/DocumentNodeView"
import { EmbedNodeView } from "@/features/project-content/components/nodeviews/EmbedNodeView"
import { GalleryNodeView } from "@/features/project-content/components/nodeviews/GalleryNodeView"
import { ImageNodeView } from "@/features/project-content/components/nodeviews/ImageNodeView"
import { MathNodeView } from "@/features/project-content/components/nodeviews/MathNodeView"
import { VideoNodeView } from "@/features/project-content/components/nodeviews/VideoNodeView"

/**
 * Dasselbe Schema wie im Lesepfad, um die Ansichten der Schreibflaeche
 * ergaenzt.
 *
 * <p><strong>Das Schema bleibt eine Stelle.</strong> Die vierzehn
 * Blocktypen entstehen weiterhin ausschliesslich in
 * {@code createBlockExtensions()}; hier kommen nur die React-Ansichten
 * dazu, die es allein beim Schreiben gibt. Eine zweite Extension-Liste
 * waere ein Befund: sie liefe auseinander, und der Unterschied fiele erst
 * beim Speichern auf.
 *
 * <p><strong>Warum die Ansichten nicht im Schema stehen.</strong> Ohne sie
 * gaeben die sieben eigenen Knoten ein leeres {@code figure} mit
 * Datenattributen aus: die Anzeige im Lesepfad laeuft ueber einen eigenen
 * JSON-Renderer und nicht ueber das HTML von Tiptap. Beim Schreiben gaebe
 * es dann eine Leerstelle, in der etwas steht. Umgekehrt zoege eine
 * Extension-Liste mit React-Ansichten das ganze Ansichtsbuendel in jeden
 * Schematest und in jede Stelle, die nur das Schema braucht.
 *
 * <p>Dazu kommt {@code HeadingNodeView}: die Ueberschrift wird auf der
 * Schreibflaeche um eine Stufe versetzt ausgegeben, wie im Lesepfad
 * (Contract 2.5 seit v63). Sie ist eine reine Ansichtssache und gehoert
 * deshalb hierhin und nicht ins Schema.
 */

/** Knotenname zu Ansicht; die uebrigen Knoten haben keine. */
const NODE_VIEWS: Record<string, ComponentType<ReactNodeViewProps>> = {
  imageBlock: ImageNodeView,
  galleryBlock: GalleryNodeView,
  videoBlock: VideoNodeView,
  audioBlock: AudioNodeView,
  documentBlock: DocumentNodeView,
  embedBlock: EmbedNodeView,
  mathBlock: MathNodeView,
}

/**
 * Die Erweiterungen, die es nur beim Schreiben gibt.
 *
 * <p>{@code Placeholder} sagt in der leeren Zeile, was zu tun ist, und
 * nennt dabei den Slash-Befehl: ohne diesen Hinweis findet ihn niemand.
 * {@code SlashCommand} ist der zweite Weg zum Einfuegen, neben der Pille
 * am Plus. Beide kommen fertig aus dem Tiptap-Paket statt von Hand.
 *
 * <p>{@code BlockDropCursor} ist die dritte und die einzige eigene: sie
 * ersetzt den abgemeldeten {@code dropcursor} des StarterKits, dessen
 * Ablegelinie quer ueber Bloecken lag statt zwischen ihnen (Begruendung im
 * Kopf der Datei).
 *
 * <p><strong>Kein {@code TrailingNode} hier.</strong> Er waere die
 * naheliegende Ergaenzung fuer „hinter dem letzten Bild weiterschreiben",
 * steckt aber bereits im StarterKit und wuerde doppelt angemeldet
 * ({@code Duplicate extension names}). Dass sich unter dem letzten Block
 * noch klicken laesst, ist entsprechend keine Frage des Schemas, sondern
 * der Flaeche: {@code project-content.css} gibt der Schreibflaeche eine
 * Mindesthoehe und einen Fussraum.
 *
 * <p>Der Platzhaltertext wird bei jeder Neuberechnung der Dekorationen
 * frisch uebersetzt und nicht beim Anlegen des Editors eingefroren: sonst
 * bliebe nach einem Sprachwechsel der deutsche Satz stehen, bis die Seite
 * neu geladen wird.
 */
function createEditorOnlyExtensions(): Extensions {
  return [
    Placeholder.configure({
      /*
       * Nur an der Zeile, in der die Textmarke steht, und im ganz leeren
       * Beitrag. In jeder leeren Zeile stuende derselbe Satz mehrfach
       * untereinander; das liest sich wie ein Fehler und nicht wie ein
       * Hinweis.
       */
      placeholder: ({ editor, node, hasAnchor }) =>
        node.type.name === "paragraph" && (hasAnchor || editor.isEmpty)
          ? i18n.t("projectContent.editor.placeholder")
          : "",
      showOnlyWhenEditable: true,
    }),
    SlashCommand,
    BlockDropCursor,
  ]
}

export function createEditorExtensions(): Extensions {
  return [
    ...createEditorOnlyExtensions(),
    ...createBlockExtensions(),
    HeadingNodeView,
  ].map((extension) => {
    const view = NODE_VIEWS[extension.name]
    if (view === undefined) {
      return extension
    }
    /*
     * Der Cast ist eng: NODE_VIEWS fuehrt ausschliesslich die sieben
     * eigenen Nodes, und extend() gibt es an Node, Mark und Extension mit
     * je eigener Signatur. Ohne ihn muesste die Zuordnung raten, welcher
     * der drei Typen vorliegt.
     */
    return (extension as Node).extend({
      addNodeView() {
        return ReactNodeViewRenderer(view)
      },
    })
  })
}
