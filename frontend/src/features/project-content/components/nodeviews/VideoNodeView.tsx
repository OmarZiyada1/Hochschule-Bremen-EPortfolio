import type { ReactNodeViewProps } from "@tiptap/react"
import { RefreshCwIcon, VideoIcon } from "lucide-react"
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
import { MediaCard } from "@/features/project-content/components/nodeviews/MediaCard"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import { parseVideoInput } from "@/features/project-content/providerInput"
import type { VideoProvider } from "@/features/project-content/providers"
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
 * Adresse liest {@code parseVideoUrl} Anbieter und {@code videoId}; die
 * Einbettungsadresse entsteht erst zur Anzeige aus fester Vorlage. Eine vom
 * Client gelieferte Fremd-URL in der Datenbank waere ein unnoetiger
 * Angriffspunkt, weil sie beim Rendern in ein {@code iframe} gelangt.
 *
 * <p><strong>Kein laufender Player auf der Schreibflaeche.</strong> Ein
 * eingebettetes {@code iframe} faengt Tastatur und Zeiger ab: der Cursor
 * kaeme nicht mehr daran vorbei, und ein fremder Rahmen nimmt den Fokus,
 * ohne ihn zurueckzugeben. Der Block erscheint deshalb als benannte Karte;
 * wie er wirklich aussieht, zeigt die Vorschau.
 */
export function VideoNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
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
      settings={
        hasFile || hasEmbed ? (
          <>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-caption`}>
                {t("projectContent.video.caption")}
              </FieldLabel>
              <Input
                id={`${fieldId}-caption`}
                value={attrs.caption ?? ""}
                onChange={(event) =>
                  updateAttributes({ caption: event.target.value })
                }
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={reset}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("projectContent.video.replace")}
            </Button>
          </>
        ) : undefined
      }
    >
      {hasFile || hasEmbed ? (
        <MediaCard
          icon={VideoIcon}
          title={t("projectContent.blockName.videoBlock")}
          detail={
            hasEmbed
              ? t("projectContent.video.embedDetail", {
                  provider: t(`projectContent.provider.${attrs.provider}`),
                  videoId: attrs.videoId,
                })
              : t("projectContent.video.fileDetail")
          }
          caption={attrs.caption}
        />
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
