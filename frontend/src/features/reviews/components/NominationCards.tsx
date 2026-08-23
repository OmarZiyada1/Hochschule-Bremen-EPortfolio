import { ChevronRightIcon, HistoryIcon, TrophyIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { NominationTier, Top10NominationResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { Pill, type PillTone } from "@/components/common/Pill"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Ton je Stufe. Der Ton ist Zugabe und nie die Aussage: die Stufe steht
 * immer als Text in der Pille (SC 1.4.1). Record ueber den Enum-Typ, damit
 * eine vierte Stufe den Typecheck bricht.
 */
const tierTones: Record<NominationTier, PillTone> = {
  TOP_1: "success",
  TOP_5: "info",
  TOP_10: "neutral",
}

/** Zahl der Plaetze, die die kuratierte Liste hoechstens fuehrt (§3.11). */
const TOP10_SIZE = 10

/**
 * „Meine Top-10-Nominierungen" (Template „Meine Reviews", KAN-37): die
 * eigenen Vorschlaege mit Stufe, Titel, Zeitpunkt und Stand.
 *
 * <p>Die Angabe „n von zehn Plaetzen aktiv" kommt aus der Laenge von
 * {@code GET /api/top10} und nicht aus den Nominierungen: sie beschreibt
 * die kuratierte Liste und nicht die eigenen Vorschlaege. Unbesetzte
 * Plaetze fehlen in der Antwort (§3.11.1), die Laenge ist also genau die
 * Zahl der belegten.
 */
export function OwnNominationsCard({
  nominations,
  activePlaces,
  isPending,
  error,
}: {
  nominations: Top10NominationResponse[]
  activePlaces: number | undefined
  isPending: boolean
  /**
   * Fehler der Abfrage. Ohne ihn zeigte die Karte nach einem 500 den
   * Leerzustand und behauptete damit, es gebe keine Nominierungen (Befund
   * des frontend-reviewers).
   */
  error?: unknown
}) {
  const { t } = useTranslation()

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

        {isPending && <Skeleton className="h-16 w-full rounded-control" />}

        {error !== null && error !== undefined && (
          <Alert variant="destructive">
            <AlertTitle>
              {isApiError(error)
                ? t(apiErrorMessageKey(error), { defaultValue: error.message })
                : t("apiError.INTERNAL_ERROR")}
            </AlertTitle>
          </Alert>
        )}

        {!isPending && error === undefined && nominations.length === 0 && (
          <EmptyState
            headingLevel={3}
            icon={<TrophyIcon aria-hidden="true" />}
            title={t("review.nomination.own.empty.title")}
            description={t("review.nomination.own.empty.description")}
          />
        )}

        {/* Die Zeilen komponieren die Registry-Primitive item, statt Medien-,
            Titel- und Aktionsbereich aus divs nachzubauen (Befund aus KAN-7).
            Item rendert ein div, die Aufzaehlung bleibt deshalb aussen: ul und
            li tragen die Semantik, Item das Aussehen. */}
        {nominations.length > 0 && (
          <ul className="flex flex-col gap-2">
            {nominations.map((nomination) => (
              <li key={nomination.id}>
                <Item size="sm">
                  <ItemMedia>
                    <Pill tone={tierTones[nomination.proposedTier]}>
                      {t(`top10.tier.${nomination.proposedTier}`)}
                    </Pill>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      <NominationProjectLink nomination={nomination} />
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions className="type-label-xs gap-2 text-muted-foreground">
                    <NominationTimestamp value={nomination.createdAt} />
                    <span>
                      {t(`top10.nominationStatus.${nomination.status}`)}
                    </span>
                  </ItemActions>
                </Item>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * „Mein Nominierungs-Verlauf" (Template „Meine Reviews"): dieselben Daten
 * als Zeitleiste, aufklappbar.
 *
 * <p>Dieselbe Abfrage und keine zweite: der Verlauf ist eine andere
 * Darstellung derselben Vorschlaege, kein anderer Gegenstand. Zugeklappt
 * beginnt er, weil er der Nachschlagefall ist und die Karte darueber den
 * Regelfall zeigt.
 */
export function NominationHistoryCard({
  nominations,
  isPending,
  error,
}: {
  nominations: Top10NominationResponse[]
  isPending: boolean
  /** Wie oben: ein Fehler ist kein leerer Verlauf. */
  error?: unknown
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardContent>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="flex w-full items-center justify-between gap-2 px-0"
              />
            }
          >
            <span className="flex flex-col items-start gap-0.5">
              <span className="type-body-sm flex items-center gap-2 font-semibold">
                <HistoryIcon
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                {t("review.nomination.history.title")}
              </span>
              <span className="type-label-xs font-normal text-muted-foreground">
                {isPending
                  ? t("review.nomination.history.loading")
                  : t("review.nomination.history.summary", {
                      count: nominations.length,
                    })}
              </span>
            </span>
            <ChevronRightIcon
              aria-hidden="true"
              className={cn("transition-transform", open && "rotate-90")}
            />
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            {error !== null && error !== undefined ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {isApiError(error)
                    ? t(apiErrorMessageKey(error), {
                        defaultValue: error.message,
                      })
                    : t("apiError.INTERNAL_ERROR")}
                </AlertTitle>
              </Alert>
            ) : nominations.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon={<HistoryIcon aria-hidden="true" />}
                title={t("review.nomination.history.empty.title")}
                description={t("review.nomination.history.empty.description")}
              />
            ) : (
              <ol className="flex flex-col gap-2 border-l pl-4">
                {nominations.map((nomination) => (
                  <li key={nomination.id}>
                    <Item size="sm" className="items-start">
                      <ItemContent>
                        <span className="type-label-xs text-muted-foreground">
                          <NominationTimestamp value={nomination.createdAt} />
                        </span>
                        <ItemTitle>
                          <NominationProjectLink nomination={nomination} />
                        </ItemTitle>
                        <ItemDescription>
                          {t("review.nomination.history.entry", {
                            tier: t(`top10.tier.${nomination.proposedTier}`),
                            person: fullNameOf(nomination.nominatedBy),
                          })}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  </li>
                ))}
              </ol>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

/**
 * Der Projekttitel als Weg auf die Detailseite. Die Nominierung fuehrt die
 * ganze Kachel mit (§6.1), ein zweiter Aufruf ist dafuer also nicht noetig.
 */
function NominationProjectLink({
  nomination,
}: {
  nomination: Top10NominationResponse
}) {
  return (
    <Link
      to={`/projects/${nomination.project.id}`}
      className="type-body-sm font-semibold hover:underline focus-visible:underline"
    >
      {nomination.project.title}
    </Link>
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
