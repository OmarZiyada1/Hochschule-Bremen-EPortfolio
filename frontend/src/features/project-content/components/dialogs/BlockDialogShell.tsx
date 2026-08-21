import type { FormEventHandler, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { FieldError as RhfFieldError } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * Die gemeinsame Huelle der sieben Blockdialoge und die drei Felder, die
 * mehr als einer von ihnen braucht.
 *
 * <p>Alle sieben tun dasselbe: sie erheben die Pflichtattribute eines
 * Blocktyps aus Contract 2.5, bevor der Knoten entsteht, und geben ihn dann
 * an die Schreibflaeche. Titel, Fusszeile, Abbrechen und das Verhalten von
 * Escape stehen deshalb hier und nicht siebenmal.
 *
 * <p>Die Formulare selbst laufen ueber {@code react-hook-form} mit einem
 * {@code zod}-Schema aus {@code blockDialogs.schema.ts}
 * (Frontend-Regel 12); handgeschriebene Pruefungen daneben gibt es nicht.
 */

/**
 * Uebersetzt einen Fehler aus dem Formular.
 *
 * <p>Die zod-Schemata fuehren i18n-Schluessel als Meldung, keine Prosa; ein
 * Fehler vom Typ {@code server} traegt dagegen bereits den Text des
 * Envelopes (6.2) und wird nicht noch einmal durch die Uebersetzung
 * geschickt. Dieselbe Regel wie in den Auth-Formularen.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Der Hook gehoert zur Huelle: alle sieben Dialoge uebersetzen ihre Fehler nach derselben Regel.
export function useFieldMessage(): (
  error: RhfFieldError | undefined
) => string | undefined {
  const { t } = useTranslation()
  return (error) => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }
}

export function BlockDialogShell({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  onSubmit,
  submitDisabled = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey: string
  descriptionKey: string
  onSubmit: FormEventHandler<HTMLFormElement>
  submitDisabled?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-modal sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.action.cancel")}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {t("projectContent.dialogs.insert")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Die Unterschrift eines Medienblocks. Freiwillig in jedem Typ, der sie
 * kennt (2.5); sie beschreibt den Zusammenhang und ersetzt nie den
 * Alternativtext.
 */
export function CaptionField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Field className="gap-1.5">
      <FieldLabel
        htmlFor={id}
        className="type-label-xs text-muted-foreground uppercase"
      >
        {t("projectContent.dialogs.caption")}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <FieldDescription id={`${id}-hint`}>
        {t("projectContent.dialogs.captionHint")}
      </FieldDescription>
    </Field>
  )
}

/**
 * Alternativtext mit dem Haekchen „schmueckend".
 *
 * <p><strong>Zwei Faelle, und der Unterschied ist nicht kosmetisch.</strong>
 * Contract 2.5 liest ein leeres {@code alt} als die ausdrueckliche Aussage
 * „dieses Bild ist schmueckend"; ein fehlendes ist ein vergessener
 * Alternativtext, und den weist der Server ab. Das Formular bildet genau
 * diese zwei Faelle ab und laesst keinen dritten zu: entweder steht ein
 * Text da, oder das Haekchen ist gesetzt (SC 1.1.1).
 *
 * <p>Das Feld wird beim Setzen des Haekchens nicht geleert, sondern nur
 * gesperrt: wer sich anders entscheidet, findet seinen Text wieder.
 */
export function AltField({
  id,
  alt,
  decorative,
  error,
  onAltChange,
  onDecorativeChange,
}: {
  id: string
  alt: string
  decorative: boolean
  error?: string
  onAltChange: (value: string) => void
  onDecorativeChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Field data-invalid={error !== undefined} className="gap-1.5">
      <FieldLabel
        htmlFor={id}
        className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
      >
        {t("projectContent.dialogs.alt")}
      </FieldLabel>
      <Input
        id={id}
        value={alt}
        disabled={decorative}
        onChange={(event) => onAltChange(event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={
          error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`
        }
      />
      <FieldDescription id={`${id}-hint`}>
        {t("projectContent.dialogs.altHint")}
      </FieldDescription>
      <label className="type-body-sm flex items-center gap-2">
        <Checkbox
          checked={decorative}
          onCheckedChange={onDecorativeChange}
        />
        {t("projectContent.dialogs.altDecorative")}
      </label>
      {error !== undefined && (
        <FieldError id={`${id}-error`} errors={[{ message: error }]} />
      )}
    </Field>
  )
}
