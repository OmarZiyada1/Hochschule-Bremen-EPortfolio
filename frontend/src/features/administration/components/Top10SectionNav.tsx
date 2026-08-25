import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"

/**
 * Die beiden Ansichten der Top-10 als Umschalter (Frames {@code Admin ·
 * Top 10} und {@code Admin · Top 10 Protokoll}, KAN-40): Verwaltung und
 * Protokoll.
 *
 * <p><strong>Links und keine Registerkarten.</strong> Optisch ist es die
 * Leiste aus dem Frame, fachlich sind es zwei Routen: {@code /top10} und
 * {@code /top10/audit}. Die Primitive {@code tabs} waere hier die falsche
 * Zusage, denn sie verspricht mit {@code role="tab"} ein
 * {@code role="tabpanel"} im selben Dokument, das es nicht gibt; ein
 * Screenreader kuendigte „Registerkarte 1 von 2" an und faende danach
 * nichts. Eine Suche in der Registry ({@code search @shadcn -q "tabs
 * navigation"}) fuehrt zu keinem Eintrag fuer eine Navigationsleiste, es
 * gibt also auch nichts nachzubauen (Skill frontend-shadcn, Abschnitt 1).
 *
 * <p>Die Gestalt ist bewusst dieselbe wie beim {@code SegmentedFilter}:
 * aussen {@code rounded-card} (12px), innen {@code rounded-control} (8px),
 * dazwischen die 4px aus {@code p-1}. Zwei Leisten mit gleicher Aufgabe und
 * verschiedenem Aussehen waeren eine Inkonsistenz ohne Gewinn.
 *
 * <p><strong>Das Protokoll bekommt keinen eigenen Eintrag in der
 * Seitenleiste</strong>, es wird von hier aus geoeffnet (KAN-38). Der
 * Eintrag „Top 10" dort bleibt auch auf der Protokollseite markiert, weil
 * {@code isAdminNavActive} mit Praefix vergleicht.
 */
export function Top10SectionNav({ className }: { className?: string }) {
  const { t } = useTranslation()
  const location = useLocation()

  const entries = [
    {
      to: "/administration/top10",
      label: t("administration.top10.nav.manage"),
      /* Exakter Vergleich: der Pfad der Verwaltung ist Praefix des
         Protokolls, mit startsWith waeren beide zugleich markiert. */
      active: location.pathname.replace(/\/$/, "") === "/administration/top10",
    },
    {
      to: "/administration/top10/audit",
      label: t("administration.top10.nav.audit"),
      active: location.pathname.startsWith("/administration/top10/audit"),
    },
  ]

  return (
    <nav aria-label={t("administration.top10.nav.label")}>
      <ul
        className={cn(
          "inline-flex flex-wrap gap-1 rounded-card border bg-muted p-1 text-muted-foreground",
          className
        )}
      >
        {entries.map((entry) => (
          <li key={entry.to}>
            <Link
              to={entry.to}
              /* aria-current statt einer zweiten Auszeichnung: die aktive
                 Seite ist eine Eigenschaft des Links und keine Marke
                 daneben (SC 4.1.2). Die Faerbung allein traegt die Aussage
                 nicht (SC 1.4.1). */
              aria-current={entry.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-control px-4 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                entry.active
                  ? "bg-card text-foreground shadow-sm"
                  : "hover:text-foreground"
              )}
            >
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
