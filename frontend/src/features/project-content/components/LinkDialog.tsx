import { zodResolver } from "@hookform/resolvers/zod"
import type { Editor } from "@tiptap/react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isSafeHref } from "@/features/project-content/blockSanitize"

/**
 * Der Link der Auswahlleiste (Contract 2.5).
 *
 * <p><strong>Drei Schemata und keines mehr:</strong> {@code http},
 * {@code https} und {@code mailto}. Geprueft wird ueber dieselbe Funktion
 * wie im Lesepfad und im Schema, damit es keine zweite, abweichende Liste
 * gibt; verbindlich bleibt der Server mit 400
 * {@code BLOCK_CONTENT_INVALID}. Ein {@code javascript:}-Link liefe nach
 * einem gewoehnlichen Klick im Ursprung des Portals, mit der Sitzung der
 * klickenden Person.
 *
 * <p>Die Pruefung laeuft ueber {@code zod} mit {@code react-hook-form}
 * (Frontend-Regel 12); handgeschriebene Validierung daneben gibt es nicht.
 *
 * <p>Der Dialog ist gesteuert und ohne eigenen Auslöser, weil die
 * Schaltflaeche in der Leiste sitzt. Der Fokus geht beim Schliessen an sie
 * zurueck (SC 2.4.3); dafuer sorgt die aufrufende Leiste.
 */
export function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  const schema = z.object({
    href: z
      .string()
      .trim()
      .min(1, { message: t("projectContent.link.required") })
      .refine(isSafeHref, { message: t("projectContent.link.invalid") }),
  })

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { href: "" },
  })

  /* Beim Oeffnen den bestehenden Link uebernehmen: wer eine Adresse
     korrigieren will, soll sie nicht neu tippen muessen. */
  const current = (editor.getAttributes("link").href as string | undefined) ?? ""
  useEffect(() => {
    if (open) {
      form.reset({ href: current })
    }
    /* form.reset ist stabil; current soll nur beim Oeffnen gelesen werden. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const apply = ({ href }: z.infer<typeof schema>) => {
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: href.trim() })
      .run()
    onOpenChange(false)
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-modal">
        <form onSubmit={form.handleSubmit(apply)}>
          <DialogHeader>
            <DialogTitle>{t("projectContent.link.title")}</DialogTitle>
            <DialogDescription>
              {t("projectContent.link.description")}
            </DialogDescription>
          </DialogHeader>

          <Field className="py-4">
            <FieldLabel htmlFor="project-content-link-href">
              {t("projectContent.link.label")}
            </FieldLabel>
            <Input
              id="project-content-link-href"
              autoFocus
              placeholder="https://"
              aria-invalid={form.formState.errors.href !== undefined}
              {...form.register("href")}
            />
            {form.formState.errors.href !== undefined && (
              <FieldError>{form.formState.errors.href.message}</FieldError>
            )}
          </Field>

          <DialogFooter>
            {current !== "" && (
              <Button type="button" variant="ghost" onClick={remove}>
                {t("projectContent.link.remove")}
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("common.action.cancel")}
            </DialogClose>
            <Button type="submit">{t("projectContent.link.apply")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
