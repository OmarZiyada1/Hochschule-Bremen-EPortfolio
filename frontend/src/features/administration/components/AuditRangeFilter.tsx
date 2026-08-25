import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { adminUserQueries } from "@/api/queries/admin"
import type { UserLookupResponse } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { AdminTop10AuditState } from "@/features/administration/adminTop10Filters"
import {
  auditRangeSchema,
  type AuditRangeFormValues,
} from "@/features/administration/components/AuditRangeFilter.schema"
import { PersonCombobox } from "@/features/projects/components/PersonCombobox"

/**
 * Der Filter des Top-10-Protokolls (§6.1, KAN-40): Zeitraum und Person.
 *
 * <p><strong>Der Zeitraum ist ein Formular, die Person nicht.</strong> Die
 * beiden Datumsfelder haengen voneinander ab: {@code from} nach {@code to}
 * ergibt serverseitig 400 {@code VALIDATION_FAILED}, und das ist ein
 * Eingabefehler und kein leeres Ergebnis. Sie brauchen deshalb ein
 * zod-Schema und einen ausdruecklichen Absendeschritt (Frontend-Regel 12).
 * Die Personenwahl hat keine solche Bedingung und wirkt sofort.
 *
 * <p><strong>Gewaehlt wird ein Tag, geschickt ein Zeitpunkt.</strong> In der
 * Adresse steht {@code JJJJ-MM-TT}; die Tagesgrenzen bildet
 * {@code auditQueryOf} daraus, in der Zeitzone der lesenden Person, und
 * beide Grenzen sind eingeschlossen (§1, §6.1). Ein Bereich bis heute
 * schliesst den heutigen Tag damit vollstaendig ein.
 *
 * <p><strong>Zwei {@code input type="date"} und kein eigener
 * Kalenderaufsatz.</strong> Das Eingabefeld kommt aus der Registry
 * ({@code input}), bringt die Tastaturbedienung und die landesuebliche
 * Schreibweise vom Browser mit und braucht keine zweite Ebene. Die
 * Primitive {@code calendar} waere ein Aufsatz darum herum, mit eigener
 * Fokusfuehrung und eigenem Zustand, ohne dass die Auswahl dadurch etwas
 * koennte, was sie hier nicht schon kann.
 *
 * <p><strong>Die Person kommt aus der Personensuche.</strong> Wer den Filter
 * ueber die Adresse betritt, hat nur eine UUID; den Namen dazu holt diese
 * Komponente ueber {@code GET /api/admin/users/{id}}, den einzigen
 * Einzelabruf eines Kontos (§6.1). Ohne ihn stuende im Feld eine leere
 * Zeile, waehrend die Liste gefiltert waere.
 */
export function AuditRangeFilter({
  state,
  onChange,
}: {
  state: AdminTop10AuditState
  onChange: (change: Partial<AdminTop10AuditState>) => void
}) {
  const { t } = useTranslation()
  const fromId = useId()
  const toId = useId()

  const defaults: AuditRangeFormValues = {
    from: state.from ?? "",
    to: state.to ?? "",
  }

  const form = useForm<AuditRangeFormValues>({
    resolver: zodResolver(auditRangeSchema),
    defaultValues: defaults,
    values: defaults,
  })

  /* Nur wenn die Adresse eine Person nennt: ein Abruf auf Vorrat waere ein
     Request fuer ein Feld, das niemand ausgefuellt hat. */
  const selected = useQuery({
    ...adminUserQueries.detail(state.admin ?? ""),
    enabled: state.admin !== null,
  })

  const person: UserLookupResponse | null =
    selected.data === undefined
      ? null
      : {
          id: selected.data.id,
          firstName: selected.data.firstName,
          lastName: selected.data.lastName,
        }

  const submit = form.handleSubmit((values) => {
    onChange({
      from: values.from === "" ? null : values.from,
      to: values.to === "" ? null : values.to,
    })
  })

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <Controller
        name="from"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2 sm:w-44">
            <FieldLabel
              htmlFor={fromId}
              className="type-label-xs text-muted-foreground uppercase"
            >
              {t("administration.top10.audit.from")}
            </FieldLabel>
            <Input
              id={fromId}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <FieldError>{t(fieldState.error?.message ?? "")}</FieldError>
            )}
          </Field>
        )}
      />

      <Controller
        name="to"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-2 sm:w-44">
            <FieldLabel
              htmlFor={toId}
              className="type-label-xs text-muted-foreground uppercase"
            >
              {t("administration.top10.audit.to")}
            </FieldLabel>
            <Input
              id={toId}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <FieldError>{t(fieldState.error?.message ?? "")}</FieldError>
            )}
          </Field>
        )}
      />

      <Button type="submit">
        {t("administration.top10.audit.applyRange")}
      </Button>

      <PersonCombobox
        className="sm:w-64"
        label={t("administration.top10.audit.person")}
        value={person}
        onChange={(next) => onChange({ admin: next?.id ?? null })}
        placeholder={t("administration.top10.audit.personPlaceholder")}
      />

      {(state.from !== null || state.to !== null || state.admin !== null) && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset({ from: "", to: "" })
            onChange({ from: null, to: null, admin: null })
          }}
        >
          {t("administration.top10.audit.reset")}
        </Button>
      )}
    </form>
  )
}
