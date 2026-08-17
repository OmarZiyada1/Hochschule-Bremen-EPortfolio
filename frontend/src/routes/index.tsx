import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from "react-router-dom"

import ChangePasswordPage from "@/features/auth/ChangePasswordPage"
import ComponentGalleryPage from "@/features/token-gallery/ComponentGalleryPage"
import ForgotPasswordPage from "@/features/auth/ForgotPasswordPage"
import HomePage from "@/features/home/HomePage"
import LoginPage from "@/features/auth/LoginPage"
import NotFoundPage from "@/features/not-found/NotFoundPage"
import ProjectListPage from "@/features/projects/ProjectListPage"
import RegisterDetailsPage from "@/features/auth/RegisterDetailsPage"
import RegisterDonePage from "@/features/auth/RegisterDonePage"
import RegisterVerifyEmailPage from "@/features/auth/RegisterVerifyEmailPage"
import RegisterVerifyHsbEmailPage from "@/features/auth/RegisterVerifyHsbEmailPage"
import ResetPasswordPage from "@/features/auth/ResetPasswordPage"
import TokenGalleryPage from "@/features/token-gallery/TokenGalleryPage"
import { AppLayout } from "@/routes/AppLayout"
import { AuthLayout } from "@/routes/AuthLayout"
import { PlaceholderPage } from "@/routes/PlaceholderPage"
import { RequireAuth } from "@/routes/RequireAuth"
import { RequireRole } from "@/routes/RequireRole"

/**
 * Routenbaum der Anwendung (Ticket KAN-7, Umfang 2). Die Pfade sind
 * englisch und dort verbindlich festgelegt; die sichtbaren Beschriftungen
 * kommen aus i18n. Jede Template-Seite hat eine Route mit erkennbarem
 * Platzhalter, bis ihr eigenes Ticket sie ersetzt; die Zuordnung Route zu
 * Ticket steht auf der Confluence-Seite "Template-Abdeckung".
 *
 * Die Zugriffsebenen (Contract 2.1, 5) liegen als elternlose
 * Wrapper-Routen im Baum: "angemeldet" fuer das eigene Profil, STUDENT
 * oder EDITOR fuer eigene Projekte (nicht ADMIN, Fussnote 10), EDITOR oder
 * ADMIN fuer die Redaktion, ADMIN fuer die Administrationsseite.
 *
 * /projects/new steht bewusst vor /projects/:projectId, sonst wuerde "new"
 * als Projekt-ID gelesen.
 *
 * Die 404-Auffangroute steht als letzte Route ausserhalb der Layout-Route
 * (Template ohne NavBar, eigene Fusszeile); alle uebrigen Seitenrouten
 * liegen im Anwendungsrahmen.
 *
 * /dev/tokens und /dev/components sind die Prueffflaechen aus KAN-6 und
 * KAN-29. Sie liegen ausserhalb der Layout-Route, damit NavBar und Footer
 * sie nicht ueberlagern, und existieren nur im Entwicklungs-Build:
 * import.meta.env.DEV ist im Produktions-Build eine Konstante, der Zweig
 * faellt beim Buendeln weg.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      {
        /* Durchstich aus KAN-8: echte Liste statt Platzhalter; Filter,
           Suche und Paginierung folgen mit KAN-31. */
        path: "/projects",
        element: <ProjectListPage />,
      },
      {
        element: <RequireRole roles={["STUDENT", "EDITOR"]} />,
        children: [
          {
            path: "/projects/new",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.projectNew"
                ticket="KAN-35"
              />
            ),
          },
          {
            path: "/projects/:projectId/metadata",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.projectMetadata"
                ticket="KAN-35"
              />
            ),
          },
          {
            path: "/projects/:projectId/editor",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.projectEditor"
                ticket="KAN-36"
              />
            ),
          },
        ],
      },
      {
        path: "/projects/:projectId",
        element: (
          <PlaceholderPage
            titleKey="placeholder.title.projectDetail"
            ticket="KAN-32"
          />
        ),
      },
      {
        path: "/portfolios/:userId",
        element: (
          <PlaceholderPage
            titleKey="placeholder.title.portfolio"
            ticket="KAN-34"
          />
        ),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "/my-portfolio",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.myPortfolio"
                ticket="KAN-34"
              />
            ),
          },
          {
            path: "/my-portfolio/profile",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.profile"
                ticket="KAN-34"
              />
            ),
          },
        ],
      },
      {
        element: <RequireRole roles={["EDITOR", "ADMIN"]} />,
        children: [
          {
            path: "/reviews",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.reviews"
                ticket="KAN-37"
              />
            ),
          },
          {
            path: "/projects/:projectId/review",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.projectReview"
                ticket="KAN-37"
              />
            ),
          },
        ],
      },
      {
        element: <RequireRole roles={["ADMIN"]} />,
        children: [
          {
            path: "/administration",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.administration"
                ticket="KAN-38"
              />
            ),
          },
          {
            path: "/administration/projects",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.adminProjects"
                ticket="KAN-38"
              />
            ),
          },
          {
            path: "/administration/users",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.adminUsers"
                ticket="KAN-39"
              />
            ),
          },
          {
            path: "/administration/categories",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.adminCategories"
                ticket="KAN-39"
              />
            ),
          },
          {
            path: "/administration/study-structure",
            element: (
              <PlaceholderPage
                titleKey="placeholder.title.adminStudyStructure"
                ticket="KAN-39"
              />
            ),
          },
          {
            /* Das Protokoll liegt unter der Top-10-Verwaltung, weil es
               deren Verlauf zeigt; die Verwaltung selbst ist die
               Index-Route (Ticket KAN-7, Umfang 2). */
            path: "/administration/top10",
            children: [
              {
                index: true,
                element: (
                  <PlaceholderPage
                    titleKey="placeholder.title.adminTop10"
                    ticket="KAN-40"
                  />
                ),
              },
              {
                path: "audit",
                element: (
                  <PlaceholderPage
                    titleKey="placeholder.title.adminTop10Audit"
                    ticket="KAN-40"
                  />
                ),
              },
            ],
          },
        ],
      },
      {
        /* Statische Fussbereich-Seiten ohne eigenes Ticket (Klaerungsrunde
           KAN-7): der Footer verlinkt sie, also fuehren sie nicht auf die
           404-Seite. */
        path: "/imprint",
        element: <PlaceholderPage titleKey="placeholder.title.imprint" />,
      },
      {
        path: "/privacy",
        element: <PlaceholderPage titleKey="placeholder.title.privacy" />,
      },
      {
        path: "/accessibility",
        element: <PlaceholderPage titleKey="placeholder.title.accessibility" />,
      },
    ],
  },
  {
    /* Anmeldung, Registrierung und die Passwort-Seiten liegen ausserhalb
       des Anwendungsrahmens: ihre Templates blenden NavBar und Footer aus
       (Review zu KAN-8; die fruehere Festlegung aus der Klaerungsrunde zu
       KAN-7 ist ueberholt). Fuer die Passwort-Seiten hat das die
       Klaerungsrunde zu KAN-33 entschieden: sie haben kein eigenes
       Template und folgen dem Kartenstil der uebrigen Auth-Seiten. */
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        /* Die kurze, von Hand eingetippte Adresse laeuft nicht ins Leere;
           verbindlich ist die lange Form (Ticket KAN-7, Umfang 2). Erster
           Schritt sind die Angaben: eine Rollenauswahl gibt es seit
           Contract v41 nicht mehr (KAN-63). */
        path: "/register",
        element: <Navigate to="/register/details" replace />,
      },
      { path: "/register/details", element: <RegisterDetailsPage /> },
      { path: "/register/verify-email", element: <RegisterVerifyEmailPage /> },
      {
        path: "/register/verify-hsb-email",
        element: <RegisterVerifyHsbEmailPage />,
      },
      { path: "/register/done", element: <RegisterDonePage /> },
      {
        /* Bewusst ohne RequireAuth-Wrapper: der leitet bei gesetztem
           passwordChangeRequired genau hierher um und wuerde auf dieser
           Seite eine Schleife bauen. Den Anmelde-Guard fuehrt die Seite
           selbst (Contract 6.7). */
        path: "/change-password",
        element: <ChangePasswordPage />,
      },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
    ],
  },
  ...(import.meta.env.DEV
    ? [
        { path: "/dev/tokens", element: <TokenGalleryPage /> },
        { path: "/dev/components", element: <ComponentGalleryPage /> },
      ]
    : []),
  /* Die Auffangroute liegt ausserhalb der Layout-Route: ihr Template
     fuehrt keine NavBar, nur den zentrierten Inhalt mit dem Weg zurueck
     und eine eigene einzeilige Fusszeile. */
  { path: "*", element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
