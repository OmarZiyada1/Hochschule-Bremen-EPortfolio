import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { fullNameOf } from "@/lib/name"

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
 * <p><strong>Gesteuert ueber {@code value} und {@code onChange}</strong>,
 * und daran haengt das sichtbare Verhalten. Bleibt {@code value} nach der
 * Wahl gesetzt, steht der Name im Feld stehen (Mitgliederzeile). Setzt der
 * Aufrufer ihn sofort wieder auf {@code null}, leert sich das Feld und die
 * Person wandert in eine Liste daneben (Redaktionszuweisung). Es gibt
 * deshalb nur eine Betriebsart und keinen Schalter dafuer.
 *
 * <p><strong>Der getippte Text ueberlagert den Namen, statt ihn zu
 * ersetzen.</strong> Angezeigt wird {@code typed ?? Name(value)}: solange
 * niemand tippt, steht die gewaehlte Person da; sobald jemand tippt, sucht
 * das Feld. Ohne diese Trennung braeuchte es einen Effekt, der den
 * Eingabewert nachzieht, und der liefe dem Tippen hinterher. Der leere
 * Eingabewert, den die Primitive nach einer Wahl nachschickt, wird dabei
 * verschluckt (siehe {@code swallowEmptyEcho}); er ist kein Tippen.
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
 * als Quelle aus (§3.1). Namensgleiche lassen sich hier folglich nicht
 * unterscheiden; das ist die bewusste Gegenleistung dafuer, dass die
 * Adressen den Server nicht verlassen.
 *
 * <p>Barrierefreiheit: Rollen, {@code aria-expanded},
 * {@code aria-activedescendant} und die Tastaturbedienung bringt die
 * Primitive aus Base UI mit (Frontend-Regel 11).
 */
export function PersonCombobox({
  label,
  labelSuffix,
  value,
  onChange,
  id,
  role,
  excludedIds,
  placeholder,
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: {
  label: string
  /** Zusatz hinter der Beschriftung, etwa die Pflichtkennzeichnung. */
  labelSuffix?: ReactNode
  /** Die gewaehlte Person, oder {@code null} fuer "keine". */
  value: UserLookupResponse | null
  onChange: (person: UserLookupResponse | null) => void
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
  disabled?: boolean
  /** Setzt {@code aria-invalid} am Eingabefeld, wie bei jedem anderen Feld. */
  invalid?: boolean
  /**
   * ID der Fehlermeldung, die zu diesem Feld gehoert. Ohne sie steht die
   * Meldung zwar als Live-Region da, ist aber beim Zuruecknavigieren zum
   * Feld nicht mehr auffindbar (SC 3.3.1).
   */
  describedBy?: string
  className?: string
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputId = id ?? generatedId

  /* null heisst "es wurde nichts getippt"; dann zeigt das Feld die gewaehlte
     Person. Ein leerer String ist etwas anderes: bewusst geleert. */
  const [typed, setTyped] = useState<string | null>(null)
  /*
   * Nach einer Wahl gleicht die Primitive ihr Eingabefeld selbst ab und
   * meldet dabei zwei Werte nach: erst die Beschriftung des gewaehlten
   * Eintrags, dann eine leere Zeichenkette. Beides geschieht noch im selben
   * Durchlauf, also mit dem alten value, und beides ist kein Tippen.
   *
   * Uebernommen werden darf vor allem der leere Wert nicht: typed merkte
   * sich sonst "bewusst geleert", und der Name der gewaehlten Person kaeme
   * nie wieder zum Vorschein.
   *
   * Sichtbar wurde das erst am Protokollfilter der Top-10 (Nacharbeit zu
   * KAN-40). Die beiden aelteren Verwendungen setzen value nach der Wahl
   * sofort wieder auf null; dort ist ein leeres Feld ohnehin richtig, und
   * der Fehler blieb verborgen.
   *
   * Die Marke wird beim Waehlen gesetzt und im Effekt unten geloescht, der
   * nach jedem Commit laeuft. Sie deckt damit genau die Nachmeldungen ab,
   * die noch zum Klick gehoeren, und nichts danach. Ein ref und kein
   * Zustand: sie soll kein erneutes Rendern ausloesen.
   */
  const syncingAfterPick = useRef(false)
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)

  const inputValue = typed ?? (value === null ? "" : fullNameOf(value))

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedQuery((typed ?? "").trim()),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(handle)
  }, [typed])

  /* Laeuft nach jedem Commit und beendet damit das Fenster, in dem die
     Nachmeldungen der Primitive zum Klick gehoeren. Ohne Abhaengigkeitsliste
     mit Absicht: gemeint ist "nach diesem Durchlauf", nicht "wenn sich x
     aendert". */
  useEffect(() => {
    syncingAfterPick.current = false
  })

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
      <FieldLabel
        htmlFor={inputId}
        className="type-label-xs text-muted-foreground uppercase"
      >
        {label}
        {labelSuffix}
      </FieldLabel>

      <Combobox
        items={items}
        /* Der Server hat bereits gefiltert, siehe Kommentar an der Komponente. */
        filter={null}
        itemToStringLabel={(person: UserLookupResponse) => fullNameOf(person)}
        value={value}
        onValueChange={(picked) => {
          /* typed zuruecksetzen: ab jetzt zeigt das Feld wieder den Namen
             der gewaehlten Person, beziehungsweise nichts. */
          syncingAfterPick.current = true
          setTyped(null)
          setDebouncedQuery("")
          setOpen(false)
          onChange(
            picked !== null && typeof picked === "object"
              ? (picked as UserLookupResponse)
              : null
          )
        }}
        inputValue={inputValue}
        onInputValueChange={(next) => {
          if (syncingAfterPick.current) {
            return
          }
          setTyped(next)
        }}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
      >
        <ComboboxInput
          id={inputId}
          className="h-11"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          /* Erst wenn eine Person feststeht: sonst stuende ein Kreuz an
             einem leeren Feld. */
          showClear={value !== null}
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
