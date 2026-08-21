import type { ReactNodeViewProps } from "@tiptap/react"
import { RefreshCwIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import type { ImageWidth } from "@/features/project-content/blockTypes"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/** Die drei Stufen aus Contract 2.5, in der Reihenfolge des Templates. */
const WIDTHS: readonly ImageWidth[] = [100, 75, 50]

/**
 * IMAGE auf der Schreibflaeche (Contract 2.5).
 *
 * <p>Leer ist der Block eine Ablageflaeche, gefuellt zeigt er das Bild in
 * der gewaehlten Breite, also so, wie es danach aussieht. Ueber „Ersetzen"
 * geht es zurueck in den leeren Zustand, ohne den Block zu verlieren: die
 * Bildunterschrift und der Alternativtext bleiben stehen.
 *
 * <p><strong>Zum Alternativtext.</strong> Contract 2.5 liest einen leeren
 * {@code alt} als ausdrueckliche Aussage „das Bild ist schmueckend". Die
 * Beschreibung unter dem Feld sagt genau das, statt eine zweite,
 * nicht speicherbare Angabe daneben zu fuehren; ein Kreuzchen
 * „schmueckend" haette in §2.5 kein Attribut und waere nach dem Neuladen
 * verschwunden.
 */
export function ImageNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const fieldId = useId()
  const attrs = node.attrs as {
    fileId: string | null
    alt: string | null
    caption: string | null
    width: ImageWidth
  }
  const image = useFileObjectUrl(attrs.fileId)
  const label = t("projectContent.blockName.imageBlock")

  return (
    <MediaShell
      label={label}
      incompleteHint={
        attrs.fileId ? null : t("projectContent.image.incomplete")
      }
      settings={
        attrs.fileId ? (
          <>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-alt`}>
                {t("projectContent.image.alt")}
              </FieldLabel>
              <Input
                id={`${fieldId}-alt`}
                value={attrs.alt ?? ""}
                onChange={(event) =>
                  updateAttributes({ alt: event.target.value })
                }
              />
              <FieldDescription>
                {t("projectContent.image.altDescription")}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${fieldId}-caption`}>
                {t("projectContent.image.caption")}
              </FieldLabel>
              <Input
                id={`${fieldId}-caption`}
                value={attrs.caption ?? ""}
                onChange={(event) =>
                  updateAttributes({ caption: event.target.value })
                }
              />
            </Field>

            <FieldSet>
              <FieldLegend variant="label">
                {t("projectContent.image.width")}
              </FieldLegend>
              <RadioGroup
                value={String(attrs.width)}
                onValueChange={(value) =>
                  updateAttributes({ width: Number(value) })
                }
                className="grid-cols-3"
              >
                {WIDTHS.map((width) => (
                  <FieldLabel key={width} className="items-center">
                    <RadioGroupItem value={String(width)} />
                    {t("projectContent.image.widthOption", { width })}
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => updateAttributes({ fileId: null })}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("projectContent.image.replace")}
            </Button>
          </>
        ) : undefined
      }
    >
      {attrs.fileId === null || attrs.fileId === "" ? (
        <UploadDropzone
          kind="image"
          label={t("projectContent.image.dropzone")}
          hint={t("projectContent.image.dropzoneHint", {
            max: maxMebibytes("image"),
          })}
          onUploaded={(file) => updateAttributes({ fileId: file.id })}
        />
      ) : (
        <figure data-width={attrs.width}>
          {image.url === null ? (
            <Skeleton className="h-64 w-full rounded-card" />
          ) : (
            <img src={image.url} alt={attrs.alt ?? ""} />
          )}
          {attrs.caption != null && attrs.caption !== "" && (
            <figcaption>{attrs.caption}</figcaption>
          )}
        </figure>
      )}
    </MediaShell>
  )
}
