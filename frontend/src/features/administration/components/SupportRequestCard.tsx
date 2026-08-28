import { MailIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { SupportRequestResponse, SupportRequestStatus } from "@/api/types"
import { Pill, type PillTone } from "@/components/common/Pill"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Der Ton je Bearbeitungsstand (§2.15). Ein {@code Record} ueber den
 * Contract-Typ ohne Standardzweig, wie im {@code StatusBadge}: ein vierter
 * Stand bricht den Typecheck, statt still auf Grau zu fallen.
 *
 * <p>Der Ton ist Zugabe und nie die Aussage: die Bedeutung steht in der
 * Beschriftung der Pille (SC 1.4.1).
 */
const STATUS_TONES: Record<SupportRequestStatus, PillTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
}

/**
 * Die je Stand angebotenen Statuswechsel (§2.15). Sie sind eine Teilmenge der
 * erlaubten Uebergaenge und keine zweite Wahrheit daneben: der Server prueft
 * dieselbe Tabelle und antwortet auf alles andere mit 409
 * {@code SUPPORT_STATUS_TRANSITION_INVALID}.
 *
 * <p>Aus {@code OPEN} stehen beide Wege da, weil viele Anfragen in einem Zug
 * erledigt sind; aus {@code RESOLVED} fuehrt nur der Weg zurueck nach
 * {@code OPEN}, damit eine wieder geoeffnete Anfrage in derselben Zaehlung
 * erscheint wie eine neue.
 */
const ACTIONS: Record<
  SupportRequestStatus,
  readonly { target: SupportRequestStatus; variant: "default" | "outline" }[]
> = {
  OPEN: [
    { target: "IN_PROGRESS", variant: "outline" },
    { target: "RESOLVED", variant: "default" },
  ],
  IN_PROGRESS: [{ target: "RESOLVED", variant: "default" }],
  RESOLVED: [{ target: "OPEN", variant: "outline" }],
}

/**
 * Eine eingegangene Support-Anfrage als Karte (Template „Kontakt &amp;
 * Support", Frame {@code Admin · Support}; KAN-85).
 *
 * <p>Komponiert die vorhandenen Primitiven {@code Card}, {@code Button} und die
 * Domaenenhuelle {@code Pill}; von Hand entsteht hier allein das
 * Domaenenwissen, also welcher Stand welche Handlung anbietet und wie die
 * Absenderzeile aussieht (Frontend-Regel 11).
 *
 * <p><strong>Das Briefsymbol oeffnet das Mailprogramm, es versendet
 * nicht.</strong> Der Verweis ist ein {@code mailto:} an die absendende Person
 * mit vorbelegtem Betreff; der Server verschickt keine E-Mail (§3.20).
 * Deshalb ist es ein Link und keine Schaltflaeche: es fuehrt fort und loest
 * nichts aus.
 *
 * <p><strong>Der Papierkorb fragt nicht hier nach.</strong> Die Rueckfrage
 * gehoert in den {@code AlertDialog} der Seite; diese Karte meldet nur die
 * Absicht. Sonst truege jede Karte einen eigenen Dialog im Baum.
 */
export function SupportRequestCard({
  request,
  onChangeStatus,
  onDelete,
  disabled = false,
}: {
  request: SupportRequestResponse
  onChangeStatus: (target: SupportRequestStatus) => void
  onDelete: () => void
  /** Solange ein Schreibvorgang laeuft, damit nicht zweimal gesendet wird. */
  disabled?: boolean
}) {
  const { t, i18n } = useTranslation()

  /*
   * Datum und Uhrzeit in der Sprache der Oberflaeche, nicht des Browsers:
   * die Seite ist deutsch oder englisch, und ein drittes Format daneben
   * waere Zufall. Format wie im Template: „27.08.2026, 12:27".
   */
  const submittedAt = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(request.createdAt))

  const mailtoHref = `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(
    t("administration.support.replySubject", { subject: request.subject })
  )}`

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Pill tone={STATUS_TONES[request.status]}>
              {t(`support.status.${request.status}`)}
            </Pill>
            <span className="type-label-xs text-muted-foreground uppercase">
              {t(`support.category.${request.category}`)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {ACTIONS[request.status].map((action) => (
              <Button
                key={action.target}
                type="button"
                size="sm"
                variant={action.variant}
                disabled={disabled}
                onClick={() => onChangeStatus(action.target)}
              >
                {t(`administration.support.action.${action.target}`)}
              </Button>
            ))}

            {/*
              Ein Link und keine Schaltflaeche: das Symbol fuehrt ins
              Mailprogramm und loest nichts aus. Deshalb ein <a> mit
              buttonVariants und nicht die Button-Primitive mit einem
              hereingereichten Element: jene meldete sich mit
              nativeButton={false} als role="button" und behauptete damit
              genau das Gegenteil (Skill frontend-shadcn, Abschnitt zu
              buttonVariants; dasselbe Muster wie in NavBar).
            */}
            <a
              href={mailtoHref}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <MailIcon aria-hidden="true" />
              <span className="sr-only">
                {t("administration.support.reply", { name: request.name })}
              </span>
            </a>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={onDelete}
            >
              <Trash2Icon aria-hidden="true" />
              <span className="sr-only">
                {t("administration.support.delete", {
                  subject: request.subject,
                })}
              </span>
            </Button>
          </div>
        </div>

        {/*
          Ebene 3: die Seite traegt h1, die Liste selbst keine Zwischenebene.
          Ohne Ueberschrift faende die Sprungnavigation eines Screenreaders in
          einer langen Liste keinen Anker (SC 1.3.1).
        */}
        <h3 className="type-body font-semibold">{request.subject}</h3>

        <p className="type-body-sm text-muted-foreground">
          {request.name}
          {" · "}
          {request.email}
          {" · "}
          <time dateTime={request.createdAt}>{submittedAt}</time>
        </p>

        <hr />

        {/* whitespace-pre-line: der Text kommt als reiner Text mit
            Zeilenumbruechen (§3.20) und wird nicht als Markup gedeutet. */}
        <p className="type-body-sm whitespace-pre-line">{request.message}</p>
      </CardContent>
    </Card>
  )
}
