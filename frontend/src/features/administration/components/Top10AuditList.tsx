import { ArrowUpDownIcon, MinusIcon, PlusIcon } from "lucide-react"
import type { ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { Top10Action, Top10AuditEntryResponse } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { fullNameOf } from "@/lib/name"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

/*
 * Symbol und Ton je Aktion (§2.12). Record ueber den Enum-Typ ohne
 * Standardzweig: ein vierter Wert braeche den Typecheck, statt still ohne
 * Symbol zu erscheinen (Skill frontend-shadcn, Abschnitt 6).
 *
 * Der Ton ist Zugabe und nie die Aussage: die Aktion steht immer als Text
 * ueber dem Projekttitel, das Symbol daneben ist dekorativ (SC 1.4.1).
 */
const ACTION_ICONS: Record<
  Top10Action,
  ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
> = {
  ADDED: PlusIcon,
  REMOVED: MinusIcon,
  REORDERED: ArrowUpDownIcon,
}

const ACTION_TONES: Record<Top10Action, string> = {
  ADDED: "bg-pill-success-bg text-pill-success-fg",
  REMOVED: "bg-pill-danger-bg text-pill-danger-fg",
  REORDERED: "bg-pill-info-bg text-pill-info-fg",
}

/**
 * Das Top-10-Aenderungsprotokoll (Template „Top 10 Protokoll", Frame
 * {@code Admin · Top 10 Protokoll}; KAN-40): je Vorgang ein Ereignis mit
 * Symbol, Aktion, Projekt, Platzwechsel, Person und Zeitpunkt.
 *
 * <p><strong>Eine Ereignisliste, keine Tabelle.</strong> So zeigt es der
 * Frame, und Confluence nennt den Baustein „Aktivitaets-Eintrag (Log-Zeile)"
 * (Klaerungsrunde zu KAN-40). Das traegt auch schmale Fenster: der
 * Platzwechsel rueckt unter den Titel, statt eine Tabelle waagerecht
 * scrollen zu lassen (SC 1.4.10).
 *
 * <p><strong>Das Protokoll ist unveraenderlich</strong> (§3.17). Es gibt
 * keinen schreibenden Endpoint und kein Loeschen; die Liste bietet deshalb
 * keine Bearbeitung an, auch keine ausgegraute.
 *
 * <p><strong>Mehrere Zeilen mit derselben Uhrzeit sind normal.</strong>
 * {@code PUT /admin/top10} schreibt eine Zeile je bewegtem Projekt, alle mit
 * demselben Zeitpunkt (§3.17). Zusammengefasst wird trotzdem nichts: eine
 * Vorgangs-ID gibt es nicht, und ueber den Zeitstempel zu gruppieren waere
 * geraten.
 *
 * <p><strong>„von" nennt einen Namen und keine Rolle.</strong> Den Entzug
 * eines Platzes loest die Redaktion aus, wenn ein Projekt PUBLISHED
 * verlaesst; {@code admin} heisst „wer veranlasst hat" (§3.17).
 */
export function Top10AuditList({
  entries,
}: {
  entries: readonly Top10AuditEntryResponse[]
}) {
  const { t, i18n } = useTranslation()
  /* Herkunft fuer den Brotkrumenpfad des Ziels (KAN-80). */
  const origin = useBreadcrumbOrigin()
  const timestampFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => {
        const Icon = ACTION_ICONS[entry.action]
        return (
          <li key={entry.id}>
            <Card size="sm">
              <CardContent className="flex items-start gap-4">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-pill ${ACTION_TONES[entry.action]}`}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="type-label-xs text-muted-foreground uppercase">
                      {t(`top10.action.${entry.action}`)}
                    </span>
                    <span className="type-body-sm text-muted-foreground">
                      {timestampFormat.format(new Date(entry.timestamp))}
                    </span>
                  </div>

                  {/* Ein geloeschtes Projekt hinterlaesst eine Zeile ohne
                      Verweis (§3.17, on delete set null). Sie bleibt
                      stehen und wird nicht verlinkt: das Ziel gibt es
                      nicht mehr, und ein toter Link waere schlechter als
                      gar keiner. */}
                  {entry.project === null ? (
                    <p className="type-body font-semibold text-muted-foreground">
                      {t("administration.top10.audit.projectDeleted")}
                    </p>
                  ) : (
                    <h3 className="type-body font-semibold">
                      <Link
                        to={`/projects/${entry.project.id}`}
                        state={origin}
                        className="text-primary hover:underline focus-visible:underline"
                      >
                        {entry.project.title}
                      </Link>
                    </h3>
                  )}

                  <p className="type-body-sm text-muted-foreground">
                    {positionText(entry, t)}
                  </p>
                  <p className="type-body-sm text-muted-foreground">
                    {t("administration.top10.audit.by", {
                      person: fullNameOf(entry.admin),
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Der Platzwechsel als Satz.
 *
 * <p>Welche der beiden Positionen gesetzt ist, haengt an der Aktion (§3.17):
 * {@code ADDED} traegt nur {@code newPosition}, {@code REMOVED} nur
 * {@code previousPosition}, {@code REORDERED} beide. Gelesen wird trotzdem
 * der tatsaechliche Inhalt und nicht die Erwartung: eine leere Angabe
 * ergaebe sonst „auf Platz null".
 */
function positionText(
  entry: Top10AuditEntryResponse,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (entry.previousPosition !== null && entry.newPosition !== null) {
    return t("administration.top10.audit.moved", {
      from: entry.previousPosition,
      to: entry.newPosition,
    })
  }
  if (entry.newPosition !== null) {
    return t("administration.top10.audit.onto", { position: entry.newPosition })
  }
  if (entry.previousPosition !== null) {
    return t("administration.top10.audit.fromPosition", {
      position: entry.previousPosition,
    })
  }
  return t("administration.top10.audit.noPosition")
}
