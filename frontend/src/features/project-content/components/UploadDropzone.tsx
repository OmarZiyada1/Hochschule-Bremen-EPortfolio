import { UploadIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { uploadProjectFile } from "@/api/queries/files"
import type { StoredFileResponse } from "@/api/types"
import { FieldError } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { useEditorContext } from "@/features/project-content/EditorContext"
import {
  UPLOAD_CONSTRAINTS,
  maxMebibytes,
  type UploadKind,
} from "@/features/project-content/uploadKinds"
import { cn } from "@/lib/utils"

/**
 * Die Ablageflaeche eines leeren Medienblocks (Figma
 * {@code Template / Studierende · Editor}, Knoten {@code Audio-Upload}).
 *
 * <p><strong>Sie steht im Text und nicht in einem Dialog.</strong> Ein
 * Medienblock entsteht dort, wo er hingehoert, und wird dort gefuellt: die
 * Autor:in sieht beim Ablegen, an welcher Stelle des Beitrags das Bild
 * landet. Ein Dialog nimmt ihr diese Sicht und macht den Block ausserdem
 * unveraenderlich, sobald er einmal steht.
 *
 * <p><strong>Ein echtes {@code input[type=file]}, kein Nachbau.</strong> Es
 * ist {@code sr-only} und trotzdem fokussierbar; der Fokus wird ueber
 * {@code peer-focus-visible} am Label sichtbar (SC 2.4.7, wie im
 * Titelbildfeld aus KAN-35). Die Ziehbewegung ist der zweite Weg und nie
 * der einzige (SC 2.1.1).
 *
 * <p><strong>Der Fortschritt ist nicht nur Zierde.</strong> Ein Video darf
 * 200 MiB gross sein; ohne Rueckmeldung sieht der Upload aus wie ein
 * Stillstand. Anfang und Ende sagt eine Live-Region an (SC 4.1.3), der
 * Balken selbst ist {@code aria-hidden}, weil sein Wert schon in der Ansage
 * steht.
 */
export function UploadDropzone({
  kind,
  label,
  hint,
  onUploaded,
  className,
}: {
  kind: UploadKind
  label: string
  hint: string
  onUploaded: (file: StoredFileResponse) => void
  className?: string
}) {
  const { t } = useTranslation()
  const { projectId, announce, editable } = useEditorContext()
  const inputId = useId()
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  const constraint = UPLOAD_CONSTRAINTS[kind]
  const uploading = progress !== null

  const accept = async (file: File | undefined) => {
    if (file === undefined || !editable) {
      return
    }
    /* Vorpruefung als Komfort; die Allowlist selbst gehoert dem Server
       (Skill frontend-api, Abschnitt 8). */
    if (!constraint.mimeTypes.includes(file.type)) {
      setError(t("projectContent.upload.typeNotAllowed"))
      return
    }
    if (file.size > constraint.maxBytes) {
      setError(t("projectContent.upload.tooLarge", { max: maxMebibytes(kind) }))
      return
    }

    setError(null)
    setProgress(0)
    announce(t("projectContent.upload.started", { fileName: file.name }))
    try {
      const stored = await uploadProjectFile(file, projectId, {
        onProgress: (value) => setProgress(value ?? 0),
      })
      onUploaded(stored)
      announce(t("projectContent.upload.done", { fileName: file.name }))
    } catch (uploadError) {
      if (!isApiError(uploadError)) {
        throw uploadError
      }
      setError(
        t(apiErrorMessageKey(uploadError), {
          defaultValue: uploadError.message,
        })
      )
      announce(t("projectContent.upload.failed", { fileName: file.name }))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div
      /* contentEditable false am Rahmen: die Flaeche gehoert zur Bedienung
         und nicht zum Text, sonst liesse sich in sie hineintippen. */
      contentEditable={false}
      className={cn("flex flex-col gap-2", className)}
    >
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          void accept(event.dataTransfer.files?.[0])
        }}
        className={cn(
          "rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors",
          over
            ? "border-primary bg-muted"
            : "border-border hover:border-primary"
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={constraint.mimeTypes.join(",")}
          disabled={!editable}
          className="peer sr-only"
          aria-busy={uploading}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => {
            void accept(event.target.files?.[0])
            /* Zuruecksetzen, damit dieselbe Datei nach einem Fehler noch
               einmal gewaehlt werden kann: ohne das feuert change nicht. */
            event.target.value = ""
          }}
        />
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-control peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          <UploadIcon aria-hidden="true" className="size-6 text-primary" />
          <span className="type-body-sm font-semibold text-primary">
            {label}
          </span>
          <span className="type-caption text-muted-foreground">{hint}</span>
        </label>

        {uploading && (
          <Progress
            aria-hidden="true"
            value={Math.round(progress * 100)}
            className="mt-4"
          />
        )}
      </div>

      {error !== null && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}
