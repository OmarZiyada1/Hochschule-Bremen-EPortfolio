import { lazy, Suspense, type ComponentType } from "react"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Die Seiten der Administrationsseite als eigener Chunk (KAN-38, erweitert
 * mit KAN-39), nach demselben Muster und aus demselben Grund wie der Editor
 * ({@code EditorRoute}).
 *
 * <p><strong>Warum nachgeladen wird.</strong> Die Startansicht zieht ueber die
 * Karte „Projekt je Fakultäten" die Diagrammbibliothek mit, nach ProseMirror
 * die zweitgroesste Abhaengigkeit des Frontends. Stuende sie im Hauptbuendel,
 * luede jede Besucherin der oeffentlichen Startseite sie mit, obwohl der
 * Bereich ausschliesslich fuer ADMIN erreichbar ist; gemessen waren das rund
 * 280 kB. Die Projektverwaltung liegt aus Nachbarschaft im selben Chunk: wer
 * eine der beiden Seiten oeffnet, oeffnet meist auch die andere, und zwei
 * Chunks fuer denselben Bereich brauchten zwei Ladevorgaenge.
 *
 * <p>Eigene Datei, weil {@code routes/index.tsx} den Routenbaum ausgibt und
 * keine Komponente; beides in einer Datei bricht das Fast Refresh der
 * Entwicklungsumgebung.
 */
const AdminDashboardPage = lazy(
  () => import("@/features/administration/AdminDashboardPage")
)
const AdminProjectListPage = lazy(
  () => import("@/features/administration/AdminProjectListPage")
)
const AdminUserListPage = lazy(
  () => import("@/features/administration/AdminUserListPage")
)
const AdminCategoryListPage = lazy(
  () => import("@/features/administration/AdminCategoryListPage")
)
const AdminSemesterListPage = lazy(
  () => import("@/features/administration/AdminSemesterListPage")
)
const AdminStudyStructurePage = lazy(
  () => import("@/features/administration/AdminStudyStructurePage")
)
const AdminTop10Page = lazy(
  () => import("@/features/administration/AdminTop10Page")
)
const AdminTop10AuditPage = lazy(
  () => import("@/features/administration/AdminTop10AuditPage")
)
const AdminSupportListPage = lazy(
  () => import("@/features/administration/AdminSupportListPage")
)
const AdminSiteContentPage = lazy(
  () => import("@/features/administration/AdminSiteContentPage")
)

/**
 * Derselbe Umriss wie der Ladezustand der Seiten selbst, damit der Wechsel
 * vom Chunk zum ersten Rendern nicht springt: Kopfbereich, dann eine breite
 * Flaeche.
 */
function AdministrationFallback() {
  return (
    <>
      <Skeleton className="h-12 w-1/2 rounded-control" />
      <Skeleton className="h-64 rounded-card" />
    </>
  )
}

function withFallback(Page: ComponentType) {
  return (
    <Suspense fallback={<AdministrationFallback />}>
      <Page />
    </Suspense>
  )
}

export function AdminDashboardRoute() {
  return withFallback(AdminDashboardPage)
}

export function AdminProjectListRoute() {
  return withFallback(AdminProjectListPage)
}

export function AdminUserListRoute() {
  return withFallback(AdminUserListPage)
}

export function AdminCategoryListRoute() {
  return withFallback(AdminCategoryListPage)
}

export function AdminSemesterListRoute() {
  return withFallback(AdminSemesterListPage)
}

export function AdminStudyStructureRoute() {
  return withFallback(AdminStudyStructurePage)
}

export function AdminTop10Route() {
  return withFallback(AdminTop10Page)
}

export function AdminTop10AuditRoute() {
  return withFallback(AdminTop10AuditPage)
}

export function AdminSupportListRoute() {
  return withFallback(AdminSupportListPage)
}

export function AdminSiteContentRoute() {
  return withFallback(AdminSiteContentPage)
}
