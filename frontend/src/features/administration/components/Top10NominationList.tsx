import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { Top10NominationResponse } from "@/api/types"
import { Pill } from "@/components/common/Pill"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AcceptNominationDialog } from "@/features/administration/components/AcceptNominationDialog"
import { RejectNominationDialog } from "@/features/administration/components/RejectNominationDialog"
import { useAcceptNomination } from "@/features/administration/hooks/useAdminTop10"
import { suggestedPositionFor } from "@/features/administration/top10Slots"
import {
  nominationStatusTones,
  tierIcons,
  tierTones,
} from "@/features/reviews/nominations"
import { fullNameOf } from "@/lib/name"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"
import { projectHref } from "@/features/projects/projectRoutes"

/**
 * Die Nominierungen der Top-10-Verwaltung (Frame {@code Admin · Top 10},
 * KAN-40): je Vorschlag eine Zeile mit Stufe, Zeitpunkt, Projekt,
 * vorschlagender Person und den Handlungen.
 *
 * <p><strong>Der vollstaendige Spiegel, nicht die eigenen Vorschlaege.</strong>
 * Die Redaktion sieht dieselbe Ressource unter {@code nominatedBy=me}
 * (KAN-37); hier stehen alle, gefiltert ueber den Stand aus §2.8. Die
 * Zuordnung von Stufe und Stand zu Ton und Symbol kommt aus
 * {@code reviews/nominations} und wird nicht ein zweites Mal aufgeschrieben:
 * es sind dieselben Werte, und zwei Abschriften liefen auseinander.
 *
 * <p><strong>Jede Zeile ist ein Kasten, keine Tabellenzeile.</strong> So
 * zeigt es der Frame, und es traegt auch schmale Fenster: die Knoepfe
 * ruecken unter den Text, statt eine Tabelle waagerecht scrollen zu lassen.
 *
 * <p><strong>Hier wird angenommen und abgelehnt, nicht zurueckgezogen</strong>
 * (Vorgabe zur Nacharbeit an KAN-87). Die Verwaltung entscheidet ueber
 * fremde Vorschlaege, und dafuer stehen genau diese beiden Verben; wer seinen
 * eigenen Vorschlag zurueckholen will, tut das in „Meine Reviews". Bis dahin
 * trug diese Liste zusaetzlich einen Rueckzugsknopf am eigenen Vorschlag, und
 * an einem angenommenen nahm er das Projekt nebenbei von der oeffentlichen
 * Startseite; dafuer gibt es „Vom Platz nehmen" in der Platzliste, und zwei
 * Wege zu demselben Ergebnis sind einer zu viel. Die Regel selbst steht in
 * {@code nominationWithdrawable}.
 */
export function Top10NominationList({
  nominations,
  freePositions,
  onNotice,
}: {
  nominations: readonly Top10NominationResponse[]
  /** Die noch unbesetzten Plaetze, fuer die Auswahl im Annahme-Dialog. */
  freePositions: readonly number[]
  /** Ansage nach jeder Entscheidung, fuer die Live-Region der Seite. */
  onNotice: (message: string) => void
}) {
  return (
    <ul className="flex flex-col gap-3">
      {nominations.map((nomination) => (
        <li key={nomination.id}>
          <NominationRow
            nomination={nomination}
            freePositions={freePositions}
            onNotice={onNotice}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * Eine Zeile.
 *
 * <p><strong>Die Zeile fuehrt ihre Dialoge selbst.</strong> Jede Handlung
 * braucht ein eigenes Ziel fuer die Fokusrueckgabe, und das ist der Knopf in
 * genau dieser Zeile (SC 2.4.3); eine Ebene hoeher gaebe es nur noch einen
 * gemeinsamen. Dasselbe Muster wie im Nominierungsbereich der Redaktion.
 */
function NominationRow({
  nomination,
  freePositions,
  onNotice,
}: {
  nomination: Top10NominationResponse
  freePositions: readonly number[]
  onNotice: (message: string) => void
}) {
  const { t, i18n } = useTranslation()
  /* Herkunft fuer den Brotkrumenpfad des Ziels (KAN-80). */
  const origin = useBreadcrumbOrigin()
  const accept = useAcceptNomination()
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const acceptTrigger = useRef<HTMLButtonElement | null>(null)
  const rejectTrigger = useRef<HTMLButtonElement | null>(null)

  const TierIcon = tierIcons[nomination.proposedTier]
  const open = nomination.status === "PENDING"
  const created = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(nomination.createdAt))

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tierTones[nomination.proposedTier]}>
              <TierIcon aria-hidden="true" className="size-3.5" />
              {t(`top10.tier.${nomination.proposedTier}`)}
            </Pill>
            {/* Der Stand steht nur dann als Marke da, wenn er nicht ohnehin
                aus den Knoepfen hervorgeht: an einem offenen Vorschlag
                saehe „Offen" neben „Annehmen" und „Ablehnen" wie eine
                dritte Angabe aus. */}
            {!open && (
              <Pill tone={nominationStatusTones[nomination.status]}>
                {t(`top10.nominationStatus.${nomination.status}`)}
              </Pill>
            )}
            <span className="type-body-sm text-muted-foreground">
              {created}
            </span>
          </div>

          <h3 className="type-body font-semibold">
            <Link
              to={projectHref(
                nomination.project.id,
                nomination.project.status,
                "review"
              )}
              state={origin}
              className="text-primary hover:underline focus-visible:underline"
            >
              {nomination.project.title}
            </Link>
          </h3>

          <p className="type-body-sm text-muted-foreground">
            {t("administration.top10.nomination.by", {
              person: fullNameOf(nomination.nominatedBy),
            })}
          </p>

          {/* Wer entschieden hat, gehoert an die entschiedene Zeile: ohne
              diese Angabe waere das Protokoll die einzige Auskunft
              darueber, und die liegt eine Seite weiter. */}
          {nomination.decidedBy !== null && nomination.decidedAt !== null && (
            <p className="type-body-sm text-muted-foreground">
              {t("administration.top10.nomination.decidedBy", {
                person: fullNameOf(nomination.decidedBy),
                date: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(nomination.decidedAt)),
              })}
              {nomination.proposedPosition !== null &&
                ` · ${t("top10.position", {
                  position: nomination.proposedPosition,
                })}`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {open && (
            <>
              <Button
                ref={acceptTrigger}
                type="button"
                onClick={() => setAccepting(true)}
                /* Bei zehn belegten Plaetzen gibt es nichts zu vergeben:
                   accept raeumt keinen Platz, sondern antwortete mit 409
                   RESOURCE_IN_USE (§3.11.1). Der Titel sagt, was zu tun
                   ist, statt den Knopf wortlos zu sperren. */
                disabled={freePositions.length === 0}
                title={
                  freePositions.length === 0
                    ? t("administration.top10.accept.noFreeSlot")
                    : undefined
                }
              >
                {t("administration.top10.accept.action")}
              </Button>
              <Button
                ref={rejectTrigger}
                type="button"
                variant="outline"
                onClick={() => setRejecting(true)}
              >
                {t("administration.top10.reject.action")}
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <AcceptNominationDialog
        nomination={accepting ? nomination : null}
        freePositions={freePositions}
        suggestedPosition={suggestedPositionFor(
          nomination.proposedTier,
          freePositions
        )}
        onOpenChange={setAccepting}
        pending={accept.isPending}
        onSubmit={async (position) => {
          await accept.mutateAsync({ nominationId: nomination.id, position })
          onNotice(
            t("administration.top10.accept.done", {
              title: nomination.project.title,
              position,
            })
          )
        }}
        finalFocus={acceptTrigger}
      />

      <RejectNominationDialog
        nomination={rejecting ? nomination : null}
        onOpenChange={setRejecting}
        finalFocus={rejectTrigger}
        onDone={onNotice}
      />
    </Card>
  )
}
