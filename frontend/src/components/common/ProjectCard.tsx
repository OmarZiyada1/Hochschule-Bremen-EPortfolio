import { HeartIcon, ImageIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { ProjectReference, ProjectStatus, ProjectType } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Card, CardContent } from "@/components/ui/card"
import { fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Projektkachel der Listenansichten (Figma "Project Card").
 *
 * Aufbau: eine Coverflaeche mit Fakultaetskuerzel, Projektart und dem Titel,
 * darunter Autor:in, Teaser und eine Fusszeile aus Semester und
 * Reaktionszahl. Jedes Feld entspricht einem Feld aus ProjectCardResponse
 * (§6.1); nichts davon ist erfunden, und alles ausser dem Titel darf fehlen,
 * weil der Contract es im DRAFT als nullable fuehrt.
 *
 * Reine Darstellung, die Daten kommen ueber Props. Ob der Status ueberhaupt
 * erscheint, entscheidet die Seite anhand der Rechtematrix: in oeffentlichen
 * Listen ist alles PUBLISHED, dort bleibt status weg. Figma fuehrt ihn aus
 * demselben Grund als eigenen Slot und nicht als festen Bestandteil.
 *
 * Das h3 im Titel setzt die Ebene unterhalb der Listenueberschrift voraus
 * (h1 Seite, h2 Abschnitt).
 */
export function ProjectCard({
  title,
  summary,
  coverImageUrl,
  projectType,
  faculty,
  author,
  semester,
  reactionCount,
  status,
  href,
  className,
}: {
  title: string
  summary?: string | null
  coverImageUrl?: string | null
  projectType?: ProjectType | null
  faculty?: ProjectReference | null
  author?: PersonName | null
  semester?: string | null
  reactionCount?: number
  status?: ProjectStatus
  href?: string
  className?: string
}) {
  const { t } = useTranslation()

  /* gap-0 und py-0 heben den Innenabstand der Registry-Karte auf: das Cover
     liegt randlos, den Abstand setzt erst der Inhalt darunter. Beides laeuft
     ueber className, die erzeugte Datei bleibt unberuehrt. */
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <div className="surface-cover relative isolate">
        {/* Bildflaeche. Liegt ein Cover vor, fuellt es die Flaeche; sonst
            bleibt der Verlauf mit dem Platzhaltersymbol stehen. Das Symbol
            ist Dekoration und traegt keinen Namen: dass hier kein Bild ist,
            sagt der Vorlesende sonst bei jeder Kachel einer Liste erneut. */}
        <div className="relative h-47 w-full">
          {coverImageUrl ? (
            <>
              <img
                src={coverImageUrl}
                alt=""
                className="size-full object-cover"
              />
              {/* Ohne diesen Film gibt es fuer den weissen Titel auf einem
                  hochgeladenen Foto keine Kontrastzusage (SC 1.4.3). Auf dem
                  Verlauf ist der Kontrast berechenbar, dort entfaellt er. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-cover-scrim to-transparent"
              />
            </>
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon
                aria-hidden="true"
                className="size-8 text-cover-foreground/70"
              />
            </div>
          )}
        </div>

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {faculty && (
            /* Das Kuerzel ist kurz genug, um allein unverstaendlich zu sein,
               deshalb laeuft es zweispurig: sichtbar das Kuerzel, vorgelesen
               der volle Name. Ueber title allein geht das nicht, den erreicht
               weder Tastatur noch Touch, und die meisten Screenreader lesen
               ihn an einem span gar nicht vor. Ohne Kuerzel steht der Name
               einfach da; ihn dann zweimal einzusetzen, sichtbar und
               sr-only, waere derselbe Text an zwei Stellen. */
            <span className="type-label-xs rounded-pill bg-cover-badge px-2.5 py-1 font-bold text-cover-muted">
              {faculty.abbreviation ? (
                <>
                  <span className="sr-only">{faculty.name}</span>
                  <span aria-hidden="true">{faculty.abbreviation}</span>
                </>
              ) : (
                faculty.name
              )}
            </span>
          )}
          {projectType && (
            <span className="type-label-xs rounded-pill bg-card px-2.5 py-1 font-semibold text-card-foreground">
              {t(`project.type.${projectType}`)}
            </span>
          )}
        </div>

        {/* line-clamp ist hier keine Kosmetik: der Titel haengt am unteren
            Rand einer Flaeche fester Hoehe und waechst nach oben. Ohne
            Begrenzung laeuft ein langer Titel in die Badges am oberen Rand.
            Drei Zeilen wie beim Teaser. */}
        <h3 className="type-h3 absolute inset-x-3 bottom-3 line-clamp-3 font-semibold text-cover-foreground">
          {href ? (
            <a href={href} className="hover:underline focus-visible:underline">
              {title}
            </a>
          ) : (
            title
          )}
        </h3>
      </div>

      <CardContent className="flex flex-col gap-2.5 px-5 py-4">
        {author && (
          <p className="flex items-center gap-2">
            <UserAvatar person={author} className="type-label-xs" />
            <span className="type-body-sm font-medium text-muted-foreground">
              {fullNameOf(author)}
            </span>
          </p>
        )}

        {summary && (
          <p className="type-body-sm line-clamp-3 text-muted-foreground">
            {summary}
          </p>
        )}

        {status && <StatusBadge status={status} className="self-start" />}

        {(semester || reactionCount !== undefined) && (
          <>
            {/* Ohne Klasse: die Grundregel in tokens.css gibt jedem Element
                border-color: var(--border), und genau das ist die Rolle fuer
                eine Linie. muted ist eine Flaechenrolle und hier falsch
                (Skill frontend-design, Abschnitt 1). */}
            <hr />
            <div className="flex items-center justify-between gap-2">
              <span className="type-label-xs text-muted-foreground">
                {semester}
              </span>
              {reactionCount !== undefined && (
                <span className="type-caption flex items-center gap-1 text-muted-foreground">
                  <HeartIcon aria-hidden="true" className="size-3.5" />
                  {/* Die Zahl allein sagt nicht, was sie zaehlt. Sichtbar
                      bleibt sie knapp, vorgelesen wird der ganze Satz. */}
                  <span className="sr-only">
                    {t("project.card.reactions", { count: reactionCount })}
                  </span>
                  <span aria-hidden="true">{reactionCount}</span>
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
