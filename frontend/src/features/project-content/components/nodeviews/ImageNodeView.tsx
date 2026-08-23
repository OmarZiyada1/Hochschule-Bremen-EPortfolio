import type { ReactNodeViewProps } from "@tiptap/react"
import { TriangleAlertIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorContext } from "@/features/project-content/EditorContext"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import type { ImageWidth } from "@/features/project-content/blockTypes"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/** Die drei Stufen aus Contract 2.5, aufsteigend wie in der Leiste am Bild. */
const WIDTHS: readonly ImageWidth[] = [50, 75, 100]

/**
 * IMAGE auf der Schreibflaeche (Contract 2.5).
 *
 * <p>Leer ist der Block eine Ablageflaeche, gefuellt zeigt er das Bild in
 * der gewaehlten Breite, also so, wie es danach aussieht.
 *
 * <p><strong>Die Angaben stehen am Bild und nicht mehr in einem
 * Ausklapper.</strong> Die Breite liegt als Leiste ueber dem Bild und
 * erscheint beim Zeigen oder mit dem Fokus; Alternativtext und
 * Bildunterschrift sind zwei schlanke Felder direkt darunter, dort, wo die
 * Unterschrift nachher auch steht. Jede Aenderung wirkt sofort am Block,
 * ohne dass sich vorher etwas oeffnen muss. Der fruehere Ausklapper
 * verlangte fuer jeden Handgriff erst das Aufklappen und stellte die drei
 * Angaben als Formular neben das Bild statt an das Bild.
 *
 * <p><strong>Die Breitenleiste ist kein Zeigerweg allein</strong>
 * (SC 2.1.1): die Leiste ist eine toolbar mit einem Tabstopp, mit dem
 * Fokus wird sie sichtbar (focus-within), und die gewaehlte Stufe traegt
 * aria-pressed. Beschriftet ist jede Stufe mit ihrem vollen Namen; die
 * sichtbare Zahl allein ist als Name zu wenig. Symbole dafuer gibt es
 * nicht: lucide fuehrt keine Dreierreihe fuer Breitenstufen, und
 * nachgebaute SVGs sind kein Weg (Frontend-Regel 11).
 *
 * <p><strong>Zum Alternativtext.</strong> Contract 2.5 liest einen leeren
 * {@code alt} als ausdrueckliche Aussage "das Bild ist schmueckend". Der
 * Hinweis dazu erscheint, sobald das Feld den Fokus hat, und haengt per
 * aria-describedby dauerhaft am Feld; dauerhaft sichtbar machte er aus
 * zwei schlanken Zeilen wieder ein Formular.
 *
 * <p><strong>Read-only zeigt den Lesezustand.</strong> Ohne Schreibrecht
 * (§4.1) erscheinen weder Leiste noch Felder, sondern die Unterschrift
 * als figcaption wie im Renderer.
 */
export function ImageNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const { editable, announce } = useEditorContext()
  const fieldId = useId()
  const attrs = node.attrs as {
    fileId: string | null
    alt: string | null
    caption: string | null
    width: ImageWidth
  }
  const image = useFileObjectUrl(attrs.fileId)

  return (
    <MediaShell
      incompleteHint={
        attrs.fileId ? null : t("projectContent.image.incomplete")
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
        <figure data-width={attrs.width} className="group/image relative">
          {/* Ein Fehlschlag wird gesagt und nicht als Dauerladen gezeigt:
              ohne die Meldung stand hier bis zum Neuladen der Seite ein
              graues Feld, und niemand erfuhr, warum. */}
          {image.isError ? (
            <p className="type-caption flex items-center gap-1.5 rounded-card bg-muted px-4 py-6 text-muted-foreground">
              <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
              {t("projectContent.image.loadFailed")}
            </p>
          ) : image.url === null ? (
            <Skeleton className="h-64 w-full rounded-card" />
          ) : (
            <img src={image.url} alt={attrs.alt ?? ""} />
          )}

          {editable && !image.isError && (
            /*
             * Erst beim Zeigen oder mit dem Fokus sichtbar, damit sie das
             * Bild nicht dauerhaft verdeckt. focus-within macht sie fuer
             * die Tastatur sichtbar, bevor der erste Eintrag den Fokus
             * traegt (Base UI setzt den Tabstopp auf die Leiste).
             */
            <Toolbar
              aria-label={t("projectContent.image.widthToolbar")}
              className="absolute inset-e-2 top-2 rounded-control border border-border bg-popover p-0.5 opacity-0 shadow-md transition-opacity group-hover/image:opacity-100 focus-within:opacity-100 motion-reduce:transition-none"
            >
              {WIDTHS.map((width) => (
                <Tooltip key={width}>
                  <TooltipTrigger
                    render={
                      <ToolbarButton
                        render={
                          <Toggle
                            size="sm"
                            pressed={attrs.width === width}
                            onPressedChange={() => {
                              if (attrs.width === width) {
                                return
                              }
                              updateAttributes({ width })
                              /* Die Aenderung ist rein visuell; fuer
                                 Screenreader sagt die Live-Region der
                                 Seite sie an. */
                              announce(
                                t("projectContent.image.widthChanged", {
                                  width,
                                })
                              )
                            }}
                            className="h-7 min-w-0 px-2"
                          />
                        }
                      />
                    }
                  >
                    <span aria-hidden="true" className="type-caption">
                      {t("projectContent.image.widthValue", { width })}
                    </span>
                    <span className="sr-only">
                      {t("projectContent.image.widthOption", { width })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("projectContent.image.widthOption", { width })}
                  </TooltipContent>
                </Tooltip>
              ))}
            </Toolbar>
          )}

          {editable ? (
            <div className="mt-2 flex flex-col gap-1">
              <div className="group/alt">
                <label className="sr-only" htmlFor={`${fieldId}-alt`}>
                  {t("projectContent.image.alt")}
                </label>
                <Input
                  id={`${fieldId}-alt`}
                  value={attrs.alt ?? ""}
                  placeholder={t("projectContent.image.altPlaceholder")}
                  aria-describedby={`${fieldId}-alt-hint`}
                  className="-mx-1 h-7 w-[calc(100%+0.5rem)] border-transparent px-1 py-0 text-muted-foreground shadow-none md:text-xs dark:bg-transparent"
                  onChange={(event) =>
                    updateAttributes({ alt: event.target.value })
                  }
                />
                {/* Sichtbar nur mit Fokus im Feld; fuer Screenreader haengt
                    er ueber aria-describedby dauerhaft am Feld. */}
                <p
                  id={`${fieldId}-alt-hint`}
                  className="type-caption hidden text-muted-foreground group-focus-within/alt:block"
                >
                  {t("projectContent.image.altDescription")}
                </p>
              </div>

              <div>
                <label className="sr-only" htmlFor={`${fieldId}-caption`}>
                  {t("projectContent.image.caption")}
                </label>
                <Input
                  id={`${fieldId}-caption`}
                  value={attrs.caption ?? ""}
                  placeholder={t("projectContent.image.captionPlaceholder")}
                  /* Gefuellt traegt das rahmenlose Feld keinen sichtbaren
                     Namen mehr; der title sagt beim Zeigen, was es ist
                     (SC 3.3.2, Review-Hinweis). */
                  title={t("projectContent.image.caption")}
                  className="-mx-1 h-7 w-[calc(100%+0.5rem)] border-transparent px-1 py-0 shadow-none dark:bg-transparent"
                  onChange={(event) =>
                    updateAttributes({ caption: event.target.value })
                  }
                />
              </div>
            </div>
          ) : (
            attrs.caption != null &&
            attrs.caption !== "" && <figcaption>{attrs.caption}</figcaption>
          )}
        </figure>
      )}
    </MediaShell>
  )
}
