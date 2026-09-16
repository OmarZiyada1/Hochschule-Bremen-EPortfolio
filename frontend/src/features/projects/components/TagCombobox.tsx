import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { XIcon } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { tagQueries } from "@/api/queries/tags"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { Tag } from "@/components/common/Tag"
import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/common/InfoHint"
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

/**
 * Obergrenze aus Contract §3.3: hoechstens fuenf Schlagwoerter je Projekt.
 * Der Server weist einen sechsten mit 400 VALIDATION_FAILED ab; diese Zahl
 * verhindert nur, dass die Anfrage ueberhaupt entsteht.
 */
export const MAX_TAGS = 5

/** Hoechstlaenge eines Schlagworts aus Contract §3.3. */
const MAX_TAG_LENGTH = 64

/**
 * Wartezeit vor der Suchanfrage, wie in der Projektbibliothek (KAN-64):
 * lang genug, dass ein durchgetipptes Wort einen Request kostet und nicht
 * einen je Zeichen.
 */
const SUGGEST_DEBOUNCE_MS = 300

/**
 * Die Normalform des Servers (§3.19, ProjectWriteService.applyTags und
 * MasterDataService.likePattern): getrimmt, innere Mehrfach-Leerzeichen
 * zusammengezogen.
 *
 * Sie steht hier, damit die Oberflaeche dieselbe Frage beantwortet wie der
 * Server: Ist dieses Wort schon gewaehlt? Waere die Antwort verschieden,
 * boete das Feld "hinzufuegen" fuer ein Wort an, das der Server auf ein
 * bereits gewaehltes abbildet, und die Auswahl bliebe danach unveraendert
 * stehen. Die Entscheidung faellt weiterhin am Server, nicht hier: dies ist
 * eine Vorschau darauf, keine zweite Regel.
 */
function normalized(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

/**
 * Vergleich ohne Ruecksicht auf Gross- und Kleinschreibung, wie lower(name).
 *
 * Bewusst toLowerCase und nicht toLocaleLowerCase: die Sprache des Browsers
 * soll nicht mitentscheiden, ob ein Wort als schon gewaehlt gilt. Im
 * Tuerkischen bildete toLocaleLowerCase "I" auf "ı" ab, die Datenbank mit
 * ihrem lower() nicht, und die Vorschau liefe an genau dieser Stelle vom
 * Server weg.
 */
function comparable(name: string): string {
  return normalized(name).toLowerCase()
}

/**
 * Auswahlfeld fuer Schlagwoerter (§3.19, KAN-75): eine Combobox, die
 * vorhandene Woerter vorschlaegt und ein unbekanntes ausdruecklich zum
 * Anlegen anbietet.
 *
 * <strong>Sie kennt kein Projekt und setzt keine Mutation ab.</strong> Sie
 * bekommt die gewaehlten Namen und meldet jede Aenderung als vollstaendige
 * neue Liste; gespeichert wird im Formular darum (KAN-35). Damit gibt es
 * genau einen Schreibweg, und der laeuft ueber PUT /api/projects/{id} mit
 * seiner Versionspruefung. Eine eigene Mutation hier umginge sie.
 *
 * <strong>Vorgeschlagen wird serverseitig, nicht im Browser.</strong> Die
 * Zahl der Schlagwoerter waechst mit jedem Projekt; eine vollstaendige
 * Liste zu laden und darin zu filtern waere in einem Jahr weder schnell
 * noch vollstaendig. Deshalb liefert GET /api/tags die haeufigsten und
 * verfeinert ueber q, und die eingebaute Filterung der Primitive ist mit
 * filter={null} abgeschaltet: zweimal zu filtern hiesse, Treffer wieder
 * auszublenden, die der Server gerade gefunden hat.
 *
 * <strong>items traegt den Anlege-Eintrag mit.</strong> Base UI leitet aus
 * items nicht nur die Filterung ab, sondern auch die Navigationsliste und
 * den Leerzustand: ein nur im DOM stehender Eintrag waere mit der Tastatur
 * nicht erreichbar (SC 2.1.1), und ComboboxEmpty meldete "kein Treffer"
 * ueber einem waehlbaren Eintrag. Deshalb steht das getippte Wort in items
 * und nicht bloss in der Liste (Befund des frontend-reviewers).
 *
 * Barrierefreiheit: Rollen, aria-expanded, aria-controls,
 * aria-activedescendant und die Tastaturbedienung bringt die Primitive aus
 * Base UI mit (Frontend-Regel 11). Von Hand kommen der zugaengliche Name
 * je Entfernen-Schaltflaeche (SC 4.1.2) und die Live-Region fuer die
 * erreichte Obergrenze (SC 4.1.3).
 */
export function TagCombobox({
  value,
  onChange,
  id,
  label,
  disabled = false,
  className,
}: {
  value: string[]
  onChange: (next: string[]) => void
  id?: string
  label?: string
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)

  const limitReached = value.length >= MAX_TAGS

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SUGGEST_DEBOUNCE_MS
    )
    return () => clearTimeout(handle)
  }, [query])

  /*
   * Bei erreichter Obergrenze geht kein Request hinaus: das Feld nimmt
   * ohnehin nichts mehr an, und eine Liste zu laden, aus der nichts
   * waehlbar ist, waere eine Anfrage ohne Zweck (Ticket KAN-75).
   *
   * Das Feld selbst bleibt trotzdem bedienbar. Es abzuschalten nimmt dem
   * Browser das fokussierte Element unter den Fingern weg: wer den fuenften
   * Tag mit der Tastatur waehlt, staende danach auf document.body und finge
   * am Seitenanfang von vorn an (Befund des frontend-reviewers).
   */
  const suggestions = useQuery({
    ...tagQueries.suggestions(debouncedQuery),
    enabled: !disabled && !limitReached,
    // Ohne das leert sich die Liste bei jedem neuen q und zeigt kurz den
    // Ladezustand; mit ihm bleibt die vorige Auswahl stehen, bis die neue da
    // ist.
    placeholderData: keepPreviousData,
  })

  const chosen = useMemo(() => new Set(value.map(comparable)), [value])

  /*
   * name ist im generierten Typ optional, weil springdoc kein Feld als
   * required markiert (siehe api/types.ts). Der Server schickt es immer;
   * die Einschraenkung steht hier trotzdem, damit der Rest ohne Fragezeichen
   * auskommt und kein "undefined" in einer Beschriftung landet.
   */
  const options = useMemo(
    () =>
      (suggestions.data ?? [])
        .flatMap((tag) => (tag.name === undefined ? [] : [tag.name]))
        .filter((name) => !chosen.has(comparable(name))),
    [suggestions.data, chosen]
  )

  const typed = normalized(query)

  /*
   * Laesst sich das Getippte ueberhaupt aufnehmen? Die Frage ist nicht
   * dieselbe wie „gehoert ein Anlege-Eintrag in die Liste": ein Wort, das
   * genauso schon als Vorschlag dasteht, ist aufnehmbar, aber nicht neu
   * anzulegen. Die Eingabetaste braucht die erste Fassung, die Liste die
   * zweite.
   */
  const addableTyped =
    !limitReached &&
    typed !== "" &&
    typed.length <= MAX_TAG_LENGTH &&
    !chosen.has(comparable(typed))

  const creatable =
    addableTyped &&
    !options.some((name) => comparable(name) === comparable(typed))

  const items = useMemo(
    () => (creatable ? [...options, typed] : options),
    [options, creatable, typed]
  )

  function add(name: string) {
    const next = normalized(name)
    if (next === "" || chosen.has(comparable(next)) || limitReached) {
      return
    }
    onChange([...value, next])
    setQuery("")
    setDebouncedQuery("")
    setOpen(false)
  }

  function remove(name: string) {
    onChange(value.filter((entry) => entry !== name))
  }

  /*
   * Der Leerzustand der Primitive ist zugleich eine Live-Region. Er darf
   * deshalb nicht "kein Treffer" sagen, wenn es gar nicht am Suchbegriff
   * liegt: bei erreichter Obergrenze fragt das Feld nicht einmal nach.
   */
  const emptyMessage = limitReached
    ? t("project.tags.limitReached", { max: MAX_TAGS })
    : suggestions.isPending
      ? t("project.tags.loading")
      : t("project.tags.empty")

  return (
    <Field className={className}>
      <div className="flex items-center gap-1">
        <FieldLabel
          htmlFor={inputId}
          className="type-label-xs text-muted-foreground uppercase"
        >
          {label ?? t("project.tags.label")}
        </FieldLabel>
        {/* Die Obergrenze hinter einem „i": sie gilt immer und aendert sich
            nie, stand aber als eigene Zeile unter jedem Feld. Erreicht ist
            sie dagegen eine Nachricht und bleibt sichtbar (unten). */}
        <InfoHint
          label={t("project.tags.maxLabel")}
          text={t("project.tags.max", { max: MAX_TAGS })}
          descriptionId={hintId}
        />
      </div>

      <Combobox
        items={items}
        /* Der Server hat bereits gefiltert, siehe Kommentar an der Komponente. */
        filter={null}
        value={null}
        onValueChange={(picked) => {
          if (typeof picked === "string") {
            add(picked)
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
          /* Dieselbe Hoehe wie Personensuche und Auswahlfelder. InputGroup
             steht auf h-8, und ohne diese Zeile sass das Schlagwortfeld
             sichtbar niedriger als jedes andere Feld daneben. Gesetzt wie
             in der PersonCombobox. */
          className="h-11"
          aria-describedby={hintId}
          disabled={disabled}
          placeholder={t("project.tags.placeholder")}
          onKeyDown={(event) => {
            /*
             * Die Eingabetaste nimmt auf, statt das Formular abzuschicken.
             *
             * <p>Base UI laesst die implizite Absendung ausdruecklich zu,
             * solange kein Vorschlag hervorgehoben ist („Allow form
             * submission when no item is highlighted", ComboboxInput). Im
             * Metadatenformular hiess das: wer ein Schlagwort tippt und
             * Enter drueckt, loest „Speichern & weiter zum Editor" aus, und
             * das Getippte ist weg, ohne je aufgenommen worden zu sein.
             * Derselbe Befund wie am Rollenfeld der Projektmitglieder.
             *
             * <p>Ein hervorgehobener Vorschlag gehoert dagegen der
             * Primitive: sie waehlt ihn und unterdrueckt die Absendung
             * dabei selbst. Erkennbar ist er an aria-activedescendant, das
             * die virtuelle Fokusfuehrung am Eingabefeld setzt.
             *
             * <p>Ist nichts aufzunehmen (leeres Feld, Obergrenze erreicht,
             * Schlagwort steht schon da), bleibt es bei der Absendung:
             * ein Enter, das gar nichts tut, waere die schlechtere Antwort.
             */
            if (event.key !== "Enter") {
              return
            }
            if (event.currentTarget.getAttribute("aria-activedescendant")) {
              return
            }
            if (!addableTyped) {
              return
            }
            event.preventDefault()
            /* Steht dasselbe Wort schon als Vorschlag da, wird dessen
               Schreibweise aufgenommen und nicht die getippte. */
            const exact = options.find(
              (name) => comparable(name) === comparable(typed)
            )
            add(exact ?? typed)
          }}
        />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
            {options.map((name) => (
              <ComboboxItem key={name} value={name}>
                {name}
              </ComboboxItem>
            ))}
            {creatable && (
              <ComboboxItem value={typed}>
                {t("project.tags.create", { name: typed })}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {suggestions.isError && (
        <FieldError>{apiMessage(suggestions.error)}</FieldError>
      )}

      {/*
       * Sichtbar und zugleich Live-Region: Wer die Obergrenze erreicht,
       * soll den Grund lesen koennen und nicht nur ein Feld vorfinden, das
       * nichts mehr annimmt (SC 4.1.3, Ticket KAN-75).
       *
       * <p>Immer gerendert und nicht bedingt: eine Live-Region, die erst
       * mit ihrer Nachricht entsteht, sagt sie nicht zuverlaessig an.
       * {@code empty:hidden} nimmt ihr dafuer den Platz, solange sie
       * schweigt.
       */}
      <FieldDescription aria-live="polite" className="empty:hidden">
        {limitReached ? t("project.tags.limitReached", { max: MAX_TAGS }) : ""}
      </FieldDescription>

      {/*
       * Die Trefferzahl gehoert angesagt, aber nicht gedruckt: sie steht
       * sichtbar bereits als Liste da (SC 4.1.3, Ticket KAN-75). Gezaehlt
       * wird items und nicht options, damit der Anlege-Eintrag mitzaehlt.
       * Sie schweigt bei erreichter Obergrenze, weil dann die Meldung
       * darueber gilt und zwei Live-Regionen sonst gleichzeitig sprechen.
       */}
      <p aria-live="polite" className="sr-only">
        {open && !disabled && !limitReached
          ? t("project.tags.hits", { count: items.length })
          : ""}
      </p>

      {value.length > 0 && (
        <ul
          /*
           * role="list" ausdruecklich: Tailwinds Preflight setzt
           * list-style: none, und Safari mit VoiceOver verwirft dann die
           * Listensemantik samt aria-label.
           */
          role="list"
          className="flex flex-wrap gap-2"
          aria-label={t("project.tags.selected")}
        >
          {value.map((name) => (
            <li key={name}>
              {/*
               * h-auto und overflow-visible heben zwei Grundklassen des
               * Badge auf (h-5 = 20px, overflow-hidden). Ohne sie schnitte
               * die Pille den Fokusring der Entfernen-Schaltflaeche weg und
               * beschnitte ihre Trefferflaeche auf 24 mal 20 Pixel
               * (SC 2.4.7, SC 2.5.8; Befund des frontend-reviewers). Der
               * Eingriff steht hier an der Verwendungsstelle und nicht in
               * der erzeugten Datei.
               */}
              <Tag className="h-auto items-center gap-1 overflow-visible py-0.5 pr-0.5">
                <span>{name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={t("project.tags.remove", { name })}
                  onClick={() => remove(name)}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </Tag>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}
