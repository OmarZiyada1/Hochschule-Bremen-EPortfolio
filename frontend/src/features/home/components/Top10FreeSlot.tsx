import { TrophyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Pill } from "@/components/common/Pill"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

/**
 * Unbesetzter Platz der Top-10-Sektion: gestrichelte leere Flaeche mit
 * Platznummer, "Platz frei" und der Top-10-Pille (Template "Startseite
 * (Oeffentlich)"). Laut Ticket KAN-31 keine Kachelvariante, sondern eine
 * leere Flaeche; getragen wird sie von der empty-Primitive, wie es die
 * Inventarregel fuer Zustandsflaechen verlangt (Skill frontend-shadcn,
 * Abschnitt 1).
 *
 * EmptyState passt hier strukturell nicht: die Huelle rendert eine echte
 * Ueberschrift, und zehnmal "Platz frei" als h3 fuellte die
 * Sprungnavigation mit Abschnitten ohne Inhalt. Deshalb komponiert die
 * Flaeche die Primitive direkt, wie NotFoundPage es vormacht.
 *
 * Die Platznummer laeuft zweispurig wie in Top10Card: vorgelesen als Satz,
 * sichtbar zweistellig und aria-hidden.
 */
export function Top10FreeSlot({
  position,
  className,
}: {
  /** Platz 1 bis 10, der in der Antwort von GET /top10 fehlt. */
  position: number
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <Empty
      className={cn("h-full rounded-card border border-dashed", className)}
    >
      <EmptyHeader>
        <span className="type-body-sm font-semibold text-muted-foreground">
          <span className="sr-only">{t("top10.position", { position })}</span>
          <span aria-hidden="true">{String(position).padStart(2, "0")}</span>
        </span>
        <EmptyTitle className="type-label-xs tracking-widest text-muted-foreground uppercase">
          {t("home.top10.freeSlot")}
        </EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Pill tone="success" className="uppercase">
          <TrophyIcon aria-hidden="true" className="size-3" />
          {t("home.top10.freeBadge")}
        </Pill>
      </EmptyContent>
    </Empty>
  )
}
