import type { ReactNodeViewProps } from "@tiptap/react"
import { MusicIcon, RefreshCwIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MediaCard } from "@/features/project-content/components/nodeviews/MediaCard"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/**
 * AUDIO auf der Schreibflaeche (Contract 2.5).
 *
 * <p><strong>Nur die hochgeladene Datei, keine fremde Adresse.</strong> Das
 * Template zeichnet unter der Ablageflaeche ein zweites Feld „Oder
 * Audio-URL einfuegen"; §2.5 hat {@code AUDIO.src} mit v51 gestrichen, und
 * die Streichung ist mit Grund erfolgt: eine Fremdadresse im Dokument
 * braeche die Regel aus §3.15, dass Dateien nie im Dokument liegen, und
 * waere beim Rendern ein ungeprueftes Laden gegen einen beliebigen Host.
 * Das Feld entfaellt deshalb. Der Contract steht in der Quellenordnung vor
 * dem Template, und es geht hier um die Frage, welche Daten es gibt, nicht
 * darum, was auf der Seite steht.
 */
export function AudioNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const fieldId = useId()
  const attrs = node.attrs as {
    fileId: string | null
    caption: string | null
  }
  const hasFile = attrs.fileId != null && attrs.fileId !== ""

  return (
    <MediaShell
      label={t("projectContent.blockName.audioBlock")}
      incompleteHint={hasFile ? null : t("projectContent.audio.incomplete")}
      settings={
        hasFile ? (
          <>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-caption`}>
                {t("projectContent.audio.caption")}
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
              onClick={() => updateAttributes({ fileId: null })}
            >
              <RefreshCwIcon aria-hidden="true" />
              {t("projectContent.audio.replace")}
            </Button>
          </>
        ) : undefined
      }
    >
      {hasFile ? (
        <MediaCard
          icon={MusicIcon}
          title={t("projectContent.blockName.audioBlock")}
          detail={t("projectContent.audio.fileDetail")}
          caption={attrs.caption}
        />
      ) : (
        <UploadDropzone
          kind="audio"
          label={t("projectContent.audio.dropzone")}
          hint={t("projectContent.audio.dropzoneHint", {
            max: maxMebibytes("audio"),
          })}
          onUploaded={(file) => updateAttributes({ fileId: file.id })}
        />
      )}
    </MediaShell>
  )
}
