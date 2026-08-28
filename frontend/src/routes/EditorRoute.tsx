import { lazy, Suspense } from "react"
import { useParams } from "react-router-dom"

import { Skeleton } from "@/components/ui/skeleton"
import { EditLockGate } from "@/features/project-content/components/EditLockGate"

/**
 * Der Editor als eigener Chunk (KAN-36).
 *
 * <p><strong>Ohne NavBar und Footer:</strong> den Rahmen fuehrt das
 * EditorLayout, das im Routenbaum ueber der Rollenschranke liegt und
 * dort begruendet ist.
 *
 * <p><strong>Die einzige nachgeladene Route, und das hat einen Grund.</strong>
 * Der Editor zieht ueber {@code createEditorExtensions} das gesamte
 * ProseMirror-Buendel mit, die groesste einzelne Abhaengigkeit des
 * Frontends. Stuende er im Hauptbuendel, luede jede Besucherin der
 * oeffentlichen Startseite ihn mit, obwohl sie ihn nie oeffnet. Genau davor
 * bewahrt schon der eigene JSON-Renderer des Lesepfads (KAN-10); ein
 * statischer Import im Routenbaum machte das wieder zunichte.
 *
 * <p><strong>Die Bearbeitungssperre sitzt vor der Seite</strong> (§6.9,
 * KAN-86) und nicht in ihr: haelt jemand anders, entsteht die Schreibflaeche
 * gar nicht erst, und das ProseMirror-Buendel wird nicht ausgepackt. Hier
 * laufen alle Wege in den Editor zusammen, auch das Lesezeichen und die
 * eingetippte Adresse.
 *
 * <p>Eigene Datei, weil {@code routes/index.tsx} den Routenbaum ausgibt und
 * keine Komponente; beides in einer Datei bricht das Fast Refresh der
 * Entwicklungsumgebung.
 */
const EditorPage = lazy(() => import("@/features/project-content/EditorPage"))

export function EditorRoute() {
  const { projectId = "" } = useParams()

  /* Derselbe Umriss wie der Ladezustand der Seite selbst, damit weder der
     Wechsel vom Chunk zum ersten Rendern noch das Warten auf die Sperre
     springt. */
  const skeleton = (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <Skeleton className="h-12 w-1/2 rounded-control" />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    </div>
  )

  return (
    <EditLockGate projectId={projectId} fallback={skeleton}>
      <Suspense fallback={skeleton}>
        <EditorPage />
      </Suspense>
    </EditLockGate>
  )
}
