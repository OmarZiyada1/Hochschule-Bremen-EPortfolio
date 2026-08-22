import type { ReactNodeViewProps } from "@tiptap/react"
import { BracesIcon, RefreshCwIcon } from "lucide-react"
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
import {
  EMBED_PROVIDERS,
  type EmbedProvider,
} from "@/features/project-content/providers"
import { parseEmbedInput } from "@/features/project-content/providerInput"

/**
 * EMBED auf der Schreibflaeche (Contract 2.5).
 *
 * <p><strong>Der Anbieter wird nicht gefragt, sondern gelesen.</strong> Er
 * ergibt sich eindeutig aus dem Host der Adresse, und genau diese Zuordnung
 * prueft der Server anschliessend noch einmal. Ein Auswahlfeld daneben
 * waere eine Angabe, die schon in der Adresse steht, und der erste
 * Widerspruch zwischen beiden endete in einem 400.
 *
 * <p><strong>Die Vorpruefung ist ein Vorabhinweis.</strong> Verbindlich
 * bleibt der Server mit 400 {@code EMBED_PROVIDER_NOT_ALLOWED}; die
 * Allowlist wird hier nicht nachgebaut, sondern aus derselben Datei
 * gelesen, die auch der Renderer benutzt.
 *
 * <p>Kein {@code iframe} auf der Schreibflaeche, aus demselben Grund wie
 * beim Video: ein fremder Rahmen faengt Tastatur und Zeiger ab.
 */
export function EmbedNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const fieldId = useId()
  const attrs = node.attrs as {
    provider: EmbedProvider | null
    embedUrl: string | null
    height: number
  }
  const [url, setUrl] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)

  const hasEmbed = attrs.embedUrl != null && attrs.embedUrl !== ""

  const applyUrl = () => {
    /*
     * Angenommen wird die Adresszeile des Browsers, der Teilen-Link und
     * der ganze Einbettungscode; daraus entsteht die eine Adresse, die
     * sich tatsaechlich einbetten laesst. Gespeichert wird nur diese
     * kanonische Form, geprueft wird sie danach noch einmal am Server.
     */
    const parsed = parseEmbedInput(url)
    if (parsed === null) {
      setUrlError(
        t("projectContent.embed.urlInvalid", {
          providers: EMBED_PROVIDERS.map((entry) =>
            t(`projectContent.provider.${entry}`)
          ).join(", "),
        })
      )
      return
    }
    setUrlError(null)
    updateAttributes({ provider: parsed.provider, embedUrl: parsed.embedUrl })
  }

  return (
    <MediaShell
      label={t("projectContent.blockName.embedBlock")}
      incompleteHint={hasEmbed ? null : t("projectContent.embed.incomplete")}
      settings={
        hasEmbed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => updateAttributes({ provider: null, embedUrl: null })}
          >
            <RefreshCwIcon aria-hidden="true" />
            {t("projectContent.embed.replace")}
          </Button>
        ) : undefined
      }
    >
      {hasEmbed ? (
        <MediaCard
          icon={BracesIcon}
          title={t("projectContent.blockName.embedBlock")}
          detail={`${t(`projectContent.provider.${attrs.provider}`)} · ${attrs.embedUrl}`}
        />
      ) : (
        <Field contentEditable={false}>
          <FieldLabel htmlFor={`${fieldId}-url`}>
            {t("projectContent.embed.urlLabel")}
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id={`${fieldId}-url`}
              value={url}
              placeholder={t("projectContent.embed.urlPlaceholder")}
              aria-describedby={
                urlError === null ? `${fieldId}-hint` : `${fieldId}-error`
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
              {t("projectContent.embed.action")}
            </Button>
          </div>
          {urlError === null ? (
            <FieldDescription id={`${fieldId}-hint`}>
              {t("projectContent.embed.urlHint")}
            </FieldDescription>
          ) : (
            <FieldError id={`${fieldId}-error`}>{urlError}</FieldError>
          )}
        </Field>
      )}
    </MediaShell>
  )
}
