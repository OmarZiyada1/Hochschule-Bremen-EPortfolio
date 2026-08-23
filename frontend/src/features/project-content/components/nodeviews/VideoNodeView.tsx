import type { ReactNodeViewProps } from "@tiptap/react"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useEditorContext } from "@/features/project-content/EditorContext"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { parseVideoInput } from "@/features/project-content/providerInput"
import {
  embedUrlFor,
  type VideoProvider,
} from "@/features/project-content/providers"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/**
 * VIDEO auf der Schreibflaeche (Contract 2.5).
 *
 * <p><strong>Zwei Quellen, nie beide.</strong> Entweder die hochgeladene
 * Datei oder die Einbettung bei einem Anbieter. Der leere Block bietet
 * deshalb beides an; sobald eine der beiden steht, verschwindet die andere,
 * denn ein Block mit {@code fileId} <em>und</em> {@code provider} ergibt
 * serverseitig 400.
 *
 * <p><strong>Gespeichert wird keine Adresse.</strong> Aus der eingefuegten
 * Adresse liest {@code parseVideoInput} Anbieter und {@code videoId}; die
 * Einbettungsadresse entsteht erst zur Anzeige aus fester Vorlage
 * ({@code embedUrlFor}), derselben wie im Renderer. Eine vom Client
 * gelieferte Fremd-URL in der Datenbank waere ein unnoetiger Angriffspunkt,
 * weil sie beim Rendern in ein {@code iframe} gelangt.
 *
 * <p><strong>Der Block zeigt den echten Player, sobald ein Video da
 * ist.</strong> Bis KAN-36 stand hier eine benannte Karte mit Anbieter und
 * Kennung, aus Sorge, ein Player fange Tastatur und Zeiger ab. Die Karte
 * erzwang aber fuer jede Kontrolle den Umweg ueber die Vorschau: ob das
 * richtige Video hinterlegt ist, sah man erst auf der Detailseite.
 * Deshalb steht jetzt der Player selbst da, wie im Renderer: die Datei als
 * {@code video} mit Bedienelementen, die Einbettung als {@code iframe} des
 * Anbieters. Nichts startet von allein ({@code preload="metadata"}, kein
 * {@code autoplay}, SC 1.4.2), die Tastatur laeuft mit Tab durch den
 * Player hindurch statt in ihm zu kreisen, und das Ziehen des Blocks
 * geschieht ohnehin am Griff im Streifen links, nicht auf der Flaeche.
 *
 * <p><strong>Die Angaben stehen am Block und nicht mehr in einem
 * Ausklapper:</strong> die Unterschrift als schlankes Feld direkt unter
 * dem Player, das Ersetzen als Aktion darunter. Erst "Ersetzen" zeigt
 * wieder den leeren Zustand mit Upload und Adresse; die Unterschrift
 * bleibt dabei stehen.
 */
export function VideoNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const { editable } = useEditorContext()
  const fieldId = useId()
  const attrs = node.attrs as {
    fileId: string | null
    provider: VideoProvider | null
    videoId: string | null
    hash: string | null
    caption: string | null
  }
  const [url, setUrl] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)

  const hasFile = attrs.fileId != null && attrs.fileId !== ""
  const hasEmbed = attrs.videoId != null && attrs.videoId !== ""
  /* Unbedingt vor jeder Verzweigung: Hooks laufen bei jedem Rendern. Ohne
     fileId laedt der Hook nichts. */
  const file = useFileObjectUrl(hasFile ? attrs.fileId : null)

  const applyUrl = () => {
    /*
     * Angenommen wird alles, was in der Zwischenablage sein kann: die
     * Adresszeile des Browsers, der Teilen-Link und der ganze
     * Einbettungscode. Gespeichert wird daraus nur Anbieter, Kennung und
     * gegebenenfalls der Freigabe-Hash (2.5).
     */
    const parsed = parseVideoInput(url)
    if (parsed === null) {
      setUrlError(t("projectContent.video.urlInvalid"))
      return
    }
    setUrlError(null)
    /* fileId ausdruecklich zuruecksetzen: der Block traegt genau eine
       Quelle, und ein Rest der anderen ergaebe 400 (2.5). */
    updateAttributes({
      fileId: null,
      provider: parsed.provider,
      videoId: parsed.videoId,
      hash: parsed.hash ?? null,
    })
  }

  const reset = () =>
    updateAttributes({
      fileId: null,
      provider: null,
      videoId: null,
      hash: null,
    })

  return (
    <MediaShell
      label={t("projectContent.blockName.videoBlock")}
      incompleteHint={
        hasFile || hasEmbed ? null : t("projectContent.video.incomplete")
      }
    >
      {hasFile || hasEmbed ? (
        <figure>
          {hasEmbed ? (
            <iframe
              title={t("projectContent.video.embedTitle", {
                provider: t(`projectContent.provider.${attrs.provider}`),
              })}
              src={embedUrlFor(
                attrs.provider as VideoProvider,
                attrs.videoId as string,
                attrs.hash
              )}
              loading="lazy"
              allowFullScreen
            />
          ) : file.isError ? (
            <p className="type-caption flex items-center gap-1.5 rounded-card bg-muted px-4 py-6 text-muted-foreground">
              <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
              {t("projectContent.video.loadFailed")}
            </p>
          ) : file.url === null ? (
            <Skeleton className="aspect-video w-full rounded-card" />
          ) : (
            <video
              controls
              preload="metadata"
              src={file.url}
              aria-label={t("projectContent.video.label")}
            />
          )}

          {editable ? (
            <div className="mt-2 flex flex-col gap-1">
              <div>
                <label className="sr-only" htmlFor={`${fieldId}-caption`}>
                  {t("projectContent.video.caption")}
                </label>
                <Input
                  id={`${fieldId}-caption`}
                  value={attrs.caption ?? ""}
                  placeholder={t("projectContent.video.captionPlaceholder")}
                  /* Gefuellt traegt das rahmenlose Feld keinen sichtbaren
                     Namen mehr; der title sagt beim Zeigen, was es ist
                     (SC 3.3.2, Review-Hinweis). */
                  title={t("projectContent.video.caption")}
                  className="-mx-1 h-7 w-[calc(100%+0.5rem)] border-transparent px-1 py-0 shadow-none dark:bg-transparent"
                  onChange={(event) =>
                    updateAttributes({ caption: event.target.value })
                  }
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={reset}
              >
                <RefreshCwIcon aria-hidden="true" />
                {t("projectContent.video.replace")}
              </Button>
            </div>
          ) : (
            attrs.caption != null &&
            attrs.caption !== "" && <figcaption>{attrs.caption}</figcaption>
          )}
        </figure>
      ) : (
        <div className="flex flex-col gap-3">
          <UploadDropzone
            kind="video"
            label={t("projectContent.video.dropzone")}
            hint={t("projectContent.video.dropzoneHint", {
              max: maxMebibytes("video"),
            })}
            onUploaded={(file) =>
              updateAttributes({
                fileId: file.id,
                provider: null,
                videoId: null,
              })
            }
          />

          <Field contentEditable={false}>
            <FieldLabel htmlFor={`${fieldId}-url`}>
              {t("projectContent.video.urlLabel")}
            </FieldLabel>
            <div className="flex gap-2">
              <Input
                id={`${fieldId}-url`}
                value={url}
                placeholder={t("projectContent.video.urlPlaceholder")}
                aria-describedby={
                  urlError === null ? `${fieldId}-url-hint` : `${fieldId}-error`
                }
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applyUrl()
                  }
                }}
              />
              <Button type="button" onClick={applyUrl} disabled={url === ""}>
                {t("projectContent.video.embedAction")}
              </Button>
            </div>
            {urlError === null ? (
              <FieldDescription id={`${fieldId}-url-hint`}>
                {t("projectContent.video.urlHint")}
              </FieldDescription>
            ) : (
              <FieldError id={`${fieldId}-error`}>{urlError}</FieldError>
            )}
          </Field>
        </div>
      )}
    </MediaShell>
  )
}
