import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { TableCell, TableHeader, TableKit } from "@tiptap/extension-table"
import { TextAlign } from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { Node, wrappingInputRule, type Extensions } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"

import { isSafeHref } from "@/features/project-content/blockSanitize"
import { HeadingNodeView } from "@/features/project-content/headingNodeView"
import { HEADING_LEVELS } from "@/features/project-content/headingRendering"
import { isContentColorRole } from "@/features/project-content/contentColors"
import { AudioBlock } from "@/features/project-content/extensions/AudioBlock"
import { DocumentBlock } from "@/features/project-content/extensions/DocumentBlock"
import { EmbedBlock } from "@/features/project-content/extensions/EmbedBlock"
import { GalleryBlock } from "@/features/project-content/extensions/GalleryBlock"
import { ImageBlock } from "@/features/project-content/extensions/ImageBlock"
import { MathBlock } from "@/features/project-content/extensions/MathBlock"
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
 * Zelle und Kopfzelle mit dem Inhalt, den 2.5 zulaesst.
 *
 * <p><strong>Sonst faellt Inhalt still weg.</strong> Der Standardinhalt von
 * {@code TableCell} ist {@code block+}, das Editor-Schema liesse also eine
 * Ueberschrift in einer Zelle zu. Der Lesepfad nimmt dort nach 2.5 nur
 * {@code paragraph}, {@code bulletList} und {@code orderedList}
 * ({@code blockSanitize.sanitizeFlowList}), und der Server prueft nur die
 * Wurzelattribute des Blocks. Die Ueberschrift liefe damit durch den
 * Autosave und waere beim naechsten Laden samt Text verschwunden, ohne
 * Fehler und ohne Meldung. Befund des Contract-Abgleichs zu KAN-36.
 */
const ContentTableCell = TableCell.extend({
  content: "(paragraph | bulletList | orderedList)+",
})

const ContentTableHeader = TableHeader.extend({
  content: "(paragraph | bulletList | orderedList)+",
})

/**
 * Das Zitat, das nur Absaetze enthaelt.
 *
 * <p>2.5 sagt zu QUOTE woertlich „enthaelt {@code paragraph}-Knoten", und
 * der Lesepfad nimmt dort auch nur Absaetze an. Der Blockquote aus dem
 * StarterKit laeuft dagegen mit {@code block+}: eine Aufzaehlung im Zitat
 * liesse sich einschalten, ginge durch den Autosave und waere nach dem
 * naechsten Laden weg. Derselbe Fehlermodus wie in der Tabellenzelle.
 *
 * <p><strong>Von Hand und nicht ueber die Extension aus dem
 * StarterKit.</strong> {@code @tiptap/extension-blockquote} ist keine
 * direkte Abhaengigkeit dieses Projekts, und unter pnpm gibt es kein
 * flaches {@code node_modules}: ein Import daraus scheiterte zur Laufzeit.
 * Der Knoten ist klein genug, um ihn hier zu fuehren, und alles, was er
 * braucht, kommt aus {@code @tiptap/react}.
 *
 * <p><strong>Er bringt dieselben Griffe mit wie die Bibliotheksfassung</strong>,
 * und das ist keine Bequemlichkeit: {@code toggleBlockquote} wird von der
 * Auswahlleiste gerufen, und ohne den Befehl endete jeder Klick auf „Zitat"
 * in einem {@code TypeError}. Der Typecheck faengt das nicht, weil die
 * Kommandotypen der Bibliothek transitiv im Typgraphen stehen. Dazu der
 * Backspace-Handler: mit {@code content: "paragraph+"} ist das Heraustreten
 * am Absatzanfang der einzige bequeme Weg aus einem Zitat.
 */
const ContentBlockquote = Node.create({
  name: "blockquote",
  group: "block",
  content: "paragraph+",
  defining: true,

  parseHTML() {
    return [{ tag: "blockquote" }]
  },

  renderHTML() {
    return ["blockquote", 0]
  },

  addInputRules() {
    /* Dieselbe Eingaberegel wie im StarterKit: "> " am Zeilenanfang. */
    return [
      wrappingInputRule({ find: /^\s*>\s$/, type: this.type }),
    ]
  },

  addCommands() {
    return {
      setBlockquote:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      toggleBlockquote:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
      unsetBlockquote:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-b": () => this.editor.commands.toggleBlockquote(),
      /*
       * Backspace am Anfang des ersten Absatzes hebt aus dem Zitat heraus,
       * wie in der Bibliotheksfassung. Ohne den Handler gaebe es aus einem
       * Zitat, das nur Absaetze aufnimmt, keinen bequemen Weg zurueck.
       */
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection
        const isAtStart = $anchor.parentOffset === 0
        if (!empty || !isAtStart || !this.editor.isActive(this.name)) {
          return false
        }
        return this.editor.commands.lift(this.name)
      },
    }
  },
})

/**
 * Die Extension-Liste des Editors. Reihenfolge: StarterKit, die vier
 * konfigurierten Erweiterungen, die beiden Marks ohne Konfiguration, dann
 * die sieben eigenen Nodes.
 */
export function createBlockExtensions(): Extensions {
  return [
    StarterKit.configure({
      /*
       * Sechs Ebenen (2.5 seit v63). Der gespeicherte Wert ist die
       * Gliederung und nicht das HTML-Element: der Projekttitel bleibt die
       * einzige Ebene 1 der Seite (3.3), und die Anzeige schiebt jede Ebene
       * um eine Stufe nach unten.
       *
       * Den Versatz faehrt die Knotenansicht aus headingNodeView.ts, die
       * als HeadingNodeView weiter unten in dieser Liste steht; sie und der
       * Renderer lesen dieselbe Abbildung aus headingRendering.ts. Ohne sie
       * gaebe die Extension h1 bis h6 aus, und auf der Schreibflaeche
       * stuenden zwei h1.
       */
      heading: { levels: [...HEADING_LEVELS] },
      /* Ersetzt durch ContentBlockquote mit content "paragraph+" (2.5). */
      blockquote: false,
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
    }),
    ContentBlockquote,
    /* Der Versatz der Ueberschriftenebenen aus 2.5 (siehe heading oben). */
    HeadingNodeView,
    /*
     * TableKit meldet table, tableRow, tableHeader und tableCell gemeinsam
     * an. resizable: true schriebe colwidth in jede Zelle; ein Umschalten
     * braeuchte danach die Migration aus 2.10.
     *
     * Zelle und Kopfzelle kommen als eigene Fassungen daneben, weil ihr
     * Inhalt auf die Knoten aus 2.5 eingeengt ist (siehe oben).
     */
    TableKit.configure({
      table: { resizable: false },
      tableCell: false,
      tableHeader: false,
    }),
    ContentTableCell,
    ContentTableHeader,
    /*
     * 2.5 kennt textAlign seit v63 auch am HEADING, dort aber ohne justify.
     * Die Extension fuehrt nur eine gemeinsame Werteliste je Konfiguration;
     * die engere Menge der Ueberschrift durchzusetzen ist deshalb Sache der
     * Auswahlleiste (Blocksatz erscheint deaktiviert) und des Servers, der
     * ein justify am HEADING mit 400 BLOCK_CONTENT_INVALID abweist. Der
     * Lesepfad verwirft es zusaetzlich (blockSanitize.ts).
     */
    TextAlign.configure({
      types: ["paragraph", "heading"],
      alignments: ["left", "center", "right", "justify"],
    }),
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
  ]
}
