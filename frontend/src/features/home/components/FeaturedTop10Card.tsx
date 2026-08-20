import { ArrowUpRightIcon, ImageIcon, TrophyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { Top10EntryResponse } from "@/api/types"
import { Pill } from "@/components/common/Pill"
import { Card, CardContent } from "@/components/ui/card"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Grosse Featured-Card fuer Platz 1 der Startseite (Template "Startseite
 * (Oeffentlich)"): Coverflaeche links, rechts Platz-Pille, Titel, Autor:in,
 * Link zur Detailseite, Teaser und Studiengang, dazu die grosse Rangziffer
 * als Wasserzeichen.
 *
 * Kein Top10Card-Zweig: das Template zeigt fuer Platz 1 einen eigenen
 * Aufbau mit Teaser und Aktionslink, den die Kachelvarianten feature und
 * compact nicht tragen (Ticket KAN-31 fuehrt die Featured-Card deshalb
 * getrennt von den Kacheln). Nur hier verwendet, daher im Feature-Ordner.
 *
 * Die Rangziffer laeuft zweispurig wie in Top10Card: die Pille nennt den
 * Platz als Satz, die grosse "01" ist Dekoration und bleibt aria-hidden.
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
  const author = project.author
    ? {
        firstName: project.author.firstName,
        lastName: project.author.lastName,
      }
    : null

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
            src={project.coverImageUrl}
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

      <CardContent className="relative flex flex-col gap-3 px-6 py-6 text-cover-foreground sm:px-8 sm:py-8">
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

        <h3 className="type-h1 max-w-md">{project.title}</h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {author && (
            <p className="type-body-sm font-semibold">{fullNameOf(author)}</p>
          )}
          {project.id && (
            <Link
              to={`/projects/${project.id}`}
              className="type-body-sm inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline focus-visible:underline"
            >
              {t("home.top10.viewProject")}
              <span className="sr-only">: {project.title}</span>
              <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </div>

        {project.summary && (
          <p className="type-body-sm line-clamp-2 max-w-md text-cover-muted">
            {project.summary}
          </p>
        )}

        {project.studyProgram && (
          <p className="type-label-xs text-cover-muted uppercase">
            {project.studyProgram.name}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
