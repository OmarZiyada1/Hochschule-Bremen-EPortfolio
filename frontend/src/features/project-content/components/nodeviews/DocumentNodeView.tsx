import type { ReactNodeViewProps } from "@tiptap/react"
import { TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
/* Dieselbe Groessenschreibweise wie im Lesepfad: zwei Formatierungen
   lieferten am selben Dokument zwei Groessen (Review-Befund). */
import { formatFileSize } from "@/features/project-content/renderer/renderBlockNode"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/**
 * DOCUMENT auf der Schreibflaeche (Contract 2.5).
 *
 * <p><strong>Der Block sieht aus wie im Renderer</strong> (WYSIWYG-Umbau in
 * KAN-36): der Dateiname als Link mit der Groesse dahinter, in derselben
 * Absatzform ({@code data-block="document"}) und mit demselben
 * zugaenglichen Namen (SC 2.4.4). Der Link fuehrt auf die Object-URL des
 * angemeldeten Abrufs und traegt {@code download} mit dem Dateinamen, wie
 * der Renderer es an einer blob-Adresse tut.
 *
 * <p>Drei Pflichtattribute, und alle drei kommen aus der Antwort des
 * Uploads: {@code fileId}, {@code fileName} und {@code size}. Es gibt
 * deshalb nichts einzutippen; eine Ersetzen-Aktion gibt es nicht mehr, wer
 * ein anderes Dokument will, loescht den Block und fuegt einen neuen ein.
 */
export function DocumentNodeView({
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const { t, i18n } = useTranslation()
  const attrs = node.attrs as {
    fileId: string | null
    fileName: string | null
    size: number
  }
  const hasFile = attrs.fileId != null && attrs.fileId !== ""
  const file = useFileObjectUrl(hasFile ? attrs.fileId : null)
  const formattedSize = formatFileSize(attrs.size, i18n.language)

  return (
    <MediaShell
      incompleteHint={hasFile ? null : t("projectContent.document.incomplete")}
    >
      {hasFile ? (
        file.isError ? (
          <p className="type-caption flex items-center gap-1.5 rounded-card bg-muted px-4 py-6 text-muted-foreground">
            <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
            {t("projectContent.media.unavailable")}
          </p>
        ) : file.url === null ? (
          <Skeleton className="h-6 w-64 rounded-control" />
        ) : (
          <p data-block="document">
            <a
              href={file.url}
              download={attrs.fileName ?? undefined}
              aria-label={t("projectContent.document.accessibleName", {
                fileName: attrs.fileName,
                size: formattedSize,
              })}
            >
              {attrs.fileName}
            </a>{" "}
            <span aria-hidden="true">{formattedSize}</span>
          </p>
        )
      ) : (
        <UploadDropzone
          kind="document"
          label={t("projectContent.document.dropzone")}
          hint={t("projectContent.document.dropzoneHint", {
            max: maxMebibytes("document"),
          })}
          onUploaded={(file) =>
            updateAttributes({
              fileId: file.id,
              fileName: file.fileName,
              size: file.size,
            })
          }
        />
      )}
    </MediaShell>
  )
}
