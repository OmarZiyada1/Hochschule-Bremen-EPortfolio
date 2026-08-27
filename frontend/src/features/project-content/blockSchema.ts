import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { TableKit } from "@tiptap/extension-table"
import { TextAlign } from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import type { Extensions } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"

import { isSafeHref } from "@/features/project-content/blockSanitize"
import { isContentColorRole } from "@/features/project-content/contentColors"
import { AudioBlock } from "@/features/project-content/extensions/AudioBlock"
import { DocumentBlock } from "@/features/project-content/extensions/DocumentBlock"
import { EmbedBlock } from "@/features/project-content/extensions/EmbedBlock"
import { GalleryBlock } from "@/features/project-content/extensions/GalleryBlock"
import { HeadingAlignGuard } from "@/features/project-content/extensions/HeadingAlignGuard"
import { ImageBlock } from "@/features/project-content/extensions/ImageBlock"
import { MathBlock } from "@/features/project-content/extensions/MathBlock"
import { TableOfContentsBlock } from "@/features/project-content/extensions/TableOfContentsBlock"
import { VideoBlock } from "@/features/project-content/extensions/VideoBlock"

/**
 * Das Tiptap-Schema des Editors: genau die vierzehn Blocktypen aus
 * Contract 2.5 und keinen fuenfzehnten.
 *
 * <p><strong>Eine Stelle, nicht zwei.</strong> {@link createBlockExtensions}
 * ist der einzige Ort, an dem das Schema entsteht; Editor (KAN-36), die
 * Werkzeugleisten (KAN-70), die Medien- und Tabellendialoge (KAN-73,
 * KAN-71) und die Schematests holen es von hier. Zwei Listen liefen
 * auseinander, und der Unterschied fiele erst beim Speichern auf.
 *
 * <p><strong>Die Schemaversion steht bewusst nicht hier</strong>, sondern in
 * {@code blockSerialization.ts}. Sie wird vom Lesepfad gebraucht, und ein
 * Wertimport aus dieser Datei zoege das gesamte ProseMirror-Buendel in die
 * oeffentliche Detailseite: dort ist es die groesste einzelne Abhaengigkeit
 * des Frontends und wird nicht gebraucht, weil der Renderer ein eigener
 * JSON-Renderer ist.
 *
 * <p>Importiert wird ausschliesslich aus {@code @tiptap/react} und den
 * direkt aufgenommenen Erweiterungspaketen. {@code @tiptap/core} liegt nur
 * transitiv im Baum; unter pnpm gibt es kein flaches {@code node_modules},
 * ein direkter Import scheiterte zur Laufzeit. {@code @tiptap/react} reicht
 * die Kern-API durch.
 */

/**
 * {@code textStyle} mit einem Rollennamen statt eines Farbwerts.
 *
 * <p>Deshalb entfaellt {@code @tiptap/extension-color}: dessen Attribut
 * schriebe {@code style="color: #rrggbb"} und damit eine Farbe ausserhalb
 * der Tokenschicht (Frontend-Regel 5), die im Dunkelmodus den Kontrast von
 * 4,5:1 verfehlte (SC 1.4.3).
 *
 * <p>Auch {@code parseHTML} wird ersetzt. Die Regel der Bibliothek greift
 * nur bei einem {@code span} <em>mit</em> {@code style}-Attribut; ein
 * {@code span} mit bloss {@code data-color} kaeme nicht zurueck, und ein
 * {@code span} mit beliebigem Inline-Stil hat in diesem Schema nichts zu
 * suchen.
 */
const ContentTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-color"),
        renderHTML: (attributes: Record<string, unknown>) =>
          isContentColorRole(attributes.color)
            ? { "data-color": attributes.color }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-color]" }]
  },
})

/**
 * {@code highlight} ebenso auf Rollennamen. Die Fassung der Bibliothek
 * schriebe neben {@code data-color} ein
 * {@code style="background-color: ..."}; mit einem Rollennamen darin waere
 * das nicht nur eine Farbe ausserhalb der Tokenschicht, sondern gar keine
 * gueltige Farbe.
 */
const ContentHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-color"),
        renderHTML: (attributes: Record<string, unknown>) =>
          isContentColorRole(attributes.color)
            ? { "data-color": attributes.color }
            : {},
      },
    }
  },
}).configure({ multicolor: true })

/**
 * Die Extension-Liste des Editors. Reihenfolge: StarterKit, die vier
 * konfigurierten Erweiterungen, die beiden Marks ohne Konfiguration, dann
 * die sieben eigenen Nodes.
 */
export function createBlockExtensions(): Extensions {
  return [
    StarterKit.configure({
      /*
       * Sechs Ebenen (2.5 seit v63). Gespeichert wird die Gliederungsebene,
       * angezeigt eine Stufe tiefer: der Projekttitel bleibt die einzige
       * Ebene 1 der Seite (3.3), und die Abbildung steht an einer Stelle in
       * headingRendering.ts.
       */
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      /*
       * link gehoert in Tiptap 3 zum StarterKit. autolink legte
       * unentschiedene Marks an, waehrend jemand tippt, und ein Klick im
       * Editor soll den Cursor setzen und nicht die Seite verlassen.
       * Geprueft wird ueber dieselbe Funktion wie im Lesepfad, damit es
       * keine zweite, abweichende Protokolliste gibt.
       */
      link: {
        protocols: ["http", "https", "mailto"],
        openOnClick: false,
        autolink: false,
        isAllowedUri: (url: string) => isSafeHref(url),
      },
      /*
       * 2.5 kennt keinen hardBreak; die Whitelist verwuerfe ihn beim Lesen
       * still. Ein Umbruch entsteht als neuer Absatz.
       */
      hardBreak: false,
      /*
       * Die Ablegelinie kommt aus BlockDropCursor und nicht aus
       * prosemirror-dropcursor: dessen Rechnung ueber posAtCoords und
       * dropPoint trifft auch Stellen innerhalb eines Blocks und zeichnete
       * die Linie deshalb quer ueber Bloecke, je unterschiedlicher deren
       * Hoehen, desto haeufiger. Die Begruendung im Einzelnen steht im Kopf
       * von extensions/BlockDropCursor.ts; angemeldet wird der Ersatz im
       * Editor-Schema, weil es ihn nur beim Schreiben gibt.
       */
      dropcursor: false,
      /*
       * Der Schlussblock kommt aus TrailingBlock und nicht aus der Fassung
       * des StarterKits: deren Sperrliste enthaelt den Absatz fest
       * (notAfter.concat(defaultNode)), sodass ein Beitrag, der auf einen
       * gefuellten Absatz endet, keinen bekommt. Die Begruendung im
       * Einzelnen steht im Kopf von extensions/TrailingBlock.ts; angemeldet
       * wird der Ersatz im Editor-Schema, weil es ihn nur beim Schreiben
       * gibt (KAN-83).
       */
      trailingNode: false,
    }),
    /*
     * TableKit meldet table, tableRow, tableHeader und tableCell gemeinsam
     * an. resizable: true schriebe colwidth in jede Zelle; ein Umschalten
     * braeuchte danach die Migration aus 2.10. KAN-71 erbt die Einstellung.
     */
    TableKit.configure({ table: { resizable: false } }),
    /*
     * 2.5 fuehrt textAlign seit v63 an TEXT und HEADING. Die Werteliste
     * gilt fuer beide Typen gemeinsam, die Extension kennt keine Liste je
     * Typ; dass justify an der Ueberschrift trotzdem nicht stehenbleibt,
     * sichert HeadingAlignGuard.
     */
    TextAlign.configure({
      types: ["paragraph", "heading"],
      alignments: ["left", "center", "right", "justify"],
    }),
    HeadingAlignGuard,
    ContentTextStyle,
    ContentHighlight,
    Superscript,
    Subscript,
    ImageBlock,
    GalleryBlock,
    VideoBlock,
    AudioBlock,
    DocumentBlock,
    EmbedBlock,
    MathBlock,
    TableOfContentsBlock,
  ]
}
