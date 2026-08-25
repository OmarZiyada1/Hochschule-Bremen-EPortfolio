import { useTranslation } from "react-i18next"
import { Outlet, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { resolveApiUrl } from "@/api/client"
import { Footer } from "@/components/layout/Footer"
import { NavBar } from "@/components/layout/NavBar"
import { useOwnPortfolio } from "@/features/portfolio/hooks/usePortfolio"
import { BreadcrumbProvider } from "@/routes/AppBreadcrumb"
import { navLinksFor, userMenuFor } from "@/routes/navLinks"

/**
 * Anwendungsrahmen: Sprunglink, Kopfleiste, Inhaltsbereich, Fusszeile
 * (Ticket KAN-7, Umfang 1). Die Seitenrouten liegen als Kinder unter
 * dieser Layout-Route; ausserhalb stehen die Auth-Seiten (AuthLayout),
 * der Editor (EditorRoute, eigene Kopfzeile ohne NavBar und Footer),
 * die 404-Seite und die /dev-Pruefflaechen.
 *
 * Der Sprunglink ist das erste fokussierbare Element (SC 2.4.1): ohne ihn
 * durchlaeuft jede Tastaturbedienung auf jeder Seite erneut die gesamte
 * Navigation. Sichtbar wird er erst mit dem Fokus.
 *
 * <p>Seit KAN-80 zeichnet der Rahmen auch das Brotkrumenband, und zwar
 * innerhalb der {@code main}-Landmarke: Es beschreibt, wo im Inhalt man ist,
 * und der Sprunglink soll davor landen und nicht dahinter.
 */
export function AppLayout() {
  const { t } = useTranslation()
  const { user, role, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  /*
   * Das Profilbild der Kopfleiste kommt aus GET /api/portfolio/me: der
   * Avatar haengt am Portfolio und nicht am User, UserResponse fuehrt ihn
   * deshalb nicht (§3.2). Nur fuer Angemeldete, sonst waere der Aufruf ein
   * sicherer 401. Die Abfrage teilt sich ihren Cache-Eintrag mit den
   * Portfolio-Seiten, laeuft also einmal je Sitzung und nicht je Seite.
   * Schlaegt sie fehl, bleibt es bei den Initialen; ein fehlendes Bild ist
   * kein Fehlerfall der Kopfleiste.
   */
  const { data: portfolio } = useOwnPortfolio(isAuthenticated)

  return (
    <div className="relative flex min-h-svh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-control focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md"
      >
        {t("common.nav.skipToContent")}
      </a>
      <NavBar
        user={
          user
            ? {
                /* springdoc markiert kein required; ein Konto ohne Namen
                   gibt es fachlich nicht, die Leiste zeigt dann nichts
                   statt "undefined". */
                firstName: user.firstName,
                lastName: user.lastName,
                /* Die Referenz /api/files/{id} wird hier zur abrufbaren
                   Adresse, wie in der Profilkarte (§3.15.1). */
                avatarUrl: portfolio?.avatarUrl
                  ? resolveApiUrl(portfolio.avatarUrl)
                  : undefined,
              }
            : null
        }
        role={role}
        links={navLinksFor(role)}
        menuItems={userMenuFor(role)}
        activeHref={location.pathname}
        onLogout={() => {
          /* Nach der Abmeldung zurueck auf die Startseite: die aktuelle
             Route kann geschuetzt sein und wuerde sonst sofort zum Login
             umleiten, was nach einer gewollten Abmeldung irritiert. */
          void logout().then(() => navigate("/"))
        }}
      />
      <main id="content" className="flex-1">
        {/* Das Brotkrumenband steht im Rahmen und nicht mehr in jeder Seite
            (KAN-80): es gehoert zur Orientierung wie die Kopfleiste, und je
            Seite geschrieben fehlte es zuletzt auf der Administrationsseite
            und unter „Meine Reviews" ganz. Der Pfad wird aus der Route
            abgeleitet; Seiten mit eigenem Namen melden ihn ueber
            useBreadcrumbTitle nach. */}
        <BreadcrumbProvider>
          <Outlet />
        </BreadcrumbProvider>
      </main>
      <Footer />
    </div>
  )
}
