import { ChevronRightIcon, PlusIcon } from "lucide-react"
import { useRef, type ReactNode, type RefObject } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/EmptyState"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Eine Zeile der Spalte, so schmal wie die Spalte sie braucht. */
export interface StudyStructureItem {
  id: string
  name: string
}

/**
 * Eine der drei Spalten der Studienstruktur (Frame
 * {@code Admin · Studienstruktur}, KAN-39): Ueberschrift mit Zahl,
 * Anlegeknopf, Liste und Zeilenmenue.
 *
 * <p><strong>Master-Detail statt Aufklappliste.</strong> Die Template-Seite
 * beschreibt eine aufklappbare Liste; der Frame zeichnet drei Spalten
 * nebeneinander, in denen die Auswahl links die Liste rechts einschraenkt.
 * Gebaut ist der Frame, er ist der juengere und genauere Entwurf.
 *
 * <p><strong>Ein beschrifteter Knopf statt Feld und Plus.</strong> Der Frame
 * zeichnet je Spalte ein Textfeld mit Plus-Schaltflaeche. Angelegt wird aber
 * ueber das Formular, weil die Fakultaet ihr Kuerzel zwingend braucht (§3.8,
 * Klaerungsrunde zu KAN-39); ein Feld davor haette dann nur den Namen
 * vorbelegt und daneben ein zweites Mal nach ihm gefragt. Der Knopf traegt
 * seine Beschriftung sichtbar und nicht nur fuer Hilfsmittel: ein blosses
 * Plus laesst offen, was es anlegt (Nachtrag zur Klaerungsrunde).
 *
 * <p><strong>Die Auswahl ist ein Knopf mit {@code aria-pressed}</strong> und
 * kein Listeneintrag mit Klickhandler: sie ist ein Zustand, und genau das
 * sagt die Rolle. Die Modulspalte hat keine Ebene unter sich und deshalb
 * keine Auswahl; ihre Zeilen sind Text.
 *
 * <p><strong>Warum hier keine {@code toggle-group} steht.</strong> Die
 * Registry-Primitive traegt die Einzelauswahl samt Pfeiltasten, verlangt
 * dafuer aber, dass jede Zeile <em>ein</em> Element ihrer Gruppe ist. Hier
 * steht neben der Auswahl das Zeilenmenue, also ein zweites Bedienelement in
 * derselben Zeile; es laege damit entweder in der Gruppe (und faenge die
 * Pfeiltasten mit ab) oder ausserhalb der Liste. Ein Knopf mit
 * {@code aria-pressed} sagt dasselbe ohne diesen Konflikt (Befund des
 * frontend-reviewers zu KAN-39).
 */
export function StudyStructureColumn({
  title,
  count,
  items,
  selectedId,
  onSelect,
  loading,
  error,
  emptyTitle,
  createLabel,
  createDisabled = false,
  disabledHint,
  onCreate,
  renderMenu,
}: {
  title: string
  /** Zahl hinter der Ueberschrift. Ohne Angabe steht dort keine, wie im Frame. */
  count?: number
  items: readonly StudyStructureItem[]
  selectedId: string | null
  /** Ohne Angabe ist die Spalte nicht auswaehlbar (Modulspalte). */
  onSelect?: (id: string) => void
  loading: boolean
  /**
   * Meldung, wenn die Liste dieser Spalte nicht geladen werden konnte.
   * Ohne sie stuende ein Serverausfall als „noch nichts angelegt" da, und
   * die Administration legte einen vorhandenen Eintrag ein zweites Mal an.
   */
  error?: string
  emptyTitle: string
  /** Sichtbare Beschriftung des Anlegeknopfes, etwa „Fakultät hinzufügen". */
  createLabel: string
  /** Ohne uebergeordnete Auswahl laesst sich hier nichts anlegen. */
  createDisabled?: boolean
  disabledHint?: string
  /**
   * Oeffnet das Formular. Geprueft wird dort (Frontend-Regel 12).
   *
   * <p>Der Anlegeknopf geht als Fokusziel mit: er ist beim Schliessen des
   * Dialogs noch da, und ohne ihn fiele der Fokus auf body (SC 2.4.3).
   */
  onCreate: (trigger: RefObject<HTMLElement | null>) => void
  renderMenu: (item: StudyStructureItem) => ReactNode
}) {
  const { t } = useTranslation()
  const createRef = useRef<HTMLButtonElement | null>(null)

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-col gap-4">
        <h2 className="type-label-xs text-muted-foreground uppercase">
          {count === undefined
            ? title
            : t("administration.studyStructure.columnTitle", { title, count })}
        </h2>

        <Button
          ref={createRef}
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={createDisabled}
          onClick={() => onCreate(createRef)}
        >
          <PlusIcon aria-hidden="true" />
          {createLabel}
        </Button>

        {createDisabled && disabledHint !== undefined && (
          <p className="type-body-sm text-muted-foreground">{disabledHint}</p>
        )}

        {error !== undefined && (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full rounded-control" />
            <Skeleton className="h-9 w-full rounded-control" />
            <Skeleton className="h-9 w-full rounded-control" />
          </div>
        )}

        {!loading && error === undefined && items.length === 0 && (
          <EmptyState headingLevel={3} title={emptyTitle} className="py-6" />
        )}

        {items.length > 0 && (
          <ul className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
            {items.map((item) => {
              const selected = item.id === selectedId
              return (
                <li key={item.id} className="flex items-center gap-1">
                  {onSelect === undefined ? (
                    <span className="min-w-0 flex-1 truncate px-3 py-2">
                      {item.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-control px-3 py-2 text-left",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="min-w-0 truncate">{item.name}</span>
                      {selected && (
                        <ChevronRightIcon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                      )}
                    </button>
                  )}
                  {renderMenu(item)}
                </li>
              )
            })}
          </ul>
        )}

        {/* Der Zaehler steht sichtbar in der Ueberschrift; fuer Hilfsmittel
            sagt diese Zeile zusaetzlich, worauf sich die Liste gerade
            bezieht, wenn die Auswahl links sie eingeschraenkt hat. */}
        <span className="sr-only">
          {t("administration.studyStructure.columnCount", {
            count: items.length,
          })}
        </span>
      </CardContent>
    </Card>
  )
}
