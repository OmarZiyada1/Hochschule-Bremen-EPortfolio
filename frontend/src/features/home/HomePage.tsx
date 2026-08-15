import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { ThemeToggle } from "@/components/common/ThemeToggle"

/**
 * Startseite. KAN-6 baut keine fachliche Ansicht; diese Seite belegt nur,
 * dass Routing, i18n, Tokenschicht und Moduswechsel zusammen laufen. Die
 * eigentliche Startseite entsteht mit ihrem eigenen Ticket.
 */
export default function HomePage() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="type-h1">{t("home.title")}</h1>
        <ThemeToggle />
      </div>

      <p className="type-body text-muted-foreground">{t("home.intro")}</p>

      {/* Bewusst kein <nav>: ein Navigationsbereich ohne zugaenglichen Namen
          erscheint in der Landmark-Liste als zweites, unbenanntes
          "navigation" neben der Hauptnavigation aus KAN-7. Zwei Links, die
          es nur im Entwicklungs-Build gibt, rechtfertigen keine Landmarke. */}
      {import.meta.env.DEV ? (
        <div className="flex flex-col gap-2">
          <Link className="type-body text-primary underline" to="/dev/tokens">
            {t("home.tokenGallery")}
          </Link>
          <Link
            className="type-body text-primary underline"
            to="/dev/components"
          >
            {t("home.componentGallery")}
          </Link>
        </div>
      ) : null}
    </main>
  )
}
