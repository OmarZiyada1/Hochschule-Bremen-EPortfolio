import type { ReactNodeViewProps } from "@tiptap/react"
import { TriangleAlertIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useEditorContext } from "@/features/project-content/EditorContext"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/**
 * AUDIO auf der Schreibflaeche (Contract 2.5).
 *
 * <p><strong>Der Block zeigt den echten Player</strong> (WYSIWYG-Umbau in
 * KAN-36), wie der Renderer: {@code audio} mit Bedienelementen,
 * {@code preload="metadata"}, nichts startet von allein (SC 1.4.2). Die
 * Unterschrift ist ein schlankes Feld direkt darunter; eine
 * Ersetzen-Aktion gibt es nicht mehr, wer eine andere Aufnahme will,
 * loescht den Block und fuegt einen neuen ein.
 *
 * <p><strong>Nur die hochgeladene Datei, keine fremde Adresse.</strong> Das
 * Template zeichnet unter der Ablageflaeche ein zweites Feld "Oder
 * Audio-URL einfuegen"; §2.5 hat {@code AUDIO.src} mit v51 gestrichen, und
 * die Streichung ist mit Grund erfolgt: eine Fremdadresse im Dokument
 * braeche die Regel aus §3.15, dass Dateien nie im Dokument liegen, und
 * waere beim Rendern ein ungeprueftes Laden gegen einen beliebigen Host.
 */
export function AudioNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const { editable } = useEditorContext()
  const fieldId = useId()
  const attrs = node.attrs as {
    fileId: string | null
    caption: string | null
  }
  const hasFile = attrs.fileId != null && attrs.fileId !== ""
  const file = useFileObjectUrl(hasFile ? attrs.fileId : null)

  return (
    <MediaShell
      incompleteHint={hasFile ? null : t("projectContent.audio.incomplete")}
    >
      {hasFile ? (
        <figure>
          {file.isError ? (
            <p className="type-caption flex items-center gap-1.5 rounded-card bg-muted px-4 py-6 text-muted-foreground">
              <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
              {t("projectContent.audio.loadFailed")}
            </p>
          ) : file.url === null ? (
            <Skeleton className="h-12 w-full rounded-card" />
          ) : (
            <audio
              controls
              preload="metadata"
              src={file.url}
              aria-label={t("projectContent.audio.label")}
            />
          )}

          {editable ? (
            <div className="mt-2">
              <label className="sr-only" htmlFor={`${fieldId}-caption`}>
                {t("projectContent.audio.caption")}
              </label>
              <Input
                id={`${fieldId}-caption`}
                value={attrs.caption ?? ""}
                placeholder={t("projectContent.audio.captionPlaceholder")}
                title={t("projectContent.audio.caption")}
                className="-mx-1 h-7 w-[calc(100%+0.5rem)] border-transparent px-1 py-0 shadow-none dark:bg-transparent"
                onChange={(event) =>
                  updateAttributes({ caption: event.target.value })
                }
              />
            </div>
          ) : (
            attrs.caption != null &&
            attrs.caption !== "" && <figcaption>{attrs.caption}</figcaption>
          )}
        </figure>
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
