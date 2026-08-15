import { ImageIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { ProjectReference } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Kachel eines Top-10-Platzes (Figma "Card (Top 5)" und "Frame (Top 10)").
 *
 * Die Felder entsprechen Top10EntryResponse (§3.11, §6.1): ein Platz
 * zwischen 1 und 10 und die Projektkachel dazu. Die Liste hat Luecken, der
 * Platz ist deshalb kein Index und wird immer aus position gezeigt, nie aus
 * der Position im Array.
 *
 * Zwei Varianten, wie im Design:
 * - feature: grosse Kachel, Text auf dem Cover. Die Startseite zeigt damit
 *   die vorderen Plaetze.
 * - compact: kleine Kachel, Text unter dem Cover, fuer die hinteren Plaetze.
 *
 * Die Rangziffer laeuft zweispurig: sichtbar zweistellig mit fuehrender Null
 * wie in Figma, vorgelesen als ganzer Satz. "06" allein liest ein
 * Screenreader je nach Stimme als "null sechs" vor und sagt nicht, wofuer
 * die Zahl steht.
 */
export function Top10Card({
  position,
  title,
  author,
  studyProgram,
  coverImageUrl,
  href,
  variant = "feature",
  className,
}: {
  position: number
  title: string
  author?: PersonName | null
  studyProgram?: ProjectReference | null
  coverImageUrl?: string | null
  href?: string
  variant?: "feature" | "compact"
  className?: string
}) {
  const { t } = useTranslation()
  const rank = (
    <span
      className={cn(
        "absolute z-10 flex items-center justify-center rounded-pill bg-card font-bold text-card-foreground",
        variant === "feature"
          ? "type-body top-5 left-5 size-9"
          : "type-label-xs top-5 left-5 size-6"
      )}
    >
      <span className="sr-only">{t("top10.position", { position })}</span>
      <span aria-hidden="true">{String(position).padStart(2, "0")}</span>
    </span>
  )

  const cover = coverImageUrl ? (
    <img src={coverImageUrl} alt="" className="size-full object-cover" />
  ) : (
    <div className="flex size-full items-center justify-center">
      <ImageIcon
        aria-hidden="true"
        className="size-8 text-cover-foreground/70"
      />
    </div>
  )

  const heading = (
    <h3
      className={
        variant === "feature"
          ? "type-h3 font-semibold"
          : "type-body-sm font-medium"
      }
    >
      {href ? (
        <a href={href} className="hover:underline focus-visible:underline">
          {title}
        </a>
      ) : (
        title
      )}
    </h3>
  )

  if (variant === "compact") {
    return (
      <Card size="sm" className={cn("relative", className)}>
        {rank}
        <CardContent className="flex flex-col gap-2.5">
          <div className="surface-cover h-28 overflow-hidden rounded-card">
            {cover}
          </div>
          {heading}
          {author && (
            <p className="type-body-sm font-medium text-muted-foreground">
              {fullNameOf(author)}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    /* Randabstand und Abstand der Kinder laufen ueber die kartei-eigene
       Variable auf null, statt py und gap zu ueberschreiben: die Kachel ist
       hier randlos, bleibt aber dieselbe Flaeche wie jede andere Karte
       (Ecken, Ring, overflow-hidden kommen aus der Primitive). */
    <Card
      className={cn(
        "surface-cover relative isolate min-h-79 justify-end [--card-spacing:--spacing(0)]",
        className
      )}
    >
      <div className="absolute inset-0 -z-10">{cover}</div>
      {/* Der Text liegt hier immer auf dem Cover. Auf dem Verlauf traegt er
          sich selbst, auf einem hochgeladenen Foto nicht: der Film sichert
          den Kontrast nach SC 1.4.3 unabhaengig vom Bild. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-linear-to-t from-cover-scrim to-transparent"
      />
      {rank}
      <CardContent className="flex flex-col gap-2 px-5 py-5 text-cover-foreground">
        {studyProgram && (
          <p className="type-label-xs text-cover-muted uppercase">
            {studyProgram.name}
          </p>
        )}
        {heading}
        {author && (
          <p className="type-body-sm font-semibold text-cover-muted">
            {fullNameOf(author)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
