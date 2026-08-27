import type { ReactNodeViewProps } from "@tiptap/react"
import {
  Columns2Icon,
  Columns3Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
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
import type {
  GalleryColumns,
  GalleryItem,
} from "@/features/project-content/blockTypes"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/** Genau zwei Werte (Contract 2.5), mit ihren lucide-Symbolen. */
const COLUMNS: readonly { value: GalleryColumns; icon: typeof Columns2Icon }[] =
  [
    { value: 2, icon: Columns2Icon },
    { value: 3, icon: Columns3Icon },
  ]

/**
 * GALLERY auf der Schreibflaeche (Contract 2.5).
 *
 * <p><strong>Die Angaben stehen am Block, der Ausklapper ist weg</strong>
 * (WYSIWYG-Umbau in KAN-36): die Spaltenzahl liegt als Leiste ueber der
 * Galerie und erscheint beim Zeigen oder mit dem Fokus, ein Klick wirkt
 * sofort und die aktive Stufe traegt aria-pressed; die Unterschrift ist
 * ein schlankes Feld direkt unter dem Raster, wie beim Bildblock. Die
 * Leiste steht rechts oben (Nutzerwunsch); der Entfernen-Knopf jeder
 * Kachel steht dafuer links oben, damit sich die beiden Hover-Flaechen an
 * der letzten Kachel der ersten Zeile nicht ueberlagern.
 *
 * <p><strong>Die Alternativtexte bleiben, als schlanke Zeilen unter der
 * Unterschrift.</strong> Der Ausklapper fiel weg, die Pflicht nicht: jedes
 * Bild traegt seinen eigenen Alternativtext, der gemeinsame {@code caption}
 * beschreibt die Gruppe und ersetzt ihn nicht (SC 1.1.1). In die Kacheln
 * selbst passen die Felder nicht, ohne das Raster zu verzerren, dessen
 * Zellen eine feste Groesse tragen.
 *
 * <p>Bilder werden einzeln hinzugefuegt und einzeln wieder entfernt. Die
 * Reihenfolge des Arrays ist die Anzeigereihenfolge; ein Umsortieren
 * innerhalb der Galerie gibt es bewusst nicht: dafuer waere ein zweites
 * Verschiebe-Verfahren neben dem der Bloecke noetig, und der Weg ueber
 * Entfernen und neu Ablegen ist bei zwei bis drei Bildern je Zeile
 * schneller als jede Bedienung dafuer.
 */
export function GalleryNodeView({
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const { t } = useTranslation()
  const { editable, announce } = useEditorContext()
  const fieldId = useId()
  const attrs = node.attrs as {
    items: GalleryItem[]
    columns: GalleryColumns
    caption: string | null
  }
  const items = attrs.items ?? []

  const setItems = (next: GalleryItem[]) => updateAttributes({ items: next })

  return (
    <MediaShell
      incompleteHint={
        items.length === 0 ? t("projectContent.gallery.incomplete") : null
      }
    >
      <figure data-columns={attrs.columns} className="group/gallery relative">
        <ul>
          {items.map((item, index) => (
            <li key={`${item.fileId}-${index}`}>
              <GalleryTile
                item={item}
                position={index + 1}
                editable={editable}
                onRemove={() =>
                  setItems(items.filter((_, position) => position !== index))
                }
              />
            </li>
          ))}
        </ul>

        {editable && items.length > 0 && (
          /* Wie die Breitenleiste am Bild: erst beim Zeigen oder mit dem
             Fokus sichtbar, ein Tabstopp, aria-pressed an der aktiven
             Stufe. */
          <Toolbar
            aria-label={t("projectContent.gallery.columns")}
            className="absolute inset-e-2 top-2 rounded-control border border-border bg-popover p-0.5 opacity-0 shadow-md transition-opacity group-hover/gallery:opacity-100 focus-within:opacity-100 motion-reduce:transition-none"
          >
            {COLUMNS.map(({ value, icon: Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <ToolbarButton
                      render={
                        <Toggle
                          size="sm"
                          pressed={attrs.columns === value}
                          onPressedChange={() => {
                            if (attrs.columns === value) {
                              return
                            }
                            updateAttributes({ columns: value })
                            announce(
                              t("projectContent.gallery.columnsChanged", {
                                columns: value,
                              })
                            )
                          }}
                          className="size-7 min-w-0 px-0"
                        />
                      }
                    />
                  }
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="sr-only">
                    {t("projectContent.gallery.columnsOption", {
                      columns: value,
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("projectContent.gallery.columnsOption", {
                    columns: value,
                  })}
                </TooltipContent>
              </Tooltip>
            ))}
          </Toolbar>
        )}

        {editable
          ? items.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <div>
                  <label className="sr-only" htmlFor={`${fieldId}-caption`}>
                    {t("projectContent.gallery.caption")}
                  </label>
                  <Input
                    id={`${fieldId}-caption`}
                    value={attrs.caption ?? ""}
                    placeholder={t("projectContent.gallery.captionPlaceholder")}
                    title={t("projectContent.gallery.caption")}
                    className="-mx-1 h-7 w-[calc(100%+0.5rem)] border-transparent px-1 py-0 shadow-none dark:bg-transparent"
                    onChange={(event) =>
                      updateAttributes({ caption: event.target.value })
                    }
                  />
                </div>

                <div className="group/alts flex flex-col gap-1">
                  {items.map((item, index) => (
                    <div
                      key={`${item.fileId}-${index}`}
                      className="flex items-baseline gap-2"
                    >
                      <label
                        htmlFor={`${fieldId}-alt-${index}`}
                        className="type-caption shrink-0 text-muted-foreground"
                      >
                        {t("projectContent.gallery.altFor", {
                          position: index + 1,
                        })}
                      </label>
                      <Input
                        id={`${fieldId}-alt-${index}`}
                        value={item.alt}
                        placeholder={t("projectContent.image.altPlaceholder")}
                        aria-describedby={`${fieldId}-alt-hint`}
                        className="h-7 border-transparent px-1 py-0 text-muted-foreground shadow-none md:text-xs dark:bg-transparent"
                        onChange={(event) =>
                          setItems(
                            items.map((entry, position) =>
                              position === index
                                ? { ...entry, alt: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                  {/* Ein Hinweis fuer alle Zeilen, sichtbar sobald eine den
                      Fokus hat; per aria-describedby haengt er dauerhaft an
                      jedem Feld (wie am Bildblock). */}
                  <p
                    id={`${fieldId}-alt-hint`}
                    className="type-caption hidden text-muted-foreground group-focus-within/alts:block"
                  >
                    {t("projectContent.image.altDescription")}
                  </p>
                </div>
              </div>
            )
          : attrs.caption != null &&
            attrs.caption !== "" && <figcaption>{attrs.caption}</figcaption>}
      </figure>

      {editable && (
        <UploadDropzone
          kind="image"
          label={t("projectContent.gallery.dropzone")}
          hint={t("projectContent.image.dropzoneHint", {
            max: maxMebibytes("image"),
          })}
          onUploaded={(file) =>
            setItems([...items, { fileId: file.id, alt: "" }])
          }
        />
      )}
    </MediaShell>
  )
}

/**
 * Ein Bild der Galerie. Eigene Komponente, weil jeder Eintrag seinen
 * eigenen Abruf braucht und Hooks nicht in einer Schleife stehen duerfen.
 */
function GalleryTile({
  item,
  position,
  editable,
  onRemove,
}: {
  item: GalleryItem
  position: number
  editable: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const image = useFileObjectUrl(item.fileId)

  return (
    <div className="group/tile relative">
      {/* Wie beim einzelnen Bild: ein Fehlschlag wird gesagt, statt als
          Dauerladen zu erscheinen. */}
      {image.isError ? (
        <p className="type-caption flex aspect-square w-full items-center justify-center gap-1.5 rounded-card bg-muted px-3 text-center text-muted-foreground">
          <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {t("projectContent.image.loadFailed")}
        </p>
      ) : image.url === null ? (
        <Skeleton className="aspect-square w-full rounded-card" />
      ) : (
        <img src={image.url} alt={item.alt} />
      )}
      {editable && (
        <button
          type="button"
          onClick={onRemove}
          /* Links oben, weil rechts oben am Raster die Spaltenleiste
             liegt: an der letzten Kachel der ersten Zeile laegen beide
             sonst uebereinander. */
          className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-pill bg-card/90 text-muted-foreground opacity-0 outline-none group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">
            {t("projectContent.gallery.remove", { position })}
          </span>
        </button>
      )}
    </div>
  )
}
