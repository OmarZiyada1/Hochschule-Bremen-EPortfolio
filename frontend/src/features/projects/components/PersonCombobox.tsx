import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEffect, useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { userQueries } from "@/api/queries/users"
import type { Role, UserLookupResponse } from "@/api/types"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Wartezeit vor der Suchanfrage, wie bei der TagCombobox (KAN-75) und in
 * der Projektbibliothek (KAN-64): lang genug, dass ein durchgetippter Name
 * einen Request kostet und nicht einen je Zeichen.
 */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Auswahlfeld fuer eine Person aus {@code GET /api/users/lookup} (§6.1,
 * KAN-35): tippen, aus der Vorschlagsliste waehlen, fertig.
 *
 * <p><strong>Sie waehlt genau eine Person und behaelt keine.</strong> Nach
 * der Wahl meldet sie die Person nach oben und leert sich wieder. Wer eine
 * Mehrfachauswahl braucht, sammelt darueber: die Redaktionszuweisung
 * ({@code ProjectEditorsField}) legt Pillen darunter, die Mitgliederliste
 * ({@code ProjectMembersField}) eine Zeile je Person. So gibt es ein
 * Suchfeld fuer beide Faelle statt zweier fast gleicher.
 *
 * <p><strong>Gesucht wird serverseitig, nicht im Browser.</strong> Die Zahl
 * der Konten waechst mit jedem Semester; eine vollstaendige Liste zu laden
 * und darin zu filtern waere weder schnell noch vollstaendig. Die
 * eingebaute Filterung der Primitive ist mit {@code filter={null}}
 * abgeschaltet: zweimal zu filtern hiesse, Treffer wieder auszublenden, die
 * der Server gerade gefunden hat.
 *
 * <p><strong>Die Antwort traegt keine Adressen</strong>, und diese
 * Komponente zeigt deshalb auch keine an. Genau dafuer gibt es den
 * Endpoint: {@code AdminUserResponse} fuehrt {@code hsbEmail} und scheidet
 * als Quelle aus (§3.1). Unterscheiden lassen sich Namensgleiche hier
 * folglich nicht; das ist die bewusste Gegenleistung fuer die Zusage, dass
 * die Adressen den Server nicht verlassen.
 *
 * <p><strong>{@code q} sucht ueber Vor- und Nachname</strong> (§6.1), nicht
 * ueber Adressen. Das Feld ist entsprechend beschriftet, damit niemand eine
 * Adresse eintippt und aus einem leeren Ergebnis schliesst, das Konto gebe
 * es nicht.
 *
 * <p>Barrierefreiheit: Rollen, {@code aria-expanded},
 * {@code aria-activedescendant} und die Tastaturbedienung bringt die
 * Primitive aus Base UI mit (Frontend-Regel 11). Von Hand kommt die
 * Live-Region fuer die Trefferzahl (SC 4.1.3).
 */
export function PersonCombobox({
  label,
  labelSuffix,
  onSelect,
  id,
  role,
  excludedIds,
  placeholder,
  description,
  labelHidden = false,
  disabled = false,
  className,
}: {
  label: string
  /**
   * Zusatz hinter der Beschriftung, etwa die Kennzeichnung "erforderlich
   * zum Einreichen". Er gehoert in das Label und nicht daneben, sonst
   * traegt ihn der zugaengliche Name des Feldes nicht (SC 3.3.2).
   */
  labelSuffix?: ReactNode
  /** Meldet die gewaehlte Person; das Feld leert sich danach selbst. */
  onSelect: (person: UserLookupResponse) => void
  id?: string
  /** Rollenfilter, etwa {@code EDITOR} fuer die Redaktion. Ohne ihn alle Rollen. */
  role?: Role
  /**
   * Konten, die nicht zur Auswahl stehen: die bereits Gewaehlten, die
   * eigene Person, die Autor:in. Ausgeblendet statt gesperrt, denn ein
   * gesperrter Eintrag in einer Vorschlagsliste erklaert sich nicht selbst.
   */
  excludedIds?: readonly string[]
  placeholder?: string
  description?: string
  labelHidden?: boolean
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(handle)
  }, [query])

  const results = useQuery({
    ...userQueries.lookup({ role, q: debouncedQuery }),
    enabled: !disabled,
    /* Ohne das leert sich die Liste bei jedem neuen q und zeigt kurz den
       Ladezustand; mit ihm bleibt die vorige Auswahl stehen, bis die neue
       da ist. */
    placeholderData: keepPreviousData,
  })

  const excluded = useMemo(() => new Set(excludedIds ?? []), [excludedIds])

  const items = useMemo(
    () => (results.data ?? []).filter((person) => !excluded.has(person.id)),
    [results.data, excluded]
  )

  /*
   * Der Leerzustand der Primitive ist zugleich eine Live-Region. Er darf
   * deshalb nicht "kein Treffer" sagen, solange noch gesucht wird.
   */
  const emptyMessage = results.isPending
    ? t("project.people.loading")
    : t("project.people.empty")

  return (
    <Field className={className}>
      <FieldLabel htmlFor={inputId} className={cn(labelHidden && "sr-only")}>
        {label}
        {labelSuffix}
      </FieldLabel>

      <Combobox
        items={items}
        /* Der Server hat bereits gefiltert, siehe Kommentar an der Komponente. */
        filter={null}
        itemToStringLabel={(person: UserLookupResponse) => fullNameOf(person)}
        value={null}
        onValueChange={(picked) => {
          if (picked !== null && typeof picked === "object") {
            onSelect(picked as UserLookupResponse)
            setQuery("")
            setDebouncedQuery("")
            setOpen(false)
          }
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
      >
        <ComboboxInput
          id={inputId}
          aria-describedby={
            description === undefined ? undefined : descriptionId
          }
          disabled={disabled}
          placeholder={placeholder ?? t("project.people.placeholder")}
        />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
            {items.map((person) => (
              <ComboboxItem key={person.id} value={person}>
                {fullNameOf(person)}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {results.isError && (
        <FieldError>
          {isApiError(results.error)
            ? t(apiErrorMessageKey(results.error), {
                defaultValue: results.error.message,
              })
            : t("apiError.INTERNAL_ERROR")}
        </FieldError>
      )}

      {description !== undefined && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}

      {/*
       * Die Trefferzahl gehoert angesagt, aber nicht gedruckt: sie steht
       * sichtbar bereits als Liste da (SC 4.1.3), wie bei der TagCombobox.
       */}
      <p aria-live="polite" className="sr-only">
        {open && !disabled
          ? t("project.people.hits", { count: items.length })
          : ""}
      </p>
    </Field>
  )
}
