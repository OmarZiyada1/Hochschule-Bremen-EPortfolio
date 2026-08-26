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
import MyPortfolioPage from "@/features/portfolio/MyPortfolioPage"
import NotFoundPage from "@/features/not-found/NotFoundPage"
import ProfileEditPage from "@/features/portfolio/ProfileEditPage"
import ProjectDetailPage from "@/features/projects/ProjectDetailPage"
import ProjectListPage from "@/features/projects/ProjectListPage"
import NewProjectPage from "@/features/projects/NewProjectPage"
import ProjectMetadataPage from "@/features/projects/ProjectMetadataPage"
import { AdministrationLayout } from "@/features/administration/AdministrationLayout"
import ProjectReviewPage from "@/features/reviews/ProjectReviewPage"
import PublicPortfolioPage from "@/features/portfolio/PublicPortfolioPage"
import RegisterDetailsPage from "@/features/auth/RegisterDetailsPage"
import RegisterDonePage from "@/features/auth/RegisterDonePage"
import RegisterVerifyEmailPage from "@/features/auth/RegisterVerifyEmailPage"
import RegisterVerifyHsbEmailPage from "@/features/auth/RegisterVerifyHsbEmailPage"
import ResetPasswordPage from "@/features/auth/ResetPasswordPage"
import ReviewListPage from "@/features/reviews/ReviewListPage"
import TokenGalleryPage from "@/features/token-gallery/TokenGalleryPage"
import {
  AdminCategoryListRoute,
  AdminDashboardRoute,
  AdminProjectListRoute,
  AdminSemesterListRoute,
  AdminStudyStructureRoute,
  AdminTop10AuditRoute,
  AdminTop10Route,
  AdminUserListRoute,
} from "@/routes/AdministrationRoute"
import { AppLayout } from "@/routes/AppLayout"
import { AuthLayout } from "@/routes/AuthLayout"
import { EditorLayout } from "@/routes/EditorLayout"
import { EditorRoute } from "@/routes/EditorRoute"
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
 * Wrapper-Routen im Baum: "angemeldet" fuer das eigene Profil und fuer
 * eigene Projekte, EDITOR oder ADMIN fuer die Redaktion, ADMIN fuer die
 * Administrationsseite. Bis KAN-82 waren die eigenen Projekte auf STUDENT
 * und EDITOR eingegrenzt; seither ist ADMIN die Obermenge und faehrt sein
 * eigenes Portfolio wie jedes andere Konto.
 *
 * /projects/new steht bewusst vor /projects/:projectId, sonst wuerde "new"
 * als Projekt-ID gelesen.
 *
 * Die 404-Auffangroute steht als letzte Route ausserhalb der Layout-Route
 * (Template ohne NavBar, eigene Fusszeile); ebenfalls ausserhalb liegt der
 * Editor, der mit dem EditorHeader eine eigene Kopfzeile fuehrt. Alle
 * uebrigen Seitenrouten liegen im Anwendungsrahmen.
 *
 * /dev/tokens und /dev/components sind die Pruefflaechen aus KAN-6 und
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
        element: <RequireAuth />,
        children: [
          {
            /* Legt das Projekt mit einem vorlaeufigen Titel an und fuehrt
               sofort auf seine Metadatenseite (KAN-35). Kein eigenes
               Anlegeformular: es zeigte dieselben Felder ein zweites Mal. */
            path: "/projects/new",
            element: <NewProjectPage />,
          },
          {
            path: "/projects/:projectId/metadata",
            element: <ProjectMetadataPage />,
          },
        ],
      },
      {
        /* Oeffentlich, weil §5 veroeffentlichte Inhalte fuer alle lesbar
           macht; die engere Schranke fuer nicht veroeffentlichte Projekte
           liegt im Server (KAN-32). */
        path: "/projects/:projectId",
        element: <ProjectDetailPage />,
      },
      {
        /* Oeffentlich, weil §5 veroeffentlichte Inhalte fuer alle lesbar
           macht (KAN-34). */
        path: "/portfolios/:userId",
        element: <PublicPortfolioPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "/my-portfolio", element: <MyPortfolioPage /> },
          { path: "/my-portfolio/profile", element: <ProfileEditPage /> },
        ],
      },
      {
        element: <RequireRole roles={["EDITOR", "ADMIN"]} />,
        children: [
          {
            /* Der Arbeitsplatz der Redaktion (KAN-37). Die Rollenschranke
               ist Bequemlichkeit; welche Projekte erscheinen, entscheidet
               der Server ueber editor=me (§5 Fussnote 11). */
            path: "/reviews",
            element: <ReviewListPage />,
          },
          {
            /* Der Review-Modus bleibt im Anwendungsrahmen: das Template
               zeichnet NavBar und Ruecksprungleiste, nicht das rahmenlose
               EditorLayout (KAN-37). */
            path: "/projects/:projectId/review",
            element: <ProjectReviewPage />,
          },
        ],
      },
      {
        element: <RequireRole roles={["ADMIN"]} />,
        children: [
          {
            /* Der Rahmen der Administrationsseite mit der Seitennavigation
               (KAN-38). Er liegt im Anwendungsrahmen und nicht daneben:
               beide Frames zeichnen NavBar und Fusszeile, anders als beim
               Editor. Die noch offenen Bereiche behalten ihren Platzhalter,
               erscheinen aber innerhalb desselben Rahmens, damit die
               Navigation von jeder Admin-Seite aus vollstaendig ist. */
            path: "/administration",
            element: <AdministrationLayout />,
            children: [
              { index: true, element: <AdminDashboardRoute /> },
              { path: "projects", element: <AdminProjectListRoute /> },
              { path: "users", element: <AdminUserListRoute /> },
              { path: "categories", element: <AdminCategoryListRoute /> },
              {
                /* Der siebte Eintrag der Figma-Komponente Sidebar, am
                   17.08.2026 zwischen Kategorien und Studienstruktur
                   dazugekommen (Confluence "Template-Abdeckung"). Die
                   Oberflaeche steht seit KAN-39, das Backend seit KAN-65. */
                path: "semesters",
                element: <AdminSemesterListRoute />,
              },
              {
                path: "study-structure",
                element: <AdminStudyStructureRoute />,
              },
              {
                /* Das Protokoll liegt unter der Top-10-Verwaltung, weil es
                   deren Verlauf zeigt; die Verwaltung selbst ist die
                   Index-Route (Ticket KAN-7, Umfang 2). */
                path: "top10",
                children: [
                  { index: true, element: <AdminTop10Route /> },
                  { path: "audit", element: <AdminTop10AuditRoute /> },
                ],
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
    /* Der blockbasierte Editor (KAN-36) liegt ausserhalb des
       Anwendungsrahmens: die Schreibflaeche fuehrt mit dem EditorHeader
       eine eigene Kopfzeile samt Zurueck-Weg, NavBar und Footer entfallen
       dort. Das EditorLayout steht ueber der Zugriffsschranke und gibt der
       Route damit ihre main-Landmarke, auch waehrend die Schranke noch
       entscheidet. Bis KAN-82 trug dieselbe Reihenfolge zusaetzlich eine
       sichtbare Zugriffsmeldung im Rahmen; die kann hier nicht mehr
       entstehen, seit RequireAuth statt RequireRole steht und in beiden
       Fehlfaellen umleitet. Die Schranke ist dieselbe wie an den
       Metadatenseiten: seit KAN-82 genuegt die Anmeldung, weil jede Rolle
       eigene Projekte fuehren kann. Die Ressourcenebene (Autor:in oder
       Projektmitglied) prueft der Server (§5). */
    element: <EditorLayout />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            path: "/projects/:projectId/editor",
            element: <EditorRoute />,
          },
        ],
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
