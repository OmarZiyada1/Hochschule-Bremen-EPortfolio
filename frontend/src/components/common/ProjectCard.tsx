import { ImageIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { useFileUrl } from "@/api/useFileUrl"
import type { ProjectCardResponse } from "@/api/types"
import { CardLinkOverlay } from "@/components/common/CardLinkOverlay"
import { ClapIcon } from "@/components/common/ClapIcon"
import { ProjectPeople } from "@/components/common/ProjectPeople"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Card, CardContent } from "@/components/ui/card"
import { peopleOfProject } from "@/lib/people"
import { cn } from "@/lib/utils"

/**
 * Projektkachel der Listenansichten (Figma "Project Card").
 *
 * Aufbau: eine Coverflaeche mit Studiengangskuerzel, Projektart und dem Titel,
 * darunter Autor:in, Teaser und eine Fusszeile aus Semester und
 * Reaktionszahl. Bis KAN-80 stand links das Fakultaetskuerzel; Fakultaet und
 * Studiengang nebeneinander sagten dieselbe Einordnung zweimal. Die Kachel nimmt die ProjectCardResponse aus §6.1 als
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
  href,
  showStatus = false,
  headingLevel = 3,
  action,
  className,
}: {
  /** Kacheldaten, unveraendert aus der Listen- oder Top-10-Antwort (§6.1). */
  project: ProjectCardResponse
  /**
   * Wohin die Kachel fuehrt. Ohne Angabe die oeffentliche Seite.
   *
   * <p>Entschieden wird das von der Seite und nicht hier: die Kachel weiss
   * nicht, aus welcher Liste sie kommt, und genau daran haengt die Antwort
   * (siehe {@code projectHref}). Unter „Mein Portfolio" fuehrt ein nicht
   * veroeffentlichtes Projekt in den Editor, in der Projektliste gibt es
   * ohnehin nur Veroeffentlichtes.
   */
  href?: string
  /** Status-Badge zeigen? Entscheidet die Seite nach §5, nicht die Kachel. */
  showStatus?: boolean
  /** Ebene der Titel-Ueberschrift, passend zur Seite darum herum. */
  headingLevel?: 2 | 3
  /**
   * Handlung in der Fusszeile, etwa "Bearbeiten" oder "Zurueckziehen" unter
   * "My Portfolio" (KAN-69). Sie ersetzt dort die Reaktionszahl: beide
   * teilen sich den Platz rechts vom Semester, und auf einer eigenen,
   * nicht veroeffentlichten Karte sagt eine Reaktionszahl nichts. Ob und
   * welche Handlung erscheint, entscheidet die Seite nach §5 und §4.1; die
   * Kachel bleibt reine Darstellung.
   */
  action?: ReactNode
  className?: string
}) {
  /* Ohne Angabe die oeffentliche Seite: das ist das Ziel jeder Liste, in
     der ohnehin nur Veroeffentlichtes steht. */
  const target = href ?? `/projects/${project.id}`

  const { t } = useTranslation()
  const Heading = `h${headingLevel}` as "h2" | "h3"

  /*
   * Das Kachelbild eines noch nicht veroeffentlichten Projekts ist nicht
   * oeffentlich (§3.15, §5): es wird deshalb mit Token geholt, sonst
   * antwortet der Server mit 401 und die Kachel zeigt einen leeren Rahmen.
   * Zu sehen war das unter „Mein Portfolio" und nach dem Einreichen. Bei
   * PUBLISHED bleibt es beim blossen Pfad, dort darf der Browser das Bild
   * zwischenspeichern (Befund aus KAN-36).
   */
  const cover = useFileUrl(
    project.coverImageUrl,
    project.status !== "PUBLISHED"
  )

  /* gap-0 und py-0 heben den Innenabstand der Registry-Karte auf: das Cover
     liegt randlos, den Abstand setzt erst der Inhalt darunter. Beides laeuft
     ueber className, die erzeugte Datei bleibt unberuehrt. */
  return (
    <Card className={cn("relative gap-0 py-0", className)}>
      <div className="surface-cover relative isolate">
        {/* Bildflaeche. Liegt ein Cover vor, fuellt es die Flaeche; sonst
            bleibt der Verlauf mit dem Platzhaltersymbol stehen. Das Symbol
            ist Dekoration und traegt keinen Namen: dass hier kein Bild ist,
            sagt der Vorlesende sonst bei jeder Kachel einer Liste erneut. */}
        <div className="relative h-47 w-full">
          {cover.url !== null ? (
            <>
              <img src={cover.url} alt="" className="size-full object-cover" />
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
          {/* Links das Fakultaetskuerzel, rechts die Projektart (KAN-83).
              KAN-80 hatte hier den Studiengang gesetzt und das Fakultaetsbadge
              entfernt, weil beide nebeneinander dieselbe Einordnung zweimal
              sagten. Die Doppelung bleibt aufgeloest, nur andersherum: auf der
              Kachel steht jetzt die grobe Einordnung, weil sie beim
              Ueberfliegen einer Liste die nuetzlichere ist. Vier Fakultaeten
              lassen sich im Kopf behalten, elf Studiengaenge nicht. Der
              Studiengang steht ausgeschrieben in den Projektdetails.

              Das Kuerzel laeuft zweispurig: sichtbar die Kurzform, vorgelesen
              der volle Name. Ueber title allein geht das nicht, den erreicht
              weder Tastatur noch Touch, und die meisten Screenreader lesen ihn
              an einem span gar nicht vor. */}
          {project.faculty ? (
            <span className="type-label-xs rounded-pill bg-cover-badge px-2.5 py-1 font-bold text-cover-muted">
              {project.faculty.abbreviation ? (
                <>
                  <span className="sr-only">{project.faculty.name}</span>
                  <span aria-hidden="true">{project.faculty.abbreviation}</span>
                </>
              ) : (
                /* Seit Contract v81 kann das nicht mehr eintreten; die
                   Referenz fuehrt das Feld weiterhin als nullable, weil
                   Kategorie und Semester keines haben. Den Namen dann zweimal
                   einzusetzen, sichtbar und sr-only, waere derselbe Text an
                   zwei Stellen. */
                project.faculty.name
              )}
            </span>
          ) : (
            /* Platzhalter, damit die Projektart rechts bleibt: ohne
               Fakultaet zoege justify-between sie sonst nach links. */
            <span />
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
          {/* Router-Link statt rohem Anker: ein roher href laedt die ganze
              Anwendung neu und wirft Query-Cache und Scrollposition weg
              (Review zu KAN-31, analog Top10Card). */}
          <Link to={target} className="hover:underline focus-visible:underline">
            {project.title}
          </Link>
        </Heading>
      </div>

      <CardContent className="flex flex-col gap-2.5 px-5 py-4">
        {/* Eine Person mit Namen, ab zwei die Gruppe mit Zaehler
            (Nacharbeit an KAN-40). Die Bilder kommen seit Contract v49 fuer
            die Autor:in und seit v78 auch fuer die Mitwirkenden an der
            Kachel mit; der Lesedienst holt sie fuer die ganze Seite in einer
            Abfrage. 24px nach Template (Figma-Knoten "Avatar"). */}
        <ProjectPeople
          people={peopleOfProject(project)}
          size="sm"
          className="text-muted-foreground"
        />

        {project.summary && (
          <p className="type-body-sm line-clamp-3 text-muted-foreground">
            {project.summary}
          </p>
        )}

        {showStatus && (
          <StatusBadge status={project.status} className="self-start" />
        )}

        {/* Ohne Bedingung: reactionCount kommt immer mit (§6.1), die
            Fusszeile steht also an jeder Kachel. */}
        <>
          {/* Ohne Klasse: die Grundregel in tokens.css gibt jedem Element
                border-color: var(--border), und genau das ist die Rolle fuer
                eine Linie. muted ist eine Flaechenrolle und hier falsch
                (Skill frontend-design, Abschnitt 1). */}
          <hr />
          <div className="flex items-center justify-between gap-2">
            <span className="type-label-xs text-muted-foreground">
              {project.semester?.name}
            </span>
            {action !== undefined ? (
              /* Ueber der Klickflaeche der Karte, sonst fuehrte ein Klick
                 auf „Bearbeiten" ins Projekt (KAN-80). */
              <span className="relative z-20">{action}</span>
            ) : (
              <span className="type-caption flex items-center gap-1 text-muted-foreground">
                {/* Klatschen, nicht Herz: die Reaktion ist ein Applaus
                        wie im Figma-Template und auf der Referenzplattform,
                        keine Gefaellt-mir-Angabe. */}
                <ClapIcon className="size-3.5" />
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
      </CardContent>

      {/* Die ganze Kachel fuehrt ins Projekt, nicht nur der Titel (KAN-80). */}
      <CardLinkOverlay to={target} />
    </Card>
  )
}
