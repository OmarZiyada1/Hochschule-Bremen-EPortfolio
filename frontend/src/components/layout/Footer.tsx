import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { HsbKeyLogo } from "@/components/common/HsbKeyLogo"

/*
 * Statische Links ohne Serverdaten, in den zwei Spalten des Designs. Jedes
 * Ziel steht im Routenbaum aus KAN-7: /study-programs und /faq sind mit
 * der Klaerungsrunde zu KAN-7 entfallen, weil dahinter weder Template noch
 * Ticket steht; ein Link auf die 404-Seite waere eine Attrappe. Kommen die
 * Seiten zurueck, ist das ein eigener Punkt und keine stille
 * Wiedereinfuehrung.
 */
const footerGroups = [
  {
    key: "platform",
    links: [
      { key: "projects", href: "/projects" },
      /*
       * Der zweite Einstieg ins Kontaktformular (KAN-85). Er steht
       * ausgerechnet in der Fusszeile, weil sie auch erreicht, wer sich
       * gerade nicht anmelden kann, und das ist der haeufigste
       * Support-Fall. Der zweite Einstieg liegt im Nutzermenue
       * (routes/navLinks.ts), fuer alle, die mitten in der Arbeit sind.
       */
      { key: "support", href: "/support" },
    ],
  },
  {
    key: "legal",
    links: [
      { key: "imprint", href: "/imprint" },
      { key: "privacy", href: "/privacy" },
      { key: "accessibility", href: "/accessibility" },
    ],
  },
]

/**
 * Fusszeile der Anwendung (Figma "Footer"): Bildmarke, Beschreibung, zwei
 * Linkspalten und die Zeile mit Urheberrecht.
 *
 * Reine Darstellung ohne Serverdaten; KAN-7 bindet sie an den
 * Anwendungsrahmen an. Jede Spalte ist eine eigene nav mit eigenem Namen:
 * zwei gleichnamige Navigationen auf einer Seite sind fuer eine
 * Sprungliste nicht zu unterscheiden (SC 1.3.1).
 *
 * Das Jahr kommt aus der Laufzeit und steht nicht im Text: eine feste
 * Jahreszahl ist am 1. Januar still falsch.
 */
export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-14 pb-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-brand text-surface-brand-foreground"
              >
                <HsbKeyLogo className="h-6 w-auto" />
              </span>
              <span className="flex flex-col">
                <span className="type-nav-brand-lg font-semibold text-accent-foreground">
                  {t("app.institution")}
                </span>
                <span className="type-label-xs text-muted-foreground uppercase">
                  {t("app.productLabel")}
                </span>
              </span>
            </div>
            <p className="type-body-sm max-w-105 text-muted-foreground">
              {t("common.footer.description")}
            </p>
          </div>

          <div className="flex gap-14">
            {footerGroups.map((group) => (
              <nav
                key={group.key}
                aria-label={t(`common.footer.group.${group.key}`)}
                className="flex flex-col gap-3.5"
              >
                <p className="type-label-xs font-semibold text-accent-foreground uppercase">
                  {t(`common.footer.group.${group.key}`)}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        to={link.href}
                        className="type-body-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {t(`common.footer.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-2 border-t pt-6 sm:flex-row sm:items-center">
          <p className="type-caption text-muted-foreground">
            {t("common.footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="type-label-xs text-muted-foreground">
            {t("common.footer.tagline")}
          </p>
        </div>
      </div>
    </footer>
  )
}
