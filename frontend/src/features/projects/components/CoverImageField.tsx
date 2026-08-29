import { useQuery } from "@tanstack/react-query"
import {
  ImageIcon,
  ImagePlusIcon,
  ImageUpIcon,
  LoaderIcon,
  Trash2Icon,
} from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import { fileQueries } from "@/api/queries/files"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldError, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  COVER_IMAGE_MAX_BYTES,
  COVER_IMAGE_MIME_TYPES,
} from "@/features/projects/ProjectMetadataForm.schema"
import { cn } from "@/lib/utils"

/** Zehn Mebibyte als Zahl fuer die Meldung, passend zu §3.15. */
const MAX_MEGABYTES = Math.round(COVER_IMAGE_MAX_BYTES / (1024 * 1024))

/**
 * Die zulaessigen Seitenverhaeltnisse der Vorschauflaeche.
 *
 * <p>Als Tabelle und nicht als zusammengesetzte Klasse, weil Tailwind die
 * Klassennamen im Quelltext liest: {@code aspect-[${ratio}]} entstuende
 * erst zur Laufzeit und faende sich im gebauten CSS nicht wieder.
 *
 * <p>Zwei Werte, weil dasselbe Bild an zwei Stellen verschieden gerahmt
 * ist: das Metadatenformular zeigt es 7:4 wie im Template, die Kopfpartie
 * des Editors 16:9 (KAN-36). Der Standard bleibt der aeltere Wert, damit
 * die vorhandenen Aufrufe unveraendert bleiben.
 */
const ASPECT_CLASS = {
  "7/4": "aspect-[7/4]",
  "16/9": "aspect-video",
} as const

/** Seitenverhaeltnis der Vorschauflaeche. */
export type CoverImageAspect = keyof typeof ASPECT_CLASS

/**
 * Wo die Bedienelemente stehen.
 *
 * <p>{@code below} setzt sie unter die Flaeche, wie es das Metadatenformular
 * in seiner schmalen Vorschau-Spalte braucht. {@code overlay} legt sie als
 * eigene Leiste auf das Bild, damit die Kopfpartie des Editors ohne einen
 * Streifen darunter auskommt.
 */
export type CoverImageControlPlacement = "below" | "overlay"

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
 * <p>Eine {@code projectId} gibt es hier immer: {@code /projects/new} legt
 * das Projekt an, bevor diese Seite erscheint. Ohne sie waere derselbe
 * Upload per Definition ein Avatar und fuer jede:n abrufbar (§3.15).
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
  aspect = "7/4",
  controlPlacement = "below",
}: {
  /** Referenz der Form /api/files/{id}, leer heisst "kein Titelbild". */
  value: string
  onChange: (next: string) => void
  /** Laedt die Datei hoch und liefert die Referenz zurueck. */
  onUpload: (file: File) => Promise<string>
  uploading?: boolean
  disabled?: boolean
  /** Rahmen der Vorschauflaeche; siehe {@link ASPECT_CLASS}. */
  aspect?: CoverImageAspect
  /** Lage der Bedienelemente; siehe {@link CoverImageControlPlacement}. */
  controlPlacement?: CoverImageControlPlacement
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [error, setError] = useState<string | null>(null)

  /*
   * Die Object-URL kommt aus dem Query-Cache und wird mit ihm freigegeben
   * (fileQueries.objectUrl). Sie hier zu erzeugen und im Aufraeumen eines
   * Effekts freizugeben, war unter StrictMode falsch: React ruft beim
   * Montieren Aufbau, Abbau, Aufbau, und der Abbau gab genau die Adresse
   * frei, die das img in derselben Runde schon trug. Sichtbar wurde das,
   * sobald die Datei beim Montieren im Cache lag, also beim zweiten
   * Aufschlagen der Metadatenseite: das Titelbild blieb leer, ohne Fehler
   * und ohne Meldung (Befund aus KAN-36).
   */
  const image = useQuery({
    ...fileQueries.objectUrl(value),
    enabled: value !== "",
  })
  const objectUrl = image.data ?? null

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
      setError(apiMessage(uploadError))
    }
  }

  const overlaid = controlPlacement === "overlay"

  /** Beschriftung des Dateiwaehlers; sie haengt am Zustand, nicht am Ort. */
  const chooseLabel = uploading
    ? t("project.metadata.cover.pending")
    : value === ""
      ? t("project.metadata.cover.choose")
      : t("project.metadata.cover.replace")
  const removeLabel = t("project.metadata.cover.remove")

  /*
   * Die Bedienelemente entstehen einmal und werden anschliessend an einer
   * von zwei Stellen eingehaengt. Sie zweimal zu schreiben, waere zwei
   * Dateiwaehler mit zwei Bezeichnern im Baum: der zweite Auslesevorgang
   * traefe dann je nach Platzierung den falschen.
   *
   * <p><strong>Ueberlagert wird das Bild, nicht der Untergrund.</strong> Die
   * Leiste liegt oben rechts auf einer eigenen Kartenflaeche und nicht
   * unmittelbar auf dem Bild. Ein Titelbild ist beliebig hell oder dunkel,
   * und ein Zeichen darauf haelt keinen Kontrast zu (SC 1.4.11); die
   * undurchsichtige Flaeche stellt genau den Untergrund her, den die Leiste
   * unterhalb der Flaeche ohnehin hat.
   *
   * <p><strong>Nur Zeichen, und deshalb ein Zeichen je Zustand.</strong>
   * Ueberlagert traegt das Sinnbild die Bedeutung allein, also unterscheidet
   * es Hinzufuegen ({@code ImagePlus}) von Ersetzen ({@code ImageUp}) und
   * zeigt waehrend des Uploads den Kreisel. Unterhalb der Flaeche steht die
   * Beschriftung daneben; dort genuegt das neutrale Zeichen des Templates.
   * Der zugaengliche Name geht dabei nicht verloren: er steht als
   * {@code sr-only} im Bedienelement und noch einmal sichtbar im Tooltip
   * (SC 4.1.2, SC 1.1.1). Die Flaechen messen 32px und damit mehr als die
   * geforderten 24px (SC 2.5.8).
   *
   * <p>Der Dateiwaehler bleibt auch ueberlagert ein echtes
   * {@code input[type=file]} mit verbundenem Label: {@code TooltipTrigger}
   * zeichnet das Label selbst, die Wurzel des Tooltips zeichnet nichts, und
   * damit bleibt das Label im Dokument der Nachbar des Feldes, auf den
   * {@code peer-focus-visible} zielt.
   */
  const controls = disabled ? null : overlaid ? (
    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-pill border bg-card p-1 text-card-foreground shadow-sm">
      <input
        id={inputId}
        type="file"
        accept={COVER_IMAGE_MIME_TYPES.join(",")}
        className="peer sr-only"
        aria-busy={uploading}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => void onFileSelected(event.target.files?.[0])}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <FieldLabel
              htmlFor={inputId}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "cursor-pointer peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
              )}
            />
          }
        >
          {uploading ? (
            <LoaderIcon aria-hidden="true" className="size-4 animate-spin" />
          ) : value === "" ? (
            <ImagePlusIcon aria-hidden="true" className="size-4" />
          ) : (
            <ImageUpIcon aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only">{chooseLabel}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{chooseLabel}</TooltipContent>
      </Tooltip>

      {value !== "" && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hover:text-destructive"
                onClick={() => {
                  setError(null)
                  onChange("")
                }}
              />
            }
          >
            <Trash2Icon aria-hidden="true" className="size-4" />
            <span className="sr-only">{removeLabel}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{removeLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
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
        {chooseLabel}
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
          {removeLabel}
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <div
        data-slot="cover-image-preview"
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-card bg-surface-brand",
          ASPECT_CLASS[aspect]
        )}
      >
        {value === "" ? (
          <span className="type-body-sm text-surface-brand-foreground">
            {t("project.metadata.cover.empty")}
          </span>
        ) : image.isPending ? (
          <Skeleton className="size-full" />
        ) : image.isError ? (
          /* Ein fehlgeschlagener Abruf bleibt sichtbar: eine leere Flaeche
             waere der uebersehene Fall (Skill frontend-modul, Abschnitt 5).

             Ueberlagert braucht die Meldung Vorlauf nach oben, sonst laeuft
             sie unter die deckende Leiste. Nachgerechnet fuer den Bezugsfall
             aus SC 1.4.10, also 320px Ansichtsbreite: die Spalte des Editors
             ist dort 208px breit, die Flaeche im Verhaeltnis 16:9 also 117px
             hoch; die Leiste steht ab top-3 und ist 42px hoch, endet also bei
             54px. Eine Fehlermeldung bricht auf dieser Breite auf mehrere
             Zeilen, und ihre erste laege mittig genau in diesem Band. 3.5rem
             Vorlauf setzen den Text darunter. Der Leerzustand braucht das
             nicht: ohne Bild traegt die Leiste nur den Dateiwaehler, und
             "Kein Titelbild" bleibt in jeder Breite links daneben. */
          <span
            className={cn(
              "type-body-sm px-4 text-center text-surface-brand-foreground",
              overlaid && "pt-14"
            )}
          >
            {apiMessage(image.error)}
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

        {overlaid && controls}
      </div>

      {overlaid ? null : controls}

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
