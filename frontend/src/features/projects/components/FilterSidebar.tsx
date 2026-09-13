import type { UseQueryResult } from "@tanstack/react-query"
import { RotateCcwIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { StudyProgramResponse } from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CountBadge } from "@/components/common/CountBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useFilterOptions } from "@/features/projects/hooks/useFilterOptions"
import {
  activeFilterCount,
  emptyFilterSelection,
  FILTER_DEGREES,
  FILTER_KEYS,
  FILTER_PROJECT_TYPES,
  toggleValue,
  type ProjectFilterSelection,
} from "@/features/projects/projectFilters"

type FilterGroupKey = (typeof FILTER_KEYS)[number]

/**
 * Die Gruppe, die offen steht, wenn keine Auswahl etwas anderes verlangt.
 *
 * <p>Seit KAN-80 ist immer genau eine Gruppe offen (Akkordeon), und die erste
 * des Templates ist die naheliegende: Die Fakultaet ist der Einstieg in die
 * Hierarchie, und der Studiengang darunter richtet sich nach ihr.
 */
const DEFAULT_OPEN_GROUP: FilterGroupKey = "faculty"

/**
 * Schraenkt die Studiengang-Optionen auf die gewaehlten Fakultaeten ein
 * (Ticket KAN-64); ohne Fakultaetsauswahl gibt es nichts einzuschraenken
 * und alle Studiengaenge bleiben sichtbar (Klaerungsrunde).
 */
function programsOfFaculties(
  programs: readonly StudyProgramResponse[],
  facultyIds: readonly string[]
): StudyProgramResponse[] {
  if (facultyIds.length === 0) {
    return [...programs]
  }
  return programs.filter(
    (program) =>
      program.facultyId !== undefined && facultyIds.includes(program.facultyId)
  )
}

/**
 * Filter-Seitenleiste der Projektbibliothek nach Template "Projekte
 * (Oeffentlich)" (KAN-64, ersetzt den Kommt-bald-Rahmen aus KAN-31):
 * aufklappbare Gruppen mit Checkbox-Mehrfachauswahl. Werte innerhalb einer
 * Gruppe sind ODER-verknuepft, Gruppen untereinander UND-verknuepft
 * (Contract §6.1, v43).
 *
 * Die Auswahl gehoert der Seite: sie liest sie aus der URL und schreibt
 * sie dorthin zurueck; die Seitenleiste meldet jede Aenderung als ganzes
 * Auswahlobjekt. Die Abwahl einer Fakultaet entfernt dabei die gewaehlten
 * Studiengaenge, die dadurch aus der Optionsliste verschwinden: es filtert
 * nie ein Wert, den die Seitenleiste nicht mehr anzeigt (Klaerungsrunde).
 * Die Zusage gilt fuer Aenderungen ueber die Seitenleiste; eine von Hand
 * geschriebene URL wie ?faculty=A&studyProgram=P mit fremdem P filtert
 * weiter (der Server beantwortet sie ohnehin, §6.1), die URL wird beim
 * Laden bewusst nicht umgeschrieben: ein geteilter Link bleibt, was er
 * ist, und die Historie bekommt keinen stillen Ersatz-Eintrag.
 *
 * <p><strong>Drei Aenderungen aus KAN-80.</strong>
 *
 * <p>Erstens ist immer <em>genau eine</em> Gruppe offen: Wer eine aufklappt,
 * schliesst die vorige. Bis dahin standen vier der sechs Gruppen gleichzeitig
 * offen, und die Leiste war laenger als das Fenster. Deshalb steht hier jetzt
 * das Akkordeon aus der Registry und nicht mehr eine Reihe einzelner
 * Aufklapper: „nur eines offen" ist eine Aussage ueber die Gruppe und nicht
 * ueber ein Glied, und die Primitive fuehrt sie samt Pfeiltastenbedienung.
 *
 * <p>Zweitens zaehlt jede Gruppe ihre gesetzten Werte, offen wie zugeklappt.
 * Zugeklappt war sonst nicht zu sehen, dass ein Filter wirkt, und die
 * Trefferliste sah aus wie ein Fehler.
 *
 * <p>Drittens gibt es oben rechts einen Weg zurueck auf null, mit der Zahl
 * aller gesetzten Werte. Er erscheint erst, sobald etwas gesetzt ist: eine
 * Schaltflaeche, die nichts zuruecksetzen kann, ist nur Platz und
 * Tabstopp. Sie raeumt allein die Filtergruppen; der Suchbegriff daneben
 * gehoert dem Suchfeld und bleibt stehen.
 */
export function FilterSidebar({
  selection,
  onSelectionChange,
}: {
  selection: ProjectFilterSelection
  onSelectionChange: (selection: ProjectFilterSelection) => void
}) {
  const { t } = useTranslation()
  const { faculties, studyPrograms, categories, semesters } = useFilterOptions()

  const activeCount = activeFilterCount(selection)

  /*
   * Beim ersten Rendern steht die Gruppe offen, in der bereits etwas
   * ausgewaehlt ist; sonst die Vorgabe. Ein Reload versteckte sonst die
   * wirksame Filterung. Nur die erste: mehr als eine Gruppe kann seit
   * KAN-80 nicht offen stehen.
   */
  const preselected = FILTER_KEYS.find((key) => selection[key].length > 0)

  function changeFaculty(facultyId: string) {
    const faculty = toggleValue(selection.faculty, facultyId)
    const loadedPrograms = studyPrograms.data
    /* Solange die Studiengaenge noch laden, kann die Kaskade nicht
       rechnen; die Auswahl bleibt dann unveraendert stehen. */
    const studyProgram =
      loadedPrograms === undefined
        ? selection.studyProgram
        : selection.studyProgram.filter((programId) =>
            programsOfFaculties(loadedPrograms, faculty).some(
              (program) => program.id === programId
            )
          )
    onSelectionChange({ ...selection, faculty, studyProgram })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        {/* Feste Zeilenhoehe, damit das Erscheinen und Verschwinden des Weges
            zurueck auf null die Leiste nicht springen laesst (Befund zu
            KAN-80): die Schaltflaeche ist hoeher als die Ueberschrift, und
            ohne min-h wanderte beim Zuruecksetzen die ganze Karte samt
            Trefferliste daneben nach oben. */}
        <div className="flex min-h-7 items-center justify-between gap-2">
          <h2 className="type-label-xs tracking-widest text-muted-foreground uppercase">
            {t("project.list.filter.title")}
          </h2>
          {activeCount > 0 && (
            <Button
              variant="link"
              size="sm"
              className="type-label-xs h-auto p-0"
              onClick={() => onSelectionChange(emptyFilterSelection())}
            >
              <RotateCcwIcon aria-hidden="true" className="size-3.5" />
              {t("project.list.filter.reset", { count: activeCount })}
            </Button>
          )}
        </div>

        {/* multiple={false} ist der ganze Unterschied zur Reihe einzelner
            Aufklapper von zuvor: die Primitive schliesst die vorige Gruppe
            selbst. defaultValue statt value, weil der Aufklappzustand der
            Leiste gehoert und nicht der URL; geteilt wird die Auswahl, nicht
            die Ansicht. */}
        <Accordion
          multiple={false}
          defaultValue={[preselected ?? DEFAULT_OPEN_GROUP]}
        >
          <FilterGroup group="faculty" count={selection.faculty.length}>
            <OptionsState query={faculties}>
              {(options) =>
                options.map((faculty) => {
                  const id = faculty.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={faculty.name ?? id}
                      checked={selection.faculty.includes(id)}
                      onToggle={() => changeFaculty(id)}
                    />
                  )
                })
              }
            </OptionsState>
          </FilterGroup>

          <FilterGroup
            group="studyProgram"
            count={selection.studyProgram.length}
          >
            <OptionsState query={studyPrograms}>
              {(options) => {
                const visible = programsOfFaculties(options, selection.faculty)
                if (visible.length === 0) {
                  return <NoOptionsNote />
                }
                return visible.map((program) => {
                  const id = program.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={program.name ?? id}
                      checked={selection.studyProgram.includes(id)}
                      onToggle={() =>
                        onSelectionChange({
                          ...selection,
                          studyProgram: toggleValue(selection.studyProgram, id),
                        })
                      }
                    />
                  )
                })
              }}
            </OptionsState>
          </FilterGroup>

          <FilterGroup group="degree" count={selection.degree.length}>
            {FILTER_DEGREES.map((degree) => (
              <FilterOption
                key={degree}
                label={t(`project.degree.${degree}`)}
                checked={selection.degree.includes(degree)}
                onToggle={() =>
                  onSelectionChange({
                    ...selection,
                    degree: toggleValue(selection.degree, degree),
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup group="semester" count={selection.semester.length}>
            <OptionsState query={semesters}>
              {(options) =>
                options.map((semester) => {
                  const id = semester.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={semester.name ?? id}
                      checked={selection.semester.includes(id)}
                      onToggle={() =>
                        onSelectionChange({
                          ...selection,
                          semester: toggleValue(selection.semester, id),
                        })
                      }
                    />
                  )
                })
              }
            </OptionsState>
          </FilterGroup>

          <FilterGroup group="type" count={selection.type.length}>
            {FILTER_PROJECT_TYPES.map((type) => (
              <FilterOption
                key={type}
                label={t(`project.type.${type}`)}
                checked={selection.type.includes(type)}
                onToggle={() =>
                  onSelectionChange({
                    ...selection,
                    type: toggleValue(selection.type, type),
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup group="category" count={selection.category.length}>
            <OptionsState query={categories}>
              {(options) =>
                options.map((category) => {
                  const id = category.id
                  if (id === undefined) {
                    return null
                  }
                  return (
                    <FilterOption
                      key={id}
                      label={category.name ?? id}
                      checked={selection.category.includes(id)}
                      onToggle={() =>
                        onSelectionChange({
                          ...selection,
                          category: toggleValue(selection.category, id),
                        })
                      }
                    />
                  )
                })
              }
            </OptionsState>
          </FilterGroup>
        </Accordion>
      </CardContent>
    </Card>
  )
}

/**
 * Eine Filtergruppe des Akkordeons: Gruppenname, Zahl der gesetzten Werte,
 * Pfeil, darunter die Optionsliste.
 *
 * <p><strong>Die Zahl steht zwischen Name und Pfeil</strong> (Vorgabe zu
 * KAN-80). Sie erscheint nur, wenn etwas gesetzt ist: eine Null an jeder der
 * sechs Gruppen waere sechsmal die Auskunft, dass nichts passiert.
 *
 * <p>Sichtbar ist sie eine blosse Ziffer, und die sagt allein nicht, was sie
 * zaehlt; vorgelesen wird deshalb der ganze Satz. Derselbe Kunstgriff wie am
 * Fakultaetskuerzel der Projektkachel.
 *
 * <p>Der Wert des Akkordeon-Glieds ist der Gruppenschluessel und nicht die
 * Position: eine neue Gruppe in der Mitte verschoebe sonst, welche offen
 * steht.
 *
 * <p><strong>Lange Optionslisten scrollen innerhalb der Gruppe.</strong> Die
 * Studiengaenge sind der auffaellige Fall: Es sind rund siebzig, und ohne
 * Hoehengrenze zog die aufgeklappte Gruppe die Leiste auf ein Vielfaches der
 * Fensterhoehe. Die Annahme aus KAN-80, das Akkordeon halte die Leiste kurz
 * genug, um ohne Klebeposition auszukommen (Begruendung in
 * ProjectListPage), traegt erst mit dieser Grenze. Kurze Gruppen wie die
 * Abschlussart merken davon nichts.
 *
 * <p>24rem sind rund vierzehn Zeilen. Knapper gesetzt faengt eine Gruppe
 * schon dort an zu scrollen, wo das Rollen mehr kostet, als es einbringt;
 * hoeher gesetzt steht die Karte samt der fuenf zugeklappten Gruppen ueber
 * einem 768 Pixel hohen Fenster. Die Rollleiste selbst ist schlank gesetzt
 * (scrollbar-slim in index.css): die Systembreite von rund 17 Pixeln nimmt
 * einer 16rem schmalen Leiste ein Zwoelftel der Zeile.
 */
function FilterGroup({
  group,
  count,
  children,
}: {
  group: FilterGroupKey
  count: number
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <AccordionItem value={group} className="last:border-b-0">
      <AccordionTrigger className="type-label-xs gap-2 tracking-wide uppercase hover:no-underline">
        {/* Die Beschriftung nimmt den freien Platz, damit der Zaehler
            unmittelbar vor dem Pfeil steht.

            Vorher trug der Zaehler selbst ein ml-auto. Der Pfeil der
            Primitive traegt aber ebenfalls eines
            (**:data-[slot=accordion-trigger-icon]:ml-auto in accordion.tsx),
            und zwei automatische Aussenabstaende teilen sich den freien
            Platz zu gleichen Teilen: der Zaehler landete auf halber Strecke
            zwischen Text und Pfeil. Den freien Platz stattdessen der
            Beschriftung zu geben loest das, ohne die erzeugte Datei
            anzufassen (Frontend-Regel 11): fuer den Pfeil bleibt nichts
            mehr zu verteilen, sein ml-auto wird damit zu null. */}
        <span className="flex-1 text-left">
          {t(`project.list.filter.group.${group}`)}
        </span>
        {count > 0 && (
          <CountBadge
            count={count}
            label={t("project.list.filter.groupCount", { count })}
          />
        )}
      </AccordionTrigger>
      <AccordionContent>
        {/* Die Grenze steht hier und nicht je Gruppe: max-height erzwingt
            keine Hoehe, sie greift also von selbst erst dort, wo sie noetig
            ist. Die drei Abschlussarten bleiben drei Zeilen, die rund
            siebzig Studiengaenge scrollen.

            py-2 ist kein Rand nach Gefuehl, sondern die Bedingung dafuer,
            dass die kurzen Gruppen ueberhaupt ohne Rollleiste auskommen.
            Die Checkbox traegt eine unsichtbare Trefferflaeche
            (after:-inset-y-2 in checkbox.tsx), die acht Pixel ueber ihre
            Zeile hinausragt. Absolut gesetzt zaehlt sie nicht zur Hoehe des
            Rahmens, sehr wohl aber zu seinem rollbaren Bereich: ohne
            Polsterung stand schon bei drei Zeilen eine Rollleiste fuer drei
            Pixel da (gemessen 83 zu 80).

            Kein overscroll-contain: Wer am Ende der Studiengangliste
            angekommen ist, soll mit derselben Bewegung die Seite
            weiterrollen (Vorgabe). scroll-py-1 haelt beim Tabben auf eine
            halb verdeckte Zeile den Fokusring der Checkbox frei, den der
            Browser sonst buendig an die Kante schiebt (Rezept aus
            command.tsx). overflow-x-hidden verhindert eine zweite,
            waagerechte Rollleiste: overflow-y allein macht die waagerechte
            Achse zu auto. px-1 gibt dem Fokusring links und rechts Platz;
            ein Gegenrand -mx-1 daneben brauchte es nicht, Panel und Karte
            klippen beide bei null. */}
        <div
          data-slot="filter-group-options"
          className="flex scrollbar-slim max-h-96 scroll-py-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-1 py-2"
        >
          {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * Eine Checkbox-Zeile; das umschliessende Label macht die ganze Zeile klickbar.
 *
 * <p><strong>Das Kaestchen fluchtet mit der ersten Textzeile</strong> (Punkt 4
 * aus KAN-105). Label aus der Registry zentriert seine Kinder
 * (items-center). Einzeilig faellt das nicht auf; bricht ein langer Name wie
 * „Wirtschaftsingenieurwesen" in der 16rem schmalen Leiste um, stand das
 * Kaestchen zwischen den beiden Zeilen und gehoerte sichtbar zu keiner.
 * items-start stellt es an den Anfang.
 *
 * <p>Oben buendig allein genuegt nicht, deshalb der Ausgleich. Das Label
 * setzt text-sm mit leading-none, die Textzeile ist also 0,875rem hoch, und
 * zwei Zeilen stuenden ohne Durchschuss aufeinander. Der Text bekommt darum
 * eine eigene Zeilenhoehe, leading-5 (1,25rem); das Kaestchen ist size-4
 * (1rem) und steht mit mt-0.5 um den halben Unterschied, 0,125rem, tiefer.
 * Seine Mitte liegt dann auf 0,625rem, genau auf der Mitte der ersten
 * Zeile. Die Rechnung setzt Tailwinds --spacing von 0,25rem voraus; die
 * Tokenschicht schaltet nur --color-* und --radius-* ab.
 *
 * <p>Aus py-1 wird dafuer py-0.5. Die hoehere Textzeile machte die Zeile
 * sonst um 0,25rem hoeher; mit dem halbierten Rand bleibt sie 1,5rem hoch
 * (die 24 Pixel aus SC 2.5.8), das Kaestchen steht wie zuvor 0,25rem unter
 * ihrer Oberkante und die Textmitte auf 0,75rem. Einzeilige Optionen sehen
 * also aus wie vorher, die „rund vierzehn Zeilen" an FilterGroup bleiben
 * richtig, und die unsichtbare Trefferflaeche der Checkbox
 * (after:-inset-y-2) ragt ueber die erste und letzte Zeile genauso weit
 * hinaus wie bisher, also nicht weiter, als das py-2 der Optionsliste
 * auffaengt. Eine zweizeilige Zeile waechst nur nach unten, ihr Ueberstand
 * dort wird kleiner.
 *
 * <p>Die Klassen stehen hier am Aufrufer und nicht in label.tsx: die
 * erzeugte Datei bleibt unangetastet (Frontend-Regel 11), und dort traefe
 * items-start jede andere Verwendung, deren Kinder mittig stehen sollen.
 * cn() in der Primitive verwirft das items-center zugunsten der Klasse von
 * hier, beide stehen also nicht nebeneinander im Klassennamen.
 */
function FilterOption({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <Label className="items-start py-0.5 font-normal">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      {/* Ein eigenes Element und nicht blosser Text: Ein anonymes Flex-Kind
          traegt min-width:auto und schrumpft nie unter sein laengstes Wort.
          „Wirtschaftsingenieurwesen" ist in der 16rem schmalen Leiste
          laenger als die Zeile und stuende sonst ueber den Rand hinaus, wo
          der Scrollrahmen ihn abschneidet. */}
      <span className="min-w-0 leading-5 break-words">{label}</span>
    </Label>
  )
}

/**
 * Die drei Zustaende einer Optionsliste aus Stammdaten (Skill
 * frontend-modul, Abschnitt 5): Skeleton in Zeilenform, Fehler aus dem
 * ApiError-Envelope, Leermeldung; sonst rendert der Aufrufer die Optionen.
 */
function OptionsState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T[], Error>
  children: (data: T[]) => ReactNode
}) {
  const apiMessage = useApiErrorMessage()
  if (query.isPending) {
    return (
      <>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-full" />
      </>
    )
  }
  if (query.error !== null) {
    return (
      <p className="type-body-sm text-destructive">{apiMessage(query.error)}</p>
    )
  }
  if (query.data.length === 0) {
    return <NoOptionsNote />
  }
  return <>{children(query.data)}</>
}

function NoOptionsNote() {
  const { t } = useTranslation()
  return (
    <p className="type-body-sm text-muted-foreground">
      {t("project.list.filter.noOptions")}
    </p>
  )
}
