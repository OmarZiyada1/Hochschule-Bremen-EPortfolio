import type { ReactNodeViewProps } from "@tiptap/react"
import { XIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { UploadDropzone } from "@/features/project-content/components/UploadDropzone"
import type {
  GalleryColumns,
  GalleryItem,
} from "@/features/project-content/blockTypes"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { maxMebibytes } from "@/features/project-content/uploadKinds"

/** Genau zwei Werte (Contract 2.5). */
const COLUMNS: readonly GalleryColumns[] = [2, 3]

/**
 * GALLERY auf der Schreibflaeche (Contract 2.5).
 *
 * <p>Bilder werden einzeln hinzugefuegt und einzeln wieder entfernt, und
 * jedes traegt seinen <strong>eigenen Alternativtext</strong>: der
 * gemeinsame {@code caption} beschreibt die Gruppe und ersetzt ihn nicht.
 * Wer sich eine Galerie vorlesen laesst, erfuehre sonst zum dritten Bild
 * nichts (SC 1.1.1).
 *
 * <p>Die Reihenfolge des Arrays ist die Anzeigereihenfolge; sie ergibt sich
 * aus der Reihenfolge des Hinzufuegens. Ein Umsortieren innerhalb der
 * Galerie gibt es bewusst nicht: dafuer waere ein zweites
 * Verschiebe-Verfahren neben dem der Bloecke noetig, und der Weg ueber
 * Entfernen und neu Ablegen ist bei zwei bis drei Bildern je Zeile
 * schneller als jede Bedienung dafuer.
 */
export function GalleryNodeView({
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const { t } = useTranslation()
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
      label={t("projectContent.blockName.galleryBlock")}
      incompleteHint={
        items.length === 0 ? t("projectContent.gallery.incomplete") : null
      }
      settings={
        <>
          {items.length > 0 && (
            <FieldSet>
              <FieldLegend variant="label">
                {t("projectContent.gallery.altGroup")}
              </FieldLegend>
              <FieldDescription>
                {t("projectContent.image.altDescription")}
              </FieldDescription>
              <div className="mt-2 flex flex-col gap-2">
                {items.map((item, index) => (
                  <Field key={`${item.fileId}-${index}`}>
                    <FieldLabel htmlFor={`${fieldId}-alt-${index}`}>
                      {t("projectContent.gallery.altFor", {
                        position: index + 1,
                      })}
                    </FieldLabel>
                    <Input
                      id={`${fieldId}-alt-${index}`}
                      value={item.alt}
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
                  </Field>
                ))}
              </div>
            </FieldSet>
          )}

          <Field>
            <FieldLabel htmlFor={`${fieldId}-caption`}>
              {t("projectContent.gallery.caption")}
            </FieldLabel>
            <Input
              id={`${fieldId}-caption`}
              value={attrs.caption ?? ""}
              onChange={(event) =>
                updateAttributes({ caption: event.target.value })
              }
            />
          </Field>

          <FieldSet>
            <FieldLegend variant="label">
              {t("projectContent.gallery.columns")}
            </FieldLegend>
            <RadioGroup
              value={String(attrs.columns)}
              onValueChange={(value) =>
                updateAttributes({ columns: Number(value) })
              }
              className="grid-cols-2"
            >
              {COLUMNS.map((columns) => (
                <FieldLabel key={columns} className="items-center">
                  <RadioGroupItem value={String(columns)} />
                  {t("projectContent.gallery.columnsOption", { columns })}
                </FieldLabel>
              ))}
            </RadioGroup>
          </FieldSet>
        </>
      }
    >
      <figure data-columns={attrs.columns}>
        <ul>
          {items.map((item, index) => (
            <li key={`${item.fileId}-${index}`}>
              <GalleryTile
                item={item}
                position={index + 1}
                onRemove={() =>
                  setItems(items.filter((_, position) => position !== index))
                }
              />
            </li>
          ))}
        </ul>
        {attrs.caption != null && attrs.caption !== "" && (
          <figcaption>{attrs.caption}</figcaption>
        )}
      </figure>

      <UploadDropzone
        kind="image"
        label={t("projectContent.gallery.dropzone")}
        hint={t("projectContent.image.dropzoneHint", {
          max: maxMebibytes("image"),
        })}
        onUploaded={(file) => setItems([...items, { fileId: file.id, alt: "" }])}
      />
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
  onRemove,
}: {
  item: GalleryItem
  position: number
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const image = useFileObjectUrl(item.fileId)

  return (
    <div className="group/tile relative">
      {image.url === null ? (
        <Skeleton className="aspect-square w-full rounded-card" />
      ) : (
        <img src={image.url} alt={item.alt} />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-pill bg-card/90 text-muted-foreground opacity-0 outline-none group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <XIcon aria-hidden="true" className="size-4" />
        <span className="sr-only">
          {t("projectContent.gallery.remove", { position })}
        </span>
      </button>
    </div>
  )
}
