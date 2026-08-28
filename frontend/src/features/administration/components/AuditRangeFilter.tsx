import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { adminUserQueries } from "@/api/queries/admin"
import type { Role, UserLookupResponse } from "@/api/types"
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
 * Das Protokoll fuehrt nur Handlungen der Administration (§3.17), die
 * Personensuche daneben also auch nur Admin-Konten.
 *
 * <p>Modulweit, weil {@code role} seit Contract v89 eine Liste ist
 * (KAN-87) und im Query-Key der Auswahlliste steht: ein frisches Array je
 * Render waere dort jedes Mal ein anderer Schluessel.
 */
const ADMIN_ONLY: readonly Role[] = ["ADMIN"]

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
 * <p><strong>Zur Auswahl stehen nur Admin-Konten.</strong> Seit Contract v72
 * sperrt die kuratierte Liste den einzigen Uebergang aus {@code PUBLISHED}
 * heraus: solange ein Projekt einen Platz belegt, weist der Server den Weg
 * nach {@code REVISION} mit 409 ab (§3.11.1). Damit kann die Redaktion einen
 * Platz nicht mehr freimachen, und alle vier Schreibwege des Protokolls
 * (§3.17) liegen bei der Administration. Nach einer Redakteur:in filtern zu
 * lassen hiesse, eine Auswahl anzubieten, die verlaesslich kein Ergebnis
 * liefert. Ältere Zeilen aus der Zeit vor v72 koennen eine Redakteur:in
 * tragen; sie sind ueber den Zeitraum erreichbar, nicht ueber die Person.
 *
 * <p><strong>Die gewaehlte Person steht sofort im Feld.</strong> Der Name
 * wird beim Auswaehlen mitgenommen und nicht erst nachgeladen. Ohne das
 * blieb das Feld leer, waehrend die Liste bereits gefiltert war: die
 * Combobox merkt sich ein leeres Eingabefeld als „bewusst geleert", und der
 * spaeter eintreffende Name kam dagegen nicht mehr an (Befund aus der
 * Nacharbeit an KAN-40).
 *
 * <p>Wer den Filter ueber die Adresse betritt, hat dagegen nur eine UUID;
 * den Namen dazu holt {@code GET /api/admin/users/{id}}, der einzige
 * Einzelabruf eines Kontos (§6.1).
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
  /* Die eben gewaehlte Person, damit ihr Name ohne Umweg ueber den Server
     im Feld steht. Beim Betreten ueber die Adresse ist sie null und der
     Abruf unten springt ein. */
  const [picked, setPicked] = useState<UserLookupResponse | null>(null)

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

  const resolved: UserLookupResponse | null =
    selected.data === undefined
      ? null
      : {
          id: selected.data.id,
          firstName: selected.data.firstName,
          lastName: selected.data.lastName,
        }

  /* Die eigene Wahl gewinnt, solange sie zur Adresse passt: sonst zeigte das
     Feld nach einem Zuruecksetzen noch den alten Namen. */
  const person = picked !== null && picked.id === state.admin ? picked : resolved

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
        role={ADMIN_ONLY}
        value={person}
        onChange={(next) => {
          setPicked(next)
          onChange({ admin: next?.id ?? null })
        }}
        placeholder={t("administration.top10.audit.personPlaceholder")}
      />

      {(state.from !== null || state.to !== null || state.admin !== null) && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset({ from: "", to: "" })
            setPicked(null)
            onChange({ from: null, to: null, admin: null })
          }}
        >
          {t("administration.top10.audit.reset")}
        </Button>
      )}
    </form>
  )
}
