import { TrophyIcon, Undo2Icon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type {
  NominationStatus,
  Top10EntryResponse,
  Top10NominationResponse,
} from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { Pill } from "@/components/common/Pill"
import {
  SegmentedFilter,
  type SegmentedOption,
} from "@/components/common/SegmentedFilter"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { NominationWithdrawDialog } from "@/features/reviews/components/NominationWithdrawDialog"
import {
  ALL_NOMINATION_STATUSES,
  NOMINATION_STATUSES,
  nominationStatusTones,
  nominationWithdrawable,
  tierIcons,
  tierTones,
  type NominationFilterValue,
} from "@/features/reviews/nominations"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

/** Zahl der Plaetze, die die kuratierte Liste hoechstens fuehrt (§3.11). */
const TOP10_SIZE = 10

/**
 * „Meine Top-10-Nominierungen" (Template „Meine Reviews", KAN-37): die
 * eigenen Vorschlaege mit Stufe, Titel, Zeitpunkt und Stand, gefiltert ueber
 * eine Standsleiste.
 *
 * <p><strong>Ein Bereich statt zwei.</strong> Bis zur Nacharbeit standen hier
 * zwei Karten nebeneinander: „Meine Top-10-Nominierungen" und „Mein
 * Nominierungs-Verlauf". Beide lasen dieselbe Abfrage und zeigten dieselben
 * Zeilen, nur anders angeordnet; wer wissen wollte, was aus einem Vorschlag
 * geworden ist, musste raten, welche der beiden die Antwort hat. Der Verlauf
 * war ausserdem die schlechtere Darstellung: grosse Zeitleistenkarten, die
 * den Stand gar nicht zeigten. Jetzt gibt es eine Liste, und die Leiste
 * darueber beantwortet die Frage nach dem Stand.
 *
 * <p>Die Angabe „n von zehn Plaetzen aktiv" kommt aus der Laenge von
 * {@code GET /api/top10} und nicht aus den Nominierungen: sie beschreibt die
 * kuratierte Liste und nicht die eigenen Vorschlaege. Unbesetzte Plaetze
 * fehlen in der Antwort (§3.11.1), die Laenge ist also genau die Zahl der
 * belegten.
 *
 * <p><strong>Gefiltert wird im Browser</strong> und nicht ueber den
 * Parameter {@code status} des Endpoints. Die Liste ist unpaginiert und
 * klein, der Wechsel zwischen den Staenden soll ohne Ladezustand gehen, und
 * die Angabe „n von zehn" bezoege sich sonst auf eine gefilterte Menge. Der
 * Parameter bleibt trotzdem in der Query-Fabrik: die Administrationsseite
 * braucht ihn (KAN-40).
 */
export function NominationPanel({
  nominations,
  top10,
  isPending,
  error,
  isAdmin,
}: {
  nominations: Top10NominationResponse[]
  /**
   * Die kuratierte Liste selbst (§6.1). Sie beantwortet zwei Fragen
   * des Bereichs: wie viele Plaetze belegt sind, und auf welchem
   * Platz ein angenommener Vorschlag jetzt steht.
   */
  top10: Top10EntryResponse[] | undefined
  isPending: boolean
  /**
   * Fehler der Abfrage. Ohne ihn zeigte der Bereich nach einem 500 den
   * Leerzustand und behauptete damit, es gebe keine Nominierungen (Befund
   * des frontend-reviewers).
   */
  error?: unknown
  /**
   * Ob die angemeldete Person kuratieren darf (§5). Entscheidet allein
   * darueber, ob ein angenommener Vorschlag noch zurueckziehbar ist;
   * verbindlich bleibt der Server.
   */
  isAdmin: boolean
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<NominationFilterValue>(
    ALL_NOMINATION_STATUSES
  )
  /* Eine Ansage je Rueckzug: die Zeile verschwindet danach aus dem
     gewaehlten Ausschnitt, und ohne Live-Region bliebe das fuer
     Screenreader unbemerkt (SC 4.1.3). */
  const [notice, setNotice] = useState("")
  /*
   * Ziel der Fokusrueckgabe: nach dem Rueckzug liefert nominationWithdrawable
   * false, der Ausloeser verschwindet, und bei aktivem Filter gleich die
   * ganze Zeile. Ohne dieses Ziel fiele der Fokus auf body und die naechste
   * Tabulatorreihe begaenne wieder ganz oben (SC 2.4.3).
   */
  const list = useRef<HTMLUListElement | null>(null)

  const options: SegmentedOption<NominationFilterValue>[] = [
    { value: ALL_NOMINATION_STATUSES, label: t("common.filter.all") },
    ...NOMINATION_STATUSES.map((status) => ({
      value: status as NominationFilterValue,
      label: t(`top10.nominationStatus.${status}`),
    })),
  ]

  const shown =
    filter === ALL_NOMINATION_STATUSES
      ? nominations
      : nominations.filter((nomination) => nomination.status === filter)

  const failed = error !== null && error !== undefined
  const activePlaces = top10?.length
  /*
   * Projekt-ID auf Platz. Einmal je Rendervorgang gebaut statt je
   * Zeile gesucht: die Liste ist zwar hoechstens zehn Eintraege lang,
   * eine Suche je Zeile waere aber genau die Art Schleife in der
   * Schleife, die spaeter niemand mehr bemerkt.
   */
  const placeOf = new Map(
    (top10 ?? []).map((entry) => [entry.project.id, entry.position])
  )

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-body-sm flex items-center gap-2 font-semibold">
            <TrophyIcon aria-hidden="true" className="size-4 text-primary" />
            {t("review.nomination.own.title")}
          </h2>
          {activePlaces !== undefined && (
            <span className="type-label-xs text-muted-foreground">
              {t("review.nomination.own.places", {
                count: activePlaces,
                total: TOP10_SIZE,
              })}
            </span>
          )}
        </div>

        <SegmentedFilter
          label={t("review.nomination.own.statusFilter")}
          options={options}
          value={filter}
          onValueChange={setFilter}
          fallback={ALL_NOMINATION_STATUSES}
        />

        {isPending && <Skeleton className="h-16 w-full rounded-control" />}

        {failed && (
          <Alert variant="destructive">
            <AlertTitle>
              {isApiError(error)
                ? t(apiErrorMessageKey(error), { defaultValue: error.message })
                : t("apiError.INTERNAL_ERROR")}
            </AlertTitle>
          </Alert>
        )}

        {/* Zwei Leerzustaende, weil sie Verschiedenes sagen: „noch nichts
            vorgeschlagen" ist ein Anfang, „unter diesem Stand nichts" ist
            eine Auskunft ueber den gewaehlten Filter. Eine leere weisse
            Flaeche sagte beides nicht. */}
        {!isPending && !failed && shown.length === 0 && (
          <EmptyState
            headingLevel={3}
            icon={<TrophyIcon aria-hidden="true" />}
            title={
              nominations.length === 0
                ? t("review.nomination.own.empty.title")
                : t(`review.nomination.own.emptyFiltered.${filter}`)
            }
            description={
              nominations.length === 0
                ? t("review.nomination.own.empty.description")
                : undefined
            }
          />
        )}

        {/* Die Zeilen komponieren die Registry-Primitive item, statt Medien-,
            Titel- und Aktionsbereich aus divs nachzubauen (Befund aus KAN-7).
            Item rendert ein div, die Aufzaehlung bleibt deshalb aussen: ul und
            li tragen die Semantik, Item das Aussehen. */}
        {shown.length > 0 && (
          <ul
            ref={list}
            tabIndex={-1}
            className="flex flex-col gap-2 outline-none"
          >
            {shown.map((nomination) => (
              <li key={nomination.id}>
                <NominationRow
                  nomination={nomination}
                  place={placeOf.get(nomination.project.id)}
                  isAdmin={isAdmin}
                  onNotice={(message) => {
                    setNotice(message)
                    list.current?.focus()
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <span className="sr-only" role="status">
          {notice}
        </span>
      </CardContent>
    </Card>
  )
}

/**
 * Eine Zeile: Stufe, Titel, Zeitpunkt, Stand und, wo sie greift, die
 * Handlung. Eigene Komponente, weil das Zurueckziehen eine Rueckfrage je
 * Zeile braucht und ein Hook nicht in einer Schleife entstehen darf.
 */
function NominationRow({
  nomination,
  place,
  isAdmin,
  onNotice,
}: {
  nomination: Top10NominationResponse
  /** Platz, auf dem das Projekt <em>jetzt</em> steht, sonst undefined. */
  place: number | undefined
  isAdmin: boolean
  onNotice: (message: string) => void
}) {
  const { t } = useTranslation()
  /* Herkunft fuer den Brotkrumenpfad des Ziels (KAN-80). */
  const origin = useBreadcrumbOrigin()
  const TierIcon = tierIcons[nomination.proposedTier]

  return (
    <Item size="sm">
      <ItemMedia>
        <Pill tone={tierTones[nomination.proposedTier]}>
          {/* Symbol und Text in derselben Pille; die Primitive setzt fuer
              ein svg bereits size-3 und den Abstand. */}
          <TierIcon aria-hidden="true" />
          {t(`top10.tier.${nomination.proposedTier}`)}
        </Pill>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link
            to={`/projects/${nomination.project.id}`}
            state={origin}
            className="type-body-sm font-semibold hover:underline focus-visible:underline"
          >
            {nomination.project.title}
          </Link>
        </ItemTitle>
        <ItemDescription>
          <NominationTimestamp value={nomination.createdAt} />
        </ItemDescription>
      </ItemContent>
      <ItemActions className="gap-2">
        <NominationPlace nomination={nomination} place={place} />
        <NominationStatusBadge status={nomination.status} />
        <NominationWithdrawAction
          nomination={nomination}
          isAdmin={isAdmin}
          onNotice={onNotice}
        />
      </ItemActions>
    </Item>
  )
}

/**
 * Der Platz eines angenommenen Vorschlags, in drei Faellen.
 *
 * <p><strong>Steht das Projekt jetzt in der Top-10, gilt dieser
 * Platz</strong> und nicht {@code proposedPosition}. Die beiden laufen
 * auseinander, sobald die Administration die Liste umsortiert: ein auf
 * Platz 3 angenommenes und spaeter auf Platz 7 geschobenes Projekt
 * traegt an der Nominierung weiterhin die 3. Die Zeile soll sagen, wo
 * es steht, nicht wo es einmal einsortiert wurde.
 *
 * <p><strong>Steht es nicht mehr darin, bleibt der entschiedene
 * Platz</strong> als Angabe in der Vergangenheit. Ein Projekt verlaesst
 * die Liste, wenn es {@code PUBLISHED} verlaesst, geloescht wird oder
 * die Nominierung zurueckgezogen wurde (§3.11, §3.11.1); die
 * Entscheidung von damals bleibt trotzdem wahr.
 *
 * <p><strong>Beides leer heisst: nichts anzeigen.</strong>
 * {@code proposedPosition} bleibt nach §3.11.1 Regel 5 leer, wenn die
 * Administration das Projekt ueber {@code PUT /admin/top10} direkt
 * aufgenommen hat. Ein „Platz null" waere dann schlechter als gar
 * keine Angabe.
 *
 * <p>Nur bei {@code ACCEPTED}: bei einem offenen, abgelehnten oder
 * zurueckgezogenen Vorschlag gibt es keinen Platz, ueber den etwas zu
 * sagen waere.
 */
function NominationPlace({
  nomination,
  place,
}: {
  nomination: Top10NominationResponse
  place: number | undefined
}) {
  const { t } = useTranslation()

  if (nomination.status !== "ACCEPTED") {
    return null
  }
  if (place !== undefined) {
    return (
      <span className="type-label-xs font-medium text-muted-foreground">
        {t("top10.position", { position: place })}
      </span>
    )
  }
  if (nomination.proposedPosition !== null) {
    return (
      <span className="type-label-xs text-muted-foreground">
        {t("review.nomination.own.formerPosition", {
          position: nomination.proposedPosition,
        })}
      </span>
    )
  }
  return null
}

/**
 * Der Stand als Marke und nicht als blanker Text: eine Zeile traegt Stufe
 * und Stand nebeneinander, und ohne Flaeche liefen beide zu einem Satz
 * zusammen. Die Bedeutung steht in der Beschriftung, nie allein in der Farbe
 * (SC 1.4.1).
 */
function NominationStatusBadge({ status }: { status: NominationStatus }) {
  const { t } = useTranslation()
  return (
    <Pill tone={nominationStatusTones[status]}>
      {t(`top10.nominationStatus.${status}`)}
    </Pill>
  )
}

/**
 * Der Rueckzug als Symbolknopf mit Kurzhinweis, nach dem Muster der
 * Kachelhandlungen unter „Mein Portfolio" ({@code OwnProjectCardActions}).
 *
 * <p><strong>Warum kein Dreipunktmenue mehr.</strong> Es oeffnete sich mit
 * genau einem Eintrag, kostete also zwei Klicks fuer eine Handlung, und
 * {@code MoreVerticalIcon} sagt „hier gibt es etwas", nicht was. Die Zeile
 * wird durch den Direktknopf keinen Pixel breiter: Menueknopf und
 * Symbolknopf sind beide {@code size="icon-sm"}, also 28px und damit ueber
 * der Mindestgroesse von 24px (SC 2.5.8).
 *
 * <p><strong>Der Knopf erscheint nur, wo er greift.</strong> Ein
 * abgelehnter oder bereits zurueckgezogener Vorschlag traegt keine
 * Handlung; ein gesperrter Knopf an jeder zweiten Zeile waere Ruhe ohne
 * Auskunft.
 *
 * <p><strong>Kurzhinweis und zugaenglicher Name sagen Verschiedenes.</strong>
 * Der Hinweis ist die knappe Beschriftung, der Name nennt zusaetzlich das
 * Projekt: in einer Liste stuenden sonst mehrere gleichnamige Knoepfe
 * untereinander, die eine Elementliste nicht auseinanderhaelt (SC 2.4.6).
 * Beide wechseln bei einem angenommenen Vorschlag den Text, denn dort nimmt
 * der Klick das Projekt zugleich von der Startseite, und vor dem Klick hat
 * ein Symbolknopf nur diese beiden Texte.
 */
function NominationWithdrawAction({
  nomination,
  isAdmin,
  onNotice,
}: {
  nomination: Top10NominationResponse
  isAdmin: boolean
  onNotice: (message: string) => void
}) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  if (!nominationWithdrawable(nomination.status, isAdmin)) {
    return null
  }

  const accepted = nomination.status === "ACCEPTED"

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirm(true)}
            />
          }
        >
          <Undo2Icon aria-hidden="true" />
          <span className="sr-only">
            {t(
              accepted
                ? "review.nomination.withdraw.actionAcceptedFor"
                : "review.nomination.withdraw.actionFor",
              { title: nomination.project.title }
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t(
            accepted
              ? "review.nomination.withdraw.actionAccepted"
              : "review.nomination.withdraw.action"
          )}
        </TooltipContent>
      </Tooltip>

      <NominationWithdrawDialog
        open={confirm}
        onOpenChange={setConfirm}
        nomination={nomination}
        finalFocus={triggerRef}
        onDone={onNotice}
      />
    </>
  )
}

/** Zeitpunkt in der Sprache der Oberflaeche, nicht von Hand gesetzt. */
function NominationTimestamp({ value }: { value: string }) {
  const { i18n } = useTranslation()
  const formatted = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
  return <>{formatted}</>
}
