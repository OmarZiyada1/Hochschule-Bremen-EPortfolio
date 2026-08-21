import { UploadIcon, XIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { uploadProjectFile } from "@/api/queries/files"
import type { StoredFileResponse } from "@/api/types"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { formatFileSize } from "@/features/project-content/renderer/renderBlockNode"

/**
 * Die Uploadflaeche der Medien-Dialoge: Dateiwahl, Fortschritt, Abbruch.
 *
 * <p><strong>Ein echtes {@code input[type=file]}</strong>, nur optisch
 * verborgen und ueber sein Label bedient. Ein nachgebauter Knopf, der einen
 * Klick auf ein verstecktes Feld weiterreicht, verliert die Dateiwahl per
 * Tastatur und die Ansage des Dateinamens durch den Screenreader; das
 * native Feld bringt beides mit (SC 2.1.1, SC 4.1.2).
 *
 * <p><strong>Fortschritt und Abbruch laufen ueber eine Live-Region.</strong>
 * Ein Balken allein ist fuer eine blinde Person kein Fortschritt.
 * {@code Progress} traegt {@code role="progressbar"} und einen Wert; die
 * Meldungen ueber Beginn, Abbruch und Fehler stehen zusaetzlich in einem
 * {@code role="status"} an dieser Stelle, damit sie ohne Blick auf den
 * Balken ankommen.
 *
 * <p><strong>Die Allowlist wird nicht nachgebaut.</strong> {@code accept}
 * ist ein Vorabhinweis fuer den Dateiauswahldialog, keine Pruefung:
 * verbindlich ist der Server mit 400 {@code FILE_TYPE_NOT_ALLOWED} und 400
 * {@code FILE_TOO_LARGE} (Skill frontend-api, Abschnitt 8). Beide erscheinen
 * hier als Meldung.
 */

export function FileUploadField({
  projectId,
  accept,
  label,
  hint,
  value,
  onUploaded,
  onClear,
}: {
  projectId: string
  /** MIME-Vorauswahl fuer den Dateiauswahldialog, kein Ersatz fuer den Server. */
  accept: string
  label: string
  hint: string
  /** Die bereits hochgeladene Datei, wenn es eine gibt. */
  value: StoredFileResponse | null
  onUploaded: (file: StoredFileResponse) => void
  onClear: () => void
}) {
  const { t, i18n } = useTranslation()
  const inputId = useId()
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /*
   * "Laeuft gerade" steht im Zustand und nicht im Ref. Ein Ref darf waehrend
   * des Renderns nicht gelesen werden, und das Rendern haengt genau daran:
   * Fortschrittsbalken und Abbruchknopf erscheinen nur waehrend eines
   * Uploads. Der Ref traegt allein den Abbruchgriff, den niemand rendert.
   */
  const [uploading, setUploading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const start = async (file: File) => {
    setError(null)
    setProgress(0)
    setMessage(t("projectContent.upload.started", { fileName: file.name }))

    const controller = new AbortController()
    abortRef.current = controller
    setUploading(true)

    try {
      const stored = await uploadProjectFile(file, projectId, {
        signal: controller.signal,
        onProgress: ({ loaded, total }) => {
          /* Ohne bekannte Gesamtgroesse gibt es keinen Prozentwert, den die
             Anzeige behaupten koennte: dann laeuft der Balken unbestimmt. */
          setProgress(total === null ? null : Math.round((loaded / total) * 100))
        },
      })
      onUploaded(stored)
      setMessage(t("projectContent.upload.done", { fileName: stored.fileName }))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setMessage(t("projectContent.upload.cancelled"))
        return
      }
      setMessage(null)
      setError(
        isApiError(caught)
          ? t(apiErrorMessageKey(caught), { defaultValue: caught.message })
          : t("apiError.INTERNAL_ERROR")
      )
    } finally {
      abortRef.current = null
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="type-label-xs text-muted-foreground uppercase"
      >
        {label}
      </label>

      {value === null ? (
        <div className="flex flex-col items-center gap-1 rounded-card border border-dashed border-input px-4 py-6 text-center">
          <UploadIcon aria-hidden="true" className="size-5 text-primary" />
          <input
            id={inputId}
            type="file"
            accept={accept}
            /*
             * Waehrend des Uploads nicht gesperrt, sondern als beschaeftigt
             * gemeldet: ein gesperrtes Feld nimmt dem Browser das fokussierte
             * Element unter den Fingern weg, und der Fokus faellt auf body
             * (SC 2.4.3, derselbe Befund wie beim Titelbild in KAN-35).
             */
            aria-busy={uploading}
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) {
                void start(file)
              }
              /* Zuruecksetzen, damit dieselbe Datei nach einem Abbruch
                 erneut gewaehlt werden kann: sonst feuert change nicht. */
              event.target.value = ""
            }}
            className="type-body-sm mt-1 file:mr-3 file:rounded-control file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-semibold file:text-secondary-foreground"
          />
          <p id={`${inputId}-hint`} className="type-caption text-muted-foreground">
            {hint}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-card border border-border px-3 py-2">
          <span className="type-body-sm truncate">
            {value.fileName}{" "}
            <span className="text-muted-foreground">
              {formatFileSize(value.size, i18n.language)}
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t("projectContent.upload.replace")}
          </Button>
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2">
          <Progress value={progress} className="flex-1">
            <ProgressLabel className="type-body-sm">
              {t("projectContent.upload.progressLabel")}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => abortRef.current?.abort()}
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("projectContent.upload.cancel")}</span>
          </Button>
        </div>
      )}

      {/* Die Live-Region steht immer im DOM, auch leer: ein erst beim
          Ereignis eingehaengtes role="status" wird von manchen
          Screenreadern nicht mehr vorgelesen. */}
      <p role="status" className="sr-only">
        {message ?? ""}
      </p>

      {error !== null && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
    </div>
  )
}
