import { Fragment, type ReactNode } from "react"

import type {
  AudioBlockNode,
  BlockNode,
  BlockquoteNode,
  BulletListNode,
  CodeBlockNode,
  DocumentBlockNode,
  EmbedBlockNode,
  FlowNode,
  GalleryBlockNode,
  HeadingNode,
  ImageBlockNode,
  ListItemNode,
  OrderedListNode,
  ParagraphNode,
  TableNode,
  TableRowNode,
  VideoBlockNode,
} from "@/features/project-content/blockTypes"
import { headingRendering } from "@/features/project-content/headingRendering"
import { embedUrlFor } from "@/features/project-content/providers"
import { LazyMathBlock } from "@/features/project-content/renderer/LazyMathBlock"
import { MediaFigure } from "@/features/project-content/renderer/MediaFigure"
import { renderInline } from "@/features/project-content/renderer/renderInline"

/**
 * Die Knotenabbildung des Read-Only-Renderers: aus einem
 * {@code BlockNode} wird semantisches HTML.
 *
 * <p><strong>Ohne Tiptap.</strong> Der Lesepfad ist die haeufigste Ansicht
 * und die einzige ohne Anmeldung; ein ProseMirror-Buendel waere dort die
 * groesste einzelne Abhaengigkeit des Frontends. Kein Modul unterhalb von
 * {@code renderer/} importiert deshalb aus {@code @tiptap/*}; eine
 * ESLint-Regel und ein Test ueber den ganzen Importbaum halten das fest.
 *
 * <p>Diese Datei enthaelt keine Komponente, sondern Funktionen: sie kann
 * damit keine Hooks rufen, und alles Umgebungsabhaengige kommt ueber
 * {@link RenderContext} herein. Das macht sie ohne Provider testbar und
 * haelt die Uebersetzung an einer Stelle.
 */

/**
 * Laedt den Formelsatz vor und wartet darauf.
 *
 * <p>KaTeX kommt erst mit der ersten Formel ({@code LazyMathBlock}). Fuer
 * die Bildschirmanzeige genuegt das, fuer eine Ausgabe, die nicht auf das
 * Nachladen wartet, nicht: der PDF-Export (KAN-41) druckte sonst eine
 * leere Stelle, wo eine Formel steht. Er ruft diese Funktion und wartet,
 * bevor er den Druck anstoesst. Derselbe Modulbezeichner wie dort, also
 * derselbe Chunk.
 */
export function preloadMath(): Promise<unknown> {
  return import("@/features/project-content/renderer/MathBlockView")
}

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>
) => string

export type RenderContext = {
  t: TranslateFn
  /** Sprachkennung fuer {@code Intl}, aus i18n. */
  locale: string
  /**
   * Adresse einer Datei. Der Renderer setzt keine URL selbst zusammen
   * (Frontend-Regel 3): der Standard ist {@code apiPaths.files.detail}, und
   * die Vorschau eines Entwurfs (KAN-36) reicht eine eigene Aufloesung
   * herein, weil {@code GET /api/files/{id}} nur bei PUBLISHED oeffentlich
   * ist und weder {@code img} noch {@code video} einen Bearer-Token
   * mitschickt.
   */
  resolveFileUrl: (fileId: string) => string
  /** Praefix erzeugter Kennungen, damit zwei Ansichten auf einer Seite sich nicht ins Gehege kommen. */
  idPrefix: string
}

export function renderBlockNode(
  node: BlockNode,
  nodeKey: string,
  context: RenderContext
): ReactNode {
  switch (node.type) {
    case "heading":
      return renderHeading(node)
    case "paragraph":
      return renderParagraph(node)
    case "bulletList":
      return renderBulletList(node)
    case "orderedList":
      return renderOrderedList(node)
    case "blockquote":
      return renderBlockquote(node)
    case "codeBlock":
      return renderCodeBlock(node, context)
    case "horizontalRule":
      return <hr />
    case "table":
      return renderTable(node, nodeKey, context)
    case "imageBlock":
      return renderImage(node, nodeKey, context)
    case "galleryBlock":
      return renderGallery(node, nodeKey, context)
    case "videoBlock":
      return renderVideo(node, nodeKey, context)
    case "audioBlock":
      return renderAudio(node, nodeKey, context)
    case "documentBlock":
      return renderDocument(node, context)
    case "embedBlock":
      return renderEmbed(node, context)
    case "mathBlock":
      return <LazyMathBlock latex={node.attrs.latex} />
    default: {
      /* Ein kuenftiger Knotentyp soll hier den Uebersetzer anhalten und
         nicht still undefined liefern. */
      const exhaustive: never = node
      return exhaustive
    }
  }
}

/* ------------------------------------------------------------------ */
/* Zugaengliche Namen                                                   */
/* ------------------------------------------------------------------ */

/**
 * Der zugaengliche Name eines Medienelements.
 *
 * <p>Liegt eine Unterschrift vor, ist <strong>sie</strong> der Name; sonst
 * bleibt der allgemeine Text aus i18n. Der Grund ist die Elementliste eines
 * Screenreaders: ein Beitrag mit vier Videos haette sonst vier gleich
 * benannte Player, zwischen denen nichts zu unterscheiden ist (SC 2.4.6).
 * Ein zusaetzliches {@code aria-describedby} auf dieselbe Unterschrift
 * entfaellt dann, sonst wird sie zweimal vorgelesen.
 */
function namedBy(
  captionId: string,
  caption: string,
  fallbackLabel: string
): { "aria-labelledby": string } | { "aria-label": string } {
  return caption.trim().length > 0
    ? { "aria-labelledby": captionId }
    : { "aria-label": fallbackLabel }
}

/* ------------------------------------------------------------------ */
/* Text und Struktur                                                    */
/* ------------------------------------------------------------------ */

/**
 * Nie ein {@code h1}: die einzige Ebene 1 der Seite ist der Projekttitel,
 * den die verwendende Seite setzt (2.5, 3.3, SC 1.3.1). Die Abbildung der
 * sechs Ebenen steht in {@code headingRendering.ts} und gilt fuer Lesepfad
 * und Schreibflaeche gleichermassen.
 *
 * <p>Die Rollenklasse wird ausdruecklich gesetzt und nicht dem Elementnamen
 * ueberlassen: {@code .type-content-h1} steht an einem {@code h2}, und die
 * sechste Ebene ist gar kein Ueberschriftenelement.
 */
function renderHeading(node: HeadingNode): ReactNode {
  const { tag: Tag, role, ariaLevel, className } = headingRendering(
    node.attrs.level
  )
  return (
    <Tag
      className={className}
      role={role}
      aria-level={ariaLevel}
      data-text-align={node.attrs.textAlign ?? undefined}
    >
      {renderInline(node.content)}
    </Tag>
  )
}

function renderParagraph(node: ParagraphNode): ReactNode {
  /* textAlign als Datenattribut, gestylt ueber CSS: ein Inline-Stil liesse
     sich per Medienabfrage nicht ueberschreiben, und KAN-41 braucht fuer
     den Druck andere Regeln. */
  return (
    <p data-text-align={node.attrs?.textAlign ?? undefined}>
      {renderInline(node.content)}
    </p>
  )
}

function renderBulletList(node: BulletListNode): ReactNode {
  return <ul>{renderListItems(node.content)}</ul>
}

function renderOrderedList(node: OrderedListNode): ReactNode {
  return (
    <ol start={node.attrs?.start ?? undefined}>
      {renderListItems(node.content)}
    </ol>
  )
}

function renderListItems(items: ListItemNode[] | undefined): ReactNode {
  return (items ?? []).map((item, index) => (
    <li key={index}>{renderFlow(item.content)}</li>
  ))
}

/** Absatz oder verschachtelte Liste, innerhalb von Listeneintrag und Zelle. */
function renderFlow(nodes: FlowNode[] | undefined): ReactNode {
  return (nodes ?? []).map((node, index) => (
    <Fragment key={index}>
      {node.type === "paragraph"
        ? renderParagraph(node)
        : node.type === "bulletList"
          ? renderBulletList(node)
          : renderOrderedList(node)}
    </Fragment>
  ))
}

function renderBlockquote(node: BlockquoteNode): ReactNode {
  return (
    <blockquote>
      {(node.content ?? []).map((paragraph, index) => (
        <Fragment key={index}>{renderParagraph(paragraph)}</Fragment>
      ))}
    </blockquote>
  )
}

/**
 * Ohne Syntaxhervorhebung: dafuer gibt es kein freigegebenes Paket
 * (Frontend-Regel 9). Die Sprache steht als Klasse am {@code code}, wie es
 * die HTML-Spezifikation vorsieht, und ein spaeteres Ticket kann daran
 * ansetzen.
 *
 * <p>Das {@code pre} scrollt waagerecht in seinem eigenen Bereich und ist
 * deshalb fokussierbar: ein Container mit {@code overflow-x: auto} ohne
 * Fokus laesst sich mit der Tastatur nicht scrollen, und ein langer
 * Quelltext waere damit teilweise unerreichbar (SC 2.1.1). Dieselbe
 * Behandlung wie beim Tabellenbereich.
 */
function renderCodeBlock(
  node: CodeBlockNode,
  context: RenderContext
): ReactNode {
  const language = node.attrs?.language ?? null
  const text = (node.content ?? []).map((child) => child.text).join("")
  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={context.t("projectContent.code.regionLabel")}
    >
      <code className={language === null ? undefined : `language-${language}`}>
        {text}
      </code>
    </pre>
  )
}

/* ------------------------------------------------------------------ */
/* Tabelle                                                              */
/* ------------------------------------------------------------------ */

/**
 * Die Tabelle steht in einem eigenen Bereich mit {@code overflow-x: auto},
 * der mit der Tastatur erreichbar ist (SC 2.1.1). Die Seite selbst scrollt
 * nie waagerecht. Kopfzellen sind {@code th} mit {@code scope} und keine
 * fetten Absaetze (SC 1.3.1); besteht die erste Zeile ausschliesslich aus
 * Kopfzellen, wird sie zum {@code thead}.
 *
 * <p><strong>Warum das Markup hier von Hand steht und nicht die Primitive
 * {@code table} aus der Registry komponiert wird</strong> (Skill
 * frontend-shadcn, Abschnitt 1 verlangt diese Antwort): drei Gruende, jeder
 * fuer sich ausreichend. Erstens traegt die Registry-Fassung
 * {@code whitespace-nowrap} an der Zelle und {@code caption-bottom} an der
 * Beschriftung; beides ist fuer eine Tabelle im Fliesstext eines Beitrags
 * falsch. Zweitens gibt ihr Scrollcontainer {@code overflow-x-auto} ohne
 * {@code tabIndex} aus, waere hier also ein Rueckschritt gegenueber
 * SC 2.1.1. Drittens muessen die Regeln dasselbe DOM treffen, das Tiptap in
 * KAN-36 auf der Schreibflaeche erzeugt, und das kennt keine
 * Utility-Klassen: deshalb liegt die Gestaltung in
 * {@code styles/project-content.css} und nicht an der Komponente.
 */
function renderTable(
  node: TableNode,
  nodeKey: string,
  context: RenderContext
): ReactNode {
  const rows = node.content ?? []
  const firstRow = rows[0]
  const hasHeaderRow =
    firstRow !== undefined &&
    (firstRow.content ?? []).length > 0 &&
    (firstRow.content ?? []).every((cell) => cell.type === "tableHeader")
  const bodyRows = hasHeaderRow ? rows.slice(1) : rows
  const caption = node.attrs?.caption ?? ""
  const captionId = `${context.idPrefix}-${nodeKey}-caption`

  return (
    <div
      data-block="table-scroll"
      tabIndex={0}
      role="region"
      {...namedBy(
        captionId,
        caption,
        context.t("projectContent.table.regionLabel")
      )}
    >
      <table>
        {caption.trim().length > 0 ? (
          <caption id={captionId}>{caption}</caption>
        ) : null}
        {hasHeaderRow && firstRow !== undefined ? (
          <thead>{renderTableRow(firstRow, 0, true)}</thead>
        ) : null}
        <tbody>
          {bodyRows.map((row, index) => renderTableRow(row, index + 1, false))}
        </tbody>
      </table>
    </div>
  )
}

function renderTableRow(
  row: TableRowNode,
  rowKey: number,
  isHeaderRow: boolean
): ReactNode {
  return (
    <tr key={rowKey}>
      {(row.content ?? []).map((cell, cellIndex) => {
        const colSpan = cell.attrs?.colspan ?? undefined
        const rowSpan = cell.attrs?.rowspan ?? undefined
        if (cell.type === "tableHeader") {
          /* scope="col" nur in der Kopfzeile, scope="row" nur am
             Zeilenanfang. Eine Kopfzelle mitten in einer Koerperzeile
             ueberschreibt weder Spalte noch Zeile und bekommt deshalb gar
             kein scope statt eines falschen. */
          const scope = isHeaderRow
            ? "col"
            : cellIndex === 0
              ? "row"
              : undefined
          return (
            <th
              key={cellIndex}
              scope={scope}
              colSpan={colSpan}
              rowSpan={rowSpan}
            >
              {renderFlow(cell.content)}
            </th>
          )
        }
        return (
          <td key={cellIndex} colSpan={colSpan} rowSpan={rowSpan}>
            {renderFlow(cell.content)}
          </td>
        )
      })}
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/* Medien                                                               */
/* ------------------------------------------------------------------ */

function renderImage(
  node: ImageBlockNode,
  nodeKey: string,
  context: RenderContext
): ReactNode {
  const { fileId, alt, caption, width } = node.attrs
  return (
    <MediaFigure
      caption={caption}
      captionId={`${context.idPrefix}-${nodeKey}-caption`}
      width={width}
    >
      <img
        src={context.resolveFileUrl(fileId)}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </MediaFigure>
  )
}

/**
 * Die Galerie als Raster in einer Liste: so wird die Anzahl der Bilder
 * angesagt. Jedes Bild traegt den {@code alt} seines Eintrags; der
 * gemeinsame {@code caption} beschreibt die Gruppe und ersetzt das nicht
 * (SC 1.1.1).
 */
function renderGallery(
  node: GalleryBlockNode,
  nodeKey: string,
  context: RenderContext
): ReactNode {
  const { items, columns, caption } = node.attrs
  return (
    <MediaFigure
      caption={caption}
      captionId={`${context.idPrefix}-${nodeKey}-caption`}
      columns={columns}
      role="group"
    >
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <img
              src={context.resolveFileUrl(item.fileId)}
              alt={item.alt}
              loading="lazy"
              decoding="async"
            />
          </li>
        ))}
      </ul>
    </MediaFigure>
  )
}

/**
 * Beide Videofaelle liefern dasselbe {@code figure} mit derselben
 * {@code figcaption}.
 *
 * <p>Beim Upload: {@code controls} und {@code preload="metadata"}, nie
 * {@code preload="auto"} (eine Seite mit drei Videos luede sonst mehrere
 * hundert Megabyte ungefragt) und nie {@code autoplay}, {@code loop} oder
 * {@code muted} als Ersatz (SC 1.4.2). Der Sprung in der Zeitleiste setzt
 * die Range-Antwort von {@code GET /api/files/{id}} voraus (3.15, seit
 * KAN-72 umgesetzt).
 *
 * <p>Bei der Einbettung: ein {@code iframe}, dessen {@code title} den
 * Anbieter nennt. Der bleibt auch bei gefuellter Unterschrift der Name, weil
 * "eingebettet von X" eine Information ist, die der Beitrag selbst nicht
 * hergibt; die Unterschrift kommt als {@code aria-describedby} dazu.
 */
function renderVideo(
  node: VideoBlockNode,
  nodeKey: string,
  context: RenderContext
): ReactNode {
  const attrs = node.attrs
  const captionId = `${context.idPrefix}-${nodeKey}-caption`
  const caption = attrs.caption

  if (attrs.fileId !== undefined) {
    return (
      <MediaFigure caption={caption} captionId={captionId}>
        <video
          controls
          preload="metadata"
          src={context.resolveFileUrl(attrs.fileId)}
          {...namedBy(
            captionId,
            caption,
            context.t("projectContent.video.label")
          )}
        />
      </MediaFigure>
    )
  }

  return (
    <MediaFigure caption={caption} captionId={captionId}>
      <iframe
        title={context.t("projectContent.video.embedTitle", {
          provider: context.t(`projectContent.provider.${attrs.provider}`),
        })}
        aria-describedby={caption.trim().length > 0 ? captionId : undefined}
        src={embedUrlFor(attrs.provider, attrs.videoId)}
        loading="lazy"
        allowFullScreen
      />
    </MediaFigure>
  )
}

function renderAudio(
  node: AudioBlockNode,
  nodeKey: string,
  context: RenderContext
): ReactNode {
  const captionId = `${context.idPrefix}-${nodeKey}-caption`
  const caption = node.attrs.caption
  return (
    <MediaFigure caption={caption} captionId={captionId}>
      <audio
        controls
        preload="metadata"
        src={context.resolveFileUrl(node.attrs.fileId)}
        {...namedBy(
          captionId,
          caption,
          context.t("projectContent.audio.label")
        )}
      />
    </MediaFigure>
  )
}

/**
 * Der Dokumentlink nennt den Dateinamen sichtbar; der zugaengliche Name
 * nennt zusaetzlich Dateityp und Groesse, damit vor dem Klick klar ist, was
 * geladen wird (SC 2.4.4). Der sichtbare Name steht im zugaenglichen Namen,
 * wie SC 2.5.3 es verlangt.
 */
function renderDocument(
  node: DocumentBlockNode,
  context: RenderContext
): ReactNode {
  const { fileId, fileName, size } = node.attrs
  const formattedSize = formatFileSize(size, context.locale)
  return (
    <p data-block="document">
      <a
        href={context.resolveFileUrl(fileId)}
        aria-label={context.t("projectContent.document.accessibleName", {
          fileName,
          size: formattedSize,
        })}
      >
        {fileName}
      </a>{" "}
      <span aria-hidden="true">{formattedSize}</span>
    </p>
  )
}

/**
 * Die Dateigroesse in der Sprache der Oberflaeche. {@code Intl} kennt die
 * Einheiten selbst; ein eigener Satz i18n-Schluessel dafuer waere eine
 * zweite, schlechtere Uebersetzungstabelle.
 */
export function formatFileSize(bytes: number, locale: string): string {
  const megabytes = bytes / 1_000_000
  const unit = megabytes >= 1 ? "megabyte" : "kilobyte"
  const value = megabytes >= 1 ? megabytes : bytes / 1000
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Die Einbettung. Der Host ist vor der Ausgabe gegen die Allowlist geprueft
 * (Whitelist beim Lesen); passt er nicht, entsteht gar kein
 * {@code embedBlock}, sondern der Platzhalter mit der Adresse als reinem
 * Text. Die Hoehe steht als Attribut in CSS-Pixeln, die Breite kommt aus
 * dem Stylesheet.
 */
function renderEmbed(node: EmbedBlockNode, context: RenderContext): ReactNode {
  const { provider, embedUrl, height } = node.attrs
  return (
    <iframe
      title={context.t("projectContent.embed.title", {
        provider: context.t(`projectContent.provider.${provider}`),
      })}
      src={embedUrl}
      height={displayHeight(height)}
      loading="lazy"
    />
  )
}

/**
 * Die Hoehe einer Einbettung fuer die Anzeige, begrenzt auf 200 bis 1200
 * CSS-Pixel.
 *
 * <p>Die Spanne steht hier und nicht in der Whitelist: weder 2.5 noch der
 * Server kennen sie, und was der Lesepfad in das Dokument zurueckschriebe,
 * haette niemand verlangt. Ein iframe von fuenftausend Pixeln bricht
 * dagegen den Textfluss (SC 1.4.10), also wird die Anzeige begrenzt und der
 * gespeicherte Wert bleibt, wie er ist.
 */
export function displayHeight(height: number): number {
  return Math.min(Math.max(height, 200), 1200)
}
