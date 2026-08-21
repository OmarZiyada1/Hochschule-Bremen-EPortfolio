import {
  ReactNodeViewRenderer,
  type Extensions,
  type Node,
  type ReactNodeViewProps,
} from "@tiptap/react"
import type { ComponentType } from "react"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import { HeadingNodeView } from "@/features/project-content/extensions/HeadingNodeView"
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

export function createEditorExtensions(): Extensions {
  return [...createBlockExtensions(), HeadingNodeView].map((extension) => {
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
