import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

/**
 * Startseite, weiterhin als erkennbarer Platzhalter: die fachliche
 * Startseite entsteht mit KAN-31. Seit KAN-7 liegt die Seite unter der
 * Layout-Route; das main-Element und der ThemeToggle gehoeren jetzt dem
 * Anwendungsrahmen beziehungsweise der NavBar.
 */
export default function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="type-h1">{t("home.title")}</h1>

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
    </div>
  )
}
