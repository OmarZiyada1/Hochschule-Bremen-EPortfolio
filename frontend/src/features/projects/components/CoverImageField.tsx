import { useQuery } from "@tanstack/react-query"
import { ImageIcon } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { fileQueries } from "@/api/queries/files"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import {
  COVER_IMAGE_MAX_BYTES,
  COVER_IMAGE_MIME_TYPES,
} from "@/features/projects/ProjectMetadataForm.schema"

/** Zehn Mebibyte als Zahl fuer die Meldung, passend zu §3.15. */
const MAX_MEGABYTES = Math.round(COVER_IMAGE_MAX_BYTES / (1024 * 1024))

/**
 * Das Titelbild in der Vorschau-Spalte des Metadatenformulars (§3.15,
 * KAN-35). Ausgangslage ist "Kein Titelbild", wie im Template.
 *
 * <p><strong>Der Upload macht das Bild noch nicht zum Titelbild.</strong>
 * {@code POST /api/files} liefert nur die Referenz {@code /api/files/{id}};
 * gespeichert wird sie mit dem Formular ueber
 * {@code PUT /api/projects/{id}}, wie beim Avatar in KAN-34. Wer die Seite
 * ohne Speichern verlaesst, hat eine verwaiste Datei hochgeladen und kein
 * geaendertes Projekt, und das ist die richtige Richtung: ein Bild, das
 * schon am Projekt haengt, bevor jemand "Speichern" gesagt hat, waere die
 * schlechtere Ueberraschung.
 *
 * <p><strong>Angezeigt wird ueber einen authentifizierten Abruf, nicht
 * ueber die blosse Adresse.</strong> Eine Datei an einem nicht
 * veroeffentlichten Projekt darf nur lesen, wer das Projekt lesen darf
 * (§5, Zeile „Datei lesen"), und ein {@code <img src>} weist nichts nach:
 * das Token liegt im Store, nicht in einem Cookie. Mit
 * {@code src={resolveApiUrl(value)}} bliebe die Flaeche im Entwurf leer,
 * ohne Fehler und ohne Meldung. Deshalb holt {@code fileQueries.blob} die
 * Datei mit Token, und daraus wird eine Object-URL (Befund des
 * frontend-reviewers).
 *
 * <p><strong>Auf {@code /projects/new} ist die Flaeche gesperrt.</strong>
 * {@code POST /api/files} verlangt eine {@code projectId}, und die gibt es
 * vor dem Anlegen nicht; ohne sie waere derselbe Upload per Definition ein
 * Avatar und fuer jede:n abrufbar (§3.15). Statt das zu verschweigen, nennt
 * das Feld den Grund und den naechsten Schritt.
 *
 * <p><strong>Die Vorpruefung ist Komfort, nicht die Regel.</strong>
 * Verbindlich bleibt der Server mit <strong>400</strong>
 * {@code FILE_TYPE_NOT_ALLOWED} beziehungsweise {@code FILE_TOO_LARGE}
 * (§3.15). Sie steht hier trotzdem, weil ein 12-MB-Bild sonst erst nach dem
 * vollstaendigen Hochladen abgelehnt wuerde.
 *
 * <p>Barrierefreiheit: Der Dateiwaehler ist ein echtes
 * {@code input[type=file]} mit verbundenem Label und damit ohne Nachbau
 * bedienbar (SC 2.1.1). Es ist {@code sr-only} und trotzdem fokussierbar;
 * {@code peer-focus-visible} macht den Fokus am Label sichtbar (SC 2.4.7),
 * wie im Profilformular aus KAN-34. Waehrend des Uploads wird es
 * <em>nicht</em> gesperrt, sondern nur als {@code aria-busy} gemeldet: ein
 * gesperrtes Feld nimmt dem Browser das fokussierte Element unter den
 * Fingern weg, und die Tastaturbedienung finge am Seitenanfang von vorn an.
 * Anfang und Ende sagt eine eigene Live-Region an (SC 4.1.3).
 */
export function CoverImageField({
  value,
  onChange,
  onUpload,
  uploading = false,
  disabled = false,
  lockedReason,
}: {
  /** Referenz der Form /api/files/{id}, leer heisst "kein Titelbild". */
  value: string
  onChange: (next: string) => void
  /** Laedt die Datei hoch und liefert die Referenz zurueck. */
  onUpload: (file: File) => Promise<string>
  uploading?: boolean
  disabled?: boolean
  /**
   * Warum kein Upload moeglich ist, etwa weil das Projekt noch nicht
   * angelegt wurde. Gesetzt heisst: kein Dateifeld, dafuer der Grund.
   */
  lockedReason?: string
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [error, setError] = useState<string | null>(null)

  const locked = disabled || lockedReason !== undefined

  const image = useQuery({
    ...fileQueries.blob(value),
    enabled: value !== "",
  })

  /*
   * Die Object-URL lebt so lange wie der Blob und wird beim Wechsel
   * freigegeben. Ohne revokeObjectURL haelt der Browser jedes je gezeigte
   * Bild bis zum Neuladen der Seite im Speicher.
   */
  const blob = image.data
  const objectUrl = useMemo(
    () => (blob === undefined ? null : URL.createObjectURL(blob)),
    [blob]
  )
  useEffect(() => {
    if (objectUrl === null) {
      return
    }
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  async function onFileSelected(file: File | undefined) {
    if (file === undefined) {
      return
    }
    setError(null)

    if (!(COVER_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError(t("project.metadata.cover.typeNotAllowed"))
      return
    }
    if (file.size > COVER_IMAGE_MAX_BYTES) {
      setError(t("project.metadata.cover.tooLarge", { max: MAX_MEGABYTES }))
      return
    }

    try {
      onChange(await onUpload(file))
    } catch (uploadError) {
      if (!isApiError(uploadError)) {
        throw uploadError
      }
      /* Welcher Typ und welche Groesse zulaessig sind, entscheidet der
         Server; die Allowlist wird im Client nicht nachgebaut, sondern nur
         vorweggenommen (Skill frontend-api, Abschnitt 8). */
      setError(
        t(apiErrorMessageKey(uploadError), {
          defaultValue: uploadError.message,
        })
      )
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex aspect-[7/4] w-full items-center justify-center overflow-hidden rounded-card bg-surface-brand">
        {value === "" ? (
          <span className="type-body-sm text-surface-brand-foreground">
            {t("project.metadata.cover.empty")}
          </span>
        ) : image.isPending ? (
          <Skeleton className="size-full" />
        ) : image.isError ? (
          /* Ein fehlgeschlagener Abruf bleibt sichtbar: eine leere Flaeche
             waere der uebersehene Fall (Skill frontend-modul, Abschnitt 5). */
          <span className="type-body-sm px-4 text-center text-surface-brand-foreground">
            {isApiError(image.error)
              ? t(apiErrorMessageKey(image.error), {
                  defaultValue: image.error.message,
                })
              : t("apiError.INTERNAL_ERROR")}
          </span>
        ) : objectUrl !== null ? (
          <img
            src={objectUrl}
            /* Das Titelbild wiederholt den Titel, der direkt daneben steht:
               ein dekoratives Bild bekommt ein leeres alt, nicht keins
               (Skill frontend-design, Abschnitt 4). */
            alt=""
            className="size-full object-cover"
          />
        ) : null}
      </div>

      {locked ? (
        lockedReason !== undefined && (
          <FieldDescription>{lockedReason}</FieldDescription>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input
            id={inputId}
            type="file"
            accept={COVER_IMAGE_MIME_TYPES.join(",")}
            className="peer sr-only"
            aria-busy={uploading}
            aria-describedby={error === null ? undefined : errorId}
            onChange={(event) => void onFileSelected(event.target.files?.[0])}
          />
          <FieldLabel
            htmlFor={inputId}
            className="type-body-sm cursor-pointer items-center gap-2 font-semibold text-primary underline-offset-4 peer-focus-visible:underline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:underline"
          >
            <ImageIcon aria-hidden="true" className="size-4" />
            {uploading
              ? t("project.metadata.cover.pending")
              : value === ""
                ? t("project.metadata.cover.choose")
                : t("project.metadata.cover.replace")}
          </FieldLabel>

          {value !== "" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null)
                onChange("")
              }}
            >
              {t("project.metadata.cover.remove")}
            </Button>
          )}
        </div>
      )}

      {/* Dauerhaft im Baum, nur der Text wechselt: eine Live-Region, die
          zusammen mit ihrem Inhalt entsteht, sagt bei einigen Screenreadern
          nichts (SC 4.1.3). */}
      <p role="status" className="sr-only">
        {uploading ? t("project.metadata.cover.pending") : ""}
      </p>

      {error !== null && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}
