import { Outlet, ScrollRestoration } from "react-router-dom"

/**
 * Die aeusserste Route: sie stellt die Bildlaufposition wieder her und
 * rendert sonst nichts (KAN-83).
 *
 * <p><strong>Das Problem.</strong> Ein Browser merkt sich die Position je
 * Verlaufseintrag, aber nur bei echten Seitenwechseln. Eine
 * Einzelseitenanwendung tauscht den Inhalt aus, ohne das Dokument zu
 * verlassen; die Position blieb deshalb einfach stehen. Wer weit unten in
 * einer Projektliste eine Kachel anklickte, landete im Projekt ebenfalls weit
 * unten, oft mitten im Beitrag oder unterhalb seines Endes.
 *
 * <p><strong>Warum die Bibliotheksloesung und kein eigener Effekt.</strong>
 * {@code ScrollRestoration} unterscheidet, was ein eigener
 * {@code useEffect(() =&gt; window.scrollTo(0, 0), [pathname])} nicht
 * unterscheiden kann: Vorwaertsnavigation von Zurueckkehren. Der Schluessel
 * ist {@code location.key}, und den vergibt der Router je Verlaufseintrag neu.
 * Ein PUSH bekommt einen frischen Schluessel, zu dem keine Position
 * gespeichert ist, und beginnt oben; ein POP bekommt den alten Schluessel
 * zurueck und landet dort, wo man war. Genau diese Unterscheidung verlangt
 * der Punkt.
 *
 * <p><strong>Auch Seitenblaettern und Filterwechsel beginnen oben.</strong>
 * Sie laufen ueber {@code setSearchParams}, und der Router vergibt dabei einen
 * neuen {@code location.key}. Das gilt auch fuer die entprellte Suche, die
 * bewusst mit {@code replace: true} navigiert und damit gerade keinen
 * Verlaufseintrag anlegt: der Schluessel ist trotzdem neu, und die Liste
 * beginnt oben. Das ist gewollt: die Schaltflaechen zum Blaettern stehen am
 * Fuss der Liste, und wer auf „weiter" drueckt, will den Anfang der neuen
 * Trefferseite sehen und nicht deren Fuss. Wollte man das an einzelnen
 * Stellen anders, waere dort {@code preventScrollReset} zu setzen.
 *
 * <p><strong>Eine pfadlose Elternroute</strong>, damit es genau eine
 * Fundstelle gibt. In jedes der vier Layouts geschrieben waere dieselbe
 * Zusage viermal, und die 404-Route sowie die Entwicklungsflaechen liegen
 * ausserhalb aller Layouts und blieben ohne.
 */
export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}
