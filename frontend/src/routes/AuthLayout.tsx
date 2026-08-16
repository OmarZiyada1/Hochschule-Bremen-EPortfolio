import { Outlet } from "react-router-dom"

/**
 * Rahmen der Anmelde- und Registrierungsseiten: bewusst ohne NavBar und
 * Footer, das Figma-Template blendet beide dort aus (Review zu KAN-8; die
 * fruehere Festlegung aus der Klaerungsrunde zu KAN-7 ist damit ueberholt).
 *
 * Ein Sprunglink entfaellt hier nicht aus Nachlaessigkeit: er springt ueber
 * die Navigation hinweg, und ohne Navigation gibt es nichts zu ueberspringen
 * (SC 2.4.1 verlangt einen Block-Skip nur, wo wiederholte Bloecke sind).
 * main bleibt als Landmarke stehen, damit die Seitenstruktur fuer
 * Screenreader dieselbe ist wie im Anwendungsrahmen.
 *
 * Der Rahmen zentriert nichts mehr selbst, sondern reicht nur die Hoehe
 * durch: die Login-Vorlage setzt ueber die Karte eine Brotkrumenleiste, und
 * ein justify-center hier schoebe Leiste und Karte gemeinsam in die Mitte.
 * Die Seite bestimmt ihre Aufteilung deshalb selbst und bekommt mit flex-1
 * den Platz dafuer.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <main id="content" className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
