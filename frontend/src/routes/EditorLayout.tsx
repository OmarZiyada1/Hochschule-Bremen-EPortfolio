import { Outlet } from "react-router-dom"

/**
 * Rahmen der Editor-Route: bewusst ohne NavBar und Footer. Die
 * Schreibflaeche fuehrt mit dem EditorHeader eine eigene Kopfzeile samt
 * Zurueck-Weg, und die volle Hoehe gehoert dem Inhalt.
 *
 * Der Rahmen liegt im Routenbaum ueber der Rollenschranke und nicht
 * darunter: RequireRole rendert bei falscher Rolle die AccessDeniedPage
 * anstelle des Outlets, und laege der Rahmen im Outlet-Zweig, stuende
 * genau diese Meldung als einzige Flaeche der Anwendung ohne
 * main-Landmarke da (Befund aus dem Review zu dieser Aenderung).
 *
 * Ein Sprunglink entfaellt wie im AuthLayout: er springt ueber die
 * wiederholte Navigation hinweg, und die gibt es hier nicht (SC 2.4.1).
 * main bleibt als Landmarke stehen, wie im AuthLayout; anders als im
 * Anwendungsrahmen liegt die Kopfzeile des Editors innerhalb von main
 * und ist deshalb keine banner-Landmarke.
 */
export function EditorLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <main id="content" className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
