import { ArrowUpRightIcon, ImageIcon, TrophyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { resolveApiUrl } from "@/api/client"
import type { Top10EntryResponse } from "@/api/types"
import { CardLinkOverlay } from "@/components/common/CardLinkOverlay"
import { Pill } from "@/components/common/Pill"
import { ProjectPeople } from "@/components/common/ProjectPeople"
import { Card, CardContent } from "@/components/ui/card"
import { peopleOfProject } from "@/lib/people"
import { cn } from "@/lib/utils"

/**
 * Grosse Featured-Card fuer Platz 1 der Startseite (Template "Startseite
 * (Oeffentlich)"): Coverflaeche links, rechts Platz-Pille, Studiengang,
 * Titel, Teaser und die Zeile aus Personen und Detail-Link, dazu die grosse
 * Rangziffer als Wasserzeichen.
 *
 * Kein Top10Card-Zweig: das Template zeigt fuer Platz 1 einen eigenen
 * Aufbau mit Teaser und Aktionslink, den die Kachelvarianten feature und
 * compact nicht tragen (Ticket KAN-31 fuehrt die Featured-Card deshalb
 * getrennt von den Kacheln). Nur hier verwendet, daher im Feature-Ordner.
 *
 * Die Rangziffer laeuft zweispurig wie in Top10Card: die Pille nennt den
 * Platz als Satz, die grosse "01" ist Dekoration und bleibt aria-hidden.
 *
 * <p><strong>Die Reihenfolge folgt den Kacheln daneben, nicht dem
 * Frame.</strong> Der Figma-Frame {@code 359:13} setzt an dieser Karte den
 * Studiengang ganz nach unten und die Personenzeile zwischen Titel und
 * Teaser, waehrend die vier Kacheln in derselben Reihe den Studiengang ueber
 * den Titel stellen. Zwei Anordnungen desselben Inhalts nebeneinander lesen
 * sich als zwei verschiedene Sachen; entschieden ist deshalb die der Kacheln
 * (Nacharbeit an KAN-40, Vorlage vom 25.08.2026): Studiengang, Titel,
 * Teaser, Personen. Der Teaser steht damit auch hier direkt unter dem Titel,
 * den er fortsetzt.
 */
export function FeaturedTop10Card({
  entry,
  className,
}: {
  /** Eintrag unveraendert aus GET /top10 (§3.11, §6.1). */
  entry: Top10EntryResponse
  className?: string
}) {
  const { t } = useTranslation()
  const project = entry.project

  /* springdoc markiert kein required; einen Eintrag ohne Projekt gibt es
     fachlich nicht (§3.11, projectId not null). */
  if (project === undefined) {
    return null
  }

  const position = entry.position ?? 1
  const people = peopleOfProject(project)

  return (
    <Card
      className={cn(
        "surface-cover relative isolate gap-0 overflow-hidden py-0 sm:grid sm:grid-cols-2",
        className
      )}
    >
      {/* Coverflaeche: Bild, sonst der Verlauf der Karte mit dem
          Platzhaltersymbol. Das Symbol ist Dekoration ohne Namen, wie in
          ProjectCard. */}
      <div className="relative min-h-48 sm:min-h-72">
        {project.coverImageUrl ? (
          <img
            /* Wie in ProjectCard ueber resolveApiUrl: die Adresse laeuft
               nie durch request() und muesste die Basis-URL sonst selbst
               tragen. */
            src={resolveApiUrl(project.coverImageUrl)}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon
              aria-hidden="true"
              className="size-10 text-cover-foreground/70"
            />
          </div>
        )}
      </div>

      <CardContent className="relative flex flex-col px-6 py-6 text-cover-foreground sm:px-8 sm:py-8">
        <span
          aria-hidden="true"
          className="type-num-rank pointer-events-none absolute top-2 right-6 font-bold text-cover-foreground/15"
        >
          {String(position).padStart(2, "0")}
        </span>

        <Pill tone="warning" className="self-start uppercase">
          <TrophyIcon aria-hidden="true" className="size-3" />
          {t("top10.position", { position })}
        </Pill>

        {/* Die Pille bleibt oben, der Text sitzt in der Mitte der Restflaeche.
            Ein fester Abstand darunter waere hier eine Zahl, die nur bei einer
            Karte stimmt: die Hoehe kommt aus der Coverspalte daneben, und die
            waechst mit der Breite des Fensters.

            Der Abstand nach oben ist mit KAN-80 gewachsen: Platzpille und
            Rangziffer standen dem Studiengang darunter zu nah und lasen sich
            als eine Zeile mit ihm. Jetzt trennt sie eine klare Lucke, und die
            Ziffer hat den Raum, den ihre Groesse braucht. */}
        <div className="flex flex-1 flex-col justify-center gap-3 pt-10 sm:pt-16">
          {/* Studiengang, Titel, Teaser, Personen: dieselbe Reihenfolge wie
              in den Kacheln der Reihe darunter (Top10Card). Overline statt
              type-label-xs wie dort, weil die Zeile hier ueber dem Titel als
              Vorspann gelesen wird und nicht als Beschriftung darunter. */}
          {project.studyProgram && (
            <p className="type-overline text-cover-muted">
              {project.studyProgram.name}
            </p>
          )}

          <h3 className="type-h1 max-w-md">{project.title}</h3>

          {/* Erst der Teaser, dann die Personen: die Karte erzaehlt, worum es
              geht, bevor sie sagt, wer daran gearbeitet hat. Bis zur
              Nacharbeit an KAN-40 stand die Namenszeile zwischen Titel und
              Teaser und trennte damit zwei Dinge, die zusammengehoeren. */}
          {project.summary && (
            <p className="type-body-sm line-clamp-2 max-w-md text-cover-muted">
              {project.summary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* Auf dem Cover, deshalb der Cover-Ton: text-muted-foreground
                haelt dort die Kontrastzusage nicht (SC 1.4.3). */}
            <ProjectPeople
              people={people}
              className="font-semibold text-cover-foreground"
            />
            {project.id && (
              <>
                {/* Trennpunkt statt eines blossen Abstands: Personen und
                    Aktion stehen in einer Zeile und sind zweierlei. Er ist
                    Dekoration und bleibt aus dem vorgelesenen Text heraus,
                    sonst spraeche der Screenreader ihn als Wort mit. */}
                {people.length > 0 && (
                  <span aria-hidden="true" className="text-cover-muted">
                    &middot;
                  </span>
                )}
                <Link
                  to={`/projects/${project.id}`}
                  className="type-body-sm relative z-20 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline focus-visible:underline"
                >
                  {t("home.top10.viewProject")}
                  <span className="sr-only">: {project.title}</span>
                  <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* Die ganze Karte fuehrt ins Projekt, nicht nur „Projekt ansehen"
          (KAN-80). */}
      {project.id && <CardLinkOverlay to={`/projects/${project.id}`} />}
    </Card>
  )
}
