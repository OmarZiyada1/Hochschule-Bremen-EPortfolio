import { HeartIcon, ImageIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { ProjectCardResponse } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Card, CardContent } from "@/components/ui/card"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Projektkachel der Listenansichten (Figma "Project Card").
 *
 * Aufbau: eine Coverflaeche mit Fakultaetskuerzel, Projektart und dem Titel,
 * darunter Autor:in, Teaser und eine Fusszeile aus Semester und
 * Reaktionszahl. Die Kachel nimmt die ProjectCardResponse aus §6.1 als
 * Ganzes entgegen (Review zu KAN-8): jede Verwendung reicht `project`
 * durch, statt die Felder einzeln zu verdrahten; nichts davon ist erfunden,
 * und alles ausser dem Titel darf fehlen, weil der Contract es im DRAFT als
 * nullable fuehrt.
 *
 * Reine Darstellung. Ob der Status erscheint, entscheidet die Seite ueber
 * `showStatus` anhand der Rechtematrix: die Projektbibliothek zeigt nur
 * PUBLISHED, dort unterschiede ein Badge nichts; angemeldete eigene
 * Ansichten ("Mein Portfolio", Administrationsseite) schalten es zu.
 *
 * Die Ueberschriftenebene des Titels setzt die Seite, wie bei EmptyState:
 * unter einem Abschnitts-h2 bleibt es beim Standard h3, liegt die Liste
 * direkt unter dem Seiten-h1, uebergibt die Seite Ebene 2. Ein fester Wert
 * erzeugte dort einen Sprung h1 zu h3, und die Sprungnavigation eines
 * Screenreaders faende keinen Abschnitt dazwischen (SC 1.3.1).
 */
export function ProjectCard({
  project,
  showStatus = false,
  headingLevel = 3,
  className,
}: {
  /** Kacheldaten, unveraendert aus der Listen- oder Top-10-Antwort (§6.1). */
  project: ProjectCardResponse
  /** Status-Badge zeigen? Entscheidet die Seite nach §5, nicht die Kachel. */
  showStatus?: boolean
  /** Ebene der Titel-Ueberschrift, passend zur Seite darum herum. */
  headingLevel?: 2 | 3
  className?: string
}) {
  const { t } = useTranslation()
  const Heading = `h${headingLevel}` as "h2" | "h3"

  /* springdoc markiert kein required; ein Konto ohne Namen gibt es fachlich
     nicht, die Kachel zeigt dann nichts statt "undefined". */
  const author = project.author
    ? {
        firstName: project.author.firstName ?? "",
        lastName: project.author.lastName ?? "",
      }
    : null
  const href = project.id ? `/projects/${project.id}` : undefined

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
          {project.coverImageUrl ? (
            <>
              <img
                src={project.coverImageUrl}
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
          {project.faculty && (
            /* Das Kuerzel ist kurz genug, um allein unverstaendlich zu sein,
               deshalb laeuft es zweispurig: sichtbar das Kuerzel, vorgelesen
               der volle Name. Ueber title allein geht das nicht, den erreicht
               weder Tastatur noch Touch, und die meisten Screenreader lesen
               ihn an einem span gar nicht vor. Ohne Kuerzel steht der Name
               einfach da; ihn dann zweimal einzusetzen, sichtbar und
               sr-only, waere derselbe Text an zwei Stellen. */
            <span className="type-label-xs rounded-pill bg-cover-badge px-2.5 py-1 font-bold text-cover-muted">
              {project.faculty.abbreviation ? (
                <>
                  <span className="sr-only">{project.faculty.name}</span>
                  <span aria-hidden="true">{project.faculty.abbreviation}</span>
                </>
              ) : (
                project.faculty.name
              )}
            </span>
          )}
          {project.projectType && (
            <span className="type-label-xs rounded-pill bg-card px-2.5 py-1 font-semibold text-card-foreground">
              {t(`project.type.${project.projectType}`)}
            </span>
          )}
        </div>

        {/* line-clamp ist hier keine Kosmetik: der Titel haengt am unteren
            Rand einer Flaeche fester Hoehe und waechst nach oben. Ohne
            Begrenzung laeuft ein langer Titel in die Badges am oberen Rand.
            Drei Zeilen wie beim Teaser. */}
        <Heading className="type-h3 absolute inset-x-3 bottom-3 line-clamp-3 font-semibold text-cover-foreground">
          {href ? (
            <a href={href} className="hover:underline focus-visible:underline">
              {project.title ?? ""}
            </a>
          ) : (
            (project.title ?? "")
          )}
        </Heading>
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

        {project.summary && (
          <p className="type-body-sm line-clamp-3 text-muted-foreground">
            {project.summary}
          </p>
        )}

        {showStatus && project.status && (
          <StatusBadge status={project.status} className="self-start" />
        )}

        {(project.semester || project.reactionCount !== undefined) && (
          <>
            {/* Ohne Klasse: die Grundregel in tokens.css gibt jedem Element
                border-color: var(--border), und genau das ist die Rolle fuer
                eine Linie. muted ist eine Flaechenrolle und hier falsch
                (Skill frontend-design, Abschnitt 1). */}
            <hr />
            <div className="flex items-center justify-between gap-2">
              <span className="type-label-xs text-muted-foreground">
                {project.semester}
              </span>
              {project.reactionCount !== undefined && (
                <span className="type-caption flex items-center gap-1 text-muted-foreground">
                  <HeartIcon aria-hidden="true" className="size-3.5" />
                  {/* Die Zahl allein sagt nicht, was sie zaehlt. Sichtbar
                      bleibt sie knapp, vorgelesen wird der ganze Satz. */}
                  <span className="sr-only">
                    {t("project.card.reactions", {
                      count: project.reactionCount,
                    })}
                  </span>
                  <span aria-hidden="true">{project.reactionCount}</span>
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
