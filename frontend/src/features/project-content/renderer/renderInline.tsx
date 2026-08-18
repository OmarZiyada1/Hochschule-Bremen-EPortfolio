import { Fragment, type ReactNode } from "react"

import type {
  ContentMark,
  InlineNode,
  TextNode,
} from "@/features/project-content/blockTypes"

/**
 * Text und die zehn Marks aus Contract 2.5 als React-Baum.
 *
 * <p>Kein HTML-String als Zwischenformat und kein
 * {@code dangerouslySetInnerHTML}: der Text kommt aus einem Beitrag und
 * wird als Textknoten gesetzt, womit React ihn von sich aus maskiert.
 *
 * <p><strong>Die Schachtelung ist festgelegt, nicht zufaellig.</strong> Die
 * Marks eines Textknotens stehen im JSON in beliebiger Reihenfolge; wuerde
 * der Renderer ihr folgen, saehe derselbe Beitrag je nach Speicherlauf
 * anders aus und die Tests waeren von der Eingabereihenfolge abhaengig.
 * Deshalb die feste Ordnung unten: der Link steht aussen, damit die ganze
 * Auszeichnung anklickbar ist, {@code code} innen, weil es die Schriftart
 * wechselt.
 */
const MARK_ORDER: ContentMark["type"][] = [
  "link",
  "textStyle",
  "highlight",
  "bold",
  "italic",
  "underline",
  "strike",
  "superscript",
  "subscript",
  "code",
]

export function renderInline(nodes: InlineNode[] | undefined): ReactNode {
  if (nodes === undefined || nodes.length === 0) {
    return null
  }
  return nodes.map((node, index) => (
    <Fragment key={index}>{renderTextNode(node)}</Fragment>
  ))
}

function renderTextNode(node: TextNode): ReactNode {
  let element: ReactNode = node.text
  const marks = node.marks ?? []
  /* Von innen nach aussen: die letzte Umhuellung ist die aeusserste. */
  for (let index = MARK_ORDER.length - 1; index >= 0; index -= 1) {
    const mark = marks.find((candidate) => candidate.type === MARK_ORDER[index])
    if (mark !== undefined) {
      element = wrap(mark, element)
    }
  }
  return element
}

function wrap(mark: ContentMark, child: ReactNode): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{child}</strong>
    case "italic":
      return <em>{child}</em>
    case "underline":
      return <u>{child}</u>
    case "strike":
      return <s>{child}</s>
    case "code":
      return <code>{child}</code>
    case "superscript":
      return <sup>{child}</sup>
    case "subscript":
      return <sub>{child}</sub>
    case "link":
      /*
       * Das Schema ist vor der Ausgabe geprueft (isSafeHref): javascript:,
       * data: und vbscript: erreichen das DOM in keiner Schreibweise.
       * rel setzt die Anzeige, der Server prueft es nicht (2.5). Kein
       * target="_blank": ein neuer Tab ist eine Entscheidung der lesenden
       * Person, und ohne ihn braucht es auch keinen Hinweis darauf.
       */
      return (
        <a href={mark.attrs.href} rel="noopener noreferrer">
          {child}
        </a>
      )
    case "textStyle":
      /* Rollenname als data-color; die Farbe loest project-content.css
         ueber die Tokenschicht auf, getrennt fuer hell und dunkel. */
      return <span data-color={mark.attrs.color}>{child}</span>
    case "highlight":
      return <mark data-color={mark.attrs.color}>{child}</mark>
  }
}
