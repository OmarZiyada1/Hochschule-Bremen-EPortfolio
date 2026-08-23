import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"

import {
  headingRendering,
  type HeadingRendering,
} from "@/features/project-content/headingRendering"
import type { HeadingLevel } from "@/features/project-content/blockTypes"

/**
 * Die versetzte Ueberschrift auf der <strong>Schreibflaeche</strong>
 * (Contract 2.5 seit v63).
 *
 * <p><strong>Warum es sie braucht.</strong> Tiptap gibt eine Ueberschrift
 * der Ebene {@code n} als {@code h{n}} aus. Gespeichert wird aber die
 * Gliederungsebene des Beitrags, und angezeigt wird sie eine Stufe tiefer:
 * die einzige {@code h1} der Seite ist der Projekttitel (§3.3). Ohne diese
 * Ansicht stuende im Editor ein zweites {@code h1} auf der Seite, und wer
 * sich den Beitrag vorlesen laesst, hoerte beim Schreiben eine andere
 * Gliederung als danach (SC 1.3.1).
 *
 * <p><strong>Und die Groesse haengt daran mit.</strong> Die Rollenklasse
 * der Inhaltsskala steht am Element, nicht am Elementnamen; ohne sie saehe
 * dieselbe Ueberschrift beim Schreiben anders aus als im Beitrag.
 *
 * <p><strong>Als Plugin und nicht ueber {@code addNodeView}.</strong> Der
 * Knoten {@code heading} kommt aus dem StarterKit und ist von aussen nicht
 * erweiterbar, ohne ihn abzuschalten und das Paket
 * {@code @tiptap/extension-heading} direkt einzubinden; das waere eine neue
 * Abhaengigkeit. ProseMirror sammelt Knotenansichten aus allen Plugins und
 * den direkten Props ein und mischt sie, die Ansichten der Medienknoten
 * bleiben also unberuehrt.
 *
 * <p>Die Ansicht ersetzt nur die Huelle. Der Inhalt bleibt
 * {@code contentDOM}, also ProseMirrors eigenes DOM; hier wird nichts
 * gerendert, was der Editor danach nicht mehr bearbeiten koennte.
 */
export const HeadingNodeView = Extension.create({
  name: "headingNodeView",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingNodeView"),
        props: {
          nodeViews: {
            heading: (node) => {
              const dom = createHeading(
                headingRendering(node.attrs.level as HeadingLevel),
                node.attrs.textAlign as string | null
              )
              return {
                dom,
                contentDOM: dom,
                /*
                 * Nur Aenderungen derselben Ebene und Ausrichtung
                 * uebernehmen; alles andere baut die Huelle neu, denn dann
                 * ist es ein anderes Element.
                 */
                update: (updated) =>
                  updated.type.name === "heading" &&
                  updated.attrs.level === node.attrs.level &&
                  updated.attrs.textAlign === node.attrs.textAlign,
              }
            },
          },
        },
      }),
    ]
  },
})

function createHeading(
  rendering: HeadingRendering,
  textAlign: string | null
): HTMLElement {
  const dom = document.createElement(rendering.tag)
  dom.className = rendering.className
  if (rendering.role !== undefined) {
    dom.setAttribute("role", rendering.role)
  }
  if (rendering.ariaLevel !== undefined) {
    dom.setAttribute("aria-level", String(rendering.ariaLevel))
  }
  if (textAlign !== null) {
    dom.setAttribute("data-text-align", textAlign)
  }
  return dom
}
