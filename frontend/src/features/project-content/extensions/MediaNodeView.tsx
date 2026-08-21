import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import {
  BracesIcon,
  FileTextIcon,
  ImageIcon,
  MusicIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { useEditorFileUrl } from "@/features/project-content/EditorFileUrlContext"
import type {
  GalleryColumns,
  GalleryItem,
  ImageWidth,
} from "@/features/project-content/blockTypes"
import { LazyMathBlock } from "@/features/project-content/renderer/LazyMathBlock"

/**
 * Die Ansicht der sieben Medien- und Formelknoten auf der
 * <strong>Schreibflaeche</strong>.
 *
 * <p>Ohne sie waeren sie unsichtbar: die Extensions geben ein leeres
 * {@code figure} mit Datenattributen aus, weil die Anzeige im Lesepfad ueber
 * einen eigenen JSON-Renderer laeuft und nicht ueber das HTML von Tiptap.
 * Beim Schreiben gaebe es dann eine Leerstelle, in der etwas steht.
 *
 * <p><strong>Nicht jeder Knoten zeigt hier, was er spaeter zeigt, und das
 * ist Absicht.</strong> Bild, Galerie und Formel erscheinen so, wie sie
 * danach aussehen: sie sind unbewegt, und der Cursor kommt an ihnen vorbei.
 * Video, Ton, Dokument und Einbettung erscheinen dagegen als benannte
 * Karte. Ein laufender Player oder ein {@code iframe} in einer
 * Schreibflaeche faengt Tastatur und Zeiger ab: der Cursor laesst sich
 * nicht mehr daran vorbeibewegen, ein fremder Rahmen nimmt den Fokus und
 * gibt ihn nicht zurueck, und ein Video startete beim Schreiben. Die
 * tatsaechliche Ausgabe zeigt die Vorschau, die denselben Renderer wie die
 * oeffentliche Detailseite verwendet.
 *
 * <p>Jede Ansicht ist {@code contentEditable={false}} und {@code draggable}:
 * die Attribute eines Medienknotens sind Daten und kein Text, sie lassen
 * sich also nicht im Fliesstext tippen.
 *
 * <p><strong>Benannte Grenze: ein eingefuegter Medienblock laesst sich
 * nicht nachtraeglich aendern.</strong> Es gibt keinen Weg zurueck in den
 * Dialog, also auch keinen zu einem berichtigten Alternativtext oder einer
 * anderen Bildbreite; wer sich vertippt hat, loescht den Block und legt ihn
 * neu an, und die hochgeladene Datei bleibt am Projekt haengen. Das ist
 * eine Luecke und keine Entscheidung: sie ist beim Review zu KAN-36
 * aufgefallen, im Umfang dieses Tickets nicht mehr geschlossen worden und
 * als eigener Punkt am Ticket vermerkt. Der Weg dorthin waere ein
 * Auslöser je Knotenansicht, der denselben Dialog mit
 * {@code node.attrs} als Vorbelegung oeffnet und ueber
 * {@code updateAttributes} zurueckschreibt.
 */

/** Die Karte fuer die vier Typen ohne eigene Vorschau. */
function MediaCard({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon
  title: string
  detail: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-muted/40 px-4 py-3">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-col">
        <span className="type-body-sm font-semibold">{title}</span>
        <span className="type-caption truncate text-muted-foreground">
          {detail}
        </span>
      </span>
    </div>
  )
}

function Caption({ caption }: { caption: unknown }) {
  return typeof caption === "string" && caption.trim() !== "" ? (
    <figcaption>{caption}</figcaption>
  ) : null
}

export function MediaNodeView({ node }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const resolveFileUrl = useEditorFileUrl()
  const attrs = node.attrs as Record<string, unknown>

  return (
    <NodeViewWrapper
      contentEditable={false}
      draggable
      data-drag-handle
      className="project-content-node"
    >
      {renderByType()}
    </NodeViewWrapper>
  )

  function renderByType() {
    switch (node.type.name) {
      case "imageBlock": {
        const url = resolveFileUrl(String(attrs.fileId ?? ""))
        return (
          <figure data-width={attrs.width as ImageWidth}>
            {url === "" ? (
              <MediaCard
                icon={ImageIcon}
                title={t("projectContent.nodeView.image")}
                detail={t("projectContent.nodeView.loading")}
              />
            ) : (
              <img src={url} alt={String(attrs.alt ?? "")} />
            )}
            <Caption caption={attrs.caption} />
          </figure>
        )
      }
      case "galleryBlock": {
        const items = Array.isArray(attrs.items)
          ? (attrs.items as GalleryItem[])
          : []
        return (
          <figure data-columns={attrs.columns as GalleryColumns}>
            <ul>
              {items.map((item, index) => {
                const url = resolveFileUrl(item.fileId)
                return (
                  <li key={`${item.fileId}-${index}`}>
                    {url === "" ? null : <img src={url} alt={item.alt} />}
                  </li>
                )
              })}
            </ul>
            <Caption caption={attrs.caption} />
          </figure>
        )
      }
      case "mathBlock":
        return <LazyMathBlock latex={String(attrs.latex ?? "")} />
      case "videoBlock":
        return (
          <MediaCard
            icon={VideoIcon}
            title={t("projectContent.nodeView.video")}
            detail={
              typeof attrs.provider === "string"
                ? t("projectContent.nodeView.videoEmbed", {
                    provider: t(`projectContent.provider.${attrs.provider}`),
                    videoId: String(attrs.videoId ?? ""),
                  })
                : t("projectContent.nodeView.videoFile")
            }
          />
        )
      case "audioBlock":
        return (
          <MediaCard
            icon={MusicIcon}
            title={t("projectContent.nodeView.audio")}
            detail={
              typeof attrs.caption === "string" && attrs.caption !== ""
                ? attrs.caption
                : t("projectContent.nodeView.audioFile")
            }
          />
        )
      case "documentBlock":
        return (
          <MediaCard
            icon={FileTextIcon}
            title={t("projectContent.nodeView.document")}
            detail={String(attrs.fileName ?? "")}
          />
        )
      case "embedBlock":
        return (
          <MediaCard
            icon={BracesIcon}
            title={t("projectContent.nodeView.embed")}
            detail={
              typeof attrs.provider === "string"
                ? `${t(`projectContent.provider.${attrs.provider}`)} · ${String(attrs.embedUrl ?? "")}`
                : String(attrs.embedUrl ?? "")
            }
          />
        )
      default:
        return null
    }
  }
}
