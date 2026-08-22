import type { ReactNodeViewProps } from "@tiptap/react"
import { FileTextIcon, RefreshCwIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { MediaCard } from "@/features/project-content/components/nodeviews/MediaCard"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import {
  formatFileSize,
  maxMebibytes,
} from "@/features/project-content/uploadKinds"

/**
 * DOCUMENT auf der Schreibflaeche (Contract 2.5).
 *
 * <p>Drei Pflichtattribute, und alle drei kommen aus der Antwort des
 * Uploads: {@code fileId}, {@code fileName} und {@code size}. Es gibt
 * deshalb nichts einzutippen und keinen Ausklapper mit Angaben; der
 * Dateiname ist der Name, unter dem die Datei hochgeladen wurde, und ihn
 * hier ueberschreibbar zu machen hiesse, zwei Namen fuer dieselbe Datei zu
 * fuehren.
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

  return (
    <MediaShell
      label={t("projectContent.blockName.documentBlock")}
      incompleteHint={hasFile ? null : t("projectContent.document.incomplete")}
      settings={
        hasFile ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              updateAttributes({ fileId: null, fileName: null, size: 0 })
            }
          >
            <RefreshCwIcon aria-hidden="true" />
            {t("projectContent.document.replace")}
          </Button>
        ) : undefined
      }
    >
      {hasFile ? (
        <MediaCard
          icon={FileTextIcon}
          title={attrs.fileName ?? ""}
          detail={formatFileSize(attrs.size, i18n.language)}
        />
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
