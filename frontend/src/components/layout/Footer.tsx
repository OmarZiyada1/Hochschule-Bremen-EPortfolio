import { useTranslation } from "react-i18next"

import { Separator } from "@/components/ui/separator"

/*
 * Statische Links ohne Serverdaten. Die Ziele existieren als Routen erst
 * mit ihren Tickets; die Pfade sind hier trotzdem fest, damit nicht jede
 * Seite eigene erfindet.
 */
const footerLinks = [
  { key: "imprint", href: "/imprint" },
  { key: "privacy", href: "/privacy" },
  { key: "contact", href: "/contact" },
]

/**
 * Fusszeile der Anwendung: Projektname und statische Links, keine
 * Serverdaten. Reine Darstellung; KAN-7 bindet sie an den
 * Anwendungsrahmen an.
 */
export function Footer() {
  const { t } = useTranslation()
  return (
    <footer>
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <p className="type-body-sm text-muted-foreground">{t("app.name")}</p>
        <nav aria-label={t("common.footer.label")}>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.key}>
                <a
                  href={link.href}
                  className="type-body-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t(`common.footer.${link.key}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
